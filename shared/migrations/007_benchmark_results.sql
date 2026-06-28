-- MetaMesh-UGA Migration 007 - Benchmark Engine

-- ============================================
-- TABELLA BENCHMARK RESULTS
-- ============================================
CREATE TABLE IF NOT EXISTS benchmark_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tool_name TEXT NOT NULL,
  startup_time_ms INTEGER,
  response_time_p50_ms INTEGER,
  response_time_p95_ms INTEGER,
  memory_usage_mb INTEGER,
  success_rate DECIMAL(5,4),
  throughput_rps INTEGER,
  benchmark_score DECIMAL(5,4),
  details JSON,
  benchmarked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tool_name) REFERENCES tools(name)
);

CREATE INDEX IF NOT EXISTS idx_benchmark_tool ON benchmark_results(tool_name);
CREATE INDEX IF NOT EXISTS idx_benchmark_date ON benchmark_results(benchmarked_at);

-- ============================================
-- VISTA RANKING
-- ============================================
CREATE VIEW IF NOT EXISTS v_tool_ranking AS
SELECT 
  t.name,
  t.category,
  t.trust_score,
  t.security_score,
  b.benchmark_score,
  b.response_time_p95_ms,
  b.success_rate,
  b.throughput_rps,
  (t.trust_score * 0.4 + t.security_score * 0.3 + COALESCE(b.benchmark_score, 0.5) * 0.3) AS overall_score
FROM tools t
LEFT JOIN benchmark_results b ON t.name = b.tool_name
  AND b.benchmarked_at = (
    SELECT MAX(benchmarked_at) FROM benchmark_results WHERE tool_name = t.name
  )
WHERE t.deprecated = FALSE
ORDER BY overall_score DESC;
