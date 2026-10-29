// Embedded YouTube: a few embeddable videos for a topic, played in the overlay (youtube-nocookie). The server holds the
// API key and caches searches. Without a key, or once the daily quota is used up, this falls back to a plain search link.
const VID = new Map(); // search text -> Promise of videos
const ytLink = (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;

// lazy: wait for a tap before searching (guide sections, correct answers), so quota is only spent on videos someone wants.
function videosHTML(q, lazy) {
  q = String(q || '').trim();
  if (!q) return '';
  const link = `<a class="link" target="_blank" rel="noopener" href="${ytLink(q)}">Find a video on this</a>`;
  if (!aiStatus.videos) return link;
  return `<div class="videos" data-vq="${esc(q)}" data-lazy="${lazy ? 1 : 0}">${lazy ? '<button class="link" data-vid="load">Show videos</button>' : '<small>Finding videos…</small>'} ${link}</div>`;
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
  const link = el.querySelector('a'), vids = await loadVideos(el.dataset.vq);
  if (!el.isConnected) return;
  el.innerHTML = vids.length
    ? `<div class="vthumbs">${vids.map((v) => `<button class="vthumb" data-vid="${esc(v.id)}" data-vt="${esc(v.title)}"><img src="${esc(v.thumb)}" alt="" loading="lazy"><span>${esc(v.title)}</span><small>${esc(v.channel)}</small></button>`).join('')}</div>`
    : '<small>No embeddable videos found.</small>';
  if (link) el.insertAdjacentHTML('beforeend', ' ' + link.outerHTML);
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
  else openVideo(b.dataset.vid, b.dataset.vt);
});
