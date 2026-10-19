/**
 * THE FROZEN THRESHOLDS. The screening chooses its two thresholds (strong, possible) on the training sets (src/entites.ts,
 * `choisirSeuils`). Those sets are private (src/jeux.ts), so a clone without them could not screen. The choice is made once
 * with the sets present (`npm run figer-seuils`) and committed in src/seuils-figes.json, sealed with the repository's own
 * sealing helper (src/empreinte.ts), with the rule that chose it, the source commit and the sha256 of every set used.
 *
 *   - without the private folder the engine reads the frozen file, after checking its seal;
 *   - with the private folder it still chooses on the sets, and refuses, naming the difference, if its choice is not the
 *     frozen one: the file cannot drift silently;
 *   - a frozen file whose seal does not match its content is refused in both cases.
 */
import { existsSync, readFileSync } from "node:fs";
import { deepStrictEqual } from "node:assert";
import { fileURLToPath } from "node:url";
import { empreinteDuReleve, scelleIntact } from "./empreinte.ts";
import type { Cellule } from "./measure.ts";
import {
  mesurerJeux, mesurerReel, choisirSeuils, lireJeu, CHEMINS_APPRENTISSAGE, CHEMIN_APPRENTISSAGE_REEL, CHEMIN_VERDICT, RAPPEL_MIN,
  SEUIL_POSSIBLE, FAUSSES_ALERTES_MAX_FORT, FAUSSES_ALERTES_REELLES_MAX_FORT, type Frequences, type JeuMesure,
} from "./entites.ts";
import { relatif } from "./jeux.ts";

export const FICHIER_FIGE = new URL("./seuils-figes.json", import.meta.url);

export type MesureCitee = { rappel: Cellule; fauxPositifs: Cellule };
/** What the screening record says about its thresholds: the values and the figures measured at them. */
export type MesureDesSeuils = {
  seuils: { fort: number; possible: number };
  tientLePlancher: boolean;
  apprentissage: { jeux: JeuMesure[]; fort: MesureCitee; possible: MesureCitee };
  apprentissageReel: { jeu: JeuMesure; fort: MesureCitee; possible: MesureCitee };
  verdict: { jeu: JeuMesure; fort: MesureCitee; possible: MesureCitee } | null;
};

export type SeuilsFiges = MesureDesSeuils & {
  version: 1;
  genre: "crusetra-screening-frozen-thresholds";
  /** the rule that chose the two values, as the engine states it */
  regle: string;
  /** the commit of the labelled sets (crusetra-jeux MANIFEST.txt, "source commit") */
  commitDesJeux: string;
  /** the commit of this repository when the file was made */
  commitDuMoteur: string | null;
  figeLe: string;
  /** every set read, with the sha256 recorded in crusetra-jeux MANIFEST.txt */
  jeux: { chemin: string; sha256: string; noteDuManifeste?: string }[];
  empreinte?: string;
};

const citer = (t: Record<string, MesureCitee>, seuil: number): MesureCitee => {
  const c = t[seuil.toFixed(2)]!;
  return { rappel: c.rappel, fauxPositifs: c.fauxPositifs };
};

/** The rule, written from the constants of src/entites.ts (no figure typed here). */
export const regleDesSeuils = (): string =>
  `possible: the first grid threshold at or above ${SEUIL_POSSIBLE.toFixed(2)}. strong: the lowest grid threshold above the possible one whose ` +
  `false-alert upper Wilson bound is at most ${FAUSSES_ALERTES_MAX_FORT} on the written training sets and at most ${FAUSSES_ALERTES_REELLES_MAX_FORT} on the real training sample ` +
  `(src/entites.ts, choisirSeuils); recall floor ${RAPPEL_MIN} on the lower bound.`;

/** The thresholds chosen on the private sets, exactly as the screening does. Throws the named error when a set is absent. */
export function mesurerSurLesJeux(f: Frequences): MesureDesSeuils {
  const bruts = CHEMINS_APPRENTISSAGE.map((u) => {
    const b = lireJeu(u);
    if (b === null) throw new Error(`the training set ${relatif(u)} is missing from the private sets (CRUSETRA_JEUX, src/jeux.ts): the thresholds cannot be measured. Nothing was screened.`);
    return b;
  });
  const apprentissage = mesurerJeux(f, bruts);
  const brutReel = lireJeu(CHEMIN_APPRENTISSAGE_REEL);
  if (brutReel === null) throw new Error(`the real training sample ${relatif(CHEMIN_APPRENTISSAGE_REEL)} is missing from the private sets (CRUSETRA_JEUX, src/jeux.ts): the thresholds cannot be measured. Nothing was screened.`);
  const reel = mesurerReel(f, brutReel);
  const reglage = choisirSeuils(apprentissage.table, reel.table);
  const seuils = { fort: reglage.fort.seuil, possible: reglage.possible.seuil };
  const brutVerdict = lireJeu(CHEMIN_VERDICT);
  const verdict = brutVerdict === null ? null : mesurerJeux(f, [brutVerdict]);
  return {
    seuils, tientLePlancher: reglage.tientLePlancher,
    apprentissage: { jeux: apprentissage.jeux, fort: citer(apprentissage.table, seuils.fort), possible: citer(apprentissage.table, seuils.possible) },
    apprentissageReel: { jeu: reel.jeux[0]!, fort: citer(reel.table, seuils.fort), possible: citer(reel.table, seuils.possible) },
    verdict: verdict ? { jeu: verdict.jeux[0]!, fort: citer(verdict.table, seuils.fort), possible: citer(verdict.table, seuils.possible) } : null,
  };
}

/** The frozen file, after its seal is checked. A missing, unreadable or tampered file is a named refusal. */
export function lireSeuilsFiges(fichier: URL = FICHIER_FIGE): SeuilsFiges {
  const nom = fileURLToPath(fichier);
  if (!existsSync(fichier)) throw new Error(`the frozen thresholds ${nom} are missing: without the private sets the thresholds cannot be taken from anywhere. Nothing was screened.`);
  let f: SeuilsFiges;
  try { f = JSON.parse(readFileSync(fichier, "utf8")) as SeuilsFiges; } catch {
    throw new Error(`the frozen thresholds ${nom} cannot be read as JSON. Nothing was screened.`);
  }
  if (f === null || typeof f !== "object" || !scelleIntact(f as unknown as Record<string, unknown>)) {
    throw new Error(`the frozen thresholds ${nom} are refused: the seal is missing or does not match the content (the file was edited after it was sealed). Nothing was screened.`);
  }
  return f;
}

const mesureDe = (f: SeuilsFiges): MesureDesSeuils =>
  ({ seuils: f.seuils, tientLePlancher: f.tientLePlancher, apprentissage: f.apprentissage, apprentissageReel: f.apprentissageReel, verdict: f.verdict });
const viaJson = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/**
 * What the screening uses. No private set at all: the frozen file. Some but not all: the named error. All of them: the
 * choice is made on the sets and must equal the frozen file, field by field (the verdict figures only if that set is there).
 */
export function seuilsDuCriblage(f: Frequences, fichier: URL = FICHIER_FIGE): MesureDesSeuils {
  const chemins = [...CHEMINS_APPRENTISSAGE, CHEMIN_APPRENTISSAGE_REEL];
  if (!chemins.some((u) => existsSync(u))) return mesureDe(lireSeuilsFiges(fichier));
  const mesuree = viaJson(mesurerSurLesJeux(f));
  const figee = viaJson(mesureDe(lireSeuilsFiges(fichier)));
  const champs = (Object.keys(mesuree) as (keyof MesureDesSeuils)[]).filter((k) => {
    if (k === "verdict" && mesuree.verdict === null) return false;
    try { deepStrictEqual(mesuree[k], figee[k]); return false; } catch { return true; }
  });
  if (champs.length > 0) {
    throw new Error(`the thresholds chosen on the private sets (strong ${mesuree.seuils.fort.toFixed(2)}, possible ${mesuree.seuils.possible.toFixed(2)}) differ from the frozen file ${fileURLToPath(fichier)} ` +
      `(fields that differ: ${champs.join(", ")}; frozen: strong ${figee.seuils.fort.toFixed(2)}, possible ${figee.seuils.possible.toFixed(2)}). ` +
      `The frozen file does not drift silently: re-freeze it with \`npm run figer-seuils\` and review the diff. Nothing was screened.`);
  }
  return { ...mesuree, verdict: mesuree.verdict ?? figee.verdict };
}

/** Seals a frozen file (the repository's helper, `empreinteDuReleve`). */
export const sceller = (sansSceau: Omit<SeuilsFiges, "empreinte">): SeuilsFiges => ({ ...sansSceau, empreinte: empreinteDuReleve(sansSceau) });
