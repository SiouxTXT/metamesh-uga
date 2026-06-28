# MetaMesh-UGA API Reference

> Riferimento completo degli endpoint implementati nelle Fasi 1-5.

---

## Base URL

```
Production: https://api.metamesh-uga.dev
```

## Autenticazione

- **Admin**: `X-Admin-Key` header
- **Public**: la maggior parte degli endpoint di sola lettura sono aperti

---

## Gateway

| Endpoint | Metodo | Descrizione |
|----------|--------|-------------|
| `/health` | GET | Health check gateway |
| `/v1/tools` | GET | Lista tool con cache, sort, category, min_trust |
| `/v1/tools/:name/trust` | GET | Trust score di un tool |
| `/v1/tools/trusted` | GET | Tool trusted |
| `/v1/call` | POST | Esegue un tool con reliability layer |
| `/v1/route` | GET | Smart routing test |

## Discovery

| Endpoint | Metodo | Descrizione |
|----------|--------|-------------|
| `/v1/search` | GET | Ricerca semantica |
| `/v1/intent` | GET | Intent search |
| `/v1/graph` | GET | Capability graph |
| `/v1/capabilities/:capability` | GET | Tool per capability |
| `/v1/admin/index` | POST | Indexazione semantica |
| `/v1/admin/discovery` | POST | Trigger discovery |

## Trust

| Endpoint | Metodo | Descrizione |
|----------|--------|-------------|
| `/v1/tools/:name/trust` | GET | Trust score |
| `/v1/tools/trusted` | GET | Tool trusted |
| `/v1/admin/trust/recalculate` | POST | Ricalcola trust |
| `/v1/admin/trust/recalculate/:name` | POST | Ricalcola trust singolo |

## Security

| Endpoint | Metodo | Descrizione |
|----------|--------|-------------|
| `/v1/security/:name` | GET | Security scan |
| `/v1/admin/security/scan` | POST | Scansiona tutti |
| `/v1/admin/security/scan/:name` | POST | Scansiona singolo |

## Policy

| Endpoint | Metodo | Descrizione |
|----------|--------|-------------|
| `/v1/evaluate` | POST | Valuta policy |
| `/v1/policies` | GET/POST | Lista/Crea policy |
| `/v1/policies/:id` | DELETE | Elimina policy |

## Benchmark

| Endpoint | Metodo | Descrizione |
|----------|--------|-------------|
| `/v1/benchmark/:name` | GET | Benchmark tool |
| `/v1/ranking` | GET | Classifica overall |
| `/v1/admin/benchmark` | POST | Benchmark tutti |
| `/v1/admin/benchmark/:name` | POST | Benchmark singolo |

## Registry

| Endpoint | Metodo | Descrizione |
|----------|--------|-------------|
| `/v1/registry/sources` | GET | Sorgenti registry |
| `/v1/registry/sync` | GET/POST | Sync registry |
| `/v1/admin/registry/sources` | POST | Aggiungi sorgente |
| `/v1/admin/registry/snapshot` | POST | Snapshot registry |
| `/v1/admin/registry/snapshots` | GET | Lista snapshot |
| `/v1/admin/registry/restore` | POST | Ripristina snapshot |

## Recommendation

| Endpoint | Metodo | Descrizione |
|----------|--------|-------------|
| `/v1/recommend` | GET | Raccomandazione tool |
| `/v1/similar/:tool` | GET | Tool simili |

## Cost

| Endpoint | Metodo | Descrizione |
|----------|--------|-------------|
| `/v1/estimate` | GET | Stima costo |
| `/v1/optimize` | GET | Ottimizzazione per costo |
| `/v1/budget/:user_id` | GET | Budget check |

## Lifecycle

| Endpoint | Metodo | Descrizione |
|----------|--------|-------------|
| `/v1/lifecycle/:tool` | GET | Storico lifecycle |
| `/v1/admin/lifecycle/evaluate` | POST | Valuta tutti |
| `/v1/admin/lifecycle/evaluate/:tool` | POST | Valuta singolo |

## Intelligence

| Endpoint | Metodo | Descrizione |
|----------|--------|-------------|
| `/v1/insights` | GET | Insight e raccomandazioni |
| `/v1/anomalies` | GET | Anomalie |
| `/v1/admin/intelligence/refresh` | POST | Refresh insights |

## Compatibility

| Endpoint | Metodo | Descrizione |
|----------|--------|-------------|
| `/v1/check` | POST | Check compatibilità |
| `/v1/compatible` | POST | Tool compatibili |

## Analytics

| Endpoint | Metodo | Descrizione |
|----------|--------|-------------|
| `/v1/dashboard/usage` | GET | Usage dashboard |
| `/v1/dashboard/health` | GET | Health dashboard |
| `/v1/dashboard/errors` | GET | Error distribution |
| `/v1/metrics/prometheus` | GET | Export Prometheus |
| `/v1/metrics/opentelemetry` | GET | Export OpenTelemetry |
| `/v1/metrics` | GET | Stored metrics |

## Health

| Endpoint | Metodo | Descrizione |
|----------|--------|-------------|
| `/v1/health` | GET | Health status |
| `/v1/health/:tool` | GET | Health history |
| `/v1/admin/health/check` | POST | Health check tutti |
| `/v1/admin/health/check/:tool` | POST | Health check singolo |

## Config

| Endpoint | Metodo | Descrizione |
|----------|--------|-------------|
| `/v1/config` | GET/POST | Leggi/Scrivi config |
| `/v1/features` | GET | Feature flags |
| `/v1/feature/:name` | GET | Feature flag check |
| `/v1/admin/config` | POST/DELETE | Admin config |
| `/v1/admin/features` | POST | Admin feature flags |

## Cache

| Endpoint | Metodo | Descrizione |
|----------|--------|-------------|
| `/v1/admin/cache/invalidate` | POST | Invalida cache |
| `/v1/admin/cache/stats` | GET | Stats cache |

## Self-Healing

| Endpoint | Metodo | Descrizione |
|----------|--------|-------------|
| `/v1/history` | GET | Storico healing |
| `/v1/admin/heal` | POST | Trigger healing |

## Inserter / Updater / Aggregator / Eliminatore

| Endpoint | Metodo | Descrizione |
|----------|--------|-------------|
| `/v1/admin/tools` | POST | Inserisci tool (inserter) |
| `/v1/admin/update` | POST | Aggiorna metadati (updater) |
| `/v1/admin/aggregate` | POST | Aggregazione (aggregator) |
| `/v1/stats` | GET | Statistiche aggregate |
| `/v1/admin/cleanup` | POST | Cleanup tool (eliminatore) |

---

## Esempi

### List tools

```bash
curl "https://api.metamesh-uga.dev/v1/tools?sort=trust&limit=10"
```

### Call tool

```bash
curl -X POST "https://api.metamesh-uga.dev/v1/call" \
  -H "Content-Type: application/json" \
  -d '{"tool": "example.echo", "params": {"message": "Hello"}}'
```

### Smart routing

```bash
curl "https://api.metamesh-uga.dev/v1/route?category=ai&strategy=cost&min_trust=0.6"
```

### Policy evaluation

```bash
curl -X POST "https://api.metamesh-uga.dev/v1/evaluate" \
  -H "Content-Type: application/json" \
  -d '{"server": {"name": "example.echo", "security_score": 0.9, "state": "RANKED", "deprecated": false}}'
```

### Recommend

```bash
curl "https://api.metamesh-uga.dev/v1/recommend?q=send+email"
```

### Cost estimate

```bash
curl "https://api.metamesh-uga.dev/v1/estimate?tool=example.echo&calls=100"
```

### Analytics Prometheus

```bash
curl "https://api.metamesh-uga.dev/v1/metrics/prometheus"
```

---

## Note

- Gli endpoint `/v1/admin/*` richiedono l'header `X-Admin-Key`.
- Gli endpoint `/v1/tools` restituiscono header `X-Cache` con `HIT`/`MISS`.
- Alcune funzionalità avanzate (KV, R2) richiedono la configurazione dei binding in `wrangler.toml`.

---

*Aggiornato alla Fase 5 — 2026-06-25*
