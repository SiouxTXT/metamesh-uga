/**
 * MetaMesh-UGA Discovery Worker (Livello 2)
 * 
 * Automatically discovers new MCP servers from the official registry
 * and updates the database. Runs on a cron schedule (every 6 hours).
 * Also indexes tools for semantic search.
 */

import { SemanticSearch } from './semantic-search.js';
import { RegistryFederation } from '../../registry/src/federation.js';
import { CapabilityGraph } from './capability-graph.js';
import { IntentSearch } from './intent.js';

// GitHub MCP topic search
const GITHUB_MCP_TOPIC = 'https://api.github.com/search/repositories?q=topic:mcp-server&sort=updated&per_page=100';

// Tool categories mapping
const CATEGORY_MAPPING = {
  'communication': ['slack', 'discord', 'telegram', 'email', 'gmail', 'outlook', 'teams', 'zoom'],
  'development': ['github', 'gitlab', 'bitbucket', 'jira', 'trello', 'vscode', 'cursor'],
  'data': ['postgresql', 'mysql', 'mongodb', 'redis', 'snowflake', 'bigquery'],
  'ai': ['openai', 'anthropic', 'gemini', 'claude', 'huggingface', 'cohere'],
  'productivity': ['notion', 'asana', 'monday', 'clickup', 'todoist'],
  'infrastructure': ['aws', 'gcp', 'azure', 'kubernetes', 'docker', 'terraform'],
  'finance': ['stripe', 'plaid', 'coinbase', 'paypal', 'square']
};

export default {
  // Cron trigger handler
  async scheduled(event, env, ctx) {
    console.log('Discovery job started at:', new Date().toISOString());
    
    try {
      const results = await discoverNewMCPs(env);
      
      // Index tools for semantic search
      try {
        const semanticSearch = new SemanticSearch(env.DB);
        const indexResults = await semanticSearch.indexAll();
        results.semantic_indexed = indexResults.indexed;
        results.semantic_failed = indexResults.failed;
      } catch (indexError) {
        console.error('Semantic indexing error:', indexError);
        results.semantic_indexed = 0;
        results.semantic_failed = 1;
      }
      
      console.log('Discovery job completed:', results);
      
      // Send notification if new tools found
      if (results.new > 0 && env.TELEGRAM_BOT_TOKEN) {
        await sendTelegramNotification(
          env,
          `🔍 Discovery completed\nNew tools: ${results.new}\nUpdated: ${results.updated}\nIndexed: ${results.semantic_indexed}\nErrors: ${results.errors}`
        );
      }
      
    } catch (error) {
      console.error('Discovery job failed:', error);
      
      if (env.TELEGRAM_BOT_TOKEN) {
        await sendTelegramNotification(
          env,
          `❌ Discovery job failed: ${error.message}`
        );
      }
    }
  },
  
  // HTTP endpoints
  async fetch(request, env) {
    const url = new URL(request.url);
    const adminKey = request.headers.get('X-Admin-Key');
    
    // Health check
    if (url.pathname === '/health') {
      return jsonResponse({
        status: 'healthy',
        worker: 'discovery',
        timestamp: new Date().toISOString()
      });
    }
    
    // Semantic search endpoint
    if (url.pathname === '/v1/search') {
      const query = url.searchParams.get('q') || '';
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 50);
      const minTrust = parseFloat(url.searchParams.get('min_trust') || '0');
      
      if (!query) {
        return jsonResponse({ error: 'Query parameter q is required' }, 400);
      }
      
      const semanticSearch = new SemanticSearch(env.DB);
      let results = await semanticSearch.search(query, limit, minTrust);
      results = semanticSearch.rerankByTrust(results);
      
      return jsonResponse({
        query,
        total: results.length,
        results
      });
    }
    
    // Intent search endpoint
    if (url.pathname === '/v1/intent') {
      const query = url.searchParams.get('q') || '';
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 50);
      const minTrust = parseFloat(url.searchParams.get('min_trust') || '0');
      
      if (!query) {
        return jsonResponse({ error: 'Query parameter q is required' }, 400);
      }
      
      const intentSearch = new IntentSearch(env.DB);
      const results = await intentSearch.search(query, limit, minTrust);
      return jsonResponse(results);
    }
    
    // Capability graph endpoint
    if (url.pathname === '/v1/graph') {
      const capabilityGraph = new CapabilityGraph(env.DB);
      const graph = await capabilityGraph.getGraph();
      return jsonResponse(graph);
    }
    
    // Capability search endpoint
    if (url.pathname === '/v1/capabilities/:capability') {
      const capability = url.pathname.split('/')[3];
      const capabilityGraph = new CapabilityGraph(env.DB);
      const servers = await capabilityGraph.findServersForCapabilities([capability]);
      return jsonResponse({ capability, total: servers.length, servers });
    }
    
    // Admin: trigger semantic indexing
    if (url.pathname === '/v1/admin/index') {
      if (adminKey !== env.ADMIN_KEY) {
        return new Response('Unauthorized', { status: 401 });
      }
      
      const semanticSearch = new SemanticSearch(env.DB);
      const results = await semanticSearch.indexAll();
      return jsonResponse(results);
    }
    
    // Admin: trigger full discovery
    if (adminKey !== env.ADMIN_KEY) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    const results = await discoverNewMCPs(env);
    
    // Index tools after discovery
    try {
      const semanticSearch = new SemanticSearch(env.DB);
      const indexResults = await semanticSearch.indexAll();
      results.semantic_indexed = indexResults.indexed;
      results.semantic_failed = indexResults.failed;
    } catch (indexError) {
      console.error('Semantic indexing error:', indexError);
      results.semantic_indexed = 0;
      results.semantic_failed = 1;
    }
    
    return jsonResponse(results);
  }
};

function jsonResponse(data, status = 200) {
  return new Response(
    JSON.stringify(data, null, 2),
    { status, headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * Main discovery function
 */
async function discoverNewMCPs(env) {
  const results = {
    new: 0,
    updated: 0,
    errors: 0,
    sources: {}
  };
  
  // Discover from official registry
  try {
    const registryResults = await discoverFromRegistry(env);
    results.sources.registry = registryResults;
    results.new += registryResults.new;
    results.updated += registryResults.updated;
    results.errors += registryResults.errors;
  } catch (error) {
    console.error('Registry discovery error:', error);
    results.sources.registry = { error: error.message };
    results.errors++;
  }
  
  // Discover from GitHub
  try {
    const githubResults = await discoverFromGitHub(env);
    results.sources.github = githubResults;
    results.new += githubResults.new;
    results.updated += githubResults.updated;
    results.errors += githubResults.errors;
  } catch (error) {
    console.error('GitHub discovery error:', error);
    results.sources.github = { error: error.message };
    results.errors++;
  }
  
  // Update routing table
  try {
    await updateRoutingTable(env);
  } catch (error) {
    console.error('Routing table update error:', error);
    results.errors++;
  }
  
  // Log discovery run
  await env.ANALYTICS?.writeDataPoint({
    blobs: ['discovery', results.errors > 0 ? 'partial' : 'success'],
    doubles: [results.new, results.updated],
    indexes: ['discovery', 'cron']
  });
  
  return results;
}

/**
 * Discover from federated registries
 */
async function discoverFromRegistry(env) {
  const results = { new: 0, updated: 0, errors: 0, processed: 0, sources: {} };
  
  const federation = new RegistryFederation(env.DB, env);
  const syncResult = await federation.sync();
  
  // Update source statuses
  for (const [name, sourceResult] of Object.entries(syncResult.sources)) {
    await federation.updateSourceStatus(name, sourceResult.success ? 'success' : 'failed');
  }
  
  results.sources = syncResult.sources;
  results.federated = syncResult.merged;
  
  for (const server of syncResult.servers || []) {
    try {
      const processed = await processServer(server, env, server.registry_source);
      if (processed.isNew) results.new++;
      if (processed.isUpdated) results.updated++;
      results.processed++;
    } catch (error) {
      console.error(`Failed to process ${server.name}:`, error);
      results.errors++;
    }
  }
  
  return results;
}

/**
 * Discover from GitHub
 */
async function discoverFromGitHub(env) {
  const results = { new: 0, updated: 0, errors: 0, processed: 0 };
  
  // Only run if we have a GitHub token (optional)
  if (!env.GITHUB_TOKEN) {
    return { ...results, skipped: true, reason: 'No GitHub token' };
  }
  
  const response = await fetch(GITHUB_MCP_TOPIC, {
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `token ${env.GITHUB_TOKEN}`
    }
  });
  
  if (!response.ok) {
    throw new Error(`GitHub returned ${response.status}`);
  }
  
  const data = await response.json();
  const repos = data.items || [];
  
  for (const repo of repos) {
    try {
      // Convert repo to server format
      const server = {
        name: repo.name,
        description: repo.description,
        source_url: repo.html_url,
        version: '1.0.0', // Unknown, will be updated
        category: inferCategory(repo.name, repo.topics, repo.description),
        schema: null, // Will be fetched later
        registry: 'github'
      };
      
      const processed = await processServer(server, env, 'github');
      if (processed.isNew) results.new++;
      if (processed.isUpdated) results.updated++;
      results.processed++;
    } catch (error) {
      console.error(`Failed to process ${repo.name}:`, error);
      results.errors++;
    }
  }
  
  return results;
}

/**
 * Process a single server
 */
async function processServer(server, env, source) {
  const name = server.name.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const version = normalizeVersion(server.version || '1.0.0');
  
  // Check if already exists
  const existing = await env.DB.prepare(
    'SELECT * FROM tools WHERE name = ? ORDER BY version DESC LIMIT 1'
  ).bind(name).first();
  
  if (existing) {
    // Check if version is newer
    if (isNewerVersion(version, existing.version)) {
      // Update existing
      await env.DB.prepare(
        `UPDATE tools SET 
          version = ?,
          description = ?,
          source_url = ?,
          last_updated = CURRENT_TIMESTAMP
        WHERE id = ?`
      ).bind(
        version,
        server.description || existing.description,
        server.source_url || existing.source_url,
        existing.id
      ).run();
      
      return { isNew: false, isUpdated: true };
    }
    
    return { isNew: false, isUpdated: false };
  }
  
  // Insert new tool
  const category = server.category || inferCategory(name, server.topics, server.description);
  const registrySource = server.registry_source || source || 'unknown';
  const registryPriority = server.registry_priority !== undefined ? server.registry_priority : 99;
  const capabilities = server.capabilities ? JSON.stringify(server.capabilities) : null;
  
  // Try to fetch schema
  let schema = null;
  try {
    schema = await fetchToolSchema(server);
  } catch (error) {
    console.log(`Could not fetch schema for ${name}`);
  }
  
  await env.DB.prepare(
    `INSERT INTO tools 
      (name, version, category, description, schema, source_url, registry_url,
       popularity_score, compiled_at, registry_source, registry_priority, capabilities, state)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?, ?, 'DISCOVERED')`
  ).bind(
    name,
    version,
    category,
    server.description || '',
    schema ? JSON.stringify(schema) : null,
    server.source_url || '',
    server.registry_url || '',
    registrySource,
    registryPriority,
    capabilities
  ).run();
  
  // Initialize pricing for agent usage
  await env.DB.prepare(
    `INSERT INTO tool_pricing (tool_name, price_per_call_usd, x402_enabled)
     VALUES (?, 0.001, TRUE)
     ON CONFLICT(tool_name) DO NOTHING`
  ).bind(name).run();
  
  return { isNew: true, isUpdated: false };
}

/**
 * Infer category from name, topics, description
 */
function inferCategory(name, topics = [], description = '') {
  const text = `${name} ${topics.join(' ')} ${description}`.toLowerCase();
  
  for (const [category, keywords] of Object.entries(CATEGORY_MAPPING)) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        return category;
      }
    }
  }
  
  return 'other';
}

/**
 * Fetch tool schema from source
 */
async function fetchToolSchema(server) {
  // Try to fetch from various sources
  const sources = [];
  
  if (server.source_url?.includes('github.com')) {
    // Try to fetch from GitHub raw
    const rawUrl = server.source_url
      .replace('github.com', 'raw.githubusercontent.com')
      .replace('/tree/', '/')
      .replace('/blob/', '/');
    
    sources.push(`${rawUrl}/main/schema.json`);
    sources.push(`${rawUrl}/master/schema.json`);
    sources.push(`${rawUrl}/main/package.json`);
  }
  
  if (server.schema_url) {
    sources.push(server.schema_url);
  }
  
  for (const url of sources) {
    try {
      const response = await fetch(url, { timeout: 5000 });
      if (response.ok) {
        const data = await response.json();
        
        // Extract schema from various formats
        if (data.mcp || data.schema) {
          return data.mcp || data.schema;
        }
        
        // If it's a package.json, look for mcp field
        if (data.name && data.mcp) {
          return data.mcp;
        }
        
        return data;
      }
    } catch (error) {
      // Continue to next source
    }
  }
  
  return null;
}

/**
 * Update routing table
 */
async function updateRoutingTable(env) {
  const categories = await env.DB.prepare(
    'SELECT DISTINCT category FROM tools WHERE deprecated = FALSE'
  ).all();
  
  for (const { category } of categories.results || []) {
    // Get worker URL for this category (in production, these would be separate workers)
    const workerUrl = `https://cat-${category.slice(0, 4)}.metamesh-uga.workers.dev`;
    
    // Update or insert routing for all tools in this category
    await env.DB.prepare(
      `INSERT OR REPLACE INTO routing (tool_name, category, worker_url, last_used)
       SELECT name, category, ?, CURRENT_TIMESTAMP 
       FROM tools 
       WHERE category = ? AND deprecated = FALSE`
    ).bind(workerUrl, category).run();
  }
}

/**
 * Normalize version string
 */
function normalizeVersion(version) {
  // Remove 'v' prefix if present
  return version.replace(/^v/, '');
}

/**
 * Check if version1 is newer than version2
 */
function isNewerVersion(version1, version2) {
  const v1Parts = version1.split('.').map(Number);
  const v2Parts = version2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
    const v1Part = v1Parts[i] || 0;
    const v2Part = v2Parts[i] || 0;
    
    if (v1Part > v2Part) return true;
    if (v1Part < v2Part) return false;
  }
  
  return false; // Equal
}

/**
 * Send Telegram notification
 */
async function sendTelegramNotification(env, message) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    return;
  }
  
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
