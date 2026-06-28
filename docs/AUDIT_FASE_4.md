# Audit — Fase 4: Lifecycle, AI Intelligence, Compatibility e Analytics

> Data: 2026-06-25
> Stato: **COMPLETATA**

---

## 1. Obiettivo della Fase 4

Completare il Control Plane con lifecycle management, AI intelligence, compatibility checks, real-time analytics e registry mirroring.

---

## 2. Componenti implementate

### 2.1 Lifecycle Manager

| File | Contenuto |
|------|-----------|
| `packages/lifecycle/src/lifecycle.js` | Classe `LifecycleManager` con stati e transizioni automatiche basate su metriche |
| `packages/lifecycle/src/index.js` | Worker cron giornaliero (01:00) + endpoint `/health`, `/v1/lifecycle/:tool`, `/v1/admin/lifecycle/evaluate` |
| `packages/lifecycle/wrangler.toml` | Configurazione worker con D1 e cron trigger |

### 2.2 AI Intelligence Layer

| File | Contenuto |
|------|-----------|
| `packages/intelligence/src/intelligence.js` | Classe `IntelligenceEngine` con usage trends, anomaly detection, security risks, cost analysis, recommendations |
| `packages/intelligence/src/index.js` | Endpoint `/health`, `/v1/insights`, `/v1/anomalies`, `/v1/admin/intelligence/refresh` |
| `packages/intelligence/wrangler.toml` | Configurazione worker con D1 |

### 2.3 Compatibility Engine

| File | Contenuto |
|------|-----------|
| `packages/compatibility/src/compatibility.js` | Classe `CompatibilityEngine` con version check, schema compatibility, protocol check, capability matching |
| `packages/compatibility/src/index.js` | Endpoint `/health`, `/v1/check`, `/v1/compatible` |
| `packages/compatibility/wrangler.toml` | Configurazione worker con D1 |

### 2.4 Real-time Analytics

| File | Contenuto |
|------|-----------|
| `shared/migrations/009_analytics_metrics.sql` | Tabelle `analytics_metrics`, viste `v_usage_dashboard`, `v_health_dashboard` |
| `packages/analytics/src/analytics.js` | Classe `AnalyticsEngine` con dashboard, error distribution, export Prometheus/OpenTelemetry |
| `packages/analytics/src/index.js` | Endpoint `/health`, `/v1/dashboard/usage`, `/v1/dashboard/health`, `/v1/dashboard/errors`, `/v1/metrics/prometheus`, `/v1/metrics/opentelemetry`, `/v1/metrics` |
| `packages/analytics/wrangler.toml` | Configurazione worker con D1 |

### 2.5 Registry Mirroring

| File | Contenuto |
|------|-----------|
| `shared/migrations/010_registry_snapshots.sql` | Tabella `registry_snapshots` |
| `packages/registry/src/mirror.js` | Classe `RegistryMirror` con snapshot, list, restore, delete |
| `packages/registry/src/index.js` | Endpoint `/v1/admin/registry/snapshot`, `/v1/admin/registry/snapshots`, `/v1/admin/registry/restore` |
| `packages/registry/wrangler.toml` | R2 binding placeholder per `metamesh-registry-mirror` |

### 2.6 Deploy e orchestrazione

| File | Modifica |
|------|----------|
| `package.json` | `deploy:workers` include `packages/lifecycle`, `packages/intelligence`, `packages/compatibility`, `packages/analytics` |
| `package.json` | `db:migrate` include migrazioni 001-010 |

---

## 3. Nuovi endpoint API

| Metodo | Endpoint | Package | Descrizione |
|--------|----------|---------|-------------|
| GET | `/health` | Lifecycle | Health check worker lifecycle |
| GET | `/v1/lifecycle/:tool` | Lifecycle | Storico lifecycle di un tool |
| POST | `/v1/admin/lifecycle/evaluate` | Lifecycle | Valuta tutti i tool |
| POST | `/v1/admin/lifecycle/evaluate/:tool` | Lifecycle | Valuta singolo tool |
| GET | `/v1/insights` | Intelligence | Insight completi con raccomandazioni |
| GET | `/v1/anomalies` | Intelligence | Anomalie rilevate |
| POST | `/v1/check` | Compatibility | Check compatibilità tool |
| POST | `/v1/compatible` | Compatibility | Trova tool compatibili |
| GET | `/v1/dashboard/usage` | Analytics | Usage dashboard |
| GET | `/v1/dashboard/health` | Analytics | Health dashboard |
| GET | `/v1/dashboard/errors` | Analytics | Error distribution |
| GET | `/v1/metrics/prometheus` | Analytics | Export Prometheus |
| GET | `/v1/metrics/opentelemetry` | Analytics | Export OpenTelemetry JSON |
| GET | `/v1/metrics` | Analytics | Stored metrics |
| POST | `/v1/admin/registry/snapshot` | Registry | Crea snapshot registry |
| GET | `/v1/admin/registry/snapshots` | Registry | Lista snapshot |
| POST | `/v1/admin/registry/restore` | Registry | Ripristina snapshot |

---

## 4. Lifecycle States

```
DISCOVERED → VALIDATED → VERIFIED → BENCHMARKED → RANKED → ACTIVE → DEPRECATED → ARCHIVED
```

### Regole di transizione

| Da | A | Condizione |
|----|---|------------|
| DISCOVERED | VALIDATED | description > 10 char e schema presente |
| VALIDATED | VERIFIED | security_score >= 0.5 |
| VERIFIED | BENCHMARKED | benchmark_score >= 0.4 |
| BENCHMARKED | RANKED | trust_score >= 0.7 |
| RANKED | ACTIVE | popularity_score >= 50 OR trust_score >= 0.8 |
| * | DEPRECATED | malware detected OR security_score < 0.3 |
| DEPRECATED | ARCHIVED | deprecated_since > 90 giorni |

---

## 5. Cron schedule attivo

| Worker | Frequenza | Orario |
|--------|-----------|--------|
| `metamesh-lifecycle` | Giornaliero | `0 1 * * *` |
| `metamesh-registry` | Ogni 6 ore | `0 */6 * * *` |
| `metamesh-discovery` | Ogni 6 ore | `0 */6 * * *` |
| `metamesh-updater` | Giornaliero | `0 2 * * *` |
| `metamesh-benchmark` | Giornaliero | `0 2 * * *` |
| `metamesh-trust` | Giornaliero | `0 3 * * *` |
| `metamesh-security` | Giornaliero | `0 3 * * *` |
| `metamesh-aggregator` | Giornaliero | `0 4 * * *` |
| `metamesh-eliminatore` | Settimanale | `0 5 * * 0` |

---

## 6. Verifica consigliata

### Migrazione database

```bash
npm run db:migrate
```

### Deploy

```bash
npm run deploy:workers
```

### Test rapidi

```bash
# Lifecycle
curl -X POST -H "X-Admin-Key: $ADMIN_KEY" https://api.metamesh-uga.dev/v1/admin/lifecycle/evaluate
curl https://api.metamesh-uga.dev/v1/lifecycle/example.echo

# Intelligence
curl https://api.metamesh-uga.dev/v1/insights
curl https://api.metamesh-uga.dev/v1/anomalies

# Compatibility
curl -X POST https://api.metamesh-uga.dev/v1/check \
  -H "Content-Type: application/json" \
  -d '{"tool": "example.echo", "requirements": {"min_version": "1.0.0"}}'

# Analytics
curl https://api.metamesh-uga.dev/v1/dashboard/health
curl https://api.metamesh-uga.dev/v1/metrics/prometheus

# Registry mirroring
curl -X POST -H "X-Admin-Key: $ADMIN_KEY" https://api.metamesh-uga.dev/v1/admin/registry/snapshot \
  -H "Content-Type: application/json" -d '{"name": "pre-release"}'
curl https://api.metamesh-uga.dev/v1/admin/registry/snapshots
```

---

## 7. Note e limiti noti

- **Lifecycle Manager**: le regole sono hardcoded in `lifecycle.js`. In futuro possono essere configurate tramite tabella `lifecycle_rules`.
- **AI Intelligence**: analisi statistica su dati D1. In futuro può integrare LLM/ML per insight più sofisticati.
- **Compatibility Engine**: schema check basato su nomi tool presenti in `schema.tools`. In futuro può essere esteso con JSON Schema diff.
- **Analytics**: Prometheus export in formato testo. OpenTelemetry export in JSON semplificato. Per streaming real-time completo serve integrazione con un time-series database.
- **Registry Mirroring**: R2 binding è commentato; abilitarlo in `wrangler.toml` e creare il bucket `metamesh-registry-mirror` per produzione.

---

## 8. Prossima fase

**Fase 5 — Operatività e Scalabilità**

- Config Engine e feature flags
- Health Engine e real-time health checks
- Advanced Cache Engine
- Multi-region deployment
- Self-healing automation
- Final documentation e operational runbook

---

*Audit generato automaticamente al termine della Fase 4 — 2026-06-25*
