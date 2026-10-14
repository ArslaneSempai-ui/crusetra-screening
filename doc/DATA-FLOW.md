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
| `npm run listes -- --fetch` | webgate.ec.europa.eu | download | the EU consolidated financial sanctions list (public token, or your own in `CRUSETRA_EU_TOKEN`, in its deprecated name `CASCADE_EU_TOKEN`, or in the file `~/.cascade/eu-token`, read only when it is a regular file you own that no one else can read and that holds a single word no longer than a token, never on Windows, where only the variables count; the token goes in the request only, and every new manifest and every new sealed record writes `token=[username]` in its place; records and manifest lines written before keep what they were written with until the next fetch or seal); each download also reads the EU feed (RSS) of the same host, which takes no token |
| `npm run listes -- --fetch` | sanctionslist.fcdo.gov.uk | download | the UK Sanctions List |
| `npm run listes -- --fetch` | publications.europa.eu | download | the consolidated text of Regulation (EU) No 833/2014, for the vessels of its Annex XLII (the Office answers with a redirection to an http address of its store) |
| `npm run listes -- --actes` | publications.europa.eu | query | the Publications Office catalogue (SPARQL), asked one question per run: which regulations and decisions titled as restrictive measures it dates from a margin before the newest publication in the EU file on disk. The address carries that question and nothing else (a day and fixed words: no name, no client data, no token, no cookie); the answer is read as data (a size cap applied while the body is read, a row limit, strict JSON, a redirect refused); an answer the Office flags as partial (a status other than 200, X-SQL-State, X-SQL-Message, Warning, Content-Range, any header saying partial or truncated) is refused; and a failure to ask or to read, or an answer that does not hold every act the file carries on its newest publication day, is exit 2, never "no act is missing" |
| `npm run listes -- --fetch` | www.dfat.gov.au | download | Australia's DFAT Consolidated List |
| `npm run listes -- --fetch` | www.international.gc.ca | download | the Consolidated Canadian Autonomous Sanctions List |
| `npm run listes -- --fetch` | www.mfat.govt.nz | download | New Zealand's Russia Sanctions Register |
| `npm run poids -- --fetch` | huggingface.co | download | the optional embedding tier: four files of `Xenova/multilingual-e5-small` at a pinned revision, checked by size and sha256 |

Each download is recorded in `listes-manifest.json` with its source, date, sha256 and entry
count, so a report can say which version of each list it was screened against. The EU row also
carries `actes`, the distinct act numbers of the file's own year (the year of its generationDate):
plain public numbers, one line per act number in the manifest, so the row grows with the acts of the
year and is not bounded; the count is read from the file and is not written here.

Each EU download also reads the EU feed once (RSS, no token, nothing of yours sent) and records, in
the EU row, what the freshness rule reads: the generationDate and the newest publicationDate of
the file, the newest file the feed announces for it, and the day of the last download that found
the feed in agreement with the file. The EU list is stale when the feed announces a file
published more than 1 day after the downloaded one was generated; when the newest evidence that
the file is the latest (its generation, or that last confirming download) is more than 7 days
before the day of the run, which is how a failed daily update shows; or when a date in it is
missing, impossible or later than it can be (`src/fraicheur-ue.ts`). A quiet week, in which the
EU published nothing, is not stale: the file stays the latest and each download confirms it. A
download that cannot confirm (feed unreadable, or a newer file announced) does not refresh that
day, and a feed that cannot be read is recorded with its reason and is not stale by itself. A
stale list is marked in the field `avertissement`, the one OFAC's record count check already
uses: the row stays available, the file is written and its hash recorded, `npm run listes --
--fetch` prints the warning on a line marked ⚠, and its text passes through the same token
redaction as every other string of the manifest.

`npm run cribler`, which never touches the network, refuses to run when the EU list is stale by
that rule. It decides from the dates recorded in the manifest and the date of the run: the exit
is non-zero, the message names the list and its dates, and no report, spreadsheet or sealed
record is written. The other lists are not judged this way. It does not trust the file dates written in
the manifest: it reads the generationDate again from the EU file on disk (after checking the
file's hash against the manifest), and refuses when that differs from the recorded one, when the
file cannot be read, or when the freshness record is not a record. What it cannot see is a forged
download day: the manifest is a local, unsigned file, so anyone who can edit it can say that a
download confirmed the file today. The rule keeps an honest manifest honest; it is not a defense
against the person who owns it.

`npm run listes -- --actes` is the one command here that sends something, and what it sends is a
fixed public question about the Official Journal, not a name from your files. It writes, in the
directory it is run from, `donnees/listes/<date>.json`: the key `actes_absents`, one entry per act
the EU file does not carry (CELEX, number, title and date of the act, as the Office's catalogue gives
them). That folder is local data, never part of a report. A day with a file already there keeps every
other byte: only the value of `actes_absents` is replaced or added, in place. The comparison is on
the act number, which relies on one number per act in a year: if the answer ever holds two CELEX
with the same number, the output says so in a NOTE, because one carried number would hide both.
The canary (the acts the file carries on its newest publication day must be in the answer) is brittle
on purpose: an act of that day the question cannot return, such as Regulation 1210/2003 on Iraq
whose title has no "restrictive measure", a catalogue that lags the Journal, or a corrigendum, makes
the run exit 2 and name it, and the run heals within days as newer acts become the file's newest day;
if it proves too noisy, the narrower canary is only the acts carried by `regulation` elements with a
programme and numbered in the file's year. An incomplete answer still prints the absent acts it found,
labelled as such (it can lose rows, it cannot invent an act), and writes nothing.

`CRUSETRA_OFFLINE=1` makes even the downloader refuse, with a message that names the flag.
`CASCADE_OFFLINE=1`, its deprecated name, still refuses exactly as before.
`npm run test` runs with the network cut.

## What the tool writes

Only beside your input file: the sealed report (`<file>.screening.json`) and its spreadsheet
(`<file>.screening.csv`). It writes nothing elsewhere and keeps no copy.
