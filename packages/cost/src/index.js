/**
 * MetaMesh-UGA Cost Worker
 * 
 * Provides cost optimization and estimation endpoints.
 */

import { CostOptimizer } from './optimizer.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    if (url.pathname === '/health') {
      return jsonResponse({
        status: 'healthy',
        worker: 'cost',
        timestamp: new Date().toISOString()
      });
    }
    
    if (url.pathname === '/v1/estimate') {
      const toolName = url.searchParams.get('tool');
      const callCount = parseInt(url.searchParams.get('calls') || '1');
      
      if (!toolName) {
        return jsonResponse({ error: 'tool parameter required' }, 400);
      }
      
      const optimizer = new CostOptimizer(env.DB);
      const estimate = await optimizer.estimateCost(toolName, callCount);
      return jsonResponse(estimate);
    }
    
    if (url.pathname === '/v1/optimize') {
      const category = url.searchParams.get('category');
      const capability = url.searchParams.get('capability');
      const maxCost = parseFloat(url.searchParams.get('max_cost')) || undefined;
      const minTrust = parseFloat(url.searchParams.get('min_trust') || '0.5');
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '5'), 20);
      
      const optimizer = new CostOptimizer(env.DB);
      const result = await optimizer.optimize({
        category,
        capability,
        max_cost_usd: maxCost,
        min_trust: minTrust,
        limit
      });
      return jsonResponse(result);
    }
    
    if (url.pathname === '/v1/budget/:user_id') {
      const userId = url.pathname.split('/')[3];
      const toolName = url.searchParams.get('tool');
      const calls = parseInt(url.searchParams.get('calls') || '1');
      
      const optimizer = new CostOptimizer(env.DB);
      const budget = await optimizer.checkBudget(userId, toolName, calls);
      return jsonResponse(budget);
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
