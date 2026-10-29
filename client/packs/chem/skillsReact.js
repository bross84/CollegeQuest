// Reactions (Chapter 5): balancing, reaction types, redox, oxidation numbers.
const ZR = 'Reactions';
const ox = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n);
const showEq = (s) => fm(s);
const species = (s) => s.replace(/^\d+\s*/, '').replace(/\((s|l|g|aq)\)$/, '');

const TYPES = {
  precip: 'Precipitation', acid: 'Acid-base (neutralization)', redox: 'Oxidation-reduction (redox)',
};
const RXN_ACCEPT = {
  precip: ['Precipitation', 'precipitate', 'precipitation reaction', 'precip', 'ppt'],
  acid: ['Acid-base (neutralization)', 'acid-base', 'acid base reaction', 'neutralization', 'neutralisation'],
  redox: ['Oxidation-reduction (redox)', 'redox', 'oxidation-reduction', 'oxidation reduction'],
};
const RXN_TYPES = [
  ['precip', 'AgNO3(aq) + NaCl(aq) → AgCl(s) + NaNO3(aq)', 'Two aqueous ionic compounds swap partners and one product is a solid: (s).'],
  ['precip', 'BaCl2(aq) + Na2SO4(aq) → BaSO4(s) + 2 NaCl(aq)', 'Two aqueous ionic compounds swap partners and BaSO4 is the solid.'],
  ['precip', 'Pb(NO3)2(aq) + 2 KI(aq) → PbI2(s) + 2 KNO3(aq)', 'A solid forms from two aqueous solutions.'],
  ['precip', 'CuSO4(aq) + 2 NaOH(aq) → Cu(OH)2(s) + Na2SO4(aq)', 'A solid, Cu(OH)2, forms from two aqueous solutions.'],
  ['precip', '3 CaCl2(aq) + 2 Na3PO4(aq) → Ca3(PO4)2(s) + 6 NaCl(aq)', 'A solid forms from two aqueous solutions.'],
  ['precip', 'FeCl3(aq) + 3 NaOH(aq) → Fe(OH)3(s) + 3 NaCl(aq)', 'A solid forms from two aqueous solutions.'],
  ['precip', '2 AgNO3(aq) + K2SO4(aq) → Ag2SO4(s) + 2 KNO3(aq)', 'A solid forms from two aqueous solutions.'],
  ['precip', 'Na2CO3(aq) + CaCl2(aq) → CaCO3(s) + 2 NaCl(aq)', 'A solid, CaCO3, forms from two aqueous solutions.'],
  ['acid', 'HCl(aq) + NaOH(aq) → NaCl(aq) + H2O(l)', 'An acid (HCl) and a base (NaOH) make a salt and water.'],
  ['acid', 'H2SO4(aq) + 2 KOH(aq) → K2SO4(aq) + 2 H2O(l)', 'An acid and a base make a salt and water.'],
  ['acid', '2 HCl(aq) + Ca(OH)2(aq) → CaCl2(aq) + 2 H2O(l)', 'An acid and a hydroxide base make a salt and water.'],
  ['acid', 'H3PO4(aq) + 3 NaOH(aq) → Na3PO4(aq) + 3 H2O(l)', 'An acid and a base make a salt and water.'],
  ['acid', '2 HNO3(aq) + Mg(OH)2(s) → Mg(NO3)2(aq) + 2 H2O(l)', 'An acid and a base make a salt and water.'],
  ['acid', 'HBr(aq) + LiOH(aq) → LiBr(aq) + H2O(l)', 'An acid and a base make a salt and water.'],
  ['acid', 'H2SO4(aq) + Ca(OH)2(aq) → CaSO4(aq) + 2 H2O(l)', 'An acid and a base make a salt and water.'],
  ['acid', 'HNO3(aq) + KOH(aq) → KNO3(aq) + H2O(l)', 'An acid and a base make a salt and water.'],
  ['redox', '2 Na(s) + Cl2(g) → 2 NaCl(s)', 'Elements react to form a compound, so oxidation numbers change (0 to +1 and 0 to −1).'],
  ['redox', 'Zn(s) + 2 HCl(aq) → ZnCl2(aq) + H2(g)', 'A free element (Zn, 0) becomes an ion (+2), so electrons are transferred.'],
  ['redox', '2 Mg(s) + O2(g) → 2 MgO(s)', 'Both reactants are free elements (0) and end up as ions, so it is redox.'],
  ['redox', 'CH4(g) + 2 O2(g) → CO2(g) + 2 H2O(l)', 'Combustion: O₂ is a free element (0) that ends up at −2, so it is redox.'],
  ['redox', 'Fe(s) + CuSO4(aq) → FeSO4(aq) + Cu(s)', 'Fe (0 → +2) and Cu (+2 → 0) change oxidation number.'],
  ['redox', '2 Li(s) + I2(s) → 2 LiI(s)', 'Both reactants are free elements, so electrons are transferred.'],
  ['redox', 'Cu(s) + 2 AgNO3(aq) → Cu(NO3)2(aq) + 2 Ag(s)', 'Cu (0 → +2) and Ag (+1 → 0) change oxidation number.'],
  ['redox', '4 Fe(s) + 3 O2(g) → 2 Fe2O3(s)', 'Both reactants are free elements, so electrons are transferred.'],
  ['redox', '2 H2(g) + O2(g) → 2 H2O(l)', 'Both reactants are free elements, so oxidation numbers change.'],
  ['redox', '2 Al(s) + 3 Br2(l) → 2 AlBr3(s)', 'Both reactants are free elements, so electrons are transferred.'],
];
const REDOX = [
  ['2 Na(s) + Cl2(g) → 2 NaCl(s)', 'Na', 'Cl2'], ['2 Mg(s) + O2(g) → 2 MgO(s)', 'Mg', 'O2'], ['Zn(s) + 2 HCl(aq) → ZnCl2(aq) + H2(g)', 'Zn', 'HCl'],
  ['Fe(s) + CuSO4(aq) → FeSO4(aq) + Cu(s)', 'Fe', 'CuSO4'], ['2 Li(s) + I2(s) → 2 LiI(s)', 'Li', 'I2'], ['Cu(s) + 2 AgNO3(aq) → Cu(NO3)2(aq) + 2 Ag(s)', 'Cu', 'AgNO3'],
  ['4 Fe(s) + 3 O2(g) → 2 Fe2O3(s)', 'Fe', 'O2'], ['2 Al(s) + 3 Br2(l) → 2 AlBr3(s)', 'Al', 'Br2'], ['C(s) + O2(g) → CO2(g)', 'C', 'O2'], ['Ca(s) + 2 H2O(l) → Ca(OH)2(aq) + H2(g)', 'Ca', 'H2O'],
];
const OX_KNOWN = { O: -2, H: 1, F: -1, Li: 1, Na: 1, K: 1, Mg: 2, Ca: 2, Ba: 2, Al: 3, Zn: 2, Ag: 1, Cl: -1, Br: -1, I: -1 };
// [formula, charge, element to solve for]
const OX_BANK = [['CO3', -2, 'C'], ['SO4', -2, 'S'], ['SO3', -2, 'S'], ['NO3', -1, 'N'], ['NO2', -1, 'N'], ['PO4', -3, 'P'], ['OCl', -1, 'Cl'],
  ['NH4', 1, 'N'], ['HSO4', -1, 'S'], ['HCO3', -1, 'C'], ['HNO3', 0, 'N'], ['H2SO4', 0, 'S'], ['H3PO4', 0, 'P'], ['SO2', 0, 'S'], ['SO3', 0, 'S'], ['NO', 0, 'N'], ['N2O', 0, 'N'],
  ['NO2', 0, 'N'], ['N2O5', 0, 'N'], ['CO', 0, 'C'], ['CO2', 0, 'C'], ['CH4', 0, 'C'], ['PCl3', 0, 'P'], ['PCl5', 0, 'P'], ['SiCl4', 0, 'Si'], ['Fe2O3', 0, 'Fe'], ['FeO', 0, 'Fe'],
  ['MnO2', 0, 'Mn'], ['Cu2O', 0, 'Cu'], ['CuO', 0, 'Cu'], ['P4O10', 0, 'P'], ['NH3', 0, 'N'], ['Na2SO4', 0, 'S'], ['Ca3(PO4)2', 0, 'P'], ['Al2(SO4)3', 0, 'S'], ['Cl2O7', 0, 'Cl'],
  ['ICl3', 0, 'I'], ['Mn2O3', 0, 'Mn'], ['HNO2', 0, 'N'], ['H2CO3', 0, 'C']];

SKILLS.push(
{
  id: 'balance', zone: ZR, core: true, glyph: '=', name: 'Balancing equations',
  rule: 'Both sides must have the same number of each atom (Law of Conservation of Mass). Change coefficients only, never subscripts.',
  tip: 'Count atoms of each element on both sides. Balance elements that appear in only one compound on each side first, and leave O and H (or any free element) for last. A polyatomic ion that is unchanged on both sides can be counted as one unit. Enter the coefficients in order, with 1 where there is none.',
  video: 'how to balance chemical equations',
  gen() {
    const e = pick(RXN_BANK), raw = (ts) => ts.map((t) => ({ f: t.f, c: 1 }));
    const co = [...e.rs, ...e.ps].map((t) => t.c);
    const atoms = Object.keys(parseFormula([...e.rs, ...e.ps].map((t) => t.f).join('')));
    const side = (ts) => atoms.map((a) => `${ts.reduce((s, t) => s + (parseFormula(t.f)[a] || 0) * t.c, 0)} ${a}`).join(', ');
    return { q: `Balance: ${eqHTML(raw(e.rs), raw(e.ps))}<br><small>Coefficients in order, separated by commas. Use 1 when there is none.</small>`, type: 'seq', answer: co, wrongs: [co.map((x) => x * 2), co.map((x, i) => (i === 0 ? x + 1 : x)), co.map((x, i) => (i === co.length - 1 ? x + 1 : x)), co.map(() => 1), [...co.slice(1), co[0]]],
      steps: [`Balanced: ${eqHTML(e.rs, e.ps)}`, `Check the atoms. Left: ${side(e.rs)}. Right: ${side(e.ps)}.`, `Coefficients: <b>${co.join(', ')}</b>`] };
  },
},
{
  id: 'rxntype', zone: ZR, core: true, glyph: 'type', name: 'Reaction type',
  rule: 'Precipitation: a solid (s) forms from two aqueous solutions. Acid-base: acid + base → salt + water. Redox: electrons transfer, so oxidation numbers change.',
  tip: 'Look for water as a product with an acid and a base (acid-base). Look for (s) forming from two (aq) ionic reactants (precipitation). If a free element (0) is a reactant or product, it is redox.',
  video: 'types of chemical reactions precipitation acid base redox',
  gen() {
    const [k, eq, why] = pick(RXN_TYPES), ans = TYPES[k];
    const m = mc(ans, Object.values(TYPES).filter((x) => x !== ans));
    return { q: `${showEq(eq)}<br>What type of reaction is this?`, type: 'choice', choices: m.choices, answer: m.answer, steps: [why, `<b>${ans}</b>`],
      typed: { type: 'text', accept: RXN_ACCEPT[k], ph: 'type of reaction', hint: '<br><small>Name the type of reaction.</small>' } };
  },
},
{
  id: 'redox', zone: ZR, core: true, glyph: 'e⁻', name: 'Oxidized, reduced, agents',
  rule: 'Oxidation = loss of electrons (oxidation number goes up). Reduction = gain of electrons (goes down). The oxidizing agent is reduced; the reducing agent is oxidized.',
  tip: 'LEO says GER: Lose Electrons = Oxidation; Gain Electrons = Reduction. The agent does the opposite to itself: the oxidizing agent causes oxidation by being reduced.',
  video: 'oxidizing agent reducing agent oxidized reduced identify',
  gen() {
    if (R(0, 4) === 0) {
      const m = mc('Loses electrons', ['Gains electrons', 'Loses protons', 'Gains protons']);
      return { q: 'A substance that is <b>oxidized</b>…', type: 'choice', choices: m.choices, answer: m.answer, steps: ['Oxidation is loss of electrons (LEO).'] };
    }
    const [eq, oxd, red] = pick(REDOX), all = [...new Set(eq.split(' → ').flatMap((s) => s.split(' + ')).map(species))];
    const t = R(0, 3), target = t === 0 || t === 2 ? oxd : red;
    const word = ['oxidized', 'reduced', 'the reducing agent', 'the oxidizing agent'][t];
    const m = mc(fm(target), all.filter((x) => x !== target).map(fm));
    const why = t === 0 || t === 2 ? `${fm(oxd)} loses electrons (its oxidation number goes up), so it is oxidized, and it is the reducing agent.`
      : `${fm(red)} gains electrons (an oxidation number goes down), so it is reduced, and it is the oxidizing agent.`;
    return { q: `${showEq(eq)}<br>Which species is <b>${word}</b>?`, type: 'choice', choices: m.choices, answer: m.answer, steps: [why, `<b>${fm(target)}</b>`] };
  },
},
{
  id: 'oxnum', zone: ZR, core: true, glyph: '+n', name: 'Oxidation numbers',
  rule: 'Free element = 0. O is usually −2, H is +1, halogens −1, group 1 is +1, group 2 is +2. The numbers add up to the charge (0 for a neutral compound).',
  tip: 'Write what you know (O = −2, H = +1, etc.), multiply by the number of atoms, and set the total equal to the charge of the species. Solve for the unknown. Type it like +5 or -2.',
  video: 'how to find oxidation numbers rules',
  gen() {
    if (R(0, 7) === 0) {
      const el = pick(['Cl2', 'O2', 'N2', 'H2', 'P4', 'Na', 'Fe', 'Br2']);
      return { q: `What is the oxidation number of ${fm(el.replace(/\d/g, ''))} in ${fm(el)}?<br><small>Include the sign for negative numbers.</small>`, type: 'num', answer: 0, tol: 0, wrongs: [1, -1, 2, -2], fmtAns: ox,
        steps: ['A free element has an oxidation number of <b>0</b>.'] };
    }
    const [f, c, t] = pick(OX_BANK), cnt = parseFormula(f), others = Object.entries(cnt).filter(([e]) => e !== t);
    const sum = others.reduce((s, [e, n]) => s + OX_KNOWN[e] * n, 0), val = (c - sum) / cnt[t];
    const label = fm(c ? `${f}^${chg(c)}` : f);
    return { q: `What is the oxidation number of <b>${t}</b> in ${label}?<br><small>Include the sign for negative numbers.</small>`, type: 'num', answer: val, tol: 0, wrongs: [-val, val + 1, val - 1, val + 2, val - 2, val * 2], fmtAns: ox,
      steps: [`Known: ${others.map(([e, n]) => `${n} ${e} (${ox(OX_KNOWN[e])}) = ${ox(n * OX_KNOWN[e])}`).join(', ')}.`,
        `${cnt[t] > 1 ? cnt[t] + '·' : ''}${t} + (${ox(sum)}) = ${c ? ox(c) : '0'} (the charge)`, `${t} = <b>${ox(val)}</b>`] };
  },
},
);
