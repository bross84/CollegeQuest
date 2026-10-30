# Overnight report: branch `overnight/scope-1`

Nothing was pushed, and `main` is untouched. All 34 tests pass (24 old ones, 8 new parser tests and 2 new API tests). I clicked through every change against the stand-in AI in a browser.

## What to run

```bash
git checkout overnight/scope-1
docker compose up -d --build
```

Then open **Exams** and click **Read again** on both practice exams.

You may not need to. On first start the database upgrade (v14) re-reads every question already in your bank with the new parser, so Exam 2's questions 1 to 15 should already show as multiple choice. Read again also picks up the answer key and anything the old read missed. It does not delete anything.

## Done

| Item | Commit | Notes |
|---|---|---|
| Stand-in AI | `4ff70d5` | `test/mock-ai.js`. It serves `/chat/completions` (streaming and not) and `/search`, and answers each of the app's prompts with canned JSON. Its "Find every problem" answer is deliberately sloppy: it leaves options in the question and calls the sig-fig table multiple choice, so the parser has to correct it. |
| P0: multiple choice vs multi-part | `5d9f6f1` | New `server/qtext.js`. The server uses it, and `client/build.js` builds the same file into `app.js`, so there is one copy and no drift. `parseOptions` finds `a)` markers even when glued to the text (`Covalentc)`), sorts the two-column order a, c, b, d back to a, b, c, d, and skips brackets that belong to formulas (`Ca(OH)2`, `(aq)`, `a(an)`). It reads a question as **multi-part** (new format `parts`) when the markers are `(a)`, a part has blanks, the parts are tasks ("Write…"), the stem says "each of the following" / "classify each" / "the following number", or there are only 2 parts. When in doubt it chooses multi-part. A sig-fig table with no letters (`9004____ / 0.00660____`) is multi-part too. Parts are stored in `choices`, so no new column was needed for them. |
| | | The parser wins over the AI whenever it finds options or parts. `Question N:` comes off the stem and N goes into `ref`. An answer key (`Answers: 1) b 2) c`) is read and the letter mapped to the option text. |
| | | **Exam taking:** one box per part, the same size within a question (a single line for table rows like 9004). **Review:** your answer per part, plus the key per part when the key is written `a) … b) …`. Otherwise the whole key is shown and nothing is marked automatically. **Print:** parts listed with a line for each. |
| | | **Generated exams:** a model with N parts produces a new question with N parts. Selection, mix, ordering and focus topic are unchanged. I only added `parts` to the format names, to the variant prompt and to the keyless-answer prompt. |
| | | **Re-reading** (`readDocs`): a question read again now **updates the old row in place**, matched by number or by text, instead of being deleted and re-added. Saved exams and your progress keep pointing at it. The document's own answer key replaces an earlier read's answer. |
| | | **Migration v14:** adds `problems.raw`, which keeps a question's original text whenever a later read changes it, then re-reads every original question with the parser. |
| P1: PDF text repair | `5d9f6f1` | This went in with the parser because the parser depends on it. `repairPdfText` turns `AgNO 3` into `AgNO3`, `K 2 SO 4` into `K2SO4`, `Cl 2 .` into `Cl2 .` and `3.57 x 10 23` into `3.57 x 10^23` (shown as a superscript). It runs at PDF upload, on every displayed question (`fmtMath`), and in the v14 re-read. It only joins a word made entirely of element symbols, so "Question 9", "Table 2" and "Chapter 3" are left alone. Element-symbol words like "In 2 hours" and "At 25 °C" are joined only when a phase like `(s)` follows. The tests cover both these and the bad cases. |
| P0: saved exams note | `0befa82` | The Exams page shows "N saved exams use questions that were re-read. Rebuild them." when an exam points at questions no longer in the bank, and each such exam's row says "N questions gone". Because re-reads now update in place, you should rarely see it. A question deleted by hand also triggers it. |
| P1: Prepare also reads problems | `662bafa` | After the guide is built, "Prepare this chapter" (and the Continue card's button) reads the problems in the chapter's non-exam files, with progress on the builder screen. Files already read are skipped, so preparing again adds nothing twice. If that step fails, the guide is still saved. |
| P1: tiles never repeat | `662bafa` | Once every real problem in a section is answered right, the round uses AI-written problems for the section, labelled `AI-written · Chapter …`. Your own problems still come first while any are left. With the AI off it falls back to repeating yours. |
| P2: mole map | `8496de0` | Ported from ChemQuest's `mapHTML`, minus its "Chapter 6" wording. It is a fourth table (`mole`), one button away and never open inline. It has a checkbox under Class settings and is on the server whitelist. It is on by default only for chemistry classes that never chose their tables. **Your class may have saved choices, so you might need to tick it under Class settings.** |
| P2: gamification audit | `4175acb` | Still visible and now removed: the rank ("Newcomer"), "N days in a row" and "day streak" on the class dashboard, red due-count badges in the dashboard menu and chapter chips, the "Recall due" stat, the "due" pill on the chapter Practice tab, and the counts in "Quiz me (N due)" / "Review N questions due". Also removed: the unused rank/streak line code (`standLine`, `rankName`, `liveStreak`) and the pack's rank names. |
| P2: size and layout pass | `7e59ad6` | I checked every screen at 1280 px and 375 px. No page scrolls sideways, and buttons in a row are within 1 px of each other. Fixed: the dashboard numbers (27 px), dashboard stats (19.5 px), and the exam review heading and score (20 to 30 px) are now heading size or less. The five chapter tabs now fit at 375 px (Tutor was cut off). Measured on a tile: root 15 px, question 15.75 px, options 13.5 px. |
| README | `dc52ecf` | Short additions. |

## Not done, or left on purpose

- **Unreachable gamification code:** the "Practice sets" skill screen, its mastery meter, the "Session complete … correct on the first try" summary and the streak counter in saved state (in `ui.js` and `game.js`). They only appear when a subject pack has built-in drills, and none does now. I left them because the round code is shared with the homework helper and tutor paths I was told not to touch. Remove them in a separate change if you want them gone.
- **Controls 1 px apart:** dropdowns are 42 px and buttons 43 px in the same row on the chapter Practice tab and the Materials upload row. I didn't think that counts as a clear violation.

## Uncertain: please check

1. **Tested only against the stand-in AI.** Real Groq output may differ, but the parser works on the question text whatever the AI says.
2. **Answer keys:** I only know the format `Answers: 1) b 2) c` (also `3. d`, and "Answer key"). If your PDFs print the key differently, it is ignored and the exam builder's AI-worked key is used, labelled as before.
3. **`(a) (b) (c)` always means multi-part,** as the scope said. A textbook multiple-choice problem printed with `(a)…(d)` options will be multi-part, and tiles skip multi-part problems.
4. **Migration v14 rewrites stored question text.** It strips "Question N:", splits out options and joins subscripts. The original text is kept in the new `raw` column, so it can be restored.
5. **Question 16:** your extract (Appendix A) has no letters on the rows, but you said they are labelled a to d. Both forms read as multi-part, and both are tested.
6. **Ports on this PC:** something from an earlier session was already listening on 3998 and 3999 when I started. I didn't touch it and ran my servers on 3988 and 3989 instead (now stopped). The README's mock-AI command uses 3998/3999, so stop the old ones first if they're still running.

## Open questions (behaviour unchanged, as asked)

1. Chapter 3 splits into about 26 sections. Too many? (One option: merge to about 8 to 10 per chapter.)
2. A per-question chapter picker to re-file a misfiled exam question: not added.
3. Combining "Read its problems" and "Make a study guide" into one AI pass: not done. "Prepare this chapter" only runs them one after the other.
4. The "Practice answers" class setting (multiple choice vs type first) stays hidden, because the general pack has `hasChoiceMode: false`.
5. The `chem` and `algebra` packs were not re-added.
