// Reference overlay: a full periodic table (with A-group labels = valence electrons) and the 16 polyatomic ions.
// It opens on top of whatever you are doing, so a question in progress is never lost.
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
function ionsHTML() {
  return `<p class="lead">The 16 you need to know. Chromate, dichromate, oxalate, and permanganate are not required.</p><div class="reftable">${IONS.map((i) => `<div><b>${i.name}</b>${(i.altNames || []).length ? ` <small>(${i.altNames.join(', ')})</small>` : ''}</div><div class="mono">${ionHTML(i)}</div>`).join('')}</div>`;
}
