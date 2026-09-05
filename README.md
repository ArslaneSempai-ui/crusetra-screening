# Cascade · Screening

**Which name matcher suffices, at which threshold, measured on your own alert history.**
Nothing of yours goes up: the lists come down, your alerts stay on your machine.

Name screening (sanctions, PEP, internal lists) raises alerts; most of them are false, and
nobody can say why the threshold sits at 85 rather than 90 except "that is the vendor's
setting". This tool measures it: several matchers, from exact to phonetic to a local
embedding model, are run over the alerts your analysts already dispositioned, and each
matcher × threshold cell is read for recall on confirmed matches, false-alert rate and
alerts per thousand screenings — with its count and its interval, or not at all.

It is the second tool of the Cascade suite. The first, [cascade-routing](https://github.com/ArslaneSempai-ui/cascade-routing),
measures which extraction tier suffices per field. Same method, same seal, same key.

<!-- figures:commandes -->
| Command | What it does, in the order that makes sense |
|---|---|
| `npm ci --ignore-scripts` | install exactly the versions the lockfile pins, and run no install script from any dependency — the only command besides `listes -- --fetch` that needs the network |
| `npm run listes [-- --fetch]` | the three public sanctions lists — OFAC SDN, UN consolidated, EU consolidated (FSF) — downloaded into data/ with a committed manifest (source, date, sha256, entry count); without the flag it reports what is on disk and touches nothing. The list comes down, nothing goes up |
| `npm run test` | types, the README blocks, the licence inventory, and the suite — start here; it runs with the network cut |
| `npm run measure [-- --yes-overwrite]` | the public measure: every tier at every threshold on pairs we authored (hard negatives included) plus declared synthetic variants, sealed into `releve-public.json` and readable in `RELEVE-PUBLIC.md` — the record the catalogue requires, and it refuses to overwrite a sealed one without the flag |
| `npm run measure:yours -- --alerts=<csv> [--screened=<csv> | --volume=N]` | your own alert history: recall and false-alert rate per matcher and threshold, with n and interval; a sealed record and a report beside your file, never a name |
| `npm run optimise -- --from=<record> --recall=<min>` | the frontier: fewest alerts with the recall lower bound held, or `--alert-budget=<N>` for the highest bounded recall under a monthly alert budget |
| `npm run sceller -- <record.json>` | seal a record: the fingerprint that makes a silently edited measurement fail loudly — the same fingerprint as cascade-routing |
| `npm run verify -- <report>` | check that a report was issued by the holder of the suite's public key, `cle-publique.pem`, without asking us |
| `npm run licences` | regenerate `LICENCES.md`, the licence of every shipped package — `--check` fails the suite when the table drifts |
<!-- /figures:commandes -->

## Requirements

Node 24 or newer, on **macOS or Linux**. Windows has not been tested and is not claimed.

## What leaves your machine

Nothing, except one explicit download: `npm run listes -- --fetch` pulls the public lists
(OFAC SDN, EU consolidated, UN). Every other command runs with the network cut:
`CASCADE_OFFLINE=1` is honoured by the one module allowed to touch it, and a test walks the
sources so that no second one appears (`src/frontiere.test.ts`).

## What is measured, assumed, synthetic

Every rate in a report carries its `n` and its 95 % Wilson interval. Analyst minutes per
alert and analyst cost are **assumed** and declared. Perturbed variants of list entries are
**synthetic**, measured apart, and never merged into a measured recall. Below five confirmed
matches, no recall is quoted: the report says so.

## Seals and signatures

Records are sealed (`npm run sceller`) with the same fingerprint as cascade-routing, and
reports are verified against the same public key, [`cle-publique.pem`](cle-publique.pem),
with `npm run verify`.

<!-- figures:tests -->
**103 tests** across 11 files, counted from the sources rather than typed here.
**104 tests** across 11 files, counted from the sources rather than typed here.
<!-- /figures:tests -->

## Licence

The same public licence as cascade-routing: non-commercial use without limit of time, a
thirty-day evaluation on your own records for organisations, a commercial licence for
production. See [LICENSE](LICENSE) and [LICENCES.md](LICENCES.md).
