// Reading problems out of documents: the text is split into parts, and findPrompt asks the AI to list the problems in one part.
// The chapter problem bank (bank.js) uses these to read a document's problems.
const CHUNK = 12000, MAX_PARTS = 24;

function splitChunks(text, size = CHUNK) {
  const out = [];
  while (text.length > size) {
    let cut = text.lastIndexOf('\n', size);
    if (cut < size * 0.5) cut = size;
    out.push(text.slice(0, cut)); text = text.slice(cut);
  }
  if (text.trim()) out.push(text);
  return out;
}
// What to send the AI for these documents: text in chunks, photos in small batches. Also used by the chapter problem bank.
async function docParts(picked, pasted) {
  const lim = smpLimits && smpLimits.images, parts = [];
  if (pasted) splitChunks(pasted.slice(0, CHUNK * 3)).forEach((t) => parts.push({ text: t }));
  for (const d of picked.filter((x) => x.kind !== 'image')) splitChunks((await api('GET', `/api/docs/${d.id}/text`)).text).forEach((c) => parts.push({ text: c }));
  const photos = picked.filter((x) => x.kind === 'image');
  for (let i = 0; i < photos.length; i += lim ? lim.maxCount : 4) parts.push({ images: photos.slice(i, i + lim.maxCount).map((d) => ({ doc: d.id })) });
  return parts;
}
// The prompt that lists the problems in one part. withAnswers also copies any answer key found in the material.
function findPrompt(part, { skillHint, withAnswers, source, chapters }) {
  return `You are helping an adult student who is taking "${CLASS.name}". Below are photos and/or text from their class materials (${source || 'a worksheet, textbook pages, or notes'}). `
    + findRules({ skillHint, withAnswers, chapters }) + `Reply with only this JSON (at most 30 problems):\n{"topic":"short name of the unit or section, e.g. Average rate of change","problems":[${findShape({ skillHint, withAnswers })}]}\n\n`
    + findChapters(chapters)
    + (part.text ? `Text:\n${part.text}` : '(no text, see the photos)');
}
// How to list the problems in a part, the JSON for one problem, and the chapter list for material that covers several chapters.
// The study-guide prompt (study.js) uses them too, so a textbook's guide and its problems come from one read.
const findShape = ({ skillHint, withAnswers }) => `{${['"number":"21"', '"text":"the problem"', '"format":"mc"', '"choices":["option"]', withAnswers && '"answer":""', skillHint].filter(Boolean).join(',')}}`;
const findChapters = (chapters) => (chapters && chapters.length ? `This material may cover several chapters, so give each problem its own "chapter": the number of the chapter it belongs to from the list below, or 0 if none fits.\n${chapters.map((c, i) => `${i + 1}. ${c.title}`).join('\n')}\n\n` : '');
function findRules({ withAnswers }) {
  return 'Find every problem the student is expected to solve. Skip worked examples unless there are no other problems. '
    + `Transcribe each problem as plain text: ${PACK.finder}. Do NOT solve anything.${withAnswers ? ' If the material has an answer key or solutions, copy the final answer for each problem into "answer"; leave "answer" empty when there is none. Never work out an answer yourself.' : ''}\n\n`
    + 'Give each problem’s number as printed ("number": "21", "3.21" or "Question 9"; empty if it has none), and leave the number out of "text". '
    + 'Keep each problem’s answer format: "format" is "mc" for multiple choice, "tf" for true/false, "fill" for fill in the blank, "parts" for one question with several labelled parts that each need their own written answer, or "work" for anything else solved by working it out. '
    + 'For multiple choice put only the question in "text" and list every option, in order and without its a) b) c) letter, in "choices". Fix any options that the text extraction ran together. For "parts", list each part (without its letter) in "choices" the same way. A question whose a) b) c) items are tasks or blanks to fill in is "parts", not multiple choice. '
    + `${withAnswers ? 'For multiple choice, "answer" is the text of the correct option (not its letter) when the material shows the key. ' : ''}\n\n`;
}

// A problem as the AI describes it, tidied: the question, its answer format, its options and its answer. A letter answer
// ("b") becomes the text of that option. Anything that isn't a real multiple choice (under two options) has none.
// A multi-part question ('parts') keeps the prompt of each part in choices (an AI writing one may call them "parts").
const FORMATS = ['mc', 'tf', 'fill', 'work', 'parts'];
function shapeProblem(p) {
  const text = String((p && p.text) || '').trim();
  const given = p && p.format === 'parts' && Array.isArray(p.parts) && p.parts.length ? p.parts : p && p.choices;
  let choices = (Array.isArray(given) ? given : []).map((c) => String(c).replace(/^\s*\(?[A-Ha-h][).:]\s+/, '').trim()).filter(Boolean).slice(0, 8);
  let format = FORMATS.includes(p && p.format) ? p.format : choices.length >= 2 ? 'mc' : '';
  if (format === 'mc' && choices.length < 2) format = '';
  if (format === 'parts' && !choices.length) format = 'work';
  if (format !== 'mc' && format !== 'parts') choices = [];
  let answer = String((p && p.answer) || '').trim();
  const letter = answer.match(/^\(?([A-Ha-h])\)?[.)]?$/);
  if (format === 'mc' && letter && choices[letter[1].toLowerCase().charCodeAt(0) - 97]) answer = choices[letter[1].toLowerCase().charCodeAt(0) - 97];
  return { text, format, choices, answer: answer.slice(0, 500) };
}
// Options an AI wrote are put in random order (it likes to make the first one right), unless one refers to the others.
const refersToOthers = (choices) => choices.some((c) => /\b(all|none|both|neither)\b.*\b(above|these|of the)\b/i.test(c) || /^\(?[a-d]\)?\s+(and|or)\s+\(?[a-d]\)?$/i.test(c.trim()));
function mixChoices(sh) { return sh.format === 'mc' && !refersToOthers(sh.choices) ? { ...sh, choices: shuffle(sh.choices) } : sh; }
// Position of the right option for a multiple-choice or true/false problem, or -1 when there is no key.
function keyIndex(p, opts) {
  const a = String(p.answer || '').trim();
  if (!a || !opts) return -1;
  let k = opts.findIndex((c) => normText(c) === normText(a));
  if (k < 0) { const m = a.match(/^\(?([A-Ha-h])\)?[.)]?$/); if (m) k = m[1].toLowerCase().charCodeAt(0) - 97; }
  if (k < 0 && opts.length === 2 && /^(true|false)$/i.test(opts[0])) k = /^t/i.test(a) ? 0 : /^f/i.test(a) ? 1 : -1;
  return k < opts.length ? k : -1;
}
// The options to show for a problem, or null when it is answered by writing.
const optionsOf = (p) => (p.format === 'mc' && p.choices && p.choices.length >= 2 ? p.choices : p.format === 'tf' ? ['True', 'False'] : null);
// The parts of a multi-part question, each answered in its own box, or null.
const partsOf = (p) => (p.format === 'parts' && p.choices && p.choices.length ? p.choices : null);
// A question with its parts written under it, for the tutor and anything else that reads it as one piece of text.
const questionText = (p) => (partsOf(p) ? `${p.text}\n${p.choices.map((c, k) => `${'abcdefgh'[k]}) ${c}`).join('\n')}` : p.text);
