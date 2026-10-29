// Documents: each class keeps its own files (photos, PDFs, Word, text), sorted into chapters. They feed the problem
// finder and the problem bank, and their text is searched so the tutor can quote your own notes and textbook.
let DOCS = [];
let DU = { busy: false, msg: '', err: '', delId: null, name: '', text: '', offer: [] }; // offer: uploads that can become a problem bank
const DSEL = new Set(); // documents ticked for "Move to chapter"
const DOC_ACCEPT = 'image/*,.pdf,.docx,.txt,.md,text/plain';
const KIND_LABEL = { image: 'Photo', pdf: 'PDF', docx: 'Word', text: 'Text' };
const TAG_LABEL = { '': 'Untagged', exam: 'Practice exam', textbook: 'Textbook', notes: 'Notes', slides: 'Slides' };
const fmtSize = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');

async function loadDocs() {
  try { DOCS = await api('GET', `/api/classes/${CLASS.id}/docs`); } catch (e) { if (e.code === 'auth_required') throw e; DOCS = []; }
}

// Excerpts of your own materials that match a question, formatted to append to an AI prompt. The current chapter's
// documents are preferred. Never throws.
async function classContext(q, chapterId = curChapterId()) {
  if (!CLASS || !DOCS.some((d) => d.useContext && d.chars)) return '';
  try {
    const hits = await api('POST', `/api/classes/${CLASS.id}/search`, { q, chapterId });
    if (!hits.length) return '';
    return '\n\nExcerpts from the student’s own class materials (use them if relevant, ignore them if not):\n' + hits.map((h) => `[${h.doc}]\n${h.text}`).join('\n---\n');
  } catch (e) { return ''; }
}

const tagOptions = (cur) => Object.entries(TAG_LABEL).map(([k, l]) => `<option value="${k}" ${cur === k ? 'selected' : ''}>${l}</option>`).join('');

// One uploaded document: open it, tag it, move it, and the things you can make from it.
function docRowHTML(d, bulk) {
  const canBank = !!d.chars;
  return `<div class="docrow">
      <div class="dtop">${bulk ? `<input type="checkbox" data-act="d-sel" data-id="${d.id}" aria-label="Select ${esc(d.name)}" ${DSEL.has(d.id) ? 'checked' : ''}>` : ''}
        <span class="dk">${KIND_LABEL[d.kind]}</span>${d.tag ? `<span class="dk tag-${d.tag}">${TAG_LABEL[d.tag]}</span>` : ''}
        <a class="dn" href="/api/docs/${d.id}/file" target="_blank" rel="noopener">${esc(d.name)}</a>
        <small>${fmtSize(d.size)}${d.chars ? ` &middot; ${d.chars.toLocaleString()} characters read` : ''}</small></div>
      ${d.note ? `<small class="warn">${esc(d.note)}</small>` : ''}
      <div class="dact">
        <select class="line sm" data-dtag="${d.id}" aria-label="Kind of material">${tagOptions(d.tag)}</select>
        <select class="line sm" data-dmove="${d.id}" aria-label="Chapter">${chapterOptions(d.chapterId)}</select>
        ${canBank ? `<button class="btn alt sm" data-act="b-build" data-id="${d.id}" ${BK.busy ? 'disabled' : ''}>${allProblems().some((p) => p.sourceDoc === d.id) ? 'Read problems again' : 'Read its problems'}</button>` : ''}
        ${d.chars ? `<button class="link" data-act="g-new" data-id="${d.id}">Study guide</button>` : ''}
        ${d.kind === 'image' || d.chars ? `<button class="link" data-act="u-open" data-id="${d.id}">Find problems</button>` : ''}
        ${d.chars ? `<label class="chk"><input type="checkbox" data-act="d-ctx" data-id="${d.id}" ${d.useContext ? 'checked' : ''}> Tutor can use this</label>` : ''}
        <button class="link" data-act="d-rename" data-id="${d.id}">Rename</button>
        <button class="link" data-act="d-del" data-id="${d.id}">${DU.delId === d.id ? 'Really delete? Click again' : 'Delete'}</button>
      </div></div>`;
}
const pasteNoteHTML = (open) => `<details class="paste" ${open ? 'open' : ''}><summary>Paste text as a note</summary>
    <input class="line" id="dnote-name" type="text" maxlength="120" placeholder="Name, e.g. Ch. 3 notes" value="${esc(DU.name)}">
    <textarea id="dnote" rows="4" placeholder="Paste notes, a worksheet or problems here">${esc(DU.text)}</textarea>
    <div class="answer"><button class="btn alt" data-act="d-note">Save note</button></div></details>`;
const upMsgHTML = () => `${DU.msg ? `<div class="fb good" role="status"><p>${esc(DU.msg)}</p>${DU.offer.map((id) => { const d = DOCS.find((x) => x.id === id); return d ? `<div class="acts"><button class="btn sm" data-act="b-build" data-id="${d.id}">Read the problems in ${esc(d.name)}</button></div>` : ''; }).join('')}</div>` : ''}${DU.err ? `<div class="fb no" role="status"><p>${esc(DU.err)}</p></div>` : ''}`;

// "All documents": every upload in the class, whatever its chapter, with a bulk move.
function docsPageHTML() {
  const rows = DOCS.map((d) => docRowHTML(d, true)).join('');
  return `<h1 class="ptitle">All documents</h1>
  <p class="lead">Files stay with this class. Photos, PDFs (with selectable text), Word files and plain text work. Scanned PDFs: upload the pages as photos. Use the Materials tab of a chapter to upload straight into it.</p>
  <div class="answer"><label class="btn ${DU.busy ? 'alt' : ''}" for="dfile">${DU.busy ? 'Uploading…' : 'Upload files'}</label>
    <input type="file" id="dfile" multiple accept="${DOC_ACCEPT}" hidden ${DU.busy ? 'disabled' : ''}>
    ${aiStatus.images ? '<label class="btn alt" for="dcam">Take a photo</label><input type="file" id="dcam" accept="image/*" capture="environment" hidden>' : ''}</div>
  ${upMsgHTML()}${pasteNoteHTML(false)}
  <section class="zone"><h3>${DOCS.length ? plural(DOCS.length, 'document') : 'No documents yet'}</h3>
    ${DOCS.length && CHAPTERS.length ? `<div class="bulk"><small>${DSEL.size ? plural(DSEL.size, 'document') + ' selected' : 'Tick documents to move them together'}</small>
      <select class="line sm" id="dmoveall" aria-label="Move selected to">${chapterOptions('')}</select><button class="btn alt sm" data-act="d-moveall" ${DSEL.size ? '' : 'disabled'}>Move to chapter</button></div>` : ''}
    ${rows}</section>`;
}
function syncDU() {
  const n = document.getElementById('dnote'), nn = document.getElementById('dnote-name');
  if (n) DU.text = n.value;
  if (nn) DU.name = nn.value;
}
const refreshDocs = () => renderRoute(true);

// Upload files to this class (into a chapter, with a kind, when given). Photos are shrunk first. Returns the new documents.
async function uploadFiles(files, opts = {}) {
  const fd = new FormData();
  const skipped = [];
  for (const f of files) {
    if (f.type.startsWith('image/')) {
      try { const b = await shrinkImage(f, 1800); fd.append('files', b, b === f ? f.name : f.name.replace(/\.[^.]+$/, '') + '.jpg'); }
      catch (e) { skipped.push(e.message); }
    } else fd.append('files', f, f.name);
  }
  if (![...fd.keys()].length) throw new Error(skipped[0] || 'Nothing to upload.');
  const qs = new URLSearchParams({ ...(opts.chapterId ? { chapterId: opts.chapterId } : {}), ...(opts.tag ? { tag: opts.tag } : {}) }).toString();
  const made = await api('POST', `/api/classes/${CLASS.id}/docs${qs ? '?' + qs : ''}`, fd);
  DOCS = [...made, ...DOCS];
  if (skipped.length) throw Object.assign(new Error(skipped.join(' ')), { made });
  return made;
}
async function handleUploads(files, opts) {
  DU.busy = true; DU.msg = ''; DU.err = ''; DU.offer = []; refreshDocs();
  try {
    const made = await uploadFiles(files, opts);
    DU.msg = `Added ${plural(made.length, 'file')}.`;
    DU.offer = made.filter((d) => d.chars && (d.tag === 'exam' || d.tag === 'textbook' || d.chapterId)).map((d) => d.id);
    if (opts && opts.chapterId && !(opts.tag)) DU.msg += '';
    await loadChapters();
  }
  catch (e) { DU.err = e.message; if (e.made) DU.msg = `Added ${plural(e.made.length, 'file')}.`; }
  DU.busy = false; refreshDocs();
}
const patchDoc = async (id, body) => { const d = await api('PATCH', `/api/docs/${id}`, body); DOCS = DOCS.map((x) => (x.id === id ? d : x)); return d; };

async function docAct(act, t) {
  syncDU();
  const id = t.dataset && t.dataset.id;
  if (act !== 'd-del') DU.delId = null;
  if (act === 'd-sel') { if (t.checked) DSEL.add(id); else DSEL.delete(id); return refreshDocs(); }
  if (act === 'd-open') { DU.msg = ''; DU.err = ''; go(routeHash('docs')); }
  else if (act === 'd-home') renderHome();
  else if (act === 'd-note') {
    if (!DU.text.trim()) { DU.err = 'Paste some text first.'; return refreshDocs(); }
    const ch = ROUTE && ROUTE.view === 'chapter' ? ROUTE.realId : null;
    try { DOCS.unshift(await api('POST', `/api/classes/${CLASS.id}/notes`, { name: DU.name, text: DU.text, chapterId: ch })); DU.text = ''; DU.name = ''; DU.err = ''; DU.msg = 'Note saved.'; }
    catch (e) { DU.err = e.message; }
    refreshDocs();
  } else if (act === 'd-ctx') {
    try { await patchDoc(id, { useContext: t.checked }); } catch (e) { DU.err = e.message; }
    refreshDocs();
  } else if (act === 'd-rename') {
    const cur = DOCS.find((x) => x.id === id), name = window.prompt('Rename document', cur ? cur.name : '');
    if (name && name.trim()) { try { await patchDoc(id, { name }); } catch (e) { DU.err = e.message; } refreshDocs(); }
  } else if (act === 'd-moveall') {
    const to = document.getElementById('dmoveall').value;
    try { for (const x of [...DSEL]) await patchDoc(x, { chapterId: to || null }); DU.msg = `Moved ${plural(DSEL.size, 'document')}.`; DSEL.clear(); await loadChapters(); }
    catch (e) { DU.err = e.message; }
    refreshDocs();
  } else if (act === 'd-del') {
    if (DU.delId !== id) { DU.delId = id; return refreshDocs(); }
    try { await api('DELETE', `/api/docs/${id}`); DOCS = DOCS.filter((x) => x.id !== id); U.docs.delete(id); DSEL.delete(id); await loadChapters(); } catch (e) { DU.err = e.message; }
    DU.delId = null; refreshDocs();
  }
}
app.addEventListener('change', async (e) => {
  const t = e.target;
  if ((t.id === 'dfile' || t.id === 'dcam' || t.id === 'xfile') && t.files && t.files.length) { const files = [...t.files]; t.value = ''; handleUploads(files, t.id === 'xfile' ? { tag: 'exam' } : undefined); }
  else if (t.dataset && t.dataset.dtag !== undefined && t.matches('select')) { try { await patchDoc(t.dataset.dtag, { tag: t.value }); } catch (err) { DU.err = err.message; } refreshDocs(); }
  else if (t.dataset && t.dataset.dmove !== undefined && t.matches('select')) {
    try { await patchDoc(t.dataset.dmove, { chapterId: t.value || null }); await loadChapters(); } catch (err) { DU.err = err.message; }
    refreshDocs();
  }
});
