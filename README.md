# Crusetra · Screening

**Which name matcher suffices, at which threshold, measured on your own alert history.**
Nothing of yours goes up: the lists come down, your alerts stay on your machine.

It also screens a list of counterparties (companies, vessels, IMO numbers) against ten public
sanctions sources, on your machine: see `npm run cribler` below and [the sources and their
licenses](#the-sources-and-their-licenses). Its rates on real company names, measured on the
GLEIF register, are in `verification/GLEIF.md`.

Name screening (sanctions, PEP, internal lists) raises alerts; most of them are false, and
nobody can say why the threshold sits at 85 rather than 90 except "that is the vendor's
setting". This tool measures it: several matchers, from exact to phonetic to a local
embedding model, are run over the alerts your analysts already dispositioned, and each
matcher × threshold cell is read for recall on confirmed matches, false-alert rate and
alerts per thousand screenings, with its count and its interval, or not at all.

It is the second tool of the Crusetra suite. The first, [Crusetra Routing](https://github.com/ArslaneSempai-ui/crusetra-routing),
measures which extraction tier suffices per field. Same method, same seal, same key.

<!-- figures:commandes -->
| Command | What it does, in the order that makes sense |
|---|---|
| `npm ci --ignore-scripts` | install exactly the versions the lockfile pins, and run no install script from any dependency; the only command besides `listes -- --fetch` that needs the network |
| `npm run listes [-- --fetch [--only=<sources>]]` | the 10 public sanctions sources: OFAC SDN and OFAC consolidated (non-SDN), the US Consolidated Screening List (its Commerce and State lists; its Treasury rows come from the two OFAC files), UN consolidated, EU consolidated (FSF), the UK Sanctions List (individuals, entities and ships), the vessels the EU designates in Annex XLII of Regulation 833/2014 (read from the consolidated text of a dated version; a later sanctions package is not in it until that date is moved forward), Australia's DFAT Consolidated List, the Consolidated Canadian Autonomous Sanctions List and New Zealand's Russia Sanctions Register, downloaded into data/ with a committed manifest (source, date, sha256, entry count); without the flag it reports what is on disk and touches nothing. The lists download to your machine, and nothing of yours is sent |
| `npm run poids [-- --fetch]` | the embed tier's weights: four files pinned by bytes and sha256, fetched only by this command (never during install or tests, refused offline) into data/models/: absent weights make an absent tier, named, not a surprise download |
| `npm run test` | types, the README blocks, the license inventory, and the suite. Start here; it runs with the network cut |
| `npm run measure [-- --yes-overwrite]` | the public measure: every tier at every threshold on pairs we authored (hard negatives included) plus declared synthetic variants, sealed into `releve-public.json` and readable in `RELEVE-PUBLIC.md`: the record the catalog requires, and it refuses to overwrite a sealed one without the flag |
| `npm run measure:yours -- --alerts=<csv> [--screened=<csv> | --volume=N]` | your own alert history: recall and false-alert rate per matcher and threshold, with n and interval; a sealed record and a report beside your file, never a name; with CRUSETRA_LOGIC_V2_PYTHON (or CASCADE_LOGIC_V2_PYTHON, its deprecated alias) naming the Python of an environment where you installed nomenklatura (pip install nomenklatura, MIT, never installed by this tool), OpenSanctions' logic-v2 is measured as one more matcher on the two names only, its version written in the record; without it the report says it is absent |
| `npm run cribler -- --names=<csv> [--client=<name>] [--previous=<record>]` | screen a list of counterparties (companies, vessels, IMO numbers) against every list on disk: each name gets its candidates, their list and score, at two levels. STRONG is measured: the lowest threshold that keeps false alerts, at the upper bound of their 95 % Wilson interval, under 5 % on the authored training pairs and under 1 % on real different companies from the GLEIF register. POSSIBLE is the level where the method saw a precise reason to doubt (a name found inside a longer one, a legal form of another country, a distinctive word on one side only, a short word one letter apart, a vessel number on one side) and the candidate is shown for review; it is kept there for a review budget of one name per forty counterparties. Rates at both levels come from a held-out set written by another hand, and are quoted in the record. With `--previous`, only what changed since the last record. A sealed record and a spreadsheet beside your file, no network; an English word list (web2, public domain) ships with the tool to tell a typo from another word |
| `npm run mesure-entites [-- --detail]` | the company and vessel matcher measured on the training pair sets: found names and false alerts at the strong and possible levels, the whole curve, and with `--detail` every pair missed or wrongly alerted; the held-out verdict set is never detailed |
| `npm run releve-entites [-- --check]` | the company and vessel matcher's public record, releve-entites.json: the training cells measured here, the realistic verdict every client report cites, the blind verdicts of the rounds and the two thousand-name books, each read from its source and frozen with the date and commit, then sealed with npm run sceller; --check refuses a record its sources no longer match |
| `npm run verdict [-- --version=vN]` | the single verdict on the held-out pair set: overlap with the training sets counted first, code hashes frozen, both levels with their intervals; no pair is read (see verification/JUGE.md) |
| `npm run temoin-index [-- --exhaustif]` | the screening index against the exhaustive comparison on the real lists (needs data/): same candidates, same scores, and the time per name |
| `npm run optimise -- --from=<record> --recall=<min>` | the best trade-off: fewest alerts with the recall lower bound held, or `--alert-budget=<N>` for the highest bounded recall under a monthly alert budget |
| `npm run sceller -- <record.json> [--check]` | seal a record: the content hash that makes a silently edited measurement fail loudly; the same content hash as Crusetra Routing. --check verifies and writes nothing: exit 0 when the seal holds, 1 when it is missing or no longer matches; without it, the command re-declares the seal on an edited file |
| `npm run verify -- <report>` | check that a report was issued by the holder of the suite's public key, `cle-publique.pem`, without asking us |
| `npm run licences` | regenerate `LICENCES.md`, the license of every shipped package; `--check` fails the suite when the table drifts |
<!-- /figures:commandes -->

## The sources and their licenses

Ten public lists, each read in the format its publisher offers. The license of each was read on the
publisher's own page on the date shown, never on a third party's; where a license requires an
attribution statement, the statement below is the one it requires, word for word, and the screener
carries it in its record (`.screening.json`: the `licence` of each list, and `attributions`) and in
its spreadsheet (column `list_licence`, on every candidate row). Reproduce it with any extract of a
report. `npm run licences -- --check` fails when a source lacks its license, its page or its
statement, and `LICENCES.md` repeats this table for a procurement review.

<!-- figures:sources -->
| Source | What it is | License | Attribution required | Publisher's page, read on |
|---|---|---|---|---|
| OFAC | OFAC Specially Designated Nationals (SDN) list | United States Government work: not subject to copyright (17 U.S.C. § 105) | none required | https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title17-section105&num=0&edition=prelim (2026-10-05) |
| OFAC-CONS | OFAC Consolidated Sanctions List (the non-SDN lists) | United States Government work: not subject to copyright (17 U.S.C. § 105) | none required | https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title17-section105&num=0&edition=prelim (2026-10-05) |
| CSL | US Consolidated Screening List: its Commerce and State lists (trade.gov) | United States Government work: not subject to copyright (17 U.S.C. § 105) | none required | https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title17-section105&num=0&edition=prelim (2026-10-05) |
| UN | UN Security Council Consolidated List | United Nations website Terms of Use (no open license) | none required | https://www.un.org/en/about-us/terms-of-use (2026-10-05) |
| EU | EU consolidated financial sanctions list (FSF, XML v1.1) | Commission Decision 2011/833/EU on the reuse of Commission documents; Creative Commons Attribution 4.0 International (CC BY 4.0) | Source: European Commission, Financial Sanctions Files (FSF), © European Union, reused under Commission Decision 2011/833/EU (CC BY 4.0) | https://commission.europa.eu/legal-notice_en (2026-10-05) |
| UK | UK Sanctions List (FCDO): individuals, entities and ships | Open Government Licence v3.0 | Contains public sector information licensed under the Open Government Licence v3.0. | https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/ (2026-10-05) |
| EU-VESSELS | EU designated vessels: Annex XLII of Regulation (EU) No 833/2014, consolidated text 2026-07-24 | Commission Decision 2011/833/EU on the reuse of Commission documents; consolidated texts under Creative Commons Attribution 4.0 International (CC BY 4.0), Publications Office (EUR-Lex) | © European Union, 1998-2026. Source: EUR-Lex, consolidated text of Regulation (EU) No 833/2014 (Annex XLII), reused under Commission Decision 2011/833/EU (CC BY 4.0) | https://eur-lex.europa.eu/content/legal-notice/legal-notice.html (2026-10-05) |
| AU | Australia: DFAT Consolidated List (Australian Sanctions Office) | Creative Commons Attribution 4.0 International (CC BY 4.0), Commonwealth of Australia (DFAT) | Department of Foreign Affairs and Trade website – www.dfat.gov.au | https://www.dfat.gov.au/about-us/about-this-website/copyright (2026-10-05) |
| CA | Canada: Consolidated Canadian Autonomous Sanctions List (Global Affairs Canada) | Open Government Licence - Canada | Contains information licensed under the Open Government Licence – Canada. | https://open.canada.ca/en/open-government-licence-canada (2026-10-05) |
| NZ | New Zealand: Russia Sanctions Register (MFAT): individuals, entities and ships | Creative Commons Attribution 4.0 International (CC BY 4.0), Crown copyright (Ministry of Foreign Affairs and Trade) | Source: New Zealand Ministry of Foreign Affairs and Trade, Russia Sanctions Register, Crown copyright, licensed under CC BY 4.0 | https://www.mfat.govt.nz/en/copyright (2026-10-05) |
<!-- /figures:sources -->

Three things the table does not say:

- **The UN consolidated list has no open license.** The UN website's Terms of Use grant Users
  permission to download and copy the Materials for personal, non-commercial use, without any right
  to resell or redistribute them; the list's own page says the list exists to facilitate the
  implementation of the measures. Commercial reuse is not settled by the publisher's page and is to
  be confirmed with the United Nations before a sale; no attribution wording is prescribed.
- **Not ingested.** Switzerland's SECO list (SESAM): the federal administration's terms state that
  reproduction requires the prior written consent of the copyright holder; a request for that consent
  is drafted and not sent, and the list is not read until it is answered. Ukraine's NSDC list: its
  commercial terms are unresolved, so it is not read either.
- **The UN 1718 Committee's designated vessels** (26 vessels, published as a PDF only) are not in the
  UN consolidated XML this tool reads: the consolidated list holds individuals and entities, and the
  only IMO numbers in it are company numbers. They are not a separate source here because every one
  of the 26 is already carried, with its IMO number, by the UK Sanctions List (17 as ships of the
  DPRK regime) or by OFAC (23), 26 of 26 by the union, measured on 5 October 2026 on the files of
  the manifest. A PDF is not a record this tool can read; if one of the 26 ever leaves the UK and
  OFAC lists, that proof is to be made again.

## What the screening record carries, per candidate

Beside the listed name, its list, its score and the level, each candidate of `.screening.json` (and
each row of the spreadsheet) carries four fields a reviewer asks for, none of them inferred:

1. **Designation date**, as the list states it, with the field it comes from and the source
   (`designation`: `date`, `champ`, `source`; columns `designated_on`, `designation_field`). OFAC
   publishes none in its files: the field says `not published by OFAC`. A list that has the field
   and left it empty for an entry says `not stated by <source> for this entry`.
2. **Parties the list itself names for this entry** (`parties`; column `named_parties`): the owner or
   operator of a vessel, a "Linked To", the associates a register names, verbatim, with the role as
   the list writes it and the source. Only structured fields enter here (OFAC `vesselOwner` and
   `Linked To`, UK `CurrentOwnerOperator` and `PreviousOwnerOperator`, CSL `vessel_owner`, MFAT
   `Associates/Relatives`); free text never does, and nothing is taken from another entry.
3. **Renamed ship** (`renomme`; column `renamed_ship_listed_names`): the candidate was found by the
   IMO rule, and the name you sent stays below the possible threshold against every name the list
   gives that hull; the listed names are given so the reviewer sees the rename instead of a
   stranger at the strong level.
4. **Vessel screened without IMO** (`navireSansImo`; column `vessel_without_imo`, on every row of the
   counterparty): the row is a vessel by your own `type` column, or by an explicit marker in the name
   (a prefix written with its slash such as M/V, M/T, LNG/C, T/H, a leading "motor vessel", or a type
   in parentheses at the end such as "(tanker)"), and no readable IMO number was given, so the IMO rule,
   which decides, could not apply. The marker list is deliberately narrow: "MV Agusta", "MT Bank" or
   "Barge Transport Services" do not flag.

**Word weights are pinned.** The weights every score depends on are those of the committed table
`data/frequences.885b92c25ddf5d30.json`, counted on 4 October 2026 over the seven sources of that
day's manifest (40,435 entries), the table every published rate was measured on; the record names it
(`methode.tablePoids`). The three sources added on 5 October 2026 are screened with those same
weights, and a word absent from the table weighs as a word seen in no listed entry, the highest
weight there is (`src/mots.ts`, `poidsDuMot`). Adding or refreshing a list therefore moves no
published figure; moving the weights is a deliberate act (`node src/frequences.ts --refaire`, then
`TABLE_GELEE` in `src/frequences.ts`, then every figure measured again).

## Requirements

Node 24 or newer, on **macOS, Linux or Windows**: the whole test suite runs on all three at every push to main, on GitHub's runners (`.github/workflows/tests.yml`). Nobody has yet run the tool on a client's Windows machine, and this page does not claim it.

## What leaves your machine

Nothing, except two explicit downloads: `npm run listes -- --fetch` pulls the ten public sources
named above, and `npm run poids -- --fetch` pulls the embed tier's weights. Every other command
runs with the network cut:
`CRUSETRA_OFFLINE=1` (or `CASCADE_OFFLINE=1`, its deprecated alias) is honored by the one
module allowed to touch it, and a test reads every source so that no second one appears
(`src/frontiere.test.ts`).

## What is measured, assumed, synthetic

Every rate in a report carries its `n` and its 95 % Wilson interval. Analyst minutes per
alert and analyst cost are **assumed** and declared. Perturbed variants of list entries are
**synthetic**, measured apart, and never merged into a measured recall. Below five confirmed
matches, no recall is quoted, and the report states why.

## Trust package

For a procurement or compliance review: [what the tool talks to, and when](doc/DATA-FLOW.md), [running on a machine without network](doc/OFFLINE.md), [a pre-filled vendor security questionnaire](doc/SECURITY-QUESTIONNAIRE.md), and [a pilot annex of outsourcing clauses](doc/PILOT-TERMS.md), a draft for counsel.

## Seals and signatures

Records are sealed (`npm run sceller`) with the same content hash as Crusetra Routing, and
reports are verified against the same public key, [`cle-publique.pem`](cle-publique.pem),
with `npm run verify`.

<!-- figures:tests -->
**486 tests** across 64 files, counted from the sources rather than typed here.
<!-- /figures:tests -->

## License

The same public license as Crusetra Routing: non-commercial use without limit of time, a
thirty-day evaluation on your own records for organizations, a commercial license for
production. See [LICENSE](LICENSE) and [LICENCES.md](LICENCES.md).
