# 🚀 MetaMesh-UGA Autonomous Deploy System

**Complete "Set & Forget" Production Deployment**

---

## 📋 Overview

This system enables fully autonomous deployment of MetaMesh-UGA to production, handling:

- ✅ Automatic credential generation & management
- ✅ Infrastructure provisioning (D1, R2, KV, Workers)
- ✅ Database migrations & seeding
- ✅ Worker & Pages deployment
- ✅ Health verification & self-healing
- ✅ Automated backups & credential rotation

---

## 🎯 Quick Start

### Single Command Launch

```bash
npm run launch:autonomous
```

This executes the complete autonomous deployment pipeline.

---

## 🔧 Deployment Phases

### Phase 1: Credential Setup
- Generates `JWT_SECRET` (64-byte secure random)
- Generates `ADMIN_KEY` (UUID v4)
- Loads existing credentials from `.env`
- Backs up to `.credentials/`

### Phase 2: Cloudflare Infrastructure
- Creates D1 database `metamesh-catalog`
- Creates R2 bucket `metamesh-wasm`
- Creates KV namespaces: `CACHE`, `USER_CONFIGS`
- Creates Queue `compilation-queue`
- Updates `wrangler.toml` with resource IDs

### Phase 3: Stripe Configuration
- Configures products: Free, Pro ($19), Enterprise ($499)
- Sets up webhook endpoints
- Demo mode available for testing

### Phase 4: Database Setup
- Runs migration `001_init.sql`
- Seeds with `002_seed_data.sql`
- Creates tables, indexes, views

### Phase 5: Worker Deployment
Deploys in order:
1. `discovery` - Tool discovery
2. `alerts` - Monitoring & alerting
3. `agent-billing` - AI agent billing
4. `gateway` - Main API gateway

### Phase 6: Pages Deployment
- `dashboard` - User dashboard (Cloudflare Pages)
- `landing` - Marketing site (Cloudflare Pages)

### Phase 7: Health Verification
- Checks Gateway health endpoint
- Verifies API endpoints
- Tests Pages accessibility
- Validates database connectivity

### Phase 8: Report Generation
- Saves deployment report to `deploy-reports/`
- Logs to `deploy-logs/`
- Prints summary to console

---

## 🛡️ Self-Healing System

### Start Continuous Monitoring

```bash
npm run self-healing:start
```

This runs a background process that:
- Checks health every 5 minutes
- Detects failures automatically
- Attempts recovery (redeploy workers, pages)
- Sends alerts via Telegram/Discord
- Maintains health reports

### Manual Health Check

```bash
npm run health:check
```

### Single Self-Healing Cycle

```bash
npm run self-healing:once
```

---

## 🔐 Credential Management

### Automatic Backup

Credentials are automatically backed up to:
- `.credentials/credentials-{timestamp}.json` (encrypted)
- `.env` file
- Wrangler secrets

### Manual Backup

```bash
npm run credentials:backup
```

### Credential Rotation

Rotates sensitive credentials every 90 days:

```bash
npm run credentials:rotate
```

Rotates:
- `JWT_SECRET`
- `ADMIN_KEY`
- API keys

---

## 💾 Database Backups

### Manual Backup

```bash
npm run db:backup
```

Exports D1 database to R2:
- Location: `r2://metamesh-wasm/backups/database/`
- Retains last 7 backups
- Sends notification on completion

### Automatic Backups

Configure as cron trigger in `wrangler.toml`:

```toml
[[triggers]]
crons = ["0 2 * * *"]  # Daily at 2 AM
```

---

## 📊 Available Commands

| Command | Description |
|---------|-------------|
| `npm run launch:autonomous` | Full autonomous deployment |
| `npm run deploy:production` | Alias for autonomous deploy |
| `npm run set-and-forget` | Deploy + start self-healing |
| `npm run self-healing:start` | Start health monitoring |
| `npm run self-healing:once` | Run one health check cycle |
| `npm run credentials:rotate` | Rotate credentials |
| `npm run credentials:backup` | Backup credentials |
| `npm run db:migrate` | Run DB migrations |
| `npm run db:seed` | Seed database |
| `npm run db:backup` | Backup database |
| `npm run health:check` | Check system health |
| `npm run report:status` | Get status report |

---

## 🔧 Configuration

### Environment Variables

Create `.env` file (auto-generated if missing):

```env
# Cloudflare
CLOUDFLARE_API_TOKEN=your_token
CLOUDFLARE_ACCOUNT_ID=your_account_id

# Stripe (optional - demo mode if missing)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# System (auto-generated)
JWT_SECRET=auto_generated_64byte_hex
ADMIN_KEY=admin_auto_generated_uuid

# Alerting (optional)
TELEGRAM_BOT_TOKEN=bot_token
TELEGRAM_CHAT_ID=chat_id
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...

# Recovery
BACKUP_PASSWORD=secure_password_for_credential_encryption
```

---

## 🚨 Troubleshooting

### Deployment Fails

1. Check wrangler login:
   ```bash
   wrangler whoami
   ```

2. Verify credentials:
   ```bash
   cat .env
   ```

3. Check logs:
   ```bash
   ls deploy-logs/
   cat deploy-logs/deploy-{timestamp}.log
   ```

### Recovery from Backup

```bash
# Restore credentials
node -e "
const { CredentialManager } = require('./scripts/autonomous-deploy');
const cm = new CredentialManager();
cm.recoverCredentials().then(creds => {
  console.log('Restored:', Object.keys(creds));
});
"
```

### Manual Component Deploy

```bash
# Deploy single worker
cd packages/gateway && wrangler deploy --env production

# Deploy dashboard
cd packages/dashboard && npm run deploy

# Deploy landing
cd packages/landing && npm run deploy
```

---

## 📈 Monitoring

### Health Reports

Reports saved to `health-reports/`:
- JSON format
- Timestamps for each check
- Issue tracking
- Recovery attempts

### Deployment Reports

Reports saved to `deploy-reports/`:
- Component status
- Credential status
- Endpoints
- Health check results

---

## 🎯 Success Criteria

System is **OPERATIONAL** when:

1. ✅ All Workers respond to health checks
2. ✅ Database contains ≥100 tools
3. ✅ API endpoints return 200 OK
4. ✅ Dashboard & Landing are accessible
5. ✅ Self-healing is active (if started)
6. ✅ Backups are configured
7. ✅ Credentials are backed up

---

## 🔄 Set & Forget Mode

Activate the complete autonomous system:

```bash
npm run set-and-forget
```

This will:
1. Execute full deployment
2. Start self-healing monitor
3. System maintains itself automatically

---

## 📝 Recovery Scenarios

### Scenario 1: Worker Crash
- Self-healing detects within 5 minutes
- Attempts redeploy (max 3 retries)
- Sends alert on failure

### Scenario 2: Database Corruption
- Daily backups available in R2
- Can restore from any of last 7 backups
- Migration re-run capability

### Scenario 3: Credential Compromise
- Rotation script available
- 90-day automatic rotation
- Encrypted backups

### Scenario 4: Complete Infrastructure Loss
- Credentials backed up locally
- Re-run `npm run launch:autonomous`
- System rebuilds from scratch

---

## 🏆 Production Checklist

Before running autonomous deploy:

- [ ] `wrangler login` completed
- [ ] Stripe account ready (or accept demo mode)
- [ ] Telegram/Discord for alerts (optional)
- [ ] DNS configured for domain
- [ ] GitHub repository set up

After deployment:

- [ ] Health checks pass
- [ ] API responds correctly
- [ ] Dashboard accessible
- [ ] Landing page loads
- [ ] Self-healing started (optional)

---

## 📞 Support

- **Docs**: https://docs.metamesh-uga.dev
- **API**: https://api.metamesh-uga.dev
- **Dashboard**: https://dashboard.metamesh-uga.dev
- **Status**: https://status.metamesh-uga.dev

---

**🚀 MetaMesh-UGA: Deployed, Monitored, Maintained - Automatically.**
