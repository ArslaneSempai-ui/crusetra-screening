/**
 * Le README qui ne peut pas périmer : ses tables sont GÉNÉRÉES, jamais tapées.
 *
 *   npm run figures            réécrit les blocs entre marqueurs
 *   node src/readme.ts --check refuse si un bloc ne correspond plus au code (la suite le lance)
 *
 * Deux blocs pour commencer, la forme de cascade-routing :
 *   commandes  la table des commandes, dans l'ordre où elles ont un sens
 *   tests      « N tests across M files » compté DANS LES SOURCES, jamais recopié
 *
 * Chaque commande ajoutée par un lot ajoute sa ligne ICI, pas dans le README : le README
 * suit. Un lot qui ajoute un test n'a rien à faire : le compte suit tout seul.
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { run, table } from "./figures.ts";
import { SOURCES, MODE_FICHIER_JETON_MAX } from "./listes.ts";
import { SEUIL_RETARD_UE_JOURS, TOLERANCE_APRES_GENERATION_UE_JOURS } from "./fraicheur-ue.ts";
import { MARGE_JOURS } from "./actes-ue.ts";

/** "7 days", "1 day": the two EU freshness limits are printed from the constants the rule uses, never typed here. */
const jours = (n: number) => `${n} day${n === 1 ? "" : "s"}`;

/* ─── les commandes, dans l'ordre où elles ont un sens ─── */
export const COMMANDES: [string, string][] = [
  ["npm ci --ignore-scripts", "install exactly the versions the lockfile pins, and run no install script from any dependency; it needs the network, like `listes -- --fetch` and `listes -- --actes`"],
  ["npm run listes [-- --fetch [--only=<sources>]]", `the ${SOURCES.length} public sanctions sources: OFAC SDN and OFAC consolidated (non-SDN), the US Consolidated Screening List (its Commerce and State lists; its Treasury rows come from the two OFAC files), UN consolidated, EU consolidated (FSF), the UK Sanctions List (individuals, entities and ships), the vessels the EU designates in Annex XLII of Regulation 833/2014 (read from the consolidated text of a dated version; a later sanctions package is not in it until that date is moved forward), Australia's DFAT Consolidated List, the Consolidated Canadian Autonomous Sanctions List and New Zealand's Russia Sanctions Register, downloaded into data/ with a committed manifest (source, date, sha256, entry count); without the flag it reports what is on disk and touches nothing. A personal EU Login token, if the public one is refused, is read from \`CRUSETRA_EU_TOKEN\` (\`CASCADE_EU_TOKEN\`, its deprecated name, still works), then from the file \`~/.cascade/eu-token\`, which is used only if it is a regular file you own that no one else can read (mode ${MODE_FICHIER_JETON_MAX.toString(8)} or stricter) and holds a single word no longer than a token: a link, another owner, a looser mode, a longer file or a value with a space or a line break inside makes it ignored, with one warning that names the file as ~/.cascade/eu-token (never the absolute path) and never the value. On Windows file modes mean nothing, so only the variables are read. The token goes in the request and is written nowhere. The EU row of that manifest also records what the freshness rule reads: the generationDate and the newest publicationDate of the file, the newest file the EU feed (RSS, no token) announces for it (read once per download), and the day of the last download that found the feed in agreement with the file. The EU list is stale when the feed announces a file published more than ${jours(TOLERANCE_APRES_GENERATION_UE_JOURS)} after the downloaded one was generated; when the newest evidence that the file is the latest (its generation, or that last confirming download) is more than ${jours(SEUIL_RETARD_UE_JOURS)} before the day of the run, which is how a failed daily update shows; or when a date in it is missing, impossible or later than it can be. A quiet week, in which the EU published nothing, is not stale: the file stays the latest and each download confirms it. A download that cannot confirm (feed unreadable, or a newer file announced) does not refresh that day. A stale list is marked in the row (the \`avertissement\` field); a feed that cannot be read is recorded with its reason and warned about, and is not stale by itself. The row stays available, the file is written and hashed, and \`--fetch\` prints the warning on a line marked ⚠. The lists download to your machine, and nothing of yours is sent`],
  ["npm run listes -- --actes", `the Journal watch. The EU file on disk can stop before an act and say nothing, so this asks the Publications Office catalogue one public question (a day and fixed words: no name, no token, nothing of yours) for the regulations and decisions titled as restrictive measures that it dates from ${jours(MARGE_JOURS)} before the newest publication in that file, and names, with CELEX, number, title and date, those whose number no numberTitle of the file carries. Each is named and none is a verdict: an act titled this way can renew or amend a regime and add no listing, so someone reads the act. The answer is read as data (a size cap, a row limit, strict JSON, every title cut and cleaned). Exit 1 when some act is absent; 0 when none is and at least one act of the answer is in the file, because an answer that shares nothing with the file cannot show that the question works; 2 when it could not ask or read (the Office refusing or silent, a body too large, too many rows, a file it cannot use), in which case it writes nothing and never reads as "no act is missing". The absent acts are written under \`donnees/listes/<date>.json\`, key \`actes_absents\`, in the directory it is run from. It runs alone, reads the EU file on disk, and is refused offline`],
  ["npm run poids [-- --fetch]", "the embed tier's weights: four files pinned by bytes and sha256, fetched only by this command (never during install or tests, refused offline) into data/models/: absent weights make an absent tier, named, not a surprise download"],
  ["npm run test", "types, the README blocks, the license inventory, and the suite. Start here; it runs with the network cut"],
  ["npm run measure [-- --yes-overwrite]", "the public measure: every tier at every threshold on pairs we authored (hard negatives included) plus declared synthetic variants, sealed into `releve-public.json` and readable in `RELEVE-PUBLIC.md`: the record the catalog requires, and it refuses to overwrite a sealed one without the flag"],
  ["npm run measure:yours -- --alerts=<csv> [--screened=<csv> | --volume=N]", "your own alert history: recall and false-alert rate per matcher and threshold, with n and interval; a sealed record and a report beside your file, never a name; with CRUSETRA_LOGIC_V2_PYTHON (or CASCADE_LOGIC_V2_PYTHON, its deprecated alias) naming the Python of an environment where you installed nomenklatura (pip install nomenklatura, MIT, never installed by this tool), OpenSanctions' logic-v2 is measured as one more matcher on the two names only, its version written in the record; without it the report says it is absent"],
  ["npm run cribler -- --names=<csv> [--client=<name>] [--previous=<record>]", "screen a list of counterparties (companies, vessels, IMO numbers) against every list on disk: each name gets its candidates, their list and score, at two levels. STRONG is measured: the lowest threshold that keeps false alerts, at the upper bound of their 95 % Wilson interval, under 5 % on the authored training pairs and under 1 % on real different companies from the GLEIF register. POSSIBLE is the level where the method saw a precise reason to doubt (a name found inside a longer one, a legal form of another country, a distinctive word on one side only, a short word one letter apart, a vessel number on one side) and the candidate is shown for review; it is kept there for a review budget of one name per forty counterparties. Rates at both levels come from a held-out set written by another hand, and are quoted in the record. With `--previous`, only what changed since the last record. A sealed record and a spreadsheet beside your file, no network. It refuses to run when the EU list is stale (the rule of the \`listes\` row, judged from the dates recorded in the manifest and the date of the run): the message names the list and its dates, the exit is non-zero, and no report, spreadsheet or sealed record is written; the other lists are not judged this way. It reads the generation date again from the EU file instead of trusting the manifest, but it cannot tell a forged download day from a real one: the manifest is a local, unsigned file. An English word list (web2, public domain) ships with the tool to tell a typo from another word"],
  ["npm run mesure-entites [-- --detail]", "the company and vessel matcher measured on the training pair sets: found names and false alerts at the strong and possible levels, the whole curve, and with `--detail` every pair missed or wrongly alerted; the held-out verdict set is never detailed"],
  ["npm run releve-entites [-- --check]", "the company and vessel matcher's public record, releve-entites.json: the training cells measured here, the realistic verdict every client report cites, the blind verdicts of the rounds and the two thousand-name books, each read from its source and frozen with the date and commit, then sealed with npm run sceller; --check refuses a record its sources no longer match"],
  ["npm run verdict [-- --version=vN]", "the single verdict on the held-out pair set: overlap with the training sets counted first, code hashes frozen, both levels with their intervals; no pair is read (see verification/JUGE.md)"],
  ["npm run temoin-index [-- --exhaustif]", "the screening index against the exhaustive comparison on the real lists (needs data/): same candidates, same scores, and the time per name"],
  ["npm run optimise -- --from=<record> --recall=<min>", "the best trade-off: fewest alerts with the recall lower bound held, or `--alert-budget=<N>` for the highest bounded recall under a monthly alert budget"],
  ["npm run sceller -- <record.json> [--check]", "seal a record: the content hash that makes a silently edited measurement fail loudly; the same content hash as Crusetra Routing. --check verifies and writes nothing: exit 0 when the seal holds, 1 when it is missing or no longer matches; without it, the command re-declares the seal on an edited file"],
  ["npm run verify -- <report>", "check that a report was issued by the holder of the suite's public key, `cle-publique.pem`, without asking us"],
  ["npm run licences", "regenerate `LICENCES.md`, the license of every shipped package; `--check` fails the suite when the table drifts"],
];

/* ─── le compte des tests, lu dans les sources ─── */
const dossier = fileURLToPath(new URL(".", import.meta.url));

/** Les extensions de fichiers de test que le script `test` de package.json lance vraiment. */
export function extensionsLancees(scriptTest: string): string[] {
  return [...scriptTest.matchAll(/src\/\*(\.test\.[a-z]+)/g)].map((m) => m[1]!);
}

/** Compte les `test(` dans les fichiers que la commande de test lance — pas dans ceux qu'on
 *  aurait choisis ici. */
export function compterLesCas(dossierSrc: string, scriptTest: string): { n: number; fichiers: string[] } {
  const extensions = extensionsLancees(scriptTest);
  const fichiers = readdirSync(dossierSrc).filter((f) => extensions.some((e) => f.endsWith(e))).sort();
  let n = 0;
  for (const f of fichiers) {
    const src = readFileSync(join(dossierSrc, f), "utf8");
    n += [...src.matchAll(/^\s*test\s*\(/gm)].length;
  }
  return { n, fichiers };
}

const scriptTest = String(JSON.parse(
  readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8"),
).scripts?.test ?? "");

/* TÉMOIN AVANT LE COMPTE : si le motif cesse de lire le script, le compte porterait sur un
   ensemble choisi ici plutôt que sur celui qui tourne. */
if (extensionsLancees(scriptTest).length < 2) {
  throw new Error("the `test` script in package.json no longer names the test extensions it runs; the count would lie.");
}
const { n, fichiers } = compterLesCas(dossier, scriptTest);
if (n < 5) throw new Error(`${n} tests counted across ${fichiers.length} file(s): the reading failed.`);

/* ─── les sources et leurs licences, lues dans SOURCES : la mention exigée s'imprime ici, pas de mémoire ─── */
const cellule = (t: string) => t.replace(/\|/g, "\\|").replace(/\n/g, " ");

const blocs = {
  commandes: table(["Command", "What it does, in the order that makes sense"],
    COMMANDES.map(([c, quoi]) => [`\`${c}\``, quoi])),
  sources: table(["Source", "What it is", "License", "Attribution required", "Publisher's page, read on"],
    SOURCES.map((s) => [s.source, cellule(s.titre), cellule(s.licence.nom), s.licence.mention === null ? "none required" : cellule(s.licence.mention), `${s.licence.url} (${s.licence.lue})`])),
  tests: `**${n} tests** across ${fichiers.length} files, counted from the sources rather than typed here.`,
};

run(fileURLToPath(new URL("../README.md", import.meta.url)), blocs);
