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
function classCard(c) {
  const s = c.stats || {}, m = metaOf(c.pack);
  const bits = [m.name, s.total ? `${s.total} problems practiced` : '', s.openHw ? `${s.openHw} open homework` : '', s.docs ? plural(s.docs, 'document') : ''].filter(Boolean);
  const hot = c.id === lastClassId();
  return `<div class="classcard ${hot ? 'last' : ''}"><button class="cc-main" data-act="c-open" data-id="${c.id}">
      <span class="cc-name">${esc(c.name)}</span><span class="cc-meta">${bits.map(esc).join(' &middot; ')}</span></button>
    <button class="link" data-act="c-edit" data-id="${c.id}" aria-label="Edit ${esc(c.name)}">Edit</button></div>`;
}
function aiLine() {
  return aiStatus.configured
    ? `AI tutor: ${aiStatus.providers.map((p) => (p === 'groq' ? 'Groq' : 'OpenRouter')).join(' then ')}${aiStatus.images ? '' : ' (no photo reading)'}.`
    : 'AI tutor is off: no GROQ_API_KEY or OPENROUTER_API_KEY on the server. Practice sets still work.';
}
function renderClasses() {
  CLASS = null; PACK = null; round = null; W.id = null;
  const list = CLASSES.length
    ? `<div class="classes">${CLASSES.map(classCard).join('')}</div>`
    : '<p class="lead">Each class is its own space, with its own practice, homework and documents. Start with one.</p>';
  app.innerHTML = `<div class="top"><div class="brand">College Quest</div>${AUTH.required ? '<button class="link" data-act="c-logout">Sign out</button>' : ''}</div>
  <section class="zone"><h3>Your classes</h3>${list}
    <div class="row"><button class="btn ${CLASSES.length ? 'alt' : ''}" data-act="c-new">Add a class</button></div></section>
  <div class="foot"><small>${esc(aiLine())}</small><button class="link" data-act="c-settings">AI settings</button></div>`;
  window.scrollTo(0, 0);
}

// ---- create / edit ----
function openClassForm(c) {
  const p = metaOf(c ? c.pack : CQ.meta[0].id).preset;
  CF = c
    ? { id: c.id, pack: c.pack, name: c.name, description: c.description, examLabel: c.examLabel, examDate: c.examDate, err: '', preset: null }
    : { id: null, pack: CQ.meta[0].id, name: p.name, description: p.description, examLabel: p.examLabel, examDate: p.examDate, err: '', preset: p };
  delClassArmed = false;
  renderClassForm();
}
function syncCF() {
  const g = (id) => document.getElementById(id);
  if (!CF || !g('cf-name')) return;
  CF.name = g('cf-name').value; CF.description = g('cf-desc').value; CF.examLabel = g('cf-exl').value; CF.examDate = g('cf-exd').value;
}
function renderClassForm() {
  const editing = !!CF.id;
  const packs = CQ.meta.map((m) => `<label class="pick packpick"><input type="radio" name="cf-pack" value="${m.id}" ${CF.pack === m.id ? 'checked' : ''} ${editing ? 'disabled' : ''} data-act="c-pack" data-id="${m.id}">
    <span><b>${esc(m.name)}</b><small>${esc(m.blurb)}</small></span></label>`).join('');
  app.innerHTML = `<div class="rbar"><button class="link" data-act="c-cancel">‹ Back</button></div>
  <div class="prob"><div class="eyebrow">${editing ? 'Edit class' : 'Add a class'}</div>
    ${editing ? '' : `<label class="field">Subject</label><div class="found">${packs}</div>`}
    <label class="field" for="cf-name">Class name</label>
    <input class="line" id="cf-name" type="text" maxlength="80" value="${esc(CF.name)}" placeholder="e.g. CHEM 1121">
    <label class="field" for="cf-desc">About this class <small>(the tutor reads this: course, textbook, what the exam covers, how you like things explained)</small></label>
    <textarea id="cf-desc" rows="4" maxlength="2000">${esc(CF.description)}</textarea>
    <label class="field" for="cf-exl">Exam or deadline <small>(optional)</small></label>
    <div class="answer"><input class="line" id="cf-exl" type="text" maxlength="60" placeholder="e.g. Exam 2" value="${esc(CF.examLabel)}"><input class="line" id="cf-exd" type="date" value="${esc(CF.examDate)}"></div>
    ${CF.err ? `<div class="fb no" role="status"><p>${esc(CF.err)}</p></div>` : ''}
    <div class="answer"><button class="btn" data-act="c-save">${editing ? 'Save changes' : 'Create class'}</button></div></div>
  ${editing ? `<div class="skiprow"><button class="link" data-act="c-delete">${delClassArmed ? 'Really delete the class, its progress and documents? Click again' : 'Delete this class'}</button></div>` : ''}`;
}
async function saveClassForm() {
  syncCF();
  if (!CF.name.trim()) { CF.err = 'Give the class a name.'; return renderClassForm(); }
  const body = { name: CF.name, description: CF.description, examLabel: CF.examLabel, examDate: CF.examDate };
  try {
    if (CF.id) {
      const c = await api('PATCH', `/api/classes/${CF.id}`, body);
      CLASSES = CLASSES.map((x) => (x.id === c.id ? c : x));
      const inside = CLASS && CLASS.id === c.id;
      if (inside) CLASS = c;
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
    await loadState();
    await loadDocs();
    await loadGuides();
    LS.set('cq-last', c.id);
    history.replaceState(null, '', '#/class/' + c.id);
    renderHome();
  } catch (e) {
    CLASS = null; PACK = null;
    if (e.code !== 'auth_required') { renderClasses(); app.insertAdjacentHTML('afterbegin', `<div class="fb no" role="status"><p>${esc(e.message)}</p></div>`); }
  }
}
async function leaveClass() {
  if (CLASS) await pushNow();
  try { CLASSES = await api('GET', '/api/classes'); } catch (e) { /* keep the old list */ }
  closeRef();
  history.replaceState(null, '', location.pathname);
  renderClasses();
}

function classAct(act, t) {
  if (act === 'c-open') { const c = CLASSES.find((x) => x.id === t.dataset.id); if (c) enterClass(c); }
  else if (act === 'c-classes') leaveClass();
  else if (act === 'c-new') openClassForm(null);
  else if (act === 'c-edit') openClassForm(CLASSES.find((x) => x.id === t.dataset.id) || CLASS);
  else if (act === 'c-cancel') { CF = null; if (CLASS) renderHome(); else renderClasses(); }
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
    if (!CF.examLabel || (old && CF.examLabel === old.examLabel)) { CF.examLabel = p.examLabel; CF.examDate = p.examDate; }
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
}
