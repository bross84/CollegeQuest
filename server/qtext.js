// Reading questions out of extracted PDF text without the AI: repairing subscripts and exponents the extractor split off,
// telling multiple choice (a) b) c) d) options) from multi-part written questions, and reading an answer key.
// Shared: the server requires it, and client/build.js puts it into app.js, where every name here is global. Keep it pure.

const QT_SYMS = new Set('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og'.split(' '));
// Symbols that are also everyday words ("In 2 hours", "At 25 °C"): joined to a number only when a phase or charge follows.
const QT_WORDLIKE = new Set(['In', 'At', 'As', 'No', 'He', 'Be', 'Am', 'Re', 'Ho', 'I', 'Pa', 'Po', 'Es']);
const qtFormula = (tok) => { const s = tok.match(/[A-Z][a-z]?/g); return !!s && s.join('') === tok.replace(/\d+/g, '') && /^(?:[A-Z][a-z]?\d*)+$/.test(tok) && s.every((e) => QT_SYMS.has(e)); };

// "AgNO 3 (aq)" -> "AgNO3 (aq)", "K 2 SO 4" -> "K2SO4", "3.57 x 10 23" -> "3.57 x 10^23". Ordinary words and numbers are left alone.
function repairPdfText(text) {
  let t = String(text);
  // an exponent the extractor split off a power of ten
  t = t.replace(/(\d)(\s*[x×*]\s*)10\s+([-−–]?\d{1,3})(?![\d.])/g, (m, d, x, e) => `${d}${x}10^${e.replace(/[−–]/, '-')}`);
  // a subscript split off its formula: the word before the digits must be made only of element symbols
  t = t.replace(/(^|[\s(+→=])([A-Z][A-Za-z]{0,11}) (\d{1,2})(?=\s|[(+→.,;)]|$)/g, (m, pre, tok, n, at, all) => {
    if (!qtFormula(tok)) return m;
    const next = all.slice(at + m.length);
    if (QT_WORDLIKE.has(tok) && !/^\s*\((?:s|l|g|aq)\)|^[+-]/.test(next)) return m;
    return `${pre}${tok}${n}`;
  });
  // the rest of a formula split at a subscript: "K2 SO4" -> "K2SO4" (the next piece must carry its own subscript or a phase)
  for (let i = 0; i < 3; i++) {
    t = t.replace(/(^|[\s(+→=])((?:[A-Z][a-z]?\d*)*[A-Z][a-z]?\d{1,2}) ((?:[A-Z][a-z]?\d*)+)(?=\s|[(+→.,;)]|$)/g, (m, pre, a, b, at, all) => {
      if (!qtFormula(a) || !qtFormula(b)) return m;
      const next = all.slice(at + m.length);
      return /\d/.test(b) || /^\s*\((?:s|l|g|aq)\)/.test(next) ? `${pre}${a}${b}` : m;
    });
  }
  return t;
}

// "Question 9:", "Problem 21." or "Q3)" at the start of a question: the number goes to ref, the rest is the question.
function stripQNumber(text) {
  const m = String(text).match(/^\s*(?:question|problem|exercise|q)\s*#?\s*(\d+[a-z]?)\s*[:.)\-–]?\s*/i);
  return m ? { text: String(text).slice(m[0].length).trim(), ref: m[1] } : { text: String(text).trim(), ref: '' };
}

// Option or part markers in a question: "a)" (possibly glued to the text before it, as PDF columns leave it) and "(a)".
// A ")" that closes a "(" opened earlier, like "Ca(OH)2" or "(see table)", is not a marker.
function qtMarkers(text) {
  const out = [];
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') {
      const m = text.slice(i).match(/^\(([a-h])\)/);
      if (m && (i === 0 || !/[A-Za-z0-9]/.test(text[i - 1]))) { out.push({ letter: m[1], pos: i, end: i + m[0].length, paren: true }); i += m[0].length - 1; continue; }
      depth++;
    } else if (ch === ')') {
      if (depth > 0) { depth--; continue; }
      const l = text[i - 1];
      if (i > 0 && /[a-h]/.test(l) && (i < 2 || text[i - 2] !== '(')) out.push({ letter: l, pos: i - 1, end: i + 1, paren: false });
    }
  }
  return out;
}

// A run of markers a, b, c, ... each once, in letter order: the option texts, each the span from its marker to the next
// marker by position (two PDF columns put them in the order a, c, b, d). Null when the letters don't run from a.
function qtRun(text, marks) {
  if (marks.length < 2) return null;
  const letters = marks.map((m) => m.letter).sort();
  if (letters.some((l, i) => l !== 'abcdefgh'[i])) return null;
  const byPos = marks.slice().sort((a, b) => a.pos - b.pos);
  const spans = byPos.map((m, i) => ({ letter: m.letter, text: text.slice(m.end, i + 1 < byPos.length ? byPos[i + 1].pos : text.length).trim().replace(/[;,]\s*$/, '') }));
  return { stem: text.slice(0, byPos[0].pos).replace(/[\s/|]+$/, '').trim(), items: spans.sort((a, b) => (a.letter < b.letter ? -1 : 1)).map((s) => s.text) };
}

const QT_TASK = /^(write|give|calculate|determine|find|name|identify|classify|explain|draw|show|predict|balance|indicate|list|describe|state|convert|complete|how|why|what is the|which of)\b/i;
const QT_EACH = /\beach of the following\b|\bclassify each\b|\bfor each\b|\bthe following (?:number|equations?|reactions?|compounds?|values?|quantities)\b/i;
const QT_STEM_TASK = /\bfor the following\b|\bwrite\b|\bclassify\b|\bcalculate\b|\bindicate\b|\bshow (?:your|all)\b/i;
// Would these pieces be parts of one written question rather than options to pick from?
function looksLikeParts(stem, items) {
  if (items.some((x) => /_{3,}/.test(x))) return true;
  if (items.some((x) => x.length > 160)) return true;
  if (items.filter((x) => QT_TASK.test(x) || /\?\s*$/.test(x)).length * 2 >= items.length) return true;
  if (QT_EACH.test(stem)) return true;
  return QT_STEM_TASK.test(stem) && (items.length < 3 || items.some((x) => x.length > 60));
}

// Rows of a fill-in table with no letters, like "9004____ / 0.00660____ / 22000____": the values in front of each blank.
function qtBlankRows(text) {
  const rows = [...text.matchAll(/(?:^|[\s/|])([-+]?[\d.,]+(?:\s*[x×]\s*10\^?-?\d+)?)\s*_{3,}/g)];
  if (rows.length < 2) return null;
  return { stem: text.slice(0, rows[0].index).replace(/[\s/|]+$/, '').trim(), items: rows.map((r) => r[1]) };
}

// How a question is answered, read from its own text: { text, format, choices }. format is 'mc' with its options, 'parts' with
// the prompt of each part, or '' when the text alone doesn't say (a written question, as far as the parser can tell).
function parseOptions(input) {
  const text = String(input || '').trim(), none = { text, format: '', choices: [] };
  const marks = qtMarkers(text);
  const paren = marks.filter((m) => m.paren), bare = marks.filter((m) => !m.paren);
  if (paren.length >= 2) { // "(a) ... (b) ..." is how a book or exam labels the parts of one question
    const r = qtRun(text, paren);
    if (r && r.stem && r.items.every(Boolean)) return { text: r.stem, format: 'parts', choices: r.items };
  }
  const r = qtRun(text, bare);
  if (r && r.stem && r.items.every(Boolean)) {
    if (!looksLikeParts(r.stem, r.items) && r.items.length >= 3 && r.items.length <= 5) return { text: r.stem, format: 'mc', choices: r.items };
    if (looksLikeParts(r.stem, r.items) || r.items.length === 2) return { text: r.stem, format: 'parts', choices: r.items.map((x) => x.replace(/\s*_{3,}\s*$/, '') || x) };
    return none;
  }
  if (!marks.length) { const rows = qtBlankRows(text); if (rows && rows.stem) return { text: rows.stem, format: 'parts', choices: rows.items }; }
  return none;
}

// An answer key printed with an exam, like "Answers: 1) b 2) c 3. d": question number -> letter (or short answer).
function parseAnswerKey(text) {
  const t = String(text || ''), at = t.search(/\b(?:answer key|answers?)\s*[:\-–]?\s*(?:\n|\s)*\d+\s*[).:\-–]\s*[a-hA-H]\b/i);
  if (at < 0) return {};
  const key = {};
  for (const m of t.slice(at).matchAll(/(?:^|\s)(\d{1,3})\s*[).:\-–]\s*([a-hA-H])(?=[\s,;.]|$)/g)) if (!key[m[1]]) key[m[1]] = m[2].toLowerCase();
  return Object.keys(key).length >= 2 ? key : {};
}
// The same key cut off the end of a question's text, where a reader may leave it.
const dropAnswerKey = (text) => String(text).replace(/\s*\b(?:answer key|answers?)\s*[:\-–]?\s*\d+\s*[).:\-–]\s*[a-hA-H]\b[\s\S]*$/i, '').trim();

// One part's key out of an answer written "a) 4 sig figs, 9.004 x 10^3 b) ...": a list as long as the parts, or null.
function partKeys(answer, n) {
  const a = String(answer || ''), r = qtRun(a, qtMarkers(a));
  return r && r.items.length === n && r.items.every(Boolean) ? r.items : null;
}

// A question as the AI read it, checked against its own text: the parser's reading wins whenever it finds options or parts,
// because the AI often leaves PDF options jammed into the question or calls a blanks table multiple choice.
// p: { number, text, format, choices, answer }. Returns { text, format, choices, answer, ref }.
function readQuestion(p) {
  const num = stripQNumber(dropAnswerKey(repairPdfText((p && p.text) || '')));
  const ref = String((p && p.number) || '').replace(/^\s*(problem|question|q|exercise)\s*#?\s*/i, '').trim() || num.ref;
  const parsed = parseOptions(num.text);
  let raw = (Array.isArray(p && p.choices) ? p.choices : []).map((c) => String(c).trim()).filter(Boolean);
  const lettered = raw.map((c) => (c.match(/^\(?([a-hA-H])[).:]\s*/) || [])[1]);
  if (lettered.every(Boolean) && new Set(lettered.map((l) => l.toLowerCase())).size === raw.length) raw = raw.map((c, i) => [lettered[i].toLowerCase(), c]).sort((a, b) => (a[0] < b[0] ? -1 : 1)).map((x) => x[1]); // kept their letters: put them in letter order
  const aiChoices = raw.map((c) => repairPdfText(c.replace(/^\s*\(?[A-Ha-h][).:]\s*/, '').trim())).filter(Boolean);
  let format = ['mc', 'tf', 'fill', 'work', 'parts'].includes(p && p.format) ? p.format : '', text = num.text, choices = aiChoices;
  if (parsed.format) ({ text, format, choices } = parsed);
  else if (format === 'mc' && aiChoices.length >= 2 && looksLikeParts(text, aiChoices)) format = 'parts';
  else if (format === 'mc' && aiChoices.length < 2) format = '';
  if (format !== 'mc' && format !== 'parts') choices = [];
  if (!format) format = 'work';
  return { text, format, choices: choices.slice(0, 8), answer: String((p && p.answer) || '').trim(), ref: ref.slice(0, 40) };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { repairPdfText, stripQNumber, parseOptions, looksLikeParts, parseAnswerKey, dropAnswerKey, partKeys, readQuestion, QT_SYMS };
