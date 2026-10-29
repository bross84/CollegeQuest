// Chapter 3, sections 3.7 and 3.8.
const Z37 = '3.7 Rational functions', Z38 = '3.8 Inverses & radical functions';
const quadX = (a, b) => poly([[1, X2], [-(a + b), 'x'], [a * b, '']]); // (x - a)(x - b) expanded
const distinct = (n, lo = -6, hi = 6) => {
  const out = [];
  while (out.length < n) { const v = nz(lo, hi); if (!out.includes(v)) out.push(v); }
  return out;
};

SKILLS.push(
{
  id: 'ratdom', zone: Z37, glyph: 'x≠', name: 'Rational domain',
  rule: 'The domain is every real number except where the denominator equals 0. Set the denominator = 0 and solve.',
  tip: 'Only the denominator matters for the domain. Set it equal to 0 and solve (factor first if it is expanded). Those x-values are the ones to exclude. Enter several answers separated by commas.',
  video: 'domain of a rational function',
  gen() {
    const [p, q] = distinct(2), m = nz(-5, 5);
    const num = R(0, 1) ? poly([[1, 'x'], [m, '']]) : '' + nz(-5, 5);
    if (R(0, 3) === 0) {
      return { q: `f(x) = ${fr(num, fac(p))}<br>Which x-value is NOT in the domain?`, type: 'num', answer: p,
        steps: [`Set the denominator to 0: ${fac(p)} = 0.`, `<b>x = ${sgn(p)}</b>`] };
    }
    const expanded = R(0, 1), den = expanded ? quadX(p, q) : fac(p) + fac(q);
    return { q: `f(x) = ${fr(num, den)}<br>Which x-values are NOT in the domain?<br><small>Separate with commas</small>`, type: 'list', answer: [p, q],
      steps: [`Set the denominator to 0.${expanded ? ` Factor it: ${fac(p)}${fac(q)} = 0.` : ''}`, `Each factor gives an excluded value: <b>x = ${sgn(p)}, ${sgn(q)}</b>`] };
  },
},
{
  id: 'asymp', zone: Z37, glyph: 'y=', name: 'Asymptotes & holes',
  rule: 'Horizontal asymptote: compare degrees. Top smaller: y = 0. Equal: y = ratio of leading coefficients. Top bigger: none. A factor that cancels is a hole; a factor left in the denominator is a vertical asymptote.',
  tip: 'For horizontal asymptotes, only the highest powers matter. For holes and vertical asymptotes, factor top and bottom first and cancel matching factors: the cancelled factor makes a hole, whatever stays in the denominator makes a vertical asymptote.',
  video: 'horizontal asymptotes holes and vertical asymptotes of rational functions',
  gen() {
    const t = R(0, 2);
    if (t === 0) {
      const rel = R(0, 2); let n, d;
      if (rel === 0) { d = R(2, 3); n = R(1, d - 1); } else if (rel === 1) { d = R(1, 3); n = d; } else { n = R(2, 3); d = R(1, n - 1); }
      const a = nz(-6, 6), b = nz(-6, 6);
      const top = pp([[a, n], [nz(-5, 5), R(0, n - 1)]]), bot = pp([[b, d], [nz(-5, 5), R(0, d - 1)]]);
      const NONE = 'No horizontal asymptote', Z = 'y = 0', RA = `y = ${rt(a, b)}`, RB = `y = ${rt(b, a)}`;
      const ans = rel === 0 ? Z : rel === 1 ? RA : NONE;
      const m = mc(ans, [Z, RA, RB, NONE].filter((x) => x !== ans));
      return { q: `f(x) = ${fr(top, bot)}<br>What is the horizontal asymptote?`, type: 'choice', choices: m.choices, answer: m.answer,
        steps: [`Degree of the top is ${n}; degree of the bottom is ${d}.`, rel === 0 ? 'Top is smaller: y = 0.' : rel === 1 ? `Equal degrees: divide the leading coefficients, ${sgn(a)} / ${sgn(b)}.` : 'Top is bigger: there is no horizontal asymptote.', `<b>${ans}</b>`] };
    }
    const [a, b, c] = distinct(3, -5, 5), expanded = R(0, 1);
    const top = expanded ? quadX(a, b) : fac(a) + fac(b), bot = expanded ? quadX(a, c) : fac(a) + fac(c);
    const hole = t === 1;
    return { q: `f(x) = ${fr(top, bot)}<br>${hole ? 'At what x-value is the hole?' : 'Where is the vertical asymptote?'}`, type: 'num', answer: hole ? a : c,
      steps: [`Factor top and bottom: ${fr(fac(a) + fac(b), fac(a) + fac(c))}`, `${fac(a)} cancels, so there is a hole at x = ${sgn(a)}.`, `${fac(c)} stays in the denominator, so the vertical asymptote is x = ${sgn(c)}.`, `<b>x = ${sgn(hole ? a : c)}</b>`] };
  },
},
{
  id: 'ratint', zone: Z37, glyph: 'x↔y', name: 'Rational intercepts',
  rule: 'Horizontal intercept: set the numerator equal to 0. Vertical intercept: find f(0).',
  tip: 'For the horizontal intercept, only the top matters: set it to 0 (the zero must not also zero the denominator). For the vertical intercept, plug in x = 0 everywhere and simplify the fraction.',
  video: 'finding intercepts of rational functions',
  gen() {
    const [p, q, r] = distinct(3, -6, 6), a = nz(-3, 3);
    const f = `f(x) = ${fr(lead(a) + fac(p), fac(q) + fac(r))}`;
    if (R(0, 1)) return { q: `${f}<br>Find the horizontal intercept.`, type: 'num', answer: p,
      steps: [`Set the top to 0: ${lead(a)}${fac(p)} = 0.`, `<b>x = ${sgn(p)}</b>`] };
    const v = (-a * p) / (q * r);
    return { q: `${f}<br>Find the vertical intercept, f(0).<br><small>Fractions are fine</small>`, type: 'num', answer: v,
      steps: [`Plug in 0: ${fr(sgn(a) + '·' + pn(-p), pn(-q) + '·' + pn(-r))}`, `= ${fr(sgn(-a * p), sgn(q * r))} = <b>${F(-a * p, q * r)}</b>`] };
  },
},
{
  id: 'ratwrite', zone: Z37, glyph: 'f=?', name: 'Rational from asymptotes',
  rule: 'A zero of the numerator gives a horizontal intercept. A zero of the denominator gives a vertical asymptote. Factor (x − z) has its zero at x = z.',
  tip: 'Each factor (x − z) is zero at x = z, so flip the sign you see. Put the factor for the intercept on top and the factors for the asymptotes on the bottom.',
  video: 'writing a rational function from asymptotes and intercepts',
  gen() {
    let [p, q, r] = distinct(3, -5, 5);
    if (p > q) [p, q] = [q, p];
    const good = fr(fac(r), fac(p) + fac(q));
    const m = mc(good, [fr(fac(-r), fac(-p) + fac(-q)), fr(fac(p) + fac(q), fac(r)), fr(fac(r), fac(-p) + fac(q))]);
    return { q: `Which function has vertical asymptotes at x = ${sgn(p)} and x = ${sgn(q)} and a horizontal intercept at x = ${sgn(r)}?`, type: 'choice', choices: m.choices, answer: m.answer,
      steps: [`Horizontal intercept at ${sgn(r)}: ${fac(r)} goes on top.`, `Vertical asymptotes at ${sgn(p)} and ${sgn(q)}: ${fac(p)} and ${fac(q)} go on the bottom.`, `<b>${good}</b>`] };
  },
},
{
  id: 'inverse', zone: Z38, glyph: 'f⁻¹', name: 'Inverse functions',
  rule: 'To find an inverse: write y = f(x), swap x and y, then solve for y. f⁻¹(k) asks "which input gives output k?"',
  tip: 'f⁻¹(k) means: what x makes f(x) equal k? You can solve f(x) = k directly. To get a formula, swap x and y and solve for y.',
  video: 'finding the inverse of a function',
  gen() {
    const t = R(0, 3);
    if (t === 0) {
      const a = nz(-5, 5), b = nz(-9, 9), k = R(-9, 9), v = (k - b) / a;
      return { q: `f(x) = ${poly([[a, 'x'], [b, '']])}<br>Find f<sup>−1</sup>(${sgn(k)}).<br><small>Fractions are fine</small>`, type: 'num', answer: v,
        steps: [`f<sup>−1</sup>(${sgn(k)}) is the x that makes f(x) = ${sgn(k)}.`, `${poly([[a, 'x'], [b, '']])} = ${sgn(k)} → ${poly([[a, 'x']])} = ${sgn(k - b)}`, `<b>x = ${F(k - b, a)}</b>`] };
    }
    if (t === 1) {
      const b = nz(-9, 9), m = R(-3, 3), k = m ** 3 + b;
      return { q: `f(x) = ${poly([[1, 'x<sup>3</sup>'], [b, '']])}<br>Find f<sup>−1</sup>(${sgn(k)}).`, type: 'num', answer: m,
        steps: [`Solve f(x) = ${sgn(k)}: x<sup>3</sup> = ${sgn(k - b)}.`, `Take the cube root: <b>x = ${sgn(m)}</b>`] };
    }
    if (t === 2) {
      const b = nz(-9, 9), m = R(1, 6), k = m * m + b;
      return { q: `f(x) = ${poly([[1, X2], [b, '']])}, for x ≥ 0<br>Find f<sup>−1</sup>(${sgn(k)}).`, type: 'num', answer: m,
        steps: [`Solve f(x) = ${sgn(k)}: x<sup>2</sup> = ${sgn(k - b)}.`, `Square root, and x ≥ 0 means keep only the positive one: <b>x = ${m}</b>`] };
    }
    const a = pick([2, 3, 4, -2, -3]), b = nz(-8, 8);
    const good = fr(poly([[1, 'x'], [-b, '']]), sgn(a));
    const m = mc(good, [fr(poly([[1, 'x'], [b, '']]), sgn(a)), poly([[a, 'x'], [-b, '']]), fr(poly([[1, 'x'], [-b, '']]), sgn(-a))]);
    return { q: `Which is the inverse of f(x) = ${poly([[a, 'x'], [b, '']])}?`, type: 'choice', choices: m.choices, answer: m.answer,
      steps: [`y = ${poly([[a, 'x'], [b, '']])}. Swap x and y: x = ${poly([[a, 'y'], [b, '']])}.`, `Solve for y: ${poly([[a, 'y']])} = ${poly([[1, 'x'], [-b, '']])}, so y = <b>${good}</b>`] };
  },
},
{
  id: 'radeq', zone: Z38, glyph: '√x=', name: 'Radical equations',
  rule: 'Isolate the square root, square both sides, solve, then check every answer in the original equation.',
  tip: 'Get the root alone on one side first. Then square both sides. If you end up with two answers, plug each into the ORIGINAL equation: a root can never equal a negative number, so one may be extraneous.',
  video: 'solving radical equations extraneous solutions',
  gen() {
    const t = R(0, 2);
    if (t === 0) {
      const a = pick([1, 2, 3]), c = R(1, 6), x = R(-6, 10), b = c * c - a * x;
      return { q: `${rad(poly([[a, 'x'], [b, '']]))} = ${c}`, type: 'num', answer: x,
        steps: [`Square both sides: ${poly([[a, 'x'], [b, '']])} = ${c * c}`, `${poly([[a, 'x']])} = ${sgn(c * c - b)}`, `<b>x = ${sgn(x)}</b>`] };
    }
    if (t === 1) {
      const s = R(1, 6), k = nz(-5, 5), x = R(-5, 10), b = s * s - x, m = s + k;
      return { q: `${rad(poly([[1, 'x'], [b, '']]))} ${k < 0 ? '−' : '+'} ${Math.abs(k)} = ${sgn(m)}`, type: 'num', answer: x,
        steps: [`Isolate the root: ${rad(poly([[1, 'x'], [b, '']]))} = ${sgn(m)} ${k < 0 ? '+' : '−'} ${Math.abs(k)} = ${s}`, `Square both sides: ${poly([[1, 'x'], [b, '']])} = ${s * s}`, `<b>x = ${sgn(x)}</b>`] };
    }
    const k = nz(-4, 4), s = R(2, 5), v = k + s, w = k + 1 - s, h = k * k - w * v;
    return { q: `${rad(poly([[1, 'x'], [h, '']]))} = ${poly([[1, 'x'], [-k, '']])}<br><small>Check for extraneous solutions</small>`, type: 'num', answer: v,
      steps: [`Square both sides: ${poly([[1, 'x'], [h, '']])} = ${poly([[1, 'x'], [-k, '']])}<sup>2</sup>`, `Collect: ${quadX(v, w)} = 0, so x = ${sgn(v)} or x = ${sgn(w)}.`,
        `Check x = ${sgn(w)}: the right side is ${sgn(w - k)}, a negative number, but a square root can’t be negative. It is extraneous.`, `<b>x = ${sgn(v)}</b>`] };
  },
},
);
