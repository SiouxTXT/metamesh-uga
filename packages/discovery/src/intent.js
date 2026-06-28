/**
 * MetaMesh-UGA Intent Search
 * 
 * Classifies natural language queries into intents and maps them
 * to capabilities via the Capability Graph.
 */

import { CapabilityGraph } from './capability-graph.js';

export class IntentSearch {
  constructor(db) {
    this.db = db;
    this.graph = new CapabilityGraph(db);
  }

  /**
   * Classify a natural language query into intent
   */
  classify(query) {
    const text = query.toLowerCase();
    
    const intentTypes = {
      'data_processing': ['process', 'transform', 'analyze', 'query', 'database', 'sql'],
      'communication': ['send', 'email', 'message', 'chat', 'notify', 'slack'],
      'search': ['search', 'find', 'lookup', 'discover', 'query'],
      'ai_generation': ['generate', 'create', 'image', 'text', 'write', 'llm'],
      'automation': ['automate', 'schedule', 'trigger', 'workflow', 'run'],
      'file_management': ['file', 'read', 'write', 'save', 'folder'],
      'finance': ['pay', 'payment', 'invoice', 'billing', 'price', 'cost'],
      'system': ['system', 'health', 'monitor', 'status', 'log']
    };

    const scores = {};
    for (const [type, keywords] of Object.entries(intentTypes)) {
      scores[type] = keywords.filter(k => text.includes(k)).length;
    }

    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const primary = sorted[0];
    const secondary = sorted[1];

    return {
      type: primary[1] > 0 ? primary[0] : 'general',
      secondary: secondary[1] > 0 ? secondary[0] : null,
      confidence: primary[1] > 0 ? Math.min(primary[1] / 3, 1) : 0,
      query
    };
  }

  /**
   * Search for servers based on intent
   */
  async search(query, limit = 10, minTrust = 0) {
    // 1. Classify intent
    const intent = this.classify(query);

    // 2. Find servers via capability graph
    const capabilityResult = await this.graph.findServersForIntent(query);
    const serverNames = capabilityResult.servers.slice(0, limit * 3).map(s => s.name);

    if (serverNames.length === 0) {
      return {
        intent,
        query,
        total: 0,
        results: []
      };
    }

    // 3. Fetch tool details from database
    let whereClause = `WHERE name IN (${serverNames.map(() => '?').join(',')}) AND deprecated = FALSE`;
    const params = [...serverNames];

    if (minTrust > 0) {
      whereClause += ' AND trust_score >= ?';
      params.push(minTrust);
    }

    const tools = await this.db.prepare(
      `SELECT name, version, category, description, trust_score, security_score, popularity_score, state
       FROM tools ${whereClause}
       ORDER BY trust_score DESC, popularity_score DESC`
    ).bind(...params).all();

    // 4. Merge with capability info
    const results = (tools.results || []).map(tool => {
      const capInfo = capabilityResult.servers.find(s => s.name === tool.name);
      return {
        ...tool,
        matched_capabilities: capInfo?.matched_capabilities || 0,
        similarity: Math.min((capInfo?.matched_capabilities || 0) / Math.max(capabilityResult.expanded_capabilities.length, 1), 1)
      };
    });

    return {
      intent,
      query,
      extracted_capabilities: capabilityResult.extracted_capabilities,
      expanded_capabilities: capabilityResult.expanded_capabilities,
      total: results.length,
      results: results.slice(0, limit)
    };
  }
}
