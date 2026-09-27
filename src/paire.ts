/**
 * LE DIAGNOSTIC D'UNE PAIRE : ce que le chef réécrivait en script jetable à chaque tour pour
 * comprendre un score. Une commande, un texte plat, un fait par ligne : le score et la paire de
 * lectures qui l'a donné avec son plafond, puis pour chaque côté les variantes typées, les
 * lectures, les mots préparés avec leurs poids et leurs squelettes, les marques posées, et enfin
 * si `marquesEnConflit` tire entre les deux noms préparés. Rien n'est scoré autrement qu'ici :
 * la boucle des lectures est celle de `scoreNoms`, refaite pour garder la paire gagnante, et le
 * test le prouve en comparant les deux.
 *
 *   npm run paire -- "a" "b" [--sans-listes]
 *   npm run paire -- --limites [--corriger]     les paires de doc/LIMITES.md rejouées, celles
 *                                              dont le score a bougé nommées ; --corriger
 *                                              réécrit la colonne du score
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { isMain, refuserDrapeauxInconnus } from "./cli.ts";
import { frequencesDesListes } from "./frequences.ts";
import {
  scoreNoms, lecturesDe, variantesTypees, plafondDesLectures, preparerNom, scoreBrut, marquesEnConflit,
  succursalesCompatibles, FREQUENCES_UNIFORMES, type Frequences, type LectureDe, type Marques, type NomPrepare,
} from "./entites.ts";
import { CHEMIN_LIMITES, lignesLimites, type Limite } from "./rates-du-jeu.ts";

export type Meilleure = { score: number; brut: number; plafond: number; la: LectureDe; lb: LectureDe; A: NomPrepare; B: NomPrepare };

/** La paire de lectures qui a donné le score : le maximum de `scoreNoms`, le plafond des lectures
 *  appliqué au score brut. Plusieurs paires de lectures atteignent souvent le même maximum (l'ancien
 *  nom des deux côtés plafonné à 0,8, et le nom entier qui contient cet ancien nom à 0,8 aussi) : on
 *  montre celle dont le plafond a le plus retenu, le score brut le plus haut, parce que c'est elle qui
 *  explique le chiffre. Le score rendu est le même quelle que soit la paire montrée (le test le tient). */
export function meilleureLecture(f: Frequences, a: string, b: string): Meilleure {
  let meilleure: Meilleure | undefined;
  for (const la of lecturesDe(a)) {
    const A = preparerNom(f, la.texte, la.lecture);
    for (const lb of lecturesDe(b)) {
      const B = preparerNom(f, lb.texte, lb.lecture);
      const plafond = plafondDesLectures(la, lb);
      const brut = scoreBrut(f, la.texte, A, lb.texte, B);
      const score = Math.min(plafond, brut);
      if (meilleure === undefined || score > meilleure.score || (score === meilleure.score && brut > meilleure.brut)) {
        meilleure = { score, brut, plafond, la, lb, A, B };
      }
    }
  }
  if (meilleure === undefined) throw new Error(`no reading for "${a}" / "${b}": lecturesDe returned nothing`);
  return meilleure;
}

/** Ce qui a plafonné deux lectures, dans l'ordre où `plafondDesLectures` regarde ; « » quand rien
 *  des cinq raisons connues ne tire (le plafond a alors gagné une raison que ce diagnostic ignore). */
export function raisonDuPlafond(a: LectureDe, b: LectureDe): string {
  if (a.ancien && b.ancien) return "a former name on both sides";
  if (a.mention !== "" && b.mention !== "" && !succursalesCompatibles(a.mention, b.mention)) return `two branch mentions, ${a.mention} / ${b.mention}`;
  if (a.registre !== "" && b.registre !== "" && a.registre !== b.registre) return `two registration numbers, ${a.registre} / ${b.registre}`;
  if (a.partie !== "" && b.partie !== "" && a.partie !== b.partie) return `two document parties, ${a.partie} / ${b.partie}`;
  if (a.paysRegistre !== "" && b.paysRegistre !== "" && a.paysRegistre !== b.paysRegistre) return `two registration countries, ${a.paysRegistre} / ${b.paysRegistre}`;
  return "";
}

/** Les marques dans l'ordre où on les lit : ce que la préparation a retiré d'abord, la langue ensuite. */
const ORDRE_DES_MARQUES: readonly (keyof Marques)[] = [
  "pays", "familles", "designations", "navire", "societe", "typeNavire", "filiation", "filiationOrdre", "succursale",
  "arabe", "japonais", "chinois", "coreen", "hebreuOuGrec", "indien", "hispanique", "tamoul", "thai", "slave",
  "prive", "priveInconnu", "majuscules", "chat", "abjad", "cantonais", "lecture", "natifs",
];

/** Une ligne par marque vraie ou non vide, rien pour les autres : « mark: navire », « mark: pays = pk ». */
export function lignesDesMarques(m: Marques): string[] {
  const sortie: string[] = [];
  for (const cle of ORDRE_DES_MARQUES) {
    const v = m[cle];
    if (typeof v === "boolean") { if (v) sortie.push(`mark: ${cle}`); }
    else if (typeof v === "string") { if (v !== "") sortie.push(`mark: ${cle} = ${v}`); }
    else if ("size" in v) { if (v.size) sortie.push(`mark: ${cle} = ${[...v].map(([jeton, caracteres]) => `${jeton}:${caracteres}`).join(", ")}`); }
    else if (v.length) sortie.push(`mark: ${cle} = ${v.join(", ")}`);
  }
  return sortie;
}

/** Un côté de la paire : ses variantes typées, ses lectures, les mots de sa première lecture avec
 *  leurs poids et squelettes, ses numéros s'il en porte, ses marques. */
export function lignesDUnCote(f: Frequences, etiquette: string, brut: string): string[] {
  const sortie = [`${etiquette}: ${brut}`];
  for (const v of variantesTypees(brut)) {
    const proprietes = [
      v.ancien ? "ancien" : "", v.mention ? `mention=${v.mention}` : "", v.registre ? `registre=${v.registre}` : "",
      v.partie ? `partie=${v.partie}` : "", v.paysRegistre ? `paysRegistre=${v.paysRegistre}` : "",
    ].filter((p) => p !== "");
    sortie.push(`  variant: ${v.texte}${proprietes.length ? `  [${proprietes.join(", ")}]` : ""}`);
  }
  const lectures = lecturesDe(brut);
  for (const l of lectures) sortie.push(`  reading: ${l.lecture}  ${l.texte}`);
  const premiere = lectures[0];
  if (premiere === undefined) return sortie;
  const N = preparerNom(f, premiere.texte, premiere.lecture);
  N.mots.forEach((mot, i) => sortie.push(`  word: ${mot}  weight ${N.poids[i]!.toFixed(3)}  skeleton ${N.squelettes[i]}`));
  if (N.numeros !== "") sortie.push(`  numbers: ${N.numeros}`);
  sortie.push(...lignesDesMarques(N.marques).map((l) => `  ${l}`));
  return sortie;
}

/** Le diagnostic entier, dans l'ordre où on le lit : le score, ce qui l'a donné, chaque côté, le conflit. */
export function diagnostic(f: Frequences, a: string, b: string): string[] {
  const m = meilleureLecture(f, a, b);
  const sortie = [
    `pair: ${a}  /  ${b}`,
    `score: ${m.score.toFixed(3)}`,
    `read as: ${m.la.texte} (${m.la.lecture})  /  ${m.lb.texte} (${m.lb.lecture})`,
    `raw score: ${m.brut.toFixed(3)}`,
    `cap (plafondDesLectures): ${m.plafond.toFixed(3)}`,
  ];
  if (m.plafond < 1) sortie.push(`cap reason: ${raisonDuPlafond(m.la, m.lb) || "none of the five known reasons (plafondDesLectures gained one)"}`);
  sortie.push("", ...lignesDUnCote(f, "a", a), "", ...lignesDUnCote(f, "b", b), "");
  const conflit = marquesEnConflit(m.A.marques, m.B.marques);
  sortie.push(`marks conflict (marquesEnConflit): ${conflit ? "yes" : "no"}`);
  /* le conflit tient-il sans les pays ? c'est la seule marque que `scorePrepares` sait taire (raisons bilingues) */
  if (conflit) sortie.push(`marks conflict without pays: ${marquesEnConflit({ ...m.A.marques, pays: [] }, { ...m.B.marques, pays: [] }) ? "yes" : "no"}`);
  return sortie;
}

/** Les lignes du registre dont le score a bougé, et le texte du registre avec la colonne refaite. */
export function rejouerLimites(f: Frequences, markdown: string): { bougees: string[]; texte: string } {
  const bougees: string[] = [];
  const parCle = new Map<string, Limite>(lignesLimites(markdown).map((l) => [`${l.a}\u0000${l.b}`, l]));
  const texte = markdown.split("\n").map((ligne) => {
    if (!ligne.startsWith("|")) return ligne;
    const cellules = ligne.split("|").slice(1, -1).map((c) => c.trim());
    const l = parCle.get(`${cellules[0]}\u0000${cellules[1]}`);
    if (l === undefined) return ligne;
    const actuel = scoreNoms(f, l.a, l.b).toFixed(3);
    if (actuel === l.score) return ligne;
    bougees.push(`set ${l.jeu}  ${l.score} -> ${actuel}  ${l.a}  /  ${l.b}`);
    return `| ${l.a} | ${l.b} | ${l.jeu} | ${actuel} | ${l.raison} |`;
  }).join("\n");
  return { bougees, texte };
}

function principal(): void {
  refuserDrapeauxInconnus(["--sans-listes", "--limites", "--corriger"]);
  const drapeaux = new Set(process.argv.slice(2).filter((x) => x.startsWith("--") && x !== "--"));
  const noms = process.argv.slice(2).filter((x) => !drapeaux.has(x));
  const usage = () => {
    console.error('usage: npm run paire -- "a" "b" [--sans-listes]\n       npm run paire -- --limites [--corriger]');
    process.exit(2);
  };
  const f = drapeaux.has("--sans-listes") ? FREQUENCES_UNIFORMES : frequencesDesListes();
  if (drapeaux.has("--limites")) {
    if (noms.length !== 0) usage();
    const chemin = fileURLToPath(CHEMIN_LIMITES);
    const { bougees, texte } = rejouerLimites(f, readFileSync(chemin, "utf8"));
    if (bougees.length === 0) { console.log("doc/LIMITES.md: every score is current"); return; }
    console.log(bougees.join("\n"));
    if (drapeaux.has("--corriger")) { writeFileSync(chemin, texte); console.log(`doc/LIMITES.md: ${bougees.length} score(s) rewritten`); return; }
    console.log(`${bougees.length} score(s) moved; rerun with --corriger to rewrite them`);
    process.exit(1);
  }
  if (drapeaux.has("--corriger") || noms.length !== 2 || noms.some((n) => n.trim() === "")) usage();
  console.log(diagnostic(f, noms[0]!, noms[1]!).join("\n"));
}

if (isMain(import.meta)) principal();
