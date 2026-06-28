/**
 * MetaMesh-UGA Trust Score Engine
 * 
 * Computes trust scores for MCP servers based on observable metrics.
 * Phase 2 implementation uses:
 * - uptime (usage_log)
 * - latency (usage_log)
 * - success_rate (usage_log)
 * - popularity (usage_log)
 * - security (security scanner)
 * 
 * Additional components (maintainer activity, update frequency, etc.) will be
 * integrated in later phases.
 */

export const TRUST_COMPONENTS = {
  uptime: { weight: 0.20, min: 0, max: 1 },
  latency: { weight: 0.20, min: 0, max: 5000 },
  success_rate: { weight: 0.20, min: 0, max: 1 },
  popularity: { weight: 0.20, min: 0, max: 1000 },
  security: { weight: 0.20, min: 0, max: 1 }
};

/**
 * Main trust score calculator
 */
export class TrustScoreEngine {
  constructor(db) {
    this.db = db;
  }

  /**
   * Compute trust score for a single tool
   */
  async calculate(toolName) {
    const metrics = await this.collectMetrics(toolName);
    const normalized = this.normalize(metrics);
    const score = this.weightedSum(normalized);
    const confidence = this.calculateConfidence(metrics);

    return {
      tool_name: toolName,
      score: Math.min(Math.max(score, 0), 1),
      confidence: Math.min(Math.max(confidence, 0), 1),
      components: normalized,
      raw_metrics: metrics,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Compute trust scores for all active tools
   */
  async calculateAll(limit = 1000) {
    const tools = await this.db.prepare(
      'SELECT name FROM tools WHERE deprecated = FALSE ORDER BY name LIMIT ?'
    ).bind(limit).all();

    const results = {
      processed: 0,
      updated: 0,
      failed: 0,
      errors: []
    };

    for (const tool of tools.results || []) {
      try {
        const score = await this.calculate(tool.name);
        await this.store(score);
        results.updated++;
      } catch (error) {
        results.failed++;
        results.errors.push({ tool: tool.name, error: error.message });
        console.error(`Trust score failed for ${tool.name}:`, error);
      }
      results.processed++;
    }

    return results;
  }

  /**
   * Collect raw metrics from usage_log
   */
  async collectMetrics(toolName) {
    const windowDays = 30;

    // Total calls and success/error counts
    const calls = await this.db.prepare(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'success' THEN 1 END) as success,
        COUNT(CASE WHEN status = 'error' THEN 1 END) as error,
        AVG(CASE WHEN status = 'success' THEN latency_ms END) as avg_latency,
        PERCENTILE(CASE WHEN status = 'success' THEN latency_ms END, 50) as p50_latency,
        PERCENTILE(CASE WHEN status = 'success' THEN latency_ms END, 95) as p95_latency,
        MAX(called_at) as last_called
      FROM usage_log
      WHERE tool_name = ?
        AND called_at > datetime('now', '-${windowDays} days')`
    ).bind(toolName).first();

    // Recent popularity (last 7 days)
    const popularity = await this.db.prepare(
      `SELECT COUNT(*) as calls
      FROM usage_log
      WHERE tool_name = ?
        AND called_at > datetime('now', '-7 days')`
    ).bind(toolName).first();

    const total = calls?.total || 0;
    const success = calls?.success || 0;
    const error = calls?.error || 0;
    const successRate = total > 0 ? success / total : 0;
    const uptime = total > 0 ? 1 - (error / total) : 0;
    const latency = calls?.p50_latency || calls?.avg_latency || 5000;
    const popScore = popularity?.calls || 0;

    // Fetch security score from tools table
    const toolInfo = await this.db.prepare(
      'SELECT security_score FROM tools WHERE name = ?'
    ).bind(toolName).first();
    const securityScore = toolInfo?.security_score ?? 0.5;

    return {
      uptime,
      latency,
      success_rate: successRate,
      popularity: popScore,
      security: securityScore,
      total_calls: total,
      window_days: windowDays
    };
  }

  /**
   * Normalize metrics to 0-1 range
   */
  normalize(metrics) {
    const result = {};
    for (const [key, value] of Object.entries(metrics)) {
      const config = TRUST_COMPONENTS[key];
      if (!config) continue;
      const normalized = (value - config.min) / (config.max - config.min);
      result[key] = Math.min(Math.max(normalized, 0), 1);
    }
    return result;
  }

  /**
   * Weighted sum of normalized components
   */
  weightedSum(normalized) {
    let score = 0;
    for (const [key, value] of Object.entries(normalized)) {
      const weight = TRUST_COMPONENTS[key]?.weight || 0;
      score += value * weight;
    }
    return score;
  }

  /**
   * Calculate confidence based on sample size
   */
  calculateConfidence(metrics) {
    const totalCalls = metrics.total_calls || 0;
    // Confidence grows with sample size: 0 calls = 0, 100+ calls = 1
    const confidence = Math.min(totalCalls / 100, 1);
    return confidence;
  }

  /**
   * Store trust score in database and history
   */
  async store(score) {
    await this.db.prepare(
      `UPDATE tools SET
        trust_score = ?,
        trust_score_confidence = ?,
        trust_score_updated = CURRENT_TIMESTAMP
      WHERE name = ?`
    ).bind(score.score, score.confidence, score.tool_name).run();

    await this.db.prepare(
      `INSERT INTO trust_score_history
        (tool_name, score, confidence, components)
        VALUES (?, ?, ?, ?)`
    ).bind(
      score.tool_name,
      score.score,
      score.confidence,
      JSON.stringify(score.components)
    ).run();
  }

  /**
   * Get trust score for a tool
   */
  async getScore(toolName) {
    const tool = await this.db.prepare(
      `SELECT name, trust_score, trust_score_confidence, trust_score_updated
      FROM tools WHERE name = ?`
    ).bind(toolName).first();

    if (!tool) {
      return null;
    }

    return {
      tool_name: tool.name,
      score: tool.trust_score,
      confidence: tool.trust_score_confidence,
      updated_at: tool.trust_score_updated
    };
  }

  /**
   * Get top trusted tools
   */
  async getTopTrusted(limit = 50, minScore = 0.7) {
    const tools = await this.db.prepare(
      `SELECT name, version, category, description, trust_score, trust_score_confidence
      FROM tools
      WHERE deprecated = FALSE
        AND trust_score >= ?
        AND state IN ('RANKED', 'ACTIVE')
      ORDER BY trust_score DESC, popularity_score DESC
      LIMIT ?`
    ).bind(minScore, limit).all();

    return tools.results || [];
  }
}
