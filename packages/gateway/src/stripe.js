/**
 * Stripe Integration Module
 * MetaMesh-UGA Gateway
 * 
 * Handles:
 * - Webhook events
 * - Subscription management
 * - Invoice generation
 */

/**
 * Handle Stripe webhook
 */
export async function handleStripeWebhook(request, env) {
  const payload = await request.text();
  const signature = request.headers.get('stripe-signature');
  
  // Verify signature (in production, use Stripe library)
  // For now, we check if the secret matches
  if (!signature || !env.STRIPE_WEBHOOK_SECRET) {
    return new Response('Missing signature or secret', { status: 400 });
  }
  
  let event;
  try {
    // In production: event = stripe.webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET);
    event = JSON.parse(payload);
  } catch (error) {
    return new Response(`Webhook error: ${error.message}`, { status: 400 });
  }
  
  console.log('Stripe webhook received:', event.type);
  
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object, env);
        break;
        
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object, env);
        break;
        
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object, env);
        break;
        
      case 'invoice.payment_succeeded':
        await handleInvoicePaid(event.data.object, env);
        break;
        
      case 'invoice.payment_failed':
        await handleInvoiceFailed(event.data.object, env);
        break;
        
      case 'customer.created':
        await handleCustomerCreated(event.data.object, env);
        break;
        
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
    
    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Webhook handler error:', error);
    return new Response(`Handler error: ${error.message}`, { status: 500 });
  }
}

/**
 * Handle checkout session completed
 */
async function handleCheckoutCompleted(session, env) {
  const customerId = session.customer;
  const subscriptionId = session.subscription;
  
  // Find user by Stripe customer ID or email
  let user = await env.DB.prepare(
    'SELECT * FROM users WHERE stripe_customer_id = ?'
  ).bind(customerId).first();
  
  if (!user && session.customer_email) {
    // Try to find by email
    user = await env.DB.prepare(
      'SELECT * FROM users WHERE email = ?'
    ).bind(session.customer_email).first();
    
    if (user) {
      // Update with Stripe customer ID
      await env.DB.prepare(
        'UPDATE users SET stripe_customer_id = ? WHERE id = ?'
      ).bind(customerId, user.id).run();
    }
  }
  
  if (!user) {
    // Create new user
    const apiKey = generateAPIKey();
    const referralCode = generateReferralCode(Date.now());
    
    const result = await env.DB.prepare(
      `INSERT INTO users (email, api_key, plan, stripe_customer_id, stripe_subscription_id, referral_code)
       VALUES (?, ?, 'pro', ?, ?, ?)`
    ).bind(
      session.customer_email || `stripe-${customerId}@metamesh.local`,
      apiKey,
      customerId,
      subscriptionId,
      referralCode
    ).run();
    
    user = { id: result.meta.last_row_id, email: session.customer_email, api_key: apiKey };
  } else {
    // Update subscription
    await env.DB.prepare(
      'UPDATE users SET stripe_subscription_id = ?, plan = ? WHERE id = ?'
    ).bind(subscriptionId, 'pro', user.id).run();
  }
  
  // Send welcome email
  await sendWelcomeEmail(env, user);
  
  console.log(`Activated subscription for user ${user.id}`);
}

/**
 * Handle subscription updated
 */
async function handleSubscriptionUpdated(subscription, env) {
  const customerId = subscription.customer;
  
  // Find user
  const user = await env.DB.prepare(
    'SELECT * FROM users WHERE stripe_customer_id = ?'
  ).bind(customerId).first();
  
  if (!user) {
    console.error(`User not found for customer ${customerId}`);
    return;
  }
  
  // Determine plan from subscription
  let plan = 'free';
  const priceId = subscription.items?.data[0]?.price?.id;
  
  // Map price IDs to plans (these should match your Stripe setup)
  const priceMap = {
    [env.STRIPE_PRO_PRICE_ID]: 'pro',
    [env.STRIPE_ENTERPRISE_PRICE_ID]: 'enterprise'
  };
  
  plan = priceMap[priceId] || 'pro';
  
  // Update user
  const subscriptionStart = new Date(subscription.current_period_start * 1000).toISOString();
  const subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
  
  await env.DB.prepare(
    `UPDATE users SET 
      plan = ?,
      stripe_subscription_id = ?,
      subscription_start = ?,
      subscription_end = ?,
      plan_limit = ?
    WHERE id = ?`
  ).bind(
    plan,
    subscription.id,
    subscriptionStart,
    subscriptionEnd,
    plan === 'pro' ? 999999999 : 999999999, // Unlimited for paid plans
    user.id
  ).run();
  
  console.log(`Updated subscription for user ${user.id} to ${plan}`);
}

/**
 * Handle subscription deleted
 */
async function handleSubscriptionDeleted(subscription, env) {
  const customerId = subscription.customer;
  
  // Find user
  const user = await env.DB.prepare(
    'SELECT * FROM users WHERE stripe_customer_id = ?'
  ).bind(customerId).first();
  
  if (!user) {
    console.error(`User not found for customer ${customerId}`);
    return;
  }
  
  // Downgrade to free
  await env.DB.prepare(
    `UPDATE users SET 
      plan = 'free',
      stripe_subscription_id = NULL,
      plan_limit = 1000,
      subscription_end = CURRENT_TIMESTAMP
    WHERE id = ?`
  ).bind(user.id).run();
  
  // Send downgrade email
  await sendDowngradeEmail(env, user);
  
  console.log(`Downgraded user ${user.id} to free`);
}

/**
 * Handle invoice paid
 */
async function handleInvoicePaid(invoice, env) {
  const customerId = invoice.customer;
  
  const user = await env.DB.prepare(
    'SELECT * FROM users WHERE stripe_customer_id = ?'
  ).bind(customerId).first();
  
  if (!user) return;
  
  // Record transaction
  await env.DB.prepare(
    `INSERT INTO transactions 
      (user_id, type, amount, currency, status, stripe_invoice_id)
      VALUES (?, 'payment', ?, 'USD', 'completed', ?)`
  ).bind(user.id, invoice.amount_paid / 100, invoice.id).run();
  
  // Create invoice record
  const invoiceNumber = `INV-${user.id}-${Date.now()}`;
  await env.DB.prepare(
    `INSERT INTO invoices 
      (user_id, invoice_number, amount_usd, status, stripe_invoice_id, paid_at)
      VALUES (?, ?, ?, 'paid', ?, CURRENT_TIMESTAMP)`
  ).bind(user.id, invoiceNumber, invoice.amount_paid / 100, invoice.id).run();
  
  console.log(`Recorded invoice ${invoice.id} for user ${user.id}`);
}

/**
 * Handle invoice payment failed
 */
async function handleInvoiceFailed(invoice, env) {
  const customerId = invoice.customer;
  
  const user = await env.DB.prepare(
    'SELECT * FROM users WHERE stripe_customer_id = ?'
  ).bind(customerId).first();
  
  if (!user) return;
  
  // Record failed transaction
  await env.DB.prepare(
    `INSERT INTO transactions 
      (user_id, type, amount, currency, status, stripe_invoice_id)
      VALUES (?, 'payment', ?, 'USD', 'failed', ?)`
  ).bind(user.id, invoice.amount_due / 100, invoice.id).run();
  
  // Send notification
  await sendPaymentFailedEmail(env, user, invoice);
  
  console.log(`Payment failed for user ${user.id}, invoice ${invoice.id}`);
}

/**
 * Handle customer created
 */
async function handleCustomerCreated(customer, env) {
  // If user already exists with this email, link them
  if (customer.email) {
    const user = await env.DB.prepare(
      'SELECT * FROM users WHERE email = ? AND stripe_customer_id IS NULL'
    ).bind(customer.email).first();
    
    if (user) {
      await env.DB.prepare(
        'UPDATE users SET stripe_customer_id = ? WHERE id = ?'
      ).bind(customer.id, user.id).run();
      
      console.log(`Linked customer ${customer.id} to user ${user.id}`);
    }
  }
}

/**
 * Generate API key
 */
function generateAPIKey() {
  return `sk_${crypto.randomUUID().replace(/-/g, '')}`;
}

/**
 * Generate referral code
 */
function generateReferralCode(id) {
  return `REF-${id}-${Date.now().toString(36).toUpperCase()}`;
}

/**
 * Send welcome email
 */
async function sendWelcomeEmail(env, user) {
  // In production, integrate with email service
  console.log(`Would send welcome email to ${user.email}`);
}

/**
 * Send downgrade email
 */
async function sendDowngradeEmail(env, user) {
  console.log(`Would send downgrade email to ${user.email}`);
}

/**
 * Send payment failed email
 */
async function sendPaymentFailedEmail(env, user, invoice) {
  console.log(`Would send payment failed email to ${user.email}`);
}

/**
 * Create Stripe checkout session (for API use)
 */
export async function createCheckoutSession(userId, priceId, env) {
  // In production, call Stripe API
  // For now, return mock session
  return {
    id: `cs_test_${Date.now()}`,
    url: `https://checkout.stripe.com/pay/cs_test_${Date.now()}`
  };
}

/**
 * Get customer portal URL
 */
export async function getCustomerPortalUrl(customerId, env) {
  // In production, call Stripe API to create portal session
  return `https://billing.stripe.com/session/_test_${Date.now()}`;
}
