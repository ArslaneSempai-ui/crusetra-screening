/**
 * THE WORD FREQUENCIES OF THE LISTS, AS A TABLE. The word weights (IDF) come from the public lists of the manifest:
 * reading and parsing them for every measurement cost a minute (measured on 28/09/2026: twelve measurements per lane,
 * four lanes per round). The table is a file of data/ named by the fingerprint of the manifest, and it IS committed
 * (see .gitignore): it carries the weights every frozen figure depends on, so a measurement replays on a fresh clone
 * without the lists. A refreshed list changes the manifest, so the name, so the table is counted again. Nothing comes
 * in here that does not come from the lists: no client's name.
 *
 * WHAT THE NAME DOES NOT SEE: the code that cuts a name into words. A rule that changes the words (the Bulgarian hard
 * sign read as a vowel before a consonant, src/preparation.ts, 4 October 2026) leaves the manifest, so the name, as it
 * was, and the table keeps the old counts. Measured on 4 October 2026: the table committed in 617e771, counted at 17:45
 * before that rule was written, differed from a fresh count by the same commit's code on 122 of 58,593 words, while the
 * screener (src/cribler.ts), which counts afresh at every screening, used the new counts. The measurement tools and the
 * screener weighed those words differently. The guard is src/frequences.test.ts: whenever the lists are on disk, the
 * committed table must be the count the code makes now; when it is not, `node src/frequences.ts --refaire` counts again.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from "node:fs";
import { isMain, refuserDrapeauxInconnus } from "./cli.ts";
import { frequencesDe, FREQUENCES_UNIFORMES, type Frequences } from "./entites.ts";
import { lireListe, lireManifeste, SOURCES, MANIFESTE, type Manifeste } from "./listes.ts";

const DOSSIER = new URL("../data/", import.meta.url);

/** The table named by the manifest on disk: data/frequences.<first 16 hex of the manifest's SHA-256>.json. */
export function cheminDeLaTable(): URL {
  const empreinte = createHash("sha256").update(readFileSync(MANIFESTE)).digest("hex").slice(0, 16);
  return new URL(`frequences.${empreinte}.json`, DOSSIER);
}

/** The counts straight from the available lists of the manifest, by the code as it stands (reads every list; about
 *  nine seconds and 600 MB on the seven sources, measured on 4 October 2026). Throws when a list is missing from disk or
 *  differs from its manifest hash (src/listes.ts, lireListe). */
export function compterLesListes(m: Manifeste): Frequences {
  const dispo = SOURCES.filter((s) => m.listes.some((l) => l.source === s.source && l.disponible));
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

/** The frequencies of the available lists, read from the table when the manifest has not moved, counted and written
 *  otherwise; uniform when no list is there (the measurement then says so in its first line). */
export function frequencesDesListes(): Frequences {
  const m = lireManifeste();
  if (!m) return FREQUENCES_UNIFORMES;
  const chemin = cheminDeLaTable();
  if (existsSync(chemin)) return lireTable(chemin);
  const f = compterLesListes(m);
  ecrireTable(chemin, f);
  return f;
}

/** node src/frequences.ts --refaire: counts the lists again by the code as it stands and rewrites the table the
 *  manifest names. Without the flag: says whether the table is that count, and touches nothing. */
async function principal(): Promise<void> {
  refuserDrapeauxInconnus(["--refaire"]);
  const m = lireManifeste();
  if (!m) { console.error("no listes-manifest.json: there is no table to count (npm run listes -- --fetch)."); process.exit(1); }
  const chemin = cheminDeLaTable();
  const fraiche = compterLesListes(m);
  if (process.argv.includes("--refaire")) {
    const avant = existsSync(chemin) ? ecarts(lireTable(chemin), fraiche).length : null;
    ecrireTable(chemin, fraiche);
    console.log(`${chemin.pathname.split("/").slice(-2).join("/")} rewritten: ${fraiche.entrees} entries, ${fraiche.df.size} words`
      + (avant === null ? " (there was no table)" : ` (${avant} differed from the table it replaces)`));
    return;
  }
  const d = existsSync(chemin) ? ecarts(lireTable(chemin), fraiche) : ["the table is missing"];
  if (d.length) { console.error(`the table is not the count the code makes now (${d.length} differences): node src/frequences.ts --refaire`); process.exit(1); }
  console.log(`the table is the count the code makes now: ${fraiche.entrees} entries, ${fraiche.df.size} words.`);
}

if (isMain(import.meta)) await principal();
