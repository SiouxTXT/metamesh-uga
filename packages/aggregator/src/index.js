/**
 * MetaMesh-UGA Aggregator Worker
 * 
 * Aggregates and normalizes MCP server data:
 * - Rebuilds routing table from tools catalog
 * - Computes category statistics
 * - Aggregates usage metrics
 * - Updates tool popularity scores
 */

export default {
  // Cron: daily at 04:00
  async scheduled(event, env, ctx) {
    console.log('Aggregator job started at:', new Date().toISOString());
    
    try {
      const results = await aggregateData(env);
      console.log('Aggregator job completed:', results);
      
      if (env.TELEGRAM_BOT_TOKEN && (results.routing_updated > 0 || results.popularity_updated > 0)) {
        await sendTelegramNotification(
          env,
          `📊 Aggregator completed\nRouting entries: ${results.routing_updated}\nPopularity updated: ${results.popularity_updated}`
        );
      }
      
      return results;
    } catch (error) {
      console.error('Aggregator job failed:', error);
      if (env.TELEGRAM_BOT_TOKEN) {
        await sendTelegramNotification(env, `❌ Aggregator failed: ${error.message}`);
      }
      throw error;
    }
  },
  
  // HTTP endpoints
  async fetch(request, env) {
    const url = new URL(request.url);
    const adminKey = request.headers.get('X-Admin-Key');
    
    // Health check
    if (url.pathname === '/health') {
      return jsonResponse({
        status: 'healthy',
        worker: 'aggregator',
        timestamp: new Date().toISOString()
      });
    }
    
    // Admin only
    if (adminKey !== env.ADMIN_KEY) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    // Trigger aggregation
    if (url.pathname === '/v1/admin/aggregate' && request.method === 'POST') {
      const results = await aggregateData(env);
      return jsonResponse(results);
    }
    
    // Get aggregated stats
    if (url.pathname === '/v1/stats') {
      const stats = await getStats(env);
      return jsonResponse(stats);
    }
    
    return jsonResponse({ error: 'Not found' }, 404);
  }
};

async function aggregateData(env) {
  const results = {
    routing_updated: 0,
    popularity_updated: 0,
    categories_updated: 0,
    errors: 0
  };
  
  // Rebuild routing table
  try {
    const tools = await env.DB.prepare(
      `SELECT name, category FROM tools WHERE deprecated = FALSE AND state IN ('RANKED', 'ACTIVE', 'BENCHMARKED')`
    ).all();
    
    for (const tool of tools.results || []) {
      try {
        await env.DB.prepare(
          `INSERT INTO routing (tool_name, category, latency_ms, success_rate, last_used)
           VALUES (?, ?, 0, 1.0, NULL)
           ON CONFLICT(tool_name) DO UPDATE SET
             category = excluded.category,
             success_rate = 1.0`
        ).bind(tool.name, tool.category).run();
        results.routing_updated++;
      } catch (error) {
        results.errors++;
        console.error(`Routing update failed for ${tool.name}:`, error);
      }
    }
  } catch (error) {
    results.errors++;
    console.error('Routing table aggregation failed:', error);
  }
  
  // Update popularity scores from usage
  try {
    const popularity = await env.DB.prepare(
      `SELECT tool_name, COUNT(*) as calls
       FROM usage_log
       WHERE called_at > datetime('now', '-30 days')
       GROUP BY tool_name`
    ).all();
    
    for (const row of popularity.results || []) {
      try {
        await env.DB.prepare(
          `UPDATE tools SET popularity_score = ?, last_updated = CURRENT_TIMESTAMP WHERE name = ?`
        ).bind(Math.min(row.calls, 10000), row.tool_name).run();
        results.popularity_updated++;
      } catch (error) {
        results.errors++;
        console.error(`Popularity update failed for ${row.tool_name}:`, error);
      }
    }
  } catch (error) {
    results.errors++;
    console.error('Popularity aggregation failed:', error);
  }
  
  return results;
}

async function getStats(env) {
  const tools = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM tools WHERE deprecated = FALSE`
  ).first();
  
  const routing = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM routing`
  ).first();
  
  const categories = await env.DB.prepare(
    `SELECT category, COUNT(*) as count FROM tools WHERE deprecated = FALSE GROUP BY category ORDER BY count DESC`
  ).all();
  
  const usage = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM usage_log WHERE called_at > datetime('now', '-24 hours')`
  ).first();
  
  return {
    timestamp: new Date().toISOString(),
    tools: tools?.total || 0,
    routing_entries: routing?.total || 0,
    categories: categories.results || [],
    usage_24h: usage?.total || 0
  };
}

function jsonResponse(data, status = 200) {
  return new Response(
    JSON.stringify(data, null, 2),
    { status, headers: { 'Content-Type': 'application/json' } }
  );
}

async function sendTelegramNotification(env, message) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
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

