# Real company names: the GLEIF verdicts

Every other test set in this repository was written by AI agents, with invented names. The sets here
are built from real names: the legal entity names in GLEIF's LEI register, released under CC0 1.0.

There are two verdicts, each measured once. The first, on 30 September 2026, took the method as
published then (entites 1dd3c893, cribler ac3c1b11), with thresholds chosen on the 23 written
training sets alone. The matcher was then recalibrated on a separate GLEIF training sample and
measured once more on a fresh sample: that second verdict is the current one, and it is
[further down](#the-second-verdict-after-recalibration). On 488 real spelling variants the
recalibrated matcher caught 239 at the strong level (49 %) and 334 at the possible level (68 %);
on 1,000 real different companies it raised 1 false alert at the strong level and 7 at the possible
level.

# The first verdict

## What the set is

`verification/paires-gleif.json` (sha256 d75bd443…), rebuilt byte for byte by `node src/gleif-paires.ts`
from the golden copy of 2026-09-30 08:00 UTC. The file's `provenance` field gives the two download
URLs, their sizes and SHA-256 hashes, the seed and every selection rule.

- **1,000 same-entity pairs.** The legal name of one LEI record and another name recorded on the
  same record: a previous legal name, a trading name, an alternative-language name, or an ASCII
  transliteration of a non-Latin legal name, 250 of each. Pairs identical after case, spacing and
  punctuation folding were dropped.
- **1,000 different-entity pairs.** The legal names of two distinct LEIs that share a distinctive
  word: same country, other country, or same city and same legal form. Pairs linked by a GLEIF
  parent or child relationship were left out.
- **250 contained pairs**, reported on their own: two distinct LEIs where one name's words sit
  inside the other's. A screening team may want those to alert, so they never count in the
  false-alert rate.

The labels come from the register, not from anyone judging a match. A same-entity pair can
therefore be two names no name matcher should link: a full rename, initials, a brand, a
translation.

## The kind of second name, judged blind

To separate those from real spelling variants, two AI judges sorted the 1,000 same-entity pairs,
each on their own, reading only the two names. They never saw a score, the code or a result. They
agreed on 943 of 1,000, and an AI arbiter settled the other 57 by the written rule. The labels are
in `verification/paires-gleif-juges.json`:

- **same-name** (448): the same name written differently. Spelling, punctuation, a legal form
  added or changed, a branch or city qualifier, word order, a truncation, or a transliteration of
  the same words between scripts.
- **partial** (322): the distinctive core is shared, but a distinctive word is translated, added
  or dropped.
- **other-name** (230): another name of the same entity. A rename, initials alone, a brand made
  of other words, or a translation with nothing carried over by spelling or sound.

## Results

`node src/verdict-gleif.ts`, by register stratum:

```
set d75bd443 · 2250 pairs · overlap with the training and verdict sets: 0 pairs, 0 pairs with a name already seen
code entites 1dd3c893 · cribler ac3c1b11 · ecritures 9496c409 · score 79125510 · preparation 8cc1284c
weights: 33393 listed entries · thresholds chosen on 23 training sets (4170 match, 4170 different): strong 0.81, possible 0.80
MATCH: pairs found (score >= threshold)
  previous-legal-name                  strong   22/250    8.8 % [5.9-13.0 %]   possible   76/250   30.4 % [25.0-36.4 %]
  trading-name                         strong   50/250   20.0 % [15.5-25.4 %]   possible  109/250   43.6 % [37.6-49.8 %]
  alternative-language-name            strong   52/250   20.8 % [16.2-26.3 %]   possible   72/250   28.8 % [23.5-34.7 %]
  transliteration                      strong   43/250   17.2 % [13.0-22.4 %]   possible   55/250   22.0 % [17.3-27.5 %]
  TOTAL match                          strong  167/1000  16.7 % [14.5-19.1 %]   possible  312/1000  31.2 % [28.4-34.1 %]
DIFFERENT: false alerts (score >= threshold), contained stratum apart
  different-same-word-same-country     strong    0/334    0.0 % [0.0-1.1 %]   possible    1/334    0.3 % [0.1-1.7 %]
  different-same-word-other-country    strong    0/333    0.0 % [0.0-1.1 %]   possible    0/333    0.0 % [0.0-1.1 %]
  different-same-city-same-form        strong    0/333    0.0 % [0.0-1.1 %]   possible    0/333    0.0 % [0.0-1.1 %]
  TOTAL different                      strong    0/1000   0.0 % [0.0-0.4 %]   possible    1/1000   0.1 % [0.0-0.6 %]
CONTAINED (different entities, one name's words inside the other's): alerts, reported on their own
  different-contained                  strong    0/250    0.0 % [0.0-1.5 %]   possible   11/250    4.4 % [2.5-7.7 %]
```

`node src/verdict-gleif-juge.ts`, the same measurement read by the judges' labels:

```
thresholds chosen on 23 training sets: strong 0.81, possible 0.80
SAME ENTITY, found (score >= threshold), by kind of second name:
  same-name                                    strong  143/448   31.9 % [27.8-36.4 %]   possible  242/448   54.0 % [49.4-58.6 %]
  partial                                      strong   24/322    7.5 % [5.1-10.9 %]   possible   69/322   21.4 % [17.3-26.2 %]
  other-name                                   strong    0/230    0.0 % [0.0-1.6 %]   possible    1/230    0.4 % [0.1-2.4 %]
  all                                          strong  167/1000  16.7 % [14.5-19.1 %]   possible  312/1000  31.2 % [28.4-34.1 %]
by kind and register stratum:
  other-name · alternative-language-name       strong    0/30     0.0 % [0.0-11.4 %]   possible    0/30     0.0 % [0.0-11.4 %]
  other-name · previous-legal-name             strong    0/100    0.0 % [0.0-3.7 %]   possible    0/100    0.0 % [0.0-3.7 %]
  other-name · trading-name                    strong    0/68     0.0 % [0.0-5.3 %]   possible    1/68     1.5 % [0.3-7.9 %]
  other-name · transliteration                 strong    0/32     0.0 % [0.0-10.7 %]   possible    0/32     0.0 % [0.0-10.7 %]
  partial · alternative-language-name          strong   14/117   12.0 % [7.3-19.1 %]   possible   15/117   12.8 % [7.9-20.1 %]
  partial · previous-legal-name                strong    1/75     1.3 % [0.2-7.2 %]   possible   23/75    30.7 % [21.4-41.8 %]
  partial · trading-name                       strong    1/57     1.8 % [0.3-9.3 %]   possible   22/57    38.6 % [27.1-51.6 %]
  partial · transliteration                    strong    8/73    11.0 % [5.7-20.2 %]   possible    9/73    12.3 % [6.6-21.8 %]
  same-name · alternative-language-name        strong   38/103   36.9 % [28.2-46.5 %]   possible   57/103   55.3 % [45.7-64.6 %]
  same-name · previous-legal-name              strong   21/75    28.0 % [19.1-39.0 %]   possible   53/75    70.7 % [59.6-79.8 %]
  same-name · trading-name                     strong   49/125   39.2 % [31.1-48.0 %]   possible   86/125   68.8 % [60.2-76.3 %]
  same-name · transliteration                  strong   35/145   24.1 % [17.9-31.7 %]   possible   46/145   31.7 % [24.7-39.7 %]
```

## What it means

On real different companies the matcher almost never alerts: 0 of 1,000 at the strong level. On
real spelling variants of the same name it catches 143 of 448 at the strong level (32 %), and 242
at the possible level (54 %). The AI-written realistic set gave 83 % at the strong level, so that
set was easier than real names. Transliterations are the weakest kind: 35 of 145 at the strong
level.

The thresholds were chosen on AI-written traps, which are harder than real neighbouring
companies, and on real data they are too cautious.

## What happened next

This set has been judged, so by the rule of `VERDICTS.md` it can no longer serve as a verdict. The
matcher was recalibrated on a separate GLEIF sample, then measured once on a fresh sample drawn
with another seed. That is the second verdict, below.

# The second verdict, after recalibration

## What changed

**A training sample of real names.** `src/paires-gleif-apprentissage.json` (seed 20261001) is drawn
from the same golden copy by the same rules, 1,000 same-entity pairs, 1,000 different-entity pairs
and 250 contained pairs, and shares no name with either verdict sample. It is there to be studied:
`node src/etude-gleif.ts` prints its table, and its pairs may be read. One AI judge per batch
labelled the kind of its second names (`src/paires-gleif-apprentissage-juges.json`).

**General rules, written from that sample.** Each reads a way of writing a name:

- English words spelt by their sound in another script (Cyrillic, Greek, kana, hangul, Thai): both
  sides are compared on a key of consonant classes.
- Latin initials spelt out letter by letter in Arabic, Cyrillic, katakana, hangul or Thai.
- Pinyin written one syllable per character by a register's automatic transliteration, read the
  way the characters are read.
- Legal forms the register showed missing, in short and in full, the sole-shareholder qualifier
  one script writes and the other omits, and Gulf forms written letter by letter.
- Status notes in the other languages of the registers ("in liquidation" and the like).
- Serbian and Macedonian Cyrillic letters, and Greek digraphs written letter for letter.

**A written rule for the two thresholds** (`choisirSeuils`, `src/entites.ts`), set down on
30 September 2026 before it was applied. Each ceiling is held on the upper bound of the 95 % Wilson
interval, not on the rate.

- Strong is the lowest threshold above possible that keeps false alerts under 5 % on the written
  traps of the 23 training sets and under 1 % on the real different companies of the training
  sample (the contained stratum apart).
- Possible is the level where the method's ceilings put a doubtful pair, 0.80, and the review
  budget keeps it there: one name to review per fifty counterparties. On the two thousand-name
  books of `exemple/`, screened against the real lists, 0.80 gave 18 and 17 names to review, 0.75
  gave 22 and 21, 0.70 gave 45 and 43, and 0.61 gave 215 and 219. A first version of the rule went
  down to 0.61; the budget was preferred, a choice made on 30 September 2026 with those volumes in
  hand. Because both books were read for this choice, neither is a blind figure any more, and
  `releve-entites.json` says so.

The rule gives strong 0.81 and possible 0.80: the same two values as before, now for a stated
reason. On the training sample, at those thresholds (`node src/etude-gleif.ts`, 4 October 2026):
same-name variants 257/548 at strong (46.9 % [42.8-51.1 %]) and 377/548 at possible (68.8 %
[64.8-72.5 %]); false alerts on real different companies 0/1,000 at both levels; contained pairs
1/250 at strong and 11/250 at possible. On the 23 written training sets: 3,817/4,170 found and
127/4,170 false alerts at strong, 4,061/4,170 and 884/4,170 at possible.

## The fresh sample

`verification/paires-gleif-2.json` (sha256 e6471105…, seed 20261002), built by
`node src/gleif-paires.ts --graine 20261002` from the same golden copy with the same selection
rules, leaving out every name of the first verdict set and of the training sample. Two AI judges
sorted its 1,000 same-entity pairs on their own, reading only the two names; they agreed on 926 of
1,000 and an AI arbiter settled the other 74 by the written rule
(`verification/paires-gleif-2-juges.json`): 488 same-name, 281 partial, 231 other-name.

Before the measurement the method was frozen: `verification/methode-gelee-gleif-2.json` holds the
SHA-256 of the 83 files the score and the choice of thresholds depend on, and
`src/verdict-gleif-2.ts` refuses to measure when one of them differs, or when a result already
exists. The method was frozen on 30 September 2026; the measurement ran once, in the night that
followed (1 October 2026), and wrote `verification/verdict-gleif-2.txt`.

## Results

`node src/verdict-gleif-2.ts`, the output as written:

```
set e6471105 · 2250 pairs · overlap with the training sets and the other verdict sets: 0 pairs, 0 pairs with a name already seen
method frozen in verification/methode-gelee-gleif-2.json (83 files, all unchanged)
weights: 33393 listed entries · thresholds chosen on 23 written training sets and the real training sample: strong 0.81, possible 0.80
SAME ENTITY, found (score >= threshold), by kind of second name:
  same-name                                    strong  239/488   49.0 % [44.6-53.4 %]   possible  334/488   68.4 % [64.2-72.4 %]
  partial                                      strong   20/281    7.1 % [4.7-10.7 %]   possible   64/281   22.8 % [18.3-28.0 %]
  other-name                                   strong    0/231    0.0 % [0.0-1.6 %]   possible    1/231    0.4 % [0.1-2.4 %]
  all                                          strong  259/1000  25.9 % [23.3-28.7 %]   possible  399/1000  39.9 % [36.9-43.0 %]
by kind and register stratum:
  other-name · alternative-language-name       strong    0/37     0.0 % [0.0-9.4 %]   possible    0/37     0.0 % [0.0-9.4 %]
  other-name · previous-legal-name             strong    0/91     0.0 % [0.0-4.1 %]   possible    0/91     0.0 % [0.0-4.1 %]
  other-name · trading-name                    strong    0/74     0.0 % [0.0-4.9 %]   possible    1/74     1.4 % [0.2-7.3 %]
  other-name · transliteration                 strong    0/29     0.0 % [0.0-11.7 %]   possible    0/29     0.0 % [0.0-11.7 %]
  partial · alternative-language-name          strong   12/104   11.5 % [6.7-19.1 %]   possible   12/104   11.5 % [6.7-19.1 %]
  partial · previous-legal-name                strong    2/79     2.5 % [0.7-8.8 %]   possible   20/79    25.3 % [17.0-35.9 %]
  partial · trading-name                       strong    1/53     1.9 % [0.3-9.9 %]   possible   26/53    49.1 % [36.1-62.1 %]
  partial · transliteration                    strong    5/45    11.1 % [4.8-23.5 %]   possible    6/45    13.3 % [6.3-26.2 %]
  same-name · alternative-language-name        strong   49/109   45.0 % [35.9-54.3 %]   possible   65/109   59.6 % [50.2-68.4 %]
  same-name · previous-legal-name              strong   29/80    36.3 % [26.6-47.2 %]   possible   62/80    77.5 % [67.2-85.3 %]
  same-name · trading-name                     strong   53/123   43.1 % [34.7-51.9 %]   possible   89/123   72.4 % [63.9-79.5 %]
  same-name · transliteration                  strong  108/176   61.4 % [54.0-68.2 %]   possible  118/176   67.0 % [59.8-73.6 %]
DIFFERENT: false alerts (score >= threshold) on real different companies, contained stratum apart:
  different-same-word-same-country             strong    1/334    0.3 % [0.1-1.7 %]   possible    1/334    0.3 % [0.1-1.7 %]
  different-same-word-other-country            strong    0/333    0.0 % [0.0-1.1 %]   possible    0/333    0.0 % [0.0-1.1 %]
  different-same-city-same-form                strong    0/333    0.0 % [0.0-1.1 %]   possible    6/333    1.8 % [0.8-3.9 %]
  TOTAL different                              strong    1/1000   0.1 % [0.0-0.6 %]   possible    7/1000   0.7 % [0.3-1.4 %]
CONTAINED (different entities, one name's words inside the other's): alerts, reported on their own
  different-contained                          strong    2/250    0.8 % [0.2-2.9 %]   possible   13/250    5.2 % [3.1-8.7 %]
```

## What it means

On real spelling variants of the same name the recalibrated matcher catches 239 of 488 at the
strong level (49.0 %) and 334 of 488 at the possible level (68.4 %). The first verdict gave 143 of
448 (31.9 %) and 242 of 448 (54.0 %). The two samples are different draws with their own judges'
labels, so the comparison is between two samples, not a paired one; the intervals do not overlap
at either level. The figures are close to those of the training sample (46.9 % and 68.8 %), so the
rules carried over to names they had not seen. Same-name transliterations moved most: 108 of 176 at
strong, against 35 of 145.

The price is on the other side. On 1,000 real different companies there is now 1 false alert at the
strong level and 7 at the possible level, against 0 and 1; the training sample had shown 0 and 0,
so the 7 were not visible when the rules were written. Six of the seven are in the stratum of
companies of the same city with the same legal form. Contained pairs alert 2 times in 250 at
strong and 13 at possible, against 0 and 11.

Half of the real spelling variants are still missed at the strong level, and a third at the
possible level. Second names that share only part of the name (partial) are found 64 times in 281
at the possible level, and other names of the same entity are not found, as designed.

The same matcher on the two thousand-name books of `exemple/` (invented counterparties, real
lists) raises 4 strong and 14 possible alerts on the first and 4 and 13 on the second; before the
recalibration, 2 and 13, and 3 and 13. Three of the strong alerts are new: each is a Latin vessel
name against a Cyrillic alias of a listed party. They are false on reading, and they are the first
thing a further round would look at.

This sample has now been judged, so it can no longer serve as a verdict either.

# Limits of both verdicts

- A same-entity label means the same LEI, and the kind of name comes from AI judges, not from
  compliance analysts.
- GLEIF's parent and child reporting is incomplete, so some different-entity pairs, and more of
  the contained ones, may be unreported group companies. They are still distinct legal entities.
- Chinese and Japanese legal names have no spaces, so they rarely share a distinctive word: the
  different-entity pairs are mostly in Latin script.
- Company names only. No person and no vessel is in these sets.
- The second verdict is one draw of 2,250 pairs from one day's golden copy. Its three samples
  (first verdict, training, second verdict) come from the same register by the same rules, so it
  says nothing about names built another way, such as sanctions list aliases.
- The possible threshold was kept at 0.80 for a review budget measured on two invented books; a
  team with another budget would choose another level, and the rule in `src/entites.ts` says how.
