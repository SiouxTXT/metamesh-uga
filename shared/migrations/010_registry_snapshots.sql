-- MetaMesh-UGA Migration 010 - Registry Snapshots

-- ============================================
-- TABELLA REGISTRY SNAPSHOTS
-- ============================================
CREATE TABLE IF NOT EXISTS registry_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  key TEXT UNIQUE NOT NULL,
  source TEXT DEFAULT 'manual',
  size_bytes INTEGER,
  tool_count INTEGER,
  source_count INTEGER,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'success', 'failed')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  restored_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_registry_snapshots_key ON registry_snapshots(key);
CREATE INDEX IF NOT EXISTS idx_registry_snapshots_created ON registry_snapshots(created_at);
