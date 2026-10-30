// Study guides: pick documents, the AI reads them part by part and writes a guide (sections, key terms, key points)
// plus recall questions. The questions are practised by typing first, with choices after a miss, and come back on a
// spaced schedule (S.cards) so they stick.
let GUIDES = [];
let GB = { docs: new Set(), title: '', busy: false, note: '', err: '', ctl: null, chapterId: null, all: false, auto: false };   // builder
let GV = { id: null, delArmed: false, askSec: null };                                                              // viewer
let Q = null;                                                                           // quiz round
const GCHUNK = 8000, GMAX_PARTS = 40, GROUND = 10, GINTERVALS = [0, 1, 3, 7, 14, 30];
const resetGB = () => { GB = { docs: new Set(), title: '', busy: false, note: '', err: '', ctl: null, chapterId: null, all: false, auto: false }; };

async function loadGuides() {
  try { GUIDES = await api('GET', `/api/classes/${CLASS.id}/guides`); } catch (e) { if (e.code === 'auth_required') throw e; GUIDES = []; }
}
const guideById = (id) => GUIDES.find((g) => g.id === id);
const cardId = (g, i) => `${g.id}:${i}`;
const cardRec = (id) => ((S.cards || (S.cards = {}))[id] || null);
const allCards = () => GUIDES.flatMap((g) => g.cards.map((c, i) => ({ g, c, i, id: cardId(g, i) })));
const cardsMastered = () => allCards().filter((x) => (cardRec(x.id) || {}).box >= 3).length;
const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return dayKey(d); };
const dueCount = (g) => g.cards.filter((c, i) => { const r = cardRec(cardId(g, i)); return !r || r.due <= dayKey(); }).length;

// ---- builder ----
function renderBuilder() {
  const scoped = !!GB.chapterId && !GB.all, ch = chapterById(GB.chapterId);
  const usable = DOCS.filter((d) => d.chars && (!scoped || d.chapterId === GB.chapterId));
  const aiOk = typeof smp !== 'undefined' && smp;
  const list = usable.length
    ? `<div class="found">${usable.map((d) => `<label class="pick"><input type="checkbox" data-gdoc="${d.id}" ${GB.docs.has(d.id) ? 'checked' : ''} ${GB.busy ? 'disabled' : ''}><span>${esc(d.name)} <small>${d.chars.toLocaleString()} characters</small></span></label>`).join('')}</div>`
    : `<small>No readable documents ${scoped ? 'in this chapter ' : ''}yet. Upload a PDF, Word or text file (or paste notes) first.</small>`;
  app.innerHTML = `<div class="rbar"><button class="link" data-act="g-home">‹ Back</button></div>
  <div class="prob"><div class="eyebrow">Make a study guide${ch ? ' &middot; ' + esc(ch.title) : ''}</div>
    <p class="lead">Choose the chapter or notes to study from. I’ll read them in order and write a guide with the key terms and the points to know, plus questions to practise. A long chapter takes a few minutes.</p>
    ${aiOk ? '' : '<div class="fb no" role="status"><p>This needs the AI. Add a Groq or OpenRouter key under Settings first.</p></div>'}
    ${list}
    ${GB.chapterId ? `<div><button class="link" data-act="g-all" ${GB.busy ? 'disabled' : ''}>${scoped ? 'Show documents from all chapters' : 'Only this chapter’s documents'}</button></div>` : ''}
    <div class="answer"><label class="btn alt" for="gfile">Upload more</label><input type="file" id="gfile" multiple accept="${DOC_ACCEPT}" hidden></div>
    <label class="field" for="gtitle">Name <small>(optional)</small></label>
    <input class="line" id="gtitle" type="text" maxlength="120" placeholder="e.g. Chapter 4 guide" value="${esc(GB.title)}">
    <div class="answer"><button class="btn" data-act="g-build" ${GB.busy || !aiOk ? 'disabled' : ''}>${GB.busy ? esc(GB.note || 'Reading…') : 'Build the guide'}</button>${GB.busy ? '<button class="link" data-act="g-stop">Stop and keep what’s done</button>' : ''}</div>
    ${GB.err ? `<div class="fb no" role="status"><p>${esc(GB.err)}</p></div>` : ''}</div>`;
}
function syncGB() {
  const t = document.getElementById('gtitle'); if (t) GB.title = t.value;
  document.querySelectorAll('input[data-gdoc]').forEach((c) => { if (c.checked) GB.docs.add(c.dataset.gdoc); else GB.docs.delete(c.dataset.gdoc); });
}

const gs = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
const gl = (v, n, m) => (Array.isArray(v) ? v : []).map((x) => gs(x, n)).filter(Boolean).slice(0, m);

function partPrompt(i, n, text, focus) {
  return `You are writing a study guide for an adult student taking "${CLASS.name}". ${CLASS.description ? `About the course: ${CLASS.description}. ` : ''}Below is part ${i + 1} of ${n} of their reading. Use ONLY what this text says. Do not invent facts.\n\n`
    + 'Reply with only this JSON:\n'
    + '{"sections":[{"heading":"short heading taken from the text","summary":"2 or 3 plain sentences","video":"a YouTube search (3 to 6 words) that finds a short lesson on the topic of this section","terms":[{"term":"","def":"one clear sentence"}],"points":["a fact or rule worth knowing cold"]}],'
    + '"cards":[{"q":"a question whose answer is 1 to 4 words","a":"the answer","accept":["other correct wordings or abbreviations"],"wrong":["three believable wrong answers of the same kind"]}]}\n\n'
    + 'Limits for this part: at most 3 sections, 10 terms in total, 6 points in total, 8 cards. Skip anything that is only an example, a figure caption, a table of contents or an index. '
    + 'Cards test the most important ideas, terms and facts: "What is the term for ...?", "Which ... does ...?", "What value/number ...?". Each question must make sense on its own, with no "according to the text".\n\n'
    + `Text:\n${text}`;
}

// One JSON answer from the AI. Retries a few times, and waits out the rate limit (onWait gets the seconds left).
async function aiJson(prompt, ctl, onWait, maxTokens = 4000) {
  for (let attempt = 0; ; attempt++) {
    try { return await smp.json(prompt, { signal: ctl.signal, maxTokens }); }
    catch (e) {
      if (e && e.code === 'cancelled') throw e;
      const again = attempt < 2 && e && (e.code === 'rate_limited' || e.code === 'invalid_json' || e.code === 'empty_completion' || e.code === 'ai_timeout');
      if (!again) throw e;
      if (e.code === 'rate_limited') {
        for (let s = 25; s > 0; s--) { onWait(s); await new Promise((r) => setTimeout(r, 1000)); if (ctl.signal.aborted) throw Object.assign(new Error('cancelled'), { code: 'cancelled' }); }
      }
    }
  }
}
const aiPart = (prompt, ctl) => aiJson(prompt, ctl, (s) => { GB.note = `Waiting for the AI quota (${s}s)…`; renderBuilder(); });

async function gBuild() {
  syncGB();
  const picked = DOCS.filter((d) => GB.docs.has(d.id) && d.chars);
  GB.err = '';
  if (!picked.length) { GB.err = 'Tick at least one document.'; return renderBuilder(); }
  if (!smp) { GB.err = 'This needs the AI, which isn’t set up on this server.'; return renderBuilder(); }
  GB.busy = true; GB.ctl = new AbortController(); GB.note = 'Reading…'; renderBuilder();
  const sections = [], cards = [], seenQ = new Set();
  let done = 0, failed = 0, total = 0, stopped = false, cut = false, why = '';
  try {
    const parts = [];
    for (const d of picked) splitChunks((await api('GET', `/api/docs/${d.id}/text`)).text, GCHUNK).forEach((t) => parts.push(t));
    cut = parts.length > GMAX_PARTS; total = Math.min(parts.length, GMAX_PARTS);
    for (let i = 0; i < total; i++) {
      GB.note = `Reading part ${i + 1} of ${total}…`; renderBuilder();
      let r;
      try { r = await aiPart(partPrompt(i, total, parts[i]), GB.ctl); }
      catch (e) {
        if (e && e.code === 'cancelled') { stopped = true; break; }
        failed++; why = mineErr(e);
        if (e && (e.code === 'ai_unavailable' || e.code === 'ai_auth' || e.code === 'auth_required')) break;
        continue;
      }
      done++;
      (Array.isArray(r && r.sections) ? r.sections : []).forEach((s) => {
        const sec = {
          heading: gs(s && s.heading, 120) || 'Notes', summary: gs(s && s.summary, 600), video: gs(s && s.video, 120),
          terms: (Array.isArray(s && s.terms) ? s.terms : []).map((t) => ({ term: gs(t && t.term, 100), def: gs(t && t.def, 400) })).filter((t) => t.term && t.def).slice(0, 12),
          points: gl(s && s.points, 300, 8),
        };
        const prev = sections[sections.length - 1];
        if (prev && prev.heading.toLowerCase() === sec.heading.toLowerCase()) { // a section that runs across two parts
          prev.summary = (prev.summary + ' ' + sec.summary).trim(); prev.video = prev.video || sec.video; prev.terms.push(...sec.terms); prev.points.push(...sec.points);
        } else sections.push(sec);
      });
      const head = (sections[sections.length - 1] || {}).heading || '';
      (Array.isArray(r && r.cards) ? r.cards : []).forEach((c) => {
        const q = gs(c && c.q, 300), a = gs(c && c.a, 160), k = q.toLowerCase();
        if (q && a && !seenQ.has(k)) { seenQ.add(k); cards.push({ q, a, accept: gl(c.accept, 160, 5), wrong: gl(c.wrong, 160, 4).filter((w) => w.toLowerCase() !== a.toLowerCase()), topic: head }); }
      });
    }
  } catch (e) { GB.err = mineErr(e); }
  GB.busy = false;
  if (!sections.length && !cards.length) {
    GB.err = GB.err || (stopped ? 'Stopped before anything was read.' : failed ? `I couldn’t build it. ${why}` : 'I couldn’t find anything to study in that.');
    return renderBuilder();
  }
  const note = [stopped ? `Stopped after ${done} of ${total} parts.` : '', failed ? `${plural(failed, 'part')} couldn’t be read (${why}).` : '', cut ? `Only the first ${GMAX_PARTS} parts were read; build another guide from the rest.` : ''].filter(Boolean).join(' ');
  try {
    const g = await api('POST', `/api/classes/${CLASS.id}/guides`, { chapterId: GB.chapterId, title: GB.title.trim() || (picked.length === 1 ? picked[0].name.replace(/\.[^.]+$/, '') : `${picked[0].name.replace(/\.[^.]+$/, '')} and ${picked.length - 1} more`), docs: picked.map((d) => d.id), sections, cards, note });
    const auto = GB.auto;
    GUIDES.unshift(g); resetGB(); GV = { id: g.id, delArmed: false, askSec: null }; loadChapters().then(() => {}); if (auto) go(chHash(g.chapterId || 'unsorted', 'learn')); else goGuide(g);
  } catch (e) { GB.err = 'Built it, but saving failed: ' + e.message; renderBuilder(); }
}

// ---- viewer ----
// A guide as it appears under a chapter's Guide tab: contents, sections with questions and videos.
function guideBodyHTML(g) {
  const toc = g.sections.length >= 4
    ? `<nav class="toc" aria-label="Contents"><h3>Contents</h3><ol>${g.sections.map((s, i) => `<li><button class="link" data-toc="gs-${i}">${esc(s.heading)}</button></li>`).join('')}</ol></nav>` : '';
  const sec = g.sections.map((s, i) => {
    const asking = GV.askSec && GV.askSec.gid === g.id && GV.askSec.i === i;
    return `<section class="gsec" id="gs-${i}"><h3>${esc(s.heading)}</h3>${s.summary ? `<p>${esc(s.summary)}</p>` : ''}
    ${s.points.length ? `<ul class="gpts">${s.points.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    ${s.terms.length ? `<dl class="gterms">${s.terms.map((t) => `<dt>${esc(t.term)}</dt><dd>${esc(t.def)}</dd>`).join('')}</dl>` : ''}
    <div class="acts gsact">${smp ? `<button class="link" data-act="g-asksec" data-id="${g.id}" data-i="${i}">${asking ? 'Hide question box' : 'Ask about this section'}</button>` : ''}${videosHTML(s.video || `${s.heading} ${CLASS.name}`, true)}</div>
    ${asking ? followHTML({ title: 'Ask about this section', placeholder: 'e.g. What does this term mean?' }) : ''}</section>`;
  }).join('');
  return `<div class="prob"><div class="eyebrow">Study guide</div><h2 class="gtitle">${esc(g.title)}</h2>
    ${g.note ? `<small class="warn">${esc(g.note)}</small>` : ''}
    <div class="acts">${g.cards.length ? `<button class="btn" data-act="g-quiz" data-id="${g.id}">Quiz me (${plural(g.cards.length, 'question')})</button>` : ''}<button class="link" data-act="g-print">Print</button><button class="link" data-act="g-del" data-id="${g.id}">${GV.delArmed ? 'Really delete? Click again' : 'Delete'}</button></div>
    <small>Written by the AI from your documents, so check anything important against the book.</small></div>
  ${toc}
  <div class="gsecs">${sec || '<section class="zone"><small>This guide has questions but no written sections.</small></section>'}</div>`;
}
app.addEventListener('click', (e) => {
  const b = e.target.closest('[data-toc]');
  if (b) { const el = document.getElementById(b.dataset.toc); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
});

// ---- answer matching ----
const GSTOP = new Set(['the', 'a', 'an', 'of', 'to', 'and', 'or', 'is', 'are', 'in', 'on', 'for', 'by', 'its', 'it', 'as']);
const gtoks = (s) => String(s).toLowerCase().replace(/[’']/g, '').split(/[^a-z0-9.]+/).map((t) => t.replace(/^\.+|\.+$/g, '')).filter(Boolean);
const gnum = (t) => (/^\d+(\.\d+)?$/.test(t) ? parseFloat(t) : null);
// A typed answer matches when every meaningful word of an accepted answer is covered: a prefix of 3+ letters
// ("tetra" for "tetrahedral"), a number within 1% ("109" for "109.5"), or a word with one slipped letter.
function tokMatch(want, got) {
  const wn = gnum(want);
  if (wn !== null) return got.some((g) => { const gn = gnum(g); return gn !== null && (want.includes('.') ? Math.abs(gn - wn) < 1 : gn === wn); }); // 109 passes for 109.5, but 1777 is not 1776
  return got.some((g) => g === want || (g.length >= 3 && want.startsWith(g)) || (want.length >= 6 && lev(g, want) <= 1) || (want.length >= 10 && lev(g, want) <= 2));
}
function cardOk(c, raw) {
  const got = gtoks(raw);
  if (!got.length) return null;
  return [c.a, ...(c.accept || [])].some((a) => {
    const want = gtoks(a).filter((t) => !GSTOP.has(t) || gtoks(a).length === 1);
    if (!want.length) return false;
    if (normT(a) === normT(raw)) return true;
    return want.every((w) => tokMatch(w, got)) && got.filter((g) => !GSTOP.has(g)).length <= want.length + 2;
  });
}

// ---- quiz ----
const inChapter = (g, chId) => !chId || (chId === 'unsorted' ? !g.chapterId : g.chapterId === chId);
function pickCards(guideId, chapterId) {
  const today = dayKey();
  const pool = allCards().filter((x) => (!guideId || x.g.id === guideId) && inChapter(x.g, chapterId));
  const due = pool.filter((x) => { const r = cardRec(x.id); return r && r.due <= today; }).sort((a, b) => cardRec(a.id).box - cardRec(b.id).box);
  const fresh = pool.filter((x) => !cardRec(x.id));
  let q = [...due.slice(0, GROUND), ...fresh.slice(0, Math.max(GROUND - Math.min(due.length, GROUND), 4))].slice(0, GROUND);
  let extra = false;
  if (!q.length) { q = shuffle(pool).slice(0, GROUND); extra = true; }
  return { q: shuffle(q), extra };
}
function startQuiz(guideId, chapterId) {
  const { q, extra } = pickCards(guideId, chapterId);
  if (!q.length) { GB.err = ''; return renderHome(); }
  round = null; W.id = null;
  Q = { guideId, chapterId: chapterId || null, askOpen: false, items: q, i: 0, results: [], extra, state: 'ask', typed: '', choices: null, ans: -1, wrong: [], tries: 0 };
  renderQuiz();
}
function buildChoices(x) {
  const a = x.c.a, seen = new Set([a.toLowerCase()]), w = [];
  [...x.c.wrong, ...shuffle(x.g.cards.filter((c) => c !== x.c).map((c) => c.a))].forEach((t) => { if (w.length < 3 && t && !seen.has(t.toLowerCase())) { seen.add(t.toLowerCase()); w.push(t); } });
  const all = shuffle([a, ...w]);
  return { choices: all, ans: all.indexOf(a) };
}
// What to search for when a card was missed: the section's own video search, else the topic in this class.
const cardVideoQ = (x) => { const sec = x.g.sections.find((t) => t.heading === x.c.topic); return (sec && sec.video) || `${x.c.topic || x.c.q} ${CLASS.name}`; };
function renderQuiz() {
  const x = Q.items[Q.i], st = Q.state, locked = st === 'right' || st === 'shown', last = Q.i === Q.items.length - 1;
  let input;
  if (st === 'choices' || (locked && Q.choices)) {
    input = `<div class="choices ${Q.choices.some((c) => c.length > 34) ? 'wide' : ''}">${Q.choices.map((c, i) => `<button class="choice ${locked && i === Q.ans ? 'right' : ''}" data-act="g-pick" data-c="${i}" ${locked || Q.wrong.includes(i) ? 'disabled' : ''}>${esc(c)}</button>`).join('')}</div>`;
  } else {
    input = `<form class="answer" data-form="gq" autocomplete="off"><input id="gans" type="text" enterkeyhint="done" autocapitalize="off" spellcheck="false" aria-label="Your answer" value="${esc(Q.typed)}" ${locked ? 'disabled' : ''} placeholder="your answer">
      ${locked ? '' : '<button class="btn" type="submit">Check</button>'}</form>`;
  }
  let fb = '';
  if (st === 'choices') fb = `<div class="fb no" role="status"><p>${Q.typed ? `You typed <b>${esc(Q.typed)}</b>. ` : ''}Pick the right one from these choices.</p>${Q.typed ? '<div class="acts"><button class="link" data-act="g-mine">My answer was right</button></div>' : ''}</div>`;
  if (st === 'right') fb = `<div class="fb good" role="status"><h3>${Q.fb === 'first' ? 'Correct.' : 'Correct on the retry.'}</h3><p>${esc(x.c.a)}</p><div class="acts"><button class="btn" id="nextbtn" data-act="g-next">${last ? 'Finish' : 'Next'}</button>${quizHelpHTML(x, true)}</div></div>`;
  if (st === 'shown') fb = `<div class="fb no" role="status"><h3>The answer</h3><p><b>${esc(x.c.a)}</b></p><p>This one will come back soon.</p><div class="acts"><button class="btn" id="nextbtn" data-act="g-next">${last ? 'Finish' : 'Next'}</button>${quizHelpHTML(x, false)}</div></div>`;
  const help = st === 'ask' ? '<div class="help"><button class="link" data-act="g-show">I don’t know this one</button></div>' : '';
  app.innerHTML = `<div class="rbar"><button class="link" data-act="g-home">‹ End session</button><span class="progress">Question ${Q.i + 1} of ${Q.items.length}</span></div>
  <div class="prob"><div class="eyebrow">${esc(x.g.title)}${x.c.topic ? ' &middot; ' + esc(x.c.topic) : ''}</div><div class="qtext">${esc(x.c.q)}</div>${input}${help}${fb}${Q.askOpen && locked ? followHTML() : ''}</div>`;
  const nb = document.getElementById('nextbtn'), inp = document.getElementById('gans');
  if (nb) nb.focus(); else if (inp && !inp.disabled) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
}
// After a card is answered: ask the tutor about it, and watch a video on the topic.
const quizHelpHTML = (x, lazy) => `${smp ? `<button class="link" data-act="follow">${Q.askOpen ? 'Hide follow-up' : 'Ask a follow-up'}</button>` : ''}${videosHTML(cardVideoQ(x), lazy)}`;
// kind: 'first' (typed it right), 'retry' (right from the choices), 'miss' (had to be shown)
function gRecord(x, kind) {
  const r = cardRec(x.id) || { box: 0, seen: 0 };
  r.seen++; r.last = dayKey();
  if (kind === 'first') r.box = Math.min(GINTERVALS.length - 1, r.box + 1);
  else if (kind === 'miss') r.box = 0;
  r.due = addDays(kind === 'miss' ? 0 : kind === 'retry' ? 1 : GINTERVALS[r.box]);
  S.cards[x.id] = r;
  record(null, kind);
}
function gFinishCard(kind) {
  Q.results[Q.i] = kind; Q.fb = kind;
  gRecord(Q.items[Q.i], kind);
  Q.state = kind === 'miss' ? 'shown' : 'right';
  renderQuiz();
}
function gAnswer() {
  if (!Q || Q.state !== 'ask') return;
  const el = document.getElementById('gans'), v = el ? el.value : '';
  if (!v.trim()) return;
  Q.typed = v;
  const ok = cardOk(Q.items[Q.i].c, v);
  if (ok) return gFinishCard('first');
  Q.tries = 1; Q.state = 'choices';
  Object.assign(Q, buildChoices(Q.items[Q.i])); Q.wrong = [];
  renderQuiz();
}
function gShow() { if (!Q.choices) Object.assign(Q, buildChoices(Q.items[Q.i])); gFinishCard('miss'); }
function gPick(i) {
  if (i === Q.ans) return gFinishCard('retry');
  Q.wrong.push(i);
  if (Q.wrong.length >= 2) return gFinishCard('miss');
  renderQuiz();
}
function gNext() {
  Q.i++;
  if (Q.i >= Q.items.length) return renderQuizSummary();
  Object.assign(Q, { state: 'ask', typed: '', choices: null, ans: -1, wrong: [], tries: 0, fb: null, askOpen: false });
  renderQuiz();
}
function renderQuizSummary() {
  const firsts = Q.results.filter((r) => r === 'first').length, n = Q.items.length;
  const missed = Q.items.filter((x, i) => Q.results[i] === 'miss');
  const path = Q.path, here = path && pathAt(path.gid, path.i), nxt = here ? nextAfter(here) : null;
  app.innerHTML = `<div class="sum"><h1>${path ? 'Section complete' : 'Session complete'}</h1><div class="big">${firsts} of ${n}</div><small>typed correctly on the first try</small>
    ${missed.length ? `<p class="lines">To review: ${missed.map((x) => esc(x.c.a)).join('; ')}. These come back sooner.</p>` : ''}
    <small>${plural(cardsMastered(), 'question')} of ${allCards().length} well learned so far.</small>
    <div class="acts">${path
      ? `${nxt ? `<button class="btn" id="nextbtn" data-act="g-sec" data-id="${nxt.g.id}" data-i="${nxt.i}">Next: ${esc(nxt.sec.heading)}</button>` : ''}<button class="${nxt ? 'link' : 'btn'}" ${nxt ? '' : 'id="nextbtn" '}data-act="g-secgo" data-id="${path.gid}" data-i="${path.i}">Try this section again</button>`
      : `<button class="btn" id="nextbtn" data-act="g-quiz" data-id="${Q.guideId || ''}" data-ch="${Q.chapterId || ''}">Another round</button>`}<button class="link" data-act="g-home">Back to the course</button></div></div>`;
  document.getElementById('nextbtn').focus();
  Q = null;
}

async function gUpload(files) {
  syncGB();
  GB.err = ''; GB.busy = true; GB.note = 'Uploading…'; renderBuilder();
  try { (await uploadFiles(files, { chapterId: GB.chapterId })).forEach((d) => { if (d.chars) GB.docs.add(d.id); }); }
  catch (e) { GB.err = e.message; (e.made || []).forEach((d) => { if (d.chars) GB.docs.add(d.id); }); }
  GB.busy = false; renderBuilder();
}
async function guideAct(act, t) {
  const id = t.dataset && t.dataset.id;
  if (act !== 'g-del' && GV.delArmed) GV.delArmed = false;
  if (act === 'g-home') { if (GB.ctl && GB.busy) return; Q = null; renderHome(); }
  else if (act === 'g-new') {
    resetGB();
    const d = id && DOCS.find((x) => x.id === id);
    if (id) GB.docs.add(id);
    GB.chapterId = t.dataset.ch || (d && d.chapterId) || (ROUTE && ROUTE.realId) || null;
    renderBuilder();
  }
  else if (act === 'g-all') { syncGB(); GB.all = !GB.all; renderBuilder(); }
  else if (act === 'g-view') { GV = { id, delArmed: false, askSec: null }; const g = guideById(id); go(chHash((g && g.chapterId) || 'unsorted', 'guide', id)); }
  else if (act === 'g-asksec') {
    const i = +t.dataset.i, same = GV.askSec && GV.askSec.gid === id && GV.askSec.i === i;
    GV.askSec = same ? null : { gid: id, i };
    renderRoute(true);
    const f = document.getElementById('ftext'); if (f && !same) f.focus();
  }
  else if (act === 'g-build') gBuild();
  else if (act === 'g-stop') { if (GB.ctl) GB.ctl.abort(); }
  else if (act === 'g-quiz') startQuiz(id || null, t.dataset.ch || null);
  else if (act === 'g-sec') showSection(id, +t.dataset.i);
  else if (act === 'g-secgo') startSectionQuiz(id, +t.dataset.i);
  else if (act === 'g-prep') prepareChapter(t.dataset.ch);
  else if (act === 'g-learn') go(chHash(t.dataset.ch, 'learn'));
  else if (act === 'g-show') gShow();
  else if (act === 'g-pick') gPick(+t.dataset.c);
  else if (act === 'g-mine') gFinishCard('first');
  else if (act === 'g-next') gNext();
  else if (act === 'g-print') window.print(); // the print stylesheet hides everything but the guide
  else if (act === 'g-del') {
    if (!GV.delArmed) { GV.delArmed = true; return renderRoute(true); }
    try { await api('DELETE', `/api/guides/${id}`); GUIDES = GUIDES.filter((g) => g.id !== id); await loadChapters(); } catch (e) { /* stays listed */ }
    GV = { id: null, delArmed: false, askSec: null }; renderHome();
  }
}
app.addEventListener('change', (e) => {
  const t = e.target;
  if (t.id === 'gfile' && t.files && t.files.length) { const files = [...t.files]; t.value = ''; gUpload(files); }
});
