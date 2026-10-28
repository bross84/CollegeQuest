// Chapter 3, sections 3.4 to 3.6.
const Z34 = '3.4 Factor & Remainder Theorems', Z35 = '3.5 Real zeros of polynomials', Z36 = '3.6 Complex zeros';
// Synthetic division of coefficient list `co` (highest power first) by (x - c). Returns { q, r }.
function synth(co, c) {
  const out = [co[0]];
  for (let i = 1; i < co.length; i++) out.push(co[i] + c * out[i - 1]);
  return { q: out.slice(0, -1), r: out[out.length - 1] };
}
const cubic = (co) => pp(co.map((c, i) => [c, co.length - 1 - i]));
const addTail = (t) => (t.startsWith('−') ? ` − ${t.slice(1)}` : ` + ${t}`);

SKILLS.push(
{
  id: 'remth', zone: Z34, glyph: 'f(c)', name: 'Remainder Theorem',
  rule: 'Dividing f(x) by (x − c) leaves a remainder of f(c). If f(c) = 0, then (x − c) is a factor.',
  tip: 'No long division needed: plug c into f and simplify. Use c, not the sign you see: for (x + 2), c = −2. A result of 0 means it divides evenly, so it is a factor.',
  video: 'remainder theorem and factor theorem',
  gen() {
    const c = nz(-3, 3);
    let co;
    const rand = () => [pick([1, 2]), nz(-6, 6), nz(-8, 8), nz(-9, 9)];
    const val = (k) => k[0] * c ** 3 + k[1] * c * c + k[2] * c + k[3];
    if (R(0, 1)) {
      co = rand();
      const v = val(co);
      return { q: `f(x) = ${cubic(co)}<br>Find the remainder when f(x) is divided by ${fac(c)}.`, type: 'num', answer: v,
        steps: [`Remainder = f(${sgn(c)}).`, `${sgn(co[0])}·${pn(c)}<sup>3</sup> + ${pn(co[1])}·${pn(c)}<sup>2</sup> + ${pn(co[2])}·${pn(c)} + ${pn(co[3])}`,
          `= ${sgn(co[0] * c ** 3)} + ${pn(co[1] * c * c)} + ${pn(co[2] * c)} + ${pn(co[3])} = <b>${sgn(v)}</b>`] };
    }
    const yes = R(0, 1);
    if (yes) { const p = nz(-5, 5), q = nz(-6, 6), a = pick([1, 2]); co = [a, a * (p - c), a * (q - c * p), -a * c * q]; }
    else do co = rand(); while (val(co) === 0);
    const v = val(co), m = mc(yes ? 'Yes' : 'No', [yes ? 'No' : 'Yes']);
    return { q: `f(x) = ${cubic(co)}<br>Is ${fac(c)} a factor of f(x)?`, type: 'choice', choices: m.choices, answer: m.answer,
      steps: [`Check f(${sgn(c)}). If it is 0, the factor divides evenly.`, `f(${sgn(c)}) = ${sgn(v)}`, v === 0 ? '<b>Yes</b>: the remainder is 0.' : `<b>No</b>: the remainder is ${sgn(v)}, not 0.`] };
  },
},
{
  id: 'synth', zone: Z34, glyph: '÷', name: 'Synthetic division',
  rule: 'To divide by (x − c): write c, bring down the leading coefficient, then multiply by c and add, moving across. The last number is the remainder.',
  tip: 'Use c, not the sign you see: dividing by (x + 2) means c = −2. Bring down the first coefficient, multiply by c, add to the next coefficient, and repeat. The last number is the remainder; the others are the quotient.',
  video: 'synthetic division of polynomials',
  gen() {
    const co = [pick([1, 2, 3]), nz(-7, 7), nz(-7, 7), nz(-9, 9)], c = nz(-4, 4);
    const { q, r } = synth(co, c);
    const quo = (x) => pp(x.map((k, i) => [k, x.length - 1 - i]));
    const show = (x, rem) => `${quo(x)}, remainder ${sgn(rem)}`;
    const flip = synth(co, -c);
    const m = mc(show(q, r), [show(flip.q, flip.r), show(q, r + pick([1, 2, 3])), show([q[0], q[1], q[2] + pick([-2, -1, 1, 2])], r)]);
    return { q: `Divide ${cubic(co)} by ${fac(c)}.<br><small>Use synthetic division</small>`, type: 'choice', choices: m.choices, answer: m.answer,
      steps: [`${fac(c)} means c = ${sgn(c)}. Coefficients: ${co.map(sgn).join(', ')}.`, `Bring down, multiply by c, add: ${[...q, r].map(sgn).join(', ')}.`,
        `The last number is the remainder: <b>${show(q, r)}</b>`] };
  },
},
{
  id: 'factork', zone: Z34, glyph: 'k=?', name: 'Find k with the Factor Theorem',
  rule: 'If (x − c) is a factor of f(x), then f(c) = 0. Plug in c, set the result to 0, and solve for k.',
  tip: 'Replace every x with c. The k term turns into k times a number. Collect the plain numbers, set the whole thing equal to 0, and solve for k.',
  video: 'factor theorem find unknown coefficient k',
  gen() {
    const c = nz(-3, 3), k = nz(-5, 5), a1 = nz(-6, 6), a0 = -(c ** 3 + k * c * c + a1 * c);
    const rest = c ** 3 + a1 * c + a0, tail = poly([[a1, 'x'], [a0, '']]);
    return { q: `${fac(c)} is a factor of f(x) = x<sup>3</sup> + kx<sup>2</sup>${addTail(tail)}.<br>Find k.`, type: 'num', answer: k,
      steps: [`A factor means f(${sgn(c)}) = 0.`, `${pn(c)}<sup>3</sup> + k·${pn(c)}<sup>2</sup> + ${pn(a1)}·${pn(c)} + ${pn(a0)} = 0`, `${c * c}k + ${pn(rest)} = 0`, `<b>k = ${sgn(k)}</b>`] };
  },
},
{
  id: 'ratroots', zone: Z35, glyph: 'p/q', name: 'Rational Roots Theorem',
  rule: 'Possible rational zeros are ± p/q, where p divides the constant term and q divides the leading coefficient.',
  tip: 'List the factors of the constant term (the p’s) and the factors of the leading coefficient (the q’s). A possible zero is any ± p/q built from them, written in lowest terms.',
  video: 'rational root theorem possible rational zeros',
  gen() {
    const an = pick([2, 3, 4, 6]), a0 = pick([-1, 1]) * pick([6, 8, 9, 10, 12, 15]);
    const co = [an, nz(-7, 7), nz(-7, 7), a0];
    let p, q;
    do { p = pick(divs(a0)); q = pick(divs(an)); } while (gcd(p, q) !== 1);
    const sg = pick([-1, 1]);
    const badP = [];
    for (let n = 2; badP.length < 2; n++) if (a0 % n !== 0 && gcd(n, q) === 1) badP.push(n);
    let badQ = 2;
    while (an % badQ === 0 || gcd(p, badQ) !== 1) badQ++;
    const ans = rt(sg * p, q);
    const m = mc(ans, [rt(sg * badP[0], q), rt(-sg * badP[1], q), rt(sg * p, badQ)]);
    return { q: `f(x) = ${cubic(co)}<br>Which could be a rational zero?`, type: 'choice', choices: m.choices, answer: m.answer,
      steps: [`p divides the constant term ${a0}: ${divs(a0).join(', ')}.`, `q divides the leading coefficient ${an}: ${divs(an).join(', ')}.`,
        `<b>${ans}</b> uses a p and a q from those lists. The others use a number that is not a factor.`] };
  },
},
{
  id: 'realzeros', zone: Z35, glyph: 'x=?', name: 'Find all real zeros',
  rule: 'List the possible rational zeros, test one with synthetic division, then factor or solve the leftover quadratic.',
  tip: 'Possible zeros are factors of the constant term (leading coefficient is 1 here). Test them with synthetic division until you get remainder 0, then factor the quotient. Enter all zeros separated by commas.',
  video: 'finding all real zeros of a polynomial rational root theorem synthetic division',
  gen() {
    const z = shuffle([-4, -3, -2, -1, 1, 2, 3, 4]).slice(0, 3);
    const [p, q, r] = z, s1 = p + q + r, s2 = p * q + p * r + q * r, s3 = p * q * r;
    const co = [1, -s1, s2, -s3], d = synth(co, p);
    return { q: `Find all real zeros of<br>f(x) = ${cubic(co)}<br><small>Separate with commas</small>`, type: 'list', answer: z.slice().sort((a, b) => a - b),
      steps: [`Possible zeros: factors of ${sgn(-s3)}, so ±${divs(s3).join(', ±')}.`, `Try x = ${sgn(p)} with synthetic division: the remainder is 0, so it is a zero.`,
        `The quotient is ${pp([[1, 2], [d.q[1], 1], [d.q[2], 0]])} = ${fac(q)}${fac(r)}.`, `<b>x = ${z.slice().sort((a, b) => a - b).map(sgn).join(', ')}</b>`] };
  },
},
{
  id: 'cplxarith', zone: Z36, glyph: 'a+bi', name: 'Complex number arithmetic',
  rule: 'Add or subtract the real parts and the imaginary parts separately. To multiply, FOIL and replace i² with −1. Powers of i repeat every 4: i, −1, −i, 1.',
  tip: 'Treat i like a variable, then swap every i² for −1. For powers of i, divide the exponent by 4 and use the remainder: 1 is i, 2 is −1, 3 is −i, 0 is 1. For answers a + bi, enter a, b.',
  video: 'complex numbers add subtract multiply imaginary i',
  gen() {
    const t = R(0, 2), a = nz(-6, 6), b = nz(-6, 6), c = nz(-6, 6), d = nz(-6, 6);
    if (t === 0) {
      const s = pick([1, -1]);
      return { q: `(${cx(a, b)}) ${s > 0 ? '+' : '−'} (${cx(c, d)})<br><small>Answer as a, b for a + bi</small>`, type: 'pair', answer: [a + s * c, b + s * d],
        steps: [`Real parts: ${sgn(a)} ${s > 0 ? '+' : '−'} ${pn(c)} = ${sgn(a + s * c)}`, `Imaginary parts: ${sgn(b)} ${s > 0 ? '+' : '−'} ${pn(d)} = ${sgn(b + s * d)}`, `<b>${cx(a + s * c, b + s * d)}</b>`] };
    }
    if (t === 1) {
      const re = a * c - b * d, im = a * d + b * c;
      return { q: `(${cx(a, b)})(${cx(c, d)})<br><small>Answer as a, b for a + bi</small>`, type: 'pair', answer: [re, im],
        steps: [`FOIL: ${sgn(a * c)} + ${pn(a * d)}i + ${pn(b * c)}i + ${pn(b * d)}i²`, `Replace i² with −1: ${sgn(a * c)} − ${pn(b * d)} + ${pn(a * d + b * c)}i`, `<b>${cx(re, im)}</b>`] };
    }
    const n = R(5, 43), ans = ['1', 'i', '−1', '−i'][n % 4];
    const m = mc(ans, ['1', 'i', '−1', '−i'].filter((x) => x !== ans));
    return { q: `Simplify i<sup>${n}</sup>`, type: 'choice', choices: m.choices, answer: m.answer,
      steps: [`Powers of i repeat every 4. ${n} ÷ 4 leaves remainder ${n % 4}.`, `Remainder 1 is i, 2 is −1, 3 is −i, 0 is 1: <b>${ans}</b>`] };
  },
},
{
  id: 'cplxroots', zone: Z36, glyph: '±i', name: 'Complex zeros',
  rule: 'When b² − 4ac is negative, √(−n) = i√n. Complex zeros of a real polynomial come in conjugate pairs: a + bi and a − bi.',
  tip: 'Use the quadratic formula. A negative number under the root becomes i times the positive root. The two solutions are the same except for the sign in front of the i term.',
  video: 'complex zeros of quadratic using quadratic formula',
  gen() {
    if (R(0, 1)) {
      const h = R(-4, 4), k = R(1, 5), b = -2 * h, c = h * h + k * k, D = b * b - 4 * c;
      return { q: `Solve ${poly([[1, X2], [b, 'x'], [c, '']])} = 0<br>The solutions are h ± ki.<br><small>Answer as h, k with k positive</small>`, type: 'pair', answer: [h, k],
        steps: [`b² − 4ac = ${b * b} − ${4 * c} = ${sgn(D)}, which is negative.`, `√${sgn(D)} = ${2 * k}i`, `x = (${sgn(-b)} ± ${2 * k}i) / 2 = <b>${sgn(h)} ± ${k}i</b>`] };
    }
    const a = nz(-5, 5), b = R(1, 5), ans = cx(a, -b);
    const m = mc(ans, [cx(-a, b), cx(-a, -b), cx(b, a)]);
    return { q: `A polynomial with real coefficients has the zero ${cx(a, b)}.<br>Which must also be a zero?`, type: 'choice', choices: m.choices, answer: m.answer,
      steps: [`Complex zeros of real polynomials come in conjugate pairs.`, `Keep the real part, flip the sign of the i part: <b>${ans}</b>`] };
  },
},
);
