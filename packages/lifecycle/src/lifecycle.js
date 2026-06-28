/**
 * MetaMesh-UGA Lifecycle Manager
 * 
 * Manages the lifecycle states of MCP servers.
 * 
 * States:
 *   DISCOVERED → VALIDATED → VERIFIED → BENCHMARKED → RANKED → ACTIVE → DEPRECATED → ARCHIVED
 * 
 * Rules:
 * - DISCOVERED → VALIDATED: has description (>10 chars) and schema
 * - VALIDATED → VERIFIED: security_score >= 0.5
 * - VERIFIED → BENCHMARKED: benchmark_score >= 0.4
 * - BENCHMARKED → RANKED: trust_score >= 0.7
 * - RANKED → ACTIVE: popularity_score >= 50 OR trust_score >= 0.8
 * - Any → DEPRECATED: stale for 90 days, malware detected, or security_score < 0.3
 * - DEPRECATED → ARCHIVED: deprecated for 90 days
 */

export const STATES = {
  DISCOVERED: 'DISCOVERED',
  VALIDATED: 'VALIDATED',
  VERIFIED: 'VERIFIED',
  BENCHMARKED: 'BENCHMARKED',
  RANKED: 'RANKED',
  ACTIVE: 'ACTIVE',
  DEPRECATED: 'DEPRECATED',
  ARCHIVED: 'ARCHIVED'
};

export const ALLOWED_TRANSITIONS = {
  'NONE': ['DISCOVERED'],
  'DISCOVERED': ['VALIDATED', 'DEPRECATED'],
  'VALIDATED': ['VERIFIED', 'DEPRECATED'],
  'VERIFIED': ['BENCHMARKED', 'DEPRECATED'],
  'BENCHMARKED': ['RANKED', 'DEPRECATED'],
  'RANKED': ['ACTIVE', 'DEPRECATED'],
  'ACTIVE': ['DEPRECATED'],
  'DEPRECATED': ['ARCHIVED', 'ACTIVE'],
  'ARCHIVED': []
};

export class LifecycleManager {
  constructor(db) {
    this.db = db;
  }

  /**
   * Evaluate and transition a single tool
   */
  async evaluateTool(tool) {
    const targetState = this.determineTargetState(tool);
    
    if (targetState && targetState !== tool.state) {
      const allowed = (ALLOWED_TRANSITIONS[tool.state] || []).includes(targetState);
      if (allowed) {
        await this.transition(tool.name, tool.state, targetState, this.getReason(tool, targetState));
        return { changed: true, from: tool.state, to: targetState };
      }
    }
    
    return { changed: false, state: tool.state };
  }

  /**
   * Determine the target state for a tool based on its metrics
   */
  determineTargetState(tool) {
    // Force deprecation for malware or very low security
    if (tool.malware_detected) {
      return STATES.DEPRECATED;
    }
    if (tool.security_score !== null && tool.security_score !== undefined && tool.security_score < 0.3) {
      return STATES.DEPRECATED;
    }

    // Archive old deprecated tools
    if (tool.state === STATES.DEPRECATED && tool.deprecated_since) {
      const deprecatedDate = new Date(tool.deprecated_since);
      const now = new Date();
      if (now - deprecatedDate > 90 * 24 * 60 * 60 * 1000) {
        return STATES.ARCHIVED;
      }
    }

    // Progressive promotion
    if (tool.state === STATES.DISCOVERED) {
      const hasDescription = tool.description && tool.description.length > 10;
      const hasSchema = tool.schema && tool.schema !== 'null';
      if (hasDescription && hasSchema) return STATES.VALIDATED;
    }

    if (tool.state === STATES.VALIDATED) {
      if (tool.security_score >= 0.5) return STATES.VERIFIED;
    }

    if (tool.state === STATES.VERIFIED) {
      // Check latest benchmark
      if (tool.benchmark_score >= 0.4) return STATES.BENCHMARKED;
    }

    if (tool.state === STATES.BENCHMARKED || tool.state === STATES.VERIFIED) {
      if (tool.trust_score >= 0.7) return STATES.RANKED;
    }

    if (tool.state === STATES.RANKED) {
      if (tool.popularity_score >= 50 || tool.trust_score >= 0.8) return STATES.ACTIVE;
    }

    return null;
  }

  /**
   * Get reason for a transition
   */
  getReason(tool, targetState) {
    const reasons = {
      [STATES.VALIDATED]: 'Description and schema present',
      [STATES.VERIFIED]: `Security score ${tool.security_score} >= 0.5`,
      [STATES.BENCHMARKED]: `Benchmark score ${tool.benchmark_score} >= 0.4`,
      [STATES.RANKED]: `Trust score ${tool.trust_score} >= 0.7`,
      [STATES.ACTIVE]: `Popularity ${tool.popularity_score} or trust ${tool.trust_score} sufficient`,
      [STATES.DEPRECATED]: `Malware: ${tool.malware_detected}, security: ${tool.security_score}`,
      [STATES.ARCHIVED]: 'Deprecated for more than 90 days'
    };
    return reasons[targetState] || 'Lifecycle rule evaluation';
  }

  /**
   * Perform a state transition
   */
  async transition(toolName, fromState, toState, reason) {
    await this.db.prepare(
      `UPDATE tools
       SET state = ?, state_updated = CURRENT_TIMESTAMP
       WHERE name = ?`
    ).bind(toState, toolName).run();

    await this.db.prepare(
      `INSERT INTO lifecycle_log (tool_name, from_state, to_state, reason, triggered_by)
       VALUES (?, ?, ?, ?, 'lifecycle-manager')`
    ).bind(toolName, fromState, toState, reason).run();
  }

  /**
   * Evaluate all tools
   */
  async evaluateAll() {
    const tools = await this.db.prepare(
      `SELECT t.name, t.state, t.description, t.schema, t.security_score, t.malware_detected,
              t.trust_score, t.popularity_score, t.deprecated_since,
              b.benchmark_score
       FROM tools t
       LEFT JOIN (
         SELECT tool_name, benchmark_score
         FROM benchmark_results
         WHERE (tool_name, benchmarked_at) IN (
           SELECT tool_name, MAX(benchmarked_at)
           FROM benchmark_results
           GROUP BY tool_name
         )
       ) b ON t.name = b.tool_name
       WHERE t.deprecated = FALSE
       ORDER BY t.name`
    ).all();

    const results = {
      evaluated: 0,
      transitioned: 0,
      errors: 0,
      transitions: []
    };

    for (const tool of tools.results || []) {
      try {
        const result = await this.evaluateTool(tool);
        results.evaluated++;
        if (result.changed) {
          results.transitioned++;
          results.transitions.push({
            tool: tool.name,
            from: result.from,
            to: result.to
          });
        }
      } catch (error) {
        results.errors++;
        console.error(`Lifecycle evaluation failed for ${tool.name}:`, error);
      }
    }

    return results;
  }

  /**
   * Get lifecycle history for a tool
   */
  async getHistory(toolName) {
    const history = await this.db.prepare(
      `SELECT * FROM lifecycle_log WHERE tool_name = ? ORDER BY created_at DESC`
    ).bind(toolName).all();

    return history.results || [];
  }
}
