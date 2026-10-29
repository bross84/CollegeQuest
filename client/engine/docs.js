// Documents: each class keeps its own files (photos, PDFs, Word, text). They feed the problem finder,
// and their text is searched so the tutor can quote your own notes and textbook.
let DOCS = [];
let DU = { busy: false, msg: '', err: '', delId: null, name: '', text: '' };
const DOC_ACCEPT = 'image/*,.pdf,.docx,.txt,.md,text/plain';
const KIND_LABEL = { image: 'Photo', pdf: 'PDF', docx: 'Word', text: 'Text' };
const fmtSize = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');

async function loadDocs() {
  try { DOCS = await api('GET', `/api/classes/${CLASS.id}/docs`); } catch (e) { if (e.code === 'auth_required') throw e; DOCS = []; }
}

// Excerpts of your own materials that match a question, formatted to append to an AI prompt. Never throws.
async function classContext(q) {
  if (!CLASS || !DOCS.some((d) => d.useContext && d.chars)) return '';
  try {
    const hits = await api('POST', `/api/classes/${CLASS.id}/search`, { q });
    if (!hits.length) return '';
    return '\n\nExcerpts from the student’s own class materials (use them if relevant, ignore them if not):\n' + hits.map((h) => `[${h.doc}]\n${h.text}`).join('\n---\n');
  } catch (e) { return ''; }
}

// Home-screen card.
function docsSection() {
  const rows = DOCS.slice(0, 3).map((d) => `<div class="docrow compact"><span class="dk">${KIND_LABEL[d.kind]}</span><span class="dn">${esc(d.name)}</span></div>`).join('');
  return `<section class="zone"><h3>Documents${DOCS.length ? ` &middot; ${DOCS.length}` : ''}</h3><div class="mine">${rows}
    <div class="row"><button class="btn ${DOCS.length ? 'alt' : ''}" data-act="d-open">${DOCS.length ? 'Manage documents' : 'Add documents'}</button>${DOCS.length ? '<button class="btn alt" data-act="u-open">Find problems in them</button>' : ''}</div></div>
    ${DOCS.length ? '' : '<small>Upload your syllabus, notes, worksheets or textbook pages (photos, PDF, Word, text). I can pull the problems out, and the tutor can use them when you ask a question.</small>'}</section>`;
}

function renderDocs() {
  W.id = null;
  const rows = DOCS.map((d) => `<div class="docrow">
      <div class="dtop"><span class="dk">${KIND_LABEL[d.kind]}</span><a class="dn" href="/api/docs/${d.id}/file" target="_blank" rel="noopener">${esc(d.name)}</a>
        <small>${fmtSize(d.size)}${d.chars ? ` &middot; ${d.chars.toLocaleString()} characters read` : ''}</small></div>
      ${d.note ? `<small class="warn">${esc(d.note)}</small>` : ''}
      <div class="dact">
        ${d.chars ? `<button class="link" data-act="g-new" data-id="${d.id}">Study guide</button>` : ''}
        ${d.kind === 'image' || d.chars ? `<button class="link" data-act="u-open" data-id="${d.id}">Find problems</button>` : ''}
        ${d.chars ? `<label class="chk"><input type="checkbox" data-act="d-ctx" data-id="${d.id}" ${d.useContext ? 'checked' : ''}> Tutor can use this</label>` : ''}
        <button class="link" data-act="d-rename" data-id="${d.id}">Rename</button>
        <button class="link" data-act="d-del" data-id="${d.id}">${DU.delId === d.id ? 'Really delete? Click again' : 'Delete'}</button>
      </div></div>`).join('');
  app.innerHTML = `<div class="rbar"><button class="link" data-act="d-home">‹ Back</button></div>
  <div class="prob"><div class="eyebrow">Documents &middot; ${esc(CLASS.name)}</div>
    <p class="lead">Files stay with this class. Photos, PDFs (with selectable text), Word files and plain text work. Scanned PDFs: upload the pages as photos.</p>
    <div class="answer"><label class="btn ${DU.busy ? 'alt' : ''}" for="dfile">${DU.busy ? 'Uploading…' : 'Upload files'}</label>
      <input type="file" id="dfile" multiple accept="${DOC_ACCEPT}" hidden ${DU.busy ? 'disabled' : ''}>
      ${aiStatus.images ? '<label class="btn alt" for="dcam">Take a photo</label><input type="file" id="dcam" accept="image/*" capture="environment" hidden>' : ''}</div>
    ${DU.msg ? `<div class="fb good" role="status"><p>${esc(DU.msg)}</p></div>` : ''}${DU.err ? `<div class="fb no" role="status"><p>${esc(DU.err)}</p></div>` : ''}
    <label class="field" for="dnote">Or paste text as a note</label>
    <input class="line" id="dnote-name" type="text" maxlength="120" placeholder="Name, e.g. Ch. 3 notes" value="${esc(DU.name)}">
    <textarea id="dnote" rows="4" placeholder="Paste notes, a worksheet or problems here">${esc(DU.text)}</textarea>
    <div class="answer"><button class="btn alt" data-act="d-note">Save note</button></div></div>
  <section class="zone"><h3>${DOCS.length ? plural(DOCS.length, 'document') : 'No documents yet'}</h3>${rows}</section>`;
}
function syncDU() {
  const n = document.getElementById('dnote'), nn = document.getElementById('dnote-name');
  if (n) DU.text = n.value;
  if (nn) DU.name = nn.value;
}

// Upload files to this class. Photos are shrunk first. Returns the new documents.
async function uploadFiles(files) {
  const fd = new FormData();
  const skipped = [];
  for (const f of files) {
    if (f.type.startsWith('image/')) {
      try { const b = await shrinkImage(f, 1800); fd.append('files', b, b === f ? f.name : f.name.replace(/\.[^.]+$/, '') + '.jpg'); }
      catch (e) { skipped.push(e.message); }
    } else fd.append('files', f, f.name);
  }
  if (![...fd.keys()].length) throw new Error(skipped[0] || 'Nothing to upload.');
  const made = await api('POST', `/api/classes/${CLASS.id}/docs`, fd);
  DOCS = [...made, ...DOCS];
  if (skipped.length) throw Object.assign(new Error(skipped.join(' ')), { made });
  return made;
}
async function handleUploads(files) {
  DU.busy = true; DU.msg = ''; DU.err = ''; renderDocs();
  try { const made = await uploadFiles(files); DU.msg = `Added ${plural(made.length, 'file')}.`; }
  catch (e) { DU.err = e.message; if (e.made) DU.msg = `Added ${plural(e.made.length, 'file')}.`; }
  DU.busy = false; renderDocs();
}

async function docAct(act, t) {
  syncDU();
  const id = t.dataset && t.dataset.id;
  if (act !== 'd-del') DU.delId = null;
  if (act === 'd-open') { DU.msg = ''; DU.err = ''; renderDocs(); }
  else if (act === 'd-home') renderHome();
  else if (act === 'd-note') {
    if (!DU.text.trim()) { DU.err = 'Paste some text first.'; return renderDocs(); }
    try { DOCS.unshift(await api('POST', `/api/classes/${CLASS.id}/notes`, { name: DU.name, text: DU.text })); DU.text = ''; DU.name = ''; DU.err = ''; DU.msg = 'Note saved.'; }
    catch (e) { DU.err = e.message; }
    renderDocs();
  } else if (act === 'd-ctx') {
    try { const d = await api('PATCH', `/api/docs/${id}`, { useContext: t.checked }); DOCS = DOCS.map((x) => (x.id === id ? d : x)); } catch (e) { DU.err = e.message; }
    renderDocs();
  } else if (act === 'd-rename') {
    const cur = DOCS.find((x) => x.id === id), name = window.prompt('Rename document', cur ? cur.name : '');
    if (name && name.trim()) { try { const d = await api('PATCH', `/api/docs/${id}`, { name }); DOCS = DOCS.map((x) => (x.id === id ? d : x)); } catch (e) { DU.err = e.message; } renderDocs(); }
  } else if (act === 'd-del') {
    if (DU.delId !== id) { DU.delId = id; return renderDocs(); }
    try { await api('DELETE', `/api/docs/${id}`); DOCS = DOCS.filter((x) => x.id !== id); U.docs.delete(id); } catch (e) { DU.err = e.message; }
    DU.delId = null; renderDocs();
  }
}
app.addEventListener('change', (e) => {
  const t = e.target;
  if ((t.id === 'dfile' || t.id === 'dcam') && t.files && t.files.length) { const files = [...t.files]; t.value = ''; handleUploads(files); }
});
