/**
 * MetaMesh-UGA Recommendation Engine
 * 
 * Recommends MCP tools for a given task or intent.
 * Combines semantic search, capability graph, and scoring to provide
 * ranked recommendations with explanations and alternatives.
 */

import { SemanticSearch } from '../../discovery/src/semantic-search.js';
import { IntentSearch } from '../../discovery/src/intent.js';

export const SCORE_WEIGHTS = {
  trust: 0.30,
  security: 0.25,
  semantic: 0.20,
  intent: 0.15,
  popularity: 0.10
};

export class RecommendationEngine {
  constructor(db) {
    this.db = db;
    this.semanticSearch = new SemanticSearch(db);
    this.intentSearch = new IntentSearch(db);
  }

  /**
   * Recommend tools for a task/intent
   */
  async recommend(query, options = {}) {
    const limit = Math.min(options.limit || 5, 20);
    const includeAlternatives = options.include_alternatives !== false;
    const minTrust = options.min_trust || 0.5;
    const category = options.category;

    // 1. Semantic search results
    const semanticResults = await this.semanticSearch.search(query, limit * 3, minTrust);
    const semanticMap = new Map();
    for (const result of semanticResults) {
      semanticMap.set(result.name, result);
    }

    // 2. Intent search results
    const intentResult = await this.intentSearch.search(query, limit * 3, minTrust);
    const intentMap = new Map();
    for (const result of intentResult.results || []) {
      intentMap.set(result.name, result);
    }

    // 3. Combine all candidate names
    const allNames = new Set([...semanticMap.keys(), ...intentMap.keys()]);

    if (allNames.size === 0) {
      return {
        query,
        total: 0,
        primary: null,
        alternatives: []
      };
    }

    // 4. Fetch full tool details from database
    let whereClause = `WHERE name IN (${Array.from(allNames).map(() => '?').join(',')}) AND deprecated = FALSE`;
    const params = [...allNames];

    if (minTrust > 0) {
      whereClause += ' AND trust_score >= ?';
      params.push(minTrust);
    }

    if (category) {
      whereClause += ' AND category = ?';
      params.push(category);
    }

    const tools = await this.db.prepare(
      `SELECT name, version, category, description, trust_score, security_score,
              popularity_score, state, registry_source
       FROM tools ${whereClause}
       ORDER BY trust_score DESC`
    ).bind(...params).all();

    // 5. Score and rank recommendations
    let recommendations = (tools.results || []).map(tool => {
      const semantic = semanticMap.get(tool.name);
      const intent = intentMap.get(tool.name);

      const semanticScore = semantic?.similarity || 0;
      const intentScore = intent ? (intent.matched_capabilities / Math.max(intent.expanded_capabilities?.length || 1, 1)) : 0;
      const trustScore = tool.trust_score || 0.5;
      const securityScore = tool.security_score || 0.5;
      const popularityScore = Math.min((tool.popularity_score || 0) / 100, 1);

      const overallScore =
        trustScore * SCORE_WEIGHTS.trust +
        securityScore * SCORE_WEIGHTS.security +
        semanticScore * SCORE_WEIGHTS.semantic +
        intentScore * SCORE_WEIGHTS.intent +
        popularityScore * SCORE_WEIGHTS.popularity;

      return {
        ...tool,
        semantic_score: semanticScore,
        intent_score: intentScore,
        overall_score: Math.round(overallScore * 1000) / 1000,
        explanation: this.buildExplanation(tool, semanticScore, intentScore)
      };
    });

    recommendations.sort((a, b) => b.overall_score - a.overall_score);

    const primary = recommendations[0];
    const alternatives = includeAlternatives ? recommendations.slice(1, limit) : [];

    return {
      query,
      intent: intentResult.intent,
      extracted_capabilities: intentResult.extracted_capabilities,
      total: recommendations.length,
      primary,
      alternatives
    };
  }

  /**
   * Build a human-readable explanation for why a tool is recommended
   */
  buildExplanation(tool, semanticScore, intentScore) {
    const reasons = [];

    if (tool.trust_score >= 0.8) {
      reasons.push(`High trust score (${tool.trust_score.toFixed(2)})`);
    } else if (tool.trust_score >= 0.6) {
      reasons.push(`Good trust score (${tool.trust_score.toFixed(2)})`);
    }

    if (tool.security_score >= 0.8) {
      reasons.push(`Strong security (${tool.security_score.toFixed(2)})`);
    }

    if (semanticScore > 0.5) {
      reasons.push('Semantic match with your request');
    }

    if (intentScore > 0.5) {
      reasons.push('Matches required capabilities');
    }

    if (tool.popularity_score > 100) {
      reasons.push(`Popular (${tool.popularity_score} recent calls)`);
    }

    if (reasons.length === 0) {
      reasons.push(`Recommended in category ${tool.category}`);
    }

    return reasons;
  }

  /**
   * Get similar tools to a given tool
   */
  async getSimilarTools(toolName, limit = 5) {
    const tool = await this.db.prepare(
      `SELECT name, category, description, capabilities FROM tools WHERE name = ? AND deprecated = FALSE`
    ).bind(toolName).first();

    if (!tool) {
      return { tool: toolName, error: 'Tool not found' };
    }

    const searchQuery = `${tool.name} ${tool.description} ${tool.category}`;
    const similar = await this.semanticSearch.search(searchQuery, limit + 1, 0);
    
    return {
      tool: toolName,
      total: Math.max(similar.length - 1, 0),
      similar: similar.filter(s => s.name !== toolName).slice(0, limit)
    };
  }
}
