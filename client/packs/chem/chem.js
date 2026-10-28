// Chemistry helpers: atomic masses, formula parsing, molar mass, formatting, and an equation balancer.
// Atomic masses use two decimals, like most intro-course periodic tables.
const ATOMS = {
  H: 1.01, He: 4.00, Li: 6.94, Be: 9.01, B: 10.81, C: 12.01, N: 14.01, O: 16.00, F: 19.00, Ne: 20.18, Na: 22.99, Mg: 24.31, Al: 26.98, Si: 28.09,
  P: 30.97, S: 32.07, Cl: 35.45, Ar: 39.95, K: 39.10, Ca: 40.08, Ti: 47.87, Cr: 52.00, Mn: 54.94, Fe: 55.85, Co: 58.93, Ni: 58.69, Cu: 63.55,
  Zn: 65.38, Br: 79.90, Sr: 87.62, Ag: 107.87, Sn: 118.71, I: 126.90, Ba: 137.33, Hg: 200.59, Pb: 207.2,
};
// Order the skill zones appear in (and the order "Move on" follows). `core` skills are the exam material.
const ZONES = ['Bonding & shapes', 'Reactions', 'Moles & stoichiometry', 'Polyatomic ions', 'Concept check', 'Earlier material'];
const AVO = 6.02e23;

// "Fe2(SO4)3" -> { Fe: 2, S: 3, O: 12 }. Charges (^2-) and state symbols are ignored.
function parseFormula(f) {
  f = f.replace(/\^\d*[+-]/g, '').replace(/\((s|l|g|aq)\)/g, '');
  const stack = [{}];
  let i = 0;
  const num = () => { let n = ''; while (/\d/.test(f[i] || '')) n += f[i++]; return +n || 1; };
  while (i < f.length) {
    const c = f[i];
    if (c === '(') { stack.push({}); i++; }
    else if (c === ')') {
      i++; const m = num(), top = stack.pop(), below = stack[stack.length - 1];
      for (const k in top) below[k] = (below[k] || 0) + top[k] * m;
    } else if (/[A-Z]/.test(c)) {
      let s = c; i++;
      if (/[a-z]/.test(f[i] || '')) s += f[i++];
      const top = stack[stack.length - 1];
      top[s] = (top[s] || 0) + num();
    } else i++;
  }
  return stack[0];
}
const molarMass = (f) => Object.entries(parseFormula(f)).reduce((s, [e, n]) => s + ATOMS[e] * n, 0);

// ASCII formula -> HTML: "SO4^2-" becomes SO<sub>4</sub><sup>2−</sup>. A digit after a letter or ")" is a subscript.
const fm = (f) => f.replace(/\^(\d*[+-])/g, (m, c) => `<sup>${c.replace('-', '−')}</sup>`).replace(/([A-Za-z)])(\d+)/g, '$1<sub>$2</sub>');
const chg = (c) => `${Math.abs(c) > 1 ? Math.abs(c) : ''}${c > 0 ? '+' : '-'}`; // 2 -> "2+", -1 -> "-"
// Equation terms are { c: coefficient, f: formula, st: 'aq' | 's' | 'l' | 'g' }.
const term = (t) => `${t.c > 1 ? t.c + ' ' : ''}${fm(t.f)}${t.st ? `(${t.st})` : ''}`;
const eqHTML = (rs, ps) => `${rs.map(term).join(' + ')} → ${ps.map(term).join(' + ')}`;
const sci = (x) => { const e = Math.floor(Math.log10(Math.abs(x))); return `${(x / 10 ** e).toFixed(2)} × 10<sup>${e}</sup>`; };
const g2 = (x) => (Math.abs(x) >= 100 ? x.toFixed(1) : Math.abs(x) >= 1 ? x.toFixed(2) : x.toPrecision(2));

// Balance reactants -> products. Returns the smallest whole-number coefficients, or null if there is no unique answer.
function balance(reacts, prods) {
  const sp = [...reacts, ...prods], cnt = sp.map(parseFormula), n = sp.length;
  const els = [...new Set(cnt.flatMap((c) => Object.keys(c)))];
  const A = els.map((e) => cnt.map((c, j) => (c[e] || 0) * (j < reacts.length ? 1 : -1)));
  const piv = []; let r = 0;
  for (let c = 0; c < n && r < A.length; c++) {
    let p = r;
    for (let i = r + 1; i < A.length; i++) if (Math.abs(A[i][c]) > Math.abs(A[p][c])) p = i;
    if (Math.abs(A[p][c]) < 1e-9) continue;
    [A[r], A[p]] = [A[p], A[r]];
    const d = A[r][c]; A[r] = A[r].map((v) => v / d);
    for (let i = 0; i < A.length; i++) if (i !== r) { const f = A[i][c]; if (f) A[i] = A[i].map((v, k) => v - f * A[r][k]); }
    piv.push(c); r++;
  }
  const free = [...Array(n).keys()].filter((c) => !piv.includes(c));
  if (free.length !== 1) return null;
  const x = Array(n).fill(0); x[free[0]] = 1;
  piv.forEach((c, i) => { x[c] = -A[i][free[0]]; });
  for (let m = 1; m <= 200; m++) {
    const y = x.map((v) => v * m);
    if (!y.every((v) => Math.abs(v - Math.round(v)) < 1e-6)) continue;
    let z = y.map(Math.round);
    if (z.every((v) => v <= 0)) z = z.map((v) => -v);
    if (!z.every((v) => v > 0)) return null;
    const g = z.reduce((a, b) => gcd(a, b));
    return z.map((v) => v / g);
  }
  return null;
}

// Balanced equations used by the stoichiometry skills. Built from unbalanced bank entries by the solver above.
const RXN_BANK = [
  ['H2 + O2', 'H2O'], ['N2 + H2', 'NH3'], ['Mg + O2', 'MgO'], ['Al + O2', 'Al2O3'], ['Fe + O2', 'Fe2O3'], ['Na + Cl2', 'NaCl'], ['Li + Br2', 'LiBr'],
  ['Fe + F2', 'FeF3'], ['P4 + O2', 'P4O10'], ['SO2 + O2', 'SO3'], ['K + Cl2', 'KCl'], ['KClO3', 'KCl + O2'], ['H2O2', 'H2O + O2'], ['CaCO3', 'CaO + CO2'],
  ['Al2O3', 'Al + O2'], ['CH4 + O2', 'CO2 + H2O'], ['C2H6 + O2', 'CO2 + H2O'], ['C3H8 + O2', 'CO2 + H2O'], ['C4H10 + O2', 'CO2 + H2O'],
  ['C2H5OH + O2', 'CO2 + H2O'], ['C6H12O6 + O2', 'CO2 + H2O'], ['C2H2 + O2', 'CO2 + H2O'], ['Zn + HCl', 'ZnCl2 + H2'], ['Al + HCl', 'AlCl3 + H2'],
  ['Mg + HCl', 'MgCl2 + H2'], ['Al + CuCl2', 'AlCl3 + Cu'], ['Na + H2O', 'NaOH + H2'], ['Ca + H2O', 'Ca(OH)2 + H2'], ['Zn + AgNO3', 'Zn(NO3)2 + Ag'],
  ['AgNO3 + K2SO4', 'KNO3 + Ag2SO4'], ['BaCl2 + Na2SO4', 'BaSO4 + NaCl'], ['Pb(NO3)2 + KI', 'PbI2 + KNO3'], ['Ca(OH)2 + H3PO4', 'Ca3(PO4)2 + H2O'],
  ['H2SO4 + NaOH', 'Na2SO4 + H2O'], ['Al(OH)3 + HCl', 'AlCl3 + H2O'], ['Na2CO3 + HCl', 'NaCl + H2O + CO2'], ['FeCl3 + NaOH', 'Fe(OH)3 + NaCl'],
  ['CaCl2 + Na3PO4', 'Ca3(PO4)2 + NaCl'], ['Na2SO4 + C', 'Na2S + CO2'], ['H2SO4 + Ca(OH)2', 'CaSO4 + H2O'],
].map(([l, r]) => {
  const rs = l.split(' + '), ps = r.split(' + '), co = balance(rs, ps);
  return co && { rs: rs.map((f, i) => ({ f, c: co[i] })), ps: ps.map((f, i) => ({ f, c: co[rs.length + i] })) };
}).filter(Boolean);
