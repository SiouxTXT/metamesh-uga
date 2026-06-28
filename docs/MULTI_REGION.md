# MetaMesh-UGA — Multi-Region Deployment

> Guida operativa per il deployment multi-regione su Cloudflare.

---

## 1. Architettura multi-regione

MetaMesh-UGA è progettato per sfruttare l'infrastruttura globale di Cloudflare:

- **Cloudflare Workers**: eseguito in ogni edge location, vicino agli utenti.
- **D1**: database SQLite globale con replicazione automatica.
- **KV**: cache chiave-valore globale con replica in ogni PoP.
- **R2**: object storage compatibile S3, disponibile globalmente.

```
Utente (EU) -> Cloudflare Edge (FRA) -> metamesh-gateway Worker -> D1 read replica
Utente (US) -> Cloudflare Edge (IAD) -> metamesh-gateway Worker -> D1 read replica
                                                        |
                                                        v
                                              D1 primary (WRITES)
```

---

## 2. Configurazione per multi-region

### 2.1 KV Namespace

Creare un KV namespace per ogni ambiente:

```bash
wrangler kv namespace create "CACHE"
wrangler kv namespace create "CONFIG_CACHE"
```

Aggiornare ogni `wrangler.toml` con l'ID ottenuto:

```toml
[[kv_namespaces]]
binding = "CACHE"
id = "<kv-id>"
```

### 2.2 R2 Bucket

Creare i bucket R2:

```bash
wrangler r2 bucket create metamesh-registry-mirror
wrangler r2 bucket create metamesh-analytics
```

Aggiornare i `wrangler.toml` con i binding:

```toml
[[r2_buckets]]
binding = "REGISTRY_MIRROR"
bucket_name = "metamesh-registry-mirror"
```

### 2.3 D1

D1 è già globale. Assicurarsi che il `database_id` sia lo stesso in tutti i worker:

```toml
[[d1_databases]]
binding = "DB"
database_name = "metamesh-catalog"
database_id = "f9d503dc-708e-4d7a-a502-6b7952611013"
```

---

## 3. Deploy regionale

Il deploy di un Worker su Cloudflare è automaticamente globale. Non è necessario specificare una regione.

Per il routing DNS:

- Usare Cloudflare Load Balancing per indirizzare gli utenti al gateway più vicino.
- Configurare `api.metamesh-uga.dev` come proxy CNAME.

---

## 4. Considerazioni

- **Scritture D1**: D1 supporta una sola regione di scrittura. Le scritture avvengono nel primary; le letture sono servite dalla replica più vicina.
- **Cache KV**: usa TTL brevi per dati che cambiano frequentemente (tool list, routing decisions).
- **R2**: ideale per snapshot, analytics export, log a lungo termine.
- **Worker secrets**: i secret sono replicati globalmente.

---

## 5. Feature flag

Abilitare la feature flag `multi_region` tramite il Config Worker:

```bash
curl -X POST https://api.metamesh-uga.dev/v1/admin/features \
  -H "X-Admin-Key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"multi_region","enabled":true,"target_percent":100}'
```

---

*Documento Fase 5 — 2026-06-25*
