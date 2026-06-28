/**
 * MetaMesh-UGA Registry Federation
 * 
 * Aggregates MCP servers from multiple registry sources:
 * - Official MCP registry
 * - Smithery registry
 * - Custom/private registries
 * 
 * Merging strategy:
 * - Deduplicate by name
 * - Lower priority wins (0 = official, 1 = community, 2 = private)
 * - If same priority, keep the first source encountered
 */

export const DEFAULT_REGISTRY_URL = 'https://registry.mcp.io/v0.1/servers';
export const SMITHERY_REGISTRY_URL = 'https://registry.smithery.ai/servers';

export class RegistryFederation {
  constructor(db, env) {
    this.db = db;
    this.env = env;
  }

  /**
   * Load enabled registry sources from database
   */
  async getSources() {
    const sources = await this.db.prepare(
      `SELECT name, url, type, priority, sync_interval_hours
       FROM registry_sources
       WHERE enabled = TRUE
       ORDER BY priority ASC`
    ).all();

    const results = sources.results || [];
    
    // Always ensure official MCP registry exists
    if (!results.some(s => s.name === 'mcp-official')) {
      results.unshift({
        name: 'mcp-official',
        url: this.env.MCP_REGISTRY_URL || DEFAULT_REGISTRY_URL,
        type: 'official',
        priority: 0
      });
    }

    // Always ensure Smithery registry exists
    if (!results.some(s => s.name === 'smithery')) {
      results.push({
        name: 'smithery',
        url: this.env.SMITHERY_REGISTRY_URL || SMITHERY_REGISTRY_URL,
        type: 'community',
        priority: 1
      });
    }

    return results;
  }

  /**
   * Add a custom registry source
   */
  async addSource(source) {
    await this.db.prepare(
      `INSERT INTO registry_sources (name, url, type, priority, sync_interval_hours)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(name) DO UPDATE SET
         url = excluded.url,
         type = excluded.type,
         priority = excluded.priority,
         sync_interval_hours = excluded.sync_interval_hours,
         updated_at = CURRENT_TIMESTAMP`
    ).bind(
      source.name,
      source.url,
      source.type || 'community',
      source.priority || 1,
      source.sync_interval_hours || 6
    ).run();
  }

  /**
   * Fetch servers from a single source
   */
  async fetchSource(source) {
    try {
      const response = await fetch(source.url, {
        headers: { 'Accept': 'application/json' },
        timeout: 10000
      });

      if (!response.ok) {
        return {
          source: source.name,
          success: false,
          error: `HTTP ${response.status}`,
          servers: []
        };
      }

      const data = await response.json();
      const servers = data.servers || data.data || data.items || data.results || [];

      return {
        source: source.name,
        success: true,
        count: servers.length,
        servers: servers.map(s => this.normalizeServer(s, source))
      };
    } catch (error) {
      return {
        source: source.name,
        success: false,
        error: error.message,
        servers: []
      };
    }
  }

  /**
   * Normalize a server from any source to common format
   */
  normalizeServer(server, source) {
    return {
      name: (server.name || server.id || server.title || 'unknown').toLowerCase().replace(/[^a-z0-9_-]/g, '_'),
      description: server.description || server.summary || server.about || '',
      version: this.normalizeVersion(server.version || '1.0.0'),
      category: server.category || this.inferCategory(server),
      source_url: server.source_url || server.homepage || server.url || server.repository || '',
      registry_url: server.registry_url || server.smithery_url || source.url,
      registry_source: source.name,
      registry_priority: source.priority,
      schema: server.schema || server.capabilities || server.tools || null,
      capabilities: server.capabilities || server.tags || server.keywords || []
    };
  }

  /**
   * Infer category from server metadata
   */
  inferCategory(server) {
    const text = `${server.name || ''} ${server.description || ''} ${(server.tags || server.keywords || []).join(' ')}`.toLowerCase();
    
    const CATEGORY_MAPPING = {
      'communication': ['slack', 'discord', 'telegram', 'email', 'gmail', 'outlook', 'teams', 'zoom'],
      'development': ['github', 'gitlab', 'jira', 'vscode', 'cursor', 'bitbucket'],
      'data': ['postgresql', 'mysql', 'mongodb', 'redis', 'snowflake', 'bigquery'],
      'ai': ['openai', 'anthropic', 'claude', 'gemini', 'huggingface'],
      'productivity': ['notion', 'asana', 'todoist', 'clickup'],
      'infrastructure': ['aws', 'gcp', 'azure', 'kubernetes', 'docker'],
      'finance': ['stripe', 'plaid', 'coinbase', 'paypal']
    };

    for (const [category, keywords] of Object.entries(CATEGORY_MAPPING)) {
      for (const keyword of keywords) {
        if (text.includes(keyword)) return category;
      }
    }

    return 'other';
  }

  /**
   * Normalize version string
   */
  normalizeVersion(version) {
    if (!version || typeof version !== 'string') return '1.0.0';
    const cleaned = version.replace(/^v/, '').split('.').slice(0, 3).join('.');
    return cleaned || '1.0.0';
  }

  /**
   * Merge results from multiple sources with deduplication and priority
   */
  merge(results) {
    const map = new Map();

    for (const result of results) {
      if (!result.success) continue;

      for (const server of result.servers) {
        const existing = map.get(server.name);
        
        if (!existing) {
          map.set(server.name, server);
        } else if (server.registry_priority < existing.registry_priority) {
          // Lower priority number wins
          map.set(server.name, server);
        }
      }
    }

    return Array.from(map.values());
  }

  /**
   * Sync all registries
   */
  async sync() {
    const sources = await this.getSources();
    const results = {
      sources: {},
      total: 0,
      merged: 0,
      errors: 0
    };

    const fetchResults = [];
    for (const source of sources) {
      const fetchResult = await this.fetchSource(source);
      results.sources[source.name] = fetchResult;
      fetchResults.push(fetchResult);
      if (!fetchResult.success) results.errors++;
    }

    const merged = this.merge(fetchResults);
    results.total = merged.length;
    results.merged = merged.length;

    return {
      ...results,
      servers: merged
    };
  }

  /**
   * Update source last sync status
   */
  async updateSourceStatus(sourceName, status) {
    await this.db.prepare(
      `UPDATE registry_sources
       SET last_sync = CURRENT_TIMESTAMP,
           last_status = ?
       WHERE name = ?`
    ).bind(status, sourceName).run();
  }
}
