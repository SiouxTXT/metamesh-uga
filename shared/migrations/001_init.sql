-- MetaMesh-UGA Database Schema
-- D1 SQLite Schema

-- ============================================
-- TABELLE UTENTI (Umani)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  api_key TEXT UNIQUE NOT NULL,
  plan TEXT DEFAULT 'free' CHECK(plan IN ('free', 'pro', 'enterprise')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  usage_count INTEGER DEFAULT 0,
  plan_limit INTEGER DEFAULT 1000, -- chiamate/mese
  subscription_start TIMESTAMP,
  subscription_end TIMESTAMP,
  referral_code TEXT UNIQUE,
  referred_by INTEGER,
  bonus_calls INTEGER DEFAULT 0,
  discount_percent INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (referred_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_users_api_key ON users(api_key);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_plan ON users(plan);
CREATE INDEX IF NOT EXISTS idx_users_referral ON users(referral_code);

-- ============================================
-- TABELLE TOOL MCP
-- ============================================
CREATE TABLE IF NOT EXISTS tools (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  schema JSON,
  source_url TEXT,
  registry_url TEXT,
  popularity_score INTEGER DEFAULT 0,
  deprecated BOOLEAN DEFAULT FALSE,
  deprecated_since TIMESTAMP,
  compiled_at TIMESTAMP,
  wasm_size_bytes INTEGER,
  wasm_hash TEXT,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(name, version)
);

CREATE INDEX IF NOT EXISTS idx_tools_name ON tools(name);
CREATE INDEX IF NOT EXISTS idx_tools_category ON tools(category);
CREATE INDEX IF NOT EXISTS idx_tools_deprecated ON tools(deprecated);
CREATE INDEX IF NOT EXISTS idx_tools_popularity ON tools(popularity_score);

-- ============================================
-- TABELLA ROUTING (L1 → L4/L5)
-- ============================================
CREATE TABLE IF NOT EXISTS routing (
  tool_name TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  worker_url TEXT,
  direct_wasm BOOLEAN DEFAULT FALSE,
  latency_ms INTEGER DEFAULT 0,
  success_rate REAL DEFAULT 1.0,
  last_used TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tool_name) REFERENCES tools(name)
);

CREATE INDEX IF NOT EXISTS idx_routing_category ON routing(category);

-- ============================================
-- TABELLA CONFIGURAZIONI UTENTE (Cifrate)
-- ============================================
CREATE TABLE IF NOT EXISTS configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  tool_name TEXT NOT NULL,
  config_json TEXT NOT NULL, -- Cifrato AES-256-GCM
  iv TEXT NOT NULL, -- Initialization vector per decifratura
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (tool_name) REFERENCES tools(name),
  UNIQUE(user_id, tool_name)
);

CREATE INDEX IF NOT EXISTS idx_configs_user ON configs(user_id);

-- ============================================
-- TABELLA USAGE LOG (Caching, Analytics Engine per real-time)
-- ============================================
CREATE TABLE IF NOT EXISTS usage_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  agent_id INTEGER,
  tool_name TEXT NOT NULL,
  status TEXT CHECK(status IN ('success', 'error', 'timeout', 'rate_limited')),
  latency_ms INTEGER,
  error_message TEXT,
  called_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);

CREATE INDEX IF NOT EXISTS idx_usage_user ON usage_log(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_agent ON usage_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_usage_tool ON usage_log(tool_name);
CREATE INDEX IF NOT EXISTS idx_usage_status ON usage_log(status);
CREATE INDEX IF NOT EXISTS idx_usage_date ON usage_log(called_at);

-- ============================================
-- TABELLE AI AGENT
-- ============================================
CREATE TABLE IF NOT EXISTS agents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT UNIQUE NOT NULL, -- UUID dell'agente
  wallet_address TEXT UNIQUE NOT NULL, -- Address Base per pagamenti
  email TEXT,
  name TEXT,
  plan TEXT DEFAULT 'free' CHECK(plan IN ('free', 'pay_as_you_go', 'enterprise')),
  budget_limit_usd DECIMAL(10,2) DEFAULT 0, -- 0 = illimitato
  current_spent_usd DECIMAL(10,2) DEFAULT 0,
  total_spent_usd DECIMAL(10,2) DEFAULT 0,
  suspended BOOLEAN DEFAULT FALSE,
  suspended_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agents_agent_id ON agents(agent_id);
CREATE INDEX IF NOT EXISTS idx_agents_wallet ON agents(wallet_address);
CREATE INDEX IF NOT EXISTS idx_agents_plan ON agents(plan);
CREATE INDEX IF NOT EXISTS idx_agents_suspended ON agents(suspended);

-- ============================================
-- TABELLA WALLET AGENT (Multi-chain)
-- ============================================
CREATE TABLE IF NOT EXISTS agent_wallets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id INTEGER NOT NULL,
  chain TEXT NOT NULL CHECK(chain IN ('base', 'ethereum', 'polygon', 'optimism')),
  currency TEXT NOT NULL CHECK(currency IN ('USDC', 'USDT', 'DAI', 'ETH')),
  balance DECIMAL(20,6) DEFAULT 0,
  total_deposited DECIMAL(20,6) DEFAULT 0,
  total_withdrawn DECIMAL(20,6) DEFAULT 0,
  last_refreshed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES agents(id),
  UNIQUE(agent_id, chain, currency)
);

CREATE INDEX IF NOT EXISTS idx_agent_wallets_agent ON agent_wallets(agent_id);

-- ============================================
-- TABELLA PRICING TOOL (Per AI Agent x402)
-- ============================================
CREATE TABLE IF NOT EXISTS tool_pricing (
  tool_name TEXT PRIMARY KEY,
  price_per_call_usd DECIMAL(10,6) DEFAULT 0.001, -- $0.001 = 0.1 cent
  price_per_call_usdc DECIMAL(10,6) DEFAULT 0.001,
  x402_enabled BOOLEAN DEFAULT TRUE,
  discount_bulk BOOLEAN DEFAULT TRUE,
  min_call_volume INTEGER DEFAULT 100, -- Soglia per sconti
  bulk_price DECIMAL(10,6) DEFAULT 0.0005,
  bulk_discount_percent INTEGER DEFAULT 50,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tool_name) REFERENCES tools(name)
);

-- ============================================
-- TABELLA USAGE AGENT
-- ============================================
CREATE TABLE IF NOT EXISTS agent_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id INTEGER NOT NULL,
  tool_name TEXT NOT NULL,
  call_count INTEGER DEFAULT 0,
  total_spent_usd DECIMAL(10,6) DEFAULT 0,
  last_called TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES agents(id),
  UNIQUE(agent_id, tool_name)
);

CREATE INDEX IF NOT EXISTS idx_agent_usage_agent ON agent_usage(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_usage_tool ON agent_usage(tool_name);

-- ============================================
-- TABELLA NONCE x402 (Anti-replay)
-- ============================================
CREATE TABLE IF NOT EXISTS used_nonces (
  nonce TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP -- TTL 24h
);

CREATE INDEX IF NOT EXISTS idx_nonces_agent ON used_nonces(agent_id);
CREATE INDEX IF NOT EXISTS idx_nonces_expires ON used_nonces(expires_at);

-- ============================================
-- TABELLA TRANSACTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id INTEGER,
  user_id INTEGER,
  type TEXT CHECK(type IN ('payment', 'refund', 'topup', 'withdrawal')),
  amount DECIMAL(20,6) NOT NULL,
  currency TEXT NOT NULL,
  chain TEXT,
  status TEXT CHECK(status IN ('pending', 'completed', 'failed')),
  tx_hash TEXT,
  stripe_payment_intent_id TEXT,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES agents(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_transactions_agent ON transactions(agent_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);

-- ============================================
-- TABELLA INVOICES
-- ============================================
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  agent_id INTEGER,
  invoice_number TEXT UNIQUE NOT NULL,
  period_start TIMESTAMP,
  period_end TIMESTAMP,
  amount_usd DECIMAL(10,2) NOT NULL,
  amount_paid DECIMAL(10,2) DEFAULT 0,
  status TEXT CHECK(status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  stripe_invoice_id TEXT,
  pdf_url TEXT,
  sent_at TIMESTAMP,
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);

CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_agent ON invoices(agent_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- ============================================
-- TABELLA RATE LIMITING AGENT
-- ============================================
CREATE TABLE IF NOT EXISTS agent_rate_limits (
  agent_id INTEGER PRIMARY KEY,
  limit_per_minute INTEGER DEFAULT 1000,
  current_count INTEGER DEFAULT 0,
  reset_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  budget_limit_usd DECIMAL(10,2) DEFAULT 10.00,
  current_spent_usd DECIMAL(10,2) DEFAULT 0,
  alert_80_sent BOOLEAN DEFAULT FALSE,
  alert_100_sent BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);

-- ============================================
-- TABELLA ALERTS CONFIG
-- ============================================
CREATE TABLE IF NOT EXISTS alerts_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alert_type TEXT UNIQUE NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  threshold REAL,
  telegram_chat_id TEXT,
  email_recipients TEXT, -- JSON array
  webhook_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABELLA BACKUP LOG
-- ============================================
CREATE TABLE IF NOT EXISTS backup_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  backup_type TEXT NOT NULL,
  backup_path TEXT NOT NULL,
  tables_backed_up JSON,
  size_bytes INTEGER,
  status TEXT CHECK(status IN ('success', 'failed')),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- VIEWS per reporting
-- ============================================

-- View: Top tools per usage
CREATE VIEW IF NOT EXISTS v_top_tools AS
SELECT 
  tool_name,
  COUNT(*) as total_calls,
  COUNT(CASE WHEN status = 'success' THEN 1 END) as success_calls,
  COUNT(CASE WHEN status = 'error' THEN 1 END) as error_calls,
  AVG(latency_ms) as avg_latency,
  MAX(called_at) as last_called
FROM usage_log
WHERE called_at > datetime('now', '-30 days')
GROUP BY tool_name
ORDER BY total_calls DESC;

-- View: Revenue mensile
CREATE VIEW IF NOT EXISTS v_monthly_revenue AS
SELECT 
  strftime('%Y-%m', created_at) as month,
  COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END) as human_transactions,
  COUNT(CASE WHEN agent_id IS NOT NULL THEN 1 END) as agent_transactions,
  SUM(CASE WHEN user_id IS NOT NULL THEN amount ELSE 0 END) as human_revenue,
  SUM(CASE WHEN agent_id IS NOT NULL THEN amount ELSE 0 END) as agent_revenue,
  SUM(amount) as total_revenue
FROM transactions
WHERE status = 'completed'
GROUP BY strftime('%Y-%m', created_at)
ORDER BY month DESC;

-- View: Agent health
CREATE VIEW IF NOT EXISTS v_agent_health AS
SELECT 
  a.agent_id,
  a.name,
  a.plan,
  a.suspended,
  aw.balance,
  aw.currency,
  COALESCE(au.call_count, 0) as total_calls,
  COALESCE(au.total_spent_usd, 0) as total_spent,
  a.current_spent_usd as current_month_spent,
  a.budget_limit_usd,
  CASE 
    WHEN a.budget_limit_usd > 0 THEN (a.current_spent_usd / a.budget_limit_usd * 100)
    ELSE 0
  END as budget_usage_percent
FROM agents a
LEFT JOIN agent_wallets aw ON a.id = aw.agent_id AND aw.chain = 'base' AND aw.currency = 'USDC'
LEFT JOIN agent_usage au ON a.id = au.agent_id;
