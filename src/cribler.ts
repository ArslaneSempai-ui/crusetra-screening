/**
 * CRIBLER UNE LISTE DE CONTREPARTIES contre les listes publiques, et sceller la réponse.
 *
 *   npm run cribler -- --names=<csv> [--client=<name>]
 *
 * Le fichier porte une colonne `name` (obligatoire) et, s'il le veut, `ref` (son propre
 * identifiant), `imo` (le numéro OMI d'un navire), `type` et `country`. Chaque nom est
 * comparé à chaque nom ET alias de chaque liste disponible sur cette machine. Rien ne sort
 * de la machine : les listes sont descendues avant (`npm run listes -- --fetch`), et cette
 * commande ne touche pas le réseau.
 *
 * ─── LES SEUILS NE SONT PAS DES RÉGLAGES, CE SONT DES MESURES ───
 *
 * À chaque criblage, le score d'entité est mesuré sur les jeux d'apprentissage, et les deux
 * seuils (fort, possible) sont ceux que `choisirSeuils` désigne. Le jeu de VERDICT, écrit par
 * une autre main et jamais utilisé pour choisir, est mesuré aux mêmes seuils : ce sont SES
 * taux que le rapport cite en premier. Les poids des mots viennent des listes criblées, dont
 * le relevé porte les empreintes : un lecteur peut refaire chaque calcul.
 *
 * ─── CE QUE CE RELEVÉ N'EST PAS ───
 *
 * Un candidat n'est pas une correspondance établie : c'est un nom à relire par le
 * responsable conformité du client, qui confirme ou écarte. Le relevé le dit dans ses
 * réserves, à chaque fois, parce qu'un rapport de criblage cité sans cette phrase devient
 * une accusation.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename } from "node:path";
import { isMain, refuserDrapeauxInconnus } from "./cli.ts";
import { lireTable } from "./csv.ts";
import { lireManifeste, lireListe, SOURCES, type EntreeListe } from "./listes.ts";
import { empreinteDuReleve, scelleIntact } from "./empreinte.ts";
import { commitCourant } from "./your-alerts.ts";
import type { Cellule } from "./measure.ts";
import {
  frequencesDe, preparerNom, scoreBrut, variantes, simMot, abrege, abregeAllemand, tronque, simMinimale, palierEntite, estCoupe, CREDIT_ABJAD, sembleCoupe,
  compose, membres, gerondif, PARTICULES,
  variationVocalique, voyelleEpenthetique, squeletteLongue, pliAi, tousDeuxAnglais, lettrePerdue, PERDU, mesurerJeux, choisirSeuils, lireJeu,
  CHEMINS_APPRENTISSAGE, lecturesDe, plafondDesLectures, pliCantonais, pliJaponais, pliCoreen, CREDIT_KANA, pluriel, CHEMIN_VERDICT, RAPPEL_MIN,
  pliSlave, CREDIT_CYRILLIQUE, pliGrec, clePhonetique, homophoneCorrige, squeletteArabe, ARTICLES_ARABES, clesSlaves, pliThai, CREDIT_THAI,
  BLOC_MIN, LONGUEUR_CHAMP, type Frequences, type NomPrepare, type Reglage, type JeuMesure, LU_UN, porteUnJalon, CIVILITES, lemme, pliEnye,
} from "./entites.ts";
import { cleAbjad, cleAbjadSansTa, cleAbjadVLuF, type Abjad } from "./ecritures.ts";
import { distanceOsa } from "./matchers/damerau.ts";

/** Au plus autant de candidats montrés par nom ; le compte des autres est donné. */
export const CANDIDATS_MONTRES = 5;

export type Contrepartie = { ligne: number; nom: string; ref?: string; imo?: string; type?: string; pays?: string };

export type Candidat = {
  source: EntreeListe["source"]; liste?: string;
  /** les identifiants de la liste : plusieurs quand la même liste porte le même nom deux
   *  fois (deux adresses d'une même société), regroupés pour ne pas doubler l'alerte */
  ids: string[];
  nomListe: string;
  /** l'alias qui a porté le score, s'il n'est pas le nom principal */
  alias?: string;
  /** vrai si cet alias est classé « weak » par l'OFAC : trop générique pour désigner seul */
  aliasFaible?: boolean;
  type: EntreeListe["type"];
  imo?: string;
  score: number;
  /** « imo » : trouvé par le numéro OMI, pas par le nom */
  par: "name" | "imo";
};

export type Statut = "strong" | "possible" | "no-match";

export type Resultat = Contrepartie & {
  statut: Statut;
  candidats: Candidat[];
  /** candidats au-dessus du seuil possible au-delà des CANDIDATS_MONTRES affichés */
  autres: number;
  /** navires listés au nom voisin, écartés parce que leur numéro OMI diffère de celui fourni */
  ecartesParImo: { nomListe: string; imo: string }[];
  /** l'IMO fourni ne passe pas son chiffre de contrôle : utilisé tel quel, et signalé */
  imoInvalide?: boolean;
};

type MesureCitee = { rappel: Cellule; fauxPositifs: Cellule };

export type Criblage = {
  version: 1;
  genre: "cascade-screening/counterparty-screening";
  emisLe: string;
  client?: string;
  commit?: string;
  fichier: { nom: string; sha256: string; lignes: number };
  listes: { source: string; titre: string; url: string; telechargeLe: string; sha256: string; entrees: number }[];
  nonCriblees: { source: string; titre: string; raison: string }[];
  methode: {
    palier: string; description: string;
    poids: string;
    seuils: { fort: number; possible: number };
    rappelMin: number; tientLePlancher: boolean;
    apprentissage: { jeux: JeuMesure[]; fort: MesureCitee; possible: MesureCitee };
    verdict: { jeu: JeuMesure; fort: MesureCitee; possible: MesureCitee } | null;
  };
  totaux: { lignes: number; forts: number; possibles: number; sansCorrespondance: number };
  /** présent quand un relevé précédent a été fourni (--previous) : ce qui a CHANGÉ */
  changements?: Changements;
  resultats: Resultat[];
  reserves: string[];
  empreinte?: string;
};

/* ─────────────────────────── le numéro OMI ─────────────────────────── */

/** Le chiffre de contrôle OMI : les six premiers chiffres pondérés de 7 à 2, somme modulo 10. */
export function imoValide(imo: string): boolean {
  if (!/^\d{7}$/.test(imo)) return false;
  let s = 0;
  for (let i = 0; i < 6; i++) s += Number(imo[i]) * (7 - i);
  return s % 10 === Number(imo[6]);
}

/** « IMO 9187629 », « imo9187629 », « 9187629 » → « 9187629 » ; autre chose → undefined. */
export function lireImo(brut: string): string | undefined {
  const m = /^(?:imo\s*)?(\d{7})$/i.exec(brut.trim());
  return m?.[1];
}

/* ─────────────────────────── le fichier du client ─────────────────────────── */

export function lireContreparties(texte: string): { lignes: Contrepartie[]; avertissements: string[] } {
  const t = lireTable(texte);
  const noms = t.noms.map((n) => n.trim().toLowerCase());
  const i = (col: string) => noms.indexOf(col);
  if (i("name") === -1) {
    throw new Error(`the file has no "name" column (found: ${t.noms.join(", ") || "nothing"}).\n`
      + `  One column is required, "name"; "ref", "imo", "type" and "country" are optional.\n`
      + `  Nothing was screened.`);
  }
  const avertissements: string[] = [];
  if (t.ecartees.length) avertissements.push(`${t.ecartees.length} line(s) had more cells than the header and were set aside (first: line ${t.ecartees[0]!.ligne}).`);
  const lignes: Contrepartie[] = [];
  let vides = 0;
  const imosIllisibles: number[] = [];
  t.lignes.forEach((l, k) => {
    const nom = (l[i("name")] ?? "").trim();
    if (!nom) { vides++; return; }
    const opt = (col: string) => { const v = i(col) === -1 ? "" : (l[i(col)] ?? "").trim(); return v || undefined; };
    const ref = opt("ref"), type = opt("type"), pays = opt("country"), imoBrut = opt("imo");
    const imo = imoBrut ? lireImo(imoBrut) : undefined;
    if (imoBrut && !imo) imosIllisibles.push(t.numeros[k]!);
    lignes.push({ ligne: t.numeros[k]!, nom, ...(ref ? { ref } : {}), ...(imo ? { imo } : {}),
      ...(type ? { type } : {}), ...(pays ? { pays } : {}) });
  });
  if (vides) avertissements.push(`${vides} line(s) had an empty name and were skipped.`);
  if (imosIllisibles.length) avertissements.push(`${imosIllisibles.length} IMO value(s) are not seven digits and were ignored (first: line ${imosIllisibles[0]}); those names are screened by name only.`);
  if (lignes.length === 0) throw new Error(`the file has a "name" column but no name in it. Nothing was screened.`);
  return { lignes, avertissements };
}

/* ─────────────────────────── l'index ─────────────────────────── */

type NomIndexe = { brut: string; nom: NomPrepare; entree: EntreeListe; alias?: string; faible: boolean;
  /** la chaîne est un ANCIEN nom annoncé, ou a perdu une mention de succursale qui nommait `mention` : voir
   *  `plafondDesLectures`, que le criblage applique comme le score d'entité */
  ancien: boolean; mention: string; registre: string; partie: string;
  /** les bigrammes des deux blocs, codés et triés : le compte des bigrammes partagés se fait
   *  par fusion de deux tableaux triés, sans recalcul (mesuré : 35 % du temps avant) */
  bg: Uint32Array; bgSq: Uint32Array };

/** Un mot du vocabulaire des listes : sa forme, ses clés, et les chaînes qui le portent. */
type MotIndexe = { mot: string; sq: string; repli: string; abregeVu: boolean; noms: number[];
  /** une chaîne listée porte ce mot comme un SIGLE écrit (« C&F », « T/C » : voir `sigleDe`) */
  sigleVu: boolean;
  /** les abjads (a : arabe, h : hébreu, t : thaï) dans l'écriture desquels une chaîne listée porte ce mot */
  abjadVu: string;
  /** une chaîne listée lue en cantonais porte ce mot */
  cantonaisVu: boolean;
  /** une chaîne listée marquée japonaise, coréenne, porte ce mot (voir `pliJaponais`, `pliCoreen`) */
  japonaisVu: boolean; coreenVu: boolean;
  /** une chaîne listée marquée grecque ou hébraïque porte ce mot (voir `pliGrec`) */
  grecVu: boolean;
  /** une chaîne listée marquée slave porte ce mot (voir `pliSlave`) */
  slaveVu: boolean;
  /** une chaîne listée porte ce mot juste après un article ou une filiation arabe (« Al Ameen ») : le dictionnaire anglais
   *  ne le tient plus pour un mot anglais (voir `anglais` dans scorePrepares et ARTICLES_ARABES) */
  apresArticleVu: boolean;
  /** une chaîne listée marquée thaïe porte ce mot (voir `pliThai`) */
  thaiVu: boolean };

/**
 * L'INDEX, ET POURQUOI IL NE PERD RIEN.
 *
 * Comparer chaque nom du client à chacune des ~94 000 chaînes listées (noms, alias, variantes)
 * prend deux secondes par nom ; une liste de 5 000 contreparties prendrait trois heures.
 * L'index ne compare un nom qu'aux chaînes qui PEUVENT atteindre le seuil, sans approximation :
 *
 *  - le score d'alignement est une moyenne pondérée des apports des mots ; il n'atteint le
 *    seuil que si au moins un mot du client a, avec un mot de la chaîne listée, une similarité
 *    d'au moins `simMinimale(seuil)`. Ce mot se cherche dans le vocabulaire des listes, rangé
 *    par initiale et longueur (la distance d'édition borne l'écart de longueur, et la première
 *    lettre compte double, donc au-dessus de 0,9 l'initiale est la même), et par égalité de
 *    squelette et de repli ; les règles à 0,9 (abréviation, mot tronqué, abrégé d'un point)
 *    partagent toutes l'initiale, et se cherchent dans le seau de cette initiale ;
 *  - le bloc (mots collés) ne compte qu'à partir de BLOC_MIN ; deux chaînes à distance
 *    d'édition k partagent au moins L − 1 − 3k bigrammes (le lemme des q-grammes, compté large
 *    pour les transpositions). Les bigrammes des deux blocs (brut et squelette) sont indexés,
 *    et seules les chaînes qui en partagent assez sont comparées ;
 *  - la contenance vaut au plus FACTEUR_CONTENANCE fois la couverture : elle passe par un mot
 *    rare retrouvé, donc par le vocabulaire ;
 *  - les noms coupés à 35 caractères ne se comparent qu'à ce dont ils sont le début (à deux
 *    caractères près, `sembleCoupe`).
 *
 * Le témoin `cribler.test.ts` (liste synthétique) et `temoin-index.ts --exhaustif` (les vraies
 * listes) comparent l'index à la comparaison exhaustive : mêmes candidats, mêmes scores.
 */
export class Index {
  readonly noms: NomIndexe[] = [];
  private readonly vocabulaire = new Map<string, MotIndexe>();
  private readonly parInitialeLongueur = new Map<string, MotIndexe[]>();
  private readonly parSqInitialeLongueur = new Map<string, MotIndexe[]>();
  private readonly parInitiale = new Map<string, MotIndexe[]>();
  private readonly parSq = new Map<string, MotIndexe[]>();
  private readonly parRepli = new Map<string, MotIndexe[]>();
  /** les mots listés qui portent une lettre perdue à l'encodage (« seʔora »), par longueur */
  private readonly parLongueurPerdu = new Map<string, MotIndexe[]>();
  /** la clé consonantique (`cleAbjad`) de chaque mot, dans les trois lectures (« a| », « h| », « t| ») :
   *  c'est là qu'un nom écrit dans un abjad cherche ses mots */
  private readonly parCleAbjad = new Map<string, MotIndexe[]>();
  /** la même clé, pour les seuls mots que des chaînes écrites dans un abjad portent : c'est là
   *  qu'un nom latin cherche les leurs (voir CREDIT_ABJAD dans scorePrepares) */
  private readonly parCleAbjadNatif = new Map<string, MotIndexe[]>();
  /** le pli cantonais (`pliCantonais`) de chaque mot : c'est là qu'un nom lu en cantonais cherche ses mots */
  private readonly parPliCantonais = new Map<string, MotIndexe[]>();
  /** le pli de la ñ écrite ny (`pliEnye`), pour les seuls mots listés qui écrivent ny : c'est là qu'un mot en n
   *  cherche « Nunyez » ; le mot en ny cherche « Nunez » par égalité sous son pli */
  private readonly parPliEnye = new Map<string, MotIndexe[]>();
  /** les quatre dernières lettres de chaque mot : c'est là qu'un mot cherche les composés qui FINISSENT par lui
   *  (« rohr » retrouve « stahlrohr » ; voir `compose`), l'initiale n'étant pas la sienne */
  private readonly parFinale = new Map<string, MotIndexe[]>();
  /** les initiales de deux à quatre mots consécutifs d'une chaîne listée (« cf » pour « clearing forwarding ») : c'est là
   *  qu'un sigle écrit de la requête cherche la locution en toutes lettres (voir `sigleDe`) */
  private readonly parInitialesSuite = new Map<string, number[]>();
  /** le même pli, pour les seuls mots que des chaînes lues en cantonais portent : c'est là qu'un
   *  nom latin cherche les leurs (voir `cantonais` dans scorePrepares) */
  private readonly parPliCantonaisNatif = new Map<string, MotIndexe[]>();
  /** le pli des deux romanisations du japonais (`pliJaponais`, CREDIT_KANA) et celui du coréen (`pliCoreen`,
   *  CREDIT_ROMANISATION) : un nom marqué cherche sous tous les mots, un nom sans marque sous les seuls mots
   *  que des chaînes marquées portent, comme pour le cantonais (jeu 11, 28/09 : « Huzimoto » ne retrouvait
   *  « Fujimoto » que par la comparaison exhaustive) */
  private readonly parPliJaponais = new Map<string, MotIndexe[]>();
  private readonly parPliJaponaisNatif = new Map<string, MotIndexe[]>();
  private readonly parPliCoreen = new Map<string, MotIndexe[]>();
  private readonly parPliCoreenNatif = new Map<string, MotIndexe[]>();
  /** le pli des romanisations du grec (`pliGrec`, CREDIT_ROMANISATION), dans les deux sens de la marque, comme le coréen */
  private readonly parPliGrec = new Map<string, MotIndexe[]>();
  private readonly parPliGrecNatif = new Map<string, MotIndexe[]>();
  /** le pli des romanisations du cyrillique (`pliSlave`, CREDIT_CYRILLIQUE), dans les deux sens de la marque comme le
   *  japonais ; et le même pli par initiale et longueur, pour la voyelle d'appui de la forme anglaise (« Aleksandr »,
   *  « Alexander » : une lettre d'écart sur la clé, que le squelette ne rapproche pas, x et ks) */
  private readonly parPliSlave = new Map<string, MotIndexe[]>();
  private readonly parPliSlaveNatif = new Map<string, MotIndexe[]>();
  /** les clés ALLEMANDES des mots listés qui en ont (voir `clesSlaves`), hors leur clé standard : c'est là que la clé standard d'un
   *  mot demandé cherche « Sawod » ou « Chimtechnika » ; dans l'autre sens, les clés allemandes du mot demandé se cherchent sous
   *  la clé standard des mots listés */
  /** le pli du thaï (`pliThai`, CREDIT_THAI), dans les deux sens de la marque comme le japonais */
  private readonly parPliThai = new Map<string, MotIndexe[]>();
  private readonly parPliThaiNatif = new Map<string, MotIndexe[]>();
  /** la clé phonétique anglaise des mots listés (`clePhonetique`) : c'est là que l'homophone d'un clavardage (0,9, « Steal » pour
   *  Steel) cherche le mot du commerce, et le mot du commerce son homophone (voir `homophoneCorrige`) */
  private readonly parClePhonetique = new Map<string, MotIndexe[]>();
  private readonly parPliSlaveAllemand = new Map<string, MotIndexe[]>();
  private readonly parPliSlaveAllemandNatif = new Map<string, MotIndexe[]>();
  private readonly parPliSlaveInitialeLongueur = new Map<string, MotIndexe[]>();
  /** les chaînes qui portent un bigramme, par bigramme ET longueur de bloc (« an20 ») : la
   *  borne de longueur du bloc se lit dans la clé, sans parcourir les autres longueurs */
  private readonly bigrammes = new Map<string, number[]>();
  private readonly bigrammesSq = new Map<string, number[]>();
  private readonly parLongueurBloc = new Map<number, number[]>();
  private readonly parLongueurBlocSq = new Map<number, number[]>();
  private readonly codes = new Map<string, number>();
  private readonly sansMots: number[] = [];
  /** les chaînes listées qui ont elles-mêmes la longueur d'un champ coupé */
  private readonly coupes: number[] = [];
  private readonly parImo = new Map<string, number[]>();
  private readonly cacheMots = new Map<string, number[]>();
  /** les paires de mots déjà comparées, pour toutes les requêtes : les mots d'un fichier client
   *  se répètent (« trading », « international »), et ceux des listes aussi */
  readonly memo = new Map<string, number>();

  readonly f: Frequences;
  readonly seuil: number;

  /* Pas de propriété de paramètre (`readonly f` dans la signature) : Node lit ce fichier en
     retirant les types, et ce raccourci n'est pas un type, c'est du code qu'il refuse. */
  constructor(f: Frequences, entrees: readonly EntreeListe[], seuil: number) {
    this.f = f;
    this.seuil = seuil;
    const ranger = (table: Map<string, MotIndexe[]>, cle: string, m: MotIndexe) => {
      const l = table.get(cle);
      if (l) l.push(m); else table.set(cle, [m]);
    };
    for (const e of entrees) {
      const faibles = new Set(e.aliasFaibles ?? []);
      let premier = -1;
      /* chaque nom et chaque alias, avec leurs variantes (« ex- », annotations) : une variante
         est indexée comme un alias, et le relevé la montre comme la chaîne qui a porté le score */
      const chaines = [[e.nom, undefined], ...e.alias.map((a) => [a, a] as const)] as const;
      const lectures = chaines.flatMap(([t, a]) => lecturesDe(t).map((l) => [l.texte, l.texte === e.nom ? undefined : l.texte, a, l] as const));
      for (const [texte, alias, origine, l] of lectures) {
        const lecture = l.lecture;
        const prepare = preparerNom(f, texte, lecture);
        /* la liste DIT qu'il s'agit d'un navire : même marque qu'un préfixe « M/V », et même
           conflit face à une forme de société (« Davar Shipping Co. Limited » contre le navire
           « DORE », alias « DAVAR », mesuré le 27/09 sur l'exemple) */
        const nom = e.type === "vessel" ? { ...prepare, marques: { ...prepare.marques, navire: true } } : prepare;
        if (nom.mots.length === 0 && nom.numeros === "") continue;
        const k = this.noms.length;
        if (premier === -1) premier = k;
        this.noms.push({ brut: texte, nom, entree: e, ...(alias ? { alias } : {}), faible: origine ? faibles.has(origine) : false,
          ancien: l.ancien, mention: l.mention, registre: l.registre, partie: l.partie, bg: this.coder(nom.bloc), bgSq: this.coder(nom.blocSq) });
        if (estCoupe(texte)) this.coupes.push(k);
        if (nom.mots.length === 0) { this.sansMots.push(k); continue; }
        nom.mots.forEach((mot, i) => {
          let m = this.vocabulaire.get(mot);
          if (!m) {
            m = { mot, sq: nom.squelettes[i]!, repli: nom.replis[i]!, abregeVu: nom.abreges[i]!, sigleVu: nom.sigles[i]!, noms: [k], abjadVu: "", cantonaisVu: false, grecVu: false,
              japonaisVu: false, coreenVu: false, slaveVu: false, apresArticleVu: false, thaiVu: false };
            const ps = pliSlave(mot);
            ranger(this.parPliSlave, ps, m);
            for (const k of clesSlaves(mot)) if (k !== ps) ranger(this.parPliSlaveAllemand, k, m);
            ranger(this.parPliSlaveInitialeLongueur, (ps[0] ?? "") + ps.length, m);
            ranger(this.parPliCantonais, pliCantonais(mot), m);
            ranger(this.parPliJaponais, pliJaponais(mot), m);
            ranger(this.parPliCoreen, pliCoreen(mot), m);
            ranger(this.parPliGrec, pliGrec(mot), m);
            ranger(this.parPliThai, pliThai(mot), m);
            if (mot.length >= 4) ranger(this.parClePhonetique, clePhonetique(mot), m);
            this.vocabulaire.set(mot, m);
            ranger(this.parInitialeLongueur, mot[0]! + mot.length, m);
            ranger(this.parSqInitialeLongueur, (m.sq[0] ?? "") + m.sq.length, m);
            ranger(this.parInitiale, mot[0]!, m);
            if (mot.length >= 4) ranger(this.parFinale, mot.slice(-4), m);
            if (pliEnye(mot) !== mot) ranger(this.parPliEnye, pliEnye(mot), m);
            ranger(this.parSq, m.sq, m);
            /* la voyelle longue écrite ee (« naseem ») : rangé aussi sous son squelette lu i (voir squeletteLongue) */
            if (mot.includes("ee")) ranger(this.parSq, squeletteLongue(mot), m);
            /* et la diphtongue ai ou ei lue e (« quraishi », « kureishi ») : rangé aussi sous son squelette lu e, ee compris (voir pliAi) */
            if (pliAi(mot) !== mot) ranger(this.parSq, squeletteLongue(pliAi(mot)), m);
            /* et sous son squelette arabe (o et u fondus, p lu f : voir squeletteArabe), quand il diffère */
            const sa = squeletteArabe(mot);
            if (sa !== m.sq) ranger(this.parSq, sa, m);
            /* et sous le squelette arabe d'un mot natif (o et u, p et f seulement), quand il diffère des deux autres */
            const saNatif = squeletteArabe(mot, true, false);
            if (saNatif !== m.sq && saNatif !== sa) ranger(this.parSq, saNatif, m);
            ranger(this.parRepli, m.repli, m);
            if (porteUnJalon(mot)) ranger(this.parLongueurPerdu, String(mot.length), m);
            for (const mode of ["arabe", "hebreu", "thai"] as const) {
              const c = cleAbjad(mot, mode);
              if (c.length >= 3) ranger(this.parCleAbjad, `${mode[0]}|${c}`, m);
            }
            /* la ta marbuta : un mot en « -at » se range aussi sous sa clé sans ce t (voir cleAbjadSansTa) */
            const sansTa = cleAbjadSansTa(mot);
            if (sansTa !== undefined && sansTa.length >= 3) ranger(this.parCleAbjad, `a|${sansTa}`, m);
            /* et le v lu ف : un mot en « v » se range aussi sous sa clé où v est f (voir cleAbjadVLuF) */
            const vLuF = cleAbjadVLuF(mot);
            if (vLuF !== undefined && vLuF.length >= 3) ranger(this.parCleAbjad, `a|${vLuF}`, m);
          } else {
            if (m.noms[m.noms.length - 1] !== k) m.noms.push(k);
            if (nom.abreges[i]) m.abregeVu = true;
            if (nom.sigles[i]) m.sigleVu = true;
          }
          if (i > 0 && ARTICLES_ARABES.has(nom.mots[i - 1]!)) m.apresArticleVu = true;
          const mode = nom.marques.abjad;
          if (mode !== "" && !m.abjadVu.includes(mode[0]!)) {
            m.abjadVu += mode[0];
            const c = cleAbjad(mot, mode);
            if (c.length >= 3) ranger(this.parCleAbjadNatif, `${mode[0]}|${c}`, m);
            const sansTa = mode === "arabe" ? cleAbjadSansTa(mot) : undefined;
            if (sansTa !== undefined && sansTa.length >= 3) ranger(this.parCleAbjadNatif, `a|${sansTa}`, m);
            const vLuF = mode === "arabe" ? cleAbjadVLuF(mot) : undefined;
            if (vLuF !== undefined && vLuF.length >= 3) ranger(this.parCleAbjadNatif, `a|${vLuF}`, m);
          }
          if (nom.marques.cantonais && !m.cantonaisVu) { m.cantonaisVu = true; ranger(this.parPliCantonaisNatif, pliCantonais(mot), m); }
          if (nom.marques.japonais && !m.japonaisVu) { m.japonaisVu = true; ranger(this.parPliJaponaisNatif, pliJaponais(mot), m); }
          if (nom.marques.coreen && !m.coreenVu) { m.coreenVu = true; ranger(this.parPliCoreenNatif, pliCoreen(mot), m); }
          if (nom.marques.hebreuOuGrec && !m.grecVu) { m.grecVu = true; ranger(this.parPliGrecNatif, pliGrec(mot), m); }
          if (nom.marques.thai && !m.thaiVu) { m.thaiVu = true; ranger(this.parPliThaiNatif, pliThai(mot), m); }
          if (nom.marques.slave && !m.slaveVu) {
            m.slaveVu = true;
            const ps = pliSlave(mot);
            ranger(this.parPliSlaveNatif, ps, m);
            for (const k of clesSlaves(mot)) if (k !== ps) ranger(this.parPliSlaveAllemandNatif, k, m);
          }
        });
        /* les initiales de deux à quatre mots consécutifs, pour le sigle écrit d'une requête (mêmes conditions que `sigleDe`) */
        for (let L = 2; L <= 4; L++) for (let i = 0; i + L <= nom.mots.length; i++) {
          const suite = nom.mots.slice(i, i + L);
          if (suite.some((w) => w.length < 3 || PARTICULES.has(w))) continue;
          const cle = suite.map((w) => w[0]).join("");
          const l = this.parInitialesSuite.get(cle);
          if (l) { if (l[l.length - 1] !== k) l.push(k); } else this.parInitialesSuite.set(cle, [k]);
        }
        for (const [table, longueurs, bloc] of [[this.bigrammes, this.parLongueurBloc, nom.bloc],
          [this.bigrammesSq, this.parLongueurBlocSq, nom.blocSq]] as const) {
          const l = longueurs.get(bloc.length);
          if (l) l.push(k); else longueurs.set(bloc.length, [k]);
          for (const g of compterBigrammes(bloc).keys()) {
            const cle = g + bloc.length;
            const p = table.get(cle);
            if (p) p.push(k); else table.set(cle, [k]);
          }
        }
      }
      /* le numéro OMI désigne l'ENTRÉE : on l'accroche à sa première chaîne indexée */
      if (e.imo && premier !== -1) {
        const l = this.parImo.get(e.imo);
        if (l) l.push(premier); else this.parImo.set(e.imo, [premier]);
      }
    }
  }

  /** Les bigrammes d'un bloc, codés (un entier par bigramme distinct vu) et triés. */
  coder(bloc: string): Uint32Array {
    const t = new Uint32Array(Math.max(0, bloc.length - 1));
    for (let i = 0; i + 1 < bloc.length; i++) {
      const g = bloc.slice(i, i + 2);
      let c = this.codes.get(g);
      if (c === undefined) { c = this.codes.size + 1; this.codes.set(g, c); }
      t[i] = c;
    }
    return t.sort();
  }

  /** Les chaînes listées dont un mot est assez proche de `mot` (mêmes règles que le score). */
  private nomsParMot(mot: string, sq: string, repli: string, dernier: boolean, coupe: boolean, abreviation: boolean, abjad: Abjad, cantonais: boolean,
    japonais: boolean, coreen: boolean, slave: boolean, grec: boolean, apresArticle: boolean, thai: boolean): number[] {
    const cle = `${mot}|${dernier ? 1 : 0}|${coupe ? 1 : 0}|${abreviation ? 1 : 0}|${abjad}|${cantonais ? 1 : 0}${japonais ? 1 : 0}${coreen ? 1 : 0}${slave ? 1 : 0}${grec ? 1 : 0}${apresArticle ? 1 : 0}${thai ? 1 : 0}`;
    /* deux mots du dictionnaire ne sont deux mots anglais que hors de l'article arabe, d'un côté comme de l'autre (voir ARTICLES_ARABES) */
    const anglais = (autre: MotIndexe) => tousDeuxAnglais(mot, autre.mot) && !apresArticle && !autre.apresArticleVu;
    const deja = this.cacheMots.get(cle);
    if (deja) return deja;
    const t = simMinimale(this.seuil);
    const retenus = new Set<MotIndexe>();
    const exact = this.vocabulaire.get(mot);
    if (exact) retenus.add(exact);
    /* la lettre perdue d'un encodage, des deux côtés (mêmes règles que `simMot`) : le mot
       demandé qui en porte une se cherche parmi les mots listés de même longueur (sous toutes
       les initiales si c'est l'initiale qui manque), et les mots listés qui en portent une
       se comparent au mot demandé */
    const jalons = mot.split(PERDU).length - 1;
    if (porteUnJalon(mot)) {
      /* une lettre-jalon vaut une lettre, ou deux quand la lettre perdue se plie en deux (æ) ; le
         jalon du 1 lu optiquement (LU_UN) ne vaut qu'un i ou un l, en tête comme ailleurs */
      for (const c of mot[0] === PERDU ? [...INITIALES] : mot[0] === LU_UN ? ["i", "l"] : [mot[0]!]) for (let L = mot.length; L <= mot.length + jalons; L++) {
        for (const m of this.parInitialeLongueur.get(c + L) ?? []) if (lettrePerdue(mot, m.mot)) retenus.add(m);
      }
    }
    for (let L = mot.length - 3; L <= mot.length; L++) {
      for (const m of this.parLongueurPerdu.get(String(L)) ?? []) if (lettrePerdue(mot, m.mot)) retenus.add(m);
    }
    /* la capitale I lue l par une lecture optique (« lsolde », Isolde) : le mot listé qui n'en
       diffère que par cette initiale, dans un sens comme dans l'autre */
    if (mot.length >= 5 && (mot[0] === "i" || mot[0] === "l")) {
      const lu = this.vocabulaire.get((mot[0] === "i" ? "l" : "i") + mot.slice(1));
      if (lu) retenus.add(lu);
    }
    if (t <= 0.95) for (const m of this.parSq.get(sq) ?? []) retenus.add(m);
    /* et le mot demandé qui écrit ee cherche sous son squelette lu i, où les mots listés en ee sont
       aussi rangés : les deux sens de squeletteLongue */
    if (t <= 0.95 && mot.includes("ee")) for (const m of this.parSq.get(squeletteLongue(mot)) ?? []) retenus.add(m);
    /* et le mot demandé qui écrit ai ou ei cherche sous son squelette lu e (voir pliAi), où les mots listés en ai, ei sont aussi rangés */
    if (t <= 0.95 && pliAi(mot) !== mot) for (const m of this.parSq.get(squeletteLongue(pliAi(mot))) ?? []) retenus.add(m);
    /* et sous son squelette arabe (voir squeletteArabe), où les mots listés dont il diffère sont aussi rangés */
    if (t <= 0.95) for (const k of new Set([squeletteArabe(mot), squeletteArabe(mot, true, false)])) for (const m of this.parSq.get(k) ?? []) retenus.add(m);
    /* les mêmes consonnes (CREDIT_ABJAD) : un nom écrit dans un abjad face à tous les mots, un nom
       latin face aux mots que des chaînes écrites dans un abjad portent */
    if (t <= CREDIT_ABJAD) {
      for (const mode of abjad !== "" ? [abjad] : ["arabe", "hebreu", "thai"] as const) {
        const table = abjad !== "" ? this.parCleAbjad : this.parCleAbjadNatif;
        const c = cleAbjad(mot, mode);
        if (c.length >= 3) for (const m of table.get(`${mode[0]}|${c}`) ?? []) retenus.add(m);
        /* la ta marbuta, dans les deux sens : le mot demandé en « -at » cherche aussi sous sa clé sans
           ce t, et les mots listés en « -at » sont rangés sous la leur */
        const sansTa = mode === "arabe" ? cleAbjadSansTa(mot) : undefined;
        if (sansTa !== undefined && sansTa.length >= 3) for (const m of table.get(`a|${sansTa}`) ?? []) retenus.add(m);
        /* le v lu ف, dans les deux sens aussi */
        const vLuF = mode === "arabe" ? cleAbjadVLuF(mot) : undefined;
        if (vLuF !== undefined && vLuF.length >= 3) for (const m of table.get(`a|${vLuF}`) ?? []) retenus.add(m);
      }
    }
    /* les mêmes kana (CREDIT_KANA) : un nom marqué japonais face à tous les mots, un nom sans marque face aux mots
       que des chaînes marquées portent */
    if (t <= CREDIT_KANA) for (const m of (japonais ? this.parPliJaponais : this.parPliJaponaisNatif).get(pliJaponais(mot)) ?? []) retenus.add(m);
    /* les mêmes lettres thaïes (CREDIT_THAI), dans les deux sens de la marque */
    if (t <= CREDIT_THAI) for (const m of (thai ? this.parPliThai : this.parPliThaiNatif).get(pliThai(mot)) ?? []) retenus.add(m);
    /* la même suite cyrillique (CREDIT_CYRILLIQUE), dans les deux sens de la marque ; et, au crédit d'une romanisation, la
       voyelle d'appui sur la clé du pli (« aleksandr », « aleksander ») : la marque se vérifie au score */
    const ps = pliSlave(mot);
    if (t <= CREDIT_CYRILLIQUE) {
      const [table, allemande] = slave ? [this.parPliSlave, this.parPliSlaveAllemand] : [this.parPliSlaveNatif, this.parPliSlaveAllemandNatif];
      for (const m of table.get(ps) ?? []) retenus.add(m);
      /* la romanisation allemande, dans les deux sens (voir `clesSlaves` et `memeSuiteCyrillique`) */
      for (const m of allemande.get(ps) ?? []) retenus.add(m);
      for (const k of clesSlaves(mot)) if (k !== ps) for (const m of table.get(k) ?? []) retenus.add(m);
    }
    if (t <= 0.9) {
      for (const L of [ps.length - 1, ps.length + 1]) {
        for (const m of this.parPliSlaveInitialeLongueur.get((ps[0] ?? "") + L) ?? []) {
          if ((slave || m.slaveVu) && voyelleEpenthetique(ps, pliSlave(m.mot)) && !anglais(m)) retenus.add(m);
        }
      }
    }
    if (t <= 0.9) {
      for (const m of this.parRepli.get(repli) ?? []) retenus.add(m);
      /* le pli coréen (CREDIT_ROMANISATION), dans les deux sens de la marque, comme le cantonais */
      for (const m of (coreen ? this.parPliCoreen : this.parPliCoreenNatif).get(pliCoreen(mot)) ?? []) retenus.add(m);
      /* le pli grec (CREDIT_ROMANISATION), dans les deux sens de la marque grecque ou hébraïque */
      for (const m of (grec ? this.parPliGrec : this.parPliGrecNatif).get(pliGrec(mot)) ?? []) retenus.add(m);
      /* le pli cantonais (CREDIT_ROMANISATION) : un nom lu en cantonais face à tous les mots, un nom
         latin face aux mots que des chaînes lues en cantonais portent */
      for (const m of (cantonais ? this.parPliCantonais : this.parPliCantonaisNatif).get(pliCantonais(mot)) ?? []) retenus.add(m);
      /* les règles à 0,9 partagent l'initiale : abréviation dans un sens ou l'autre, mot
         tronqué, mot abrégé d'un point, dernier mot d'un nom coupé ; et la variation d'une
         voyelle, qui garde longueur et initiale du squelette ; le pluriel anglais (0,95) aussi */
      for (const m of this.parInitiale.get(mot[0]!) ?? []) {
        const autre = m.mot;
        if (abrege(mot, autre) || abrege(autre, mot) || pluriel(mot, autre) || pluriel(autre, mot)
          /* l'abréviation allemande d'un mot écrit avec son point (0,9 sous la marque germanique, que le score vérifie :
             « Sueddt. », Süddeutsche ; voir `abregeAllemand`) */
          || ((abreviation || m.abregeVu) && (abregeAllemand(mot, autre) || abregeAllemand(autre, mot)))
          /* le gérondif anglais (0,95 : « trading », « trade ») et le composé qui COMMENCE par le mot demandé
             (CREDIT_ROMANISATION : « metaal », « metaalhandel ») partagent l'initiale */
          || gerondif(mot, autre) || gerondif(autre, mot) || compose(autre, mot)
          || ((dernier || coupe && dernier) && tronque(mot, autre)) || tronque(autre, mot)
          || (abreviation && autre.length > mot.length && autre.startsWith(mot))
          || (m.abregeVu && mot.length > autre.length && mot.startsWith(autre))
          || (coupe && dernier && autre.startsWith(mot))) retenus.add(m);
      }
      for (const m of this.parSqInitialeLongueur.get((sq[0] ?? "") + sq.length) ?? []) {
        /* le schwa (e, u) de la marque arabe se retient large : la marque se vérifie au score */
        if (variationVocalique(sq, m.sq, true) && !anglais(m)) retenus.add(m);
      }
      /* la voyelle sautée sous le squelette arabe (voir voyelleSauteeArabe), dans les deux sens : le mot demandé moins une voyelle
         intérieure ou initiale, et le mot demandé plus une voyelle, cherchés parmi les squelettes arabes rangés dans parSq ; la
         marque se vérifie au score */
      const sa = squeletteArabe(mot);
      if (sa.length >= 5) for (let i = 0; i <= sa.length - 2; i++) {
        if ("aeiou".includes(sa[i]!)) for (const m of this.parSq.get(sa.slice(0, i) + sa.slice(i + 1)) ?? []) retenus.add(m);
      }
      if (sa.length >= 4) for (let i = 0; i <= sa.length - 1; i++) {
        for (const v of "aeiou") for (const m of this.parSq.get(sa.slice(0, i) + v + sa.slice(i)) ?? []) retenus.add(m);
      }
      /* l'article maghrébin réduit à son l (voir articleReduit), dans les deux sens : le mot demandé en l cherche le nom nu sous le
         squelette arabe de son reste, le mot demandé nu cherche le mot en l sous le squelette arabe de « l » et lui ; la marque se
         vérifie au score */
      if (mot.length >= 5 && /^l[aeiouh]/.test(mot)) for (const m of this.parSq.get(squeletteArabe(mot.slice(1))) ?? []) retenus.add(m);
      if (mot.length >= 4) for (const k of [squeletteArabe("l" + mot), "l" + sa]) for (const m of this.parSq.get(k) ?? []) retenus.add(m);
      /* la ñ écrite ny (CREDIT_ROMANISATION sous la marque hispanique, qui se vérifie au score) : les mots listés en ny
         sous leur pli, et, pour un mot demandé en ny, le mot listé en n par égalité (voir `pliEnye`) */
      for (const m of this.parPliEnye.get(pliEnye(mot)) ?? []) retenus.add(m);
      if (pliEnye(mot) !== mot) { const m = this.vocabulaire.get(pliEnye(mot)); if (m) retenus.add(m); }
      /* les composés allemands et néerlandais, dans l'autre sens et dans l'autre ordre (voir `compose`) : le mot
         listé qui FINIT par le mot demandé se trouve sous ses quatre dernières lettres ; et le mot demandé qui
         est lui-même un composé cherche ses membres listés par égalité, en tête et en queue, avec ou sans le s
         du pluriel. La marque allemande ou néerlandaise se vérifie au score */
      for (const c of membres(mot)) if (c.length >= 4) for (const m of this.parFinale.get(c.slice(-4)) ?? []) if (compose(m.mot, mot)) retenus.add(m);
      for (let L = 4; L <= mot.length - 3; L++) {
        for (const sfx of ["", "s", "es"]) {
          for (const autre of [mot.slice(0, L) + sfx, mot.slice(-L) + sfx]) {
            const m = this.vocabulaire.get(autre);
            if (m && compose(mot, autre)) retenus.add(m);
          }
        }
      }
      /* la voyelle d'appui d'un groupe final (« bahr », « bahar ») : une lettre d'écart au squelette,
         même initiale */
      for (const L of [sq.length - 1, sq.length + 1]) {
        for (const m of this.parSqInitialeLongueur.get((sq[0] ?? "") + L) ?? []) {
          if (voyelleEpenthetique(sq, m.sq) && !anglais(m)) retenus.add(m);
        }
      }
      /* la faute d'un clavardage (mêmes règles que le score) : même initiale, une lettre près, un seul
         des deux mots au dictionnaire ; la marque chat et la langue se vérifient au score */
      if (mot.length >= 4) {
        const anglais = lemme(mot) !== undefined;
        for (let L = mot.length - 1; L <= mot.length + 1; L++) {
          for (const m of this.parInitialeLongueur.get(mot[0]! + L) ?? []) {
            if (m.mot.length >= 4 && (lemme(m.mot) !== undefined) !== anglais && distanceOsa(mot, m.mot) === 1) retenus.add(m);
          }
        }
        /* l'homophone d'un clavardage (mêmes règles que le score) : la même clé phonétique, un mot du commerce d'un côté et un mot
           du dictionnaire de l'autre, dans les deux sens ; la marque chat se vérifie au score */
        for (const m of this.parClePhonetique.get(clePhonetique(mot)) ?? []) if (homophoneCorrige(mot, m.mot) || homophoneCorrige(m.mot, mot)) retenus.add(m);
      }
    }
    /* la distance d'édition, sur le mot et sur son squelette : l'écart de longueur est borné
       par (1 − t) × la plus grande longueur, et l'initiale est la même tant que
       (1 − t) × longueur < 2 (au-delà, toutes les initiales sont regardées) */
    const balayer = (table: Map<string, MotIndexe[]>, forme: string) => {
      const L0 = forme.length;
      for (let L = Math.max(1, Math.floor(L0 - (1 - t) * L0)); L <= Math.ceil(L0 + (1 - t) * L); L++) {
        const Lmax = Math.max(L, L0);
        if (Math.abs(L - L0) > (1 - t) * Lmax) continue;
        /* aucune édition permise à cette longueur : seule l'égalité passe, et elle est déjà
           prise (au-dessus de 0,9, c'est le cas de tout mot de moins de onze lettres) */
        if ((1 - t) * Lmax < 1) continue;
        const initiales = (1 - t) * Lmax >= 2 ? [...INITIALES] : [forme[0] ?? ""];
        for (const c of initiales) {
          for (const m of table.get(c + L) ?? []) {
            if (retenus.has(m)) continue;
            if (simMot(mot, m.mot, sq, m.sq) >= t) retenus.add(m);
          }
        }
      }
    };
    balayer(this.parInitialeLongueur, mot);
    balayer(this.parSqInitialeLongueur, sq);
    const noms = new Set<number>();
    for (const m of retenus) for (const k of m.noms) noms.add(k);
    const l = [...noms];
    this.cacheMots.set(cle, l);
    return l;
  }

  /** Toutes les chaînes listées qui peuvent atteindre le seuil face à `q`. */
  candidats(q: NomPrepare, brut: string): number[] {
    if (q.mots.length === 0) return this.sansMots;
    const retenus = new Set<number>();
    /* une chaîne listée coupée à 35 ne se compare qu'à un nom du client PLUS long dont elle
       semble le début */
    if (brut.trim().length > LONGUEUR_CHAMP) {
      for (const k of this.coupes) if (sembleCoupe(this.noms[k]!.brut, brut)) retenus.add(k);
    }
    const coupe = estCoupe(brut);
    q.mots.forEach((m, i) => {
      for (const k of this.nomsParMot(m, q.squelettes[i]!, q.replis[i]!, i === q.mots.length - 1, coupe, q.abreges[i]!, q.marques.abjad, q.marques.cantonais,
        q.marques.japonais, q.marques.coreen, q.marques.slave, q.marques.hebreuOuGrec, i > 0 && ARTICLES_ARABES.has(q.mots[i - 1]!), q.marques.thai)) retenus.add(k);
      /* une civilité que la requête soude au mot suivant (« sripelangi »), ou qu'elle écrit à part
         quand une chaîne listée la soude : mêmes règles que le score, qui vérifie que l'autre côté
         l'a écrite ; ici on retient large */
      for (const c of CIVILITES) if (m.startsWith(c) && m.length >= c.length + 4) for (const k of this.vocabulaire.get(m.slice(c.length))?.noms ?? []) retenus.add(k);
      for (const c of q.civilites) for (const k of this.vocabulaire.get(c + m)?.noms ?? []) retenus.add(k);
    });
    /* le sigle d'une locution (voir `sigleDe`) : un sigle écrit de la requête cherche les chaînes dont des mots consécutifs
       portent ses initiales ; les initiales de mots consécutifs de la requête cherchent les sigles écrits des listes. La
       condition d'absence de l'autre côté se vérifie au score ; ici on retient large */
    q.mots.forEach((m, i) => { if (q.sigles[i] && m.length >= 2 && m.length <= 4) for (const k of this.parInitialesSuite.get(m) ?? []) retenus.add(k); });
    for (let L = 2; L <= 4; L++) for (let i = 0; i + L <= q.mots.length; i++) {
      const suite = q.mots.slice(i, i + L);
      if (suite.some((w) => w.length < 3 || PARTICULES.has(w))) continue;
      const s = this.vocabulaire.get(suite.map((w) => w[0]).join(""));
      if (s?.sigleVu) for (const k of s.noms) retenus.add(k);
    }
    /* le bloc, sur le bloc brut puis sur celui des squelettes. Pour chaque longueur de bloc
       listé dans la bande, le lemme dit combien de bigrammes doivent être partagés ; par le
       principe des tiroirs, une chaîne qui en partage autant porte au moins un des
       (|Q| − besoin + 1) bigrammes de la requête qu'on choisit, et on choisit les plus rares.
       Le compte exact se vérifie ensuite sur ces seules chaînes. */
    const borne = 1 - Math.max(this.seuil, BLOC_MIN);
    for (const [table, longueurs, bloc, lireBloc] of [
      [this.bigrammes, this.parLongueurBloc, q.bloc, (n: NomIndexe) => n.bg],
      [this.bigrammesSq, this.parLongueurBlocSq, q.blocSq, (n: NomIndexe) => n.bgSq],
    ] as const) {
      const len = bloc.length;
      const Q = compterBigrammes(bloc);
      const codesQ = this.coder(bloc);
      const jetonsQ = len - 1;
      const verifier = (k: number, besoin: number) => {
        if (retenus.has(k)) return;
        const n = this.noms[k]!;
        if (n.nom.mots.length === q.mots.length) return;
        if (partages(codesQ, lireBloc(n)) >= besoin) retenus.add(k);
      };
      for (let L = Math.max(1, Math.ceil(len * (1 - borne))); L <= Math.floor(len / (1 - borne)); L++) {
        const Lmax = Math.max(L, len);
        if (Math.abs(L - len) > borne * Lmax) continue;
        const besoin = Lmax - 1 - 3 * Math.floor(borne * Lmax + 1e-9);
        if (besoin <= 0 || jetonsQ <= 0) {
          for (const k of longueurs.get(L) ?? []) verifier(k, Math.max(0, besoin));
          continue;
        }
        const aChoisir = jetonsQ - besoin + 1;
        if (aChoisir <= 0) continue;
        const rares = [...Q.entries()].map(([g, n]) => ({ g, n, p: table.get(g + L) ?? [] }))
          .sort((a, b) => a.p.length - b.p.length);
        let pris = 0;
        for (const { n, p } of rares) {
          if (pris >= aChoisir) break;
          pris += n;
          for (const k of p) verifier(k, besoin);
        }
      }
    }
    return [...retenus];
  }

  parNumeroImo(imo: string): number[] {
    return this.parImo.get(imo) ?? [];
  }
}

const INITIALES = "abcdefghijklmnopqrstuvwxyz0123456789";

/** Le nombre de bigrammes communs à deux tableaux triés de codes, multiplicité comprise. */
function partages(a: Uint32Array, b: Uint32Array): number {
  let i = 0, j = 0, n = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { n++; i++; j++; }
    else if (a[i]! < b[j]!) i++;
    else j++;
  }
  return n;
}

function compterBigrammes(s: string): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = 0; i + 1 < s.length; i++) {
    const g = s.slice(i, i + 2);
    m.set(g, (m.get(g) ?? 0) + 1);
  }
  return m;
}

/* ─────────────────────────── le criblage d'un nom ─────────────────────────── */

/** Une contrepartie contre l'index. Le meilleur score PAR ENTRÉE (un alias et le nom
 *  principal d'une même entrée ne font pas deux candidats), puis les entrées homonymes d'une
 *  même liste regroupées, trié, coupé à CANDIDATS_MONTRES. `exhaustif` compare à tout : c'est
 *  le témoin de l'index, pas un mode d'usage. */
export function cribler(c: Contrepartie, index: Index, seuils: { fort: number; possible: number }, exhaustif = false): Resultat {
  const lectures = lecturesDe(c.nom).map((l) => ({ brut: l.texte, nom: preparerNom(index.f, l.texte, l.lecture), lecture: l }));
  if (index.memo.size > 500_000) index.memo.clear();
  const options = { auMoins: seuils.possible, memo: index.memo };
  const meilleurs = new Map<string, Candidat>();
  const garder = (cle: string, cand: Candidat) => {
    const deja = meilleurs.get(cle);
    if (!deja || prefere(cand, deja)) meilleurs.set(cle, cand);
  };
  const ks = exhaustif ? index.noms.map((_, k) => k)
    : [...new Set(lectures.flatMap((l) => index.candidats(l.nom, l.brut)))];
  for (const k of ks) {
    const n = index.noms[k]!;
    let s = 0;
    /* un ancien nom des deux côtés, deux succursales : le possible au plus (voir `plafondDesLectures`) */
    for (const l of lectures) {
      const plafond = plafondDesLectures(l.lecture, { texte: n.brut, lecture: n.nom.marques.lecture, ancien: n.ancien, mention: n.mention, registre: n.registre, partie: n.partie });
      s = Math.max(s, Math.min(plafond, scoreBrut(index.f, l.brut, l.nom, n.brut, n.nom, options)));
    }
    if (s < seuils.possible) continue;
    garder(`${n.entree.source}:${n.entree.id}`, candidat(n, Math.round(s * 1000) / 1000, "name"));
  }
  if (c.imo) {
    for (const k of index.parNumeroImo(c.imo)) {
      const n = index.noms[k]!;
      garder(`${n.entree.source}:${n.entree.id}`, { ...candidat(n, 1, "imo"), nomListe: n.entree.nom });
    }
  }
  /* L'IMO fourni tranche : un navire listé au nom voisin mais au numéro différent n'est pas
     ce navire. Il est écarté, et nommé dans le relevé : écarté n'est pas caché. */
  const ecartesParImo: Resultat["ecartesParImo"] = [];
  if (c.imo) {
    for (const [cle, cand] of meilleurs) {
      if (cand.par === "name" && cand.imo && cand.imo !== c.imo) {
        ecartesParImo.push({ nomListe: cand.nomListe, imo: cand.imo });
        meilleurs.delete(cle);
      }
    }
  }
  const regroupes = new Map<string, Candidat>();
  for (const cand of meilleurs.values()) {
    const cle = `${cand.source}|${cand.liste ?? ""}|${cand.nomListe.toLowerCase()}|${cand.imo ?? ""}`;
    const d = regroupes.get(cle);
    if (!d) { regroupes.set(cle, { ...cand, ids: [...cand.ids] }); continue; }
    d.ids.push(...cand.ids);
    if (prefere(cand, d)) { d.score = cand.score; d.par = cand.par;
      if (cand.alias) d.alias = cand.alias; else delete d.alias;
      if (cand.aliasFaible) d.aliasFaible = true; else delete d.aliasFaible; }
  }
  const tous = [...regroupes.values()].map((x) => ({ ...x, ids: [...new Set(x.ids)].sort() }))
    .sort((a, b) => b.score - a.score || a.nomListe.localeCompare(b.nomListe)
      || a.source.localeCompare(b.source) || a.ids[0]!.localeCompare(b.ids[0]!));
  const statut: Statut = tous.length === 0 ? "no-match" : tous[0]!.score >= seuils.fort ? "strong" : "possible";
  return { ...c, statut, candidats: tous.slice(0, CANDIDATS_MONTRES), autres: Math.max(0, tous.length - CANDIDATS_MONTRES),
    ecartesParImo, ...(c.imo && !imoValide(c.imo) ? { imoInvalide: true } : {}) };
}

/**
 * Entre deux chaînes d'une même entrée, laquelle a porté le score ? Le plus haut score ; à
 * égalité, l'OMI avant le nom, le nom principal avant un alias, un alias ordinaire avant un
 * alias faible, puis l'ordre alphabétique. Sans cet ordre total, le résultat dépendrait de
 * l'ordre de parcours, et l'index et la comparaison exhaustive désigneraient deux chaînes
 * différentes pour la même entrée (mesuré : « CHONMYONG SHIPPING CO »).
 */
function prefere(a: Candidat, b: Candidat): boolean {
  if (a.score !== b.score) return a.score > b.score;
  if (a.par !== b.par) return a.par === "imo";
  if (!a.alias !== !b.alias) return !a.alias;
  if (!a.aliasFaible !== !b.aliasFaible) return !a.aliasFaible;
  return (a.alias ?? "") < (b.alias ?? "");
}

function candidat(n: NomIndexe, score: number, par: Candidat["par"]): Candidat {
  return {
    source: n.entree.source, ...(n.entree.programme ? { liste: n.entree.programme } : {}),
    ids: [n.entree.id], nomListe: n.entree.nom,
    ...(n.alias && par === "name" ? { alias: n.alias } : {}),
    ...(n.faible && par === "name" ? { aliasFaible: true } : {}),
    type: n.entree.type, ...(n.entree.imo ? { imo: n.entree.imo } : {}), score, par,
  };
}

/* ─────────────────────────── ce qui a changé depuis le relevé précédent ─────────────────────────── */

/**
 * LE RE-CRIBLAGE NE MONTRE QUE CE QUI A CHANGÉ. Les listes bougent chaque semaine ; un
 * abonné ne relit pas cinq cents noms chaque lundi, il relit ce qui est NOUVEAU. Une
 * contrepartie se reconnaît d'un relevé à l'autre par sa référence (`ref`), à défaut par son
 * nom ; un candidat, par sa liste et ses identifiants.
 */
export type Changements = {
  precedent: { emisLe: string; empreinte: string; fichier: string };
  listesMisesAJour: { source: string; avant: string; apres: string }[];
  nouveauxCandidats: { ref?: string; nom: string; statut: Statut; candidat: Candidat }[];
  candidatsDisparus: { ref?: string; nom: string; candidat: Candidat }[];
  contrepartiesAjoutees: { ref?: string; nom: string }[];
  contrepartiesRetirees: { ref?: string; nom: string }[];
};

const cleContrepartie = (r: { ref?: string; nom: string }) => (r.ref ? `ref:${r.ref}` : `nom:${r.nom.trim().toLowerCase()}`);
const cleCandidat = (c: Candidat) => `${c.source}|${[...c.ids].sort().join(",")}`;

export function comparer(avant: Criblage, apres: Omit<Criblage, "reserves" | "empreinte">): Changements {
  if (!scelleIntact(avant as unknown as Record<string, unknown>)) {
    throw new Error(`the previous record's seal does not match its content: it was edited after screening.
`
      + `  A comparison against an edited record would report changes that never happened. Nothing was screened.`);
  }
  const av = new Map(avant.resultats.map((r) => [cleContrepartie(r), r]));
  const ap = new Map(apres.resultats.map((r) => [cleContrepartie(r), r]));
  const ch: Changements = {
    precedent: { emisLe: avant.emisLe, empreinte: avant.empreinte!, fichier: avant.fichier.nom },
    listesMisesAJour: apres.listes.flatMap((l) => {
      const p = avant.listes.find((x) => x.source === l.source);
      return p && p.sha256 !== l.sha256 ? [{ source: l.source, avant: p.telechargeLe.slice(0, 10), apres: l.telechargeLe.slice(0, 10) }] : [];
    }),
    nouveauxCandidats: [], candidatsDisparus: [], contrepartiesAjoutees: [], contrepartiesRetirees: [],
  };
  for (const [k, r] of ap) {
    const p = av.get(k);
    if (!p) { ch.contrepartiesAjoutees.push({ ...(r.ref ? { ref: r.ref } : {}), nom: r.nom }); continue; }
    const avantCles = new Set(p.candidats.map(cleCandidat));
    for (const c of r.candidats) if (!avantCles.has(cleCandidat(c))) ch.nouveauxCandidats.push({ ...(r.ref ? { ref: r.ref } : {}), nom: r.nom, statut: r.statut, candidat: c });
    const apresCles = new Set(r.candidats.map(cleCandidat));
    for (const c of p.candidats) if (!apresCles.has(cleCandidat(c))) ch.candidatsDisparus.push({ ...(r.ref ? { ref: r.ref } : {}), nom: r.nom, candidat: c });
  }
  for (const [k, p] of av) if (!ap.has(k)) ch.contrepartiesRetirees.push({ ...(p.ref ? { ref: p.ref } : {}), nom: p.nom });
  return ch;
}

/* ─────────────────────────── l'export tableur ─────────────────────────── */

/** Une ligne par candidat (une seule pour un nom sans candidat), pour le système du client.
 *  Les cellules qui commencent par = + - @ sont préfixées d'une apostrophe : un tableur les
 *  exécuterait comme des formules (l'injection de formule dans un export CSV). */
export function versCsv(c: Criblage): string {
  const cell = (v: string | number | undefined) => {
    let t = v === undefined ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
    return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const lignes = [["ref", "name", "imo", "level", "listed_name", "list_source", "list", "list_ids", "via_alias", "weak_alias", "listed_imo", "score", "matched_on"].join(",")];
  for (const r of c.resultats) {
    const base = [r.ref, r.nom, r.imo, r.statut];
    if (r.candidats.length === 0) { lignes.push([...base, "", "", "", "", "", "", "", "", ""].map(cell).join(",")); continue; }
    for (const k of r.candidats) {
      lignes.push([...base, k.nomListe, k.source, k.liste, k.ids.join(" "), k.alias, k.aliasFaible ? "yes" : "", k.imo,
        k.score.toFixed(3), k.par].map(cell).join(","));
    }
  }
  return lignes.join("\n") + "\n";
}

/* ─────────────────────────── le relevé ─────────────────────────── */

const pct = (x: number) => `${Math.round(x * 100)} %`;

export function reserves(c: Omit<Criblage, "reserves" | "empreinte">): string[] {
  const dates = [...new Set(c.listes.map((l) => l.telechargeLe.slice(0, 10)))].sort();
  const m = c.methode;
  const r = [
    "A candidate is not a finding. Each one is for your compliance officer to confirm or clear; this report does not decide, and it is not legal advice.",
    `The lists are those downloaded on ${dates.join(", ")}. A name added to a list after that date is not in this report.`,
    "Names and IMO numbers only are compared. Dates of birth, addresses and other identifiers on the lists are not.",
    "Ownership is not screened. Under OFAC's 50 Percent Rule, an entity owned 50 % or more, directly or indirectly, by one or more blocked persons is itself blocked even when it appears on no list; no name screening can see that.",
    "The type and country columns are carried into the report, not used to filter: a counterparty listed under another type or country is still shown.",
    `At most ${CANDIDATS_MONTRES} candidates are shown per name, highest score first; the count of the others is given.`,
    m.verdict
      ? `The rates quoted first come from ${m.verdict.jeu.match} matching pairs and ${m.verdict.jeu.different} hard negatives written by a separate author who never saw the method, and never used to set a threshold. They are rates on authored names, not on your counterparties.`
      : "No held-out verdict set was available on this machine: the only rates quoted are those of the training sets, on which the thresholds were chosen, and they flatter the method.",
  ];
  for (const n of c.nonCriblees) r.push(`${n.titre} was NOT screened: ${n.raison}`);
  if (!m.tientLePlancher) r.push(`Even the possible level does not hold a recall lower bound of ${pct(m.rappelMin)} on the training sets.`);
  if (m.seuils.fort === m.seuils.possible) r.push(`On the training sets the two levels meet at ${m.seuils.fort.toFixed(2)}: every candidate is a strong one.`);
  if (c.resultats.some((x) => x.imoInvalide)) r.push("Some IMO numbers you supplied fail their check digit; they were used as given, and are marked.");
  return r;
}

const citer = (t: Record<string, { rappel: Cellule; fauxPositifs: Cellule }>, seuil: number): MesureCitee => {
  const c = t[seuil.toFixed(2)]!;
  return { rappel: c.rappel, fauxPositifs: c.fauxPositifs };
};

export function executer(
  fichier: string, client: string | undefined, maintenant: Date = new Date(), precedent?: string,
): { criblage: Criblage; cheminJson: string; avertissements: string[] } {
  const texte = readFileSync(fichier, "utf8");
  const { lignes, avertissements } = lireContreparties(texte);

  const m = lireManifeste();
  if (!m) throw new Error(`no listes-manifest.json: run \`npm run listes -- --fetch\` first. Nothing was screened.`);
  const listes: Criblage["listes"] = [];
  const nonCriblees: Criblage["nonCriblees"] = [];
  const entrees: EntreeListe[] = [];
  for (const s of SOURCES) {
    const l = m.listes.find((x) => x.source === s.source);
    if (!l) { nonCriblees.push({ source: s.source, titre: s.titre, raison: "absent from the manifest; run `npm run listes -- --fetch`." }); continue; }
    if (!l.disponible) { nonCriblees.push({ source: s.source, titre: s.titre, raison: `${l.erreur}. ${l.issue}` }); continue; }
    /* lireListe refuse un fichier qui ne correspond plus à son empreinte : on ne crible
       pas contre une liste qui n'est pas celle que le relevé va nommer. */
    entrees.push(...lireListe(s.source));
    listes.push({ source: s.source, titre: s.titre, url: s.url, telechargeLe: l.telechargeLe, sha256: l.sha256, entrees: l.entrees });
  }
  if (listes.length === 0) throw new Error(`no list is available on this machine. Nothing was screened.\n  → npm run listes -- --fetch`);

  const f = frequencesDe(entrees.map((e) => [e.nom, ...e.alias]));
  const bruts = CHEMINS_APPRENTISSAGE.map((u) => {
    const b = lireJeu(u);
    if (b === null) throw new Error(`the training set ${u.pathname} is missing: the thresholds cannot be measured. Nothing was screened.`);
    return b;
  });
  const apprentissage = mesurerJeux(f, bruts);
  const reglage: Reglage = choisirSeuils(apprentissage.table);
  const seuils = { fort: reglage.fort.seuil, possible: reglage.possible.seuil };
  const brutVerdict = lireJeu(CHEMIN_VERDICT);
  const verdict = brutVerdict === null ? null : mesurerJeux(f, [brutVerdict]);

  const index = new Index(f, entrees, seuils.possible);
  const resultats = lignes.map((c) => cribler(c, index, seuils));
  const forts = resultats.filter((x) => x.statut === "strong").length;
  const possibles = resultats.filter((x) => x.statut === "possible").length;
  const commit = commitCourant();
  const p = palierEntite(f);

  const base: Omit<Criblage, "reserves" | "empreinte"> = {
    version: 1, genre: "cascade-screening/counterparty-screening",
    emisLe: maintenant.toISOString(), ...(client ? { client } : {}), ...(commit ? commit : {}),
    fichier: { nom: basename(fichier), sha256: createHash("sha256").update(texte).digest("hex"), lignes: lignes.length },
    listes, nonCriblees,
    methode: {
      palier: p.id, description: p.description,
      poids: `word weights are the smoothed inverse document frequency over the ${f.entrees.toLocaleString("en-GB")} entries of the screened lists`,
      seuils, rappelMin: RAPPEL_MIN, tientLePlancher: reglage.tientLePlancher,
      apprentissage: { jeux: apprentissage.jeux, fort: citer(apprentissage.table, seuils.fort), possible: citer(apprentissage.table, seuils.possible) },
      verdict: verdict ? { jeu: verdict.jeux[0]!, fort: citer(verdict.table, seuils.fort), possible: citer(verdict.table, seuils.possible) } : null,
    },
    totaux: { lignes: lignes.length, forts, possibles, sansCorrespondance: lignes.length - forts - possibles },
    resultats,
  };
  if (precedent) base.changements = comparer(JSON.parse(readFileSync(precedent, "utf8")) as Criblage, base);
  const criblage: Criblage = { ...base, reserves: reserves(base) };
  criblage.empreinte = empreinteDuReleve(criblage);
  const cheminJson = fichier.replace(/\.csv$/i, "") + ".screening.json";
  return { criblage, cheminJson, avertissements };
}

/* ─────────────────────────── la commande ─────────────────────────── */

const intervalle = (c: Cellule) => `${pct(c.taux)} [${Math.round(c.bas * 100)}-${Math.round(c.haut * 100)}]`;

function principal(): void {
  refuserDrapeauxInconnus(["--names", "--client", "--previous"]);
  const arg = (nom: string) => process.argv.find((a) => a.startsWith(`--${nom}=`))?.split("=").slice(1).join("=");
  const fichier = arg("names");
  if (!fichier) {
    console.error(`Usage: npm run cribler -- --names=<counterparties.csv> [--client=<name>] [--previous=<last.screening.json>]\n\n`
      + `  The file needs a "name" column; "ref", "imo", "type" and "country" are optional.`);
    process.exit(2);
  }
  if (!existsSync(fichier)) { console.error(`\n${fichier}: no such file. Nothing was screened.\n`); process.exit(2); }
  const debut = Date.now();
  const precedent = arg("previous");
  if (precedent && !existsSync(precedent)) { console.error(`\n${precedent}: no such file. Nothing was screened.\n`); process.exit(2); }
  /* le relevé précédent est lu AVANT que le nouveau ne soit écrit : relancer sur le même
     fichier écrase l'ancien relevé, et c'est souvent lui qu'on passe en --previous */
  const { criblage: c, cheminJson, avertissements } = executer(fichier, arg("client"), new Date(), precedent);
  writeFileSync(cheminJson, JSON.stringify(c, null, 2) + "\n");
  const cheminCsv = cheminJson.replace(/\.json$/, ".csv");
  writeFileSync(cheminCsv, versCsv(c));
  for (const a of avertissements) console.log(`  ⚠ ${a}`);
  console.log(`\n${c.totaux.lignes} name(s) screened against ${c.listes.map((l) => `${l.source} (${l.entrees.toLocaleString("en-GB")})`).join(", ")}`);
  for (const n of c.nonCriblees) console.log(`  NOT screened: ${n.source}: ${n.raison}`);
  const m = c.methode;
  console.log(`Thresholds: strong ${m.seuils.fort.toFixed(2)}, possible ${m.seuils.possible.toFixed(2)} (chosen on the training sets)`);
  if (m.verdict) {
    console.log(`Held-out verdict set at strong: recall ${intervalle(m.verdict.fort.rappel)}, false alerts on hard negatives ${intervalle(m.verdict.fort.fauxPositifs)}`);
    if (m.seuils.possible !== m.seuils.fort) console.log(`Held-out verdict set at possible: recall ${intervalle(m.verdict.possible.rappel)}, false alerts ${intervalle(m.verdict.possible.fauxPositifs)}`);
  } else console.log(`No held-out verdict set on this machine: training rates only (they flatter the method).`);
  console.log(`${c.totaux.forts} strong, ${c.totaux.possibles} possible, ${c.totaux.sansCorrespondance} with no candidate · ${((Date.now() - debut) / 1000).toFixed(1)} s`);
  if (c.changements) {
    const ch = c.changements;
    console.log(`Since ${ch.precedent.emisLe.slice(0, 10)}: ${ch.nouveauxCandidats.length} new candidate(s), ${ch.candidatsDisparus.length} gone, `
      + `${ch.contrepartiesAjoutees.length} counterparty(ies) added, ${ch.contrepartiesRetirees.length} removed; lists updated: ${ch.listesMisesAJour.map((l) => l.source).join(", ") || "none"}`);
  }
  console.log(`Sealed record: ${cheminJson} (seal ${c.empreinte}) · spreadsheet: ${cheminCsv}\n`);
}

if (isMain(import.meta)) {
  try { principal(); }
  catch (e) { console.error(`\n${e instanceof Error ? e.message : String(e)}\n`); process.exit(1); }
}
