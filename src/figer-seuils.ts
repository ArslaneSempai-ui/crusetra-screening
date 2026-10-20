/**
 * npm run figer-seuils: choose the two thresholds on the private training sets, exactly as the screening does, and write
 * src/seuils-figes.json (sealed). Needs every private set; refuses otherwise. The sha256 of each set is read from the
 * MANIFEST.txt of crusetra-jeux and must equal the hash of the file as measured.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { isMain, refuserDrapeauxInconnus } from "./cli.ts";
import { frequencesDesListes } from "./frequences.ts";
import { JEUX_DU_CRIBLAGE, racineJeux } from "./jeux.ts";
import { FICHIER_FIGE, mesurerSurLesJeux, regleDesSeuils, sceller, type SeuilsFiges } from "./seuils-figes.ts";

export function lireManifesteDesJeux(): { commit: string; sha: Map<string, { sha256: string; note?: string }> } {
  const chemin = new URL("MANIFEST.txt", racineJeux());
  if (!existsSync(chemin)) throw new Error(`${fileURLToPath(chemin)} is missing: the sha256 of the sets cannot be recorded.`);
  const lignes = readFileSync(chemin, "utf8").split("\n");
  const commit = lignes.map((l) => /^# source commit:\s*([0-9a-f]{7,40})\s*$/.exec(l)?.[1]).find((x) => x);
  if (!commit) throw new Error(`no "# source commit:" line in ${fileURLToPath(chemin)}.`);
  const sha = new Map<string, { sha256: string; note?: string }>();
  for (const l of lignes) {
    const m = /^(\S+)\s+([0-9a-f]{64})(?:\s+(.*\S))?\s*$/.exec(l);
    if (m) sha.set(m[1]!, { sha256: m[2]!, ...(m[3] ? { note: m[3] } : {}) });
  }
  return { commit, sha };
}

export function figer(maintenant: Date = new Date()): SeuilsFiges {
  const { commit, sha } = lireManifesteDesJeux();
  const mesure = mesurerSurLesJeux(frequencesDesListes());
  const jeux = JEUX_DU_CRIBLAGE.map((chemin) => {
    const s = sha.get(chemin);
    if (!s) throw new Error(`${chemin} is not in the MANIFEST.txt of the private sets.`);
    return { chemin, sha256: s.sha256, ...(s.note ? { noteDuManifeste: s.note } : {}) };
  });
  /* the hashes the measure computed on the files must be the ones the manifest recorded */
  const mesures = new Set([...mesure.apprentissage.jeux.map((j) => j.sha256), mesure.apprentissageReel.jeu.sha256, ...(mesure.verdict ? [mesure.verdict.jeu.sha256] : [])]);
  for (const j of jeux) if (!mesures.has(j.sha256)) throw new Error(`the sha256 recorded for ${j.chemin} (MANIFEST.txt) is not the hash of the file as measured: the sets changed since they were recorded.`);
  let commitDuMoteur: string | null = null;
  try { commitDuMoteur = execFileSync("git", ["rev-parse", "HEAD"], { cwd: fileURLToPath(new URL(".", import.meta.url)), encoding: "utf8" }).trim() || null; } catch { /* no git */ }
  return sceller({
    version: 1, genre: "crusetra-screening-frozen-thresholds", regle: regleDesSeuils(),
    commitDesJeux: commit, commitDuMoteur, figeLe: maintenant.toISOString().slice(0, 10), jeux, ...mesure,
  });
}

if (isMain(import.meta)) {
  refuserDrapeauxInconnus([]);
  const f = figer();
  writeFileSync(FICHIER_FIGE, JSON.stringify(f, null, 2) + "\n");
  console.log(`wrote ${fileURLToPath(FICHIER_FIGE)}: strong ${f.seuils.fort.toFixed(2)}, possible ${f.seuils.possible.toFixed(2)}, seal ${f.empreinte}`);
}
