// Reference tables: a periodic table (with A-group labels = valence electrons) and the polyatomic ions. A class turns them on in its
// settings; they open on top of a question in progress (the overlay) and stay open under each practice question.
const PT_SYMS = 'H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og'.split(' ');
const PT_NAMES = 'Hydrogen Helium Lithium Beryllium Boron Carbon Nitrogen Oxygen Fluorine Neon Sodium Magnesium Aluminum Silicon Phosphorus Sulfur Chlorine Argon Potassium Calcium Scandium Titanium Vanadium Chromium Manganese Iron Cobalt Nickel Copper Zinc Gallium Germanium Arsenic Selenium Bromine Krypton Rubidium Strontium Yttrium Zirconium Niobium Molybdenum Technetium Ruthenium Rhodium Palladium Silver Cadmium Indium Tin Antimony Tellurium Iodine Xenon Cesium Barium Lanthanum Cerium Praseodymium Neodymium Promethium Samarium Europium Gadolinium Terbium Dysprosium Holmium Erbium Thulium Ytterbium Lutetium Hafnium Tantalum Tungsten Rhenium Osmium Iridium Platinum Gold Mercury Thallium Lead Bismuth Polonium Astatine Radon Francium Radium Actinium Thorium Protactinium Uranium Neptunium Plutonium Americium Curium Berkelium Californium Einsteinium Fermium Mendelevium Nobelium Lawrencium Rutherfordium Dubnium Seaborgium Bohrium Hassium Meitnerium Darmstadtium Roentgenium Copernicium Nihonium Flerovium Moscovium Livermorium Tennessine Oganesson'.split(' ');
const ptInfo = (z) => `${PT_NAMES[z - 1]} (${PT_SYMS[z - 1]}) · atomic number ${z}${PT_MASS[z - 1] ? ` · ${PT_MASS[z - 1]} g/mol` : ''}`;
// Atomic masses for Z = 1..92 (a value in brackets is the mass number of the longest-lived isotope). Heavier elements show no mass.
const PT_MASS = ['1.01', '4.00', '6.94', '9.01', '10.81', '12.01', '14.01', '16.00', '19.00', '20.18', '22.99', '24.31', '26.98', '28.09', '30.97', '32.07', '35.45', '39.95', '39.10', '40.08',
  '44.96', '47.87', '50.94', '52.00', '54.94', '55.85', '58.93', '58.69', '63.55', '65.38', '69.72', '72.63', '74.92', '78.97', '79.90', '83.80', '85.47', '87.62', '88.91', '91.22',
  '92.91', '95.95', '(98)', '101.07', '102.91', '106.42', '107.87', '112.41', '114.82', '118.71', '121.76', '127.60', '126.90', '131.29', '132.91', '137.33', '138.91', '140.12', '140.91', '144.24',
  '(145)', '150.36', '151.96', '157.25', '158.93', '162.50', '164.93', '167.26', '168.93', '173.05', '174.97', '178.49', '180.95', '183.84', '186.21', '190.23', '192.22', '195.08', '196.97', '200.59',
  '204.38', '207.2', '208.98', '(209)', '(210)', '(222)', '(223)', '(226)', '(227)', '232.04', '231.04', '238.03'];
const PT_NONMETAL = ['H', 'C', 'N', 'O', 'P', 'S', 'Se', 'F', 'Cl', 'Br', 'I'], PT_METALLOID = ['B', 'Si', 'Ge', 'As', 'Sb', 'Te', 'At'], PT_NOBLE = ['He', 'Ne', 'Ar', 'Kr', 'Xe', 'Rn', 'Og'];
const ptCat = (s) => (PT_NOBLE.includes(s) ? 'noble' : PT_NONMETAL.includes(s) ? 'nonmetal' : PT_METALLOID.includes(s) ? 'metalloid' : 'metal');
// [row, column] on the standard 18-column layout; rows 10 and 11 are the lanthanides and actinides.
function ptPos(z) {
  if (z === 1) return [2, 1]; if (z === 2) return [2, 18];
  if (z <= 4) return [3, z - 2]; if (z <= 10) return [3, z + 8];
  if (z <= 12) return [4, z - 10]; if (z <= 18) return [4, z];
  if (z <= 36) return [5, z - 18]; if (z <= 54) return [6, z - 36];
  if (z <= 56) return [7, z - 54]; if (z <= 71) return [10, z - 54];
  if (z <= 86) return [7, z - 68]; if (z <= 88) return [8, z - 86];
  if (z <= 103) return [11, z - 86]; return [8, z - 100];
}
const PT_A = { 1: '1A', 2: '2A', 13: '3A', 14: '4A', 15: '5A', 16: '6A', 17: '7A', 18: '8A' };

function ptHTML() {
  let out = '<p class="lead">For the main-group elements (the A groups), <b>valence electrons = the group number</b>: 1A has 1, 2A has 2, 3A has 3, up to 8A with 8 (helium has 2).</p><p class="ptinfo" id="ptinfo" role="status">Tap or hover an element to see its name.</p><div class="ptwrap"><div class="ptg">';
  for (let c = 1; c <= 18; c++) out += `<div class="pth" style="grid-column:${c};grid-row:1">${PT_A[c] ? `<b>${PT_A[c]}</b><span>${c === 18 ? '8 e⁻' : (c > 12 ? c - 10 : c) + ' e⁻'}</span>` : `<span>${c}</span>`}</div>`;
  PT_SYMS.forEach((s, i) => {
    const [r, c] = ptPos(i + 1), m = PT_MASS[i] || '';
    out += `<div class="ptc ${ptCat(s)}" style="grid-column:${c};grid-row:${r}" data-z="${i + 1}" title="${ptInfo(i + 1)}"><small>${i + 1}</small><b>${s}</b><small>${m}</small></div>`;
  });
  out += '<div class="ptc gap" style="grid-column:3;grid-row:7"><small>57–71</small></div><div class="ptc gap" style="grid-column:3;grid-row:8"><small>89–103</small></div></div></div>';
  return out + '<p class="legend"><span class="sw metal"></span>metal <span class="sw nonmetal"></span>nonmetal <span class="sw metalloid"></span>metalloid <span class="sw noble"></span>noble gas</p><small>Masses are in g/mol (amu). Heaviest elements have no mass shown here. On the exam you get your own periodic table.</small>';
}

// Polyatomic ions: name, formula with its charge (^ marks the charge), and whether the course requires it.
const REF_IONS = [
  ['ammonium', 'NH4^+'], ['hydronium', 'H3O^+'], ['acetate', 'CH3CO2^-'], ['carbonate', 'CO3^2-'], ['hydrogen carbonate (bicarbonate)', 'HCO3^-'], ['cyanide', 'CN^-'],
  ['hydroxide', 'OH^-'], ['hypochlorite', 'OCl^-'], ['nitrate', 'NO3^-'], ['nitrite', 'NO2^-'], ['phosphate', 'PO4^3-'], ['hydrogen phosphate', 'HPO4^2-'],
  ['dihydrogen phosphate', 'H2PO4^-'], ['sulfate', 'SO4^2-'], ['hydrogen sulfate (bisulfate)', 'HSO4^-'], ['sulfite', 'SO3^2-'],
  ['chromate', 'CrO4^2-'], ['dichromate', 'Cr2O7^2-'], ['oxalate', 'C2O4^2-'], ['permanganate', 'MnO4^-'],
];
// "SO4^2-" -> SO<sub>4</sub><sup>2−</sup>
const refFm = (f) => esc(f).replace(/\^(\d*[+-])/g, (m, c) => `<sup>${c.replace('-', '−')}</sup>`).replace(/([A-Za-z)])(\d+)/g, '$1<sub>$2</sub>');
function ionsHTML() {
  return `<div class="reftable">${REF_IONS.map(([n, f]) => `<div><b>${esc(n)}</b></div><div class="mono">${refFm(f)}</div>`).join('')}</div>`;
}
// Bond geometry (VSEPR): shape and angle always appear together.
const GEO_ROWS = [
  [2, 2, 0, 'Linear', '180°', 'CO2, CS2, HCN'],
  [3, 3, 0, 'Trigonal planar', '120°', 'BF3, CH2O, COCl2'],
  [3, 2, 1, 'Bent', 'about 120°', 'SO2'],
  [4, 4, 0, 'Tetrahedral', '109.5°', 'CH4, CCl4, NH4^+'],
  [4, 3, 1, 'Pyramidal', 'about 107°', 'NH3, PCl3, H3O^+'],
  [4, 2, 2, 'Bent', 'about 104.5°', 'H2O, H2S, OF2'],
];
function geoHTML() {
  let last = 0;
  const rows = GEO_ROWS.map(([c, b, l, shape, ang, ex]) => {
    const head = c !== last ? `<tr class="grp"><td colspan="6">${c} charge clouds</td></tr>` : '';
    last = c;
    return `${head}<tr><td class="num">${c}</td><td class="num">${b}</td><td class="num">${l}</td><td class="shape">${shape}</td><td class="ang">${ang}</td><td>${ex.split(', ').map((e) => fmtMath(e)).join(', ')}</td></tr>`;
  }).join('');
  return `<p class="lead">Count the charge clouds on the central atom. A single, double or triple bond is one cloud, and each lone pair is one cloud. Learn each shape together with its angle.</p>
    <div class="gtwrap"><table class="gt"><thead><tr><th>Clouds</th><th>Bonds</th><th>Lone pairs</th><th>Shape</th><th>Bond angle</th><th>Examples</th></tr></thead><tbody>${rows}</tbody></table></div>
    <small>Lone pairs push the bonded atoms closer together, so the angle shrinks: methane 109.5°, ammonia 107°, water 104.5°.</small>`;
}
// Mole map (from ChemQuest): every conversion goes through moles.
function moleMapHTML() {
  const row = (a, via, b, mid) => `<div class="row3"><div class="box ${/a/.test(mid) ? 'mol' : ''}">${a}</div><div class="via">${via}</div><div class="box ${/b/.test(mid) ? 'mol' : ''}">${b}</div></div>`;
  return `<p class="lead">Every conversion goes through <b>moles</b>. You can only change substance (A to B) while you are in moles, using the coefficients.</p>
    <div class="mm">
      ${row('Mass of A (g)', '÷ molar mass of A<br>× molar mass of A', 'Moles of A', 'b')}
      ${row('Particles of A', '÷ 6.022 × 10<sup>23</sup><br>× 6.022 × 10<sup>23</sup>', 'Moles of A', 'b')}
      ${row('Moles of A', '× coefficient of B<br>÷ coefficient of A', 'Moles of B', 'ab')}
      ${row('Moles of B', '× molar mass of B<br>÷ molar mass of B', 'Mass of B (g)', 'a')}
    </div>
    <p class="lead"><b>Mass to mass:</b> grams A → moles A → moles B → grams B.</p>
    <p class="lead"><b>Limiting reagent:</b> moles of each reactant ÷ its coefficient. The smaller number runs out first.</p>
    <p class="lead"><b>Percent yield</b> = actual ÷ theoretical × 100. Theoretical comes from the limiting reagent only.</p>
    <small>Unit prefixes: 1 mg = 0.001 g, 1 μg = 0.000001 g, 1 kg = 1000 g. Mole ratios are exact numbers, so they never limit significant figures.</small>`;
}
// inline: kept open under practice questions. Only the periodic table; the others are one button away.
const REF_DEFS = [{ k: 'pt', label: 'Periodic table', html: ptHTML, inline: true }, { k: 'ions', label: 'Polyatomic ions', html: ionsHTML }, { k: 'geo', label: 'Molecular geometry', html: geoHTML }, { k: 'mole', label: 'Mole map', html: moleMapHTML }];
// The tables a class has switched on. A class that never chose gets them when it looks like chemistry.
const classRefs = (c = CLASS) => {
  if (!c) return [];
  const on = Array.isArray(c.refs) ? c.refs : /\bchem/i.test(`${c.name} ${c.description}`) ? ['pt', 'ions', 'geo', 'mole'] : [];
  return REF_DEFS.filter((r) => on.includes(r.k));
};

// ---- polyatomic ions in their own colour ----
// Wherever a formula or an ion's name appears in a question, the polyatomic ion is wrapped in a colour so you learn to see it:
// SO4 in Na2SO4, the OH in Ca(OH)2, a free ion like NO3-, and names such as sulfate. Formulas also get subscripts and charges.
const MK_PS = '\u0001', MK_PE = '\u0002', MK_SB = '\u0003', MK_SBE = '\u0004', MK_SP = '\u0005', MK_SPE = '\u0006';
const ELEM = new Set(PT_SYMS);
const ION_BODIES = [...REF_IONS.map(([n, f]) => f.replace(/\^.*$/, '')), 'CH3COO', 'C2H3O2', 'ClO'];
const ION_WORDS = ['hydrogen carbonate', 'dihydrogen phosphate', 'hydrogen phosphate', 'hydrogen sulfate', 'bicarbonate', 'bisulfate', 'ammonium', 'hydronium', 'acetate', 'carbonate', 'cyanide', 'hydroxide',
  'hypochlorite', 'nitrate', 'nitrite', 'phosphate', 'sulfate', 'sulfite', 'chromate', 'dichromate', 'oxalate', 'permanganate'];
const NAME_RE = new RegExp('\\b(' + ION_WORDS.slice().sort((a, b) => b.length - a.length).join('|') + ')s?\\b', 'gi');
const CAT_RE = /^(\(NH4\)\d*|NH4|H3O|Hg|Na|K|Li|Mg|Ca|Ba|Al|Zn|Fe|Cu|Ag|Pb|Sr|Mn|Ni|Co|Cr|Sn|H)(\d*)/;
const ANION_RE = new RegExp('^(?:\\((' + ION_BODIES.slice().sort((a, b) => b.length - a.length).join('|') + ')\\)\\d*|(' + ION_BODIES.slice().sort((a, b) => b.length - a.length).join('|') + '))$');
const nElems = (core) => (core.match(/[A-Z][a-z]?/g) || []).length;
const subs = (t) => t.replace(/([A-Za-z)])(\d+)/g, '$1' + MK_SB + '$2' + MK_SBE);
// A formula may open with its own bracket, "(NH4)2CO3", or sit inside brackets, "(Na2SO4)": try it whole first, then without the bracket.
function markToken(tok) {
  const whole = markTokenWith(tok, /^["'“[]*/);
  if (!tok.startsWith('(') || whole.includes(MK_PS)) return whole;
  const inner = markTokenWith(tok, /^[("'“[]*/);
  return inner.includes(MK_PS) || whole === tok ? inner : whole;
}
function markTokenWith(tok, leadRe) {
  const lead = tok.match(leadRe)[0];
  let rest = tok.slice(lead.length), tail = '';
  const t = rest.match(/^(.*?)((?:\((?:s|l|g|aq)\))?)([.,;:!?"'”\]]*)$/);
  let core = t[1]; tail = t[2] + t[3];
  if (lead.includes('(') && core.endsWith(')') && (core.match(/\(/g) || []).length < (core.match(/\)/g) || []).length) { core = core.slice(0, -1); tail = ')' + tail; }
  let charge = '';
  const c = core.match(/^(.+?)(\^\d*[+-]|[+-])$/);
  if (c) { core = c[1]; charge = c[2].replace('^', ''); }
  if (!/^(?:[A-Z][a-z]?\d*|\((?:[A-Z][a-z]?\d*)+\)\d*)+$/.test(core) || !(core.match(/[A-Z][a-z]?/g) || []).every((e) => ELEM.has(e))) return tok;
  if (/^[+-]$/.test(charge) && /^[A-Z][a-z]?\d$/.test(core)) { charge = core.slice(-1) + charge; core = core.slice(0, -1); } // Ca2+: the digit is the charge
  const sup = charge ? MK_SP + charge.replace('-', '−') + MK_SPE : '';
  let out = '', marked = false;
  if (ION_BODIES.includes(core) && (charge || nElems(core) >= 2)) { out = MK_PS + subs(core) + sup + MK_PE; marked = true; } // an ion on its own
  else {
    const cm = core.match(CAT_RE);
    if (cm) {
      const r = core.slice(cm[0].length), am = r ? r.match(ANION_RE) : null, catPoly = /NH4|H3O/.test(cm[1]), ion = am ? am[1] || am[2] : '';
      if (!(am && cm[1] === 'H' && ['CN', 'OH', 'OCl', 'ClO'].includes(ion)) && (am || catPoly)) { // HCN and friends are molecules, not an ion
        out = subs((catPoly ? MK_PS + cm[0] + MK_PE : cm[0]) + (am ? MK_PS + r + MK_PE : r)) + sup; marked = true;
      }
    }
  }
  if (!marked) { if (!charge && !/\d/.test(core)) return tok; out = subs(core) + sup; }
  return lead + out + tail;
}
const markChem = (text) => text.replace(NAME_RE, (w) => MK_PS + w + MK_PE).split(/(\s+)/).map((p) => (!p || /^\s+$/.test(p) ? p : markToken(p))).join('');
const unmark = (h) => h.replace(/\u0001/g, '<span class="poly">').replace(/\u0002/g, '</span>').replace(/\u0003/g, '<sub>').replace(/\u0004/g, '</sub>').replace(/\u0005/g, '<sup>').replace(/\u0006/g, '</sup>');
// A question's text as it is shown: cleaned, formatted for the subject, and for classes with reference tables the formulas are
// laid out and the polyatomic ions coloured.
const fmtMath = (s) => {
  const t = repairPdfText(cleanGlyphs(String(s))); // text stored before the repair at upload still shows "K2SO4", not "K 2 SO 4"
  return classRefs().length ? unmark(PACK.fmt(markChem(t))) : PACK.fmt(t);
};

// Buttons that open a table over the page.
const refChipsHTML = () => classRefs().map((r) => `<button class="link" data-act="ref" data-k="${r.k}">${r.label}</button>`).join('');
// The tables kept open under a practice question (each can be folded away; the choice is remembered).
const refIsOpen = (k) => { try { return localStorage.getItem('cq-ref-' + k) !== '0'; } catch (e) { return true; } };
const refPanelHTML = () => classRefs().filter((r) => r.inline).map((r) => `<details class="inlineref" data-refk="${r.k}" ${refIsOpen(r.k) ? 'open' : ''}><summary>${r.label}</summary>${r.html()}</details>`).join('');
// Hovering (or tapping) an element shows its name and mass above the table it is in.
function refHover(e) {
  const c = e.target.closest && e.target.closest('.ptc[data-z]');
  const box = c && (c.closest('.inlineref, #ovbody') || document).querySelector('.ptinfo');
  if (c && c.dataset.z && box) { box.textContent = ptInfo(+c.dataset.z); return true; }
  return false;
}
app.addEventListener('mouseover', refHover);
app.addEventListener('click', refHover);
app.addEventListener('toggle', (e) => { const k = e.target.dataset && e.target.dataset.refk; if (k) { try { localStorage.setItem('cq-ref-' + k, e.target.open ? '1' : '0'); } catch (err) { /* not remembered */ } } }, true);
