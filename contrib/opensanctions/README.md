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
