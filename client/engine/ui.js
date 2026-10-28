// Rendering and interaction. Screens: home (map), round, summary.
const app = document.getElementById('app');
const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
// How well a skill is going: three segments and a word.
const masteryHTML = (id) => {
  const n = stars(id), started = S.skills[id] && S.skills[id].seen;
  return `<span class="mastery"><span class="meter m${started ? n + 1 : 0}" aria-hidden="true"><i></i><i></i><i></i><i></i></span>${started ? MASTERY[n] : 'Not started'}</span>`;
};
let round = null, resetArmed = false;
// A reference (periodic table, ion list) kept open under the problem. Stays collapsed once you collapse it.
let refOpen = true;
function inlineRefHTML(key) {
  const r = key && PACK.refs.find((x) => x.k === key);
  return r ? `<details class="inlineref" ${refOpen ? 'open' : ''}><summary>${r.label}</summary><div class="inlinebody">${r.html()}</div></details>` : '';
}
app.addEventListener('toggle', (e) => { if (e.target.classList && e.target.classList.contains('inlineref')) refOpen = e.target.open; }, true);
app.addEventListener('mouseover', (e) => { if (PACK && PACK.refHover) PACK.refHover(e); });

function renderHome() {
  round = null;
  if (!SKILLS.length) return renderHomeLite();
  const done = setDoneToday(), nx = nextUp();
  const zones = activeZones();
  const chZones = chapterZones(), baseZones = zones.filter((z) => !chZones.includes(z));
  const hw = focusSkills();
  const tile = (s) => {
    const tag = s.id === nx ? '<span class="tag next">Next</span>' : hw.has(s.id) ? '<span class="tag">Homework</span>' : isRusty(s.id) ? '<span class="tag">Review</span>' : '';
    return `<button class="tile ${s.id === nx ? 'next' : ''}" data-act="skill" data-id="${s.id}"><span class="nm">${s.name}</span><span class="meta">${masteryHTML(s.id)}${tag}</span></button>`;
  };
  const zoneHTML = (z, toggle) => {
    const on = S.sections.includes(z);
    return `<section class="zone"><h3>${z}${toggle ? `<button class="link sec ${on ? 'on' : ''}" data-act="sec" data-i="${zones.indexOf(z)}" aria-pressed="${on}">${on ? 'Current section ✓' : 'Mark as current'}</button>` : ''}</h3><div class="tiles">${SKILLS.filter((s) => s.zone === z).map(tile).join('')}</div></section>`;
  };
  app.innerHTML = `
  <div class="top">${brandHTML()}</div>
  ${standingHTML()}
  ${examHTML()}
  <section class="practice">
    <h2>${done ? 'Practice set done for today' : 'Today’s practice'}</h2>
    <p>${done ? 'Another set is optional.' : `Five problems from ${S.sections.length ? 'the sections you marked as current' : `all of ${coreName()} (mark current sections below to narrow it)`}${baseZones.length ? ', with a couple of earlier-material problems mixed in' : ''}. You can stop at any point.`}</p>
    <div class="actions"><button class="btn" data-act="practice">${done ? 'Another set' : 'Start practice set'}</button><button class="link" data-act="one">One problem only</button></div>
  </section>
  ${todayHTML()}
  ${coachHTML()}
  ${refHTML()}
  ${mineSection()}
  ${docsSection()}
  <h2 class="part">${esc(partTitle())}</h2>
  ${chZones.map((z) => zoneHTML(z, true)).join('')}
  ${baseZones.length ? `<h2 class="part">${esc(PACK.baseTitle || 'Earlier material')}</h2>` : ''}
  ${baseZones.map((z) => zoneHTML(z, false)).join('')}
  <div class="foot"><small><span id="syncnote">${syncNote()}</span> ${S.total} problems answered, ${S.right} right on the first try.</small>
    <span><button class="link" data-act="c-edit" data-id="${CLASS.id}">Class settings</button> <button class="link" data-act="reset">${resetArmed ? 'Really erase all progress? Click again' : 'Reset progress'}</button></span></div>`;
  window.scrollTo(0, 0);
}

// Reference screens: the polyatomic ion table and atomic masses, like the periodic table you get on the exam.
const refHTML = () => {
  const btns = [...PACK.refs.map((r) => `<button class="btn alt sm" data-act="ref" data-k="${r.k}">${r.label}</button>`),
    '<button class="btn alt sm" data-act="ref" data-k="ask">Ask a question</button>',
    PACK.hasChoiceMode ? `<button class="btn alt sm" data-act="style">${S.style === 'type' ? 'Answers: typed. Tap for multiple choice' : 'Answers: multiple choice. Tap to type'}</button>` : ''];
  return `<section class="zone"><h3>Reference</h3><div class="row2">${btns.join('')}</div></section>`;
};
const roundRefs = () => [...PACK.refs.map((r) => `<button class="link" data-act="ref" data-k="${r.k}">${r.label}</button>`), '<button class="link" data-act="ref" data-k="ask">Ask</button>'].join('');
const coreName = () => (CLASS.examLabel ? CLASS.examLabel + ' material' : PACK.coreName);
const partTitle = () => (CLASS.examLabel ? CLASS.examLabel + (CLASS.examDate ? ' · ' + fmtDate(CLASS.examDate) : '') : PACK.coreTitle);
const fmtDate = (d) => new Date(d + 'T00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const brandHTML = () => `<div class="brandbox"><button class="link" data-act="c-classes">‹ Classes</button><div class="brand">${esc(CLASS.name)}</div></div>`;
// Rank, progress and streak: one quiet line and a thin bar.
function standingHTML() {
  const pct = progressPct(), st = liveStreak();
  return `<div class="standing"><div class="srow"><span class="rank">${esc(rankName())}</span>
    <span class="smeta">Progress ${pct}%${st ? ` &middot; <span title="A day counts when you answer a problem. One missed day is forgiven.">${plural(st, 'day')} in a row</span>` : ''}</span></div>
    <div class="bar" role="progressbar" aria-label="Overall progress" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div></div>`;
}
function examHTML() {
  const dte = daysToExam(), ready = SKILLS.some(isChapter);
  if (dte === null && !ready) return '';
  const label = CLASS.examLabel || 'the exam';
  const left = dte === null ? '<span></span>' : `<span><b>${dte > 0 ? dte + (dte === 1 ? ' day' : ' days') : dte === 0 ? 'Today' : 'Done'}</b> ${dte >= 0 ? 'to ' + esc(label) + (CLASS.examDate ? ' (' + fmtDate(CLASS.examDate) + ')' : '') : esc(label) + ' has passed'}</span>`;
  return `<div class="exam">${left}${ready ? `<span>Readiness <b>${readiness()}%</b></span>` : ''}</div>`;
}
// A class with no practice skills: homework, the tutor and documents.
function renderHomeLite() {
  app.innerHTML = `
  <div class="top">${brandHTML()}</div>
  ${standingHTML()}
  ${examHTML()}
  ${refHTML()}
  ${mineSection()}
  ${docsSection()}
  <div class="foot"><small><span id="syncnote">${syncNote()}</span> ${S.total} problems answered.</small>
    <span><button class="link" data-act="c-edit" data-id="${CLASS.id}">Class settings</button> <button class="link" data-act="reset">${resetArmed ? 'Really erase all progress? Click again' : 'Reset progress'}</button></span></div>`;
  window.scrollTo(0, 0);
}

// Today's plan: the blocks the first practice set set up for the rest of your session.
const blockLabel = (b) => (b.kind === 'hw' ? 'Work on your homework' : SKILLS.find((s) => s.id === b.id).name);
const planRows = (p, buttons) => `<ol class="blocks">${p.blocks.map((b, i) => {
  const d = blockDone(b);
  return `<li class="${d ? 'done' : ''}"><span><b>${blockLabel(b)}</b> <small>${d ? 'done' : '~10 min'} &middot; ${b.why}</small></span>${buttons && !d ? `<button class="link" data-act="tplan" data-i="${i}">Start</button>` : ''}</li>`;
}).join('')}</ol>`;
function todayHTML() {
  if (!S.today || S.today.day !== dayKey() || !S.today.blocks.length) return '';
  const left = S.today.blocks.filter((b) => !blockDone(b)).length;
  return `<section class="today" aria-label="Today’s plan"><h3>Suggested plan for today</h3>${planRows(S.today, true)}
    <small>${left ? `${left} of ${S.today.blocks.length} blocks left. You can stop at any point.` : 'Plan complete.'}</small></section>`;
}
// "Where you are": observations from your history, each with an optional one-tap action.
let lastCoach = [], planBusy = false;
function coachHTML() {
  lastCoach = coach();
  if (!lastCoach.length) return '';
  const claude = typeof smp !== 'undefined' && smp;
  return `<section class="coach" aria-label="Where you are"><h3>Where you are</h3>
    <ul>${lastCoach.map((c, i) => `<li><span>${c.text}</span>${c.act ? `<button class="link" data-act="coach" data-i="${i}">${c.label}</button>` : ''}</li>`).join('')}</ul>
    ${claude ? '<div class="acts2"><button class="link" data-act="plan">Ask the AI for a plan</button></div><div class="plan" id="plan" role="status"></div>' : ''}</section>`;
}
function coachAct(c) {
  if (c.act === 'one') startMixed(1);
  else if (c.act === 'skill') startRound(Array(5).fill(c.id), 'skill', c.id);
  else if (c.act === 'advance') { S.sections = [...S.sections.filter((z) => z !== c.from), c.to]; save(); renderHome(); }
}
// Sends your progress summary to the AI and shows a short plan. Uses your AI quota, only when you tap.
async function askPlan() {
  const el = document.getElementById('plan');
  if (!el || planBusy || typeof smp === 'undefined' || !smp) return;
  const zs = chapterZones(), marked = zs.filter((z) => S.sections.includes(z));
  const rows = SKILLS.filter((s) => S.skills[s.id] && S.skills[s.id].seen).map((s) => {
    const r = recent(s.id);
    return `${s.zone} | ${s.name}: mastery ${MASTERY[stars(s.id)].toLowerCase()}, ${firstTry(r)} of ${r.length} right first try lately${isRusty(s.id) ? ', rusty' : ''}`;
  });
  const untried = SKILLS.filter((s) => marked.includes(s.zone) && !(S.skills[s.id] && S.skills[s.id].seen)).map((s) => s.name);
  const prompt = `${rules()}\n\nWrite a short coaching note for the student's next study session.\n\nSections they are studying now: ${marked.join('; ') || 'none marked'}.\n`
    + `Problems answered: ${S.total}.\nSkills practiced so far:\n${rows.join('\n') || '(none yet)'}\nNot yet tried in their sections: ${untried.join(', ') || 'nothing'}.\n\n`
    + 'Give at most 3 short bullets: what to do next today, the one thing most worth fixing, and whether they look ready to move to the next section. Use the skill names above. No pep talk. Plain text.';
  planBusy = true; el.textContent = 'Thinking…';
  try { const r = await smp(prompt, { modelTier: 'quick', cache: false, onText: ({ text }) => { el.textContent = text; } }); el.textContent = r.text; }
  catch (e) { el.textContent = mineErr(e); }
  planBusy = false;
}

function startRound(ids, mode, skillId) {
  W.id = null;
  round = { ids, mode, skillId, n: ids.length, i: 0, results: [] };
  nextProblem();
}
const startMixed = (n) => startRound(pickMixed(n), 'set', null);
function nextProblem() {
  round.skill = SKILLS.find((s) => s.id === round.ids[round.i]);
  round.p = freshProblem(round.skill);
  round.tries = 0; round.askOpen = false; round.state = 'ask'; round.wrong = []; round.fb = null; round.typed = '';
  renderRound();
}

function renderRound() {
  const { p, skill, state } = round;
  const locked = state === 'right' || state === 'shown';
  let input;
  if (p.type === 'choice') {
    input = `<div class="choices ${p.choices.some((c) => plain(c).length > 34) ? 'wide' : ''}">${p.choices.map((c, i) => `<button class="choice ${locked && i === p.answer ? 'right' : ''}" data-act="pick" data-c="${i}" ${locked || round.wrong.includes(i) ? 'disabled' : ''}>${c}</button>`).join('')}</div>`;
  } else {
    input = `<form class="answer" id="af" autocomplete="off"><input id="ans" type="text" inputmode="text" enterkeyhint="done" autocapitalize="off" spellcheck="false"
      aria-label="Your answer" value="${esc(round.typed)}" ${locked ? 'disabled' : ''} placeholder="${(PACK.ph || {})[p.type] || 'your answer'}">
      ${locked ? '' : '<button class="btn" type="submit">Check</button>'}</form>`;
  }
  const last = round.i === round.n - 1;
  const help = state === 'ask' || state === 'bad'
    ? '<div class="help"><button class="btn alt sm" data-act="show">I don’t know this one. Explain it</button></div>' : '';
  let fb = '';
  if (state === 'bad') fb = `<div class="fb no" role="status"><p>${PACK.badInput}</p></div>`;
  if (state === 'no') fb = `<div class="fb no" role="status"><h3>Not yet.</h3><p><b>Use:</b> ${skill.rule}</p><p>${skill.tip}</p>
    <div class="acts"><button class="btn" data-act="retry">Try again</button><button class="link" data-act="show">Show me the steps</button><button class="link" data-act="follow">${round.askOpen ? 'Hide follow-up' : 'Ask a follow-up'}</button>
    <a class="link" target="_blank" rel="noopener" href="https://www.youtube.com/results?search_query=${encodeURIComponent(skill.video)}">Find a video on this</a></div></div>`;
  if (state === 'right') {
    const f = round.fb;
    fb = `<div class="fb good" role="status"><h3>${f.kind === 'retry' ? 'Correct on the retry.' : 'Correct.'}</h3>
      <div class="acts"><button class="btn" id="nextbtn" data-act="next">${last ? 'Finish' : 'Next'}</button><button class="link" data-act="follow">${round.askOpen ? 'Hide follow-up' : 'Ask a follow-up'}</button></div></div>`;
  }
  if (state === 'shown') {
    fb = `<div class="fb no" role="status"><h3>Here’s how it goes.</h3><p><b>Use:</b> ${skill.rule}</p><ol class="steps">${p.steps.map((x) => `<li>${x}</li>`).join('')}</ol>
      <p>Answer: <b>${answerText(p)}</b>. This skill will come back in later practice.</p>
      <div class="acts"><button class="btn" data-act="similar">Try a similar one</button><button class="btn alt" id="nextbtn" data-act="next">${last ? 'Finish' : 'Next'}</button>
        <a class="link" target="_blank" rel="noopener" href="https://www.youtube.com/results?search_query=${encodeURIComponent(skill.video)}">Find a video on this</a></div></div>`;
  }
  app.innerHTML = `
  <div class="rbar"><button class="link" data-act="home">‹ End session</button>${roundRefs()}<span class="progress">Problem ${round.i + 1} of ${round.n}</span></div>
  <div class="prob"><div class="eyebrow">${skill.name}</div><div class="qtext ${plain(p.q).length > 60 && p.q.indexOf('→') >= 0 ? 'eq' : ''}">${p.q}</div>${input}${help}${fb}${round.askOpen && state !== 'ask' && state !== 'bad' ? followHTML() : ''}</div>
  ${inlineRefHTML(PACK.inlineRef && PACK.inlineRef(skill.id))}
  ${locked ? '' : '<div class="skiprow"><button class="link" data-act="skip">Skip this one</button><small>Ending the session keeps your progress.</small></div>'}`;
  const nb = document.getElementById('nextbtn'), inp = document.getElementById('ans');
  if (nb) nb.focus(); else if (inp && !inp.disabled) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
}

function submit(raw) {
  const p = round.p, ok = checkAnswer(p, raw);
  if (p.type !== 'choice') round.typed = raw;
  if (ok === null) { round.state = 'bad'; round.typed = raw; return renderRound(); }
  if (!ok) {
    round.tries++; round.state = 'no'; round.typed = raw;
    if (p.type === 'choice') round.wrong.push(raw);
    return renderRound();
  }
  const kind = round.tries === 0 ? 'first' : 'retry';
  record(round.skill.id, kind);
  round.results[round.i] = kind;
  round.fb = { kind };
  round.state = 'right';
  renderRound();
}
function showSteps() {
  record(round.skill.id, 'miss');
  round.results[round.i] = 'miss';
  round.fb = {};
  round.state = 'shown'; round.askOpen = true;
  renderRound();
}
// After reading the steps: a fresh problem of the same skill in the same slot. A correct answer counts as a retry.
function similar() {
  round.p = freshProblem(round.skill); round.tries = 1; round.askOpen = false; round.state = 'ask'; round.wrong = []; round.fb = null; round.typed = '';
  renderRound();
}
function advance() {
  round.i++;
  if (round.i >= round.n) return renderSummary();
  nextProblem();
}

function renderSummary() {
  const res = round.results, firsts = res.filter((r) => r === 'first').length;
  const firstOfDay = finishSet(round);
  if (firstOfDay) { S.today = planFromSet(round); save(); }
  else if (round.mode === 'skill' && S.today && S.today.day === dayKey() && !S.today.done.includes(round.skillId) && S.today.blocks.some((b) => b.kind === 'skill' && b.id === round.skillId)) { S.today.done.push(round.skillId); save(); }
  const plan = firstOfDay && S.today.blocks.length ? S.today : null;
  const missed = [...new Set(round.ids.filter((id, i) => res[i] === 'miss'))].map((id) => SKILLS.find((s) => s.id === id).name);
  app.innerHTML = `<div class="sum"><h1>Session complete</h1>
    <div class="big">${firsts} of ${round.n}</div><small>correct on the first try</small>
    ${missed.length ? `<p class="lines">To review: ${missed.join(', ')}. These will come back in later practice.</p>` : ''}
    ${plan ? `<div class="sum-plan"><h3>Suggested next steps</h3>${planRows(plan, false)}</div>` : ''}
    <div class="acts">${plan
      ? `<button class="btn" data-act="tplan" data-i="0" id="nextbtn">Start: ${blockLabel(plan.blocks[0])}</button><button class="link" data-act="home">Back to the course</button>`
      : `<button class="btn" data-act="again" id="nextbtn">${round.skillId ? 'Another round' : 'Another set'}</button><button class="link" data-act="home">Back to the course</button>`}</div></div>`;
  document.getElementById('nextbtn').focus();
}

app.addEventListener('click', (e) => {
  const t = e.target.closest('[data-act]');
  if (!t) return;
  const act = t.dataset.act;
  if (act !== 'reset' && resetArmed) resetArmed = false;
  if (act === 'follow') { round.askOpen = !round.askOpen; renderRound(); const f = document.getElementById('ftext'); if (round.askOpen && f) f.focus(); return; }
  if (act === 'ref') return openRef(t.dataset.k);
  if (act === 'style') { const y = window.scrollY; S.style = S.style === 'type' ? 'choice' : 'type'; save(); renderHome(); window.scrollTo(0, y); return; }
  if (act === 'tplan') {
    const b = S.today && S.today.blocks[+t.dataset.i];
    if (!b) return;
    if (b.kind === 'skill') return startRound(Array(8).fill(b.id), 'skill', b.id);
    const hw = S.mine.find((m) => m.status !== 'done');
    return hw ? openProblem(hw.id) : renderHome();
  }
  if (act === 'coach') return coachAct(lastCoach[+t.dataset.i]);
  if (act === 'plan') return askPlan();
  if (act === 'sec') {
    const z = activeZones()[+t.dataset.i], y = window.scrollY;
    S.sections = S.sections.includes(z) ? S.sections.filter((x) => x !== z) : [...S.sections, z];
    save(); renderHome(); window.scrollTo(0, y); return;
  }
  if (act.startsWith('s-')) return settingsAct(act, t);
  if (act.startsWith('c-')) return classAct(act, t);
  if (act.startsWith('d-')) return docAct(act, t);
  if (act.startsWith('m-')) return mineAct(act, t);
  if (act.startsWith('u-')) return uAct(act, t);
  if (act === 'practice') startMixed(5);
  else if (act === 'one') startMixed(1);
  else if (act === 'skill') startRound(Array(5).fill(t.dataset.id), 'skill', t.dataset.id);
  else if (act === 'home') renderHome();
  else if (act === 'pick') submit(+t.dataset.c);
  else if (act === 'retry') { round.state = 'ask'; renderRound(); }
  else if (act === 'show') showSteps();
  else if (act === 'similar') similar();
  else if (act === 'skip') { round.results[round.i] = 'skip'; advance(); }
  else if (act === 'next') advance();
  else if (act === 'again') round.skillId ? startRound(Array(5).fill(round.skillId), 'skill', round.skillId) : startMixed(5);
  else if (act === 'reset') {
    if (!resetArmed) { resetArmed = true; return renderHome(); }
    resetArmed = false; S = fresh(); save(); renderHome();
  }
});
app.addEventListener('submit', (e) => {
  e.preventDefault();
  if (e.target.dataset.form) return formSubmit(e.target);
  if (e.target.id === 'ff') { askSend(); return; }
  const v = document.getElementById('ans').value;
  if (v.trim()) submit(v);
});

