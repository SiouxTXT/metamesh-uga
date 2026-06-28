/**
 * MetaMesh-UGA Compatibility Engine
 * 
 * Checks compatibility between MCP servers and client requirements:
 * - Version compatibility (semver ranges)
 * - Schema compatibility (required tool names/properties)
 * - Protocol version compatibility
 * - Capability matching
 */

export const MCP_PROTOCOL_VERSION = '2024-11-05';

export class CompatibilityEngine {
  constructor(db) {
    this.db = db;
  }

  /**
   * Check compatibility of a tool against requirements
   */
  async checkCompatibility(toolName, requirements) {
    const tool = await this.db.prepare(
      `SELECT name, version, schema, capabilities, protocol_version FROM tools WHERE name = ?`
    ).bind(toolName).first();

    if (!tool) {
      return { compatible: false, reason: 'Tool not found' };
    }

    const results = {
      tool: toolName,
      compatible: true,
      version: this.checkVersion(tool.version, requirements.min_version, requirements.max_version),
      protocol: this.checkProtocol(tool.protocol_version || MCP_PROTOCOL_VERSION, requirements.protocol_version),
      schema: this.checkSchema(tool, requirements.required_tools),
      capabilities: this.checkCapabilities(tool.capabilities, requirements.required_capabilities)
    };

    results.compatible = Object.values(results).every(
      v => typeof v === 'boolean' ? v : v.compatible
    );

    if (!results.compatible) {
      const failedChecks = [];
      if (!results.version.compatible) failedChecks.push('version');
      if (!results.protocol.compatible) failedChecks.push('protocol');
      if (!results.schema.compatible) failedChecks.push('schema');
      if (!results.capabilities.compatible) failedChecks.push('capabilities');
      results.reason = `Failed checks: ${failedChecks.join(', ')}`;
    }

    return results;
  }

  /**
   * Check version compatibility
   */
  checkVersion(toolVersion, minVersion, maxVersion) {
    const normalized = this.normalizeVersion(toolVersion);
    const parts = normalized.split('.').map(Number);

    let compatible = true;
    let reason = `Version ${toolVersion} OK`;

    if (minVersion) {
      const minParts = this.normalizeVersion(minVersion).split('.').map(Number);
      if (this.compareVersions(parts, minParts) < 0) {
        compatible = false;
        reason = `Version ${toolVersion} is below minimum ${minVersion}`;
      }
    }

    if (maxVersion) {
      const maxParts = this.normalizeVersion(maxVersion).split('.').map(Number);
      if (this.compareVersions(parts, maxParts) > 0) {
        compatible = false;
        reason = `Version ${toolVersion} is above maximum ${maxVersion}`;
      }
    }

    return { compatible, reason, tool_version: toolVersion };
  }

  /**
   * Check protocol version compatibility
   */
  checkProtocol(toolProtocol, requiredProtocol) {
    const required = requiredProtocol || MCP_PROTOCOL_VERSION;
    const compatible = toolProtocol === required;

    return {
      compatible,
      tool_protocol: toolProtocol,
      required_protocol: required,
      reason: compatible ? 'Protocol versions match' : `Protocol mismatch: tool ${toolProtocol}, required ${required}`
    };
  }

  /**
   * Check schema compatibility
   */
  checkSchema(tool, requiredToolNames) {
    const result = {
      compatible: true,
      missing_tools: [],
      reason: 'Schema compatible'
    };

    if (!requiredToolNames || requiredToolNames.length === 0) {
      return result;
    }

    try {
      const schema = tool.schema ? JSON.parse(tool.schema) : null;
      const availableTools = schema?.tools || schema || [];
      const availableNames = availableTools.map(t => t.name || t.title);

      for (const required of requiredToolNames) {
        if (!availableNames.includes(required)) {
          result.missing_tools.push(required);
        }
      }

      if (result.missing_tools.length > 0) {
        result.compatible = false;
        result.reason = `Missing tools: ${result.missing_tools.join(', ')}`;
      }
    } catch (error) {
      result.compatible = false;
      result.reason = `Schema parse error: ${error.message}`;
    }

    return result;
  }

  /**
   * Check capability matching
   */
  checkCapabilities(toolCapabilities, requiredCapabilities) {
    const result = {
      compatible: true,
      missing_capabilities: [],
      reason: 'Capabilities match'
    };

    if (!requiredCapabilities || requiredCapabilities.length === 0) {
      return result;
    }

    let available = [];
    try {
      available = toolCapabilities ? JSON.parse(toolCapabilities) : [];
    } catch (error) {
      available = [];
    }

    for (const required of requiredCapabilities) {
      if (!available.includes(required)) {
        result.missing_capabilities.push(required);
      }
    }

    if (result.missing_capabilities.length > 0) {
      result.compatible = false;
      result.reason = `Missing capabilities: ${result.missing_capabilities.join(', ')}`;
    }

    return result;
  }

  /**
   * Compare two version arrays
   */
  compareVersions(a, b) {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const av = a[i] || 0;
      const bv = b[i] || 0;
      if (av !== bv) return av - bv;
    }
    return 0;
  }

  /**
   * Normalize version string
   */
  normalizeVersion(version) {
    if (!version) return '0.0.0';
    return version.replace(/^v/, '').split('.').slice(0, 3).join('.');
  }

  /**
   * Find compatible tools for a set of requirements
   */
  async findCompatibleTools(requirements) {
    const tools = await this.db.prepare(
      `SELECT name, version, capabilities, protocol_version FROM tools
       WHERE deprecated = FALSE AND state IN ('ACTIVE', 'RANKED', 'BENCHMARKED')`
    ).all();

    const results = [];
    for (const tool of tools.results || []) {
      const check = await this.checkCompatibility(tool.name, requirements);
      if (check.compatible) {
        results.push({
          name: tool.name,
          version: tool.version
        });
      }
    }

    return results;
  }
}
