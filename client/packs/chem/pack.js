// What the engine needs to know about this subject. Must be last: it returns the pack.
// Which reference to keep open under a practice problem: the periodic table for anything that needs masses, groups or
// charges, the ion list for polyatomic-ion skills, nothing for the rest (balancing, solubility, ...).
const WITH_TABLE = new Set(['valelec', 'lewis', 'geometry', 'bondangle', 'molname', 'bondbasics', 'ioncharge', 'oxnum', 'redox', 'molmass', 'moleconv', 'avogadro', 'stoich', 'limiting']);
const WITH_IONS = new Set(['ionformula', 'ionname', 'ioncompound']);
const refHover = (e) => {
  const c = e.target.closest && e.target.closest('.ptc[data-z]');
  const box = c && (c.closest('.inlineref, #ovbody') || document).querySelector('.ptinfo');
  if (c && c.dataset.z && box) { box.textContent = ptInfo(+c.dataset.z); return true; }
  return false;
};
return {
  id: 'chem',
  skills: SKILLS,
  zones: ZONES,
  normF,
  normT,
  ranks: ['Lab Rookie', 'Goggles On', 'Mole Counter', 'Bond Builder', 'Equation Balancer', 'Reaction Tamer', 'Stoichiometer', 'Exam Ready'],
  coreName: 'the core material',
  coreTitle: 'Core material',
  baseTitle: 'Earlier material',
  hasChoiceMode: true,
  looseUnits: true, // a typed number may be followed by a unit
  checkShape,
  badInput: 'I couldn’t read that. Try a number like 3, −2, 0.25, or 3.5e23.',
  ph: { list: 'e.g. 2, -5', pair: 'e.g. 3, -1', seq: 'e.g. 2, 1, 2', text: 'type the name', formula: 'e.g. Ca(NO3)2 or SO4 2-', num: 'your answer' },
  fmt: (s) => esc(s).replace(/([A-Za-z)])(\d+)/g, '$1<sub>$2</sub>').replace(/\^(\([^)]*\)|-?\w+)/g, (m, e) => `<sup>${e.replace(/^\(|\)$/g, '')}</sup>`).replace(/sqrt\(/g, '√('),
  refs: [{ k: 'pt', label: 'Periodic table', html: ptHTML }, { k: 'ions', label: 'Polyatomic ions', html: ionsHTML }],
  refHover,
  inlineRef: (skillId) => (WITH_TABLE.has(skillId) ? 'pt' : WITH_IONS.has(skillId) ? 'ions' : null),
  homeworkRef: 'pt',
  tutor: { role: 'chemistry', style: 'Name the procedure or rule to apply (for example "convert grams to moles first" or "balance the O last"). The goal is exam-ready procedural fluency.' },
  ask: {
    format: 'Write chemical formulas like H2SO4 and charges like SO4^2-.',
    extra: 'Whenever you name a molecular geometry, give its bond angle in the same sentence, and whenever you give a bond angle, name the geometry.',
    example: 'e.g. Why is the coefficient 2 and not 3?',
  },
  add: { example: 'e.g. How many grams of NaCl are in 0.50 mol?', hint: 'Write formulas like H2SO4 and charges like SO4^2-. Use ^ for exponents.', key: 'e.g. 29.2' },
  transcribe: 'Transcribe the chemistry problem in this photo as plain text. Write formulas like H2SO4 and Ca(OH)2 and charges like SO4^2-. Reply with only the problem text.',
  finder: 'plain-text formulas like H2SO4 and Ca(OH)2 (no subscripts), keep any given values, masses or tables',
  videoWord: 'chemistry',
};
