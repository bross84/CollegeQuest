// Earlier material: skills from the first chapters that Exam 2 problems still lean on. Not "core", so they fill the quest's variety slots.
const ZE = 'Earlier material';
function sigCount(s) {
  s = s.split(' x ')[0].replace('-', '');
  const dot = s.includes('.');
  let d = s.replace('.', '').replace(/^0+/, '');
  if (!dot) d = d.replace(/0+$/, '');
  return d.length;
}
const UNITS = { length: { km: 1e3, m: 1, cm: 1e-2, mm: 1e-3 }, mass: { kg: 1e3, g: 1, mg: 1e-3 }, volume: { L: 1, mL: 1e-3 } };

SKILLS.push(
{
  id: 'sigfigs', zone: ZE, glyph: 'SF', name: 'Significant figures',
  rule: 'Nonzero digits always count. Zeros between digits count. Leading zeros never count. Trailing zeros count only if there is a decimal point.',
  tip: 'Start at the first nonzero digit and count to the end. Zeros before it are placeholders. Zeros at the end count only when the number has a decimal point (1200 has 2, 1200. has 4). In scientific notation, count only the first part.',
  video: 'counting significant figures rules',
  gen() {
    const pats = [
      () => `0.00${R(1, 9)}${R(0, 9)}${R(1, 9)}`, () => `${R(1, 9)}${R(1, 9)}00`, () => `${R(1, 9)}${R(1, 9)}${R(1, 9)}0.`, () => `${R(1, 9)}.${R(0, 9)}0`,
      () => `${R(1, 9)}0${R(1, 9)}0`, () => `0.${R(1, 9)}${R(1, 9)}0`, () => `${R(1, 9)}.${R(1, 9)}0${R(1, 9)} x 10^${R(2, 6)}`,
    ];
    const s = pick(pats)(), n = sigCount(s), shown = s.replace(/ x 10\^(\d+)/, ' × 10<sup>$1</sup>');
    return { q: `How many significant figures are in <b>${shown}</b>?`, type: 'num', answer: n, tol: 0, wrongs: [n + 1, n - 1, n + 2, n - 2],
      steps: [`Ignore leading zeros. Count from the first nonzero digit.`, s.includes('.') || s.includes('x') ? 'There is a decimal point, so trailing zeros count.' : 'No decimal point, so trailing zeros do not count.', `<b>${n}</b> significant figures`] };
  },
},
{
  id: 'unitconv', zone: ZE, glyph: 'a→b', name: 'Unit conversions',
  rule: 'Multiply by conversion factors so the units you do not want cancel. Metric: kilo = 1000, centi = 0.01, milli = 0.001.',
  tip: 'Write the starting number with its unit, then multiply by a fraction that has the unit you want on top and the unit you are leaving on the bottom. For tiny or huge answers use scientific notation, like 2.5e-3.',
  video: 'dimensional analysis metric unit conversion',
  gen() {
    const fam = UNITS[pick(Object.keys(UNITS))], [a, b] = shuffle(Object.keys(fam)).slice(0, 2), x = pick([dec(1, 99), dec(100, 999, 0), dec(0.1, 9.9)]);
    const ans = (x * fam[a]) / fam[b], per = fam[a] / fam[b];
    return { q: `Convert ${x} ${a} to ${b}.<br><small>Scientific notation is fine (e notation works).</small>`, type: 'num', answer: ans, tol: 0.01, wrongs: [ans * 10, ans / 10, ans * 1000, ans / 1000, ans * 100],
      steps: [`1 ${a} = ${per} ${b}.`, `${x} ${a} × (${per} ${b} / 1 ${a}) = <b>${+ans.toPrecision(4)} ${b}</b>`] };
  },
},
);
