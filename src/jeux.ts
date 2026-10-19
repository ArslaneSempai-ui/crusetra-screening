/**
 * THE PRIVATE DOOR. The full labelled sets are not in this repository: they live in the private
 * repository crusetra-jeux, folder crusetra-screening/, under the same relative paths they had here.
 * This module is the one place that knows where that folder is and which paths moved.
 *
 *   CRUSETRA_JEUX   the folder that holds src/ and verification/ of the private copy
 *                   (default: ../crusetra-jeux/crusetra-screening, next to this repository)
 *
 * What stays public is the figures, the method and a 20-row sample per family (src/echantillons/).
 * A command that needs a full set and does not find it refuses with a named error (`cheminPrive`);
 * a test that needs one skips with a named reason (`raisonDAbsence`), never fails, never passes silently.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { isAbsolute, resolve } from "node:path";

const RACINE = new URL("../", import.meta.url);

/** The 23 written training sets of the entity matcher, in the order src/entites.ts lists them. */
export const APPRENTISSAGE: readonly string[] = ["src/paires-entites.json", ...Array.from({ length: 22 }, (_, i) => `src/paires-entites-${i + 2}.json`)];
/** Everything the screener reads to choose its two thresholds: the 23 sets, the real sample, the verdict set it reports. */
export const JEUX_DU_CRIBLAGE: readonly string[] = [...APPRENTISSAGE, "src/paires-gleif-apprentissage.json", "verification/paires-entites-verdict.json"];

/** The paths (relative to the repository root) that moved to the private repository. */
export const CHEMIN_PRIVE =
  /^(?:src\/paires-(?:etiquetees|entites(?:-\d+)?|gleif-apprentissage(?:-juges)?)\.json|verification\/(?:paires-gleif(?:-\d+)?(?:-juges)?|paires-entites-verdict)\.json)$/;

export const estPrive = (rel: string): boolean => CHEMIN_PRIVE.test(rel);

/** The folder of the private copy, as a directory URL ending with a slash. */
export function racineJeux(): URL {
  const env = process.env.CRUSETRA_JEUX;
  const dossier = env && env.trim() !== ""
    ? (isAbsolute(env) ? env : resolve(process.cwd(), env))
    : fileURLToPath(new URL("../crusetra-jeux/crusetra-screening", RACINE));
  return new URL(`file://${dossier.replace(/\/+$/, "")}/`);
}

/** Where a moved file would be (it may be absent). Refuses a path that did not move. */
export function urlPrive(rel: string): URL {
  if (!estPrive(rel)) throw new Error(`${rel} is not one of the private sets (src/jeux.ts, CHEMIN_PRIVE).`);
  return new URL(rel, racineJeux());
}

/** The file where it lives: the private copy for a moved path, this repository for any other. */
export const urlDuDepot = (rel: string): URL => (estPrive(rel) ? urlPrive(rel) : new URL(rel, RACINE));

export const jeuPresent = (rel: string): boolean => existsSync(urlPrive(rel));

export class JeuPriveAbsent extends Error {
  constructor(rel: string) {
    super(`private set absent: ${rel} is not in ${fileURLToPath(racineJeux())}. ` +
      `Clone the private repository crusetra-jeux next to this one, or point CRUSETRA_JEUX at its crusetra-screening folder.`);
    this.name = "JeuPriveAbsent";
  }
}

/** The URL of a private set that a measure needs; throws the named error when it is absent. */
export function cheminPrive(rel: string): URL {
  const u = urlPrive(rel);
  if (!existsSync(u)) throw new JeuPriveAbsent(rel);
  return u;
}

/** The text of a private set, or the named error. */
export const lirePrive = (rel: string): string => readFileSync(cheminPrive(rel), "utf8");

/** For `test(name, { skip })`: the reason when any of these sets is absent, false when all are present. */
export function raisonDAbsence(...rels: string[]): string | false {
  const manque = rels.filter((r) => !jeuPresent(r));
  return manque.length === 0 ? false : `private set absent (${manque.length} of ${rels.length}: ${manque[0]}${manque.length > 1 ? ", ..." : ""}); set CRUSETRA_JEUX`;
}

/** Where the public 20-row sample of each family is (drawn by src/echantillonner.ts). */
export const ECHANTILLONS = {
  "paires-etiquetees": "src/echantillons/paires-etiquetees-20.json",
  "paires-entites": "src/echantillons/paires-entites-20.json",
  "paires-gleif": "verification/echantillon-gleif-20.json",
} as const;

export const echantillon = (nom: keyof typeof ECHANTILLONS): unknown =>
  JSON.parse(readFileSync(new URL(ECHANTILLONS[nom], RACINE), "utf8"));

/** Reads a file that lives in the private copy (a URL built by `urlPrive`); an absent file is the named error, not a bare ENOENT. */
export function lireUrlPrive(u: URL): string {
  try {
    return readFileSync(u, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    const base = fileURLToPath(racineJeux());
    const chemin = fileURLToPath(u);
    throw new JeuPriveAbsent(chemin.startsWith(base) ? chemin.slice(base.length) : chemin);
  }
}

/** The path of a private file relative to the private root, as it was relative to this repository (src/..., verification/...). */
export function relatif(u: URL): string {
  const base = fileURLToPath(racineJeux());
  const chemin = fileURLToPath(u);
  if (!chemin.startsWith(base)) throw new Error(`${chemin} is not under the private folder ${base}`);
  return chemin.slice(base.length);
}

/** The private files of a folder (e.g. "src") whose name matches; the named error when the private folder is absent. */
export function listerPrive(dossier: "src" | "verification", motif: RegExp): URL[] {
  const d = new URL(`${dossier}/`, racineJeux());
  if (!existsSync(d)) throw new JeuPriveAbsent(`${dossier}/`);
  return readdirSync(d).filter((f) => motif.test(f)).sort().map((f) => new URL(f, d));
}
