// What the engine needs to know about this subject. Must be last: it returns the pack.
SKILLS.forEach((s) => { s.core = true; });
const zones = [...new Set(SKILLS.map((s) => s.zone))];
return {
  id: 'algebra',
  skills: SKILLS,
  zones,
  ranks: ['Rookie', 'Sign Spotter', 'Equation Tamer', 'Factor Finder', 'Quadratic Knight', 'Function Wizard', 'Log Lord', 'Calc-Ready'],
  coreName: 'the whole map',
  coreTitle: 'Skills map',
  baseTitle: '',
  hasChoiceMode: false,
  absTol: 0.006,
  badInput: 'I couldn’t read that. Try a number like 3, −2, or 3/4.',
  ph: { list: 'e.g. 2, -5', pair: 'e.g. 3, -1', num: 'your answer' },
  fmt: (s) => esc(s).replace(/\^(\([^)]*\)|-?\w+)/g, (m, e) => `<sup>${e.replace(/^\(|\)$/g, '')}</sup>`).replace(/sqrt\(/g, '√('),
  answerText(p) {
    if (p.type === 'num') return showNum(p.answer);
    return p.type === 'pair' ? `x = ${showNum(p.answer[0])}, y = ${showNum(p.answer[1])}` : p.answer.map(showNum).join(', ');
  },
  refs: [],
  tutor: { role: 'math', style: 'Name the procedure or rule to apply (for example "distribute the negative" or "zero-product property"), not the theory behind it. The goal is procedural fluency to pass.' },
  ask: { format: 'Plain text only; use ^ for exponents and sqrt() for roots.', extra: '', example: 'e.g. Why do I flip the sign here?' },
  add: { example: 'e.g. Solve 2x^2 - 5x - 3 = 0', hint: 'Type exponents with ^ (x^2), fractions with /, roots as sqrt(9).', key: 'e.g. 3, -1/2' },
  transcribe: 'Transcribe the math problem in this photo as plain text. Use ^ for exponents, / for fractions, sqrt() for roots. Reply with only the problem text.',
  finder: '^ for exponents, / for fractions, sqrt() for roots, keep any given values or tables',
  videoWord: 'algebra',
};
