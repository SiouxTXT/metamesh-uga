// MetaMesh-UGA — AI Agent prepaid-credit billing (Stripe-funded).
//
// Model (Option A):
//   1. Agent registers      -> agent_id + api_key + pseudo wallet address
//   2. Agent tops up balance -> Stripe Checkout -> webhook credits balance_usd
//   3. Agent calls a tool    -> per-call price debited from balance_usd
//   4. Insufficient balance  -> HTTP 402 with a top-up link
//
// x402 crypto (USDC on-chain) remains available as an alternative payment path.

import { createTopupCheckout, verifyStripeWebhook, stripeConfigured } from './stripe-api.js';

const DEFAULT_PRICE_USD = 0.001;
const MIN_TOPUP_USD = 1;
const MAX_TOPUP_USD = 10000;

function uuid() {
  return crypto.randomUUID();
}

function genApiKey() {
  return `ak_${uuid().replace(/-/g, '')}`;
}

// Generate a pseudo EVM address for agents that only use Stripe credit.
function genWalletAddress() {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return '0x' + [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function dashboardBase(env) {
  return (env.PUBLIC_DASHBOARD_URL || 'https://dashboard.metamesh-uga.dev').replace(/\/$/, '');
}

// Identify and authenticate an agent from request headers.
// Accepts X-Agent-Id + X-Agent-Key (or Authorization: Bearer <api_key>).
export async function authenticateAgent(env, request) {
  const agentId = request.headers.get('X-Agent-Id');
  let apiKey = request.headers.get('X-Agent-Key');
  if (!apiKey) {
    const auth = request.headers.get('Authorization');
    if (auth && auth.startsWith('Bearer ')) apiKey = auth.slice(7);
  }
  if (!agentId || !apiKey) return null;

  const agent = await env.DB.prepare(
    'SELECT * FROM agents WHERE agent_id = ? AND api_key = ?'
  ).bind(agentId, apiKey).first();
  return agent || null;
}

// POST /v1/agent/register
export async function registerAgent(request, env) {
  let body = {};
  try { body = await request.json(); } catch (_e) { /* allow empty */ }

  const name = (body.name || 'Unnamed Agent').toString().slice(0, 120);
  const email = body.email ? body.email.toString().slice(0, 200) : null;

  const agentId = `agent_${uuid().replace(/-/g, '')}`;
  const apiKey = genApiKey();
  const wallet = genWalletAddress();

  try {
    await env.DB.prepare(
      `INSERT INTO agents (agent_id, wallet_address, email, name, plan, api_key, balance_usd, budget_limit_usd)
       VALUES (?, ?, ?, ?, 'pay_as_you_go', ?, 0, 0)`
    ).bind(agentId, wallet, email, name, apiKey).run();
  } catch (e) {
    return json({ error: `Registration failed: ${e.message}` }, 500);
  }

  return json({
    success: true,
    agent_id: agentId,
    api_key: apiKey,
    wallet_address: wallet,
    plan: 'pay_as_you_go',
    balance_usd: 0,
    note: 'Store your api_key securely — it is shown only once. Send it as X-Agent-Key (with X-Agent-Id) on calls.',
    next_steps: {
      topup: 'POST /v1/agent/topup { amount_usd } with X-Agent-Id + X-Agent-Key',
      call: 'POST /v1/call with X-Agent-Id + X-Agent-Key to debit per-call pricing'
    }
  }, 201);
}

// GET /v1/agent/wallet
export async function getWallet(request, env) {
  const agent = await authenticateAgent(env, request);
  if (!agent) return json({ error: 'Unauthorized: provide X-Agent-Id and X-Agent-Key' }, 401);

  return json({
    agent_id: agent.agent_id,
    name: agent.name,
    plan: agent.plan,
    wallet_address: agent.wallet_address,
    balance_usd: Number(agent.balance_usd || 0),
    budget_limit_usd: Number(agent.budget_limit_usd || 0),
    current_spent_usd: Number(agent.current_spent_usd || 0),
    total_spent_usd: Number(agent.total_spent_usd || 0),
    suspended: !!agent.suspended,
    suspended_reason: agent.suspended_reason || null
  });
}

// GET /v1/agent/transactions
export async function getTransactions(request, env) {
  const agent = await authenticateAgent(env, request);
  if (!agent) return json({ error: 'Unauthorized: provide X-Agent-Id and X-Agent-Key' }, 401);

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);

  const rows = await env.DB.prepare(
    `SELECT type, amount, currency, chain, status, tx_hash, stripe_payment_intent_id, created_at
     FROM transactions WHERE agent_id = ? ORDER BY created_at DESC LIMIT ?`
  ).bind(agent.id, limit).all();

  return json({
    agent_id: agent.agent_id,
    balance_usd: Number(agent.balance_usd || 0),
    count: (rows.results || []).length,
    transactions: rows.results || []
  });
}

// POST /v1/agent/topup  { amount_usd }
export async function createTopup(request, env) {
  const agent = await authenticateAgent(env, request);
  if (!agent) return json({ error: 'Unauthorized: provide X-Agent-Id and X-Agent-Key' }, 401);

  if (!stripeConfigured(env)) {
    return json({
      error: 'Stripe not configured',
      hint: 'Operator must set the STRIPE_SECRET_KEY secret (wrangler secret put STRIPE_SECRET_KEY).'
    }, 503);
  }

  let body = {};
  try { body = await request.json(); } catch (_e) { /* ignore */ }
  const amountUsd = Number(body.amount_usd);
  if (!amountUsd || amountUsd < MIN_TOPUP_USD || amountUsd > MAX_TOPUP_USD) {
    return json({ error: `amount_usd must be between ${MIN_TOPUP_USD} and ${MAX_TOPUP_USD}` }, 400);
  }

  const base = dashboardBase(env);
  try {
    const session = await createTopupCheckout(env, {
      agentId: agent.agent_id,
      amountUsd,
      customerId: agent.stripe_customer_id || undefined,
      successUrl: `${base}/agent?topup=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${base}/agent?topup=cancelled`
    });

    // Record a pending top-up for reconciliation.
    await env.DB.prepare(
      `INSERT INTO transactions (agent_id, type, amount, currency, status, stripe_payment_intent_id, metadata)
       VALUES (?, 'topup', ?, 'USD', 'pending', ?, ?)`
    ).bind(agent.id, amountUsd, session.payment_intent || session.id, JSON.stringify({ checkout_session: session.id })).run();

    return json({
      success: true,
      checkout_url: session.url,
      session_id: session.id,
      amount_usd: amountUsd,
      message: 'Open checkout_url to complete payment. Balance is credited via webhook on success.'
    });
  } catch (e) {
    return json({ error: `Stripe checkout failed: ${e.message}` }, 502);
  }
}

// Look up per-call price for a tool (USD).
async function getToolPriceUsd(env, toolName) {
  try {
    const row = await env.DB.prepare(
      'SELECT price_per_call_usd, x402_enabled FROM tool_pricing WHERE tool_name = ?'
    ).bind(toolName).first();
    if (row) {
      return {
        priceUsd: Number(row.price_per_call_usd) || DEFAULT_PRICE_USD,
        enabled: row.x402_enabled !== 0
      };
    }
  } catch (_e) { /* default */ }
  return { priceUsd: DEFAULT_PRICE_USD, enabled: true };
}

// ---- Freemium free-tier metering (per identity, per calendar month) ----

const DEFAULT_FREE_MONTHLY_CALLS = 100;

function currentPeriod() {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

// Stable, privacy-preserving fingerprint for anonymous callers (IP + UA hash).
async function anonFingerprint(request) {
  const ip = request.headers.get('CF-Connecting-IP') ||
    (request.headers.get('X-Forwarded-For') || '').split(',')[0].trim() ||
    'unknown';
  const ua = request.headers.get('User-Agent') || '';
  const data = new TextEncoder().encode(`${ip}|${ua}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].slice(0, 10).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getFreeUsage(env, key) {
  if (!env.CACHE) return 0;
  try {
    const v = await env.CACHE.get(key);
    return v ? parseInt(v, 10) || 0 : 0;
  } catch (_e) { return 0; }
}

async function incrFreeUsage(env, key, current) {
  if (!env.CACHE) return;
  try {
    // 40-day TTL so monthly buckets self-expire. KV is eventually consistent;
    // a tiny over/under count at the boundary is acceptable for a free tier.
    await env.CACHE.put(key, String(current + 1), { expirationTtl: 60 * 60 * 24 * 40 });
  } catch (_e) { /* non-fatal */ }
}

// Freemium enforcement for one priced tool call. Used by BOTH the REST
// /v1/call endpoint and the MCP /mcp tools/call handler so behaviour is
// identical for HTTP clients and MCP agents:
//   1. Discovery / unpriced tools are always free (handled by callers).
//   2. Every identity gets a free monthly quota of tool calls.
//   3. After the quota: authenticated agents are charged from prepaid
//      balance; anonymous callers receive a 402 to register + top up or pay
//      via x402.
// Returns { ok:true, payment } or { ok:false, status, body }.
export async function enforceFreemium(env, { request, toolName }) {
  const { priceUsd, enabled } = await getToolPriceUsd(env, toolName);
  if (!enabled || priceUsd <= 0) {
    return { ok: true, payment: { method: 'free', reason: 'tool_not_priced' } };
  }

  const limit = Number(env.FREE_MONTHLY_CALLS || DEFAULT_FREE_MONTHLY_CALLS);
  const period = currentPeriod();
  const agent = await authenticateAgent(env, request);

  if (agent && agent.suspended) {
    return { ok: false, status: 403, body: { error: `Agent suspended: ${agent.suspended_reason || 'contact support'}` } };
  }

  const identity = agent ? `agent:${agent.agent_id}` : `ip:${await anonFingerprint(request)}`;
  const usageKey = `fq:${period}:${identity}`;
  const used = await getFreeUsage(env, usageKey);

  // Within the free quota: allow and meter.
  if (used < limit) {
    await incrFreeUsage(env, usageKey, used);
    return {
      ok: true,
      payment: {
        method: 'free-tier',
        period,
        free_calls_used: used + 1,
        free_calls_limit: limit,
        free_calls_remaining: Math.max(0, limit - used - 1),
        authenticated: !!agent
      }
    };
  }

  // Free quota exhausted. Authenticated agents pay from prepaid balance.
  if (agent) {
    return await debitAgentCredit(env, { request, toolName, agent, priceUsd });
  }

  // Anonymous caller, quota exhausted -> require payment.
  return {
    ok: false,
    status: 402,
    body: {
      error: 'Free tier exhausted — payment required',
      x402Version: 1,
      price_usd: priceUsd,
      free_calls_limit: limit,
      period,
      message: 'You have used your free monthly tool calls. Register an agent and top up (Stripe), or pay per call via x402.',
      accepts: [
        {
          scheme: 'prepaid-credit',
          register: 'POST /v1/agent/register',
          topup: 'POST /v1/agent/topup { amount_usd }'
        },
        {
          scheme: 'x402',
          info: 'GET /v1/x402/info',
          usage: 'Send an X-PAYMENT header (USDC on Base) to pay per call'
        }
      ]
    }
  };
}

// Atomically debit an agent's prepaid balance for one tool call.
// Returns { ok:true, payment } or { ok:false, status, body }.
export async function debitAgentCredit(env, { request, toolName, agent: knownAgent, priceUsd: knownPrice }) {
  const priceUsd = knownPrice != null
    ? knownPrice
    : (await getToolPriceUsd(env, toolName)).priceUsd;
  if (priceUsd <= 0) {
    return { ok: true, payment: { method: 'free', reason: 'tool_not_priced' } };
  }

  const agent = knownAgent || await authenticateAgent(env, request);
  if (!agent) {
    return {
      ok: false,
      status: 402,
      body: {
        error: 'Payment required',
        x402Version: 1,
        price_usd: priceUsd,
        accepts: [
          {
            scheme: 'prepaid-credit',
            description: 'Authenticate with X-Agent-Id + X-Agent-Key and maintain a positive USD balance.',
            register: 'POST /v1/agent/register',
            topup: 'POST /v1/agent/topup { amount_usd }'
          }
        ]
      }
    };
  }

  if (agent.suspended) {
    return { ok: false, status: 403, body: { error: `Agent suspended: ${agent.suspended_reason || 'contact support'}` } };
  }

  // Budget guard.
  const budget = Number(agent.budget_limit_usd || 0);
  const spent = Number(agent.current_spent_usd || 0);
  if (budget > 0 && spent + priceUsd > budget) {
    return { ok: false, status: 402, body: { error: 'Monthly budget limit reached', budget_limit_usd: budget, current_spent_usd: spent } };
  }

  // Insufficient funds.
  const balance = Number(agent.balance_usd || 0);
  if (balance < priceUsd) {
    return {
      ok: false,
      status: 402,
      body: {
        error: 'Insufficient balance',
        x402Version: 1,
        balance_usd: balance,
        price_usd: priceUsd,
        message: 'Your free quota is used up and your balance is too low. Top up to continue.',
        accepts: [{ scheme: 'prepaid-credit', topup: 'POST /v1/agent/topup { amount_usd }' }]
      }
    };
  }

  // Atomic debit guarded by balance check to prevent races/overdraft.
  const upd = await env.DB.prepare(
    `UPDATE agents
       SET balance_usd = balance_usd - ?,
           current_spent_usd = current_spent_usd + ?,
           total_spent_usd = total_spent_usd + ?,
           updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND balance_usd >= ?`
  ).bind(priceUsd, priceUsd, priceUsd, agent.id, priceUsd).run();

  if (!upd.meta || upd.meta.changes === 0) {
    return { ok: false, status: 402, body: { error: 'Insufficient balance (concurrent debit)', price_usd: priceUsd } };
  }

  // Record the payment + per-tool usage (best-effort).
  try {
    await env.DB.prepare(
      `INSERT INTO transactions (agent_id, type, amount, currency, status, metadata)
       VALUES (?, 'payment', ?, 'USD', 'completed', ?)`
    ).bind(agent.id, priceUsd, JSON.stringify({ tool: toolName })).run();

    await env.DB.prepare(
      `INSERT INTO agent_usage (agent_id, tool_name, call_count, total_spent_usd, last_called)
       VALUES (?, ?, 1, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(agent_id, tool_name) DO UPDATE SET
         call_count = call_count + 1,
         total_spent_usd = total_spent_usd + excluded.total_spent_usd,
         last_called = CURRENT_TIMESTAMP`
    ).bind(agent.id, toolName, priceUsd).run();
  } catch (_e) { /* non-fatal */ }

  return {
    ok: true,
    payment: {
      method: 'prepaid-credit',
      charged_usd: priceUsd,
      balance_after_usd: Number((balance - priceUsd).toFixed(6)),
      agent_id: agent.agent_id
    }
  };
}

// POST /v1/stripe/webhook  — credit balance on successful top-up.
export async function handleStripeWebhook(request, env) {
  const payload = await request.text();
  const sig = request.headers.get('Stripe-Signature') || request.headers.get('stripe-signature');

  let event;
  try {
    event = await verifyStripeWebhook(payload, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    return new Response(`Webhook verification failed: ${e.message}`, { status: 400 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const meta = session.metadata || {};
      if (meta.type === 'agent_topup' && session.payment_status === 'paid') {
        const agentId = meta.agent_id || session.client_reference_id;
        const amountUsd = (session.amount_total || 0) / 100;
        await creditAgent(env, agentId, amountUsd, session.payment_intent || session.id, session.customer);
      }
    }
    return json({ received: true });
  } catch (e) {
    return new Response(`Handler error: ${e.message}`, { status: 500 });
  }
}

// Credit an agent's balance and reconcile the pending top-up transaction.
async function creditAgent(env, agentId, amountUsd, paymentIntentId, customerId) {
  const agent = await env.DB.prepare('SELECT id FROM agents WHERE agent_id = ?').bind(agentId).first();
  if (!agent) {
    console.error(`Top-up for unknown agent ${agentId}`);
    return;
  }

  // Idempotency: skip if this payment intent was already completed.
  const existing = await env.DB.prepare(
    "SELECT id FROM transactions WHERE stripe_payment_intent_id = ? AND status = 'completed'"
  ).bind(paymentIntentId).first();
  if (existing) return;

  await env.DB.prepare(
    'UPDATE agents SET balance_usd = balance_usd + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).bind(amountUsd, agent.id).run();

  if (customerId) {
    await env.DB.prepare('UPDATE agents SET stripe_customer_id = ? WHERE id = ?').bind(customerId, agent.id).run();
  }

  // Mark the pending top-up completed, or insert one if missing.
  const pending = await env.DB.prepare(
    "SELECT id FROM transactions WHERE stripe_payment_intent_id = ? AND type = 'topup' ORDER BY created_at DESC LIMIT 1"
  ).bind(paymentIntentId).first();

  if (pending) {
    await env.DB.prepare("UPDATE transactions SET status = 'completed' WHERE id = ?").bind(pending.id).run();
  } else {
    await env.DB.prepare(
      `INSERT INTO transactions (agent_id, type, amount, currency, status, stripe_payment_intent_id)
       VALUES (?, 'topup', ?, 'USD', 'completed', ?)`
    ).bind(agent.id, amountUsd, paymentIntentId).run();
  }

  console.log(`Credited $${amountUsd} to agent ${agentId}`);
}
