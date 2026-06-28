-- MetaMesh-UGA Migration 008 - Seed Default Registry Sources

INSERT OR IGNORE INTO registry_sources (name, url, type, priority, sync_interval_hours) VALUES
('mcp-official', 'https://registry.mcp.io/v0.1/servers', 'official', 0, 6),
('smithery', 'https://registry.smithery.ai/servers', 'community', 1, 6);
