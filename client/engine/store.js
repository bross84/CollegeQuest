// Saving progress. Every change is kept in this browser right away and pushed to the server shortly after,
// so progress follows you between devices. If two devices changed things, the two copies are merged, not overwritten.
// On a "public computer" sign-in nothing is cached in the browser: the server copy is the only copy.
const LS = {
  get(k) { try { return AUTH.public ? null : localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { if (!AUTH.public) localStorage.setItem(k, v); } catch (e) { /* storage blocked: the server copy still works */ } },
  clear() { try { Object.keys(localStorage).filter((k) => k.startsWith('cq-')).forEach((k) => localStorage.removeItem(k)); } catch (e) { /* ignore */ } },
};
let syncedT = 0, pushTimer = null, pushing = false, pushAgain = false, syncMsg = '';
const stateKey = () => 'cq-state-' + CLASS.id;
const syncKey = () => 'cq-sync-' + CLASS.id;
const syncNote = () => `Saved to your server${syncMsg ? ' (' + syncMsg + ')' : ''}.`;
function setSync(msg) { syncMsg = msg; const el = document.getElementById('syncnote'); if (el) el.textContent = syncNote(); }
const persistLocal = () => LS.set(stateKey(), JSON.stringify(S));
function markSynced(t) { syncedT = t; LS.set(syncKey(), String(t)); }
const atHome = () => !!document.querySelector('.level');

function save() {
  S._t = Date.now();
  persistLocal();
  schedulePush();
}
function snapshotJSON() {
  let j = JSON.stringify(S);
  if (j.length > 900000) { const c = JSON.parse(j); (c.mine || []).forEach((m) => { delete m.chat; }); j = JSON.stringify(c); }
  return j;
}
function schedulePush() { clearTimeout(pushTimer); pushTimer = setTimeout(() => pushNow(), 1500); }

async function pushNow(leaving) {
  if (!CLASS) return;
  clearTimeout(pushTimer);
  if (pushing) { pushAgain = true; return; }
  pushing = true;
  const cid = CLASS.id;
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const t = S._t || Date.now(), body = JSON.stringify({ t, baseT: syncedT, json: snapshotJSON() });
      const res = await fetch(`/api/classes/${cid}/state`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body, keepalive: !!leaving && body.length < 60000 });
      if (res.status === 401) { authLost(); throw new Error('auth'); }
      if (res.status === 409) { // saved from another device since we last synced: merge, then try again
        const cur = await res.json();
        if (!CLASS || CLASS.id !== cid) return;
        S = mergeState(S, JSON.parse(cur.json)); S._t = Date.now(); persistLocal(); syncedT = cur.t;
        if (atHome()) renderHome();
        continue;
      }
      if (!res.ok) throw new Error('save failed');
      markSynced(t); setSync('up to date');
      break;
    }
  } catch (e) {
    setSync('not synced yet, will retry');
    pushTimer = setTimeout(() => pushNow(), 15000);
  }
  pushing = false;
  if (pushAgain) { pushAgain = false; schedulePush(); }
}

// When both devices changed since the last sync, combine them instead of dropping one side.
function mergeState(a, b) {
  const o = Object.assign(fresh(), b, a);
  ['total', 'right'].forEach((k) => { o[k] = Math.max(a[k] || 0, b[k] || 0); });
  const later = (a.lastDay || '') >= (b.lastDay || '') ? a : b;
  o.lastDay = later.lastDay; o.streak = later.streak; o.best = Math.max(a.best || 0, b.best || 0);
  o.setDay = (a.setDay || '') >= (b.setDay || '') ? a.setDay : b.setDay;
  o.skills = {};
  new Set([...Object.keys(a.skills || {}), ...Object.keys(b.skills || {})]).forEach((id) => {
    const x = (a.skills || {})[id], y = (b.skills || {})[id];
    o.skills[id] = !x ? y : !y ? x : (y.seen > x.seen || (y.seen === x.seen && (y.last || '') > (x.last || ''))) ? y : x;
  });
  o.sections = [...new Set([...(a.sections || []), ...(b.sections || [])])];
  const byId = {};
  [...(b.mine || []), ...(a.mine || [])].forEach((m) => {
    const p = byId[m.id];
    byId[m.id] = !p ? m : (p.status === 'done') !== (m.status === 'done') ? (m.status === 'done' ? m : p) : ((m.chat || []).length >= (p.chat || []).length && (m.tries || 0) >= (p.tries || 0)) ? m : p;
  });
  o.mine = Object.values(byId);
  o.log = (a.log || []).length >= (b.log || []).length ? a.log : b.log;
  o.today = ((a.today && a.today.day) || '') >= ((b.today && b.today.day) || '') ? a.today : b.today;
  o.style = a.style;
  return o;
}

// Called when a class is opened (CLASS and PACK are already set): pick the newest of the browser copy and the server copy.
async function loadState() {
  syncedT = +LS.get(syncKey()) || 0;
  syncMsg = '';
  let local = null, remote = null, offline = false;
  try { const raw = LS.get(stateKey()); if (raw) local = Object.assign(fresh(), JSON.parse(raw)); } catch (e) { /* ignore a damaged cache */ }
  try {
    const r = await api('GET', `/api/classes/${CLASS.id}/state`);
    if (r.json) remote = { t: r.t, s: Object.assign(fresh(), JSON.parse(r.json)) };
  } catch (e) { if (e.code === 'auth_required') throw e; offline = true; }
  let push = false;
  if (!remote) { S = local || fresh(); push = !!local && !offline; }
  else if (!local) { S = remote.s; S._t = remote.t; markSynced(remote.t); }
  else if ((local._t || 0) > syncedT && remote.t > syncedT && remote.t !== local._t) { S = mergeState(local, remote.s); S._t = Date.now(); push = true; }
  else if (remote.t > (local._t || 0)) { S = remote.s; S._t = remote.t; markSynced(remote.t); }
  else { S = local; push = (local._t || 0) > syncedT; }
  persistLocal();
  setSync(offline ? 'offline, using this browser’s copy' : '');
  if (push) pushNow();
}

// Pick up changes made on another device when you come back to this tab.
async function pullLatest() {
  if (!CLASS || !atHome() || pushing) return;
  try {
    const r = await api('GET', `/api/classes/${CLASS.id}/state`);
    if (!r.json || r.t <= syncedT || !atHome()) return;
    const remote = Object.assign(fresh(), JSON.parse(r.json));
    if ((S._t || 0) > syncedT) { S = mergeState(S, remote); S._t = Date.now(); persistLocal(); renderHome(); pushNow(); }
    else { S = remote; S._t = r.t; persistLocal(); markSynced(r.t); renderHome(); setSync('loaded from your other device'); }
  } catch (e) { /* stay on the local copy */ }
}
document.addEventListener('visibilitychange', () => {
  if (!CLASS) return;
  if (document.hidden) { if ((S._t || 0) > syncedT) pushNow(true); } else pullLatest();
});
