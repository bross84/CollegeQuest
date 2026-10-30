// Classes: the landing screen, the create/edit form, sign-in, and opening a class as its own space.
let CLASSES = [];
let CF = null;           // the class form being edited, or null
let delClassArmed = false;
const AUTH = { required: false, public: false };

const metaOf = (id) => CQ.meta.find((m) => m.id === id) || CQ.meta[CQ.meta.length - 1];
const lastClassId = () => LS.get('cq-last');

// ---- sign-in ----
function renderLogin(err) {
  CLASS = null;
  app.innerHTML = `<div class="top"><div class="brand">College Quest</div></div>
  <div class="prob"><div class="eyebrow">Sign in</div>
    <form data-form="login" autocomplete="on">
      <label class="field" for="lpw">Password</label>
      <input class="line" id="lpw" type="password" autocomplete="current-password" autofocus>
      <label class="chk"><input type="checkbox" id="lpub"> This is a public or shared computer <small>(shorter sign-in, nothing saved in this browser)</small></label>
      <div class="answer"><button class="btn" type="submit">Sign in</button></div>
      ${err ? `<div class="fb no" role="status"><p>${esc(err)}</p></div>` : ''}
    </form></div>`;
}
async function doLogin() {
  const pw = document.getElementById('lpw').value;
  try {
    await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw, publicPc: document.getElementById('lpub').checked }) })
      .then(async (r) => { if (!r.ok) throw new Error(((await r.json().catch(() => ({}))).error) || 'Could not sign in.'); });
    authLostFlag = false;
    boot();
  } catch (e) { renderLogin(e.message); }
}

// ---- landing ----
function aiLine() {
  return aiStatus.configured
    ? `AI tutor: ${aiStatus.providers.map((p) => (p === 'groq' ? 'Groq' : 'OpenRouter')).join(' then ')}${aiStatus.images ? '' : ' (no photo reading)'}.`
    : 'AI tutor is off: no GROQ_API_KEY or OPENROUTER_API_KEY on the server. Practice sets still work.';
}
// ---- create / edit ----
function openClassForm(c) {
  // A new class starts with no generated practice and blank fields; a subject pack with its own starter text fills it in when picked.
  const first = c ? c.pack : 'general', p = metaOf(first).preset;
  CF = c
    ? { id: c.id, pack: c.pack, name: c.name, description: c.description, dates: c.dates.map((d) => ({ ...d })), err: '', preset: null, style: CLASS && CLASS.id === c.id ? S.style : null }
    : { id: null, pack: first, name: p.name, description: p.description, dates: [{ label: 'Class starts', date: '' }, { label: 'Final exam', date: '' }], err: '', preset: p };
  delClassArmed = false;
  renderClassForm();
}
function syncCF() {
  const g = (id) => document.getElementById(id);
  if (!CF || !g('cf-name')) return;
  CF.name = g('cf-name').value; CF.description = g('cf-desc').value; CF.dates = [...document.querySelectorAll('.kdrow')].map((r) => ({ label: r.querySelector('.kd-l').value, date: r.querySelector('.kd-d').value }));
  if (g('cf-style')) CF.style = g('cf-style').value;
}
function renderClassForm() {
  const editing = !!CF.id;
  const packs = CQ.meta.map((m) => `<label class="pick packpick"><input type="radio" name="cf-pack" value="${m.id}" ${CF.pack === m.id ? 'checked' : ''} ${editing ? 'disabled' : ''} data-act="c-pack" data-id="${m.id}">
    <span><b>${esc(m.name)}</b><small>${esc(m.blurb)}</small></span></label>`).join('');
  app.innerHTML = `<div class="rbar"><button class="link" data-act="c-cancel">‹ Back</button></div>
  <div class="prob"><div class="eyebrow">${editing ? 'Edit class' : 'Add a class'}</div>
    ${editing || CQ.meta.length < 2 ? '' : `<label class="field">Subject</label><div class="found">${packs}</div>`}
    <label class="field" for="cf-name">Class name</label>
    <input class="line" id="cf-name" type="text" maxlength="80" value="${esc(CF.name)}" placeholder="e.g. CHEM 1121">
    <label class="field" for="cf-desc">About this class <small>(the tutor reads this: course, textbook, what the exam covers, how you like things explained)</small></label>
    <textarea id="cf-desc" rows="4" maxlength="2000">${esc(CF.description)}</textarea>
    <label class="field">Key dates <small>(when the class starts, each exam, the final. Rows with no date are ignored.)</small></label>
    ${CF.dates.map((d, i) => `<div class="answer kdrow"><input class="line kd-l" type="text" maxlength="60" placeholder="e.g. Exam 2" aria-label="What happens" value="${esc(d.label)}"><input class="line kd-d" type="date" aria-label="Date" value="${esc(d.date)}"><button class="link" data-act="c-deldate" data-i="${i}">Remove</button></div>`).join('')}
    ${CF.dates.length < 12 ? '<div class="answer"><button class="link" data-act="c-adddate">+ Add a date</button></div>' : ''}
    ${CF.style && PACK && PACK.hasChoiceMode ? `<label class="field" for="cf-style">Practice answers <small>(how problems in practice sets are answered)</small></label>
      <select class="line" id="cf-style">${STYLES.map((k) => `<option value="${k}" ${CF.style === k ? 'selected' : ''}>${STYLE_LABEL[k].replace('Answers: ', '')}</option>`).join('')}</select>` : ''}
    ${CF.err ? `<div class="fb no" role="status"><p>${esc(CF.err)}</p></div>` : ''}
    <div class="answer"><button class="btn" data-act="c-save">${editing ? 'Save changes' : 'Create class'}</button></div></div>
  ${editing ? `<div class="skiprow"><button class="link" data-act="c-delete">${delClassArmed ? 'Really delete the class, its progress and documents? Click again' : 'Delete this class'}</button></div>` : ''}`;
}
async function saveClassForm() {
  syncCF();
  if (!CF.name.trim()) { CF.err = 'Give the class a name.'; return renderClassForm(); }
  const body = { name: CF.name, description: CF.description, dates: CF.dates };
  try {
    if (CF.id) {
      const c = await api('PATCH', `/api/classes/${CF.id}`, body);
      CLASSES = CLASSES.map((x) => (x.id === c.id ? c : x));
      const inside = CLASS && CLASS.id === c.id;
      if (inside) { CLASS = c; if (CF.style && CF.style !== S.style) { S.style = CF.style; save(); } }
      CF = null;
      if (inside) renderHome(); else renderClasses();
    } else {
      const c = await api('POST', '/api/classes', { ...body, pack: CF.pack });
      CLASSES.push(c); CF = null;
      enterClass(c);
    }
  } catch (e) { CF.err = e.message; renderClassForm(); }
}
async function deleteClass() {
  if (!delClassArmed) { delClassArmed = true; return renderClassForm(); }
  try {
    await api('DELETE', `/api/classes/${CF.id}`);
    LS.set('cq-state-' + CF.id, ''); LS.set('cq-sync-' + CF.id, '');
    CLASSES = CLASSES.filter((x) => x.id !== CF.id);
    CF = null; delClassArmed = false; CLASS = null; PACK = null; history.replaceState(null, '', location.pathname); renderClasses();
  } catch (e) { CF.err = e.message; renderClassForm(); }
}

// ---- opening and leaving a class ----
const packLoading = {};
function loadPack(id) {
  if (CQ.packs[id]) return Promise.resolve();
  if (!packLoading[id]) {
    packLoading[id] = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = '/' + metaOf(id).url;
      s.onload = resolve;
      s.onerror = () => { delete packLoading[id]; reject(new Error('Could not load the subject pack.')); };
      document.head.appendChild(s);
    });
  }
  return packLoading[id];
}
async function enterClass(c) {
  if (CLASS) await pushNow(); // finish saving the class we are leaving
  app.innerHTML = '<p class="lead">Opening…</p>';
  try {
    await loadPack(c.pack);
    CLASS = c; PACK = CQ.packs[c.pack];
    SKILLS.length = 0; SKILLS.push(...PACK.skills);
    ASK.turns = []; ASK.key = '';
    delete DASH[c.id]; dashTried.delete(c.id); // its progress will have changed by the time we come back
    CHAPTERS = []; PROBS = {}; PLOADED = false; SETS = []; SS.tpl = null; SS.focus = ''; SS.from = ''; READ_TRIED.clear(); XS.ch.clear(); XS.init = false; ROUTE = null; GV = { id: null, delArmed: false, askSec: null }; DSEL.clear(); SB.adding = false; SB.err = ''; exitExam();
    await loadState();
    await loadDocs();
    await loadGuides();
    await loadChapters();
    await loadSets();
    LS.set('cq-last', c.id);
    const r = parseRoute();
    if (!r || r.cid !== c.id) history.pushState(null, '', '#/class/' + c.id); // a bookmarked chapter opens where it was
    renderRoute();
  } catch (e) {
    CLASS = null; PACK = null;
    if (e.code !== 'auth_required') { renderClasses(); app.insertAdjacentHTML('afterbegin', `<div class="fb no" role="status"><p>${esc(e.message)}</p></div>`); }
  }
}
async function leaveClass(popped) { // popped: the browser's Back already left the class route
  if (CLASS) await pushNow();
  try { CLASSES = await api('GET', '/api/classes'); } catch (e) { /* keep the old list */ }
  closeRef(); exitExam();
  if (!popped) history.pushState(null, '', location.pathname);
  renderClasses();
}

function classAct(act, t) {
  if (act === 'c-open') { const c = CLASSES.find((x) => x.id === t.dataset.id); if (c) enterClass(c); }
  else if (act === 'c-classes') leaveClass();
  else if (act === 'c-new') openClassForm(null);
  else if (act === 'c-edit') openClassForm(CLASSES.find((x) => x.id === t.dataset.id) || CLASS);
  else if (act === 'c-cancel') { CF = null; if (CLASS) renderHome(); else renderClasses(); }
  else if (act === 'c-adddate') { syncCF(); CF.dates.push({ label: '', date: '' }); renderClassForm(); }
  else if (act === 'c-deldate') { syncCF(); CF.dates.splice(+t.dataset.i, 1); renderClassForm(); }
  else if (act === 'c-save') saveClassForm();
  else if (act === 'c-delete') deleteClass();
  else if (act === 'c-settings') openSettings();
  else if (act === 'c-logout') signOut();
  else if (act === 'c-pack') {
    syncCF();
    const old = CF.preset, p = metaOf(t.dataset.id).preset;
    // keep what was typed unless it is still the previous subject's starter text
    if (!CF.name || (old && CF.name === old.name)) CF.name = p.name;
    if (!CF.description || (old && CF.description === old.description)) CF.description = p.description;
    CF.pack = t.dataset.id; CF.preset = p;
    renderClassForm();
  }
}
// End the session, and forget everything this browser cached for it.
async function signOut() {
  try { if (CLASS) await pushNow(); await api('POST', '/api/logout'); } catch (e) { /* signing out anyway */ }
  LS.clear();
  authLostFlag = false; CLASS = null; PACK = null; AUTH.public = false;
  renderLogin();
}
function formSubmit(form) {
  if (form.dataset.form === 'login') doLogin();
  else if (form.dataset.form === 'gq') gAnswer();
  else if (form.dataset.form === 'chapter-add') addChapter(form);
  else if (form.dataset.form === 'class-search') { const q = form.q.value.trim(); if (q) go(findHash(q)); }
}
