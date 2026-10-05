/**
 * VALIDER UN JEU AVEUGLE avant de le juger : les comptes, le recouvrement avec TOUS les jeux
 * d'apprentissage, les paires identiques à la casse près, les quasi-doublons, les cadratins,
 * l'empreinte. Une seule ligne JSON, jamais une paire : le jeu reste aveugle. Le refus tient en
 * une ligne et dit quoi corriger, sans citer un nom.
 *
 *   npm run valider-jeu -- <chemin.json> [--copier] [--attendu=<paires>/<match>/<different>]
 *
 * `--copier` range le jeu accepté dans ~/Documents/jeux-aveugles/jeu<N>-aveugle.json (N lu dans
 * « blind test set #N » de la provenance ; un fichier présent n'est jamais écrasé), après avoir
 * remplacé les cadratins DANS LES NOMS par un tiret entouré d'espaces, et le dit dans la
 * provenance. C'est la substitution que le verdict de v17 a faite à la main sur le jeu 15 ; la
 * faire ici, toujours pareil, évite qu'un tiret décide d'un verdict.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { isMain, refuserDrapeauxInconnus } from "./cli.ts";
import { CHEMINS_APPRENTISSAGE } from "./entites.ts";

export type PaireBrute = { a: string; b: string; verdict: string; nature: string };
export type JeuBrut = { quoi: string; provenance: string; avertissement: string; paires: PaireBrute[] };
export type Compte = {
  paires: number; match: number; different: number; memePaire: number; memeNom: number;
  identiquesCasse: number; quasiDoublons: number; cadratins: number; sha256: string;
};
export type Analyse = { jeu: JeuBrut | null; compte: Compte | null; refus: string[]; attention: string[] };
export type Nom = { a: string; b: string };

export const CLES_ATTENDUES = ["quoi", "provenance", "avertissement", "paires"] as const;
export const ATTENDU = { paires: 400, match: 200, different: 200 } as const;
/** Les jeux aveugles vivent À CÔTÉ du dépôt, jamais dedans (un jeu aveugle commis n'est plus aveugle) ;
 *  CRUSETRA_JEUX_AVEUGLES les déplace (CASCADE_JEUX_AVEUGLES, l'ancien nom, reste lu en alias déprécié).
 *  Aucun chemin de poste ici : le dépôt est public, et un autre poste doit pouvoir rejouer la promotion
 *  (sans-chemin-machine.test.ts le tient). */
export const dossierJeuxAveugles = (env: NodeJS.ProcessEnv = process.env): string =>
  env.CRUSETRA_JEUX_AVEUGLES ?? env.CASCADE_JEUX_AVEUGLES ?? fileURLToPath(new URL("../../jeux-aveugles", import.meta.url));
export const DOSSIER_JEUX_AVEUGLES = dossierJeuxAveugles();
export const CADRATIN = "\u2014";
export const PHRASE_CADRATINS = "Em dashes inside names were replaced by hyphens before the verdict, blind.";

/** La forme sous laquelle deux noms se recouvrent : sans diacritiques, sans casse, sans
 *  ponctuation ni blancs (« S.A. » rejoint « SA », « Hong-Da » rejoint « Hong Da »). Plus large
 *  que celle de verdict.ts, exprès : un jeu qui recopie un nom d'apprentissage avec un accent en
 *  moins ou un point en plus n'est pas plus aveugle, et un recouvrement en trop coûte un regard,
 *  un recouvrement manqué coûte un verdict. */
export function normaliserNom(s: string): string {
  return s.normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

/** Une paire, dans un sens comme dans l'autre. */
export function cleDePaire(p: Nom): string {
  return [normaliserNom(p.a), normaliserNom(p.b)].sort().join(" | ");
}

/** « À la casse près » garde la définition de verdict.ts (casse et blancs), pour que le compte
 *  reste celui des lignes du registre. */
const aLaCasse = (s: string): string => s.toLowerCase().replace(/\s+/g, " ").trim();

const compterCadratins = (s: string): number => (s.match(/\u2014/g) ?? []).length;

/** La structure, avant tout compte : les quatre clés, pas une de plus, et chaque paire entière.
 *  Le refus nomme un indice, jamais un nom. */
export function refusDeStructure(jeu: unknown): string | null {
  if (typeof jeu !== "object" || jeu === null || Array.isArray(jeu)) return "the file is not a JSON object";
  const cles = Object.keys(jeu).sort().join(", ");
  const attendues = [...CLES_ATTENDUES].sort().join(", ");
  if (cles !== attendues) return `top-level keys are [${cles}], expected exactly [${attendues}]`;
  const j = jeu as Record<string, unknown>;
  for (const c of ["quoi", "provenance", "avertissement"]) {
    if (typeof j[c] !== "string" || (j[c] as string).trim() === "") return `${c} must be a non-empty string`;
  }
  if (!Array.isArray(j.paires)) return "paires must be an array";
  const manques: string[] = [];
  j.paires.forEach((p, i) => {
    if (typeof p !== "object" || p === null) { manques.push(`pair #${i + 1} is not an object`); return; }
    for (const champ of ["a", "b", "verdict", "nature"]) {
      const v = (p as Record<string, unknown>)[champ];
      if (typeof v !== "string" || v.trim() === "") manques.push(`pair #${i + 1} lacks ${champ}`);
    }
  });
  if (manques.length > 0) return manques.slice(0, 3).join(", ") + (manques.length > 3 ? ` (and ${manques.length - 3} more)` : "");
  return null;
}

/** Les jeux d'apprentissage, réduits aux noms : c'est tout ce que le recouvrement regarde. */
export function lireApprentissage(chemins: readonly URL[] = CHEMINS_APPRENTISSAGE): Nom[][] {
  return chemins.map((u) => (JSON.parse(readFileSync(u, "utf8")) as { paires: Nom[] }).paires.map((p) => ({ a: p.a, b: p.b })));
}

/** Le numéro du jeu, lu dans sa provenance (« blind test set #15 »). */
export function numeroDuJeu(provenance: string): number | null {
  const m = /(?:blind test|realistic) set #(\d+)/.exec(provenance);
  return m ? Number(m[1]) : null;
}

/** Les cadratins dans les noms deviennent un tiret entouré d'espaces (les blancs voisins sont
 *  absorbés, pour ne pas laisser deux espaces) ; la provenance le dit, une fois. */
export function nettoyerCadratins(jeu: JeuBrut): { jeu: JeuBrut; remplaces: number } {
  let remplaces = 0;
  const nettoyer = (s: string): string => { remplaces += compterCadratins(s); return s.replace(/\s*\u2014\s*/g, " - ").trim(); };
  const paires = jeu.paires.map((p) => ({ ...p, a: nettoyer(p.a), b: nettoyer(p.b) }));
  if (remplaces === 0) return { jeu, remplaces };
  const provenance = jeu.provenance.includes(PHRASE_CADRATINS) ? jeu.provenance : `${jeu.provenance.trimEnd()} ${PHRASE_CADRATINS}`;
  return { jeu: { ...jeu, provenance, paires }, remplaces };
}

/**
 * Tout ce que la ligne JSON dit, et tout ce qui refuse. `copier` change une seule chose : un
 * cadratin DANS UN NOM n'est plus un refus, puisqu'il va être remplacé ; ailleurs (quoi,
 * provenance, avertissement, nature) il le reste, parce que rien ne le remplacera. `attendu` :
 * les comptes d'un jeu d'une autre nature (le jeu realiste de 600 paires) ; par defaut ceux
 * d'un jeu aveugle, 400/200/200, et promouvoir n'en connait pas d'autres : un jeu realiste se
 * juge, il ne s'apprend pas.
 */
export type Attendu = { paires: number; match: number; different: number };

export function analyserJeu(brut: string, apprentissage: readonly (readonly Nom[])[], options: { copier?: boolean; attendu?: Attendu } = {}): Analyse {
  let lu: unknown;
  try { lu = JSON.parse(brut); } catch (e) { return { jeu: null, compte: null, refus: [`not valid JSON (${e instanceof Error ? e.message : String(e)})`] , attention: [] }; }
  const structure = refusDeStructure(lu);
  if (structure !== null) return { jeu: null, compte: null, refus: [structure] , attention: [] };
  const jeu = lu as JeuBrut;

  const clesApprises = new Set<string>(), nomsAppris = new Set<string>();
  for (const paires of apprentissage) for (const p of paires) { clesApprises.add(cleDePaire(p)); nomsAppris.add(normaliserNom(p.a)); nomsAppris.add(normaliserNom(p.b)); }

  const parCle = new Map<string, number>();
  for (const p of jeu.paires) { const k = cleDePaire(p); parCle.set(k, (parCle.get(k) ?? 0) + 1); }
  const nomsVus = new Set<string>();
  let memePaire = 0, identiquesCasse = 0, quasiDoublons = 0, cadratinsDansLesNoms = 0, verdictsInconnus = 0;
  const exacts = new Map<string, number>();
  for (const p of jeu.paires) {
    if (clesApprises.has(cleDePaire(p))) memePaire++;
    for (const n of [normaliserNom(p.a), normaliserNom(p.b)]) if (nomsAppris.has(n)) nomsVus.add(n);
    if (aLaCasse(p.a) === aLaCasse(p.b)) identiquesCasse++;
    if ((parCle.get(cleDePaire(p)) ?? 0) > 1) quasiDoublons++;
    cadratinsDansLesNoms += compterCadratins(p.a) + compterCadratins(p.b);
    if (p.verdict !== "match" && p.verdict !== "different") verdictsInconnus++;
    const e = [p.a, p.b].sort().join(" / "); exacts.set(e, (exacts.get(e) ?? 0) + 1);
  }
  const match = jeu.paires.filter((p) => p.verdict === "match").length;
  const different = jeu.paires.filter((p) => p.verdict === "different").length;
  const cadratins = compterCadratins(brut);
  const compte: Compte = {
    paires: jeu.paires.length, match, different, memePaire, memeNom: nomsVus.size,
    identiquesCasse, quasiDoublons, cadratins, sha256: createHash("sha256").update(brut).digest("hex"),
  };

  const refus: string[] = [];
  const attendu: Attendu = options.attendu ?? ATTENDU;
  if (compte.paires !== attendu.paires || match !== attendu.match || different !== attendu.different) {
    refus.push(`${compte.paires} pairs, ${match} match, ${different} different: expected ${attendu.paires}/${attendu.match}/${attendu.different}`);
  }
  if (verdictsInconnus > 0) refus.push(`${verdictsInconnus} pair(s) carry a verdict outside match/different`);
  const doubles = [...exacts.values()].filter((n) => n > 1).length;
  if (doubles > 0) refus.push(`${doubles} pair(s) written twice, order included`);
  /* un recouvrement d'une ou deux paires (un nom inventé deux fois, jeu 19) et les paires identiques à la casse près (jeux 15 et 17)
     s'ÉCRIVENT dans la ligne du Juge, comme il le fait déjà : on avertit, on ne refuse pas ; au-delà de deux paires, c'est une fuite */
  const attention: string[] = [];
  if (memePaire > 2) refus.push(`overlap with the ${apprentissage.length} training sets: ${memePaire} pair(s), ${compte.memeNom} name(s)`);
  else if (memePaire > 0 || compte.memeNom > 0) attention.push(`overlap with the ${apprentissage.length} training sets: ${memePaire} pair(s), ${compte.memeNom} name(s), to be written in the judge row`);
  if (identiquesCasse > 0) attention.push(`${identiquesCasse} pair(s) identical but for case, to be written in the judge row`);
  if (attention.length > 0) console.error(`attention: ${attention.join(" · ")}`);
  const horsNoms = cadratins - cadratinsDansLesNoms;
  if (options.copier) {
    if (horsNoms > 0) refus.push(`${horsNoms} em dash(es) outside names (quoi, provenance, avertissement or nature): replace them by hand`);
  } else if (cadratins > 0) {
    refus.push(`${cadratins} em dash(es) in the file${cadratinsDansLesNoms > 0 ? ` (${cadratinsDansLesNoms} inside names, which --copier replaces by hyphens)` : ""}`);
  }
  return { jeu, compte, refus, attention };
}

/** La copie sous son numéro, jamais par-dessus une autre. Sans cadratin à remplacer, ce sont
 *  les octets mêmes qui partent (l'empreinte reste celle du fichier reçu). */
export function copier(brut: string, jeu: JeuBrut, dossier: string): { chemin: string; sha256: string; remplaces: number } {
  const n = numeroDuJeu(jeu.provenance);
  if (n === null) throw new Error("the provenance does not say \"blind test set #N\" nor \"realistic set #N\": no number to file the copy under");
  const chemin = join(dossier, `jeu${n}-aveugle.json`);
  if (existsSync(chemin)) throw new Error(`${chemin} exists already and is not overwritten`);
  const { jeu: propre, remplaces } = nettoyerCadratins(jeu);
  const texte = remplaces === 0 ? brut : JSON.stringify(propre, null, 2) + "\n";
  mkdirSync(dossier, { recursive: true });
  writeFileSync(chemin, texte, { flag: "wx" });
  return { chemin, sha256: createHash("sha256").update(texte).digest("hex"), remplaces };
}

/** `--attendu=600/400/200` : les comptes d'un jeu d'une autre nature que le jeu aveugle. Mal
 *  forme, il refuse : un compte devine validerait n'importe quoi. */
export function lireAttendu(drapeau: string | undefined): Attendu | undefined {
  if (drapeau === undefined) return undefined;
  const m = /^--attendu=(\d+)\/(\d+)\/(\d+)$/.exec(drapeau);
  if (!m) throw new Error(`${drapeau}: expected --attendu=<pairs>/<match>/<different>`);
  const attendu = { paires: Number(m[1]), match: Number(m[2]), different: Number(m[3]) };
  if (attendu.match + attendu.different !== attendu.paires) throw new Error(`${drapeau}: match + different must equal pairs`);
  return attendu;
}

function principal(): void {
  refuserDrapeauxInconnus(["--copier", "--attendu"]);
  const chemin = process.argv.slice(2).find((a) => !a.startsWith("--"));
  if (!chemin) { console.error("usage: npm run valider-jeu -- <chemin.json> [--copier] [--attendu=<pairs>/<match>/<different>]"); process.exit(2); }
  if (!existsSync(chemin)) { console.error(`${chemin}: no such file`); process.exit(2); }
  const veutCopier = process.argv.includes("--copier");
  const brut = readFileSync(chemin, "utf8");
  let attendu: Attendu | undefined;
  try { attendu = lireAttendu(process.argv.find((a) => a.startsWith("--attendu"))); }
  catch (e) { console.error(e instanceof Error ? e.message : String(e)); process.exit(2); }
  const { jeu, compte, refus } = analyserJeu(brut, lireApprentissage(), { copier: veutCopier, attendu });
  if (compte) console.log(JSON.stringify(compte));
  if (refus.length > 0) { console.error(`refused: ${refus.join(" · ")}`); process.exit(1); }
  if (veutCopier && jeu) {
    try {
      const c = copier(brut, jeu, DOSSIER_JEUX_AVEUGLES);
      console.log(`copied to ${c.chemin} · sha256 ${c.sha256}${c.remplaces > 0 ? ` · ${c.remplaces} em dash(es) inside names replaced` : ""}`);
    } catch (e) { console.error(`refused: ${e instanceof Error ? e.message : String(e)}`); process.exit(1); }
  }
}

if (isMain(import.meta)) principal();
