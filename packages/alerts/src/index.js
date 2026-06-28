/**
 * MetaMesh-UGA Alerts Worker
 * 
 * Monitors system health and sends alerts via Telegram, Email, Discord
 * Runs every 10 minutes via cron trigger.
 */

export default {
  async scheduled(event, env, ctx) {
    console.log('Alert check started at:', new Date().toISOString());
    
    const alerts = [];
    
    // Check error rate
    try {
      const errorAlert = await checkErrorRate(env);
      if (errorAlert) alerts.push(errorAlert);
    } catch (e) {
      console.error('Error rate check failed:', e);
    }
    
    // Check latency
    try {
      const latencyAlert = await checkLatency(env);
      if (latencyAlert) alerts.push(latencyAlert);
    } catch (e) {
      console.error('Latency check failed:', e);
    }
    
    // Check rate limiting
    try {
      const rateLimitAlert = await checkRateLimits(env);
      if (rateLimitAlert) alerts.push(rateLimitAlert);
    } catch (e) {
      console.error('Rate limit check failed:', e);
    }
    
    // Check database size
    try {
      const dbAlert = await checkDatabaseSize(env);
      if (dbAlert) alerts.push(dbAlert);
    } catch (e) {
      console.error('Database check failed:', e);
    }
    
    // Check budget alerts for agents
    try {
      const budgetAlerts = await checkAgentBudgets(env);
      alerts.push(...budgetAlerts);
    } catch (e) {
      console.error('Budget check failed:', e);
    }
    
    // Send notifications
    if (alerts.length > 0) {
      await sendNotifications(env, alerts);
    }
    
    // Log check
    await env.ANALYTICS?.writeDataPoint({
      blobs: ['alert_check', alerts.length > 0 ? 'alert' : 'ok'],
      doubles: [alerts.length],
      indexes: ['monitoring', 'cron']
    });
    
    console.log('Alert check completed:', alerts.length, 'alerts');
  },
  
  // Manual check endpoint
  async fetch(request, env) {
    const adminKey = request.headers.get('X-Admin-Key');
    if (adminKey !== env.ADMIN_KEY) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    const alerts = [];
    
    const errorAlert = await checkErrorRate(env);
    if (errorAlert) alerts.push(errorAlert);
    
    const latencyAlert = await checkLatency(env);
    if (latencyAlert) alerts.push(latencyAlert);
    
    const dbAlert = await checkDatabaseSize(env);
    if (dbAlert) alerts.push(dbAlert);
    
    return new Response(
      JSON.stringify({ alerts, count: alerts.length }, null, 2),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }
};

/**
 * Check error rate over last 10 minutes
 */
async function checkErrorRate(env) {
  // Query analytics for error rate
  const stats = await env.DB.prepare(
    `SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN status = 'error' THEN 1 END) as errors
    FROM usage_log 
    WHERE called_at > datetime('now', '-10 minutes')`
  ).first();
  
  if (!stats || stats.total === 0) return null;
  
  const errorRate = stats.errors / stats.total;
  const threshold = 0.05; // 5%
  
  if (errorRate > threshold) {
    return {
      type: 'error_rate_high',
      severity: 'warning',
      message: `⚠️ Error rate is ${(errorRate * 100).toFixed(2)}% (threshold: ${threshold * 100}%)`,
      details: {
        total_requests: stats.total,
        errors: stats.errors,
        error_rate: errorRate,
        threshold
      }
    };
  }
  
  return null;
}

/**
 * Check average latency
 */
async function checkLatency(env) {
  const stats = await env.DB.prepare(
    `SELECT 
      AVG(latency_ms) as avg_latency,
      PERCENTILE(latency_ms, 95) as p95_latency,
      PERCENTILE(latency_ms, 99) as p99_latency
    FROM usage_log 
    WHERE called_at > datetime('now', '-10 minutes')
    AND status = 'success'`
  ).first();
  
  if (!stats || !stats.avg_latency) return null;
  
  const avgThreshold = 500; // 500ms
  const p95Threshold = 1000; // 1s
  
  if (stats.avg_latency > avgThreshold) {
    return {
      type: 'latency_high',
      severity: 'warning',
      message: `⚠️ Average latency is ${stats.avg_latency.toFixed(0)}ms (threshold: ${avgThreshold}ms)`,
      details: {
        avg_latency: stats.avg_latency,
        p95_latency: stats.p95_latency,
        p99_latency: stats.p99_latency,
        threshold: avgThreshold
      }
    };
  }
  
  return null;
}

/**
 * Check rate limiting events
 */
async function checkRateLimits(env) {
  const stats = await env.DB.prepare(
    `SELECT 
      COUNT(*) as rate_limited_count
    FROM usage_log 
    WHERE status = 'rate_limited'
    AND called_at > datetime('now', '-10 minutes')`
  ).first();
  
  if (!stats) return null;
  
  const threshold = 100;
  
  if (stats.rate_limited_count > threshold) {
    return {
      type: 'rate_limit_exceeded',
      severity: 'info',
      message: `📊 ${stats.rate_limited_count} rate limit events in last 10 minutes`,
      details: {
        rate_limited_count: stats.rate_limited_count,
        threshold
      }
    };
  }
  
  return null;
}

/**
 * Check database size
 */
async function checkDatabaseSize(env) {
  // D1 doesn't have a direct size query, but we can estimate from row counts
  const stats = await env.DB.prepare(
    `SELECT 
      (SELECT COUNT(*) FROM tools) as tools_count,
      (SELECT COUNT(*) FROM users) as users_count,
      (SELECT COUNT(*) FROM usage_log WHERE called_at > datetime('now', '-30 days')) as recent_usage_count,
      (SELECT COUNT(*) FROM agents) as agents_count`
  ).first();
  
  if (!stats) return null;
  
  // Alert if usage_log is very large (should be cleaned up)
  if (stats.recent_usage_count > 1000000) {
    return {
      type: 'database_size',
      severity: 'warning',
      message: `📊 Database has ${stats.recent_usage_count.toLocaleString()} recent usage records`,
      details: {
        ...stats,
        recommendation: 'Consider archiving old usage logs'
      }
    };
  }
  
  return null;
}

/**
 * Check agent budgets
 */
async function checkAgentBudgets(env) {
  const alerts = [];
  
  // Check agents at 80% of budget
  const agents80 = await env.DB.prepare(
    `SELECT * FROM agents 
     WHERE budget_limit_usd > 0 
     AND current_spent_usd > budget_limit_usd * 0.8
     AND current_spent_usd < budget_limit_usd
     AND suspended = FALSE`
  ).all();
  
  for (const agent of agents80.results || []) {
    // Check if alert already sent
    const rateLimit = await env.DB.prepare(
      'SELECT alert_80_sent FROM agent_rate_limits WHERE agent_id = ?'
    ).bind(agent.id).first();
    
    if (!rateLimit?.alert_80_sent) {
      alerts.push({
        type: 'agent_budget_80',
        severity: 'info',
        message: `💰 Agent ${agent.agent_id.slice(0, 8)}... at 80% of budget ($${agent.current_spent_usd.toFixed(2)} / $${agent.budget_limit_usd})`,
        agent_id: agent.agent_id,
        details: {
          budget_limit: agent.budget_limit_usd,
          current_spent: agent.current_spent_usd,
          percent_used: (agent.current_spent_usd / agent.budget_limit_usd * 100).toFixed(1)
        }
      });
      
      // Mark alert as sent
      await env.DB.prepare(
        `INSERT INTO agent_rate_limits (agent_id, alert_80_sent) 
         VALUES (?, TRUE)
         ON CONFLICT(agent_id) DO UPDATE SET alert_80_sent = TRUE`
      ).bind(agent.id).run();
    }
  }
  
  // Check agents at 100% of budget
  const agents100 = await env.DB.prepare(
    `SELECT * FROM agents 
     WHERE budget_limit_usd > 0 
     AND current_spent_usd >= budget_limit_usd
     AND suspended = FALSE`
  ).all();
  
  for (const agent of agents100.results || []) {
    // Suspend agent
    await env.DB.prepare(
      'UPDATE agents SET suspended = TRUE, suspended_reason = ? WHERE id = ?'
    ).bind('Budget limit exceeded', agent.id).run();
    
    alerts.push({
      type: 'agent_budget_depleted',
      severity: 'warning',
      message: `🚫 Agent ${agent.agent_id.slice(0, 8)}... budget depleted ($${agent.current_spent_usd.toFixed(2)} / $${agent.budget_limit_usd}). Agent suspended.`,
      agent_id: agent.agent_id,
      details: {
        budget_limit: agent.budget_limit_usd,
        current_spent: agent.current_spent_usd
      }
    });
  }
  
  return alerts;
}

/**
 * Send notifications via all channels
 */
async function sendNotifications(env, alerts) {
  const criticalAlerts = alerts.filter(a => a.severity === 'critical');
  const warningAlerts = alerts.filter(a => a.severity === 'warning');
  const infoAlerts = alerts.filter(a => a.severity === 'info');
  
  // Build message
  let message = '<b>🚨 MetaMesh-UGA Alerts</b>\n\n';
  
  if (criticalAlerts.length > 0) {
    message += '<b>🔴 Critical:</b>\n';
    criticalAlerts.forEach(a => message += `• ${a.message}\n`);
    message += '\n';
  }
  
  if (warningAlerts.length > 0) {
    message += '<b>🟡 Warnings:</b>\n';
    warningAlerts.forEach(a => message += `• ${a.message}\n`);
    message += '\n';
  }
  
  if (infoAlerts.length > 0) {
    message += '<b>🔵 Info:</b>\n';
    infoAlerts.forEach(a => message += `• ${a.message}\n`);
  }
  
  message += `\n<i>${new Date().toISOString()}</i>`;
  
  // Send to Telegram
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    try {
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: 'HTML'
        })
      });
    } catch (error) {
      console.error('Telegram notification failed:', error);
    }
  }
  
  // Send to Discord webhook
  if (env.DISCORD_WEBHOOK_URL) {
    try {
      await fetch(env.DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: message.replace(/<[^>]+>/g, ''), // Strip HTML
          username: 'MetaMesh Alerts'
        })
      });
    } catch (error) {
      console.error('Discord notification failed:', error);
    }
  }
  
  // Log to Sentry if critical
  if (criticalAlerts.length > 0 && env.SENTRY_DSN) {
    // In production, send to Sentry
    console.error('Critical alerts:', criticalAlerts);
  }
}
