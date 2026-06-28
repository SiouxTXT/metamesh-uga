-- MetaMesh-UGA Migration 003 - Discovery and Changelog tables

CREATE TABLE IF NOT EXISTS discovery_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('running', 'completed', 'failed')),
  tools_found INTEGER DEFAULT 0,
  tools_added INTEGER DEFAULT 0,
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_discovery_log_status ON discovery_log(status);
CREATE INDEX IF NOT EXISTS idx_discovery_log_completed ON discovery_log(completed_at);

CREATE TABLE IF NOT EXISTS changelog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version TEXT NOT NULL,
  changes TEXT NOT NULL,
  released_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO changelog (version, changes, released_at) VALUES
('1.0.0', 'Initial release with MCP server, tool discovery, REST API, and dynamic docs.', CURRENT_TIMESTAMP);
