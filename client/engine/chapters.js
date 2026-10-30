// The notebook: Class -> Chapters -> (materials, study guide, practice, tutor). This file owns the hash routes,
// the shell around every class page (chapter sidebar on desktop, picker on a phone), the overview and the chapter page.
//   #/class/:id                          overview
//   #/class/:id/ch/:chId/:tab[/:gid]     a chapter (tab: materials | guide | practice | tutor; chId may be "unsorted")
//   #/class/:id/guide/:gid               a study guide, shown under its chapter
//   #/class/:id/docs | hw | sets | exams         all documents, homework, practice sets
let CHAPTERS = [];
let ROUTE = null;      // the route on screen: { cid, view, chId, tab, gid, chapter, realId }
let TUTOR_CTX = null;  // set while a saved chat panel is on screen: { id, title }
const SB = { adding: false, err: '' };
const CH = { delArmed: false };
const TABS = [['learn', 'Learn'], ['materials', 'Materials'], ['guide', 'Guide'], ['practice', 'Practice'], ['tutor', 'Tutor']];
const UNSORTED = { id: 'unsorted', title: 'Unsorted', unsorted: true };

async function loadChapters() {
  try { CHAPTERS = await api('GET', `/api/classes/${CLASS.id}/chapters`); } catch (e) { if (e.code === 'auth_required') throw e; CHAPTERS = []; }
}
const chapterById = (id) => CHAPTERS.find((c) => c.id === id) || null;
const unsortedCount = () => DOCS.filter((d) => !d.chapterId && d.tag !== 'exam').length + GUIDES.filter((g) => !g.chapterId).length;
const chapterOptions = (cur) => `<option value="">Unsorted</option>${CHAPTERS.map((c) => `<option value="${c.id}" ${cur === c.id ? 'selected' : ''}>${esc(c.title)}</option>`).join('')}`;
// Recall questions waiting in a chapter (new ones count too).
const chapterDue = (chId) => GUIDES.filter((g) => inChapter(g, chId)).reduce((n, g) => n + (g.cards.length ? dueCount(g) : 0), 0);
// The chapter a question is about, for the tutor's document search: the open chapter problem, quiz, or chapter page.
const curChapterId = () => (W.id && W.src === 'bank' ? W.chId : Q ? (Q.chapterId && Q.chapterId !== 'unsorted' ? Q.chapterId : null) : (ROUTE && ROUTE.realId) || null);

// ---- routes ----
const baseHash = () => '#/class/' + CLASS.id;
const chHash = (chId, tab, gid) => `${baseHash()}/ch/${chId}/${tab || 'learn'}${gid ? '/' + gid : ''}`;
const routeHash = (view) => (view === 'overview' ? baseHash() : `${baseHash()}/${view}`);
function parseRoute() {
  const m = location.hash.match(/^#\/class\/(\w+)(?:\/(.*))?$/);
  if (!m) return null;
  const p = (m[2] || '').split('/').filter(Boolean), r = { cid: m[1], view: 'overview' };
  if (p[0] === 'ch' && p[1]) { r.view = 'chapter'; r.chId = p[1]; r.tab = TABS.some((t) => t[0] === p[2]) ? p[2] : 'learn'; r.gid = p[2] === 'guide' ? p[3] : undefined; }
  else if (p[0] === 'guide' && p[1]) { r.view = 'guide'; r.gid = p[1]; }
  else if (p[0] === 'search') { r.view = 'search'; try { r.q = decodeURIComponent(p.slice(1).join('/')); } catch (e) { r.q = ''; } }
  else if (p[0] === 'sec' && p[1]) { r.view = 'section'; r.gid = p[1]; r.si = +p[2] || 0; }
  else if (p[0] === 'exams' && p[1]) { r.view = 'examdoc'; r.docId = p[1]; }
  else if (['docs', 'hw', 'sets', 'exams'].includes(p[0])) r.view = p[0];
  return r;
}
// Move to a route in the browser's history, so Back works and the page can be bookmarked.
function go(hash) {
  if (location.hash === hash) history.replaceState(null, '', hash); else history.pushState(null, '', hash);
  renderRoute();
}
const goGuide = (g) => go(chHash(g.chapterId || 'unsorted', 'guide', g.id));
const renderHome = () => renderRoute();

function renderRoute(keepScroll) {
  if (!CLASS) return;
  const y = window.scrollY;
  round = null; Q = null; W.id = null; TUTOR_CTX = null; exitExam();
  const toOverview = () => { history.replaceState(null, '', baseHash()); return { cid: CLASS.id, view: 'overview' }; };
  let r = parseRoute();
  if (!r || r.cid !== CLASS.id) r = { cid: CLASS.id, view: 'overview' };
  if (r.view === 'guide') {
    const g = guideById(r.gid);
    if (g) { r = { cid: CLASS.id, view: 'chapter', chId: g.chapterId || 'unsorted', tab: 'guide', gid: g.id }; history.replaceState(null, '', chHash(r.chId, 'guide', g.id)); }
    else r = toOverview();
  }
  if (r.view === 'chapter') {
    const ch = r.chId === 'unsorted' ? (unsortedCount() ? UNSORTED : null) : chapterById(r.chId);
    if (!ch) r = toOverview(); else { r.chapter = ch; r.realId = ch.unsorted ? null : ch.id; }
  }
  if (r.view === 'sets' && !SKILLS.length) r = toOverview();
  if (r.view === 'section' && !pathAt(r.gid, r.si)) r = toOverview();
  if (r.view === 'examdoc' && !DOCS.some((d) => d.id === r.docId)) { r = { cid: CLASS.id, view: 'exams' }; history.replaceState(null, '', routeHash('exams')); }
  ROUTE = r;
  if (r.gid) GV.id = r.gid;
  if (!(r.view === 'chapter' && r.tab === 'guide')) GV.askSec = null;
  if (!(r.view === 'chapter')) CH.delArmed = false;
  const pane = {
    overview: () => shell('overview', overviewHTML()),
    chapter: () => shell('ch:' + r.chapter.id, chapterHTML(r)),
    docs: () => shell('docs', docsPageHTML()),
    hw: () => shell('hw', `<h1 class="ptitle">Homework</h1>${mineSection()}`),
    sets: () => shell('sets', practiceSetsHTML()),
    exams: () => shell('exams', examsHTML()),
    examdoc: () => shell('exams', examDocHTML(r.docId)),
    section: () => showSection(r.gid, r.si),
    search: () => { shell('search', searchPageHTML(r.q)); runFind(r.q); },
  }[r.view];
  pane();
  window.scrollTo(0, keepScroll ? y : 0);
}

// ---- the shell: sidebar on a wide screen, a picker on a phone ----
const countPill = (n, cls) => (n ? `<span class="count ${cls || ''}">${n}</span>` : '');
function addChapterFormHTML() {
  return SB.adding
    ? `<form class="addch" data-form="chapter-add" autocomplete="off"><input class="line" name="chname" maxlength="120" placeholder="Chapter name, e.g. Chapter 4" aria-label="Chapter name">
      <div class="answer"><button class="btn sm" type="submit">Add</button><button type="button" class="link" data-act="ch-cancel">Cancel</button></div>${SB.err ? `<small class="warn">${esc(SB.err)}</small>` : ''}</form>`
    : '<button class="sl add" data-act="ch-add">+ Add chapter</button>';
}
function sidebarHTML(active) {
  const a = (key, hash, label, badge) => `<a class="sl ${active === key ? 'on' : ''}" href="${hash}" ${active === key ? 'aria-current="page"' : ''}><span>${label}</span>${badge || ''}</a>`;
  const openHw = S.mine.filter((m) => m.status !== 'done').length;
  return `<nav class="side" aria-label="${esc(CLASS.name)}">
    <div class="sbrand"><button class="link" data-act="c-classes">‹ Classes</button><div class="brand">${esc(CLASS.name)}</div></div>
    ${searchBoxHTML()}
    ${a('overview', baseHash(), 'Overview')}
    <div class="slabel">Chapters</div>
    ${CHAPTERS.map((c) => a('ch:' + c.id, chHash(c.id), esc(c.title))).join('')}
    ${unsortedCount() ? a('ch:unsorted', chHash('unsorted'), 'Unsorted', countPill(unsortedCount())) : ''}
    ${addChapterFormHTML()}
    <div class="slabel">Class</div>
    ${a('hw', routeHash('hw'), 'Homework', countPill(openHw))}
    ${SKILLS.length ? a('sets', routeHash('sets'), 'Practice sets') : ''}
    ${a('exams', routeHash('exams'), 'Exams')}
    ${a('docs', routeHash('docs'), 'All documents', countPill(DOCS.length))}
    <div class="sfoot"><button class="link" data-act="c-edit" data-id="${CLASS.id}">Class settings</button></div>
  </nav>`;
}
function pickerHTML(active) {
  const opt = (key, hash, label) => `<option value="${hash}" ${active === key ? 'selected' : ''}>${label}</option>`;
  return `<div class="picker"><div class="prow1"><button class="link" data-act="c-classes">‹ Classes</button><b class="pname">${esc(CLASS.name)}</b><button class="link" data-act="c-edit" data-id="${CLASS.id}">Settings</button></div>
    ${searchBoxHTML()}
    <select class="line" id="cpick" aria-label="Go to">
      ${opt('overview', baseHash(), 'Overview')}
      <optgroup label="Chapters">${CHAPTERS.map((c) => opt('ch:' + c.id, chHash(c.id), esc(c.title))).join('')}${unsortedCount() ? opt('ch:unsorted', chHash('unsorted'), 'Unsorted') : ''}</optgroup>
      <optgroup label="Class">${opt('hw', routeHash('hw'), 'Homework')}${SKILLS.length ? opt('sets', routeHash('sets'), 'Practice sets') : ''}${opt('exams', routeHash('exams'), 'Exams')}${opt('docs', routeHash('docs'), 'All documents')}</optgroup>
    </select>${SB.adding ? addChapterFormHTML() : '<button class="btn alt sm" data-act="ch-add">+ Chapter</button>'}</div>`;
}
function shell(active, main) {
  app.innerHTML = `<div class="shell">${pickerHTML(active)}${sidebarHTML(active)}<main class="pane">${main}</main></div>`;
}

// ---- overview ----
function overviewHTML() {
  return `<h1 class="ptitle">${esc(CLASS.name)}</h1>
  ${examHTML()}
  ${continueHTML()}
  ${classRefs().length ? `<div class="acts reflinks"><small>Reference</small>${refChipsHTML()}</div>` : ''}
  ${SKILLS.length ? `<div class="ovcols"><div class="ovcol">${todayHTML()}${coachHTML()}</div></div>` : ''}
  ${startAnywhereHTML()}
  <div class="foot"><span><small id="syncnote">${syncNote()}</small></span>
    <span>${AUTH.required ? '<button class="link" data-act="c-logout">Sign out</button> ' : ''}<button class="link" data-act="reset">${resetArmed ? 'Really erase all progress? Click again' : 'Reset progress'}</button></span></div>`;
}

// ---- chapter page ----
function chapterHTML(r) {
  const ch = r.chapter, tab = ch.unsorted && r.tab === 'learn' ? 'materials' : r.tab;
  const head = `<div class="chhead"><h1 class="ptitle">${esc(ch.title)}</h1>${ch.unsorted
    ? '<small>Materials and guides that aren’t in a chapter yet. File each one with its chapter picker.</small>'
    : `<span class="chacts"><button class="link" data-act="ch-rename">Rename</button><button class="link" data-act="ch-del">${CH.delArmed ? 'Really delete? Its materials become Unsorted. Click again' : 'Delete chapter'}</button></span>`}</div>`;
  const tabs = `<div class="tabs" role="tablist">${TABS.map(([k, l]) => `<a class="tab ${k === tab ? 'on' : ''}" role="tab" aria-selected="${k === tab}" href="${chHash(ch.id, k)}">${l}</a>`).join('')}</div>`;
  const body = { learn: learnTab, materials: materialsTab, guide: guideTab, practice: practiceTab, tutor: tutorTab }[tab](ch, r);
  return `${head}${tabs}<div class="tabbody">${body}</div>`;
}
const docsIn = (ch) => DOCS.filter((d) => (ch.unsorted ? !d.chapterId : d.chapterId === ch.id));

function materialsTab(ch) {
  const list = docsIn(ch), file = `<input type="file" id="mfile" multiple accept="${DOC_ACCEPT}" hidden ${DU.busy ? 'disabled' : ''}>`;
  if (!list.length) {
    return `<div class="empty"><p>No materials in this chapter yet.</p>
      <label class="btn big" for="mfile">${DU.busy ? 'Uploading…' : ch.unsorted ? 'Upload materials' : 'Upload materials for this chapter'}</label>${file}
      <small>Practice exams, textbook pages, notes or slides. Photos, PDF, Word and text files work.</small></div>${upMsgHTML()}`;
  }
  return `<div class="answer"><label class="btn ${DU.busy ? 'alt' : ''}" for="mfile">${DU.busy ? 'Uploading…' : 'Upload materials'}</label>${file}
      <select class="line sm" id="mtag" aria-label="What are you uploading?">${tagOptions('')}</select>
      ${aiStatus.images ? '<label class="btn alt" for="mcam">Take a photo</label><input type="file" id="mcam" accept="image/*" capture="environment" hidden>' : ''}</div>
    <small>Mark practice exams and textbook pages when you upload (or on their row) to build practice problems from them.</small>
    ${upMsgHTML()}
    <div class="docs">${list.map((d) => docRowHTML(d, false)).join('')}</div>
    ${pasteNoteHTML(false)}`;
}

function guideTab(ch) {
  const gs = GUIDES.filter((g) => inChapter(g, ch.id)), here = docsIn(ch).some((d) => d.chars);
  const make = `<button class="btn ${gs.length ? 'alt sm' : 'big'}" data-act="g-new" data-ch="${ch.unsorted ? '' : ch.id}">${gs.length ? 'Make another guide' : 'Make a study guide from this chapter'}</button>`;
  if (!gs.length) {
    return `<div class="empty"><p>No study guide for this chapter yet.</p>${here ? make : `<a class="btn big" href="${chHash(ch.id, 'materials')}">Upload materials first</a>`}
      <small>The guide has key terms, the points to know, a video for each section and recall questions.</small></div>`;
  }
  const cur = gs.find((g) => g.id === GV.id) || gs[0];
  GV.id = cur.id;
  const pick = gs.length > 1 ? `<div class="chips">${gs.map((g) => `<button class="qchip ${g.id === cur.id ? 'on' : ''}" data-act="g-view" data-id="${g.id}">${esc(g.title)}</button>`).join('')}</div>` : '';
  return `${pick}${guideBodyHTML(cur)}<div class="gmore">${make}</div>`;
}

function tutorTab(ch) {
  TUTOR_CTX = { id: ch.id, title: ch.title };
  return `<p class="lead">Your chat about ${esc(ch.title)} is saved here. The tutor looks in this chapter’s materials first.</p>
    ${followHTML({ title: 'Ask the tutor', placeholder: `Ask about ${ch.title}…` })}`;
}

// ---- actions ----
async function addChapter(form) {
  const title = (form.elements.chname.value || '').trim();
  if (!title) { SB.err = 'Give the chapter a name.'; return renderRoute(true); }
  try {
    const c = await api('POST', `/api/classes/${CLASS.id}/chapters`, { title });
    CHAPTERS.push(c); SB.adding = false; SB.err = '';
    go(chHash(c.id, 'materials'));
  } catch (e) { SB.err = e.message; renderRoute(true); }
}
async function chapterAct(act) {
  const ch = ROUTE && ROUTE.chapter;
  if (act !== 'ch-del') CH.delArmed = false;
  if (act === 'ch-add') {
    SB.adding = true; SB.err = ''; renderRoute(true);
    const box = [...app.querySelectorAll('.addch input')].find((i) => i.offsetParent !== null);
    if (box) box.focus();
  } else if (act === 'ch-cancel') { SB.adding = false; SB.err = ''; renderRoute(true); }
  else if (act === 'ch-rename' && ch && !ch.unsorted) {
    const title = window.prompt('Rename chapter', ch.title);
    if (title && title.trim()) { try { await api('PATCH', `/api/chapters/${ch.id}`, { title }); await loadChapters(); } catch (e) { DU.err = e.message; } }
    renderRoute(true);
  } else if (act === 'ch-del' && ch && !ch.unsorted) {
    if (!CH.delArmed) { CH.delArmed = true; return renderRoute(true); }
    try { await api('DELETE', `/api/chapters/${ch.id}`); CHAPTERS = CHAPTERS.filter((c) => c.id !== ch.id); PLOADED = false; await loadDocs(); await loadGuides(); await loadChapters(); } catch (e) { DU.err = e.message; }
    CH.delArmed = false; go(baseHash());
  }
}

app.addEventListener('change', (e) => {
  const t = e.target;
  if (t.id === 'cpick') { location.hash = t.value; return; }
  if ((t.id === 'mfile' || t.id === 'mcam') && t.files && t.files.length) {
    const files = [...t.files], tag = (document.getElementById('mtag') || {}).value || '';
    t.value = '';
    handleUploads(files, { chapterId: ROUTE && ROUTE.realId, tag });
  }
});

// The browser's Back and Forward buttons: follow the route in the address bar.
window.addEventListener('hashchange', () => {
  const r = parseRoute();
  if (!CLASS) { const c = r && CLASSES.find((x) => x.id === r.cid); if (c && !CF) enterClass(c); return; }
  if (!r) return leaveClass(true);
  if (r.cid !== CLASS.id) { const c = CLASSES.find((x) => x.id === r.cid); return c ? enterClass(c) : leaveClass(true); }
  if (ROUTE && ROUTE.view === 'section' && r.view !== 'section' && r.view !== 'overview') history.replaceState(null, '', baseHash()); // Back out of a section lands on the overview
  renderRoute();
});
