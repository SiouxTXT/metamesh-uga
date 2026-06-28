/**
 * MetaMesh-UGA Cache Worker
 * 
 * Provides cache management and invalidation endpoints.
 */

import { CacheEngine } from '../../gateway/src/cache.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const adminKey = request.headers.get('X-Admin-Key');
    
    if (url.pathname === '/health') {
      return jsonResponse({
        status: 'healthy',
        worker: 'cache',
        timestamp: new Date().toISOString()
      });
    }
    
    if (adminKey !== env.ADMIN_KEY) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    const cache = new CacheEngine(env.CACHE);
    
    if (url.pathname === '/v1/admin/cache/invalidate' && request.method === 'POST') {
      try {
        const body = await request.json();
        const prefix = body.prefix || 'all';
        
        if (prefix === 'all') {
          // L1 memory cleared
          cache.memory.clear();
          return jsonResponse({ invalidated: 'all' });
        }
        
        await cache.invalidate(prefix);
        return jsonResponse({ invalidated: prefix });
      } catch (error) {
        return jsonResponse({ error: error.message }, 400);
      }
    }
    
    if (url.pathname === '/v1/admin/cache/stats') {
      return jsonResponse({
        memory_keys: cache.memory.size,
        kv_available: !!env.CACHE
      });
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
