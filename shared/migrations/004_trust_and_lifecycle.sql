-- MetaMesh-UGA Migration 004 - Trust Score, Security, Lifecycle, Registry Federation

-- ============================================
-- ESTENSIONE TABELLA tools
-- ============================================
ALTER TABLE tools ADD COLUMN IF NOT EXISTS trust_score DECIMAL(5,4) DEFAULT 0.5;
ALTER TABLE tools ADD COLUMN IF NOT EXISTS trust_score_confidence DECIMAL(5,4) DEFAULT 0.0;
ALTER TABLE tools ADD COLUMN IF NOT EXISTS trust_score_updated TIMESTAMP;
ALTER TABLE tools ADD COLUMN IF NOT EXISTS security_score DECIMAL(5,4) DEFAULT 0.5;
ALTER TABLE tools ADD COLUMN IF NOT EXISTS security_scan_updated TIMESTAMP;
ALTER TABLE tools ADD COLUMN IF NOT EXISTS cve_count INTEGER DEFAULT 0;
ALTER TABLE tools ADD COLUMN IF NOT EXISTS malware_detected BOOLEAN DEFAULT FALSE;
ALTER TABLE tools ADD COLUMN IF NOT EXISTS state TEXT DEFAULT 'DISCOVERED' CHECK(state IN ('DISCOVERED', 'VALIDATED', 'VERIFIED', 'BENCHMARKED', 'RANKED', 'ACTIVE', 'DEPRECATED', 'ARCHIVED'));
ALTER TABLE tools ADD COLUMN IF NOT EXISTS state_updated TIMESTAMP;
ALTER TABLE tools ADD COLUMN IF NOT EXISTS registry_source TEXT DEFAULT 'mcp-official';
ALTER TABLE tools ADD COLUMN IF NOT EXISTS registry_priority INTEGER DEFAULT 0;
ALTER TABLE tools ADD COLUMN IF NOT EXISTS federation_id TEXT;
ALTER TABLE tools ADD COLUMN IF NOT EXISTS capabilities TEXT; -- JSON array of capabilities

CREATE INDEX IF NOT EXISTS idx_tools_trust_score ON tools(trust_score);
CREATE INDEX IF NOT EXISTS idx_tools_security_score ON tools(security_score);
CREATE INDEX IF NOT EXISTS idx_tools_state ON tools(state);
CREATE INDEX IF NOT EXISTS idx_tools_registry_source ON tools(registry_source);

-- ============================================
-- TABELLA STORICO TRUST SCORE
-- ============================================
CREATE TABLE IF NOT EXISTS trust_score_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tool_name TEXT NOT NULL,
  score DECIMAL(5,4),
  confidence DECIMAL(5,4),
  components JSON,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tool_name) REFERENCES tools(name)
);

CREATE INDEX IF NOT EXISTS idx_trust_history_tool ON trust_score_history(tool_name);
CREATE INDEX IF NOT EXISTS idx_trust_history_recorded ON trust_score_history(recorded_at);

-- ============================================
-- TABELLA SECURITY SCANS
-- ============================================
CREATE TABLE IF NOT EXISTS security_scans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tool_name TEXT NOT NULL,
  security_score DECIMAL(5,4),
  cve_count INTEGER DEFAULT 0,
  critical_cve_count INTEGER DEFAULT 0,
  high_cve_count INTEGER DEFAULT 0,
  malware_detected BOOLEAN DEFAULT FALSE,
  permissions JSON,
  network_analysis JSON,
  filesystem_analysis JSON,
  dependency_analysis JSON,
  scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tool_name) REFERENCES tools(name)
);

CREATE INDEX IF NOT EXISTS idx_security_scans_tool ON security_scans(tool_name);
CREATE INDEX IF NOT EXISTS idx_security_scans_scanned ON security_scans(scanned_at);

-- ============================================
-- TABELLA REGISTRY SOURCES
-- ============================================
CREATE TABLE IF NOT EXISTS registry_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  url TEXT NOT NULL,
  type TEXT DEFAULT 'official' CHECK(type IN ('official', 'community', 'private')),
  priority INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT TRUE,
  sync_interval_hours INTEGER DEFAULT 6,
  last_sync TIMESTAMP,
  last_status TEXT DEFAULT 'pending' CHECK(last_status IN ('pending', 'success', 'failed')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_registry_sources_priority ON registry_sources(priority);
CREATE INDEX IF NOT EXISTS idx_registry_sources_enabled ON registry_sources(enabled);

-- ============================================
-- TABELLA LIFECYCLE LOG
-- ============================================
CREATE TABLE IF NOT EXISTS lifecycle_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tool_name TEXT NOT NULL,
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  reason TEXT,
  triggered_by TEXT DEFAULT 'system',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tool_name) REFERENCES tools(name)
);

CREATE INDEX IF NOT EXISTS idx_lifecycle_log_tool ON lifecycle_log(tool_name);
CREATE INDEX IF NOT EXISTS idx_lifecycle_log_created ON lifecycle_log(created_at);

-- ============================================
-- VISTA TRUSTED TOOLS
-- ============================================
CREATE VIEW IF NOT EXISTS v_trusted_tools AS
SELECT 
  name,
  version,
  category,
  description,
  trust_score,
  trust_score_confidence,
  security_score,
  state,
  popularity_score
FROM tools
WHERE deprecated = FALSE
  AND trust_score >= 0.7
  AND security_score >= 0.5
  AND state IN ('RANKED', 'ACTIVE')
ORDER BY trust_score DESC, popularity_score DESC;

-- ============================================
-- SEED DEFAULT REGISTRY SOURCE
-- ============================================
INSERT OR IGNORE INTO registry_sources (name, url, type, priority, sync_interval_hours) VALUES
('mcp-official', 'https://registry.mcp.io/v0.1/servers', 'official', 0, 6);
