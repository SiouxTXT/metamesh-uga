/**
 * MetaMesh-UGA Health Worker
 * 
 * Performs periodic health checks on MCP servers and manages degradation.
 * Runs every 10 minutes.
 */

import { HealthEngine } from './health.js';

export default {
  async scheduled(event, env, ctx) {
    console.log('Health check job started at:', new Date().toISOString());
    
    try {
      const engine = new HealthEngine(env.DB, env);
      const results = await engine.checkAll();
      console.log('Health check job completed:', results);
      
      if (env.TELEGRAM_BOT_TOKEN && (results.unhealthy > 0 || results.evicted > 0)) {
        await sendTelegramNotification(
          env,
          `🏥 Health Check\nChecked: ${results.checked}\nHealthy: ${results.healthy}\nDegraded: ${results.degraded}\nUnhealthy: ${results.unhealthy}\nEvicted: ${results.evicted}`
        );
      }
      
      return results;
    } catch (error) {
      console.error('Health check job failed:', error);
      if (env.TELEGRAM_BOT_TOKEN) {
        await sendTelegramNotification(env, `❌ Health check failed: ${error.message}`);
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
        worker: 'health',
        timestamp: new Date().toISOString()
      });
    }
    
    if (url.pathname === '/v1/health') {
      const engine = new HealthEngine(env.DB, env);
      const status = await engine.getHealthStatus();
      return jsonResponse({ total: status.length, status });
    }
    
    if (url.pathname.startsWith('/v1/health/')) {
      const toolName = url.pathname.split('/')[3];
      const engine = new HealthEngine(env.DB, env);
      const history = await engine.getHistory(toolName);
      return jsonResponse({ tool: toolName, history });
    }
    
    if (adminKey !== env.ADMIN_KEY) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    if (url.pathname === '/v1/admin/health/check' && request.method === 'POST') {
      const engine = new HealthEngine(env.DB, env);
      const results = await engine.checkAll();
      return jsonResponse(results);
    }
    
    if (url.pathname.startsWith('/v1/admin/health/check/') && request.method === 'POST') {
      const toolName = url.pathname.split('/').pop();
      const engine = new HealthEngine(env.DB, env);
      
      const tool = await env.DB.prepare(
        'SELECT name, source_url, registry_url, state FROM tools WHERE name = ?'
      ).bind(toolName).first();
      
      if (!tool) {
        return jsonResponse({ error: 'Tool not found' }, 404);
      }
      
      const result = await engine.checkTool(tool);
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
