/**
 * MetaMesh-UGA Compatibility Worker
 * 
 * Provides compatibility checks for MCP servers and clients.
 */

import { CompatibilityEngine } from './compatibility.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    if (url.pathname === '/health') {
      return jsonResponse({
        status: 'healthy',
        worker: 'compatibility',
        timestamp: new Date().toISOString()
      });
    }
    
    if (url.pathname === '/v1/check' && request.method === 'POST') {
      try {
        const body = await request.json();
        const toolName = body.tool;
        const requirements = body.requirements || {};
        
        if (!toolName) {
          return jsonResponse({ error: 'tool parameter required' }, 400);
        }
        
        const engine = new CompatibilityEngine(env.DB);
        const result = await engine.checkCompatibility(toolName, requirements);
        return jsonResponse(result);
      } catch (error) {
        return jsonResponse({ error: error.message }, 400);
      }
    }
    
    if (url.pathname === '/v1/compatible' && request.method === 'POST') {
      try {
        const body = await request.json();
        const requirements = body.requirements || {};
        
        const engine = new CompatibilityEngine(env.DB);
        const tools = await engine.findCompatibleTools(requirements);
        return jsonResponse({ total: tools.length, tools });
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
