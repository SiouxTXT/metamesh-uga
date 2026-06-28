-- MetaMesh-UGA Seed Data
-- Insert initial data for production launch

-- Insert sample MCP tools
INSERT OR IGNORE INTO tools (name, description, version, source_url, registry_url, category, popularity_score) VALUES
('gmail_send_email', 'Send emails via Gmail API', '1.0.0', 'https://github.com/metamesh/mcp-gmail', 'https://smithery.ai/server/gmail', 'communication', 100),
('gmail_read_email', 'Read and search Gmail messages', '1.0.0', 'https://github.com/metamesh/mcp-gmail', 'https://smithery.ai/server/gmail', 'communication', 95),
('slack_post_message', 'Post messages to Slack channels', '1.0.0', 'https://github.com/metamesh/mcp-slack', 'https://smithery.ai/server/slack', 'communication', 90),
('github_create_issue', 'Create GitHub issues', '1.0.0', 'https://github.com/metamesh/mcp-github', 'https://smithery.ai/server/github', 'development', 85),
('github_create_pr', 'Create GitHub pull requests', '1.0.0', 'https://github.com/metamesh/mcp-github', 'https://smithery.ai/server/github', 'development', 80),
('notion_create_page', 'Create pages in Notion', '1.0.0', 'https://github.com/metamesh/mcp-notion', 'https://smithery.ai/server/notion', 'productivity', 75),
('openai_chat', 'Chat with OpenAI models', '1.0.0', 'https://github.com/metamesh/mcp-openai', 'https://smithery.ai/server/openai', 'ai', 100),
('stripe_create_payment', 'Create Stripe payments', '1.0.0', 'https://github.com/metamesh/mcp-stripe', 'https://smithery.ai/server/stripe', 'finance', 70),
('aws_s3_upload', 'Upload files to AWS S3', '1.0.0', 'https://github.com/metamesh/mcp-aws', 'https://smithery.ai/server/aws', 'infrastructure', 65),
('postgres_query', 'Execute PostgreSQL queries', '1.0.0', 'https://github.com/metamesh/mcp-postgres', 'https://smithery.ai/server/postgres', 'data', 80),
('redis_get', 'Get values from Redis', '1.0.0', 'https://github.com/metamesh/mcp-redis', 'https://smithery.ai/server/redis', 'data', 60),
('discord_send_message', 'Send Discord messages', '1.0.0', 'https://github.com/metamesh/mcp-discord', 'https://smithery.ai/server/discord', 'communication', 55),
('linear_create_issue', 'Create Linear issues', '1.0.0', 'https://github.com/metamesh/mcp-linear', 'https://smithery.ai/server/linear', 'productivity', 50),
('shopify_get_products', 'Get Shopify products', '1.0.0', 'https://github.com/metamesh/mcp-shopify', 'https://smithery.ai/server/shopify', 'commerce', 45),
('twilio_send_sms', 'Send SMS via Twilio', '1.0.0', 'https://github.com/metamesh/mcp-twilio', 'https://smithery.ai/server/twilio', 'communication', 40),
('zapier_trigger', 'Trigger Zapier webhooks', '1.0.0', 'https://github.com/metamesh/mcp-zapier', 'https://smithery.ai/server/zapier', 'productivity', 35),
('calendly_list_events', 'List Calendly events', '1.0.0', 'https://github.com/metamesh/mcp-calendly', 'https://smithery.ai/server/calendly', 'productivity', 30),
('jira_create_ticket', 'Create Jira tickets', '1.0.0', 'https://github.com/metamesh/mcp-jira', 'https://smithery.ai/server/jira', 'development', 45),
('figma_get_file', 'Get Figma file contents', '1.0.0', 'https://github.com/metamesh/mcp-figma', 'https://smithery.ai/server/figma', 'design', 35),
('airtable_list_records', 'List Airtable records', '1.0.0', 'https://github.com/metamesh/mcp-airtable', 'https://smithery.ai/server/airtable', 'data', 40);

-- Insert routing information
INSERT OR IGNORE INTO routing (tool_name, wasm_url, wasm_hash, wasm_size, wasm_compiled, execution_url, priority, health_status, last_health_check) VALUES
('gmail_send_email', 'https://r2.metamesh-uga.dev/wasm/gmail_send_email_v1.0.0.wasm', 'sha256:abc123', 204800, 1, 'https://cat-comm.metamesh-uga.dev', 1, 'healthy', datetime('now')),
('gmail_read_email', 'https://r2.metamesh-uga.dev/wasm/gmail_read_email_v1.0.0.wasm', 'sha256:def456', 198000, 1, 'https://cat-comm.metamesh-uga.dev', 1, 'healthy', datetime('now')),
('slack_post_message', 'https://r2.metamesh-uga.dev/wasm/slack_post_message_v1.0.0.wasm', 'sha256:ghi789', 156000, 1, 'https://cat-comm.metamesh-uga.dev', 1, 'healthy', datetime('now')),
('github_create_issue', 'https://r2.metamesh-uga.dev/wasm/github_create_issue_v1.0.0.wasm', 'sha256:jkl012', 175000, 1, 'https://cat-dev.metamesh-uga.dev', 1, 'healthy', datetime('now')),
('github_create_pr', 'https://r2.metamesh-uga.dev/wasm/github_create_pr_v1.0.0.wasm', 'sha256:mno345', 182000, 1, 'https://cat-dev.metamesh-uga.dev', 1, 'healthy', datetime('now')),
('notion_create_page', 'https://r2.metamesh-uga.dev/wasm/notion_create_page_v1.0.0.wasm', 'sha256:pqr678', 145000, 1, 'https://cat-prod.metamesh-uga.dev', 1, 'healthy', datetime('now')),
('openai_chat', 'https://r2.metamesh-uga.dev/wasm/openai_chat_v1.0.0.wasm', 'sha256:stu901', 198000, 1, 'https://cat-ai.metamesh-uga.dev', 1, 'healthy', datetime('now')),
('stripe_create_payment', 'https://r2.metamesh-uga.dev/wasm/stripe_create_payment_v1.0.0.wasm', 'sha256:vwx234', 167000, 1, 'https://cat-fin.metamesh-uga.dev', 1, 'healthy', datetime('now')),
('aws_s3_upload', 'https://r2.metamesh-uga.dev/wasm/aws_s3_upload_v1.0.0.wasm', 'sha256:yz5678', 178000, 1, 'https://cat-infra.metamesh-uga.dev', 1, 'healthy', datetime('now')),
('postgres_query', 'https://r2.metamesh-uga.dev/wasm/postgres_query_v1.0.0.wasm', 'sha256:abc901', 189000, 1, 'https://cat-data.metamesh-uga.dev', 1, 'healthy', datetime('now'));

-- Insert tool pricing
INSERT OR IGNORE INTO tool_pricing (tool_name, price_type, price_per_call_usdc, min_agent_tier) VALUES
('gmail_send_email', 'flat', 0.001, 'free'),
('gmail_read_email', 'flat', 0.001, 'free'),
('slack_post_message', 'flat', 0.001, 'free'),
('github_create_issue', 'flat', 0.001, 'free'),
('github_create_pr', 'flat', 0.001, 'free'),
('notion_create_page', 'flat', 0.002, 'free'),
('openai_chat', 'flat', 0.005, 'free'),
('stripe_create_payment', 'flat', 0.002, 'free'),
('aws_s3_upload', 'flat', 0.001, 'free'),
('postgres_query', 'flat', 0.002, 'free'),
('redis_get', 'flat', 0.001, 'free'),
('discord_send_message', 'flat', 0.001, 'free'),
('linear_create_issue', 'flat', 0.002, 'free'),
('shopify_get_products', 'flat', 0.002, 'free'),
('twilio_send_sms', 'flat', 0.005, 'free'),
('zapier_trigger', 'flat', 0.002, 'free'),
('calendly_list_events', 'flat', 0.001, 'free'),
('jira_create_ticket', 'flat', 0.002, 'free'),
('figma_get_file', 'flat', 0.002, 'free'),
('airtable_list_records', 'flat', 0.002, 'free');

-- Insert admin user (for initial setup)
INSERT OR IGNORE INTO users (email, api_key, stripe_customer_id, plan, usage_count) VALUES
('admin@metamesh-uga.dev', 'sk_admin_supersecretkey_001', 'cus_admin', 'enterprise', 0);

-- Insert sample agent for testing
INSERT OR IGNORE INTO agents (agent_id, name, email, wallet_address, plan, budget_limit_usd, current_spent_usd, created_at, updated_at) VALUES
('agent_test_001', 'Test Agent', 'test@metamesh-uga.dev', '0x1234567890abcdef1234567890abcdef12345678', 'free', 10.00, 0, datetime('now'), datetime('now'));

-- Insert agent wallet
INSERT OR IGNORE INTO agent_wallets (agent_id, chain, currency, balance) VALUES
('agent_test_001', 'base', 'USDC', 0.00);

-- Insert alert configuration
INSERT OR IGNORE INTO alerts_config (alert_type, enabled, threshold) VALUES
('error_rate_high', 1, 0.05),
('latency_high', 1, 0.5),
('daily_summary', 1, 1.0);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tools_category ON tools(category);
CREATE INDEX IF NOT EXISTS idx_tools_name ON tools(name);
CREATE INDEX IF NOT EXISTS idx_usage_log_tool ON usage_log(tool_name);
CREATE INDEX IF NOT EXISTS idx_usage_log_user ON usage_log(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_usage_agent ON agent_usage(agent_id);
