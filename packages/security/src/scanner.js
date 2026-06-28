/**
 * MetaMesh-UGA Security Scanner
 * 
 * Scans MCP servers for security risks and computes a security score.
 * Runs in a Cloudflare Worker environment.
 * 
 * Capabilities:
 * - Dependency scan (fetch package.json and detect known risky dependencies)
 * - CVE lookup via NVD API (keyword-based)
 * - Malware detection placeholder (URL reputation)
 * - Permission analysis (schema-based)
 * - Network and filesystem access analysis
 */

export const RISKY_DEPENDENCIES = {
  'request': { reason: 'deprecated, known vulnerabilities' },
  'event-stream': { reason: 'historical malicious package incident' },
  'minimatch': { reason: 'old versions vulnerable to ReDoS' },
  'lodash': { reason: 'older versions have prototype pollution CVEs' },
  'axios': { reason: 'older versions have SSRF CVEs' },
  'node-fetch': { reason: 'older versions have redirect vulnerability' },
  'debug': { reason: 'older versions have ReDoS CVEs' }
};

export const RISKY_PERMISSIONS = [
  'filesystem',
  'shell',
  'exec',
  'child_process',
  'network',
  'fetch',
  'http',
  'https',
  'fs',
  'path',
  'os'
];

export const SUSPICIOUS_PATTERNS = {
  network: ['http://', 'https://', 'fetch', 'axios', 'request', 'got', 'node-fetch'],
  filesystem: ['fs.', 'readFile', 'writeFile', 'path.', 'process.env'],
  execution: ['exec', 'spawn', 'child_process', 'eval', 'Function']
};

export class SecurityScanner {
  constructor(db, env) {
    this.db = db;
    this.env = env;
  }

  /**
   * Scan all active tools
   */
  async scanAll(limit = 1000) {
    const tools = await this.db.prepare(
      `SELECT name, source_url, registry_url, schema, description, capabilities
       FROM tools
       WHERE deprecated = FALSE
       ORDER BY name
       LIMIT ?`
    ).bind(limit).all();

    const results = {
      scanned: 0,
      updated: 0,
      failed: 0,
      errors: []
    };

    for (const tool of tools.results || []) {
      try {
        const scan = await this.scan(tool);
        await this.storeResults(tool.name, scan);
        await this.updateToolScore(tool.name, scan);
        results.updated++;
      } catch (error) {
        results.failed++;
        results.errors.push({ tool: tool.name, error: error.message });
        console.error(`Security scan failed for ${tool.name}:`, error);
      }
      results.scanned++;
    }

    return results;
  }

  /**
   * Scan a single tool
   */
  async scan(tool) {
    const sourceUrl = tool.source_url || '';
    const registryUrl = tool.registry_url || '';
    const schema = tool.schema ? JSON.parse(tool.schema) : null;
    const description = tool.description || '';
    const capabilities = tool.capabilities ? JSON.parse(tool.capabilities) : [];

    const results = {
      dependencies: await this.scanDependencies(sourceUrl),
      cves: await this.lookupCVEs(tool.name),
      malware: this.detectMalware(sourceUrl, registryUrl),
      permissions: this.analyzePermissions(schema, capabilities),
      network: this.analyzeNetwork(sourceUrl, schema, description),
      filesystem: this.analyzeFilesystem(schema, capabilities, description),
      timestamp: new Date().toISOString()
    };

    results.security_score = this.calculateSecurityScore(results);
    return results;
  }

  /**
   * Scan dependencies by fetching package.json from GitHub
   */
  async scanDependencies(sourceUrl) {
    const result = {
      scanned: false,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      findings: []
    };

    if (!sourceUrl.includes('github.com')) {
      return { ...result, reason: 'Not a GitHub source' };
    }

    try {
      const rawUrl = sourceUrl
        .replace('github.com', 'raw.githubusercontent.com')
        .replace('/tree/', '/')
        .replace('/blob/', '/')
        .replace(/\/$/, '');

      const packageUrl = `${rawUrl}/main/package.json`;
      const response = await fetch(packageUrl, { timeout: 5000 });

      if (!response.ok) {
        return { ...result, reason: `Could not fetch package.json: ${response.status}` };
      }

      const pkg = await response.json();
      const deps = {
        ...pkg.dependencies,
        ...pkg.devDependencies
      };

      result.scanned = true;
      for (const [name, version] of Object.entries(deps)) {
        if (RISKY_DEPENDENCIES[name]) {
          result.findings.push({
            name,
            version,
            severity: 'high',
            reason: RISKY_DEPENDENCIES[name].reason
          });
          result.high++;
        }
      }
    } catch (error) {
      result.reason = `Dependency scan error: ${error.message}`;
    }

    return result;
  }

  /**
   * Lookup CVEs via NVD API using keyword search
   */
  async lookupCVEs(toolName) {
    const result = {
      scanned: false,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      cves: []
    };

    try {
      const keyword = encodeURIComponent(toolName);
      const url = `${this.env.NVD_API_URL || 'https://services.nvd.nist.gov/rest/json/cves/2.0'}?keywordSearch=${keyword}&resultsPerPage=10`;
      const response = await fetch(url, { timeout: 5000 });

      if (!response.ok) {
        return { ...result, reason: `NVD API returned ${response.status}` };
      }

      const data = await response.json();
      result.scanned = true;

      for (const vuln of data.vulnerabilities || []) {
        const cve = vuln.cve;
        const severity = this.parseSeverity(cve.metrics);
        result.cves.push({
          id: cve.id,
          severity,
          description: cve.descriptions?.[0]?.value || ''
        });
        result[severity]++;
      }
    } catch (error) {
      result.reason = `CVE lookup error: ${error.message}`;
    }

    return result;
  }

  /**
   * Detect malware based on URL reputation heuristics
   */
  detectMalware(sourceUrl, registryUrl) {
    const suspiciousDomains = [
      'raw.githubusercontent.com/malicious',
      'pastebin.com',
      'bit.ly'
    ];

    const detected = suspiciousDomains.some(domain =>
      sourceUrl.includes(domain) || registryUrl.includes(domain)
    );

    return {
      scanned: true,
      detected,
      reason: detected ? 'Suspicious source URL' : 'No suspicious indicators'
    };
  }

  /**
   * Analyze permissions from schema and capabilities
   */
  analyzePermissions(schema, capabilities) {
    const text = JSON.stringify(schema) + ' ' + capabilities.join(' ');
    const lowerText = text.toLowerCase();
    const excessive = [];

    for (const perm of RISKY_PERMISSIONS) {
      if (lowerText.includes(perm.toLowerCase())) {
        excessive.push(perm);
      }
    }

    return {
      scanned: true,
      excessive: excessive.length > 0,
      permissions: excessive
    };
  }

  /**
   * Analyze network usage
   */
  analyzeNetwork(sourceUrl, schema, description) {
    const text = `${sourceUrl} ${JSON.stringify(schema)} ${description}`.toLowerCase();
    const suspicious = SUSPICIOUS_PATTERNS.network.some(p => text.includes(p.toLowerCase()));

    return {
      scanned: true,
      suspicious,
      indicators: SUSPICIOUS_PATTERNS.network.filter(p => text.includes(p.toLowerCase()))
    };
  }

  /**
   * Analyze filesystem access
   */
  analyzeFilesystem(schema, capabilities, description) {
    const text = `${JSON.stringify(schema)} ${capabilities.join(' ')} ${description}`.toLowerCase();
    const suspicious = SUSPICIOUS_PATTERNS.filesystem.some(p => text.includes(p.toLowerCase()));

    return {
      scanned: true,
      suspicious,
      indicators: SUSPICIOUS_PATTERNS.filesystem.filter(p => text.includes(p.toLowerCase()))
    };
  }

  /**
   * Calculate security score from 0 to 1
   */
  calculateSecurityScore(results) {
    let score = 1.0;

    const deps = results.dependencies;
    if (deps?.critical > 0) score -= 0.3;
    if (deps?.high > 0) score -= 0.2;
    if (deps?.medium > 0) score -= 0.05;

    const cves = results.cves;
    if (cves?.critical > 0) score -= 0.3;
    if (cves?.high > 0) score -= 0.2;
    if (cves?.medium > 0) score -= 0.05;

    if (results.malware?.detected) score = 0;
    if (results.permissions?.excessive) score -= 0.1;
    if (results.network?.suspicious) score -= 0.05;
    if (results.filesystem?.suspicious) score -= 0.05;

    return Math.max(score, 0);
  }

  /**
   * Parse severity from NVD metrics
   */
  parseSeverity(metrics) {
    if (!metrics) return 'low';
    const cvss = metrics.cvssMetricV31?.[0]?.cvssData || metrics.cvssMetricV30?.[0]?.cvssData;
    const score = cvss?.baseScore || 0;

    if (score >= 9.0) return 'critical';
    if (score >= 7.0) return 'high';
    if (score >= 4.0) return 'medium';
    return 'low';
  }

  /**
   * Store scan results in database
   */
  async storeResults(toolName, results) {
    await this.db.prepare(
      `INSERT INTO security_scans
        (tool_name, security_score, cve_count, critical_cve_count, high_cve_count,
         malware_detected, permissions, network_analysis, filesystem_analysis, dependency_analysis)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(tool_name) DO UPDATE SET
          security_score = excluded.security_score,
          cve_count = excluded.cve_count,
          critical_cve_count = excluded.critical_cve_count,
          high_cve_count = excluded.high_cve_count,
          malware_detected = excluded.malware_detected,
          permissions = excluded.permissions,
          network_analysis = excluded.network_analysis,
          filesystem_analysis = excluded.filesystem_analysis,
          dependency_analysis = excluded.dependency_analysis,
          scanned_at = CURRENT_TIMESTAMP`
    ).bind(
      toolName,
      results.security_score,
      (results.cves?.critical || 0) + (results.cves?.high || 0) + (results.cves?.medium || 0) + (results.cves?.low || 0),
      results.cves?.critical || 0,
      results.cves?.high || 0,
      results.malware?.detected || false,
      JSON.stringify(results.permissions),
      JSON.stringify(results.network),
      JSON.stringify(results.filesystem),
      JSON.stringify(results.dependencies)
    ).run();
  }

  /**
   * Update tool security score in tools table
   */
  async updateToolScore(toolName, results) {
    await this.db.prepare(
      `UPDATE tools SET
        security_score = ?,
        security_scan_updated = CURRENT_TIMESTAMP,
        cve_count = ?,
        malware_detected = ?
      WHERE name = ?`
    ).bind(
      results.security_score,
      (results.cves?.critical || 0) + (results.cves?.high || 0) + (results.cves?.medium || 0) + (results.cves?.low || 0),
      results.malware?.detected || false,
      toolName
    ).run();
  }

  /**
   * Get latest scan for a tool
   */
  async getScan(toolName) {
    const scan = await this.db.prepare(
      `SELECT * FROM security_scans WHERE tool_name = ? ORDER BY scanned_at DESC LIMIT 1`
    ).bind(toolName).first();

    return scan;
  }
}
