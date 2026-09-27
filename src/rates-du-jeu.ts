/**
 * LES RATÉS D'UN JEU : ce que le jeu d'apprentissage N ne passe pas encore, groupé par la nature
 * que son auteur a donnée à chaque paire, pour écrire le brief d'une voie. La mesure détaillée
 * est celle de mesure-entites, relancée ici dans un fichier temporaire (comme scripts/voie.sh) ou
 * lue dans un fichier déjà écrit ; ce script ne score rien lui-même, il filtre. Il garde les
 * lignes RATÉ, FAUSSE-F et possible ; les fausses alertes au seul niveau possible (fausse-p) sont
 * le prix des plafonds, pas une cible. Une paire que le registre des limites connues
 * (doc/LIMITES.md) porte sort avec sa raison, pour qu'une voie ne la redécouvre pas.
 *
 *   npm run rates-du-jeu -- <N> [--mesure <fichier>]
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isMain, refuserDrapeauxInconnus } from "./cli.ts";
import { fichierDuJeu } from "./promouvoir.ts";

export type Niveau = "RATÉ" | "FAUSSE-F" | "possible";
export type Ligne = { niveau: Niveau; score: string; texte: string };
export type Groupe = { nature: string; lignes: Ligne[] };
export type Paire = { a: string; b: string; nature: string };
/** Une ligne du registre des limites connues : la paire, son jeu, le score au moment de la ligne, la raison. */
export type Limite = { a: string; b: string; jeu: number; score: string; raison: string };

const NIVEAUX: readonly Niveau[] = ["RATÉ", "FAUSSE-F", "possible"];
const ORDRE = new Map<Niveau, number>(NIVEAUX.map((n, i) => [n, i]));

/** La clé d'une paire telle que mesure-entites l'imprime : « a  /  b », dans l'ordre du jeu. */
export const cleImprimee = (p: { a: string; b: string }): string => `${p.a}  /  ${p.b}`;

/* ─────────────────────────── le registre des limites connues ─────────────────────────── */

export const CHEMIN_LIMITES = new URL("../doc/LIMITES.md", import.meta.url);

/** Les lignes de la table de doc/LIMITES.md (« | a | b | set | score | reason | ») : l'en-tête et le
 *  filet sautés, tout ce qui n'est pas une ligne de table ignoré. Un nom ne porte jamais de barre. */
export function lignesLimites(markdown: string): Limite[] {
  const sortie: Limite[] = [];
  for (const l of markdown.split("\n")) {
    if (!l.startsWith("|")) continue;
    const cellules = l.split("|").slice(1, -1).map((c) => c.trim());
    if (cellules.length !== 5) continue;
    const [a, b, jeu, score, raison] = cellules as [string, string, string, string, string];
    if ((a === "a" && b === "b") || cellules.every((c) => /^:?-+:?$/.test(c))) continue;
    sortie.push({ a, b, jeu: Number(jeu), score, raison });
  }
  return sortie;
}

/** La raison de chaque paire du registre, sous sa clé imprimée dans les deux ordres : la mesure
 *  imprime la paire dans l'ordre du jeu, le registre peut l'avoir écrite dans l'autre. */
export function limitesDepuis(markdown: string): Map<string, string> {
  const limites = new Map<string, string>();
  for (const l of lignesLimites(markdown)) {
    limites.set(cleImprimee(l), l.raison);
    limites.set(cleImprimee({ a: l.b, b: l.a }), l.raison);
  }
  return limites;
}

export function lireLimites(chemin: URL = CHEMIN_LIMITES): Map<string, string> {
  return limitesDepuis(readFileSync(chemin, "utf8"));
}

/** Les lignes de détail de la mesure qui appartiennent au jeu, groupées par nature. Le groupe le
 *  plus fourni d'abord ; dans un groupe, les ratés avant les fausses alertes fortes avant les
 *  possibles, puis du score le plus bas au plus haut. */
export function lignesDuJeu(mesure: string, paires: readonly Paire[]): Groupe[] {
  const natures = new Map<string, string>(paires.map((p) => [cleImprimee(p), p.nature]));
  const groupes = new Map<string, Ligne[]>();
  for (const l of mesure.split("\n")) {
    const m = /^  (RATÉ|FAUSSE-F|possible|fausse-p) +(\d\.\d{3}) +(\S+) +(.*)$/.exec(l);
    if (!m || m[1] === "fausse-p") continue;
    const nature = natures.get(m[4]!);
    if (nature === undefined) continue;
    const liste = groupes.get(nature) ?? [];
    liste.push({ niveau: m[1] as Niveau, score: m[2]!, texte: m[4]! });
    groupes.set(nature, liste);
  }
  const tri = (x: Ligne, y: Ligne) => (ORDRE.get(x.niveau)! - ORDRE.get(y.niveau)!) || x.score.localeCompare(y.score);
  return [...groupes.entries()]
    .map(([nature, lignes]) => ({ nature, lignes: lignes.sort(tri) }))
    .sort((g, h) => h.lignes.length - g.lignes.length || g.nature.localeCompare(h.nature));
}

/** Le rendu : le nom du groupe et son compte, une ligne par paire, et les trois totaux à la fin.
 *  Une paire du registre des limites connues porte sa raison en queue de ligne, et le total les
 *  compte : un brief écrit dessus dit à la voie ce qu'elle ne rouvre pas (doc/VOIE.md, règle 11). */
export function rendre(groupes: readonly Groupe[], limites: ReadonlyMap<string, string> = new Map()): string[] {
  const sortie: string[] = [];
  const totaux = new Map<Niveau, number>(NIVEAUX.map((n) => [n, 0]));
  let connues = 0;
  for (const g of groupes) {
    sortie.push(`${g.nature} (${g.lignes.length})`);
    for (const l of g.lignes) {
      const raison = limites.get(l.texte);
      if (raison !== undefined) connues++;
      sortie.push(`  ${l.niveau.padEnd(8)} ${l.score}  ${l.texte}${raison !== undefined ? ` (limite connue: ${raison})` : ""}`);
      totaux.set(l.niveau, totaux.get(l.niveau)! + 1);
    }
  }
  sortie.push(`total: ${NIVEAUX.map((n) => `${totaux.get(n)} ${n}`).join(", ")}${connues ? ` · ${connues} limite${connues > 1 ? "s" : ""} connue${connues > 1 ? "s" : ""}` : ""}`);
  return sortie;
}

/** La mesure détaillée, relancée comme voie.sh la lance, dans un fichier temporaire dont le chemin
 *  part sur stderr : le rapport (stdout) ne porte que les ratés. */
export function mesurer(): string {
  const dossier = mkdtempSync(join(tmpdir(), "rates-du-jeu-"));
  const fichier = join(dossier, "mesure-detail.txt");
  const r = spawnSync("node", [new URL("./mesure-entites.ts", import.meta.url).pathname, "--detail"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) { console.error(r.stderr); process.exit(r.status ?? 1); }
  writeFileSync(fichier, r.stdout);
  console.error(`measure written to ${fichier} (reuse it with --mesure)`);
  return r.stdout;
}

function principal(): void {
  refuserDrapeauxInconnus(["--mesure"]);
  const argv = process.argv.slice(2);
  const iMesure = argv.indexOf("--mesure");
  const fichierMesure = iMesure >= 0 ? argv[iMesure + 1] : undefined;
  const restes = iMesure >= 0 ? argv.filter((_, i) => i !== iMesure && i !== iMesure + 1) : argv;
  const n = restes.length === 1 && /^\d+$/.test(restes[0]!) ? Number(restes[0]) : NaN;
  if (!Number.isInteger(n) || n < 1 || (iMesure >= 0 && !fichierMesure)) {
    console.error("usage: npm run rates-du-jeu -- <N> [--mesure <fichier>]");
    process.exit(2);
  }
  const cheminJeu = new URL(`./${fichierDuJeu(n)}`, import.meta.url);
  if (!existsSync(cheminJeu)) { console.error(`src/${fichierDuJeu(n)}: no such training set`); process.exit(2); }
  if (fichierMesure !== undefined && !existsSync(fichierMesure)) { console.error(`${fichierMesure}: no such file`); process.exit(2); }
  /* le registre absent n'est pas un rapport sans limite, c'est un rapport qui ne sait pas : refus */
  if (!existsSync(CHEMIN_LIMITES)) { console.error("doc/LIMITES.md: the register of known limits is missing; nothing was run"); process.exit(2); }
  const paires = (JSON.parse(readFileSync(cheminJeu, "utf8")) as { paires: Paire[] }).paires;
  const mesure = fichierMesure !== undefined ? readFileSync(fichierMesure, "utf8") : mesurer();
  console.log(rendre(lignesDuJeu(mesure, paires), lireLimites()).join("\n"));
}

if (isMain(import.meta)) principal();
