/**
 * LE RELEVÉ PUBLIC DU MATCHER D'ENTITÉS : ce qu'un rapport client cite, figé avec sa date et son commit.
 *
 *   npm run releve-entites            écrit releve-entites.json (puis : npm run sceller -- releve-entites.json)
 *   npm run releve-entites -- --check refuse si les sources ont bougé depuis le relevé scellé (la suite le lance)
 *
 * Le relevé public (releve-public.json) mesure les paliers sur des noms de PERSONNES. Celui-ci
 * porte les chiffres du matcher de SOCIÉTÉS ET NAVIRES, et chacun vient d'une source qui se relit :
 * les cellules d'apprentissage sont mesurées ici même (mesurerJeuxParallele, choisirSeuils) ; le
 * verdict réaliste et les verdicts aveugles sont les lignes du Juge dans verification/VERDICTS.md
 * (lignes lues par ligneDuJuge, jamais retapées) ; les deux livres de mille contreparties sont les
 * relevés scellés d'exemple/ (sceau, comptes, commit). Rien n'est tapé à la main : un chiffre qui
 * n'a pas de source n'entre pas. Le scellé (npm run sceller) fige le tout ; --check refait la
 * lecture des sources et refuse le relevé qui ne leur correspond plus, comme readme.ts --check.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { isMain, refuserDrapeauxInconnus } from "./cli.ts";
import { CHEMINS_APPRENTISSAGE, CHEMIN_APPRENTISSAGE_REEL, choisirSeuils } from "./entites.ts";
import type { Cellule } from "./measure.ts";
import { frequencesDesListes } from "./frequences.ts";
import { mesurerJeuxParallele, mesurerReelParallele } from "./mesure-parallele.ts";
import { ligneDuJuge, aujourdhui, CHEMIN_VERDICTS, type Juge } from "./promouvoir.ts";

export const CHEMIN_RELEVE = new URL("../releve-entites.json", import.meta.url);
/** Les jeux aveugles jugés à l'aveugle, dans l'ordre des versions v14 à v24 ; le 20 est le jeu réaliste. */
export const JEUX_AVEUGLES: readonly number[] = [12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23];
export const JEU_REALISTE = 20;
export const LIVRES = [
  { fichier: "exemple/contreparties-mille.csv", releve: "exemple/contreparties-mille.screening.json", aveugle: false,
    note: "a Rotterdam forwarder's book; the abbreviation rule of 3eec970 was tightened from its first record, and its alert volume was read on 30 September 2026 to choose the possible threshold (the review budget of choisirSeuils), so its figure is not blind" },
  { fichier: "exemple/contreparties-mille-2.csv", releve: "exemple/contreparties-mille-2.screening.json", aveugle: false,
    note: "a Hamburg forwarder's book, written after that rule and screened blind once on commit 9e18a1c; its alert volume was then read on 30 September 2026 to choose the possible threshold (the review budget of choisirSeuils), so its figure is no longer blind" },
] as const;

export type Niveau = { seuil: number; trouves: Cellule; fausses: Cellule;
  /** les fausses alertes sur les vraies sociétés distinctes de l'échantillon réel (voir `choisirSeuils`), au même seuil */
  faussesReelles?: Cellule };
export type Apprentissage = { jeux: number; paires: number; pieges: number; fort: Niveau; possible: Niveau };
export type Verdict = { jeu: number; realiste: boolean } & Juge;
export type Livre = { fichier: string; sha256: string; releve: string; sceau: string; commit: string; emisLe: string;
  lignes: number; forts: number; possibles: number; sansCorrespondance: number; aveugle: boolean; note: string };
export type ReleveEntites = {
  version: 1; quoi: string; date: string; commit: string;
  apprentissage: Apprentissage; verdictRealiste: Verdict; verdictsAveugles: Verdict[]; livres: Livre[]; reserves: string[];
  empreinte?: string;
};

export const RESERVES: readonly string[] = [
  "A candidate is a name to be read by the client's compliance officer, never a match established: every figure here counts candidates, not findings.",
  "The realistic set is a quarter of ordinary documents of one forwarder, written blind; it is the held-out set every client report cites first, and it was never used to choose a threshold.",
  "The blind sets are trap populations, one per round; a population whose script the matcher had never read scores 40 to 55 % at the strong level on its round and gains about forty points the round after, so the last set (Polish and Baltic) stands where the unread ones stood.",
  "Neither thousand-name book is blind any more: both were read to choose the possible threshold and its review budget. Screened against the seven sources, each gives 24 names to review in a thousand, inside the budget of one in forty set on 4 October 2026 (it was one in fifty on five lists, with 18 and 17 names). Of their two strong alerts, one is false on reading (a vessel name against an alias of a listed company) and the other is one letter away from a listed vessel's name.",
];

export function batirReleve(entree: { date: string; commit: string; apprentissage: Apprentissage; verdictRealiste: Verdict; verdictsAveugles: Verdict[]; livres: Livre[] }): ReleveEntites {
  return {
    version: 1,
    quoi: "the company and vessel name matcher of Crusetra Screening: the training cells, the realistic verdict every client report cites, the blind verdicts of the rounds and the two thousand-name books, frozen with their date and commit; sealed afterwards with npm run sceller",
    date: entree.date, commit: entree.commit,
    apprentissage: entree.apprentissage, verdictRealiste: entree.verdictRealiste, verdictsAveugles: entree.verdictsAveugles,
    livres: entree.livres, reserves: [...RESERVES],
  };
}

/** Les lignes du Juge, lues dans le registre : le jeu réaliste et les jeux aveugles, ou un refus qui nomme le manquant. */
export function lireVerdicts(registre: string): { realiste: Verdict; aveugles: Verdict[] } {
  const lire = (n: number, realiste: boolean): Verdict => {
    const j = ligneDuJuge(registre, n);
    if (!j) throw new Error(`verification/VERDICTS.md has no judge row for set #${n}`);
    return { jeu: n, realiste, ...j };
  };
  return { realiste: lire(JEU_REALISTE, true), aveugles: JEUX_AVEUGLES.map((n) => lire(n, false)) };
}

/** Un livre de mille contreparties : le CSV et son relevé scellé, lus tels quels. */
export function lireLivre(racine: string, l: (typeof LIVRES)[number]): Livre {
  const csv = readFileSync(`${racine}${l.fichier}`);
  const r = JSON.parse(readFileSync(`${racine}${l.releve}`, "utf8")) as {
    commit: string; emisLe: string; empreinte: string; fichier: { sha256: string };
    totaux: { lignes: number; forts: number; possibles: number; sansCorrespondance: number };
  };
  const sha256 = createHash("sha256").update(csv).digest("hex");
  if (sha256 !== r.fichier.sha256) throw new Error(`${l.fichier} is not the file ${l.releve} was sealed on (${sha256.slice(0, 8)} vs ${r.fichier.sha256.slice(0, 8)})`);
  return { fichier: l.fichier, sha256, releve: l.releve, sceau: r.empreinte, commit: r.commit, emisLe: r.emisLe,
    lignes: r.totaux.lignes, forts: r.totaux.forts, possibles: r.totaux.possibles, sansCorrespondance: r.totaux.sansCorrespondance,
    aveugle: l.aveugle, note: l.note };
}

/** Les cellules d'apprentissage, mesurées ici même sur tous les jeux listés. */
export async function mesurerApprentissage(): Promise<Apprentissage> {
  const f = frequencesDesListes();
  const bruts = CHEMINS_APPRENTISSAGE.map((u) => readFileSync(u, "utf8"));
  const m = await mesurerJeuxParallele(f, bruts, { cache: true });
  const reel = await mesurerReelParallele(f, readFileSync(CHEMIN_APPRENTISSAGE_REEL, "utf8"), { cache: true });
  const r = choisirSeuils(m.table, reel.table);
  const paires = m.paires.filter((x) => x.verdict === "match").length;
  const niveau = (n: { seuil: number; rappel: Cellule; fauxPositifs: Cellule; fauxPositifsReels: Cellule }): Niveau => ({ seuil: n.seuil, trouves: n.rappel, fausses: n.fauxPositifs, faussesReelles: n.fauxPositifsReels });
  return { jeux: CHEMINS_APPRENTISSAGE.length, paires, pieges: m.paires.length - paires, fort: niveau(r.fort), possible: niveau(r.possible) };
}

/** Ce qui doit être identique entre le relevé sur disque et les sources relues : tout sauf la date, le commit et le scellé. */
export function differences(disque: ReleveEntites, relu: ReleveEntites): string[] {
  const d: string[] = [];
  const cmp = (nom: string, a: unknown, b: unknown) => { if (JSON.stringify(a) !== JSON.stringify(b)) d.push(nom); };
  cmp("apprentissage", disque.apprentissage, relu.apprentissage);
  cmp("verdictRealiste", disque.verdictRealiste, relu.verdictRealiste);
  cmp("verdictsAveugles", disque.verdictsAveugles, relu.verdictsAveugles);
  cmp("livres", disque.livres, relu.livres);
  cmp("reserves", disque.reserves, relu.reserves);
  return d;
}

export async function releveRelu(racine: string): Promise<ReleveEntites> {
  const v = lireVerdicts(readFileSync(CHEMIN_VERDICTS, "utf8"));
  const livres = LIVRES.map((l) => lireLivre(racine, l));
  const commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: racine, encoding: "utf8" }).trim();
  return batirReleve({ date: aujourdhui(), commit, apprentissage: await mesurerApprentissage(), verdictRealiste: v.realiste, verdictsAveugles: v.aveugles, livres });
}

async function principal(): Promise<void> {
  refuserDrapeauxInconnus(["--check"]);
  const racine = fileURLToPath(new URL("..", import.meta.url));
  const relu = await releveRelu(racine);
  if (process.argv.includes("--check")) {
    if (!existsSync(CHEMIN_RELEVE)) { console.error("releve-entites.json is missing: run npm run releve-entites, then npm run sceller -- releve-entites.json"); process.exit(1); }
    const disque = JSON.parse(readFileSync(CHEMIN_RELEVE, "utf8")) as ReleveEntites;
    if (typeof disque.empreinte !== "string") { console.error("releve-entites.json is not sealed: run npm run sceller -- releve-entites.json"); process.exit(1); }
    const d = differences(disque, relu);
    if (d.length > 0) { console.error(`releve-entites.json no longer matches its sources: ${d.join(", ")}. Run npm run releve-entites, then npm run sceller -- releve-entites.json`); process.exit(1); }
    console.log(`releve-entites.json matches its sources (sealed ${disque.empreinte}, ${disque.date}, commit ${disque.commit}).`);
    return;
  }
  writeFileSync(CHEMIN_RELEVE, JSON.stringify(relu, null, 2) + "\n");
  const a = relu.apprentissage, r = relu.verdictRealiste;
  console.log(`releve-entites.json written (unsealed): ${a.jeux} training sets, strong ${a.fort.trouves.succes}/${a.paires} found and ${a.fort.fausses.succes}/${a.pieges} false alerts; realistic verdict ${r.fort.trouves.n}/${r.fort.trouves.sur} with ${r.fort.fausses.n}/${r.fort.fausses.sur}; ${relu.livres.length} books. Now: npm run sceller -- releve-entites.json`);
}

if (isMain(import.meta)) await principal();
