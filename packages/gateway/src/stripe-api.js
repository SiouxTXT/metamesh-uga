// MetaMesh-UGA — Real Stripe REST integration (Workers-native, no SDK).
// Uses fetch against api.stripe.com with x-www-form-urlencoded bodies, and
// Web Crypto for webhook signature verification.

const STRIPE_BASE = 'https://api.stripe.com/v1';

// Encode a nested object into Stripe's bracketed form syntax.
// e.g. { line_items: [{ price_data: { currency: 'usd' } }] }
//   -> line_items[0][price_data][currency]=usd
function encodeForm(obj, prefix = '', pairs = []) {
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;
    const field = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (typeof item === 'object') encodeForm(item, `${field}[${i}]`, pairs);
        else pairs.push(`${encodeURIComponent(`${field}[${i}]`)}=${encodeURIComponent(item)}`);
      });
    } else if (typeof value === 'object') {
      encodeForm(value, field, pairs);
    } else {
      pairs.push(`${encodeURIComponent(field)}=${encodeURIComponent(value)}`);
    }
  }
  return pairs;
}

export function stripeConfigured(env) {
  return typeof env.STRIPE_SECRET_KEY === 'string' && env.STRIPE_SECRET_KEY.startsWith('sk_');
}

// Low-level Stripe API call. Returns parsed JSON; throws on non-2xx.
export async function stripeRequest(env, method, path, body) {
  if (!stripeConfigured(env)) {
    throw new Error('STRIPE_SECRET_KEY not configured');
  }
  const headers = {
    Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
    'Content-Type': 'application/x-www-form-urlencoded'
  };
  const init = { method, headers };
  if (body) init.body = encodeForm(body).join('&');

  const res = await fetch(`${STRIPE_BASE}${path}`, init);
  const json = await res.json();
  if (!res.ok) {
    const msg = json?.error?.message || `Stripe API error ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

// Create a Checkout Session for a one-time agent wallet top-up.
export async function createTopupCheckout(env, { agentId, amountUsd, successUrl, cancelUrl, customerId }) {
  const amountCents = Math.round(amountUsd * 100);
  const body = {
    mode: 'payment',
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: agentId,
    metadata: { type: 'agent_topup', agent_id: agentId },
    payment_intent_data: { metadata: { type: 'agent_topup', agent_id: agentId } },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: amountCents,
          product_data: {
            name: 'MetaMesh-UGA Agent Credit',
            description: `Prepaid API credit top-up for agent ${agentId}`
          }
        }
      }
    ]
  };
  if (customerId) body.customer = customerId;
  return stripeRequest(env, 'POST', '/checkout/sessions', body);
}

// --- Webhook signature verification (Stripe scheme v1, HMAC-SHA256) ---

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// Verify the `Stripe-Signature` header against the raw payload.
// Returns the parsed event on success, throws on failure.
export async function verifyStripeWebhook(payload, sigHeader, secret, toleranceSeconds = 300) {
  if (!sigHeader || !secret) throw new Error('Missing signature or webhook secret');

  const parts = Object.fromEntries(
    sigHeader.split(',').map(kv => kv.split('=').map(s => s.trim()))
  );
  const timestamp = parts['t'];
  const expected = parts['v1'];
  if (!timestamp || !expected) throw new Error('Malformed Stripe-Signature header');

  // Reject stale timestamps (replay protection).
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > toleranceSeconds) {
    throw new Error('Webhook timestamp outside tolerance');
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBuf = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${timestamp}.${payload}`)
  );
  const computed = toHex(signatureBuf);

  if (!timingSafeEqual(computed, expected)) {
    throw new Error('Webhook signature mismatch');
  }
  return JSON.parse(payload);
}
