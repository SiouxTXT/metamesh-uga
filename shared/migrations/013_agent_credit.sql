-- ============================================
-- Migration 013: Stripe-funded prepaid credit for AI agents
-- Adds a USD balance wallet + agent API key to the agents table.
-- (SQLite/D1 does not support ADD COLUMN IF NOT EXISTS; run once.)
-- ============================================

ALTER TABLE agents ADD COLUMN balance_usd DECIMAL(10,2) DEFAULT 0;
ALTER TABLE agents ADD COLUMN api_key TEXT;
ALTER TABLE agents ADD COLUMN stripe_customer_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_api_key ON agents(api_key);
