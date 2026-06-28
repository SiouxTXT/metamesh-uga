-- MetaMesh-UGA Migration 006 - Policy Engine

-- ============================================
-- TABELLA POLICIES
-- ============================================
CREATE TABLE IF NOT EXISTS policies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  priority INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT TRUE,
  effect TEXT DEFAULT 'deny' CHECK(effect IN ('allow', 'deny')),
  conditions JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_policies_enabled ON policies(enabled);
CREATE INDEX IF NOT EXISTS idx_policies_priority ON policies(priority);

-- ============================================
-- TABELLA POLICY EVALUATION LOG
-- ============================================
CREATE TABLE IF NOT EXISTS policy_evaluations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  policy_id INTEGER,
  tool_name TEXT,
  user_id INTEGER,
  decision TEXT CHECK(decision IN ('allow', 'deny')),
  reason TEXT,
  evaluated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (policy_id) REFERENCES policies(id)
);

CREATE INDEX IF NOT EXISTS idx_policy_evaluations_tool ON policy_evaluations(tool_name);
CREATE INDEX IF NOT EXISTS idx_policy_evaluations_decision ON policy_evaluations(decision);

-- ============================================
-- SEED DEFAULT POLICIES
-- ============================================
INSERT OR IGNORE INTO policies (name, description, priority, effect, conditions) VALUES
('block-low-security', 'Block tools with security score below 0.5', 100, 'deny', '{"operator": "lt", "field": "server.security_score", "value": 0.5, "message": "Tool has security score below 0.5"}'),
('block-malware', 'Block tools with malware detected', 200, 'deny', '{"operator": "eq", "field": "server.malware_detected", "value": true, "message": "Malware detected"}'),
('block-deprecated', 'Block deprecated tools', 50, 'deny', '{"operator": "eq", "field": "server.deprecated", "value": true, "message": "Tool is deprecated"}'),
('require-active-state', 'Require active or ranked state for tool usage', 75, 'deny', '{"operator": "not_in", "field": "server.state", "value": ["ACTIVE", "RANKED"], "message": "Tool must be ACTIVE or RANKED"}'),
('allow-admin-any', 'Allow admins to use any tool', 10, 'allow', '{"operator": "eq", "field": "user.role", "value": "admin"}');
