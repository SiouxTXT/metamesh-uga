/**
 * MetaMesh-UGA Intelligence Worker
 * 
 * Provides AI-driven insights and analytics for the MCP ecosystem.
 */

import { IntelligenceEngine } from './intelligence.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const adminKey = request.headers.get('X-Admin-Key');
    
    if (url.pathname === '/health') {
      return jsonResponse({
        status: 'healthy',
        worker: 'intelligence',
        timestamp: new Date().toISOString()
      });
    }
    
    if (url.pathname === '/v1/insights') {
      const engine = new IntelligenceEngine(env.DB);
      const insights = await engine.generateInsights();
      return jsonResponse(insights);
    }
    
    if (url.pathname === '/v1/anomalies') {
      const engine = new IntelligenceEngine(env.DB);
      const anomalies = await engine.detectAnomalies();
      return jsonResponse({ total: anomalies.length, anomalies });
    }
    
    if (adminKey !== env.ADMIN_KEY) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    if (url.pathname === '/v1/admin/intelligence/refresh' && request.method === 'POST') {
      const engine = new IntelligenceEngine(env.DB);
      const insights = await engine.generateInsights();
      return jsonResponse(insights);
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
