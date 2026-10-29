// "Ask a question": a small chat in the reference overlay. It knows the problem you are on (if any), so you can ask
// "why is it 2 and not 3?" without leaving the round. Uses the AI only when you press Ask.
const ASK = { turns: [], busy: false, ctl: null, key: '', live: '', draft: '' };
const plain = (h) => String(h).replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const CHIPS = [
  ['Explain it simpler', 'I still don’t get it. Explain it again in simpler words, with an everyday comparison.'],
  ['Why that step?', 'Why do we do that step? What is the idea behind it?'],
  ['Show another example', 'Show me one similar worked example with different numbers.'],
];

// What the helper knows, most specific first: the practice problem you are on, the guide question you are on, the guide
// section you asked about, the homework or chapter problem you have open, or the chapter/course chat you are in.
function askContext() {
  if (round && round.p && round.skill) {
    const p = round.p, revealed = round.state === 'shown' || round.state === 'right';
    return {
      key: `${round.skill.id}|${plain(p.q)}`, hw: false, revealed, skill: round.skill.name,
      q: plain(p.q), choices: p.type === 'choice' ? p.choices.map(plain) : null, answer: plain(answerText(p)),
      steps: p.steps.map(plain).join(' '), rule: plain(round.skill.rule), tried: round.state === 'no' || round.wrong.length > 0,
    };
  }
  if (typeof Q !== 'undefined' && Q && Q.items && !round) {
    const x = Q.items[Q.i], sec = (x.g.sections || []).find((t) => t.heading === x.c.topic);
    return {
      kind: 'card', key: 'card|' + x.id, hw: false, revealed: Q.state === 'right' || Q.state === 'shown', skill: x.g.title,
      q: x.c.q, choices: Q.choices || null, answer: x.c.a, section: sec ? `${sec.heading}. ${sec.summary}` : '',
    };
  }
  if (typeof GV !== 'undefined' && GV.askSec && typeof guideById === 'function' && guideById(GV.askSec.gid)) {
    const g = guideById(GV.askSec.gid), sec = g.sections[GV.askSec.i];
    if (sec) {
      return {
        kind: 'section', key: `sec|${g.id}:${GV.askSec.i}`, hw: false, revealed: true, skill: g.title, q: sec.heading, answer: '',
        section: [sec.summary, ...sec.points.map((t) => '- ' + t), ...sec.terms.map((t) => `${t.term}: ${t.def}`)].join('\n'),
      };
    }
  }
  const x = W.id ? curProblem() : null;
  if (x) {
    const extra = W.extra && W.extra !== 'Thinking…' ? W.extra : '';
    return {
      key: (W.src === 'bank' ? 'bk|' : 'hw|') + x.id, hw: true, revealed: !!extra || (!!W.res && W.res.verdict === 'correct'), skill: x.topic || 'My homework',
      q: plain(x.text), choices: null, answer: x.key || '', work: W.work || '', res: W.res, extra, saved: x.chat || [],
    };
  }
  if (typeof TUTOR_CTX !== 'undefined' && TUTOR_CTX) {
    return { kind: 'chat', key: 'chat|' + TUTOR_CTX.id, hw: false, revealed: true, skill: TUTOR_CTX.title, q: '', answer: '', saved: (S.chats || {})[TUTOR_CTX.id] || [], chapter: TUTOR_CTX.title };
  }
  return null;
}
// A new problem starts a new conversation. Homework problems get their saved conversation back.
function askSync(c) {
  const k = c ? c.key : '';
  if (ASK.key === k) return;
  if (ASK.ctl && ASK.busy) ASK.ctl.abort();
  ASK.ctl = null; ASK.busy = false; ASK.live = ''; ASK.draft = '';
  ASK.key = k; ASK.turns = c && c.saved ? c.saved.slice() : [];
}
function askSave() {
  const k = ASK.key;
  if (k.indexOf('hw|') === 0) {
    const x = S.mine.find((m) => 'hw|' + m.id === k);
    if (x) { x.chat = ASK.turns.slice(-20); save(); }
  } else if (k.indexOf('bk|') === 0) { bankRec(k.slice(3)).chat = ASK.turns.slice(-20); save(); }
  else if (k.indexOf('chat|') === 0) { (S.chats || (S.chats = {}))[k.slice(5)] = ASK.turns.slice(-30); save(); }
}
function askInstructions(c) {
  let t = `${rules()}\n\nThe student is practicing in a quiz app and has a question. Answer it directly, in plain text, in at most about 120 words. ${PACK.ask.format} `
    + 'The student wants to understand well enough to re-explain it in their own words, so explain the idea behind the step, use a plain everyday comparison when it helps, and avoid jargon. '
    + 'If they say they are confused, come at it from a different angle than the explanation they already saw instead of repeating it. If a short worked example helps, give one with different numbers. ' + PACK.ask.extra;
  if (!c) return `${t}\n\nNo specific problem is open, so answer the question at the level of the course "${CLASS.name}".`;
  if (c.kind === 'chat') return `${t}\n\nThe student is studying ${c.chapter === 'Course overview' ? 'the course as a whole' : `the chapter "${c.chapter}"`} of "${CLASS.name}". Answer at that level, and use the excerpts from their own materials when they help.`;
  if (c.kind === 'section') return `${t}\n\nThe student is reading one section of a study guide that was written from their own documents. The section is "${c.q}":\n${c.section}\nAnswer their question about it. If the section is vague or looks wrong, say so and use the excerpts from their materials.`;
  if (c.kind === 'card') {
    t += `\n\nThe student is on this recall question from their study guide (${c.skill}): ${c.q}`;
    if (c.choices) t += `\nThe answer choices were: ${c.choices.join(' | ')}.`;
    if (c.section) t += `\nIt comes from this part of the guide: ${c.section}`;
    t += c.revealed ? `\nThey have already seen the answer: ${c.answer}. Explain why it is the answer and how to remember it.`
      : `\nThey have NOT seen the answer yet. Do not state it. Give a hint. (For your reference only, the answer is ${c.answer}.)`;
    return t;
  }
  if (c.hw) {
    t += `\n\nThe student is on this homework problem (${c.skill}): ${c.q}`;
    if (c.work) t += `\nTheir work so far:\n${c.work}`;
    if (c.res && c.res.verdict && c.res.verdict !== 'correct') t += `\nFeedback they already got. Step: ${c.res.where || 'n/a'}. Rule: ${c.res.procedure || 'n/a'}. ${c.res.note || ''}`;
    if (c.extra) t += `\nThe explanation they were just shown:\n${c.extra}`;
    t += c.revealed ? '\nThey have already seen the explanation, so you can go deeper into any step of it.'
      : '\nThey have not seen a solution yet. Give a hint and name the rule. Do not give the final answer or the corrected step unless they explicitly ask for it.';
    if (c.answer && !c.revealed) t += ` (For your reference only, the book's answer is ${c.answer}. Never reveal it.)`;
    return t;
  }
  t += `\n\nThe problem they are on (skill: ${c.skill}): ${c.q}`;
  if (c.choices) t += `\nThe answer choices are: ${c.choices.join(' | ')}.`;
  t += `\nThe rule for this skill: ${c.rule}`;
  t += c.revealed ? `\nThe student has already seen the worked solution. The correct answer is: ${c.answer}. The steps were: ${c.steps}`
    : `\nThe student has NOT seen the answer yet. Do not state the final answer to this problem. Explain the concept or give a hint that moves them forward. (For your reference only, the correct answer is: ${c.answer}.)`;
  return t;
}
const askLogHTML = (empty) => {
  const bubbles = ASK.turns.map((t) => `<div class="bub ${t.role}">${t.role === 'user' ? esc(t.content) : fmtMath(t.content)}</div>`);
  if (ASK.busy) bubbles.push(`<div class="bub assistant">${ASK.live ? fmtMath(ASK.live) : 'Thinking…'}</div>`);
  return bubbles.join('') || (empty === undefined ? `<small>Ask anything about the problem you are on, or about ${esc(CLASS.name)} in general.</small>` : empty);
};
// Overlay version (top bar "Ask").
function askHTML() {
  const c = askContext();
  askSync(c);
  if (typeof smp === 'undefined' || !smp) return '<p class="lead">The AI tutor isn’t set up on this server. Add a GROQ_API_KEY or OPENROUTER_API_KEY and restart.</p>';
  return `<p class="lead">${c && c.q ? `About this ${c.kind === 'section' ? 'section' : c.kind === 'card' ? 'question' : 'problem'}: <b>${esc(c.q.length > 90 ? c.q.slice(0, 90) + '…' : c.q)}</b>` : `Ask anything about ${esc(c && c.chapter && c.chapter !== 'Course overview' ? c.chapter : CLASS.name)}.`}</p>
    <div class="asklog" id="asklog" role="log" aria-live="polite">${askLogHTML()}</div>
    <label class="field" for="asktext">Your question</label>
    <textarea id="asktext" rows="3" placeholder="${esc(PACK.ask.example)}"></textarea>
    <div class="answer"><button class="btn" data-ask="send" ${ASK.busy ? 'disabled' : ''}>${ASK.busy ? 'Thinking…' : 'Ask'}</button>
      ${ASK.busy ? '<button class="link" data-ask="stop">Stop</button>' : ''}${ASK.turns.length && !ASK.busy ? '<button class="link" data-ask="clear">Clear chat</button>' : ''}</div>
    <small>Uses your AI quota when you press Ask. The AI can make mistakes, so check against your textbook.</small>`;
}
// Inline version: sits right under an explanation so you can ask about it without leaving the screen.
// opts: { title, placeholder } for places that are not a follow-up, like a chapter's tutor tab.
let FOLLOW_OPTS = {};
function followHTML(opts) {
  opts = FOLLOW_OPTS = opts || {};
  const c = askContext();
  if (!c || typeof smp === 'undefined' || !smp) return opts.title && !smp ? '<p class="lead">The AI tutor isn’t set up on this server. Add a GROQ_API_KEY or OPENROUTER_API_KEY and restart.</p>' : '';
  askSync(c);
  return `<div class="follow" id="follow"><h3>${esc(opts.title || 'Still unclear? Ask a follow-up')}</h3>
    <div class="asklog" id="flog" role="log" aria-live="polite">${askLogHTML('')}</div>
    <div class="chips">${CHIPS.map(([l, q]) => `<button type="button" class="qchip" data-ask="chip" data-q="${esc(q)}" ${ASK.busy ? 'disabled' : ''}>${l}</button>`).join('')}</div>
    <form class="answer" id="ff" autocomplete="off"><input id="ftext" type="text" aria-label="Your follow-up question" placeholder="${esc(opts.placeholder || 'e.g. Why is it 2 and not 3?')}" value="${esc(ASK.draft)}">
      <button class="btn" type="submit" ${ASK.busy ? 'disabled' : ''}>${ASK.busy ? 'Thinking…' : 'Ask'}</button>${ASK.busy ? '<button type="button" class="link" data-ask="stop">Stop</button>' : ''}</form>
    <small>Uses your AI quota when you ask. The AI can make mistakes, so check against your textbook.${ASK.turns.length && !ASK.busy ? ' <button type="button" class="link" data-ask="clear">Clear chat</button>' : ''}</small></div>`;
}
function askRefresh(full) {
  const log = document.getElementById('asklog'), flog = document.getElementById('flog');
  if (!full) {
    if (log) { log.innerHTML = askLogHTML(); log.scrollTop = log.scrollHeight; }
    if (flog) { flog.innerHTML = askLogHTML(''); flog.scrollTop = flog.scrollHeight; }
    return;
  }
  const body = document.getElementById('ovbody');
  if (body && ov && !ov.hidden && ov.dataset.k === 'ask') {
    const draft = (document.getElementById('asktext') || {}).value || '';
    body.innerHTML = askHTML();
    const box = document.getElementById('asktext'); if (box && draft) box.value = draft;
    const l = document.getElementById('asklog'); if (l) l.scrollTop = l.scrollHeight;
  }
  const f = document.getElementById('follow');
  if (f) {
    const fx = document.getElementById('ftext'), had = !!fx && document.activeElement === fx;
    if (fx) ASK.draft = fx.value;
    const h = followHTML(FOLLOW_OPTS);
    if (h) {
      f.outerHTML = h;
      const l = document.getElementById('flog'); if (l) l.scrollTop = l.scrollHeight;
      if (had) { const i = document.getElementById('ftext'); if (i) i.focus(); }
    }
  }
}
async function askSend(preset) {
  if (typeof smp === 'undefined' || !smp || ASK.busy) return;
  syncInputs();
  const box = document.getElementById('asktext'), fx = document.getElementById('ftext'), src = ov && !ov.hidden && box ? box : fx;
  const q = String(preset || (src ? src.value : '') || '').trim();
  if (!q) return;
  const c = askContext();
  askSync(c);
  ASK.turns.push({ role: 'user', content: q }); askSave();
  ASK.busy = true; ASK.live = ''; ASK.draft = '';
  const ctl = (ASK.ctl = new AbortController());
  if (box) box.value = '';
  if (fx) fx.value = '';
  askRefresh(true);
  let recent = ASK.turns.slice(-8);
  if (recent[0] && recent[0].role === 'assistant') recent = recent.slice(1);
  const ctx = await classContext(q + ' ' + (c ? c.q : ''));
  const input = [{ role: 'user', content: askInstructions(c) + ctx }, ...recent];
  try {
    const r = await smp(input, { cache: false, signal: ctl.signal, onText: ({ text }) => { if (ASK.ctl === ctl) { ASK.live = text; askRefresh(false); } } });
    if (ASK.ctl === ctl) ASK.turns.push({ role: 'assistant', content: r.text });
  } catch (e) {
    if (ASK.ctl === ctl) {
      if (e && e.text) ASK.turns.push({ role: 'assistant', content: e.text });
      else if (e && e.code !== 'cancelled') ASK.turns.push({ role: 'assistant', content: mineErr(e) });
    }
  }
  if (ASK.ctl === ctl) { askSave(); ASK.busy = false; ASK.live = ''; askRefresh(true); }
}
function askAct(a, el) {
  if (a === 'send') askSend();
  else if (a === 'chip') askSend(el && el.dataset.q);
  else if (a === 'stop') { if (ASK.ctl) ASK.ctl.abort(); }
  else if (a === 'clear') { ASK.turns = []; askSave(); askRefresh(true); }
}
app.addEventListener('click', (e) => { const a = e.target.closest('[data-ask]'); if (a && a.dataset.ask) askAct(a.dataset.ask, a); });
