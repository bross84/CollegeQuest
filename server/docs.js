// Document types we accept, text extraction, and a small keyword search over extracted text.
const fs = require('fs');
const path = require('path');

// extension -> { kind, mime }. The stored mime comes from here, never from the upload, so a file can't pose as HTML.
const TYPES = {
  '.png': { kind: 'image', mime: 'image/png' },
  '.jpg': { kind: 'image', mime: 'image/jpeg' },
  '.jpeg': { kind: 'image', mime: 'image/jpeg' },
  '.webp': { kind: 'image', mime: 'image/webp' },
  '.gif': { kind: 'image', mime: 'image/gif' },
  '.pdf': { kind: 'pdf', mime: 'application/pdf' },
  '.txt': { kind: 'text', mime: 'text/plain; charset=utf-8' },
  '.md': { kind: 'text', mime: 'text/plain; charset=utf-8' },
  '.docx': { kind: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
};
const MAX_TEXT = 2000000;
const typeOf = (name) => TYPES[path.extname(String(name)).toLowerCase()] || null;

async function extractText(kind, file) {
  try {
    if (kind === 'text') return { text: fs.readFileSync(file, 'utf8').slice(0, MAX_TEXT), note: '' };
    if (kind === 'pdf') {
      const pdf = require('pdf-parse/lib/pdf-parse.js');
      const r = await pdf(fs.readFileSync(file));
      const text = String(r.text || '').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_TEXT);
      return { text, note: text.length < 40 ? 'No readable text in this PDF (it may be scanned). Upload the pages as photos instead.' : '' };
    }
    if (kind === 'docx') {
      const r = await require('mammoth').extractRawText({ path: file });
      return { text: String(r.value || '').trim().slice(0, MAX_TEXT), note: '' };
    }
  } catch (e) {
    return { text: '', note: `Could not read this file's text (${e.message}).` };
  }
  return { text: '', note: '' }; // images: read by the AI when needed
}

// ---- search: split into ~1200 character chunks and rank by shared words (weighted by rarity) ----
const STOP = new Set('the a an and or of to in is are was for on with as by at it this that be from how what why do does i you my me find solve'.split(' '));
const words = (s) => (String(s).toLowerCase().match(/[a-z0-9]{2,}/g) || []).filter((w) => !STOP.has(w));

function chunks(text, size = 1200) {
  const out = [];
  let cur = '';
  for (const para of String(text).split(/\n\s*\n/)) {
    if (cur && cur.length + para.length > size) { out.push(cur.trim()); cur = ''; }
    cur += para + '\n\n';
    while (cur.length > size * 1.6) { out.push(cur.slice(0, size).trim()); cur = cur.slice(size); }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function search(docs, query, k = 3) {
  const q = [...new Set(words(query))];
  if (!q.length) return [];
  const all = [];
  docs.forEach((d) => chunks(d.text).forEach((c) => all.push({ doc: d.name, text: c, ws: new Set(words(c)) })));
  if (!all.length) return [];
  const df = {};
  q.forEach((w) => { df[w] = all.filter((c) => c.ws.has(w)).length; });
  return all
    .map((c) => ({ doc: c.doc, text: c.text, score: q.reduce((s, w) => s + (c.ws.has(w) ? Math.log(1 + all.length / (1 + df[w])) : 0), 0) }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

module.exports = { typeOf, extractText, search, chunks };
