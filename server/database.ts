import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export function openDatabase(path: string) {
  if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true, mode: 0o700 });
  const db = new Database(path);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY, data TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
      name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
      recovery_hash TEXT NOT NULL, is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, expires_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      csrf_token TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
    CREATE TABLE IF NOT EXISTS commands (
      id TEXT NOT NULL, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      payload_hash TEXT NOT NULL, revision INTEGER NOT NULL, created_at TEXT NOT NULL,
      PRIMARY KEY(workspace_id, id)
    );
    CREATE TABLE IF NOT EXISTS audit (
      sequence INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      action TEXT NOT NULL, detail TEXT NOT NULL, revision INTEGER NOT NULL,
      created_at TEXT NOT NULL, previous_hash TEXT NOT NULL, hash TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS audit_workspace ON audit(workspace_id, sequence);
    PRAGMA user_version = 1;
  `);
  return db;
}

export type AppDatabase = ReturnType<typeof openDatabase>;
