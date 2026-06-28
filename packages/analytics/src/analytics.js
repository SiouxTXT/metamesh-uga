/**
 * MetaMesh-UGA Analytics Engine
 * 
 * Aggregates real-time and historical metrics for dashboards and export.
 * Provides:
 * - Usage metrics
 * - Health metrics
 * - Cost metrics
 * - Prometheus export
 * - OpenTelemetry export
 */

export class AnalyticsEngine {
  constructor(db) {
    this.db = db;
  }

  /**
   * Get usage dashboard data
   */
  async getUsageDashboard(hours = 24) {
    const data = await this.db.prepare(
      `SELECT tool_name, SUM(calls) as calls, SUM(successes) as successes,
              SUM(errors) as errors, AVG(avg_latency) as avg_latency,
              AVG(p95_latency) as p95_latency
       FROM v_usage_dashboard
       WHERE day >= date('now', '-${hours / 24} days')
       GROUP BY tool_name
       ORDER BY calls DESC
       LIMIT 50`
    ).all();

    return data.results || [];
  }

  /**
   * Get health dashboard data
   */
  async getHealthDashboard() {
    const data = await this.db.prepare(
      `SELECT * FROM v_health_dashboard ORDER BY calls_24h DESC LIMIT 100`
    ).all();

    return data.results || [];
  }

  /**
   * Get recent error distribution
   */
  async getErrorDistribution(hours = 24) {
    const data = await this.db.prepare(
      `SELECT 
        tool_name,
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'error' THEN 1 END) as errors,
        ROUND(COUNT(CASE WHEN status = 'error' THEN 1 END) * 100.0 / COUNT(*), 2) as error_rate
       FROM usage_log
       WHERE called_at > datetime('now', '-${hours} hours')
       GROUP BY tool_name
       HAVING total > 5
       ORDER BY error_rate DESC
       LIMIT 20`
    ).all();

    return data.results || [];
  }

  /**
   * Export metrics in Prometheus format
   */
  async exportPrometheus() {
    const health = await this.getHealthDashboard();
    const lines = [];
    
    lines.push('# HELP metamesh_trust_score Tool trust score');
    lines.push('# TYPE metamesh_trust_score gauge');
    for (const tool of health) {
      lines.push(`metamesh_trust_score{name="${tool.name}"} ${tool.trust_score || 0}`);
    }
    
    lines.push('# HELP metamesh_security_score Tool security score');
    lines.push('# TYPE metamesh_security_score gauge');
    for (const tool of health) {
      lines.push(`metamesh_security_score{name="${tool.name}"} ${tool.security_score || 0}`);
    }
    
    lines.push('# HELP metamesh_calls_24h Tool calls in last 24h');
    lines.push('# TYPE metamesh_calls_24h counter');
    for (const tool of health) {
      lines.push(`metamesh_calls_24h{name="${tool.name}"} ${tool.calls_24h || 0}`);
    }
    
    lines.push('# HELP metamesh_errors_24h Tool errors in last 24h');
    lines.push('# TYPE metamesh_errors_24h counter');
    for (const tool of health) {
      lines.push(`metamesh_errors_24h{name="${tool.name}"} ${tool.errors_24h || 0}`);
    }
    
    lines.push('# HELP metamesh_benchmark_latency_p95 Benchmark p95 latency');
    lines.push('# TYPE metamesh_benchmark_latency_p95 gauge');
    for (const tool of health) {
      if (tool.response_time_p95_ms) {
        lines.push(`metamesh_benchmark_latency_p95{name="${tool.name}"} ${tool.response_time_p95_ms}`);
      }
    }
    
    return lines.join('\n');
  }

  /**
   * Export metrics in OpenTelemetry format (simple JSON)
   */
  async exportOpenTelemetry() {
    const health = await this.getHealthDashboard();
    const now = new Date().toISOString();
    
    const metrics = health.map(tool => ({
      name: 'metamesh.tool.health',
      timestamp: now,
      attributes: {
        tool_name: tool.name,
        category: tool.category,
        state: tool.state
      },
      values: {
        trust_score: tool.trust_score || 0,
        security_score: tool.security_score || 0,
        benchmark_score: tool.benchmark_score || 0,
        calls_24h: tool.calls_24h || 0,
        errors_24h: tool.errors_24h || 0,
        p95_latency_ms: tool.response_time_p95_ms || 0
      }
    }));
    
    return {
      resource: {
        service: 'metamesh-uga',
        version: '1.0.0'
      },
      metrics
    };
  }

  /**
   * Record a metric
   */
  async recordMetric(name, value, labels = {}) {
    await this.db.prepare(
      `INSERT INTO analytics_metrics (metric_name, metric_value, labels)
       VALUES (?, ?, ?)`
    ).bind(name, value, JSON.stringify(labels)).run();
  }

  /**
   * Get recent metrics
   */
  async getMetrics(name, limit = 100) {
    let whereClause = '';
    const params = [];
    
    if (name) {
      whereClause = 'WHERE metric_name = ?';
      params.push(name);
    }
    
    const metrics = await this.db.prepare(
      `SELECT * FROM analytics_metrics ${whereClause}
       ORDER BY recorded_at DESC LIMIT ?`
    ).bind(...params, limit).all();
    
    return metrics.results || [];
  }
}
