// Bonding & shapes (Chapter 4): valence electrons, Lewis structures, VSEPR geometry, bond angles, naming molecular compounds.
const ZB = 'Bonding & shapes';
const VAL = { H: 1, Li: 1, Na: 1, K: 1, Be: 2, Mg: 2, Ca: 2, B: 3, Al: 3, C: 4, Si: 4, N: 5, P: 5, O: 6, S: 6, F: 7, Cl: 7, Br: 7, I: 7 };
// Molecules with one central atom. lig = [atom, bond order]; lp = lone pairs on the central atom.
const MOLS = [
  { f: 'H2O', c: 'O', lig: [['H', 1], ['H', 1]], lp: 2 }, { f: 'H2S', c: 'S', lig: [['H', 1], ['H', 1]], lp: 2 }, { f: 'OF2', c: 'O', lig: [['F', 1], ['F', 1]], lp: 2 },
  { f: 'SCl2', c: 'S', lig: [['Cl', 1], ['Cl', 1]], lp: 2 }, { f: 'SO2', c: 'S', lig: [['O', 2], ['O', 2]], lp: 1 },
  { f: 'NH3', c: 'N', lig: [['H', 1], ['H', 1], ['H', 1]], lp: 1 }, { f: 'PCl3', c: 'P', lig: [['Cl', 1], ['Cl', 1], ['Cl', 1]], lp: 1 }, { f: 'PH3', c: 'P', lig: [['H', 1], ['H', 1], ['H', 1]], lp: 1 },
  { f: 'NCl3', c: 'N', lig: [['Cl', 1], ['Cl', 1], ['Cl', 1]], lp: 1 }, { f: 'NF3', c: 'N', lig: [['F', 1], ['F', 1], ['F', 1]], lp: 1 },
  { f: 'H3O^+', c: 'O', lig: [['H', 1], ['H', 1], ['H', 1]], lp: 1, chg: 1 },
  { f: 'CH4', c: 'C', lig: [['H', 1], ['H', 1], ['H', 1], ['H', 1]], lp: 0 }, { f: 'CCl4', c: 'C', lig: [['Cl', 1], ['Cl', 1], ['Cl', 1], ['Cl', 1]], lp: 0 },
  { f: 'SiCl4', c: 'Si', lig: [['Cl', 1], ['Cl', 1], ['Cl', 1], ['Cl', 1]], lp: 0 }, { f: 'SiH4', c: 'Si', lig: [['H', 1], ['H', 1], ['H', 1], ['H', 1]], lp: 0 },
  { f: 'CH3Cl', c: 'C', lig: [['H', 1], ['H', 1], ['H', 1], ['Cl', 1]], lp: 0 }, { f: 'CH2Cl2', c: 'C', lig: [['H', 1], ['H', 1], ['Cl', 1], ['Cl', 1]], lp: 0 },
  { f: 'NH4^+', c: 'N', lig: [['H', 1], ['H', 1], ['H', 1], ['H', 1]], lp: 0, chg: 1 },
  { f: 'CO2', c: 'C', lig: [['O', 2], ['O', 2]], lp: 0 }, { f: 'CS2', c: 'C', lig: [['S', 2], ['S', 2]], lp: 0 }, { f: 'HCN', c: 'C', lig: [['H', 1], ['N', 3]], lp: 0 },
  { f: 'BF3', c: 'B', lig: [['F', 1], ['F', 1], ['F', 1]], lp: 0 }, { f: 'BCl3', c: 'B', lig: [['Cl', 1], ['Cl', 1], ['Cl', 1]], lp: 0 },
  { f: 'CH2O', c: 'C', lig: [['H', 1], ['H', 1], ['O', 2]], lp: 0 }, { f: 'COCl2', c: 'C', lig: [['Cl', 1], ['Cl', 1], ['O', 2]], lp: 0 },
];
const label = (m) => fm(m.f);
const GEOS = ['Linear', 'Trigonal planar', 'Bent', 'Tetrahedral', 'Pyramidal'];
// Shape and angle are always shown together so they get learned as a pair.
const GA = [['Linear', 180], ['Trigonal planar', 120], ['Bent', 120], ['Bent', 104.5], ['Tetrahedral', 109.5], ['Pyramidal', 107]];
const gaLabel = (n, a) => `${n}, ${a}°`;
const gaChoices = (g, byAngle) => mc(gaLabel(g.g, g.a), GA.filter(([n, a]) => (byAngle ? a !== g.a : n !== g.g)).map(([n, a]) => gaLabel(n, a)));
function geo(m) {
  const clouds = m.lig.length + m.lp;
  if (clouds === 2) return { g: 'Linear', a: 180, clouds };
  if (clouds === 3) return m.lp === 0 ? { g: 'Trigonal planar', a: 120, clouds } : { g: 'Bent', a: 120, clouds };
  return m.lp === 0 ? { g: 'Tetrahedral', a: 109.5, clouds } : m.lp === 1 ? { g: 'Pyramidal', a: 107, clouds } : { g: 'Bent', a: 104.5, clouds };
}
const valTotal = (m) => Object.entries(parseFormula(m.f)).reduce((s, [e, n]) => s + VAL[e] * n, 0) - (m.chg || 0);
// Electrons actually drawn: 2 per bond pair, 2 per lone pair (terminal atoms fill to an octet, H has none).
const drawnE = (m) => 2 * m.lig.reduce((s, [, o]) => s + o, 0) + 2 * m.lp + m.lig.reduce((s, [a, o]) => s + (a === 'H' ? 0 : 2 * (4 - o)), 0);

// ---- Lewis structure pictures ----
const rad2 = (deg) => (deg * Math.PI) / 180;
function lewisSVG(m, v = {}) {
  const S0 = 150, cx = 75, cy = 75, RL = 46, n = m.lig.length, lpC = v.lpC ?? m.lp;
  const dirs = n === 2 ? (m.lp === 0 ? [180, 0] : [210, 330]) : n === 3 ? (m.lp === 0 ? [90, 210, 330] : [210, 270, 330]) : [90, 0, 270, 180];
  const P = (a, r, ox = cx, oy = cy) => [ox + r * Math.cos(rad2(a)), oy - r * Math.sin(rad2(a))];
  let out = '';
  const pair = (a, r, ox, oy) => { const [x, y] = P(a, r, ox, oy), [dx, dy] = [Math.cos(rad2(a + 90)) * 3.2, -Math.sin(rad2(a + 90)) * 3.2]; return `<circle cx="${(x + dx).toFixed(1)}" cy="${(y + dy).toFixed(1)}" r="2" /><circle cx="${(x - dx).toFixed(1)}" cy="${(y - dy).toFixed(1)}" r="2" />`; };
  const label_ = (t, x, y) => `<text x="${x.toFixed(1)}" y="${(y + 6).toFixed(1)}" text-anchor="middle" font-size="19" font-family="ui-monospace,Consolas,monospace" font-weight="700" stroke="none">${t}</text>`;
  m.lig.forEach(([atom, o0], i) => {
    const a = dirs[i], o = v.order && v.order[i] ? v.order[i] : o0, [lx, ly] = P(a, RL);
    for (let k = 0; k < o; k++) { const off = (k - (o - 1) / 2) * 5, [sx, sy] = P(a, 14), [ex, ey] = P(a, RL - 13), [px, py] = [-Math.sin(rad2(a)) * off, -Math.cos(rad2(a)) * off]; out += `<line x1="${(sx + px).toFixed(1)}" y1="${(sy + py).toFixed(1)}" x2="${(ex + px).toFixed(1)}" y2="${(ey + py).toFixed(1)}" stroke-width="2" stroke-linecap="round" />`; }
    out += label_(atom, lx, ly);
    if (atom !== 'H') {
      const cnt = Math.max(0, 4 - o0 + (v.termDelta || 0)), offs = { 1: [0], 2: [-50, 50], 3: [-65, 0, 65], 4: [-90, -30, 30, 90], 0: [] }[Math.min(cnt, 4)];
      offs.forEach((d) => { out += pair(a + d, 16, lx, ly); });
    }
  });
  // Central lone pairs go on the side away from the bonded atoms.
  const free = { '2.0': [[90], [70, 110], [50, 90, 130]], '2.1': [[90], [65, 115], [45, 90, 135]], '3.0': [[270], [250, 290], [230, 270, 310]], '3.1': [[90], [65, 115], [45, 90, 135]], '4.0': [[45], [45, 135], [45, 135, 225]] }[`${n}.${m.lp > 0 ? 1 : 0}`] || [];
  (free[Math.max(0, Math.min(lpC, free.length)) - 1] || []).forEach((a) => { out += pair(a, 18, cx, cy); });
  out += label_(m.c, cx, cy);
  if (m.chg) out += `<text x="132" y="20" text-anchor="middle" font-size="16" font-weight="700">${m.chg > 0 ? '+' : '−'}</text>`;
  return `<svg viewBox="0 0 ${S0} ${S0}" width="150" height="150" role="img" aria-label="Lewis structure option" fill="currentColor" stroke="currentColor">${out}</svg>`;
}

const PRE = ['', 'mono', 'di', 'tri', 'tetra', 'penta', 'hexa', 'hepta', 'octa', 'nona', 'deca'];
const EL1 = { C: 'carbon', N: 'nitrogen', O: 'oxygen', P: 'phosphorus', S: 'sulfur', Si: 'silicon', B: 'boron', I: 'iodine', Cl: 'chlorine', F: 'fluorine', Br: 'bromine' };
const EL2 = { C: 'carbide', N: 'nitride', O: 'oxide', P: 'phosphide', S: 'sulfide', Cl: 'chloride', F: 'fluoride', Br: 'bromide', I: 'iodide' };
const BINARY = ['CO', 'CO2', 'SO2', 'SO3', 'N2O', 'NO', 'NO2', 'N2O3', 'N2O4', 'N2O5', 'PCl3', 'PCl5', 'SiCl4', 'CS2', 'SF6', 'BCl3', 'ICl3', 'P4O10', 'P2O5', 'CCl4', 'NF3', 'OF2', 'Cl2O', 'IF5', 'SCl2', 'PBr3', 'BF3', 'SiO2', 'CBr4', 'N2S3'];
function nameBinary(f) {
  const c = parseFormula(f), els = [...f.matchAll(/[A-Z][a-z]?/g)].map((x) => x[0]), [a, b] = els, na = c[a], nb = c[b];
  const first = (na > 1 ? PRE[na] : '') + EL1[a], p2 = PRE[nb], an = EL2[b];
  const second = /[ao]$/.test(p2) && /^[ao]/.test(an) ? p2.slice(0, -1) + an : p2 + an, loose = p2 + an;
  return { name: `${first} ${second}`, alt: `${first} ${loose}` };
}
const CONCEPTS = [
  ['Why must a chemical equation be balanced?', 'Atoms are neither created nor destroyed (conservation of mass)', ['Energy is always released in equal amounts', 'Every compound must keep its state symbol', 'The number of molecules must double'], 'Balancing follows the Law of Conservation of Mass.'],
  ['The limiting reagent is…', 'the reactant that is completely used up first', ['the reactant present in the largest mass', 'the reactant with the largest molar mass', 'the product that forms first'], 'It runs out first, so it limits how much product forms.'],
  ['Which statement about the mole is correct?', 'One mole of any substance contains 6.02 × 10²³ particles of it', ['One mole of any compound has a mass of 100 g', 'One mole of any element has a mass of 1 g', 'One mole of a gas always has 6.02 × 10²³ atoms'], 'A mole is a count (6.02 × 10²³), and its mass in grams is the molar mass.'],
  ['The molar mass of a compound is…', 'the mass in grams of one mole of it', ['the mass of one molecule in grams', 'its mass in amu divided by 6.02 × 10²³', 'the number of atoms in one mole'], 'Molar mass is g per mol.'],
  ['A substance that is oxidized…', 'loses electrons', ['gains electrons', 'loses protons', 'gains protons'], 'Oxidation is loss of electrons (LEO).'],
  ['The reducing agent is the substance that…', 'is oxidized', ['is reduced', 'is the product', 'does not change oxidation number'], 'It gives electrons away, so it is oxidized.'],
  ['A product of every acid-base neutralization is…', 'water (and a salt)', ['a precipitate', 'a free metal', 'oxygen gas'], 'Acid + base → salt + water.'],
  ['A precipitate is…', 'an insoluble solid that forms from a solution', ['a gas that bubbles out of a solution', 'a dissolved ionic compound', 'the liquid left after a reaction'], 'Precipitates are the (s) products of precipitation reactions.'],
  ['Spectator ions are…', 'ions that appear unchanged on both sides of the equation', ['ions that form the precipitate', 'ions that are oxidized', 'ions that are only in the products'], 'Cancel them to get the net ionic equation.'],
  ['A net ionic equation shows…', 'only the species that actually change', ['every ion in the reaction', 'only the spectator ions', 'only the solids'], 'Spectators are left out.'],
  ['In a covalent bond, atoms…', 'share electrons', ['transfer electrons completely', 'share protons', 'share neutrons'], 'Ionic bonds transfer electrons; covalent bonds share them.'],
  ['The bond length is the distance between two nuclei when…', 'attraction and repulsion are balanced', ['attraction is weakest', 'the electrons are farthest apart', 'the atoms are not touching'], 'It is the lowest-energy separation.'],
  ['Compared with a single bond, a triple bond is…', 'shorter and stronger', ['longer and stronger', 'shorter and weaker', 'the same length'], 'More shared pairs pull the nuclei closer together.'],
  ['In a coordinate covalent bond, the shared pair…', 'comes from one of the two atoms', ['comes from both atoms equally', 'is made of protons', 'is transferred completely'], 'Both electrons are donated by the same atom.'],
  ['Theoretical yield is…', 'the most product that could form, based on the limiting reagent', ['the amount of product actually collected', 'the amount of excess reactant left', 'the mass of all reactants combined'], 'Percent yield = actual ÷ theoretical × 100.'],
  ['The VSEPR model says electron clouds…', 'repel each other and spread as far apart as possible', ['attract each other and cluster', 'always form a flat shape', 'move only when heated'], 'That is what sets the shape.'],
  ['The octet rule says atoms tend to…', 'end up with eight valence electrons', ['lose all their valence electrons', 'have equal protons and neutrons', 'gain exactly one electron'], 'Hydrogen is the exception (two).'],
  ['A lone pair is…', 'a pair of valence electrons not shared in a bond', ['two atoms sharing electrons', 'a pair of protons', 'a double bond'], 'Lone pairs count as charge clouds in VSEPR.'],
];

// Plausible wrong names and formulas for binary molecular compounds (wrong prefixes, no prefixes, swapped counts).
const binParts = (f) => { const c = parseFormula(f), els = [...f.matchAll(/[A-Z][a-z]?/g)].map((x) => x[0]); return { a: els[0], b: els[1], na: c[els[0]], nb: c[els[1]] }; };
const mkName = (a, b, na, nb, mono1) => { const p2 = PRE[nb], an = EL2[b], second = /[ao]$/.test(p2) && /^[ao]/.test(an) ? p2.slice(0, -1) + an : p2 + an; return `${na > 1 || mono1 ? PRE[na] : ''}${EL1[a]} ${second}`; };
const badNames = (f) => { const { a, b, na, nb } = binParts(f); return [mkName(a, b, na, nb === 1 ? 2 : nb - 1), mkName(a, b, na, nb + 1), mkName(a, b, na, nb, true), `${EL1[a]} ${EL2[b]}`, mkName(a, b, nb, na)].filter((s) => !/undefined/.test(s)); };
const num_ = (n) => (n > 1 ? n : '');
const badFormulas = (f) => { const { a, b, na, nb } = binParts(f); return [a + num_(nb) + b + num_(na), a + num_(na) + b + (nb + 1), a + (na + 1) + b + num_(nb), b + num_(nb) + a + num_(na)].map(fm).filter((s) => s !== fm(f)); };

SKILLS.push(
{
  id: 'valelec', zone: ZB, core: true, glyph: 'e⁻#', name: 'Valence electrons',
  rule: 'Valence electrons = the group number (A groups). For a molecule, add every atom’s valence electrons. Subtract 1 for each + charge on an ion, add 1 for each −.',
  tip: 'Find each element’s group (H = 1, C = 4, N = 5, O = 6, halogens = 7), multiply by the number of atoms, and add. This is Step 1 of drawing a Lewis structure.',
  video: 'counting valence electrons in a molecule lewis structure step 1',
  gen() {
    if (R(0, 3) === 0) {
      const el = pick(Object.keys(VAL));
      return { q: `How many valence electrons does one <b>${el}</b> atom have?`, type: 'num', answer: VAL[el], tol: 0, wrongs: [VAL[el] + 1, VAL[el] - 1, VAL[el] + 2, 8 - VAL[el]], steps: [`${el} is in the group with ${VAL[el]} valence electron${VAL[el] > 1 ? 's' : ''} (its A-group number).`] };
    }
    const m = pick(MOLS), parts = Object.entries(parseFormula(m.f)), tot = valTotal(m);
    return { q: `How many valence electrons are in ${label(m)}?<br><small>Total for the whole ${m.chg ? 'ion' : 'molecule'}</small>`, type: 'num', answer: tot, tol: 0, wrongs: [tot + 2, tot - 2, tot + 8, tot - 8, tot + 1],
      steps: [...parts.map(([e, n]) => `${n} ${e} × ${VAL[e]} = ${n * VAL[e]}`), m.chg ? `Subtract ${m.chg} for the +${m.chg} charge.` : '', `Total: <b>${tot}</b>`].filter(Boolean) };
  },
},
{
  id: 'lewis', zone: ZB, core: true, glyph: 'Lewis', name: 'Pick the Lewis structure',
  rule: '1) Count all valence electrons. 2) Connect the atoms with single bonds. 3) Give each outer atom (not H) a full octet. 4) Put leftover electrons on the central atom. 5) Use double or triple bonds if the central atom still lacks an octet.',
  tip: 'Count the dots and lines: each bond is 2 electrons, each dot pair is 2. The total must equal the valence electrons you counted, and every atom except H should have 8 around it (H has 2).',
  video: 'how to draw lewis structures step by step',
  gen() {
    const m = pick(MOLS), tot = valTotal(m);
    const hasT = m.lig.some(([a]) => a !== 'H'), multi = m.lig.some(([, o]) => o > 1);
    const ords = m.lig.map(([, o]) => o);
    const flat = {}, ix = Math.max(0, m.lig.findIndex(([a, o]) => a !== 'H' && o === 1)); // wrong on purpose: bond orders changed
    m.lig.forEach(([, o], i) => { flat[i] = multi ? 1 : i === ix ? 2 : o; });
    const wrongs = [{ lpC: m.lp > 0 ? m.lp - 1 : m.lp + 1 }, { lpC: m.lp + 1 }, hasT ? { termDelta: -1 } : { lpC: m.lp + 2 }, { order: flat }].map((v) => lewisSVG(m, v));
    const good = lewisSVG(m), mm = mc(good, wrongs);
    return { q: `Which is the correct Lewis structure for ${label(m)}?<br><small>Dots are lone pairs, lines are bonds</small>`, type: 'choice', choices: mm.choices, answer: mm.answer,
      steps: [`Valence electrons: ${tot}.`, `Bonds use ${2 * ords.reduce((a, b) => a + b, 0)} electrons${m.lig.some(([a]) => a !== 'H') ? ', outer atoms get octets' : ''}, and the central atom gets ${m.lp} lone pair${m.lp === 1 ? '' : 's'}.`, `The correct picture is the one where everything adds up to ${tot} electrons.`] };
  },
},
{
  id: 'geometry', zone: ZB, core: true, glyph: 'VSEPR', name: 'Molecular geometry',
  rule: 'Count the charge clouds on the central atom (each bond, double and triple bonds included, counts as ONE; each lone pair counts as one). 2 clouds: linear. 3: trigonal planar (bent if 1 lone pair). 4: tetrahedral (pyramidal with 1 lone pair, bent with 2).',
  tip: 'Draw the Lewis structure first. Then count bonding groups and lone pairs on the central atom. Shape names only describe the atoms, so lone pairs change the name: NH₃ has 4 clouds but is pyramidal, H₂O is bent. Learn each shape with its angle: linear 180°, trigonal planar 120°, tetrahedral 109.5°, pyramidal 107°, bent 104.5° (or 120° with 3 clouds).',
  video: 'VSEPR theory molecular geometry charge clouds lone pairs',
  gen() {
    if (R(0, 3) === 0) {
      const lp = pick([0, 0, 1, 1, 2]), bonds = pick([2, 3, 4]), clouds = bonds + lp;
      if (clouds > 4) return this.gen();
      const g = geo({ lig: Array(bonds).fill(['X', 1]), lp }), mm = gaChoices(g);
      return { q: `A central atom has <b>${bonds}</b> bonded atoms and <b>${lp}</b> lone pair${lp === 1 ? '' : 's'}. What is the geometry and bond angle?`, type: 'choice', choices: mm.choices, answer: mm.answer,
        steps: [`Charge clouds: ${bonds} + ${lp} = ${clouds}.`, `<b>${g.g}, ${g.a}°</b>`] };
    }
    const m = pick(MOLS), g = geo(m), mm = gaChoices(g);
    return { q: `What is the geometry and bond angle around the central atom of ${label(m)}?`, type: 'choice', choices: mm.choices, answer: mm.answer,
      steps: [`Lewis structure: ${m.c} is bonded to ${m.lig.length} atom${m.lig.length > 1 ? 's' : ''}${m.lig.some(([, o]) => o > 1) ? ' (double/triple bonds count as one cloud)' : ''} and has ${m.lp} lone pair${m.lp === 1 ? '' : 's'}.`, `Charge clouds: ${m.lig.length} + ${m.lp} = ${g.clouds}.`, `<b>${g.g}, ${g.a}°</b>`] };
  },
},
{
  id: 'bondangle', zone: ZB, core: true, glyph: '∠', name: 'Bond angles',
  rule: 'Linear 180°. Trigonal planar 120°. Tetrahedral 109.5°. Pyramidal about 107°. Bent about 104.5° when it comes from 4 clouds (like water) or about 120° from 3 clouds (like SO₂).',
  tip: 'Get the geometry first, then match the angle. Lone pairs squeeze the bond angle a little: methane 109.5°, ammonia 107°, water 104.5°.',
  video: 'bond angles for molecular geometries 180 120 109.5',
  gen() {
    const m = pick(MOLS), g = geo(m), ans = gaLabel(g.g, g.a), mm = gaChoices(g, true);
    return { q: `What are the geometry and approximate bond angle in ${label(m)}?`, type: 'choice', choices: mm.choices, answer: mm.answer, steps: [`${label(m)} is <b>${g.g}</b> (${g.clouds} charge clouds).`, `Answer: <b>${ans}</b>`] };
  },
},
{
  id: 'molname', zone: ZB, core: true, glyph: 'di-tri', name: 'Naming molecular compounds',
  rule: 'Name the first element (add a prefix only if it has 2 or more atoms), then the second element with an -ide ending and a prefix that always shows the number. Prefixes: 1 mono, 2 di, 3 tri, 4 tetra, 5 penta, 6 hexa, 7 hepta, 8 octa, 9 nona, 10 deca.',
  tip: 'Never use mono- on the first element (carbon monoxide, not monocarbon monoxide). Drop the last letter of the prefix before oxide: monoxide, pentoxide. Type names in lowercase or any case; type formulas like N2O5.',
  video: 'naming binary molecular compounds covalent prefixes',
  gen() {
    const f = pick(BINARY), nm = nameBinary(f);
    if (R(0, 1)) return { q: `Name this compound: ${fm(f)}`, type: 'text', accept: [nm.name, nm.alt, nm.name.replace('phosphorus', 'phosphorous')], wrongs: badNames(f), steps: [`First element: ${nm.name.split(' ')[0]}.`, `Second element with prefix and -ide: ${nm.name.split(' ').slice(1).join(' ')}.`, `<b>${nm.name}</b>`] };
    return { q: `Write the formula for <b>${nm.name}</b>.<br><small>For example: N2O5</small>`, type: 'formula', accept: [normF(f)], shown: fm(f), wrongs: badFormulas(f), steps: [`Prefixes give the subscripts: ${nm.name}.`, `<b>${fm(f)}</b>`] };
  },
},
{
  id: 'bondbasics', zone: ZB, core: true, glyph: 'bond', name: 'Covalent vs ionic basics',
  rule: 'Metal + nonmetal: ionic (electrons transferred). Nonmetal + nonmetal: molecular (electrons shared). H forms 1 bond, halogens 1, O 2, N 3, C 4.',
  tip: 'Ask what the elements are: a metal on the left side of the table with a nonmetal gives an ionic compound; two nonmetals share electrons. Each bond is a pair of shared electrons, so a double bond shares 4 electrons.',
  video: 'ionic vs covalent bonds how to tell',
  gen() {
    const t = R(0, 2);
    if (t === 0) {
      const el = pick(['H', 'C', 'N', 'O', 'F', 'Cl', 'Br', 'I']), n = { H: 1, C: 4, N: 3, O: 2, F: 1, Cl: 1, Br: 1, I: 1 }[el];
      return { q: `How many covalent bonds does a neutral <b>${el}</b> atom usually form?`, type: 'num', answer: n, tol: 0, wrongs: [1, 2, 3, 4], steps: [`${el} has ${VAL[el]} valence electrons and needs ${el === 'H' ? 1 : 8 - VAL[el]} more, so it forms <b>${n}</b> bond${n > 1 ? 's' : ''}.`] };
    }
    if (t === 1) {
      const ionic = ['NaCl', 'MgO', 'CaCl2', 'K2S', 'Al2O3', 'LiF', 'BaCl2', 'MgBr2', 'Na2O', 'KI'], mol = ['CO2', 'H2O', 'NH3', 'CH4', 'SO2', 'PCl3', 'CCl4', 'N2O', 'HCl', 'CS2', 'SiCl4', 'OF2'];
      const isIon = R(0, 1), f = pick(isIon ? ionic : mol), ans = isIon ? 'Ionic' : 'Molecular (covalent)';
      const mm = mc(ans, [isIon ? 'Molecular (covalent)' : 'Ionic']);
      return { q: `Is ${fm(f)} an ionic or a molecular compound?`, type: 'choice', choices: mm.choices, answer: mm.answer,
        steps: [isIon ? 'It contains a metal and a nonmetal: electrons are transferred.' : 'It contains only nonmetals: electrons are shared.', `<b>${ans}</b>`] };
    }
    const k = pick([1, 2, 3]), word = ['single', 'double', 'triple'][k - 1];
    return { q: `How many electrons are shared in a <b>${word}</b> bond?`, type: 'num', answer: 2 * k, tol: 0, wrongs: [2, 4, 6, 8], steps: [`A ${word} bond is ${k} shared pair${k > 1 ? 's' : ''}: ${k} × 2 = <b>${2 * k}</b> electrons.`] };
  },
},
{
  id: 'concepts', zone: 'Concept check', core: true, glyph: 'MC', name: 'Multiple-choice concepts',
  rule: 'Quick definition questions like the multiple-choice section of the exam: read all four answers before choosing.',
  tip: 'These come straight from the vocabulary in Chapters 4 to 6. If you miss one, read the one-line reason, then say the definition out loud.',
  video: 'general chemistry exam review definitions',
  gen() {
    const [q, ok, wr, why] = pick(CONCEPTS), mm = mc(ok, wr);
    return { q, type: 'choice', choices: mm.choices, answer: mm.answer, steps: [why, `<b>${ok}</b>`] };
  },
},
);
