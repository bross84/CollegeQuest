const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { openDb } = require('./db');
const { createAuth } = require('./auth');
const { createAi, AiError } = require('./ai');
const { typeOf, extractText, search } = require('./docs');

const newId = () => crypto.randomBytes(6).toString('hex');
const clip = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const PACKS = ['chem', 'algebra', 'general'];

function createApp(cfg) {
  const db = openDb(cfg.dataDir);
  const auth = createAuth(cfg);
  const ai = createAi(cfg);
  const uploads = path.join(cfg.dataDir, 'uploads');
  fs.mkdirSync(uploads, { recursive: true });

  const app = express();
  app.disable('x-powered-by');
  if (cfg.trustProxy) app.set('trust proxy', true);
  app.use((req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'same-origin'); next(); });

  const api = express.Router();
  const json = express.json({ limit: '2mb' });
  api.get('/health', (req, res) => res.json({ ok: true }));
  api.get('/session', (req, res) => res.json({ authRequired: auth.required, authed: auth.authed(req) }));
  api.post('/login', express.json({ limit: '10kb' }), (req, res) => auth.login(req, res));
  api.post('/logout', (req, res) => auth.logout(req, res));
  api.use(auth.middleware);

  // ---- AI ----
  api.get('/ai/status', (req, res) => res.json(ai.status()));
  api.post('/ai', express.json({ limit: '40mb' }), async (req, res) => {
    const b = req.body || {};
    const messages = Array.isArray(b.messages)
      ? b.messages.filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string').slice(-24).map((m) => ({ role: m.role, content: m.content.slice(0, 60000) }))
      : [];
    if (!messages.length) return res.status(400).json({ error: { code: 'bad_request', message: 'No messages.' } });
    const images = [];
    for (const im of (Array.isArray(b.images) ? b.images : []).slice(0, 6)) {
      if (typeof im === 'string' && /^data:image\/(png|jpe?g|webp|gif);base64,/.test(im)) images.push(im);
      else if (im && typeof im.doc === 'string') {
        const d = db.prepare("SELECT file, mime FROM documents WHERE id = ? AND kind = 'image'").get(im.doc);
        if (d) images.push(`data:${d.mime};base64,${fs.readFileSync(path.join(uploads, d.file)).toString('base64')}`);
      }
    }
    const ctl = new AbortController();
    res.on('close', () => { if (!res.writableEnded) ctl.abort(new Error('client closed')); });
    const opts = { messages, images, quick: !!b.quick, signal: ctl.signal };
    const fail = (e) => ({ code: e.code || 'ai_error', message: e.message || 'AI request failed', text: e.partial || '' });
    if (!b.stream) {
      try { return res.json({ text: await ai.chat({ ...opts, stream: false }) }); }
      catch (e) { return res.status(e instanceof AiError ? e.status : 502).json({ error: fail(e) }); }
    }
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    const send = (o) => res.write(`data: ${JSON.stringify(o)}\n\n`);
    try {
      await ai.chat({ ...opts, stream: true, onDelta: (t) => send({ t }) });
      send({ done: true });
    } catch (e) { if (!ctl.signal.aborted) send({ error: fail(e) }); }
    res.end();
  });

  // ---- classes ----
  const classRow = (r) => ({ id: r.id, name: r.name, pack: r.pack, description: r.description, examLabel: r.exam_label, examDate: r.exam_date, createdAt: r.created_at });
  function stats(id) {
    const out = { docs: db.prepare('SELECT COUNT(*) n FROM documents WHERE class_id = ?').get(id).n, total: 0, lastDay: null, streak: 0, openHw: 0 };
    const st = db.prepare('SELECT json FROM class_state WHERE class_id = ?').get(id);
    if (st) {
      try {
        const s = JSON.parse(st.json);
        out.total = s.total || 0; out.lastDay = s.lastDay || null; out.streak = s.streak || 0;
        out.openHw = (s.mine || []).filter((m) => m.status !== 'done').length;
      } catch (e) { /* unreadable state: show zeros */ }
    }
    return out;
  }
  function classInput(b, partial) {
    const out = {};
    if (!partial || b.name !== undefined) out.name = clip(b.name, 80);
    if (!partial || b.pack !== undefined) out.pack = PACKS.includes(b.pack) ? b.pack : 'general';
    if (!partial || b.description !== undefined) out.description = clip(b.description, 2000);
    if (!partial || b.examLabel !== undefined) out.examLabel = clip(b.examLabel, 60);
    if (!partial || b.examDate !== undefined) out.examDate = /^\d{4}-\d{2}-\d{2}$/.test(b.examDate || '') ? b.examDate : '';
    return out;
  }
  const getClass = (id) => db.prepare('SELECT * FROM classes WHERE id = ?').get(id);
  const needClass = (req, res) => { const c = getClass(req.params.id); if (!c) res.status(404).json({ error: 'No such class.' }); return c; };

  api.get('/classes', (req, res) => {
    res.json(db.prepare('SELECT * FROM classes ORDER BY created_at').all().map((r) => ({ ...classRow(r), stats: stats(r.id) })));
  });
  api.post('/classes', json, (req, res) => {
    const c = classInput(req.body || {}, false);
    if (!c.name) return res.status(400).json({ error: 'Give the class a name.' });
    const id = newId();
    db.prepare('INSERT INTO classes (id, name, pack, description, exam_label, exam_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, c.name, c.pack, c.description, c.examLabel, c.examDate, Date.now());
    res.status(201).json({ ...classRow(getClass(id)), stats: stats(id) });
  });
  api.patch('/classes/:id', json, (req, res) => {
    const cur = needClass(req, res); if (!cur) return;
    const c = classInput(req.body || {}, true);
    if (c.name === '') return res.status(400).json({ error: 'Give the class a name.' });
    delete c.pack; // the subject can't change once progress exists
    const col = { name: 'name', description: 'description', examLabel: 'exam_label', examDate: 'exam_date' };
    for (const [k, v] of Object.entries(c)) db.prepare(`UPDATE classes SET ${col[k]} = ? WHERE id = ?`).run(v, cur.id);
    res.json({ ...classRow(getClass(cur.id)), stats: stats(cur.id) });
  });
  api.delete('/classes/:id', (req, res) => {
    const cur = needClass(req, res); if (!cur) return;
    db.prepare('DELETE FROM classes WHERE id = ?').run(cur.id);
    fs.rmSync(path.join(uploads, cur.id), { recursive: true, force: true });
    res.json({ ok: true });
  });

  // ---- per-class game state (opaque JSON; the client merges conflicts) ----
  api.get('/classes/:id/state', (req, res) => {
    const c = needClass(req, res); if (!c) return;
    const st = db.prepare('SELECT t, json FROM class_state WHERE class_id = ?').get(c.id);
    res.json(st || { t: 0, json: null });
  });
  api.put('/classes/:id/state', express.json({ limit: '4mb' }), (req, res) => {
    const c = needClass(req, res); if (!c) return;
    const { t, baseT, json: body } = req.body || {};
    if (typeof body !== 'string' || !Number.isFinite(+t)) return res.status(400).json({ error: 'Bad state.' });
    try { JSON.parse(body); } catch (e) { return res.status(400).json({ error: 'Bad state.' }); }
    const cur = db.prepare('SELECT t, json FROM class_state WHERE class_id = ?').get(c.id);
    if (cur && cur.t > (+baseT || 0) && cur.t !== +t) return res.status(409).json(cur); // saved elsewhere since this device last synced
    db.prepare('INSERT INTO class_state (class_id, t, json) VALUES (?, ?, ?) ON CONFLICT(class_id) DO UPDATE SET t = excluded.t, json = excluded.json').run(c.id, +t, body);
    res.json({ ok: true, t: +t });
  });

  // ---- documents ----
  const DOC_COLS = 'id, class_id, name, kind, size, note, use_context, created_at, LENGTH(text) AS chars';
  const docRow = (r) => ({ id: r.id, classId: r.class_id, name: r.name, kind: r.kind, size: r.size, chars: r.chars, note: r.note, useContext: !!r.use_context, createdAt: r.created_at });
  const docById = (id) => docRow(db.prepare(`SELECT ${DOC_COLS} FROM documents WHERE id = ?`).get(id));
  const upload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => { const d = path.join(uploads, req.params.id); fs.mkdirSync(d, { recursive: true }); cb(null, d); },
      filename: (req, file, cb) => cb(null, newId() + path.extname(file.originalname).toLowerCase()),
    }),
    limits: { fileSize: cfg.maxUploadMb * 1024 * 1024, files: 20 },
    fileFilter: (req, file, cb) => cb(null, !!typeOf(file.originalname)),
  });
  // multer decodes names as latin1; recover UTF-8 names
  const fixName = (n) => Buffer.from(n, 'latin1').toString('utf8');

  api.get('/classes/:id/docs', (req, res) => {
    const c = needClass(req, res); if (!c) return;
    res.json(db.prepare(`SELECT ${DOC_COLS} FROM documents WHERE class_id = ? ORDER BY created_at DESC`).all(c.id).map(docRow));
  });
  api.post('/classes/:id/docs', (req, res, next) => { if (needClass(req, res)) next(); }, upload.array('files', 20), async (req, res) => {
    const made = [];
    for (const f of req.files || []) {
      const t = typeOf(f.originalname);
      const { text, note } = await extractText(t.kind, f.path);
      const id = path.basename(f.filename, path.extname(f.filename));
      db.prepare('INSERT INTO documents (id, class_id, name, kind, mime, size, file, text, note, use_context, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, req.params.id, clip(fixName(f.originalname), 200), t.kind, t.mime, f.size, `${req.params.id}/${f.filename}`, text, note, t.kind === 'image' ? 0 : 1, Date.now());
      made.push(docById(id));
    }
    if (!made.length) return res.status(400).json({ error: 'No supported files. Use photos, PDF, DOCX, TXT or MD.' });
    return res.status(201).json(made);
  });
  api.post('/classes/:id/notes', json, (req, res) => {
    const c = needClass(req, res); if (!c) return;
    const text = clip(req.body && req.body.text, 500000);
    if (!text) return res.status(400).json({ error: 'Nothing to save.' });
    const id = newId(), name = clip(req.body.name, 120) || 'Pasted notes';
    const dir = path.join(uploads, c.id); fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, id + '.txt'), text);
    db.prepare('INSERT INTO documents (id, class_id, name, kind, mime, size, file, text, note, use_context, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)')
      .run(id, c.id, name, 'text', 'text/plain; charset=utf-8', Buffer.byteLength(text), `${c.id}/${id}.txt`, text, '', Date.now());
    res.status(201).json(docById(id));
  });
  const getDoc = (req, res) => { const d = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id); if (!d) res.status(404).json({ error: 'No such document.' }); return d; };
  api.get('/docs/:id/file', (req, res) => {
    const d = getDoc(req, res); if (!d) return;
    res.setHeader('Content-Type', d.mime);
    res.setHeader('Content-Disposition', `${d.kind === 'docx' ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(d.name)}`);
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox");
    fs.createReadStream(path.join(uploads, d.file)).on('error', () => res.destroy()).pipe(res);
  });
  api.get('/docs/:id/text', (req, res) => {
    const d = getDoc(req, res); if (!d) return;
    res.json({ id: d.id, name: d.name, kind: d.kind, text: d.text, note: d.note });
  });
  api.patch('/docs/:id', json, (req, res) => {
    const d = getDoc(req, res); if (!d) return;
    const b = req.body || {};
    if (b.name !== undefined && clip(b.name, 200)) db.prepare('UPDATE documents SET name = ? WHERE id = ?').run(clip(b.name, 200), d.id);
    if (b.useContext !== undefined) db.prepare('UPDATE documents SET use_context = ? WHERE id = ?').run(b.useContext ? 1 : 0, d.id);
    res.json(docById(d.id));
  });
  api.delete('/docs/:id', (req, res) => {
    const d = getDoc(req, res); if (!d) return;
    db.prepare('DELETE FROM documents WHERE id = ?').run(d.id);
    fs.rmSync(path.join(uploads, d.file), { force: true });
    res.json({ ok: true });
  });
  api.post('/classes/:id/search', json, (req, res) => {
    const c = needClass(req, res); if (!c) return;
    const docs = db.prepare("SELECT name, text FROM documents WHERE class_id = ? AND use_context = 1 AND text != ''").all(c.id);
    res.json(search(docs, clip(req.body && req.body.q, 2000), 3));
  });

  api.use((req, res) => res.status(404).json({ error: 'Not found.' }));
  api.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    if (err instanceof multer.MulterError) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? `File too large (limit ${cfg.maxUploadMb} MB).` : err.message });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Too large.' });
    console.error(err);
    return res.status(500).json({ error: 'Server error.' });
  });
  app.use('/api', api);

  app.use(express.static(cfg.publicDir, { etag: true, index: 'index.html' }));
  app.use((req, res) => res.status(404).send('Not found'));
  return { app, db };
}

module.exports = { createApp };
