const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { openDb } = require('./db');
const { createAuth } = require('./auth');
const { createAi, AiError } = require('./ai');
const { typeOf, extractText, search, cleanGlyphs } = require('./docs');

const newId = () => crypto.randomBytes(6).toString('hex');
const clip = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const PACKS = ['general']; // a class's subject; classes saved with a retired subject read as general

function createApp(cfg) {
  const db = openDb(cfg.dataDir);
  const auth = createAuth(cfg);
  // AI settings: environment variables are the defaults, and anything saved from the Settings screen overrides them.
  const MODELS = ['smart', 'quick', 'vision'], NAMES = Object.keys(cfg.ai.providers);
  const aiOverrides = () => {
    const r = db.prepare("SELECT value FROM settings WHERE key = 'ai'").get();
    try { return r ? JSON.parse(r.value) : {}; } catch (e) { return {}; }
  };
  const youtubeKey = () => aiOverrides().youtubeKey || cfg.youtube.key;
  function effectiveAi() {
    const o = aiOverrides(), out = { ...cfg.ai, providers: {} };
    NAMES.forEach((n) => { const ov = o[n] || {}; out.providers[n] = { ...cfg.ai.providers[n], ...Object.fromEntries(['key', ...MODELS].filter((k) => ov[k]).map((k) => [k, ov[k]])) }; });
    if (Array.isArray(o.order) && o.order.length) out.order = o.order.filter((n) => NAMES.includes(n));
    return out;
  }
  const ai = createAi(cfg, effectiveAi);
  const uploads = path.join(cfg.dataDir, 'uploads');
  fs.mkdirSync(uploads, { recursive: true });

  const app = express();
  app.disable('x-powered-by');
  if (cfg.trustProxy) app.set('trust proxy', cfg.trustProxy);
  app.use((req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'same-origin'); next(); });

  const api = express.Router();
  const json = express.json({ limit: '2mb' });
  api.get('/health', (req, res) => res.json({ ok: true }));
  api.get('/session', (req, res) => res.json({ authRequired: auth.required, authed: auth.authed(req), public: auth.isPublic(req) }));
  api.post('/login', express.json({ limit: '10kb' }), (req, res) => auth.login(req, res));
  api.post('/logout', (req, res) => auth.logout(req, res));
  api.use(auth.middleware);

  // ---- AI ----
  api.get('/ai/status', (req, res) => res.json({ ...ai.status(), videos: !!youtubeKey() }));

  // ---- settings (keys are never sent back in full) ----
  function settingsView() {
    const o = aiOverrides(), eff = effectiveAi();
    return {
      canEdit: auth.required,
      order: eff.order,
      youtube: { keySource: o.youtubeKey ? 'app' : cfg.youtube.key ? 'env' : 'none', keyHint: youtubeKey() ? '…' + youtubeKey().slice(-4) : '' },
      providers: Object.fromEntries(NAMES.map((n) => {
        const ov = o[n] || {}, base = cfg.ai.providers[n], key = eff.providers[n].key;
        return [n, {
          keySource: ov.key ? 'app' : base.key ? 'env' : 'none', keyHint: key ? '…' + key.slice(-4) : '',
          models: { smart: ov.smart || '', quick: ov.quick || '', vision: ov.vision || '' },
          defaults: { smart: base.smart, quick: base.quick, vision: base.vision },
        }];
      })),
    };
  }
  api.get('/settings', (req, res) => res.json(settingsView()));
  api.put('/settings', json, (req, res) => {
    if (!auth.required) return res.status(403).json({ error: 'Set APP_PASSWORD on the server before editing keys here, so only you can change them.' });
    const b = req.body || {}, o = aiOverrides();
    NAMES.forEach((n) => {
      const inb = b[n];
      if (!inb || typeof inb !== 'object') return;
      const ov = o[n] || {};
      if (typeof inb.key === 'string') ov.key = inb.key.trim().slice(0, 300);
      MODELS.forEach((m) => { if (typeof inb[m] === 'string') ov[m] = inb[m].trim().slice(0, 120); });
      o[n] = ov;
    });
    if (typeof b.youtubeKey === 'string') o.youtubeKey = b.youtubeKey.trim().slice(0, 300);
    if (Array.isArray(b.order) && b.order.length && b.order.every((n) => NAMES.includes(n))) o.order = [...new Set(b.order)];
    db.prepare("INSERT INTO settings (key, value) VALUES ('ai', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(JSON.stringify(o));
    return res.json(settingsView());
  });
  api.post('/settings/test', json, async (req, res) => {
    const n = req.body && req.body.provider;
    if (!NAMES.includes(n)) return res.status(400).json({ error: 'Unknown provider.' });
    const t0 = Date.now();
    try {
      const reply = await ai.chat({ messages: [{ role: 'user', content: 'Reply with the single word OK.' }], quick: true, stream: false, only: n });
      return res.json({ ok: true, ms: Date.now() - t0, model: effectiveAi().providers[n].quick, reply: reply.trim().slice(0, 40) });
    } catch (e) { return res.json({ ok: false, code: e.code || 'ai_error', message: e.message }); }
  });
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
    const opts = { messages, images, quick: !!b.quick, signal: ctl.signal, maxTokens: Math.min(Math.max(+b.maxTokens || 0, 0), 6000) || undefined };
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
  const classRow = (r) => ({ id: r.id, name: r.name, pack: PACKS.includes(r.pack) ? r.pack : 'general', description: r.description, dates: JSON.parse(r.dates || '[]'), topics: JSON.parse(r.topics || '[]'), createdAt: r.created_at });
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
    if (!partial || b.dates !== undefined) {
      out.dates = JSON.stringify((Array.isArray(b.dates) ? b.dates : []).slice(0, 12)
        .map((d) => ({ label: clip(d && d.label, 60), date: /^\d{4}-\d{2}-\d{2}$/.test((d && d.date) || '') ? d.date : '' }))
        .filter((d) => d.date).sort((a, b2) => (a.date < b2.date ? -1 : a.date > b2.date ? 1 : 0)));
    }
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
    db.prepare('INSERT INTO classes (id, name, pack, description, dates, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, c.name, c.pack, c.description, c.dates, Date.now());
    res.status(201).json({ ...classRow(getClass(id)), stats: stats(id) });
  });
  api.patch('/classes/:id', json, (req, res) => {
    const cur = needClass(req, res); if (!cur) return;
    const c = classInput(req.body || {}, true);
    if (c.name === '') return res.status(400).json({ error: 'Give the class a name.' });
    delete c.pack; // the subject can't change once progress exists
    const col = { name: 'name', description: 'description', dates: 'dates' };
    for (const [k, v] of Object.entries(c)) db.prepare(`UPDATE classes SET ${col[k]} = ? WHERE id = ?`).run(v, cur.id);
    res.json({ ...classRow(getClass(cur.id)), stats: stats(cur.id) });
  });
  api.put('/classes/:id/topics', json, (req, res) => {
    const cur = needClass(req, res); if (!cur) return;
    const seen = new Set(), topics = [];
    for (const t of Array.isArray(req.body && req.body.topics) ? req.body.topics.slice(0, 600) : []) {
      const title = clip(t && t.title, 80), key = title.toLowerCase();
      if (!title || seen.has(key)) continue;
      seen.add(key); topics.push({ chapterId: chapterOf(cur.id, t.chapterId), title });
    }
    db.prepare('UPDATE classes SET topics = ? WHERE id = ?').run(JSON.stringify(topics), cur.id);
    res.json({ topics });
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
  const DOC_COLS = 'id, class_id, chapter_id, tag, name, kind, size, note, use_context, created_at, LENGTH(text) AS chars';
  const TAGS = ['', 'exam', 'textbook', 'notes', 'slides'];
  const docRow = (r) => ({ id: r.id, classId: r.class_id, chapterId: r.chapter_id, tag: r.tag, name: r.name, kind: r.kind, size: r.size, chars: r.chars, note: r.note, useContext: !!r.use_context, createdAt: r.created_at });
  // A chapter id from the client only counts when it belongs to this class; otherwise the row stays unsorted.
  const chapterOf = (classId, id) => (id && db.prepare('SELECT id FROM chapters WHERE id = ? AND class_id = ?').get(String(id), classId) ? String(id) : null);
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
      db.prepare('INSERT INTO documents (id, class_id, chapter_id, tag, name, kind, mime, size, file, text, note, use_context, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, req.params.id, chapterOf(req.params.id, req.query.chapterId), TAGS.includes(req.query.tag) ? req.query.tag : '', clip(fixName(f.originalname), 200), t.kind, t.mime, f.size, `${req.params.id}/${f.filename}`, text, note, t.kind === 'image' ? 0 : 1, Date.now());
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
    db.prepare('INSERT INTO documents (id, class_id, chapter_id, tag, name, kind, mime, size, file, text, note, use_context, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)')
      .run(id, c.id, chapterOf(c.id, req.body.chapterId), TAGS.includes(req.body.tag) ? req.body.tag : 'notes', name, 'text', 'text/plain; charset=utf-8', Buffer.byteLength(text), `${c.id}/${id}.txt`, text, '', Date.now());
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
    res.json({ id: d.id, name: d.name, kind: d.kind, text: cleanGlyphs(d.text), note: d.note });
  });
  api.patch('/docs/:id', json, (req, res) => {
    const d = getDoc(req, res); if (!d) return;
    const b = req.body || {};
    if (b.name !== undefined && clip(b.name, 200)) db.prepare('UPDATE documents SET name = ? WHERE id = ?').run(clip(b.name, 200), d.id);
    if (b.useContext !== undefined) db.prepare('UPDATE documents SET use_context = ? WHERE id = ?').run(b.useContext ? 1 : 0, d.id);
    if (b.chapterId !== undefined) db.prepare('UPDATE documents SET chapter_id = ? WHERE id = ?').run(chapterOf(d.class_id, b.chapterId), d.id);
    if (TAGS.includes(b.tag)) db.prepare('UPDATE documents SET tag = ? WHERE id = ?').run(b.tag, d.id);
    res.json(docById(d.id));
  });
  api.delete('/docs/:id', (req, res) => {
    const d = getDoc(req, res); if (!d) return;
    db.prepare('DELETE FROM documents WHERE id = ?').run(d.id);
    db.prepare('DELETE FROM problems WHERE source_doc = ?').run(d.id); // what was read from it goes with it
    fs.rmSync(path.join(uploads, d.file), { force: true });
    res.json({ ok: true });
  });
  // Study guides: the client builds them (it reads the documents part by part and asks the AI), the server keeps them.
  const guideOut = (g) => ({ id: g.id, chapterId: g.chapter_id, title: g.title, docs: JSON.parse(g.docs), createdAt: g.created_at, ...JSON.parse(g.json) });
  api.get('/classes/:id/guides', (req, res) => {
    const c = needClass(req, res); if (!c) return;
    res.json(db.prepare('SELECT * FROM guides WHERE class_id = ? ORDER BY created_at DESC').all(c.id).map(guideOut));
  });
  api.post('/classes/:id/guides', express.json({ limit: '4mb' }), (req, res) => {
    const c = needClass(req, res); if (!c) return;
    const b = req.body || {};
    const sections = Array.isArray(b.sections) ? b.sections.slice(0, 200) : [], cards = Array.isArray(b.cards) ? b.cards.slice(0, 600) : [];
    if (!sections.length && !cards.length) return res.status(400).json({ error: 'The guide is empty.' });
    const id = newId(), docs = (Array.isArray(b.docs) ? b.docs : []).map((d) => clip(d, 40)).slice(0, 50);
    db.prepare('INSERT INTO guides (id, class_id, chapter_id, title, docs, json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, c.id, chapterOf(c.id, b.chapterId), clip(b.title, 120) || 'Study guide', JSON.stringify(docs), JSON.stringify({ sections, cards, note: clip(b.note, 300) }), Date.now());
    res.status(201).json(guideOut(db.prepare('SELECT * FROM guides WHERE id = ?').get(id)));
  });
  api.patch('/guides/:id', json, (req, res) => {
    const g = db.prepare('SELECT * FROM guides WHERE id = ?').get(req.params.id);
    if (!g) return res.status(404).json({ error: 'No such guide.' });
    const b = req.body || {};
    if (b.chapterId !== undefined) db.prepare('UPDATE guides SET chapter_id = ? WHERE id = ?').run(chapterOf(g.class_id, b.chapterId), g.id);
    if (b.title !== undefined && clip(b.title, 120)) db.prepare('UPDATE guides SET title = ? WHERE id = ?').run(clip(b.title, 120), g.id);
    res.json(guideOut(db.prepare('SELECT * FROM guides WHERE id = ?').get(g.id)));
  });
  api.delete('/guides/:id', (req, res) => {
    const r = db.prepare('DELETE FROM guides WHERE id = ?').run(req.params.id);
    if (!r.changes) return res.status(404).json({ error: 'No such guide.' });
    res.json({ ok: true });
  });
  api.post('/classes/:id/search', json, (req, res) => {
    const c = needClass(req, res); if (!c) return;
    const docs = db.prepare("SELECT name, text, chapter_id FROM documents WHERE class_id = ? AND use_context = 1 AND text != ''").all(c.id);
    const q = clip(req.body && req.body.q, 2000), ch = chapterOf(c.id, req.body && req.body.chapterId);
    if (!ch) return res.json(search(docs, q, 3));
    // the current chapter's documents win; other chapters only fill the remaining slots
    const hits = search(docs.filter((d) => d.chapter_id === ch), q, 3);
    if (hits.length < 3) search(docs.filter((d) => d.chapter_id !== ch), q, 3 - hits.length).forEach((h) => hits.push(h));
    res.json(hits);
  });

  // Plain-text find across a class: every word must appear, in each document (with a few snippets) and in the problem bank.
  api.get('/classes/:id/find', (req, res) => {
    const c = needClass(req, res); if (!c) return;
    const terms = [...new Set(clip(req.query.q, 200).toLowerCase().split(/\s+/).filter(Boolean))].slice(0, 6);
    if (!terms.length) return res.json({ docs: [], problems: [] });
    const all = (t) => terms.every((w) => t.includes(w));
    const docs = [];
    for (const d of db.prepare('SELECT id, name, kind, tag, chapter_id, text FROM documents WHERE class_id = ?').all(c.id)) {
      const low = `${d.name}
${d.text}`.toLowerCase();
      if (!all(low)) continue;
      const snippets = [], body = d.text.toLowerCase();
      let n = 0, from = 0, last = -1000;
      for (let i = body.indexOf(terms[0]); i >= 0; i = body.indexOf(terms[0], from)) {
        n++; from = i + terms[0].length;
        if (snippets.length < 3 && i - last > 200) { last = i; snippets.push((i > 90 ? '… ' : '') + d.text.slice(Math.max(0, i - 90), i + 140).replace(/\s+/g, ' ').trim() + ' …'); }
      }
      docs.push({ id: d.id, name: d.name, kind: d.kind, tag: d.tag, chapterId: d.chapter_id, snippets, n });
    }
    docs.sort((a, b) => b.n - a.n);
    const problems = db.prepare('SELECT * FROM problems WHERE class_id = ? ORDER BY created_at').all(c.id)
      .filter((p) => all(`${p.text}
${p.topic}
${p.answer}`.toLowerCase())).slice(0, 40).map(problemOut);
    res.json({ docs: docs.slice(0, 20).map(({ n, ...d }) => d), problems });
  });

  // ---- chapters: the notebook's table of contents ----
  const chapterOut = (r) => ({
    id: r.id, classId: r.class_id, title: r.title, position: r.position, createdAt: r.created_at,
    counts: {
      docs: db.prepare('SELECT COUNT(*) n FROM documents WHERE chapter_id = ?').get(r.id).n,
      guides: db.prepare('SELECT COUNT(*) n FROM guides WHERE chapter_id = ?').get(r.id).n,
      problems: db.prepare('SELECT COUNT(*) n FROM problems WHERE chapter_id = ?').get(r.id).n,
    },
  });
  const chaptersOf = (classId) => db.prepare('SELECT * FROM chapters WHERE class_id = ? ORDER BY position, created_at').all(classId);
  const needChapter = (req, res) => { const r = db.prepare('SELECT * FROM chapters WHERE id = ?').get(req.params.id); if (!r) res.status(404).json({ error: 'No such chapter.' }); return r; };
  api.get('/classes/:id/chapters', (req, res) => {
    const c = needClass(req, res); if (!c) return;
    res.json(chaptersOf(c.id).map(chapterOut));
  });
  api.post('/classes/:id/chapters', json, (req, res) => {
    const c = needClass(req, res); if (!c) return;
    const title = clip(req.body && req.body.title, 120);
    if (!title) return res.status(400).json({ error: 'Give the chapter a name.' });
    const id = newId(), pos = db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS p FROM chapters WHERE class_id = ?').get(c.id).p;
    db.prepare('INSERT INTO chapters (id, class_id, title, position, created_at) VALUES (?, ?, ?, ?, ?)').run(id, c.id, title, pos, Date.now());
    res.status(201).json(chapterOut(db.prepare('SELECT * FROM chapters WHERE id = ?').get(id)));
  });
  api.patch('/chapters/:id', json, (req, res) => {
    const ch = needChapter(req, res); if (!ch) return;
    const b = req.body || {};
    if (b.title !== undefined) {
      if (!clip(b.title, 120)) return res.status(400).json({ error: 'Give the chapter a name.' });
      db.prepare('UPDATE chapters SET title = ? WHERE id = ?').run(clip(b.title, 120), ch.id);
    }
    if (Number.isInteger(b.position)) { // move to that slot among its siblings, then renumber
      const ids = chaptersOf(ch.class_id).map((r) => r.id).filter((x) => x !== ch.id);
      ids.splice(Math.min(Math.max(b.position, 0), ids.length), 0, ch.id);
      ids.forEach((x, i) => db.prepare('UPDATE chapters SET position = ? WHERE id = ?').run(i, x));
    }
    res.json(chapterOut(db.prepare('SELECT * FROM chapters WHERE id = ?').get(ch.id)));
  });
  api.delete('/chapters/:id', (req, res) => { // its documents, guides and problems become Unsorted
    const ch = needChapter(req, res); if (!ch) return;
    db.prepare('DELETE FROM chapters WHERE id = ?').run(ch.id);
    res.json({ ok: true });
  });

  // ---- problems: a chapter's problem bank (originals pulled from uploads, plus AI-made similar ones) ----
  // A question's answer format and, for multiple choice, its options (at least two, or it is not multiple choice).
  const FORMATS = ['mc', 'tf', 'fill', 'work'];
  const shapeOf = (p) => {
    const choices = (Array.isArray(p && p.choices) ? p.choices : []).map((x) => clip(x, 300)).filter(Boolean).slice(0, 8);
    let format = FORMATS.includes(p && p.format) ? p.format : choices.length >= 2 ? 'mc' : '';
    if (format === 'mc' && choices.length < 2) format = '';
    return { format, choices: format === 'mc' ? choices : [] };
  };
  const problemOut = (r) => ({ id: r.id, classId: r.class_id, chapterId: r.chapter_id, sourceDoc: r.source_doc, kind: r.kind, text: r.text, answer: r.answer, steps: JSON.parse(r.steps), topic: r.topic, links: r.links === null || r.links === undefined ? null : JSON.parse(r.links), format: r.format || '', choices: JSON.parse(r.choices || '[]'), wrong: JSON.parse(r.wrong || '[]'), aiKey: !!r.ai_key, createdAt: r.created_at });
  api.get('/chapters/:id/problems', (req, res) => {
    const ch = needChapter(req, res); if (!ch) return;
    res.json(db.prepare('SELECT * FROM problems WHERE chapter_id = ? ORDER BY created_at, rowid').all(ch.id).map(problemOut));
  });
  api.post('/chapters/:id/problems', express.json({ limit: '4mb' }), (req, res) => {
    const ch = needChapter(req, res); if (!ch) return;
    const list = (Array.isArray(req.body && req.body.problems) ? req.body.problems : [req.body]).slice(0, 100);
    const ins = db.prepare('INSERT INTO problems (id, class_id, chapter_id, source_doc, kind, text, answer, steps, topic, format, choices, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const made = [];
    for (const p of list) {
      const text = clip(p && p.text, 4000);
      if (!text) continue;
      const id = newId(), shape = shapeOf(p);
      ins.run(id, ch.class_id, ch.id, clip(p.sourceDoc, 40), p.kind === 'similar' ? 'similar' : 'original', text, clip(p.answer, 500),
        JSON.stringify((Array.isArray(p.steps) ? p.steps : []).map((x) => clip(x, 500)).filter(Boolean).slice(0, 20)), clip(p.topic, 120), shape.format, JSON.stringify(shape.choices), Date.now());
      made.push(problemOut(db.prepare('SELECT * FROM problems WHERE id = ?').get(id)));
    }
    if (!made.length) return res.status(400).json({ error: 'No problems to save.' });
    res.status(201).json(made);
  });
  // The whole class's bank. A problem's chapter is optional: a practice exam covers several, and each question is
  // filed under the chapter it fits (or none). The chapter routes above are the same rows, filtered.
  api.get('/classes/:id/problems', (req, res) => {
    if (!db.prepare('SELECT 1 FROM classes WHERE id = ?').get(req.params.id)) return res.status(404).json({ error: 'No such class.' });
    res.json(db.prepare('SELECT * FROM problems WHERE class_id = ? ORDER BY created_at, rowid').all(req.params.id).map(problemOut));
  });
  api.post('/classes/:id/problems', express.json({ limit: '4mb' }), (req, res) => {
    if (!db.prepare('SELECT 1 FROM classes WHERE id = ?').get(req.params.id)) return res.status(404).json({ error: 'No such class.' });
    const list = (Array.isArray(req.body && req.body.problems) ? req.body.problems : [req.body])
    .slice(0, 200);
    const ins = db.prepare('INSERT INTO problems (id, class_id, chapter_id, source_doc, kind, text, answer, steps, topic, format, choices, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const made = [];
    for (const p of list) {
      const text = clip(p && p.text, 4000);
      if (!text) continue;
      const id = newId(), shape = shapeOf(p);
      ins.run(id, req.params.id, chapterOf(req.params.id, p.chapterId), clip(p.sourceDoc, 40), p.kind === 'similar' ? 'similar' : 'original', text, clip(p.answer, 500),
        JSON.stringify((Array.isArray(p.steps) ? p.steps : []).map((x) => clip(x, 500)).filter(Boolean).slice(0, 20)), clip(p.topic, 120), shape.format, JSON.stringify(shape.choices), Date.now());
      made.push(problemOut(db.prepare('SELECT * FROM problems WHERE id = ?').get(id)));
    }
    if (!made.length) return res.status(400).json({ error: 'No problems to save.' });
    res.status(201).json(made);
  });
  api.patch('/problems/:id', express.json(), (req, res) => {
    const p = db.prepare('SELECT * FROM problems WHERE id = ?').get(req.params.id);
    if (!p) return res.status(404).json({ error: 'No such problem.' });
    if (req.body && req.body.chapterId !== undefined) db.prepare('UPDATE problems SET chapter_id = ? WHERE id = ?').run(chapterOf(p.class_id, req.body.chapterId), p.id);
    if (req.body && Array.isArray(req.body.links)) {
      const mine = new Set(db.prepare('SELECT id FROM problems WHERE class_id = ?').all(p.class_id).map((r) => r.id));
      db.prepare('UPDATE problems SET links = ? WHERE id = ?').run(JSON.stringify(req.body.links.filter((x) => mine.has(x) && x !== p.id).slice(0, 5)), p.id);
    }
    if (req.body && Array.isArray(req.body.wrong)) db.prepare('UPDATE problems SET wrong = ? WHERE id = ?').run(JSON.stringify(req.body.wrong.map((x) => clip(x, 300)).filter(Boolean).slice(0, 6)), p.id);
    if (req.body && typeof req.body.answer === 'string' && !p.answer && clip(req.body.answer, 500)) db.prepare('UPDATE problems SET answer = ?, ai_key = 1 WHERE id = ?').run(clip(req.body.answer, 500), p.id); // only fills a missing key
    res.json(problemOut(db.prepare('SELECT * FROM problems WHERE id = ?').get(p.id)));
  });
  api.delete('/classes/:id/problems', (req, res) => { // ?chapter=<id> clears one chapter, ?chapter=none the unfiled ones, no query clears them all
    if (!db.prepare('SELECT 1 FROM classes WHERE id = ?').get(req.params.id)) return res.status(404).json({ error: 'No such class.' });
    const ch = req.query.chapter;
    const r = ch === undefined ? db.prepare('DELETE FROM problems WHERE class_id = ?').run(req.params.id)
      : ch === 'none' ? db.prepare('DELETE FROM problems WHERE class_id = ? AND chapter_id IS NULL').run(req.params.id)
        : db.prepare('DELETE FROM problems WHERE class_id = ? AND chapter_id = ?').run(req.params.id, String(ch));
    res.json({ ok: true, removed: Number(r.changes) });
  });
  api.delete('/docs/:id/problems', (req, res) => { // the questions read out of one document (so it can be read again), not the AI-written ones
    const d = getDoc(req, res); if (!d) return;
    res.json({ ok: true, removed: db.prepare("DELETE FROM problems WHERE source_doc = ? AND kind = 'original'").run(d.id).changes });
  });
  api.delete('/problems/:id', (req, res) => {
    const r = db.prepare('DELETE FROM problems WHERE id = ?').run(req.params.id);
    if (!r.changes) return res.status(404).json({ error: 'No such problem.' });
    res.json({ ok: true });
  });

  // ---- study sets: a saved list of bank problems (a chapter's study set, or an exam built across chapters) ----
  const SRC = ['exam', 'book', 'ai'];
  const setOut = (r) => ({ id: r.id, classId: r.class_id, kind: r.kind, title: r.title, chapterIds: JSON.parse(r.chapter_ids), items: JSON.parse(r.items), createdAt: r.created_at });
  api.get('/classes/:id/sets', (req, res) => {
    if (!db.prepare('SELECT 1 FROM classes WHERE id = ?').get(req.params.id)) return res.status(404).json({ error: 'No such class.' });
    res.json(db.prepare('SELECT * FROM studysets WHERE class_id = ? ORDER BY created_at DESC, rowid DESC').all(req.params.id).map(setOut));
  });
  api.post('/classes/:id/sets', express.json({ limit: '1mb' }), (req, res) => {
    if (!db.prepare('SELECT 1 FROM classes WHERE id = ?').get(req.params.id)) return res.status(404).json({ error: 'No such class.' });
    const b = req.body || {}, mine = new Set(db.prepare('SELECT id FROM problems WHERE class_id = ?').all(req.params.id).map((r) => r.id));
    const items = (Array.isArray(b.items) ? b.items : []).filter((x) => x && mine.has(x.id)).slice(0, 200)
      .map((x) => ({ id: x.id, src: SRC.includes(x.src) ? x.src : 'book', key: clip(x.key, 500) }));
    if (!items.length) return res.status(400).json({ error: 'A set needs at least one problem.' });
    const id = newId(), chapters = (Array.isArray(b.chapterIds) ? b.chapterIds : []).map((c) => chapterOf(req.params.id, c)).filter(Boolean);
    db.prepare('INSERT INTO studysets (id, class_id, kind, title, chapter_ids, items, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, req.params.id, b.kind === 'exam' ? 'exam' : 'chapter', clip(b.title, 120) || 'Study set', JSON.stringify(chapters), JSON.stringify(items), Date.now());
    res.status(201).json(setOut(db.prepare('SELECT * FROM studysets WHERE id = ?').get(id)));
  });
  api.delete('/sets/:id', (req, res) => {
    const r = db.prepare('DELETE FROM studysets WHERE id = ?').run(req.params.id);
    if (!r.changes) return res.status(404).json({ error: 'No such set.' });
    res.json({ ok: true });
  });

  // ---- videos: embeddable YouTube results for a topic, cached for 30 days ----
  const VIDEO_TTL = 30 * 24 * 3600 * 1000;
  api.get('/videos', async (req, res) => {
    const q = clip(req.query.q, 200).toLowerCase();
    if (!q) return res.status(400).json({ error: 'No search given.' });
    const hit = db.prepare('SELECT json, fetched_at FROM video_cache WHERE q = ?').get(q);
    if (hit && Date.now() - hit.fetched_at < VIDEO_TTL) return res.json({ videos: JSON.parse(hit.json), fallback: false });
    const key = youtubeKey();
    if (!key) return res.json({ videos: [], fallback: true });
    try {
      const url = `${cfg.youtube.base}/search?${new URLSearchParams({ part: 'snippet', type: 'video', videoEmbeddable: 'true', safeSearch: 'strict', maxResults: '3', q, key })}`;
      const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!r.ok) return res.json({ videos: [], fallback: true }); // quota used up, bad key or outage: the client shows a plain search link
      const data = await r.json();
      const videos = (data.items || []).filter((i) => i && i.id && i.id.videoId).slice(0, 3).map((i) => ({
        id: String(i.id.videoId), title: clip(i.snippet && i.snippet.title, 150), channel: clip(i.snippet && i.snippet.channelTitle, 80),
        thumb: `https://i.ytimg.com/vi/${encodeURIComponent(i.id.videoId)}/mqdefault.jpg`,
      }));
      if (videos.length) db.prepare('INSERT INTO video_cache (q, json, fetched_at) VALUES (?, ?, ?) ON CONFLICT(q) DO UPDATE SET json = excluded.json, fetched_at = excluded.fetched_at').run(q, JSON.stringify(videos), Date.now());
      return res.json({ videos, fallback: !videos.length });
    } catch (e) { return res.json({ videos: [], fallback: true }); }
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
