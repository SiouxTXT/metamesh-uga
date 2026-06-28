/**
 * MetaMesh-UGA AI Intelligence Layer
 * 
 * Provides analytics insights, anomaly detection, and trend analysis
 * for the MCP ecosystem.
 * 
 * Phase 4 implementation: statistical analysis using D1 data.
 * Future phases can integrate with real ML models or external AI APIs.
 */

export class IntelligenceEngine {
  constructor(db) {
    this.db = db;
  }

  /**
   * Generate insights across multiple dimensions
   */
  async generateInsights() {
    const insights = {
      timestamp: new Date().toISOString(),
      usage_trends: await this.getUsageTrends(),
      top_tools: await this.getTopTools(),
      declining_tools: await this.getDecliningTools(),
      anomalies: await this.detectAnomalies(),
      security_risks: await this.getSecurityRisks(),
      cost_analysis: await this.getCostAnalysis(),
      recommendations: []
    };

    insights.recommendations = this.generateRecommendations(insights);
    return insights;
  }

  /**
   * Get usage trends (last 7 days vs previous 7 days)
   */
  async getUsageTrends() {
    const current = await this.db.prepare(
      `SELECT COUNT(*) as calls, AVG(latency_ms) as avg_latency
       FROM usage_log
       WHERE called_at > datetime('now', '-7 days')`
    ).first();

    const previous = await this.db.prepare(
      `SELECT COUNT(*) as calls, AVG(latency_ms) as avg_latency
       FROM usage_log
       WHERE called_at > datetime('now', '-14 days')
         AND called_at <= datetime('now', '-7 days')`
    ).first();

    const currentCalls = current?.calls || 0;
    const previousCalls = previous?.calls || 0;
    const changePercent = previousCalls > 0
      ? ((currentCalls - previousCalls) / previousCalls) * 100
      : 0;

    return {
      current_7d_calls: currentCalls,
      previous_7d_calls: previousCalls,
      change_percent: Math.round(changePercent * 10) / 10,
      current_avg_latency_ms: current?.avg_latency || 0,
      previous_avg_latency_ms: previous?.avg_latency || 0
    };
  }

  /**
   * Get top tools by usage
   */
  async getTopTools() {
    const tools = await this.db.prepare(
      `SELECT tool_name, COUNT(*) as calls, AVG(latency_ms) as avg_latency
       FROM usage_log
       WHERE called_at > datetime('now', '-7 days')
       GROUP BY tool_name
       ORDER BY calls DESC
       LIMIT 10`
    ).all();

    return tools.results || [];
  }

  /**
   * Get declining tools (usage dropped significantly)
   */
  async getDecliningTools() {
    const tools = await this.db.prepare(
      `SELECT 
        tool_name,
        COUNT(CASE WHEN called_at > datetime('now', '-7 days') THEN 1 END) as current_7d,
        COUNT(CASE WHEN called_at > datetime('now', '-14 days') AND called_at <= datetime('now', '-7 days') THEN 1 END) as previous_7d
       FROM usage_log
       WHERE called_at > datetime('now', '-14 days')
       GROUP BY tool_name
       HAVING current_7d < previous_7d * 0.5 AND previous_7d > 5`
    ).all();

    return (tools.results || []).map(t => ({
      tool_name: t.tool_name,
      current_7d: t.current_7d,
      previous_7d: t.previous_7d,
      decline_percent: t.previous_7d > 0
        ? Math.round(((t.previous_7d - t.current_7d) / t.previous_7d) * 100)
        : 0
    }));
  }

  /**
   * Detect anomalies in usage and latency
   */
  async detectAnomalies() {
    const anomalies = [];

    // Anomaly: high error rate
    const errors = await this.db.prepare(
      `SELECT tool_name, COUNT(*) as error_count,
        COUNT(CASE WHEN status = 'success' THEN 1 END) as success_count
       FROM usage_log
       WHERE called_at > datetime('now', '-24 hours')
       GROUP BY tool_name`
    ).all();

    for (const row of errors.results || []) {
      const total = row.error_count + row.success_count;
      const errorRate = total > 0 ? row.error_count / total : 0;
      if (errorRate > 0.5 && total > 10) {
        anomalies.push({
          type: 'high_error_rate',
          tool_name: row.tool_name,
          error_rate: Math.round(errorRate * 100) / 100,
          total_calls: total,
          severity: errorRate > 0.8 ? 'critical' : 'warning'
        });
      }
    }

    // Anomaly: latency spike
    const latencies = await this.db.prepare(
      `SELECT tool_name, AVG(latency_ms) as avg_latency, COUNT(*) as calls
       FROM usage_log
       WHERE called_at > datetime('now', '-24 hours')
       GROUP BY tool_name
       HAVING avg_latency > 2000`
    ).all();

    for (const row of latencies.results || []) {
      anomalies.push({
        type: 'high_latency',
        tool_name: row.tool_name,
        avg_latency_ms: Math.round(row.avg_latency),
        calls: row.calls,
        severity: row.avg_latency > 5000 ? 'critical' : 'warning'
      });
    }

    return anomalies;
  }

  /**
   * Get security risks
   */
  async getSecurityRisks() {
    const tools = await this.db.prepare(
      `SELECT name, security_score, malware_detected, cve_count, state
       FROM tools
       WHERE deprecated = FALSE
         AND (security_score < 0.5 OR malware_detected = TRUE)
       ORDER BY security_score ASC
       LIMIT 20`
    ).all();

    return tools.results || [];
  }

  /**
   * Get cost analysis
   */
  async getCostAnalysis() {
    const costs = await this.db.prepare(
      `SELECT 
        u.tool_name,
        COUNT(*) as calls,
        COALESCE(p.price_per_call_usd, 0.001) as price_per_call,
        COUNT(*) * COALESCE(p.price_per_call_usd, 0.001) as estimated_cost
       FROM usage_log u
       LEFT JOIN tool_pricing p ON u.tool_name = p.tool_name
       WHERE u.called_at > datetime('now', '-30 days')
       GROUP BY u.tool_name
       ORDER BY estimated_cost DESC
       LIMIT 10`
    ).all();

    const total = costs.results?.reduce((sum, c) => sum + c.estimated_cost, 0) || 0;

    return {
      total_estimated_cost_usd: Math.round(total * 1000) / 1000,
      by_tool: costs.results || []
    };
  }

  /**
   * Generate recommendations based on insights
   */
  generateRecommendations(insights) {
    const recommendations = [];

    if (insights.usage_trends.change_percent < -20) {
      recommendations.push({
        type: 'usage_decline',
        message: `Overall usage declined by ${insights.usage_trends.change_percent}% in the last 7 days. Investigate gateway health or marketing.`,
        priority: 'high'
      });
    }

    if (insights.usage_trends.current_avg_latency_ms > insights.usage_trends.previous_avg_latency_ms * 1.5) {
      recommendations.push({
        type: 'latency_increase',
        message: 'Average latency increased significantly. Review routing and reliability configuration.',
        priority: 'high'
      });
    }

    for (const anomaly of insights.anomalies) {
      if (anomaly.type === 'high_error_rate') {
        recommendations.push({
          type: 'tool_reliability',
          message: `Tool ${anomaly.tool_name} has error rate ${anomaly.error_rate}. Consider deprecation or fallback.`,
          priority: 'critical',
          tool: anomaly.tool_name
        });
      }
    }

    for (const risk of insights.security_risks.slice(0, 3)) {
      recommendations.push({
        type: 'security_risk',
        message: `Tool ${risk.name} has security score ${risk.security_score}. Review or quarantine.`,
        priority: 'high',
        tool: risk.name
      });
    }

    for (const tool of insights.declining_tools.slice(0, 3)) {
      recommendations.push({
        type: 'declining_tool',
        message: `Tool ${tool.tool_name} usage declined by ${tool.decline_percent}%. Consider promotion or deprecation.`,
        priority: 'medium',
        tool: tool.tool_name
      });
    }

    return recommendations;
  }
}
