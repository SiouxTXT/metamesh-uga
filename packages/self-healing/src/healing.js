/**
 * MetaMesh-UGA Self-Healing Engine
 * 
 * Monitors system health and automatically applies remediation actions:
 * - Detect high error rates and trigger tool deprecation
 * - Detect low trust scores and trigger lifecycle re-evaluation
 * - Detect stale tools and trigger cleanup
 * - Rollback recently deprecated tools if they recover
 * 
 * Phase 5 implementation: D1-based monitoring with automatic remediation.
 */

export class SelfHealingEngine {
  constructor(db, env) {
    this.db = db;
    this.env = env;
  }

  /**
   * Run full self-healing cycle
   */
  async run() {
    const results = {
      timestamp: new Date().toISOString(),
      checks: [],
      actions: [],
      errors: []
    };

    try {
      const errorActions = await this.fixHighErrorRates();
      results.actions.push(...errorActions);
    } catch (error) {
      results.errors.push({ check: 'high_error_rates', error: error.message });
    }

    try {
      const staleActions = await this.fixStaleTools();
      results.actions.push(...staleActions);
    } catch (error) {
      results.errors.push({ check: 'stale_tools', error: error.message });
    }

    try {
      const rollbackActions = await this.rollbackRecoveredTools();
      results.actions.push(...rollbackActions);
    } catch (error) {
      results.errors.push({ check: 'rollback', error: error.message });
    }

    return results;
  }

  /**
   * Fix tools with high error rates
   */
  async fixHighErrorRates() {
    const actions = [];
    const tools = await this.db.prepare(
      `SELECT 
        tool_name,
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'error' THEN 1 END) as errors,
        COUNT(CASE WHEN status = 'error' THEN 1 END) * 100.0 / COUNT(*) as error_rate
       FROM usage_log
       WHERE called_at > datetime('now', '-1 hour')
       GROUP BY tool_name
       HAVING total > 10 AND error_rate > 50`
    ).all();

    for (const tool of tools.results || []) {
      // Deprecate the tool
      await this.db.prepare(
        `UPDATE tools
         SET state = 'DEPRECATED', deprecated = TRUE, deprecated_since = CURRENT_TIMESTAMP
         WHERE name = ? AND state != 'DEPRECATED'`
      ).bind(tool.tool_name).run();

      await this.db.prepare(
        `INSERT INTO lifecycle_log (tool_name, from_state, to_state, reason, triggered_by)
         VALUES (?, 'ACTIVE', 'DEPRECATED', ?, 'self-healing')`
      ).bind(tool.tool_name, `High error rate: ${Math.round(tool.error_rate)}%`).run();

      actions.push({
        tool: tool.tool_name,
        action: 'deprecated',
        reason: `error_rate: ${Math.round(tool.error_rate)}%`
      });
    }

    return actions;
  }

  /**
   * Fix stale tools (no usage for 90 days)
   */
  async fixStaleTools() {
    const actions = [];
    const tools = await this.db.prepare(
      `SELECT t.name
       FROM tools t
       LEFT JOIN (
         SELECT tool_name, MAX(called_at) as last_call
         FROM usage_log
         GROUP BY tool_name
       ) u ON t.name = u.tool_name
       WHERE t.deprecated = FALSE
         AND t.state IN ('ACTIVE', 'RANKED')
         AND (u.last_call IS NULL OR u.last_call < datetime('now', '-90 days'))
         AND t.last_updated < datetime('now', '-90 days')`
    ).all();

    for (const tool of tools.results || []) {
      await this.db.prepare(
        `UPDATE tools
         SET state = 'DEPRECATED', deprecated = TRUE, deprecated_since = CURRENT_TIMESTAMP
         WHERE name = ?`
      ).bind(tool.name).run();

      await this.db.prepare(
        `INSERT INTO lifecycle_log (tool_name, from_state, to_state, reason, triggered_by)
         VALUES (?, 'ACTIVE', 'DEPRECATED', 'No usage for 90 days', 'self-healing')`
      ).bind(tool.name).run();

      actions.push({
        tool: tool.name,
        action: 'deprecated',
        reason: 'stale: no usage for 90 days'
      });
    }

    return actions;
  }

  /**
   * Rollback recently deprecated tools that recovered
   */
  async rollbackRecoveredTools() {
    const actions = [];
    const tools = await this.db.prepare(
      `SELECT t.name,
        COUNT(CASE WHEN u.status = 'success' THEN 1 END) as successes,
        COUNT(CASE WHEN u.status = 'error' THEN 1 END) as errors
       FROM tools t
       LEFT JOIN usage_log u ON t.name = u.tool_name
       WHERE t.state = 'DEPRECATED'
         AND t.deprecated_since > datetime('now', '-7 days')
         AND u.called_at > datetime('now', '-1 hour')
       GROUP BY t.name
       HAVING successes > errors * 2`
    ).all();

    for (const tool of tools.results || []) {
      await this.db.prepare(
        `UPDATE tools
         SET state = 'RANKED', deprecated = FALSE, deprecated_since = NULL, state_updated = CURRENT_TIMESTAMP
         WHERE name = ?`
      ).bind(tool.name).run();

      await this.db.prepare(
        `INSERT INTO lifecycle_log (tool_name, from_state, to_state, reason, triggered_by)
         VALUES (?, 'DEPRECATED', 'RANKED', 'Tool recovered', 'self-healing')`
      ).bind(tool.name).run();

      actions.push({
        tool: tool.name,
        action: 'rollback',
        reason: 'recovered: recent successes > 2x errors'
      });
    }

    return actions;
  }

  /**
   * Get recent healing actions
   */
  async getHistory(limit = 100) {
    const history = await this.db.prepare(
      `SELECT tool_name, from_state, to_state, reason, triggered_by, created_at
       FROM lifecycle_log
       WHERE triggered_by = 'self-healing'
       ORDER BY created_at DESC
       LIMIT ?`
    ).bind(limit).all();

    return history.results || [];
  }
}
