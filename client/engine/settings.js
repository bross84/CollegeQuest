// AI settings: API keys, provider order and models. Saved on the server (keys are never sent back in full).
let ST = null; // { data, msg, err, busy, tests: { groq: result } }
const PROVIDER_LABEL = { groq: 'Groq', openrouter: 'OpenRouter' };
const MODEL_LABEL = { smart: 'Main model (checking work, explanations)', quick: 'Quick model (short jobs)', vision: 'Vision model (reading photos)' };

async function openSettings() {
  ST = { data: null, msg: '', err: '', busy: false, tests: {} };
  app.innerHTML = '<p class="lead">Loading…</p>';
  try { ST.data = await api('GET', '/api/settings'); } catch (e) { if (e.code === 'auth_required') return; ST.err = e.message; }
  renderSettings();
}

function keyStatus(p) {
  if (p.keySource === 'app') return `Saved in the app (key ending ${esc(p.keyHint.slice(1))}).`;
  if (p.keySource === 'env') return `Using the key from the server’s environment (ending ${esc(p.keyHint.slice(1))}).`;
  return 'No key set.';
}
function renderSettings() {
  const d = ST.data;
  if (!d) { app.innerHTML = `<div class="rbar"><button class="link" data-act="s-back">‹ Back</button></div><div class="fb no" role="status"><p>${esc(ST.err || 'Could not load settings.')}</p></div>`; return; }
  const dis = d.canEdit ? '' : 'disabled';
  const test = (n) => { const t = ST.tests[n]; return t === 'busy' ? '<small>Testing…</small>' : !t ? '' : t.ok ? `<small class="okmsg">Works: ${esc(t.model)} answered in ${(t.ms / 1000).toFixed(1)}s.</small>` : `<small class="warn">Failed: ${esc(t.message)}</small>`; };
  const prov = Object.keys(d.providers).map((n) => {
    const p = d.providers[n];
    return `<section class="zone form"><h3>${PROVIDER_LABEL[n] || n}</h3>
      <small>${keyStatus(p)}</small>
      <label class="field" for="st-${n}-key">API key <small>(leave blank to keep the current one)</small></label>
      <input class="line" id="st-${n}-key" data-st="${n}.key" type="password" autocomplete="off" spellcheck="false" placeholder="${p.keySource === 'none' ? 'paste a key' : '•••••••• unchanged'}" ${dis}>
      ${['smart', 'quick', 'vision'].map((m) => `<label class="field" for="st-${n}-${m}">${MODEL_LABEL[m]}</label>
        <input class="line" id="st-${n}-${m}" data-st="${n}.${m}" type="text" autocomplete="off" spellcheck="false" value="${esc(p.models[m])}" placeholder="${esc(p.defaults[m])}" ${dis}>`).join('')}
      <div class="answer"><button class="btn alt" data-act="s-test" data-id="${n}" ${ST.busy ? 'disabled' : ''}>Save and test</button>
        ${p.keySource === 'app' && d.canEdit ? `<button class="link" data-act="s-clear" data-id="${n}">Remove saved key</button>` : ''}${test(n)}</div></section>`;
  }).join('');
  app.innerHTML = `<div class="rbar"><button class="link" data-act="s-back">‹ Back</button></div>
  <div class="prob"><div class="eyebrow">AI settings</div>
    <p class="lead">Keys saved here are stored on your server (in its data volume) and override the ones in <code>.env</code>. Changes apply immediately. Empty model fields use the default shown in grey.</p>
    ${d.canEdit ? '' : '<div class="fb no" role="status"><p>Editing is locked because the server has no <code>APP_PASSWORD</code>. Set one, restart, and sign in, so only you can change the keys.</p></div>'}
    <label class="field" for="st-order">Which provider to try first</label>
    <select class="line" id="st-order" data-st="order" ${dis}>${Object.keys(d.providers).map((n) => `<option value="${n}" ${d.order[0] === n ? 'selected' : ''}>${PROVIDER_LABEL[n] || n} first, then the other</option>`).join('')}</select>
    ${ST.err ? `<div class="fb no" role="status"><p>${esc(ST.err)}</p></div>` : ''}${ST.msg ? `<div class="fb good" role="status"><p>${esc(ST.msg)}</p></div>` : ''}
  </div>
  ${prov}
  ${d.canEdit ? '<div class="answer" style="margin-top:20px"><button class="btn" data-act="s-save">Save settings</button></div>' : ''}`;
}

// Collect the form into the PUT body. Keys are only sent when something was typed.
function settingsBody() {
  const body = {}, order = document.getElementById('st-order');
  document.querySelectorAll('[data-st]').forEach((el) => {
    const [n, f] = el.dataset.st.split('.');
    if (!f) return;
    if (f === 'key' && !el.value.trim()) return;
    (body[n] = body[n] || {})[f] = el.value;
  });
  if (order) { const all = Object.keys(ST.data.providers); body.order = [order.value, ...all.filter((n) => n !== order.value)]; }
  return body;
}
async function saveSettings(extra) {
  ST.err = ''; ST.msg = '';
  try {
    ST.data = await api('PUT', '/api/settings', extra || settingsBody());
    await initAI();
    ST.msg = 'Saved.';
    return true;
  } catch (e) { ST.err = e.message; return false; }
}
async function settingsAct(act, t) {
  if (act === 's-back') { await initAI(); return renderClasses(); }
  if (act === 's-save') { await saveSettings(); return renderSettings(); }
  if (act === 's-clear') { await saveSettings({ [t.dataset.id]: { key: '' } }); return renderSettings(); }
  if (act === 's-test') {
    const n = t.dataset.id;
    if (ST.data.canEdit && !(await saveSettings())) return renderSettings();
    ST.tests[n] = 'busy'; renderSettings();
    try { ST.tests[n] = await api('POST', '/api/settings/test', { provider: n }); } catch (e) { ST.tests[n] = { ok: false, message: e.message }; }
    ST.msg = '';
    renderSettings();
  }
}
