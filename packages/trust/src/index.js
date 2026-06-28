/**
 * MetaMesh-UGA Trust Worker
 * 
 * Computes and updates trust scores for all MCP servers.
 * Runs daily at 03:00 via cron trigger.
 * Also exposes HTTP endpoints for manual operations and queries.
 */

import { TrustScoreEngine } from './trust-score.js';

export default {
  // Cron trigger: daily trust score recalculation
  async scheduled(event, env, ctx) {
    console.log('Trust score job started at:', new Date().toISOString());
    
    try {
      const engine = new TrustScoreEngine(env.DB);
      const results = await engine.calculateAll();
      
      console.log('Trust score job completed:', results);
      
      if (env.TELEGRAM_BOT_TOKEN) {
        await sendTelegramNotification(
          env,
          `⭐ Trust Score Update\nProcessed: ${results.processed}\nUpdated: ${results.updated}\nFailed: ${results.failed}`
        );
      }
      
      return results;
    } catch (error) {
      console.error('Trust score job failed:', error);
      
      if (env.TELEGRAM_BOT_TOKEN) {
        await sendTelegramNotification(
          env,
          `❌ Trust score job failed: ${error.message}`
        );
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
        worker: 'trust',
        timestamp: new Date().toISOString()
      });
    }
    
    // Get trust score for a specific tool
    if (url.pathname.startsWith('/v1/tools/') && url.pathname.endsWith('/trust')) {
      const toolName = url.pathname.split('/')[3];
      const engine = new TrustScoreEngine(env.DB);
      const score = await engine.getScore(toolName);
      
      if (!score) {
        return jsonResponse({ error: 'Tool not found' }, 404);
      }
      
      return jsonResponse(score);
    }
    
    // Get top trusted tools
    if (url.pathname === '/v1/tools/trusted') {
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const minScore = parseFloat(url.searchParams.get('min_score') || '0.7');
      const engine = new TrustScoreEngine(env.DB);
      const tools = await engine.getTopTrusted(limit, minScore);
      return jsonResponse({ total: tools.length, tools });
    }
    
    // Admin: recalculate all trust scores
    if (url.pathname === '/v1/admin/trust/recalculate' && request.method === 'POST') {
      if (adminKey !== env.ADMIN_KEY) {
        return new Response('Unauthorized', { status: 401 });
      }
      
      const engine = new TrustScoreEngine(env.DB);
      const results = await engine.calculateAll();
      return jsonResponse(results);
    }
    
    // Admin: recalculate single tool
    if (url.pathname.startsWith('/v1/admin/trust/recalculate/') && request.method === 'POST') {
      if (adminKey !== env.ADMIN_KEY) {
        return new Response('Unauthorized', { status: 401 });
      }
      
      const toolName = url.pathname.split('/').pop();
      const engine = new TrustScoreEngine(env.DB);
      const score = await engine.calculate(toolName);
      await engine.store(score);
      
      return jsonResponse(score);
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
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    return;
  }
  
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
