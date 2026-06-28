# MetaMesh-UGA — Audit Completo
**Data:** 2026-06-26  
**Worker Version:** `224afcfa-a03e-4d7e-85a7-9f1f9b3979e9`  
**Scope:** Gateway Worker, Infrastruttura Cloudflare, DB Schema, Sicurezza

---

## 1. ARCHITETTURA GENERALE

### Struttura del progetto
```
packages/
  gateway/         ← Worker Cloudflare (PRODUZIONE)
  dashboard/       ← Cloudflare Pages (React)
  landing/         ← Cloudflare Pages (React)
  discovery/       ← Package (non deployato come worker separato)
  trust/           ← Package (non deployato come worker separato)
  security/        ← Package (non deployato come worker separato)
  self-healing/    ← Package (non deployato come worker separato)
  ... (20+ packages)
shared/
  migrations/      ← 12 migration SQL per D1
```

> ⚠️ **FINDING #1 — Package non deployati**: I 20+ package sotto `packages/` (trust, security, discovery, lifecycle, ecc.) esistono come codice ma **non sono worker Cloudflare autonomi deployati**. Tutta la logica è centralizzata in `gateway/src/index.js` (1265 righe). Non è un problema operativo, ma limita la scalabilità futura e l'isolamento delle responsabilità.

---

## 2. ENDPOINTS — MAPPA COMPLETA

| Metodo | Path | Auth | Stato |
|--------|------|------|-------|
| GET | `/health` | No | ✅ |
| GET | `/v1/tools` | No | ✅ |
| GET | `/v1/tools/trusted` | No | ✅ |
| GET | `/v1/tools/:name/trust` | No | ✅ |
| GET | `/v1/search` | No | ✅ |
| GET | `/v1/recommend` | No | ✅ |
| GET | `/v1/route` | No | ✅ |
| POST | `/v1/call` | No | ✅ |
| GET | `/v1/metrics/prometheus` | No | ✅ |
| GET | `/v1/config` | No | ✅ |
| GET | `/v1/features` | No | ✅ |
| GET | `/v1/dashboard/health` | No | ✅ |
| GET | `/v1/dashboard/usage` | No | ✅ |
| GET | `/v1/dashboard/errors` | No | ✅ |
| GET | `/v1/history` | X-Admin-Key | ✅ |
| POST | `/v1/admin/discovery` | No | ⚠️ |
| GET | `/v1/admin/discovery/status` | No | ⚠️ |
| POST | `/v1/admin/security/scan/*` | X-Admin-Key | ✅ |
| POST | `/v1/admin/trust/recalculate/*` | X-Admin-Key | ✅ |
| POST | `/v1/admin/registry/sync` | X-Admin-Key | ✅ |
| POST | `/v1/admin/heal` | X-Admin-Key | ✅ |
| GET | `/mcp` | No | ✅ (SSE) |
| POST | `/mcp` | No | ✅ (JSON-RPC) |
| POST | `/mcp/message` | No | ✅ (JSON-RPC) |
| GET | `/docs` | No | ✅ |
| GET | `/install` | No | ✅ |
| GET | `/*` | No | 404 fallback |

> ⚠️ **FINDING #2 — Admin discovery senza auth**: `POST /v1/admin/discovery` e `GET /v1/admin/discovery/status` **non richiedono autenticazione**. Chiunque può triggherare una re-discovery dei tool.

---

## 3. SICUREZZA

### Autenticazione
- **Pattern**: `X-Admin-Key` header confrontato con `env.ADMIN_KEY` (secret Wrangler).
- **Proteggono**: `/v1/history`, `/v1/admin/security/scan/*`, `/v1/admin/trust/recalculate/*`, `/v1/admin/registry/sync`, `/v1/admin/heal`.
- **Non proteggono**: `/v1/admin/discovery`, `/v1/admin/discovery/status`, MCP endpoints, tutti i GET pubblici.

### CORS
```js
'Access-Control-Allow-Origin': '*'
'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
'Access-Control-Allow-Headers': 'Content-Type'
```
> ⚠️ **FINDING #3 — CORS wildcard**: `Access-Control-Allow-Origin: *` su tutti gli endpoint. Accettabile per API pubblica, ma i response headers del CORS **non includono** `X-Admin-Key`. Se si tenta di chiamare endpoint admin da browser (CORS preflight), l'header non viene allowlistato → le richieste admin da browser falliranno.

**Fix richiesto:**
```js
'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key'
```

### JWT
- `JWT_SECRET` definito in `wrangler.toml` come variabile (valore: `dev-secret-change-in-production`).
- ⚠️ **FINDING #4 — JWT_SECRET in produzione non aggiornato**: il valore è ancora quello di sviluppo. Nessun endpoint lo usa attivamente per ora (non c'è middleware JWT), ma è un rischio latente.

### Secrets configurati
| Secret | Stato |
|--------|-------|
| `ADMIN_KEY` | ✅ Impostato via `wrangler secret put` |
| `JWT_SECRET` | ⚠️ Valore dev in var (non secret) |
| `STRIPE_SECRET_KEY` | ❌ Non impostato |
| `TELEGRAM_BOT_TOKEN` | ❌ Non impostato |
| `TELEGRAM_CHAT_ID` | ❌ Non impostato |
| `SENTRY_DSN` | ❌ Non impostato |

---

## 4. BINDINGS CLOUDFLARE

| Binding | Tipo | Nome risorsa | Stato |
|---------|------|-------------|-------|
| `DB` | D1 | `metamesh-catalog` | ✅ |
| `CACHE` | KV | `e3fb217...` | ✅ |
| `CONFIG_CACHE` | KV | `38d187a...` | ✅ |
| `STORAGE` | R2 | `metamesh-wasm` | ✅ (0 oggetti) |
| `REGISTRY_MIRROR` | R2 | `metamesh-registry-mirror` | ✅ (0 oggetti) |
| `ANALYTICS_STORAGE` | R2 | `metamesh-analytics` | ✅ (1 oggetto, 131B) |
| `ANALYTICS` | Analytics Engine | `metamesh_usage` | ✅ |
| `COMPILATION_QUEUE` | Queue | `wasm-compilation` | ✅ |

> ℹ️ `STORAGE` (metamesh-wasm) e `REGISTRY_MIRROR` hanno 0 oggetti — bindings attivi ma non ancora utilizzati dal codice in produzione (logica WASM non deployata).

---

## 5. DATABASE D1

### Tabelle presenti (12 migration)
| Tabella | Scopo | Usata da API |
|---------|-------|-------------|
| `tools` | Registro tool MCP | ✅ Intensamente |
| `usage_log` | Log chiamate | ✅ |
| `users` | Utenti umani | ❌ Non usata da endpoint live |
| `agents` | AI agents | ❌ Non usata da endpoint live |
| `agent_wallets` | Wallet multi-chain | ❌ |
| `tool_pricing` | Prezzi per tool | ✅ (routing engine) |
| `configs` | Config utente cifrate | ❌ |
| `transactions` | Transazioni | ❌ |
| `invoices` | Fatture | ❌ |
| `benchmark_results` | Benchmark tool | ✅ (routing engine) |
| `security_scans` | Scan sicurezza | ✅ (admin scan) |
| `trust_score_history` | Storico trust | ✅ (admin trust recalc) |
| `lifecycle_log` | Lifecycle tool | ✅ (history, heal) |
| `discovery_log` | Log discovery | ✅ |
| `agent_rate_limits` | Rate limiting agenti | ❌ |
| `alerts_config` | Config alert | ❌ |
| `used_nonces` | Anti-replay x402 | ❌ |
| `routing` | Routing info | ❌ (routing engine usa tools) |
| Views (`v_top_tools`, ecc.) | Report | ❌ |

> ⚠️ **FINDING #5 — Molte tabelle inutilizzate**: users, agents, transactions, invoices, configs, wallet — presenti nello schema ma nessun endpoint attivo le popola o legge. Il sistema è pronto per la monetizzazione ma **non è ancora collegato**.

---

## 6. QUALITÀ DEL CODICE

### Router custom
- Implementazione manuale senza framework (itty-router, hono, ecc.).
- **Bug potenziale**: la route `GET:/*` cattura TUTTO incluse `POST` non trovate (il fallback GET viene usato anche per POST sconosciuti).
- **Wildcard matching**: funziona per `/*` suffix ma non per pattern arbitrari (es. `/v1/tools/:id`). La route `/v1/tools/:name/trust` è parsata manualmente con `split('/')[3]`.

### Variabili `_aeStatus` / `_r2Status` (debug residuo)
```js
let _aeStatus = 'no_binding';   // linea 511
let _r2Status = 'no_binding';   // linea 526
```
> ⚠️ **FINDING #6 — Variabili debug assegnate ma non usate**: `_aeStatus` e `_r2Status` vengono assegnate ma non compaiono nella risposta (il `_bindings` è stato rimosso). Generano variabili inutili ad ogni `POST /v1/call`. Non causa errori ma è codice non pulito.

### Tool execution placeholder
```js
data = { tool: dbTool.name, params, note: 'Execution placeholder - MCP worker not yet deployed' };
```
> ℹ️ **FINDING #7 — Solo `example.echo` ha esecuzione reale**. Tutti gli altri tool restituiscono un placeholder. Comportamento atteso per ora, ma è importante documentarlo.

### Security score hardcoded
Nel security scan admin:
```js
const securityScore = 0.9;   // linea 1022 — sempre 0.9
```
> ⚠️ **FINDING #8 — Security scan non fa analisi reale**: imposta sempre `security_score = 0.9`. È un placeholder.

### Trust score formula
```js
const trustScore = Math.min(0.95, (uptime * 0.25 + (1 - latency / 1000) * 0.15 + successRate * 0.25 + popularity * 0.15 + 0.9 * 0.2));
```
Formula parzialmente parametrizzata — il valore `0.9` alla fine è hardcoded (peso reputazione).

### Scheduled handler
- Cron attivo: `0 */6 * * *` e `0 2 * * *`.
- Fa solo `console.log` e conta tool/errori — non scrive in nessuna tabella, non triggera healing automatico.

---

## 7. PERFORMANCE

### Caching
- **L1**: in-memory Map (per request, non persiste tra invocazioni).
- **L2**: KV con TTL 60s per `/v1/tools`.
- **Non cached**: `/v1/search`, `/v1/recommend`, `/v1/route` (query full-table ad ogni richiesta).

> ⚠️ **FINDING #9 — Search e recommend non cachati**: con 114+ tool, la query `SELECT * FROM tools WHERE state = "ACTIVE"` viene eseguita ad ogni request. Sotto carico, potrebbe diventare un bottleneck.

### Search client-side
```js
const tools = await env.DB.prepare('SELECT name, description, category... FROM tools...').all();
const results = (tools.results || []).filter(t => t.name.toLowerCase().includes(q)...);
```
> ⚠️ **FINDING #10 — Full-scan in-memory per search**: carica tutti i tool ACTIVE in memoria e filtra in JS. Funziona con 114 tool, problematico oltre i 10k. Soluzione: FTS5 su D1 o SQLite LIKE con indice.

---

## 8. INFRASTRUTTURA

### DNS / Routing
| Dominio | Punta a | Metodo |
|---------|---------|--------|
| `api.metamesh-uga.dev/*` | `metamesh-gateway-prod` | Zone route (non custom domain Workers) |
| `metamesh-uga.dev` | Cloudflare Pages (landing) | Pages |
| `dashboard.metamesh-uga.dev` | Cloudflare Pages (dashboard) | Pages |

> ℹ️ La route `api.metamesh-uga.dev/*` è una **zone route**, non un "Custom Domain" Workers. Non compare in `/domains` API ma in `/zones/:id/workers/routes`.

### wrangler.toml
- `account_id = ""` — genera warning ad ogni deploy (innocuo ma brutto).
- `[[triggers]]` alla riga 110 causa un warning su wrangler v4 (`Unexpected fields: "0"`).

---

## 9. RIEPILOGO FINDINGS

| # | Severità | Finding | Stato |
|---|----------|---------|-------|
| 1 | INFO | 20+ package non deployati | Open / Roadmap |
| 2 | 🔴 HIGH | `/v1/admin/discovery` senza auth | ✅ FIXATO — `X-Admin-Key` aggiunto |
| 3 | 🟡 MEDIUM | CORS non include `X-Admin-Key` | ✅ FIXATO — header allowlistato |
| 4 | 🟡 MEDIUM | `JWT_SECRET` valore dev in produzione | ✅ FIXATO — rimosso da vars, rimane secret |
| 5 | INFO | Tabelle DB inutilizzate (users, agents, billing) | Open / Roadmap monetizzazione |
| 6 | 🟢 LOW | Variabili `_aeStatus`/`_r2Status` assegnate ma non usate | ✅ FIXATO — rimosse |
| 7 | INFO | Tool execution è placeholder | Open / Atteso |
| 8 | 🟡 MEDIUM | Security scan hardcoded a 0.9 | Open — implementare analisi reale |
| 9 | 🟡 MEDIUM | Search/recommend non cachati | ✅ FIXATO — KV cache TTL 30/60s |
| 10 | 🟡 MEDIUM | Full-scan in-memory per search | ✅ FIXATO — SQL LIKE su D1 |

---

## 10. AZIONI PRIORITARIE

### Immediato (5 min)
```bash
# Fix CORS per admin browser calls
# Fix variabili debug residue
npx wrangler secret put JWT_SECRET --env production --config wrangler.toml
```

### Breve termine
1. Proteggere `/v1/admin/discovery` con `X-Admin-Key`.
2. Aggiungere `X-Admin-Key` agli allow CORS headers.
3. Aggiungere KV cache a `/v1/search` e `/v1/recommend`.

### Medio termine
1. Sostituire full-scan search con query SQL LIKE o FTS5.
2. Collegare tabelle `users`/`agents` a endpoint di registrazione.
3. Implementare middleware JWT per API personali.

---

**Stato complessivo: OPERATIVO AL 100% per use case attuale (registry + MCP proxy). Nessun bug bloccante. 3 fix HIGH/MEDIUM consigliati prima di apertura pubblica.**
