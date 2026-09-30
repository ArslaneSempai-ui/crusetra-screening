# Real company names: the GLEIF verdict

Every other test set in this repository was written by AI agents, with invented names. This one is
built from real names: the legal entity names in GLEIF's LEI register, released under CC0 1.0.
It was measured once, on 30 September 2026, with the method as published (entites 1dd3c893,
cribler ac3c1b11) and the thresholds chosen on the 23 training sets: strong 0.81, possible 0.80.

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

## What happens next

This set has now been judged, so by the rule of `VERDICTS.md` it can no longer serve as a verdict.
The thresholds will be recalibrated on a separate GLEIF sample, then measured once on a fresh
sample drawn with another seed, and that number will be published here whatever it is.

## Limits

- A same-entity label means the same LEI, and the kind of name comes from AI judges, not from
  compliance analysts.
- GLEIF's parent and child reporting is incomplete, so some different-entity pairs, and more of
  the contained ones, may be unreported group companies. They are still distinct legal entities.
- Chinese and Japanese legal names have no spaces, so they rarely share a distinctive word: the
  different-entity pairs are mostly in Latin script.
- Company names only. No person and no vessel is in this set.
