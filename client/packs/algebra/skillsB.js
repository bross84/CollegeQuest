// Zone 3: Lines & systems  |  Zone 4: Quadratics & radicals  |  Zone 5: Functions & logs
const rad = (n) => `√<span class="rad">${n}</span>`;
const bin = (p, q) => {
  [p, q] = [p, q].sort((a, b) => a - b);
  const f = (n) => `(x ${n < 0 ? '−' : '+'} ${Math.abs(n)})`;
  return f(p) + f(q);
};

SKILLS.push(
{
  id: 'slope', zone: 'Lines & systems', glyph: 'm', name: 'Slope',
  rule: 'Slope formula: rise over run, (y₂ − y₁) / (x₂ − x₁)',
  tip: 'Slope is change in y over change in x. Keep the points in the same order on top and bottom. For an equation, solve for y first. Type answers like 3/4 or -2.',
  video: 'slope formula from two points',
  gen() {
    if (R(0, 2) === 0) {
      const a = nz(-6, 6), b = nz(-6, 6), c = R(-9, 9);
      return { q: `Find the slope of<br>${poly([[a, 'x'], [b, 'y']])} = ${sgn(c)}`, type: 'num', answer: -a / b,
        steps: [`Solve for y: ${poly([[b, 'y']])} = ${poly([[-a, 'x'], [c, '']])}`, `Divide by ${sgn(b)}. The number in front of x is the slope: <b>${F(-a, b)}</b>`] };
    }
    const x1 = R(-6, 6), y1 = R(-6, 6), y2 = R(-6, 6);
    let x2; do x2 = R(-6, 6); while (x2 === x1);
    return { q: `Slope through<br>(${sgn(x1)}, ${sgn(y1)}) and (${sgn(x2)}, ${sgn(y2)})`, type: 'num', answer: (y2 - y1) / (x2 - x1),
      steps: [`${fr('y₂ − y₁', 'x₂ − x₁')} = ${fr(sgn(y2) + ' − ' + pn(y1), sgn(x2) + ' − ' + pn(x1))}`,
        `= ${fr(sgn(y2 - y1), sgn(x2 - x1))} = <b>${F(y2 - y1, x2 - x1)}</b>`] };
  },
},
{
  id: 'systems', zone: 'Lines & systems', glyph: '{ }', name: 'Systems of equations',
  rule: 'Elimination (or substitution)',
  tip: 'Multiply one or both equations so a variable has matching coefficients, add or subtract to eliminate it, solve, then substitute back. Enter the answer as x, y.',
  video: 'solving systems of equations by elimination',
  gen() {
    let a1, b1, a2, b2;
    do { a1 = nz(-5, 5); b1 = nz(-5, 5); a2 = nz(-5, 5); b2 = nz(-5, 5); } while (a1 * b2 - a2 * b1 === 0);
    const x = R(-6, 6), y = R(-6, 6);
    const c1 = a1 * x + b1 * y, c2 = a2 * x + b2 * y;
    return { q: `${poly([[a1, 'x'], [b1, 'y']])} = ${sgn(c1)}<br>${poly([[a2, 'x'], [b2, 'y']])} = ${sgn(c2)}<br><small>Answer as x, y</small>`,
      type: 'pair', answer: [x, y],
      steps: [`Multiply equation 1 by ${sgn(a2)} and equation 2 by ${sgn(a1)} so the x terms match.`,
        `Subtract to eliminate x, then solve: <b>y = ${sgn(y)}</b>`, `Substitute y back in: <b>x = ${sgn(x)}</b>`] };
  },
},
{
  id: 'factor', zone: 'Quadratics & radicals', glyph: '( )( )', name: 'Factoring',
  rule: 'Factor x² + bx + c: find two numbers that multiply to c and add to b. Also: difference of squares.',
  tip: 'Look for two numbers that multiply to the last term and add to the middle term. If there is no middle term and it is a subtraction of two squares, use a² − b² = (a − b)(a + b).',
  video: 'factoring trinomials x^2+bx+c',
  gen() {
    if (R(0, 3) === 0) {
      const k = R(2, 9);
      const m = mc(bin(-k, k), [`(x − ${k})<sup>2</sup>`, `(x + ${k})<sup>2</sup>`, `(x − ${k * k})(x + 1)`, `(x − ${k})(x − ${k})`]);
      return { q: `Factor ${poly([[1, X2], [-k * k, '']])}`, type: 'choice', choices: m.choices, answer: m.answer,
        steps: [`Difference of squares: ${X2} − ${k}<sup>2</sup> = (x − ${k})(x + ${k})`] };
    }
    let p, q; do { p = nz(-8, 8); q = nz(-8, 8); } while (p + q === 0);
    const m = mc(bin(p, q), [bin(-p, -q), bin(p, -q), bin(-p, q), bin(p, q + (q > 0 ? 1 : -1))]);
    return { q: `Factor ${poly([[1, X2], [p + q, 'x'], [p * q, '']])}`, type: 'choice', choices: m.choices, answer: m.answer,
      steps: [`Need two numbers that multiply to ${sgn(p * q)} and add to ${sgn(p + q)}.`, `Those are ${sgn(p)} and ${sgn(q)}: <b>${bin(p, q)}</b>`] };
  },
},
{
  id: 'quad', zone: 'Quadratics & radicals', glyph: 'x²=0', name: 'Solve by factoring',
  rule: 'Factor, then zero-product property',
  tip: 'Get zero on one side, factor, then set each factor equal to zero. Enter answers separated by a comma (one answer if both are the same).',
  video: 'solving quadratic equations by factoring',
  gen() {
    const p = nz(-7, 7); let q = nz(-7, 7);
    if (R(0, 5) === 0) q = p;
    const roots = [...new Set([-p, -q])];
    return { q: `Solve ${poly([[1, X2], [p + q, 'x'], [p * q, '']])} = 0`, type: 'list', answer: roots,
      steps: [`Factor: ${bin(p, q)} = 0`, `Zero-product: set each factor to 0.`, `<b>x = ${roots.map(sgn).join(', ')}</b>`] };
  },
},
{
  id: 'disc', zone: 'Quadratics & radicals', glyph: 'b²−4ac', name: 'Discriminant',
  rule: 'Discriminant b² − 4ac from the quadratic formula',
  tip: 'Match ax² + bx + c, then compute b² − 4ac. Positive: 2 real solutions. Zero: 1. Negative: none. Watch the sign when b is negative: square it first.',
  video: 'discriminant quadratic formula number of solutions',
  gen() {
    const t = R(0, 2);
    let a, b, c;
    if (t === 2) { a = R(1, 3); const m = nz(-4, 4); b = 2 * a * m; c = a * m * m; }
    else { a = nz(-4, 5); b = nz(-8, 8); c = nz(-6, 6); }
    const eq = `${poly([[a, X2], [b, 'x'], [c, '']])} = 0`;
    const D = b * b - 4 * a * c;
    if (t === 0) {
      return { q: `Find b² − 4ac for<br>${eq}`, type: 'num', answer: D,
        steps: [`a = ${sgn(a)}, b = ${sgn(b)}, c = ${sgn(c)}`, `${pn(b)}<sup>2</sup> − 4(${sgn(a)})(${sgn(c)}) = ${b * b} − ${pn(4 * a * c)} = <b>${sgn(D)}</b>`] };
    }
    const ans = D > 0 ? 'Two real solutions' : D === 0 ? 'One real solution' : 'No real solutions';
    const m = mc(ans, ['Two real solutions', 'One real solution', 'No real solutions']);
    return { q: `How many real solutions?<br>${eq}`, type: 'choice', choices: m.choices, answer: m.answer,
      steps: [`b² − 4ac = ${b * b} − ${pn(4 * a * c)} = ${sgn(D)}`, `${D > 0 ? 'Positive' : D === 0 ? 'Zero' : 'Negative'} → <b>${ans.toLowerCase()}</b>`] };
  },
},
{
  id: 'radicals', zone: 'Quadratics & radicals', glyph: '√', name: 'Simplify radicals',
  rule: 'Pull out the largest perfect-square factor',
  tip: 'Split the number into (perfect square) × (leftover). The square root of the perfect square comes outside, the leftover stays inside.',
  video: 'simplifying square roots radicals',
  gen() {
    const k = R(2, 7), n = pick([2, 3, 5, 6, 7]);
    const m = mc(`${k}${rad(n)}`, [`${n}${rad(k)}`, `${k * k}${rad(n)}`, `${k}${rad(k * n)}`, rad(k * k * n)]);
    return { q: `Simplify ${rad(k * k * n)}`, type: 'choice', choices: m.choices, answer: m.answer,
      steps: [`${k * k * n} = ${k * k} · ${n}, and ${k * k} is a perfect square.`, `${rad(k * k)} = ${k}, so the answer is <b>${k}${rad(n)}</b>`] };
  },
},
{
  id: 'funceval', zone: 'Functions & logs', glyph: 'f(x)', name: 'Function notation',
  rule: 'Substitute the input for x, then follow order of operations',
  tip: 'Replace every x with the input in parentheses, then use order of operations. For f(g(x)), work the inside function first.',
  video: 'evaluating functions and composition of functions',
  gen() {
    if (R(0, 2) === 0) {
      const a = nz(-4, 4), b = nz(-5, 5), d = nz(-6, 6), k = R(-3, 3);
      const g = k * k + d, f = a * g + b;
      return { q: `f(x) = ${poly([[a, 'x'], [b, '']])}<br>g(x) = ${poly([[1, X2], [d, '']])}<br>Find f(g(${sgn(k)}))`, type: 'num', answer: f,
        steps: [`Inside first: g(${sgn(k)}) = ${pn(k)}<sup>2</sup> + ${pn(d)} = ${sgn(g)}`, `Then f(${sgn(g)}) = ${sgn(a)}·${pn(g)} + ${pn(b)} = <b>${sgn(f)}</b>`] };
    }
    const a = nz(-3, 3), b = nz(-5, 5), c = nz(-9, 9), k = nz(-4, 4);
    const v = a * k * k + b * k + c;
    return { q: `f(x) = ${poly([[a, X2], [b, 'x'], [c, '']])}<br>Find f(${sgn(k)})`, type: 'num', answer: v,
      steps: [`Replace x with ${pn(k)}: ${sgn(a)}·${pn(k)}<sup>2</sup> + ${pn(b)}·${pn(k)} + ${pn(c)}`,
        `Exponent first: ${sgn(a)}·${k * k} + ${pn(b * k)} + ${pn(c)} = <b>${sgn(v)}</b>`] };
  },
},
{
  id: 'arc', zone: 'Functions & logs', glyph: 'Δy/Δx', name: 'Average rate of change',
  rule: 'Average rate of change = (f(b) − f(a)) / (b − a). It is the slope formula on a function.',
  tip: 'Plug each endpoint into f to get two outputs. Subtract the outputs, then divide by the difference of the inputs, keeping the same order on top and bottom. Type answers like 3/4 or -2.',
  video: 'average rate of change of a function over an interval',
  gen() {
    const t = R(0, 2);
    if (t === 0) {
      const a = nz(-3, 3), b = nz(-5, 5), c = R(-6, 6), p = R(-3, 2), q = p + R(1, 4);
      const f = (x) => a * x * x + b * x + c;
      return { q: `f(x) = ${poly([[a, X2], [b, 'x'], [c, '']])}<br>Average rate of change from x = ${sgn(p)} to x = ${sgn(q)}`, type: 'num', answer: (f(q) - f(p)) / (q - p),
        steps: [`f(${sgn(p)}) = ${sgn(f(p))} and f(${sgn(q)}) = ${sgn(f(q))}.`,
          `${fr('f(' + sgn(q) + ') − f(' + sgn(p) + ')', sgn(q) + ' − ' + pn(p))} = ${fr(sgn(f(q)) + ' − ' + pn(f(p)), sgn(q - p))} = <b>${F(f(q) - f(p), q - p)}</b>`] };
    }
    if (t === 1) {
      const p = R(-3, 3), q = p + R(1, 5), y1 = R(-9, 12), y2 = R(-9, 12);
      return { q: `f(${sgn(p)}) = ${sgn(y1)} and f(${sgn(q)}) = ${sgn(y2)}<br>Average rate of change from x = ${sgn(p)} to x = ${sgn(q)}`, type: 'num', answer: (y2 - y1) / (q - p),
        steps: [`${fr('f(b) − f(a)', 'b − a')} = ${fr(sgn(y2) + ' − ' + pn(y1), sgn(q) + ' − ' + pn(p))}`, `= ${fr(sgn(y2 - y1), sgn(q - p))} = <b>${F(y2 - y1, q - p)}</b>`] };
    }
    const t1 = R(0, 3), t2 = t1 + R(1, 4), d1 = R(0, 60), d2 = d1 + R(-20, 120);
    return { q: `A car is ${d1} miles from home at t = ${t1} hours and ${d2} miles from home at t = ${t2} hours.<br>Average rate of change, in miles per hour?`, type: 'num', answer: (d2 - d1) / (t2 - t1),
      steps: [`Change in distance over change in time: ${fr(d2 + ' − ' + d1, t2 + ' − ' + t1)} = ${fr(sgn(d2 - d1), t2 - t1)}`, `= <b>${F(d2 - d1, t2 - t1)}</b> mph`] };
  },
},
{
  id: 'logs', zone: 'Functions & logs', glyph: 'log', name: 'Logs & exponentials',
  rule: 'log_b(y) = x means b to the x equals y',
  tip: 'Read a log as a question: log base b of y asks "b to what power gives y?" To solve b^x = y, ask the same question.',
  video: 'logarithms introduction change exponential form to log form',
  gen() {
    const b = pick([2, 3, 5, 10]), k = R(1, b === 2 ? 5 : b === 10 ? 4 : 3), y = Math.pow(b, k);
    const t = R(0, 2);
    if (t === 0) return { q: `log<sub>${b}</sub>(${y}) =`, type: 'num', answer: k,
      steps: [`Ask: ${b} to what power is ${y}?`, `${b}<sup>${k}</sup> = ${y}, so <b>${k}</b>`] };
    if (t === 1) return { q: `Solve ${b}<sup>x</sup> = ${y}`, type: 'num', answer: k,
      steps: [`Ask: ${b} to what power is ${y}?`, `${b}<sup>${k}</sup> = ${y}, so <b>x = ${k}</b>`] };
    return { q: `log<sub>${b}</sub>(${fr(1, y)}) =`, type: 'num', answer: -k,
      steps: [`${fr(1, y)} = ${b}<sup>−${k}</sup> (a negative exponent flips it).`, `So the log is <b>${sgn(-k)}</b>`] };
  },
},
);
