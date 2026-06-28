#!/usr/bin/env bash
#
# MetaMesh-UGA — Enable Cloudflare Bindings
# Crea KV namespaces e R2 buckets e stampa le sezioni da aggiungere ai wrangler.toml.
#

set -e

echo "=== MetaMesh-UGA Binding Setup ==="
echo ""

# Verifica wrangler
if ! command -v wrangler >/dev/null 2>&1; then
  echo "❌ wrangler CLI non trovato. Installa con: npm install -g wrangler"
  exit 1
fi

# KV Namespaces
echo "Creating KV namespaces..."

CACHE_KV=$(wrangler kv namespace create "CACHE" 2>/dev/null | grep -oP 'id = "\K[^"]+' || true)
CONFIG_KV=$(wrangler kv namespace create "CONFIG_CACHE" 2>/dev/null | grep -oP 'id = "\K[^"]+' || true)

if [ -n "$CACHE_KV" ]; then
  echo "✅ CACHE KV id: $CACHE_KV"
else
  echo "⚠️  CACHE KV: controllare manualmente o già esistente"
fi

if [ -n "$CONFIG_KV" ]; then
  echo "✅ CONFIG_CACHE KV id: $CONFIG_KV"
else
  echo "⚠️  CONFIG_CACHE KV: controllare manualmente o già esistente"
fi

# R2 Buckets
echo ""
echo "Creating R2 buckets..."

wrangler r2 bucket create metamesh-registry-mirror 2>/dev/null || echo "⚠️  metamesh-registry-mirror potrebbe già esistere"
wrangler r2 bucket create metamesh-analytics 2>/dev/null || echo "⚠️  metamesh-analytics potrebbe già esistere"

echo "✅ R2 buckets created/verified"

# Stampa configurazione da inserire nei wrangler.toml
echo ""
echo "=== Aggiungi questi blocchi ai wrangler.toml ==="
echo ""
cat <<EOF
# Per gateway, cache, config, analytics, registry:
[[kv_namespaces]]
binding = "CACHE"
id = "${CACHE_KV:-<CACHE_KV_ID>}"

[[kv_namespaces]]
binding = "CONFIG_CACHE"
id = "${CONFIG_KV:-<CONFIG_KV_ID>}"

# Per registry:
[[r2_buckets]]
binding = "REGISTRY_MIRROR"
bucket_name = "metamesh-registry-mirror"

# Per analytics:
[[r2_buckets]]
binding = "ANALYTICS_BUCKET"
bucket_name = "metamesh-analytics"
EOF

echo ""
echo "=== Note ==="
echo "1. Wrangler crea namespace per account. Se vuoi separati per ambiente, usa nomi distinti."
echo "2. Dopo aver aggiornato i wrangler.toml, esegui: npm run deploy:workers"
echo "3. Analytics Engine si attiva dal Cloudflare Dashboard > Analytics Engine."
