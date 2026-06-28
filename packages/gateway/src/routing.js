/**
 * MetaMesh-UGA Smart Routing Engine
 * 
 * Selects the best MCP server for a given tool or category based on:
 * - weighted (default)
 * - latency (benchmark results)
 * - cost (tool pricing)
 * - health (trust score + state)
 * - geographic (CF-IPCountry header)
 * 
 * Phase 3 implementation: single-server selection with scoring.
 * Future phases will support multi-instance routing and load balancing.
 */

export const ROUTING_STRATEGIES = {
  WEIGHTED: 'weighted',
  LATENCY: 'latency',
  COST: 'cost',
  HEALTH: 'health',
  GEOGRAPHIC: 'geographic'
};

export class RoutingEngine {
  constructor(db) {
    this.db = db;
  }

  /**
   * Select the best tool for a given capability/category
   */
  async route(request, options = {}) {
    const strategy = options.strategy || ROUTING_STRATEGIES.WEIGHTED;
    const category = options.category;
    const capability = options.capability;
    const toolName = options.tool;
    const country = options.country;
    const maxLatency = options.max_latency_ms;
    const maxCost = options.max_cost_usd;
    const minTrust = options.min_trust || 0.5;

    let candidates = [];

    // Direct tool routing
    if (toolName) {
      const tool = await this.db.prepare(
        `SELECT name, version, category, description, trust_score, security_score,
                state, popularity_score, registry_source
         FROM tools WHERE name = ? AND deprecated = FALSE AND state IN ('ACTIVE', 'RANKED', 'BENCHMARKED')`
      ).bind(toolName).first();

      if (tool) {
        candidates.push(tool);
      }
    } else if (category || capability) {
      candidates = await this.findCandidates(category, capability, minTrust);
    }

    if (candidates.length === 0) {
      return {
        strategy,
        selected: null,
        reason: 'No available candidates'
      };
    }

    // Enrich with benchmark and pricing
    for (const tool of candidates) {
      tool.benchmark = await this.getBenchmark(tool.name);
      tool.pricing = await this.getPricing(tool.name);
    }

    // Apply constraints
    let filtered = candidates;
    if (maxLatency) {
      filtered = filtered.filter(t => !t.benchmark?.response_time_p95_ms || t.benchmark.response_time_p95_ms <= maxLatency);
    }
    if (maxCost) {
      filtered = filtered.filter(t => !t.pricing?.price_per_call_usd || t.pricing.price_per_call_usd <= maxCost);
    }

    if (filtered.length === 0) {
      return {
        strategy,
        selected: null,
        reason: 'No candidates match constraints'
      };
    }

    // Score based on strategy
    let selected;
    switch (strategy) {
      case ROUTING_STRATEGIES.LATENCY:
        selected = this.selectByLatency(filtered);
        break;
      case ROUTING_STRATEGIES.COST:
        selected = this.selectByCost(filtered);
        break;
      case ROUTING_STRATEGIES.HEALTH:
        selected = this.selectByHealth(filtered);
        break;
      case ROUTING_STRATEGIES.GEOGRAPHIC:
        selected = this.selectByGeographic(filtered, country);
        break;
      case ROUTING_STRATEGIES.WEIGHTED:
      default:
        selected = this.selectWeighted(filtered);
        break;
    }

    return {
      strategy,
      selected: selected ? {
        name: selected.name,
        version: selected.version,
        category: selected.category,
        trust_score: selected.trust_score,
        security_score: selected.security_score,
        benchmark: selected.benchmark,
        pricing: selected.pricing
      } : null,
      candidates: filtered.length,
      all_candidates: candidates.map(c => ({
        name: c.name,
        trust_score: c.trust_score,
        security_score: c.security_score,
        latency_ms: c.benchmark?.response_time_p95_ms,
        cost_usd: c.pricing?.price_per_call_usd
      }))
    };
  }

  /**
   * Find candidate tools for a category or capability
   */
  async findCandidates(category, capability, minTrust) {
    let whereClause = 'WHERE deprecated = FALSE AND state IN (\'ACTIVE\', \'RANKED\', \'BENCHMARKED\')';
    const params = [];

    if (category) {
      whereClause += ' AND category = ?';
      params.push(category);
    }

    if (minTrust > 0) {
      whereClause += ' AND trust_score >= ?';
      params.push(minTrust);
    }

    const tools = await this.db.prepare(
      `SELECT name, version, category, description, trust_score, security_score,
              state, popularity_score, registry_source
       FROM tools ${whereClause}
       ORDER BY trust_score DESC, popularity_score DESC
       LIMIT 20`
    ).bind(...params).all();

    return tools.results || [];
  }

  /**
   * Get latest benchmark for a tool
   */
  async getBenchmark(toolName) {
    const benchmark = await this.db.prepare(
      `SELECT startup_time_ms, response_time_p50_ms, response_time_p95_ms,
              success_rate, throughput_rps, benchmark_score
       FROM benchmark_results
       WHERE tool_name = ?
       ORDER BY benchmarked_at DESC
       LIMIT 1`
    ).bind(toolName).first();

    return benchmark;
  }

  /**
   * Get pricing for a tool
   */
  async getPricing(toolName) {
    const pricing = await this.db.prepare(
      `SELECT price_per_call_usd, x402_enabled
       FROM tool_pricing
       WHERE tool_name = ?`
    ).bind(toolName).first();

    return pricing;
  }

  /**
   * Weighted selection (default)
   */
  selectWeighted(candidates) {
    let best = candidates[0];
    let bestScore = -1;

    for (const tool of candidates) {
      const trustScore = tool.trust_score || 0.5;
      const securityScore = tool.security_score || 0.5;
      const benchmarkScore = tool.benchmark?.benchmark_score || 0.5;
      const popularityScore = Math.min((tool.popularity_score || 0) / 100, 1);
      const costScore = tool.pricing?.price_per_call_usd
        ? Math.max(1 - tool.pricing.price_per_call_usd * 100, 0)
        : 0.5;

      const score =
        trustScore * 0.35 +
        securityScore * 0.25 +
        benchmarkScore * 0.20 +
        popularityScore * 0.10 +
        costScore * 0.10;

      if (score > bestScore) {
        bestScore = score;
        best = tool;
      }
    }

    return best;
  }

  /**
   * Select by lowest latency
   */
  selectByLatency(candidates) {
    return candidates
      .filter(c => c.benchmark?.response_time_p95_ms)
      .sort((a, b) => a.benchmark.response_time_p95_ms - b.benchmark.response_time_p95_ms)[0] || candidates[0];
  }

  /**
   * Select by lowest cost
   */
  selectByCost(candidates) {
    return candidates
      .filter(c => c.pricing?.price_per_call_usd !== undefined)
      .sort((a, b) => a.pricing.price_per_call_usd - b.pricing.price_per_call_usd)[0] || candidates[0];
  }

  /**
   * Select by highest health score
   */
  selectByHealth(candidates) {
    return candidates.sort((a, b) => (b.trust_score || 0) - (a.trust_score || 0))[0];
  }

  /**
   * Select by geographic proximity
   */
  selectByGeographic(candidates, country) {
    // Phase 3: no geo data available, fallback to weighted
    // In production, use tool.region or latency by country
    return this.selectWeighted(candidates);
  }
}
