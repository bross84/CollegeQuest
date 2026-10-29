// A chapter's problem bank. Originals are pulled out of uploaded practice exams and textbooks (with any answer key
// found there); "similar" problems are written by the AI from an original. Both are worked through the homework
// checker (mine.js), and can be run as a timed practice exam. Progress lives in S.bank, the problems on the server.
let PROBS = {};   // chapter id -> its problems
const BK = { busy: false, note: '', err: '', msg: '', ctl: null, delId: null };
let EX = null;    // the practice exam in progress or under review
const bankGet = (id) => (S.bank || {})[id] || null;
const bankRec = (id) => ((S.bank || (S.bank = {}))[id] || (S.bank[id] = { status: 'todo', tries: 0 }));
const normText = (t) => String(t).toLowerCase().replace(/\s+/g, ' ').trim();
const allProblems = () => Object.values(PROBS).flat();

// A chapter problem shaped like a homework item, so renderWork and the checker can take either source.
function bankProblem(id) {
  const p = allProblems().find((x) => x.id === id);
  if (!p) return null;
  return {
    id: p.id, text: p.text, key: p.answer, topic: p.topic, skill: null, aiKey: p.kind === 'similar', steps: p.steps,
    get status() { return (bankGet(p.id) || {}).status || 'todo'; }, set status(v) { bankRec(p.id).status = v; },
    get tries() { return (bankGet(p.id) || {}).tries || 0; }, set tries(v) { bankRec(p.id).tries = v; },
    get chat() { return (bankGet(p.id) || {}).chat || []; }, set chat(v) { bankRec(p.id).chat = v; },
    set doneDay(v) { bankRec(p.id).doneDay = v; },
  };
}
// The class's whole bank is read at once and filed by chapter ('none' holds problems no chapter claims).
let PLOADED = false;
async function loadProblems(chId) {
  const all = await api('GET', `/api/classes/${CLASS.id}/problems`);
  PROBS = Object.fromEntries(CHAPTERS.map((c) => [c.id, []]));
  PROBS.none = [];
  all.forEach((p) => (PROBS[p.chapterId && PROBS[p.chapterId] ? p.chapterId : 'none'] || (PROBS.none)).push(p));
  PLOADED = true;
  return PROBS[chId || 'none'] || [];
}
// Load the bank the first time a page that shows it is opened, then redraw that page.
function ensureProblems() {
  if (PLOADED || BK.loading) return;
  BK.loading = true;
  loadProblems().catch(() => { PROBS = { none: [] }; PLOADED = true; }).then(() => { BK.loading = false; paintBank(); });
}
const onPractice = () => ROUTE && ((ROUTE.view === 'chapter' && ROUTE.tab === 'practice') || ROUTE.view === 'exams');
const paintBank = () => { if (onPractice()) renderRoute(true); };
const sourceDocs = () => DOCS.filter((d) => d.chars);
// Source documents that have problems in the bank, for choosing what a practice exam draws from.
const docsWithProblems = () => sourceDocs().filter((d) => allProblems().some((p) => p.sourceDoc === d.id));

// ---- the Practice tab ----
function practiceTab(ch) {
  const gs = GUIDES.filter((g) => inChapter(g, ch.id)), cards = gs.reduce((n, g) => n + g.cards.length, 0), due = chapterDue(ch.id);
  const recall = `<section class="zone"><h3>Recall questions</h3>${cards
    ? `<div class="mine"><div class="row"><button class="btn" data-act="g-quiz" data-ch="${ch.id}">${due ? `Quiz me (${plural(due, 'question')} due)` : 'Quiz me'}</button></div></div>
      <small>${plural(cards, 'question')} from this chapter’s study guide, brought back on a spaced schedule.</small>`
    : `<small>Make a study guide on the <a href="${chHash(ch.id, 'guide')}">Guide tab</a> to get recall questions.</small>`}</section>`;
  if (ch.unsorted) return `${recall}<section class="zone"><h3>Problems</h3><small>Move materials into a chapter to build a problem bank from them.</small></section>`;
  ensureProblems();
  const list = PLOADED ? PROBS[ch.id] || [] : null;
  if (!list) return `${recall}<section class="zone"><h3>Problems</h3><small>Loading…</small></section>`;
  const originals = list.filter((p) => p.kind === 'original'), made = list.length - originals.length;
  const bankable = DOCS.filter((d) => d.chapterId === ch.id && d.chars);
  const off = BK.busy ? 'disabled' : '';
  const row = (p) => {
    const st = (bankGet(p.id) || {}).status || 'todo', tries = (bankGet(p.id) || {}).tries;
    return `<div class="prow"><button class="mine-item" data-act="b-open" data-id="${p.id}" data-ch="${ch.id}"><span class="mtext">${fmtMath(p.text)}</span>
        <span class="pill ${st}">${st === 'done' ? 'Done' : tries ? 'In progress' : 'To do'}</span></button>
      <span class="pcol"><span class="origin ${p.kind}">${p.kind === 'similar' ? 'AI-made' : 'Original'}</span>
        ${p.kind === 'original' && smp ? `<button class="link" data-act="b-similar" data-id="${p.id}" ${off}>Make similar</button>` : ''}
        <button class="link" data-act="b-del" data-id="${p.id}">${BK.delId === p.id ? 'Really? Click again' : 'Delete'}</button></span></div>`;
  };
  const sizes = [...new Set([...[5, 10, 15, 20].filter((n) => n < list.length), list.length])], pre = sizes.filter((n) => n <= 10).pop();
  const exam = list.length >= 3 ? `<div class="examset"><b>Practice exam</b><small>Timed, no hints until you submit, then a review of every question.</small>
      <div class="answer"><select class="line sm" id="exn" aria-label="Questions">${sizes.map((n) => `<option value="${n}" ${n === pre ? 'selected' : ''}>${n === list.length && n < 5 ? 'All ' : ''}${n} questions</option>`).join('')}</select>
        <select class="line sm" id="ext" aria-label="Time">${[15, 30, 45, 60].map((m) => `<option value="${m}" ${m === 30 ? 'selected' : ''}>${m} minutes</option>`).join('')}</select>
        <button class="btn alt" data-act="b-exam" data-ch="${ch.id}">Start practice exam</button></div></div>` : '';
  return `${studyZoneHTML(ch)}${recall}
  <details class="bankbox" ${BK.open ? 'open' : ''}><summary>Problem bank <small>${plural(list.length, 'problem')}</small></summary><section class="zone"><h3>Problems${list.length ? ` &middot; ${originals.length} from your materials${made ? `, ${made} AI-made` : ''}` : ''}</h3>
    <div class="row2">
      ${bankable.length ? `<button class="btn ${list.length ? 'alt' : ''}" data-act="b-build" ${off}>Build problem bank</button>` : ''}
      ${bankable.length && smp ? `<button class="btn alt" data-act="b-gen" ${off}>Write new problems from my materials</button>` : ''}
      ${originals.length && smp ? `<button class="btn alt" data-act="b-similar-all" ${off}>Make similar problems</button>` : ''}
      ${BK.busy ? '<button class="link" data-act="b-stop">Stop</button>' : ''}
      ${list.length ? clearBtn(ch.id, `Clear this chapter’s ${plural(list.length, 'problem')}`) : ''}</div>
    ${list.length ? `<div class="mine plist">${list.map(row).join('')}</div>${made ? '<small>AI-made problems come with an answer the AI worked out, which can be wrong. The checker treats it as a hint, not a verdict.</small>' : ''}${exam}`
      : `<div class="empty"><p>No problems yet.</p>${bankable.length ? '<small>“Build problem bank” copies the problems out of your uploads and writes new ones when there are none. “Write new problems from my materials” makes fresh ones from your notes and reading.</small>'
        : `<small>Upload this chapter’s notes, reading, or a past exam on the <a href="${chHash(ch.id, 'materials')}">Materials tab</a>. Practice is built from what you upload.</small>`}</div>`}
  </section></details>`;
}
app.addEventListener('toggle', (e) => { if (e.target.classList && e.target.classList.contains('bankbox')) BK.open = e.target.open; }, true);

// ---- building ----
// where: a chapter id when started from a chapter's Practice tab, else null (the class-level Practice exams page).
function bankBegin(where) {
  BK.busy = true; BK.err = ''; BK.msg = ''; BK.ctl = new AbortController(); BK.note = 'Starting…';
  if (!onPractice()) go(where ? chHash(where, 'practice') : routeHash('exams')); else paintBank();
}
function bankEnd(msg, e) {
  BK.busy = false; BK.msg = msg || ''; BK.err = e && e.code !== 'cancelled' ? mineErr(e) : '';
  loadChapters().then(() => paintBank());
  paintBank();
}
const bankWait = () => (s) => { BK.note = `Waiting for the AI quota (${s}s)…`; paintBank(); };
const bankHome = (where) => go(where ? chHash(where, 'practice') : routeHash('exams'));

// Read problems out of documents. A document that sits in a chapter and isn't an exam gives that chapter its problems;
// an exam (or a document with no chapter) is read as covering several chapters, and each problem is filed by the AI.
async function bankBuild(docs, where) {
  if (BK.busy) return;
  if (!smp) { BK.err = 'Building a problem bank needs the AI, which isn’t set up on this server.'; return bankHome(where); }
  if (docs.some((d) => d.kind === 'image') && !(smpLimits && smpLimits.images)) { BK.err = 'Reading photos needs a vision model. Upload a PDF or text version instead.'; return bankHome(where); }
  bankBegin(where);
  let tally = { added: 0, cut: false };
  try {
    tally = await readDocs(docs, tally);
    await loadProblems();
    await linkExam(tally.added > 0);
    if (where && !(PROBS[where] || []).length && !BK.ctl.signal.aborted) return bankGenerate(where, true);
    bankEnd(tally.added ? `Added ${plural(tally.added, 'problem')} to the bank.${tally.cut ? ' That was a lot of material, so some of it was not read. Run it again for the rest.' : ''}` : 'I couldn’t find any new problems in that.');
  } catch (e) { await loadProblems().catch(() => {}); bankEnd(tally.added ? `Added ${plural(tally.added, 'problem')} before it stopped.` : '', e); }
}

// The reading itself: every part of each document goes to the AI, and what it finds is saved to the bank. tally.added and
// tally.cut are updated as it goes, so a failure part-way still reports what was saved.
const PER_DOC = 150;
async function readDocs(docs, tally) {
  if (!PLOADED) await loadProblems().catch(() => { PROBS = { none: [] }; });
  const seen = new Set(allProblems().map((p) => normText(p.text)));
  for (const d of docs) {
    const spread = d.tag === 'exam' || !d.chapterId, ask = spread && CHAPTERS.length ? CHAPTERS : null;
    const parts = await docParts([d]);
    if (parts.length > MAX_PARTS) tally.cut = true;
    const found = [];
    let topic = '';
    for (let i = 0; i < Math.min(parts.length, MAX_PARTS) && found.length < PER_DOC; i++) {
      BK.note = `Reading ${d.name}${parts.length > 1 ? ` (part ${i + 1} of ${Math.min(parts.length, MAX_PARTS)})` : ''}…`; paintBank();
      const source = d.tag === 'exam' ? 'a past practice exam' : d.tag === 'textbook' ? 'textbook pages' : 'class notes or handouts';
      const r = await aiJson(findPrompt(parts[i], { skillHint: '"skill":null' + (ask ? ',"chapter":0' : ''), withAnswers: true, source, chapters: ask }), BK.ctl, bankWait(), 3000);
      topic = topic || String((r && r.topic) || '').slice(0, 80);
      (Array.isArray(r && r.problems) ? r.problems : []).forEach((p) => {
        const text = String((p && p.text) || '').trim(), k = normText(text), pick = ask ? ask[(+(p && p.chapter) || 0) - 1] : null;
        if (text && !seen.has(k)) { seen.add(k); found.push({ kind: 'original', text, answer: String((p && p.answer) || '').trim().slice(0, 500), topic, sourceDoc: d.id, chapterId: pick ? pick.id : d.chapterId || null }); }
      });
    }
    for (let i = 0; i < Math.min(found.length, PER_DOC); i += 100) {
      const chunk = found.slice(i, Math.min(found.length, PER_DOC)).slice(0, 100);
      await api('POST', `/api/classes/${CLASS.id}/problems`, { problems: chunk }); tally.added += chunk.length;
    }
  }
  return tally;
}

// Write practice problems straight from the chapter's materials, for when they hold no problems to copy (notes, slides,
// a textbook chapter). Any problems already in the bank set the style. Saved as AI-made.
async function bankGenerate(chId, cont) {
  if (!cont) { if (BK.busy || !smp) return; bankBegin(chId); }
  const tally = { added: 0 };
  try {
    await genCore(chId, tally);
    await loadProblems();
    bankEnd(tally.added ? `Wrote ${plural(tally.added, 'problem')} from your materials.` : 'The AI didn’t write anything usable. Try again.');
  } catch (e) { await loadProblems().catch(() => {}); bankEnd(tally.added ? `Wrote ${plural(tally.added, 'problem')} before it stopped.` : '', e); }
}
async function genCore(chId, tally) {
  {
    if (!PLOADED) await loadProblems().catch(() => { PROBS = { none: [] }; });
    const docs = DOCS.filter((d) => d.chapterId === chId && d.chars && d.kind !== 'image');
    if (!docs.length) throw Object.assign(new Error('There is no readable text in this chapter yet. Upload a PDF, Word file or notes.'), { code: 'none' });
    const parts = (await docParts(docs)).slice(0, 4), seen = new Set(allProblems().map((p) => normText(p.text)));
    const style = (PROBS[chId] || []).filter((p) => p.kind === 'original').slice(0, 3).map((p) => p.text).join('\n');
    for (let i = 0; i < parts.length; i++) {
      BK.note = parts.length > 1 ? `Writing problems from your materials… (${i + 1} of ${parts.length})` : 'Writing problems from your materials…'; paintBank();
      const prompt = `${rules()}

Below is part of the student's class material for one chapter of "${CLASS.name}". Write 6 practice problems that test what it teaches, the kind this course would ask on an exam. Use only what the material covers.`
        + (style ? ` Match the style of these problems from the course:
${style}
` : '')
        + `
Work each problem out carefully before you write its answer, and double-check it. Plain text only (${PACK.finder}).

Reply with only this JSON:
{"topic":"short name of the topic","problems":[{"text":"the problem","answer":"the final answer","steps":["one short step"]}]}

Material:
${parts[i].text}`;
      const r = await aiJson(prompt, BK.ctl, bankWait(), 3000), topic = String((r && r.topic) || '').slice(0, 80);
      const made = (Array.isArray(r && r.problems) ? r.problems : []).slice(0, 6).map((q) => ({
        kind: 'similar', text: String((q && q.text) || '').trim(), answer: String((q && q.answer) || '').trim(),
        steps: (Array.isArray(q && q.steps) ? q.steps : []).map((x) => String(x)), topic, sourceDoc: '', chapterId: chId,
      })).filter((q) => q.text && !seen.has(normText(q.text)) && seen.add(normText(q.text)));
      if (made.length) { await api('POST', `/api/classes/${CLASS.id}/problems`, { problems: made }); tally.added += made.length; }
    }
  }
}

// n new problems like each original: same type and difficulty, different numbers or wording.
async function bankSimilar(origs, n, chId) {
  if (BK.busy || !smp) return;
  bankBegin(chId);
  let added = 0;
  const seen = new Set(allProblems().map((p) => normText(p.text))); // never save a problem the bank already has
  try {
    for (let i = 0; i < origs.length; i++) {
      const p = origs[i];
      BK.note = origs.length > 1 ? `Writing similar problems… (${i + 1} of ${origs.length})` : 'Writing similar problems…'; paintBank();
      const ctx = await classContext(p.text, chId);
      const prompt = `${rules()}${ctx}\n\nWrite ${n} NEW practice problems like the one below: the same type of problem and the same difficulty, but with different numbers, names or wording. Do not copy the original.\n\n`
        + `Original problem:\n${p.text}\n${p.answer ? `Its answer: ${p.answer}\n` : ''}\nWork each new problem out carefully before you write its answer, and double-check it. Plain text only (${PACK.finder}).\n\n`
        + 'Reply with only this JSON:\n{"problems":[{"text":"the new problem","answer":"the final answer","steps":["one short step","one short step"]}]}';
      const r = await aiJson(prompt, BK.ctl, bankWait(), 3000);
      const made = (Array.isArray(r && r.problems) ? r.problems : []).slice(0, n).map((q) => ({
        kind: 'similar', text: String((q && q.text) || '').trim(), answer: String((q && q.answer) || '').trim(),
        steps: (Array.isArray(q && q.steps) ? q.steps : []).map((x) => String(x)), topic: p.topic, sourceDoc: p.sourceDoc, chapterId: p.chapterId,
      })).filter((q) => q.text && !seen.has(normText(q.text)) && seen.add(normText(q.text)));
      if (made.length) { await api('POST', `/api/classes/${CLASS.id}/problems`, { problems: made }); added += made.length; }
    }
    await loadProblems();
    bankEnd(added ? `Added ${plural(added, 'AI-made problem')}.` : 'The AI didn’t write anything usable. Try again.');
  } catch (e) { await loadProblems().catch(() => {}); bankEnd(added ? `Added ${plural(added, 'AI-made problem')} before it stopped.` : '', e); }
}

// Two-click button that deletes problems: which = a chapter id, 'none' (unfiled) or 'all'.
const clearBtn = (which, label) => `<button class="link" data-act="b-clear" data-which="${which}">${BK.clearArmed === which ? 'Really delete them? Click again' : label}</button>`;

async function bankAct(act, t) {
  if (/^b-(set|xbuild)/.test(act)) return setAct(act, t);
  const id = t.dataset && t.dataset.id, chId = (ROUTE && ROUTE.realId) || t.dataset.ch;
  if (act !== 'b-del') BK.delId = null;
  if (act !== 'b-clear') BK.clearArmed = null;
  if (act === 'b-clear') {
    const which = t.dataset.which;
    if (BK.clearArmed !== which) { BK.clearArmed = which; return renderRoute(true); }
    BK.clearArmed = null;
    try {
      await api('DELETE', `/api/classes/${CLASS.id}/problems${which === 'all' ? '' : '?chapter=' + encodeURIComponent(which)}`);
      PLOADED = false; PROBS = {}; await loadProblems(); BK.msg = 'Cleared.';
    } catch (e) { BK.err = e.message; }
    return renderRoute(true);
  }
  if (act === 'b-open') return openProblem(id, 'bank', t.dataset.ch);
  if (act === 'b-build') {
    const docs = id ? DOCS.filter((d) => d.id === id) : DOCS.filter((d) => d.chapterId === chId && d.chars);
    return bankBuild(docs, ROUTE && ROUTE.view === 'chapter' ? ROUTE.realId : null);
  }
  if (act === 'b-gen') return bankGenerate(chId);
  if (act === 'b-similar') { const p = (PROBS[chId] || []).find((x) => x.id === id); return p && bankSimilar([p], 3, chId); }
  if (act === 'b-similar-all') return bankSimilar((PROBS[chId] || []).filter((p) => p.kind === 'original').slice(0, 10), 2, chId);
  if (act === 'b-link') {
    if (BK.busy) return;
    bankBegin(null);
    try { const n = await linkExam(true); bankEnd(n ? `Matched ${plural(n, 'exam question')} to the text.` : 'Nothing new to match.'); } catch (e) { bankEnd('', e); }
    return;
  }
  if (act === 'b-stop') { if (BK.ctl) BK.ctl.abort(); return; }
  if (act === 'b-del') {
    if (BK.delId !== id) { BK.delId = id; return renderRoute(true); }
    try { await api('DELETE', `/api/problems/${id}`); Object.keys(PROBS).forEach((k) => { PROBS[k] = PROBS[k].filter((p) => p.id !== id); }); delete (S.bank || {})[id]; await loadChapters(); } catch (e) { BK.err = e.message; }
    BK.delId = null; return renderRoute(true);
  }
  if (act === 'b-exam') return exStart(t.dataset.ch);
  if (act === 'b-exdoc') return exStart(null, id);
  if (act === 'b-exmix') return exStart();
  if (act === 'b-xch') { if (XS.ch.has(id)) XS.ch.delete(id); else XS.ch.add(id); return renderRoute(true); }
  if (act === 'b-xorig') { XS.orig = !XS.orig; return renderRoute(true); }
  if (act === 'b-exsubmit') return exSubmit();
  if (act === 'b-exleave') { exitExam(); return renderHome(); }
  if (act === 'b-exopen') { const x = EX.items[+t.dataset.i], work = EX.answers[+t.dataset.i], ch = EX.chId; exitExam(); openProblem(x.id, 'bank', ch); W.work = work; return renderWork(); }
}

// ---- practice exam: a timed set from the chapter's originals and AI-made problems ----
function exitExam() { if (EX) { clearInterval(EX.timer); EX = null; } }
// A chapter's own problems, one uploaded exam's questions in their order, or a mix drawn from the chapters ticked on the
// Practice exams page.
const XS = { ch: new Set(), init: false, orig: false };
function examPool(chId, docId) {
  if (docId) { const d = DOCS.find((x) => x.id === docId); return { list: allProblems().filter((p) => p.sourceDoc === docId && p.kind === 'original'), label: d ? d.name : 'Practice exam', ordered: true }; }
  if (chId) return { list: PROBS[chId] || [], label: (chapterById(chId) || {}).title || 'Practice exam' };
  const all = [...CHAPTERS.map((c) => c.id), 'none'], on = all.filter((k) => XS.ch.has(k));
  return { list: allProblems().filter((p) => XS.ch.has(p.chapterId && PROBS[p.chapterId] ? p.chapterId : 'none') && (!XS.orig || p.kind === 'original')), label: on.length === all.length ? 'All chapters' : plural(on.length, 'chapter') };
}
function exStart(chId, docId) {
  const { list, label, ordered } = examPool(chId, docId);
  const n = ordered ? list.length : Math.min(+(document.getElementById('exn') || {}).value || 10, list.length), min = +(document.getElementById('ext') || {}).value || (ordered ? 60 : minutesFor(n));
  if (n < 1) return;
  exRun(label, ordered ? list : shuffle(list).slice(0, n), min, chId);
}
function exRun(label, items, min, chId) {
  round = null; Q = null; W.id = null; closeRef();
  EX = { chId: chId || null, label, items, answers: items.map(() => ''), endsAt: Date.now() + min * 60000, done: false, timer: setInterval(exTick, 1000) };
  renderExam();
}
const clock = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
function exTick() {
  if (!EX || EX.done) return;
  if (Date.now() >= EX.endsAt) return exSubmit();
  const el = document.getElementById('extime'); if (el) el.textContent = clock(EX.endsAt - Date.now()) + ' left';
}
function exSubmit() {
  if (!EX || EX.done) return;
  clearInterval(EX.timer);
  EX.done = true;
  EX.results = EX.items.map((p, i) => localMatch(p.answer, EX.answers[i].trim()));
  renderExam();
}
// The textbook problems an instructor question was matched to, for extra practice on the same idea.
const relatedHTML = (p) => {
  const rel = (p.links || []).map((id) => allProblems().find((x) => x.id === id)).filter(Boolean);
  return rel.length ? `<details class="paste"><summary>Practice the same idea from the text</summary>${rel.map((r) => `<p class="qtext">${fmtMath(r.text)}${chapterById(r.chapterId) ? ` <small>${esc(chapterById(r.chapterId).title)}</small>` : ''}</p>`).join('')}</details>` : '';
};
function renderExam() {
  if (!EX.done) {
    app.innerHTML = `<div class="rbar"><button class="link" data-act="b-exleave">‹ Leave exam</button><span class="progress" id="extime">${clock(EX.endsAt - Date.now())} left</span></div>
    <div class="prob"><div class="eyebrow">Practice exam &middot; ${esc(EX.label)}</div>
      <p class="lead">No hints until you submit. Write your work and your final answer on the last line of each answer.</p>
      ${EX.items.map((p, i) => `<div class="exq"><div class="eyebrow">Question ${i + 1} of ${EX.items.length}</div><div class="qtext">${fmtMath(p.text)}</div>
        <textarea data-exa="${i}" rows="4" aria-label="Your answer to question ${i + 1}" placeholder="Your work and answer">${esc(EX.answers[i])}</textarea></div>`).join('')}
      <div class="answer"><button class="btn" data-act="b-exsubmit">Submit exam</button></div></div>`;
    return;
  }
  const keyed = EX.results.filter((r) => r !== null), right = keyed.filter(Boolean).length, blank = EX.answers.filter((a) => !a.trim()).length;
  app.innerHTML = `<div class="rbar"><button class="link" data-act="b-exleave">‹ Back to the course</button></div>
  <div class="sum"><h1>Exam review</h1>
    ${keyed.length ? `<div class="big">${right} of ${keyed.length}</div><small>matched the answer key (${plural(EX.items.length - keyed.length, 'question')} had no key to compare with)</small>` : '<small>None of these questions had an answer key to compare with. Open each one in the checker to find out where you stand.</small>'}
    ${blank ? `<p class="lines">${plural(blank, 'question')} left blank.</p>` : ''}</div>
  ${EX.items.map((p, i) => {
    const r = EX.results[i], mine = EX.answers[i].trim();
    const verdict = r === true ? '<div class="fb good"><p><b>Matches the key.</b></p></div>'
      : r === false ? `<div class="fb no"><p><b>Doesn’t match the key.</b> The key says: <b>${esc(p.answer)}</b>${p.kind === 'similar' || p.aiKey ? ' (worked out by the AI, so double-check it)' : ''}</p></div>`
      : p.answer ? `<div class="fb"><p>${mine ? '' : 'Left blank. '}The key says: <b>${esc(p.answer)}</b>${p.kind === 'similar' || p.aiKey ? ' (worked out by the AI, so double-check it)' : ''}${mine ? '. Compare it with your work.' : '.'}</p></div>`
      : '<div class="fb"><p>No answer key for this one.</p></div>';
    return `<div class="prob exq"><div class="eyebrow">Question ${i + 1}${p.src ? ' &middot; ' + SRC_LABEL[p.src] : p.kind === 'similar' ? ' &middot; AI-made' : ''}${chapterById(p.chapterId) ? ' &middot; ' + esc(chapterById(p.chapterId).title) : ''}</div><div class="qtext">${fmtMath(p.text)}</div>
      <div class="where">${mine ? esc(mine) : '(left blank)'}</div>${verdict}
      ${relatedHTML(p)}
      ${p.steps && p.steps.length ? `<details class="paste"><summary>Worked steps</summary><ol class="steps">${p.steps.map((s) => `<li>${fmtMath(s)}</li>`).join('')}</ol></details>` : ''}
      <div class="acts"><button class="btn alt sm" data-act="b-exopen" data-i="${i}">Check my work with the tutor</button>${videosHTML(`${p.topic || ''} ${PACK.videoWord}`.trim() || CLASS.name, true)}</div></div>`;
  }).join('')}`;
  window.scrollTo(0, 0);
}
// ---- the class-level Practice exams page: instructor materials, and exams drawn from any chapters ----
function examsHTML() {
  const head = '<h1 class="ptitle">Practice exams</h1>';
  ensureProblems();
  if (!PLOADED) return `${head}<small>Loading…</small>`;
  if (!XS.init) { CHAPTERS.forEach((c) => XS.ch.add(c.id)); XS.ch.add('none'); XS.init = true; }
  const off = BK.busy ? 'disabled' : '', { list } = examPool(), total = allProblems().length;
  const sizes = [...new Set([...[5, 10, 15, 20, 30].filter((n) => n < list.length), list.length])], pre = sizes.filter((n) => n <= 10).pop();
  const count = (id) => (PROBS[id] || []).length;
  const chk = (id, label) => `<label class="chk"><input type="checkbox" data-act="b-xch" data-id="${id}" ${XS.ch.has(id) ? 'checked' : ''}> ${label} <small>${plural(count(id), 'problem')}</small></label>`;
  const srcRow = (d) => {
    const n = allProblems().filter((p) => p.sourceDoc === d.id && p.kind === 'original').length;
    return `<div class="docrow"><div class="dtop"><span class="dk">${KIND_LABEL[d.kind]}</span>${d.tag ? `<span class="dk tag-${d.tag}">${TAG_LABEL[d.tag]}</span>` : ''}<a class="dn" href="/api/docs/${d.id}/file" target="_blank" rel="noopener">${esc(d.name)}</a>
        <small>${n ? plural(n, 'problem') + ' read' : 'not read yet'}</small></div>
      <div class="dact">${n ? `<button class="btn alt sm" data-act="b-exdoc" data-id="${d.id}">Take as an exam</button>` : ''}${smp ? `<button class="btn alt sm" data-act="b-build" data-id="${d.id}" ${off}>${n ? 'Read again' : 'Read its problems'}</button>` : ''}</div></div>`;
  };
  const loose = PROBS.none || [];
  const exQs = allProblems().filter((p) => p.kind === 'original' && srcOf(p) === 'exam'), matched = exQs.filter((p) => (p.links || []).length).length;
  const hasBooks = allProblems().some((p) => p.kind === 'original' && srcOf(p) === 'book');
  const matchLine = exQs.length ? `<small>${matched} of ${plural(exQs.length, 'exam question')} matched to textbook problems${hasBooks ? '' : ' (read a textbook chapter first)'}.</small>
    ${hasBooks && smp && matched < exQs.length ? `<div class="answer"><button class="btn alt sm" data-act="b-link" ${off}>Match exam questions to the text</button></div>` : ''}` : '';
  const srcs = sourceDocs().filter((d) => d.tag === 'exam' || d.tag === 'textbook' || allProblems().some((p) => p.sourceDoc === d.id));
  return `${head}
  <p class="lead">Practice exams cover more than one chapter. Upload your instructor’s exams and review materials, let the AI read the questions and file each under its chapter, then build a timed exam from any chapters.</p>
  <div class="answer"><label class="btn ${DU.busy ? 'alt' : ''}" for="xfile">${DU.busy ? 'Uploading…' : 'Upload a practice exam'}</label><input type="file" id="xfile" multiple accept="${DOC_ACCEPT}" hidden ${DU.busy ? 'disabled' : ''}></div>
  ${upMsgHTML()}
  ${BK.busy ? `<div class="fb" role="status"><p>${esc(BK.note)}</p><div class="acts"><button class="link" data-act="b-stop">Stop</button></div></div>` : ''}${BK.err ? `<div class="fb no" role="status"><p>${esc(BK.err)}</p></div>` : ''}${BK.msg ? `<div class="fb good" role="status"><p>${esc(BK.msg)}</p></div>` : ''}
  <section class="zone"><h3>Exams and review materials</h3>${srcs.length ? srcs.map(srcRow).join('') : '<small>Nothing yet. Upload a past exam above, or tag a document as a Practice exam or Textbook under All documents.</small>'}${matchLine}</section>
  ${examBuilderHTML(list)}
  ${savedExamsHTML()}
  ${allProblems().length ? `<div class="skiprow">${clearBtn('all', `Clear all ${plural(allProblems().length, 'problem')} read from my materials`)}</div>` : ''}
  ${loose.length && CHAPTERS.length ? `<details class="bankbox"><summary>Not filed under a chapter <small>${plural(loose.length, 'problem')}</small></summary><section class="zone"><small>The AI couldn’t place these. Pick a chapter for each, or ${clearBtn('none', 'clear them')}.</small>
    <div class="mine plist">${loose.map((p) => `<div class="prow"><button class="mine-item" data-act="b-open" data-id="${p.id}"><span class="mtext">${fmtMath(p.text)}</span></button>
      <select class="line sm" data-pmove="${p.id}" aria-label="Chapter"><option value="">Choose a chapter</option>${CHAPTERS.map((c) => `<option value="${c.id}">${esc(c.title)}</option>`).join('')}</select></div>`).join('')}</div></section></details>` : ''}`;
}
app.addEventListener('change', async (e) => {
  const t = e.target;
  if (t.dataset && t.dataset.pmove && t.matches('select') && t.value) {
    try { await api('PATCH', `/api/problems/${t.dataset.pmove}`, { chapterId: t.value }); await loadProblems(); await loadChapters(); } catch (err) { BK.err = err.message; }
    renderRoute(true);
  }
});
app.addEventListener('input', (e) => { const t = e.target; if (EX && !EX.done && t.dataset && t.dataset.exa !== undefined) EX.answers[+t.dataset.exa] = t.value; });
