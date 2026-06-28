#!/bin/bash

# MetaMesh-UGA Production Setup Script
# Run once to set up all Cloudflare resources

set -e

echo "🚀 MetaMesh-UGA Production Setup"
echo "================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check prerequisites
echo -e "${BLUE}Checking prerequisites...${NC}"

command -v node >/dev/null 2>&1 || { echo -e "${RED}Node.js is required${NC}"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo -e "${RED}npm is required${NC}"; exit 1; }
command -v wrangler >/dev/null 2>&1 || { echo -e "${RED}Wrangler is required. Run: npm install -g wrangler${NC}"; exit 1; }

# Check login
wrangler whoami || { echo -e "${RED}Please login first: wrangler login${NC}"; exit 1; }

echo -e "${GREEN}✓ Prerequisites OK${NC}"
echo ""

# Get account info
echo -e "${BLUE}Account Info:${NC}"
wrangler whoami
echo ""

# Create D1 Database
echo -e "${BLUE}Step 1: Creating D1 Database...${NC}"
wrangler d1 create metamesh-catalog || echo -e "${YELLOW}Database may already exist${NC}"
echo -e "${YELLOW}Note: Please update database_id in wrangler.toml with the ID shown above${NC}"
echo ""

# Create R2 Bucket
echo -e "${BLUE}Step 2: Creating R2 Bucket...${NC}"
wrangler r2 bucket create metamesh-wasm || echo -e "${YELLOW}Bucket may already exist${NC}"
echo ""

# Create KV Namespaces
echo -e "${BLUE}Step 3: Creating KV Namespaces...${NC}"

# Create and get ID for CACHE
CACHE_OUTPUT=$(wrangler kv:namespace create "CACHE" 2>&1 || true)
echo "$CACHE_OUTPUT"
CACHE_ID=$(echo "$CACHE_OUTPUT" | grep -oP 'id = "\K[^"]+' || echo "")

# Create and get ID for USER_CONFIGS  
CONFIG_OUTPUT=$(wrangler kv:namespace create "USER_CONFIGS" 2>&1 || true)
echo "$CONFIG_OUTPUT"
CONFIG_ID=$(echo "$CONFIG_OUTPUT" | grep -oP 'id = "\K[^"]+' || echo "")

echo ""

# Create Queue
echo -e "${BLUE}Step 4: Creating Queue...${NC}"
wrangler queues create compilation-queue || echo -e "${YELLOW}Queue may already exist${NC}"
echo ""

# Setup secrets
echo -e "${BLUE}Step 5: Setting up Secrets...${NC}"
echo -e "${YELLOW}You will need to provide the following secrets:${NC}"
echo ""

echo "1. JWT_SECRET (random string for JWT signing)"
echo "2. STRIPE_SECRET_KEY (from Stripe dashboard)"
echo "3. STRIPE_WEBHOOK_SECRET (from Stripe webhook settings)"
echo "4. ADMIN_KEY (for admin endpoints)"
echo "5. TELEGRAM_BOT_TOKEN (optional, for alerts)"
echo "6. TELEGRAM_CHAT_ID (optional, for alerts)"
echo "7. DISCORD_WEBHOOK_URL (optional, for alerts)"
echo ""

echo -e "${YELLOW}Set secrets with: wrangler secret put <NAME>${NC}"
echo ""
read -p "Press Enter to continue after setting secrets..."

# Update wrangler.toml
echo -e "${BLUE}Step 6: Updating wrangler.toml...${NC}"
echo ""
echo "Please manually update the following in wrangler.toml:"
echo ""
echo "[[d1_databases]]"
echo "  binding = \"DB\""
echo "  database_name = \"metamesh-catalog\""
echo "  database_id = \"<YOUR_DATABASE_ID>\""
echo ""

if [ -n "$CACHE_ID" ]; then
    echo "[[kv_namespaces]]"
    echo "  binding = \"CACHE\""
    echo "  id = \"$CACHE_ID\""
    echo ""
fi

if [ -n "$CONFIG_ID" ]; then
    echo "[[kv_namespaces]]"
    echo "  binding = \"USER_CONFIGS\""
    echo "  id = \"$CONFIG_ID\""
    echo ""
fi

echo "[[r2_buckets]]"
echo "  binding = \"WASM_STORAGE\""
echo "  bucket_name = \"metamesh-wasm\""
echo ""

# Create seed data migration
echo -e "${BLUE}Step 7: Creating seed data...${NC}"
cat > shared/migrations/002_seed_data.sql << 'EOF'
-- MetaMesh-UGA Seed Data
-- Run after 001_init.sql

-- Insert sample tools
INSERT INTO tools (name, description, version, author, source_url, registry_url, category, tags, is_active, popularity_score) VALUES
('gmail_send_email', 'Send emails via Gmail API', '1.0.0', 'MetaMesh', 'https://github.com/metamesh/mcp-gmail', 'https://smithery.ai/server/gmail', 'communication', '["email", "gmail"]', 1, 100),
('github_create_issue', 'Create GitHub issues', '1.0.0', 'MetaMesh', 'https://github.com/metamesh/mcp-github', 'https://smithery.ai/server/github', 'development', '["github", "issues"]', 1, 95),
('slack_post_message', 'Post Slack messages', '1.0.0', 'MetaMesh', 'https://github.com/metamesh/mcp-slack', 'https://smithery.ai/server/slack', 'communication', '["slack", "chat"]', 1, 90),
('openai_chat', 'Chat with OpenAI models', '1.0.0', 'MetaMesh', 'https://github.com/metamesh/mcp-openai', 'https://smithery.ai/server/openai', 'ai', '["ai", "llm"]', 1, 100);

-- Insert admin user
INSERT INTO users (id, email, api_key, plan, created_at, updated_at, is_active) VALUES
('admin_001', 'admin@metamesh-uga.dev', 'sk_admin_change_this_in_production', 'enterprise', datetime('now'), datetime('now'), 1);

-- Insert tool pricing
INSERT INTO tool_pricing (tool_name, price_type, price_per_call_usdc, min_agent_tier) VALUES
('gmail_send_email', 'flat', 0.001, 'free'),
('github_create_issue', 'flat', 0.001, 'free'),
('slack_post_message', 'flat', 0.001, 'free'),
('openai_chat', 'flat', 0.005, 'free');
EOF

echo -e "${GREEN}✓ Created shared/migrations/002_seed_data.sql${NC}"
echo ""

# Database migrations
echo -e "${BLUE}Step 8: Running database migrations...${NC}"
echo "Run the following command after updating wrangler.toml:"
echo ""
echo "  wrangler d1 execute metamesh-catalog --file=./shared/migrations/001_init.sql"
echo "  wrangler d1 execute metamesh-catalog --file=./shared/migrations/002_seed_data.sql"
echo ""

# Summary
echo "================================"
echo -e "${GREEN}✓ Setup complete!${NC}"
echo "================================"
echo ""
echo "Next steps:"
echo "  1. Update database_id in wrangler.toml"
echo "  2. Set all required secrets"
echo "  3. Run database migrations"
echo "  4. Deploy with: ./scripts/deploy-all.sh production"
echo ""
echo "Resources created:"
echo "  - D1 Database: metamesh-catalog"
echo "  - R2 Bucket: metamesh-wasm"
echo "  - KV Namespaces: CACHE, USER_CONFIGS"
echo "  - Queue: compilation-queue"
echo ""
echo "Support: https://docs.metamesh-uga.dev"
