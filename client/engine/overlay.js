// Reference overlay. It opens on top of whatever you are doing, so a question in progress is never lost.
// Tabs come from the current pack (periodic table, ion list, ...) plus the AI question box.
const ov = document.getElementById('ov'), ovBody = document.getElementById('ovbody'), ovTabs = document.getElementById('ovtabs');

function openRef(kind) {
  if (!ov || !PACK) return;
  const tabs = [...PACK.refs.map((r) => ({ k: r.k, label: r.label })), { k: 'ask', label: 'Ask a question' }];
  const k = tabs.some((t) => t.k === kind) ? kind : tabs[0].k;
  ovTabs.innerHTML = tabs.map((t) => `<button class="link" data-ov="${t.k}">${t.label}</button>`).join('');
  const ref = PACK.refs.find((r) => r.k === k);
  ovBody.innerHTML = k === 'ask' || !ref ? askHTML() : ref.html();
  ov.querySelectorAll('[data-ov]').forEach((b) => b.classList.toggle('on', b.dataset.ov === k));
  ov.dataset.k = k;
  ov.hidden = false;
  const x = k === 'ask' ? ov.querySelector('#asktext') : null, cl = ov.querySelector('[data-ov="close"]');
  if (x) x.focus(); else if (cl) cl.focus();
}
function closeRef() { if (ov) ov.hidden = true; }

if (ov) {
  ov.addEventListener('mouseover', (e) => { if (PACK && PACK.refHover) PACK.refHover(e); });
  ov.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('[data-ask]');
    if (a && a.dataset.ask) { askAct(a.dataset.ask, a); return; }
    if (PACK && PACK.refHover && PACK.refHover(e)) return;
    const t = e.target.closest('[data-ov]');
    if (t) { if (t.dataset.ov === 'close') closeRef(); else openRef(t.dataset.ov); } else if (e.target === ov) closeRef();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !ov.hidden) closeRef();
    else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.target && e.target.id === 'asktext') askSend();
  });
}
