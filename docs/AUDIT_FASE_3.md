# Audit — Fase 3: Intelligenza e Routing

> Data: 2026-06-25
> Stato: **COMPLETATA**

---

## 1. Obiettivo della Fase 3

Aggiungere l'intelligence layer (capability graph, intent search, recommendation) e il data plane avanzato (smart routing, reliability, cost optimization).

---

## 2. Componenti implementate

### 2.1 Capability Graph e Intent Search

| File | Contenuto |
|------|-----------|
| `packages/discovery/src/capability-graph.js` | Classe `CapabilityGraph` con gerarchia capability, keyword extraction, espansione parent/child |
| `packages/discovery/src/intent.js` | Classe `IntentSearch` con classificazione intent e ricerca tool per intento |
| `packages/discovery/src/index.js` | Endpoint `/v1/intent`, `/v1/graph`, `/v1/capabilities/:capability` |

### 2.2 Recommendation Engine

| File | Contenuto |
|------|-----------|
| `packages/recommendation/src/recommendation.js` | Classe `RecommendationEngine` che combina semantic search, intent search, trust, security, popularity |
| `packages/recommendation/src/index.js` | Endpoint `/v1/recommend`, `/v1/similar/:tool` |
| `packages/recommendation/wrangler.toml` | Configurazione worker con D1 |

### 2.3 Smart Routing Engine

| File | Contenuto |
|------|-----------|
| `packages/gateway/src/routing.js` | Classe `RoutingEngine` con strategie: weighted, latency, cost, health, geographic |
| `packages/gateway/src/index.js` | Endpoint `/v1/route` per testing del routing |

### 2.4 Reliability Layer

| File | Contenuto |
|------|-----------|
| `packages/gateway/src/reliability.js` | Classi `CircuitBreaker`, `RetryPolicy`, `Timeout`, `Bulkhead`, `ReliabilityLayer` |
| `packages/gateway/src/index.js` | `/v1/call` esegue i tool tramite `ReliabilityLayer` (retry, circuit breaker, timeout, bulkhead) |

### 2.5 Cost Optimizer

| File | Contenuto |
|------|-----------|
| `packages/cost/src/optimizer.js` | Classe `CostOptimizer` con stima costi, ottimizzazione per costo, budget check |
| `packages/cost/src/index.js` | Endpoint `/v1/estimate`, `/v1/optimize`, `/v1/budget/:user_id` |
| `packages/cost/wrangler.toml` | Configurazione worker con D1 |

### 2.6 Deploy e orchestrazione

| File | Modifica |
|------|----------|
| `package.json` | `deploy:workers` include `packages/recommendation` e `packages/cost` |

---

## 3. Nuovi endpoint API

| Metodo | Endpoint | Package | Descrizione |
|--------|----------|---------|-------------|
| GET | `/v1/intent?q=...` | Discovery | Ricerca per intento naturale |
| GET | `/v1/graph` | Discovery | Capability graph completo |
| GET | `/v1/capabilities/:capability` | Discovery | Tool per una capability |
| GET | `/v1/recommend?q=...` | Recommendation | Raccomandazione tool con alternative e spiegazioni |
| GET | `/v1/similar/:tool` | Recommendation | Tool simili |
| GET | `/v1/route?strategy=...` | Gateway | Smart routing test |
| GET | `/v1/estimate?tool=...` | Cost | Stima costo chiamate |
| GET | `/v1/optimize?category=...` | Cost | Ottimizzazione per costo |
| GET | `/v1/budget/:user_id` | Cost | Verifica budget |

---

## 4. Endpoint gateway aggiornati

| Endpoint | Modifica |
|----------|----------|
| `/v1/call` | Esecuzione avvolta da ReliabilityLayer (retry, circuit breaker, timeout, bulkhead) |
| `/v1/route` | Nuovo endpoint per smart routing |

---

## 5. Capability hierarchy esempio

```
Database → SQL → PostgreSQL, MySQL, SQLite
        → NoSQL → MongoDB, Redis
        → VectorDB → Pinecone, Qdrant, Chroma, Weaviate
AI → LLM → OpenAI, Claude, Gemini
   → Embedding
   → ImageGeneration
   → OCR
Search → WebSearch, DocumentSearch, VectorSearch
Communication → Email, Chat
```

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
# Capability graph
curl https://api.metamesh-uga.dev/v1/graph

# Intent search
curl "https://api.metamesh-uga.dev/v1/intent?q=send+an+email"

# Raccomandazione
curl "https://api.metamesh-uga.dev/v1/recommend?q=query+a+postgres+database"

# Smart routing
curl "https://api.metamesh-uga.dev/v1/route?category=data&strategy=cost"
curl "https://api.metamesh-uga.dev/v1/route?tool=example.echo&strategy=health"

# Cost estimate
curl "https://api.metamesh-uga.dev/v1/estimate?tool=example.echo&calls=100"
curl "https://api.metamesh-uga.dev/v1/optimize?category=ai"
```

---

## 7. Note e limiti noti

- **Capability Graph**: gerarchia hardcoded in `capability-graph.js`. In futuro può essere migrata su Neo4j o grafo D1/KV.
- **Intent Search**: classificazione basata su keyword matching. In futuro può essere potenziata con un modello di classificazione.
- **Recommendation**: utilizza semantic embedding semplice (Phase 1). La qualità migliora con embedding avanzati.
- **Smart Routing**: supporta selezione single-tool per strategia. Multi-instance e load balancing verranno in Fase 5.
- **Reliability**: circuit breaker in-memory. Per ambienti multi-worker serve KV condiviso.
- **Cost Optimizer**: usa i prezzi da `tool_pricing`. Il budget check usa la tabella `transactions`.

---

## 8. Prossima fase

**Fase 4 — Lifecycle, AI Intelligence e Compatibility**

- Lifecycle Manager completo
- AI Intelligence Layer
- Compatibility Engine
- Real-time Analytics
- Registry Mirroring

---

*Audit generato automaticamente al termine della Fase 3 — 2026-06-25*
