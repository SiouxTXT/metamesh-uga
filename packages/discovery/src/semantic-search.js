/**
 * MetaMesh-UGA Semantic Search Service
 * 
 * Indexes tool embeddings and performs semantic search.
 */

import { embed, cosineSimilarity, EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from './semantic.js';

export class SemanticSearch {
  constructor(db) {
    this.db = db;
  }

  /**
   * Build index text from tool metadata
   */
  buildToolText(tool) {
    const parts = [
      tool.name,
      tool.description,
      tool.category,
      tool.registry_source || '',
      ...(tool.capabilities ? JSON.parse(tool.capabilities) : [])
    ];
    return parts.filter(Boolean).join(' ');
  }

  /**
   * Index a single tool
   */
  async indexTool(tool) {
    const text = this.buildToolText(tool);
    const embedding = embed(text);

    await this.db.prepare(
      `INSERT INTO tool_embeddings (tool_name, embedding, dimensions, model, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(tool_name) DO UPDATE SET
         embedding = excluded.embedding,
         dimensions = excluded.dimensions,
         model = excluded.model,
         updated_at = CURRENT_TIMESTAMP`
    ).bind(
      tool.name,
      JSON.stringify(embedding),
      EMBEDDING_DIMENSIONS,
      EMBEDDING_MODEL
    ).run();

    return { tool_name: tool.name, dimensions: EMBEDDING_DIMENSIONS };
  }

  /**
   * Index all tools that don't have an embedding or have outdated embeddings
   */
  async indexAll() {
    const tools = await this.db.prepare(
      `SELECT t.name, t.description, t.category, t.registry_source, t.capabilities
       FROM tools t
       LEFT JOIN tool_embeddings e ON t.name = e.tool_name
       WHERE t.deprecated = FALSE
         AND (e.tool_name IS NULL OR e.model != ?)
       ORDER BY t.name`
    ).bind(EMBEDDING_MODEL).all();

    const results = {
      indexed: 0,
      failed: 0,
      errors: []
    };

    for (const tool of tools.results || []) {
      try {
        await this.indexTool(tool);
        results.indexed++;
      } catch (error) {
        results.failed++;
        results.errors.push({ tool: tool.name, error: error.message });
        console.error(`Semantic indexing failed for ${tool.name}:`, error);
      }
    }

    return results;
  }

  /**
   * Search tools by semantic similarity
   */
  async search(query, limit = 10, minTrust = 0) {
    const queryEmbedding = embed(query);

    // Fetch all tools with embeddings
    let whereClause = 'WHERE t.deprecated = FALSE AND e.model = ?';
    const params = [EMBEDDING_MODEL];

    if (minTrust > 0) {
      whereClause += ' AND t.trust_score >= ?';
      params.push(minTrust);
    }

    const tools = await this.db.prepare(
      `SELECT t.name, t.version, t.category, t.description, t.trust_score, t.popularity_score, e.embedding
       FROM tools t
       JOIN tool_embeddings e ON t.name = e.tool_name
       ${whereClause}
       ORDER BY t.name`
    ).bind(...params).all();

    const results = [];
    for (const tool of tools.results || []) {
      try {
        const toolEmbedding = JSON.parse(tool.embedding);
        const similarity = cosineSimilarity(queryEmbedding, toolEmbedding);
        results.push({
          name: tool.name,
          version: tool.version,
          category: tool.category,
          description: tool.description,
          trust_score: tool.trust_score,
          popularity_score: tool.popularity_score,
          similarity: Math.round(similarity * 1000) / 1000
        });
      } catch (error) {
        console.error(`Failed to parse embedding for ${tool.name}:`, error);
      }
    }

    // Sort by similarity descending, then by trust score
    results.sort((a, b) => {
      if (b.similarity !== a.similarity) return b.similarity - a.similarity;
      return (b.trust_score || 0) - (a.trust_score || 0);
    });

    return results.slice(0, limit);
  }

  /**
   * Re-rank semantic results by trust score
   */
  rerankByTrust(results) {
    return results
      .map(r => ({
        ...r,
        combined_score: r.similarity * 0.6 + (r.trust_score || 0.5) * 0.4
      }))
      .sort((a, b) => b.combined_score - a.combined_score)
      .map(r => {
        const { combined_score, ...rest } = r;
        return rest;
      });
  }
}
