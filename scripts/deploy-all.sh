#!/bin/bash

# MetaMesh-UGA Complete Deploy Script
# Usage: ./deploy-all.sh [environment]
# Environment: development (default) | production

set -e

ENVIRONMENT=${1:-development}
echo "🚀 MetaMesh-UGA Deploy - Environment: $ENVIRONMENT"
echo "================================================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}Checking prerequisites...${NC}"
    
    command -v node >/dev/null 2>&1 || { echo -e "${RED}Node.js is required but not installed.${NC}" >&2; exit 1; }
    command -v npm >/dev/null 2>&1 || { echo -e "${RED}npm is required but not installed.${NC}" >&2; exit 1; }
    command -v wrangler >/dev/null 2>&1 || { echo -e "${RED}Wrangler is required but not installed.${NC}" >&2; exit 1; }
    
    # Check if logged in to Cloudflare
    wrangler whoami || { echo -e "${RED}Not logged in to Cloudflare. Run: wrangler login${NC}" >&2; exit 1; }
    
    echo -e "${GREEN}✓ Prerequisites OK${NC}"
}

# Setup resources (run once)
setup_resources() {
    echo -e "${YELLOW}Setting up Cloudflare resources...${NC}"
    
    # Create D1 database if not exists
    echo "Creating D1 database..."
    wrangler d1 create metamesh-catalog 2>/dev/null || echo "Database may already exist"
    
    # Create R2 bucket
    echo "Creating R2 bucket..."
    wrangler r2 bucket create metamesh-wasm 2>/dev/null || echo "Bucket may already exist"
    
    # Create KV namespaces
    echo "Creating KV namespaces..."
    wrangler kv:namespace create "CACHE" 2>/dev/null || echo "CACHE namespace may already exist"
    wrangler kv:namespace create "USER_CONFIGS" 2>/dev/null || echo "USER_CONFIGS namespace may already exist"
    
    # Create Queue
    echo "Creating Queue..."
    wrangler queues create compilation-queue 2>/dev/null || echo "Queue may already exist"
    
    echo -e "${GREEN}✓ Resources setup complete${NC}"
}

# Database migrations
run_migrations() {
    echo -e "${YELLOW}Running database migrations...${NC}"
    
    # Get database ID from wrangler.toml or prompt
    DB_ID=$(grep -A 5 'id = "metamesh-catalog"' wrangler.toml | grep 'database_id' | cut -d'"' -f2)
    
    if [ -z "$DB_ID" ]; then
        echo "Please enter your D1 database ID:"
        read DB_ID
    fi
    
    # Run migrations
    wrangler d1 execute metamesh-catalog --file=./shared/migrations/001_init.sql --yes || true
    
    # Seed data if production
    if [ "$ENVIRONMENT" = "production" ]; then
        echo "Seeding initial data..."
        wrangler d1 execute metamesh-catalog --file=./shared/migrations/002_seed_data.sql --yes || true
    fi
    
    echo -e "${GREEN}✓ Database migrations complete${NC}"
}

# Deploy Workers in order
deploy_workers() {
    echo -e "${YELLOW}Deploying Workers...${NC}"
    
    # Shared libraries
    echo "Building shared libraries..."
    cd shared
    npm install 2>/dev/null || true
    cd ..
    
    # L2: Discovery
    echo -e "${YELLOW}Deploying Discovery Worker (L2)...${NC}"
    cd packages/discovery
    wrangler deploy --env $ENVIRONMENT
    cd ../..
    
    # L3: Aggregator
    if [ -d "packages/aggregator" ]; then
        echo -e "${YELLOW}Deploying Aggregator Worker (L3)...${NC}"
        cd packages/aggregator
        wrangler deploy --env $ENVIRONMENT
        cd ../..
    fi
    
    # L4: Categories
    echo -e "${YELLOW}Deploying Category Workers (L4)...${NC}"
    for cat in comm dev data ai prod infra fin; do
        if [ -d "packages/categories/$cat" ]; then
            echo "  - Deploying category: $cat"
            cd packages/categories/$cat
            wrangler deploy --env $ENVIRONMENT
            cd ../../..
        fi
    done
    
    # Management Engines
    if [ -d "packages/inserter" ]; then
        echo -e "${YELLOW}Deploying Inserter...${NC}"
        cd packages/inserter && wrangler deploy --env $ENVIRONMENT && cd ../..
    fi
    
    if [ -d "packages/updater" ]; then
        echo -e "${YELLOW}Deploying Updater...${NC}"
        cd packages/updater && wrangler deploy --env $ENVIRONMENT && cd ../..
    fi
    
    if [ -d "packages/eliminatore" ]; then
        echo -e "${YELLOW}Deploying Eliminatore...${NC}"
        cd packages/eliminatore && wrangler deploy --env $ENVIRONMENT && cd ../..
    fi
    
    # Alerts & Billing
    echo -e "${YELLOW}Deploying Alerts Worker...${NC}"
    cd packages/alerts
    wrangler deploy --env $ENVIRONMENT
    cd ../..
    
    echo -e "${YELLOW}Deploying Agent Billing Worker...${NC}"
    cd packages/agent-billing
    wrangler deploy --env $ENVIRONMENT
    cd ../..
    
    # L1: Gateway (last, as it exposes the product)
    echo -e "${YELLOW}Deploying Gateway Worker (L1)...${NC}"
    cd packages/gateway
    wrangler deploy --env $ENVIRONMENT
    cd ../..
    
    echo -e "${GREEN}✓ All Workers deployed${NC}"
}

# Deploy Dashboard
deploy_dashboard() {
    echo -e "${YELLOW}Deploying Dashboard...${NC}"
    
    cd packages/dashboard
    npm install
    npm run build
    
    if [ "$ENVIRONMENT" = "production" ]; then
        wrangler pages deploy ./dist --project-name=metamesh-dashboard --production
    else
        wrangler pages deploy ./dist --project-name=metamesh-dashboard
    fi
    
    cd ../..
    echo -e "${GREEN}✓ Dashboard deployed${NC}"
}

# Deploy Landing Page
deploy_landing() {
    echo -e "${YELLOW}Deploying Landing Page...${NC}"
    
    cd packages/landing
    npm install 2>/dev/null || true
    npm run build 2>/dev/null || true
    
    if [ "$ENVIRONMENT" = "production" ]; then
        wrangler pages deploy ./dist --project-name=metamesh-landing --production
    else
        wrangler pages deploy ./dist --project-name=metamesh-landing
    fi
    
    cd ../..
    echo -e "${GREEN}✓ Landing page deployed${NC}"
}

# Health check
health_check() {
    echo -e "${YELLOW}Running health checks...${NC}"
    
    GATEWAY_URL=$(grep 'GATEWAY_URL' .env.$ENVIRONMENT 2>/dev/null | cut -d'=' -f2 || echo "https://api.metamesh-uga.dev")
    
    # Check gateway health
    echo "Checking Gateway health..."
    curl -s "$GATEWAY_URL/health" | jq . 2>/dev/null || echo "⚠️  Health check endpoint not responding"
    
    echo -e "${GREEN}✓ Health checks complete${NC}"
}

# Main execution
main() {
    check_prerequisites
    setup_resources
    run_migrations
    deploy_workers
    deploy_dashboard
    deploy_landing
    health_check
    
    echo ""
    echo -e "${GREEN}================================================${NC}"
    echo -e "${GREEN}🎉 MetaMesh-UGA Deploy Complete!${NC}"
    echo -e "${GREEN}================================================${NC}"
    echo ""
    echo "Services deployed:"
    echo "  - Gateway: $GATEWAY_URL"
    echo "  - Dashboard: https://dashboard.metamesh-uga.dev"
    echo "  - Landing: https://metamesh-uga.dev"
    echo ""
    echo "Next steps:"
    echo "  1. Set up Stripe webhooks"
    echo "  2. Configure custom domain (if not using default)"
    echo "  3. Run initial discovery: curl $GATEWAY_URL/v1/admin/discover"
    echo "  4. Test the CLI: cd cli && go build && ./metamesh connect"
}

# Run main
main
