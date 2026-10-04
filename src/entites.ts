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
  new URL("./paires-entites-18.json", import.meta.url),
  new URL("./paires-entites-19.json", import.meta.url),
  new URL("./paires-entites-20.json", import.meta.url),
  new URL("./paires-entites-21.json", import.meta.url),
  new URL("./paires-entites-22.json", import.meta.url),
  new URL("./paires-entites-23.json", import.meta.url),
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

/* ─────────────────────────── le choix des deux seuils ─────────────────────────── */

/**
 * L'ÉCHANTILLON D'APPRENTISSAGE RÉEL : des noms de sociétés du registre GLEIF (CC0), tirés par src/gleif-paires.ts avec la graine
 * 20261001, sans aucun nom commun avec le verdict dépensé (verification/paires-gleif.json) ni avec le verdict frais
 * (verification/paires-gleif-2.json). Ses 1 000 paires « different » sont de VRAIES sociétés distinctes qui partagent un mot
 * distinctif : la population qu'une équipe de criblage rencontre chaque jour, et que les jeux écrits par des agents ne montrent
 * pas (verification/GLEIF.md : 0 fausse alerte sur 1 000 au niveau fort, quand les pièges écrits en faisaient 3 %). Il entre
 * dans le choix des seuils à côté des 23 jeux d'apprentissage écrits ; sa strate CONTENUE (un nom retrouvé dans l'autre) est à
 * part : une équipe peut vouloir qu'elle alerte, elle ne compte jamais comme fausse alerte.
 */
export const CHEMIN_APPRENTISSAGE_REEL = new URL("./paires-gleif-apprentissage.json", import.meta.url);
export const STRATE_CONTENUE = "different-contained";

/** L'échantillon réel mesuré : ses paires « match » et ses vraies paires « different », la strate contenue retirée ; le jeu
 *  cité porte l'empreinte du fichier tel qu'il est sur disque. */
export function mesurerReel(f: Frequences, brut: string): MesureEntites {
  const jeu = JSON.parse(brut) as JeuDePaires;
  const paires = validerPaires(jeu).filter((x) => x.nature !== STRATE_CONTENUE);
  const match = paires.filter((x) => x.verdict === "match").length;
  const p = palierEntite(f);
  return { jeux: [{ quoi: jeu.quoi, provenance: jeu.provenance, sha256: createHash("sha256").update(brut).digest("hex"), match, different: paires.length - match }],
    table: mesurerPaires(new Map([[p.id, p]]), paires)[p.id]! };
}

/**
 * LA RÈGLE DES DEUX SEUILS, ÉCRITE AVANT D'ÊTRE APPLIQUÉE (30/09/2026). Chaque plafond porte sur la borne HAUTE de l'intervalle de
 * Wilson à 95 % (src/interval.ts) : un taux se tient sous son plafond avec cette confiance, pas seulement en moyenne.
 *
 * FORT : le plus bas seuil au-dessus du possible dont
 *  - les fausses alertes sur les PIÈGES ÉCRITS (les 23 jeux d'apprentissage, groupés) restent sous FAUSSES_ALERTES_MAX_FORT (5 %) :
 *    ces pièges sont écrits pour ressembler à un vrai nom (filiale, homonyme, coque numérotée), et une alerte forte en déclenche au
 *    plus une sur vingt, comme avant ;
 *  - ET les fausses alertes sur les VRAIES SOCIÉTÉS DISTINCTES (l'échantillon réel, strate contenue à part) restent sous
 *    FAUSSES_ALERTES_REELLES_MAX_FORT (1 %) : une alerte forte part en instruction ; sur des sociétés qui ne font que partager un
 *    mot, une sur cent au plus.
 * POSSIBLE : le niveau des plafonds, SEUIL_POSSIBLE (0,80), où les plafonds (un nom retrouvé dans un plus long, une forme d'un
 *  autre pays, un mot distinctif d'un seul côté) rangent leurs candidats. Plus bas, la file des relectures déborde le budget :
 *  UNE RELECTURE POUR QUARANTE CONTREPARTIES (2,5 %), choix d'Arslane du 04/10/2026. Mesuré ce jour-là sur les deux livres de
 *  mille contreparties (écrits, criblés contre les SEPT sources) : 24 et 24 noms à relire à 0,80. Le budget était d'une
 *  relecture pour cinquante (2 %) le 30/09/2026, sur cinq listes : 18 et 17 noms à 0,80, 22 et 21 à 0,75, 45 et 43 à 0,70,
 *  215 et 219 à 0,61. Les noms en plus viennent des deux sources ajoutées (la liste du Royaume-Uni, les navires de l'annexe
 *  XLII de l'UE), donc d'une meilleure couverture, pas d'un seuil plus lâche : le seuil reste à 0,80 et c'est le budget qui
 *  suit les listes. Sur les vraies variantes de l'échantillon d'apprentissage, 0,80 en retenait 69 % et 0,61 en aurait retenu
 *  79 % le 30/09 : dix points pour douze fois plus de relectures (une première version descendait à 0,61 sous un plafond de
 *  50 % sur les pièges).
 * Les deux jeux se lisent ensemble parce que chacun manque ce que l'autre voit : les pièges écrits sont plus durs que les vraies
 * voisines, les vraies voisines sont ce que le criblage rencontre ; le fort doit tenir les deux. Mesuré sur l'apprentissage seul ;
 * le verdict frais (verification/paires-gleif-2.json) ne sert jamais à choisir.
 */
export const FAUSSES_ALERTES_MAX_FORT = 0.05;
export const FAUSSES_ALERTES_REELLES_MAX_FORT = 0.01;
/** Le niveau des PLAFONDS : un nom retrouvé dans un plus long, une forme juridique d'un autre pays, un mot distinctif d'un seul
 *  côté, un mot court à une lettre près, un numéro d'un seul côté : la méthode y voit une raison précise de douter, et range ces
 *  candidats à FACTEUR_CONTENANCE (0,80) ou juste au-dessous. Le possible n'est jamais au-dessus. */
export const SEUIL_POSSIBLE = FACTEUR_CONTENANCE;

export type Niveau = { seuil: number; rappel: Cellule; fauxPositifs: Cellule;
  /** les fausses alertes sur les vraies sociétés distinctes de l'échantillon réel, au même seuil */
  fauxPositifsReels: Cellule };
export type Reglage = {
  fort: Niveau; possible: Niveau;
  /** false : même le niveau possible ne tient pas RAPPEL_MIN à la borne basse ; le rapport
   *  le dit en réserve. */
  tientLePlancher: boolean;
};

/** Les deux seuils, par la règle écrite ci-dessus. `ecrits` : la table des 23 jeux d'apprentissage écrits ; `reels` : celle de
 *  l'échantillon réel, strate contenue retirée (`mesurerReel`). Les deux tables portent la même grille de seuils. */
export function choisirSeuils(ecrits: TableDUnPalier, reels: TableDUnPalier): Reglage {
  const cellules = Object.entries(ecrits).map(([seuil, c]) => {
    const r = reels[seuil];
    if (!r) throw new Error(`the real training table has no cell at ${seuil}: the two tables do not share the threshold grid.`);
    return { seuil: Number(seuil), ...c, fauxPositifsReels: r.fauxPositifs };
  }).sort((a, b) => a.seuil - b.seuil);
  if (cellules.length === 0) throw new Error("the threshold grid is empty: nothing was measured.");
  const niveau = (c: (typeof cellules)[number]): Niveau => ({ seuil: c.seuil, rappel: c.rappel, fauxPositifs: c.fauxPositifs, fauxPositifsReels: c.fauxPositifsReels });
  const possible = cellules.find((c) => c.seuil >= SEUIL_POSSIBLE - 1e-9) ?? cellules[cellules.length - 1]!;
  const fort = cellules.find((c) => c.seuil > possible.seuil
    && c.fauxPositifs.haut <= FAUSSES_ALERTES_MAX_FORT && c.fauxPositifsReels.haut <= FAUSSES_ALERTES_REELLES_MAX_FORT)
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
