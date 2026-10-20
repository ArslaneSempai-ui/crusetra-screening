/**
 * The test fixtures keep their publishers' licences. Each file of src/fixtures is named here with the publisher whose
 * format (and whatever content) it carries; LICENCES.md and the README print the sentence built from this table, and
 * `licences.ts --check` refuses a fixture that is not named here, or a name here with no file behind it.
 */
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SOURCES } from "./listes.ts";

export const DOSSIER_FIXTURES = fileURLToPath(new URL("./fixtures/", import.meta.url));

/** file -> the code of a source of SOURCES, or a publisher named in full, or null for a file drawn from our own pair sets */
export const EDITEUR_DES_FIXTURES: Record<string, string | null> = {
  "canada.xml": "CA",
  "csl.csv": "CSL",
  "dfat.xlsx": "AU",
  "mfat.xlsx": "NZ",
  "navires-ue.xhtml": "EU-VESSELS",
  "ofac.xml": "OFAC",
  "onu.xml": "UN",
  "royaume-uni.xml": "UK",
  "ue.xml": "EU",
  "ue-rss.xml": "EU",
  "ue-2026-2193-annex-iv.txt": "the Official Journal of the European Union (EUR-Lex), reused under Commission Decision 2011/833/EU",
  "ue-2026-2193-source.json": "the Official Journal of the European Union (EUR-Lex), reused under Commission Decision 2011/833/EU",
  "paires-parallele.json": null,
};

/** What is wrong between the folder and the table: a file not named, or a name with no file. */
export function manquesDesFixtures(fichiers: readonly string[] = readdirSync(DOSSIER_FIXTURES)): string[] {
  const nommes = new Set(Object.keys(EDITEUR_DES_FIXTURES));
  const codes = new Set<string>(SOURCES.map((s) => s.source));
  return [
    ...fichiers.filter((f) => !nommes.has(f)).map((f) => `src/fixtures/${f} has no publisher in src/fixtures-licences.ts`),
    ...[...nommes].filter((f) => !fichiers.includes(f)).map((f) => `src/fixtures-licences.ts names ${f}, which is not in src/fixtures`),
    ...Object.entries(EDITEUR_DES_FIXTURES).filter(([, e]) => e !== null && /^[A-Z-]+$/.test(e) && !codes.has(e)).map(([f, e]) => `${f}: ${e} is not a source of SOURCES`),
  ];
}

/** The sentence LICENCES.md and the README print, built from the table, never typed. */
export function phraseDesFixtures(): string {
  const tiers = Object.entries(EDITEUR_DES_FIXTURES).filter(([, e]) => e !== null).sort(([a], [b]) => a.localeCompare(b));
  const nous = Object.entries(EDITEUR_DES_FIXTURES).filter(([, e]) => e === null).map(([f]) => `\`${f}\``).sort();
  return "The test fixtures in `src/fixtures` are small samples in each publisher's own format, read only by the tests. "
    + "They are not covered by this repository's licence: whatever publisher content they keep stays under that publisher's licence and attribution, "
    + "given in the table of sources above. "
    + tiers.map(([f, e]) => `\`${f}\` (${e})`).join("; ") + ". "
    + (nous.length > 0 ? `${nous.join(", ")}: drawn from this repository's own pair sets, under its licence. ` : "")
    + "`onu.xml` is invented in the UN list's format and names no real person.";
}
