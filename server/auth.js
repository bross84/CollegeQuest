// Optional single shared password. With APP_PASSWORD unset the app is open (fine on a trusted LAN).
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const COOKIE = 'cq_session';
const MAX_AGE_S = 60 * 60 * 24 * 30;
const PUBLIC_AGE_S = 60 * 60 * 12; // "public computer" sign-ins: short, and the cookie dies with the browser

function loadSecret(cfg) {
  if (cfg.sessionSecret) return cfg.sessionSecret;
  const f = path.join(cfg.dataDir, '.session-secret');
  try { return fs.readFileSync(f, 'utf8').trim(); } catch (e) { /* create below */ }
  const s = crypto.randomBytes(32).toString('hex');
  fs.mkdirSync(cfg.dataDir, { recursive: true });
  fs.writeFileSync(f, s, { mode: 0o600 });
  return s;
}

const safeEq = (a, b) => {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
};

function createAuth(cfg) {
  const secret = loadSecret(cfg);
  const sign = (payload) => crypto.createHmac('sha256', secret).update('s.' + payload).digest('hex');
  const make = (pub) => { const p = `${Date.now() + (pub ? PUBLIC_AGE_S : MAX_AGE_S) * 1000}.${pub ? 1 : 0}`; return `${p}.${sign(p)}`; };
  const parse = (tok) => {
    const [exp, pub, mac] = String(tok || '').split('.');
    return exp && pub !== undefined && mac && +exp > Date.now() && safeEq(mac, sign(`${exp}.${pub}`)) ? { pub: pub === '1' } : null;
  };
  const cookies = (req) => Object.fromEntries(String(req.headers.cookie || '').split(';').map((p) => {
    const i = p.indexOf('=');
    return i < 0 ? ['', ''] : [p.slice(0, i).trim(), decodeURIComponent(p.slice(i + 1).trim())];
  }));
  const required = !!cfg.password;
  const authed = (req) => !required || !!parse(cookies(req)[COOKIE]);
  const isPublic = (req) => { const s = parse(cookies(req)[COOKIE]); return !!s && s.pub; };

  // Slow down password guessing: 10 failures per IP per 15 minutes.
  const fails = new Map();
  const blocked = (ip) => { const f = fails.get(ip); return !!f && f.until > Date.now() && f.n >= 10; };
  const miss = (ip) => {
    const f = fails.get(ip);
    fails.set(ip, f && f.until > Date.now() ? { n: f.n + 1, until: f.until } : { n: 1, until: Date.now() + 15 * 60 * 1000 });
  };

  function cookieHeader(req, value, maxAge) {
    const secure = cfg.cookieSecure || req.secure ? '; Secure' : '';
    return `${COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax${maxAge === null ? '' : `; Max-Age=${maxAge}`}${secure}`;
  }

  return {
    required,
    authed,
    isPublic,
    login(req, res) {
      if (!required) return res.json({ ok: true });
      if (blocked(req.ip)) return res.status(429).json({ error: 'Too many attempts. Try again later.' });
      const pw = (req.body && req.body.password) || '';
      if (!safeEq(pw, cfg.password)) { miss(req.ip); return res.status(401).json({ error: 'Wrong password.' }); }
      fails.delete(req.ip);
      const pub = !!(req.body && req.body.publicPc);
      res.setHeader('Set-Cookie', cookieHeader(req, make(pub), pub ? null : MAX_AGE_S));
      return res.json({ ok: true });
    },
    logout(req, res) {
      res.setHeader('Set-Cookie', cookieHeader(req, '', 0));
      res.json({ ok: true });
    },
    middleware(req, res, next) {
      if (authed(req)) return next();
      return res.status(401).json({ error: 'auth_required' });
    },
  };
}

module.exports = { createAuth };
