-- MetaMesh-UGA Migration 011 - Configuration Engine

-- ============================================
-- TABELLA CONFIGURATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS configurations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  type TEXT DEFAULT 'string' CHECK(type IN ('string', 'number', 'boolean', 'json')),
  scope TEXT DEFAULT 'global' CHECK(scope IN ('global', 'tenant', 'user')),
  scope_id TEXT,
  description TEXT,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_config_key ON configurations(key);
CREATE INDEX IF NOT EXISTS idx_config_scope ON configurations(scope, scope_id);

-- ============================================
-- TABELLA FEATURE FLAGS
-- ============================================
CREATE TABLE IF NOT EXISTS feature_flags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  enabled BOOLEAN DEFAULT FALSE,
  target_percent INTEGER DEFAULT 100,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_name ON feature_flags(name);

-- ============================================
-- SEED DEFAULT CONFIG
-- ============================================
INSERT OR IGNORE INTO configurations (key, value, type, scope, description) VALUES
('discovery.enabled', 'true', 'boolean', 'global', 'Enable discovery cron'),
('security.scan.enabled', 'true', 'boolean', 'global', 'Enable security scans'),
('benchmark.enabled', 'true', 'boolean', 'global', 'Enable benchmark engine'),
('gateway.default_routing_strategy', 'weighted', 'string', 'global', 'Default routing strategy'),
('gateway.rate_limit_enabled', 'true', 'boolean', 'global', 'Enable rate limiting'),
('recommendation.max_results', '10', 'number', 'global', 'Max recommendation results');

INSERT OR IGNORE INTO feature_flags (name, enabled, description) VALUES
('smart_routing', TRUE, 'Enable smart routing engine'),
('cost_optimizer', TRUE, 'Enable cost optimization'),
('intent_search', TRUE, 'Enable intent-based search'),
('recommendation_engine', TRUE, 'Enable recommendation engine'),
('advanced_cache', FALSE, 'Enable advanced multi-level cache'),
('multi_region', FALSE, 'Enable multi-region deployment');
