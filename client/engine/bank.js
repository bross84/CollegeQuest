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
async function loadProblems(chId) {
  PROBS[chId] = await api('GET', `/api/chapters/${chId}/problems`);
  return PROBS[chId];
}
// Load a chapter's problems the first time its Practice tab is shown, then redraw that tab.
function ensureProblems(chId) {
  if (PROBS[chId] || BK.loading === chId) return;
  BK.loading = chId;
  loadProblems(chId).catch(() => { PROBS[chId] = []; }).then(() => { BK.loading = null; paintBank(chId); });
}
const onPractice = (chId) => ROUTE && ROUTE.view === 'chapter' && ROUTE.tab === 'practice' && ROUTE.realId === chId;
const paintBank = (chId) => { if (onPractice(chId)) renderRoute(true); };

// ---- the Practice tab ----
function practiceTab(ch) {
  const gs = GUIDES.filter((g) => inChapter(g, ch.id)), cards = gs.reduce((n, g) => n + g.cards.length, 0), due = chapterDue(ch.id);
  const recall = `<section class="zone"><h3>Recall questions</h3>${cards
    ? `<div class="mine"><div class="row"><button class="btn" data-act="g-quiz" data-ch="${ch.id}">${due ? `Quiz me (${plural(due, 'question')} due)` : 'Quiz me'}</button></div></div>
      <small>${plural(cards, 'question')} from this chapter’s study guide, brought back on a spaced schedule.</small>`
    : `<small>Make a study guide on the <a href="${chHash(ch.id, 'guide')}">Guide tab</a> to get recall questions.</small>`}</section>`;
  if (ch.unsorted) return `${recall}<section class="zone"><h3>Problems</h3><small>Move materials into a chapter to build a problem bank from them.</small></section>`;
  ensureProblems(ch.id);
  const list = PROBS[ch.id];
  if (!list) return `${recall}<section class="zone"><h3>Problems</h3><small>Loading…</small></section>`;
  const originals = list.filter((p) => p.kind === 'original'), made = list.length - originals.length;
  const bankable = DOCS.filter((d) => d.chapterId === ch.id && d.chars && (d.tag === 'exam' || d.tag === 'textbook'));
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
  return `${recall}
  <section class="zone"><h3>Problems${list.length ? ` &middot; ${originals.length} from your materials${made ? `, ${made} AI-made` : ''}` : ''}</h3>
    <div class="row2">
      ${bankable.length ? `<button class="btn ${list.length ? 'alt' : ''}" data-act="b-build" ${off}>Build problem bank</button>` : ''}
      ${originals.length && smp ? `<button class="btn alt" data-act="b-similar-all" ${off}>Make similar problems</button>` : ''}
      ${BK.busy ? '<button class="link" data-act="b-stop">Stop</button>' : ''}</div>
    ${BK.busy ? `<div class="fb" role="status"><p>${esc(BK.note)}</p></div>` : ''}${BK.err ? `<div class="fb no" role="status"><p>${esc(BK.err)}</p></div>` : ''}${BK.msg ? `<div class="fb good" role="status"><p>${esc(BK.msg)}</p></div>` : ''}
    ${list.length ? `<div class="mine plist">${list.map(row).join('')}</div>${made ? '<small>AI-made problems come with an answer the AI worked out, which can be wrong. The checker treats it as a hint, not a verdict.</small>' : ''}${exam}`
      : `<div class="empty"><p>No problems yet.</p>${bankable.length ? '<small>Use “Build problem bank” to pull the problems out of your practice exams and textbook pages.</small>'
        : `<small>Mark an upload as a <b>Practice exam</b> or <b>Textbook</b> on the <a href="${chHash(ch.id, 'materials')}">Materials tab</a>, then build the bank from it.</small>`}</div>`}
  </section>`;
}

// ---- building ----
function bankBegin(chId) {
  BK.busy = true; BK.err = ''; BK.msg = ''; BK.ctl = new AbortController(); BK.note = 'Starting…';
  if (!onPractice(chId)) go(chHash(chId, 'practice')); else paintBank(chId);
}
function bankEnd(chId, msg, e) {
  BK.busy = false; BK.msg = msg || ''; BK.err = e && e.code !== 'cancelled' ? mineErr(e) : '';
  loadChapters().then(() => paintBank(chId));
  paintBank(chId);
}
const bankWait = (chId, what) => (s) => { BK.note = `Waiting for the AI quota (${s}s)…`; paintBank(chId); };

async function bankBuild(docs, chId) {
  if (BK.busy) return;
  if (!smp) { BK.err = 'Building a problem bank needs the AI, which isn’t set up on this server.'; return go(chHash(chId, 'practice')); }
  if (docs.some((d) => d.kind === 'image') && !(smpLimits && smpLimits.images)) { BK.err = 'Reading photos needs a vision model. Upload a PDF or text version instead.'; return go(chHash(chId, 'practice')); }
  bankBegin(chId);
  if (!PROBS[chId]) await loadProblems(chId).catch(() => { PROBS[chId] = []; });
  const seen = new Set(PROBS[chId].map((p) => normText(p.text)));
  let added = 0, cut = false;
  try {
    for (const d of docs) {
      const parts = await docParts([d]);
      cut = cut || parts.length > MAX_PARTS;
      const found = [];
      let topic = '';
      for (let i = 0; i < Math.min(parts.length, MAX_PARTS) && found.length < 60; i++) {
        BK.note = `Reading ${d.name}${parts.length > 1 ? ` (part ${i + 1} of ${Math.min(parts.length, MAX_PARTS)})` : ''}…`; paintBank(chId);
        const r = await aiJson(findPrompt(parts[i], { skillHint: '"skill":null', withAnswers: true, source: d.tag === 'exam' ? 'a past practice exam' : 'textbook pages' }), BK.ctl, bankWait(chId), 3000);
        topic = topic || String((r && r.topic) || '').slice(0, 80);
        (Array.isArray(r && r.problems) ? r.problems : []).forEach((p) => {
          const text = String((p && p.text) || '').trim(), k = normText(text);
          if (text && !seen.has(k)) { seen.add(k); found.push({ kind: 'original', text, answer: String((p && p.answer) || '').trim().slice(0, 500), topic, sourceDoc: d.id }); }
        });
      }
      if (found.length) { await api('POST', `/api/chapters/${chId}/problems`, { problems: found.slice(0, 60) }); added += Math.min(found.length, 60); }
    }
    await loadProblems(chId);
    bankEnd(chId, added ? `Added ${plural(added, 'problem')} to the bank.${cut ? ' That was a lot of material, so only the first parts were read. Run it again for the rest.' : ''}` : 'I couldn’t find any new problems in that.');
  } catch (e) { await loadProblems(chId).catch(() => {}); bankEnd(chId, added ? `Added ${plural(added, 'problem')} before it stopped.` : '', e); }
}

// n new problems like each original: same type and difficulty, different numbers or wording.
async function bankSimilar(origs, n, chId) {
  if (BK.busy || !smp) return;
  bankBegin(chId);
  let added = 0;
  const seen = new Set((PROBS[chId] || []).map((p) => normText(p.text))); // never save a problem the bank already has
  try {
    for (let i = 0; i < origs.length; i++) {
      const p = origs[i];
      BK.note = origs.length > 1 ? `Writing similar problems… (${i + 1} of ${origs.length})` : 'Writing similar problems…'; paintBank(chId);
      const ctx = await classContext(p.text, chId);
      const prompt = `${rules()}${ctx}\n\nWrite ${n} NEW practice problems like the one below: the same type of problem and the same difficulty, but with different numbers, names or wording. Do not copy the original.\n\n`
        + `Original problem:\n${p.text}\n${p.answer ? `Its answer: ${p.answer}\n` : ''}\nWork each new problem out carefully before you write its answer, and double-check it. Plain text only (${PACK.finder}).\n\n`
        + 'Reply with only this JSON:\n{"problems":[{"text":"the new problem","answer":"the final answer","steps":["one short step","one short step"]}]}';
      const r = await aiJson(prompt, BK.ctl, bankWait(chId), 3000);
      const made = (Array.isArray(r && r.problems) ? r.problems : []).slice(0, n).map((q) => ({
        kind: 'similar', text: String((q && q.text) || '').trim(), answer: String((q && q.answer) || '').trim(),
        steps: (Array.isArray(q && q.steps) ? q.steps : []).map((x) => String(x)), topic: p.topic, sourceDoc: p.sourceDoc,
      })).filter((q) => q.text && !seen.has(normText(q.text)) && seen.add(normText(q.text)));
      if (made.length) { await api('POST', `/api/chapters/${chId}/problems`, { problems: made }); added += made.length; }
    }
    await loadProblems(chId);
    bankEnd(chId, added ? `Added ${plural(added, 'AI-made problem')}.` : 'The AI didn’t write anything usable. Try again.');
  } catch (e) { await loadProblems(chId).catch(() => {}); bankEnd(chId, added ? `Added ${plural(added, 'AI-made problem')} before it stopped.` : '', e); }
}

async function bankAct(act, t) {
  const id = t.dataset && t.dataset.id, chId = (ROUTE && ROUTE.realId) || t.dataset.ch;
  if (act !== 'b-del') BK.delId = null;
  if (act === 'b-open') return openProblem(id, 'bank', t.dataset.ch);
  if (act === 'b-build') {
    const docs = id ? DOCS.filter((d) => d.id === id) : DOCS.filter((d) => d.chapterId === chId && d.chars && (d.tag === 'exam' || d.tag === 'textbook'));
    return bankBuild(docs, id ? (docs[0] || {}).chapterId : chId);
  }
  if (act === 'b-similar') { const p = (PROBS[chId] || []).find((x) => x.id === id); return p && bankSimilar([p], 3, chId); }
  if (act === 'b-similar-all') return bankSimilar((PROBS[chId] || []).filter((p) => p.kind === 'original').slice(0, 10), 2, chId);
  if (act === 'b-stop') { if (BK.ctl) BK.ctl.abort(); return; }
  if (act === 'b-del') {
    if (BK.delId !== id) { BK.delId = id; return renderRoute(true); }
    try { await api('DELETE', `/api/problems/${id}`); PROBS[chId] = (PROBS[chId] || []).filter((p) => p.id !== id); delete (S.bank || {})[id]; await loadChapters(); } catch (e) { BK.err = e.message; }
    BK.delId = null; return renderRoute(true);
  }
  if (act === 'b-exam') return exStart(t.dataset.ch);
  if (act === 'b-exsubmit') return exSubmit();
  if (act === 'b-exleave') { exitExam(); return renderHome(); }
  if (act === 'b-exopen') { const x = EX.items[+t.dataset.i], work = EX.answers[+t.dataset.i], ch = EX.chId; exitExam(); openProblem(x.id, 'bank', ch); W.work = work; return renderWork(); }
}

// ---- practice exam: a timed set from the chapter's originals and AI-made problems ----
function exitExam() { if (EX) { clearInterval(EX.timer); EX = null; } }
function exStart(chId) {
  const list = PROBS[chId] || [];
  const n = Math.min(+(document.getElementById('exn') || {}).value || 10, list.length), min = +(document.getElementById('ext') || {}).value || 30;
  if (n < 1) return;
  const items = shuffle(list).slice(0, n);
  round = null; Q = null; W.id = null; closeRef();
  EX = { chId, items, answers: items.map(() => ''), endsAt: Date.now() + min * 60000, done: false, timer: setInterval(exTick, 1000) };
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
function renderExam() {
  const ch = chapterById(EX.chId);
  if (!EX.done) {
    app.innerHTML = `<div class="rbar"><button class="link" data-act="b-exleave">‹ Leave exam</button><span class="progress" id="extime">${clock(EX.endsAt - Date.now())} left</span></div>
    <div class="prob"><div class="eyebrow">Practice exam${ch ? ' &middot; ' + esc(ch.title) : ''}</div>
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
      : r === false ? `<div class="fb no"><p><b>Doesn’t match the key.</b> The key says: <b>${esc(p.answer)}</b>${p.kind === 'similar' ? ' (written by the AI, so double-check it)' : ''}</p></div>`
      : p.answer ? `<div class="fb"><p>${mine ? '' : 'Left blank. '}The key says: <b>${esc(p.answer)}</b>${p.kind === 'similar' ? ' (written by the AI, so double-check it)' : ''}${mine ? '. Compare it with your work.' : '.'}</p></div>`
      : '<div class="fb"><p>No answer key for this one.</p></div>';
    return `<div class="prob exq"><div class="eyebrow">Question ${i + 1}${p.kind === 'similar' ? ' &middot; AI-made' : ''}</div><div class="qtext">${fmtMath(p.text)}</div>
      <div class="where">${mine ? esc(mine) : '(left blank)'}</div>${verdict}
      ${p.steps && p.steps.length ? `<details class="paste"><summary>Worked steps</summary><ol class="steps">${p.steps.map((s) => `<li>${fmtMath(s)}</li>`).join('')}</ol></details>` : ''}
      <div class="acts"><button class="btn alt sm" data-act="b-exopen" data-i="${i}">Check my work with the tutor</button>${videosHTML(`${p.topic || ''} ${PACK.videoWord}`.trim() || CLASS.name, true)}</div></div>`;
  }).join('')}`;
  window.scrollTo(0, 0);
}
app.addEventListener('input', (e) => { const t = e.target; if (EX && !EX.done && t.dataset && t.dataset.exa !== undefined) EX.answers[+t.dataset.exa] = t.value; });
