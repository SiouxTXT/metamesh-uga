const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const keyPath = path.join(root, 'mcp-auth-key.pem');

const privPkcs8B64 = fs.readFileSync(keyPath, 'utf8').trim();
const privPkcs8 = Buffer.from(privPkcs8B64, 'base64');
const privRaw = privPkcs8.slice(-32);

const privateKey = crypto.createPrivateKey({
  key: privPkcs8,
  format: 'der',
  type: 'pkcs8'
});

const timestamp = new Date().toISOString();
const signature = crypto.sign(null, Buffer.from(timestamp, 'utf8'), privateKey);
const signedTimestamp = signature.toString('hex');

const payload = {
  domain: 'metamesh-uga.dev',
  timestamp,
  signed_timestamp: signedTimestamp
};

console.log(JSON.stringify(payload, null, 2));
