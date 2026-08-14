import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Store the SQLite file outside source control (see .gitignore). Allow an
// override via env so different environments can point at their own location.
const dbPath = process.env.DATABASE_PATH || join(__dirname, "..", "data", "site.sqlite");
mkdirSync(dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    body       TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const insertStmt = db.prepare(
  "INSERT INTO messages (name, body) VALUES (@name, @body) RETURNING id, name, body, created_at"
);
const listStmt = db.prepare(
  "SELECT id, name, body, created_at FROM messages ORDER BY id DESC LIMIT 200"
);
const countStmt = db.prepare("SELECT COUNT(*) AS count FROM messages");

export function addMessage({ name, body }) {
  return insertStmt.get({ name, body });
}

export function listMessages() {
  return listStmt.all();
}

export function countMessages() {
  return countStmt.get().count;
}

export default db;
