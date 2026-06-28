/**
 * MetaMesh-UGA Analytics Worker
 * 
 * Provides real-time analytics dashboards and metrics export.
 */

import { AnalyticsEngine } from './analytics.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    if (url.pathname === '/health') {
      return jsonResponse({
        status: 'healthy',
        worker: 'analytics',
        timestamp: new Date().toISOString()
      });
    }
    
    if (url.pathname === '/v1/dashboard/usage') {
      const hours = parseInt(url.searchParams.get('hours') || '24');
      const engine = new AnalyticsEngine(env.DB);
      const data = await engine.getUsageDashboard(hours);
      return jsonResponse({ total: data.length, data });
    }
    
    if (url.pathname === '/v1/dashboard/health') {
      const engine = new AnalyticsEngine(env.DB);
      const data = await engine.getHealthDashboard();
      return jsonResponse({ total: data.length, data });
    }
    
    if (url.pathname === '/v1/dashboard/errors') {
      const hours = parseInt(url.searchParams.get('hours') || '24');
      const engine = new AnalyticsEngine(env.DB);
      const data = await engine.getErrorDistribution(hours);
      return jsonResponse({ total: data.length, data });
    }
    
    if (url.pathname === '/v1/metrics/prometheus') {
      const engine = new AnalyticsEngine(env.DB);
      const metrics = await engine.exportPrometheus();
      return new Response(metrics, {
        headers: { 'Content-Type': 'text/plain; version=0.0.4' }
      });
    }
    
    if (url.pathname === '/v1/metrics/opentelemetry') {
      const engine = new AnalyticsEngine(env.DB);
      const metrics = await engine.exportOpenTelemetry();
      return jsonResponse(metrics);
    }
    
    if (url.pathname === '/v1/metrics') {
      const name = url.searchParams.get('name');
      const limit = parseInt(url.searchParams.get('limit') || '100');
      const engine = new AnalyticsEngine(env.DB);
      const metrics = await engine.getMetrics(name, limit);
      return jsonResponse({ total: metrics.length, metrics });
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
