// Game state, storage, scoring, and problem selection. No DOM in here.
// The class being studied (name, exam, notes) and its subject pack (skills, wording). Set when a class is opened.
let PACK = null, CLASS = null;
const fresh = () => ({ lastDay: null, streak: 0, best: 0, skills: {}, total: 0, right: 0, setDay: null, mine: [], sections: [], log: [], today: null, cards: {}, bank: {}, chats: {} });
let S = fresh();

const pad = (n) => String(n).padStart(2, '0');
const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dayDiff = (a, b) => Math.round((new Date(b + 'T00:00') - new Date(a + 'T00:00')) / 864e5);

const sk = (id) => S.skills[id] || (S.skills[id] = { score: 0, seen: 0, right: 0, last: null });
const stars = (id) => { const s = (S.skills[id] || {}).score || 0; return s >= 85 ? 3 : s >= 60 ? 2 : s >= 30 ? 1 : 0; };
const daysOff = (id) => { const s = S.skills[id]; return s && s.last ? dayDiff(s.last, dayKey()) : 0; };
const isRusty = (id) => stars(id) > 0 && daysOff(id) >= 5;
const setDoneToday = () => S.setDay === dayKey();
// Overall progress from a saved state: every skill's score averaged and capped at the "proficient" line. A class with no
// skills counts finished homework, well-learned recall questions and finished chapter problems.
function calcProgress(st, skills, cards, mastered, bank) {
  if (skills.length) return Math.round((skills.reduce((a, s) => a + Math.min(((st.skills || {})[s.id] || {}).score || 0, 85) / 85, 0) / skills.length) * 100);
  const total = (st.mine || []).length + cards + bank;
  const done = (st.mine || []).filter((m) => m.status === 'done').length + mastered + Object.values(st.bank || {}).filter((b) => b.status === 'done').length;
  return total ? Math.min(100, Math.round((done / total) * 100)) : 0;
}
const progressPct = () => calcProgress(S, SKILLS, typeof allCards === 'function' ? allCards().length : 0, typeof cardsMastered === 'function' ? cardsMastered() : 0,
  typeof CHAPTERS !== 'undefined' ? CHAPTERS.reduce((n, c) => n + c.counts.problems, 0) : 0);
const MASTERY = ['Started', 'Developing', 'Proficient', 'Mastered'];
// Skills behind the homework problems you haven't finished yet.
const focusSkills = () => new Set([
  ...S.mine.filter((m) => m.status !== 'done' && m.skill).map((m) => m.skill),
  ...SKILLS.filter((s) => S.sections.includes(s.zone)).map((s) => s.id), // sections you marked as studying now
]);

// kind: 'first' (right first try), 'retry' (right after a miss), 'miss' (revealed steps). skillId is null for homework not tied to a skill.
function record(skillId, kind) {
  const s = skillId ? sk(skillId) : null;
  S.total++;
  const today = dayKey();
  if (S.lastDay !== today) { // one skipped day is forgiven
    const gap = S.lastDay ? dayDiff(S.lastDay, today) : null;
    S.streak = gap !== null && gap <= 2 ? S.streak + 1 : 1;
    S.best = Math.max(S.best || 0, S.streak);
  }
  S.lastDay = today;
  if (skillId) { S.log.push({ d: dayKey(), s: skillId, k: kind }); if (S.log.length > 300) S.log.shift(); } // history the coach reads
  if (s) {
    s.seen++;
    s.score = Math.max(0, Math.min(100, s.score + (kind === 'first' ? 12 : kind === 'retry' ? 4 : -8)));
    s.last = dayKey();
  }
  if (kind === 'first') { S.right++; if (s) s.right++; }
  save();
}

// Ends a practice set. True when it was the first set of the day, which is when the study plan is made.
function finishSet(round) {
  const first = round.mode === 'set' && !setDoneToday();
  if (first) S.setDay = dayKey();
  save();
  return first;
}

const isChapter = (s) => !!s.core; // exam material; the rest is "earlier material" for variety
// Which skills a mixed round draws from: the Chapter 3 sections you marked (all of Chapter 3 if none are marked),
// plus skills from your unfinished homework.
function mixedPool() {
  const marked = SKILLS.filter((s) => isChapter(s) && S.sections.includes(s.zone));
  const ids = new Set((marked.length ? marked : SKILLS.filter(isChapter)).map((s) => s.id));
  focusSkills().forEach((id) => ids.add(id));
  return SKILLS.filter((s) => ids.has(s.id));
}
// Sprinkle: two problems in a five-problem round come from older algebra (weakest first); the rest stay on where you are.
const genericPool = () => SKILLS.filter((s) => !isChapter(s));
function pickMixed(n) {
  const main = mixedPool(), generic = genericPool(), out = [], focus = focusSkills();
  const slots = n >= 3 ? [1, 3].slice(0, Math.floor(n * 0.4)) : [];
  for (let i = 0; i < n; i++) {
    const pool = slots.includes(i) && generic.length ? generic : main;
    const ws = pool.map((s) => (s.id === out[i - 1] ? 0 : 120 - ((S.skills[s.id] || {}).score || 0) + (isRusty(s.id) ? 40 : 0) + (focus.has(s.id) ? 100 : 0)));
    let r = Math.random() * ws.reduce((a, b) => a + b, 0), k = 0;
    while (k < ws.length - 1 && (r -= ws[k]) > 0) k++;
    out.push(pool[k].id);
  }
  return out;
}
// The skill to suggest next: lowest-scoring practiced skill under 85, else first new one.
function nextUp() {
  if (!SKILLS.length) return null;
  const hw = [...focusSkills()].filter((id) => SKILLS.some((s) => s.id === id))
    .sort((a, b) => ((S.skills[a] || {}).score || 0) - ((S.skills[b] || {}).score || 0));
  if (hw.length && ((S.skills[hw[0]] || {}).score || 0) < 85) return hw[0];
  const unseen = (s) => !(S.skills[s.id] && S.skills[s.id].seen);
  const fresh1 = SKILLS.find((s) => isChapter(s) && unseen(s)) || SKILLS.find(unseen);
  const weak = SKILLS.filter((s) => S.skills[s.id] && S.skills[s.id].seen && S.skills[s.id].score < 85)
    .sort((a, b) => S.skills[a.id].score - S.skills[b.id].score)[0];
  if (weak && S.skills[weak.id].score < 50) return weak.id;
  return (fresh1 || weak || SKILLS[0]).id;
}

// ---- coach: where you are, read from your own history. Rule-based, so it works without Claude. ----
const recent = (id, n = 8) => S.log.filter((e) => e.s === id).slice(-n);
const firstTry = (es) => es.filter((e) => e.k === 'first').length;
const activeZones = () => PACK.zones.filter((z) => SKILLS.some((s) => s.zone === z));
const chapterZones = () => activeZones().filter((z) => SKILLS.some((s) => s.zone === z && s.core));
// The next key date of a class that hasn't passed yet ({ label, date }), or null. Dates are kept in order, so the first upcoming one wins.
const keyDate = (c) => (c.dates || []).find((d) => d.date >= dayKey()) || null;
const daysToExam = () => { const k = keyDate(CLASS); return k ? dayDiff(dayKey(), k.date) : null; };
// How ready you look: average of each core skill's score, capped at the 3-star line (85).
const readiness = () => { const cs = SKILLS.filter(isChapter); return Math.round((cs.reduce((s, k) => s + Math.min(((S.skills[k.id] || {}).score || 0), 85) / 85, 0) / (cs.length || 1)) * 100); };
function sectionStats(z) {
  const ss = SKILLS.filter((s) => s.zone === z);
  return { ss, tried: ss.filter((s) => S.skills[s.id] && S.skills[s.id].seen > 0), solid: ss.filter((s) => stars(s.id) >= 2) };
}
// Up to three observations, most urgent first. `act` is an optional one-tap action.
function coach() {
  const zs = chapterZones(), marked = zs.filter((z) => S.sections.includes(z)), items = [];
  const gap = S.lastDay ? dayDiff(S.lastDay, dayKey()) : 0;
  if (gap >= 3) items.push({ text: `It’s been ${gap} days. No catch-up needed: one problem today starts you again.`, act: 'one', label: 'Do one problem' });
  if (!marked.length) return [...items, { text: 'Mark the section you’re working on as current, and I’ll aim your practice there.' }];
  const trouble = [], untried = [], advance = [], lines = [];
  marked.forEach((z) => {
    const { ss, tried, solid } = sectionStats(z), next = zs[zs.indexOf(z) + 1];
    ss.forEach((s) => {
      const r = recent(s.id, 6);
      if (r.length >= 3 && firstTry(r) / r.length < 0.5) trouble.push({ s, r });
      else if (!(S.skills[s.id] && S.skills[s.id].seen)) untried.push({ s, z });
    });
    if (tried.length === ss.length && solid.length >= Math.ceil(ss.length * 0.75)) {
      advance.push(next
        ? { text: `You’re solid on ${z} (${solid.length} of ${ss.length} skills at proficient or better). Ready for ${next}?`, act: 'advance', label: 'Move on', from: z, to: next }
        : { text: `You’re solid on ${z}, the last section. Earlier material in your practice sets will keep it fresh.` });
    } else lines.push({ text: `${z}: ${solid.length} of ${ss.length} skills at proficient or better.` });
  });
  trouble.sort((a, b) => firstTry(a.r) / a.r.length - firstTry(b.r) / b.r.length);
  if (trouble[0]) items.push({ text: `${trouble[0].s.name} is giving you trouble (${firstTry(trouble[0].r)} of ${trouble[0].r.length} right first try lately). Use “Explain it,” then try a similar one.`, act: 'skill', id: trouble[0].s.id, label: 'Practice it' });
  items.push(...advance);
  if (untried[0]) items.push({ text: `You haven’t tried ${untried[0].s.name} yet (${untried[0].z}).`, act: 'skill', id: untried[0].s.id, label: 'Try it' });
  if (items.length < 2) items.push(...lines.slice(0, 1));
  return items.slice(0, 3);
}

// After the first practice set of the day: where to spend the rest of a 25-30 minute session.
// Skills you missed in the set come first, then the weakest in your sections, then open homework.
function planFromSet(round) {
  const hwOpen = S.mine.some((m) => m.status !== 'done'), weight = {};
  round.ids.forEach((id, i) => { const r = round.results[i]; if (r === 'miss' || r === 'retry') weight[id] = (weight[id] || 0) + (r === 'miss' ? 2 : 1); });
  const missed = Object.keys(weight).sort((a, b) => weight[b] - weight[a]).map((id) => ({ kind: 'skill', id, why: 'you missed it in today’s practice set' }));
  const marked = SKILLS.filter((s) => isChapter(s) && S.sections.includes(s.zone));
  const weakest = (marked.length ? marked : SKILLS.filter(isChapter)).filter((s) => !weight[s.id])
    .map((s, i) => ({ s, i, sc: (S.skills[s.id] || {}).score || 0 })).sort((a, b) => a.sc - b.sc || a.i - b.i)
    .map(({ s }) => ({ kind: 'skill', id: s.id, why: S.skills[s.id] && S.skills[s.id].seen ? 'weakest skill in your sections' : 'not tried yet in your sections' }));
  const blocks = [...missed, ...weakest].slice(0, hwOpen ? 2 : 3);
  if (hwOpen) blocks.push({ kind: 'hw', why: 'your own homework' });
  return { day: dayKey(), blocks, done: [] };
}
const blockDone = (b) => (b.kind === 'skill' ? S.today.done.includes(b.id) : S.mine.some((m) => m.doneDay === dayKey()));

// ---- answer parsing ----
function parseNum(s) {
  s = String(s).trim().replace(/[−–]/g, '-').replace(/^\+/, '').replace(/\s+/g, '').replace(/,(?=\d{3}\b)/g, '');
  if (!s) return NaN;
  s = s.replace(/[x×*]10\^?(-?\d+)$/i, 'e$1'); // 3.57x10^23, 3.57*10^23, 3.57x1023 -> 3.57e23
  const m = s.match(/^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/);
  if (m) return +m[2] === 0 ? NaN : +m[1] / +m[2];
  return /^-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s) ? +s : NaN;
}
function parseList(s) {
  return String(s).replace(/[a-z]\s*=/gi, '').replace(/[()]/g, '').split(/,|;|\band\b|\bor\b/i)
    .map((x) => x.trim()).filter(Boolean).map(parseNum);
}
// Relative tolerance (default 1%, so rounding differences in atomic masses are fine). tol 0 means exact.
const near = (a, b, tol) => {
  if (tol === undefined && PACK.absTol) return Math.abs(a - b) < PACK.absTol; // pack uses a fixed absolute tolerance
  tol = tol === undefined ? 0.01 : tol;
  return tol === 0 ? Math.abs(a - b) < 1e-9 : Math.abs(a - b) <= Math.max(Math.abs(b) * tol, 1e-9);
};
const normT = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
const normF = (s) => (PACK.normF ? PACK.normF(s) : String(s).trim());
// Returns true, false, or null when the input cannot be read as an answer.
function checkAnswer(p, raw) {
  if (p.check) return p.check(raw); // problems can bring their own forgiving checker
  if (p.type === 'choice') return raw === p.answer;
  if (p.type === 'num') { const v = PACK.looseUnits ? parseNumLoose(raw) : parseNum(raw); return Number.isNaN(v) ? null : near(v, p.answer, p.tol); }
  if (p.type === 'text') { const v = normT(raw); return v ? p.accept.some((a) => { const n = normT(a); return n === v || n + 'ion' === v || (n.length >= 9 && lev(n, v) <= 1); }) : null; } // one slipped letter is forgiven in long names
  if (p.type === 'formula') { const v = normF(raw); return v ? p.accept.includes(v) : null; }
  if (p.type === 'seq') {
    const v = String(raw).split(/[\s,;]+/).filter(Boolean).map(parseNum);
    return !v.length || v.some(Number.isNaN) ? null : v.length === p.answer.length && v.every((x, i) => x === p.answer[i]);
  }
  const v = parseList(raw);
  if (!v.length || v.some(Number.isNaN)) return null;
  if (p.type === 'pair') return v.length === 2 && near(v[0], p.answer[0]) && near(v[1], p.answer[1]);
  const got = [...new Set(v.map((x) => Math.round(x * 100)))].sort((a, b) => a - b);
  const want = p.answer.map((x) => Math.round(x * 100)).sort((a, b) => a - b);
  return got.length === want.length && got.every((x, i) => x === want[i]);
}
function answerText(p) {
  if (p.shownAns) return p.shownAns;
  if (PACK.answerText && (p.type === 'num' || p.type === 'pair' || p.type === 'list')) return PACK.answerText(p);
  if (p.type === 'choice') return p.choices[p.answer];
  if (p.type === 'num') return Number.isInteger(p.answer) ? String(p.answer) : +p.answer.toPrecision(4) + '';
  if (p.type === 'text') return p.accept[0];
  if (p.type === 'formula') return p.shown;
  if (p.type === 'seq') return p.answer.join(', ');
  return p.type === 'pair' ? `${p.answer[0]}, ${p.answer[1]}` : p.answer.join(', ');
}

// ---- multiple-choice mode: turn a typed problem into a choice problem using its `wrongs` (common mistakes) ----
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const fmtNum = (x) => {
  if (x === 0) return '0';
  const a = Math.abs(x);
  if (Number.isInteger(x) && a < 1e5) return String(x);
  if (a >= 1e5 || a < 1e-3) { const e = Math.floor(Math.log10(a)); return `${(x / 10 ** e).toPrecision(3)} × 10<sup>${e}</sup>`; }
  return String(+x.toPrecision(3));
};
const TYPING_HINT = /<br><small>(?:Scientific notation|Coefficients in order|For example|Like |Fractions like|Fractions are|Give the shape|Write the formula with|Include the |Name the type)[^<]*<\/small>/g;
function toChoice(p) {
  if (p.alt) return { ...p, q: p.q.replace(TYPING_HINT, ''), type: 'choice', choices: p.alt.choices, answer: p.alt.answer, check: null, shownAns: null, alt: null };
  if (p.type === 'choice' || !p.wrongs) return p;
  const f = p.type === 'num' ? (p.fmtAns || fmtNum) : p.type === 'seq' ? (a) => a.join(', ') : p.type === 'text' ? cap : (s) => s;
  const right = p.type === 'num' ? p.answer : p.type === 'seq' ? p.answer : p.type === 'text' ? p.accept[0] : p.shown;
  const correct = f(right), seen = new Set([correct]), w = [];
  const skip = (x) => p.type === 'num' && (!Number.isFinite(x) || x === p.answer || (p.tol !== 0 && Math.abs(x - p.answer) <= Math.abs(p.answer) * 0.04) || (!p.fmtAns && x <= 0));
  p.wrongs.forEach((x) => {
    if (skip(x)) return;
    const t = f(x);
    if (!seen.has(t) && !/undefined|(?<![A-Za-z])NaN(?![A-Za-z])/.test(String(t))) { seen.add(t); w.push(t); }
  });
  if (w.length < 2) return p; // not enough distinct wrong answers: keep it typed
  const m = mc(correct, shuffle(w).slice(0, 3));
  return { ...p, q: p.q.replace(TYPING_HINT, ''), type: 'choice', choices: m.choices, answer: m.answer };
}
// A choice-only problem can carry a `typed` alternative ({ type, check or accept, hint, ... }). Used when answers are typed;
// the original choices are kept in `alt` so a miss can still fall back to them.
const asTyped = (p) => (p.type === 'choice' && p.typed ? { ...p, ...p.typed, q: p.q + (p.typed.hint || ''), alt: { choices: p.choices, answer: p.answer } } : p);
const newProblem = (skill) => asTyped(skill.gen());

// Edit distance (small strings), for forgiving a slipped letter in a typed name.
function lev(a, b) {
  const d = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]; d[0] = i;
    for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; }
  }
  return d[b.length];
}
// "18.02 g/mol", "3.5 x 10^23 molecules", "109°": a number followed by a unit still counts as that number.
function parseNumLoose(raw) {
  const v = parseNum(raw);
  if (!Number.isNaN(v)) return v;
  const m = String(raw).trim().match(/^([-+−–]?\s*(?:\d[\d,]*\.?\d*|\.\d+)(?:\s*[x×*]\s*10\s*\^?\s*[-−–]?\d+|e[+-]?\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)?)\s*(?=[a-zA-Zµ°%])/);
  return m ? parseNum(m[1]) : NaN;
}
// Generators are random, so a skill with few variations can repeat itself. Remember what was shown and draw again:
// first avoid anything from the last 40 problems, then the last 10, and never the one just before.
const recentQs = [];
function freshProblem(skill) {
  const key = (p) => skill.id + '|' + plain(p.q);
  let p;
  for (const span of [40, 10, 1]) {
    for (let i = 0; i < 30; i++) {
      p = newProblem(skill);
      if (!recentQs.slice(-span).includes(key(p))) break;
    }
    if (!recentQs.slice(-span).includes(key(p))) break;
  }
  recentQs.push(key(p));
  if (recentQs.length > 80) recentQs.shift();
  return p;
}
