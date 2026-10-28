// Chapter 3 (Polynomial and Rational Functions), sections 3.1 to 3.3.
// Helpers shared by the Chapter 3 files.
const pw = (e) => (e === 0 ? '' : e === 1 ? 'x' : `x<sup>${e}</sup>`);
const pp = (terms) => poly(terms.map(([c, e]) => [c, pw(e)])); // terms are [coef, exponent]
const fac = (p, m = 1) => (p === 0 ? 'x' : `(x ${p < 0 ? '+' : '−'} ${Math.abs(p)})`) + (m > 1 ? `<sup>${m}</sup>` : '');
const lead = (a) => (a === 1 ? '' : a === -1 ? '−' : '' + a);
const vform = (a, h, k) => `${lead(a)}${fac(h)}<sup>2</sup>${k === 0 ? '' : (k < 0 ? ' − ' : ' + ') + Math.abs(k)}`;
const cx = (a, b) => poly([[a, ''], [b, 'i']]); // a + bi
const rt = (a, b) => { const g = gcd(a, b) || 1; a /= g; b /= g; if (b < 0) { a = -a; b = -b; } return b === 1 ? sgn(a) : `${sgn(a)}/${b}`; };
const divs = (n) => { n = Math.abs(n); const d = []; for (let i = 1; i <= n; i++) if (n % i === 0) d.push(i); return d; };
const Z31 = '3.1 Power & polynomial functions', Z32 = '3.2 Quadratic functions', Z33 = '3.3 Graphs of polynomial functions';

SKILLS.push(
{
  id: 'pdeg', zone: Z31, glyph: 'deg', name: 'Degree & leading coefficient',
  rule: 'Degree = the highest exponent. Leading coefficient = the number in front of that term.',
  tip: 'Ignore the order the terms are written in. Find the term with the biggest exponent: that exponent is the degree and the number in front of it (with its sign) is the leading coefficient.',
  video: 'degree and leading coefficient of a polynomial',
  gen() {
    const d = R(2, 6);
    const lower = shuffle([...Array(d).keys()]).slice(0, R(2, 3));
    const terms = shuffle([d, ...lower]).map((e) => [nz(-9, 9), e]);
    const lc = terms.find(([, e]) => e === d)[0];
    const f = `f(x) = ${pp(terms)}`;
    if (R(0, 1)) return { q: `${f}<br>What is the degree?`, type: 'num', answer: d,
      steps: [`The biggest exponent is ${d}, so the degree is <b>${d}</b>.`] };
    return { q: `${f}<br>What is the leading coefficient?`, type: 'num', answer: lc,
      steps: [`The highest power is ${pw(d)}. The number in front of it is <b>${sgn(lc)}</b>.`] };
  },
},
{
  id: 'endb', zone: Z31, glyph: '↗↘', name: 'End behavior',
  rule: 'Look only at the leading term. Even degree: both ends go the same way. Odd degree: opposite ways. Positive leading coefficient: the right end goes up.',
  tip: 'Find the degree and the sign of the leading coefficient. Positive leading coefficient means the right end points up. Even degree means the left end matches the right end, odd means it does the opposite.',
  video: 'end behavior of polynomial functions leading coefficient test',
  gen() {
    const d = R(2, 7), lc = nz(-5, 5);
    const lower = shuffle([...Array(d).keys()]).slice(0, R(1, 2));
    const terms = shuffle([[lc, d], ...lower.map((e) => [nz(-6, 6), e])]);
    const even = d % 2 === 0;
    const UP = 'Both ends point up', DOWN = 'Both ends point down', LU = 'Left end down, right end up', LD = 'Left end up, right end down';
    const ans = even ? (lc > 0 ? UP : DOWN) : (lc > 0 ? LU : LD);
    const m = mc(ans, [UP, DOWN, LU, LD].filter((x) => x !== ans));
    return { q: `f(x) = ${pp(terms)}<br>What does the graph do at its ends?`, type: 'choice', choices: m.choices, answer: m.answer,
      steps: [`Leading term: ${pp([[lc, d]])}. Degree ${d} is ${even ? 'even' : 'odd'}; the leading coefficient is ${lc > 0 ? 'positive' : 'negative'}.`, `So: <b>${ans}</b>`] };
  },
},
{
  id: 'polyid', zone: Z31, glyph: 'P?', name: 'Is it a polynomial?',
  rule: 'A polynomial only has whole-number exponents (0, 1, 2, …) on x. No x in a denominator, under a root, or in an exponent.',
  tip: 'Scan each term. Negative exponents, fractional exponents, x in a denominator, or x up in the exponent all make it NOT a polynomial.',
  video: 'how to tell if a function is a polynomial',
  gen() {
    const base = pp([[nz(-6, 6), R(2, 5)], [nz(-6, 6), R(0, 1)]]);
    if (R(0, 1)) {
      const t = pp([[nz(-6, 6), R(3, 6)], [nz(-6, 6), R(1, 2)], [nz(-6, 6), 0]]);
      const m = mc('Polynomial', ['Not a polynomial']);
      return { q: `f(x) = ${t}<br>Polynomial or not?`, type: 'choice', choices: m.choices, answer: m.answer,
        steps: ['Every exponent on x is a whole number (0, 1, 2, …), so it <b>is a polynomial</b>.'] };
    }
    const c = R(2, 5), k = R(1, 3);
    const bad = pick([
      [`${c}x<sup>−${k}</sup>`, `x<sup>−${k}</sup> has a negative exponent.`],
      [`${c}x<sup>1/2</sup>`, 'x<sup>1/2</sup> is a fractional exponent (a square root).'],
      [`${c}<sup>x</sup>`, `x is in the exponent in ${c}<sup>x</sup>.`],
      [fr(c, 'x'), 'x is in a denominator.'],
    ]);
    const m = mc('Not a polynomial', ['Polynomial']);
    return { q: `f(x) = ${base} + ${bad[0]}<br>Polynomial or not?`, type: 'choice', choices: m.choices, answer: m.answer,
      steps: [`${bad[1]}`, 'So it is <b>not a polynomial</b>.'] };
  },
},
{
  id: 'lrb', zone: Z31, glyph: 'x→∞', name: 'Long-run notation',
  rule: '“As x → ∞, f(x) → ∞” means: when x gets huge and positive, f(x) gets huge and positive. The leading term decides both ends.',
  tip: 'Fill in two blanks: what f(x) does when x → ∞ (the right end) and when x → −∞ (the left end). Positive leading coefficient: the right end goes to ∞. Even degree: the left end matches the right end. Odd degree: it does the opposite.',
  video: 'end behavior notation as x approaches infinity polynomial functions',
  gen() {
    const INF = '∞', NI = '−∞';
    const say = (r, l) => `As x → ${INF}, f(x) → ${r}; as x → ${NI}, f(x) → ${l}`;
    const all = [[INF, INF], [NI, NI], [INF, NI], [NI, INF]];
    if (R(0, 1)) {
      const d = R(2, 7), lc = nz(-5, 5), even = d % 2 === 0;
      const lower = shuffle([...Array(d).keys()]).slice(0, R(1, 2));
      const terms = shuffle([[lc, d], ...lower.map((e) => [nz(-6, 6), e])]);
      const r = lc > 0 ? INF : NI, l = even ? r : (r === INF ? NI : INF), ans = say(r, l);
      const m = mc(ans, all.map(([a, b]) => say(a, b)).filter((x) => x !== ans));
      return { q: `f(x) = ${pp(terms)}<br>Which describes the long run behavior?`, type: 'choice', choices: m.choices, answer: m.answer,
        steps: [`Leading term: ${pp([[lc, d]])}. Degree ${d} is ${even ? 'even' : 'odd'}; the leading coefficient is ${lc > 0 ? 'positive' : 'negative'}.`,
          `Right end: ${lc > 0 ? 'up' : 'down'}, so f(x) → ${r}. Left end: ${even ? 'same as the right' : 'opposite of the right'}, so f(x) → ${l}.`, `<b>${ans}</b>`] };
    }
    const [r, l] = pick(all), even = r === l, pos = r === INF;
    const kind = (e, p) => `${e ? 'Even' : 'Odd'} degree, ${p ? 'positive' : 'negative'} leading coefficient`;
    const ans = kind(even, pos);
    const m = mc(ans, [kind(true, true), kind(true, false), kind(false, true), kind(false, false)].filter((x) => x !== ans));
    return { q: `${say(r, l)}.<br>What can you conclude about f(x)?`, type: 'choice', choices: m.choices, answer: m.answer,
      steps: [`The two ends go ${even ? 'the same way' : 'opposite ways'}, so the degree is ${even ? 'even' : 'odd'}.`, `The right end goes to ${r}, so the leading coefficient is ${pos ? 'positive' : 'negative'}.`, `<b>${ans}</b>`] };
  },
},
{
  id: 'turns', zone: Z31, glyph: 'n−1', name: 'Turning points & intercepts',
  rule: 'A polynomial of degree n has at most n horizontal intercepts and at most n − 1 turning points. Going backwards: m turns need degree at least m + 1.',
  tip: 'The degree sets the limits: at most n intercepts and at most n − 1 turns. Reading a graph, the degree must be at least the number of intercepts and at least turns + 1. Matching ends mean even degree; opposite ends mean odd.',
  video: 'turning points and intercepts of polynomial functions degree',
  gen() {
    const t = R(0, 2);
    if (t < 2) {
      const d = R(2, 7);
      const lower = shuffle([...Array(d).keys()]).slice(0, R(2, 3));
      const f = `f(x) = ${pp(shuffle([d, ...lower]).map((e) => [nz(-9, 9), e]))}`;
      return t === 0
        ? { q: `${f}<br>What is the most turning points its graph can have?`, type: 'num', answer: d - 1, steps: [`The degree is ${d}. At most n − 1 turns: ${d} − 1 = <b>${d - 1}</b>`] }
        : { q: `${f}<br>What is the most horizontal intercepts its graph can have?`, type: 'num', answer: d, steps: [`The degree is ${d}. At most n intercepts: <b>${d}</b>`] };
    }
    const D = R(3, 6), even = D % 2 === 0, m = D - 1 - 2 * R(0, Math.floor((D - 1) / 2) - (even ? 1 : 0)), k = R(1, D);
    const need = Math.max(k, m + 1);
    let ans = need; while (ans % 2 !== D % 2) ans++;
    const ends = even ? pick(['both ends pointing up', 'both ends pointing down']) : 'the ends pointing in opposite directions';
    const pl = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
    return { q: `A polynomial graph has ${ends}, ${pl(k, 'horizontal intercept')}, and ${pl(m, 'turning point')}.<br>What is the smallest degree it could have?`, type: 'num', answer: ans,
      steps: [`${even ? 'Matching' : 'Opposite'} ends mean an ${even ? 'even' : 'odd'} degree.`, `${pl(k, 'intercept')} need degree ≥ ${k}; ${pl(m, 'turn')} need degree ≥ ${m} + 1 = ${m + 1}. So at least ${need}.`, `Smallest ${even ? 'even' : 'odd'} number that is at least ${need}: <b>${ans}</b>`] };
  },
},
{
  id: 'expand', zone: Z31, glyph: '(x)(x)', name: 'Multiply out to standard form',
  rule: 'Multiply two factors first (FOIL), then multiply that result by the next factor. Leading term: multiply the x terms. Constant term: multiply the plain numbers.',
  tip: 'Do (x − p)(x − q) first: x² − (p + q)x + pq. Then multiply every term by the third factor and combine like terms. Check: the constant term should be the product of the plain numbers.',
  video: 'multiplying three binomials expand polynomial factored form to standard form',
  gen() {
    const z = shuffle([-4, -3, -2, -1, 1, 2, 3, 4]).slice(0, 3), [p, q, r] = z, a = pick([1, 1, 2, -1]);
    const s1 = p + q + r, s2 = p * q + p * r + q * r, s3 = p * q * r;
    const std = (co) => pp(co.map((c, i) => [c, 3 - i]));
    const co = [a, -a * s1, a * s2, -a * s3], ans = std(co);
    const m = mc(ans, [std([a, a * s1, a * s2, a * s3]), std([a, -a * s1, a * s2, a * s3]), std([a, -a * s1, a * (s2 + pick([-2, -1, 1, 2])), -a * s3])]);
    return { q: `Multiply out: f(x) = ${lead(a)}${fac(p)}${fac(q)}${fac(r)}`, type: 'choice', choices: m.choices, answer: m.answer,
      steps: [`${fac(p)}${fac(q)} = ${pp([[1, 2], [-(p + q), 1], [p * q, 0]])}`, `Multiply by ${fac(r)}${a === 1 ? '' : ` and by ${sgn(a)}`} and combine like terms.`, `Leading term ${pp([[a, 3]])}, constant ${sgn(-a * s3)}: <b>${ans}</b>`] };
  },
},
{
  id: 'vertex', zone: Z32, glyph: 'V', name: 'Vertex of a parabola',
  rule: 'Vertex form a(x − h)² + k: the vertex is (h, k). General form ax² + bx + c: h = −b / 2a, then k = f(h).',
  tip: 'In vertex form, h has the opposite sign of what you see in the parentheses: (x − 3) means h = 3, (x + 3) means h = −3. In general form, use h = −b/2a and plug h back in for k. Answer as h, k.',
  video: 'finding the vertex of a quadratic function',
  gen() {
    const a = nz(-3, 3), k = R(-8, 8);
    if (R(0, 1)) {
      const h = R(-6, 6);
      return { q: `f(x) = ${vform(a, h, k)}<br>Find the vertex.<br><small>Answer as h, k</small>`, type: 'pair', answer: [h, k],
        steps: [`Vertex form a(x − h)² + k: the factor is ${fac(h)}, so h = ${sgn(h)}.`, `k is the number added on the end: <b>(${sgn(h)}, ${sgn(k)})</b>`] };
    }
    const h = R(-4, 4), b = -2 * a * h, c = a * h * h + k;
    return { q: `f(x) = ${poly([[a, X2], [b, 'x'], [c, '']])}<br>Find the vertex.<br><small>Answer as h, k</small>`, type: 'pair', answer: [h, k],
      steps: [`h = −b / 2a = −${pn(b)} / (2·${pn(a)}) = ${sgn(h)}`, `k = f(${sgn(h)}) = ${sgn(k)}`, `Vertex: <b>(${sgn(h)}, ${sgn(k)})</b>`] };
  },
},
{
  id: 'quadform', zone: Z32, glyph: '±√', name: 'Quadratic formula',
  rule: 'x = (−b ± √(b² − 4ac)) / 2a',
  tip: 'Write down a, b and c first (keep their signs). Work out b² − 4ac, take its square root, then do both the + and the −. Enter answers separated by a comma; fractions like 1/2 are fine.',
  video: 'quadratic formula how to use',
  gen() {
    let a1, a2, b1, b2;
    do { a1 = pick([1, 2, 3]); a2 = pick([1, 2, 3]); b1 = nz(-6, 6); b2 = nz(-6, 6); } while (a1 * a2 === 1);
    const a = a1 * a2, b = a1 * b2 + a2 * b1, c = b1 * b2;
    const s = Math.abs(a1 * b2 - a2 * b1), D = s * s;
    const roots = [...new Set([(-b + s) / (2 * a), (-b - s) / (2 * a)])];
    return { q: `Solve ${poly([[a, X2], [b, 'x'], [c, '']])} = 0<br><small>Use the quadratic formula</small>`, type: 'list', answer: roots,
      steps: [`a = ${sgn(a)}, b = ${sgn(b)}, c = ${sgn(c)}`, `b² − 4ac = ${b * b} − ${pn(4 * a * c)} = ${D}, and √${D} = ${s}`,
        `x = (${sgn(-b)} ± ${s}) / ${2 * a}`, `<b>x = ${[...new Set([F(-b + s, 2 * a), F(-b - s, 2 * a)])].join(', ')}</b>`] };
  },
},
{
  id: 'qint', zone: Z32, glyph: 'x↔y', name: 'Intercepts of a quadratic',
  rule: 'Vertical intercept: find f(0). Horizontal intercepts: set f(x) = 0. On a factored form, each factor gives a zero.',
  tip: 'The vertical intercept is just f(0): plug in 0 for x and follow order of operations. For horizontal intercepts on a factored form, set each factor to zero. Enter several answers separated by commas.',
  video: 'finding x and y intercepts of a quadratic function',
  gen() {
    const a = nz(-3, 3);
    if (R(0, 1)) {
      const h = R(-5, 5), k = R(-8, 8), v = a * h * h + k;
      return { q: `f(x) = ${vform(a, h, k)}<br>Find the vertical intercept, f(0).`, type: 'num', answer: v,
        steps: [`f(0) = ${sgn(a)}·(0 − ${pn(h)})<sup>2</sup> + ${pn(k)}`, `= ${sgn(a)}·${h * h} + ${pn(k)} = <b>${sgn(v)}</b>`] };
    }
    const p = nz(-6, 6), q = R(0, 4) === 0 ? p : nz(-6, 6);
    const roots = [...new Set([p, q])];
    return { q: `f(x) = ${lead(a)}${fac(p)}${fac(q)}<br>Find the horizontal intercept(s).`, type: 'list', answer: roots,
      steps: [`Set f(x) = 0. A product is zero when a factor is zero.`, `${fac(p)} = 0 gives x = ${sgn(p)}${p === q ? '' : `; ${fac(q)} = 0 gives x = ${sgn(q)}`}`, `<b>x = ${roots.map(sgn).join(', ')}</b>`] };
  },
},
{
  id: 'mult', zone: Z33, glyph: 'mult', name: 'Zeros & multiplicity',
  rule: 'Each factor (x − p)ᵐ gives a zero at x = p with multiplicity m. Odd multiplicity: the graph crosses the axis. Even: it touches and bounces back.',
  tip: 'The zero comes from setting the factor to 0 (flip the sign you see). The exponent on that factor is its multiplicity. Add up all the exponents to get the degree.',
  video: 'zeros and multiplicity of polynomial functions',
  gen() {
    const pairs = shuffle([-5, -4, -3, -2, -1, 1, 2, 3, 4, 5]).slice(0, 3).map((p) => [p, pick([1, 1, 2, 3])]).sort((x, y) => x[0] - y[0]);
    if (!pairs.some(([, m]) => m > 1)) pairs[R(0, 2)][1] = pick([2, 3]);
    const a = pick([1, 1, 2, -1, -2]);
    const f = `f(x) = ${lead(a)}${pairs.map(([p, m]) => fac(p, m)).join('')}`;
    const [p, m] = pick(pairs), t = R(0, 3);
    if (t === 0) return { q: `${f}<br>What is the multiplicity of the zero at x = ${sgn(p)}?`, type: 'num', answer: m,
      steps: [`The factor ${fac(p)} has exponent <b>${m}</b>.`] };
    if (t === 1) {
      const ans = m % 2 ? 'Crosses the axis' : 'Touches the axis and turns around';
      const mm = mc(ans, ['Crosses the axis', 'Touches the axis and turns around'].filter((x) => x !== ans));
      return { q: `${f}<br>At x = ${sgn(p)}, the graph…`, type: 'choice', choices: mm.choices, answer: mm.answer,
        steps: [`The zero at ${sgn(p)} has multiplicity ${m}, which is ${m % 2 ? 'odd' : 'even'}.`, `Odd crosses, even bounces: <b>${ans}</b>`] };
    }
    if (t === 2) { const d = pairs.reduce((s, [, k]) => s + k, 0); return { q: `${f}<br>What is the degree?`, type: 'num', answer: d,
      steps: [`Add the exponents: ${pairs.map(([, k]) => k).join(' + ')} = <b>${d}</b>`] }; }
    return { q: `${f}<br>List the zeros.`, type: 'list', answer: pairs.map(([z]) => z),
      steps: [`Set each factor to zero and flip the sign.`, `<b>x = ${pairs.map(([z]) => sgn(z)).join(', ')}</b>`] };
  },
},
{
  id: 'polyineq', zone: Z33, glyph: '± 0', name: 'Polynomial inequalities',
  rule: 'Find the zeros, mark them on a number line, then test one point in each interval for positive or negative.',
  tip: 'The zeros split the number line into pieces. Test any number from each piece in the original product and see if it comes out positive or negative. Use ≤ ≥ (with the endpoints) only when the problem has ≤ or ≥.',
  video: 'solving polynomial inequalities sign chart',
  gen() {
    if (R(0, 1)) {
      let p = nz(-6, 6), q; do q = nz(-6, 6); while (q === p);
      if (p > q) [p, q] = [q, p];
      const op = pick(['>', '<', '≥', '≤']);
      const A = `x &lt; ${sgn(p)} or x &gt; ${sgn(q)}`, B = `${sgn(p)} &lt; x &lt; ${sgn(q)}`;
      const C = `x ≤ ${sgn(p)} or x ≥ ${sgn(q)}`, D = `${sgn(p)} ≤ x ≤ ${sgn(q)}`;
      const ans = { '>': A, '<': B, '≥': C, '≤': D }[op];
      const m = mc(ans, [A, B, C, D].filter((x) => x !== ans));
      return { q: `Solve ${fac(p)}${fac(q)} ${sd(op)} 0`, type: 'choice', choices: m.choices, answer: m.answer,
        steps: [`Zeros: x = ${sgn(p)} and x = ${sgn(q)}.`, `Test a point in each piece. The product is positive outside the zeros and negative between them.`, `<b>${ans}</b>`] };
    }
    const z = shuffle([-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5]).slice(0, 3).sort((x, y) => x - y), [a, b, c] = z, op = pick(['>', '<']);
    const P = `${sgn(a)} &lt; x &lt; ${sgn(b)} or x &gt; ${sgn(c)}`, N = `x &lt; ${sgn(a)} or ${sgn(b)} &lt; x &lt; ${sgn(c)}`;
    const ans = op === '>' ? P : N;
    const m = mc(ans, [op === '>' ? N : P, `x &lt; ${sgn(a)} or x &gt; ${sgn(c)}`, `${sgn(a)} &lt; x &lt; ${sgn(c)}`]);
    return { q: `Solve ${z.map((r) => fac(r)).join('')} ${sd(op)} 0`, type: 'choice', choices: m.choices, answer: m.answer,
      steps: [`Zeros: x = ${z.map(sgn).join(', ')}.`, `Right of ${sgn(c)} every factor is positive, so the product is positive. The sign flips each time you pass a zero.`, `<b>${ans}</b>`] };
  },
},
{
  id: 'writepoly', zone: Z33, glyph: 'a(x−p)', name: 'Polynomial from zeros',
  rule: 'Start with f(x) = a(x − p)(x − q)… using the zeros, then plug in the vertical intercept (0, y) and solve for a.',
  tip: 'Plug x = 0 into the factored form: each factor becomes (0 − zero). Multiply those numbers together, set that times a equal to the given y-value, and solve for a.',
  video: 'writing equation of polynomial from zeros and a point',
  gen() {
    const zs = shuffle([-4, -3, -2, -1, 1, 2, 3, 4]).slice(0, R(2, 3)).sort((x, y) => x - y);
    const a = nz(-3, 3), prod = zs.reduce((m, z) => m * -z, 1), y = a * prod;
    return { q: `A polynomial has zeros at ${zs.map(sgn).join(', ')} and vertical intercept (0, ${sgn(y)}).<br>It has the form f(x) = a${zs.map((z) => fac(z)).join('')}.<br>Find a.`, type: 'num', answer: a,
      steps: [`f(0) = a·${zs.map((z) => pn(-z)).join('·')} = ${sgn(prod)}a`, `${sgn(prod)}a = ${sgn(y)}, so <b>a = ${sgn(a)}</b>`] };
  },
},
);
