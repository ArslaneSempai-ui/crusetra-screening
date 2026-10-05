/**
 * THE WORD FREQUENCIES OF THE LISTS, AS A TABLE, AND THE TABLE IS PINNED. The word weights (IDF) come from the public
 * lists: reading and parsing them for every measurement cost a minute (measured on 28/09/2026: twelve measurements per
 * lane, four lanes per round). The table is a file of data/ and it IS committed (see .gitignore): it carries the weights
 * every frozen figure depends on, so a measurement replays on a fresh clone without the lists.
 *
 * WHY THE TABLE IS PINNED BY NAME AND HASH, NOT NAMED BY THE MANIFEST. Until 5 October 2026 the table was named by the
 * fingerprint of listes-manifest.json, and the screener counted the weights afresh over every list it screened. Adding a
 * list (or refreshing one) changed the manifest, so the name, so the weights, so every score: the GLEIF verdicts of
 * verification/, the rates on the written sets and the two thousand-name books would no longer have described the
 * matcher that ships. Three sources were added that day (AU, CA, NZ). The weights therefore stay those of TABLE_GELEE:
 * the table counted on 4 October 2026 over the seven sources of the manifest 885b92c2 (40,435 entries, 58,593 words),
 * the one verification/methode-gelee-gleif-4.json froze, read by the measurement tools AND by the screener. A list
 * screened with it that was not counted in it (the three new sources, a refreshed list) is weighed with these same
 * weights: a word absent from the table gets the weight the code gives a word seen in no entry, 1 + ln((N + 1) / 1)
 * (src/mots.ts, poidsDuMot), the highest weight there is: an unseen word is treated as the rarest.
 *
 * Moving the weights is a deliberate act, never a side effect of a download: `node src/frequences.ts --refaire` counts
 * the lists of the current manifest again and writes data/frequences.<manifest fingerprint>.json, and pinning that
 * table means changing TABLE_GELEE here, then measuring every published figure again (a new GLEIF verdict, the written
 * sets, the books). Until then nothing that reads frequencesDesListes() moves.
 *
 * WHAT THE NAME DOES NOT SEE: the code that cuts a name into words. A rule that changes the words leaves the table
 * stale without a sign (measured on 4 October 2026: 122 of 58,593 words). The guard is src/frequences.test.ts: whenever
 * the seven pinned lists are on disk at the hashes the table was counted on, the committed table must be the count the
 * code makes now over those seven.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from "node:fs";
import { isMain, refuserDrapeauxInconnus } from "./cli.ts";
import { frequencesDe, FREQUENCES_UNIFORMES, type Frequences } from "./entites.ts";
import { lireListe, lireManifeste, SOURCES, MANIFESTE, type EntreeListe, type Manifeste } from "./listes.ts";

const DOSSIER = new URL("../data/", import.meta.url);

/**
 * THE PINNED TABLE: the file, its SHA-256, the manifest it was counted on, and the seven lists with the content hash
 * each had then (listes-manifest.json of 4 October 2026, the lines kept as recorded by --only since). Every published
 * figure of verification/ and releve-entites.json was measured with these weights.
 */
export const TABLE_GELEE = {
  fichier: "frequences.885b92c25ddf5d30.json",
  sha256: "31351eec053292b01e7f435bd971f2d2349422d00c5081c8d5b0c6e8e582e2c7",
  entrees: 40435,
  mots: 58593,
  compteeLe: "2026-10-04",
  manifeste: "885b92c25ddf5d3026f48f3993c932feef56f5025f7a5efa2e8cad9d2bdbcb8e",
  listes: [
    { source: "OFAC", sha256: "d533a38ee0a8dc1dca61574cda864d1740ec6785f1ae93f00e678fdf01654227", entrees: 19391 },
    { source: "OFAC-CONS", sha256: "a9a394cfa9457ed166728cc89c7b3aa373ad457bc908b1cef71ae2e10b147c4f", entrees: 481 },
    { source: "CSL", sha256: "3bcdfb738dccf96a55a9fd1c0c205f0c212284ca031f81c115747fae510996ea", entrees: 6269 },
    { source: "UN", sha256: "8bd12c56c7acc2b7a3736d916b592c5382f7fe75191450e06aad799095fb2f68", entrees: 1011 },
    { source: "EU", sha256: "cd59eccb0278d33181c1d87814236109287c9ea5925502f00acfd2e0fd7fe440", entrees: 6241 },
    { source: "UK", sha256: "8e23b2d050ea2cc07319a19a7e71060f71ab560c979646c43f6efcec9e03250b", entrees: 6370 },
    { source: "EU-VESSELS", sha256: "2682ecf3442d2f16a3b36ef4d9bbb6fde43fd4d6743bcd991bd4a8e14857770b", entrees: 672 },
  ] as const satisfies readonly { source: EntreeListe["source"]; sha256: string; entrees: number }[],
} as const;

/** The pinned table on disk: data/frequences.885b92c25ddf5d30.json. */
export function cheminDeLaTableGelee(): URL {
  return new URL(TABLE_GELEE.fichier, DOSSIER);
}

/** The table a fresh count of the CURRENT manifest would be written to: data/frequences.<first 16 hex of the manifest's
 *  SHA-256>.json. It is the pinned table only while the manifest is the one the table was counted on. */
export function cheminDeLaTable(): URL {
  const empreinte = createHash("sha256").update(readFileSync(MANIFESTE)).digest("hex").slice(0, 16);
  return new URL(`frequences.${empreinte}.json`, DOSSIER);
}

/** The counts straight from the lists on disk, by the code as it stands, over `sources` (default: the seven pinned
 *  ones), in the order of SOURCES. Throws when a list is missing from disk or differs from its manifest hash
 *  (src/listes.ts, lireListe). About nine seconds and 600 MB on the seven sources, measured on 4 October 2026. */
export function compterLesListes(m: Manifeste, sources: readonly EntreeListe["source"][] = TABLE_GELEE.listes.map((l) => l.source)): Frequences {
  const dispo = SOURCES.filter((s) => sources.includes(s.source) && m.listes.some((l) => l.source === s.source && l.disponible));
  return frequencesDe(dispo.flatMap((s) => lireListe(s.source)).map((e) => [e.nom, ...e.alias]));
}

/** The table as it reads on disk. */
export function lireTable(chemin: URL): Frequences {
  const j = JSON.parse(readFileSync(chemin, "utf8")) as { entrees: number; df: [string, number][] };
  return { entrees: j.entrees, df: new Map(j.df) };
}

/** Writes the table whole or not at all: to a file of its own first, then renamed, so that a test process reading it
 *  while another writes never reads half a table. */
export function ecrireTable(chemin: URL, f: Frequences): void {
  mkdirSync(DOSSIER, { recursive: true });
  const provisoire = new URL(`${chemin.href}.${process.pid}.tmp`);
  writeFileSync(provisoire, JSON.stringify({ entrees: f.entrees, df: [...f.df.entries()] }));
  renameSync(provisoire, chemin);
}

/** Where two counts differ: the number of entries, then every word whose count is not the same on both sides. */
export function ecarts(table: Frequences, fraiche: Frequences): string[] {
  const d: string[] = [];
  if (table.entrees !== fraiche.entrees) d.push(`entries: ${table.entrees} in the table, ${fraiche.entrees} counted now`);
  for (const [mot, n] of fraiche.df) if (table.df.get(mot) !== n) d.push(mot);
  for (const mot of table.df.keys()) if (!fraiche.df.has(mot)) d.push(mot);
  return d;
}

/** The pinned lists that are on disk at the content hash the table was counted on, by the manifest; the others, named.
 *  When every one is there, a fresh count over them must equal the table. */
export function listesGeleesSurDisque(m: Manifeste | null, existe: (source: EntreeListe["source"]) => boolean): { presentes: EntreeListe["source"][]; absentes: string[] } {
  const presentes: EntreeListe["source"][] = [], absentes: string[] = [];
  for (const l of TABLE_GELEE.listes) {
    const ligne = m?.listes.find((x) => x.source === l.source);
    if (!ligne || !ligne.disponible) absentes.push(`${l.source} (not in the manifest)`);
    else if (ligne.sha256 !== l.sha256) absentes.push(`${l.source} (refreshed since the table was counted: ${ligne.sha256.slice(0, 8)}, table ${l.sha256.slice(0, 8)})`);
    else if (!existe(l.source)) absentes.push(`${l.source} (not on disk)`);
    else presentes.push(l.source);
  }
  return { presentes, absentes };
}

/**
 * THE WEIGHTS EVERY MEASUREMENT AND EVERY SCREENING READ: the pinned table, checked byte for byte against its recorded
 * hash. Never counted here: a table that differs from the one the figures were measured on is refused with the hash
 * seen, and --refaire is the way to count another one on purpose. Uniform only when no manifest exists at all, as
 * before (a pair set measured with no lists, which the measurement then says in its first line).
 */
export function frequencesDesListes(): Frequences {
  if (!lireManifeste()) return FREQUENCES_UNIFORMES;
  return lireTableVerifiee(cheminDeLaTableGelee(), TABLE_GELEE.sha256);
}

/** The table at `chemin`, only if its bytes hash to `sha256Attendu`; a missing or different file is refused with the
 *  hash seen, because a table that is not the pinned one would weigh every name differently from the published figures. */
export function lireTableVerifiee(chemin: URL, sha256Attendu: string): Frequences {
  const nom = chemin.pathname.split("/").slice(-1)[0]!;
  if (!existsSync(chemin)) throw new Error(`${nom} is missing from data/: the pinned word-weight table is committed, and every published figure depends on it. Nothing is measured.`);
  const sha = createHash("sha256").update(readFileSync(chemin)).digest("hex");
  if (sha !== sha256Attendu) {
    throw new Error(`data/${nom} is not the pinned table (sha256 ${sha.slice(0, 12)}, pinned ${sha256Attendu.slice(0, 12)}): `
      + `the weights every published figure was measured on would not be the ones used. Restore the committed file, or pin another table in src/frequences.ts and measure again.`);
  }
  return lireTable(chemin);
}

/** node src/frequences.ts --refaire: counts the available lists of the current manifest again by the code as it stands
 *  and writes the table the manifest names (not the pinned one, unless the manifest is still the pinned one). Without
 *  the flag: says whether the pinned table is the count the code makes now over the pinned lists, and touches nothing. */
async function principal(): Promise<void> {
  refuserDrapeauxInconnus(["--refaire"]);
  const m = lireManifeste();
  if (!m) { console.error("no listes-manifest.json: there is no table to count (npm run listes -- --fetch)."); process.exit(1); }
  if (process.argv.includes("--refaire")) {
    const chemin = cheminDeLaTable();
    const fraiche = compterLesListes(m, SOURCES.map((s) => s.source));
    const avant = existsSync(chemin) ? ecarts(lireTable(chemin), fraiche).length : null;
    ecrireTable(chemin, fraiche);
    const nom = chemin.pathname.split("/").slice(-1)[0]!;
    console.log(`data/${nom} rewritten: ${fraiche.entrees} entries, ${fraiche.df.size} words`
      + (avant === null ? " (there was no table)" : ` (${avant} differed from the table it replaces)`));
    if (nom !== TABLE_GELEE.fichier) {
      console.log(`This is NOT the pinned table (${TABLE_GELEE.fichier}): nothing reads it until TABLE_GELEE in src/frequences.ts names it,`
        + ` and pinning it means measuring every published figure again.`);
    }
    return;
  }
  const { presentes, absentes } = listesGeleesSurDisque(m, (source) => {
    try { lireListe(source); return true; } catch { return false; }
  });
  if (absentes.length) { console.error(`the pinned lists are not all on disk as counted (${absentes.join("; ")}): the pinned table cannot be checked against a fresh count here.`); process.exit(1); }
  const d = ecarts(frequencesDesListes(), compterLesListes(m, presentes));
  if (d.length) { console.error(`the pinned table is not the count the code makes now over the pinned lists (${d.length} differences, first: ${d.slice(0, 5).join(", ")}).`); process.exit(1); }
  console.log(`the pinned table is the count the code makes now over the ${presentes.length} pinned lists: ${TABLE_GELEE.entrees} entries, ${TABLE_GELEE.mots} words.`);
}

if (isMain(import.meta)) await principal();
