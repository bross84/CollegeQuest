// The deterministic reading of exam text: options vs parts, answer keys, and subscript/exponent repair.
// Fixtures are the user's real exam text as the PDF extractor gives it.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { repairPdfText, parseOptions, readQuestion, parseAnswerKey, partKeys, stripQNumber, QT_SYMS } = require('../server/qtext');
const { cleanGlyphs } = require('../server/docs');

const Q1 = 'Question 1:A chemical bond formed when two atoms share one pair of electrons is a ________ bond; it is best described as _________. a)Single; Covalentc) Single; Ionic b)Double; Covalentd) Double; Ionic';
const Q7 = 'Question 7:The reaction 2 AgNO 3 (aq) + K 2 SO 4 (aq) → 2 KNO 3 (aq) + Ag 2 SO 4 (s) is an example of a(an) ________ reaction. a)Additivec) Acid-Base b)Oxidation-Reductiond) Precipitation';
const Q11 = 'Question 11:42.0 g Cl 2 contains ________ molecules of Cl 2 . a)3.57 x 10 23 c) 1.78 x 10 23 b)0.592d) 9.22 x 10 24';
const Q9 = 'Question 9:When the reaction shown below is correctly balanced , the coefficients are: Li (s) + Br 2 (l) [glyph] LiBr a)1, 1, 1c) 1, 2, 2 b)2, 1, 3d) 2, 1, 2';
const Q2 = 'Question 2: Classify each of the following as a precipitation, an acid-base neutralization, or a redox reaction. (a) AgNO3(aq) + KCl(aq) -> AgCl(s) + KNO3(aq) (b) 2 Al(s) + 3 Br2(l) -> 2 AlBr3(s) (c) Ca(OH)2(aq) + 2 HNO3(aq) -> 2 H2O(l) + Ca(NO3)2(aq)';
const Q16 = 'Question 16: For the following number, indicate the number of significant figures and then place into scientific notation: Number / Significant Figures / Scientific Notation / 9004____ / 0.00660____ / 22000____';
const Q16L = 'Question 16: For the following number, indicate the number of significant figures and then place into scientific notation: Number / Significant Figures / Scientific Notation / a) 9004____ b) 0.00660____ c) 22000____ d) 0.0310____';
const Q3 = 'Question 3: For the following equation: Mg(OH)2(aq) + 2 HCl(aq) -> MgCl2(aq) + 2 H2O(l)  a) Write the full ionic equation  b) Write the net ionic equation';

test('multiple-choice questions from the exam PDF come out as four options in a, b, c, d order', () => {
  const q1 = readQuestion({ text: Q1 });
  assert.deepStrictEqual(q1, { text: 'A chemical bond formed when two atoms share one pair of electrons is a ________ bond; it is best described as _________.', format: 'mc', choices: ['Single; Covalent', 'Double; Covalent', 'Single; Ionic', 'Double; Ionic'], answer: '', ref: '1' });
  const q7 = readQuestion({ text: Q7 });
  assert.strictEqual(q7.format, 'mc');
  assert.strictEqual(q7.text, 'The reaction 2 AgNO3 (aq) + K2SO4 (aq) → 2 KNO3 (aq) + Ag2SO4 (s) is an example of a(an) ________ reaction.');
  assert.deepStrictEqual(q7.choices, ['Additive', 'Oxidation-Reduction', 'Acid-Base', 'Precipitation']);
  assert.strictEqual(q7.ref, '7');
  const q11 = readQuestion({ text: Q11 });
  assert.strictEqual(q11.text, '42.0 g Cl2 contains ________ molecules of Cl2 .');
  assert.deepStrictEqual(q11.choices, ['3.57 x 10^23', '0.592', '1.78 x 10^23', '9.22 x 10^24']);
  const q9 = readQuestion({ text: Q9 });
  assert.strictEqual(q9.format, 'mc');
  assert.strictEqual(q9.text, 'When the reaction shown below is correctly balanced , the coefficients are: Li (s) + Br2 (l) [glyph] LiBr');
  assert.deepStrictEqual(q9.choices, ['1, 1, 1', '2, 1, 3', '1, 2, 2', '2, 1, 2']);
  const glyph = readQuestion({ text: cleanGlyphs(Q9.replace('[glyph]', '')) });
  assert.strictEqual(glyph.text, 'When the reaction shown below is correctly balanced , the coefficients are: Li (s) + Br2 (l) → LiBr');
  assert.strictEqual(glyph.choices.length, 4);
});

test('the parser wins over an AI that left the options in the text or miscounted them', () => {
  const r = readQuestion({ number: 'Question 1', text: Q1, format: 'work', choices: [] });
  assert.strictEqual(r.format, 'mc'); assert.strictEqual(r.ref, '1');
  const miscount = readQuestion({ number: '7', text: Q7, format: 'mc', choices: ['Additive', 'Acid-Base'] });
  assert.deepStrictEqual(miscount.choices, ['Additive', 'Oxidation-Reduction', 'Acid-Base', 'Precipitation']);
  // the AI split the options itself but kept their letters in column order
  const cols = readQuestion({ text: 'Which is a noble gas?', format: 'mc', choices: ['a) Ne', 'c) Na', 'b) N', 'd) Ni'] });
  assert.deepStrictEqual(cols.choices, ['Ne', 'N', 'Na', 'Ni']);
});

test('multi-part written questions are never read as multiple choice', () => {
  const q16 = readQuestion({ text: Q16, format: 'mc', choices: ['9004', '0.00660', '22000'] });
  assert.strictEqual(q16.format, 'parts');
  assert.deepStrictEqual(q16.choices, ['9004', '0.00660', '22000']);
  assert.match(q16.text, /^For the following number, indicate .* Scientific Notation$/);
  const q16l = readQuestion({ text: Q16L });
  assert.strictEqual(q16l.format, 'parts');
  assert.deepStrictEqual(q16l.choices, ['9004', '0.00660', '22000', '0.0310']);
  assert.strictEqual(q16l.ref, '16');
  assert.match(q16l.text, /Scientific Notation$/, 'the table header’s separators come off the end');
  const q2 = readQuestion({ text: Q2, format: 'mc' });
  assert.strictEqual(q2.format, 'parts');
  assert.strictEqual(q2.choices.length, 3);
  assert.strictEqual(q2.choices[2], 'Ca(OH)2(aq) + 2 HNO3(aq) -> 2 H2O(l) + Ca(NO3)2(aq)');
  const q3 = readQuestion({ text: Q3 });
  assert.strictEqual(q3.format, 'parts');
  assert.deepStrictEqual(q3.choices, ['Write the full ionic equation', 'Write the net ionic equation']);
  // the AI split a multi-part question into "options": they are tasks, so they are parts
  assert.strictEqual(readQuestion({ text: 'For the following equation: Mg(OH)2 + 2 HCl', format: 'mc', choices: ['Write the full ionic equation', 'Write the net ionic equation'] }).format, 'parts');
});

test('a question with no options stays written, and brackets in formulas are not options', () => {
  assert.deepStrictEqual(parseOptions('Calculate the molar mass of Ca(OH)2.'), { text: 'Calculate the molar mass of Ca(OH)2.', format: '', choices: [] });
  assert.strictEqual(readQuestion({ text: 'Calculate the molar mass of Ca(OH)2.' }).format, 'work');
  assert.strictEqual(parseOptions('What volume (see table) of CO2(g) forms from 2 moles (in total) of C?').format, '');
  assert.strictEqual(readQuestion({ text: 'Which is larger, 2 or 3?', format: 'tf' }).format, 'tf');
});

test('question numbers come off the front of the stem', () => {
  assert.deepStrictEqual(stripQNumber('Question 9:When the'), { text: 'When the', ref: '9' });
  assert.deepStrictEqual(stripQNumber('Problem 21. Find x'), { text: 'Find x', ref: '21' });
  assert.deepStrictEqual(stripQNumber('Find x'), { text: 'Find x', ref: '' });
  assert.strictEqual(readQuestion({ number: '3.21', text: 'Find x' }).ref, '3.21');
});

test('an answer key at the end of an exam is read per question, and cut out of the last question', () => {
  assert.deepStrictEqual(parseAnswerKey('...d) Precipitation\nAnswers: 1) b 2) c 3. d 11) a'), { 1: 'b', 2: 'c', 3: 'd', 11: 'a' });
  assert.deepStrictEqual(parseAnswerKey('No key here. 1) b'), {});
  const last = readQuestion({ text: Q9 + ' Answers: 1) b 2) c' });
  assert.deepStrictEqual(last.choices, ['1, 1, 1', '2, 1, 3', '1, 2, 2', '2, 1, 2']);
  assert.deepStrictEqual(partKeys('a) 4, 9.004 x 10^3 b) 3, 6.60 x 10^-3', 2), ['4, 9.004 x 10^3', '3, 6.60 x 10^-3']);
  assert.strictEqual(partKeys('9.004 x 10^3', 2), null);
});

test('PDF subscripts and exponents are joined back, and ordinary words and numbers are left alone', () => {
  assert.strictEqual(repairPdfText('2 AgNO 3 (aq) + K 2 SO 4 (aq) → 2 KNO 3 (aq) + Ag 2 SO 4 (s)'), '2 AgNO3 (aq) + K2SO4 (aq) → 2 KNO3 (aq) + Ag2SO4 (s)');
  assert.strictEqual(repairPdfText('42.0 g Cl 2 contains ________ molecules of Cl 2 .'), '42.0 g Cl2 contains ________ molecules of Cl2 .');
  assert.strictEqual(repairPdfText('3.57 x 10 23 and 9.22 × 10 24'), '3.57 x 10^23 and 9.22 × 10^24');
  assert.strictEqual(repairPdfText('6.6 x 10 -3 m'), '6.6 x 10^-3 m');
  assert.strictEqual(repairPdfText('Li (s) + Br 2 (l)'), 'Li (s) + Br2 (l)');
  for (const keep of ['Question 9', 'Question 9: what', '3.57 x 10 and 5', 'In 2 hours the', 'At 25 °C', 'Table 2 shows', 'Chapter 3 covers', 'He 2 is', 'Figure 12, page 4', 'mix 2 and 3']) assert.strictEqual(repairPdfText(keep), keep);
  assert.strictEqual(repairPdfText('I 2 (s) forms'), 'I2 (s) forms');
});

test('the server parser and the client reference table know the same element symbols', () => {
  const ref = fs.readFileSync(path.join(__dirname, '..', 'client', 'engine', 'reference.js'), 'utf8').match(/const PT_SYMS = '([^']+)'/)[1].split(' ');
  assert.deepStrictEqual([...QT_SYMS], ref);
});
