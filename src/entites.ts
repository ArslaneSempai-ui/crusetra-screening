/**
 * LES NOMS DE SOCIÉTÉS ET DE NAVIRES : la préparation qui les rend comparables, le score qui
 * les compare, et la mesure qui dit ce que la méthode vaut sur eux.
 *
 * Le relevé public (RELEVE-PUBLIC.md) mesure les paliers sur des noms de PERSONNES. Un
 * transitaire ou un exportateur crible surtout des sociétés et des navires, où les écarts
 * ne sont pas les mêmes : la forme juridique (« Ltd » contre « Limited », « OOO » devant ou
 * derrière, « Obshchestvo s ogranichennoi otvetstvennostyu » en toutes lettres), les
 * abréviations (« Intl », « Bros », « & »), le préfixe de navire (« M/V »). Et les pièges
 * non plus : la filiale d'un groupe sanctionné n'est pas sanctionnée, et « Hong Da 1 » n'est
 * pas « Hong Da 8 ».
 *
 * ─── CE QUE LA PRÉPARATION RETIRE, ET POURQUOI LA LISTE VIENT DU MÉTIER ───
 *
 * Chaque mot retiré ici l'est des DEUX côtés, et il est choisi dans l'usage des registres de
 * sociétés, pas dans les jeux de paires : une liste allongée jusqu'à ce que la mesure plaise
 * mesurerait la liste, pas la méthode. Le jeu témoin (`paires-entites-temoin.json`), écrit
 * par une autre main qui n'a jamais vu ce fichier, est là pour le vérifier.
 */
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { normaliser, jetons } from "./matchers/normaliser.ts";
import { mesurerPaires, validerPaires, type JeuDePaires, type TableDUnPalier, type Cellule } from "./measure.ts";
import type { Matcher, PalierId } from "./matcher.ts";
import { distanceOsa } from "./matchers/damerau.ts";
import { preparer } from "./matchers/preparer.ts";
import { translitterer } from "./matchers/translitteration.ts";
import { romaniser, cleAbjad, cleAbjadSansTa, abjadDe, estJaponais, type Abjad, type Lecture } from "./ecritures.ts";
import type { Frequences } from "./mots.ts";
import { lecturesDe } from "./variantes.ts";
import { preparerNom } from "./score.ts";
import { plafondDesLectures } from "./variantes.ts";
import { scoreBrut } from "./score.ts";
import { FACTEUR_CONTENANCE } from "./score.ts";
export * from "./preparation.ts";
export * from "./mots.ts";
export * from "./score.ts";
export * from "./variantes.ts";

export function scoreNoms(f: Frequences, a: string, b: string): number {
  let meilleur = 0;
  for (const la of lecturesDe(a)) {
    const A = preparerNom(f, la.texte, la.lecture);
    for (const lb of lecturesDe(b)) {
      meilleur = Math.max(meilleur, Math.min(plafondDesLectures(la, lb), scoreBrut(f, la.texte, A, lb.texte, preparerNom(f, lb.texte, lb.lecture))));
    }
  }
  return meilleur;
}

/** Le score d'entité sous la forme d'un palier, pour être mesuré avec la machinerie des
 *  sept. Il n'entre pas à leur registre : le contrat de ce registre est celui des noms de
 *  personnes, et un huitième palier y changerait le relevé public. */
export function palierEntite(f: Frequences): Matcher {
  return {
    id: "entite" as PalierId,
    description: "company and vessel names: words aligned in any order and weighted by their rarity on the lists, typos, OCR slips and romanisation variants tolerated, vessel numbers must agree, a listed name found inside a longer one is a possible match, and former names, trading names and document annotations are read as such",
    rang: 4,
    score: (a: string, b: string) => scoreNoms(f, a, b),
  };
}

/* ─────────────────────────── la mesure sur les paires ─────────────────────────── */

/** Les jeux d'APPRENTISSAGE : ceux sur lesquels le réglage est choisi, et la méthode mise au
 *  point. Le second a d'abord été un jeu témoin ; étudié, il a changé de rôle (sa provenance
 *  le dit). */
export const CHEMINS_APPRENTISSAGE = [
  new URL("./paires-entites.json", import.meta.url),
  new URL("./paires-entites-2.json", import.meta.url),
  new URL("./paires-entites-3.json", import.meta.url),
  new URL("./paires-entites-4.json", import.meta.url),
  new URL("./paires-entites-5.json", import.meta.url),
  new URL("./paires-entites-6.json", import.meta.url),
  new URL("./paires-entites-7.json", import.meta.url),
  new URL("./paires-entites-8.json", import.meta.url),
  new URL("./paires-entites-9.json", import.meta.url),
  new URL("./paires-entites-10.json", import.meta.url),
  new URL("./paires-entites-11.json", import.meta.url),
  new URL("./paires-entites-12.json", import.meta.url),
  new URL("./paires-entites-13.json", import.meta.url),
  new URL("./paires-entites-14.json", import.meta.url),
  new URL("./paires-entites-15.json", import.meta.url),
  new URL("./paires-entites-16.json", import.meta.url),
  new URL("./paires-entites-17.json", import.meta.url),
];
/** Le jeu de VERDICT : écrit par une autre main qui n'a vu ni ce fichier ni les autres jeux,
 *  lu une seule fois la méthode figée, JAMAIS utilisé pour choisir un seuil. Ses taux sont
 *  ceux qu'un lecteur doit croire. */
export const CHEMIN_VERDICT = new URL("../verification/paires-entites-verdict.json", import.meta.url);

export type JeuMesure = { quoi: string; provenance: string; sha256: string; match: number; different: number };
export type MesureEntites = { jeux: JeuMesure[]; table: TableDUnPalier };

/** Des jeux de paires, réunis puis mesurés par le score d'entité. Les noms bruts entrent :
 *  la préparation est celle du criblage, dans le même ordre. */
export function mesurerJeux(f: Frequences, bruts: readonly string[]): MesureEntites {
  const jeux: JeuMesure[] = [];
  const toutes = bruts.flatMap((brut) => {
    const jeu = JSON.parse(brut) as JeuDePaires;
    const paires = validerPaires(jeu);
    const match = paires.filter((x) => x.verdict === "match").length;
    jeux.push({ quoi: jeu.quoi, provenance: jeu.provenance,
      sha256: createHash("sha256").update(brut).digest("hex"), match, different: paires.length - match });
    return paires;
  });
  const p = palierEntite(f);
  return { jeux, table: mesurerPaires(new Map([[p.id, p]]), toutes)[p.id]! };
}

export function lireJeu(chemin: URL): string | null {
  return existsSync(chemin) ? readFileSync(chemin, "utf8") : null;
}

/** Le japonais en Hepburn et en Nihon-shiki (tsu, tu ; chi, ti ; shi, si ; fu, hu ; ji, zi), et ses
 *  voyelles longues (ō : o, oo, ou, oh ; ū : u, uu). */

export const RAPPEL_MIN = 0.90;
/** Le niveau FORT : au plus une fausse alerte sur vingt sur les pièges d'apprentissage. */
export const FAUSSES_ALERTES_MAX_FORT = 0.05;
/** Le niveau POSSIBLE est celui des PLAFONDS : un nom retrouvé dans un plus long, une forme
 *  juridique d'un autre pays, un mot distinctif d'un seul côté, un mot court à une lettre
 *  près, un numéro d'un seul côté : la méthode y voit une raison précise de douter, et
 *  range ces candidats à FACTEUR_CONTENANCE (0,80) ou juste au-dessous. */
export const SEUIL_POSSIBLE = FACTEUR_CONTENANCE;

export type Niveau = { seuil: number; rappel: Cellule; fauxPositifs: Cellule };
export type Reglage = {
  fort: Niveau; possible: Niveau;
  /** false : même le niveau possible ne tient pas RAPPEL_MIN à la borne basse ; le rapport
   *  le dit en réserve. */
  tientLePlancher: boolean;
};

/**
 * Les deux seuils.
 *  - POSSIBLE : SEUIL_POSSIBLE, le niveau des plafonds ; structurel, pas mesuré.
 *  - FORT : au-dessus du possible, le plus bas seuil dont les fausses alertes restent sous
 *    FAUSSES_ALERTES_MAX_FORT sur l'apprentissage (le plus de vrais noms possible à ce niveau
 *    de confiance). Les taux des deux niveaux sont mesurés, et cités.
 */
export function choisirSeuils(t: TableDUnPalier): Reglage {
  const cellules = Object.entries(t).map(([seuil, c]) => ({ seuil: Number(seuil), ...c }))
    .sort((a, b) => a.seuil - b.seuil);
  if (cellules.length === 0) throw new Error("the threshold grid is empty: nothing was measured.");
  const niveau = (c: (typeof cellules)[number]): Niveau => ({ seuil: c.seuil, rappel: c.rappel, fauxPositifs: c.fauxPositifs });
  const possible = cellules.find((c) => c.seuil >= SEUIL_POSSIBLE - 1e-9) ?? cellules[0]!;
  const fort = cellules.find((c) => c.seuil > possible.seuil && c.fauxPositifs.taux <= FAUSSES_ALERTES_MAX_FORT)
    ?? cellules[cellules.length - 1]!;
  return { fort: niveau(fort), possible: niveau(possible), tientLePlancher: possible.rappel.bas >= RAPPEL_MIN };
}

/** L'inverse d'`apport` : la similarité qu'un mot doit AU MOINS avoir avec un mot de l'autre
 *  nom pour que le score d'alignement atteigne `seuil`. Le score est une moyenne pondérée
 *  d'apports ; si aucun mot n'apporte `seuil`, la moyenne ne l'atteint pas. C'est ce qui
 *  permet au criblage de ne comparer que les noms qui PEUVENT passer, sans rien perdre. */
export function simMinimale(seuil: number): number {
  return 0.5 + 0.5 * seuil;
}
