#!/usr/bin/env node

// MetaMesh-UGA — MCP Official Registry publisher.
// Signs the current timestamp with the Ed25519 domain key, exchanges it for a
// short-lived registry token, then publishes server.json.
//
// Usage: node scripts/mcp-publish.js [--dry-run]

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const REGISTRY = 'https://registry.modelcontextprotocol.io';
const AUTH_URL = `${REGISTRY}/v0/auth/http`;
const PUBLISH_URL = `${REGISTRY}/v0/publish`;
const DOMAIN = 'metamesh-uga.dev';

const root = path.resolve(__dirname, '..');
const keyPath = path.join(root, 'mcp-auth-key.pem');
const serverJsonPath = path.join(root, 'server.json');
const dryRun = process.argv.includes('--dry-run');

function signTimestamp() {
  const privPkcs8B64 = fs.readFileSync(keyPath, 'utf8').trim();
  const privPkcs8 = Buffer.from(privPkcs8B64, 'base64');
  const privateKey = crypto.createPrivateKey({ key: privPkcs8, format: 'der', type: 'pkcs8' });
  const timestamp = new Date().toISOString();
  const signature = crypto.sign(null, Buffer.from(timestamp, 'utf8'), privateKey);
  return { timestamp, signed_timestamp: signature.toString('hex') };
}

async function authenticate(payload) {
  const res = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain: DOMAIN, ...payload })
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Auth failed (${res.status}): ${text}`);
  return JSON.parse(text);
}

async function publish(token, serverJson) {
  const res = await fetch(PUBLISH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(serverJson)
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Publish failed (${res.status}): ${text}`);
  return JSON.parse(text);
}

(async () => {
  const serverJson = JSON.parse(fs.readFileSync(serverJsonPath, 'utf8'));
  console.log(`Publishing ${serverJson.name} v${serverJson.version} to ${REGISTRY}`);

  const payload = signTimestamp();
  console.log(`Signed timestamp: ${payload.timestamp}`);

  if (dryRun) {
    console.log('Dry run — auth payload:', JSON.stringify(payload, null, 2));
    return;
  }

  const auth = await authenticate(payload);
  console.log(`Got registry token (expires_at=${auth.expires_at})`);
  fs.writeFileSync(path.join(root, 'mcp-registry-token.json'), JSON.stringify(auth));

  const result = await publish(auth.registry_token, serverJson);
  fs.writeFileSync(path.join(root, 'publish-response.json'), JSON.stringify(result));

  const official = result?._meta?.['io.modelcontextprotocol.registry/official'];
  console.log('Published successfully.');
  console.log(`  status:    ${official?.status}`);
  console.log(`  version:   ${result?.server?.version}`);
  console.log(`  isLatest:  ${official?.isLatest}`);
  console.log(`  updatedAt: ${official?.updatedAt}`);
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
