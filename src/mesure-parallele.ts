/**
 * LA MESURE EN PARALLÈLE : les paires des jeux (ou les requêtes du témoin de l'index) réparties
 * sur des fils (node:worker_threads). Chaque fil charge les mêmes modules, lit les fréquences du
 * cache (src/frequences.ts), note sa part et renvoie ses scores ; le fil principal assemble la
 * même table et imprime la même sortie qu'un seul fil, au chiffre de temps près.
 *
 * Ce fichier est à la fois la bibliothèque (le fil principal) et le script du fil : un fil est
 * `new Worker(import.meta.url)` avec sa tâche dans `workerData`, et la fin du fichier la fait.
 *
 *  - la répartition : une paire sur N à chaque fil (i % N), pas des blocs contigus, pour que les
 *    jeux lourds (écritures natives) ne tombent pas tous dans le même fil ;
 *  - les fréquences : le fil LIT le cache, il ne le reconstruit jamais (une minute par fil) ; le
 *    fil principal l'a construit avant, en appelant `frequencesDesListes()` lui-même. Quand les
 *    poids ne viennent pas du cache (`--sans-listes`, un test), ils voyagent dans `workerData` ;
 *  - le témoin : chaque fil porte un index complet (12 s et 0,9 Go mesurés le 28/09 sur les cinq
 *    listes) ; le nombre de fils est borné par le quart de la mémoire de la machine, et le fil
 *    principal prend une part avec l'index qu'il a déjà construit ;
 *  - MESURE_SEQUENTIELLE=1 : les scripts gardent le chemin d'un seul fil, la référence ;
 *    MESURE_FILS=N force le nombre de fils (mesure et témoin).
 *
 * Le démarrage d'un fil (modules chargés, cache lu) est mesuré et rendu : `demarrage`, en ms.
 */
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { availableParallelism, totalmem } from "node:os";
import { createHash } from "node:crypto";
import type { Frequences } from "./mots.ts";
import { scoreNoms, STRATE_CONTENUE, type JeuMesure, type MesureEntites } from "./entites.ts";
import { frequencesDesListes } from "./frequences.ts";
import { mesurerPaires, validerPaires, type JeuDePaires, type PaireEtiquetee, type TableDUnPalier } from "./measure.ts";
import type { Matcher, PalierId } from "./matcher.ts";
import type { Contrepartie } from "./cribler.ts";
import type { EntreeListe } from "./listes.ts";

export type Seuils = { fort: number; possible: number };
export type Paire = { a: string; b: string };

/** Ce qu'un fil reçoit. `frequences` null : le fil lit le cache (le fil principal l'a construit). */
type Tache =
  | { tache: "scores"; frequences: Frequences | null; paires: Paire[] }
  | { tache: "exhaustif"; frequences: Frequences | null; entrees: EntreeListe[]; seuils: Seuils; contreparties: Contrepartie[] };
/** Ce qu'un fil renvoie : prêt en `pret` ms (modules chargés, fréquences lues, index construit
 *  pour le témoin), sa part faite en `duree` ms. */
type Reponse = { pret: number; duree: number; scores?: number[]; resultats?: string[] };

export type Options = {
  /** true : les fils lisent le cache des fréquences ; false (défaut) : `f` voyage avec la tâche. */
  cache?: boolean;
  /** le nombre de fils ; défaut : `nombreDeFils()` (mesure) ou `filsDuTemoin()` (témoin). */
  fils?: number;
};
export type Repartition = { fils: number; demarrage: number; durees: number[] };

/** Le chemin d'un seul fil, demandé par la variable d'environnement : la référence. */
export function sequentielDemande(): boolean {
  return process.env.MESURE_SEQUENTIELLE === "1";
}

const filsForces = (): number | undefined => {
  const n = Number(process.env.MESURE_FILS);
  return Number.isInteger(n) && n >= 1 ? n : undefined;
};

/** Les cœurs moins un (celui du fil principal), au moins un. */
export function nombreDeFils(): number {
  return filsForces() ?? Math.max(1, availableParallelism() - 1);
}

/** Ce qu'un fil du témoin occupe avec son index complet des cinq listes (RSS mesuré le 28/09/2026). */
export const MEMOIRE_D_UN_INDEX = 1e9;
/** La part de la mémoire de la machine que les index des fils peuvent prendre, celui du fil principal compris. */
export const PART_DE_MEMOIRE = 0.25;

/** Les fils du témoin : ceux de la machine, bornés par la mémoire (le fil principal a déjà son index). */
export function filsDuTemoin(): number {
  const parMemoire = Math.floor((totalmem() * PART_DE_MEMOIRE) / MEMOIRE_D_UN_INDEX) - 1;
  return filsForces() ?? Math.max(1, Math.min(nombreDeFils(), parMemoire));
}

/** Une pièce sur N à chaque fil : la pièce i va au fil i % N. Jamais de fil vide (N est ramené
 *  au nombre de pièces) : ce qui rend la place de chaque pièce reconstructible par la même règle. */
export function repartir<T>(pieces: readonly T[], fils: number): T[][] {
  const n = Math.min(fils, pieces.length);
  const parts: T[][] = Array.from({ length: n }, () => []);
  pieces.forEach((p, i) => parts[i % n]!.push(p));
  return parts;
}

/** Les fils lancés, une tâche chacun ; la première erreur arrête les autres et remonte. */
function lancer(taches: readonly Tache[]): Promise<Reponse[]> {
  const fils: Worker[] = [];
  const arreter = () => { for (const w of fils) void w.terminate(); };
  return Promise.all(taches.map((t) => new Promise<Reponse>((resoudre, rejeter) => {
    const w = new Worker(new URL(import.meta.url), { workerData: t });
    fils.push(w);
    let reponse: Reponse | undefined;
    w.on("message", (m: Reponse) => { reponse = m; });
    w.on("error", (e) => { arreter(); rejeter(e); });
    w.on("exit", (code) => {
      if (reponse) resoudre(reponse);
      else { arreter(); rejeter(new Error(`a measuring thread exited with code ${code} before answering.`)); }
    });
  })));
}

const bilan = (fils: number, reponses: readonly Reponse[]): Repartition => ({
  fils, demarrage: reponses.length ? Math.max(...reponses.map((r) => r.pret)) : 0, durees: reponses.map((r) => r.duree),
});

/** Les paires notées par le score d'entité sur des fils, les scores rendus dans l'ordre des paires. */
export async function scorerPaires(f: Frequences, paires: readonly Paire[], options: Options = {}): Promise<Repartition & { scores: number[] }> {
  const parts = repartir(paires.map(({ a, b }) => ({ a, b })), options.fils ?? nombreDeFils());
  const n = parts.length;
  const reponses = await lancer(parts.map((p) => ({ tache: "scores", frequences: options.cache ? null : f, paires: p })));
  const scores = paires.map((_, i) => reponses[i % n]!.scores![Math.floor(i / n)]!);
  return { ...bilan(n, reponses), scores };
}

/** La table d'un palier depuis des scores déjà calculés : la même arithmétique que `mesurerPaires`,
 *  nourrie d'un matcher scripté qui relit les scores au lieu de les calculer. */
export function tableDepuisScores(paires: readonly PaireEtiquetee[], scores: readonly number[]): TableDUnPalier {
  if (scores.length !== paires.length) throw new Error(`${scores.length} scores for ${paires.length} pairs: the threads did not answer for every pair.`);
  const cle = (a: string, b: string) => `${a}\u0000${b}`;
  const parPaire = new Map(paires.map((x, i) => [cle(x.a, x.b), scores[i]!]));
  const id = "entite" as PalierId;
  const scripte: Matcher = { id, description: "the entity score, already computed on the threads", rang: 4,
    score: (a, b) => parPaire.get(cle(a, b))! };
  return mesurerPaires(new Map([[id, scripte]]), paires)[id]!;
}

/** `mesurerJeux` (src/entites.ts) sur des fils : mêmes jeux, même table ; en plus les paires
 *  dans l'ordre mesuré et leurs scores, pour que le détail n'ait pas à noter une seconde fois. */
export async function mesurerJeuxParallele(f: Frequences, bruts: readonly string[], options: Options = {}):
  Promise<MesureEntites & Repartition & { paires: PaireEtiquetee[]; scores: number[] }> {
  const jeux: JeuMesure[] = [];
  const paires = bruts.flatMap((brut) => {
    const jeu = JSON.parse(brut) as JeuDePaires;
    const validees = validerPaires(jeu);
    const match = validees.filter((x) => x.verdict === "match").length;
    jeux.push({ quoi: jeu.quoi, provenance: jeu.provenance,
      sha256: createHash("sha256").update(brut).digest("hex"), match, different: validees.length - match });
    return validees;
  });
  const { scores, ...repartition } = await scorerPaires(f, paires, options);
  return { jeux, table: tableDepuisScores(paires, scores), paires, scores, ...repartition };
}

/** `mesurerReel` (src/entites.ts) sur des fils : l'échantillon réel, strate contenue retirée, sa table et ses paires notées. */
export async function mesurerReelParallele(f: Frequences, brut: string, options: Options = {}):
  Promise<MesureEntites & Repartition & { paires: PaireEtiquetee[]; scores: number[] }> {
  const jeu = JSON.parse(brut) as JeuDePaires;
  const paires = validerPaires(jeu).filter((x) => x.nature !== STRATE_CONTENUE);
  const match = paires.filter((x) => x.verdict === "match").length;
  const { scores, ...repartition } = await scorerPaires(f, paires, options);
  return { jeux: [{ quoi: jeu.quoi, provenance: jeu.provenance, sha256: createHash("sha256").update(brut).digest("hex"), match, different: paires.length - match }],
    table: tableDepuisScores(paires, scores), paires, scores, ...repartition };
}

/** Le témoin exhaustif sur des fils : chaque fil construit son index des mêmes entrées et crible sa
 *  part de contreparties contre tout ; le fil principal, s'il donne `principal` (son propre criblage
 *  exhaustif, avec l'index qu'il a déjà), prend une part lui aussi. Les résultats, en JSON, dans
 *  l'ordre des contreparties. */
export async function criblerExhaustif(
  f: Frequences, entrees: readonly EntreeListe[], seuils: Seuils, contreparties: readonly Contrepartie[],
  options: Options & { principal?: (c: Contrepartie) => unknown } = {},
): Promise<Repartition & { resultats: string[] }> {
  const voulus = options.fils ?? filsDuTemoin();
  const parts = repartir(contreparties, options.principal ? voulus + 1 : voulus);
  const n = parts.length;
  const auxFils = options.principal && n > 0 ? parts.slice(0, n - 1) : parts;
  const enCours = lancer(auxFils.map((p) => ({ tache: "exhaustif", frequences: options.cache ? null : f,
    entrees: [...entrees], seuils, contreparties: p })));
  /* la part du fil principal se fait pendant que les fils construisent leur index */
  const miens = options.principal && n > 0 ? parts[n - 1]!.map((c) => JSON.stringify(options.principal!(c))) : [];
  const reponses = await enCours;
  const resultats = contreparties.map((_, i) => {
    const k = i % n, j = Math.floor(i / n);
    return k < auxFils.length ? reponses[k]!.resultats![j]! : miens[j]!;
  });
  return { ...bilan(auxFils.length, reponses), resultats };
}

/* ─────────────────────────── le fil ─────────────────────────── */

const estTache = (d: unknown): d is Tache =>
  typeof d === "object" && d !== null && ((d as Tache).tache === "scores" || (d as Tache).tache === "exhaustif");

async function travailler(t: Tache): Promise<void> {
  const f = t.frequences ?? frequencesDesListes();
  if (t.tache === "scores") {
    const pret = Math.round(performance.now());
    const scores = t.paires.map((p) => scoreNoms(f, p.a, p.b));
    parentPort!.postMessage({ pret, duree: Math.round(performance.now()) - pret, scores });
    return;
  }
  /* l'index n'est chargé que par les fils du témoin : ceux de la mesure restent légers */
  const { Index, cribler } = await import("./cribler.ts");
  const index = new Index(f, t.entrees, t.seuils.possible);
  const pret = Math.round(performance.now());
  const resultats = t.contreparties.map((c) => JSON.stringify(cribler(c, index, t.seuils, true)));
  parentPort!.postMessage({ pret, duree: Math.round(performance.now()) - pret, resultats });
}

if (!isMainThread && estTache(workerData)) await travailler(workerData);
