// MetaMesh-UGA — x402 Payment Protocol (HTTP 402) implementation
// Spec: https://www.x402.org — "exact" scheme on EVM (Base) using USDC.
//
// Flow:
//   1. Client calls a paid resource with no payment  -> 402 + payment requirements.
//   2. Client retries with `X-PAYMENT` header (base64 JSON payment payload).
//   3. Gateway verifies (and settles) via a configurable facilitator, then serves.
//
// Activation is gated by env vars so free usage keeps working until configured:
//   X402_ENABLED         = "true" to enforce payments
//   X402_PAY_TO          = receiving wallet address (0x...)
//   X402_FACILITATOR_URL = facilitator base URL (e.g. https://x402.org/facilitator)
//   X402_NETWORK         = "base" (default) | "base-sepolia"
//   USDC_CONTRACT        = USDC contract on the chosen network

const DEFAULTS = {
  network: 'base',
  // Base mainnet USDC
  usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  usdcDecimals: 6,
  defaultPriceUsd: 0.001
};

export class X402 {
  constructor(env) {
    this.env = env;
    this.enabled = env.X402_ENABLED === 'true';
    this.payTo = env.X402_PAY_TO || null;
    this.facilitator = env.X402_FACILITATOR_URL || null;
    this.network = env.X402_NETWORK || DEFAULTS.network;
    this.usdc = env.USDC_CONTRACT || DEFAULTS.usdc;
  }

  // Whether enforcement is actually active (enabled + receiving wallet configured).
  isActive() {
    return this.enabled && !!this.payTo;
  }

  // Convert a USD/USDC price to the smallest unit (atomic) string.
  toAtomic(priceUsdc) {
    const atomic = Math.round(priceUsdc * 10 ** DEFAULTS.usdcDecimals);
    return String(atomic);
  }

  // Look up per-tool pricing from the DB (falls back to default).
  async getPrice(toolName) {
    try {
      const row = await this.env.DB.prepare(
        'SELECT price_per_call_usdc, x402_enabled, bulk_price, min_call_volume, discount_bulk FROM tool_pricing WHERE tool_name = ?'
      ).bind(toolName).first();
      if (row) {
        return {
          priceUsdc: Number(row.price_per_call_usdc) || DEFAULTS.defaultPriceUsd,
          x402Enabled: row.x402_enabled !== 0,
          bulkPrice: Number(row.bulk_price) || null,
          minVolume: row.min_call_volume || null
        };
      }
    } catch (_e) { /* table missing or error -> default */ }
    return { priceUsdc: DEFAULTS.defaultPriceUsd, x402Enabled: true, bulkPrice: null, minVolume: null };
  }

  // Build the standard 402 payment-requirements body.
  buildRequirements(resource, priceUsdc, description) {
    return {
      x402Version: 1,
      error: 'X-PAYMENT header required',
      accepts: [
        {
          scheme: 'exact',
          network: this.network,
          maxAmountRequired: this.toAtomic(priceUsdc),
          resource,
          description: description || `Access to ${resource}`,
          mimeType: 'application/json',
          payTo: this.payTo,
          maxTimeoutSeconds: 60,
          asset: this.usdc,
          extra: { name: 'USDC', version: '2', decimals: DEFAULTS.usdcDecimals }
        }
      ]
    };
  }

  // Decode the base64 X-PAYMENT header into a payment payload object.
  decodePaymentHeader(header) {
    try {
      const json = atob(header);
      return JSON.parse(json);
    } catch (_e) {
      return null;
    }
  }

  // Anti-replay: ensure the payment nonce has not been used before.
  async checkAndStoreNonce(nonce, agentId) {
    if (!nonce) return false;
    try {
      const existing = await this.env.DB.prepare(
        'SELECT nonce FROM used_nonces WHERE nonce = ?'
      ).bind(nonce).first();
      if (existing) return false; // replay

      const expires = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      await this.env.DB.prepare(
        'INSERT INTO used_nonces (nonce, agent_id, expires_at) VALUES (?, ?, ?)'
      ).bind(nonce, agentId || 'anonymous', expires).run();
      return true;
    } catch (_e) {
      return false;
    }
  }

  // Verify (and optionally settle) the payment through the facilitator.
  // Returns { valid, settled, txHash, reason }.
  async verifyWithFacilitator(paymentPayload, requirements) {
    if (!this.facilitator) {
      return { valid: false, settled: false, reason: 'facilitator_not_configured' };
    }
    try {
      const verifyRes = await fetch(`${this.facilitator.replace(/\/$/, '')}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x402Version: 1, paymentPayload, paymentRequirements: requirements.accepts[0] })
      });
      if (!verifyRes.ok) {
        return { valid: false, settled: false, reason: `verify_http_${verifyRes.status}` };
      }
      const verify = await verifyRes.json();
      if (!verify.isValid) {
        return { valid: false, settled: false, reason: verify.invalidReason || 'invalid_payment' };
      }

      // Settle on-chain.
      const settleRes = await fetch(`${this.facilitator.replace(/\/$/, '')}/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x402Version: 1, paymentPayload, paymentRequirements: requirements.accepts[0] })
      });
      const settle = settleRes.ok ? await settleRes.json() : {};
      return {
        valid: true,
        settled: !!settle.success,
        txHash: settle.transaction || settle.txHash || null,
        reason: settle.success ? null : (settle.errorReason || 'settlement_pending')
      };
    } catch (e) {
      return { valid: false, settled: false, reason: `facilitator_error:${e.message}` };
    }
  }

  // Record a payment transaction (best-effort).
  async recordTransaction(agentId, amountUsdc, txHash, status) {
    try {
      await this.env.DB.prepare(
        'INSERT INTO transactions (agent_id, type, amount, currency, chain, status, tx_hash) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(agentId || null, 'payment', amountUsdc, 'USDC', this.network, status, txHash || null).run();
    } catch (_e) { /* ignore */ }
  }
}

// Middleware: enforce payment for a tool call.
// Returns { ok: true, payment } to proceed, or { ok: false, response } with a 402/error.
export async function requirePayment(env, { request, toolName, resource }) {
  const x402 = new X402(env);

  // Not active -> free passthrough (records nothing).
  if (!x402.isActive()) {
    return { ok: true, payment: { enforced: false } };
  }

  const pricing = await x402.getPrice(toolName);
  if (!pricing.x402Enabled) {
    return { ok: true, payment: { enforced: false, reason: 'tool_free' } };
  }

  const requirements = x402.buildRequirements(resource, pricing.priceUsdc, `Call ${toolName}`);
  const paymentHeader = request.headers.get('X-PAYMENT');

  // No payment provided -> 402 with requirements.
  if (!paymentHeader) {
    return {
      ok: false,
      response: new Response(JSON.stringify(requirements, null, 2), {
        status: 402,
        headers: { 'Content-Type': 'application/json' }
      })
    };
  }

  const payload = x402.decodePaymentHeader(paymentHeader);
  if (!payload) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ ...requirements, error: 'Malformed X-PAYMENT header (expected base64 JSON)' }, null, 2),
        { status: 402, headers: { 'Content-Type': 'application/json' } }
      )
    };
  }

  // Anti-replay on nonce.
  const nonce = payload.nonce || payload.payload?.authorization?.nonce;
  const agentId = payload.agentId || request.headers.get('X-Agent-Id') || 'anonymous';
  const nonceOk = await x402.checkAndStoreNonce(nonce, agentId);
  if (!nonceOk) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ ...requirements, error: 'Payment nonce already used or missing (replay protection)' }, null, 2),
        { status: 402, headers: { 'Content-Type': 'application/json' } }
      )
    };
  }

  // Verify + settle via facilitator.
  const result = await x402.verifyWithFacilitator(payload, requirements);
  if (!result.valid) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ ...requirements, error: `Payment verification failed: ${result.reason}` }, null, 2),
        { status: 402, headers: { 'Content-Type': 'application/json' } }
      )
    };
  }

  await x402.recordTransaction(agentId, pricing.priceUsdc, result.txHash, result.settled ? 'completed' : 'pending');

  return {
    ok: true,
    payment: {
      enforced: true,
      amount_usdc: pricing.priceUsdc,
      settled: result.settled,
      tx_hash: result.txHash,
      network: x402.network
    },
    settleHeader: result.txHash
      ? btoa(JSON.stringify({ success: true, transaction: result.txHash, network: x402.network }))
      : null
  };
}
