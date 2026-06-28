/**
 * MetaMesh-UGA Security Worker
 * 
 * Runs security scans on MCP servers and updates security scores.
 * Daily cron at 03:30.
 */

import { SecurityScanner } from './scanner.js';

export default {
  async scheduled(event, env, ctx) {
    console.log('Security scan job started at:', new Date().toISOString());
    
    try {
      const scanner = new SecurityScanner(env.DB, env);
      const results = await scanner.scanAll();
      console.log('Security scan job completed:', results);
      
      if (env.TELEGRAM_BOT_TOKEN) {
        await sendTelegramNotification(
          env,
          `🛡️ Security Scan\nScanned: ${results.scanned}\nUpdated: ${results.updated}\nFailed: ${results.failed}`
        );
      }
      
      return results;
    } catch (error) {
      console.error('Security scan job failed:', error);
      if (env.TELEGRAM_BOT_TOKEN) {
        await sendTelegramNotification(env, `❌ Security scan failed: ${error.message}`);
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
        worker: 'security',
        timestamp: new Date().toISOString()
      });
    }
    
    if (url.pathname === '/v1/security/:name') {
      const toolName = url.pathname.split('/')[3];
      const scanner = new SecurityScanner(env.DB, env);
      const scan = await scanner.getScan(toolName);
      
      if (!scan) {
        return jsonResponse({ error: 'No scan found' }, 404);
      }
      
      return jsonResponse(scan);
    }
    
    if (adminKey !== env.ADMIN_KEY) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    if (url.pathname === '/v1/admin/security/scan' && request.method === 'POST') {
      const scanner = new SecurityScanner(env.DB, env);
      const results = await scanner.scanAll();
      return jsonResponse(results);
    }
    
    if (url.pathname.startsWith('/v1/admin/security/scan/') && request.method === 'POST') {
      const toolName = url.pathname.split('/').pop();
      const scanner = new SecurityScanner(env.DB, env);
      
      const tool = await env.DB.prepare(
        'SELECT name, source_url, registry_url, schema, description, capabilities FROM tools WHERE name = ?'
      ).bind(toolName).first();
      
      if (!tool) {
        return jsonResponse({ error: 'Tool not found' }, 404);
      }
      
      const scan = await scanner.scan(tool);
      await scanner.storeResults(toolName, scan);
      await scanner.updateToolScore(toolName, scan);
      
      return jsonResponse(scan);
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
