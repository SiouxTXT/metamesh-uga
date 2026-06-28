/**
 * MetaMesh-UGA Inserter Worker
 * 
 * Inserts new tools into the catalog via admin API.
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const adminKey = request.headers.get('X-Admin-Key');
    
    // Health check
    if (url.pathname === '/health') {
      return jsonResponse({
        status: 'healthy',
        worker: 'inserter',
        timestamp: new Date().toISOString()
      });
    }
    
    // Admin only
    if (adminKey !== env.ADMIN_KEY) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    // Insert new tool
    if (url.pathname === '/v1/admin/tools' && request.method === 'POST') {
      try {
        const body = await request.json();
        const result = await insertTool(env, body);
        return jsonResponse(result, result.success ? 201 : 400);
      } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 400);
      }
    }
    
    return jsonResponse({ error: 'Not found' }, 404);
  }
};

async function insertTool(env, tool) {
  // Validate required fields
  if (!tool.name || !tool.version || !tool.category) {
    return {
      success: false,
      error: 'Required fields: name, version, category'
    };
  }
  
  const name = tool.name.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const version = tool.version;
  const category = tool.category;
  const description = tool.description || '';
  const sourceUrl = tool.source_url || '';
  const registryUrl = tool.registry_url || '';
  const schema = tool.schema ? JSON.stringify(tool.schema) : null;
  const capabilities = tool.capabilities ? JSON.stringify(tool.capabilities) : null;
  const registrySource = tool.registry_source || 'manual';
  
  // Check if already exists
  const existing = await env.DB.prepare(
    'SELECT id FROM tools WHERE name = ? AND version = ?'
  ).bind(name, version).first();
  
  if (existing) {
    return {
      success: false,
      error: `Tool ${name}@${version} already exists`
    };
  }
  
  // Insert tool
  await env.DB.prepare(
    `INSERT INTO tools
      (name, version, category, description, schema, source_url, registry_url,
       popularity_score, registry_source, capabilities, state, trust_score)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'DISCOVERED', 0.5)`
  ).bind(
    name,
    version,
    category,
    description,
    schema,
    sourceUrl,
    registryUrl,
    registrySource,
    capabilities
  ).run();
  
  // Initialize pricing
  await env.DB.prepare(
    `INSERT INTO tool_pricing (tool_name, price_per_call_usd, x402_enabled)
     VALUES (?, 0.001, TRUE)
     ON CONFLICT(tool_name) DO NOTHING`
  ).bind(name).run();
  
  // Log lifecycle
  await env.DB.prepare(
    `INSERT INTO lifecycle_log (tool_name, from_state, to_state, reason)
     VALUES (?, 'NONE', 'DISCOVERED', 'Manual insert via inserter worker')`
  ).bind(name).run();
  
  return {
    success: true,
    tool: {
      name,
      version,
      category,
      state: 'DISCOVERED'
    }
  };
}

function jsonResponse(data, status = 200) {
  return new Response(
    JSON.stringify(data, null, 2),
    { status, headers: { 'Content-Type': 'application/json' } }
  );
}

