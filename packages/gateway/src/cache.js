/**
 * MetaMesh-UGA Advanced Cache Engine
 * 
 * Multi-level caching with:
 * - L1: in-memory Map
 * - L2: Cloudflare KV
 * - L3: D1 fallback
 * 
 * Supports TTL, cache invalidation, and pattern-based invalidation.
 */

export class CacheEngine {
  constructor(kv = null, ttl = 300) {
    this.memory = new Map();
    this.kv = kv;
    this.defaultTtl = ttl;
  }

  /**
   * Build a cache key
   */
  key(prefix, id) {
    return `${prefix}:${id}`;
  }

  /**
   * Get a value from cache
   */
  async get(prefix, id) {
    const key = this.key(prefix, id);
    
    // L1 memory
    if (this.memory.has(key)) {
      const entry = this.memory.get(key);
      if (entry.expires > Date.now()) {
        return entry.value;
      }
      this.memory.delete(key);
    }

    // L2 KV
    if (this.kv) {
      try {
        const cached = await this.kv.get(key);
        if (cached) {
          const value = JSON.parse(cached);
          this.memory.set(key, {
            value,
            expires: Date.now() + (this.defaultTtl * 1000)
          });
          return value;
        }
      } catch (error) {
        console.error('KV cache read failed:', error);
      }
    }

    return null;
  }

  /**
   * Set a value in cache
   */
  async set(prefix, id, value, ttl = null) {
    const key = this.key(prefix, id);
    const expires = Date.now() + ((ttl || this.defaultTtl) * 1000);

    // L1 memory
    this.memory.set(key, { value, expires });

    // L2 KV
    if (this.kv) {
      try {
        await this.kv.put(key, JSON.stringify(value), {
          expirationTtl: ttl || this.defaultTtl
        });
      } catch (error) {
        console.error('KV cache write failed:', error);
      }
    }

    return true;
  }

  /**
   * Delete a value from cache
   */
  async delete(prefix, id) {
    const key = this.key(prefix, id);
    this.memory.delete(key);

    if (this.kv) {
      try {
        await this.kv.delete(key);
      } catch (error) {
        console.error('KV cache delete failed:', error);
      }
    }

    return true;
  }

  /**
   * Invalidate by prefix pattern
   */
  async invalidate(prefix) {
    // L1 memory
    for (const key of this.memory.keys()) {
      if (key.startsWith(`${prefix}:`)) {
        this.memory.delete(key);
      }
    }

    // L2 KV: list and delete keys
    if (this.kv) {
      try {
        const keys = await this.kv.list({ prefix: `${prefix}:` });
        for (const key of keys.keys || []) {
          await this.kv.delete(key.name);
        }
      } catch (error) {
        console.error('KV cache invalidation failed:', error);
      }
    }

    return true;
  }

  /**
   * Cache a tool by name
   */
  async getTool(name) {
    return this.get('tool', name);
  }

  async setTool(name, tool, ttl = 300) {
    return this.set('tool', name, tool, ttl);
  }

  async invalidateTool(name) {
    return this.delete('tool', name);
  }

  /**
   * Cache recommendations
   */
  async getRecommendation(query) {
    const hash = this.hashString(query);
    return this.get('recommend', hash);
  }

  async setRecommendation(query, result, ttl = 300) {
    const hash = this.hashString(query);
    return this.set('recommend', hash, result, ttl);
  }

  /**
   * Cache routing decisions
   */
  async getRouting(category) {
    return this.get('route', category || 'default');
  }

  async setRouting(category, result, ttl = 60) {
    return this.set('route', category || 'default', result, ttl);
  }

  /**
   * Simple hash function
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
}
