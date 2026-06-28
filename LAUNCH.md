# 🚀 MetaMesh-UGA Launch Guide

**Everything is ready for production deployment.**

---

## ✅ Pre-Launch Checklist

### Prerequisites
- [ ] Node.js 18+ installed
- [ ] Cloudflare account with Workers subscription
- [ ] Stripe account configured
- [ ] Domain registered (metamesh-uga.dev)
- [ ] GitHub repository set up

### Cloudflare Configuration
1. **Login to Cloudflare**
   ```bash
   npm install -g wrangler
   wrangler login
   ```

2. **Run Production Setup**
   ```bash
   chmod +x scripts/setup-production.sh
   ./scripts/setup-production.sh
   ```

3. **Set Required Secrets**
   ```bash
   wrangler secret put JWT_SECRET
   wrangler secret put STRIPE_SECRET_KEY
   wrangler secret put STRIPE_WEBHOOK_SECRET
   wrangler secret put ADMIN_KEY
   wrangler secret put TELEGRAM_BOT_TOKEN       # Optional
   wrangler secret put TELEGRAM_CHAT_ID         # Optional
   wrangler secret put DISCORD_WEBHOOK_URL      # Optional
   ```

---

## 🚀 Deploy to Production

### Option 1: Automated Deploy (Recommended)

```bash
# Make script executable
chmod +x scripts/deploy-all.sh

# Run deploy
./scripts/deploy-all.sh production
```

### Option 2: Manual Deploy

```bash
# Step 1: Install dependencies
npm install

# Step 2: Database migrations
wrangler d1 execute metamesh-catalog --file=./shared/migrations/001_init.sql
wrangler d1 execute metamesh-catalog --file=./shared/migrations/002_seed_data.sql

# Step 3: Deploy Workers
cd packages/discovery && wrangler deploy --env production
cd packages/alerts && wrangler deploy --env production
cd packages/agent-billing && wrangler deploy --env production
cd packages/gateway && wrangler deploy --env production

# Step 4: Deploy Dashboard
cd packages/dashboard
npm install && npm run build
wrangler pages deploy ./dist --project-name=metamesh-dashboard

# Step 5: Deploy Landing Page
cd packages/landing
npm install && npm run build
wrangler pages deploy ./dist --project-name=metamesh-landing
```

### Option 3: GitHub Actions (CI/CD)

1. Add secrets to GitHub repository:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`

2. Push to `main` branch

3. GitHub Actions will automatically deploy everything

---

## 🧪 Post-Deploy Verification

### Health Checks

```bash
# Test Gateway
curl https://api.metamesh-uga.dev/health

# Test API
curl https://api.metamesh-uga.dev/v1/tools

# Test with API Key
curl -H "X-API-Key: sk_your_key" \
  https://api.metamesh-uga.dev/v1/usage

# Test MCP Protocol
curl -N https://api.metamesh-uga.dev/sse

# Test Dashboard
curl https://dashboard.metamesh-uga.dev

# Test Landing Page
curl https://metamesh-uga.dev
```

### CLI Test

```bash
# Install CLI
curl -s https://metamesh-uga.dev/install | bash

# Connect
metamesh connect

# List tools
metamesh list

# Call tool
metamesh call gmail_send_email --to test@example.com --subject "Hello"
```

---

## 🎯 Go-Live Tasks

### Immediate (Day 0)

1. **Configure Stripe**
   - Create products: Free, Pro ($19), Enterprise ($499)
   - Configure webhook endpoint: `https://api.metamesh-uga.dev/stripe/webhook`
   - Test payment flow

2. **Set Up Monitoring**
   - Configure Telegram bot for alerts
   - Set up Discord webhook
   - Verify alert endpoints are working

3. **DNS Configuration**
   - Point `metamesh-uga.dev` to Cloudflare Pages
   - Point `api.metamesh-uga.dev` to Gateway Worker
   - Point `dashboard.metamesh-uga.dev` to Dashboard

### Short-term (Week 1)

1. **Marketplace Listings**
   - Submit to AWS Marketplace
   - Submit to GitHub Marketplace
   - Submit to MCP Marketplace

2. **Content & SEO**
   - Verify Schema.org markup
   - Submit sitemap to Google
   - Set up Google Analytics
   - Configure social media accounts

3. **Documentation**
   - Host docs at docs.metamesh-uga.dev
   - Set up GitBook or ReadMe

---

## 📊 Success Metrics

Track these metrics from Day 1:

| Metric | Target (Month 1) |
|--------|------------------|
| User Signups | 500 |
| API Calls/Day | 1,000 |
| Pro Conversions | 10 |
| Uptime | 99.9% |
| Avg Latency | <300ms |

---

## 🆘 Troubleshooting

### Worker Deploy Fails
```bash
# Check wrangler.toml configuration
wrangler config list

# Verify account ID
wrangler whoami

# Test locally first
wrangler dev
```

### Database Connection Issues
```bash
# Verify database ID in wrangler.toml
wrangler d1 list

# Test query
wrangler d1 execute metamesh-catalog --command="SELECT COUNT(*) FROM tools"
```

### Rate Limiting
- Free tier: 100 req/min, 1,000 calls/month
- Pro tier: 1,000 req/min, unlimited
- Check headers: `X-RateLimit-Remaining`

---

## 📞 Support & Resources

- **Documentation**: https://docs.metamesh-uga.dev
- **API Reference**: `./docs/API_REFERENCE.md`
- **Dashboard**: https://dashboard.metamesh-uga.dev
- **Status Page**: https://status.metamesh-uga.dev
- **Email**: support@metamesh-uga.dev
- **Discord**: https://discord.gg/metamesh

---

## 🎉 Launch Day Commands

```bash
# Final health check
curl https://api.metamesh-uga.dev/health | jq .

# Trigger discovery manually
curl -X POST \
  -H "X-API-Key: $ADMIN_KEY" \
  https://api.metamesh-uga.dev/v1/admin/discover

# Monitor logs
wrangler tail --name metamesh-gateway

# Celebrate!
echo "🚀 MetaMesh-UGA is LIVE!"
```

---

**The "Set & Forget" era begins now.**
