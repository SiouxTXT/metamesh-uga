# MetaMesh-UGA — Piano di Implementazione

> Derivato dal **Gap Analysis & Technical Recommendations** del 2026-06-25.
> Obiettivo: trasformare MetaMesh-UGA da gateway serverless a **MCP Operating System**.

---

## 1. Stato attuale riassunto

### Componenti esistenti e funzionanti

| Componente | Package | Stato | Note |
|--------------|---------|-------|------|
| Gateway API | `packages/gateway/` | ✅ Attivo | Health, `/v1/tools`, `/v1/call`, `/v1/admin/discovery`, `/docs`, MCP JSON-RPC |
| Discovery Engine | `packages/discovery/` | ✅ Attivo | Sync 6h con registry MCP, GitHub topic, routing table, notifiche Telegram |
| Alerts Worker | `packages/alerts/` | ✅ Attivo | Error rate, latency, DB size, budget alerts |
| Agent Billing | `packages/agent-billing/` | ✅ Attivo | Fatturazione mensile, budget, cleanup |
| Dashboard | `packages/dashboard/` | ✅ Esistente | Pagine Tools, Usage, Billing, Agents, Dashboard |
| Landing | `packages/landing/` | ✅ Esistente | Landing page React |
| Shared | `shared/src/` | ✅ Attivo | auth, ratelimit, wasm-runtime, x402 |
| D1 Schema | `shared/migrations/` | ✅ Base | users, tools, routing, usage_log, agents, pricing, transactions, invoices |

### Package scheletro / da riempire

| Package | Stato |
|---------|-------|
| `packages/aggregator/` | Scheletro (solo health) |
| `packages/inserter/` | Scheletro |
| `packages/updater/` | Scheletro |
| `packages/eliminatore/` | Scheletro |

---

## 2. Principi architetturali: Data Plane vs Control Plane

### Control Plane
Decisioni, configurazione, orchestrazione, analytics.

| Engine | Package futuro | Responsabilità |
|--------|----------------|----------------|
| Registry Engine | `packages/registry/` | Sync, federation, mirroring, snapshot, offline mode |
| Discovery Engine | `packages/discovery/` + `packages/semantic-discovery/` | Keyword search, semantic search, capability graph, intent search |
| Trust Engine | `packages/trust/` | Reputation score, ranking, storico |
| Policy Engine | `packages/policy/` | OPA/Rego evaluation, RBAC, audit |
| Lifecycle Manager | `packages/lifecycle/` | Stati server MCP, automazioni transizioni |
| Security Scanner | `packages/security/` | CVE, dependency scan, malware, permission analysis |
| Analytics Engine | `packages/analytics/` + `packages/dashboard/` | Metrics, trend, export (OpenTelemetry, Prometheus) |
| Config Engine | `packages/config/` | Configurazioni distribuite, feature flags |

### Data Plane
Esecuzione delle richieste in tempo reale.

| Engine | Package futuro | Responsabilità |
|--------|----------------|----------------|
| Routing Engine | `packages/gateway/src/routing/` | Weighted, latency, geographic, cost, health routing |
| Cache Engine | `packages/gateway/src/cache/` | Multi-level edge cache (KV/R2) |
| Health Engine | `packages/health/` | Real-time health checks, circuit breaker state |
| Proxy Engine | `packages/gateway/src/proxy/` | MCP protocol proxy |
| Rate Limiting | `shared/src/ratelimit.js` | Per-tenant rate limiting |
| Reliability Layer | `packages/gateway/src/reliability/` | Retry, circuit breaker, bulkhead, hedging |

---

## 3. Fasi di implementazione

### FASE 1 — Fondamentali (Critico)
Obiettivo: allineare documentazione e posizionamento, aggiungere trust e discovery semantico base.

| # | Task | Package/File | Dettaglio | Impatto |
|---|------|--------------|-----------|---------|
| 1.1 | Ristrutturare README e docs | `README.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY_MODEL.md` | Vision statement "MCP Operating System", architettura Data/Control Plane, diagrammi Mermaid | 🔴 Alto |
| 1.2 | Estendere schema `tools` | `shared/migrations/004_trust_and_lifecycle.sql` | `trust_score`, `trust_score_confidence`, `security_score`, `state`, `registry_source`, `registry_priority` | 🔴 Alto |
| 1.3 | Trust Engine base | `packages/trust/` | Calcolo da `usage_log` (uptime, latency, success rate) | 🔴 Alto |
| 1.4 | Estendere Discovery con semantic search base | `packages/discovery/src/semantic.js` | Embedding testo (name + description + capabilities) + ricerca vettoriale su D1 | 🔴 Medio |
| 1.5 | Riattivare package scheletro | `packages/aggregator/`, `packages/inserter/`, `packages/updater/`, `packages/eliminatore/` | Dare responsabilità concrete: aggregazione metadati, inserimento, aggiornamento, eliminazione logica | 🟠 Medio |

### FASE 2 — Sicurezza, Policy e Benchmark (Alta)
Obiettivo: rendere il catalogo sicuro, misurabile e governato da policy.

| # | Task | Package/File | Dettaglio | Impatto |
|---|------|--------------|-----------|---------|
| 2.1 | Security Scanner | `packages/security/` | Dependency scan (npm audit), CVE lookup, permission analysis, security score | 🟠 Alto |
| 2.2 | Policy Engine (OPA/Rego) | `packages/policy/` | Valutazione policy con regole Rego, endpoint `/v1/admin/policy/evaluate`, tabella `policies` | 🟠 Alto |
| 2.3 | Benchmark Engine | `packages/benchmark/` | Cron notturno: startup time, response time, memory, reliability, throughput | 🟠 Alto |
| 2.4 | API Trust Score | `packages/gateway/src/index.js` | Endpoint `GET /v1/tools/:name/trust` e `GET /v1/tools?sort=trust` | 🟠 Medio |
| 2.5 | Registry Federation | `packages/registry/src/federation.js` | Supporto multi-source: MCP ufficiale, Smithery, MCP.so, registry privati | 🟠 Medio |

### FASE 3 — Intelligenza e Routing (Media)
Obiettivo: raccomandazioni automatiche e routing avanzato.

| # | Task | Package/File | Dettaglio | Impatto |
|---|------|--------------|-----------|---------|
| 3.1 | Capability Graph | `packages/discovery/src/capability-graph.js` | Grafo capability (DB o in-memory) + ricerca per intent | 🟡 Medio |
| 3.2 | Intent Search | `packages/discovery/src/intent.js` | Classificazione query → capability → server | 🟡 Medio |
| 3.3 | Recommendation Engine | `packages/recommendation/` | Endpoint `POST /v1/recommend` con spiegazione e alternative | 🟡 Medio |
| 3.4 | Smart Routing Engine | `packages/gateway/src/routing/` | Weighted, latency, geographic, cost, health + fallback chain | 🟡 Medio |
| 3.5 | Reliability Layer | `packages/gateway/src/reliability/` | Circuit breaker, bulkhead, hedging, adaptive timeout | 🟡 Medio |
| 3.6 | Cost Optimizer | `packages/cost/` | Selezione backend per costo con vincoli di latenza/reliability | 🟢 Basso |

### FASE 4 — Lifecycle, Analytics, Scalabilità (Bassa/Media)
Obiettivo: automatizzare il ciclo di vita e potenziare osservabilità/scalabilità.

| # | Task | Package/File | Dettaglio | Impatto |
|---|------|--------------|-----------|---------|
| 4.1 | MCP Lifecycle Manager | `packages/lifecycle/` | Stati: DISCOVERED → VALIDATED → VERIFIED → BENCHMARKED → RANKED → ACTIVE → DEPRECATED → ARCHIVED | 🟡 Medio |
| 4.2 | AI Intelligence Layer | `packages/intelligence/` | Duplicate detection, obsolete detection, orphan detection, version compatibility | 🟢 Basso |
| 4.3 | Compatibility Engine | `packages/compatibility/` | Matrice compatibilità client MCP (cursor, claude, vscode, etc.) | 🟢 Basso |
| 4.4 | Real-time Dashboard | `packages/dashboard/src/pages/Realtime.tsx` | WebSocket/SSE, metriche live, heatmap, trend | 🟡 Medio |
| 4.5 | OpenTelemetry / Prometheus export | `packages/analytics/` | Export metriche e traces | 🟢 Basso |
| 4.6 | Registry Mirroring & Snapshot | `packages/registry/src/mirror.js`, `packages/registry/src/snapshot.js` | Replica regionale e snapshot point-in-time | 🟢 Basso |
| 4.7 | Cache Engine evoluto | `packages/gateway/src/cache/` | Multi-level cache (KV + R2) con TTL e invalidazione | 🟡 Medio |

---

## 4. Ordine consigliato di esecuzione

```
FASE 1
  1.1 → 1.2 → 1.3 → 1.4 → 1.5

FASE 2
  2.1 → 2.2 → 2.3 → 2.4 → 2.5

FASE 3
  3.1 → 3.2 → 3.3 → 3.4 → 3.5 → 3.6

FASE 4
  4.1 → 4.2 → 4.3 → 4.4 → 4.5 → 4.6 → 4.7
```

---

## 5. Schema evolutivo del database

### Migrazioni da creare

| File | Contenuto |
|------|-----------|
| `shared/migrations/004_trust_and_lifecycle.sql` | Colonne trust, security, lifecycle su `tools`; tabella `trust_score_history` |
| `shared/migrations/005_registry_federation.sql` | Colonne `registry_source`, `registry_priority`, `federation_id` su `tools`; tabella `registry_sources` |
| `shared/migrations/006_security_scores.sql` | `security_score`, `security_scan_updated`, `cve_count`, `malware_detected` su `tools`; tabella `security_scans` |
| `shared/migrations/007_benchmark_results.sql` | Tabella `benchmark_results` |
| `shared/migrations/008_policies.sql` | Tabella `policies` e `user_policies` |
| `shared/migrations/009_compatibility.sql` | Tabella `compatibility` |
| `shared/migrations/010_lifecycle_log.sql` | Tabella `lifecycle_log` |

---

## 6. Nuovi package e struttura consigliata

```
packages/
├── gateway/              # Data Plane + API entrypoint
│   └── src/
│       ├── index.js
│       ├── routing/      # weighted, latency, geo, cost, health
│       ├── cache/        # multi-level cache
│       ├── proxy/        # MCP proxy
│       └── reliability/  # circuit breaker, bulkhead, hedging
├── discovery/            # Control Plane: discovery base
│   └── src/
│       ├── index.js
│       ├── semantic.js
│       ├── capability-graph.js
│       └── intent.js
├── registry/             # Control Plane: registry
│   └── src/
│       ├── index.js
│       ├── federation.js
│       ├── mirror.js
│       └── snapshot.js
├── trust/                # Control Plane: reputation
│   └── src/
│       └── trust-score.js
├── benchmark/            # Control Plane: benchmark
│   └── src/
│       └── benchmark.js
├── security/             # Control Plane: security scanner
│   └── src/
│       └── scanner.js
├── policy/               # Control Plane: policy engine
│   └── src/
│       └── engine.js
├── lifecycle/            # Control Plane: lifecycle manager
│   └── src/
│       └── manager.js
├── recommendation/       # Control Plane: AI recommendations
│   └── src/
│       └── index.js
├── cost/                 # Control Plane/Data Plane: cost optimizer
│   └── src/
│       └── optimizer.js
├── compatibility/        # Control Plane: compatibility matrix
│   └── src/
│       └── matrix.js
├── intelligence/         # Control Plane: AI intelligence
│   └── src/
│       ├── duplicate.js
│       ├── obsolete.js
│       └── orphan.js
├── analytics/            # Control Plane: analytics export
│   └── src/
│       ├── opentelemetry.js
│       └── prometheus.js
├── health/               # Data Plane: health engine
│   └── src/
│       └── index.js
├── config/               # Control Plane: config engine
│   └── src/
│       └── index.js
├── aggregator/           # Riattivare
├── inserter/             # Riattivare
├── updater/              # Riattivare
├── eliminatore/          # Riattivare
├── alerts/               # Esistente
├── agent-billing/        # Esistente
├── dashboard/            # Esistente
└── landing/              # Esistente
```

---

## 7. Deliverable per sprint

| Sprint | Focus | Output misurabile |
|--------|-------|-------------------|
| 1 | Documentazione + Trust Score base | README/Architecture aggiornati, `trust_score` calcolato, API `/v1/tools/:name/trust` |
| 2 | Discovery semantico + Registry federation | Ricerca vettoriale, multi-source registry |
| 3 | Security + Policy + Benchmark | Scanner, policy engine, benchmark cron |
| 4 | Routing + Reliability | Smart router, circuit breaker, fallback |
| 5 | Lifecycle + Recommendation | Stati automatici, raccomandazioni AI |
| 6 | Analytics + Compatibility + Polish | Dashboard real-time, matrice client, OTel/Prometheus |

---

## 8. Considerazioni operative

- **Piattaforma**: Cloudflare Workers (D1, KV, R2, Analytics Engine).
- **Linguaggio**: JavaScript/TypeScript per worker; Go per CLI.
- **Testing**: Vitest per unit test; test di integrazione con `wrangler dev`.
- **Deploy**: Script esistente `npm run deploy:workers` da aggiornare con i nuovi package.
- **Secrets**: JWT_SECRET, ADMIN_KEY, GITHUB_TOKEN, TELEGRAM_* già presenti; aggiungere eventuali chiavi per OPA/embedding.
- **Costi**: embedding e CVE lookup possono richiedere API key esterne (OpenAI, NVD, Snyk). Valutare modelli locali per ridurre costi.

---

*Piano generato il 2026-06-25 — Versione 1.0*
