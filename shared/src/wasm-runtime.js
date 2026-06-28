/**
 * WASM Runtime Module
 * MetaMesh-UGA - Shared Library
 * Uses wazero for WebAssembly execution
 */

const WASM_TIMEOUT_MS = 5000; // 5 seconds timeout
const MAX_MEMORY_MB = 128; // 128 MB limit

/**
 * Load WASM module from cache or R2
 * @param {string} toolName
 * @param {string} version
 * @param {object} env
 * @returns {Promise<ArrayBuffer|null>}
 */
export async function loadWASM(toolName, version, env) {
  const cacheKey = `wasm:${toolName}:${version || 'latest'}`;
  
  // Try KV cache first (L1)
  const cached = await env.CACHE.get(cacheKey, { type: 'arrayBuffer' });
  if (cached) {
    console.log(`WASM cache hit: ${toolName}`);
    return cached;
  }
  
  // Try Worker cache (L2)
  const workerCache = await caches.default.match(`https://wasm-cache/${toolName}.wasm`);
  if (workerCache) {
    const wasm = await workerCache.arrayBuffer();
    // Store in KV for next time
    await env.CACHE.put(cacheKey, wasm, { expirationTtl: 86400 }); // 24h
    return wasm;
  }
  
  // Load from R2 (L3)
  const wasmPath = version 
    ? `wasm/${toolName}_v${version}.wasm`
    : `wasm/${toolName}.wasm`;
  
  const r2Object = await env.STORAGE.get(wasmPath);
  if (!r2Object) {
    return null;
  }
  
  const wasm = await r2Object.arrayBuffer();
  
  // Store in caches
  await env.CACHE.put(cacheKey, wasm, { expirationTtl: 86400 }); // 24h
  await caches.default.put(
    `https://wasm-cache/${toolName}.wasm`,
    new Response(wasm, { headers: { 'Content-Type': 'application/wasm' } })
  );
  
  return wasm;
}

/**
 * Execute WASM module with given parameters
 * @param {ArrayBuffer} wasmBuffer
 * @param {object} params
 * @param {object} options
 * @returns {Promise<object>}
 */
export async function executeWASM(wasmBuffer, params, options = {}) {
  const { 
    timeout = WASM_TIMEOUT_MS,
    memoryLimit = MAX_MEMORY_MB * 1024 * 1024
  } = options;
  
  // Note: This is a simplified implementation
  // In production, you would use wazero compiled to WASM
  // and run it in a Cloudflare Worker
  
  try {
    // Compile the WASM module
    const module = await WebAssembly.compile(wasmBuffer);
    
    // Prepare memory
    const memory = new WebAssembly.Memory({
      initial: 10, // 640 KB
      maximum: Math.ceil(memoryLimit / (64 * 1024)) // up to max
    });
    
    // Prepare import object
    const importObject = {
      env: {
        memory,
        abort: (msg, file, line, column) => {
          throw new Error(`WASM abort: ${msg} at ${file}:${line}:${column}`);
        },
        // Console output
        console_log: (ptr, len) => {
          const bytes = new Uint8Array(memory.buffer, ptr, len);
          const text = new TextDecoder().decode(bytes);
          console.log(`[WASM] ${text}`);
        },
        // HTTP fetch (limited)
        http_request: async (urlPtr, urlLen, methodPtr, methodLen, bodyPtr, bodyLen) => {
          // This would need to be implemented carefully for security
          // Only allow certain domains, etc.
          throw new Error('HTTP requests not implemented in this environment');
        }
      },
      wasi_snapshot_preview1: {
        // WASI imports for file system, clock, etc.
        // Simplified for Cloudflare Workers
      }
    };
    
    // Instantiate with timeout
    const instance = await Promise.race([
      WebAssembly.instantiate(module, importObject),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('WASM instantiation timeout')), timeout)
      )
    ]);
    
    // Check for callTool export
    if (!instance.exports.callTool) {
      throw new Error('WASM module does not export callTool function');
    }
    
    // Prepare input parameters
    const paramsJson = JSON.stringify(params);
    const paramsBytes = new TextEncoder().encode(paramsJson);
    
    // Allocate memory for input
    const inputPtr = instance.exports.malloc 
      ? instance.exports.malloc(paramsBytes.length)
      : 0; // If no malloc, assume fixed memory layout
    
    if (inputPtr === 0 && instance.exports.malloc) {
      throw new Error('WASM malloc returned null');
    }
    
    // Copy params to WASM memory
    const inputView = new Uint8Array(memory.buffer, inputPtr, paramsBytes.length);
    inputView.set(paramsBytes);
    
    // Call the tool with timeout
    const resultPtr = await Promise.race([
      instance.exports.callTool(inputPtr, paramsBytes.length),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('WASM execution timeout')), timeout)
      )
    ]);
    
    if (resultPtr === 0) {
      throw new Error('WASM callTool returned null');
    }
    
    // Read result from memory
    // First 4 bytes are length
    const resultView = new Uint8Array(memory.buffer, resultPtr, 4);
    const resultLen = new DataView(resultView.buffer).getInt32(0, true);
    
    const resultBytes = new Uint8Array(memory.buffer, resultPtr + 4, resultLen);
    const resultJson = new TextDecoder().decode(resultBytes);
    const result = JSON.parse(resultJson);
    
    // Free memory if free is available
    if (instance.exports.free) {
      instance.exports.free(inputPtr);
      instance.exports.free(resultPtr);
    }
    
    return {
      success: true,
      result,
      latency_ms: 0 // Would be measured in real implementation
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      error_type: error.message.includes('timeout') ? 'TIMEOUT' : 'EXECUTION_ERROR'
    };
  }
}

/**
 * Execute a tool by name
 * @param {string} toolName
 * @param {object} params
 * @param {object} env
 * @param {object} options
 * @returns {Promise<object>}
 */
export async function executeTool(toolName, params, env, options = {}) {
  const startTime = Date.now();
  
  try {
    // Get tool info from database
    const tool = await env.DB.prepare(
      'SELECT * FROM tools WHERE name = ? AND deprecated = FALSE ORDER BY version DESC LIMIT 1'
    ).bind(toolName).first();
    
    if (!tool) {
      return {
        success: false,
        error: `Tool not found: ${toolName}`,
        error_type: 'TOOL_NOT_FOUND',
        latency_ms: Date.now() - startTime
      };
    }
    
    // Load WASM
    const wasm = await loadWASM(toolName, tool.version, env);
    if (!wasm) {
      return {
        success: false,
        error: `WASM module not found for tool: ${toolName}`,
        error_type: 'WASM_NOT_FOUND',
        latency_ms: Date.now() - startTime
      };
    }
    
    // Validate params against schema (if available)
    if (tool.schema) {
      const schema = typeof tool.schema === 'string' ? JSON.parse(tool.schema) : tool.schema;
      const validationError = validateParams(params, schema);
      if (validationError) {
        return {
          success: false,
          error: validationError,
          error_type: 'INVALID_PARAMS',
          latency_ms: Date.now() - startTime
        };
      }
    }
    
    // Execute WASM
    const result = await executeWASM(wasm, params, options);
    result.latency_ms = Date.now() - startTime;
    
    // Update tool popularity
    await env.DB.prepare(
      'UPDATE tools SET popularity_score = popularity_score + 1 WHERE id = ?'
    ).bind(tool.id).run();
    
    return result;
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      error_type: 'EXECUTION_ERROR',
      latency_ms: Date.now() - startTime
    };
  }
}

/**
 * Validate parameters against schema
 * @param {object} params
 * @param {object} schema
 * @returns {string|null} Error message or null if valid
 */
function validateParams(params, schema) {
  if (!schema || !schema.properties) {
    return null; // No schema to validate against
  }
  
  const required = schema.required || [];
  
  for (const field of required) {
    if (!(field in params)) {
      return `Missing required parameter: ${field}`;
    }
  }
  
  for (const [key, value] of Object.entries(params)) {
    const fieldSchema = schema.properties[key];
    if (!fieldSchema) {
      return `Unknown parameter: ${key}`;
    }
    
    // Type checking
    const expectedType = fieldSchema.type;
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    
    if (expectedType && expectedType !== actualType) {
      return `Invalid type for ${key}: expected ${expectedType}, got ${actualType}`;
    }
  }
  
  return null;
}

/**
 * Warm cache for popular tools
 * @param {object} env
 * @returns {Promise<object>}
 */
export async function warmCache(env) {
  const startTime = Date.now();
  
  try {
    // Get top 100 tools by popularity
    const topTools = await env.DB.prepare(
      'SELECT name, version FROM tools WHERE deprecated = FALSE ORDER BY popularity_score DESC LIMIT 100'
    ).all();
    
    let loaded = 0;
    let failed = 0;
    
    for (const tool of topTools.results || []) {
      try {
        const wasm = await loadWASM(tool.name, tool.version, env);
        if (wasm) {
          loaded++;
        } else {
          failed++;
        }
      } catch (e) {
        failed++;
        console.error(`Failed to warm cache for ${tool.name}:`, e);
      }
    }
    
    return {
      success: true,
      loaded,
      failed,
      total: topTools.results?.length || 0,
      latency_ms: Date.now() - startTime
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      latency_ms: Date.now() - startTime
    };
  }
}

/**
 * Get execution statistics
 * @param {object} env
 * @returns {Promise<object>}
 */
export async function getWASMStats(env) {
  // Count cached modules in KV
  const kvList = await env.CACHE.list({ prefix: 'wasm:' });
  const kvCount = kvList.keys.length;
  
  // Get stats from database
  const stats = await env.DB.prepare(
    `SELECT 
      COUNT(*) as total_tools,
      SUM(CASE WHEN deprecated = FALSE THEN 1 ELSE 0 END) as active_tools,
      AVG(wasm_size_bytes) as avg_size,
      SUM(popularity_score) as total_executions
    FROM tools`
  ).first();
  
  return {
    kv_cached_modules: kvCount,
    ...stats
  };
}
