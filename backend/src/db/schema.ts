// backend/src/db/schema.ts
// Database schema initialization - creates all tables and indexes
import type { Database } from 'bun:sqlite'

export function initSchema(db: Database): void {
  // Enable WAL mode for better concurrent access
  db.exec('PRAGMA journal_mode = WAL')

  // Sessions: tracks each OpenCode session
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      hostname TEXT NOT NULL,
      directory TEXT,
      parent_session_id TEXT,
      status TEXT DEFAULT 'active',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      needs_attention INTEGER DEFAULT 0,
      token_total INTEGER DEFAULT 0,
      cost_total REAL DEFAULT 0
    )
  `)

  // Timeline events: user messages, tool calls, errors
  db.exec(`
    CREATE TABLE IF NOT EXISTS timeline_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      summary TEXT,
      tool_name TEXT,
      provider_id TEXT,
      model_id TEXT,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    )
  `)

  // Token usage: tracks per-message token consumption
  db.exec(`
    CREATE TABLE IF NOT EXISTS token_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      message_id TEXT,
      provider_id TEXT,
      model_id TEXT,
      agent TEXT,
      tokens_in INTEGER DEFAULT 0,
      tokens_out INTEGER DEFAULT 0,
      tokens_cache_read INTEGER DEFAULT 0,
      tokens_cache_write INTEGER DEFAULT 0,
      tokens_reasoning INTEGER DEFAULT 0,
      cost REAL DEFAULT 0,
      duration_ms INTEGER,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    )
  `)

  // File edits: tracks lines of code changes by language
  db.exec(`
    CREATE TABLE IF NOT EXISTS file_edits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_extension TEXT,
      operation TEXT NOT NULL,
      lines_added INTEGER DEFAULT 0,
      lines_removed INTEGER DEFAULT 0,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    )
  `)

  // Instances: VPS hostnames
  db.exec(`
    CREATE TABLE IF NOT EXISTS instances (
      hostname TEXT PRIMARY KEY,
      last_seen INTEGER NOT NULL,
      sessions_count INTEGER DEFAULT 0
    )
  `)

  // Indexes for query performance
  db.exec('CREATE INDEX IF NOT EXISTS idx_timeline_session ON timeline_events(session_id, timestamp)')
  db.exec('CREATE INDEX IF NOT EXISTS idx_token_session ON token_usage(session_id)')
  db.exec('CREATE INDEX IF NOT EXISTS idx_token_model ON token_usage(model_id, timestamp)')
  db.exec('CREATE INDEX IF NOT EXISTS idx_token_agent ON token_usage(agent, timestamp)')
  db.exec('CREATE INDEX IF NOT EXISTS idx_token_timestamp ON token_usage(timestamp DESC)')
  db.exec('CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status, updated_at)')
  db.exec('CREATE INDEX IF NOT EXISTS idx_sessions_parent ON sessions(parent_session_id)')
  db.exec('CREATE INDEX IF NOT EXISTS idx_sessions_directory ON sessions(directory)')
  db.exec('CREATE INDEX IF NOT EXISTS idx_file_edits_session ON file_edits(session_id)')
  db.exec('CREATE INDEX IF NOT EXISTS idx_file_edits_ext ON file_edits(file_extension)')
}
