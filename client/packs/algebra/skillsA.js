// Zone 1: Foundations  |  Zone 2: Equations
SKILLS.push(
{
  id: 'signs', zone: 'Foundations', glyph: '±', name: 'Negatives & signs',
  rule: 'Sign rules for add, subtract, multiply',
  tip: 'Subtracting a negative flips to adding. Same signs multiply to positive, different signs to negative.',
  video: 'adding subtracting multiplying negative numbers',
  gen() {
    const t = R(0, 2);
    if (t === 0) {
      const a = R(-12, 12), b = nz(-12, 12);
      return { q: `${sgn(a)} − ${pn(b)}`, type: 'num', answer: a - b,
        steps: [`Subtracting ${pn(b)} is the same as adding ${sgn(-b)}.`, `${sgn(a)} + ${pn(-b)} = <b>${sgn(a - b)}</b>`] };
    }
    if (t === 1) {
      const a = nz(-9, 9), b = nz(-9, 9);
      return { q: `${pn(a)} · ${pn(b)}`, type: 'num', answer: a * b,
        steps: [`Multiply sizes: ${Math.abs(a)} · ${Math.abs(b)} = ${Math.abs(a * b)}.`,
          `${a * b > 0 ? 'Same signs' : 'Different signs'} → <b>${sgn(a * b)}</b>`] };
    }
    const a = R(-10, 10), b = nz(-10, 10), c = nz(-10, 10);
    return { q: `${sgn(a)} + ${pn(b)} − ${pn(c)}`, type: 'num', answer: a + b - c,
      steps: [`Rewrite subtracting ${pn(c)} as adding ${sgn(-c)}: ${sgn(a)} + ${pn(b)} + ${pn(-c)}`,
        `Work left to right: <b>${sgn(a + b - c)}</b>`] };
  },
},
{
  id: 'order', zone: 'Foundations', glyph: '( )', name: 'Order of operations',
  rule: 'PEMDAS (parentheses, exponents, multiply/divide, add/subtract)',
  tip: 'Do parentheses first, then exponents, then multiply/divide left to right, then add/subtract.',
  video: 'order of operations PEMDAS',
  gen() {
    const t = R(0, 2);
    if (t === 0) {
      const a = R(2, 12), b = R(2, 9), c = R(2, 9), d = R(1, 12);
      return { q: `${a} + ${b} × ${c} − ${d}`, type: 'num', answer: a + b * c - d,
        steps: [`Multiply first: ${b} × ${c} = ${b * c}.`, `${a} + ${b * c} − ${d} = <b>${a + b * c - d}</b>`] };
    }
    if (t === 1) {
      const a = R(2, 6), b = R(1, 9), c = R(1, 9), d = R(2, 6);
      return { q: `${a} × (${b} + ${c}) − ${d}<sup>2</sup>`, type: 'num', answer: a * (b + c) - d * d,
        steps: [`Parentheses: ${b} + ${c} = ${b + c}.`, `Exponent: ${d}<sup>2</sup> = ${d * d}.`,
          `${a} × ${b + c} − ${d * d} = <b>${a * (b + c) - d * d}</b>`] };
    }
    const a = R(2, 7), b = R(2, 9), c = R(5, 15), d = R(1, 4);
    return { q: `${a}<sup>2</sup> − ${b} × (${c} − ${d})`, type: 'num', answer: a * a - b * (c - d),
      steps: [`Parentheses: ${c} − ${d} = ${c - d}.`, `Exponent: ${a}<sup>2</sup> = ${a * a}.`,
        `Multiply: ${b} × ${c - d} = ${b * (c - d)}.`, `${a * a} − ${b * (c - d)} = <b>${sgn(a * a - b * (c - d))}</b>`] };
  },
},
{
  id: 'fractions', zone: 'Foundations', glyph: 'a/b', name: 'Fractions',
  rule: 'Common denominator (add/subtract), multiply across, flip and multiply (divide)',
  tip: 'Adding or subtracting needs a common denominator. Multiplying goes straight across. Dividing means flip the second fraction and multiply. Type answers like 3/4.',
  video: 'adding subtracting multiplying dividing fractions',
  gen() {
    const ds = [2, 3, 4, 5, 6, 8];
    let b = pick(ds), d = pick(ds);
    const a = R(1, b + 2), c = R(1, d + 2);
    const op = pick(['+', '−', '×', '÷']);
    const q = `${fr(a, b)} ${op} ${fr(c, d)}`;
    if (op === '+' || op === '−') {
      const L = lcm(b, d), s = op === '+' ? 1 : -1;
      const n = a * (L / b) + s * c * (L / d);
      return { q, type: 'num', answer: n / L,
        steps: [`Common denominator: ${L}.`, `${fr(a * (L / b), L)} ${op} ${fr(c * (L / d), L)} = ${fr(sgn(n), L)}`, `Reduce: <b>${F(n, L)}</b>`] };
    }
    if (op === '×') {
      return { q, type: 'num', answer: (a * c) / (b * d),
        steps: [`Multiply across: ${fr(a * c, b * d)}`, `Reduce: <b>${F(a * c, b * d)}</b>`] };
    }
    return { q, type: 'num', answer: (a * d) / (b * c),
      steps: [`Flip the second fraction and multiply: ${fr(a, b)} × ${fr(d, c)}`, `${fr(a * d, b * c)} → <b>${F(a * d, b * c)}</b>`] };
  },
},
{
  id: 'exponents', zone: 'Foundations', glyph: 'xⁿ', name: 'Exponent rules',
  rule: 'Product, quotient, power and negative-exponent rules',
  tip: 'Same base: multiplying adds exponents, dividing subtracts, a power of a power multiplies. A negative exponent flips to the bottom of a fraction.',
  video: 'laws of exponents rules',
  gen() {
    const t = R(0, 3);
    if (t === 0) {
      const a = R(2, 9), b = R(2, 9);
      return { q: `x<sup>${a}</sup> · x<sup>${b}</sup> = x<sup>n</sup>.<br>What is n?`, type: 'num', answer: a + b,
        steps: [`Same base, multiplying → add exponents: ${a} + ${b} = <b>${a + b}</b>`] };
    }
    if (t === 1) {
      const a = R(2, 6), b = R(2, 5);
      return { q: `(x<sup>${a}</sup>)<sup>${b}</sup> = x<sup>n</sup>.<br>What is n?`, type: 'num', answer: a * b,
        steps: [`Power of a power → multiply exponents: ${a} · ${b} = <b>${a * b}</b>`] };
    }
    if (t === 2) {
      const a = R(2, 9), b = R(2, 9);
      return { q: `x<sup>${a}</sup> ÷ x<sup>${b}</sup> = x<sup>n</sup>.<br>What is n?`, type: 'num', answer: a - b,
        steps: [`Same base, dividing → subtract exponents: ${a} − ${b} = <b>${sgn(a - b)}</b>`] };
    }
    const base = pick([2, 3, 4, 5]), k = R(1, base === 2 ? 4 : 2);
    return { q: `${base}<sup>−${k}</sup> =`, type: 'num', answer: 1 / Math.pow(base, k),
      steps: [`A negative exponent flips it: ${base}<sup>−${k}</sup> = ${fr(1, base + '<sup>' + k + '</sup>')}`,
        `<b>${fr(1, Math.pow(base, k))}</b>`] };
  },
},
{
  id: 'linear1', zone: 'Equations', glyph: 'x=', name: 'Solve linear equations',
  rule: 'Inverse operations (undo add/subtract first, then multiply/divide)',
  tip: 'Undo the adding or subtracting first, then undo the multiplying or dividing. Whatever you do to one side, do to the other.',
  video: 'solving two step equations',
  gen() {
    const x = R(-9, 9);
    if (R(0, 3) === 0) {
      const a = R(2, 6), b = nz(-8, 8);
      const xm = a * R(-6, 6); // multiple of a so the right side is a whole number
      return { q: `${fr('x', a)} ${b < 0 ? '−' : '+'} ${Math.abs(b)} = ${sgn(xm / a + b)}`, type: 'num', answer: xm,
        steps: [`Subtract ${sgn(b)} from both sides: ${fr('x', a)} = ${sgn(xm / a)}`, `Multiply both sides by ${a}: <b>x = ${sgn(xm)}</b>`] };
    }
    const a = nz(-7, 7), b = nz(-12, 12);
    const c = a * x + b;
    return { q: `${poly([[a, 'x'], [b, '']])} = ${sgn(c)}`, type: 'num', answer: x,
      steps: [`Undo the ${sgn(b)}: ${poly([[a, 'x']])} = ${sgn(c - b)}`, `Divide both sides by ${sgn(a)}: <b>x = ${sgn(x)}</b>`] };
  },
},
{
  id: 'linear2', zone: 'Equations', glyph: 'x⇄', name: 'Variables on both sides',
  rule: 'Collect variable terms on one side, constants on the other',
  tip: 'Move all the x terms to one side and all plain numbers to the other, then divide by the coefficient.',
  video: 'solving equations with variables on both sides',
  gen() {
    const x = R(-8, 8), a = R(2, 9);
    let c; do c = R(-5, 8); while (c === a);
    const b = R(-10, 10), d = a * x + b - c * x;
    return { q: `${poly([[a, 'x'], [b, '']])} = ${poly([[c, 'x'], [d, '']])}`, type: 'num', answer: x,
      steps: [`Subtract ${sgn(c)}x from both sides: ${poly([[a - c, 'x'], [b, '']])} = ${sgn(d)}`,
        `Move the constant: ${poly([[a - c, 'x']])} = ${sgn(d - b)}`, `Divide by ${sgn(a - c)}: <b>x = ${sgn(x)}</b>`] };
  },
},
{
  id: 'ineq', zone: 'Equations', glyph: '<', name: 'Inequalities',
  rule: 'Solve like an equation, but flip the sign when multiplying or dividing by a negative',
  tip: 'Solve it like an equation. The one new rule: if you divide or multiply by a negative number, the inequality sign flips.',
  video: 'solving linear inequalities flip sign negative',
  gen() {
    const FLIP = { '<': '>', '>': '<', '≤': '≥', '≥': '≤' };
    const a = nz(-6, 6), x0 = nz(-8, 8), b = R(-9, 9), c = a * x0 + b;
    const op = pick(['<', '>', '≤', '≥']);
    const cs = a < 0 ? FLIP[op] : op;
    const line = (s, n) => `x ${sd(s)} ${sgn(n)}`;
    const m = mc(line(cs, x0), [line(FLIP[cs], x0), line(cs, -x0), line(FLIP[cs], -x0)]);
    return { q: `${poly([[a, 'x'], [b, '']])} ${sd(op)} ${sgn(c)}`, type: 'choice', choices: m.choices, answer: m.answer,
      steps: [`Undo the ${sgn(b)}: ${poly([[a, 'x']])} ${sd(op)} ${sgn(c - b)}`,
        `Divide by ${sgn(a)}${a < 0 ? ' — negative, so flip the sign' : ''}: <b>${line(cs, x0)}</b>`] };
  },
},
{
  id: 'absval', zone: 'Equations', glyph: '| |', name: 'Absolute value equations',
  rule: 'Split |A| = k into A = k and A = −k',
  tip: 'Split it into two equations: the inside equals k, and the inside equals −k. Solve both. Enter answers separated by a comma.',
  video: 'solving absolute value equations',
  gen() {
    const a = pick([1, 2, 3]), h = R(-5, 5), k = R(1, 6);
    const b = -a * h, c = a * k;
    return { q: `|${poly([[a, 'x'], [b, '']])}| = ${c}`, type: 'list', answer: [h - k, h + k],
      steps: [`Split: ${poly([[a, 'x'], [b, '']])} = ${c} &nbsp;or&nbsp; ${poly([[a, 'x'], [b, '']])} = −${c}`,
        `Solve each: <b>x = ${sgn(h + k)}</b> and <b>x = ${sgn(h - k)}</b>`] };
  },
},
);
