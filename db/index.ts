import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

declare global {
  // eslint-disable-next-line no-var
  var __db: ReturnType<typeof drizzle<typeof schema>> | undefined;
  // eslint-disable-next-line no-var
  var __dbInit: boolean | undefined;
}

function createDb() {
  const DATA_DIR = path.join(process.cwd(), "data");
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const sqlite = new Database(path.join(DATA_DIR, "app.db"));
  sqlite.pragma("journal_mode = WAL");

  // Run migrations inline
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      session_id TEXT PRIMARY KEY,
      month TEXT NOT NULL,
      date TEXT NOT NULL,
      series TEXT NOT NULL,
      title TEXT NOT NULL,
      time_policy TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      location TEXT,
      presenter TEXT,
      source TEXT,
      raw_text TEXT NOT NULL DEFAULT '',
      dedupe_key TEXT NOT NULL UNIQUE,
      google_event_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS papers (
      paper_id TEXT PRIMARY KEY,
      session_id TEXT,
      filename TEXT NOT NULL,
      file_hash TEXT NOT NULL UNIQUE,
      summary_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notification_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      month TEXT,
      sent_at TEXT NOT NULL,
      status TEXT NOT NULL,
      error_message TEXT
    );
  `);

  return drizzle(sqlite, { schema });
}

// Singleton: reuse connection across hot-reloads in dev
export const db: ReturnType<typeof drizzle<typeof schema>> =
  globalThis.__db ?? (globalThis.__db = createDb());

// No-op kept for backward compat — DB is initialized on first import
export function initDb() {}
