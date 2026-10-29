// Talks to Groq and OpenRouter (both speak the OpenAI chat-completions protocol).
// Providers are tried in AI_PROVIDER_ORDER; a failure before any text arrives falls through to the next one.

class AiError extends Error {
  constructor(code, message, status) { super(message || code); this.code = code; this.status = status || 502; }
}

// Reasoning models wrap their thinking in <think>...</think>. Drop it, even when split across stream chunks.
function createThinkFilter() {
  let inThink = false, buf = '';
  return (chunk, flush) => {
    buf += chunk;
    let out = '';
    for (;;) {
      if (inThink) {
        const i = buf.indexOf('</think>');
        if (i < 0) { if (flush) buf = ''; else buf = buf.slice(-8); return out; }
        buf = buf.slice(i + 8).replace(/^\s+/, ''); inThink = false;
      } else {
        const i = buf.indexOf('<think>');
        if (i < 0) {
          const keep = flush ? 0 : Math.min(buf.length, 6);
          out += buf.slice(0, buf.length - keep); buf = buf.slice(buf.length - keep);
          return out;
        }
        out += buf.slice(0, i); buf = buf.slice(i + 7); inThink = true;
      }
    }
  };
}

function createAi(cfg, getAi) {
  const cur = () => (getAi ? getAi() : cfg.ai);
  const active = () => cur().order.filter((n) => cur().providers[n] && cur().providers[n].key);

  function status() {
    const names = active();
    return {
      configured: names.length > 0,
      providers: names,
      images: names.some((n) => !!cur().providers[n].vision),
    };
  }

  // Groq reports its limits on every response: requests are per day, tokens per minute. Keep the latest reading per model.
  const usage = {}, notes = {}; // notes: why a provider has no reading, so the screen can say instead of staying blank
  function noteUsage(name, model, res) {
    const num = (k) => { const v = res.headers.get(k); return v !== null && v !== '' && !Number.isNaN(+v) ? +v : null; };
    const u = { provider: name, model, at: Date.now(), limitRequests: num('x-ratelimit-limit-requests'), remainingRequests: num('x-ratelimit-remaining-requests'),
      limitTokens: num('x-ratelimit-limit-tokens'), remainingTokens: num('x-ratelimit-remaining-tokens'),
      resetRequests: res.headers.get('x-ratelimit-reset-requests'), resetTokens: res.headers.get('x-ratelimit-reset-tokens') };
    if (u.limitRequests !== null || u.limitTokens !== null) { usage[`${name}|${model}`] = u; delete notes[name]; }
    else notes[name] = `${name} answered (HTTP ${res.status}) but sent no rate-limit headers. Headers seen: ${[...res.headers.keys()].join(', ') || 'none'}.`;
  }

  function classify(res, body) {
    const msg = (body && (body.error && (body.error.message || body.error))) || res.statusText || 'AI request failed';
    const text = typeof msg === 'string' ? msg : JSON.stringify(msg);
    if (res.status === 401 || res.status === 403) return new AiError('ai_auth', `API key rejected: ${text}`, 502);
    if (res.status === 429) return new AiError('rate_limited', text, 429);
    if (res.status === 413 || /image|vision|multimodal/i.test(text)) return new AiError('image_rejected', text, 400);
    if (res.status >= 500) return new AiError('ai_error', text, 502);
    return new AiError('ai_error', text, 400);
  }

  // messages: [{role, content}], images: data URLs attached to the last user message.
  async function callProvider(name, { messages, images, quick, stream, signal, onDelta, maxTokens }) {
    const p = cur().providers[name];
    const model = images.length ? p.vision : quick ? p.quick : p.smart;
    const msgs = messages.map((m) => ({ role: m.role, content: m.content }));
    if (images.length) {
      let i = msgs.length - 1;
      while (i > 0 && msgs[i].role !== 'user') i--;
      msgs[i] = { role: 'user', content: [{ type: 'text', text: String(msgs[i].content) }, ...images.map((u) => ({ type: 'image_url', image_url: { url: u } }))] };
    }
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(new AiError('ai_timeout', 'The AI took too long to answer.', 504)), cur().timeoutMs);
    const onAbort = () => ctl.abort(signal.reason);
    if (signal) { if (signal.aborted) onAbort(); else signal.addEventListener('abort', onAbort, { once: true }); }
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${p.key}` };
    if (name === 'openrouter') { headers['HTTP-Referer'] = 'https://github.com/collegequest'; headers['X-Title'] = 'CollegeQuest'; }
    const body = { model, messages: msgs, temperature: 0.3, max_tokens: maxTokens || cur().maxTokens, stream: !!stream };
    if (name === 'groq' && /gpt-oss|qwen3|deepseek/i.test(model)) body.reasoning_format = 'hidden';
    const filter = createThinkFilter();
    let text = '';
    const emit = (raw, flush) => { const t = filter(raw, flush); if (t) { text += t; if (onDelta) onDelta(t); } };
    try {
      let res;
      try { res = await fetch(`${p.base}/chat/completions`, { method: 'POST', headers, body: JSON.stringify(body), signal: ctl.signal }); }
      catch (e) {
        if (ctl.signal.aborted && ctl.signal.reason) throw ctl.signal.reason;
        throw new AiError('ai_error', `Could not reach ${name}: ${e.message}`, 502);
      }
      noteUsage(name, model, res);
      if (!res.ok) throw classify(res, await res.json().catch(() => null));
      if (!stream) {
        const j = await res.json();
        emit(String(((j.choices || [])[0] || {}).message ? j.choices[0].message.content || '' : ''), true);
        return text;
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
          const d = line.slice(5).trim();
          if (d === '[DONE]') continue;
          try {
            const j = JSON.parse(d);
            if (j.error) throw new AiError('ai_error', j.error.message || 'Stream error');
            const delta = ((j.choices || [])[0] || {}).delta;
            if (delta && typeof delta.content === 'string') emit(delta.content, false);
          } catch (e) { if (e instanceof AiError) throw e; /* partial JSON line */ }
        }
      }
      emit('', true);
      return text;
    } catch (e) {
      if (e.partial === undefined) e.partial = text;
      throw e;
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
    }
  }

  async function chat(opts) {
    const keyed = active().filter((n) => !opts.only || n === opts.only);
    if (!keyed.length) throw new AiError('ai_unavailable', opts.only ? 'No API key is set for that provider.' : 'No AI provider is configured on the server.', 503);
    const names = keyed.filter((n) => !(opts.images || []).length || cur().providers[n].vision);
    if (!names.length) throw new AiError('images_unavailable', 'No configured provider can read images.', 400);
    let last;
    for (const n of names) {
      try {
        const text = await callProvider(n, { ...opts, images: opts.images || [] });
        if (!text.trim()) throw new AiError('empty_completion', 'The AI returned nothing.', 502);
        return text;
      } catch (e) {
        last = e;
        if (opts.signal && opts.signal.aborted) throw e;
        if (e.partial) throw e; // already streamed text to the client: do not start over
        console.warn(`[ai] ${n} failed: ${e.code || ''} ${e.message}`);
      }
    }
    throw last;
  }

  // A one-token request to each provider, so the limits are known before the first real call (it counts as one request).
  async function probe() {
    for (const n of active()) { try { await callProvider(n, { messages: [{ role: 'user', content: 'Say ok.' }], images: [], maxTokens: 1 }); } catch (e) { if (!usage[Object.keys(usage).find((k) => k.startsWith(n + '|'))]) notes[n] = `${n} refused the test request: ${e.message}`; } }
    return report();
  }

  const report = () => ({ usage: Object.values(usage), notes: Object.values(notes) });
  return { status, chat, probe, usage: report };
}

module.exports = { createAi, AiError, createThinkFilter };
