/**
 * MetaMesh-UGA Policy Worker
 * 
 * Provides policy evaluation endpoints and management.
 */

import { PolicyEngine } from './engine.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const adminKey = request.headers.get('X-Admin-Key');
    
    if (url.pathname === '/health') {
      return jsonResponse({
        status: 'healthy',
        worker: 'policy',
        timestamp: new Date().toISOString()
      });
    }
    
    // Public policy evaluation endpoint
    if (url.pathname === '/v1/evaluate' && request.method === 'POST') {
      try {
        const body = await request.json();
        const engine = new PolicyEngine(env.DB);
        const result = await engine.evaluate(body);
        return jsonResponse(result);
      } catch (error) {
        return jsonResponse({ error: error.message }, 400);
      }
    }
    
    // Admin-only endpoints
    if (adminKey !== env.ADMIN_KEY) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    // List policies
    if (url.pathname === '/v1/policies' && request.method === 'GET') {
      const engine = new PolicyEngine(env.DB);
      const policies = await engine.getPolicies();
      return jsonResponse({ total: policies.length, policies });
    }
    
    // Create policy
    if (url.pathname === '/v1/policies' && request.method === 'POST') {
      try {
        const body = await request.json();
        const engine = new PolicyEngine(env.DB);
        const policy = await engine.createPolicy(body);
        return jsonResponse(policy, 201);
      } catch (error) {
        return jsonResponse({ error: error.message }, 400);
      }
    }
    
    // Delete policy
    if (url.pathname.match(/^\/v1\/policies\/\d+$/) && request.method === 'DELETE') {
      const id = parseInt(url.pathname.split('/').pop());
      const engine = new PolicyEngine(env.DB);
      await engine.deletePolicy(id);
      return jsonResponse({ deleted: true });
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
