/**
 * MetaMesh-UGA Recommendation Worker
 * 
 * Provides recommendations for MCP tools based on natural language tasks.
 */

import { RecommendationEngine } from './recommendation.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    if (url.pathname === '/health') {
      return jsonResponse({
        status: 'healthy',
        worker: 'recommendation',
        timestamp: new Date().toISOString()
      });
    }
    
    if (url.pathname === '/v1/recommend') {
      const query = url.searchParams.get('q') || '';
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '5'), 20);
      const minTrust = parseFloat(url.searchParams.get('min_trust') || '0.5');
      const category = url.searchParams.get('category') || undefined;
      
      if (!query) {
        return jsonResponse({ error: 'Query parameter q is required' }, 400);
      }
      
      const engine = new RecommendationEngine(env.DB);
      const recommendation = await engine.recommend(query, {
        limit,
        min_trust: minTrust,
        category
      });
      
      return jsonResponse(recommendation);
    }
    
    if (url.pathname.startsWith('/v1/similar/')) {
      const toolName = url.pathname.split('/').pop();
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '5'), 20);
      
      const engine = new RecommendationEngine(env.DB);
      const similar = await engine.getSimilarTools(toolName, limit);
      return jsonResponse(similar);
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
