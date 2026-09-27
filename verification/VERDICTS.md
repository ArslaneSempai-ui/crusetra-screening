# Verdicts of the company and vessel matcher

Each line: a method version, frozen by the SHA-256 of `src/entites.ts` and `src/cribler.ts`, judged
ONCE on a held-out pair set written by a separate author who never saw the method nor any other
set. After its judgment the set is studied and becomes a training set (`src/paires-entites-N.json`,
its provenance says so); the next verdict needs a new set. Aggregates only are recorded: no pair of
a verdict set is ever listed by any tool before it becomes training.

| date | method (entites / cribler) | held-out set (sha256) | pairs | strong level | found | false alerts |
|---|---|---|---|---|---|---|
| 2026-09-27 02h | v3 70f91e07 / (v4) | set #1, became paires-entites-3.json | 100 + 100 | 0.82 | 72/100 [63-80 %] | 12/100 [7-20 %] |
| 2026-09-27 04h | v4.1 5f963c22 / (v4) | set #2, became paires-entites-4.json | 150 + 150 | 0.81 | 99/150 [58-73 %] | 7/150 [2-9 %] |
| 2026-09-27 12h | v6 4ce80263 / f23ecac0 | set #3 c53a55c5, becomes paires-entites-5.json | 200 + 200 | 0.81 | 167/200 [78-88 %] | 25/200 [9-18 %] |
| 2026-09-27 14h | v7 9f8722eb / f23ecac0 | set #5 d90aba45 (new brief, other model), becomes paires-entites-6.json | 200 + 200 | strong 0.81 | 164/200 [76-87 %] | 6/200 [1-6 %] |
| | | | | possible 0.80 | 183/200 [87-95 %] | 40/200 [15-26 %] |
| 2026-09-27 16h | v8 90098118 / f23ecac0 | set #6 639915d6 (brief by document type, third model), becomes paires-entites-7.json | 200 + 200 | strong 0.81 | 119/200 [53-66 %] | 1/200 [0-3 %] |
| | | | | possible 0.80 | 175/200 [82-91 %] | 35/200 [13-23 %] |
| 2026-09-27 18h | v9 a4488270 / f23ecac0 | set #7 ca2fad4c (Rotterdam brief by field-error source, fourth model; overlap with the seven training sets: 0 pairs, 0 names), becomes paires-entites-8.json | 200 + 200 | strong 0.81 | 139/200 [63-75 %] | 9/200 [2-8 %] |
| | | | | possible 0.80 | 179/200 [84-93 %] | 71/200 [29-42 %] |

v6 on set #3 at other thresholds: 0.70 found 182 with 52 false; 0.75 found 181 with 37; 0.85 found 162
with 19; 0.90 found 153 with 11.

2026-09-27 13h: a set #4 commissioned with the SAME brief as set #3 came back with 398 of its 400
pairs identical to set #3 (a model given the same brief writes the same set). It was set aside,
never judged. Rule from now on: every new held-out set gets a different brief and a different
model, and its overlap with the training sets is counted before any judgment.

v7 on set #5 at other thresholds: 0.70 found 188 with 48 false; 0.75 found 186 with 43; 0.85 found 162 with 6;
0.90 found 154 with 4; 0.95 found 133 with 2. Set #5 was then studied (14h30) and became training set 6.

v8 on set #6 at other thresholds: 0.70 found 179 with 52 false; 0.75 found 176 with 37; 0.85 found 118 with 1;
0.90 found 116 with 1; 0.95 found 111 with 1. Fifty-six true pairs sit between 0.80 and 0.81: the caps
(distinctive word on one side, short ambiguous word, form conflict) hold document variants down to the
possible level. Set #6 was then studied (16h15) and became training set 7.

v9 on set #7 at other thresholds: 0.70 found 180 with 76 false; 0.75 found 180 with 72; 0.85 found 136 with 8;
0.90 found 128 with 6. Set #7 carries 110 vessel pairs (27 %) and 37 sibling-one-word traps, 19 holding-vs-operating,
18 sister ships: the possible level flags most of them by design, which is the 35 % false-alert rate at 0.80.
