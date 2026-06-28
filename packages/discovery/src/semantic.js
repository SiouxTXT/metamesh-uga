/**
 * MetaMesh-UGA Semantic Search Engine
 * 
 * Phase 1 implementation: lightweight deterministic embeddings.
 * Generates 128-dimensional embeddings from name, description and capabilities.
 * Uses a simple term-frequency hash approach that works without external APIs.
 * 
 * In later phases this can be replaced with a proper embedding model
 * (e.g. Cloudflare Workers AI, OpenAI ada-002, or a local model).
 */

export const EMBEDDING_DIMENSIONS = 128;
export const EMBEDDING_MODEL = 'simple-tf-v1';

/**
 * Generate a simple embedding vector from text.
 * Uses multiple hash functions to create a sparse term-frequency vector.
 */
export function embed(text) {
  const normalized = normalizeText(text);
  const tokens = tokenize(normalized);
  const vector = new Array(EMBEDDING_DIMENSIONS).fill(0);

  for (const token of tokens) {
    const h1 = hashString(token, 0) % EMBEDDING_DIMENSIONS;
    const h2 = hashString(token, 1) % EMBEDDING_DIMENSIONS;
    const weight = 1.0;

    vector[h1] += weight;
    vector[h2] += weight * 0.5;
  }

  return normalizeVector(vector);
}

/**
 * Compute cosine similarity between two vectors
 */
export function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Normalize text: lowercase, remove special chars, collapse spaces
 */
function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Simple tokenization
 */
function tokenize(text) {
  return text.split(/\s+/).filter(t => t.length > 1);
}

/**
 * Deterministic string hash
 */
function hashString(str, seed) {
  let hash = seed;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * L2 normalize a vector
 */
function normalizeVector(vector) {
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (norm === 0) return vector;
  return vector.map(v => v / norm);
}
