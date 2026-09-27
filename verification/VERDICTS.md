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
| 2026-09-27 17h | v10 b05e1be0 / 7f564556 | set #8 197c7ead (Singapore trade-finance KYC brief by counterparty type, Opus; overlap with the eight training sets: 0 pairs, 1 name), becomes paires-entites-9.json | 200 + 200 | strong 0.81 | 110/200 [48-62 %] | 3/200 [1-4 %] |
| | | | | possible 0.80 | 129/200 [58-71 %] | 48/200 [19-30 %] |
| 2026-09-27 21h | v11 77bac960 / ccee90bc / ecritures 4348bc88 | set #9 47ec8944 (Hamburg customs broker and Lagos trade-finance brief by document, Sonnet; overlap with the nine training sets: 0 pairs, 0 names; 11 pairs identical but for case, 6 match and 5 different), becomes paires-entites-10.json | 200 + 200 | strong 0.81 | 104/200 [45-59 %] | 39/200 [15-26 %] |
| | | | | possible 0.80 | 163/200 [76-86 %] | 78/200 [33-46 %] |
| 2026-09-28 | v12 dc363c55 / 949b2356 / ecritures 4348bc88 | set #10 985eb7c1 (Tokyo, Panama and Mexico brief by error source, explicit conventions, seventh model; overlap with the ten training sets: 0 pairs, 0 names; 0 pairs identical but for case), becomes paires-entites-11.json | 200 + 200 | strong 0.81 | 128/200 [57-70 %] | 6/200 [1-6 %] |
| | | | | possible 0.80 | 179/200 [84-93 %] | 45/200 [17-29 %] |
| 2026-09-28 | v13 3702a136 / 83ac2577 / ecritures aec60a13 | set #11 a963a80c (Helsinki and Black Sea brief by trap family, explicit conventions, eighth model; overlap with the eleven training sets: 0 pairs, 0 names; 0 pairs identical but for case), becomes paires-entites-12.json | 200 + 200 | strong 0.81 | 135/200 [61-74 %] | 14/200 [4-11 %] |
| | | | | possible 0.80 | 165/200 [77-87 %] | 44/200 [17-28 %] |
| 2026-09-28 | v14 3b94f68d / a85e7c3c / ecritures aec60a13 | set #12 3bc2d0f0 (Mumbai trade-finance and Australian exporter brief by document: Indian registry, AU/NZ documents, bulk vessels, SWIFT MT700 fields, chat; Sonnet; overlap with the twelve training sets: 0 pairs, 0 names; 0 pairs identical but for case), becomes paires-entites-13.json | 200 + 200 | strong 0.81 | 149/200 [68-80 %] | 34/200 [12-23 %] |
| | | | | possible 0.80 | 187/200 [89-96 %] | 72/200 [30-43 %] |
| 2026-09-28 | v15 ea838aa2 / 292e9ddb / ecritures bdd60326 | set #13 79a6a291 (Rotterdam customs broker and Dubai free-zone bank brief by trap family: Benelux and Gulf forms, Arabic and Persian romanisations, Rhine barges and Gulf tankers, EDI/SWIFT residues, chat/OCR; corrected conventions: one letter changed in a company name is the same name misspelt, except in a vessel name; Opus; overlap with the thirteen training sets: 0 pairs, 0 names; 0 pairs identical but for case), becomes paires-entites-14.json | 200 + 200 | strong 0.81 | 120/200 [53-67 %] | 16/200 [5-13 %] |
| | | | | possible 0.80 | 155/200 [71-83 %] | 59/200 [24-36 %] |
| 2026-09-28 | v16 ebbd2990 / 6ad910de / ecritures bdd60326 | set #14 ee673be7 (Mombasa freight forwarder and Karachi bank brief by document: East African registries, Pakistani documents, Indian Ocean vessels, SWIFT fields, chat/OCR; corrected conventions unchanged; overlap with the fourteen training sets: 0 pairs, 0 names; 0 pairs identical but for case), becomes paires-entites-15.json | 200 + 200 | strong 0.81 | 141/200 [64-76 %] | 2/200 [0-4 %] |
| | | | | possible 0.80 | 173/200 [81-91 %] | 23/200 [8-17 %] |
| 2026-09-28 | v17 fa808a1c / a91bf0c8 / ecritures bdd60326 | set #15 f44d2a17 (Abidjan customs broker and São Paulo bank brief by document: francophone West African registries, Brazilian and Argentine documents, Atlantic vessels, SWIFT fields in French and Portuguese, chat/OCR; Sonnet, written in five parts; corrected conventions unchanged; fifteen em-dashes in names replaced by hyphens blind, 22 pairs are accent variants of one pair with concordant verdicts; overlap with the fifteen training sets: 0 pairs, 0 names; 8 pairs identical but for case), becomes paires-entites-16.json | 200 + 200 | strong 0.81 | 171/200 [80-90 %] | 8/200 [2-8 %] |
| | | | | possible 0.80 | 188/200 [90-97 %] | 35/200 [13-23 %] |
| 2026-09-28 | v18 8dd86269 / a91bf0c8 / ecritures bdd60326 | set #16 482552a9 (Piraeus shipping agent and Almaty grain bank brief by document: Greek and Cypriot registries, Central Asian documents, Black Sea and Mediterranean vessels, SWIFT fields, chat/OCR and greeklish; Opus, written in five parts; corrected conventions unchanged, no em-dash; overlap with the sixteen training sets: 0 pairs, 0 names; 0 pairs identical but for case), becomes paires-entites-17.json | 200 + 200 | strong 0.81 | 93/200 [40-53 %] | 12/200 [3-10 %] |
| | | | | possible 0.80 | 132/200 [59-72 %] | 38/200 [14-25 %] |

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

v10 on set #8 at other thresholds: 0.70 found 140 with 72 false; 0.75 found 136 with 54; 0.85 found 108 with 4;
0.90 found 102 with 4. Set #8 is a different population from sets #3 to #7 (ASEAN dialect romanisations, Tamil, Thai,
Gulf and South Asian houses, chat typing, native scripts): its rates are not comparable with the earlier rows, only
with later methods judged on sets of the same brief. v10 on the eight training sets: strong 1098/1170 with 6/1170
false alerts (v9: 1047 with 14).

v11 on set #9 at other thresholds: 0.70 found 176 with 94 false; 0.75 found 164 with 86; 0.85 found 104 with 40;
0.90 found 102 with 36. The strong false-alert rate (19.5 %) is far above the 5 % the strong level promises on the
training population (6 of 1,370). Read by nature tag only, never by pair: 5 of the 39 are strings identical but for
case that the author judges distinct entities (a bank branch and its headquarters), 5 are consolidator branches
under another registration, 5 are a vessel's former name colliding with another vessel, 5 are glued words forming
another name: 22 of the 39 differ by at most two words. Those are alerts an analyst wants shown, and no string
method separates them; the set counts them against the method. The remainder is ours: one-letter near-strings
in non-English names (5), GmbH against KG (2), SARL against SA (1), autocorrect and homophones (5). Of the 96
misses at strong, 30 are legal forms written out in full by the German, Dutch and African registries, 10 are
registry numbers against trading names, and the rest are customs and SWIFT residues: a known list for round six.
v11 on the nine training sets: strong 1284/1370 with 6/1370 false alerts (v10: 1208 with 9).

Reading of v14 (blind set 12, judged 2026-09-28). The strong level found 149/200 with 34/200 false alerts, twice
v13's rate. Of the thirty-four, twenty-three are a single letter changed inside a proper name with everything else
identical (Mittal / Mital, Kennedy / Kennedey, McAllister / McAlister, Radcliffe / Ratcliffe, Kulkarni / Kulkani). Our
own brief invited it: it said "one letter changed in a vessel or shop name is another vessel or another shop", and the
author read every firm as a shop, while the same set labels "Harrington Miming / Mining" a typo of one firm and the
earlier authors labelled one letter in a company name a typo throughout. A screening tool must raise Mital against
Mittal: the officer decides. The rate at strong therefore measures the brief's convention as much as the method, and
the brief of the next blind author corrects it: one letter changed inside a company's proper name is the same name
misspelt (match), except in a vessel name; two real words (Coal / Coke, Cypress / Cyprus, Chiang Mai / Chiang Rai)
are two names. The remaining eleven (plurals of trade words without a vessel prefix, Bros. / Bro., Supplies /
Suppliers, Maghreb spellings held apart by convention) go to round nine's known list with the fifty-one misses.
