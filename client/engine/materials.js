// Find problems: pick documents from this class (or paste text) and the AI lists the problems in them.
// Each imported problem is tagged with a topic and (when the subject has practice skills) a skill,
// which steers the daily quest toward what you're actually working on.
let U = { docs: new Set(), text: '', found: null, topic: '', busy: false, err: '', note: '', ctl: null };
const resetU = () => { U = { docs: new Set(), text: '', found: null, topic: '', busy: false, err: '', note: '', ctl: null }; };
const NUMBERED = /^\(?\d+[.)]\s+/;
const CHUNK = 12000, MAX_PARTS = 10;

// No-AI fallback: split pasted text on "1." / "2)" numbering, else one problem per line.
function splitLocal(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.some((l) => NUMBERED.test(l))) return lines;
  const out = [];
  lines.forEach((l) => { if (NUMBERED.test(l)) out.push(l.replace(NUMBERED, '')); else if (out.length) out[out.length - 1] += ' ' + l; });
  return out;
}
function splitChunks(text) {
  const out = [];
  while (text.length > CHUNK) {
    let cut = text.lastIndexOf('\n', CHUNK);
    if (cut < CHUNK * 0.5) cut = CHUNK;
    out.push(text.slice(0, cut)); text = text.slice(cut);
  }
  if (text.trim()) out.push(text);
  return out;
}
function syncU() {
  const t = document.getElementById('utext'); if (t) U.text = t.value;
  document.querySelectorAll('input[data-udoc]').forEach((c) => { if (c.checked) U.docs.add(c.dataset.udoc); else U.docs.delete(c.dataset.udoc); });
}

function renderUpload() {
  W.id = null;
  const usable = DOCS.filter((d) => d.kind === 'image' || d.chars);
  const docList = usable.length
    ? `<div class="found">${usable.map((d) => `<label class="pick"><input type="checkbox" data-udoc="${d.id}" ${U.docs.has(d.id) ? 'checked' : ''}><span>${esc(d.name)} <small>${KIND_LABEL[d.kind]}</small></span></label>`).join('')}</div>`
    : '<small>No documents yet. Upload some below, or paste the text.</small>';
  const found = U.found ? `<div class="fb good" role="status"><h3>Found ${U.found.length} problem${U.found.length === 1 ? '' : 's'}${U.topic ? ' &middot; ' + esc(U.topic) : ''}</h3>
    <small>Untick anything that isn’t a problem for you to solve, and fix typos after adding.</small>
    <div class="found">${U.found.map((p, i) => `<label class="pick"><input type="checkbox" data-i="${i}" checked><span>${fmtMath(p.text)}</span></label>`).join('')}</div>
    <div class="acts"><button class="btn" data-act="u-add">Add selected to My homework</button></div></div>` : '';
  app.innerHTML = `<div class="rbar"><button class="link" data-act="u-home">‹ Back</button></div>
  <div class="prob"><div class="eyebrow">Find problems</div>
    <p class="lead">Choose the documents to read, or paste the problems. I’ll pull out what you’re expected to solve so you can pick what to work on${SKILLS.length ? ', and your practice will lean toward those topics' : ''}.</p>
    ${docList}
    <div class="answer"><label class="btn alt" for="ufile">Upload files</label>
      <input type="file" id="ufile" multiple accept="${DOC_ACCEPT}" hidden></div>
    <label class="field" for="utext">Or paste the problems</label>
    <textarea id="utext" rows="5" placeholder="1. ...&#10;2. ...">${esc(U.text)}</textarea>
    <div class="answer"><button class="btn" data-act="u-find" ${U.busy ? 'disabled' : ''}>${U.busy ? esc(U.note || 'Reading…') : 'Find the problems'}</button>${U.busy ? '<button class="link" data-act="u-stop">Stop</button>' : ''}</div>
    ${U.err ? `<div class="fb no" role="status"><p>${esc(U.err)}</p></div>` : ''}${found}</div>`;
}

async function uFind() {
  syncU();
  const lim = smpLimits && smpLimits.images, pasted = U.text.trim();
  const picked = DOCS.filter((d) => U.docs.has(d.id));
  U.err = ''; U.found = null; U.topic = '';
  if (!pasted && !picked.length) { U.err = 'Pick a document or paste some problems first.'; return renderUpload(); }
  const photos = picked.filter((d) => d.kind === 'image');
  if (photos.length && !lim) { U.err = 'Reading photos needs the AI with a vision model. Paste the text instead.'; return renderUpload(); }
  if (!smp) {
    if (picked.length && !pasted && photos.length === picked.length) { U.err = 'Reading photos needs the AI, which isn’t set up on this server. Paste the text instead.'; return renderUpload(); }
    let text = pasted;
    for (const d of picked.filter((x) => x.kind !== 'image')) text += '\n' + (await api('GET', `/api/docs/${d.id}/text`)).text;
    U.found = splitLocal(text).slice(0, 60).map((t) => ({ text: t, skill: null }));
    return renderUpload();
  }
  U.busy = true; U.ctl = new AbortController(); U.note = 'Reading…'; renderUpload();
  try {
    // Work out what to send: text in chunks, photos in small batches.
    const parts = [];
    if (pasted) splitChunks(pasted.slice(0, CHUNK * 3)).forEach((t) => parts.push({ text: t }));
    for (const d of picked.filter((x) => x.kind !== 'image')) {
      const t = (await api('GET', `/api/docs/${d.id}/text`)).text;
      splitChunks(t).forEach((c) => parts.push({ text: c }));
    }
    for (let i = 0; i < photos.length; i += lim ? lim.maxCount : 4) parts.push({ images: photos.slice(i, i + lim.maxCount).map((d) => ({ doc: d.id })) });
    const used = parts.slice(0, MAX_PARTS);
    const seen = new Set(), all = [];
    const skillHint = SKILLS.length
      ? `"skill":"one of ${SKILLS.map((s) => s.id + ' (' + s.name + ')').join(', ')}, or null"`
      : '"skill":null';
    for (let i = 0; i < used.length && all.length < 60; i++) {
      U.note = used.length > 1 ? `Reading part ${i + 1} of ${used.length}…` : 'Reading…'; renderUpload();
      const part = used[i];
      const prompt = `You are helping an adult student who is taking "${CLASS.name}". Below are photos and/or text from their class materials (a worksheet, textbook pages, or notes). `
        + 'Find every problem the student is expected to solve. Skip worked examples unless there are no other problems. '
        + `Transcribe each problem as plain text: ${PACK.finder}. Do NOT solve anything.\n\n`
        + `Reply with only this JSON (at most 30 problems):\n{"topic":"short name of the unit or section, e.g. Average rate of change","problems":[{"text":"the problem",${skillHint}}]}\n\n`
        + (part.text ? `Text:\n${part.text}` : '(no text, see the photos)');
      const opts = { signal: U.ctl.signal };
      if (part.images) opts.images = part.images;
      const r = await smp.json(prompt, opts);
      if (!U.topic) U.topic = String((r && r.topic) || '').slice(0, 80);
      (Array.isArray(r && r.problems) ? r.problems : []).forEach((p) => {
        const text = String((p && p.text) || '').trim(), k = text.toLowerCase().replace(/\s+/g, ' ');
        if (text && !seen.has(k)) { seen.add(k); all.push({ text, skill: validSkill(p && p.skill) ? p.skill : null }); }
      });
    }
    U.found = all.slice(0, 60);
    if (!U.found.length) { U.found = null; U.err = 'I couldn’t find any problems in that. Try a clearer photo, or paste the text.'; }
    else if (parts.length > MAX_PARTS) U.err = `That was a lot of material, so I only read the first ${MAX_PARTS} parts. Run it again on the rest.`;
  } catch (e) {
    if (e && e.code !== 'cancelled') U.err = mineErr(e);
  }
  U.busy = false; renderUpload();
}

function uAdd() {
  const picks = [...document.querySelectorAll('input[data-i]:checked')].map((c) => U.found[+c.dataset.i]);
  if (!picks.length) { U.err = 'Tick at least one problem.'; return renderUpload(); }
  picks.forEach((p, i) => S.mine.push({ id: Date.now().toString(36) + i, text: p.text, key: '', status: 'todo', tries: 0, added: dayKey(), topic: U.topic, skill: p.skill }));
  save(); resetU(); renderHome();
}

function uAct(act, t) {
  syncU();
  if (act === 'u-open') { const keep = t && t.dataset && t.dataset.id; resetU(); if (keep) U.docs.add(keep); renderUpload(); }
  else if (act === 'u-home') { if (U.ctl) U.ctl.abort(); resetU(); renderHome(); }
  else if (act === 'u-find') uFind();
  else if (act === 'u-stop') { if (U.ctl) U.ctl.abort(); }
  else if (act === 'u-add') uAdd();
}
app.addEventListener('change', async (e) => {
  const t = e.target;
  if (t.id !== 'ufile' || !t.files || !t.files.length) return;
  syncU();
  const files = [...t.files]; t.value = '';
  U.err = ''; U.busy = true; U.note = 'Uploading…'; renderUpload();
  try { (await uploadFiles(files)).forEach((d) => U.docs.add(d.id)); }
  catch (err) { U.err = err.message; (err.made || []).forEach((d) => U.docs.add(d.id)); }
  U.busy = false; renderUpload();
});
