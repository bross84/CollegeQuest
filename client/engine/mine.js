// "My homework": add a real problem (typed or photographed), then get your work checked.
// The AI points at the step that went wrong and names the rule. It never hands over the answer unless asked.
// The same checker runs chapter problems (W.src === 'bank'), whose progress is kept in S.bank.
let W = { id: null, src: 'mine', chId: null, work: '', photo: null, res: null, err: '', extra: '', busy: false, ctl: null, delArmed: false };
let addDraft = { text: '', key: '' };

// The tutor's standing instructions: the pack's teaching style plus whatever the student wrote about this class.
function rules() {
  return `You are a ${PACK.tutor.role} tutor for an adult learner who benefits from short, concrete steps (ADHD-friendly), taking the course "${CLASS.name}". `
    + (CLASS.description ? `Notes about the course: ${CLASS.description} ` : '')
    + `${PACK.tutor.style} Be brief, calm and encouraging; never shame.`;
}
const fmtMath = (s) => PACK.fmt(s);
const curProblem = () => (W.src === 'bank' ? bankProblem(W.id) : S.mine.find((m) => m.id === W.id));
const photoAccept = () => (smpLimits && smpLimits.images ? smpLimits.images.mediaTypes.join(',') : '');
function mineRefresh() { if (W.id) renderWork(); else renderAdd(); }
function syncInputs() {
  const w = document.getElementById('work'), t = document.getElementById('ptext'), k = document.getElementById('pkey');
  if (w) W.work = w.value;
  if (t) addDraft.text = t.value;
  if (k) addDraft.key = k.value;
  const f = document.getElementById('ftext'); if (f) ASK.draft = f.value;
}
function mineErr(e) {
  const c = e && e.code;
  if (c === 'ai_unavailable' || c === 'not_granted') return 'The AI tutor isn’t set up on this server (no API key). Add the book’s answer to this problem for an instant right/wrong.';
  if (c === 'ai_auth') return 'The server’s AI key was rejected. Check GROQ_API_KEY / OPENROUTER_API_KEY.';
  if (c === 'rate_limited') return 'That’s a lot of checks in a row, or the AI quota is used up. Wait a bit, then try again.';
  if (c === 'image_rejected' || c === 'images_unavailable') return 'That photo didn’t work. Try a clearer one, or type your steps instead.';
  if (c === 'invalid_json' || c === 'empty_completion') return 'I couldn’t read the reply. Try again.';
  if (c === 'auth_required') return 'You were signed out. Reload the page and sign in again.';
  return 'Connection hiccup. Try again.';
}

// ---- home list ----
function mineSection() {
  const items = S.mine.slice().reverse(), open = items.filter((x) => x.status !== 'done').length;
  const row = (x) => `<button class="mine-item" data-act="m-open" data-id="${x.id}"><span class="mtext">${fmtMath(x.text)}</span>
    <span class="pill ${x.status}">${x.status === 'done' ? 'Done' : x.tries ? 'In progress' : 'To do'}</span></button>`;
  return `<section class="zone"><h3>My homework${items.length ? ` &middot; ${open} open` : ''}</h3><div class="mine">${items.map(row).join('')}
    <div class="row"><button class="btn ${items.length ? 'alt' : ''}" data-act="m-add">Add a problem</button><button class="btn alt" data-act="u-open">Upload worksheet or pages</button></div></div>
    ${items.length ? '' : '<small>Stuck on real problems? Upload your worksheet or type one, and I’ll check your work, point at the step that went wrong, and name the rule to use. I won’t hand you the answer unless you ask.</small>'}</section>`;
}

// ---- add a problem ----
function renderAdd() {
  W.id = null;
  const acc = photoAccept();
  app.innerHTML = `<div class="rbar"><button class="link" data-act="m-home">‹ Back</button></div>
  <div class="prob"><div class="eyebrow">Add a problem</div>
    <label class="field" for="ptext">The problem, exactly as written</label>
    <textarea id="ptext" rows="3" placeholder="${esc(PACK.add.example)}">${esc(addDraft.text)}</textarea>
    ${acc ? `<div class="answer"><label class="btn alt" for="pfile">Snap a photo instead</label><input type="file" id="pfile" data-for="problem" accept="${acc}" hidden></div>` : ''}
    <small>${esc(PACK.add.hint)}</small>
    <label class="field" for="pkey">Answer from the back of the book <small>(optional: gives an instant right/wrong)</small></label>
    <input class="line" id="pkey" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${esc(PACK.add.key)}" value="${esc(addDraft.key)}">
    <div class="answer"><button class="btn" data-act="m-save">Save problem</button></div><div id="mnote" role="status"></div></div>`;
  const t = document.getElementById('ptext'); if (t && !smp) t.focus();
}
async function transcribe(file) {
  const note = document.getElementById('mnote');
  syncInputs();
  note.textContent = 'Reading your photo…';
  try {
    const r = await smp(PACK.transcribe, { images: file, modelTier: 'quick', cache: false });
    addDraft.text = r.text.trim();
    document.getElementById('ptext').value = addDraft.text;
    note.textContent = 'Check that it read the problem correctly, then save.';
  } catch (e) { note.textContent = mineErr(e); }
}
function saveProblem() {
  syncInputs();
  if (!addDraft.text.trim()) { document.getElementById('mnote').textContent = 'Type or photograph the problem first.'; return; }
  const x = { id: Date.now().toString(36), text: addDraft.text.trim(), key: addDraft.key.trim(), status: 'todo', tries: 0, added: dayKey() };
  S.mine.push(x); save();
  addDraft = { text: '', key: '' };
  openProblem(x.id);
}
function openProblem(id, src, chId) {
  round = null;
  W = { id, src: src || 'mine', chId: chId || null, work: '', photo: null, res: null, err: '', extra: '', busy: false, ctl: null, delArmed: false };
  renderWork();
}

// ---- work on a problem ----
function resultHTML(x) {
  const r = W.res;
  let h = '';
  if (r && r.verdict === 'correct') {
    h += `<div class="fb good" role="status"><h3>Correct.</h3><p>${esc(r.note || 'That matches.')}</p>
      <div class="acts"><button class="btn" data-act="m-home">Back to my homework</button>${validSkill(r.skill) ? '<button class="link" data-act="m-practice">Practice this skill</button>' : ''}</div></div>`;
  } else if (r) {
    const q = r.search || ((r.procedure || 'help') + ' ' + PACK.videoWord).trim();
    h += `<div class="fb no" role="status"><h3>${r.verdict === 'incomplete' ? 'Partway there.' : 'Look at this step.'}</h3>
      ${r.where ? `<p class="where">${fmtMath(r.where)}</p>` : ''}${r.procedure ? `<p><b>Use:</b> ${esc(r.procedure)}</p>` : ''}${r.note ? `<p>${esc(r.note)}</p>` : ''}
      <div class="acts">${videosHTML(q)}
      <button class="link" data-act="m-fix" ${W.busy ? 'disabled' : ''}>Show me the fix for that step</button><button class="link" data-act="m-full" ${W.busy ? 'disabled' : ''}>Full worked solution</button></div></div>`;
  }
  if (W.err) h += `<div class="fb no" role="status"><p>${esc(W.err)}</p></div>`;
  if (W.extra) h += `<div class="fb no"><div class="explain" id="explain">${fmtMath(W.extra)}</div></div>`;
  return h;
}
const validSkill = (id) => SKILLS.some((s) => s.id === id);

function renderWork() {
  const x = curProblem();
  if (!x) return renderHome();
  const acc = photoAccept();
  const showFollow = !!smp && (!!W.askOpen || !!W.extra || (x.chat || []).length > 0);
  const bank = W.src === 'bank';
  app.innerHTML = `<div class="rbar"><button class="link" data-act="m-home">‹ Back</button></div>
  <div class="prob"><div class="eyebrow">${bank ? `Practice problem &middot; ${x.aiKey ? 'AI-made' : 'from your materials'}` : 'My homework'}${x.topic ? ' &middot; ' + esc(x.topic) : ''} &middot; ${x.status === 'done' ? 'done' : 'to do'}</div><div class="qtext">${fmtMath(x.text)}</div>
    <label class="field" for="work">Your work or answer <small>(one step per line)</small></label>
    <textarea id="work" rows="5" placeholder="Paste your steps here, or just your answer">${esc(W.work)}</textarea>
    <div class="answer"><button class="btn" data-act="m-check" ${W.busy ? 'disabled' : ''}>${W.busy ? 'Working…' : 'Check my work'}</button>
      ${acc ? `<label class="btn alt" for="pfile">${W.photo ? 'Photo added ✓' : 'Add a photo of my work'}</label><input type="file" id="pfile" data-for="work" accept="${acc}" hidden>` : ''}
      ${W.photo ? '<button class="link" data-act="m-nophoto">Remove photo</button>' : ''}${W.busy ? '<button class="link" data-act="m-stop">Stop</button>' : ''}</div>
    <div class="acts2"><small>Not sure where to start?</small><button class="link" data-act="m-start" ${W.busy ? 'disabled' : ''}>Show me the first step</button><button class="link" data-act="m-full" ${W.busy ? 'disabled' : ''}>Explain the whole thing</button>${smp && !showFollow ? '<button class="link" data-act="m-follow">Ask a question</button>' : ''}</div>
    ${resultHTML(x)}${showFollow ? followHTML() : ''}</div>
  ${inlineRefHTML(PACK.homeworkRef)}
  <div class="skiprow">${bank ? '<span></span>' : `<button class="link" data-act="m-del">${W.delArmed ? 'Really delete? Click again' : 'Delete this problem'}</button>`}
    ${x.status === 'done' ? '' : '<button class="link" data-act="m-done">I got it, mark done</button>'}</div>`;
}

function finishCorrect(x, res) {
  W.res = res;
  if (x.status !== 'done') {
    record(validSkill(res.skill) ? res.skill : validSkill(x.skill) ? x.skill : null, x.tries ? 'retry' : 'first');
    x.status = 'done'; x.doneDay = dayKey(); save();
  }
  renderWork();
}

// true / false when the last line of the work can be compared with a numeric answer key, else null.
function localMatch(keyText, work) {
  const key = parseList(keyText || '');
  if (!keyText || !key.length || key.some(Number.isNaN) || !work) return null;
  return checkAnswer({ type: 'list', answer: key }, work.split('\n').pop());
}

async function mineCheck() {
  syncInputs();
  const x = curProblem(), work = W.work.trim();
  W.err = ''; W.extra = ''; W.res = null;
  if (!work && !W.photo) { W.err = 'Write your steps or your answer first, or add a photo.'; return renderWork(); }
  const local = !x.aiKey && work && !W.photo ? localMatch(x.key, work) : null; // an AI-written key may be wrong, so it never decides alone
  if (local === true) return finishCorrect(x, { verdict: 'correct', note: 'That matches the book.', skill: null });
  if (!smp) {
    W.err = local === false ? 'That doesn’t match the book’s answer. Re-check your steps from the top.' : mineErr({ code: 'not_granted' });
    if (local === false) { x.tries++; save(); }
    return renderWork();
  }
  W.busy = true; W.ctl = new AbortController(); renderWork();
  const ctx = await classContext(x.text);
  const prompt = `${rules()}${ctx}\n\nCheck the student's work on this problem.\n\nProblem: ${x.text}\n`
    + (x.topic ? `It comes from a unit on: ${x.topic}. Use that unit's method and vocabulary.\n` : '')
    + (x.key ? (x.aiKey ? `A possible answer is: ${x.key}. It was written by an AI and may be wrong, so work the problem yourself and use it only as a hint (never reveal it).\n` : `The book's answer is: ${x.key} (use it to judge correctness, but never reveal it).\n`) : '')
    + `\nStudent's work (may be empty if a photo is attached):\n${work || '(see photo)'}\n\n`
    + 'Rules:\n- Find the FIRST step where they go wrong, if any.\n- NEVER state the corrected step, the correct value, or the final answer.\n- Name the short procedure or rule they should apply at that step.\n\n'
    + `Reply with only this JSON:\n{"verdict":"correct" | "error" | "incomplete","where":"quote the student's wrong line, or say what is missing; empty if correct","procedure":"short name of the rule to use at that step; empty if correct","search":"a YouTube search query for that procedure; empty if correct","skill":"one of ${SKILLS.map((s) => s.id).join(', ')}, or null","note":"one calm sentence with no answer in it"}`;
  try {
    const opts = { signal: W.ctl.signal }; if (W.photo) opts.images = W.photo;
    const r = await smp.json(prompt, opts);
    if (!r || !['correct', 'error', 'incomplete'].includes(r.verdict)) throw { code: 'invalid_json' };
    W.busy = false;
    if (r.verdict === 'correct') return finishCorrect(x, r);
    x.tries++; save(); W.res = r; renderWork();
  } catch (e) {
    W.busy = false;
    if (e && e.code !== 'cancelled') W.err = mineErr(e);
    renderWork();
  }
}

async function mineExplain(mode) {
  syncInputs();
  const x = curProblem();
  W.busy = true; W.extra = 'Thinking…'; W.ctl = new AbortController(); renderWork();
  const ask = {
    fix: 'ONLY the corrected version of the first wrong step, with one line on why. Do not solve the rest.',
    start: 'ONLY the first step: what to do first and which rule applies, in two sentences. Do not do any later steps or give the answer.',
    full: 'a full worked solution: one short numbered step per line, naming the rule used at each step.',
  }[mode];
  const ctx = await classContext(x.text);
  const prompt = `${rules()}${ctx}\n\nProblem: ${x.text}\nStudent's work:\n${W.work || (W.photo ? '(see photo)' : '(nothing yet, the student is starting from scratch)')}\n\nThe student is explicitly asking for ${ask} Plain text only; use ^ for exponents.`;
  try {
    const opts = { signal: W.ctl.signal, onText: ({ text }) => { const el = document.getElementById('explain'); if (el) el.innerHTML = fmtMath(text); } };
    if (W.photo) opts.images = W.photo;
    const r = await smp(prompt, opts);
    W.extra = r.text;
  } catch (e) {
    W.extra = '';
    if (e && e.code !== 'cancelled') W.err = mineErr(e);
  }
  W.busy = false; renderWork();
}

function mineAct(act, t) {
  syncInputs();
  if (act !== 'm-del') W.delArmed = false;
  if (act === 'm-add') { addDraft = { text: '', key: '' }; renderAdd(); }
  else if (act === 'm-home') { if (W.ctl) W.ctl.abort(); W.id = null; renderHome(); }
  else if (act === 'm-open') openProblem(t.dataset.id);
  else if (act === 'm-save') saveProblem();
  else if (act === 'm-follow') { W.askOpen = !W.askOpen; renderWork(); const f = document.getElementById('ftext'); if (f) f.focus(); }
  else if (act === 'm-check') mineCheck();
  else if (act === 'm-stop') { if (W.ctl) W.ctl.abort(); }
  else if (act === 'm-fix' || act === 'm-full' || act === 'm-start') { if (!smp) { W.err = mineErr({ code: 'not_granted' }); renderWork(); } else mineExplain({ 'm-fix': 'fix', 'm-full': 'full', 'm-start': 'start' }[act]); }
  else if (act === 'm-nophoto') { W.photo = null; renderWork(); }
  else if (act === 'm-practice') { const id = W.res && W.res.skill; if (validSkill(id)) startRound(Array(5).fill(id), 'skill', id); }
  else if (act === 'm-done') {
    const x = curProblem();
    record(null, 'retry');
    x.status = 'done'; x.doneDay = dayKey(); save(); W.res = { verdict: 'correct', note: 'Marked done.', skill: null }; renderWork();
  } else if (act === 'm-del') {
    if (!W.delArmed) { W.delArmed = true; return renderWork(); }
    S.mine = S.mine.filter((m) => m.id !== W.id); save(); W.id = null; renderHome();
  }
}
app.addEventListener('change', (e) => {
  const t = e.target;
  if (t.id !== 'pfile' || !t.files || !t.files[0]) return;
  if (t.dataset.for === 'problem') transcribe(t.files[0]);
  else { syncInputs(); W.photo = t.files[0]; renderWork(); }
});
