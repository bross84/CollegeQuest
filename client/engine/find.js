// Search inside one class: every word you type must appear, in a document's text or in a problem from the bank.
let FIND = { q: '', res: null };
const findHash = (q) => `${baseHash()}/search/${encodeURIComponent(q)}`;
const searchBoxHTML = () => `<form class="sbox" data-form="class-search" role="search" autocomplete="off"><input class="line" type="search" name="q" maxlength="200" placeholder="Search this class" aria-label="Search this class" value="${esc(ROUTE && ROUTE.view === 'search' ? ROUTE.q : '')}"></form>`;
const hilite = (text, q) => {
  const terms = [...new Set(q.toLowerCase().split(/\s+/).filter(Boolean))], low = text.toLowerCase();
  let out = '', i = 0;
  while (i < text.length) {
    const t = terms.find((w) => low.startsWith(w, i));
    if (t) { out += '<mark>' + esc(text.slice(i, i + t.length)) + '</mark>'; i += t.length; } else { out += esc(text[i]); i++; }
  }
  return out;
};
const chapterName = (id) => (chapterById(id) ? chapterById(id).title : 'Not filed under a chapter');

function findResultsHTML(q) {
  const r = FIND.res;
  if (!r || FIND.q !== q) return '<small>Searching…</small>';
  if (!r.docs.length && !r.problems.length) return `<p>Nothing in this class matches “${esc(q)}”. Every word has to appear, so try fewer or shorter words.</p>`;
  const docs = r.docs.map((d) => `<div class="docrow"><div class="dtop"><span class="dk">${KIND_LABEL[d.kind] || 'File'}</span>${d.tag ? `<span class="dk tag-${d.tag}">${TAG_LABEL[d.tag]}</span>` : ''}
      <a class="dn" href="/api/docs/${d.id}/file" target="_blank" rel="noopener">${hilite(d.name, q)}</a><small>${esc(chapterName(d.chapterId))}</small></div>
      ${d.snippets.map((s) => `<p class="snip">${hilite(s, q)}</p>`).join('')}</div>`).join('');
  const probs = r.problems.map((p) => `<div class="docrow"><div class="dtop"><span class="dk">${SRC_LABEL[srcOf(p)]}</span><small>${esc(chapterName(p.chapterId))}</small>
      <a class="link" href="${p.chapterId ? chHash(p.chapterId, 'practice') : routeHash('exams')}">Open</a></div>
      <p class="snip">${hilite(p.text.replace(/\s+/g, ' ').slice(0, 320), q)}</p></div>`).join('');
  return `${docs ? `<section class="zone"><h3>${plural(r.docs.length, 'document')}</h3>${docs}</section>` : ''}${probs ? `<section class="zone"><h3>${plural(r.problems.length, 'problem')}</h3>${probs}</section>` : ''}`;
}
const searchPageHTML = (q) => `<h1 class="ptitle">Search</h1><p class="lead">Documents and problems in ${esc(CLASS.name)} that contain “${esc(q)}”.</p><div id="srch">${findResultsHTML(q)}</div>`;
async function runFind(q) {
  let res;
  try { res = await api('GET', `/api/classes/${CLASS.id}/find?q=${encodeURIComponent(q)}`); } catch (e) { if (e.code === 'auth_required') throw e; res = { docs: [], problems: [] }; }
  FIND = { q, res };
  const el = document.getElementById('srch');
  if (el && ROUTE && ROUTE.view === 'search' && ROUTE.q === q) el.innerHTML = findResultsHTML(q);
}
