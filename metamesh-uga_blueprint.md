# 🚀 MetaMesh-UGA - Blueprint Omnicomprensivo

## Universal Gateway Adapter for meta MCP API

> **Set & Forget | Zero Infrastructure | Serverless | Edge Native**

---

# 📋 INDICE

1. [Visione e Architettura Generale](#1-visione-e-architettura-generale)
2. [Stack Tecnologico](#2-stack-tecnologico)
3. [Architettura dei Livelli](#3-architettura-dei-livelli)
4. [Motori di Gestione](#4-motori-di-gestione)
5. [Esecuzione e Runtime WASM](#5-esecuzione-e-runtime-wasm)
6. [Database e Storage](#6-database-e-storage)
7. [API e Protocolli](#7-api-e-protocolli)
8. [Sicurezza e Autenticazione](#8-sicurezza-e-autenticazione)
9. [Monitoraggio e Analytics](#9-monitoraggio-e-analytics)
10. [Marketplace e Monetizzazione](#10-marketplace-e-monetizzazione)
11. [AI Agent Economy Integration](#11-ai-agent-economy-integration)
12. [Deploy e CI/CD](#12-deploy-e-cicd)
13. [Struttura dei File](#13-struttura-dei-file)
14. [Roadmap e Versioni](#14-roadmap-e-versioni)
15. [Set & Forget: Automazione Completa](#15-set--forget-automazione-completa)
16. [Appendici](#16-appendici)

---

## 1. Visione e Architettura Generale

### 1.1 Missione
Fornire un **comando unico** (`metamesh connect`) che dia accesso immediato a **tutti gli MCP server esistenti**, senza configurazione, senza installazioni manuali, senza gestione delle dipendenze.

### 1.2 Filosofia Progettuale
- **Serverless**: Zero infrastruttura da gestire
- **Stateless**: Ogni richiesta è indipendente
- **Open Source**: Core libero, servizi a pagamento
- **Costo Zero**: Sfruttare al massimo i free tier
- **Edge Native**: Esecuzione su Cloudflare Workers (300+ data center)

### 1.3 Architettura Generale

```
┌────────────────────────────────────────────────────────────────────┐
│                      CLIENT (utente finale)                      │
│  ┌─────────────────┐          ┌─────────────────┐               │
│  │   CLI Tool      │          │   AI Assistant  │               │
│  │  metamesh connect│          │  (Claude/Cline) │               │
│  └────────┬────────┘          └────────┬────────┘               │
│           │                            │                         │
│           └──────────┬─────────────────┘                         │
└──────────────────────┼──────────────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────────────────┐
│                     CLOUDFLARE WORKERS                           │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              LIVELLO 1 - ESPOSTO (Public)                  │ │
│  │  - REST API Endpoint (/v1/call)                           │ │
│  │  - MCP Server Interface (JSON-RPC su SSE)                 │ │
│  │  - Rate Limiting (100 req/min free, 1000 pro)            │ │
│  │  - Autenticazione (API Key / JWT)                        │ │
│  └──────────────────────────┬──────────────────────────────────┘ │
│                             │                                    │
│                             ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │             NUCLEO DEL GATEWAY (Routing)                   │ │
│  │  - Service Discovery (L1 → L4/L5 diretto)                 │ │
│  │  - Cache Management (KV per tool popolari)                │ │
│  │  - WASM Runtime (wazero su Worker)                        │ │
│  │  - Fallback e Retry Logic                                 │ │
│  └──────────────────────────┬──────────────────────────────────┘ │
│                             │                                    │
│              ┌──────────────┼──────────────┐                    │
│              ▼              ▼              ▼                    │
│  ┌─────────────────┐ ┌───────────────┐ ┌──────────────────┐    │
│  │  LIVELLO 4      │ │  LIVELLO 4    │ │  LIVELLO 4      │    │
│  │  Categoria A    │ │  Categoria B  │ │  Categoria C    │    │
│  └─────────────────┘ └───────────────┘ └──────────────────┘    │
│              │              │              │                    │
│              └──────────────┼──────────────┘                    │
│                             ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              LIVELLO 5 - MCP Server Individuali            │ │
│  │  - WASM modules su R2                                     │ │
│  │  - Esecuzione su richiesta                                │ │
│  └─────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────────────────┐
│                    LIVELLI NON ESPOSTI (Interni)                 │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  MOTORI DI GESTIONE (Cron Triggers)                        │ │
│  │  - Discovery: Registry MCP ogni 6h                         │ │
│  │  - Inserimento: Compilazione WASM                          │ │
│  │  - Aggiornamento: Version tracking                         │ │
│  │  - Eliminazione: Deprecated cleanup                        │ │
│  └──────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────────────────┐
│                      DATABASE E STORAGE                          │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │  D1 (SQL)    │  │  R2 (Object) │  │  Analytics Engine      │ │
│  │  - Catalog   │  │  - WASM      │  │  - Metrics             │ │
│  │  - Users     │  │  - Logs      │  │  - Errors              │ │
│  │  - Configs   │  │              │  │                        │ │
│  └──────────────┘  └──────────────┘  └────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

---

## 2. Stack Tecnologico

### 2.1 Cloudflare Services

| Servizio | Utilizzo | Free Tier |
|----------|----------|-----------|
| **Workers** | Gateway, Routing, WASM Runtime | 100k richieste/giorno |
| **Pages** | Dashboard frontend | Illimitato |
| **D1** | Catalogo MCP, Utenti, Configs | 500 MB DB, 5M letture/giorno |
| **R2** | Storage WASM, Logs | 10 GB storage, 1M scritture/mese |
| **KV** | Cache WASM popolari, Configs | 1k scritture/giorno |
| **Analytics Engine** | Metriche di utilizzo | 10M datapoint/mese |

### 2.2 Linguaggi e Runtime

| Componente | Linguaggio | Motivazione |
|------------|------------|-------------|
| **Workers** | JavaScript/TypeScript | Native su Cloudflare, supporto WASM integrato |
| **Runtime WASM** | Go (wazero) | Puro Go, zero CGO, integrato nel Worker |
| **Dashboard** | React + TypeScript | Sviluppo rapido, deploy su Pages |
| **CLI** | Go | Cross-platform, binary unico |

### 2.3 Librerie e Dipendenze

```json
{
  "dependencies": {
    "wazero": "1.8.0",
    "itty-router": "5.0.0",
    "jsonwebtoken": "9.0.0",
    "dayjs": "1.11.0",
    "viem": "2.0.0"
  }
}
```

### 2.4 Strumenti di Sviluppo

| Strumento | Utilizzo |
|-----------|----------|
| **Wrangler** | Deploy e gestione Cloudflare |
| **GitHub Actions** | CI/CD |
| **ESLint + Prettier** | Code quality |
| **Vitest** | Unit testing |

---

## 3. Architettura dei Livelli

### 3.1 Livello 1 - Esposto (Public Gateway)

#### 3.1.1 Worker: `metamesh-gateway`

**Endpoint**:
```yaml
REST:
  - POST /v1/call              # Chiamata tool MCP
  - GET  /v1/tools             # Lista tool disponibili
  - GET  /v1/tools/:name       # Dettaglio tool
  - POST /v1/auth/login        # Genera JWT
  - GET  /v1/usage             # Statistiche utente (pro)
  - POST /v1/agent/pay         # x402 Payment endpoint
  - GET  /v1/agent/marketplace # Marketplace per AI Agent

MCP:
  - JSON-RPC su SSE            # Per AI Assistant
  - /sse                       # EventSource endpoint
  - /message                   # JSON-RPC endpoint
```

**Rate Limiting**:
- Free: 100 richieste/minuto
- Pro: 1.000 richieste/minuto
- Enterprise: 10.000 richieste/minuto

**Routing Logic**:
```javascript
async function routeRequest(toolName, params) {
  // Step 1: Check cache (KV)
  const cached = await KV.get(`tool:${toolName}`);
  if (cached) return executeWASM(cached, params);
  
  // Step 2: Query D1 per categoria
  const tool = await D1.prepare(
    "SELECT * FROM tools WHERE name = ?"
  ).bind(toolName).first();
  
  // Step 3: Direct L1 → L5 (bypass aggregatori)
  const wasm = await R2.get(`wasm/${toolName}.wasm`);
  return executeWASM(wasm, params);
}
```

#### 3.1.2 Autenticazione

**Modalità Supportate**:
1. **API Key**: Header `X-API-Key: sk_...`
2. **JWT**: Header `Authorization: Bearer <jwt>`
3. **OAuth 2.0**: (Enterprise)
4. **x402 Payment**: Per AI Agent autonomi

**Flusso JWT**:
```javascript
async function generateJWT(userId, plan) {
  return jwt.sign(
    { sub: userId, plan, exp: Math.floor(Date.now() / 1000) + 3600 },
    SECRET_KEY,
    { algorithm: 'HS256' }
  );
}
```

### 3.2 Livello 2 - Motore di Ricerca (Non Esposto)

**Worker**: `metamesh-discovery`

**Funzione**:
- Cron trigger ogni 6 ore
- Interroga Registry MCP ufficiale
- Aggiorna catalogo su D1

### 3.3 Livello 3 - Aggregatore di Aggregatori (Non Esposto)

**Worker**: `metamesh-aggregator`

**Funzione**:
- Coordina le richieste tra categorie
- Gestisce fallback se un aggregatore di categoria fallisce
- Mantiene il routing table L1 → L4/L5

### 3.4 Livello 4 - Aggregatori di Categoria (Non Esposti)

**Worker per categoria**: `metamesh-category-{a,b,c}`

**Categorie Iniziali**:
| Categoria | Worker | Esempi MCP |
|-----------|--------|------------|
| Communication | `cat-comm` | Gmail, Slack, Telegram |
| Development | `cat-dev` | GitHub, GitLab, Jira |
| Data | `cat-data` | PostgreSQL, Snowflake, BigQuery |
| AI/ML | `cat-ai` | OpenAI, Anthropic, Gemini |
| Productivity | `cat-prod` | Notion, Asana, Trello |
| Infrastructure | `cat-infra` | AWS, GCP, Azure, Kubernetes |
| Finance | `cat-fin` | Stripe, Plaid, Coinbase |

### 3.5 Livello 5 - Repository MCP (Non Esposto)

**Storage**: Cloudflare R2 - Bucket `mcp-wasm`

**Struttura**:
```
mcp-wasm/
├── communication/
│   ├── gmail_v1.1.wasm
│   ├── gmail_v1.2.wasm
│   └── slack_v2.0.wasm
├── development/
│   ├── github_v3.0.wasm
│   └── gitlab_v1.5.wasm
└── ...
```

**Cache Strategy**:
- **L1**: KV (WASM popolari, TTL 24h)
- **L2**: Worker internal cache (WASM usati nella sessione)
- **L3**: R2 (persistente)

---

## 4. Motori di Gestione

### 4.1 Motore di Inserimento

**Worker**: `metamesh-inserter`

**Trigger**: Ogni 6 ore

**Pipeline**:
1. **Scoperta**: Legge nuovo MCP da Registry
2. **Download**: Scarica sorgente (GitHub, npm, PyPI)
3. **Compilazione**: Compila in WASM (Python→Pyodide, JS→wasm-pack, Rust→wasm-pack, Go→TinyGo)
4. **Test**: Esegue test di compatibilità
5. **Storage**: Carica su R2
6. **Indexing**: Aggiorna D1 e routing table

### 4.2 Motore di Aggiornamento

**Worker**: `metamesh-updater`

**Trigger**: Ogni 12 ore

**Logica**:
1. Query Registry per versioni aggiornate
2. Confronta con D1
3. Se nuova versione → compila in WASM
4. Carica su R2 con versione (es. `gmail_v1.2.wasm`)
5. Mantiene versione precedente per 30 giorni (fallback)
6. Aggiorna D1 con nuova versione

### 4.3 Motore di Eliminazione

**Worker**: `metamesh-eliminatore`

**Trigger**: Ogni 24 ore

**Criteri di Eliminazione**:
1. **Deprecato da > 90 giorni**: Flag `deprecated = TRUE`
2. **Nessun utilizzo da > 180 giorni**: Flag `inactive = TRUE`
3. **Versione obsoleta**: Rimosse dopo 30 giorni

---

## 5. Esecuzione e Runtime WASM

### 5.1 Runtime WASM su Cloudflare Worker

**Strumento**: `wazero` (Go) compilato in WASM e integrato nel Worker

**Limitazioni**:
- Memoria: 128 MB per istanza
- CPU Time: 50 ms per esecuzione (hard limit)
- File System: Virtuale, non persistente
- Networking: Limitato (solo HTTP/HTTPS)

**Implementazione**:
```javascript
import { Wazero } from 'wazero';

export default {
  async fetch(request, env) {
    const { toolName, params } = await request.json();
    
    // Carica WASM da R2
    const wasmBuffer = await env.R2.get(`wasm/${toolName}.wasm`);
    
    // Istanzia runtime
    const runtime = new Wazero();
    const instance = await runtime.instantiate(wasmBuffer);
    
    // Esegui con timeout
    const result = await Promise.race([
      instance.exports.callTool(params),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout 5s')), 5000)
      )
    ]);
    
    return new Response(JSON.stringify(result));
  }
};
```

### 5.2 Cold Start Mitigation

**Strategie**:
1. **Pre-warming**: Cron trigger che ogni 6 ore esegue i top 100 tool
2. **Cache L2**: `caches.default` per WASM dopo primo download
3. **Progress Indicator**: Messaggio *"Primo caricamento del tool, attendi..."*

### 5.3 Gestione degli Errori

**Categorie di Errore**:
1. **Tool non trovato**: 404
2. **Timeout**: 408
3. **Parametri invalidi**: 400
4. **MCP a valle fallisce**: 502
5. **Rate limit superato**: 429

---

## 6. Database e Storage

### 6.1 Cloudflare D1 - Schema Database

#### Tabella `users`
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  api_key TEXT UNIQUE NOT NULL,
  plan TEXT DEFAULT 'free',  -- free | pro | enterprise
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Tabella `tools`
```sql
CREATE TABLE tools (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  version TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  schema JSON,
  source_url TEXT,
  popularity_score INTEGER DEFAULT 0,
  deprecated BOOLEAN DEFAULT FALSE,
  deprecated_since TIMESTAMP,
  compiled_at TIMESTAMP,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Tabella `routing`
```sql
CREATE TABLE routing (
  tool_name TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  worker_url TEXT,
  latency_ms INTEGER DEFAULT 0,
  last_used TIMESTAMP
);
```

#### Tabella `configs`
```sql
CREATE TABLE configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  tool_name TEXT NOT NULL,
  config_json TEXT NOT NULL,  -- Cifrato
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

#### Tabella `usage_log`
```sql
CREATE TABLE usage_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  tool_name TEXT NOT NULL,
  status TEXT,  -- success | error
  latency_ms INTEGER,
  called_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 6.2 Cloudflare R2 - Storage

#### Bucket: `mcp-wasm`
```yaml
Struttura:
  /wasm/
    /{category}/
      {tool_name}_{version}.wasm
  /logs/
    /{YYYY-MM-DD}/
      access.log
      errors.log
```

### 6.3 Cloudflare KV - Cache

#### Namespace: `wasm-cache`
```yaml
TTL: 24 ore
Max keys: 10.000
Cosa contiene: WASM moduli più popolari
```

---

## 7. API e Protocolli

### 7.1 REST API

#### `POST /v1/call`
**Richiesta**:
```json
{
  "tool": "gmail_send_email",
  "params": {
    "to": "user@example.com",
    "subject": "Ciao",
    "body": "Test"
  }
}
```

**Risposta**:
```json
{
  "id": "req_123456",
  "tool": "gmail_send_email",
  "result": {
    "messageId": "msg_789",
    "status": "sent"
  },
  "latency_ms": 234,
  "timestamp": "2026-06-16T12:00:00Z"
}
```

#### `GET /v1/tools`
**Risposta**:
```json
{
  "tools": [
    {
      "name": "gmail_send_email",
      "category": "communication",
      "version": "1.2.0",
      "description": "Invia email tramite Gmail"
    }
  ],
  "total": 4823,
  "page": 1
}
```

#### `GET /v1/usage` (Pro/Enterprise)
**Risposta**:
```json
{
  "current_period": {
    "requests": 1250,
    "limit": 10000,
    "remaining": 8750
  },
  "top_tools": [
    { "tool": "gmail_send_email", "count": 450 },
    { "tool": "github_create_issue", "count": 230 }
  ],
  "latency_p95": 187,
  "error_rate": 0.02
}
```

### 7.2 MCP Protocol (JSON-RPC 2.0)

**SSE Endpoint**: `GET /sse`
**Message Endpoint**: `POST /message`

**Esempio**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "gmail_send_email",
    "arguments": {
      "to": "user@example.com",
      "subject": "Ciao"
    }
  }
}
```

### 7.3 CLI Tool

**Installazione**:
```bash
curl -s https://metamesh-uga.dev/install | bash
```

**Comandi**:
```bash
# Connetti al gateway
metamesh connect

# Chiama un tool
metamesh call gmail_send_email --to user@example.com --subject Ciao

# Lista tool disponibili
metamesh list --category communication

# Visualizza utilizzo
metamesh usage

# Configurazione
metamesh config set plan pro
```

---

## 8. Sicurezza e Autenticazione

### 8.1 Gestione delle Chiavi API

**Generazione**:
```javascript
function generateAPIKey() {
  return `sk_${crypto.randomUUID().replace(/-/g, '')}`;
}
```

**Validazione**:
```javascript
async function validateAPIKey(apiKey) {
  const user = await D1.prepare(
    "SELECT * FROM users WHERE api_key = ?"
  ).bind(apiKey).first();
  
  if (!user) throw new Error('Invalid API key');
  if (user.plan === 'free' && user.usage_count > 1000) {
    throw new Error('Monthly limit exceeded');
  }
  
  return user;
}
```

### 8.2 Cifratura delle Configurazioni

**Algoritmo**: AES-256-GCM

### 8.3 Rate Limiting

**Implementazione**:
```javascript
async function checkRateLimit(userId, plan) {
  const limit = plan === 'free' ? 100 : plan === 'pro' ? 1000 : 10000;
  const key = `ratelimit:${userId}`;
  
  const current = await KV.get(key);
  const count = current ? parseInt(current) : 0;
  
  if (count >= limit) {
    throw new Error(`Rate limit exceeded (${limit}/min)`);
  }
  
  await KV.put(key, count + 1, { expirationTtl: 60 });
}
```

### 8.4 GDPR e Privacy

**Diritti Utente**:
- **Accesso**: GET /v1/user/data
- **Cancellazione**: DELETE /v1/user/data
- **Portabilità**: GET /v1/user/export

---

## 9. Monitoraggio e Analytics

### 9.1 Workers Analytics Engine

**Dataset**: `metamesh_usage`

**Schema**:
```yaml
blobs:
  - user_id: string
  - tool_name: string
  - status: string  # success | error
  
doubles:
  - latency_ms: number
  - request_count: number

indexes:
  - user_id
  - tool_name
  - status
```

**Scrittura**:
```javascript
env.ANALYTICS.writeDataPoint({
  blobs: [userId, toolName, status],
  doubles: [latency, 1],
  indexes: [userId, toolName, status]
});
```

### 9.2 Dashboard Dev (Cloudflare Pages)

**URL**: `https://dashboard.metamesh-uga.dev`

**Funzionalità**:
- Request trend (line chart)
- Top tools (bar chart)
- Latency distribution (histogram)
- Error rate (gauge)
- User growth
- Plan distribution

**Tecnologie**:
- React + TypeScript
- Chart.js per grafici
- Tailwind CSS per styling
- Pages Functions per API

### 9.3 Alerting

**Worker**: `metamesh-alerts`

**Trigger**: Ogni 10 minuti

**Condizioni**:
- Error rate > 5% ultimi 10 minuti
- Latenza media > 500ms
- Rate limit superato > 100 volte

**Canali**:
- Telegram (gratuito)
- Email (via Cloudflare Email Routing)
- Discord (webhook)

---

## 10. Marketplace e Monetizzazione

### 10.1 Piani di Pagamento

| Piano | Prezzo | Feature |
|-------|--------|---------|
| **Free** | €0 | 1.000 chiamate/mese, Dashboard base, API rate limit 100/min |
| **Pro** | $19/mese | Chiamate illimitate, Dashboard avanzata, Export CSV, Supporto prioritario |
| **Enterprise** | $499/mese | Dedicated WASM runner (VPC), SLA 99.9%, Custom categories, Report personalizzati |

### 10.2 Canali di Distribuzione

| Marketplace | Commissione | Tempo Setup |
|-------------|-------------|-------------|
| **AWS Marketplace** | 3% | 2-4 settimane |
| **GitHub Marketplace** | 5-10% | 1-2 settimane |
| **MCP Marketplace** | 15% | 1 settimana |
| **Direct (Stripe)** | 2.9% + $0.30 | 1 giorno |

### 10.3 Stripe Integration

**Codice Webhook**:
```javascript
export async function handleStripeWebhook(request, env) {
  const sig = request.headers.get('stripe-signature');
  const event = stripe.webhooks.constructEvent(
    await request.text(),
    sig,
    env.STRIPE_WEBHOOK_SECRET
  );

  switch (event.type) {
    case 'checkout.session.completed':
      await activateSubscription(event.data.object);
      break;
    case 'customer.subscription.updated':
      await updateUserPlan(event.data.object);
      break;
    case 'customer.subscription.deleted':
      await downgradeToFree(event.data.object);
      break;
  }
}
```

---

## 11. AI Agent Economy Integration

### 11.1 Visione Strategica

MetaMesh-UGA è il **primo supermercato per AI agenti**—un marketplace dove milioni di agenti autonomi possono scoprire, pagare ed eseguire qualunque MCP tool esistente, con micropagamenti automatici e billing trasparente.

**Metrica Impatto**:

| Metrica | Oggi (umani) | Con AI Agent (2026-2027) | Impatto |
|---------|--------------|--------------------------|---------|
| **Volume chiamate** | 1.000/mese/utente | 10.000-50.000/mese/agente | **10-50x** |
| **Prezzo per chiamata** | $0 (abbonamento) | $0.001-$0.05 (x402) | **+100% revenue** |
| **TAM** | $10.3B (mercato MCP) | $600M+ (solo x402) | **+5.8% CAGR** |

### 11.2 x402 Protocol (HTTP 402)

**Flusso di Pagamento**:
```
┌─────────────────────────────────────────────────────────────────────────┐
│                           AI AGENT                                     │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ 1. Discovery: GET /v1/agent/marketplace                         │ │
│  │    → Lista tool con prezzi (price_per_call, currency, chain)    │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                    │                                   │
│                                    ▼                                   │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ 2. Payment Request: POST /v1/agent/pay/quote                    │ │
│  │    → Riceve payment intent con amount, chain, address           │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                    │                                   │
│                                    ▼                                   │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ 3. Payment Execution: Firma transazione USDC su Base            │ │
│  │    → Usa wallet dell'agente (EIP-712 signed payment)            │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                    │                                   │
│                                    ▼                                   │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ 4. Tool Execution: POST /v1/call?payment=<signature>            │ │
│  │    → Verifica pagamento, esegue WASM, restituisce risultato     │ │
│  └───────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

### 11.3 Schema Database per Agenti

**Tabella `agents`**:
```sql
CREATE TABLE agents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT UNIQUE NOT NULL,
  wallet_address TEXT UNIQUE NOT NULL,  -- Address Base per pagamenti
  email TEXT,
  name TEXT,
  plan TEXT DEFAULT 'free',  -- free | pay_as_you_go | enterprise
  budget_limit_usd DECIMAL(10,2) DEFAULT 0,
  current_spent_usd DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Tabella `tool_pricing`**:
```sql
CREATE TABLE tool_pricing (
  tool_name TEXT PRIMARY KEY,
  price_per_call_usd DECIMAL(10,6) DEFAULT 0.001,  -- $0.001 = 0.1 cent
  price_per_call_usdc DECIMAL(10,6) DEFAULT 0.001,
  x402_enabled BOOLEAN DEFAULT TRUE,
  discount_bulk BOOLEAN DEFAULT TRUE,
  min_call_volume INTEGER DEFAULT 0,
  bulk_price DECIMAL(10,6) DEFAULT 0.0005,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 11.4 Verifica Pagamento x402

```javascript
import { verifyTypedData, recoverAddress } from 'viem';
import { base } from 'viem/chains';

async function verifyX402Payment(payment, env) {
  // 1. Verifica nonce (anti-replay)
  const used = await env.DB.prepare(
    "SELECT * FROM used_nonces WHERE nonce = ? AND agent_id = ?"
  ).bind(payment.nonce, payment.payer).first();
  if (used) throw new Error('Nonce already used');

  // 2. Verifica firma EIP-712
  const domain = {
    name: 'MetaMesh x402',
    version: '1',
    chainId: 8453, // Base
    verifyingContract: env.X402_CONTRACT_ADDRESS
  };
  
  const types = {
    Payment: [
      { name: 'payer', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'currency', type: 'address' },
      { name: 'nonce', type: 'uint256' },
      { name: 'expiresAt', type: 'uint256' }
    ]
  };
  
  const recovered = recoverAddress({
    domain,
    types,
    primaryType: 'Payment',
    message: payment,
    signature: payment.signature
  });
  
  if (recovered !== payment.payer) {
    throw new Error('Invalid signature');
  }

  // 3. Verifica saldo
  const balance = await getAgentBalance(payment.payer, 'base', 'USDC');
  if (balance < payment.amount) {
    throw new Error('Insufficient balance');
  }

  // 4. Segna nonce come usato
  await env.DB.prepare(
    "INSERT INTO used_nonces (nonce, agent_id, used_at) VALUES (?, ?, datetime('now'))"
  ).bind(payment.nonce, payment.payer).run();

  // 5. Aggiorna wallet dell'agente
  await env.DB.prepare(
    "UPDATE agent_wallets SET balance = balance - ? WHERE agent_id = ? AND chain = 'base' AND currency = 'USDC'"
  ).bind(payment.amount, payment.payer).run();

  return { verified: true, payer: payment.payer };
}
```

### 11.5 Revenue Proiezione Agenti

| Mese | Agenti Attivi | Chiamate/giorno | Revenue Mensile |
|------|---------------|-----------------|-----------------|
| 6 | 10.000 | 1.000.000 | $30.000 |
| 12 | 85.000 | 8.500.000 | **$255.000** |

**Revenue Combinato Anno 1** (Umani + Agenti): **~$2.5M - $3.0M**

---

## 12. Deploy e CI/CD

### 12.1 Repository Structure

```
metamesh-uga/
├── packages/
│   ├── gateway/          # Livello 1 Worker
│   ├── discovery/        # Livello 2 Worker
│   ├── aggregator/       # Livello 3 Worker
│   ├── categories/       # Livello 4 Workers
│   │   ├── comm/
│   │   ├── dev/
│   │   └── ...
│   ├── inserter/         # Motore di inserimento
│   ├── updater/          # Motore di aggiornamento
│   ├── eliminatore/      # Motore di eliminazione
│   ├── alerts/           # Alerting Worker
│   ├── agent-billing/    # Billing per AI Agent
│   └── dashboard/        # Cloudflare Pages
├── cli/                  # CLI Tool (Go)
├── shared/               # Librerie condivise
├── wrangler.toml         # Config Cloudflare
├── package.json
└── README.md
```

### 12.2 GitHub Actions Workflow

```yaml
name: Deploy to Cloudflare

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Build all packages
        run: npm run build
      
      - name: Deploy Workers
        run: npm run deploy:workers
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
      
      - name: Deploy Dashboard
        run: npm run deploy:dashboard
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

### 12.3 Wrangler Configuration

```toml
name = "metamesh-gateway"
main = "src/index.js"
compatibility_date = "2024-01-01"

[[analytics_engine_datasets]]
binding = "ANALYTICS"
dataset = "metamesh_usage"

[[d1_databases]]
binding = "DB"
database_name = "metamesh-catalog"
database_id = "abc123"

[[kv_namespaces]]
binding = "CACHE"
id = "def456"

[[r2_buckets]]
binding = "STORAGE"
bucket_name = "metamesh-wasm"

[env.staging]
routes = [{ pattern = "staging.metamesh-uga.dev", custom_domain = true }]

[env.production]
routes = [{ pattern = "api.metamesh-uga.dev", custom_domain = true }]
```

---

## 13. Struttura dei File

### 13.1 Gateway (Livello 1)

```javascript
// packages/gateway/src/index.js
import { Router } from 'itty-router';
import { handleMCP } from './mcp';
import { handleREST } from './rest';
import { authenticate } from './auth';
import { rateLimit } from './ratelimit';

const router = Router();

router.post('/v1/call', authenticate, rateLimit, handleREST);
router.get('/v1/tools', authenticate, handleREST);
router.get('/sse', handleMCP);
router.post('/message', handleMCP);
router.post('/v1/agent/pay', handleX402Payment);
router.get('/v1/agent/marketplace', getAgentMarketplace);

export default {
  async fetch(request, env, ctx) {
    const response = await router.handle(request, env, ctx);
    if (!response) {
      return new Response('Not found', { status: 404 });
    }
    return response;
  }
};
```

### 13.2 Dashboard (Pages)

```tsx
// packages/dashboard/src/App.tsx
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Line } from 'react-chartjs-2';
import { fetchMetrics } from './api';

function Dashboard() {
  const { data } = useQuery(['metrics', 'daily'], () => 
    fetchMetrics('/api/metrics/daily')
  );
  
  const chartData = {
    labels: data?.labels || [],
    datasets: [{
      label: 'Richieste',
      data: data?.values || [],
      borderColor: 'rgb(59, 130, 246)',
      tension: 0.1
    }]
  };
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">MetaMesh Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Richieste oggi" value={data?.today || 0} />
        <StatCard label="Tool disponibili" value={data?.tools || 0} />
        <StatCard label="Utenti attivi" value={data?.users || 0} />
        <StatCard label="Error rate" value={`${data?.errorRate || 0}%`} />
      </div>
      <div className="mt-6 bg-white p-4 rounded-lg shadow">
        <Line data={chartData} options={{ responsive: true }} />
      </div>
    </div>
  );
}
```

### 13.3 CLI Tool (Go)

```go
// cli/main.go
package main

import (
  "encoding/json"
  "fmt"
  "io"
  "net/http"
  "os"
)

func main() {
  if len(os.Args) < 2 {
    fmt.Println("Usage: metamesh <command>")
    fmt.Println("Commands: connect, call, list, usage, config")
    os.Exit(1)
  }
  
  switch os.Args[1] {
  case "connect":
    connect()
  case "call":
    call()
  case "list":
    list()
  default:
    fmt.Println("Unknown command")
  }
}

func connect() {
  apiKey := os.Getenv("METAMESH_API_KEY")
  if apiKey == "" {
    fmt.Print("Enter your API key: ")
    fmt.Scanln(&apiKey)
  }
  
  resp, err := http.Get("https://api.metamesh-uga.dev/v1/tools")
  if err != nil {
    fmt.Printf("Error: %v\n", err)
    os.Exit(1)
  }
  defer resp.Body.Close()
  
  fmt.Println("✅ Connected to MetaMesh Gateway")
  fmt.Printf("Plan: %s\n", resp.Header.Get("X-User-Plan"))
}
```

---

## 14. Roadmap e Versioni

### 14.1 Fase 1 - MVP (Settimana 1-2)
- [ ] Setup Cloudflare Workers
- [ ] Implementare Gateway (Livello 1) base
- [ ] Integrare WASM runtime (wazero)
- [ ] Setup D1 con schema base
- [ ] Discovery dei top 100 MCP
- [ ] Dashboard base (Read-only)
- [ ] CLI tool minimale

### 14.2 Fase 2 - Scala (Settimana 3-4)
- [ ] Implementare tutti i motori (inserimento, aggiornamento, eliminazione)
- [ ] Aggiungere caching (KV)
- [ ] Categorie Worker (Livello 4)
- [ ] Rate limiting e autenticazione
- [ ] Stripe integration
- [ ] Deploy su production

### 14.3 Fase 3 - Enterprise (Mese 2-3)
- [ ] Self-hosted VPC deployment
- [ ] OAuth 2.0 integration
- [ ] Advanced monitoring (Datadog)
- [ ] Custom categories
- [ ] Dedicated support

### 14.4 Fase 4 - AI Native (Mese 4-6)
- [ ] x402 Payment Protocol
- [ ] AI Agent Marketplace
- [ ] Wallet management per agenti
- [ ] Usage billing per agenti
- [ ] Agent Dashboard

---

## 15. Set & Forget: Automazione Completa

### 15.1 Visione Set & Forget

Il sistema deve essere **completamente autonomo**:

| Aspetto | Automazione | Frequenza |
|---------|-------------|-----------|
| **Fatturazione** | Stripe webhook + email | Real-time |
| **Aggiornamenti piani** | Automatico su pagamento | Real-time |
| **Notifiche** | Email automatiche | Event-driven |
| **Report** | PDF generati e inviati | Mensile |
| **Backup** | Automatico su R2 | Giornaliero |
| **Monitoraggio** | Alert su Telegram/Email | 10 minuti |
| **Marketplace** | Deploy automatico | Su release |
| **SEO** | Sitemap generata | Ogni 24h |

### 15.2 Sistema di Notifica Automatica

```javascript
export default {
  async scheduled(event, env, ctx) {
    // Controlla utenti che scadono in 7 giorni
    const expiring = await env.DB.prepare(`
      SELECT * FROM users 
      WHERE plan != 'free' 
      AND subscription_end < datetime('now', '+7 days')
    `).all();
    
    for (const user of expiring) {
      await sendEmail(user.email, '⚠️ Subscription expires soon', 
        `Renew now to avoid interruption.`);
    }
    
    // Controlla utenti che hanno superato l'80% del limite
    const heavyUsers = await env.DB.prepare(`
      SELECT u.*, COUNT(l.id) as usage 
      FROM users u 
      JOIN usage_log l ON u.id = l.user_id 
      WHERE l.called_at > datetime('now', '-1 month')
      GROUP BY u.id
      HAVING usage > u.plan_limit * 0.8
    `).all();
    
    for (const user of heavyUsers) {
      await sendEmail(user.email, '📊 You\'re close to your limit',
        `Upgrade to Pro for unlimited access.`);
    }
  }
};
```

### 15.3 Report Automatici

```javascript
export default {
  async scheduled(event, env, ctx) {
    const report = {
      period: 'monthly',
      stats: await getCommercialStats(env),
      growth: await getGrowthMetrics(env),
      projections: await getProjections(env)
    };
    
    const pdf = await generateReportPDF(report);
    await sendEmail('team@metamesh-uga.dev', '📊 Monthly Report', pdf);
    await sendEmail('investors@metamesh-uga.dev', '📊 Investor Update', pdf);
  }
};
```

### 15.4 SEO Automatico

```javascript
export function SEO({ title, description, path }) {
  return (
    <Helmet>
      <title>{title} | MetaMesh-UGA</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={`https://metamesh-uga.dev${path}`} />
      <meta property="og:type" content="product" />
      <meta property="og:price:amount" content="19" />
      <meta property="og:price:currency" content="USD" />
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          "name": "MetaMesh-UGA",
          "description": "Universal Gateway Adapter for meta MCP API",
          "offers": {
            "@type": "Offer",
            "price": "19",
            "priceCurrency": "USD"
          }
        })}
      </script>
    </Helmet>
  );
}
```

---

## 16. Appendici

### 16.1 Configurazione Ambiente (.env)

```bash
# Cloudflare
CLOUDFLARE_API_TOKEN=xxx
CLOUDFLARE_ACCOUNT_ID=xxx

# Database
D1_DATABASE_ID=xxx
D1_DATABASE_NAME=metamesh-catalog

# JWT
JWT_SECRET=xxx

# Stripe
STRIPE_SECRET_KEY=xxx
STRIPE_WEBHOOK_SECRET=xxx

# Alerting
TELEGRAM_BOT_TOKEN=xxx
TELEGRAM_CHAT_ID=xxx

# Monitoring
SENTRY_DSN=xxx

# x402
X402_CONTRACT_ADDRESS=xxx
```

### 16.2 Comandi Utili

```bash
# Setup iniziale
npm install -g wrangler
wrangler login
wrangler d1 create metamesh-catalog

# Deploy singolo Worker
wrangler deploy --env production

# Deploy tutto
npm run deploy:all

# Test locale
wrangler dev

# Migrazioni D1
wrangler d1 execute metamesh-catalog --file=./migrations/001_init.sql

# Backup R2
wrangler r2 object get mcp-wasm/wasm/

# Dashboard locale
cd packages/dashboard
npm run dev
```

### 16.3 Checklist Pre-Lancio

- [ ] Registrato dominio `metamesh-uga.dev`
- [ ] Configurato Cloudflare Account
- [ ] Creato repository GitHub
- [ ] Setup CI/CD (GitHub Actions)
- [ ] Deploy Worker in staging
- [ ] Test integrazione con Registry MCP
- [ ] Configurato database D1
- [ ] Setup R2 bucket
- [ ] Dashboard deployata su Pages
- [ ] Stripe account configurato
- [ ] Alerting attivo (Telegram)
- [ ] Documentazione completa
- [ ] README con quickstart
- [ ] Pronto per lancio pubblico

---

## 🎯 Metriche di Successo

| Metrica | Target | Azione se non raggiunto |
|---------|--------|------------------------|
| **MRR** | > $1.000/mese | Aumentare marketing |
| **Churn** | < 5% | Migliorare onboarding |
| **Conversion** | > 3% | Ottimizzare pricing |
| **Uptime** | > 99.9% | Verificare alerting |
| **x402 Success** | > 99% | Debug payment flow |

---

## 🏁 Comando Unico Finale

```bash
curl -s https://metamesh-uga.dev/install | bash && metamesh connect
```

Questo comando deve:
1. Installare il CLI tool
2. Configurare automaticamente la connessione
3. Mostrare il piano free attivo
4. Offrire upgrade immediato

**E deve funzionare da Day 1.**

---

## 📝 Note Finali

Questa blueprint è **pronta per l'implementazione**:
- Ogni sezione è dettagliata e implementabile
- Tutti i path, endpoint, e schemi sono specificati
- Il codice è pronto per essere copiato e adattato
- I costi sono zero (free tier Cloudflare)

**Il "set & forget" è realtà. 🚀**

