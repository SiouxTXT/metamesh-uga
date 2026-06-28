-- MetaMesh-UGA Migration 009 - Analytics Metrics

-- ============================================
-- TABELLA METRICS
-- ============================================
CREATE TABLE IF NOT EXISTS analytics_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_name TEXT NOT NULL,
  metric_value REAL,
  labels JSON,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_analytics_name ON analytics_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_analytics_time ON analytics_metrics(recorded_at);

-- ============================================
-- VISTA USAGE DASHBOARD
-- ============================================
CREATE VIEW IF NOT EXISTS v_usage_dashboard AS
SELECT 
  tool_name,
  COUNT(*) as calls,
  COUNT(CASE WHEN status = 'success' THEN 1 END) as successes,
  COUNT(CASE WHEN status = 'error' THEN 1 END) as errors,
  AVG(latency_ms) as avg_latency,
  PERCENTILE(latency_ms, 95) as p95_latency,
  MAX(called_at) as last_called,
  DATE(called_at) as day
FROM usage_log
GROUP BY tool_name, DATE(called_at);

-- ============================================
-- VISTA HEALTH DASHBOARD
-- ============================================
CREATE VIEW IF NOT EXISTS v_health_dashboard AS
SELECT 
  t.name,
  t.trust_score,
  t.security_score,
  t.state,
  b.benchmark_score,
  b.response_time_p95_ms,
  b.success_rate as benchmark_success_rate,
  (SELECT COUNT(*) FROM usage_log WHERE tool_name = t.name AND called_at > datetime('now', '-24 hours')) as calls_24h,
  (SELECT COUNT(*) FROM usage_log WHERE tool_name = t.name AND status = 'error' AND called_at > datetime('now', '-24 hours')) as errors_24h
FROM tools t
LEFT JOIN (
  SELECT tool_name, benchmark_score, response_time_p95_ms, success_rate
  FROM benchmark_results
  WHERE (tool_name, benchmarked_at) IN (
    SELECT tool_name, MAX(benchmarked_at)
    FROM benchmark_results
    GROUP BY tool_name
  )
) b ON t.name = b.tool_name
WHERE t.deprecated = FALSE;
