/**
 * MetaMesh-UGA Eliminatore Worker
 * 
 * Removes deprecated tools from the catalog:
 * - Marks tools as deprecated if source is unreachable or gone
 * - Archives tools deprecated for more than 90 days
 * - Performs soft delete only (deprecated flag)
 */

export default {
  // Cron: weekly on Sundays at 05:00
  async scheduled(event, env, ctx) {
    console.log('Eliminatore job started at:', new Date().toISOString());
    
    try {
      const results = await cleanupDeprecated(env);
      console.log('Eliminatore job completed:', results);
      
      if (env.TELEGRAM_BOT_TOKEN && (results.deprecated > 0 || results.archived > 0)) {
        await sendTelegramNotification(
          env,
          `🗑️ Eliminatore completed\nDeprecated: ${results.deprecated}\nArchived: ${results.archived}`
        );
      }
      
      return results;
    } catch (error) {
      console.error('Eliminatore job failed:', error);
      if (env.TELEGRAM_BOT_TOKEN) {
        await sendTelegramNotification(env, `❌ Eliminatore failed: ${error.message}`);
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
        worker: 'eliminatore',
        timestamp: new Date().toISOString()
      });
    }
    
    // Admin only
    if (adminKey !== env.ADMIN_KEY) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    // Trigger cleanup
    if (url.pathname === '/v1/admin/cleanup' && request.method === 'POST') {
      const results = await cleanupDeprecated(env);
      return jsonResponse(results);
    }
    
    return jsonResponse({ error: 'Not found' }, 404);
  }
};

async function cleanupDeprecated(env) {
  const results = {
    deprecated: 0,
    archived: 0,
    errors: 0
  };
  
  // Mark old DISCOVERED tools with no metadata as deprecated
  // These are tools that were discovered but never validated
  try {
    const stale = await env.DB.prepare(
      `SELECT name FROM tools
       WHERE state = 'DISCOVERED'
         AND deprecated = FALSE
         AND created_at < datetime('now', '-30 days')
         AND (description IS NULL OR description = '')`
    ).all();
    
    for (const tool of stale.results || []) {
      try {
        await env.DB.prepare(
          `UPDATE tools
           SET deprecated = TRUE,
               deprecated_since = CURRENT_TIMESTAMP,
               state = 'DEPRECATED',
               state_updated = CURRENT_TIMESTAMP
           WHERE name = ?`
        ).bind(tool.name).run();
        
        await env.DB.prepare(
          `INSERT INTO lifecycle_log (tool_name, from_state, to_state, reason)
           VALUES (?, 'DISCOVERED', 'DEPRECATED', 'Stale discovery with no metadata')`
        ).bind(tool.name).run();
        
        results.deprecated++;
      } catch (error) {
        results.errors++;
        console.error(`Deprecation failed for ${tool.name}:`, error);
      }
    }
  } catch (error) {
    results.errors++;
    console.error('Stale deprecation failed:', error);
  }
  
  // Archive tools deprecated for more than 90 days
  try {
    const oldDeprecated = await env.DB.prepare(
      `SELECT name FROM tools
       WHERE state = 'DEPRECATED'
         AND deprecated_since < datetime('now', '-90 days')`
    ).all();
    
    for (const tool of oldDeprecated.results || []) {
      try {
        await env.DB.prepare(
          `UPDATE tools
           SET state = 'ARCHIVED',
               state_updated = CURRENT_TIMESTAMP
           WHERE name = ?`
        ).bind(tool.name).run();
        
        await env.DB.prepare(
          `INSERT INTO lifecycle_log (tool_name, from_state, to_state, reason)
           VALUES (?, 'DEPRECATED', 'ARCHIVED', 'Deprecated for more than 90 days')`
        ).bind(tool.name).run();
        
        results.archived++;
      } catch (error) {
        results.errors++;
        console.error(`Archive failed for ${tool.name}:`, error);
      }
    }
  } catch (error) {
    results.errors++;
    console.error('Archive sweep failed:', error);
  }
  
  return results;
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

