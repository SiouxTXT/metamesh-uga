-- MetaMesh-UGA Migration 005 - Semantic Search

-- ============================================
-- TABELLA EMBEDDINGS
-- ============================================
CREATE TABLE IF NOT EXISTS tool_embeddings (
  tool_name TEXT PRIMARY KEY,
  embedding TEXT NOT NULL, -- JSON array of floats
  dimensions INTEGER DEFAULT 128,
  model TEXT DEFAULT 'simple-tf-v1',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tool_name) REFERENCES tools(name)
);

CREATE INDEX IF NOT EXISTS idx_tool_embeddings_tool ON tool_embeddings(tool_name);

-- ============================================
-- VISTA RICERCA SEMANTICA
-- ============================================
CREATE VIEW IF NOT EXISTS v_tools_with_embedding AS
SELECT 
  t.name,
  t.version,
  t.category,
  t.description,
  t.popularity_score,
  t.trust_score,
  e.embedding,
  e.model
FROM tools t
LEFT JOIN tool_embeddings e ON t.name = e.tool_name
WHERE t.deprecated = FALSE;
