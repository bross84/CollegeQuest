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
    + 'Find every problem the student is expected to solve. Skip worked examples unless there are no other problems. '
    + `Transcribe each problem as plain text: ${PACK.finder}. Do NOT solve anything.${withAnswers ? ' If the material has an answer key or solutions, copy the final answer for each problem into "answer"; leave "answer" empty when there is none. Never work out an answer yourself.' : ''}\n\n`
    + `Reply with only this JSON (at most 30 problems):\n{"topic":"short name of the unit or section, e.g. Average rate of change","problems":[{${['"text":"the problem"', withAnswers && '"answer":""', skillHint].filter(Boolean).join(',')}}]}\n\n`
    + (chapters && chapters.length ? `This material may cover several chapters, so give each problem its own "chapter": the number of the chapter it belongs to from the list below, or 0 if none fits.\n${chapters.map((c, i) => `${i + 1}. ${c.title}`).join('\n')}\n\n` : '')
    + (part.text ? `Text:\n${part.text}` : '(no text, see the photos)');
}
