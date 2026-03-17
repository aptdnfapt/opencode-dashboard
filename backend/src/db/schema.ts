// backend/src/db/schema.ts
// Database schema initialization - creates all tables and indexes
import type { Database } from 'bun:sqlite'

export function initSchema(db: Database): void {
  // Enable WAL mode for better concurrent access
  db.exec('PRAGMA journal_mode = WAL')

  // Sessions: tracks each OpenCode session
  // Chamber metadata: is_tracked, group_tag, completed_at, completed_reason
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
      cost_total REAL DEFAULT 0,
      is_tracked INTEGER DEFAULT 0,
      group_tag TEXT,
      completed_at INTEGER,
      completed_reason TEXT
    )
  `)

  // Migration: add new columns if they don't exist (for existing databases)
  // SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN
  // Use PRAGMA table_info to check column existence
  const columns = db.prepare("PRAGMA table_info(sessions)").all() as { name: string }[]
  const columnNames = columns.map(c => c.name)
  
  if (!columnNames.includes('is_tracked')) {
    db.exec('ALTER TABLE sessions ADD COLUMN is_tracked INTEGER DEFAULT 0')
  }
  if (!columnNames.includes('group_tag')) {
    db.exec('ALTER TABLE sessions ADD COLUMN group_tag TEXT')
  }
  if (!columnNames.includes('completed_at')) {
    db.exec('ALTER TABLE sessions ADD COLUMN completed_at INTEGER')
  }
  if (!columnNames.includes('completed_reason')) {
    db.exec('ALTER TABLE sessions ADD COLUMN completed_reason TEXT')
  }

  // Project holds: row-level hold state for Captain's Chamber
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_holds (
      directory TEXT PRIMARY KEY,
      is_held INTEGER DEFAULT 0,
      updated_at INTEGER NOT NULL
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

  // Notes: per-session user annotations with message references
  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      content TEXT NOT NULL,
      message_refs TEXT DEFAULT '[]',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
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
  // New indexes for Chamber metadata (these will be added if they don't exist)
  db.exec('CREATE INDEX IF NOT EXISTS idx_sessions_tracked ON sessions(is_tracked, updated_at)')
  db.exec('CREATE INDEX IF NOT EXISTS idx_sessions_group_tag ON sessions(group_tag)')
  db.exec('CREATE INDEX IF NOT EXISTS idx_sessions_completed ON sessions(completed_at)')
  db.exec('CREATE INDEX IF NOT EXISTS idx_file_edits_session ON file_edits(session_id)')
  db.exec('CREATE INDEX IF NOT EXISTS idx_file_edits_ext ON file_edits(file_extension)')
  db.exec('CREATE INDEX IF NOT EXISTS idx_notes_session ON notes(session_id)')
}
