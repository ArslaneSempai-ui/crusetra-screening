/**
 * PROMOUVOIR UN JEU AVEUGLE jugé en jeu d'apprentissage : src/paires-entites-<N+1>.json, avec le
 * verdict écrit dans sa provenance (lu dans verification/VERDICTS.md, jamais recopié à la main),
 * la ligne ajoutée à CHEMINS_APPRENTISSAGE, les figures refaites. Rien n'est écrit avant que tout
 * soit vérifié : la ligne du juge existe et parle de CE fichier (son préfixe d'empreinte), le
 * recouvrement avec l'apprentissage est nul, la cible n'existe pas. Jamais une paire à l'écran.
 *
 *   npm run promouvoir -- <N>
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { isMain, refuserDrapeauxInconnus } from "./cli.ts";
import { analyserJeu, lireApprentissage, DOSSIER_JEUX_AVEUGLES, CADRATIN, type JeuBrut } from "./valider-jeu.ts";

export type Taux = { n: number; sur: number; bas: number; haut: number };
export type NiveauJuge = { seuil: string; trouves: Taux; fausses: Taux };
export type Juge = { version: string; sha: string; entites: string; cribler: string; ecritures: string; fort: NiveauJuge; possible: NiveauJuge };

const RACINE = fileURLToPath(new URL("..", import.meta.url));
export const CHEMIN_VERDICTS = join(RACINE, "verification", "VERDICTS.md");
export const CHEMIN_ENTITES = join(RACINE, "src", "entites.ts");

/** Le nom du fichier d'un jeu d'apprentissage : le premier n'a pas de numéro. */
export function fichierDuJeu(n: number): string {
  return n === 1 ? "paires-entites.json" : `paires-entites-${n}.json`;
}

/** Les nombres en lettres, comme la provenance du jeu 16 les écrit (« fifteen earlier training sets »). */
export function nombreEnLettres(n: number): string {
  const petits = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
    "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];
  return petits[n] ?? String(n);
}

const taux = (cellule: string): Taux | null => {
  const m = /^(\d+)\/(\d+) \[(\d+)-(\d+) %\]$/.exec(cellule.trim());
  return m ? { n: Number(m[1]), sur: Number(m[2]), bas: Number(m[3]), haut: Number(m[4]) } : null;
};

/**
 * La ligne du juge pour le jeu N : elle commence par « | 2026- », porte « set #N <sha> », et la
 * ligne suivante qui commence par « | | | | | possible » porte le niveau possible. Les cellules
 * se lisent entre les barres ; la cellule du jeu contient des virgules et des parenthèses, jamais
 * une barre. Absente ou d'une autre forme : null, et l'appelant refuse.
 */
export function ligneDuJuge(texte: string, n: number): Juge | null {
  const lignes = texte.split("\n");
  const i = lignes.findIndex((l) => /^\| 20\d\d-/.test(l) && new RegExp(`set #${n} [0-9a-f]{8}`).test(l));
  if (i < 0) return null;
  const cellules = lignes[i]!.split("|").map((c) => c.trim());
  /* ["", date, méthode, jeu, paires, niveau, trouvés, fausses, ""] */
  if (cellules.length < 8) return null;
  const methode = /^(v[\w.]+) ([0-9a-f]{8}) \/ ([0-9a-f]{8}) \/ ecritures ([0-9a-f]{8})$/.exec(cellules[2]!);
  const sha = new RegExp(`set #${n} ([0-9a-f]{8})`).exec(cellules[3]!);
  const fort = /^strong (\d\.\d\d)$/.exec(cellules[5]!);
  const fortTrouves = taux(cellules[6]!), fortFausses = taux(cellules[7]!);
  if (!methode || !sha || !fort || !fortTrouves || !fortFausses) return null;
  const suivante = lignes[i + 1] ?? "";
  if (!suivante.startsWith("| | | | | possible")) return null;
  const c2 = suivante.split("|").map((c) => c.trim());
  const possible = /^possible (\d\.\d\d)$/.exec(c2[5] ?? "");
  const possibleTrouves = taux(c2[6] ?? ""), possibleFausses = taux(c2[7] ?? "");
  if (!possible || !possibleTrouves || !possibleFausses) return null;
  return {
    version: methode[1]!, sha: sha[1]!, entites: methode[2]!, cribler: methode[3]!, ecritures: methode[4]!,
    fort: { seuil: fort[1]!, trouves: fortTrouves, fausses: fortFausses },
    possible: { seuil: possible[1]!, trouves: possibleTrouves, fausses: possibleFausses },
  };
}

/** La phrase ajoutée à la provenance de l'auteur : le mot à mot de paires-entites-16.json, les
 *  points de suspension en un caractère (U+2026). */
export type Recouvrement = { paires: number; noms: number };
const RECOUVREMENT_NUL: Recouvrement = { paires: 0, noms: 0 };
/** Le recouvrement toléré : celui de valider-jeu (au plus deux paires), écrit dans la provenance
 *  parce qu'un lecteur du jeu promu doit savoir ce qu'il pesait déjà. */
export const RECOUVREMENT_MAX = 2;

export function phraseDuJuge(n: number, juge: Juge, date: string, recouvrement: Recouvrement = RECOUVREMENT_NUL): string {
  const t = (x: Taux) => `${x.n}/${x.sur} [${x.bas}-${x.haut} %]`;
  const s = (k: number, mot: string) => `${k} ${mot}${k === 1 ? "" : "s"}`;
  return `Overlap with the ${nombreEnLettres(n)} earlier training sets: ${s(recouvrement.paires, "pair")}, ${s(recouvrement.noms, "name")}.`
    + ` Judged once by the judge session on method ${juge.version} (entites.ts ${juge.entites}…, cribler.ts ${juge.cribler}…, ecritures.ts ${juge.ecritures}…):`
    + ` strong ${juge.fort.seuil} found ${t(juge.fort.trouves)} with ${t(juge.fort.fausses).replace(" [", " false alerts [")};`
    + ` possible ${juge.possible.seuil} found ${t(juge.possible.trouves)} with ${t(juge.possible.fausses)}.`
    + ` Studied afterwards and promoted to training set ${n + 1} on ${date}, so it no longer measures anything held out.`;
}

/** La provenance promue : celle de l'auteur, fermée par un point si elle ne l'est pas, puis la phrase du juge. */
export function provenancePromue(auteur: string, n: number, juge: Juge, date: string, recouvrement: Recouvrement = RECOUVREMENT_NUL): string {
  const propre = auteur.trim();
  return `${/[.!?]$/.test(propre) ? propre : propre + "."} ${phraseDuJuge(n, juge, date, recouvrement)}`;
}

/** La ligne de CHEMINS_APPRENTISSAGE, insérée après celle du jeu N. Refuse si l'ancre manque ou
 *  si la ligne y est déjà : deux fois le même jeu pèserait deux fois dans la mesure. */
export function insererChemin(source: string, n: number): string {
  const ligne = (f: string) => `  new URL("./${f}", import.meta.url),`;
  const ancre = ligne(fichierDuJeu(n)), nouvelle = ligne(fichierDuJeu(n + 1));
  if (source.includes(nouvelle)) throw new Error(`src/entites.ts already lists ${fichierDuJeu(n + 1)} in CHEMINS_APPRENTISSAGE`);
  const lignes = source.split("\n");
  const i = lignes.indexOf(ancre);
  if (i < 0) throw new Error(`src/entites.ts has no line for ${fichierDuJeu(n)} in CHEMINS_APPRENTISSAGE to insert after`);
  lignes.splice(i + 1, 0, nouvelle);
  return lignes.join("\n");
}

/** La date locale, YYYY-MM-DD : la machine est à Athènes, l'UTC changerait de jour le soir. */
export function aujourdhui(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function refuser(motif: string): never {
  console.error(`refused: ${motif}`);
  process.exit(1);
}

function principal(): void {
  refuserDrapeauxInconnus([]);
  const n = Number(process.argv[2]);
  if (!Number.isInteger(n) || n < 1) { console.error("usage: npm run promouvoir -- <N>   (N: the blind set's number)"); process.exit(2); }
  const cheminAveugle = join(DOSSIER_JEUX_AVEUGLES, `jeu${n}-aveugle.json`);
  const cible = join(RACINE, "src", fichierDuJeu(n + 1));
  if (!existsSync(cheminAveugle)) refuser(`${cheminAveugle}: no such file`);
  if (existsSync(cible)) refuser(`${cible} exists already: set ${n} was promoted, or the number is wrong`);

  /* tout se vérifie avant d'écrire quoi que ce soit */
  const brut = readFileSync(cheminAveugle, "utf8");
  const apprentissage = lireApprentissage();
  const { jeu, compte, refus } = analyserJeu(brut, apprentissage, { copier: true });
  if (!jeu || !compte) refuser(refus.join(" · "));
  if (compte.memePaire > RECOUVREMENT_MAX) refuser(`overlap with the ${apprentissage.length} training sets: ${compte.memePaire} pair(s), ${compte.memeNom} name(s) (at most ${RECOUVREMENT_MAX} pairs, as valider-jeu tolerates)`);
  const recouvrement: Recouvrement = { paires: compte.memePaire, noms: compte.memeNom };
  if (compte.cadratins > 0) refuser(`${compte.cadratins} em dash(es) in the blind file: a training set carries none (npm run valider-jeu -- --copier replaces those inside names)`);
  const juge = ligneDuJuge(readFileSync(CHEMIN_VERDICTS, "utf8"), n);
  if (!juge) refuser(`no judge row for set #${n} in verification/VERDICTS.md (a row starting with "| 2026-", carrying "set #${n} <sha>", followed by its "possible" row)`);
  const prefixe = compte.sha256.slice(0, 8);
  if (prefixe !== juge.sha) refuser(`the judge row is about set #${n} ${juge.sha}, this file is ${prefixe}: not the set that was judged`);
  const sourceEntites = readFileSync(CHEMIN_ENTITES, "utf8");
  let entitesPromu: string;
  try { entitesPromu = insererChemin(sourceEntites, n); } catch (e) { refuser(e instanceof Error ? e.message : String(e)); }

  const date = aujourdhui();
  const promu: JeuBrut = { quoi: jeu.quoi, provenance: provenancePromue(jeu.provenance, n, juge, date, recouvrement), avertissement: jeu.avertissement, paires: jeu.paires };
  const texte = JSON.stringify(promu, null, 2) + "\n";
  if (texte.includes(CADRATIN)) refuser("the promoted file would carry an em dash");
  writeFileSync(cible, texte, { flag: "wx" });
  writeFileSync(CHEMIN_ENTITES, entitesPromu);

  const figures = spawnSync("npm", ["run", "figures"], { cwd: RACINE, encoding: "utf8" });
  const etatFigures = figures.status === 0 ? "figures refreshed" : `npm run figures failed (${(figures.stderr || figures.stdout).trim().split("\n").pop()})`;
  console.log(`promoted: blind set ${n} (${prefixe}, ${compte.paires} pairs, judged as ${juge.version}) -> src/${fichierDuJeu(n + 1)}; CHEMINS_APPRENTISSAGE now lists ${apprentissage.length + 1} sets; ${etatFigures}`);
  if (figures.status !== 0) process.exit(1);
}

if (isMain(import.meta)) principal();
