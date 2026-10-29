// Solubility rules, precipitation reactions, full ionic and net ionic equations (Chapter 5.3, 5.4, 5.7).
// Reactions are built at the ion level, so every atom and charge balances by construction.
const ZIC = 'Reactions';
const ICAT = [...['Na', 'K', 'Li', 'Mg', 'Ca', 'Ba', 'Al', 'Zn'].map((f) => CATIONS.find((x) => x.f === f)), IONS.find((x) => x.name === 'ammonium'),
  { name: 'silver', f: 'Ag', c: 1 }, { name: 'lead(II)', f: 'Pb', c: 2 }, CATIONS.find((x) => x.f === 'Cu')].map((o) => ({ ...o, poly: o.f === 'NH4' }));
const IAN = [...['chloride', 'bromide'].map((n) => SIMPLE_ANIONS.find((x) => x.name === n)), { name: 'iodide', f: 'I', c: -1 }, SIMPLE_ANIONS.find((x) => x.name === 'sulfide'),
  ...['nitrate', 'sulfate', 'hydroxide', 'carbonate', 'phosphate', 'acetate'].map((n) => IONS.find((x) => x.name === n))].map((o) => ({ ...o, poly: IONS.some((i) => i.f === o.f) }));
const H_ION = { name: 'hydrogen', f: 'H', c: 1 }, OH_ION = { ...IONS.find((x) => x.name === 'hydroxide'), poly: true };

// The book's guidelines (Table 5.1). Returns { s: soluble?, why }.
function soluble(cat, an) {
  const c = cat.f, a = an.f;
  if (['Li', 'Na', 'K', 'NH4'].includes(c)) return { s: true, why: `${c === 'NH4' ? 'Ammonium' : 'Group 1A'} compounds are always soluble.` };
  if (['NO3', 'ClO4', 'CH3CO2'].includes(a)) return { s: true, why: `${a === 'NO3' ? 'Nitrates' : 'Acetates'} are always soluble.` };
  if (['Cl', 'Br', 'I'].includes(a)) return ['Ag', 'Hg2', 'Pb'].includes(c) ? { s: false, why: `Halides are soluble except with Ag⁺, Hg₂²⁺, and Pb²⁺, so ${fml(cat, an).name} is insoluble.` } : { s: true, why: 'Chlorides, bromides, and iodides are soluble (except with Ag⁺, Hg₂²⁺, Pb²⁺).' };
  if (a === 'SO4') return ['Ba', 'Hg2', 'Pb'].includes(c) ? { s: false, why: 'Sulfates are soluble except with Ba²⁺, Hg₂²⁺, and Pb²⁺.' } : { s: true, why: 'Sulfates are soluble (except with Ba²⁺, Hg₂²⁺, Pb²⁺).' };
  return { s: false, why: 'It has none of the soluble ions on the list, so it is probably insoluble.' };
}
// Cases where textbooks and exams disagree (Ag2SO4, Ca(OH)2 and Ba(OH)2): left out so the answer is never debatable.
const amb = (cat, an) => (cat.f === 'Ag' && an.f === 'SO4') || (['Ca', 'Ba'].includes(cat.f) && an.f === 'OH');
const fml = (cat, an) => compound(cat, an, cat.poly, an.poly);
const cnt = (cat, an) => { const a = Math.abs(an.c), g = gcd(cat.c, a); return { nc: a / g, na: cat.c / g }; };
const sup = (ion) => fm(`${ion.f}^${chg(ion.c)}`);

// Terms: { k: coefficient, f: species, ch: charge (0 for a compound), st: state }.
const tm = (k, f, ch, st) => ({ k, f, ch, st });
const tText = (t) => `${t.k > 1 ? t.k + ' ' : ''}${fm(t.ch ? `${t.f}^${chg(t.ch)}` : t.f)}(${t.st})`;
const sideText = (ts) => ts.map(tText).join(' + ');
const eqText = (L, Rr) => `${sideText(L)} → ${sideText(Rr)}`;

// A species spec is { cat, an, st } (ionic) or { f, st } (like water). Returns a reaction with balanced coefficients.
function buildRx(reacts, prods) {
  const mk = (s) => (s.cat ? { ...s, f: fml(s.cat, s.an).f, ...cnt(s.cat, s.an) } : { ...s });
  const re = reacts.map(mk), pr = prods.map(mk), co = balance(re.map((s) => s.f), pr.map((s) => s.f));
  if (!co) return null;
  re.forEach((s, i) => { s.k = co[i]; }); pr.forEach((s, i) => { s.k = co[re.length + i]; });
  return { re, pr };
}
const molTerms = (rx) => [rx.re.map((s) => tm(s.k, s.f, 0, s.st)), rx.pr.map((s) => tm(s.k, s.f, 0, s.st))];
// Full ionic equation. Flags make the common wrong versions: splitSolid, keepSoluble, splitWater, keepAcid, noMult.
function fullTerms(rx, f = {}) {
  const side = (sp, isProd) => sp.flatMap((s) => {
    if (s.f === 'H2O' && f.splitWater) return [tm(s.k, 'H', 1, 'aq'), tm(s.k, 'OH', -1, 'aq')];
    const ionic = !!(s.cat && s.an);
    const split = ionic && (s.st === 'aq' ? !(f.keepSoluble && isProd) && !(f.keepAcid && !isProd && s.acid) : !!f.splitSolid);
    if (!split) return [tm(s.k, s.f, 0, s.st)];
    const m = f.noMult ? [s.k, s.k] : [s.k * s.nc, s.k * s.na];
    return [tm(m[0], s.cat.f, s.cat.c, 'aq'), tm(m[1], s.an.f, s.an.c, 'aq')];
  });
  return [side(rx.re, false), side(rx.pr, true)];
}
function netTerms(rx) {
  if (rx.kind === 'acid') return [[tm(1, 'H', 1, 'aq'), tm(1, 'OH', -1, 'aq')], [tm(1, 'H2O', 0, 'l')]];
  const P = rx.pr.find((s) => s.st === 's');
  return [[tm(P.nc, P.cat.f, P.cat.c, 'aq'), tm(P.na, P.an.f, P.an.c, 'aq')], [tm(1, P.f, 0, 's')]];
}
const spectators = (rx) => (rx.kind === 'acid' ? [rx.base.cat, rx.acid.an] : (() => { const S_ = rx.pr.find((s) => s.st === 'aq'); return [S_.cat, S_.an]; })());

// kind: 'precip' (exactly one insoluble product), 'none' (both products soluble), 'acid'.
function precipRx(want) {
  for (let n = 0; n < 400; n++) {
    const [c1, c2] = shuffle(ICAT).slice(0, 2), [a1, a2] = shuffle(IAN).slice(0, 2);
    if ([[c1, a1], [c2, a2], [c1, a2], [c2, a1]].some(([c, a]) => amb(c, a))) continue;
    if (!soluble(c1, a1).s || !soluble(c2, a2).s) continue;
    const s1 = soluble(c1, a2).s, s2 = soluble(c2, a1).s;
    if (want === 'none' ? !(s1 && s2) : s1 === s2) continue;
    const rx = buildRx([{ cat: c1, an: a1, st: 'aq' }, { cat: c2, an: a2, st: 'aq' }], [{ cat: c1, an: a2, st: s1 ? 'aq' : 's' }, { cat: c2, an: a1, st: s2 ? 'aq' : 's' }]);
    if (rx) { rx.kind = want; rx.notes = [`New partners: ${fm(rx.pr[0].f)} and ${fm(rx.pr[1].f)}.`, ...rx.pr.map((s) => `${fm(s.f)}: ${soluble(s.cat, s.an).why}`)]; return rx; }
  }
}
function acidRx() {
  for (let n = 0; n < 200; n++) {
    const an = pick(['chloride', 'bromide', 'nitrate', 'sulfate']).valueOf(), A = IAN.find((x) => x.name === an), M = pick(['Na', 'K', 'Li', 'Ca', 'Ba']), cat = ICAT.find((x) => x.f === M);
    if (!soluble(cat, A).s) continue;
    const rx = buildRx([{ cat: H_ION, an: A, st: 'aq', acid: true }, { cat, an: OH_ION, st: 'aq' }], [{ cat, an: A, st: 'aq' }, { f: 'H2O', st: 'l' }]);
    if (rx) { rx.kind = 'acid'; rx.acid = rx.re[0]; rx.base = rx.re[1]; rx.notes = ['Acid + base → salt + water.', 'The acid and the base are strong, so they are written as ions.']; return rx; }
  }
}
const anyRx = () => (R(0, 9) < 4 ? acidRx() : precipRx('precip'));
const ionList = (rx) => spectators(rx).map(sup).join(' and ');

SKILLS.push(
{
  id: 'solubility', zone: ZIC, core: true, glyph: 'sol', name: 'Solubility rules',
  rule: 'Soluble: group 1A and NH₄⁺ compounds; nitrates, acetates, perchlorates; chlorides, bromides, iodides (except Ag⁺, Hg₂²⁺, Pb²⁺); sulfates (except Ba²⁺, Hg₂²⁺, Pb²⁺). Everything else is probably insoluble.',
  tip: 'Check the cation first (Li, Na, K, NH₄ always soluble), then the anion (NO₃, acetate, halides, sulfate), and remember the exceptions. If it matches none of them, it is insoluble: carbonates, phosphates, sulfides, and hydroxides usually are.',
  video: 'solubility rules for ionic compounds in water',
  gen() {
    const pairs = () => { let c, a; do { c = pick(ICAT); a = pick(IAN); } while (amb(c, a)); return { c, a, r: soluble(c, a) }; };
    if (R(0, 1)) {
      const { c, a, r } = pairs(), f = fml(c, a).f, ans = r.s ? 'Soluble' : 'Insoluble', mm = mc(ans, [r.s ? 'Insoluble' : 'Soluble']);
      return { q: `Is ${fm(f)} soluble or insoluble in water?`, type: 'choice', choices: mm.choices, answer: mm.answer, steps: [r.why, `<b>${ans}</b>`],
        typed: { type: 'text', accept: r.s ? ['Soluble', 'sol'] : ['Insoluble', 'ins', 'insol', 'not soluble'], ph: 'your answer' } };
    }
    const wantSol = R(0, 1) === 1, pool = [];
    for (let n = 0; n < 200 && pool.length < 40; n++) { const p = pairs(); pool.push(p); }
    const good = pool.filter((p) => p.r.s === wantSol), bad = shuffle(pool.filter((p) => p.r.s !== wantSol));
    const one = pick(good), others = [], seen = new Set([fml(one.c, one.a).f]);
    bad.forEach((p) => { const f = fml(p.c, p.a).f; if (others.length < 3 && !seen.has(f)) { seen.add(f); others.push(p); } });
    if (others.length < 3) return this.gen();
    const mm = mc(fm(fml(one.c, one.a).f), others.map((p) => fm(fml(p.c, p.a).f)));
    return { q: `Which of these is <b>${wantSol ? 'soluble' : 'insoluble'}</b> in water?`, type: 'choice', choices: mm.choices, answer: mm.answer, steps: [one.r.why, `<b>${fm(fml(one.c, one.a).f)}</b>`] };
  },
},
{
  id: 'precipitate', zone: ZIC, core: true, glyph: 'ppt', name: 'Predict the precipitate',
  rule: 'Swap the partners to find the two possible products, then check each with the solubility rules. An insoluble product is the precipitate. If both are soluble, there is no reaction.',
  tip: 'Write the two new compounds (cation of one with anion of the other, charges balanced). Look up each one. Whichever is insoluble is the solid; if both are soluble, nothing precipitates.',
  video: 'predicting precipitation reactions solubility rules',
  gen() {
    const rx = precipRx(R(0, 3) === 0 ? 'none' : 'precip'), none = rx.kind === 'none';
    const pf = rx.pr.map((s) => fm(s.f)), NO = 'No precipitate forms', ans = none ? NO : fm(rx.pr.find((s) => s.st === 's').f);
    const mm = mc(ans, none ? [...pf, 'Both products precipitate'] : [pf.find((x) => x !== ans), NO, 'Both products precipitate']);
    return { q: `Aqueous ${fm(rx.re[0].f)} is mixed with aqueous ${fm(rx.re[1].f)}.<br>What precipitates?`, type: 'choice', choices: mm.choices, answer: mm.answer, steps: [...rx.notes, `<b>${ans}</b>`] };
  },
},
{
  id: 'fullionic', zone: ZIC, core: true, glyph: 'ionic', name: 'Full ionic equations',
  rule: 'Write every dissolved ionic compound (aq) and every strong acid or base as separate ions, multiplying by the subscripts and coefficients. Solids (s), liquids (l), and gases stay as whole formulas.',
  tip: 'Take each (aq) compound apart: 2 NaNO₃ becomes 2 Na⁺ + 2 NO₃⁻. Keep precipitates and water as full formulas. The full ionic equation has the same atoms and the same total charge on both sides.',
  video: 'how to write complete ionic equations',
  gen() {
    const rx = anyRx(), ac = rx.kind === 'acid', good = eqText(...fullTerms(rx));
    const wrongs = [eqText(...fullTerms(rx, ac ? { splitWater: true } : { splitSolid: true })), eqText(...fullTerms(rx, ac ? { keepAcid: true } : { keepSoluble: true })), eqText(...fullTerms(rx, { noMult: true })), eqText(...netTerms(rx))];
    const mm = mc(good, wrongs);
    return { q: `${eqText(...molTerms(rx))}<br>Which is the full ionic equation?`, type: 'choice', choices: mm.choices, answer: mm.answer,
      steps: [...rx.notes, `Split each (aq) ionic compound into ions, multiplying by its coefficient and subscripts. Keep ${ac ? 'water' : 'the precipitate'} whole.`, `<b>${good}</b>`] };
  },
},
{
  id: 'netionic', zone: ZIC, core: true, glyph: 'net', name: 'Net ionic equations',
  rule: 'Write the full ionic equation, cross out the spectator ions (the ones that appear unchanged on both sides), and reduce the coefficients to the lowest whole numbers. The result must balance in atoms and in charge.',
  tip: 'What is left after you cancel the spectators? For a precipitation reaction, the ions that make the solid. For an acid-base reaction, H⁺ + OH⁻ → H₂O. Check that the charge adds up the same on both sides.',
  video: 'how to write net ionic equations',
  gen() {
    const rx = anyRx(), ac = rx.kind === 'acid', [L, Rr] = netTerms(rx), good = eqText(L, Rr);
    const dbl = eqText(L.map((t) => ({ ...t, k: t.k * 2 })), Rr.map((t) => ({ ...t, k: t.k * 2 })));
    const sp = spectators(rx), spec = `${sp[0].f ? '' : ''}${sideText([tm(1, sp[0].f, sp[0].c, 'aq'), tm(1, sp[1].f, sp[1].c, 'aq')])} → ${fm(compound(sp[0], sp[1], sp[0].poly, sp[1].poly).f)}(aq)`;
    const wrongPhase = ac ? eqText(Rr, L) : eqText(L, Rr.map((t) => ({ ...t, st: 'aq' })));
    const mm = mc(good, shuffle([eqText(...fullTerms(rx)), dbl, spec, wrongPhase, eqText(...molTerms(rx))]));
    return { q: `${eqText(...molTerms(rx))}<br>Which is the net ionic equation?`, type: 'choice', choices: mm.choices, answer: mm.answer,
      steps: [`Full ionic: ${eqText(...fullTerms(rx))}`, `Spectator ions (unchanged on both sides): ${ionList(rx)}.`, `<b>${good}</b>`] };
  },
},
{
  id: 'spectators', zone: ZIC, core: true, glyph: 'spec', name: 'Spectator ions',
  rule: 'A spectator ion appears unchanged on both sides of the full ionic equation. Ions that end up in a solid or in water are not spectators.',
  tip: 'Find the ions that leave the solution (they form the precipitate) or combine into water. The ions that are left over, still dissolved on both sides, are the spectators.',
  video: 'spectator ions in net ionic equations',
  gen() {
    const rx = anyRx(), sp = spectators(rx), react = rx.kind === 'acid' ? [H_ION, OH_ION] : (() => { const P = rx.pr.find((s) => s.st === 's'); return [P.cat, P.an]; })();
    const good = ionList(rx);
    const lbl = (a, b) => `${sup(a)} and ${sup(b)}`;
    const mm = mc(good, [lbl(...react), lbl(react[0], sp[1]), lbl(sp[0], react[1])]);
    return { q: `${eqText(...molTerms(rx))}<br>Which ions are the spectator ions?`, type: 'choice', choices: mm.choices, answer: mm.answer,
      steps: [`Full ionic: ${eqText(...fullTerms(rx))}`, `${ionList(rx)} appear unchanged on both sides.`, `<b>${good}</b>`] };
  },
},
);
