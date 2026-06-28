/**
 * MetaMesh-UGA — Validation Report Generator
 * 
 * Genera un report JSON/MD di validazione per il posizionamento pubblico.
 * Usa: node scripts/validation-report.js
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'https://api.metamesh-uga.dev';
const ADMIN_KEY = process.env.ADMIN_KEY || '';

const checks = [
  { name: 'Health Check', url: '/health', method: 'GET', admin: false },
  { name: 'Tools List', url: '/v1/tools', method: 'GET', admin: false },
  { name: 'Search', url: '/v1/search?q=email', method: 'GET', admin: false },
  { name: 'Recommend', url: '/v1/recommend?q=send+email', method: 'GET', admin: false },
  { name: 'Prometheus Metrics', url: '/v1/metrics/prometheus', method: 'GET', admin: false },
  { name: 'Dashboard Health', url: '/v1/dashboard/health', method: 'GET', admin: false },
  { name: 'Self-Healing History', url: '/v1/history', method: 'GET', admin: true },
  { name: 'Config', url: '/v1/config', method: 'GET', admin: false },
  { name: 'Features', url: '/v1/features', method: 'GET', admin: false },
  { name: 'Security Scan', url: '/v1/admin/security/scan/example.echo', method: 'POST', admin: true },
  { name: 'Trust Recalc', url: '/v1/admin/trust/recalculate/example.echo', method: 'POST', admin: true },
  { name: 'Registry Sync', url: '/v1/admin/registry/sync', method: 'POST', admin: true },
  { name: 'Self-Heal', url: '/v1/admin/heal', method: 'POST', admin: true },
];

async function run() {
  const results = [];
  let pass = 0;
  let fail = 0;

  for (const check of checks) {
    if (check.admin && !ADMIN_KEY) {
      results.push({ name: check.name, status: 'SKIP', message: 'ADMIN_KEY not set' });
      continue;
    }

    try {
      const headers = { 'Accept': 'application/json' };
      if (check.admin) headers['X-Admin-Key'] = ADMIN_KEY;

      const response = await fetch(BASE_URL + check.url, {
        method: check.method,
        headers
      });

      const text = await response.text();
      const ok = response.ok;
      const hasBody = text.length > 0;

      if (ok && hasBody) {
        results.push({ name: check.name, status: 'PASS', message: `HTTP ${response.status}` });
        pass++;
      } else {
        results.push({ name: check.name, status: 'FAIL', message: `HTTP ${response.status} / body: ${text.slice(0, 200)}` });
        fail++;
      }
    } catch (error) {
      results.push({ name: check.name, status: 'FAIL', message: error.message });
      fail++;
    }
  }

  const report = {
    base_url: BASE_URL,
    timestamp: new Date().toISOString(),
    pass,
    fail,
    status: fail === 0 ? 'PASS' : 'FAIL',
    checks: results
  };

  const jsonPath = path.join(process.cwd(), 'validation-report.json');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const md = generateMarkdown(report);
  const mdPath = path.join(process.cwd(), 'validation-report.md');
  fs.writeFileSync(mdPath, md);

  console.log(`Pass: ${pass}, Fail: ${fail}`);
  console.log(`Reports saved: ${jsonPath}, ${mdPath}`);
}

function generateMarkdown(report) {
  const rows = report.checks.map(c => {
    const icon = c.status === 'PASS' ? '✅' : c.status === 'SKIP' ? '⏭️' : '❌';
    return `| ${icon} | ${c.name} | ${c.status} | ${c.message} |`;
  }).join('\n');

  return `# MetaMesh-UGA Validation Report

**Base URL:** ${report.base_url}  
**Timestamp:** ${report.timestamp}  
**Status:** ${report.status}  
**Pass:** ${report.pass}  
**Fail:** ${report.fail}

| | Check | Status | Message |
|---|-------|--------|---------|
${rows}

## Note

- Gli endpoint admin richiedono \`ADMIN_KEY\`.
- Il report non sostituisce il monitoring a 7 giorni, ma ne è un prerequisito.
`;
}

run().catch(error => {
  console.error('Validation failed:', error);
  process.exit(1);
});
