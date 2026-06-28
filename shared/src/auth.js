/**
 * Authentication & Authorization Module
 * MetaMesh-UGA - Shared Library
 */

import { Router } from 'itty-router';

/**
 * Generate a new API key
 * @returns {string} API key
 */
export function generateAPIKey() {
  return `sk_${crypto.randomUUID().replace(/-/g, '')}`;
}

/**
 * Generate a referral code
 * @param {number} userId
 * @returns {string} Referral code
 */
export function generateReferralCode(userId) {
  const timestamp = Date.now().toString(36);
  return `REF-${userId}-${timestamp}`;
}

/**
 * Hash a string using SHA-256
 * @param {string} data
 * @returns {Promise<string>} Hex digest
 */
export async function sha256(data) {
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Derive encryption key from user ID
 * @param {string} userId
 * @returns {Promise<CryptoKey>}
 */
export async function deriveKey(userId) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(userId + (ENV.JWT_SECRET || 'default-secret')),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('metamesh-salt'),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt configuration data
 * @param {object} data
 * @param {string} userId
 * @returns {Promise<{data: string, iv: string}>}
 */
export async function encryptConfig(data, userId) {
  const key = await deriveKey(userId);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(JSON.stringify(data))
  );
  
  return {
    data: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv))
  };
}

/**
 * Decrypt configuration data
 * @param {string} encryptedData - Base64 encoded
 * @param {string} iv - Base64 encoded
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function decryptConfig(encryptedData, iv, userId) {
  const key = await deriveKey(userId);
  
  const encryptedBuffer = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
  const ivBuffer = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBuffer },
    key,
    encryptedBuffer
  );
  
  return JSON.parse(new TextDecoder().decode(decrypted));
}

/**
 * Authenticate user by API key
 * @param {Request} request
 * @param {object} env
 * @returns {Promise<object|null>} User object or null
 */
export async function authenticateUser(request, env) {
  const apiKey = request.headers.get('X-API-Key');
  
  if (!apiKey) {
    return null;
  }
  
  const user = await env.DB.prepare(
    'SELECT * FROM users WHERE api_key = ?'
  ).bind(apiKey).first();
  
  return user || null;
}

/**
 * Authenticate agent by agent_id
 * @param {Request} request
 * @param {object} env
 * @returns {Promise<object|null>} Agent object or null
 */
export async function authenticateAgent(request, env) {
  const agentId = request.headers.get('X-Agent-ID');
  
  if (!agentId) {
    return null;
  }
  
  const agent = await env.DB.prepare(
    'SELECT * FROM agents WHERE agent_id = ? AND suspended = FALSE'
  ).bind(agentId).first();
  
  return agent || null;
}

/**
 * Middleware: Require authentication
 * @param {Request} request
 * @param {object} env
 * @returns {Promise<Response|void>}
 */
export async function requireAuth(request, env) {
  // Try user auth first
  const user = await authenticateUser(request, env);
  if (user) {
    request.user = user;
    return;
  }
  
  // Try agent auth
  const agent = await authenticateAgent(request, env);
  if (agent) {
    request.agent = agent;
    return;
  }
  
  return new Response(
    JSON.stringify({ error: 'Unauthorized', message: 'API key or Agent ID required' }),
    { status: 401, headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * Check if user has required plan
 * @param {object} user
 * @param {string[]} allowedPlans
 * @returns {boolean}
 */
export function checkPlan(user, allowedPlans) {
  return allowedPlans.includes(user.plan);
}

/**
 * Middleware: Require specific plan
 * @param {string[]} allowedPlans
 * @returns {Function}
 */
export function requirePlan(allowedPlans) {
  return async (request, env) => {
    const authResult = await requireAuth(request, env);
    if (authResult) return authResult;
    
    const entity = request.user || request.agent;
    if (!checkPlan(entity, allowedPlans)) {
      return new Response(
        JSON.stringify({ 
          error: 'Forbidden', 
          message: `Required plan: ${allowedPlans.join(' or ')}`,
          current_plan: entity.plan
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }
  };
}

/**
 * Generate JWT token
 * @param {object} payload
 * @param {string} secret
 * @param {number} expiresIn - Seconds
 * @returns {Promise<string>}
 */
export async function generateJWT(payload, secret, expiresIn = 3600) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + expiresIn };
  
  const encoder = new TextEncoder();
  
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '');
  const bodyB64 = btoa(JSON.stringify(body)).replace(/=/g, '');
  const message = `${headerB64}.${bodyB64}`;
  
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(message)
  );
  
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '');
  
  return `${message}.${signatureB64}`;
}

/**
 * Verify JWT token
 * @param {string} token
 * @param {string} secret
 * @returns {Promise<object|null>}
 */
export async function verifyJWT(token, secret) {
  try {
    const [headerB64, bodyB64, signatureB64] = token.split('.');
    
    const encoder = new TextEncoder();
    const message = `${headerB64}.${bodyB64}`;
    
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    const signature = Uint8Array.from(atob(signatureB64), c => c.charCodeAt(0));
    
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signature,
      encoder.encode(message)
    );
    
    if (!isValid) return null;
    
    const body = JSON.parse(atob(bodyB64));
    
    if (body.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }
    
    return body;
  } catch (e) {
    return null;
  }
}

/**
 * Anonymize user data (GDPR)
 * @param {number} userId
 * @param {object} env
 * @returns {Promise<boolean>}
 */
export async function anonymizeUser(userId, env) {
  try {
    // Anonymize user record
    await env.DB.prepare(
      "UPDATE users SET email = 'anon_' || id || '@deleted.local', api_key = 'deleted_' || id WHERE id = ?"
    ).bind(userId).run();
    
    // Delete configs
    await env.DB.prepare(
      'DELETE FROM configs WHERE user_id = ?'
    ).bind(userId).run();
    
    // Note: We keep usage_log for analytics but anonymize user_id
    await env.DB.prepare(
      'UPDATE usage_log SET user_id = NULL WHERE user_id = ?'
    ).bind(userId).run();
    
    return true;
  } catch (e) {
    console.error('Anonymization error:', e);
    return false;
  }
}
