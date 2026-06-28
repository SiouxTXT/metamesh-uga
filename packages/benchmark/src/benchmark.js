/**
 * MetaMesh-UGA Benchmark Engine
 * 
 * Measures performance of MCP tools and computes benchmark scores.
 * Phase 2 implementation: lightweight benchmarks runnable in a Cloudflare Worker.
 * 
 * For built-in tools (e.g. example.echo) it performs real calls.
 * For external tools it performs lightweight availability checks (HTTP HEAD to source_url).
 * 
 * Metrics:
 * - startup_time_ms (simulated / metadata fetch time)
 * - response_time_p50_ms
 * - response_time_p95_ms
 * - success_rate
 * - throughput_rps
 * - benchmark_score
 */

export const BENCHMARK_CALLS = 20;

export class BenchmarkEngine {
  constructor(db, env) {
    this.db = db;
    this.env = env;
  }

  /**
   * Benchmark all active tools
   */
  async benchmarkAll(limit = 1000) {
    const tools = await this.db.prepare(
      `SELECT name, source_url, registry_url, state
       FROM tools
       WHERE deprecated = FALSE
       ORDER BY name
       LIMIT ?`
    ).bind(limit).all();

    const results = {
      benchmarked: 0,
      updated: 0,
      failed: 0,
      errors: []
    };

    for (const tool of tools.results || []) {
      try {
        const benchmark = await this.benchmark(tool);
        await this.storeResults(tool.name, benchmark);
        
        // Transition VERIFIED → BENCHMARKED
        if (tool.state === 'VERIFIED') {
          await this.db.prepare(
            `UPDATE tools SET state = 'BENCHMARKED', state_updated = CURRENT_TIMESTAMP WHERE name = ?`
          ).bind(tool.name).run();
        }
        
        // Transition BENCHMARKED → RANKED if trust score is high enough
        if (tool.state === 'BENCHMARKED' || tool.state === 'VERIFIED') {
          const toolInfo = await this.db.prepare(
            'SELECT trust_score FROM tools WHERE name = ?'
          ).bind(tool.name).first();
          
          if (toolInfo?.trust_score >= 0.7) {
            await this.db.prepare(
              `UPDATE tools SET state = 'RANKED', state_updated = CURRENT_TIMESTAMP WHERE name = ?`
            ).bind(tool.name).run();
            
            await this.db.prepare(
              `INSERT INTO lifecycle_log (tool_name, from_state, to_state, reason)
               VALUES (?, 'BENCHMARKED', 'RANKED', 'Trust score >= 0.7')`
            ).bind(tool.name).run();
          }
        }
        
        results.updated++;
      } catch (error) {
        results.failed++;
        results.errors.push({ tool: tool.name, error: error.message });
        console.error(`Benchmark failed for ${tool.name}:`, error);
      }
      results.benchmarked++;
    }

    return results;
  }

  /**
   * Benchmark a single tool
   */
  async benchmark(tool) {
    const name = tool.name;
    const startTime = Date.now();
    const latencies = [];
    let successes = 0;
    let failures = 0;

    // Run benchmark calls
    for (let i = 0; i < BENCHMARK_CALLS; i++) {
      const callStart = Date.now();
      try {
        await this.callTool(name);
        successes++;
        latencies.push(Date.now() - callStart);
      } catch (error) {
        failures++;
      }
    }

    const totalDuration = Date.now() - startTime;
    const sortedLatencies = latencies.sort((a, b) => a - b);
    const p50 = this.percentile(sortedLatencies, 50);
    const p95 = this.percentile(sortedLatencies, 95);
    const successRate = BENCHMARK_CALLS > 0 ? successes / BENCHMARK_CALLS : 0;
    const throughputRps = totalDuration > 0 ? Math.round((BENCHMARK_CALLS / totalDuration) * 1000) : 0;

    // For external tools, also check source availability
    let sourceAvailable = false;
    if (tool.source_url && tool.source_url.includes('http')) {
      try {
        const response = await fetch(tool.source_url, {
          method: 'HEAD',
          redirect: 'follow',
          timeout: 5000
        });
        sourceAvailable = response.ok;
      } catch (error) {
        sourceAvailable = false;
      }
    }

    const benchmarkScore = this.calculateBenchmarkScore({
      p50,
      p95,
      successRate,
      throughputRps,
      sourceAvailable
    });

    return {
      startup_time_ms: p50,
      response_time_p50_ms: p50,
      response_time_p95_ms: p95,
      memory_usage_mb: 0,
      success_rate: successRate,
      throughput_rps: throughputRps,
      benchmark_score: benchmarkScore,
      details: {
        calls: BENCHMARK_CALLS,
        successes,
        failures,
        source_available: sourceAvailable,
        source_url: tool.source_url
      }
    };
  }

  /**
   * Call a tool for benchmarking
   */
  async callTool(toolName) {
    // Built-in example tool
    if (toolName === 'example.echo') {
      return { echoed: 'benchmark' };
    }

    // For other tools, simulate a lightweight check
    // In production this would call the actual MCP server or proxy
    await new Promise(resolve => setTimeout(resolve, 10));
    return { acknowledged: true, tool: toolName };
  }

  /**
   * Calculate percentile from sorted array
   */
  percentile(sorted, p) {
    if (sorted.length === 0) return 0;
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Calculate benchmark score from 0 to 1
   */
  calculateBenchmarkScore(metrics) {
    let score = 0.5;

    // Latency score: lower p95 is better
    if (metrics.p95 < 100) score += 0.2;
    else if (metrics.p95 < 500) score += 0.1;
    else if (metrics.p95 < 1000) score += 0;
    else score -= 0.1;

    // Success rate
    score += (metrics.successRate - 0.5) * 0.3;

    // Throughput
    if (metrics.throughputRps > 100) score += 0.1;
    else if (metrics.throughputRps > 50) score += 0.05;

    // Source availability
    if (metrics.sourceAvailable) score += 0.1;

    return Math.min(Math.max(score, 0), 1);
  }

  /**
   * Store benchmark results
   */
  async storeResults(toolName, results) {
    await this.db.prepare(
      `INSERT INTO benchmark_results
        (tool_name, startup_time_ms, response_time_p50_ms, response_time_p95_ms,
         memory_usage_mb, success_rate, throughput_rps, benchmark_score, details)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      toolName,
      results.startup_time_ms,
      results.response_time_p50_ms,
      results.response_time_p95_ms,
      results.memory_usage_mb,
      results.success_rate,
      results.throughput_rps,
      results.benchmark_score,
      JSON.stringify(results.details)
    ).run();

    // Update tool's trust score with benchmark component
    // In Phase 2 we store the benchmark_score separately; trust engine will use it later
    await this.db.prepare(
      `UPDATE tools SET last_updated = CURRENT_TIMESTAMP WHERE name = ?`
    ).bind(toolName).run();
  }

  /**
   * Get latest benchmark for a tool
   */
  async getBenchmark(toolName) {
    const benchmark = await this.db.prepare(
      `SELECT * FROM benchmark_results WHERE tool_name = ? ORDER BY benchmarked_at DESC LIMIT 1`
    ).bind(toolName).first();

    return benchmark;
  }
}
