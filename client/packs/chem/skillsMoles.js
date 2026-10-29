// Moles & stoichiometry. Every answer is computed from the atomic-mass table in chem.js.
const ZM = 'Moles & stoichiometry';
const MM_BANK = ['H2O', 'CO2', 'NaCl', 'PCl3', 'Na2SO4', 'FeF3', 'Ca(OH)2', 'Al2(SO4)3', 'NH3', 'CH4', 'C6H12O6', 'H2SO4', 'HNO3', 'NaOH', 'KCl', 'MgCl2',
  'CaCO3', 'SiCl4', 'CS2', 'SO2', 'N2O5', 'Fe2O3', 'Cu(NO3)2', '(NH4)2SO4', 'C2H5OH', 'Ca3(PO4)2', 'Cl2', 'O2', 'P4O10', 'AgNO3', 'K2SO4', 'Na2CO3',
  'HCl', 'C3H8', 'NaHCO3', 'Ba(OH)2', 'MgSO4', 'LiBr', 'ICl3', 'N2', 'Br2', 'CO', 'NO2', 'Al2O3'];
const mmSteps = (f) => Object.entries(parseFormula(f)).map(([e, n]) => `${n} ${e} × ${ATOMS[e].toFixed(2)} = ${(n * ATOMS[e]).toFixed(2)}`);
const dec = (lo, hi, d = 1) => +(R(lo * 10 ** d, hi * 10 ** d) / 10 ** d).toFixed(d);
const pickRxn = (nReact) => { let e; do e = pick(RXN_BANK); while (nReact && e.rs.length !== nReact); return e; };

SKILLS.push(
{
  id: 'molmass', zone: ZM, core: true, glyph: 'g/mol', name: 'Molar mass',
  rule: 'Molar mass = (atoms of each element × its atomic mass), added up. A number outside parentheses multiplies everything inside.',
  tip: 'Count every atom in the formula (Ca(OH)₂ has 1 Ca, 2 O, 2 H), multiply each by its atomic mass from the periodic table, and add. Units are g/mol.',
  video: 'how to calculate molar mass of a compound',
  gen() {
    const f = pick(MM_BANK), m = molarMass(f);
    return { q: `What is the molar mass of ${fm(f)}?<br><small>In g/mol. Use your periodic table.</small>`, type: 'num', answer: m, tol: 0.005, wrongs: ((els) => [els.reduce((s, e) => s + ATOMS[e], 0), m + ATOMS[pick(els)], m - ATOMS[pick(els)], m * 2, m / 2])(Object.keys(parseFormula(f))),
      steps: [...mmSteps(f), `Total: <b>${m.toFixed(2)} g/mol</b>`] };
  },
},
{
  id: 'moleconv', zone: ZM, core: true, glyph: 'g↔mol', name: 'Grams and moles',
  rule: 'moles = grams ÷ molar mass, and grams = moles × molar mass.',
  tip: 'Find the molar mass first. To go from grams to moles, divide by it. To go from moles to grams, multiply by it. Units cancel: g × (1 mol / g) = mol.',
  video: 'converting grams to moles and moles to grams',
  gen() {
    const f = pick(MM_BANK.filter((x) => molarMass(x) > 17)), M = molarMass(f);
    if (R(0, 1)) {
      const g = dec(5, 150), n = g / M;
      return { q: `How many moles are in ${g} g of ${fm(f)}?`, type: 'num', answer: n, tol: 0.01, wrongs: [g * M, M / g, n * 2, n / 2, n * 10],
        steps: [`Molar mass of ${fm(f)} = ${M.toFixed(2)} g/mol.`, `${g} g × (1 mol / ${M.toFixed(2)} g) = <b>${g2(n)} mol</b>`] };
    }
    const n = dec(0.2, 5), g = n * M;
    return { q: `What is the mass of ${n} mol of ${fm(f)}?<br><small>In grams</small>`, type: 'num', answer: g, tol: 0.01, wrongs: [n / M, M / n, g * 2, g / 2, g * 10],
      steps: [`Molar mass of ${fm(f)} = ${M.toFixed(2)} g/mol.`, `${n} mol × ${M.toFixed(2)} g/mol = <b>${g2(g)} g</b>`] };
  },
},
{
  id: 'avogadro', zone: ZM, core: true, glyph: 'Nₐ', name: 'Moles and particles',
  rule: '1 mol = 6.02 × 10²³ particles. Grams → moles → particles (or the reverse).',
  tip: 'Particles always go through moles: grams ÷ molar mass gives moles, then moles × 6.02 × 10²³ gives molecules. For atoms inside a molecule, multiply by the number of those atoms per molecule. Type 3.57e23 or 3.57 x 10^23.',
  video: 'avogadro number mole conversions molecules grams',
  gen() {
    const f = pick(MM_BANK.filter((x) => molarMass(x) > 17)), M = molarMass(f), t = R(0, 2);
    const note = '<br><small>Scientific notation works (e notation or x 10^). Use 6.02 x 10^23.</small>';
    if (t === 0) {
      const g = dec(5, 120), n = g / M, N = n * AVO;
      return { q: `${g} g of ${fm(f)} contains how many molecules?${note}`, type: 'num', answer: N, tol: 0.01, wrongs: [n, g * AVO, N * 10, N / 10],
        steps: [`Molar mass = ${M.toFixed(2)} g/mol, so ${g} g = ${g2(n)} mol.`, `${g2(n)} mol × 6.02 × 10<sup>23</sup> = <b>${sci(N)}</b> molecules`] };
    }
    if (t === 1) {
      const mant = dec(1, 9), N = mant * 1e23, n = N / AVO;
      return { q: `How many moles are in ${mant} × 10<sup>23</sup> molecules of ${fm(f)}?`, type: 'num', answer: n, tol: 0.01, wrongs: [mant * 6.02, mant, n * 10, n / 10],
        steps: [`moles = molecules ÷ 6.02 × 10<sup>23</sup>`, `${mant} × 10<sup>23</sup> ÷ 6.02 × 10<sup>23</sup> = <b>${g2(n)} mol</b>`] };
    }
    const el = pick(Object.keys(parseFormula(f))), k = parseFormula(f)[el], n = dec(0.5, 4);
    return { q: `How many ${el} atoms are in ${n} mol of ${fm(f)}?${note}`, type: 'num', answer: n * k * AVO, tol: 0.01, wrongs: [n * AVO, n * k, n * k * AVO * 10, (n * k * AVO) / 10],
      steps: [`Each ${fm(f)} has ${k} ${el} atom${k > 1 ? 's' : ''}.`, `${n} mol × ${k} × 6.02 × 10<sup>23</sup> = <b>${sci(n * k * AVO)}</b> atoms`] };
  },
},
{
  id: 'stoich', zone: ZM, core: true, glyph: 'A→B', name: 'Stoichiometry (mass to mass)',
  rule: 'grams A → moles A → moles B (use the coefficients) → grams B.',
  tip: 'Make a three-step chain: divide by the molar mass of A, multiply by the mole ratio (coefficient of B over coefficient of A), then multiply by the molar mass of B. Make sure the equation is balanced first.',
  video: 'stoichiometry grams to grams mole ratio',
  gen() {
    const e = pickRxn(), A = pick(e.rs), B = pick(e.ps), MA = molarMass(A.f), MB = molarMass(B.f);
    if (R(0, 3) === 0) {
      const n = dec(0.5, 6), ans = (n * B.c) / A.c;
      return { q: `${eqHTML(e.rs, e.ps)}<br>How many moles of ${fm(B.f)} form from ${n} mol of ${fm(A.f)}?`, type: 'num', answer: ans, tol: 0.01, wrongs: [(n * A.c) / B.c, n, n * B.c, n * (A.c + B.c), ans * 2, ans / 2],
        steps: [`Mole ratio: ${B.c} mol ${fm(B.f)} per ${A.c} mol ${fm(A.f)}.`, `${n} × ${B.c}/${A.c} = <b>${g2(ans)} mol</b>`] };
    }
    const g = dec(5, 50), ans = ((g / MA) * B.c / A.c) * MB;
    return { q: `${eqHTML(e.rs, e.ps)}<br>How many grams of ${fm(B.f)} form when ${g} g of ${fm(A.f)} react?`, type: 'num', answer: ans, tol: 0.01, wrongs: [(g / MA) * MB, (g / MA) * (A.c / B.c) * MB, (g / MA) * (B.c / A.c) * MA, (g * B.c) / A.c, ans * 2, ans / 2, ans * 1.5],
      steps: [`${g} g ÷ ${MA.toFixed(2)} g/mol = ${g2(g / MA)} mol ${fm(A.f)}`, `× (${B.c} mol ${fm(B.f)} / ${A.c} mol ${fm(A.f)}) = ${g2((g / MA) * B.c / A.c)} mol ${fm(B.f)}`,
        `× ${MB.toFixed(2)} g/mol = <b>${g2(ans)} g</b>`] };
  },
},
{
  id: 'limiting', zone: ZM, core: true, glyph: 'LR', name: 'Limiting reagent & yield',
  rule: 'Convert each reactant to moles, divide by its coefficient: the smaller result is the limiting reagent. Theoretical yield comes from the limiting reagent only.',
  tip: 'For each reactant do grams → moles, then divide by its coefficient in the balanced equation. Whichever gives the smaller number runs out first. Use that one for the yield. Percent yield = actual ÷ theoretical × 100.',
  video: 'limiting reagent and theoretical yield problems',
  gen() {
    let e, gA, gB, a, b;
    do {
      e = pickRxn(2); gA = dec(8, 60); gB = dec(8, 60);
      a = gA / molarMass(e.rs[0].f) / e.rs[0].c; b = gB / molarMass(e.rs[1].f) / e.rs[1].c;
    } while (Math.abs(a - b) / Math.min(a, b) < 0.2);
    const [X, Y] = e.rs, lim = a < b ? X : Y, P = pick(e.ps), nLim = Math.min(a, b) * lim.c;
    const theo = ((nLim / lim.c) * P.c) * molarMass(P.f);
    const head = `${eqHTML(e.rs, e.ps)}<br>${gA} g ${fm(X.f)} and ${gB} g ${fm(Y.f)} are mixed.`;
    const chain = [`${fm(X.f)}: ${gA} g ÷ ${molarMass(X.f).toFixed(2)} = ${g2(gA / molarMass(X.f))} mol, ÷ ${X.c} = ${g2(a)}`,
      `${fm(Y.f)}: ${gB} g ÷ ${molarMass(Y.f).toFixed(2)} = ${g2(gB / molarMass(Y.f))} mol, ÷ ${Y.c} = ${g2(b)}`, `Smaller is limiting: <b>${fm(lim.f)}</b>`];
    const t = R(0, 2);
    if (t === 0) {
      const m = mc(fm(lim.f), [fm((lim === X ? Y : X).f)]);
      return { q: `${head}<br>Which is the limiting reagent?`, type: 'choice', choices: m.choices, answer: m.answer, steps: chain };
    }
    const steps = [...chain, `Yield from ${fm(lim.f)}: ${g2(nLim / lim.c)} mol × ${P.c} × ${molarMass(P.f).toFixed(2)} g/mol = <b>${g2(theo)} g</b> of ${fm(P.f)}`];
    if (t === 1) return { q: `${head}<br>What is the theoretical yield of ${fm(P.f)}, in grams?`, type: 'num', answer: theo, tol: 0.01, wrongs: [Math.max(a, b) * P.c * molarMass(P.f), (nLim / lim.c) * molarMass(P.f), theo * 2, theo / 2], steps };
    const pct = dec(55, 95), actual = +(theo * pct / 100).toPrecision(3);
    return { q: `${head}<br>The theoretical yield of ${fm(P.f)} is ${g2(theo)} g, and ${actual} g are actually collected. What is the percent yield?`, type: 'num', answer: (actual / theo) * 100, tol: 0.01, wrongs: [(theo / actual) * 100, actual / theo, 100 - pct, pct / 2],
      steps: [`Percent yield = actual ÷ theoretical × 100`, `${actual} ÷ ${g2(theo)} × 100 = <b>${((actual / theo) * 100).toFixed(1)}%</b>`] };
  },
},
);
