// Shared helpers for problem generators. Everything a generator returns is HTML.
const R = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = (a) => a[R(0, a.length - 1)];
const nz = (a, b) => { let n; do n = R(a, b); while (n === 0); return n; };
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
const lcm = (a, b) => Math.abs(a * b) / gcd(a, b);
const shuffle = (a) => {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = R(0, i); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

// Signed number with a real minus sign; pn() wraps negatives in parentheses.
const sgn = (n) => (n < 0 ? '−' + -n : '' + n);
const pn = (n) => (n < 0 ? '(−' + -n + ')' : '' + n);
const sd = (s) => (s === '<' ? '&lt;' : s === '>' ? '&gt;' : s);
const X2 = 'x<sup>2</sup>';

// Raw fraction (no reducing) and reduced fraction, as stacked HTML.
const fr = (n, d) => `<span class="fr"><span>${n}</span><span>${d}</span></span>`;
const F = (n, d) => {
  if (d < 0) { n = -n; d = -d; }
  const g = gcd(n, d) || 1; n /= g; d /= g;
  return d === 1 ? sgn(n) : fr(sgn(n), d);
};

// Show a numeric answer nicely: integer, small fraction, or 2-decimal.
function showNum(x) {
  if (Math.abs(x - Math.round(x)) < 1e-9) return sgn(Math.round(x));
  for (let d = 2; d <= 30; d++) {
    const n = x * d;
    if (Math.abs(n - Math.round(n)) < 1e-9) return F(Math.round(n), d);
  }
  return sgn(Math.round(x * 100) / 100);
}

// Build "3x^2 - 5x + 2" from [[coef, 'x<sup>2</sup>'], [coef, 'x'], [coef, '']].
function poly(terms) {
  let s = '';
  terms.forEach(([c, v]) => {
    if (c === 0) return;
    const a = Math.abs(c);
    const body = v ? (a === 1 ? '' : a) + v : '' + a;
    if (!s) s = (c < 0 ? '−' : '') + body;
    else s += (c < 0 ? ' − ' : ' + ') + body;
  });
  return s || '0';
}

// Multiple choice: put the correct answer among wrong ones, drop duplicates,
// shuffle, and return { choices, answer: index }.
function mc(correct, wrongs) {
  const seen = new Set([correct]);
  const w = [];
  wrongs.forEach((x) => { if (!seen.has(x)) { seen.add(x); w.push(x); } });
  const all = shuffle([correct, ...w.slice(0, 3)]);
  return { choices: all, answer: all.indexOf(correct) };
}

const SKILLS = [];
