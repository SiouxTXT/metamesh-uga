// MetaMesh-UGA — MCP federation / hub layer.
//
// Turns the gateway's /mcp endpoint into an intelligent MCP hub that:
//   - Exposes native "analysis & control" tools (metamesh.*) so an agent gets
//     maximum context about the 13k-tool catalog in minimal tokens.
//   - Federates upstream MCP servers (Stripe MCP) and proxies their tools
//     under a namespace (stripe.*), authenticating with the gateway's secrets.
//   - Uses KV caching + concise schemas for token-efficient tools/list.
//
// Token strategy: instead of enumerating 13,000 catalog tools, agents use
// `metamesh.search_tools` / `metamesh.context` to discover precisely what they
// need, then call it. The full catalog stays paginated for clients that want it.

const STRIPE_MCP_URL = 'https://mcp.stripe.com';
const UPSTREAM_CACHE_TTL = 300; // seconds
const DESC_MAX = 180;

function clip(text, n = DESC_MAX) {
  if (!text) return '';
  const s = String(text);
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

// ----------------------------------------------------------------------------
// Native "analysis & control" tools
// ----------------------------------------------------------------------------

export const NATIVE_TOOLS = [
  {
    name: 'metamesh.context',
    description: 'Compact snapshot of the MetaMesh gateway: active tool count, top categories, payment/billing status, last discovery. Best first call for context.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'metamesh.search_tools',
    description: 'Search the catalog of 13k+ MCP tools by keyword. Returns concise matches (name, category, description). Use this instead of listing all tools.',
    inputSchema: {
      type: 'object',
      properties: {
        q: { type: 'string', description: 'Search query, e.g. "github", "database", "email"' },
        limit: { type: 'number', description: 'Max results (default 10, max 50)' }
      },
      required: ['q']
    }
  },
  {
    name: 'metamesh.tool_info',
    description: 'Detailed info for a specific catalog tool: description, category, trust/security score, state, source.',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Exact tool name' } },
      required: ['name']
    }
  },
  {
    name: 'metamesh.metrics',
    description: 'Usage analytics: total tools, calls, success rate and recent error counts. Read-only.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'metamesh.discovery_status',
    description: 'Control/observability: status of the registry discovery engine (active tools, last run, pages fetched).',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'metamesh.health',
    description: 'Gateway health: database connectivity, payment configuration and feature flags.',
    inputSchema: { type: 'object', properties: {} }
  }
];

function textResult(obj) {
  const text = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2);
  return { content: [{ type: 'text', text }], isError: false };
}

export async function callNativeTool(env, name, args = {}) {
  switch (name) {
    case 'metamesh.context': {
      const active = await env.DB.prepare("SELECT COUNT(*) AS n FROM tools WHERE deprecated = FALSE AND state = 'ACTIVE'").first();
      const cats = await env.DB.prepare(
        "SELECT category, COUNT(*) AS n FROM tools WHERE deprecated = FALSE AND state = 'ACTIVE' GROUP BY category ORDER BY n DESC LIMIT 8"
      ).all();
      const lastRun = await env.DB.prepare('SELECT completed_at, tools_added, tools_updated FROM discovery_log ORDER BY completed_at DESC LIMIT 1').first().catch(() => null);
      const stripeReady = typeof env.STRIPE_SECRET_KEY === 'string' && env.STRIPE_SECRET_KEY.startsWith('sk_');
      return textResult({
        gateway: 'metamesh-uga',
        active_tools: active?.n || 0,
        top_categories: (cats.results || []).map(c => ({ category: c.category, count: c.n })),
        payments: {
          stripe_prepaid_credit: stripeReady ? 'ready' : 'pending (no STRIPE_SECRET_KEY)',
          billing_enforced: env.BILLING_ENABLED === 'true',
          x402_crypto: (env.X402_ENABLED === 'true' && !!env.X402_PAY_TO) ? 'active' : 'inactive'
        },
        federation: { stripe_mcp: stripeReady ? 'enabled' : 'disabled' },
        last_discovery: lastRun || null,
        hint: 'Use metamesh.search_tools to find a tool, then call it. stripe.* tools manage payments.'
      });
    }
    case 'metamesh.search_tools': {
      const q = (args.q || '').toString().trim();
      if (!q) return { content: [{ type: 'text', text: 'Provide a query "q".' }], isError: true };
      const limit = Math.min(parseInt(args.limit) || 10, 50);
      const like = `%${q}%`;
      const rows = await env.DB.prepare(
        `SELECT name, category, trust_score, description FROM tools
         WHERE deprecated = FALSE AND state = 'ACTIVE' AND (name LIKE ? OR description LIKE ? OR category LIKE ?)
         ORDER BY popularity_score DESC LIMIT ?`
      ).bind(like, like, like, limit).all();
      return textResult({
        query: q,
        count: (rows.results || []).length,
        results: (rows.results || []).map(r => ({
          name: r.name,
          category: r.category,
          trust: r.trust_score,
          description: clip(r.description, 120)
        }))
      });
    }
    case 'metamesh.tool_info': {
      const tn = (args.name || '').toString();
      const t = await env.DB.prepare(
        `SELECT name, description, version, category, trust_score, security_score, state, source_url, registry_source
         FROM tools WHERE name = ? AND deprecated = FALSE`
      ).bind(tn).first();
      if (!t) return { content: [{ type: 'text', text: `Tool not found: ${tn}` }], isError: true };
      return textResult(t);
    }
    case 'metamesh.metrics': {
      const tools = await env.DB.prepare("SELECT COUNT(*) AS n FROM tools WHERE deprecated = FALSE AND state = 'ACTIVE'").first();
      const calls = await env.DB.prepare('SELECT COUNT(*) AS n FROM usage_log').first().catch(() => ({ n: 0 }));
      const errs = await env.DB.prepare("SELECT COUNT(*) AS n FROM usage_log WHERE status = 'error' AND called_at > datetime('now','-24 hours')").first().catch(() => ({ n: 0 }));
      const ok = await env.DB.prepare("SELECT COUNT(*) AS n FROM usage_log WHERE status = 'success'").first().catch(() => ({ n: 0 }));
      const total = (calls?.n || 0) || 1;
      return textResult({
        active_tools: tools?.n || 0,
        total_calls: calls?.n || 0,
        success_rate: `${((ok?.n || 0) / total * 100).toFixed(1)}%`,
        errors_24h: errs?.n || 0
      });
    }
    case 'metamesh.discovery_status': {
      const active = await env.DB.prepare("SELECT COUNT(*) AS n FROM tools WHERE deprecated = FALSE AND state = 'ACTIVE'").first();
      const last = await env.DB.prepare('SELECT * FROM discovery_log ORDER BY completed_at DESC LIMIT 1').first().catch(() => null);
      return textResult({ active_tools: active?.n || 0, last_run: last || null, cron: 'every 6h' });
    }
    case 'metamesh.health': {
      let db = false;
      try { await env.DB.prepare('SELECT 1').first(); db = true; } catch (_e) { /* */ }
      return textResult({
        status: db ? 'healthy' : 'degraded',
        database: db,
        stripe_configured: typeof env.STRIPE_SECRET_KEY === 'string' && env.STRIPE_SECRET_KEY.startsWith('sk_'),
        billing_enforced: env.BILLING_ENABLED === 'true'
      });
    }
    default:
      return { content: [{ type: 'text', text: `Unknown native tool: ${name}` }], isError: true };
  }
}

// ----------------------------------------------------------------------------
// Stripe MCP federation (upstream proxy)
// ----------------------------------------------------------------------------

export function stripeMcpEnabled(env) {
  return typeof env.STRIPE_SECRET_KEY === 'string' && env.STRIPE_SECRET_KEY.startsWith('sk_');
}

// Minimal JSON-RPC call to an upstream streamable-HTTP MCP server.
// Handles both application/json and SSE (text/event-stream) responses.
async function upstreamRpc(url, headers, method, params, sessionId) {
  const reqHeaders = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    ...headers
  };
  if (sessionId) reqHeaders['Mcp-Session-Id'] = sessionId;

  const res = await fetch(url, {
    method: 'POST',
    headers: reqHeaders,
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params: params || {} })
  });

  const newSession = res.headers.get('Mcp-Session-Id') || sessionId;
  const ct = res.headers.get('Content-Type') || '';
  let payload;
  if (ct.includes('text/event-stream')) {
    const text = await res.text();
    // Extract the last JSON `data:` line from the SSE stream.
    const dataLines = text.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trim());
    const last = dataLines.reverse().find(d => d && d !== '[DONE]');
    payload = last ? JSON.parse(last) : null;
  } else {
    payload = await res.json().catch(() => null);
  }

  if (!res.ok) {
    throw new Error(payload?.error?.message || `Upstream MCP error ${res.status}`);
  }
  return { payload, sessionId: newSession };
}

// Initialize a session with the Stripe MCP server and return the session id.
async function stripeInit(env) {
  const headers = { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` };
  const { sessionId } = await upstreamRpc(STRIPE_MCP_URL, headers, 'initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'metamesh-uga-hub', version: '1.0.0' }
  });
  return sessionId;
}

// List Stripe MCP tools (namespaced as stripe.*), cached in KV for token efficiency.
export async function listStripeTools(env) {
  if (!stripeMcpEnabled(env)) return [];

  const cacheKey = 'mcp:stripe:tools';
  if (env.CACHE) {
    const cached = await env.CACHE.get(cacheKey, 'json').catch(() => null);
    if (cached) return cached;
  }

  try {
    const headers = { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` };
    const sessionId = await stripeInit(env);
    const { payload } = await upstreamRpc(STRIPE_MCP_URL, headers, 'tools/list', {}, sessionId);
    const tools = (payload?.result?.tools || []).map(t => ({
      name: `stripe.${t.name}`,
      description: clip(t.description),
      inputSchema: t.inputSchema || { type: 'object', properties: {} }
    }));
    if (env.CACHE && tools.length) {
      await env.CACHE.put(cacheKey, JSON.stringify(tools), { expirationTtl: UPSTREAM_CACHE_TTL }).catch(() => {});
    }
    return tools;
  } catch (e) {
    console.error('Stripe MCP tools/list failed:', e.message);
    return [];
  }
}

// Proxy a tools/call to the Stripe MCP server. `name` is the stripe.* alias.
export async function callStripeTool(env, name, args = {}) {
  if (!stripeMcpEnabled(env)) {
    return { content: [{ type: 'text', text: 'Stripe MCP disabled: set STRIPE_SECRET_KEY.' }], isError: true };
  }
  const realName = name.replace(/^stripe\./, '');
  try {
    const headers = { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` };
    const sessionId = await stripeInit(env);
    const { payload } = await upstreamRpc(STRIPE_MCP_URL, headers, 'tools/call', { name: realName, arguments: args }, sessionId);
    if (payload?.error) {
      return { content: [{ type: 'text', text: `Stripe MCP error: ${payload.error.message}` }], isError: true };
    }
    return payload?.result || { content: [{ type: 'text', text: 'No result from Stripe MCP' }], isError: false };
  } catch (e) {
    return { content: [{ type: 'text', text: `Stripe MCP call failed: ${e.message}` }], isError: true };
  }
}

// ----------------------------------------------------------------------------
// Aggregation helpers used by the MCP endpoint
// ----------------------------------------------------------------------------

// Federated tools shown FIRST in tools/list (native + stripe), optionally filtered.
export async function listFederatedTools(env, filter) {
  let tools = [...NATIVE_TOOLS];
  const stripeTools = await listStripeTools(env);
  tools = tools.concat(stripeTools);

  if (filter) {
    const f = filter.toLowerCase();
    tools = tools.filter(t => t.name.toLowerCase().startsWith(f));
  }
  return tools;
}

// Route a tools/call by namespace. Returns null if not a federated tool
// (so the caller falls back to catalog handling).
export async function routeFederatedCall(env, name, args) {
  if (name.startsWith('metamesh.')) return callNativeTool(env, name, args);
  if (name.startsWith('stripe.')) return callStripeTool(env, name, args);
  return null;
}
