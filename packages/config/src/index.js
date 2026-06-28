/**
 * MetaMesh-UGA Config Worker
 * 
 * Provides configuration and feature flag management.
 */

import { ConfigEngine } from './config.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const adminKey = request.headers.get('X-Admin-Key');
    
    if (url.pathname === '/health') {
      return jsonResponse({
        status: 'healthy',
        worker: 'config',
        timestamp: new Date().toISOString()
      });
    }
    
    // Public endpoints for config and flags
    if (url.pathname === '/v1/config') {
      const key = url.searchParams.get('key');
      const scope = url.searchParams.get('scope') || 'global';
      const scopeId = url.searchParams.get('scope_id') || null;
      
      if (!key) {
        const engine = new ConfigEngine(env.DB, env.CONFIG_CACHE);
        const configs = await engine.list(scope, scopeId);
        return jsonResponse({ total: configs.length, configs });
      }
      
      const engine = new ConfigEngine(env.DB, env.CONFIG_CACHE);
      const value = await engine.get(key, scope, scopeId);
      return jsonResponse({ key, value });
    }
    
    if (url.pathname === '/v1/features') {
      const engine = new ConfigEngine(env.DB, env.CONFIG_CACHE);
      const flags = await engine.getFeatureFlags();
      return jsonResponse({ total: flags.length, flags });
    }
    
    if (url.pathname === '/v1/feature/:name') {
      const name = url.pathname.split('/')[3];
      const identifier = url.searchParams.get('id') || '';
      const engine = new ConfigEngine(env.DB, env.CONFIG_CACHE);
      const enabled = await engine.isFeatureEnabled(name, identifier);
      return jsonResponse({ name, enabled, identifier });
    }
    
    // Admin-only endpoints
    if (adminKey !== env.ADMIN_KEY) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    if (url.pathname === '/v1/admin/config' && request.method === 'POST') {
      try {
        const body = await request.json();
        const engine = new ConfigEngine(env.DB, env.CONFIG_CACHE);
        const result = await engine.set(
          body.key,
          body.value,
          body.type || 'string',
          body.scope || 'global',
          body.scope_id || null,
          body.description || ''
        );
        return jsonResponse(result, 201);
      } catch (error) {
        return jsonResponse({ error: error.message }, 400);
      }
    }
    
    if (url.pathname === '/v1/admin/config' && request.method === 'DELETE') {
      const key = url.searchParams.get('key');
      if (!key) {
        return jsonResponse({ error: 'key parameter required' }, 400);
      }
      const engine = new ConfigEngine(env.DB, env.CONFIG_CACHE);
      await engine.delete(key);
      return jsonResponse({ deleted: true });
    }
    
    if (url.pathname === '/v1/admin/features' && request.method === 'POST') {
      try {
        const body = await request.json();
        const engine = new ConfigEngine(env.DB, env.CONFIG_CACHE);
        const result = await engine.setFeatureFlag(
          body.name,
          body.enabled,
          body.target_percent || 100,
          body.description || ''
        );
        return jsonResponse(result, 201);
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
