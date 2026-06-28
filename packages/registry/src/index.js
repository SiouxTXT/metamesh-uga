/**
 * MetaMesh-UGA Registry Worker
 * 
 * Manages registry federation, sync, and snapshots.
 * Runs every 6 hours.
 */

import { RegistryFederation } from './federation.js';
import { RegistryMirror } from './mirror.js';

export default {
  async scheduled(event, env, ctx) {
    console.log('Registry sync job started at:', new Date().toISOString());
    
    try {
      const federation = new RegistryFederation(env.DB, env);
      const result = await federation.sync();
      
      // Update source statuses
      for (const [name, sourceResult] of Object.entries(result.sources)) {
        await federation.updateSourceStatus(name, sourceResult.success ? 'success' : 'failed');
      }
      
      console.log('Registry sync completed:', result);
      
      if (env.TELEGRAM_BOT_TOKEN) {
        await sendTelegramNotification(
          env,
          `🗄️ Registry Sync\nSources: ${Object.keys(result.sources).length}\nMerged: ${result.merged}\nErrors: ${result.errors}`
        );
      }
      
      return result;
    } catch (error) {
      console.error('Registry sync failed:', error);
      if (env.TELEGRAM_BOT_TOKEN) {
        await sendTelegramNotification(env, `❌ Registry sync failed: ${error.message}`);
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
        worker: 'registry',
        timestamp: new Date().toISOString()
      });
    }
    
    if (url.pathname === '/v1/registry/sources') {
      const federation = new RegistryFederation(env.DB, env);
      const sources = await federation.getSources();
      return jsonResponse({ total: sources.length, sources });
    }
    
    if (url.pathname === '/v1/registry/sync') {
      const federation = new RegistryFederation(env.DB, env);
      const result = await federation.sync();
      for (const [name, sourceResult] of Object.entries(result.sources)) {
        await federation.updateSourceStatus(name, sourceResult.success ? 'success' : 'failed');
      }
      return jsonResponse(result);
    }
    
    if (adminKey !== env.ADMIN_KEY) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    if (url.pathname === '/v1/admin/registry/sources' && request.method === 'POST') {
      try {
        const body = await request.json();
        const federation = new RegistryFederation(env.DB, env);
        await federation.addSource(body);
        return jsonResponse({ success: true, source: body }, 201);
      } catch (error) {
        return jsonResponse({ error: error.message }, 400);
      }
    }
    
    if (url.pathname === '/v1/admin/registry/sync' && request.method === 'POST') {
      const federation = new RegistryFederation(env.DB, env);
      const result = await federation.sync();
      for (const [name, sourceResult] of Object.entries(result.sources)) {
        await federation.updateSourceStatus(name, sourceResult.success ? 'success' : 'failed');
      }
      return jsonResponse(result);
    }
    
    // Registry mirroring endpoints
    if (url.pathname === '/v1/admin/registry/snapshot' && request.method === 'POST') {
      try {
        const body = await request.json();
        const mirror = new RegistryMirror(env.DB, env.REGISTRY_MIRROR);
        const snapshot = await mirror.snapshot(body.name);
        return jsonResponse(snapshot, 201);
      } catch (error) {
        return jsonResponse({ error: error.message }, 400);
      }
    }
    
    if (url.pathname === '/v1/admin/registry/snapshots' && request.method === 'GET') {
      const mirror = new RegistryMirror(env.DB, env.REGISTRY_MIRROR);
      const snapshots = await mirror.listSnapshots();
      return jsonResponse({ total: snapshots.length, snapshots });
    }
    
    if (url.pathname === '/v1/admin/registry/restore' && request.method === 'POST') {
      try {
        const body = await request.json();
        const mirror = new RegistryMirror(env.DB, env.REGISTRY_MIRROR);
        const result = await mirror.restore(body.key);
        return jsonResponse(result);
      } catch (error) {
        return jsonResponse({ error: error.message }, 400);
      }
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
