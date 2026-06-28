# MetaMesh-UGA — Deployment Guide

> Guida completa al deploy di MetaMesh-UGA su Cloudflare.

---

## 1. Prerequisiti

- Account Cloudflare
- Wrangler CLI installato
- D1 database `metamesh-catalog` creato
- (Opzionale) KV namespace e R2 bucket per cache/mirror

---

## 2. Setup iniziale

```bash
npm install

# Autenticazione Wrangler
wrangler login

# Creare D1 database
wrangler d1 create metamesh-catalog
# Aggiornare tutti i wrangler.toml con il database_id ottenuto

# (Opzionale) Creare KV namespace
wrangler kv namespace create "CACHE"
wrangler kv namespace create "CONFIG_CACHE"

# (Opzionale) Creare R2 bucket
wrangler r2 bucket create metamesh-registry-mirror
wrangler r2 bucket create metamesh-analytics
```

---

## 3. Secrets

Impostare i secret per ogni worker:

```bash
wrangler secret put ADMIN_KEY --config packages/gateway/wrangler.toml
wrangler secret put TELEGRAM_BOT_TOKEN --config packages/gateway/wrangler.toml
wrangler secret put TELEGRAM_CHAT_ID --config packages/gateway/wrangler.toml
# ... ripetere per ogni worker
```

---

## 4. Database

```bash
npm run db:migrate
npm run db:seed
```

---

## 5. Deploy

```bash
# Deploy worker
npm run deploy:workers

# Deploy completo
npm run deploy:all
```

---

## 6. DNS

Configurare `api.metamesh-uga.dev` come record CNAME proxy di Cloudflare.

---

## 7. Verifica

```bash
npm run health:check
curl https://api.metamesh-uga.dev/v1/tools?limit=1
```

---

## 8. Multi-region

Vedere `docs/MULTI_REGION.md` per la configurazione avanzata.

---

## 9. Monitoraggio

- Health: `/health`
- Analytics: `/v1/dashboard/health`
- Prometheus: `/v1/metrics/prometheus`

---

*Deployment Guide Fase 5 — 2026-06-25*
