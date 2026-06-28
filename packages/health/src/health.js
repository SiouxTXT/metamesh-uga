/**
 * MetaMesh-UGA Health Engine
 * 
 * Performs real-time health checks on MCP servers and updates health status.
 * Marks unhealthy servers as degraded or deprecated based on policy.
 * 
 * Phase 5 implementation: HTTP HEAD checks on source URLs.
 */

export class HealthEngine {
  constructor(db, env) {
    this.db = db;
    this.env = env;
    this.timeout = parseInt(env.HEALTH_TIMEOUT_MS || '5000');
  }

  /**
   * Check health of all active tools
   */
  async checkAll(limit = 1000) {
    const tools = await this.db.prepare(
      `SELECT name, source_url, registry_url, state, trust_score
       FROM tools
       WHERE deprecated = FALSE
         AND state IN ('ACTIVE', 'RANKED', 'BENCHMARKED', 'VERIFIED')
       ORDER BY name
       LIMIT ?`
    ).bind(limit).all();

    const results = {
      checked: 0,
      healthy: 0,
      degraded: 0,
      unhealthy: 0,
      evicted: 0,
      errors: 0
    };

    for (const tool of tools.results || []) {
      try {
        const check = await this.checkTool(tool);
        results.checked++;

        if (check.status === 'healthy') results.healthy++;
        else if (check.status === 'degraded') results.degraded++;
        else results.unhealthy++;

        // Evict unhealthy tools: mark as DEPRECATED
        if (check.status === 'unhealthy' && tool.state !== 'DEPRECATED') {
          await this.evictTool(tool.name, check.error_message);
          results.evicted++;
        }
      } catch (error) {
        results.errors++;
        console.error(`Health check failed for ${tool.name}:`, error);
      }
    }

    return results;
  }

  /**
   * Check health of a single tool
   */
  async checkTool(tool) {
    const url = tool.source_url || tool.registry_url;
    const start = Date.now();

    if (!url || !url.startsWith('http')) {
      const result = {
        tool_name: tool.name,
        status: 'unknown',
        response_time_ms: 0,
        error_message: 'No HTTP URL available'
      };
      await this.storeResult(result);
      return result;
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        signal: controller.signal
      });

      clearTimeout(timer);
      const responseTime = Date.now() - start;

      let status = 'healthy';
      if (!response.ok) status = 'unhealthy';
      else if (responseTime > 2000) status = 'degraded';

      const result = {
        tool_name: tool.name,
        status,
        response_time_ms: responseTime,
        http_status: response.status,
        error_message: response.ok ? null : `HTTP ${response.status}`
      };

      await this.storeResult(result);
      return result;
    } catch (error) {
      const result = {
        tool_name: tool.name,
        status: 'unhealthy',
        response_time_ms: Date.now() - start,
        http_status: null,
        error_message: error.message
      };
      await this.storeResult(result);
      return result;
    }
  }

  /**
   * Store health check result
   */
  async storeResult(result) {
    await this.db.prepare(
      `INSERT INTO health_checks (tool_name, status, response_time_ms, http_status, error_message)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(
      result.tool_name,
      result.status,
      result.response_time_ms,
      result.http_status,
      result.error_message
    ).run();
  }

  /**
   * Evict an unhealthy tool by marking it DEPRECATED
   */
  async evictTool(toolName, reason) {
    await this.db.prepare(
      `UPDATE tools
       SET state = 'DEPRECATED',
           deprecated = TRUE,
           deprecated_since = CURRENT_TIMESTAMP,
           state_updated = CURRENT_TIMESTAMP
       WHERE name = ?`
    ).bind(toolName).run();

    await this.db.prepare(
      `INSERT INTO lifecycle_log (tool_name, from_state, to_state, reason, triggered_by)
       VALUES (?, ?, 'DEPRECATED', ?, 'health-engine')`
    ).bind(toolName, toolName, `Health check failed: ${reason || 'unknown'}`).run();
  }

  /**
   * Get health status for all tools
   */
  async getHealthStatus(limit = 100) {
    const health = await this.db.prepare(
      `SELECT * FROM v_tool_health ORDER BY checked_at DESC LIMIT ?`
    ).bind(limit).all();

    return health.results || [];
  }

  /**
   * Get health history for a tool
   */
  async getHistory(toolName, limit = 100) {
    const history = await this.db.prepare(
      `SELECT * FROM health_checks WHERE tool_name = ? ORDER BY checked_at DESC LIMIT ?`
    ).bind(toolName, limit).all();

    return history.results || [];
  }
}
