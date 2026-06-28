const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const keyPath = path.join(root, 'mcp-auth-key.pem');
const wellKnownDir = path.join(root, 'packages', 'landing', 'public', '.well-known');
const authFilePath = path.join(wellKnownDir, 'mcp-registry-auth');

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');

const pubSpki = publicKey.export({ type: 'spki', format: 'der' });
const pubRaw = pubSpki.slice(-32);
const pubB64 = pubRaw.toString('base64');

const privPkcs8 = privateKey.export({ type: 'pkcs8', format: 'der' });
const privRaw = privPkcs8.slice(-32);
const privHex = privRaw.toString('hex');

const authContent = `v=MCPv1; k=ed25519; p=${pubB64}`;

fs.writeFileSync(keyPath, privPkcs8.toString('base64'));
fs.mkdirSync(wellKnownDir, { recursive: true });
fs.writeFileSync(authFilePath, authContent);

console.log('Key saved:', keyPath);
console.log('Auth file saved:', authFilePath);
console.log('Auth content:', authContent);
console.log('Private key hex (keep secret):', privHex);
console.log('Public key base64:', pubB64);
