// The 16 polyatomic ions you are responsible for (Table 3.3 minus chromate, dichromate, oxalate and permanganate).
// alts = other accepted formulas, altNames = other accepted names.
const IONS = [
  { name: 'hydronium', f: 'H3O', c: 1 },
  { name: 'ammonium', f: 'NH4', c: 1 },
  { name: 'acetate', f: 'CH3CO2', c: -1, alts: ['CH3COO', 'C2H3O2'] },
  { name: 'carbonate', f: 'CO3', c: -2 },
  { name: 'hydrogen carbonate', f: 'HCO3', c: -1, altNames: ['bicarbonate'] },
  { name: 'cyanide', f: 'CN', c: -1 },
  { name: 'hydroxide', f: 'OH', c: -1 },
  { name: 'hypochlorite', f: 'OCl', c: -1, alts: ['ClO'] },
  { name: 'nitrate', f: 'NO3', c: -1 },
  { name: 'nitrite', f: 'NO2', c: -1 },
  { name: 'phosphate', f: 'PO4', c: -3 },
  { name: 'hydrogen phosphate', f: 'HPO4', c: -2, altNames: ['biphosphate'] },
  { name: 'dihydrogen phosphate', f: 'H2PO4', c: -1 },
  { name: 'sulfate', f: 'SO4', c: -2 },
  { name: 'hydrogen sulfate', f: 'HSO4', c: -1, altNames: ['bisulfate'] },
  { name: 'sulfite', f: 'SO3', c: -2 },
];
// Simple ions used to build compounds with the polyatomic ions.
const CATIONS = [
  { name: 'sodium', f: 'Na', c: 1 }, { name: 'potassium', f: 'K', c: 1 }, { name: 'lithium', f: 'Li', c: 1 }, { name: 'magnesium', f: 'Mg', c: 2 },
  { name: 'calcium', f: 'Ca', c: 2 }, { name: 'barium', f: 'Ba', c: 2 }, { name: 'aluminum', f: 'Al', c: 3 }, { name: 'zinc', f: 'Zn', c: 2 },
  { name: 'iron(III)', f: 'Fe', c: 3, alt: 'iron3' }, { name: 'copper(II)', f: 'Cu', c: 2, alt: 'copper2' },
];
const SIMPLE_ANIONS = [{ name: 'chloride', f: 'Cl', c: -1 }, { name: 'oxide', f: 'O', c: -2 }, { name: 'sulfide', f: 'S', c: -2 }, { name: 'bromide', f: 'Br', c: -1 }];

const ionHTML = (i) => fm(`${i.f}^${chg(i.c)}`);
const ionNames = (i) => [i.name, ...(i.altNames || [])];

// Everything a typed answer may look like once spaces, ^ and brackets are stripped: SO42-, SO4-2, NO3-, NO31- ...
function normF(s) {
  const sup = { '⁰': 0, '¹': 1, '²': 2, '³': 3, '⁴': 4, '⁵': 5, '⁶': 6, '⁷': 7, '⁸': 8, '⁹': 9 };
  const sub = '₀₁₂₃₄₅₆₇₈₉';
  s = String(s).replace(/[⁰¹²³⁴-⁹]/g, (m) => sup[m]).replace(/[₀-₉]/g, (m) => sub.indexOf(m))
    .replace(/⁺/g, '+').replace(/[⁻−–]/g, '-').replace(/[\s^_{}]/g, '');
  return s.replace(/\((\d*[+-]\d*)\)$/, '$1');
}
const normT = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
function ionAccepted(i) {
  const m = Math.abs(i.c), sg = i.c > 0 ? '+' : '-', out = [];
  [i.f, ...(i.alts || [])].forEach((f) => { out.push(`${f}${m}${sg}`, `${f}${sg}${m}`); if (m === 1) out.push(`${f}${sg}`); });
  return out;
}
// Cation + anion -> formula and name, with parentheses around polyatomic ions that appear more than once.
const ionUnit = (ion, n, poly) => (poly && n > 1 ? `(${ion.f})${n}` : `${ion.f}${n > 1 ? n : ''}`);
function compound(cat, an, polyCat = false, polyAn = false) {
  const a = Math.abs(an.c), g = gcd(cat.c, a), nc = a / g, na = cat.c / g;
  return { f: ionUnit(cat, nc, polyCat) + ionUnit(an, na, polyAn), name: `${cat.name} ${an.name}` };
}
