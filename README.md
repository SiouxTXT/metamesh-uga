# MetaMesh-UGA

**The MCP Operating System — A Serverless Control Plane for AI Agents and MCP Infrastructure**

[![MCP Registry](https://img.shields.io/badge/MCP%20Registry-Registered-blue?logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTEyIDJMMTQuNSA5SDIyTDE2IDEzLjI1TDE4LjUgMjFMMTIgMTYuNzVMNS41IDIxTDggMTMuMjVMMiA5SDkuNUwxMiAyWiIgZmlsbD0id2hpdGUiLz48L3N2Zz4&link=https://registry.modelcontextprotocol.io)](https://registry.modelcontextprotocol.io/servers/dev.metamesh-uga/metamesh-uga)
[![Status](https://img.shields.io/badge/Status-Operational-green)](https://api.metamesh-uga.dev/health)
[![MCP OS](https://img.shields.io/badge/MCP%20Operating%20System-Ready-blue)](https://docs.metamesh-uga.dev)

> Set & Forget | Zero Infrastructure | Serverless | Edge Native | MCP Operating System

## Live Status

- **Gateway:** `https://api.metamesh-uga.dev` — operational
- **Dashboard:** `https://dashboard.metamesh-uga.dev`
- **MCP endpoint:** `https://api.metamesh-uga.dev/mcp` (JSON-RPC over HTTP)
- **MCP Registry:** `dev.metamesh-uga/metamesh-uga` v2.0.0 — published & latest
- **Tools indexed:** 13,000+ MCP servers, synced every 6h from the official MCP registry
- **Stripe billing:** LIVE — agents top up a USD balance and are charged per call
- **x402 payments:** implemented; activation gated by wallet config (see `/v1/x402/info`)

MetaMesh-UGA is the MCP Operating System: a serverless, edge-native control plane that discovers, verifies, scores, routes, monitors and scales MCP servers behind a single endpoint.

It combines registry sync, semantic discovery, trust scoring, policy enforcement, security scanning, lifecycle management, smart routing, multi-level caching, reliability patterns, self-healing and real-time analytics to make MCP infrastructure production-ready for AI agents.

Connect in seconds: point any MCP client (Claude, Windsurf, Cursor, Antigravity) at `https://api.metamesh-uga.dev/mcp`, or register an agent for a programmatic API key. Either way you gain access to a curated, trusted, and benchmarked catalog of MCP servers.

## 🚀 Caratteristiche

- **MCP Operating System**: Control Plane + Data Plane per gestire l'intero ecosistema MCP
- **Unified Registry**: Single source of truth con federation, mirroring e snapshot
- **Smart Discovery**: Keyword, semantic search, capability graph e intent-based discovery
- **Trust Engine**: Reputation score basato su uptime, latenza, success rate e security
- **Smart Routing**: Weighted, latency, geographic, cost e health-based routing
- **Reliability Layer**: Circuit breaker, retry, bulkhead, hedging e fallback
- **Multi-level Cache**: In-memory L1 + KV L2, TTL, pattern invalidation
- **Security Fabric**: Dependency scan, CVE detection, policy engine OPA/Rego
- **Self-Healing**: Auto-deprecated, rollback recovery, health-based remediation
- **Analytics**: Usage trends, cost analysis, performance metrics, export OTel/Prometheus
- **Lifecycle Management**: Stati automatici dalla discovery all'archiviazione
- **Serverless**: Zero infrastruttura da gestire (Cloudflare Workers)
- **WASM Runtime**: Esecuzione sicura dei tool MCP compilati in WebAssembly
- **AI Agent Economy**: Supporto nativo per x402 Protocol (micropagamenti USDC)
- **Monetizzazione**: Piani Free, Pro ($19/mese), Enterprise ($499/mese)
- **Set & Forget**: Automazione completa con cron triggers

## 📋 Requisiti

- Node.js 18+
- Go 1.21+ (per CLI)
- Account Cloudflare (free tier sufficiente)
- Account Stripe (per pagamenti)

## 🛠️ Installazione

### 1. Clone e Setup

```bash
git clone https://github.com/metamesh-uga/metamesh-uga.git
cd metamesh-uga
npm install
```

### 2. Configurazione Cloudflare

```bash
# Installa Wrangler
npm install -g wrangler

# Login a Cloudflare
wrangler login

# Crea database D1
wrangler d1 create metamesh-catalog

# Crea KV namespace
wrangler kv:namespace create "CACHE"

# Crea R2 bucket
wrangler r2 bucket create metamesh-wasm
```

### 3. Configura Secrets

```bash
# Stripe
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET

# JWT
wrangler secret put JWT_SECRET

# Alerting (opzionale)
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TELEGRAM_CHAT_ID

# Admin
wrangler secret put ADMIN_KEY
```

### 4. Database Migration

```bash
wrangler d1 execute metamesh-catalog --file=./shared/migrations/001_init.sql
```

### 5. Deploy

```bash
# Deploy Workers
npm run deploy:workers

# Deploy Dashboard
cd packages/dashboard
npm install
npm run deploy
```

### 6. Installa CLI

```bash
cd cli
go build -o metamesh

# Installa globalmente
mv metamesh /usr/local/bin/

# O usa direttamente
./metamesh connect
```

## 🎯 Uso

### CLI Tool

```bash
# Connetti al gateway (salva la config locale)
metamesh connect

# Chiama un tool (raggiunge POST /v1/call)
metamesh call example.echo --message "hello"

# Lista tool disponibili
metamesh list --category demo

# Visualizza utilizzo
metamesh usage
```

### API REST

```bash
# List tools (paginated, public)
curl "https://api.metamesh-uga.dev/v1/tools?limit=20&sort=popularity"

# Full-text search
curl "https://api.metamesh-uga.dev/v1/search?q=github"

# Execute a tool
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"tool": "example.echo", "params": {"message": "hello"}}' \
  https://api.metamesh-uga.dev/v1/call
```

### MCP Protocol

Add to Devin / Cursor / Windsurf / Claude Desktop:

```json
{
  "mcpServers": {
    "metamesh-uga": {
      "url": "https://api.metamesh-uga.dev/mcp",
      "transport": "http"
    }
  }
}
```

Or test directly via JSON-RPC:

```bash
curl -X POST https://api.metamesh-uga.dev/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

## 🤖 AI Agent Economy

Two complementary, production-ready payment models:

### Model A — Stripe prepaid credit (recommended)

Agents top up a USD balance once via **Stripe Checkout**, then per-call pricing is debited automatically from the balance. No per-call fees, no crypto required.

```bash
# 1. Register an agent (returns agent_id + api_key, shown once)
curl -X POST https://api.metamesh-uga.dev/v1/agent/register \
  -H "Content-Type: application/json" -d '{"name":"My Agent"}'

# 2. Top up via Stripe (returns a Checkout URL)
curl -X POST https://api.metamesh-uga.dev/v1/agent/topup \
  -H "X-Agent-Id: agent_xxx" -H "X-Agent-Key: ak_xxx" \
  -H "Content-Type: application/json" -d '{"amount_usd": 10}'

# 3. Call tools — balance is debited per call
curl -X POST https://api.metamesh-uga.dev/v1/call \
  -H "X-Agent-Id: agent_xxx" -H "X-Agent-Key: ak_xxx" \
  -H "Content-Type: application/json" \
  -d '{"tool":"example.echo","params":{"message":"hi"}}'

# 4. Check balance / history
curl https://api.metamesh-uga.dev/v1/agent/wallet -H "X-Agent-Id: agent_xxx" -H "X-Agent-Key: ak_xxx"
curl https://api.metamesh-uga.dev/v1/billing/info
```

**Operator activation:**

```bash
wrangler secret put STRIPE_SECRET_KEY --env production       # sk_live_... or sk_test_...
wrangler secret put STRIPE_WEBHOOK_SECRET --env production   # whsec_... (Stripe webhook signing secret)
# Point a Stripe webhook to: https://api.metamesh-uga.dev/v1/stripe/webhook (event: checkout.session.completed)
# Optionally set BILLING_ENABLED="true" in wrangler.toml to require payment for ALL callers.
```

When Stripe is unset, anonymous calls stay free and `/v1/agent/topup` returns a clear 503.

> **Current production state:** Stripe (live keys) and the `checkout.session.completed` webhook are configured, and `BILLING_ENABLED="true"`. Enforcement applies to the REST `POST /v1/call` endpoint — every caller is charged per request, so top up via `/v1/agent/topup` first. The public MCP endpoint (`POST /mcp`) stays free for discovery (`tools/list`) and native `metamesh.*` tools, so MCP clients keep working without an account.

### Model B — x402 crypto (USDC on Base)

The [x402 protocol](https://www.x402.org): agents pay per call in USDC on-chain. Send an `X-PAYMENT` header; on HTTP 402 read the `accepts` requirements.

```bash
curl https://api.metamesh-uga.dev/v1/x402/info
```

### Payment flow

1. Call a paid resource (`POST /v1/call`). When enforcement is active and no payment is attached, the gateway responds **HTTP 402** with a standard `accepts` requirements body (scheme `exact`, network `base`, asset USDC, `payTo`, `maxAmountRequired`).
2. The agent constructs a signed payment and retries with an `X-PAYMENT` header (base64 JSON).
3. The gateway verifies + settles via the configured facilitator, then returns the result plus an `X-PAYMENT-RESPONSE` header with the on-chain tx.

### Activation (operator)

x402 is implemented but disabled until you set a receiving wallet:

```bash
# In wrangler.toml [env.production.vars]
X402_ENABLED = "true"
X402_PAY_TO  = "0xYourBaseWallet"
# X402_FACILITATOR_URL and USDC_CONTRACT have working defaults
```

Per-tool pricing lives in the `tool_pricing` table (default $0.001/call, bulk $0.0005).

## 📊 Architettura

MetaMesh-UGA adotta un'architettura a due piani ispirata ai service mesh moderni.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      META MESH-UGA — MCP OPERATING SYSTEM                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     CONTROL PLANE                                   │   │
│  │                                                                     │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │   │
│  │  │ Registry │ │ Discovery│ │  Trust   │ │  Policy  │ │ Lifecycle│ │   │
│  │  │  Engine  │ │  Engine  │ │  Engine  │ │  Engine  │ │  Manager │ │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐             │   │
│  │  │ Security │ │Benchmark │ │Analytics │ │  Config  │             │   │
│  │  │  Scanner │ │  Engine  │ │  Engine  │ │  Engine  │             │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                       DATA PLANE                                    │   │
│  │                                                                     │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │   │
│  │  │  Routing │ │   Cache  │ │  Health  │ │  Proxy   │ │  Rate    │ │   │
│  │  │  Engine  │ │  Engine  │ │  Engine  │ │  Engine  │ │ Limiting │ │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         MCP ECOSYSTEM                               │   │
│  │  (Server MCP A, B, C, D, E...)                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

- **Control Plane**: decisioni, configurazione, orchestrazione, analytics.
- **Data Plane**: esecuzione delle richieste, routing, caching, health in tempo reale.

Per maggiori dettagli: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## 💰 Piani di Pagamento

| Piano | Prezzo | Feature |
|-------|--------|---------|
| **Free** | €0 | 1.000 chiamate/mese, 100 req/min |
| **Pro** | $19/mese | Chiamate illimitate, 1.000 req/min |
| **Enterprise** | $499/mese | Dedicated VPC, 10.000 req/min, SLA 99.9% |

## 📁 Struttura Repository

```
metamesh-uga/
├── packages/
│   ├── gateway/            # Data Plane: API Gateway, Routing, Cache, Proxy, Reliability
│   ├── discovery/          # Control Plane: Discovery Engine
│   ├── registry/           # Control Plane: Registry Engine (federation, mirroring, snapshot)
│   ├── trust/              # Control Plane: Trust Engine
│   ├── security/           # Control Plane: Security Scanner
│   ├── policy/             # Control Plane: Policy Engine
│   ├── benchmark/          # Control Plane: Benchmark Engine
│   ├── lifecycle/          # Control Plane: Lifecycle Manager
│   ├── recommendation/     # Control Plane: Recommendation Engine
│   ├── cost/               # Control Plane/Data Plane: Cost Optimizer
│   ├── compatibility/      # Control Plane: Compatibility Engine
│   ├── intelligence/       # Control Plane: AI Intelligence Layer
│   ├── analytics/          # Control Plane: Analytics Engine
│   ├── health/             # Data Plane: Health Engine
│   ├── config/             # Control Plane: Config Engine
│   ├── cache/              # Data Plane: Advanced Cache Engine
│   ├── self-healing/       # Data Plane: Self-Healing Engine
│   ├── aggregator/         # Motore di aggregazione
│   ├── inserter/           # Motore di inserimento
│   ├── updater/            # Motore di aggiornamento
│   ├── eliminatore/        # Motore di eliminazione
│   ├── alerts/             # Alerting Worker
│   ├── agent-billing/      # Billing per AI Agent
│   ├── dashboard/            # Cloudflare Pages (React)
│   └── landing/            # Landing page
├── cli/                    # CLI Tool (Go)
├── shared/                 # Librerie condivise
│   ├── src/
│   │   ├── auth.js         # Autenticazione
│   │   ├── ratelimit.js    # Rate limiting
│   │   ├── wasm-runtime.js # WASM execution
│   │   └── x402.js         # x402 Protocol
│   └── migrations/         # Database migrations
├── docs/                   # Documentazione
└── wrangler.toml           # Configurazione Cloudflare
```

## 🔧 Configurazione Environment

```bash
# .env
CLOUDFLARE_API_TOKEN=xxx
CLOUDFLARE_ACCOUNT_ID=xxx
D1_DATABASE_ID=xxx
JWT_SECRET=xxx
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
TELEGRAM_BOT_TOKEN=xxx
TELEGRAM_CHAT_ID=xxx
```

## 🧪 Testing

```bash
# Test locale
wrangler dev --config packages/gateway/wrangler.toml

# Test API
curl http://localhost:8787/health
```

## 📝 Licenza

MIT License - vedi [LICENSE](LICENSE)

## 👤 Autore

Davanzo Keoma - [GitHub](https://github.com/davanzo)

---

**Il "set & forget" è realtà. 🚀**
