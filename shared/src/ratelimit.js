/**
 * Rate Limiting Module
 * MetaMesh-UGA - Shared Library
 */

/**
 * Get rate limit for plan
 * @param {string} plan
 * @returns {number} Requests per minute
 */
export function getRateLimitForPlan(plan) {
  const limits = {
    'free': 100,
    'pro': 1000,
    'enterprise': 10000,
    'pay_as_you_go': 1000
  };
  return limits[plan] || 100;
}

/**
 * Check rate limit for user
 * @param {number} userId
 * @param {string} plan
 * @param {object} env
 * @returns {Promise<{allowed: boolean, remaining: number, resetAt: number}>}
 */
export async function checkRateLimit(userId, plan, env) {
  const limit = getRateLimitForPlan(plan);
  const key = `ratelimit:user:${userId}`;
  const windowSeconds = 60; // 1 minute window
  
  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / windowSeconds) * windowSeconds;
  const windowKey = `${key}:${windowStart}`;
  
  // Get current count
  const current = await env.CACHE.get(windowKey);
  const count = current ? parseInt(current) : 0;
  
  if (count >= limit) {
    const resetAt = (windowStart + windowSeconds) * 1000;
    return {
      allowed: false,
      remaining: 0,
      resetAt,
      limit
    };
  }
  
  // Increment count
  await env.CACHE.put(windowKey, (count + 1).toString(), { expirationTtl: windowSeconds });
  
  return {
    allowed: true,
    remaining: limit - count - 1,
    resetAt: (windowStart + windowSeconds) * 1000,
    limit
  };
}

/**
 * Check rate limit for agent
 * @param {number} agentId
 * @param {string} plan
 * @param {object} env
 * @returns {Promise<{allowed: boolean, remaining: number, resetAt: number}>}
 */
export async function checkAgentRateLimit(agentId, plan, env) {
  const limits = {
    'free': 100,
    'pay_as_you_go': 1000,
    'enterprise': 10000
  };
  
  const limit = limits[plan] || 100;
  
  // Check database for agent-specific limit
  const agentLimit = await env.DB.prepare(
    'SELECT limit_per_minute, current_count, reset_at FROM agent_rate_limits WHERE agent_id = ?'
  ).bind(agentId).first();
  
  const now = new Date().toISOString();
  const nowUnix = Math.floor(Date.now() / 1000);
  
  if (!agentLimit) {
    // Create new rate limit record
    const resetAt = new Date(Date.now() + 60000).toISOString();
    await env.DB.prepare(
      'INSERT INTO agent_rate_limits (agent_id, limit_per_minute, current_count, reset_at) VALUES (?, ?, 1, ?)'
    ).bind(agentId, limit, resetAt).run();
    
    return { allowed: true, remaining: limit - 1, resetAt: Date.now() + 60000, limit };
  }
  
  // Check if window has reset
  if (new Date(agentLimit.reset_at) < new Date()) {
    // Reset window
    const resetAt = new Date(Date.now() + 60000).toISOString();
    await env.DB.prepare(
      'UPDATE agent_rate_limits SET current_count = 1, reset_at = ? WHERE agent_id = ?'
    ).bind(resetAt, agentId).run();
    
    return { allowed: true, remaining: limit - 1, resetAt: Date.now() + 60000, limit };
  }
  
  // Check if limit exceeded
  if (agentLimit.current_count >= agentLimit.limit_per_minute) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(agentLimit.reset_at).getTime(),
      limit: agentLimit.limit_per_minute
    };
  }
  
  // Increment count
  await env.DB.prepare(
    'UPDATE agent_rate_limits SET current_count = current_count + 1 WHERE agent_id = ?'
  ).bind(agentId).run();
  
  return {
    allowed: true,
    remaining: agentLimit.limit_per_minute - agentLimit.current_count - 1,
    resetAt: new Date(agentLimit.reset_at).getTime(),
    limit: agentLimit.limit_per_minute
  };
}

/**
 * Middleware: Rate limiting for users
 * @param {Request} request
 * @param {object} env
 * @returns {Promise<Response|void>}
 */
export async function rateLimitMiddleware(request, env) {
  const user = request.user;
  if (!user) return; // Skip if no user (agent auth)
  
  const rateLimit = await checkRateLimit(user.id, user.plan, env);
  
  // Add rate limit headers
  request.rateLimitHeaders = {
    'X-RateLimit-Limit': rateLimit.limit.toString(),
    'X-RateLimit-Remaining': rateLimit.remaining.toString(),
    'X-RateLimit-Reset': Math.floor(rateLimit.resetAt / 1000).toString()
  };
  
  if (!rateLimit.allowed) {
    return new Response(
      JSON.stringify({
        error: 'RateLimitExceeded',
        message: `Rate limit exceeded (${rateLimit.limit}/min). Upgrade your plan for higher limits.`,
        plan: user.plan,
        upgrade_url: 'https://metamesh-uga.dev/pricing'
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString(),
          ...request.rateLimitHeaders
        }
      }
    );
  }
}

/**
 * Middleware: Rate limiting for agents
 * @param {Request} request
 * @param {object} env
 * @returns {Promise<Response|void>}
 */
export async function agentRateLimitMiddleware(request, env) {
  const agent = request.agent;
  if (!agent) return; // Skip if no agent (user auth)
  
  const rateLimit = await checkAgentRateLimit(agent.id, agent.plan, env);
  
  // Add rate limit headers
  request.rateLimitHeaders = {
    'X-RateLimit-Limit': rateLimit.limit.toString(),
    'X-RateLimit-Remaining': rateLimit.remaining.toString(),
    'X-RateLimit-Reset': Math.floor(rateLimit.resetAt / 1000).toString()
  };
  
  if (!rateLimit.allowed) {
    return new Response(
      JSON.stringify({
        error: 'RateLimitExceeded',
        message: `Rate limit exceeded (${rateLimit.limit}/min)`,
        agent_id: agent.agent_id
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString(),
          ...request.rateLimitHeaders
        }
      }
    );
  }
}

/**
 * Check monthly usage limit for user
 * @param {object} user
 * @param {object} env
 * @returns {Promise<{allowed: boolean, used: number, limit: number}>}
 */
export async function checkMonthlyLimit(user, env) {
  const limit = user.plan_limit || 1000;
  
  // Count usage this month
  const result = await env.DB.prepare(
    `SELECT COUNT(*) as count 
     FROM usage_log 
     WHERE user_id = ? 
     AND called_at > datetime('now', 'start of month')`
  ).bind(user.id).first();
  
  const used = result?.count || 0;
  
  // Add bonus calls
  const effectiveLimit = limit + (user.bonus_calls || 0);
  
  return {
    allowed: used < effectiveLimit,
    used,
    limit: effectiveLimit,
    remaining: effectiveLimit - used
  };
}

/**
 * Middleware: Monthly usage limit
 * @param {Request} request
 * @param {object} env
 * @returns {Promise<Response|void>}
 */
export async function monthlyLimitMiddleware(request, env) {
  const user = request.user;
  if (!user) return; // Skip for agents
  
  // Skip for pro/enterprise (unlimited)
  if (user.plan === 'pro' || user.plan === 'enterprise') {
    return;
  }
  
  const usage = await checkMonthlyLimit(user, env);
  
  // Add usage headers
  request.usageHeaders = {
    'X-Monthly-Limit': usage.limit.toString(),
    'X-Monthly-Used': usage.used.toString(),
    'X-Monthly-Remaining': usage.remaining.toString()
  };
  
  if (!usage.allowed) {
    return new Response(
      JSON.stringify({
        error: 'MonthlyLimitExceeded',
        message: `Monthly limit exceeded (${usage.limit} calls). Upgrade to Pro for unlimited access.`,
        plan: user.plan,
        used: usage.used,
        limit: usage.limit,
        upgrade_url: 'https://metamesh-uga.dev/pricing'
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...request.usageHeaders
        }
      }
    );
  }
}
