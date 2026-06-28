/**
 * MetaMesh-UGA Lifecycle Worker
 * 
 * Centralizes lifecycle management for all MCP tools.
 * Daily cron at 01:00.
 */

import { LifecycleManager } from './lifecycle.js';

export default {
  async scheduled(event, env, ctx) {
    console.log('Lifecycle job started at:', new Date().toISOString());
    
    try {
      const manager = new LifecycleManager(env.DB);
      const results = await manager.evaluateAll();
      console.log('Lifecycle job completed:', results);
      
      if (env.TELEGRAM_BOT_TOKEN && results.transitioned > 0) {
        await sendTelegramNotification(
          env,
          `🔄 Lifecycle Update\nEvaluated: ${results.evaluated}\nTransitioned: ${results.transitioned}\nErrors: ${results.errors}`
        );
      }
      
      return results;
    } catch (error) {
      console.error('Lifecycle job failed:', error);
      if (env.TELEGRAM_BOT_TOKEN) {
        await sendTelegramNotification(env, `❌ Lifecycle failed: ${error.message}`);
      }
      throw error;
    }
  },
  
  async fetch(request, env) {
    const url = new URL(request.url);
    const adminKey = request.headers.get('X-Admin-Key');
    
    if (url.pathname === '/health') {
      return jsonResponse({
        status: 'healthy',
        worker: 'lifecycle',
        timestamp: new Date().toISOString()
      });
    }
    
    if (url.pathname.startsWith('/v1/lifecycle/')) {
      const toolName = url.pathname.split('/')[3];
      const manager = new LifecycleManager(env.DB);
      const history = await manager.getHistory(toolName);
      return jsonResponse({ tool: toolName, history });
    }
    
    if (adminKey !== env.ADMIN_KEY) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    if (url.pathname === '/v1/admin/lifecycle/evaluate' && request.method === 'POST') {
      const manager = new LifecycleManager(env.DB);
      const results = await manager.evaluateAll();
      return jsonResponse(results);
    }
    
    if (url.pathname.startsWith('/v1/admin/lifecycle/evaluate/') && request.method === 'POST') {
      const toolName = url.pathname.split('/').pop();
      const manager = new LifecycleManager(env.DB);
      
      const tool = await env.DB.prepare(
        `SELECT t.name, t.state, t.description, t.schema, t.security_score, t.malware_detected,
                t.trust_score, t.popularity_score, t.deprecated_since,
                b.benchmark_score
         FROM tools t
         LEFT JOIN (
           SELECT tool_name, benchmark_score
           FROM benchmark_results
           WHERE (tool_name, benchmarked_at) IN (
             SELECT tool_name, MAX(benchmarked_at)
             FROM benchmark_results
             GROUP BY tool_name
           )
         ) b ON t.name = b.tool_name
         WHERE t.name = ?`
      ).bind(toolName).first();
      
      if (!tool) {
        return jsonResponse({ error: 'Tool not found' }, 404);
      }
      
      const result = await manager.evaluateTool(tool);
      return jsonResponse(result);
    }
    
    return jsonResponse({ error: 'Not found' }, 404);
  }
};

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
