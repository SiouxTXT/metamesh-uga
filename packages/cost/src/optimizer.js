/**
 * MetaMesh-UGA Cost Optimizer
 * 
 * Optimizes tool selection based on cost constraints and user plans.
 * Provides cost estimates and finds the cheapest tool that meets requirements.
 */

export const PLANS = {
  free: { monthly_budget: 0, included_calls: 1000, rate_limit: 100 },
  pro: { monthly_budget: 19, included_calls: Infinity, rate_limit: 1000 },
  enterprise: { monthly_budget: 499, included_calls: Infinity, rate_limit: 10000 }
};

export class CostOptimizer {
  constructor(db) {
    this.db = db;
  }

  /**
   * Get pricing for a tool
   */
  async getToolPrice(toolName) {
    const pricing = await this.db.prepare(
      `SELECT price_per_call_usd, x402_enabled FROM tool_pricing WHERE tool_name = ?`
    ).bind(toolName).first();

    return {
      price_per_call: pricing?.price_per_call_usd || 0.001,
      x402_enabled: pricing?.x402_enabled !== 0
    };
  }

  /**
   * Estimate cost for a number of calls
   */
  async estimateCost(toolName, callCount = 1) {
    const pricing = await this.getToolPrice(toolName);
    const total = pricing.price_per_call * callCount;

    return {
      tool_name: toolName,
      call_count: callCount,
      price_per_call: pricing.price_per_call,
      x402_enabled: pricing.x402_enabled,
      total_cost_usd: Math.round(total * 10000) / 10000
    };
  }

  /**
   * Find the cheapest tool for a category or capability
   */
  async optimize(options = {}) {
    const category = options.category;
    const capability = options.capability;
    const maxCost = options.max_cost_usd;
    const minTrust = options.min_trust || 0.5;
    const limit = Math.min(options.limit || 5, 20);

    let whereClause = 'WHERE t.deprecated = FALSE AND t.state IN (\'ACTIVE\', \'RANKED\', \'BENCHMARKED\')';
    const params = [];

    if (category) {
      whereClause += ' AND t.category = ?';
      params.push(category);
    }

    if (minTrust > 0) {
      whereClause += ' AND t.trust_score >= ?';
      params.push(minTrust);
    }

    const tools = await this.db.prepare(
      `SELECT t.name, t.version, t.category, t.description, t.trust_score,
              t.security_score, p.price_per_call_usd, p.x402_enabled
       FROM tools t
       LEFT JOIN tool_pricing p ON t.name = p.tool_name
       ${whereClause}
       ORDER BY p.price_per_call_usd ASC, t.trust_score DESC
       LIMIT ?`
    ).bind(...params, limit).all();

    let results = (tools.results || []).map(tool => ({
      name: tool.name,
      version: tool.version,
      category: tool.category,
      trust_score: tool.trust_score,
      security_score: tool.security_score,
      price_per_call_usd: tool.price_per_call_usd || 0.001,
      x402_enabled: tool.x402_enabled !== 0,
      score: this.calculateCostScore(tool)
    }));

    if (maxCost) {
      results = results.filter(r => r.price_per_call_usd <= maxCost);
    }

    return {
      category,
      capability,
      total: results.length,
      cheapest: results[0] || null,
      options: results
    };
  }

  /**
   * Calculate cost-quality score
   */
  calculateCostScore(tool) {
    const cost = tool.price_per_call_usd || 0.001;
    const trust = tool.trust_score || 0.5;
    const security = tool.security_score || 0.5;

    // Lower cost and higher trust/security is better
    const costScore = Math.max(1 - cost * 100, 0);
    return (costScore * 0.4 + trust * 0.35 + security * 0.25);
  }

  /**
   * Get user plan and budget
   */
  async getUserPlan(userId) {
    // Phase 3: simplified, read from users table
    const user = await this.db.prepare(
      'SELECT plan, monthly_budget FROM users WHERE id = ?'
    ).bind(userId).first();

    const plan = user?.plan || 'free';
    const planConfig = PLANS[plan] || PLANS.free;

    return {
      plan,
      monthly_budget_usd: planConfig.monthly_budget,
      included_calls: planConfig.included_calls,
      rate_limit: planConfig.rate_limit
    };
  }

  /**
   * Check if a request is within budget
   */
  async checkBudget(userId, toolName, estimatedCalls = 1) {
    const plan = await this.getUserPlan(userId);
    const estimate = await this.estimateCost(toolName, estimatedCalls);
    
    const usage = await this.db.prepare(
      `SELECT COALESCE(SUM(amount), 0) as spent
       FROM transactions
       WHERE user_id = ?
         AND created_at > datetime('now', '-30 days')
         AND status = 'completed'`
    ).bind(userId).first();

    const spent = usage?.spent || 0;
    const remaining = plan.monthly_budget_usd - spent;
    const affordable = estimate.total_cost_usd <= remaining;

    return {
      plan,
      estimate,
      spent_usd_30d: spent,
      remaining_budget_usd: remaining,
      affordable
    };
  }
}
