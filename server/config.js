// All settings come from environment variables (see .env.example).
const path = require('path');

const num = (v, d) => (v !== undefined && v !== '' && !Number.isNaN(+v) ? +v : d);

function loadConfig(env = process.env) {
  const order = (env.AI_PROVIDER_ORDER || 'groq,openrouter').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return {
    port: num(env.PORT, 3000),
    dataDir: path.resolve(env.DATA_DIR || path.join(process.cwd(), 'data')),
    publicDir: path.resolve(env.PUBLIC_DIR || path.join(__dirname, '..', 'public')),
    password: env.APP_PASSWORD || '',
    sessionSecret: env.SESSION_SECRET || '',
    cookieSecure: String(env.COOKIE_SECURE || '').toLowerCase() === 'true',
    // 'true' trusts every X-Forwarded-For hop (spoofable). A number trusts that many proxies, which is what you want: 1 behind cloudflared.
    trustProxy: /^\d+$/.test(String(env.TRUST_PROXY || '').trim()) ? +env.TRUST_PROXY : String(env.TRUST_PROXY || '').toLowerCase() === 'true',
    maxUploadMb: num(env.MAX_UPLOAD_MB, 25),
    ai: {
      order,
      timeoutMs: num(env.AI_TIMEOUT_MS, 90000),
      maxTokens: num(env.AI_MAX_TOKENS, 2048),
      providers: {
        groq: {
          key: env.GROQ_API_KEY || '',
          base: (env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/$/, ''),
          smart: env.GROQ_MODEL || 'llama-3.3-70b-versatile',
          quick: env.GROQ_QUICK_MODEL || 'llama-3.1-8b-instant',
          vision: env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct',
        },
        openrouter: {
          key: env.OPENROUTER_API_KEY || '',
          base: (env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, ''),
          smart: env.OPENROUTER_MODEL || 'google/gemini-2.5-flash',
          quick: env.OPENROUTER_QUICK_MODEL || env.OPENROUTER_MODEL || 'google/gemini-2.5-flash',
          vision: env.OPENROUTER_VISION_MODEL || env.OPENROUTER_MODEL || 'google/gemini-2.5-flash',
        },
      },
    },
  };
}

module.exports = { loadConfig };
