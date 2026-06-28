// MetaMesh-UGA — Real Tool Discovery Engine
// Fetches MCP servers from real public registries (official MCP registry, Smithery)
// and upserts them into the D1 `tools` table.

const OFFICIAL_REGISTRY = 'https://registry.modelcontextprotocol.io/v0/servers';

// Infer a category from the server name + description using keyword heuristics.
const CATEGORY_RULES = [
  { cat: 'ai', kw: ['llm', 'gpt', 'openai', 'anthropic', 'claude', 'inference', 'model', 'embedding', 'rag', 'agent', 'huggingface', 'replicate'] },
  { cat: 'data', kw: ['database', 'sql', 'postgres', 'mysql', 'mongodb', 'redis', 'sqlite', 'vector', 'pinecone', 'qdrant', 'chroma', 'weaviate', 'snowflake', 'bigquery', 'warehouse'] },
  { cat: 'development', kw: ['github', 'gitlab', 'git', 'jira', 'code', 'ci/cd', 'devops', 'repository', 'issue', 'pull request', 'bitbucket'] },
  { cat: 'communication', kw: ['slack', 'discord', 'email', 'gmail', 'mail', 'telegram', 'whatsapp', 'sms', 'twilio', 'chat', 'message', 'intercom'] },
  { cat: 'productivity', kw: ['notion', 'calendar', 'todo', 'task', 'trello', 'clickup', 'asana', 'drive', 'docs', 'sheet', 'note', 'linear'] },
  { cat: 'web', kw: ['fetch', 'scrape', 'crawl', 'browser', 'puppeteer', 'playwright', 'http', 'web', 'url'] },
  { cat: 'search', kw: ['search', 'brave', 'google', 'bing', 'duckduckgo', 'tavily', 'exa', 'perplexity'] },
  { cat: 'infrastructure', kw: ['aws', 'azure', 'gcp', 'cloud', 'docker', 'kubernetes', 'k8s', 'terraform', 'deploy', 'vercel', 'netlify', 'cloudflare'] },
  { cat: 'finance', kw: ['stripe', 'payment', 'invoice', 'billing', 'crypto', 'wallet', 'bank', 'paddle', 'finance', 'accounting'] },
  { cat: 'monitoring', kw: ['monitor', 'log', 'metric', 'sentry', 'datadog', 'grafana', 'observability', 'alert'] },
  { cat: 'commerce', kw: ['shopify', 'commerce', 'store', 'cart', 'product', 'order'] },
  { cat: 'media', kw: ['youtube', 'spotify', 'video', 'audio', 'image', 'media', 'music', '3d'] }
];

function inferCategory(name, description) {
  const text = `${name || ''} ${description || ''}`.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.kw.some(k => text.includes(k))) return rule.cat;
  }
  return 'general';
}

// Derive a clean, unique tool name. Registry names look like "io.github.owner/server".
function normalizeName(rawName) {
  if (!rawName) return null;
  // Take the part after the last slash, fallback to full name.
  const parts = rawName.split('/');
  let n = parts[parts.length - 1] || rawName;
  n = n.replace(/[^a-zA-Z0-9._-]/g, '-').toLowerCase();
  return n.slice(0, 80);
}

function pickSourceUrl(server) {
  if (server.repository?.url) return server.repository.url;
  if (Array.isArray(server.remotes) && server.remotes[0]?.url) return server.remotes[0].url;
  if (Array.isArray(server.packages) && server.packages[0]?.identifier) {
    return `https://www.npmjs.com/package/${server.packages[0].identifier}`;
  }
  return 'https://registry.modelcontextprotocol.io';
}

export class DiscoveryEngine {
  constructor(env) {
    this.env = env;
    this.db = env.DB;
  }

  // Fetch one page from the official registry. Returns { servers, nextCursor }.
  async fetchOfficialPage(cursor) {
    const url = new URL(OFFICIAL_REGISTRY);
    url.searchParams.set('limit', '100');
    if (cursor) url.searchParams.set('cursor', cursor);

    const res = await fetch(url.toString(), {
      headers: { 'Accept': 'application/json', 'User-Agent': 'MetaMesh-UGA/1.0 Discovery' },
      cf: { cacheTtl: 0 }
    });
    if (!res.ok) throw new Error(`Official registry HTTP ${res.status}`);
    const json = await res.json();
    return {
      servers: json.servers || [],
      nextCursor: json.metadata?.nextCursor || null
    };
  }

  // Map a registry entry to a tools-table row object.
  mapEntry(entry) {
    const server = entry.server || entry;
    const meta = entry._meta?.['io.modelcontextprotocol.registry/official'] || {};
    const name = normalizeName(server.name);
    if (!name) return null;

    const isActive = (meta.status || 'active') === 'active';
    const isLatest = meta.isLatest !== false;

    return {
      name,
      version: server.version || '1.0.0',
      category: inferCategory(server.name, server.description),
      description: (server.description || server.title || name).slice(0, 500),
      source_url: pickSourceUrl(server),
      registry_url: `https://registry.modelcontextprotocol.io/v0/servers?search=${encodeURIComponent(server.name)}`,
      registry_source: 'mcp-official',
      // Servers in the official registry are already published/validated; expose as ACTIVE.
      state: isActive ? 'ACTIVE' : 'DEPRECATED',
      deprecated: !isActive,
      isLatest,
      federation_id: server.name
    };
  }

  // Upsert a batch of rows into the tools table. Returns number of rows processed.
  async upsertBatch(rows) {
    const stmt = this.db.prepare(`
      INSERT INTO tools (name, description, version, source_url, registry_url, category, registry_source, state, deprecated, popularity_score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(name, version) DO UPDATE SET
        description = excluded.description,
        source_url = excluded.source_url,
        registry_url = excluded.registry_url,
        category = excluded.category,
        registry_source = excluded.registry_source,
        state = excluded.state,
        deprecated = excluded.deprecated,
        last_updated = CURRENT_TIMESTAMP
    `);

    const batch = [];
    for (const r of rows) {
      if (!r) continue;
      batch.push(
        stmt.bind(
          r.name, r.description, r.version, r.source_url, r.registry_url,
          r.category, r.registry_source, r.state, r.deprecated ? 1 : 0, 0
        )
      );
    }
    if (batch.length === 0) return 0;

    await this.db.batch(batch);
    return batch.length;
  }

  async countActive() {
    const row = await this.db.prepare('SELECT COUNT(*) as total FROM tools WHERE deprecated = FALSE').first();
    return row?.total || 0;
  }

  // Read/write the resume cursor in KV so consecutive runs crawl deeper.
  async loadCursor() {
    try {
      if (this.env.CONFIG_CACHE) {
        return await this.env.CONFIG_CACHE.get('discovery:cursor');
      }
    } catch (_e) { /* ignore */ }
    return null;
  }

  async saveCursor(cursor) {
    try {
      if (this.env.CONFIG_CACHE) {
        if (cursor) await this.env.CONFIG_CACHE.put('discovery:cursor', cursor);
        else await this.env.CONFIG_CACHE.delete('discovery:cursor');
      }
    } catch (_e) { /* ignore */ }
  }

  // Run a discovery pass over the official registry.
  // maxPages caps work to stay within Worker CPU/subrequest limits.
  // resume=true continues from the last saved cursor (progressive crawl).
  async run({ maxPages = 8, source = 'cron', resume = true } = {}) {
    const startedAt = new Date().toISOString();
    let cursor = resume ? await this.loadCursor() : null;
    let totalFound = 0;
    let totalProcessed = 0;
    let pages = 0;
    let status = 'completed';
    let errorMsg = null;

    const countBefore = await this.countActive();

    try {
      do {
        const { servers, nextCursor } = await this.fetchOfficialPage(cursor);
        if (servers.length === 0) { cursor = null; break; }

        // Only keep latest versions to avoid duplicate version spam.
        const rows = servers.map(s => this.mapEntry(s)).filter(r => r && r.isLatest);
        totalFound += servers.length;

        totalProcessed += await this.upsertBatch(rows);

        cursor = nextCursor;
        pages++;
      } while (cursor && pages < maxPages);

      // Persist cursor for the next run; null means we reached the end -> restart.
      await this.saveCursor(cursor);
    } catch (e) {
      status = 'failed';
      errorMsg = e.message;
    }

    const countAfter = await this.countActive();
    const totalAdded = Math.max(0, countAfter - countBefore);
    const totalUpdated = Math.max(0, totalProcessed - totalAdded);

    const completedAt = new Date().toISOString();

    // Log to discovery_log (best-effort).
    try {
      await this.db.prepare(
        'INSERT INTO discovery_log (source, status, tools_found, tools_added, started_at, completed_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(source, status, totalFound, totalAdded, startedAt, completedAt).run();
    } catch (_e) { /* table may differ; ignore */ }

    // Update registry_sources sync status (best-effort).
    try {
      await this.db.prepare(
        'UPDATE registry_sources SET last_sync = ?, last_status = ? WHERE name = ?'
      ).bind(completedAt, status === 'completed' ? 'success' : 'failed', 'mcp-official').run();
    } catch (_e) { /* ignore */ }

    const total = await this.db.prepare(
      'SELECT COUNT(*) as total FROM tools WHERE deprecated = FALSE'
    ).first();

    return {
      success: status === 'completed',
      source,
      pages_fetched: pages,
      discovered: totalFound,
      added: totalAdded,
      updated: totalUpdated,
      total_active: total?.total || 0,
      error: errorMsg,
      started_at: startedAt,
      completed_at: completedAt
    };
  }
}
