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
| `npm run listes -- --fetch` | sanctionslist.fcdo.gov.uk | download | the UK Sanctions List |
| `npm run listes -- --fetch` | publications.europa.eu | download | the consolidated text of Regulation (EU) No 833/2014, for the vessels of its Annex XLII (the Office answers with a redirection to an http address of its store) |
| `npm run listes -- --fetch` | www.dfat.gov.au | download | Australia's DFAT Consolidated List |
| `npm run listes -- --fetch` | www.international.gc.ca | download | the Consolidated Canadian Autonomous Sanctions List |
| `npm run listes -- --fetch` | www.mfat.govt.nz | download | New Zealand's Russia Sanctions Register |
| `npm run poids -- --fetch` | huggingface.co | download | the optional embedding tier: four files of `Xenova/multilingual-e5-small` at a pinned revision, checked by size and sha256 |

Each download is recorded in `listes-manifest.json` with its source, date, sha256 and entry
count, so a report can say which version of each list it was screened against.

`CASCADE_OFFLINE=1` makes even the downloader refuse, with a message that names the flag.
`npm run test` runs with the network cut.

## What the tool writes

Only beside your input file: the sealed report (`<file>.screening.json`) and its spreadsheet
(`<file>.screening.csv`). It writes nothing elsewhere and keeps no copy.
