# MetaMesh-UGA — Operational Runbook

> Guida operativa per gestire il sistema in produzione.

---

## 1. Deploy

```bash
# Migrazione database
npm run db:migrate

# Deploy di tutti i worker
npm run deploy:workers

# Deploy completo
npm run deploy:all
```

---

## 2. Health Checks

```bash
# Gateway
curl https://api.metamesh-uga.dev/health

# Health dashboard
curl https://api.metamesh-uga.dev/v1/dashboard/health

# Tool health
curl https://api.metamesh-uga.dev/v1/health
```

---

## 3. Monitoraggio

- **Analytics**: `/v1/dashboard/usage`, `/v1/dashboard/errors`, `/v1/metrics/prometheus`
- **Intelligence**: `/v1/insights`, `/v1/anomalies`
- **Health**: `/v1/health`

---

## 4. Troubleshooting

| Sintomo | Azione |
|---------|--------|
| Tool non trovato | Verificare discovery e lifecycle: `POST /v1/admin/discovery`, `POST /v1/admin/lifecycle/evaluate` |
| Trust score basso | Verificare usage log: `SELECT * FROM usage_log WHERE tool_name = '...'` |
| Security score basso | Eseguire security scan: `POST /v1/admin/security/scan/:tool` |
| Tool lento | Controllare benchmark: `GET /v1/benchmark/:tool` |
| Cache stale | Invalidare cache: `POST /v1/admin/cache/invalidate` |
| Registry non sincronizzato | Trigger sync: `POST /v1/admin/registry/sync` |

---

## 5. Rollback

### Ripristinare un tool deprecato

```bash
curl -X POST "https://api.metamesh-uga.dev/v1/admin/lifecycle/evaluate/:tool" \
  -H "X-Admin-Key: $ADMIN_KEY"
```

### Ripristinare snapshot registry

```bash
curl -X POST "https://api.metamesh-uga.dev/v1/admin/registry/restore" \
  -H "X-Admin-Key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"key": "snapshots/registry-snapshot-YYYY-MM-DD.json"}'
```

---

## 6. Cron Jobs

| Worker | Frequenza | Verifica |
|--------|-----------|----------|
| self-healing | 5 min | `POST /v1/admin/heal` |
| health | 10 min | `POST /v1/admin/health/check` |
| registry | 6 ore | `POST /v1/admin/registry/sync` |
| discovery | 6 ore | `POST /v1/admin/discovery` |
| lifecycle | 1 giorno | `POST /v1/admin/lifecycle/evaluate` |
| updater | 1 giorno | `POST /v1/admin/update` |
| benchmark | 1 giorno | `POST /v1/admin/benchmark` |
| trust | 1 giorno | `POST /v1/admin/trust/recalculate` |
| security | 1 giorno | `POST /v1/admin/security/scan` |
| aggregator | 1 giorno | `POST /v1/admin/aggregate` |
| eliminatore | 1 settimana | `POST /v1/admin/cleanup` |

---

## 7. Sicurezza

- Ruotare secret: `wrangler secret put <SECRET_NAME>`
- Backup DB: `npm run db:backup`
- Monitorare security scans: `/v1/anomalies`, `/v1/insights`

---

*Runbook Fase 5 — 2026-06-25*
