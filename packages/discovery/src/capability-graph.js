/**
 * MetaMesh-UGA Capability Graph
 * 
 * Builds and queries a lightweight capability graph for MCP servers.
 * Phase 3 implementation: in-memory graph built from tool capabilities.
 * 
 * Supports:
 * - Capability hierarchy (parent/child relationships)
 * - Tool-to-capability mapping
 * - Intent-to-capability extraction via keyword matching
 * - Finding servers that implement a set of capabilities
 */

export const CAPABILITY_RELATIONSHIPS = {
  'Database': {
    parents: [],
    children: ['SQL', 'NoSQL', 'GraphDB', 'VectorDB']
  },
  'SQL': {
    parents: ['Database'],
    children: ['PostgreSQL', 'MySQL', 'SQLite']
  },
  'NoSQL': {
    parents: ['Database'],
    children: ['MongoDB', 'Redis', 'DocumentDB']
  },
  'VectorDB': {
    parents: ['Database'],
    children: ['Pinecone', 'Qdrant', 'Chroma', 'Weaviate', 'Milvus']
  },
  'AI': {
    parents: [],
    children: ['LLM', 'Embedding', 'ImageGeneration', 'Speech']
  },
  'LLM': {
    parents: ['AI'],
    children: ['OpenAI', 'Claude', 'Gemini', 'DeepSeek']
  },
  'Search': {
    parents: [],
    children: ['WebSearch', 'DocumentSearch', 'VectorSearch']
  },
  'Communication': {
    parents: [],
    children: ['Email', 'Chat', 'Video']
  },
  'Email': {
    parents: ['Communication'],
    children: ['Gmail', 'Outlook']
  },
  'Chat': {
    parents: ['Communication'],
    children: ['Slack', 'Discord', 'Telegram']
  },
  'Automation': {
    parents: [],
    children: ['BrowserAutomation', 'Workflow', 'Scheduling']
  },
  'FileSystem': {
    parents: [],
    children: ['FileRead', 'FileWrite', 'FileSearch']
  },
  'OCR': {
    parents: ['AI', 'ImageProcessing'],
    children: []
  },
  'ImageProcessing': {
    parents: ['AI'],
    children: ['OCR', 'ImageGeneration']
  }
};

export const INTENT_KEYWORDS = {
  'Database': ['database', 'db', 'query', 'sql', 'storage', 'data'],
  'SQL': ['sql', 'relational', 'query', 'table'],
  'PostgreSQL': ['postgres', 'postgresql', 'psql'],
  'MySQL': ['mysql', 'mariadb'],
  'MongoDB': ['mongodb', 'mongo', 'document'],
  'Redis': ['redis', 'cache', 'key-value'],
  'VectorDB': ['vector', 'embedding', 'similarity', 'semantic'],
  'AI': ['ai', 'artificial intelligence', 'machine learning', 'ml'],
  'LLM': ['llm', 'language model', 'gpt', 'claude', 'gemini'],
  'Embedding': ['embedding', 'embeddings', 'vectorize'],
  'ImageGeneration': ['image generation', 'generate image', 'image ai'],
  'OCR': ['ocr', 'text extraction', 'image to text', 'read image'],
  'Search': ['search', 'find', 'lookup', 'query'],
  'WebSearch': ['web search', 'internet search', 'google search', 'bing'],
  'Communication': ['communication', 'message', 'chat', 'email'],
  'Email': ['email', 'send mail', 'gmail', 'outlook'],
  'Chat': ['chat', 'slack', 'discord', 'telegram', 'message'],
  'Automation': ['automation', 'automate', 'workflow', 'schedule'],
  'BrowserAutomation': ['browser', 'puppeteer', 'playwright', 'selenium'],
  'FileSystem': ['file', 'files', 'filesystem', 'read file', 'write file'],
  'Cloud': ['cloud', 'aws', 'gcp', 'azure', 'infrastructure'],
  'Finance': ['finance', 'payment', 'stripe', 'bank', 'crypto'],
  'Productivity': ['productivity', 'notion', 'todo', 'calendar', 'task']
};

export class CapabilityGraph {
  constructor(db) {
    this.db = db;
  }

  /**
   * Extract capabilities from tool metadata
   */
  async extractCapabilities(tool) {
    const text = `${tool.name} ${tool.description} ${tool.category}`.toLowerCase();
    const capabilities = [];

    for (const [capability, keywords] of Object.entries(INTENT_KEYWORDS)) {
      if (keywords.some(k => text.includes(k))) {
        capabilities.push(capability);
      }
    }

    // Also include existing capabilities from tools table
    if (tool.capabilities) {
      try {
        const existing = JSON.parse(tool.capabilities);
        for (const cap of existing) {
          if (!capabilities.includes(cap)) {
            capabilities.push(cap);
          }
        }
      } catch (error) {
        // Ignore parse errors
      }
    }

    return capabilities;
  }

  /**
   * Build capability graph from all tools
   */
  async buildGraph() {
    const tools = await this.db.prepare(
      `SELECT name, description, category, capabilities FROM tools WHERE deprecated = FALSE`
    ).all();

    const graph = {
      capabilities: new Map(),
      tools: new Map()
    };

    // Build capability nodes
    for (const [capability, relationships] of Object.entries(CAPABILITY_RELATIONSHIPS)) {
      graph.capabilities.set(capability, {
        name: capability,
        parents: relationships.parents || [],
        children: relationships.children || [],
        tools: []
      });
    }

    // Map tools to capabilities
    for (const tool of tools.results || []) {
      const capabilities = await this.extractCapabilities(tool);
      graph.tools.set(tool.name, {
        name: tool.name,
        capabilities
      });

      for (const capability of capabilities) {
        if (!graph.capabilities.has(capability)) {
          graph.capabilities.set(capability, {
            name: capability,
            parents: [],
            children: [],
            tools: []
          });
        }
        graph.capabilities.get(capability).tools.push(tool.name);
      }
    }

    return graph;
  }

  /**
   * Extract capabilities from a natural language intent
   */
  extractCapabilitiesFromIntent(intent) {
    const text = intent.toLowerCase();
    const capabilities = [];

    for (const [capability, keywords] of Object.entries(INTENT_KEYWORDS)) {
      if (keywords.some(k => text.includes(k))) {
        capabilities.push(capability);
      }
    }

    return capabilities;
  }

  /**
   * Expand capabilities to include parents and related capabilities
   */
  expandCapabilities(capabilities) {
    const expanded = new Set(capabilities);

    for (const capability of capabilities) {
      const node = CAPABILITY_RELATIONSHIPS[capability];
      if (node) {
        for (const parent of node.parents || []) {
          expanded.add(parent);
        }
        for (const child of node.children || []) {
          expanded.add(child);
        }
      }
    }

    return Array.from(expanded);
  }

  /**
   * Find servers that implement the given capabilities
   */
  async findServersForCapabilities(capabilities) {
    const graph = await this.buildGraph();
    const expanded = this.expandCapabilities(capabilities);
    const toolScores = new Map();

    for (const capability of expanded) {
      const node = graph.capabilities.get(capability);
      if (!node) continue;

      for (const toolName of node.tools) {
        const score = toolScores.get(toolName) || 0;
        toolScores.set(toolName, score + 1);
      }
    }

    // Sort by score descending
    const sorted = Array.from(toolScores.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, score]) => ({
        name,
        matched_capabilities: score,
        total_capabilities: expanded.length
      }));

    return sorted;
  }

  /**
   * Find servers for an intent (natural language)
   */
  async findServersForIntent(intent) {
    const capabilities = this.extractCapabilitiesFromIntent(intent);
    return {
      intent,
      extracted_capabilities: capabilities,
      expanded_capabilities: this.expandCapabilities(capabilities),
      servers: await this.findServersForCapabilities(capabilities)
    };
  }

  /**
   * Get full graph as JSON
   */
  async getGraph() {
    const graph = await this.buildGraph();
    const capabilities = {};
    const tools = {};

    for (const [name, node] of graph.capabilities) {
      capabilities[name] = {
        parents: node.parents,
        children: node.children,
        tools: node.tools
      };
    }

    for (const [name, tool] of graph.tools) {
      tools[name] = {
        capabilities: tool.capabilities
      };
    }

    return { capabilities, tools };
  }
}
