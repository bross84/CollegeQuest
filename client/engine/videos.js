// Embedded YouTube: a few embeddable videos for a topic, played in the overlay (youtube-nocookie). The server holds the
// API key and caches searches. Without a key, or once the daily quota is used up, this falls back to a plain search link.
const VID = new Map(); // search text -> Promise of videos
const ytLink = (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;

// The class name without course codes and terms ("CHEM1121-04 AU26-27 Principles Of Chemistry" -> "Principles Of Chemistry"), as a
// search word: YouTube knows nothing about course codes.
function subjectWord() {
  const t = String(CLASS && CLASS.name || '').replace(/\b[A-Za-z]{2,5}\s?-?\d{3,4}[\w-]*/g, ' ').replace(/\b[A-Za-z]{2}\d{2}(?:-\d{2})?\b/g, ' ').replace(/\s+/g, ' ').replace(/^[\s:–-]+|[\s:–-]+$/g, '');
  return t || (PACK && PACK.videoWord) || 'tutorial';
}
// A search written for one question: the AI names the concept or method the question is about, so the videos teach that and not the
// whole course. Without the AI the plain query is used.
const VQ = new Map();
async function videoQuery(ctx, fallback) {
  const key = ctx.slice(0, 300);
  if (VQ.has(key)) return VQ.get(key);
  let q = fallback;
  if (smp) {
    try {
      const r = await smp.json(`A student in "${CLASS.name}"${CLASS.description ? ` (${String(CLASS.description).slice(0, 200)})` : ''} needs help with this question:\n\n${ctx.slice(0, 600)}\n\n`
        + 'Write one YouTube search (4 to 7 words) that finds a short tutorial teaching how to solve this kind of question. Name the specific concept or method and the subject, not the course name or code.\n\nReply with only this JSON:\n{"q":"search words"}', { modelTier: 'quick', maxTokens: 80 });
      const t = String((r && r.q) || '').replace(/[^\w\s'+.-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
      if (t.split(' ').length >= 2) q = t;
    } catch (e) { /* the plain query will do */ }
  }
  VQ.set(key, q);
  return q;
}

// lazy: wait for a tap before searching (guide sections, correct answers), so quota is only spent on videos someone wants.
// ctx: the question itself; when given, the AI writes the search from it.
function videosHTML(q, lazy, ctx) {
  q = String(q || '').trim();
  if (!q) return '';
  const link = `<a class="link" target="_blank" rel="noopener" href="${ytLink(q)}">Find a video on this</a>`;
  if (!aiStatus.videos) return ctx ? `<button class="link" data-vid="open" data-vq="${esc(q)}" data-vctx="${esc(ctx.slice(0, 600))}">Find a video on this</button>` : link;
  return `<div class="videos" data-vq="${esc(q)}" data-vctx="${esc(ctx ? ctx.slice(0, 600) : '')}" data-lazy="${lazy ? 1 : 0}">${lazy ? '<button class="link" data-vid="load">Show videos</button>' : '<small>Finding videos…</small>'} ${link}</div>`;
}

function loadVideos(q) {
  if (!VID.has(q)) {
    VID.set(q, api('GET', '/api/videos?q=' + encodeURIComponent(q)).then((r) => r.videos || []).catch(() => []).then((v) => { if (!v.length) VID.delete(q); return v; }));
  }
  return VID.get(q);
}
async function hydrateVideos(el) {
  if (el.dataset.vdone) return;
  el.dataset.vdone = '1';
  const ctx = el.dataset.vctx, q = ctx ? await videoQuery(ctx, el.dataset.vq) : el.dataset.vq, vids = await loadVideos(q);
  if (!el.isConnected) return;
  const link = `<a class="link" target="_blank" rel="noopener" href="${ytLink(q)}">See more on YouTube</a>`;
  el.innerHTML = vids.length
    ? `<div class="vthumbs">${vids.map((v) => `<button class="vthumb" data-vid="${esc(v.id)}" data-vt="${esc(v.title)}"><img src="${esc(v.thumb)}" alt="" loading="lazy"><span>${esc(v.title)}</span><small>${esc(v.channel)}</small></button>`).join('')}</div><small>Searched for: ${esc(q)}</small> ${link}`
    : `<small>No embeddable videos found for “${esc(q)}”.</small> ${link}`;
}
function openVideo(id, title) {
  ovTabs.innerHTML = `<span class="vtitle">${esc(title || 'Video')}</span>`;
  ovBody.innerHTML = `<div class="vframe"><iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0" title="${esc(title || 'Video')}" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>
    <p><a class="link" target="_blank" rel="noopener" href="https://www.youtube.com/watch?v=${encodeURIComponent(id)}">Open on YouTube</a></p>`;
  ov.dataset.k = 'video';
  ov.hidden = false;
}

// Screens replace app.innerHTML wholesale, so pick up new video blocks as they appear.
new MutationObserver(() => app.querySelectorAll('[data-vq]:not([data-vdone])').forEach((el) => { if (el.dataset.lazy !== '1') hydrateVideos(el); }))
  .observe(app, { childList: true, subtree: true });
app.addEventListener('click', (e) => {
  const b = e.target.closest('[data-vid]');
  if (!b) return;
  if (b.dataset.vid === 'load') hydrateVideos(b.closest('[data-vq]'));
  else if (b.dataset.vid === 'open') { // no YouTube key: open a search for the question's own concept
    const w = window.open('', '_blank'); // opened first, so the browser doesn't block it
    videoQuery(b.dataset.vctx, b.dataset.vq).then((q) => { if (w) w.location = ytLink(q); });
  } else openVideo(b.dataset.vid, b.dataset.vt);
});
