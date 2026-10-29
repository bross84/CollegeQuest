// Polyatomic ions: name, formula, charge, and how they combine into compounds.
const ZI = 'Polyatomic ions';
const TYPE_TIP = 'Type the formula and charge any way you like: SO4 2-, SO4^2-, or SO42-.';
const pickIon = () => pick(IONS);
// The ions most easily confused with `i` (shared elements, same charge) make the best wrong answers.
const simIons = (i) => IONS.filter((x) => x !== i).map((x) => ({ x, s: Object.keys(parseFormula(x.f)).filter((e) => e in parseFormula(i.f)).length * 2 + (x.c === i.c ? 1 : 0) + Math.random() })).sort((a, b) => b.s - a.s).slice(0, 5).map((o) => o.x);

SKILLS.push(
{
  id: 'ionformula', zone: ZI, core: true, glyph: 'name→f', name: 'Ion name to formula',
  rule: 'Memorize the formula AND the charge together. Same family, same charge: sulfate and sulfite are both 2−, but sulfate has one more O.',
  tip: `${TYPE_TIP} The -ate ion has one more oxygen than the -ite ion. Hypo- and per- go one oxygen below and above.`,
  video: 'polyatomic ions names formulas charges memorize',
  gen() {
    const i = pickIon(), shown = ionHTML(i);
    return { q: `Write the formula and charge of the <b>${i.name}</b> ion.<br><small>Include the charge, with plain digits for subscripts.</small>`, type: 'formula', accept: ionAccepted(i), shown, wrongs: simIons(i).map(ionHTML),
      steps: [`${i.name} is <b>${shown}</b>.`, `Charge ${i.c > 0 ? '+' : '−'}${Math.abs(i.c)}.`] };
  },
},
{
  id: 'ionname', zone: ZI, core: true, glyph: 'f→name', name: 'Ion formula to name',
  rule: 'Match the formula to its name. The -ate ion has one more oxygen than the -ite ion. A hydrogen at the front adds “hydrogen” to the name.',
  tip: 'Look at the central atom and the number of oxygens. Compare with a pair you know: nitrate NO₃⁻ has one more O than nitrite NO₂⁻. Spelling counts, but capitals do not.',
  video: 'naming polyatomic ions ate ite rules',
  gen() {
    const i = pickIon();
    return { q: `Name this ion: ${ionHTML(i)}`, type: 'text', accept: ionNames(i), wrongs: simIons(i).map((x) => x.name), steps: [`${ionHTML(i)} is the <b>${i.name}</b> ion.`] };
  },
},
{
  id: 'ioncharge', zone: ZI, core: true, glyph: '±', name: 'Ion charges',
  rule: 'Every polyatomic ion has a fixed charge. Ammonium is the only common positive one; most others are 1−, 2−, or 3−.',
  tip: 'Enter just the number with its sign, like -2 or 1. Phosphate is the only common 3− here. Adding a hydrogen to an ion raises its charge by 1 (PO₄³⁻ → HPO₄²⁻ → H₂PO₄⁻).',
  video: 'polyatomic ion charges how to remember',
  gen() {
    const i = pickIon();
    if (R(0, 1)) return { q: `What is the charge of the <b>${i.name}</b> ion?<br><small>Include the sign for negative charges.</small>`, type: 'num', answer: i.c, tol: 0, wrongs: [-3, -2, -1, 1, 2], fmtAns: ox, steps: [`${i.name} is ${ionHTML(i)}: charge <b>${i.c > 0 ? '+' : '−'}${Math.abs(i.c)}</b>.`] };
    const wrong = shuffle(IONS.filter((x) => x.c !== i.c)).slice(0, 3).map((x) => ionHTML(x)), ans = ionHTML(i);
    const m = mc(ans, wrong);
    return { q: `Which of these has a charge of ${i.c > 0 ? '+' : '−'}${Math.abs(i.c)}?`, type: 'choice', choices: m.choices, answer: m.answer,
      steps: [`${ans} has charge ${i.c > 0 ? '+' : '−'}${Math.abs(i.c)}.`] };
  },
},
{
  id: 'ioncompound', zone: ZI, core: true, glyph: 'Ca(NO₃)₂', name: 'Compounds with polyatomic ions',
  rule: 'Charges must add to zero. Criss-cross the charges to get subscripts, and put parentheses around a polyatomic ion that appears more than once.',
  tip: 'Balance the charges: Ca²⁺ needs two NO₃⁻, so the formula is Ca(NO₃)₂. Never change the formula inside the ion. Name = cation name + ion name. Type formulas like Ca(NO3)2.',
  video: 'writing formulas for ionic compounds with polyatomic ions',
  gen() {
    const polyCat = R(0, 4) === 0, cat = polyCat ? IONS.find((x) => x.name === 'ammonium') : pick(CATIONS), an = polyCat ? pick(IONS.filter((x) => x.c < 0)) : (R(0, 5) === 0 ? pick(SIMPLE_ANIONS) : pick(IONS.filter((x) => x.c < 0)));
    const polyAn = IONS.includes(an), cmp = compound(cat, an, polyCat, polyAn);
    const names = [cmp.name]; (an.altNames || []).forEach((n) => names.push(`${cat.name} ${n}`));
    const steps = [`${cat.name}: ${ionHTML(cat)}; ${an.name}: ${ionHTML(an)}.`, `Balance the charges so the total is 0.`];
    if (R(0, 1)) return { q: `Write the formula for <b>${cmp.name}</b>.<br><small>Write the formula with plain digits for subscripts.</small>`, type: 'formula', accept: [normF(cmp.f)], shown: fm(cmp.f), wrongs: ((a_, g_) => { const nc = a_ / g_, na = cat.c / g_; return [ionUnit(cat, 1, polyCat) + ionUnit(an, 1, polyAn), ionUnit(cat, na, polyCat) + ionUnit(an, nc, polyAn), cat.f + (nc > 1 ? nc : '') + an.f + (na > 1 ? na : ''), ionUnit(cat, 2, polyCat) + ionUnit(an, 1, polyAn), ionUnit(cat, 1, polyCat) + ionUnit(an, 2, polyAn), ionUnit(cat, 2, polyCat) + ionUnit(an, 2, polyAn)].map(fm).filter((s) => s !== fm(cmp.f)); })(Math.abs(an.c), gcd(cat.c, Math.abs(an.c))), steps: [...steps, `<b>${fm(cmp.f)}</b>`] };
    const accept = names.concat(cat.alt ? names.map((n) => n.replace(cat.name, cat.alt)) : []);
    return { q: `Name this compound: ${fm(cmp.f)}`, type: 'text', accept, wrongs: [...shuffle([...IONS.filter((x) => x.c < 0), ...SIMPLE_ANIONS].filter((x) => x !== an)).slice(0, 2).map((x) => `${cat.name} ${x.name}`), `${pick(CATIONS.filter((x) => x !== cat)).name} ${an.name}`], steps: [...steps, `<b>${cmp.name}</b>`] };
  },
},
);
