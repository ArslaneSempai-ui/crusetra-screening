# Name pairs for the OpenSanctions name benchmark

`cascade-name-pairs.csv` holds 300 labelled pairs of company and vessel names, in the column format of
`contrib/name_bench/cases.csv` in [opensanctions/nomenklatura](https://github.com/opensanctions/nomenklatura).
They were picked from this repository's authored pair sets (`src/paires-entites-*.json`): at most four pairs for
each of the 75 most frequent error types, 40 on the non-match side and 35 on the match side. The `category`
column carries the error type the author gave each pair.

The held-out verdict set (`verification/paires-entites-verdict.json`), which the published rates come from, is not
part of this sample.

These files alone are released under the MIT licence (see `LICENSE` here), so they can join the benchmark.
The rest of the repository keeps its own licence.

## Second lot: Hebrew, Burmese and former names

`cascade-name-pairs-2.csv` holds 185 more pairs in the same column format, with `case_group` set to
`cascade_entities_2`. It was made for moov-io/watchman after its maintainer measured, on the first lot, that Hebrew and
Burmese names stay far below a 0.80 screening line against their Latin forms.

| Group | Same entity | Different entities |
|---|---:|---:|
| Hebrew and Latin | 38 | 24 |
| Burmese and Latin | 38 | 30 |
| Former names (ex-, f.k.a., formerly) | 42 | 13 |

The pairs that name two different entities are near misses. They share a word, a root or a number pattern across the
two scripts, so a fix that raises true pairs can be checked against raising these too.

How the pairs were made:
- 100 pairs were written for this lot by two language-model agents, one for Hebrew and one for Burmese. The other 85
  come from this repository's authored pair sets. The held-out verdict set and the first lot were excluded.
- Every pair was then checked blind, without the author's reasons. For the Hebrew and Burmese pairs, one reviewer
  checked spelling, encoding and transliteration, and another checked the label. For the former-name pairs, only the
  label reviewer ran. A pair was kept only when every reviewer kept it: 185 of 221.
- The removed pairs include a name that belongs to a real, sanctioned person, and company numbers that could belong
  to real registered companies. They also include vessel names that reviewers believed were real, and near copies of
  the first lot.
- Mechanical checks, run by script on the kept pairs: ICU's Latin transliteration as a witness for the Hebrew and
  Burmese strings, Hebrew final letters, Burmese in Unicode (no Zawgyi code points, medials in Unicode order), exactly
  one native-script side per pair, and no duplicate of the first lot.
- No native speaker has reviewed this lot. All names are invented, and any match with a real company or vessel is
  unintended.
