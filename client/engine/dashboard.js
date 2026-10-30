// The landing page: a dashboard of every class. Classes sit in a collapsible menu on the left (each opens to its
// chapters and pages); the main area shows progress, what is due and what is open for each class.
// Each class's saved state, guides and chapters are read once and cached here; nothing is changed.
const DASH = {};          // class id -> summary, once loaded
const DASH_OPEN = new Set(); // classes expanded in the left menu
let dashSeen = false;
const dashTried = new Set(); // classes whose summary was requested, so a failed load is not retried in a loop

async function loadDash(c) {
  if (DASH[c.id] && DASH[c.id].loaded) return DASH[c.id];
  await loadPack(c.pack);
  const pack = CQ.packs[c.pack];
  const [st, guides, chapters] = await Promise.all([
    api('GET', `/api/classes/${c.id}/state`), api('GET', `/api/classes/${c.id}/guides`), api('GET', `/api/classes/${c.id}/chapters`),
  ]);
  let s = fresh();
  try { if (st.json) s = Object.assign(fresh(), JSON.parse(st.json)); } catch (e) { /* unreadable state: show zeros */ }
  const cardRecs = s.cards || {};
  const cards = guides.flatMap((g) => g.cards.map((q, i) => `${g.id}:${i}`));
  const mastered = cards.filter((id) => (cardRecs[id] || {}).box >= 3).length;
  const bank = chapters.reduce((n, ch) => n + ch.counts.problems, 0);
  const pct = calcProgress(s, pack.skills, cards.length, mastered, bank);
  DASH[c.id] = {
    loaded: true, pct, chapters, cards: cards.length, mastered, bank,
    openHw: (s.mine || []).filter((m) => m.status !== 'done').length, doneHw: (s.mine || []).filter((m) => m.status === 'done').length,
    lastDay: s.lastDay, total: s.total || 0, hasSets: pack.skills.length > 0,
  };
  return DASH[c.id];
}

const lastStudied = (d) => {
  if (!d || !d.lastDay) return 'Not started';
  const n = dayDiff(d.lastDay, dayKey());
  return n <= 0 ? 'Studied today' : n === 1 ? 'Studied yesterday' : `Studied ${n} days ago`;
};
const examLine = (c) => {
  const k = keyDate(c);
  if (!k) return '';
  const n = dayDiff(dayKey(), k.date), label = k.label || 'Exam';
  return n > 0 ? `<b>${n}</b> ${n === 1 ? 'day' : 'days'} to ${esc(label)}` : `${esc(label)} is <b>today</b>`;
};

function dashMenuHTML() {
  const li = (hash, label) => `<a class="sl" href="${hash}"><span>${label}</span></a>`;
  const items = CLASSES.map((c) => {
    const d = DASH[c.id], base = '#/class/' + c.id;
    return `<details class="cls" data-cid="${c.id}" ${DASH_OPEN.has(c.id) ? 'open' : ''}><summary><span>${esc(c.name)}</span></summary>
      <div class="clsbody">${li(base, 'Overview')}
        ${d ? d.chapters.map((ch) => li(`${base}/ch/${ch.id}/materials`, esc(ch.title))).join('') : '<small class="muted">Loading…</small>'}
        ${li(base + '/hw', 'Homework')}${d && d.hasSets ? li(base + '/sets', 'Practice sets') : ''}${li(base + '/docs', 'All documents')}</div></details>`;
  }).join('');
  return `<nav class="side" aria-label="Classes"><div class="sbrand"><div class="brand">College Quest</div></div>
    <button class="sl on" aria-current="page"><span>Dashboard</span></button>
    <div class="slabel">Classes</div>${items || '<small class="muted sl">No classes yet</small>'}
    <button class="sl add" data-act="c-new">+ Add a class</button>
    <div class="sfoot"><button class="link" data-act="c-settings">AI settings</button>${AUTH.required ? ' <button class="link" data-act="c-logout">Sign out</button>' : ''}</div></nav>`;
}

function dashCardHTML(c) {
  const d = DASH[c.id], s = c.stats || {}, m = metaOf(c.pack);
  const open = `<button class="btn" data-act="c-open" data-id="${c.id}">Open</button>`;
  if (!d) {
    return `<article class="dcard"><header><h2>${esc(c.name)}</h2><small>${esc(m.name)}</small></header><div class="bar"><i style="width:0"></i></div>
      <small>${s.docs ? plural(s.docs, 'document') : 'No documents yet'}</small><div class="acts">${open}<button class="link" data-act="c-edit" data-id="${c.id}">Edit</button></div></article>`;
  }
  const chips = d.chapters.slice(0, 5).map((ch) => `<a class="chip2" href="#/class/${c.id}/ch/${ch.id}/practice">${esc(ch.title)}</a>`).join('');
  return `<article class="dcard"><header><div><h2>${esc(c.name)}</h2><small>${esc(m.name)}${keyDate(c) ? ' · ' + examLine(c) : ''}</small></div><span class="pct">${d.pct}%</span></header>
    <div class="bar" role="progressbar" aria-label="Progress in ${esc(c.name)}" aria-valuenow="${d.pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${d.pct}%"></i></div>
    <small>${lastStudied(d)}</small>
    <dl class="dstats"><div><dt>Homework open</dt><dd class="${d.openHw ? 'hot' : ''}">${d.openHw}</dd></div>
      <div><dt>Chapters</dt><dd>${d.chapters.length}</dd></div><div><dt>Problems</dt><dd>${d.bank}</dd></div></dl>
    ${chips ? `<div class="chips2">${chips}</div>` : '<small>No chapters yet. Open the class to add one.</small>'}
    <div class="acts">${open}<button class="link" data-act="c-edit" data-id="${c.id}">Edit</button></div></article>`;
}

function renderClasses(keepScroll) {
  const y = window.scrollY;
  CLASS = null; PACK = null; round = null; W.id = null; ROUTE = null;
  if (!dashSeen && lastClassId()) DASH_OPEN.add(lastClassId());
  dashSeen = true;
  const ds = CLASSES.map((c) => DASH[c.id]).filter(Boolean);
  const totals = ds.length ? `<div class="dtotals"><div><b>${ds.reduce((n, d) => n + d.openHw, 0)}</b><small>homework problems open</small></div><div><b>${ds.length ? Math.round(ds.reduce((n, d) => n + d.pct, 0) / ds.length) : 0}%</b><small>average progress</small></div></div>` : '';
  const main = CLASSES.length
    ? `<div class="dgrid">${CLASSES.map(dashCardHTML).join('')}</div>`
    : '<div class="empty"><p>Each class is its own space, with its own chapters, practice, homework and documents. Start with one.</p><button class="btn big" data-act="c-new">Add a class</button></div>';
  app.innerHTML = `<div class="shell">
    <div class="picker"><div class="prow1"><b class="pname">College Quest</b><button class="link" data-act="c-settings">AI settings</button></div><button class="btn alt sm" data-act="c-new">+ Add a class</button></div>
    ${dashMenuHTML()}
    <main class="pane"><h1 class="ptitle">Dashboard</h1>${totals}${main}<div class="foot"><small>${esc(aiLine())}</small></div></main></div>`;
  window.scrollTo(0, keepScroll ? y : 0);
  const missing = CLASSES.filter((c) => !dashTried.has(c.id));
  missing.forEach((c) => dashTried.add(c.id));
  if (missing.length) Promise.all(missing.map((c) => loadDash(c).catch(() => null))).then(() => { if (document.querySelector('.side[aria-label="Classes"]')) renderClasses(true); });
}

app.addEventListener('toggle', (e) => {
  const t = e.target;
  if (t.classList && t.classList.contains('cls')) { if (t.open) DASH_OPEN.add(t.dataset.cid); else DASH_OPEN.delete(t.dataset.cid); }
}, true);
