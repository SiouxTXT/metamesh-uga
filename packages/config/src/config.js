/**
 * MetaMesh-UGA Config Engine
 * 
 * Manages configurations and feature flags:
 * - Global configurations
 * - Per-tenant settings
 * - Per-user settings
 * - Feature flags with percentage rollout
 * 
 * Phase 5 implementation: D1-based with optional KV cache.
 */

export class ConfigEngine {
  constructor(db, cache = null) {
    this.db = db;
    this.cache = cache;
  }

  /**
   * Get a configuration value
   */
  async get(key, scope = 'global', scopeId = null) {
    const cacheKey = this.buildCacheKey(key, scope, scopeId);
    
    if (this.cache) {
      try {
        const cached = await this.cache.get(cacheKey);
        if (cached) return JSON.parse(cached);
      } catch (error) {
        console.error('Config cache read failed:', error);
      }
    }

    const config = await this.db.prepare(
      `SELECT key, value, type, scope, scope_id, enabled
       FROM configurations
       WHERE key = ? AND scope = ? AND (scope_id = ? OR scope_id IS NULL)
       ORDER BY scope_id DESC, updated_at DESC
       LIMIT 1`
    ).bind(key, scope, scopeId).first();

    if (!config || !config.enabled) return null;

    const value = this.parseValue(config.value, config.type);

    if (this.cache) {
      await this.cache.put(cacheKey, JSON.stringify(value), { expirationTtl: 300 });
    }

    return value;
  }

  /**
   * Set a configuration value
   */
  async set(key, value, type = 'string', scope = 'global', scopeId = null, description = '') {
    const strValue = type === 'json' ? JSON.stringify(value) : String(value);

    await this.db.prepare(
      `INSERT INTO configurations (key, value, type, scope, scope_id, description)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         type = excluded.type,
         scope = excluded.scope,
         scope_id = excluded.scope_id,
         description = excluded.description,
         updated_at = CURRENT_TIMESTAMP`
    ).bind(key, strValue, type, scope, scopeId, description).run();

    if (this.cache) {
      await this.cache.delete(this.buildCacheKey(key, scope, scopeId));
    }

    return { key, value, type, scope, scope_id: scopeId };
  }

  /**
   * Delete a configuration
   */
  async delete(key) {
    await this.db.prepare(
      'DELETE FROM configurations WHERE key = ?'
    ).bind(key).run();
    return { deleted: true };
  }

  /**
   * List all configurations
   */
  async list(scope = null, scopeId = null) {
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (scope) {
      whereClause += ' AND scope = ?';
      params.push(scope);
    }
    if (scopeId) {
      whereClause += ' AND scope_id = ?';
      params.push(scopeId);
    }

    const configs = await this.db.prepare(
      `SELECT key, value, type, scope, scope_id, description, enabled
       FROM configurations ${whereClause}
       ORDER BY key`
    ).bind(...params).all();

    return (configs.results || []).map(c => ({
      ...c,
      value: this.parseValue(c.value, c.type)
    }));
  }

  /**
   * Check if a feature flag is enabled
   */
  async isFeatureEnabled(name, identifier = '') {
    const flag = await this.db.prepare(
      'SELECT enabled, target_percent FROM feature_flags WHERE name = ?'
    ).bind(name).first();

    if (!flag || !flag.enabled) return false;
    if (flag.target_percent >= 100) return true;

    // Deterministic rollout based on identifier hash
    const hash = this.hashString(`${name}:${identifier}`);
    return (hash % 100) < flag.target_percent;
  }

  /**
   * Get all feature flags
   */
  async getFeatureFlags() {
    const flags = await this.db.prepare(
      'SELECT name, enabled, target_percent, description FROM feature_flags ORDER BY name'
    ).all();

    return flags.results || [];
  }

  /**
   * Set feature flag
   */
  async setFeatureFlag(name, enabled, targetPercent = 100, description = '') {
    await this.db.prepare(
      `INSERT INTO feature_flags (name, enabled, target_percent, description)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(name) DO UPDATE SET
         enabled = excluded.enabled,
         target_percent = excluded.target_percent,
         description = excluded.description,
         updated_at = CURRENT_TIMESTAMP`
    ).bind(name, enabled, targetPercent, description).run();

    return { name, enabled, target_percent: targetPercent };
  }

  /**
   * Parse stored value by type
   */
  parseValue(value, type) {
    switch (type) {
      case 'boolean':
        return value === 'true' || value === '1';
      case 'number':
        return parseFloat(value);
      case 'json':
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      default:
        return value;
    }
  }

  /**
   * Build cache key
   */
  buildCacheKey(key, scope, scopeId) {
    return `config:${scope}:${scopeId || 'global'}:${key}`;
  }

  /**
   * Simple hash for rollout
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}
