// Study sets: a short, curated set of problems that captures a chapter, or an exam built across several chapters.
// The problem bank is the raw material (read out of the instructor's exam and the text, plus AI-written variants);
// a set picks representative problems from it, covers each topic, and keeps the instructor's own questions first.
// A saved set is a list of bank problems, so it can be retaken, reviewed with the tutor, or printed.
let SETS = [];
const SRC_LABEL = { exam: 'Instructor’s exam', book: 'From the text', ai: 'AI-written' };
const SET_SIZES = [10, 15, 20, 25, 30, 40];
// share of an exam, by source; the AI-written share is new problems modelled on the picked ones
const SMIX = {
  like: { label: 'Like the instructor’s exam: mostly its questions, plus similar ones', exam: 40, book: 40, ai: 20 },
  exam: { label: 'Mostly the instructor’s questions', exam: 60, book: 30, ai: 10 },
  book: { label: 'More from the text', exam: 20, book: 60, ai: 20 },
  fresh: { label: 'Mostly new problems', exam: 20, book: 30, ai: 50 },
};
const SS = { csize: 15, xsize: 20, mix: 'like', tpl: null, delId: null }; // tpl: the exam to model on; null until chosen, then defaults to the first exam
const READ_TRIED = new Set(); // documents already read for problems this session, so a build doesn't read them again

async function loadSets() {
  try { SETS = await api('GET', `/api/classes/${CLASS.id}/sets`); } catch (e) { if (e.code === 'auth_required') throw e; SETS = []; }
}
const srcOf = (p) => (p.kind === 'similar' ? 'ai' : (DOCS.find((d) => d.id === p.sourceDoc) || {}).tag === 'exam' ? 'exam' : 'book');
// A saved set's problems as the exam and printout use them: the bank problem plus the set's own answer when the bank has none.
const setProblems = (s) => s.items.map((it) => {
  const p = allProblems().find((x) => x.id === it.id);
  return p ? { ...p, answer: p.answer || it.key, aiKey: !p.answer && !!it.key, src: it.src } : null;
}).filter(Boolean);
const breakdown = (items) => ['exam', 'book', 'ai'].map((k) => [k, items.filter((p) => p.src === k).length]).filter((x) => x[1])
  .map(([k, n]) => `${n} ${{ exam: 'from the instructor’s exam', book: 'from the text', ai: 'AI-written' }[k]}`).join(', ');
const minutesFor = (n) => Math.max(15, Math.round((n * 3) / 5) * 5);

// ---- building ----
// o: { kind: 'chapter'|'exam', chapterIds, title, size, mix, tplId, where }
async function buildSet(o) {
  if (BK.busy) return;
  if (!smp) { BK.err = 'Building a set needs the AI, which isn’t set up on this server.'; return bankHome(o.where); }
  bankBegin(o.where);
  const tally = { added: 0, cut: false };
  try {
    if (!PLOADED) await loadProblems().catch(() => { PROBS = { none: [] }; });
    const canRead = (d) => d.chars && (d.kind !== 'image' || (smpLimits && smpLimits.images));
    const unread = DOCS.filter((d) => canRead(d) && !READ_TRIED.has(d.id) && !allProblems().some((p) => p.sourceDoc === d.id)
      && (o.chapterIds.includes(d.chapterId) || d.id === o.tplId || d.tag === 'exam' || (d.tag === 'textbook' && !d.chapterId)));
    if (unread.length) { unread.forEach((d) => READ_TRIED.add(d.id)); await readDocs(unread, tally); await loadProblems(); }
    const inScope = (p) => (p.chapterId && o.chapterIds.includes(p.chapterId)) || (o.tplId && p.sourceDoc === o.tplId);
    let pool = allProblems().filter(inScope);
    if (pool.length < 3 && o.kind === 'chapter' && o.chapterIds.length === 1) { // nothing to copy: write problems from the notes
      await genCore(o.chapterIds[0], tally); await loadProblems(); pool = allProblems().filter(inScope);
    }
    if (!pool.length) throw Object.assign(new Error('I couldn’t find any problems in the materials for this. Upload a practice exam or the text with its problems, and try again.'), { code: 'none' });

    // choose representative problems
    const n = Math.max(3, Math.min(o.size, 60)), m = SMIX[o.mix] || SMIX.like;
    const nAI = Math.round((n * m.ai) / 100), nPick = Math.min(n - nAI, pool.length), nE = Math.round((nPick * m.exam) / (m.exam + m.book)), nB = nPick - nE;
    const rank = { exam: 0, book: 1, ai: 2 };
    const cand = [...shuffle(pool)].sort((a, b) => rank[srcOf(a)] - rank[srcOf(b)]).slice(0, 120);
    const multi = o.chapterIds.length > 1, letter = { exam: 'E', book: 'B', ai: 'A' };
    BK.note = 'Choosing the problems that cover the main ideas…'; paintBank();
    const lines = cand.map((p, i) => `${i + 1}. [${letter[srcOf(p)]}${multi && chapterById(p.chapterId) ? ', ' + chapterById(p.chapterId).title : ''}] ${p.text.replace(/\s+/g, ' ').slice(0, 240)}`).join('\n');
    const r = await aiJson(`${rules()}\n\nBelow are numbered practice problems for "${CLASS.name}". E = from the instructor’s practice exam, B = from the textbook, A = written by an AI. `
      + `Choose ${nPick} of them for a study set that captures the main ideas: cover every distinct topic, skip near-duplicates, and mix easy and hard. Aim for about ${nE} E and ${nB} B (take more of the other kind if one runs short; use A only if you must). `
      + (multi ? 'The set spans several chapters; keep the same balance between chapters as the E problems have. ' : '')
      + 'Name each pick’s topic in 2 to 4 words.\n\nReply with only this JSON:\n{"picks":[{"n":1,"topic":"short topic"}]}\n\nProblems:\n' + lines, BK.ctl, bankWait(), 3000);
    const used = new Set(), picks = [];
    (Array.isArray(r && r.picks) ? r.picks : []).forEach((x) => { const i = (+(x && x.n) || 0) - 1; if (cand[i] && !used.has(i) && picks.length < nPick) { used.add(i); picks.push({ p: cand[i], topic: String((x && x.topic) || cand[i].topic || '').slice(0, 60) }); } });
    cand.forEach((p, i) => { if (picks.length < Math.min(nPick, 3) && !used.has(i)) { used.add(i); picks.push({ p, topic: p.topic || '' }); } }); // the AI gave too few: top up from the best-ranked

    // variants: new problems like the picked ones, to reach the full size
    const made = [];
    for (let tries = 0; tries < 4 && picks.length; tries++) {
      const want = n - picks.length - made.length;
      if (want <= 0) break;
      BK.note = 'Writing new problems like the ones you’ll be tested on…'; paintBank();
      const k = Math.min(want, 12), seen = new Set(allProblems().map((p) => normText(p.text)));
      const models = picks.map((x, i) => `${i + 1}. [${letter[srcOf(x.p)]}] ${x.p.text.replace(/\s+/g, ' ').slice(0, 240)}${x.p.answer ? ` (answer: ${x.p.answer.slice(0, 60)})` : ''}`).join('\n');
      const v = await aiJson(`${rules()}\n\nBelow are numbered problems a student will be tested on. Write ${k} NEW practice problems, each modelled on one of them (give its number as "like"): the same type and difficulty, but different numbers, names or wording. Spread them across different models, preferring the E ones. Do not copy any original. `
        + `Work each one out carefully before you write its answer, and double-check it. Plain text only (${PACK.finder}).\n\nReply with only this JSON:\n{"problems":[{"like":1,"text":"the new problem","answer":"the final answer","steps":["one short step"]}]}\n\nProblems:\n${models}`, BK.ctl, bankWait(), 3500);
      const fresh = (Array.isArray(v && v.problems) ? v.problems : []).slice(0, k).map((q) => {
        const base = (picks[(+(q && q.like) || 1) - 1] || picks[0]).p;
        return { kind: 'similar', text: String((q && q.text) || '').trim(), answer: String((q && q.answer) || '').trim(), steps: (Array.isArray(q && q.steps) ? q.steps : []).map((x) => String(x)), topic: base.topic, sourceDoc: base.sourceDoc, chapterId: base.chapterId };
      }).filter((q) => q.text && !seen.has(normText(q.text)) && seen.add(normText(q.text)));
      if (!fresh.length) break;
      made.push(...await api('POST', `/api/classes/${CLASS.id}/problems`, { problems: fresh }));
    }

    // an answer for every picked problem the text gave no key for (marked as the AI's)
    const keys = {}, keyless = picks.filter((x) => !x.p.answer).slice(0, 20);
    if (keyless.length) {
      BK.note = 'Working out answers for problems that came without a key…'; paintBank();
      try {
        const kr = await aiJson(`${rules()}\n\nWork out the final answer to each numbered problem below, carefully. Reply with only this JSON:\n{"answers":[{"n":1,"answer":"the final answer"}]}\n\n${keyless.map((x, i) => `${i + 1}. ${x.p.text.replace(/\s+/g, ' ').slice(0, 400)}`).join('\n')}`, BK.ctl, bankWait(), 2500);
        (Array.isArray(kr && kr.answers) ? kr.answers : []).forEach((a) => { const x = keyless[(+(a && a.n) || 0) - 1]; if (x && a.answer) keys[x.p.id] = String(a.answer).slice(0, 500); });
      } catch (e) { if (e && e.code === 'cancelled') throw e; /* no keys: the review says so */ }
    }

    const items = [...picks.map((x) => ({ id: x.p.id, src: srcOf(x.p), key: x.p.answer ? '' : keys[x.p.id] || '' })), ...made.map((q) => ({ id: q.id, src: 'ai', key: '' }))];
    const ordered = o.kind === 'exam' ? shuffle(items) : items;
    const set = await api('POST', `/api/classes/${CLASS.id}/sets`, { title: o.title, kind: o.kind, chapterIds: o.chapterIds, items: ordered });
    SETS.unshift(set);
    await loadProblems(); await loadChapters();
    bankEnd(`Built “${set.title}” with ${plural(set.items.length, 'problem')}: ${breakdown(set.items)}.`);
  } catch (e) { await loadProblems().catch(() => {}); bankEnd('', e); }
}

// ---- using a set ----
function takeSet(id) {
  const s = SETS.find((x) => x.id === id);
  if (!s) return;
  const items = setProblems(s);
  if (!items.length) { BK.err = 'Those problems have been deleted from the bank.'; return renderRoute(true); }
  exRun(s.title, items, +(document.getElementById('ext') || {}).value || minutesFor(items.length), null);
}
// Opens a printable page: the questions with room to write, then the answer key on its own page.
function printSet(id) {
  const s = SETS.find((x) => x.id === id);
  if (!s) return;
  const items = setProblems(s), w = window.open('', '_blank');
  if (!w) { BK.err = 'Allow pop-ups for this site to print.'; return renderRoute(true); }
  const key = (p) => (p.answer ? esc(p.answer) + (p.kind === 'similar' || p.aiKey ? ' <i>(worked out by the AI)</i>' : '') : '<i>no key</i>');
  w.document.write(`<!doctype html><meta charset="utf-8"><title>${esc(s.title)}</title><style>body{font:15px/1.5 Georgia,serif;margin:36px;color:#111}h1{font-size:22px}h2{font-size:18px}li{margin:0 0 6px}.sp{height:130px}@page{margin:18mm}</style>
    <h1>${esc(CLASS.name)}: ${esc(s.title)}</h1><ol>${items.map((p) => `<li>${fmtMath(p.text)}<div class="sp"></div></li>`).join('')}</ol>
    <h2 style="page-break-before:always">Answer key</h2><ol>${items.map((p) => `<li>${key(p)}</li>`).join('')}</ol>`);
  w.document.close(); w.focus(); setTimeout(() => w.print(), 250);
}

// ---- screens ----
const bkStatusHTML = () => `${BK.busy ? `<div class="fb" role="status"><p>${esc(BK.note)}</p><div class="acts"><button class="link" data-act="b-stop">Stop</button></div></div>` : ''}`
  + `${BK.err ? `<div class="fb no" role="status"><p>${esc(BK.err)}</p></div>` : ''}${BK.msg ? `<div class="fb good" role="status"><p>${esc(BK.msg)}</p></div>` : ''}`;
const sizeOptions = (cur) => SET_SIZES.map((n) => `<option value="${n}" ${n === cur ? 'selected' : ''}>${n} problems</option>`).join('');
function setRowHTML(s) {
  const items = setProblems(s), when = new Date(s.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `<div class="docrow"><div class="dtop"><b>${esc(s.title)}</b><small>${plural(items.length, 'problem')} &middot; ${breakdown(items) || 'empty'} &middot; ${when}</small></div>
    <div class="dact"><button class="btn alt sm" data-act="b-settake" data-id="${s.id}">Take it</button><button class="btn alt sm" data-act="b-setprint" data-id="${s.id}">Print</button>
      <button class="link" data-act="b-setdel" data-id="${s.id}">${SS.delId === s.id ? 'Really delete? Click again' : 'Delete'}</button></div></div>`;
}
// The chapter's main action on its Practice tab.
function studyZoneHTML(ch) {
  const mine = SETS.filter((s) => s.kind === 'chapter' && s.chapterIds.includes(ch.id));
  return `<section class="zone"><h3>Study set</h3>
    <small>A short set that covers this chapter’s main ideas: your instructor’s exam questions first, then problems from the text, then new ones written to match.</small>
    <div class="answer"><select class="line sm" id="ssn" data-ss="csize" aria-label="Size">${sizeOptions(SS.csize)}</select>
      <button class="btn" data-act="b-setbuild" data-ch="${ch.id}" ${BK.busy || !smp ? 'disabled' : ''}>Build study set</button></div>
    ${smp ? '' : '<small class="warn">Needs the AI, which isn’t set up on this server.</small>'}${bkStatusHTML()}
    ${mine.map(setRowHTML).join('')}</section>`;
}
// The exam builder on the Practice exams page: chapters, the instructor's exam to model it on, the mix, the size.
function examBuilderHTML(list) {
  const tpls = sourceDocs().filter((d) => d.tag === 'exam'), loose = PROBS.none || [];
  if (SS.tpl !== '' && !tpls.some((d) => d.id === SS.tpl)) SS.tpl = tpls.length ? tpls[0].id : '';
  const count = (id) => (PROBS[id] || []).length;
  const chk = (id, label) => `<label class="chk"><input type="checkbox" data-act="b-xch" data-id="${id}" ${XS.ch.has(id) ? 'checked' : ''}> ${label} <small>${plural(count(id), 'problem')}</small></label>`;
  const sizes = [...new Set([...[5, 10, 15, 20, 30].filter((n) => n < list.length), list.length])], pre = sizes.filter((n) => n <= 10).pop();
  return `<section class="zone"><h3>Build my exam</h3>
    <small>Pick the chapters the exam covers. It mixes your instructor’s questions, problems from the text and new ones written to match, and is saved so you can retake or print it.</small>
    ${CHAPTERS.length ? `<div class="xch">${CHAPTERS.map((c) => chk(c.id, esc(c.title))).join('')}${loose.length ? chk('none', 'Not filed under a chapter') : ''}</div>` : '<small>Add chapters first (use “+ Add chapter” in the sidebar) so the exam can cover them.</small>'}
    <div class="answer"><select class="line sm" data-ss="tpl" aria-label="Model it on">${[['', 'No model exam']].concat(tpls.map((d) => [d.id, 'Model: ' + d.name])).map(([v, l]) => `<option value="${v}" ${SS.tpl === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
      <select class="line sm" data-ss="mix" aria-label="Mix">${Object.entries(SMIX).map(([k, x]) => `<option value="${k}" ${SS.mix === k ? 'selected' : ''}>${x.label}</option>`).join('')}</select>
      <select class="line sm" data-ss="xsize" aria-label="Size">${sizeOptions(SS.xsize)}</select></div>
    <div class="answer"><button class="btn" data-act="b-xbuild" ${BK.busy || !smp || !CHAPTERS.length ? 'disabled' : ''}>Build my exam</button>
      ${list.length >= 3 ? `<select class="line sm" id="exn" aria-label="Questions">${sizes.map((n) => `<option value="${n}" ${n === pre ? 'selected' : ''}>${n} questions</option>`).join('')}</select><button class="btn alt" data-act="b-exmix">Quick random exam from the bank</button>` : ''}</div>
    ${smp ? '' : '<small class="warn">Building needs the AI, which isn’t set up on this server.</small>'}</section>`;
}
function savedExamsHTML() {
  const mine = SETS.filter((s) => s.kind === 'exam');
  return mine.length ? `<section class="zone"><h3>Saved exams</h3>${mine.map(setRowHTML).join('')}</section>` : '';
}

async function setAct(act, t) {
  const id = t.dataset && t.dataset.id;
  if (act !== 'b-setdel') SS.delId = null;
  if (act === 'b-settake') return takeSet(id);
  if (act === 'b-setprint') return printSet(id);
  if (act === 'b-setdel') {
    if (SS.delId !== id) { SS.delId = id; return renderRoute(true); }
    try { await api('DELETE', `/api/sets/${id}`); SETS = SETS.filter((s) => s.id !== id); } catch (e) { BK.err = e.message; }
    SS.delId = null; return renderRoute(true);
  }
  if (act === 'b-setbuild') {
    const ch = chapterById(t.dataset.ch);
    return ch && buildSet({ kind: 'chapter', chapterIds: [ch.id], title: `${ch.title} study set`, size: SS.csize, mix: 'like', where: ch.id });
  }
  if (act === 'b-xbuild') {
    const ids = CHAPTERS.map((c) => c.id).filter((c) => XS.ch.has(c));
    if (!ids.length && !SS.tpl) { BK.err = 'Tick at least one chapter.'; return renderRoute(true); }
    const tpl = DOCS.find((d) => d.id === SS.tpl);
    return buildSet({ kind: 'exam', chapterIds: ids, tplId: SS.tpl, title: tpl ? `Exam like ${tpl.name.replace(/\.[^.]+$/, '')}` : `Practice exam, ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`, size: SS.xsize, mix: SS.mix, where: null });
  }
}
app.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset && t.dataset.ss && t.matches('select')) { SS[t.dataset.ss] = /size$/.test(t.dataset.ss) ? +t.value : t.value; }
});
