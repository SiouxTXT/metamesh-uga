/**
 * MetaMesh-UGA Self-Healing Worker
 * 
 * Automatically detects issues and applies remediation actions.
 * Runs every 5 minutes.
 */

import { SelfHealingEngine } from './healing.js';

export default {
  async scheduled(event, env, ctx) {
    console.log('Self-healing job started at:', new Date().toISOString());
    
    try {
      const engine = new SelfHealingEngine(env.DB, env);
      const results = await engine.run();
      console.log('Self-healing job completed:', results);
      
      if (env.TELEGRAM_BOT_TOKEN && results.actions.length > 0) {
        await sendTelegramNotification(
          env,
          `🩹 Self-Healing\nActions: ${results.actions.length}\nErrors: ${results.errors.length}`
        );
      }
      
      return results;
    } catch (error) {
      console.error('Self-healing job failed:', error);
      if (env.TELEGRAM_BOT_TOKEN) {
        await sendTelegramNotification(env, `❌ Self-healing failed: ${error.message}`);
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
        worker: 'self-healing',
        timestamp: new Date().toISOString()
      });
    }
    
    if (url.pathname === '/v1/history') {
      const engine = new SelfHealingEngine(env.DB, env);
      const history = await engine.getHistory();
      return jsonResponse({ total: history.length, history });
    }
    
    if (adminKey !== env.ADMIN_KEY) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    if (url.pathname === '/v1/admin/heal' && request.method === 'POST') {
      const engine = new SelfHealingEngine(env.DB, env);
      const results = await engine.run();
      return jsonResponse(results);
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
