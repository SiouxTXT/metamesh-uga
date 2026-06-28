-- MetaMesh-UGA Migration 012 - Health Engine

-- ============================================
-- TABELLA HEALTH CHECKS
-- ============================================
CREATE TABLE IF NOT EXISTS health_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tool_name TEXT NOT NULL,
  status TEXT DEFAULT 'unknown' CHECK(status IN ('healthy', 'degraded', 'unhealthy', 'unknown')),
  response_time_ms INTEGER,
  http_status INTEGER,
  error_message TEXT,
  checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tool_name) REFERENCES tools(name)
);

CREATE INDEX IF NOT EXISTS idx_health_tool ON health_checks(tool_name);
CREATE INDEX IF NOT EXISTS idx_health_time ON health_checks(checked_at);

-- ============================================
-- VISTA LATEST HEALTH
-- ============================================
CREATE VIEW IF NOT EXISTS v_tool_health AS
SELECT 
  t.name,
  t.category,
  t.state,
  t.trust_score,
  h.status as health_status,
  h.response_time_ms,
  h.http_status,
  h.error_message,
  h.checked_at
FROM tools t
LEFT JOIN (
  SELECT tool_name, status, response_time_ms, http_status, error_message, checked_at
  FROM health_checks
  WHERE (tool_name, checked_at) IN (
    SELECT tool_name, MAX(checked_at)
    FROM health_checks
    GROUP BY tool_name
  )
) h ON t.name = h.tool_name
WHERE t.deprecated = FALSE;
