const { test, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadConfig } = require('../server/config');
const { createApp } = require('../server/app');
const { createThinkFilter } = require('../server/ai');
const { search } = require('../server/docs');

let tmp, server, db, base, mock, mockHits;

const startServer = (app) => new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });

before(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cq-test-'));
  mockHits = [];
  // Stand-in for an OpenAI-compatible provider: "bad" model -> 429, anything else answers.
  mock = http.createServer((req, res) => {
    let b = '';
    req.on('data', (c) => (b += c));
    req.on('end', () => {
      const j = JSON.parse(b);
      mockHits.push(j.model);
      if (j.model === 'bad') { res.writeHead(429, { 'Content-Type': 'application/json' }); return res.end('{"error":{"message":"slow down"}}'); }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: '<think>x</think>answer from ' + j.model } }] }));
    });
  });
  await new Promise((r) => mock.listen(0, r));
  const mockUrl = `http://127.0.0.1:${mock.address().port}`;
  const cfg = loadConfig({
    DATA_DIR: tmp, PUBLIC_DIR: tmp, APP_PASSWORD: 'secret', SESSION_SECRET: 'test-secret',
    GROQ_API_KEY: 'g', GROQ_BASE_URL: mockUrl, GROQ_MODEL: 'bad',
    OPENROUTER_API_KEY: 'o', OPENROUTER_BASE_URL: mockUrl, OPENROUTER_MODEL: 'good',
  });
  const made = createApp(cfg);
  db = made.db;
  server = await startServer(made.app);
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server.close(); mock.close(); db.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

let cookie = '';
const call = async (method, url, body, extra = {}) => {
  const isForm = body instanceof FormData;
  const res = await fetch(base + url, { method, headers: { ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...extra }, body: body ? (isForm ? body : JSON.stringify(body)) : undefined });
  const text = await res.text();
  let data = null; try { data = JSON.parse(text); } catch (e) { /* not json */ }
  return { res, data, text };
};

test('api requires sign-in when APP_PASSWORD is set', async () => {
  assert.strictEqual((await call('GET', '/api/classes')).res.status, 401);
  assert.strictEqual((await call('GET', '/api/health')).res.status, 200);
  const bad = await call('POST', '/api/login', { password: 'nope' });
  assert.strictEqual(bad.res.status, 401);
  const ok = await call('POST', '/api/login', { password: 'secret' });
  assert.strictEqual(ok.res.status, 200);
  cookie = ok.res.headers.get('set-cookie').split(';')[0];
  assert.match(ok.res.headers.get('set-cookie'), /HttpOnly/);
  assert.strictEqual((await call('GET', '/api/classes')).res.status, 200);
});

test('classes: create, validate, update, delete', async () => {
  assert.strictEqual((await call('POST', '/api/classes', { name: '  ' })).res.status, 400);
  const c = (await call('POST', '/api/classes', { name: 'CHEM 1', pack: 'chem', examDate: '2026-11-02', examLabel: 'Exam 2' })).data;
  assert.strictEqual(c.pack, 'chem');
  assert.strictEqual(c.examDate, '2026-11-02');
  const bogus = (await call('POST', '/api/classes', { name: 'X', pack: '../etc', examDate: 'soon' })).data;
  assert.strictEqual(bogus.pack, 'general');
  assert.strictEqual(bogus.examDate, '');
  const up = (await call('PATCH', `/api/classes/${c.id}`, { name: 'CHEM 2', pack: 'algebra' })).data;
  assert.strictEqual(up.name, 'CHEM 2');
  assert.strictEqual(up.pack, 'chem', 'subject cannot change');
  assert.strictEqual((await call('DELETE', `/api/classes/${bogus.id}`)).res.status, 200);
  assert.strictEqual((await call('GET', `/api/classes/${bogus.id}/state`)).res.status, 404);
});

test('state: saves, and a stale device gets a conflict with the server copy', async () => {
  const c = (await call('POST', '/api/classes', { name: 'S', pack: 'general' })).data;
  const put = (t, baseT, state) => call('PUT', `/api/classes/${c.id}/state`, { t, baseT, json: JSON.stringify(state) });
  assert.strictEqual((await put(100, 0, { total: 5 })).res.status, 200);
  assert.strictEqual((await put(200, 100, { total: 9, mine: [{ status: 'todo' }] })).res.status, 200);
  const stale = await put(150, 100, { total: 7 });
  assert.strictEqual(stale.res.status, 409);
  assert.strictEqual(JSON.parse(stale.data.json).total, 9);
  assert.strictEqual((await call('PUT', `/api/classes/${c.id}/state`, { t: 1, baseT: 0, json: 'not json' })).res.status, 400);
  const list = (await call('GET', '/api/classes')).data.find((x) => x.id === c.id);
  assert.strictEqual(list.stats.total, 9);
  assert.strictEqual(list.stats.openHw, 1);
});

test('documents: upload, extract text, search, serve safely, delete', async () => {
  const c = (await call('POST', '/api/classes', { name: 'D', pack: 'general' })).data;
  const fd = new FormData();
  fd.append('files', new Blob(['Photosynthesis converts light into chemical energy.\n\nMitochondria produce ATP in the cell.']), 'bio notes.txt');
  fd.append('files', new Blob(['<script>alert(1)</script>']), 'evil.html');
  fd.append('files', new Blob([Buffer.from([137, 80, 78, 71])]), 'pic.png');
  const up = await call('POST', `/api/classes/${c.id}/docs`, fd);
  assert.strictEqual(up.res.status, 201);
  assert.deepStrictEqual(up.data.map((d) => d.name).sort(), ['bio notes.txt', 'pic.png'], 'unsupported types are skipped');
  const txt = up.data.find((d) => d.kind === 'text');
  assert.ok(txt.chars > 50);

  const hits = (await call('POST', `/api/classes/${c.id}/search`, { q: 'where is ATP made' })).data;
  assert.ok(hits.length && /Mitochondria/.test(hits[0].text));

  const file = await call('GET', `/api/docs/${txt.id}/file`);
  assert.match(file.res.headers.get('content-type'), /^text\/plain/);
  assert.match(file.res.headers.get('content-security-policy'), /sandbox/);

  await call('PATCH', `/api/docs/${txt.id}`, { useContext: false });
  assert.strictEqual((await call('POST', `/api/classes/${c.id}/search`, { q: 'ATP' })).data.length, 0, 'opted-out docs are not searched');

  const note = (await call('POST', `/api/classes/${c.id}/notes`, { name: 'Pasted', text: 'Newton first law: inertia.' })).data;
  assert.strictEqual(note.kind, 'text');
  assert.strictEqual((await call('DELETE', `/api/docs/${txt.id}`)).res.status, 200);
  assert.strictEqual((await call('GET', `/api/docs/${txt.id}/file`)).res.status, 404);
  const gone = (await call('GET', `/api/classes/${c.id}/docs`)).data;
  assert.strictEqual(gone.length, 2);
});

test('ai: falls back to the next provider and strips reasoning', async () => {
  mockHits.length = 0;
  const r = await call('POST', '/api/ai', { messages: [{ role: 'user', content: 'hi' }] });
  assert.strictEqual(r.res.status, 200);
  assert.strictEqual(r.data.text, 'answer from good');
  assert.deepStrictEqual(mockHits, ['bad', 'good']);
  assert.strictEqual((await call('POST', '/api/ai', { messages: [] })).res.status, 400);
  assert.deepStrictEqual((await call('GET', '/api/ai/status')).data.providers, ['groq', 'openrouter']);
});

test('think filter drops reasoning even when tags are split across chunks', () => {
  const f = createThinkFilter();
  const out = ['Hel', 'lo <thi', 'nk>secret', ' stuff</th', 'ink>  world'].map((c) => f(c, false)).join('') + f('', true);
  assert.strictEqual(out, 'Hello world');
});

test('search ranks the chunk that shares rare words', () => {
  const docs = [{ name: 'a', text: 'Cats are small.\n\n' + 'x '.repeat(900) + '\n\nQuadratic formula solves ax^2+bx+c.' }];
  const r = search(docs, 'quadratic formula', 1);
  assert.match(r[0].text, /Quadratic formula/);
});

test('settings: saved keys override env, are masked, apply at once, and can be tested', async () => {
  const before = (await call('GET', '/api/settings')).data;
  assert.strictEqual(before.canEdit, true);
  assert.strictEqual(before.providers.groq.keySource, 'env');
  const put = await call('PUT', '/api/settings', { groq: { key: 'sk-secret-1234', smart: 'good' }, order: ['openrouter', 'groq'] });
  assert.strictEqual(put.res.status, 200);
  assert.strictEqual(put.data.providers.groq.keySource, 'app');
  assert.strictEqual(put.data.providers.groq.keyHint, '…1234');
  assert.ok(!put.text.includes('sk-secret'), 'the full key is never returned');
  assert.deepStrictEqual(put.data.order, ['openrouter', 'groq']);
  mockHits.length = 0;
  assert.strictEqual((await call('POST', '/api/ai', { messages: [{ role: 'user', content: 'hi' }] })).data.text, 'answer from good');
  assert.strictEqual(mockHits.length, 1, 'the new order is used straight away');
  const t = (await call('POST', '/api/settings/test', { provider: 'groq' })).data;
  assert.strictEqual(t.ok, true);
  assert.strictEqual((await call('POST', '/api/settings/test', { provider: 'nope' })).res.status, 400);
  const cleared = (await call('PUT', '/api/settings', { groq: { key: '' } })).data;
  assert.strictEqual(cleared.providers.groq.keySource, 'env');
});

test('settings: locked when the server has no password', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cq-open-'));
  const made = createApp(loadConfig({ DATA_DIR: dir, PUBLIC_DIR: dir }));
  const s = await startServer(made.app);
  const url = `http://127.0.0.1:${s.address().port}/api/settings`;
  const r = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groq: { key: 'x' } }) });
  assert.strictEqual(r.status, 403);
  assert.strictEqual((await (await fetch(url)).json()).canEdit, false);
  s.close(); made.db.close(); fs.rmSync(dir, { recursive: true, force: true });
});

test('sessions: normal sign-in lasts, public-computer sign-in is a session cookie', async () => {
  const normal = await call('POST', '/api/login', { password: 'secret' });
  assert.match(normal.res.headers.get('set-cookie'), /Max-Age=\d+/);
  const pub = await call('POST', '/api/login', { password: 'secret', publicPc: true });
  const setCookie = pub.res.headers.get('set-cookie');
  assert.doesNotMatch(setCookie, /Max-Age/, 'dies with the browser');
  const s = (await call('GET', '/api/session', null, { Cookie: setCookie.split(';')[0] })).data;
  assert.strictEqual(s.public, true);
  assert.strictEqual(s.authed, true);
  assert.strictEqual((await call('GET', '/api/session', null, { Cookie: cookie })).data.public, false);
  assert.strictEqual((await call('GET', '/api/session', null, { Cookie: 'cq_session=1.2.forged' })).data.authed, false);
});

test('proxy trust: TRUST_PROXY takes a hop count, and a spoofed X-Forwarded-For cannot dodge the login limit', async () => {
  assert.strictEqual(loadConfig({ TRUST_PROXY: '1' }).trustProxy, 1);
  assert.strictEqual(loadConfig({ TRUST_PROXY: 'true' }).trustProxy, true);
  assert.strictEqual(loadConfig({}).trustProxy, false);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cq-proxy-'));
  const made = createApp(loadConfig({ DATA_DIR: dir, PUBLIC_DIR: dir, APP_PASSWORD: 'secret', TRUST_PROXY: '1' }));
  const s = await startServer(made.app);
  const login = (i) => fetch(`http://127.0.0.1:${s.address().port}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `10.0.0.${i}, 203.0.113.7` }, body: JSON.stringify({ password: 'wrong' }) });
  let last;
  for (let i = 0; i < 11; i++) last = await login(i); // different fake client addresses, same real one (the last entry)
  assert.strictEqual(last.status, 429);
  s.close(); made.db.close(); fs.rmSync(dir, { recursive: true, force: true });
});

test('study guides: saved per class, listed with their questions, deleted with the class', async () => {
  const cls = (await call('POST', '/api/classes', { name: 'Guide class', pack: 'general' }, { Cookie: cookie })).data;
  const empty = await call('POST', `/api/classes/${cls.id}/guides`, { title: 'x', sections: [], cards: [] }, { Cookie: cookie });
  assert.strictEqual(empty.res.status, 400);
  const made = await call('POST', `/api/classes/${cls.id}/guides`, {
    title: 'Ch 1', docs: ['abc'], sections: [{ heading: 'H', summary: 's', terms: [{ term: 't', def: 'd' }], points: ['p'] }],
    cards: [{ q: 'Q?', a: 'A', accept: [], wrong: ['x', 'y', 'z'] }],
  }, { Cookie: cookie });
  assert.strictEqual(made.res.status, 201);
  const list = (await call('GET', `/api/classes/${cls.id}/guides`, null, { Cookie: cookie })).data;
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].cards[0].a, 'A');
  assert.strictEqual(list[0].sections[0].terms[0].term, 't');
  assert.strictEqual((await call('DELETE', `/api/guides/${made.data.id}`, null, { Cookie: cookie })).res.status, 200);
  assert.strictEqual((await call('GET', `/api/classes/${cls.id}/guides`, null, { Cookie: cookie })).data.length, 0);
});

test('chapters: CRUD, reorder, and deleting one leaves its documents and guides unsorted', async () => {
  const cls = (await call('POST', '/api/classes', { name: 'Chapter class', pack: 'general' })).data;
  const other = (await call('POST', '/api/classes', { name: 'Other class', pack: 'general' })).data;
  assert.strictEqual((await call('POST', `/api/classes/${cls.id}/chapters`, { title: ' ' })).res.status, 400);
  const c1 = (await call('POST', `/api/classes/${cls.id}/chapters`, { title: 'Chapter 1' })).data;
  const c2 = (await call('POST', `/api/classes/${cls.id}/chapters`, { title: 'Chapter 2' })).data;
  const foreign = (await call('POST', `/api/classes/${other.id}/chapters`, { title: 'Not yours' })).data;
  assert.deepStrictEqual([c1.position, c2.position], [0, 1]);
  assert.strictEqual((await call('PATCH', `/api/chapters/${c2.id}`, { position: 0 })).data.position, 0);
  assert.deepStrictEqual((await call('GET', `/api/classes/${cls.id}/chapters`)).data.map((c) => c.title), ['Chapter 2', 'Chapter 1']);
  assert.strictEqual((await call('PATCH', `/api/chapters/${c1.id}`, { title: 'Limits' })).data.title, 'Limits');
  assert.strictEqual((await call('PATCH', '/api/chapters/nope', { title: 'x' })).res.status, 404);

  // documents: a chapter and a tag can be set on upload (query), on notes, and changed later
  const fd = new FormData(); fd.append('files', new Blob(['Find the limit of x as x approaches 2.']), 'exam.txt');
  const up = (await call('POST', `/api/classes/${cls.id}/docs?chapterId=${c1.id}&tag=exam`, fd)).data[0];
  assert.strictEqual(up.chapterId, c1.id);
  assert.strictEqual(up.tag, 'exam');
  const stray = (await call('POST', `/api/classes/${cls.id}/notes`, { text: 'notes', chapterId: foreign.id })).data;
  assert.strictEqual(stray.chapterId, null, 'a chapter from another class is ignored');
  assert.strictEqual((await call('PATCH', `/api/docs/${stray.id}`, { chapterId: c1.id, tag: 'textbook' })).data.chapterId, c1.id);
  assert.strictEqual((await call('PATCH', `/api/docs/${stray.id}`, { chapterId: foreign.id })).data.chapterId, null);

  const g = (await call('POST', `/api/classes/${cls.id}/guides`, { title: 'G', chapterId: c1.id, sections: [{ heading: 'H', summary: '', terms: [], points: [] }] })).data;
  assert.strictEqual(g.chapterId, c1.id);
  assert.strictEqual((await call('PATCH', `/api/guides/${g.id}`, { chapterId: c2.id })).data.chapterId, c2.id);
  assert.deepStrictEqual((await call('GET', `/api/classes/${cls.id}/chapters`)).data.find((c) => c.id === c2.id).counts, { docs: 0, guides: 1, problems: 0 });

  // search prefers the current chapter's documents
  await call('PATCH', `/api/docs/${up.id}`, { chapterId: c2.id });
  const hits = (await call('POST', `/api/classes/${cls.id}/search`, { q: 'limit approaches', chapterId: c2.id })).data;
  assert.strictEqual(hits[0].doc, 'exam.txt');

  assert.strictEqual((await call('DELETE', `/api/chapters/${c2.id}`)).res.status, 200);
  assert.strictEqual((await call('GET', `/api/classes/${cls.id}/docs`)).data.find((d) => d.id === up.id).chapterId, null);
  assert.strictEqual((await call('GET', `/api/classes/${cls.id}/guides`)).data[0].chapterId, null);
});

test('problems: saved per chapter, validated, deleted one by one', async () => {
  const cls = (await call('POST', '/api/classes', { name: 'Problem class', pack: 'general' })).data;
  const ch = (await call('POST', `/api/classes/${cls.id}/chapters`, { title: 'Ch 1' })).data;
  assert.strictEqual((await call('POST', `/api/chapters/${ch.id}/problems`, { problems: [{ text: '  ' }] })).res.status, 400);
  const made = await call('POST', `/api/chapters/${ch.id}/problems`, { problems: [
    { text: 'Solve 2x = 6', answer: '3', kind: 'original', sourceDoc: 'abc' },
    { text: 'Solve 3x = 12', answer: '4', kind: 'similar', steps: ['Divide by 3'], topic: 'Linear' },
  ] });
  assert.strictEqual(made.res.status, 201);
  assert.deepStrictEqual(made.data.map((p) => p.kind), ['original', 'similar']);
  const list = (await call('GET', `/api/chapters/${ch.id}/problems`)).data;
  assert.strictEqual(list.length, 2);
  assert.deepStrictEqual(list[1].steps, ['Divide by 3']);
  assert.strictEqual((await call('DELETE', `/api/problems/${list[0].id}`)).res.status, 200);
  assert.strictEqual((await call('DELETE', `/api/problems/${list[0].id}`)).res.status, 404);
  assert.strictEqual((await call('GET', `/api/chapters/${ch.id}/problems`)).data.length, 1);
});

test('problems: a class bank files each problem under its own chapter, or none, and can be refiled', async () => {
  const cls = (await call('POST', '/api/classes', { name: 'Exam class', pack: 'general' })).data;
  const other = (await call('POST', '/api/classes', { name: 'Other class', pack: 'general' })).data;
  const c1 = (await call('POST', `/api/classes/${cls.id}/chapters`, { title: 'Ch 1' })).data;
  const c2 = (await call('POST', `/api/classes/${cls.id}/chapters`, { title: 'Ch 2' })).data;
  const foreign = (await call('POST', `/api/classes/${other.id}/chapters`, { title: 'Elsewhere' })).data;
  const made = (await call('POST', `/api/classes/${cls.id}/problems`, { problems: [
    { text: 'Q1', chapterId: c1.id, sourceDoc: 'exam1' }, { text: 'Q2', chapterId: c2.id, sourceDoc: 'exam1' },
    { text: 'Q3', sourceDoc: 'exam1' }, { text: 'Q4', chapterId: foreign.id },
  ] })).data;
  assert.deepStrictEqual(made.map((p) => p.chapterId), [c1.id, c2.id, null, null]); // a chapter of another class is ignored
  assert.strictEqual((await call('GET', `/api/classes/${cls.id}/problems`)).data.length, 4);
  assert.strictEqual((await call('GET', `/api/chapters/${c1.id}/problems`)).data.length, 1);
  assert.strictEqual((await call('PATCH', `/api/problems/${made[2].id}`, { chapterId: c2.id })).data.chapterId, c2.id);
  assert.strictEqual((await call('GET', `/api/chapters/${c2.id}/problems`)).data.length, 2);
  assert.strictEqual((await call('PATCH', `/api/problems/${made[2].id}`, { chapterId: foreign.id })).data.chapterId, null);
  assert.strictEqual((await call('GET', '/api/classes/nope/problems')).res.status, 404);
});

test('videos: falls back without a key, then serves from the cache and from a live search', async () => {
  assert.strictEqual((await call('GET', '/api/videos')).res.status, 400);
  assert.deepStrictEqual((await call('GET', '/api/videos?q=factoring')).data, { videos: [], fallback: true });
  assert.strictEqual((await call('GET', '/api/settings')).data.youtube.keySource, 'none');
  db.prepare('INSERT INTO video_cache (q, json, fetched_at) VALUES (?, ?, ?)').run('cached topic', JSON.stringify([{ id: 'abc', title: 'T', channel: 'C', thumb: 'x' }]), Date.now());
  assert.strictEqual((await call('GET', '/api/videos?q=Cached%20Topic')).data.videos[0].id, 'abc');
  db.prepare('UPDATE video_cache SET fetched_at = ? WHERE q = ?').run(Date.now() - 31 * 24 * 3600 * 1000, 'cached topic');
  assert.strictEqual((await call('GET', '/api/videos?q=cached%20topic')).data.fallback, true, 'a stale entry is not used without a key');

  const seen = [];
  const yt = http.createServer((req, res) => {
    seen.push(req.url);
    if (/q=quota/.test(req.url)) { res.writeHead(403, { 'Content-Type': 'application/json' }); return res.end('{"error":{"code":403}}'); }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ items: [{ id: { videoId: 'v1' }, snippet: { title: 'Factoring', channelTitle: 'Prof' } }, { id: {}, snippet: {} }] }));
  });
  await new Promise((r) => yt.listen(0, r));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cq-yt-'));
  const made = createApp(loadConfig({ DATA_DIR: dir, PUBLIC_DIR: dir, YOUTUBE_API_KEY: 'yt-key', YOUTUBE_BASE_URL: `http://127.0.0.1:${yt.address().port}` }));
  const s = await startServer(made.app);
  const get = async (q) => (await fetch(`http://127.0.0.1:${s.address().port}/api/videos?q=${q}`)).json();
  const first = await get('factoring');
  assert.strictEqual(first.videos[0].id, 'v1');
  assert.strictEqual(first.videos.length, 1);
  assert.match(seen[0], /videoEmbeddable=true/);
  assert.match(seen[0], /safeSearch=strict/);
  await get('factoring');
  assert.strictEqual(seen.length, 1, 'the second search comes from the cache');
  assert.deepStrictEqual(await get('quota'), { videos: [], fallback: true });
  s.close(); yt.close(); made.db.close(); fs.rmSync(dir, { recursive: true, force: true });
});

test('migration: a v3 database keeps its documents and guides, now unsorted', async () => {
  const { DatabaseSync } = require('node:sqlite');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cq-mig-'));
  const old = new DatabaseSync(path.join(dir, 'collegequest.db'));
  old.exec(`
    CREATE TABLE classes (id TEXT PRIMARY KEY, name TEXT NOT NULL, pack TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', exam_label TEXT NOT NULL DEFAULT '', exam_date TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL);
    CREATE TABLE class_state (class_id TEXT PRIMARY KEY REFERENCES classes(id) ON DELETE CASCADE, t INTEGER NOT NULL, json TEXT NOT NULL);
    CREATE TABLE documents (id TEXT PRIMARY KEY, class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE, name TEXT NOT NULL, kind TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL, file TEXT NOT NULL, text TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '', use_context INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL);
    CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE guides (id TEXT PRIMARY KEY, class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE, title TEXT NOT NULL, docs TEXT NOT NULL DEFAULT '[]', json TEXT NOT NULL, created_at INTEGER NOT NULL);
    INSERT INTO classes VALUES ('c1', 'Old class', 'general', '', '', '', 1);
    INSERT INTO documents (id, class_id, name, kind, mime, size, file, text, created_at) VALUES ('d1', 'c1', 'old.txt', 'text', 'text/plain', 3, 'c1/d1.txt', 'abc', 1);
    INSERT INTO guides VALUES ('g1', 'c1', 'Old guide', '[]', '{"sections":[],"cards":[{"q":"q","a":"a"}]}', 1);
    PRAGMA user_version = 3;`);
  old.close();
  const made = createApp(loadConfig({ DATA_DIR: dir, PUBLIC_DIR: dir }));
  const s = await startServer(made.app);
  const get = async (u) => (await fetch(`http://127.0.0.1:${s.address().port}${u}`)).json();
  const doc = (await get('/api/classes/c1/docs'))[0], guide = (await get('/api/classes/c1/guides'))[0];
  assert.strictEqual(doc.chapterId, null);
  assert.strictEqual(doc.tag, '');
  assert.strictEqual(guide.chapterId, null);
  assert.strictEqual(guide.cards[0].a, 'a');
  assert.deepStrictEqual(await get('/api/classes/c1/chapters'), []);
  assert.strictEqual(made.db.prepare('PRAGMA user_version').get().user_version, 5);
  s.close(); made.db.close(); fs.rmSync(dir, { recursive: true, force: true });
});
