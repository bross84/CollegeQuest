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
// A section's practice comes straight from your textbook: its problems that test the section are picked once (by the AI, from the
// closest matches) and remembered in S.secpick2, word for word. Exam questions are not used here; they are modelled when you build an exam. AI-written problems (kept in the bank, topic = the section's
// heading) are only a fallback when fewer than three real ones fit.
const secKey = (p) => `${p.g.id}:${p.i}`;
const secPicks = (p) => (((S.secpick2 || {})[secKey(p)]) || []).map((id) => allProblems().find((q) => q.id === id)).filter(Boolean);
// The right answer and the wrong ones a problem can be practised with, or null when it has no way to be asked as multiple choice.
// A written problem can be asked as multiple choice only when it has one short answer: not several parts, and not an
// explain, describe or draw question.
const askable = (q) => {
  const t = String(q.text || '');
  if (/\(\s*a\s*\)/i.test(t) && /\(\s*b\s*\)/i.test(t)) return false;
  if (/\b(explain|describe|discuss|draw|sketch|justify|prove|why)\b/i.test(t)) return false;
  return true;
};
function playOpts(q) {
  if (q.format === 'mc' && q.choices.length >= 2) { const k = keyIndex(q, q.choices); return k < 0 ? null : { right: q.choices[k], wrongs: q.choices.filter((x, i) => i !== k) }; }
  if (!askable(q) || !q.answer || q.answer.length > 80 || q.wrong.length < 2 || q.wrong.some((w) => w.length > 100)) return null;
  return { right: q.answer, wrongs: q.wrong };
}
const secBank = (p) => { const chId = p.ch.unsorted ? null : p.ch.id; return allProblems().filter((q) => q.kind === 'similar' && q.format === 'mc' && q.topic === p.sec.heading && (chId ? q.chapterId === chId : !q.chapterId)); };
const secReal = (p) => [...secPicks(p).filter(playOpts), ...secBank(p)];
const secItems = (p) => (secReal(p).length ? secReal(p).map((q) => 'p:' + q.id) : p.cards.map((x) => x.id));
// 'new' = not started (or no problems picked yet); 'working' = some missed or unseen; 'done' = all answered right at least once;
// 'read' = nothing to ask and no AI to pick problems
function secState(p) {
  const ids = secItems(p);
  if (!ids.length) return smp ? 'new' : 'read';
  const recs = ids.map((id) => cardRec(id));
  if (recs.every((r) => r && r.box >= 1)) return 'done';
  return recs.some(Boolean) ? 'working' : 'new';
}
const todo = (p) => { const s = secState(p); return s === 'new' || s === 'working'; };
const nextAfter = (p) => { const l = pathList(), k = l.findIndex((x) => x.g.id === p.g.id && x.i === p.i); return l.slice(k + 1).find(todo) || null; };
const secNote = (p) => { const n = secItems(p).length; return n ? plural(n, 'question') : smp ? 'practice problems' : 'reading only'; };

// A bank problem as a quiz item: the question as written, its options, and where it came from.
function problemItem(q, p, pseudo) {
  const o = playOpts(q), ref = refOf(q), tidy = (t) => cleanGlyphs(String(t).replace(/\s+/g, ' ').trim());
  const stem = ref ? tidy(q.text).replace(new RegExp('^(?:problem|question|q)?\\s*#?' + ref.replace(/\./g, '\\.') + '[.):]?\\s+', 'i'), '') : tidy(q.text);
  const fixed = q.format === 'mc' && refersToOthers(q.choices) ? q.choices.map(tidy) : null;
  return { g: pseudo, c: { q: stem, a: tidy(o.right), accept: [], wrong: o.wrongs.map(tidy), topic: p.sec.heading, steps: q.steps || [], rich: true, fixed, aiKey: q.kind === 'similar' || q.aiKey, src: srcText(q) }, i: 0, id: 'p:' + q.id };
}
// Looks through the problems read from your exams and text for the ones that test this section and remembers them. The AI chooses
// among the closest matches and writes the wrong options (and an answer when the material gave none); the questions stay as written.
async function pickSectionProblems(p, onNote) {
  const chId = p.ch.unsorted ? null : p.ch.id, pool = allProblems().filter((q) => q.kind === 'original' && (chId ? q.chapterId === chId : !q.chapterId) && srcOf(q) !== 'exam' && q.text.length <= 800 && (q.format === 'mc' || askable(q))); // exam questions are for building exams, not for section practice
  const terms = p.sec.terms.map((t) => t.term).join(', ');
  let cand = pool.length ? shortlist([{ text: `${p.sec.heading} ${p.sec.summary} ${terms}` }], pool, 10)[0] : [];
  if (cand.length < 12) cand = [...cand, ...pool.filter((q) => !cand.includes(q))].slice(0, 12); // little word overlap: let the AI choose from the chapter's problems
  const picked = [];
  if (cand.length) {
    const line = (q, i) => `${i + 1}. [${q.format === 'mc' ? 'multiple choice' : 'written'}] ${q.text.replace(/\s+/g, ' ').slice(0, 400)}${q.format === 'mc' ? ` (options: ${q.choices.join(' | ').slice(0, 300)})` : ''} ${q.answer ? `(answer: ${q.answer.slice(0, 80)})` : '(no answer given)'}`;
    const prompt = `${rules()}\n\nA student is practising the section "${p.sec.heading}" of "${CLASS.name}". ${p.sec.summary ? `The section says: ${p.sec.summary} ` : ''}Below are numbered problems from their own textbook and class materials. `
      + 'Pick up to 5 that really test this section (leave out any about other topics), best first. Only pick problems with one short answer: skip any with several parts (a), (b), (c), and any that ask to explain, describe, draw or discuss. For every pick that is written (not multiple choice), give "wrong": three believable wrong answers, the mistakes students really make, in the same form as the correct answer. '
      + 'Where a problem says "(no answer given)", also give "answer": the correct answer, worked out carefully (for multiple choice, the text of the correct option). Do not change the problems.\n\n'
      + `Reply with only this JSON:\n{"picks":[{"n":1,"wrong":["wrong answer","wrong answer","wrong answer"],"answer":""}]}\n\nProblems:\n${cand.map(line).join('\n')}`;
    const r = await aiJson(prompt, new AbortController(), (n) => onNote(`Waiting for the AI quota (${n}s)…`), 2500);
    for (const x of Array.isArray(r && r.picks) ? r.picks : []) {
      const q = cand[(+(x && x.n) || 0) - 1];
      if (!q || picked.includes(q)) continue;
      const body = {}, wrong = (Array.isArray(x.wrong) ? x.wrong : []).map((w) => String(w).trim()).filter((w) => w && w.toLowerCase() !== String(q.answer || '').toLowerCase());
      if (q.format !== 'mc' && wrong.length >= 2) body.wrong = wrong.slice(0, 4);
      if (!q.answer && String((x && x.answer) || '').trim()) body.answer = String(x.answer).trim();
      if (Object.keys(body).length) await api('PATCH', `/api/problems/${q.id}`, body);
      picked.push(q);
    }
    await loadProblems();
  }
  if (picked.length) { (S.secpick2 || (S.secpick2 = {}))[secKey(p)] = picked.map((q) => q.id); save(); } // nothing found: try again next time, after more is read
}
// Writes n new multiple-choice problems for a section, modelled on the problems from your own exams and text that are closest to it,
// and saves them in the bank. Returns the saved problems.
async function writeSectionProblems(p, n, onNote) {
  const chId = p.ch.unsorted ? null : p.ch.id, pool = allProblems().filter((q) => q.kind === 'original' && (chId ? q.chapterId === chId : !q.chapterId) && srcOf(q) !== 'exam');
  const terms = p.sec.terms.map((t) => t.term).join(', '), about = `${p.sec.heading} ${p.sec.summary} ${terms}`;
  const models = pool.length ? shortlist([{ text: about }], pool, 5)[0] : [], ctx = await classContext(`${p.sec.heading} ${terms}`, chId);
  const prompt = `${rules()}${ctx}\n\nWrite ${n} multiple-choice practice problems for the section "${p.sec.heading}" of "${CLASS.name}". ${p.sec.summary ? `The section says: ${p.sec.summary} ` : ''}${p.sec.points.length ? `Key points: ${p.sec.points.join(' ')} ` : ''}`
    + (models.length ? `Model them on these problems from the course (same type and difficulty, different numbers, names or wording, and do not copy them):\n${models.map((q, i) => `${i + 1}. ${q.text.replace(/\s+/g, ' ').slice(0, 240)}${q.format === 'mc' ? ` (options: ${q.choices.join(' | ').slice(0, 200)})` : ''}${q.answer ? ` (answer: ${q.answer.slice(0, 60)})` : ''}`).join('\n')}\n\n` : 'Use only what the material says.\n\n')
    + `Each problem has four options: one correct and three believable wrong ones (the mistakes students really make), listed in "choices", with the correct option's text in "answer" and one short step per line of working in "steps". Work each one out carefully before you write its answer, and double-check it. Plain text only (${PACK.finder}).\n\n`
    + 'Reply with only this JSON:\n{"problems":[{"text":"the problem","choices":["option","option","option","option"],"answer":"text of the correct option","steps":["one short step"]}]}';
  const r = await aiJson(prompt, new AbortController(), (s) => onNote(`Waiting for the AI quota (${s}s)…`), 3500);
  const seen = new Set(allProblems().map((q) => normText(q.text)));
  const fresh = (Array.isArray(r && r.problems) ? r.problems : []).slice(0, n).map((q) => {
    const sh = mixChoices(shapeProblem(q));
    return { kind: 'similar', text: sh.text, answer: sh.answer, format: 'mc', choices: sh.choices, steps: (Array.isArray(q && q.steps) ? q.steps : []).map((x) => String(x)), topic: p.sec.heading, sourceDoc: '', chapterId: chId };
  }).filter((q) => q.text && q.choices.length >= 2 && keyIndex(q, q.choices) >= 0 && !seen.has(normText(q.text)) && seen.add(normText(q.text)));
  if (!fresh.length) return [];
  const made = await api('POST', `/api/classes/${CLASS.id}/problems`, { problems: fresh });
  await loadProblems();
  return made;
}

// ---- walking a section ----
// A section is a page of its own (#/class/<id>/sec/<guide>/<n>), so the browser's Back button and the back links return to where
// you came from: the course home, a chapter, or the previous section.
const secHash = (gid, i) => `${baseHash()}/sec/${gid}/${i}`;
let SECFROM = '';
function openSection(gid, i) {
  if (!/\/sec\//.test(location.hash)) SECFROM = location.hash;
  go(secHash(gid, i));
}
function leaveSection(chId) {
  const to = SECFROM && !/\/sec\//.test(SECFROM) ? SECFROM : chHash(chId || 'unsorted', 'learn');
  SECFROM = ''; Q = null; go(to);
}
function showSection(gid, i) {
  const p = pathAt(gid, i);
  if (!p) return renderHome();
  round = null; W.id = null; Q = null;
  const s = p.sec, inCh = pathList().filter((x) => x.ch.id === p.ch.id), n = inCh.findIndex((x) => x.g.id === p.g.id && x.i === p.i) + 1;
  app.innerHTML = `<div class="rbar"><button class="link" data-act="g-leave" data-ch="${p.ch.id}">‹ Back</button><span class="progress">${esc(p.ch.title)} &middot; section ${n} of ${inCh.length}</span></div>
  <div class="prob"><div class="eyebrow">${esc(p.ch.title)}</div><h2 class="gtitle">${esc(s.heading)}</h2>
    ${s.summary ? `<p>${esc(s.summary)}</p>` : ''}
    ${s.points.length ? `<ul class="gpts">${s.points.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    ${s.terms.length ? `<dl class="gterms">${s.terms.map((t) => `<dt>${esc(t.term)}</dt><dd>${esc(t.def)}</dd>`).join('')}</dl>` : ''}
    <div class="acts"><button class="btn" id="nextbtn" data-act="g-secgo" data-id="${p.g.id}" data-i="${p.i}">Start the problems</button>${videosHTML(s.video || `${s.heading} ${subjectWord()}`, true, `${s.heading}. ${s.summary}`)}</div></div>`;
  window.scrollTo(0, 0);
  const b = document.getElementById('nextbtn'); if (b) b.focus();
}
async function startSectionQuiz(gid, i) {
  const p = pathAt(gid, i);
  if (!p) return renderHome();
  round = null; W.id = null; Q = null;
  if (!PLOADED) await loadProblems().catch(() => {});
  const show = (title, note) => { app.innerHTML = `<div class="rbar"><span class="progress">${esc(p.sec.heading)}</span></div><div class="prob"><div class="eyebrow">${esc(p.ch.title)}</div><h2 class="gtitle">${esc(title)}</h2><p class="lead">${esc(note)}</p></div>`; };
  let problem = '';
  if (!((S.secpick2 || {})[secKey(p)] || []).length && smp) { // first time here: find the questions in your materials that test this section
    show('Finding your questions on this…', 'Looking through the problems in your textbook for the ones that test this section. This takes a few seconds.');
    try { await pickSectionProblems(p, (n) => show('Finding your questions on this…', n)); } catch (e) { problem = mineErr(e); }
  }
  const unseen = (q) => ((cardRec('p:' + q.id) || {}).box || 0) < 1; // never asked, or missed last time
  const real = secPicks(p).filter(playOpts);
  let probs = shuffle(real.filter(unseen)).slice(0, 5);
  if (!probs.length && real.length) probs = shuffle(real).slice(0, 5); // all got right already: go through them again
  if (real.length < 3 && smp) { // too few of your own questions fit: AI-written ones fill in, and are labelled
    let have = shuffle(secBank(p).filter(unseen)).slice(0, 5 - probs.length);
    if (probs.length + have.length < 3) {
      show('Writing problems for this section…', 'Few of your own questions fit this section, so the AI writes some like them.');
      try { have = [...have, ...await writeSectionProblems(p, 5 - probs.length - have.length, (n) => show('Writing problems for this section…', n))]; } catch (e) { problem = problem || mineErr(e); }
    }
    probs = [...probs, ...have];
  }
  const pseudo = { id: p.g.id, title: p.g.title, sections: p.g.sections, cards: [] };
  const items = [...probs.map((q) => problemItem(q, p, pseudo)), ...(probs.length < 5 ? shuffle(p.cards).slice(0, 5 - probs.length) : [])];
  if (!items.length) {
    app.innerHTML = `<div class="rbar"><button class="link" data-act="g-leave" data-ch="${p.ch.id}">‹ Back</button></div><div class="prob"><h2 class="gtitle">Nothing to practise yet</h2><p class="lead">${esc(problem || 'No problem in your textbook fits this section yet. Use “Read its problems” on the chapter’s materials, then try again.')}</p></div>`;
    return;
  }
  pseudo.cards = items.map((x) => x.c);
  Q = { guideId: gid, chapterId: p.ch.unsorted ? null : p.ch.id, path: { gid, i }, askOpen: false, items: shuffle(items), i: 0, results: [], extra: false };
  qOpen(); renderQuiz();
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
      <small>${st === 'working' ? 'Pick up where you left off.' : 'A short read, then a round of problems.'}</small>
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
const SEC_LABEL = { new: 'To do', working: 'In progress', done: 'Done', read: 'Read' };
function secRowHTML(p) {
  const st = secState(p);
  return `<div class="secrow"><span class="pill ${st === 'done' ? 'done' : st === 'read' ? '' : 'todo'}">${SEC_LABEL[st]}</span>
    <span><b>${esc(p.sec.heading)}</b><small>${secNote(p)}</small></span>
    <button class="btn alt sm" data-act="g-sec" data-id="${p.g.id}" data-i="${p.i}">${st === 'done' ? 'Again' : st === 'working' ? 'Continue' : 'Start'}</button></div>`;
}
// The course home: every chapter's sections as tiles, so you can start wherever you like.
function tileHTML(p) {
  const st = secState(p), note = st === 'done' ? 'Done' : st === 'working' ? 'In progress' : st === 'read' ? 'Reading' : secNote(p);
  return `<button class="tile ${st}" data-act="g-sec" data-id="${p.g.id}" data-i="${p.i}"><span class="tname">${esc(p.sec.heading)}</span><small>${note}</small></button>`;
}
function startAnywhereHTML() {
  if (!CHAPTERS.length) return '';
  ensureProblems();
  const list = pathList();
  return CHAPTERS.map((ch) => {
    const mine = list.filter((p) => p.ch.id === ch.id), hasDocs = DOCS.some((d) => d.chapterId === ch.id && d.chars && d.tag !== 'exam');
    const body = mine.length ? `<div class="tiles">${mine.map(tileHTML).join('')}</div>`
      : hasDocs ? `<div class="acts"><small>Not split into sections yet.</small><button class="btn alt sm" data-act="g-prep" data-ch="${ch.id}" ${smp ? '' : 'disabled'}>Prepare this chapter</button></div>`
        : `<div class="acts"><small>No materials yet.</small><a class="btn alt sm" href="${chHash(ch.id, 'materials')}">Upload</a></div>`;
    return `<section class="zone"><h3>${esc(ch.title)}</h3>${body}</section>`;
  }).join('');
}
// A chapter's Learn tab: its sections with where you are in each.
function learnTab(ch) {
  ensureProblems();
  const list = pathList().filter((p) => p.ch.id === ch.id), docs = docsIn(ch).filter((d) => d.chars && d.tag !== 'exam');
  if (!list.length) {
    return docs.length
      ? `<div class="empty"><p>Turn this chapter into short sections with questions.</p><button class="btn big" data-act="g-prep" data-ch="${ch.id}" ${smp ? '' : 'disabled'}>Prepare this chapter</button>
        <small>The AI reads the chapter once; a long one takes a few minutes. ${smp ? '' : 'It needs the AI, which isn’t set up on this server.'}</small></div>`
      : `<div class="empty"><p>No materials in this chapter yet.</p><a class="btn big" href="${chHash(ch.id, 'materials')}">Upload materials</a><small>Add the chapter’s text. Practice exams go on the Exams page.</small></div>`;
  }
  const next = list.find(todo), due = chapterDue(ch.id);
  return `${next ? `<div class="acts"><button class="btn big" data-act="g-sec" data-id="${next.g.id}" data-i="${next.i}">${secState(next) === 'working' ? 'Continue' : 'Start'}: ${esc(next.sec.heading)}</button></div>` : '<small>You’ve been through every section here.</small>'}
    <section class="zone"><h3>Sections &middot; ${list.length}</h3>${list.map(secRowHTML).join('')}</section>
    ${due ? `<div class="acts"><button class="btn alt" data-act="g-quiz" data-ch="${ch.id}">Review ${plural(due, 'question')} due</button></div>` : ''}`;
}
