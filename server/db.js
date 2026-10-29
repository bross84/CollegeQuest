// SQLite via Node's built-in node:sqlite, so there is nothing native to compile.
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

function openDb(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, 'collegequest.db'));
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const v = db.prepare('PRAGMA user_version').get().user_version;
  if (v < 1) {
    db.exec(`
      CREATE TABLE classes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        pack TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        exam_label TEXT NOT NULL DEFAULT '',
        exam_date TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL
      );
      CREATE TABLE class_state (
        class_id TEXT PRIMARY KEY REFERENCES classes(id) ON DELETE CASCADE,
        t INTEGER NOT NULL,
        json TEXT NOT NULL
      );
      CREATE TABLE documents (
        id TEXT PRIMARY KEY,
        class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        mime TEXT NOT NULL,
        size INTEGER NOT NULL,
        file TEXT NOT NULL,
        text TEXT NOT NULL DEFAULT '',
        note TEXT NOT NULL DEFAULT '',
        use_context INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX documents_class ON documents(class_id);
      PRAGMA user_version = 1;
    `);
  }
  if (v < 2) db.exec('CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL); PRAGMA user_version = 2;');
  if (v < 3) {
    db.exec(`
      CREATE TABLE guides (
        id TEXT PRIMARY KEY,
        class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        docs TEXT NOT NULL DEFAULT '[]',
        json TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX guides_class ON guides(class_id);
      PRAGMA user_version = 3;
    `);
  }
  return db;
}

module.exports = { openDb };
