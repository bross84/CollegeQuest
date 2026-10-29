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
  if (v < 4) {
    // Chapters group a class's documents, guides and problems. Rows with no chapter show as "Unsorted".
    db.exec(`
      CREATE TABLE chapters (
        id TEXT PRIMARY KEY,
        class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        position INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX chapters_class ON chapters(class_id);
      ALTER TABLE documents ADD COLUMN chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL;
      ALTER TABLE documents ADD COLUMN tag TEXT NOT NULL DEFAULT '';
      ALTER TABLE guides ADD COLUMN chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL;
      CREATE TABLE problems (
        id TEXT PRIMARY KEY,
        class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
        source_doc TEXT NOT NULL DEFAULT '',
        kind TEXT NOT NULL DEFAULT 'original',
        text TEXT NOT NULL,
        answer TEXT NOT NULL DEFAULT '',
        steps TEXT NOT NULL DEFAULT '[]',
        topic TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL
      );
      CREATE INDEX problems_chapter ON problems(chapter_id);
      CREATE INDEX problems_class ON problems(class_id);
      PRAGMA user_version = 4;
    `);
  }
  if (v < 5) {
    // Cached YouTube searches: each live search costs 100 of the 10,000 daily quota units.
    db.exec('CREATE TABLE video_cache (q TEXT PRIMARY KEY, json TEXT NOT NULL, fetched_at INTEGER NOT NULL); PRAGMA user_version = 5;');
  }
  if (v < 6) {
    // Saved study sets and exams: a title and an ordered list of bank problems ({ id, src, key }), so a set can be retaken or printed.
    db.exec(`
      CREATE TABLE studysets (
        id TEXT PRIMARY KEY,
        class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        kind TEXT NOT NULL DEFAULT 'chapter',
        title TEXT NOT NULL,
        chapter_ids TEXT NOT NULL DEFAULT '[]',
        items TEXT NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL
      );
      CREATE INDEX studysets_class ON studysets(class_id);
      PRAGMA user_version = 6;
    `);
  }
  if (v < 7) {
    // A class has several key dates (when it starts, each exam, the final) instead of the one exam_label/exam_date pair.
    db.exec(`
      ALTER TABLE classes ADD COLUMN dates TEXT NOT NULL DEFAULT '[]';
      UPDATE classes SET dates = json_array(json_object('label', CASE WHEN exam_label = '' THEN 'Exam' ELSE exam_label END, 'date', exam_date)) WHERE exam_date <> '';
      PRAGMA user_version = 7;
    `);
  }
  return db;
}

module.exports = { openDb };
