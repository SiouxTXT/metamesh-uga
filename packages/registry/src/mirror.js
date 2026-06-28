/**
 * MetaMesh-UGA Registry Mirroring
 * 
 * Creates snapshots of the registry, stores them in R2, and restores them.
 * Phase 4 implementation: JSON snapshot of tools and registry_sources.
 */

export class RegistryMirror {
  constructor(db, storage) {
    this.db = db;
    this.storage = storage;
  }

  /**
   * Create a snapshot of the registry
   */
  async snapshot(name = null) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const snapshotName = name || `registry-snapshot-${timestamp}`;
    const key = `snapshots/${snapshotName}.json`;

    const tools = await this.db.prepare(
      `SELECT name, version, category, description, schema, source_url, registry_url,
              registry_source, registry_priority, capabilities, state, trust_score,
              security_score, popularity_score, deprecated
       FROM tools
       WHERE deprecated = FALSE
       ORDER BY name`
    ).all();

    const sources = await this.db.prepare(
      `SELECT name, url, type, priority, enabled, sync_interval_hours
       FROM registry_sources
       ORDER BY priority`
    ).all();

    const snapshot = {
      version: '1.0.0',
      created_at: new Date().toISOString(),
      tools: tools.results || [],
      registry_sources: sources.results || []
    };

    const body = JSON.stringify(snapshot, null, 2);
    const size = new TextEncoder().encode(body).length;

    // Store in R2 if available
    if (this.storage) {
      await this.storage.put(key, body, {
        httpMetadata: { contentType: 'application/json' }
      });
    }

    // Record in database
    await this.db.prepare(
      `INSERT INTO registry_snapshots (name, key, source, size_bytes, tool_count, source_count, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      snapshotName,
      key,
      this.storage ? 'r2' : 'db-only',
      size,
      snapshot.tools.length,
      snapshot.registry_sources.length,
      'success'
    ).run();

    return {
      name: snapshotName,
      key,
      size_bytes: size,
      tool_count: snapshot.tools.length,
      source_count: snapshot.registry_sources.length,
      storage: this.storage ? 'r2' : 'db-only'
    };
  }

  /**
   * List all snapshots
   */
  async listSnapshots() {
    const snapshots = await this.db.prepare(
      `SELECT id, name, key, source, size_bytes, tool_count, source_count, status, created_at
       FROM registry_snapshots
       ORDER BY created_at DESC`
    ).all();

    return snapshots.results || [];
  }

  /**
   * Restore a snapshot by key
   */
  async restore(key) {
    let snapshot;

    // Try R2 first
    if (this.storage) {
      try {
        const object = await this.storage.get(key);
        if (object) {
          snapshot = await object.json();
        }
      } catch (error) {
        console.log('R2 restore failed, falling back to DB:', error);
      }
    }

    if (!snapshot) {
      return {
        success: false,
        error: 'Snapshot not found or R2 not configured'
      };
    }

    // Restore tools
    let restoredTools = 0;
    for (const tool of snapshot.tools || []) {
      try {
        await this.db.prepare(
          `INSERT INTO tools
            (name, version, category, description, schema, source_url, registry_url,
             registry_source, registry_priority, capabilities, state, trust_score,
             security_score, popularity_score, deprecated)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(name) DO UPDATE SET
              version = excluded.version,
              category = excluded.category,
              description = excluded.description,
              schema = excluded.schema,
              source_url = excluded.source_url,
              registry_url = excluded.registry_url,
              registry_source = excluded.registry_source,
              registry_priority = excluded.registry_priority,
              capabilities = excluded.capabilities,
              state = excluded.state,
              trust_score = excluded.trust_score,
              security_score = excluded.security_score,
              popularity_score = excluded.popularity_score,
              deprecated = excluded.deprecated`
        ).bind(
          tool.name, tool.version, tool.category, tool.description,
          tool.schema, tool.source_url, tool.registry_url,
          tool.registry_source, tool.registry_priority, tool.capabilities,
          tool.state, tool.trust_score, tool.security_score, tool.popularity_score,
          tool.deprecated
        ).run();
        restoredTools++;
      } catch (error) {
        console.error(`Failed to restore ${tool.name}:`, error);
      }
    }

    // Restore registry sources
    let restoredSources = 0;
    for (const source of snapshot.registry_sources || []) {
      try {
        await this.db.prepare(
          `INSERT INTO registry_sources (name, url, type, priority, enabled, sync_interval_hours)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(name) DO UPDATE SET
             url = excluded.url,
             type = excluded.type,
             priority = excluded.priority,
             enabled = excluded.enabled,
             sync_interval_hours = excluded.sync_interval_hours`
        ).bind(
          source.name, source.url, source.type, source.priority,
          source.enabled, source.sync_interval_hours
        ).run();
        restoredSources++;
      } catch (error) {
        console.error(`Failed to restore source ${source.name}:`, error);
      }
    }

    // Update snapshot record
    await this.db.prepare(
      `UPDATE registry_snapshots SET restored_at = CURRENT_TIMESTAMP WHERE key = ?`
    ).bind(key).run();

    return {
      success: true,
      restored_tools: restoredTools,
      restored_sources: restoredSources
    };
  }

  /**
   * Delete a snapshot
   */
  async deleteSnapshot(key) {
    if (this.storage) {
      await this.storage.delete(key);
    }

    await this.db.prepare(
      'DELETE FROM registry_snapshots WHERE key = ?'
    ).bind(key).run();

    return { deleted: true };
  }
}
