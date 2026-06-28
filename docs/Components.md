# MetaMesh-UGA — Components

> Elenco e descrizione dei componenti del sistema.

---

## Data Plane

### Gateway
- **File**: `packages/gateway/`
- **Endpoint**: `https://api.metamesh-uga.dev`
- **Funzioni**: API pubblica, routing, cache, reliability patterns, MCP JSON-RPC, tool execution.

### Cache
- **File**: `packages/gateway/src/cache.js`, `packages/cache/`
- **Funzioni**: Multi-level cache L1 in-memory + L2 KV, TTL, invalidazione per pattern.

### Health Engine
- **File**: `packages/health/`
- **Cron**: `*/10 * * * *`
- **Funzioni**: HTTP HEAD checks, health dashboard, eviction tool unhealthy.

---

## Control Plane

### Discovery
- **File**: `packages/discovery/`
- **Cron**: `0 */6 * * *`
- **Funzioni**: Ricerca semantica, intent search, capability graph, indexing.

### Registry
- **File**: `packages/registry/`
- **Cron**: `0 */6 * * *`
- **Funzioni**: Registry federation, sync, snapshot, restore, region replication.

### Trust
- **File**: `packages/trust/`
- **Cron**: giornaliero
- **Funzioni**: Trust score, popularity score, confidence, reputation.

### Security
- **File**: `packages/security/`
- **Cron**: giornaliero
- **Funzioni**: CVE scan, dependency check, malware, permission analysis.

### Policy
- **File**: `packages/policy/`
- **Funzioni**: JSON condition engine, policy evaluation, audit trail.

### Benchmark
- **File**: `packages/benchmark/`
- **Cron**: giornaliero
- **Funzioni**: Performance measurement, benchmark score, ranking view.

### Lifecycle
- **File**: `packages/lifecycle/`
- **Cron**: `0 1 * * *`
- **Funzioni**: 8 stati lifecycle, transizioni automatiche basate su metriche.

### Recommendation
- **File**: `packages/recommendation/`
- **Funzioni**: Raccomandazione tool basata su semantic, intent, trust, security.

### Cost
- **File**: `packages/cost/`
- **Funzioni**: Cost estimation, optimization, budget check.

### Compatibility
- **File**: `packages/compatibility/`
- **Funzioni**: Version, schema, protocol, capability compatibility check.

### Intelligence
- **File**: `packages/intelligence/`
- **Funzioni**: Insights, anomaly detection, trend analysis, security risk.

### Analytics
- **File**: `packages/analytics/`
- **Funzioni**: Dashboard usage/health/errors, Prometheus, OpenTelemetry export.

### Config
- **File**: `packages/config/`
- **Funzioni**: Global/tenant/user config, feature flags, percentage rollout.

### Self-Healing
- **File**: `packages/self-healing/`
- **Cron**: `*/5 * * * *`
- **Funzioni**: High error rate detection, stale tool cleanup, rollback recovery.

---

## Infrastructure Workers

### Aggregator
- **File**: `packages/aggregator/`
- **Funzioni**: Aggregazione dati, routing table generation.

### Inserter
- **File**: `packages/inserter/`
- **Funzioni**: Inserimento manuale tool.

### Updater
- **File**: `packages/updater/`
- **Cron**: giornaliero
- **Funzioni**: Aggiornamento metadati tool.

### Eliminatore
- **File**: `packages/eliminatore/`
- **Cron**: settimanale
- **Funzioni**: Cleanup tool deprecati.

### Alerts
- **File**: `packages/alerts/`
- **Funzioni**: Monitoraggio metriche e alert.

### Agent Billing
- **File**: `packages/agent-billing/`
- **Funzioni**: Billing, invoicing, budget monitoring per agenti.

---

## Storage

- **D1**: `metamesh-catalog` — database SQLite globale.
- **KV**: `CACHE`, `CONFIG_CACHE` — cache chiave-valore (placeholder).
- **R2**: `metamesh-registry-mirror`, `metamesh-analytics` — object storage (placeholder).

---

## Interfaccia utente

- **Landing**: `packages/landing/` — Cloudflare Pages, React.
- **Dashboard**: `packages/dashboard/` — Cloudflare Pages, React.

---

*Components — 2026-06-25*
