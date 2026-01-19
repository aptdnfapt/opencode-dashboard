// backend/src/db/index.ts
// Database singleton - initializes once on import
import { Database } from 'bun:sqlite'
import { initSchema } from './schema'
import { mkdirSync } from 'fs'
import { dirname } from 'path'

const dbPath = process.env.DATABASE_URL || './data/database.db'

// Ensure data directory exists
mkdirSync(dirname(dbPath), { recursive: true })

const db = new Database(dbPath)
initSchema(db)

export default db
