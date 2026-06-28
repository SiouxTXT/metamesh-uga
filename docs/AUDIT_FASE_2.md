# Audit — Fase 2: Sicurezza, Policy e Benchmark

> Data: 2026-06-25
> Stato: **COMPLETATA**

---

## 1. Obiettivo della Fase 2

Aggiungere le componenti di sicurezza, policy e benchmark al Control Plane, e completare la federazione dei registry.

---

## 2. Componenti implementate

### 2.1 Security Scanner

| File | Contenuto |
|------|-----------|
| `packages/security/src/scanner.js` | Classe `SecurityScanner` con dependency scan, CVE lookup via NVD, malware detection, permission analysis, network/filesystem analysis |
| `packages/security/src/index.js` | Worker cron giornaliero (03:30) + endpoint `/health`, `/v1/security/:name`, `/v1/admin/security/scan` |
| `packages/security/wrangler.toml` | Configurazione worker con D1 e cron trigger |
| `packages/gateway/src/index.js` | Policy enforcement inline in `/v1/call` e MCP `tools/call` (security_score, state, deprecated) |

### 2.2 Policy Engine

| File | Contenuto |
|------|-----------|
| `shared/migrations/006_policies.sql` | Tabelle `policies` e `policy_evaluations`, seed policy di default |
| `packages/policy/src/engine.js` | Classe `PolicyEngine` con evaluator JSON-based (operatori: eq, neq, gt, gte, lt, lte, in, not_in, contains, starts_with) |
| `packages/policy/src/index.js` | Endpoint `/health`, `/v1/evaluate`, `/v1/policies`, `/v1/admin/policies` |
| `packages/policy/wrangler.toml` | Configurazione worker con D1 |

### 2.3 Benchmark Engine

| File | Contenuto |
|------|-----------|
| `shared/migrations/007_benchmark_results.sql` | Tabella `benchmark_results`, vista `v_tool_ranking` |
| `packages/benchmark/src/benchmark.js` | Classe `BenchmarkEngine` con metriche: startup_time, response_time p50/p95, success_rate, throughput, benchmark_score |
| `packages/benchmark/src/index.js` | Worker cron giornaliero (02:30) + endpoint `/health`, `/v1/benchmark/:name`, `/v1/ranking`, `/v1/admin/benchmark` |
| `packages/benchmark/wrangler.toml` | Configurazione worker con D1 e cron trigger |

### 2.4 Registry Federation

| File | Contenuto |
|------|-----------|
| `packages/registry/src/federation.js` | Classe `RegistryFederation` con multi-source sync, merge con priorità, deduplicazione |
| `packages/registry/src/index.js` | Worker cron ogni 6 ore + endpoint `/health`, `/v1/registry/sources`, `/v1/registry/sync`, `/v1/admin/registry/sources` |
| `packages/registry/wrangler.toml` | Configurazione worker con D1 e cron trigger |
| `packages/discovery/src/index.js` | Aggiornato per usare `RegistryFederation` invece di singolo registry |
| `shared/migrations/008_registry_sources_seed.sql` | Seed default sources: mcp-official, smithery |

### 2.5 Trust Engine evoluto

| File | Contenuto |
|------|-----------|
| `packages/trust/src/trust-score.js` | Aggiunto `security` come componente con peso 0.20; ri-bilanciati gli altri pesi |

### 2.6 Lifecycle avanzato

| File | Contenuto |
|------|-----------|
| `packages/benchmark/src/benchmark.js` | Transizione automatica `VERIFIED → BENCHMARKED` e `BENCHMARKED → RANKED` se trust_score >= 0.7 |
| `packages/aggregator/src/index.js` | Include tool in stato `BENCHMARKED`, `RANKED`, `ACTIVE` nella routing table |
| `packages/gateway/src/index.js` | Permette esecuzione tool in stato `ACTIVE`, `RANKED`, `BENCHMARKED`, `VERIFIED` |

### 2.7 Deploy e orchestrazione

| File | Modifica |
|------|----------|
| `package.json` | `deploy:workers` include `packages/registry`, `packages/security`, `packages/policy`, `packages/benchmark` |
| `package.json` | `db:migrate` include migrazioni 001-008 |

---

## 3. Nuovi endpoint API

| Metodo | Endpoint | Package | Descrizione |
|--------|----------|---------|-------------|
| GET | `/health` | Security | Health check worker security |
| GET | `/v1/security/:name` | Security | Ultimo security scan di un tool |
| POST | `/v1/admin/security/scan` | Security | Scansiona tutti i tool |
| POST | `/v1/admin/security/scan/:name` | Security | Scansiona singolo tool |
| POST | `/v1/evaluate` | Policy | Valuta una richiesta contro le policy |
| GET | `/v1/policies` | Policy | Lista policy abilitate |
| POST | `/v1/policies` | Policy | Crea nuova policy |
| DELETE | `/v1/policies/:id` | Policy | Elimina policy |
| GET | `/v1/benchmark/:name` | Benchmark | Ultimo benchmark di un tool |
| GET | `/v1/ranking` | Benchmark | Classifica completa con overall_score |
| POST | `/v1/admin/benchmark` | Benchmark | Esegue benchmark su tutti i tool |
| POST | `/v1/admin/benchmark/:name` | Benchmark | Esegue benchmark su singolo tool |
| GET | `/v1/registry/sources` | Registry | Lista sorgenti registry |
| GET | `/v1/registry/sync` | Registry | Sincronizza tutti i registry |
| POST | `/v1/admin/registry/sources` | Registry | Aggiunge sorgente registry |
| POST | `/v1/admin/registry/sync` | Registry | Trigger sync registry |

---

## 4. Policy di default

| Nome | Effetto | Condizione |
|------|---------|------------|
| `block-low-security` | deny | `security_score < 0.5` |
| `block-malware` | deny | `malware_detected == true` |
| `block-deprecated` | deny | `deprecated == true` |
| `require-active-state` | deny | `state not in [ACTIVE, RANKED]` |
| `allow-admin-any` | allow | `user.role == admin` |

---

## 5. Cron schedule attivo

| Worker | Frequenza | Orario |
|--------|-----------|--------|
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
# Security scan singolo
curl -X POST -H "X-Admin-Key: $ADMIN_KEY" https://api.metamesh-uga.dev/v1/admin/security/scan/example.echo

# Policy evaluation
curl -X POST https://api.metamesh-uga.dev/v1/evaluate \
  -H "Content-Type: application/json" \
  -d '{"server": {"name": "example.echo", "security_score": 0.9, "state": "RANKED", "deprecated": false}, "user": {"role": "standard"}}'

# Benchmark e ranking
curl -X POST -H "X-Admin-Key: $ADMIN_KEY" https://api.metamesh-uga.dev/v1/admin/benchmark
curl https://api.metamesh-uga.dev/v1/ranking

# Registry sync e sorgenti
curl -X POST -H "X-Admin-Key: $ADMIN_KEY" https://api.metamesh-uga.dev/v1/admin/registry/sync
curl https://api.metamesh-uga.dev/v1/registry/sources
```

---

## 7. Note e limiti noti

- **Security Scanner**: le scansioni dipendono dalla disponibilità di `package.json` pubblico su GitHub e dall'API NVD. Il malware detection è un placeholder basato su URL reputation.
- **Policy Engine**: implementazione semplificata con condizioni JSON. In fasi future può essere sostituita con un vero OPA/Rego service.
- **Benchmark Engine**: esegue benchmark reali solo su tool built-in (example.echo); per tool esterni usa euristiche e source availability. Richiede un runner MCP dedicato per benchmark reali.
- **Registry Federation**: supporta MCP ufficiale e Smithery; aggiungere nuovi source è possibile tramite `/v1/admin/registry/sources`.

---

## 8. Prossima fase

**Fase 3 — Intelligenza e Routing**

- Capability Graph e Intent Search
- Recommendation Engine
- Smart Routing Engine
- Reliability Layer
- Cost Optimizer

---

*Audit generato automaticamente al termine della Fase 2 — 2026-06-25*
