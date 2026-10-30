// The learning path: a chapter's study-guide sections one after another. A section opens with a short read, then a few
// questions (its recall cards plus a couple of problems from the bank that match it). "Continue" picks up at the next
// section that isn't finished, so you can open the app and start working.
const secsOf = (g) => (g.sections.length ? g.sections : [{ heading: g.title, summary: '', points: [], terms: [], video: '' }]);
const cardSec = (g, c) => Math.max(0, secsOf(g).findIndex((s) => s.heading === c.topic));

// Every section in reading order: chapters as listed, then guides with no chapter; a chapter's guides oldest first.
function pathList() {
  const out = [];
  [...CHAPTERS, ...(unsortedCount() ? [UNSORTED] : [])].forEach((ch) => {
    GUIDES.filter((g) => inChapter(g, ch.id)).slice().sort((a, b) => a.createdAt - b.createdAt).forEach((g) => {
      secsOf(g).forEach((sec, i) => {
        const cards = g.cards.map((c, k) => ({ g, c, i: k, id: cardId(g, k) })).filter((x) => cardSec(g, x.c) === i);
        out.push({ ch, g, i, sec, cards });
      });
    });
  });
  return out;
}
const pathAt = (gid, i) => pathList().find((p) => p.g.id === gid && p.i === i);
// 'read' = nothing to ask; 'new' = not started; 'working' = some missed or unseen; 'done' = every question answered right at least once
function secState(p) {
  if (!p.cards.length) return 'read';
  const recs = p.cards.map((x) => cardRec(x.id));
  if (recs.every((r) => r && r.box >= 1)) return 'done';
  return recs.some(Boolean) ? 'working' : 'new';
}
const todo = (p) => { const s = secState(p); return s === 'new' || s === 'working'; };
const nextAfter = (p) => { const l = pathList(), k = l.findIndex((x) => x.g.id === p.g.id && x.i === p.i); return l.slice(k + 1).find(todo) || null; };

// Problems from the bank that match the section and have a short answer a typed reply can be checked against.
function sectionProblems(p) {
  const chId = p.ch.unsorted ? null : p.ch.id;
  const pool = allProblems().filter((q) => q.kind === 'original' && q.answer && q.answer.length <= 60 && q.text.length <= 240
    && (chId ? q.chapterId === chId : !q.chapterId) && ((cardRec('p:' + q.id) || {}).box || 0) < 2);
  if (!pool.length) return [];
  const about = `${p.sec.heading} ${p.sec.summary} ${p.sec.terms.map((t) => t.term).join(' ')}`;
  const pseudo = { id: p.g.id, title: p.g.title, sections: p.g.sections, cards: pool.map((q) => ({ a: cleanGlyphs(q.answer) })) }; // wrong choices come from other problems' answers
  return shortlist([{ text: about }], pool, 2)[0].map((q) => ({ g: pseudo, c: { q: cleanGlyphs(q.text.replace(/\s+/g, ' ')), a: cleanGlyphs(q.answer), accept: [], wrong: [], topic: p.sec.heading }, i: 0, id: 'p:' + q.id }));
}

// ---- walking a section ----
function showSection(gid, i) {
  const p = pathAt(gid, i);
  if (!p) return renderHome();
  round = null; W.id = null; Q = null;
  const s = p.sec, inCh = pathList().filter((x) => x.ch.id === p.ch.id), n = inCh.findIndex((x) => x.g.id === p.g.id && x.i === p.i) + 1;
  app.innerHTML = `<div class="rbar"><button class="link" data-act="g-learn" data-ch="${p.ch.id}">‹ ${esc(p.ch.title)}</button><span class="progress">Section ${n} of ${inCh.length}</span></div>
  <div class="prob"><div class="eyebrow">${esc(p.ch.title)}</div><h2 class="gtitle">${esc(s.heading)}</h2>
    ${s.summary ? `<p>${esc(s.summary)}</p>` : ''}
    ${s.points.length ? `<ul class="gpts">${s.points.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    ${s.terms.length ? `<dl class="gterms">${s.terms.map((t) => `<dt>${esc(t.term)}</dt><dd>${esc(t.def)}</dd>`).join('')}</dl>` : ''}
    <div class="acts"><button class="btn" id="nextbtn" data-act="g-secgo" data-id="${p.g.id}" data-i="${p.i}">${p.cards.length ? 'Start the questions' : 'Next section'}</button>${videosHTML(s.video || `${s.heading} ${CLASS.name}`, true)}</div></div>`;
  window.scrollTo(0, 0);
  const b = document.getElementById('nextbtn'); if (b) b.focus();
}
async function startSectionQuiz(gid, i) {
  const p = pathAt(gid, i);
  if (!p) return renderHome();
  if (!p.cards.length) { const nx = nextAfter(p); return nx ? showSection(nx.g.id, nx.i) : go(chHash(p.ch.id, 'learn')); }
  if (!PLOADED) await loadProblems().catch(() => {});
  const items = shuffle([...shuffle(p.cards).slice(0, 6), ...sectionProblems(p)]);
  round = null; W.id = null;
  Q = { guideId: gid, chapterId: p.ch.unsorted ? null : p.ch.id, path: { gid, i }, askOpen: false, items, i: 0, results: [], extra: false, state: 'ask', typed: '', choices: null, ans: -1, wrong: [], tries: 0 };
  renderQuiz();
}
// Reads the chapter's documents into a study guide in one go, then lands on the chapter's sections.
function prepareChapter(chId) {
  const ch = chapterById(chId) || UNSORTED;
  resetGB(); GB.chapterId = ch.unsorted ? null : ch.id; GB.auto = true; GB.title = ch.title;
  DOCS.filter((d) => (ch.unsorted ? !d.chapterId : d.chapterId === ch.id) && d.chars && d.tag !== 'exam').forEach((d) => GB.docs.add(d.id));
  if (!GB.docs.size) { GB.err = 'There is nothing readable in this chapter yet.'; return renderBuilder(); }
  return gBuild();
}

// ---- screens ----
// The big button on the course home: the next unfinished section, or what to do to get one.
function continueHTML() {
  if (!CHAPTERS.length) return '';
  const list = pathList(), next = list.find(todo);
  if (next) {
    const inCh = list.filter((x) => x.ch.id === next.ch.id), n = inCh.indexOf(next) + 1, st = secState(next);
    return `<section class="zone cont"><div class="eyebrow">${esc(next.ch.title)} &middot; section ${n} of ${inCh.length}</div><h2 class="gtitle">${esc(next.sec.heading)}</h2>
      <small>${st === 'working' ? 'Pick up where you left off.' : 'A short read, then a few questions.'}</small>
      <div class="acts"><button class="btn big" data-act="g-sec" data-id="${next.g.id}" data-i="${next.i}">${st === 'working' ? 'Continue' : 'Start'}</button></div></section>`;
  }
  if (list.length) return '<section class="zone cont"><div class="eyebrow">Study path</div><h2 class="gtitle">You’ve been through every section.</h2><small>Review what’s due below, or build a practice exam from the Exams page.</small></section>';
  const ready = CHAPTERS.find((c) => DOCS.some((d) => d.chapterId === c.id && d.chars && d.tag !== 'exam'));
  return ready
    ? `<section class="zone cont"><div class="eyebrow">Get started</div><h2 class="gtitle">${esc(ready.title)}</h2><small>The AI reads the chapter once and splits it into short sections with questions. A long chapter takes a few minutes.</small>
      <div class="acts"><button class="btn big" data-act="g-prep" data-ch="${ready.id}" ${smp ? '' : 'disabled'}>Prepare this chapter</button></div></section>`
    : `<section class="zone cont"><div class="eyebrow">Get started</div><h2 class="gtitle">Upload a chapter</h2><small>Add the chapter’s text and it becomes short sections with questions.</small>
      <div class="acts"><a class="btn big" href="${chHash(CHAPTERS[0].id, 'materials')}">Upload materials</a></div></section>`;
}
// A chapter's Learn tab: its sections with where you are in each.
function learnTab(ch) {
  const list = pathList().filter((p) => p.ch.id === ch.id), docs = docsIn(ch).filter((d) => d.chars && d.tag !== 'exam');
  if (!list.length) {
    return docs.length
      ? `<div class="empty"><p>Turn this chapter into short sections with questions.</p><button class="btn big" data-act="g-prep" data-ch="${ch.id}" ${smp ? '' : 'disabled'}>Prepare this chapter</button>
        <small>The AI reads the chapter once; a long one takes a few minutes. ${smp ? '' : 'It needs the AI, which isn’t set up on this server.'}</small></div>`
      : `<div class="empty"><p>No materials in this chapter yet.</p><a class="btn big" href="${chHash(ch.id, 'materials')}">Upload materials</a><small>Add the chapter’s text. Practice exams go on the Exams page.</small></div>`;
  }
  const label = { new: 'To do', working: 'In progress', done: 'Done', read: 'Read' }, next = list.find(todo), due = chapterDue(ch.id);
  const row = (p) => {
    const st = secState(p);
    return `<div class="secrow"><span class="pill ${st === 'done' ? 'done' : st === 'read' ? '' : 'todo'}">${label[st]}</span>
      <span><b>${esc(p.sec.heading)}</b><small>${p.cards.length ? plural(p.cards.length, 'question') : 'reading only'}</small></span>
      <button class="btn alt sm" data-act="g-sec" data-id="${p.g.id}" data-i="${p.i}">${st === 'done' ? 'Again' : st === 'working' ? 'Continue' : 'Start'}</button></div>`;
  };
  return `${next ? `<div class="acts"><button class="btn big" data-act="g-sec" data-id="${next.g.id}" data-i="${next.i}">${secState(next) === 'working' ? 'Continue' : 'Start'}: ${esc(next.sec.heading)}</button></div>` : '<small>You’ve been through every section here.</small>'}
    <section class="zone"><h3>Sections &middot; ${list.length}</h3>${list.map(row).join('')}</section>
    ${due ? `<div class="acts"><button class="btn alt" data-act="g-quiz" data-ch="${ch.id}">Review ${plural(due, 'question')} due</button></div>` : ''}`;
}
