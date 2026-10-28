// Talking to the server: a small fetch wrapper, and `smp`, the AI helper the rest of the app calls.
//   smp(prompt | messages, { images, modelTier: 'quick', signal, onText }) -> { text }
//   smp.json(prompt, opts) -> parsed JSON object
//   smp.limits() -> { images: { mediaTypes, maxCount } } when the server can read photos
// The server holds the Groq / OpenRouter keys; nothing secret reaches the browser.
let smp = null, smpLimits = null, aiStatus = { configured: false, providers: [], images: false };

class ApiError extends Error {
  constructor(code, message, status) { super(message || code); this.code = code; this.status = status || 0; }
}
let authLostFlag = false;
function authLost() {
  if (authLostFlag) return;
  authLostFlag = true;
  if (typeof renderLogin === 'function') renderLogin('Your session ended. Sign in again.');
}

async function api(method, url, body) {
  let res;
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  try {
    res = await fetch(url, { method, headers: body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : undefined, body: body === undefined ? undefined : isForm ? body : JSON.stringify(body) });
  } catch (e) { throw new ApiError('network', 'Could not reach the server.'); }
  if (res.status === 401) { authLost(); throw new ApiError('auth_required', 'Signed out.', 401); }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError('http', (data && ((data.error && data.error.message) || data.error)) || res.statusText, res.status);
  return data;
}

// Shrink a photo so uploads and AI calls stay small. Returns a Blob (JPEG) or the original when it is already small.
async function shrinkImage(file, max = 1600) {
  let bmp;
  try { bmp = await createImageBitmap(file); } catch (e) { throw new ApiError('image_rejected', `${file.name || 'That photo'} can’t be read by this browser (HEIC photos often can’t). Try a JPEG or PNG.`); }
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  if (scale === 1 && file.size < 1500000 && /^image\/(jpeg|png|webp)$/.test(file.type)) { bmp.close(); return file; }
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new ApiError('image_rejected', 'That photo could not be processed.'))), 'image/jpeg', 0.85));
}
const blobToDataUrl = (b) => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(b); });

async function prepImages(images) {
  const list = (Array.isArray(images) ? images : [images]).filter(Boolean);
  return Promise.all(list.map(async (im) => (im.doc ? { doc: im.doc } : blobToDataUrl(await shrinkImage(im)))));
}

function aiErr(o, text) {
  const e = new ApiError((o && o.code) || 'ai_error', (o && o.message) || 'AI request failed');
  e.text = text || (o && o.text) || '';
  return e;
}

function parseJsonLoose(t) {
  let s = String(t).trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) s = s.slice(a, b + 1);
  try { return JSON.parse(s); } catch (e) { throw new ApiError('invalid_json', 'The AI did not return valid JSON.'); }
}

function makeSmp() {
  async function run(input, opts = {}) {
    const body = { messages: typeof input === 'string' ? [{ role: 'user', content: input }] : input, quick: opts.modelTier === 'quick', stream: !!opts.onText };
    if (opts.images) body.images = await prepImages(opts.images);
    let text = '';
    try {
      const res = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: opts.signal });
      if (res.status === 401) { authLost(); throw new ApiError('auth_required', 'Signed out.', 401); }
      if (!res.ok || !res.body || !body.stream) {
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw aiErr(j.error);
        return { text: j.text || '' };
      }
      const reader = res.body.getReader(), dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
          if (!line.startsWith('data:')) continue;
          let ev; try { ev = JSON.parse(line.slice(5)); } catch (e) { continue; }
          if (ev.t) { text += ev.t; opts.onText({ text }); }
          else if (ev.error) throw aiErr(ev.error, text || ev.error.text);
        }
      }
      if (!text.trim()) throw aiErr({ code: 'empty_completion' });
      return { text };
    } catch (e) {
      if (e && e.name === 'AbortError') { const c = new ApiError('cancelled', 'Cancelled'); c.text = text; throw c; }
      if (e instanceof ApiError) { if (e.text === undefined) e.text = text; throw e; }
      throw new ApiError('network', 'Could not reach the server.');
    }
  }
  const fn = run;
  fn.json = async (prompt, opts) => parseJsonLoose((await run(prompt, { ...opts, onText: undefined })).text);
  fn.limits = async () => (aiStatus.images ? { images: { mediaTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], maxCount: 4 } } : {});
  return fn;
}

async function initAI() {
  try { aiStatus = await api('GET', '/api/ai/status'); } catch (e) { aiStatus = { configured: false, providers: [], images: false }; }
  smp = aiStatus.configured ? makeSmp() : null;
  smpLimits = smp ? await smp.limits() : null;
}
