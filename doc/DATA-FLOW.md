# What this tool talks to, and when

The whole tool runs on your machine. Nothing of yours is sent anywhere: no telemetry, no
crash reports, no licence check-in, no automatic update. The table names every host the
tool can contact, the command that contacts it, and the direction. Every other command runs
with the network cut, and a test reads every source file so that no second network call can
appear unnoticed (`src/frontiere.test.ts`).

| Command | Host | Direction | What |
|---|---|---|---|
| `npm ci --ignore-scripts` | registry.npmjs.org | download | the dependencies, at the exact versions the lockfile pins; no install script of any dependency is run |
| `npm run listes -- --fetch` | sanctionslistservice.ofac.treas.gov | download | OFAC SDN and OFAC consolidated (non-SDN) lists |
| `npm run listes -- --fetch` | data.trade.gov | download | the US Consolidated Screening List (Commerce and State lists) |
| `npm run listes -- --fetch` | scsanctions.un.org | download | the UN consolidated list |
| `npm run listes -- --fetch` | webgate.ec.europa.eu | download | the EU consolidated financial sanctions list (public token, or your own in `CASCADE_EU_TOKEN`) |
| `npm run poids -- --fetch` | huggingface.co | download | the optional embedding tier: four files of `Xenova/multilingual-e5-small` at a pinned revision, checked by size and sha256 |

Each download is recorded in `listes-manifest.json` with its source, date, sha256 and entry
count, so a report can say which version of each list it was screened against.

`CASCADE_OFFLINE=1` makes even the downloader refuse, with a message that names the flag.
`npm run test` runs with the network cut.

## What the tool writes

Only beside your input file: the sealed report (`<file>.screening.json`) and its spreadsheet
(`<file>.screening.csv`). It writes nothing elsewhere and keeps no copy.
