/**
 * MetaMesh-UGA Updater Worker
 * 
 * Updates existing tools in the catalog:
 * - Refreshes metadata from registry sources
 * - Performs lifecycle transitions for DISCOVERED → VALIDATED
 * - Updates last_updated timestamps
 */

export default {
  // Cron: daily at 02:00
  async scheduled(event, env, ctx) {
    console.log('Updater job started at:', new Date().toISOString());
    
    try {
      const results = await updateTools(env);
      console.log('Updater job completed:', results);
      
      if (env.TELEGRAM_BOT_TOKEN && (results.updated > 0 || results.validated > 0)) {
        await sendTelegramNotification(
          env,
          `🔄 Updater completed\nUpdated: ${results.updated}\nValidated: ${results.validated}\nErrors: ${results.errors}`
        );
      }
      
      return results;
    } catch (error) {
      console.error('Updater job failed:', error);
      if (env.TELEGRAM_BOT_TOKEN) {
        await sendTelegramNotification(env, `❌ Updater failed: ${error.message}`);
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
        worker: 'updater',
        timestamp: new Date().toISOString()
      });
    }
    
    // Admin only
    if (adminKey !== env.ADMIN_KEY) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    // Trigger update
    if (url.pathname === '/v1/admin/update' && request.method === 'POST') {
      const results = await updateTools(env);
      return jsonResponse(results);
    }
    
    return jsonResponse({ error: 'Not found' }, 404);
  }
};

async function updateTools(env) {
  const results = {
    updated: 0,
    validated: 0,
    errors: 0
  };
  
  // Transition DISCOVERED → VALIDATED
  // Validation: tool has non-empty description and schema
  try {
    const discovered = await env.DB.prepare(
      `SELECT name, description, schema FROM tools WHERE state = 'DISCOVERED' AND deprecated = FALSE`
    ).all();
    
    for (const tool of discovered.results || []) {
      try {
        const hasDescription = tool.description && tool.description.length > 10;
        const hasSchema = tool.schema && tool.schema !== 'null';
        
        if (hasDescription && hasSchema) {
          await env.DB.prepare(
            `UPDATE tools SET state = 'VALIDATED', state_updated = CURRENT_TIMESTAMP WHERE name = ?`
          ).bind(tool.name).run();
          
          await env.DB.prepare(
            `INSERT INTO lifecycle_log (tool_name, from_state, to_state, reason)
             VALUES (?, 'DISCOVERED', 'VALIDATED', 'Metadata validation passed')`
          ).bind(tool.name).run();
          
          results.validated++;
        }
      } catch (error) {
        results.errors++;
        console.error(`Validation failed for ${tool.name}:`, error);
      }
    }
  } catch (error) {
    results.errors++;
    console.error('Validation sweep failed:', error);
  }
  
  // Update last_updated timestamp for active tools
  try {
    const updateResult = await env.DB.prepare(
      `UPDATE tools SET last_updated = CURRENT_TIMESTAMP
       WHERE state IN ('RANKED', 'ACTIVE') AND deprecated = FALSE`
    ).run();
    results.updated = updateResult.meta?.changes || 0;
  } catch (error) {
    results.errors++;
    console.error('Active tools refresh failed:', error);
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

