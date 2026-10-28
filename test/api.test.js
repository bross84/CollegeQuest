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
