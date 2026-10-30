// Study sets: a short, curated set of problems that captures a chapter, or an exam built across several chapters.
// The problem bank is the raw material (read out of the instructor's exam and the text, plus AI-written variants);
// a set picks representative problems from it, covers each topic, and keeps the instructor's own questions first.
// A saved set is a list of bank problems, so it can be retaken, reviewed with the tutor, or printed.
let SETS = [];
const SRC_LABEL = { exam: 'Instructor’s exam', book: 'From the text', ai: 'AI-written' };
const SET_SIZES = [10, 15, 20, 25, 30, 40];
// share of an exam, by source; the AI-written share is new problems modelled on the picked ones
const SMIX = {
  like: { label: 'Like the instructor’s exam', exam: 40, book: 40, ai: 20 },
  exam: { label: 'Mostly instructor’s questions', exam: 60, book: 30, ai: 10 },
  book: { label: 'More from the text', exam: 20, book: 60, ai: 20 },
  fresh: { label: 'Mostly new problems', exam: 20, book: 30, ai: 50 },
};
const FMT_NAME = { mc: 'multiple choice', tf: 'true/false', fill: 'fill in the blank', work: 'written' };
const SS = { xsize: 20, mix: 'like', tpl: null, focus: '', from: '', delId: null }; // tpl: the exam to model on; null until chosen, then defaults to the first exam
const READ_TRIED = new Set(); // documents already read for problems this session, so a build doesn't read them again

async function loadSets() {
  try { SETS = await api('GET', `/api/classes/${CLASS.id}/sets`); } catch (e) { if (e.code === 'auth_required') throw e; SETS = []; }
}
// The number a question had in its book or exam: the one read out of it, or one at the start of its text ("21." or "Question 9:").
const refOf = (p) => p.ref || ((String(p.text || '').match(/^\s*(?:problem|question|q)?\s*#?(\d+(?:\.\d+)?)(?:[.):]|\s+(?=[A-Z]))/i) || [])[1]) || '';
// Where a question came from, for the screen: its source, its chapter and its number.
function srcText(p, src) {
  const s = src || (p.kind === 'similar' ? 'ai' : srcOf(p)), ch = chapterById(p.chapterId), ref = s === 'ai' ? '' : refOf(p);
  return [s === 'ai' ? 'AI-written' : s === 'exam' ? 'Instructor’s exam' : 'From the text', ch ? ch.title : '', ref ? (s === 'exam' ? 'Question ' : 'Problem ') + ref : ''].filter(Boolean).join(' · ');
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

// ---- matching exam questions to the text ----
// For each instructor question, find the textbook problems that test the same idea. A cheap word-overlap pass shortlists a few
// candidates per question, then the AI picks the ones that really match. The matches are saved on the question (links), and a
// question with no chapter is filed under the chapter its matches belong to.
const STOPW = new Set('the and for with from that this these those are was were what which find how many much does has have into given calculate determine following using use each than then when will would can your you its per'.split(' '));
const wordsOf = (t) => new Set((String(t).toLowerCase().match(/[a-z][a-z0-9+\-]{2,}/g) || []).filter((w) => !STOPW.has(w)));
function shortlist(qs, books, k) {
  const sets = books.map((b) => wordsOf(b.text)), df = new Map();
  sets.forEach((s) => s.forEach((w) => df.set(w, (df.get(w) || 0) + 1)));
  const idf = (w) => Math.log(1 + books.length / (1 + (df.get(w) || 0)));
  const len = (s) => Math.sqrt([...s].reduce((a, w) => a + idf(w) ** 2, 0)) || 1, bl = sets.map(len);
  return qs.map((q) => {
    const qw = wordsOf(q.text), ql = len(qw);
    return sets.map((s, i) => { let d = 0; qw.forEach((w) => { if (s.has(w)) d += idf(w) ** 2; }); return [d / (ql * bl[i]), i]; })
      .filter((x) => x[0] > 0).sort((a, b) => b[0] - a[0]).slice(0, k).map((x) => books[x[1]]);
  });
}
// redo: also try again on exam questions that found no match before (new textbook problems may have been read since).
async function linkExam(redo) {
  if (!smp) return 0;
  const books = allProblems().filter((p) => p.kind === 'original' && srcOf(p) === 'book');
  const exams = allProblems().filter((p) => p.kind === 'original' && srcOf(p) === 'exam' && (p.links == null || (redo && !p.links.length)));
  if (!exams.length || !books.length) return 0;
  const clip = (t, n) => t.replace(/\s+/g, ' ').slice(0, n);
  let done = 0;
  for (let i = 0; i < exams.length; i += 8) {
    const batch = exams.slice(i, i + 8), short = shortlist(batch, books, 6), cands = [], idx = new Map();
    short.forEach((list) => list.forEach((b) => { if (!idx.has(b.id)) { cands.push(b); idx.set(b.id, cands.length); } }));
    BK.note = `Matching exam questions to the text… (${Math.min(i + 8, exams.length)} of ${exams.length})`; paintBank();
    let r = null;
    if (cands.length) {
      r = await aiJson(`${rules()}\n\nA student is studying for exams in "${CLASS.name}". Below are questions from the instructor’s practice exam, then numbered problems from the textbook. `
        + 'For each question, name the textbook problems (only from its "possible matches") that test the same skill or idea, best first, at most 2. Use an empty list when none really does.\n\n'
        + 'Reply with only this JSON:\n{"links":[{"q":1,"match":[3]}]}\n\nExam questions:\n'
        + batch.map((q, j) => `Q${j + 1}: ${clip(q.text, 300)}\n  possible matches: ${short[j].map((b) => idx.get(b.id)).join(', ') || 'none'}`).join('\n')
        + '\n\nTextbook problems:\n' + cands.map((b, j) => `${j + 1}. ${clip(b.text, 220)}`).join('\n'), BK.ctl, bankWait(), 1500);
    }
    const got = Array.isArray(r && r.links) ? r.links : [];
    for (let j = 0; j < batch.length; j++) {
      const q = batch[j], m = (got.find((l) => +(l && l.q) === j + 1) || {}).match;
      const ids = (Array.isArray(m) ? m : []).map((x) => cands[(+x || 0) - 1]).filter((b) => b && short[j].includes(b)).slice(0, 2);
      const body = { links: ids.map((b) => b.id) };
      if (!q.chapterId) { // file it under the chapter most of its matches belong to
        const tally = {};
        ids.forEach((b) => { if (b.chapterId) tally[b.chapterId] = (tally[b.chapterId] || 0) + 1; });
        const best = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0];
        if (best) body.chapterId = best;
      }
      await api('PATCH', `/api/problems/${q.id}`, body); done++;
    }
  }
  await loadProblems();
  return done;
}

// The chapters an exam covers start as the ones its model exam's questions are filed under, or every chapter when there is none.
function tickChapters(tplId) {
  const ids = new Set(allProblems().filter((p) => tplId && p.sourceDoc === tplId && p.chapterId && PROBS[p.chapterId]).map((p) => p.chapterId));
  XS.ch.clear();
  if (ids.size) ids.forEach((id) => XS.ch.add(id)); else { CHAPTERS.forEach((c) => XS.ch.add(c.id)); XS.ch.add('none'); }
}

// ---- chapter topics ----
// The topics an exam can be aimed at: what the AI found in each chapter's text, plus the section headings of its study guides.
function topicList() {
  const seen = new Set(), out = [];
  const add = (title, chapterId) => { const t = String(title || '').trim(), k = t.toLowerCase(); if (t && !seen.has(k)) { seen.add(k); out.push({ title: t, chapterId: chapterId || null }); } };
  (CLASS.topics || []).forEach((t) => add(t.title, t.chapterId));
  GUIDES.forEach((g) => g.sections.forEach((s) => add(s.heading, g.chapterId)));
  const pos = (id) => { const i = CHAPTERS.findIndex((c) => c.id === id); return i < 0 ? 999 : i; };
  return out.sort((a, b) => pos(a.chapterId) - pos(b.chapterId));
}
// Reads a few parts of each chapter's own text and asks the AI to list what it teaches. The list is saved with the class.
async function scanTopics() {
  if (BK.busy) return;
  if (!smp) { BK.err = 'Finding topics needs the AI, which isn’t set up on this server.'; return renderRoute(true); }
  bankBegin(null);
  const found = [];
  try {
    for (const ch of CHAPTERS) {
      const docs = DOCS.filter((d) => d.chapterId === ch.id && d.chars && d.kind !== 'image' && d.tag !== 'exam');
      if (!docs.length) continue;
      BK.note = `Listing the topics in ${ch.title}…`; paintBank();
      let parts = (await docParts(docs)).filter((x) => x.text);
      if (parts.length > 6) parts = Array.from({ length: 6 }, (_, i) => parts[Math.floor((i * parts.length) / 6)]); // spread across the chapter
      for (const part of parts) {
        const r = await aiJson(`${rules()}\n\nBelow is part of the textbook chapter "${ch.title}" for "${CLASS.name}". List the specific topics, rules and skills it teaches, as short names of 2 to 5 words that a student would recognise on an exam (for example "naming polyatomic ions"). At most 8. Skip worked examples, history and summaries.\n\nReply with only this JSON:\n{"topics":["topic name"]}\n\nText:\n${part.text.slice(0, 9000)}`, BK.ctl, bankWait(), 600);
        (Array.isArray(r && r.topics) ? r.topics : []).forEach((t) => { if (typeof t === 'string' && t.trim()) found.push({ chapterId: ch.id, title: t.trim().slice(0, 80) }); });
      }
    }
    if (!found.length) throw Object.assign(new Error('I couldn’t find topics in the chapters’ text. Upload the chapters’ text into their chapters first.'), { code: 'none' });
    CLASS.topics = (await api('PUT', `/api/classes/${CLASS.id}/topics`, { topics: found })).topics;
    bankEnd(`Found ${plural(CLASS.topics.length, 'topic')} across your chapters.`);
  } catch (e) { bankEnd('', e); }
}

// ---- building ----
// o: { kind: 'chapter'|'exam', chapterIds, title, size, mix, tplId, focus, from, where }
// focus: a topic (e.g. "polyatomic ions") whose instructor questions are pulled in whole, from the exam document `from` or any exam; the rest follows the model exam and chapters.
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
    await linkExam(!!unread.length);
    const inScope = (p) => (p.chapterId && o.chapterIds.includes(p.chapterId)) || (o.tplId && p.sourceDoc === o.tplId);
    let pool = allProblems().filter(inScope);
    if (o.focus && o.tplId) pool = pool.filter((p) => srcOf(p) !== 'exam' || p.sourceDoc === o.tplId); // other exams only lend the focus topic's questions
    if (pool.length < 3 && o.kind === 'chapter' && o.chapterIds.length === 1) { // nothing to copy: write problems from the notes
      await genCore(o.chapterIds[0], tally); await loadProblems(); pool = allProblems().filter(inScope);
    }
    const forced = []; // the instructor's questions about the focus topic, always included
    if (o.focus) {
      const src = allProblems().filter((p) => p.kind === 'original' && srcOf(p) === 'exam' && (!o.from || p.sourceDoc === o.from));
      const entry = topicList().find((t) => t.title.toLowerCase() === o.focus.toLowerCase()), ctx = await classContext(o.focus, entry ? entry.chapterId : null); // what the student's own text says about it
      for (let i = 0; i < src.length; i += 60) {
        BK.note = `Finding the questions about ${o.focus}… (${Math.min(i + 60, src.length)} of ${src.length})`; paintBank();
        const part = src.slice(i, i + 60);
        const r = await aiJson(`${rules()}\n\nBelow are numbered questions from the instructor’s practice exams for "${CLASS.name}". List the ones that test or use: ${o.focus}. Judge by what each one asks (it may not use those words), and leave out ones that don’t really involve it.${ctx}\n\nReply with only this JSON:\n{"match":[3,7]}\n\nQuestions:\n`
          + part.map((p, j) => `${j + 1}. ${p.text.replace(/\s+/g, ' ').slice(0, 220)}`).join('\n'), BK.ctl, bankWait(), 800);
        (Array.isArray(r && r.match) ? r.match : []).forEach((x) => { const p = part[(+x || 0) - 1]; if (p && !forced.includes(p)) forced.push(p); });
      }
      if (!forced.length) throw Object.assign(new Error(`I couldn’t find any questions about “${o.focus}” in ${o.from ? 'that exam' : 'your instructor’s exams'}.`), { code: 'none' });
      pool = pool.filter((p) => !forced.includes(p));
    }
    if (!pool.length && !forced.length) throw Object.assign(new Error('I couldn’t find any problems in the materials for this. Upload a practice exam or the text with its problems, and try again.'), { code: 'none' });

    // choose representative problems
    const n = Math.max(3, Math.min(o.size, 60)), m = SMIX[o.mix] || SMIX.like;
    forced.splice(Math.max(1, Math.floor(n / 2))); // never more than half the exam
    const nAI = Math.round((n * m.ai) / 100), nPick = Math.max(0, Math.min(n - nAI - forced.length, pool.length)), nE = Math.round((nPick * m.exam) / (m.exam + m.book)), nB = nPick - nE;
    const rank = { exam: 0, book: 1, ai: 2 };
    // textbook problems matched to an instructor question come before the rest of the textbook
    const matched = new Set(pool.filter((p) => srcOf(p) === 'exam').flatMap((p) => p.links || []));
    const order = (p) => rank[srcOf(p)] * 2 + (srcOf(p) === 'book' && !matched.has(p.id) ? 1 : 0);
    const cand = [...shuffle(pool)].sort((a, b) => order(a) - order(b)).slice(0, 120);
    const multi = o.chapterIds.length > 1, letter = { exam: 'E', book: 'B', ai: 'A' };
    BK.note = 'Choosing the problems that cover the main ideas…'; paintBank();
    const tplQs = o.tplId ? allProblems().filter((p) => p.kind === 'original' && p.sourceDoc === o.tplId) : [], fmtCount = {};
    tplQs.forEach((p) => { const f = p.format || 'work'; fmtCount[f] = (fmtCount[f] || 0) + 1; });
    const fmtLine = Object.keys(fmtCount).length > 1 ? `The model exam is ${Object.entries(fmtCount).map(([f, c]) => `${c} ${FMT_NAME[f]}`).join(', ')}; choose in about the same proportions (the tag after E, B or A shows each problem’s format). ` : '';
    const lines = cand.map((p, i) => `${i + 1}. [${letter[srcOf(p)]}${p.format ? ', ' + p.format : ''}${multi && chapterById(p.chapterId) ? ', ' + chapterById(p.chapterId).title : ''}] ${p.text.replace(/\s+/g, ' ').slice(0, 240)}`).join('\n');
    const r = !nPick ? null : await aiJson(`${rules()}\n\nBelow are numbered practice problems for "${CLASS.name}". E = from the instructor’s practice exam, B = from the textbook, A = written by an AI. `
      + `Choose ${nPick} of them for a study set that captures the main ideas: cover every distinct topic, skip near-duplicates, and mix easy and hard. Aim for about ${nE} E and ${nB} B (take more of the other kind if one runs short; use A only if you must). `
      + (multi ? 'The set spans several chapters; keep the same balance between chapters as the E problems have. ' : '') + fmtLine
      + 'Name each pick’s topic in 2 to 4 words.\n\nReply with only this JSON:\n{"picks":[{"n":1,"topic":"short topic"}]}\n\nProblems:\n' + lines, BK.ctl, bankWait(), 3000);
    const used = new Set(), picks = [];
    (Array.isArray(r && r.picks) ? r.picks : []).forEach((x) => { const i = (+(x && x.n) || 0) - 1; if (cand[i] && !used.has(i) && picks.length < nPick) { used.add(i); picks.push({ p: cand[i], topic: String((x && x.topic) || cand[i].topic || '').slice(0, 60) }); } });
    cand.forEach((p, i) => { if (nPick && picks.length < Math.min(nPick, 3) && !used.has(i)) { used.add(i); picks.push({ p, topic: p.topic || '' }); } }); // the AI gave too few: top up from the best-ranked
    picks.unshift(...forced.map((p) => ({ p, topic: o.focus })));

    // variants: new problems like the picked ones, to reach the full size
    const made = [];
    for (let tries = 0; tries < 4 && picks.length; tries++) {
      const want = n - picks.length - made.length;
      if (want <= 0) break;
      BK.note = 'Writing new problems like the ones you’ll be tested on…'; paintBank();
      const k = Math.min(want, 12), seen = new Set([...allProblems(), ...made].map((p) => normText(p.text)));
      const models = picks.map((x, i) => `${i + 1}. [${letter[srcOf(x.p)]}, ${x.p.format || 'work'}] ${x.p.text.replace(/\s+/g, ' ').slice(0, 240)}${x.p.format === 'mc' ? ` (options: ${x.p.choices.join(' | ').slice(0, 240)})` : ''}${x.p.answer ? ` (answer: ${x.p.answer.slice(0, 60)})` : ''}`).join('\n');
      const v = await aiJson(`${rules()}\n\nBelow are numbered problems a student will be tested on. Write ${k} NEW practice problems, each modelled on one of them (give its number as "like"): the same type and difficulty, but different numbers, names or wording. Spread them across different models, preferring the E ones. Do not copy any original. `
        + 'Keep each model’s answer format (the word after its letter): a multiple-choice model gets a multiple-choice problem with four options, one correct and three believable wrong ones, listed in "choices" with the correct option’s text in "answer"; a written model gets a written problem with no options. '
        + `Work each one out carefully before you write its answer, and double-check it. Plain text only (${PACK.finder}).\n\nReply with only this JSON:\n{"problems":[{"like":1,"text":"the new problem","format":"mc","choices":["option"],"answer":"the final answer","steps":["one short step"]}]}\n\nProblems:\n${models}`, BK.ctl, bankWait(), 3500);
      const fresh = (Array.isArray(v && v.problems) ? v.problems : []).slice(0, k).map((q) => {
        const base = (picks[(+(q && q.like) || 1) - 1] || picks[0]).p;
        const sh = mixChoices(shapeProblem(q));
        return { kind: 'similar', text: sh.text, answer: sh.answer, format: sh.format, choices: sh.choices, steps: (Array.isArray(q && q.steps) ? q.steps : []).map((x) => String(x)), topic: base.topic, sourceDoc: base.sourceDoc, chapterId: base.chapterId, wasMc: base.format === 'mc' };
      }).filter((q) => q.text && (q.format !== 'mc' || keyIndex(q, q.choices) >= 0) && (!q.wasMc || q.format === 'mc') && !seen.has(normText(q.text)) && seen.add(normText(q.text)));
      if (!fresh.length) break;
      made.push(...await api('POST', `/api/classes/${CLASS.id}/problems`, { problems: fresh }));
    }

    // an answer for every picked problem the text gave no key for (marked as the AI's)
    const keys = {}, keyless = picks.filter((x) => !x.p.answer).slice(0, 20);
    if (keyless.length) {
      BK.note = 'Working out answers for problems that came without a key…'; paintBank();
      try {
        const kr = await aiJson(`${rules()}\n\nWork out the final answer to each numbered problem below, carefully. For a problem with options, "answer" is the text of the correct option. Reply with only this JSON:\n{"answers":[{"n":1,"answer":"the final answer"}]}\n\n${keyless.map((x, i) => `${i + 1}. ${x.p.text.replace(/\s+/g, ' ').slice(0, 400)}${x.p.format === 'mc' ? ` Options: ${x.p.choices.join(' | ')}` : ''}`).join('\n')}`, BK.ctl, bankWait(), 2500);
        (Array.isArray(kr && kr.answers) ? kr.answers : []).forEach((a) => { const x = keyless[(+(a && a.n) || 0) - 1]; if (x && a.answer) keys[x.p.id] = String(a.answer).slice(0, 500); });
      } catch (e) { if (e && e.code === 'cancelled') throw e; /* no keys: the review says so */ }
    }

    const items = [...picks.map((x) => ({ id: x.p.id, src: srcOf(x.p), key: x.p.answer ? '' : keys[x.p.id] || '' })), ...made.map((q) => ({ id: q.id, src: 'ai', key: '' }))];
    // an exam modelled on one that has several formats keeps its order: its multiple-choice part first, and so on
    const fmtById = {};
    picks.forEach((x) => { fmtById[x.p.id] = x.p.format || 'work'; });
    made.forEach((q) => { fmtById[q.id] = q.format || 'work'; });
    const modelOrder = [...new Set(tplQs.map((p) => p.format || 'work'))], rankF = (it) => { const k = modelOrder.indexOf(fmtById[it.id] || 'work'); return k < 0 ? 99 : k; };
    const ordered = o.kind === 'exam' ? (modelOrder.length > 1 ? shuffle(items).sort((a, b) => rankF(a) - rankF(b)) : shuffle(items)) : items;
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
  const key = (p) => { const o = optionsOf(p), k = o ? keyIndex(p, o) : -1, a = k >= 0 ? `${'abcdefgh'[k]}) ${o[k]}` : p.answer; return a ? esc(a) + (p.kind === 'similar' || p.aiKey ? ' <i>(worked out by the AI)</i>' : '') : '<i>no key</i>'; };
  const body = (p) => { const o = optionsOf(p); return `${fmtMath(p.text)}${o ? `<ol class="o">${o.map((c) => `<li>${fmtMath(c)}</li>`).join('')}</ol>` : '<div class="sp"></div>'}`; };
  w.document.write(`<!doctype html><meta charset="utf-8"><title>${esc(s.title)}</title><style>body{font:15px/1.5 Georgia,serif;margin:36px;color:#111}h1{font-size:22px}h2{font-size:18px}li{margin:0 0 6px}.sp{height:130px}ol.o{list-style:lower-alpha;margin:6px 0 10px 1.2em}@page{margin:18mm}</style>
    <h1>${esc(CLASS.name)}: ${esc(s.title)}</h1><ol>${items.map((p) => `<li>${body(p)}</li>`).join('')}</ol>
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
// The exam builder on the Exams page: chapters, the instructor's exam to model it on, the mix, the size.
function examBuilderHTML(list) {
  const tpls = sourceDocs().filter((d) => d.tag === 'exam'), loose = PROBS.none || [];
  if (SS.tpl !== '' && !tpls.some((d) => d.id === SS.tpl)) SS.tpl = tpls.length ? tpls[0].id : '';
  if (SS.from && !tpls.some((d) => d.id === SS.from)) SS.from = '';
  const count = (id) => (PROBS[id] || []).length, topics = topicList();
  const chk = (id, label) => `<label class="chk"><input type="checkbox" data-act="b-xch" data-id="${id}" ${XS.ch.has(id) ? 'checked' : ''}> ${label} <small>${plural(count(id), 'problem')}</small></label>`;
  return `<section class="zone"><h3>Build my exam</h3>
    <small>Pick the chapters the exam covers. ${tpls.length ? 'It mixes your instructor’s questions, problems from the text and new ones written to match' : 'You haven’t uploaded an instructor exam yet, so it will use problems from the text and new ones written to match (upload one below to include its questions)'}, and is saved so you can retake or print it.</small>
    ${CHAPTERS.length ? `<div class="xch">${CHAPTERS.map((c) => chk(c.id, esc(c.title))).join('')}${loose.length ? chk('none', 'Not filed under a chapter') : ''}</div>` : '<small>Add chapters first (use “+ Add chapter” in the sidebar) so the exam can cover them.</small>'}
    <div class="xrow"><label class="fld"><small>Model it on</small><select class="line" data-ss="tpl">${[['', 'No model exam']].concat(tpls.map((d) => [d.id, 'Model: ' + d.name])).map(([v, l]) => `<option value="${v}" ${SS.tpl === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
      <label class="fld"><small>Mix</small><select class="line" data-ss="mix">${Object.entries(SMIX).map(([k, x]) => `<option value="${k}" ${SS.mix === k ? 'selected' : ''}>${x.label}</option>`).join('')}</select></label>
      <label class="fld"><small>Size</small><select class="line" data-ss="xsize">${sizeOptions(SS.xsize)}</select></label></div>
    <div class="xrow"><label class="fld"><small>Also include questions about (optional)</small><input class="line" type="text" id="xfocus" data-ss="focus" list="xtopics" maxlength="100" placeholder="Search your chapters’ topics, or type one" autocomplete="off" value="${esc(SS.focus)}"><datalist id="xtopics">${topics.map((t) => `<option value="${esc(t.title)}" label="${chapterById(t.chapterId) ? esc(chapterById(t.chapterId).title) : ''}"></option>`).join('')}</datalist></label>
      <label class="fld"><small>…taken from</small><select class="line" data-ss="from">${[['', 'Any instructor exam']].concat(tpls.map((d) => [d.id, d.name])).map(([v, l]) => `<option value="${v}" ${SS.from === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label></div>
    <small class="topichint">${topics.length ? `${plural(topics.length, 'topic')} from your chapters. Pick one to pull that topic’s questions into the exam, from the exam chosen above.` : 'No topic list yet. The AI can read your chapters and list what each one teaches, so you can pick from it.'}
      ${smp && CHAPTERS.length ? `<button class="link" data-act="b-topics" ${BK.busy ? 'disabled' : ''}>${CLASS.topics && CLASS.topics.length ? 'Find topics again' : 'Find topics in my chapters'}</button>` : ''}</small>
    <div class="answer"><button class="btn" data-act="b-xbuild" ${BK.busy || !smp || !CHAPTERS.length ? 'disabled' : ''}>Build my exam</button></div>
    ${bkStatusHTML()}
    ${smp ? '' : '<small class="warn">Building needs the AI, which isn’t set up on this server.</small>'}</section>`;
}
function savedExamsHTML() {
  const mine = SETS.filter((s) => s.kind === 'exam');
  return mine.length ? `<section class="zone"><h3>Saved exams</h3>${mine.map(setRowHTML).join('')}</section>` : '';
}

async function setAct(act, t) {
  const id = t.dataset && t.dataset.id;
  if (act !== 'b-setdel') SS.delId = null;
  if (act === 'b-topics') return scanTopics();
  if (act === 'b-settake') return takeSet(id);
  if (act === 'b-setprint') return printSet(id);
  if (act === 'b-setdel') {
    if (SS.delId !== id) { SS.delId = id; return renderRoute(true); }
    try { await api('DELETE', `/api/sets/${id}`); SETS = SETS.filter((s) => s.id !== id); } catch (e) { BK.err = e.message; }
    SS.delId = null; return renderRoute(true);
  }
  if (act === 'b-xbuild') {
    const ids = CHAPTERS.map((c) => c.id).filter((c) => XS.ch.has(c));
    const fi = document.getElementById('xfocus'), focus = (fi ? fi.value : SS.focus).trim().slice(0, 100);
    SS.focus = focus;
    if (!ids.length && !SS.tpl && !focus) { BK.err = 'Tick at least one chapter.'; return renderRoute(true); }
    const tpl = DOCS.find((d) => d.id === SS.tpl), base = tpl ? `Exam like ${tpl.name.replace(/\.[^.]+$/, '')}` : `Practice exam, ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
    return buildSet({ kind: 'exam', chapterIds: ids, tplId: SS.tpl, focus, from: SS.from, title: focus ? `${base}, plus ${focus}` : base, size: SS.xsize, mix: SS.mix, where: null });
  }
}
app.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset && t.dataset.ss && t.matches('select, input[type=text]')) {
    SS[t.dataset.ss] = /size$/.test(t.dataset.ss) ? +t.value : t.value;
    if (t.dataset.ss === 'tpl') { tickChapters(t.value); renderRoute(true); }
  }
});
