/**
 * MetaMesh-UGA Benchmark Worker
 * 
 * Runs performance benchmarks on MCP tools.
 * Daily cron at 02:30.
 */

import { BenchmarkEngine } from './benchmark.js';

export default {
  async scheduled(event, env, ctx) {
    console.log('Benchmark job started at:', new Date().toISOString());
    
    try {
      const engine = new BenchmarkEngine(env.DB, env);
      const results = await engine.benchmarkAll();
      console.log('Benchmark job completed:', results);
      
      if (env.TELEGRAM_BOT_TOKEN) {
        await sendTelegramNotification(
          env,
          `⏱️ Benchmark completed\nBenchmarked: ${results.benchmarked}\nUpdated: ${results.updated}\nFailed: ${results.failed}`
        );
      }
      
      return results;
    } catch (error) {
      console.error('Benchmark job failed:', error);
      if (env.TELEGRAM_BOT_TOKEN) {
        await sendTelegramNotification(env, `❌ Benchmark failed: ${error.message}`);
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
        worker: 'benchmark',
        timestamp: new Date().toISOString()
      });
    }
    
    if (url.pathname === '/v1/benchmark/:name') {
      const toolName = url.pathname.split('/')[3];
      const engine = new BenchmarkEngine(env.DB, env);
      const benchmark = await engine.getBenchmark(toolName);
      
      if (!benchmark) {
        return jsonResponse({ error: 'No benchmark found' }, 404);
      }
      
      return jsonResponse(benchmark);
    }
    
    if (url.pathname === '/v1/ranking') {
      const ranking = await env.DB.prepare(
        `SELECT name, category, trust_score, security_score, benchmark_score, overall_score
         FROM v_tool_ranking
         LIMIT 100`
      ).all();
      return jsonResponse({ total: (ranking.results || []).length, ranking: ranking.results || [] });
    }
    
    if (adminKey !== env.ADMIN_KEY) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    if (url.pathname === '/v1/admin/benchmark' && request.method === 'POST') {
      const engine = new BenchmarkEngine(env.DB, env);
      const results = await engine.benchmarkAll();
      return jsonResponse(results);
    }
    
    if (url.pathname.startsWith('/v1/admin/benchmark/') && request.method === 'POST') {
      const toolName = url.pathname.split('/').pop();
      const engine = new BenchmarkEngine(env.DB, env);
      
      const tool = await env.DB.prepare(
        'SELECT name, source_url, registry_url, state FROM tools WHERE name = ?'
      ).bind(toolName).first();
      
      if (!tool) {
        return jsonResponse({ error: 'Tool not found' }, 404);
      }
      
      const benchmark = await engine.benchmark(tool);
      await engine.storeResults(toolName, benchmark);
      return jsonResponse(benchmark);
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
