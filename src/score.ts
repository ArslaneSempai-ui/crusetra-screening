/**
 * LE SCORE : le nom préparé et ses marques, la similitude de deux mots, l'alignement de deux noms et ses plafonds,
 * les conflits de marques, les champs coupés, scoreBrut.
 * Découpé de entites.ts le 28/09/2026 : entites.ts reste la façade qui réexporte tout, aucun import ailleurs ne change.
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
import { cleAbjadVLuF, cleAbjadVoyelles } from "./ecritures.ts";
import type { Marques } from "./preparation.ts";
import type { Frequences } from "./mots.ts";
import { analyserEntite } from "./preparation.ts";
import { numero } from "./mots.ts";
import { PARTICULES } from "./preparation.ts";
import { poidsDuMot, pliUmlaut } from "./mots.ts";
import { squelette } from "./mots.ts";
import { voyelles } from "./mots.ts";
import { regionDeRegistre } from "./preparation.ts";
import { POINTS_CARDINAUX } from "./preparation.ts";
import { formePlurielle } from "./mots.ts";
import { DICTIONNAIRE } from "./mots.ts";
import { pluriel, plurielTurc } from "./mots.ts";
import { PAYS_NORDIQUES, GENERIQUES_NORDIQUES, patronymesDistincts, raisonsBilingues } from "./nordique.ts";
import { gerondif } from "./mots.ts";
import { motsDistincts } from "./mots.ts";
import { motsHispaniquesDistincts } from "./mots.ts";
import { pliEnye } from "./mots.ts";
import { composesDistincts } from "./mots.ts";
import { lemme } from "./mots.ts";
import { tousDeuxAnglais } from "./mots.ts";
import { initialesChinoisesCompatibles, estMotCourant } from "./mots.ts";
import { variationVocalique } from "./mots.ts";
import { voyelleSautee } from "./mots.ts";
import { voyelleEpenthetique } from "./mots.ts";
import { pliJaponais } from "./mots.ts";
import { pliCoreen } from "./mots.ts";
import { memeSuiteGrecque, CREDIT_GREC } from "./mots.ts";
import { pliIndien } from "./mots.ts";
import { pliTamoul } from "./mots.ts";
import { CREDIT_ROMANISATION } from "./mots.ts";
import { CREDIT_KANA, deriveGenerique } from "./mots.ts";
import { suffixeEtablissement } from "./mots.ts";
import { pliSlave, memeSuiteCyrillique } from "./mots.ts";
import { patronymeSlave } from "./mots.ts";
import { CREDIT_CYRILLIQUE } from "./mots.ts";
import { pliThai, CREDIT_THAI } from "./mots.ts";
import { pliBirman, CREDIT_BIRMAN } from "./birman.ts";
import { pliKhmer, CREDIT_KHMER } from "./khmer.ts";
import { queueDeComposeSlave } from "./mots.ts";
import { QUEUES_SLAVES } from "./mots.ts";
import { radicalSlave } from "./mots.ts";
import { pliVoyellesCoreennes } from "./mots.ts";
import { CREDIT_APPUI } from "./mots.ts";
import { CREDIT_ABJAD } from "./mots.ts";
import { squeletteLongue, pliAi } from "./mots.ts";
import { squeletteArabe, voyelleSauteeArabe, articleReduit } from "./mots.ts";
import { estSyllabeIsolee } from "./mots.ts";
import { homophoneCorrige } from "./mots.ts";
import { PAYS_MOTS } from "./variantes.ts";
import { REGIONS } from "./preparation.ts";
import { plier } from "./preparation.ts";
import { pliCantonais } from "./mots.ts";
import { FORMES } from "./preparation.ts";
import { memeEmprunt, CREDIT_EMPRUNT } from "./mots.ts";

export type NomPrepare = {
  mots: readonly string[]; poids: readonly number[]; total: number;
  /** le poids d'un mot qu'aucune liste ne porte : l'échelle de la rareté */
  poidsMax: number;
  squelettes: readonly string[]; replis: readonly string[];
  /** les mots que leur auteur a abrégés d'un point (« Petrochem. ») */
  abreges: readonly boolean[];
  /** les sigles écrits comme tels, lettres séparées d'un point, d'une barre ou d'une esperluette (« C&F », « T/C »,
   *  « C.I. ») : les initiales d'une locution que l'autre nom écrit en toutes lettres (voir `sigleDe`) */
  sigles: readonly boolean[];
  /** les mots écrits entre parenthèses (« (Shanghai) ») */
  parentheses: readonly boolean[];
  /** les mots que les tables ont traduits (« Comercial » devenu « commercial ») : des mots du métier, jamais
   *  des orphelins rares (voir `scorePrepares`) */
  traduits: readonly boolean[];
  /** pour un mot traduit, le mot romanisé qu'il traduit (« boeki » sous « trading »), « » sinon : sous la marque
   *  japonaise, deux sources différentes sous un même lemme sont deux raisons sociales (voir `scorePrepares`) */
  sources: readonly string[];
  /** les adjectifs régionaux d'un registre (« Rheinische », « Noord-Brabantse » avec son point cardinal) :
   *  au plancher quand l'autre nom n'en porte aucun (voir REGIONS_DE_REGISTRE et `regionsAuPlancher`) */
  decor: readonly boolean[];
  numeros: string; bloc: string;
  /** les civilités que la préparation a ôtées (« sri », « shree ») : un clavardage les soude au mot
   *  qui suit, et le score ne le lit que si l'autre nom les a écrites (voir CIVILITES) */
  civilites: readonly string[];
  /** le bloc des squelettes : la comparaison des mots collés s'y fait, pour que « Aldeeb »
   *  et « Al Dheeb » ne paient pas leur romanisation en plus de leur espace */
  blocSq: string;
  marques: Marques;
};

const SANS_MARQUES: Marques = { pays: [], familles: [], designations: [], navire: false, societe: false, arabe: false, japonais: false, chinois: false,
  coreen: false, hebreuOuGrec: false, indien: false, hispanique: false, tamoul: false, thai: false, birman: false, khmer: false, prive: false, majuscules: false, chat: false, abjad: "", cantonais: false,
  lecture: "mandarin", priveInconnu: false, natifs: new Map(), filiation: "", filiationOrdre: "", succursale: "", typeNavire: "", slave: false, emprunt: "" };

export function preparerNom(f: Frequences, nom: string, lecture: Lecture = "mandarin"): NomPrepare {
  const a = analyserEntite(nom, lecture);
  const { texte: _t, abreges, parentheses, civilites, traduits, sources, sigles, ...marques } = a;
  return depuisJetons(f, jetons(preparer(a.texte)), marques, abreges, parentheses, civilites, traduits, sources, sigles);
}

export function depuisJetons(f: Frequences, J: readonly string[], marques: Marques = SANS_MARQUES,
  abreges: ReadonlySet<string> = new Set(), parentheses: ReadonlySet<string> = new Set(), civilites: ReadonlySet<string> = new Set(),
  traduits: ReadonlySet<string> = new Set(), sources: ReadonlyMap<string, string> = new Map(), sigles: ReadonlySet<string> = new Set()): NomPrepare {
  /* Un chiffre romain n'est un NUMÉRO qu'en fin de nom (« Karina II », « Star I ») : au milieu,
     « I » est un mot (« Shun I Fa », le « yi » chinois en Wade-Giles, mesuré le 27/09 : la
     règle des numéros le lisait « 1 » et rendait 0 face à « Shun Yi Fa No. 232 »). */
  const num = (j: string, i: number) => /^\d+$/.test(j) ? String(Number(j)) : i === J.length - 1 ? numero(j) : undefined;
  const mots = J.filter((j, i) => !num(j, i));
  const poids = mots.map((m) => (PARTICULES.has(m) ? 1 : poidsDuMot(f, m)));
  return {
    mots, poids, total: poids.reduce((s, p) => s + p, 0), poidsMax: poidsDuMot(f, "\u0000"),
    squelettes: mots.map(squelette),
    replis: mots.map((m) => voyelles(squelette(m))),
    abreges: mots.map((m) => abreges.has(m)),
    sigles: mots.map((m) => sigles.has(m)),
    parentheses: mots.map((m) => parentheses.has(m)),
    traduits: mots.map((m) => traduits.has(m)),
    sources: mots.map((m) => sources.get(m) ?? ""),
    decor: mots.map((m, i) => regionDeRegistre(m) || (POINTS_CARDINAUX.has(m) && regionDeRegistre(mots[i + 1] ?? ""))
      /* et le patronyme d'une personne de la CEI derrière son nom et son prénom, sous la marque slave (tour 13, voir `patronymeSlave`) */
      || (marques.slave && i >= 2 && patronymeSlave(m))),
    numeros: J.map(num).filter(Boolean).sort().join(" "),
    bloc: mots.join(""), blocSq: mots.map(squelette).join(""),
    civilites: [...civilites],
    marques,
  };
}

/**
 * Deux mots, dans [0, 1] : identiques (1), à quelques fautes près, ou même squelette de
 * romanisation (≤ 0,95).
 *
 * PAS DE CLÉ PHONÉTIQUE ICI, et c'est mesuré : elle efface les voyelles, et rendait « grain »
 * et « green », « freight » et « fruit » identiques, deux fausses alertes à 0,98 sur le jeu
 * d'apprentissage. Pour des noms de personnes elle sert (Mohammad, Muhammad) ; pour des
 * sociétés, les variantes réelles sont celles de la romanisation, que le squelette porte
 * explicitement.
 *
 * LA PREMIÈRE LETTRE COMPTE DOUBLE à l'écrit : une faute de frappe touche rarement
 * l'initiale, et une initiale différente fait presque toujours un autre mot (« Harlow »,
 * « Barlow »). Le squelette, lui, ramène déjà Q et K, W et V, Kh et H à la même initiale :
 * « Qadir » et « Kadir » ne paient rien.
 */
export function simMot(a: string, b: string, sqA: string, sqB: string, voyellesLibres = true, pluriels = true): number {
  if (a === b) return 1;
  /* la lettre perdue d'un encodage (« seʔora » pour Señora) tient lieu d'une lettre, et d'une
     seule : le mot vaut l'égalité quand tout le reste est égal, lettre pour lettre */
  if ((porteUnJalon(a) || porteUnJalon(b)) && lettrePerdue(a, b)) return 1;
  /* le pluriel d'un mot du dictionnaire : le même mot quand c'est un mot du commerce (« Metals », « Metal »),
     un AUTRE NOM sinon (« Egret », « Egrets » ; « Store », « Stores » ; « Pearl », « Pearls »), comme deux mots
     anglais distincts, et non une lettre de différence (jeu 10, 27/09 : 0,836 pour « Bonny Egret » face à
     « Bonny Egrets » par la seule distance). Dans un nom de navire (`pluriels` faux), tout pluriel est une
     autre coque : « Nembe Fortune » et « Nembe Fortunes » */
  if (formePlurielle(a, b) || formePlurielle(b, a)) {
    const court = a.length < b.length ? a : b;
    if (DICTIONNAIRE.has(court)) return pluriels && (pluriel(a, b) || pluriel(b, a)) ? 0.95 : 0.5;
    /* dans un nom de navire, le pluriel de N'IMPORTE QUEL mot est une autre coque : « MTS Rijnkrekel », « MTS Rijnkrekels » (jeu 14) */
    if (!pluriels) return 0.5;
  }
  if (gerondif(a, b) || gerondif(b, a)) return 0.95;
  /* l'adjectif d'un mot du commerce (« Industrial », « Industry » : voir `deriveGenerique`), au crédit du pluriel, hors d'un navire */
  if (pluriels && deriveGenerique(a, b)) return 0.95;
  /* l'abréviation SANS POINT n'est crue que d'un mot courant : on abrège engineering en engg et holdings en hldgs,
     pas un nom propre. « LST » retrouvait ses trois lettres dans « Lieselotte », « Lahnstein » et « Lingestroom »
     (livre de mille contreparties, 28/09 : 14 des 20 possibles étaient un navire d'un seul mot face à un sigle) */
  if ((abrege(a, b) && estMotCourant(b)) || (abrege(b, a) && estMotCourant(a))) return 0.9;
  if (motsDistincts(a, b, voyellesLibres) || composesDistincts(a, b, voyellesLibres) || motsHispaniquesDistincts(a, b)) return 0.5;
  /* sauf quand les deux squelettes sont égaux : g et k en finale, une lettre doublée sont les classes d'une graphie, pas deux
     queues (« Kleinhekking », « Kleinhekkink », jeu 14 : 0,450, « king » et « kink » lus comme Timberline et Timberland dans un
     patronyme néerlandais) */
  if (sqA !== sqB && composesAQueuesDistinctes(a, b, voyellesLibres)) return 0.5;
  if (initialeLueOptiquement(a, b)) return 0.95;
  if (sqA === sqB) return 0.95;
  /* la longueur seule tranche : deux mots dont les longueurs diffèrent de moitié ne se
     rapprochent jamais au-dessus de 0,5, et la distance d'édition n'a pas à se calculer */
  const L = Math.max(a.length, b.length), Ls = Math.max(sqA.length, sqB.length);
  const ecrit = Math.abs(a.length - b.length) * 2 > L ? 0
    : Math.max(0, 1 - (distanceOsa(a, b) + (a[0] === b[0] ? 0 : 1)) / L);
  /* et la consonne substituée au squelette ne se lit que quand l'écrit n'a pas la même longueur des deux côtés : un digramme
     contre une lettre (« sh » contre « r »). À longueur égale, l'écrit compte déjà la substitution pour une lettre, et ce qui
     reste au squelette est un pli qu'il ne connaît pas encore (« Werchnjaja » pour Verkhnyaya, « Phuedphol » pour Phuetphon,
     « Pasifik » pour Pacific : trois vrais noms perdus quand la règle valait à toute longueur, mesuré le 27/09) */
  const romanise = Math.abs(sqA.length - sqB.length) * 2 > Ls || (a.length !== b.length && consonneSubstituee(sqA, sqB)) ? 0
    : Math.max(0, Math.min(0.95, 1 - (distanceOsa(sqA, sqB) + (sqA[0] === sqB[0] ? 0 : 1)) / Ls));
  return Math.max(ecrit, romanise);
}

/** Les deux squelettes, de même longueur, ne diffèrent qu'en UNE place, et c'est une consonne des deux côtés : « iuXkeviX »
 *  et « iurkeviX » (Yushkevich, Yurkevich). Le squelette a déjà fondu toutes les classes qu'une romanisation confond ;
 *  une consonne d'une autre classe à la place d'une autre n'en est pas une, et la distance des squelettes ne la crédite
 *  pas : l'écrit seul en juge (jeu 12, 27/09 : 0,864 pour deux capitaines, le sh compté pour une lettre sur huit quand
 *  l'écrit en comptait deux sur dix). Une voyelle, une lettre de plus ou de moins restent au squelette. */
export function consonneSubstituee(sqA: string, sqB: string): boolean {
  if (sqA.length !== sqB.length || sqA === sqB) return false;
  let k = -1;
  for (let i = 0; i < sqA.length; i++) if (sqA[i] !== sqB[i]) { if (k >= 0) return false; k = i; }
  return k >= 0 && !/[aeiou]/.test(sqA[k]!) && !/[aeiou]/.test(sqB[k]!);
}

/** La lettre-jalon d'une lettre PERDUE à l'encodage (« SE?ORA », « ?ugowski ») : le coup de glotte
 *  (U+0294), une lettre pour la normalisation, qu'aucun nom n'écrit. Posée par `analyserEntite`. */
export const PERDU = "\u0294";
/** La lettre-jalon du 1 d'une lecture optique (« KEMUN1NG », « Trai1 ») : la fricative pharyngale
 *  (U+0295), une lettre pour la normalisation, qu'aucun nom n'écrit. Elle vaut un i ou un l, rien
 *  d'autre (voir `ocr`). Posée par `ocr`, donc par `analyserEntite`. */
export const LU_UN = "\u0295";
/** Le mot porte une lettre-jalon, de l'une ou l'autre sorte. */
export function porteUnJalon(mot: string): boolean {
  return mot.includes(PERDU) || mot.includes(LU_UN);
}
/** Les lettres que `plier` rend par deux : æ, œ, ß, þ. Une lettre perdue en vaut deux là. */
const DIGRAMMES_PLIES: ReadonlySet<string> = new Set(["ae", "oe", "ss", "th"]);
/** Deux mots égaux lettre pour lettre, sauf là où l'un porte la lettre-jalon, qui vaut UNE lettre
 *  de l'autre (« seʔora », « senora »), ou l'une des lettres que `plier` rend par deux (« skjʔrgʔrd »,
 *  « skjaergard » : æ). Jamais davantage : « stra?e » et « strass » ne se lisent pas. Le jalon du 1
 *  lu optiquement (LU_UN) ne vaut qu'un i ou un l (« kemunʕng », « kemuning »). */
export function lettrePerdue(a: string, b: string): boolean {
  const suite = (i: number, j: number): boolean => {
    if (i === a.length || j === b.length) return i === a.length && j === b.length;
    if (a[i] === b[j]) return suite(i + 1, j + 1);
    if (a[i] === PERDU) return suite(i + 1, j + 1) || (DIGRAMMES_PLIES.has(b.slice(j, j + 2)) && suite(i + 1, j + 2));
    if (b[j] === PERDU) return suite(i + 1, j + 1) || (DIGRAMMES_PLIES.has(a.slice(i, i + 2)) && suite(i + 2, j + 1));
    if ((a[i] === LU_UN && (b[j] === "i" || b[j] === "l")) || (b[j] === LU_UN && (a[i] === "i" || a[i] === "l"))) return suite(i + 1, j + 1);
    return false;
  };
  return Math.abs(a.length - b.length) <= 3 && suite(0, 0);
}
/** Une lecture optique lit la capitale I comme un l minuscule (« lsolde » pour Isolde, « lllmarinen »
 *  pour Illmarinen) ; la casse perdue à la normalisation, il reste deux mots qui ne diffèrent que par
 *  cette initiale. À partir de cinq lettres : plus court, un i et un l en tête font deux noms (Ian et
 *  Lan, Iago et Lago). Le chiffre 1 lu l ou I passe déjà par `ocr`. */
export function initialeLueOptiquement(a: string, b: string): boolean {
  if (a.length !== b.length || a.length < 5 || a.slice(1) !== b.slice(1)) return false;
  return (a[0] === "i" && b[0] === "l") || (a[0] === "l" && b[0] === "i");
}

/**
 * LA SIGNATURE D'UNE FAUTE DE FRAPPE entre deux mots qu'aucun dictionnaire ne connaît : une seule
 * transposition de deux lettres qui se suivent (« Lindhlom », « Nordhvan », « Aegaen »), ou une seule
 * lettre tombée ou doublée (« Tarnhem » pour Tarnhelm) ; jamais sur l'initiale, et sur des mots d'au
 * moins six lettres. Elle lève l'ambiguïté du mot court (voir `scorePrepares`) : sous six lettres,
 * ou entre deux mots anglais, une lettre de différence reste un autre mot (Phuong et Phong ; Marlin
 * et Merlin), et le plafond tient.
 *
 * PAS LA SUBSTITUTION D'UNE LETTRE, même entre deux touches voisines du clavier : c'est aussi la
 * signature de deux mots réels (mesuré le 27/09 sur le jeu 7 : « Castello » et « Castelli »
 * passaient de 0,800 à 0,869, « Fedorov » et « Fedotov » à 0,878, deux fausses alertes fortes,
 * pour un seul vrai nom gagné, « Torvakd »).
 */
export function fauteDeFrappe(a: string, b: string): boolean {
  if (a.length < 6 || b.length < 6) return false;
  if (lemme(a) !== undefined || lemme(b) !== undefined) return false;
  /* un « s » final en plus n'est pas le geste d'une faute : c'est le pluriel ou le possessif d'un nom de
     famille, l'enseigne d'une autre boutique (« Njoroge », « Njoroges » ; jeu 10, 27/09 : 0,917, la
     lettre tombée levant le plafond du mot ambigu) */
  if (formePlurielle(a, b) || formePlurielle(b, a)) return false;
  return gesteDeFrappe(a, b);
}
/** Une lettre TOMBÉE (ou ajoutée) qui n'est ni un doublement ni une transposition : « Norvik » pour Nordvik, « Nilsen »
 *  pour Nielsen. Sous la marque nordique, ce geste-là ne lève pas le plafond du mot court (voir `scorePrepares`). */
export function lettreTombee(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) !== 1) return false;
  const [court, long] = a.length < b.length ? [a, b] : [b, a];
  const k = [...long].findIndex((c, i) => c !== court[i]);
  if (long.slice(0, k) + long.slice(k + 1) !== court) return false;
  return long[k] !== long[k - 1] && long[k] !== long[k + 1];
}
/** UNE LETTRE CHANGÉE entre deux mots : une seule lettre substituée, ou une seule lettre en plus ou en moins, qui n'est ni la
 *  transposition de deux lettres voisines ni le doublement d'une lettre (ces deux gestes portent la signature d'une faute de
 *  frappe, voir `gesteDeFrappe`, et se mesurent à part). Ni le s d'un pluriel, qui a sa règle ; jamais sur un mot qui porte un
 *  chiffre, un numéro ayant la sienne. Sous la marque navire, c'est une autre coque (voir `scorePrepares`). */
export function lettreChangee(a: string, b: string): boolean {
  if (a === b || /\d/.test(a) || /\d/.test(b)) return false;
  if (formePlurielle(a, b) || formePlurielle(b, a)) return false;
  if (a.length === b.length) {
    let k = -1;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { if (k >= 0) return false; k = i; }
    return k >= 0;
  }
  return Math.abs(a.length - b.length) === 1 && lettreTombee(a, b);
}
/** Le GESTE d'une faute de frappe, sans regarder la longueur ni le dictionnaire : deux lettres qui se
 *  suivent inversées, ou une lettre tombée ou doublée, jamais sur l'initiale. */
export function gesteDeFrappe(a: string, b: string): boolean {
  if (a === b || a[0] !== b[0]) return false;
  if (a.length === b.length) {
    const k = [...a].findIndex((c, i) => c !== b[i]);
    return a[k] === b[k + 1] && a[k + 1] === b[k] && a.slice(k + 2) === b.slice(k + 2);
  }
  if (Math.abs(a.length - b.length) !== 1) return false;
  const [court, long] = a.length < b.length ? [a, b] : [b, a];
  const k = [...long].findIndex((c, i) => c !== court[i]);
  return long.slice(0, k) + long.slice(k + 1) === court;
}

/**
 * `court` abrège-t-il `long` ? « engg » engineering, « mktg » marketing, « hldgs » holdings :
 * une abréviation garde l'initiale et ses lettres dans l'ordre, sans en être le DÉBUT (un
 * début de mot est un autre mot : « sun » n'abrège pas « sunshine ») et sans voyelle après
 * l'initiale (un mot ordinaire en a : « star » n'abrège pas « steamer », mesuré par le témoin
 * le 27/09 quand la règle tolérait encore une voyelle).
 */
export function abrege(court: string, long: string): boolean {
  /* trois lettres au moins : « brk » abrège brokerage ; « pm » trouverait ses deux lettres
     dans la moitié des mots (mesuré le 27/09 : « AO PROTON PM » contre « Proton Petrochemical ») */
  if (court.length < 3 || court.length > 5 || long.length < court.length + 3) return false;
  if (court[0] !== long[0] || long.startsWith(court)) return false;
  if (/[aeiou]/.test(court.slice(1))) return false;
  let i = 0;
  for (const c of long) if (c === court[i]) i++;
  return i === court.length;
}

/** `court`, écrit avec son point, abrège-t-il `long` À L'ALLEMANDE ? L'abréviation allemande garde des syllabes
 *  entières (« Süddt. » pour Süddeutsche, « Masch. » pour Maschinen) : l'initiale et les lettres dans l'ordre, voyelles
 *  comprises, ce que `abrege` refuse ; et l'umlaut s'y écrit souvent ue, oe, ae (« Sueddt. » face à « Süddeutsche »,
 *  jeu 5, tour 10 : 0,600, le mot resté orphelin), plié des deux côtés (voir `pliUmlaut`). Quatre lettres au moins et
 *  un mot d'au moins trois de plus. Ne vaut que sous la marque germanique et pour un mot écrit avec son point
 *  (voir `scorePrepares`), et l'index le retient sous la même condition (voir cribler.ts). */
export function abregeAllemand(court: string, long: string): boolean {
  const c = pliUmlaut(court), l = pliUmlaut(long);
  if (c.length < 4 || l.length < c.length + 3 || c[0] !== l[0]) return false;
  let i = 0;
  for (const ch of l) if (ch === c[i]) i++;
  return i === c.length;
}

/** Le dernier mot d'un nom coupé par un champ de longueur fixe (35 caractères dans un
 *  message de paiement) est un DÉBUT de mot : « Engineer » pour « Engineering ». Vrai à
 *  partir de quatre lettres, et seulement pour le dernier mot. */
export function tronque(dernier: string, long: string): boolean {
  if (long.length <= dernier.length || !long.startsWith(dernier)) return false;
  /* un champ ou un usage qui n'épargne qu'UNE lettre n'a rien coupé : « Amber » n'est pas « Amberg » commencé (jeu 12,
     27/09 : 0,890, deux navires), « Store » n'est pas « Stored » ; une lettre de plus est une faute ou un autre mot, et
     leurs règles en jugent. Les vraies coupes de champ épargnent au moins deux lettres ou passent par `sembleCoupe` */
  if (long.length < dernier.length + 2) return false;
  /* un mot du dictionnaire suivi de son seul pluriel n'est pas un début coupé, c'est le pluriel, et c'est
     `pluriel` qui en décide : « Egret » n'est pas « Egrets » tronqué (jeu 10, 27/09 : quatre navires et deux
     boutiques au pluriel passaient par cette porte une fois le pluriel restreint aux mots du commerce) */
  if (DICTIONNAIRE.has(dernier) && /^(?:s|es)$/.test(long.slice(dernier.length))) return false;
  /* trois lettres suffisent quand le mot entier est long (« Pro » pour « Prosperity ») */
  return dernier.length >= 4 || (dernier.length === 3 && long.length >= 7);
}

/**
 * LE SIGLE D'UNE LOCUTION : « C&F » pour Clearing and Forwarding, « T/C » pour Time Charter, « C.I. » pour Comercializadora
 * Internacional (jeux 5 et 10, tour 9 : 0,496, 0,584 et 0,574, le sigle mot rare sans répondant et ses mots orphelins de
 * l'autre côté). Un sigle écrit comme tel (`sigles` : des lettres séparées d'un point, d'une barre ou d'une esperluette),
 * de deux à quatre lettres, dont les lettres sont les INITIALES d'autant de mots consécutifs de l'autre nom, tous de
 * trois lettres au moins, ni particules ni écrits de ce côté-ci : il vaut ces mots au crédit d'une abréviation (0,9), et
 * chacun d'eux le vaut (voir `scorePrepares`). Le sigle sans ponctuation (« CF ») n'ouvre rien : « JP », « AK », « GS »
 * sont aussi des initiales de personnes. Rend l'indice du premier mot couvert dans `mots`, ou -1.
 */
export function sigleDe(sigle: string, mots: readonly string[], absents: readonly string[]): number {
  const L = sigle.length;
  if (L < 2 || L > 4 || mots.length < L) return -1;
  for (let j = 0; j + L <= mots.length; j++) {
    let ok = true;
    for (let k = 0; k < L && ok; k++) {
      const w = mots[j + k]!;
      ok = w.length >= 3 && w[0] === sigle[k] && !PARTICULES.has(w) && !absents.includes(w);
    }
    if (ok) return j;
  }
  return -1;
}

/**
 * Ce qu'un mot apporte au score : sa similarité, TRANCHÉE. Un mot à moitié ressemblant
 * (« north » et « south », 0,6) n'est pas à moitié le même mot : il est un autre mot. Sous
 * 0,5 un mot n'apporte rien ; au-dessus, l'écart à 1 compte double.
 */
export function apport(sim: number): number {
  return sim >= 1 ? 1 : Math.max(0, (sim - 0.5) / 0.5);
}
/** Un mot du dictionnaire et ce mot suivi d'UNE lettre que le dictionnaire ne connaît plus, hors le s du pluriel :
 *  « amber » et « amberg », « park » et « parke ». Le pluriel a sa règle (`pluriel`), la faute d'un clavardage la sienne. */
export function lettreAjoutee(a: string, b: string): boolean {
  const [court, long] = a.length < b.length ? [a, b] : [b, a];
  if (long.length !== court.length + 1 || !long.startsWith(court) || long.endsWith("s")) return false;
  return lemme(court) !== undefined && lemme(long) === undefined;
}

/**
 * Le score de deux noms préparés, dans [0, 1].
 *
 *  - Les mots s'alignent sans ordre : chaque mot des deux côtés cherche son meilleur
 *    correspondant, apporte sa similarité tranchée (`apport`), et pèse selon sa RARETÉ
 *    dans les listes. « Golden Star Shipping » contre
 *    « Golden Sun Shipping » se joue sur « star » et « sun », pas sur « shipping ».
 *  - Le bloc (les mots collés : « Petro Link » contre « PetroLink ») ne compte QUE si les
 *    deux noms n'ont pas le même nombre de mots : c'est l'écart qu'il existe pour lire. Sur
 *    deux noms de même longueur, il laisserait une lettre de différence par mot se diluer
 *    dans la chaîne entière.
 *  - Les NUMÉROS ne se discutent pas : deux navires numérotés différemment sont deux
 *    navires ; un numéro d'un seul côté plafonne le score au niveau possible sans l'annuler,
 *    parce qu'un nom saisi sans son numéro reste à relire. Des marques en conflit
 *    (`marquesEnConflit`) plafonnent de même.
 */
/** Ce que le criblage passe au score : le seuil sous lequel un candidat ne l'intéresse plus
 *  (sortie anticipée), et un cache des paires de mots déjà comparées pour cette requête. */
export type OptionsScore = { auMoins?: number; memo?: Map<string, number> };

export function scorePrepares(A: NomPrepare, B: NomPrepare, options: OptionsScore = {}): number {
  if (A.numeros && B.numeros && A.numeros !== B.numeros) return 0;
  /* deux noms lus dans des sinogrammes se comparent sous la MÊME lecture : le mandarin de l'un
     face au cantonais de l'autre ne dit rien (jeu 9, 27/09 : 源成 en mandarin, yuancheng, face à
     源盛 en cantonais, yuen sing, passait à 0,857 par le bloc, hors de la garde des homophones) */
  if (A.marques.natifs.size > 0 && B.marques.natifs.size > 0 && A.marques.cantonais !== B.marques.cantonais) return 0;
  if (A.mots.length === 0 || B.mots.length === 0) {
    return A.mots.length === B.mots.length && A.numeros === B.numeros && A.numeros !== "" ? 1 : 0;
  }
  [A, B] = [regionsAuPlancher(A, B), regionsAuPlancher(B, A)];
  const orphelins = [false, false];
  const rareCouvert = [false, false];
  const parenthese = [false, false], parentheseReconnue = [false, false];
  /* un mot RARE sans répondant de l'autre côté (« Navigation », « Beheer », « Zambia »,
     « Machinery », « Plus ») : l'autre nom ne le porte pas, ce n'est pas la même entité, au
     mieux sa mère, sa filiale ou l'armateur de ce navire ; et un mot court, non anglais,
     à une lettre près d'un mot de l'autre nom (« Phuong », « Phong » ; « Lixing », « Lixin » ;
     « Meier », « Mayer ») : en chinois, en vietnamien, en allemand, c'est un autre mot autant
     qu'une faute. Les deux plafonnent au niveau POSSIBLE. */
  let orphelinRare = false, motAmbigu = false;
  /* un qualificatif de groupe soudé à son radical d'un côté (« Agroholding »), le radical nu
     de l'autre (« Agro ») : la holding face à la société qui exploite (voir QUALIFICATIFS_SOUDES) */
  let qualificatifSoudeVu = false;
  const orphelinsMots: [string[], string[]] = [[], []];
  /* LE NOM COMMERCIAL FACE AU NOM DÉPOSÉ : un côté sans aucune forme juridique (le nom tel qu'un WhatsApp,
     une facture ou un manifeste l'écrit), l'autre avec sa forme, et rien de plus qu'un mot de pays et des
     qualificatifs de registre (« Adeyemi Agro Commodities » face à « Adeyemi Agro Commodities Nigeria
     Limited », « Okafor Integrated Resources » face à « … Nig. Ltd ») : la douane ajoute le suffixe déposé,
     c'est la même société, et le mot de pays n'y fait pas une filiale (jeu 10, 27/09 : quinze paires à
     0,800). Quand les DEUX côtés portent une forme, « X Nigeria Ltd » face à « X Ltd » reste la filiale */
  const sansFormeA = !A.marques.societe && A.marques.familles.length === 0, sansFormeB = !B.marques.societe && B.marques.familles.length === 0;
  const nomCommercial: 0 | 1 | undefined = sansFormeA !== sansFormeB ? (sansFormeA ? 0 : 1) : undefined;
  /* la variation de voyelle et le repli ne sont crédités que là où une romanisation les
     produit : l'arabe et le persan (a, e, i ; o, u), le japonais (ō, ū : o, ou, oo, u). En
     allemand, en espagnol, en vietnamien, en chinois, une voyelle de plus ou de moins est un
     autre mot (Meier, Mayer ; Solaris, Solares ; Phuong, Phong ; Jinyang, Jinyoung : mesuré) */
  const romanisation = A.marques.arabe || B.marques.arabe || A.marques.japonais || B.marques.japonais;
  /* l'Indonésie et la Malaisie (PT, CV, UD, Tbk, Sdn Bhd) : l'orthographe d'avant 1972 (tj, dj, oe) et la
     moderne s'écrivent avec le même squelette, et c'est le squelette qui fait foi (« Tjahaja Soerya Kentjana »,
     « Cahaya Surya Kencana », jeu 9) */
  const indonesien = ["ID", "MY"].some((k) => A.marques.pays.includes(k) || B.marques.pays.includes(k));
  /* l'allemand et le néerlandais (GmbH, mbH, AG, KG, B.V., N.V. ; Autriche, Suisse, Belgique) : là où les noms
     composent leurs mots, et où le nom d'usage garde un membre du composé (voir `compose`) */
  const germanique = ["DE", "AT", "CH", "NL", "BE"].some((k) => A.marques.pays.includes(k) || B.marques.pays.includes(k));
  /* la voyelle d'appui d'un groupe final de consonnes (« Bahr », « Bahar ») n'est que de l'arabe */
  const arabe = A.marques.arabe || B.marques.arabe;
  const japonais = A.marques.japonais || B.marques.japonais, coreen = A.marques.coreen || B.marques.coreen;
  const hebreuOuGrec = A.marques.hebreuOuGrec || B.marques.hebreuOuGrec, indien = A.marques.indien || B.marques.indien;
  const hispanique = A.marques.hispanique || B.marques.hispanique;
  const tamoul = A.marques.tamoul || B.marques.tamoul;
  /* un nom thaï d'un côté : la RTGS et la graphie d'usage d'un même mot sont un mot (`pliThai`, CREDIT_THAI) */
  const thai = A.marques.thai || B.marques.thai;
  /* un nom birman ou khmer d'un côté : la même syllabe sous deux graphies est un mot (`pliBirman`, `pliKhmer` ; tour 18, jeu 22) */
  const birman = A.marques.birman || B.marques.birman, khmer = A.marques.khmer || B.marques.khmer;
  /* en pinyin, l'initiale est un phonème : Jin n'est pas Yin, Chang n'est pas Shang ; seules les
     paires d'aspiration du Wade-Giles se confondent (k, g ; t, d ; p, b ; ts, z, c ; ch, zh, j, q ; hs, x) */
  const chinois = A.marques.chinois || B.marques.chinois;
  /* une lecture cantonaise d'un côté : les syllabes se replient sur la graphie de Hong Kong (Shing,
     Sing ; Kam, Gam ; Luen, Lyun ; Cheung, Tseung) et l'équivalence vaut CREDIT_ROMANISATION, comme
     celle du coréen (jeu 9, 27/09 : « Wing Shing Group Holdings » contre 永成集團控股, à 0,800 par le
     seul bloc des squelettes quand 永成 ne se lisait qu'en mandarin) */
  const cantonais = A.marques.cantonais || B.marques.cantonais;
  /* l'un des deux noms vient d'un clavardage : une lettre de différence avec un mot que le
     dictionnaire connaît y est une faute ou le correcteur d'un téléphone (voir plus bas) */
  const chat = A.marques.chat || B.marques.chat;
  /* un navire d'un côté ou de l'autre : le pluriel d'un mot n'y est jamais le même mot (voir `simMot`) */
  const navire = A.marques.navire || B.marques.navire;
  /* un nom russe ou ukrainien d'un côté : deux romanisations d'une même suite cyrillique sont un mot (`pliSlave`), le
     radical d'un adjectif de lieu se compare seul (`radicalSlave`), et la queue d'un composé fait une autre société
     (`queueDeComposeSlave`) */
  const slave = A.marques.slave || B.marques.slave;
  /* une forme nordique (Oy, Ab, AS, A/S, ApS, AB, OÜ, SIA, UAB) d'un côté ou de l'autre : deux patronymes en -sen ou -son y
     sont deux familles, un mot qui en commence un autre y est un membre de composé et non une abréviation, et une lettre de
     moins y fait un autre lieu ou une autre famille (voir nordique.ts). « AS » est aussi la Turquie : la marque y est posée
     à tort, mais ces trois règles ne parlent que de patronymes et de composés que le turc n'écrit pas */
  const nordique = [...A.marques.pays, ...B.marques.pays].some((k) => PAYS_NORDIQUES.has(k));
  /* aucune forme juridique d'aucun côté : deux noms tapés, pas copiés d'un registre (voir le pluriel d'un clavardage) */
  const sansForme = !A.marques.societe && !B.marques.societe;
  /* là où une romanisation écrit les voyelles librement, deux mots anglais qui n'en diffèrent que
     par une ne sont pas deux mots (Amir, Emir ; Lung, Long en Wade-Giles et en pinyin, mesuré le
     27/09 sur le jeu 4) ; sans aucune marque de langue, si (Marlin, Merlin ; voir `motsDistincts`).
     L'espagnol et le portugais écrivent leurs voyelles : leur marque n'ouvre rien */
  const voyellesLibres = romanisation || hebreuOuGrec || chinois || coreen || indien;
  /* un côté écrit dans un abjad (arabe et persan, hébreu) n'a pas de voyelles : ses mots se
     comparent aux consonnes du côté latin (`cleAbjad`), et l'égalité vaut un squelette égal */
  const abjad = A.marques.abjad || B.marques.abjad;
  /* aucun côté natif : les deux noms sont des romanisations d'usage, et les conventions latines de l'arabe (française, anglaise) s'y plient */
  const latin = abjad === "";
  /* LE STYLE D'UN NOM QUI TRONQUE (« Tema Consol & Log Ltd », « West Coast Chart & Brok Ltd », jeu 10, tour 9 : 0,531 et 0,612) :
     un connaissement qui abrège un mot par son début en abrège d'autres, et « Consol », « Chart » y sont Consolidators et
     Chartering bien que le dictionnaire les connaisse. Le signal, par côté : un mot absent de l'autre nom qui COMMENCE un mot
     de l'autre nom au crédit d'une troncature déjà admise (le dernier mot coupé, `tronque` ; l'abréviation d'usage, quatre
     lettres qu'aucun dictionnaire ne connaît : « Brok »). Sous ce signal, la réserve du dictionnaire tombe pour les autres
     mots de ce côté (voir l'abréviation d'usage plus bas) ; sans lui, « Sun » n'abrège toujours pas « Sunshine » */
  const styleTronque = (X: NomPrepare, Y: NomPrepare) => X.mots.some((x, i) => !Y.mots.includes(x)
    && Y.mots.some((y) => (i === X.mots.length - 1 && tronque(x, y)) || (x.length >= 4 && y.length >= x.length + 3 && y.startsWith(x) && !lemme(x))));
  const tronqueur: readonly [boolean, boolean] = [styleTronque(A, B), styleTronque(B, A)];
  /* le mot qu'un téléphone a corrigé (voir `motAutocorrige`) : sous la marque chat, hors des noms chinois, coréens et japonais */
  const autocorrige = chat && !chinois && !coreen && !japonais ? motAutocorrige(A, B) : undefined;
  /* UN NOM ÉCRIT DANS UNE ÉCRITURE QUI PRONONCE, face à un nom latin : ses mots anglais se comparent sur leur clé d'emprunt (voir
     `clesEmprunt`), dans le mode de l'écriture native ; deux noms de la même écriture, ou deux noms latins, jamais */
  const emprunt = A.marques.emprunt !== "" && B.marques.emprunt === "" ? A.marques.emprunt : B.marques.emprunt !== "" && A.marques.emprunt === "" ? B.marques.emprunt : "";
  const memo = options.memo;
  const cote = (X: NomPrepare, Y: NomPrepare, cote: 0 | 1) => {
    const styleX = tronqueur[cote], styleY = tronqueur[1 - cote]!;
    let s = 0;
    const descripteurX = descripteur(X);
    for (let i = 0; i < X.mots.length; i++) {
      let m = 0, meilleurY = -1, equivalentM = false;
      const dernierX = i === X.mots.length - 1;
      for (let j = 0; j < Y.mots.length && m < 1; j++) {
        const x = X.mots[i]!, y = Y.mots[j]!;
        const dernierY = j === Y.mots.length - 1;
        /* un jeton lu dans des sinogrammes garde ses caractères (voir `natifs`) */
        const nx = X.marques.natifs.get(x) ?? "", ny = Y.marques.natifs.get(y) ?? "";
        /* la clé porte tout ce qui décide : les deux mots, leurs marques d'abréviation, et
           leur position de dernier mot (la troncature ne vaut que pour lui) */
        /* le mot qui suit l'article ou la filiation arabe (« Al Ameen », « Bin Salem ») est un mot arabe, quoi qu'en dise le
           dictionnaire anglais, qui tient « amin » et « ameen » pour deux mots (jeu 13, 28/09 : « Al Ameen Shipping » face à
           « Al-Amin Shipping » à 0,648, la voyelle longue refusée à deux « mots anglais ») ; ailleurs, deux mots du dictionnaire
           restent deux mots (Green, Grin) */
        const arabeX = arabe && i > 0 && ARTICLES_ARABES.has(X.mots[i - 1]!), arabeY = arabe && j > 0 && ARTICLES_ARABES.has(Y.mots[j - 1]!);
        const anglais = tousDeuxAnglais(x, y) && !arabeX && !arabeY;
        const cle = memo ? `${x}|${y}|${X.abreges[i] ? 1 : 0}${Y.abreges[j] ? 1 : 0}${dernierX ? 1 : 0}${dernierY ? 1 : 0}${arabeX ? 1 : 0}${arabeY ? 1 : 0}${romanisation ? 1 : 0}${arabe ? 1 : 0}${chinois ? 1 : 0}${cantonais ? 1 : 0}${japonais ? 1 : 0}${coreen ? 1 : 0}${hebreuOuGrec ? 1 : 0}${indien ? 1 : 0}${tamoul ? 1 : 0}${thai ? 1 : 0}${birman ? 1 : 0}${khmer ? 1 : 0}${hispanique ? 1 : 0}${X.marques.majuscules ? 1 : 0}${Y.marques.majuscules ? 1 : 0}${chat ? 1 : 0}${navire ? 1 : 0}${sansForme ? 1 : 0}${germanique ? 1 : 0}${slave ? 1 : 0}${abjad}${nx}${ny}${nordique ? 1 : 0}${styleX ? 1 : 0}${styleY ? 1 : 0}${emprunt}` : "";
        /* le cache code l'équivalence de romanisation en ajoutant 2 à la valeur (elle est dans [0, 1]) */
        const enCache = memo?.get(cle);
        let v = enCache === undefined ? undefined : enCache >= 2 ? enCache - 2 : enCache;
        let equivalent = enCache !== undefined && enCache >= 2;
        if (v === undefined) {
          v = simMot(x, y, X.squelettes[i]!, Y.squelettes[j]!, voyellesLibres, !navire);
          const pliC = cantonais && x !== y && !anglais && pliCantonais(x) === pliCantonais(y);
          /* la même suite de kana sous deux romanisations (`pliJaponais`) : lue AVANT la règle chinoise des
             initiales, parce que « Co., Ltd. » marque aussi le nom chinois, et que h et f (« Huzimoto »,
             « Fujimoto »), t et c (« Tyūō », « Chūō ») ne sont pas deux syllabes chinoises mais un seul kana */
          const pliJ = japonais && x !== y && !anglais && pliJaponais(x) === pliJaponais(y);
          /* la même suite cyrillique sous deux romanisations (`pliSlave` : « Zhatva », « Žatva » ; « Yeyskiy », « Eiskii » ;
             « Mykolaivskyi », « Nikolaevskiy ») ; et la voyelle d'appui que la forme anglaise d'un prénom russe écrit dans
             son groupe final (« Aleksandr », « Alexander » ; « Dnepr », « Dnieper »), au crédit d'une romanisation */
          const pliS = slave && x !== y && !anglais && memeSuiteCyrillique(x, y);
          const appuiSlave = slave && !pliS && x !== y && !anglais && voyelleEpenthetique(pliSlave(x), pliSlave(y));
          /* les mêmes lettres thaïes sous la RTGS et la graphie d'usage (`pliThai` : « Phrachan », « Prajan » ; « Ngoen », « Ngern ») ; lue
             avant la règle chinoise des initiales, parce que « Co., Ltd. » marque aussi le nom chinois */
          /* et quand les DEUX noms sont thaïs, deux mots du dictionnaire anglais qui ne diffèrent que par ce pli sont la même syllabe thaïe
             (« Thong », « Tong » : ทอง, l'or ; tour 18, jeu 22 : « Phanit Thong Songkhla » face à « Panichtong Songkla » à 0,549) ; et de même
             quand un côté est écrit en thaï ou en lao, dont la lecture n'est pas un mot anglais (« ทองไพศาล » face à « Tong Paisal ») */
          const pliT = thai && x !== y && (!anglais || abjad === "thai" || (A.marques.thai && B.marques.thai)) && pliThai(x) === pliThai(y);
          /* la même syllabe birmane (« Htun », « Tun » ; « Myint », « Myin ») ou khmère (« Chhouk », « Chouk » ; « Pich », « Pech ») sous deux
             graphies, lue avant la règle chinoise des initiales pour la même raison que le thaï (tour 18, jeu 22) */
          const pliB = birman && x !== y && !anglais && pliBirman(x) === pliBirman(y);
          const pliK = khmer && x !== y && !anglais && pliKhmer(x) === pliKhmer(y);
          /* la même suite de lettres grecques sous deux romanisations ou en greeklish (`memeSuiteGrecque` : « Hellas », « Ellas » ;
             « Chatzimichalis », « Hadjimichalis » ; « Xenofontos », « Ksenofontos », « 3enofontos »), sous la marque grecque ou hébraïque */
          const pliG = hebreuOuGrec && x !== y && !anglais && memeSuiteGrecque(x, y);
          const autreSyllabe = chinois && x !== y && !pliC && !pliJ && !pliS && !pliT && !pliB && !pliK && !pliG && !initialesChinoisesCompatibles(x, y);
          if (autreSyllabe) v = Math.min(v, 0.5);
          /* une équivalence de romanisation, dans le contexte de la langue : elle vaut au moins
             CREDIT_ROMANISATION, et elle lève l'ambiguïté du mot court (voir plus bas) */
          equivalent = !autreSyllabe && x !== y && !anglais && (pliC
            /* sous la marque arabe, e se confond aussi avec u (le schwa de la graphie française : « Youssef », « Yusuf ») */
            || (romanisation && (X.replis[i] === Y.replis[j] || variationVocalique(X.squelettes[i]!, Y.squelettes[j]!, arabe)
              || voyelleSautee(X.squelettes[i]!, Y.squelettes[j]!)))
            || (arabe && voyelleEpenthetique(X.squelettes[i]!, Y.squelettes[j]!))
            /* et la voyelle sautée sur le squelette arabe, en tête de mot aussi (« Brahim », « Ibrahim » ; « Mheiri », « Muhairi ») */
            || (arabe && latin && voyelleSauteeArabe(squeletteArabe(x), squeletteArabe(y)))
            /* et « oe » y était « u » (« Soerya », « Surya ») : o et u ne font qu'une classe sous cette marque */
            || (indonesien && X.squelettes[i]!.replace(/o/g, "u") === Y.squelettes[j]!.replace(/o/g, "u"))
            || pliJ || pliS || appuiSlave || pliT || pliB || pliK
            || (coreen && pliCoreen(x) === pliCoreen(y))
            || pliG
            /* v, w, b : hindi, hébreu, espagnol, portugais ; sous leur contexte, au crédit et non au
               squelette, pour que Fabre reste distinct de Favre */
            || ((indien || hispanique) && pliIndien(x) === pliIndien(y))
            /* et la ñ écrite ny (« Nunyez », « Nuñez ») sous la marque hispanique (voir `pliEnye`) */
            || (hispanique && pliEnye(x) === pliEnye(y))
            /* le tamoul et son sanskrit (Lakshmi, லட்சுமி latchumi), sa sonorité non écrite */
            || (tamoul && pliTamoul(x) === pliTamoul(y))
            /* le ch et le kh d'un même ח (« Bracha », « Brakha »), le h final que le squelette mange après une voyelle et le X qu'il garde
               (« Tsemakh » : sema, « Tzemach » : semaX ; tour 17, jeu 21) : les deux squelettes, X lu h et ce h final ôté */
            || (hebreuOuGrec && (squeletteSansChet(X.squelettes[i]!) === squeletteSansChet(Y.squelettes[j]!) || pliIndien(x) === pliIndien(y))));
          if (equivalent) v = Math.max(v, CREDIT_ROMANISATION);
          /* et les mêmes kana valent un squelette égal (voir CREDIT_KANA) */
          if (pliJ) v = Math.max(v, CREDIT_KANA);
          /* et la même suite cyrillique aussi (voir CREDIT_CYRILLIQUE) */
          if (pliS) v = Math.max(v, CREDIT_CYRILLIQUE);
          /* et les mêmes lettres thaïes aussi (voir CREDIT_THAI) */
          if (pliT) v = Math.max(v, CREDIT_THAI);
          /* et la même syllabe birmane ou khmère (voir CREDIT_BIRMAN, CREDIT_KHMER) */
          if (pliB) v = Math.max(v, CREDIT_BIRMAN);
          if (pliK) v = Math.max(v, CREDIT_KHMER);
          /* et les mêmes lettres grecques aussi (voir CREDIT_GREC) */
          if (pliG) v = Math.max(v, CREDIT_GREC);
          /* et la même clé d'emprunt, d'une écriture qui prononce au latin (voir CREDIT_EMPRUNT) */
          if (emprunt !== "" && v < CREDIT_EMPRUNT && x !== y && !anglais && x.length >= 3 && y.length >= 3) {
            if (memeEmprunt(x, y, emprunt, 3, true)) { equivalent = true; v = CREDIT_EMPRUNT; }
          }
          /* L'ADJECTIF SLAVE DE LIEU : « Kubanskaya » et « Kurganskaya » se ressemblent à 0,82 par leur suffixe commun ;
             ce sont leurs radicaux qui nomment, Kuban et Kurgan, deux lieux à deux lettres près (voir `radicalSlave`).
             Sous la marque, deux mots au même suffixe et de radicaux différents valent leurs radicaux seuls ; sauf quand
             le squelette les égale déjà (0,95 : « Zhurbinskiy », « Jourbinski » à la française, mesuré le 28/09 sur le
             jeu 8, deux vrais noms perdus sans cette réserve) */
          if (slave && !equivalent && v < 0.95 && x !== y) {
            const rx = radicalSlave(x), ry = radicalSlave(y);
            if (rx !== undefined && ry !== undefined && rx.suffixe === ry.suffixe && rx.radical !== ry.radical) {
              v = Math.min(v, simMot(rx.radical, ry.radical, squelette(rx.radical), squelette(ry.radical), voyellesLibres, !navire));
            }
          }
          /* les voyelles du coréen sous deux systèmes (« Cheonghae », « Chunghae » ; « Hanseong », « Hansung ») : le crédit
             de la voyelle d'appui (voir `pliVoyellesCoreennes`) ; l'index les retrouve par `pliCoreen`, que ce pli implique */
          if (coreen && x !== y && !anglais && pliVoyellesCoreennes(x) === pliVoyellesCoreennes(y)) { equivalent = true; v = Math.max(v, CREDIT_APPUI); }
          /* la voyelle d'appui (« Bahr », « Bahar ») ne change pas le mot arabe, quand une voyelle
             substituée peut en faire un autre : son crédit est au-dessus (CREDIT_APPUI) */
          if (arabe && x !== y && !anglais && voyelleEpenthetique(X.squelettes[i]!, Y.squelettes[j]!)) v = Math.max(v, CREDIT_APPUI);
          /* et la voyelle brève sautée sous le squelette arabe (« Mheiri », « Muhairi » ; « Brahim », « Ibrahim ») ne le change pas
             davantage : le même crédit, au-dessus de la variation d'une voyelle (jeu 14, 29/09 : « Tariq Al Muhairi Contracting »
             face à « Tarek El Mheiri Contracting » restait à 0,795 avec deux mots au crédit de romanisation) */
          if (arabe && latin && x !== y && !anglais && voyelleSauteeArabe(squeletteArabe(x), squeletteArabe(y))) v = Math.max(v, CREDIT_APPUI);
          /* les mêmes consonnes qu'un mot venu d'un abjad : ce côté n'a jamais eu de voyelles à
             comparer, c'est l'égalité de squelette de son écriture (« بحر » bhr et « Bahr »,
             « הנגב » hngb et « HaNegev »). Mesuré le 27/09 sur les paires des jeux 6 et 8 : au
             crédit de 0,85, « بحر الذهب » restait à 0,744, « سپیددشت » à 0,787 et « שחר הגליל » à
             0,700, sous le possible, chaque mot du nom propre n'apportant que 0,7 */
          if (abjad !== "" && x !== y && !anglais) {
            const kx = cleAbjad(x, abjad), ky = cleAbjad(y, abjad);
            /* et la ta marbuta (ة), « -at » en annexion d'un côté, « -a » de l'autre (« Zahrat », « zahra ») */
            /* et le v d'un mot anglais que l'arabe écrit ف (« Silver », « سيلفر » silfr : voir `cleAbjadVLuF`) */
            const memes = (kx.length >= 3 && kx === ky) || (abjad === "arabe"
              && ((ky.length >= 3 && cleAbjadSansTa(x) === ky) || (kx.length >= 3 && cleAbjadSansTa(y) === kx)
                || (ky.length >= 3 && cleAbjadVLuF(x) === ky) || (kx.length >= 3 && cleAbjadVLuF(y) === kx)));
            /* et la CLÉ COURTE d'un mot de moins de trois consonnes (« Ben », « Ami », « Bay », « Tzur », « Khoury », « Yazd »,
               « Haddad ») : les mêmes consonnes ET les mêmes voyelles longues, celles que l'abjad écrit (voir `cleAbjadVoyelles`),
               deux lettres au moins (tour 17, jeu 21 : « Tzur Amitai Logistics » restait à 0,313 face à צור אמיתי לוגיסטיקה, ses deux
               noms de deux consonnes sans crédit) ; l'index range et cherche la même clé (cribler.ts) */
            const courte = !memes && kx.length >= 1 && kx.length < 3 && kx === ky
              && cleAbjadVoyelles(x, abjad).length >= 2 && cleAbjadVoyelles(x, abjad) === cleAbjadVoyelles(y, abjad);
            if (memes || courte) { equivalent = true; v = Math.max(v, CREDIT_ABJAD); }
          }
          /* la voyelle longue ī écrite ee ou i : le même mot au squelette près (« Naseem », « Nasim » ;
             « Waleed », « Walid »), sous les marques arabe et indienne, et il vaut un squelette égal
             (0,95), pas une variation (jeu 9, 27/09 : « Naseem Al Bahar » et « Nasim Al Bahr », deux mots
             au crédit de 0,85, restaient à 0,715) */
          if (v < 0.95 && (arabe || indien) && x !== y && !anglais && (x.includes("ee") || y.includes("ee"))
            && squeletteLongue(x) === squeletteLongue(y)) { equivalent = true; v = 0.95; }
          /* et la diphtongue ai du sous-continent lue e (« Qureshi », « Quraishi » ; « Shaikh », « Shekh ») : la même voyelle en ourdou
             et en hindi, sous les mêmes marques, le même squelette égal (voir `pliAi`) */
          if (v < 0.95 && (arabe || indien) && x !== y && !anglais && (pliAi(x) !== x || pliAi(y) !== y)
            && squeletteLongue(pliAi(x)) === squeletteLongue(pliAi(y))) { equivalent = true; v = 0.95; }
          /* et sous la marque arabe, o et u sont une lettre, le پ persan un ف (voir `squeletteArabe`) : « Nour », « Noor » ; « Kohsar »,
             « Koohsar » ; « Sepid », « Sefid » ; un squelette égal (0,95), pas la variation d'une voyelle (jeu 13, 28/09) */
          /* les plis des conventions latines (ou et w, aw et o, ei et ai, le c dur, la finale -eh) ne valent qu'entre deux mots latins :
             un côté lu dans une écriture native a sa clé de consonnes (voir `latin`) */
          if (v < 0.95 && arabe && x !== y && !anglais && squeletteArabe(x, true, latin) === squeletteArabe(y, true, latin)) { equivalent = true; v = 0.95; }
          /* et l'article maghrébin réduit à son l et collé (« Lamine », « al-Amin » ou « Amine ») : le même squelette arabe derrière
             le l, un squelette égal (voir `articleReduit`) */
          if (v < 0.95 && arabe && latin && !anglais && (articleReduit(x, y) || articleReduit(y, x))) { equivalent = true; v = 0.95; }
          /* sous la marque japonaise, le mot augmenté d'un suffixe d'établissement (« Tekkō », « Tekkōsho ») est une autre
             raison sociale : ni abréviation sans point, ni mot coupé, ni mot abrégé (voir `suffixeEtablissement`) */
          /* et sous la marque slave, le mot augmenté d'une queue de composé (« Elevator », « Elevatorstroy » ; « Agro »,
             « Agroprom ») : une autre société, comme la holding face à la société qui exploite (voir `queueDeComposeSlave`
             et QUALIFICATIFS_SOUDES) ; la paire se range au possible */
          const composeSlave = slave && (queueDeComposeSlave(x, y) || queueDeComposeSlave(y, x));
          const etablissement = (japonais && (suffixeEtablissement(x, y) || suffixeEtablissement(y, x))) || composeSlave;
          /* LE PLURIEL TURC (« Kaptan », « Kaptanlar » ; « Martı », « Martılar ») est un autre nom, et aucun crédit de début
             de mot ne le relit : ni l'abréviation sans point, ni l'abréviation d'usage, ni le dernier mot coupé (voir `plurielTurc`) */
          const turc = plurielTurc(x, y) || plurielTurc(y, x);
          if (turc) { v = Math.min(v, 0.5); equivalent = false; }
          /* DEUX PATRONYMES NORDIQUES DIFFÉRENTS (« Rasmussen », « Rasmusson » ; « Pedersen », « Petersen ») sont deux familles
             sous la marque nordique (voir `patronymesDistincts`) */
          if (nordique && patronymesDistincts(x, y)) { v = Math.min(v, 0.5); equivalent = false; }
          const autreNom = etablissement || turc;
          /* dans un export tout en majuscules, un mot court qu'aucun dictionnaire ne connaît et
             qui commence un mot long de l'autre nom est une abréviation sans point (« HVY IND ») */
          /* jamais sous la marque navire : une syllabe qui en commence une autre y est un autre navire (« KARA MARTI », « KARA MARTILAR », jeu 12) */
          if (v < 0.9 && !autreNom && !navire && ((X.marques.majuscules && x.length >= 2 && x.length <= 9 && y.length >= x.length + 3 && y.length >= 6 && y.startsWith(x) && !lemme(x))
            || (Y.marques.majuscules && y.length >= 2 && y.length <= 9 && x.length >= y.length + 3 && x.length >= 6 && x.startsWith(y) && !lemme(y)))) v = 0.9;
          /* un mot abrégé d'un point correspond au mot entier qu'il commence, ou dont il garde
             les lettres dans l'ordre depuis l'initiale (« Petrochem. », « Dist. », « Capt. ») ;
             dans les DEUX sens, sinon le côté entier ne rendait qu'un demi-crédit */
          /* un mot d'au moins quatre lettres qu'aucun dictionnaire ne connaît et qui COMMENCE un mot
             de l'autre nom plus long d'au moins trois lettres est une abréviation d'usage, sans point
             ni majuscules (« Agri Supplies » pour Agricultural Supplies) : un crédit partiel, celui
             d'une romanisation, pas celui d'un mot égal. Hors des noms chinois, coréens et japonais,
             où une syllabe qui en commence une autre est un autre mot (Hua, Huaxin) */
          /* et sous la marque nordique, seulement si ce qui suit est un générique du commerce : « Spannmåls » commence
             « Spannmålsexport », « Brøndby » ne commence pas « Brøndbyvester », c'est un autre lieu (voir `queueGenerique`) */
          /* et sous le style d'un nom qui tronque (voir `styleTronque`), un mot que le dictionnaire connaît aussi : « Chart » pour
             Chartering, « Consol » pour Consolidators, à côté de « Brok » et de « Log » */
          if (v < CREDIT_ROMANISATION && !chinois && !coreen && !japonais && !navire && !autreNom
            && ((x.length >= 4 && y.length >= x.length + 3 && y.startsWith(x) && (!lemme(x) || styleX) && (!nordique || queueGenerique(y, x)))
              || (y.length >= 4 && x.length >= y.length + 3 && x.startsWith(y) && (!lemme(y) || styleY) && (!nordique || queueGenerique(x, y))))) v = CREDIT_ROMANISATION;
          /* LES COMPOSÉS allemands et néerlandais : le nom déterminé ferme le mot (« Stahlrohr » est un Rohr,
             « Textilmaschinen » des machines textiles, « Metaalhandel » le commerce du métal), et le nom d'usage
             garde l'un des deux membres (« Rheinstahl Rohr », « Hoffmann Textil », « De Groot Machines », jeu 10).
             Sous la marque, un mot qui commence ou finit par un mot de l'autre nom vaut le crédit d'une
             romanisation, dans les deux sens (voir `compose`) */
          if (v < CREDIT_ROMANISATION && germanique && (compose(x, y) || compose(y, x))) v = CREDIT_ROMANISATION;
          /* LE MOT DE TROIS LETTRES D'UN CLAVARDAGE : « exp » pour Exports, « imp », « gen », « eng », tapés au pouce et pas en
             dernier mot (là, `tronque` les lit déjà). Sous la marque chat, trois lettres qu'aucun dictionnaire ne connaît, qui ne
             font pas une syllabe chinoise (« xin » n'est pas Xinhai) et qui commencent un mot ANGLAIS de l'autre nom d'au moins six
             lettres : le crédit d'une abréviation d'usage (jeu 13, tour 9 : « sanghvi diamnd exp mumbai » à 0,562 face à
             « Sanghvi Diamond Exports, Mumbai », « exp » et « exports » orphelins de part et d'autre). Un mot du dictionnaire
             seulement : on abrège un mot de la langue, pas un patronyme (« Eze » n'est pas « Ezenwa » tapé court : jeu 13,
             deux destinataires différents montés à 0,800 quand la règle valait pour tout mot) */
          if (v < CREDIT_ROMANISATION && chat && !chinois && !coreen && !japonais && !navire && !autreNom
            && ((x.length === 3 && y.length >= 6 && y.startsWith(x) && !DICTIONNAIRE.has(x) && !estSyllabeIsolee(x) && !PARTICULES.has(x) && lemme(y) !== undefined)
              || (y.length === 3 && x.length >= 6 && x.startsWith(y) && !DICTIONNAIRE.has(y) && !estSyllabeIsolee(y) && !PARTICULES.has(y) && lemme(x) !== undefined))) v = CREDIT_ROMANISATION;
          /* LA FAUTE D'UN CLAVARDAGE : sous la marque chat, un mot que le dictionnaire connaît face à un
             mot qu'il ne connaît pas, à UNE lettre près hors l'initiale (substituée, tombée, doublée,
             inversée), est la faute d'un pouce ou le correcteur d'un téléphone qui a fait un mot anglais
             d'un nom (« Kim Send » pour Kim Seng, jeu 9, 27/09 : 0,720), pas deux mots. Deux mots que le
             dictionnaire connaît restent deux mots (Marlin, Merlin ; Rail, Mail), deux qu'il ignore restent
             ambigus (Phuong, Phong) ; l'initiale reste l'initiale (Qadir, Nadir) ; et deux syllabes isolées
             sont deux syllabes, marque chinoise ou pas (Heng, Hong : mesuré le 27/09 sur le jeu 9, « Chin
             Heng Trading » et « Chin Hong Trading » montaient à 0,919 sur la variante sans leurs
             sinogrammes). Mesuré sur les neuf jeux : aucun piège ne monte. Ni deux mots espagnols ou
             portugais du vocabulaire des raisons sociales (Faro, Foro ; Manzana, Manzano : le dictionnaire
             anglais n'en connaît qu'un, voir `motsHispaniquesDistincts`) */
          if (v < 0.9 && chat && !chinois && !coreen && !japonais && x.length >= 4 && y.length >= 4 && x[0] === y[0]
            && !(estSyllabeIsolee(x) && estSyllabeIsolee(y)) && !motsHispaniquesDistincts(x, y)
            && (lemme(x) === undefined) !== (lemme(y) === undefined) && distanceOsa(x, y) === 1) v = 0.9;
          /* L'HOMOPHONE D'UN CLAVARDAGE : sous la marque chat, le mot du commerce que l'autre nom attendait, écrit par le correcteur d'un
             téléphone en un mot anglais qui s'entend pareil (« Steal » pour Steel, « Hardwear » pour Hardware) : le crédit de la faute
             d'un clavardage, jamais entre deux mots qui ne sont pas du commerce (« Cypress », « Cyprus » : voir `homophoneCorrige`) */
          if (v < 0.9 && chat && !chinois && !coreen && !japonais && (homophoneCorrige(x, y) || homophoneCorrige(y, x))) v = 0.9;
          /* LE PLURIEL D'UN CLAVARDAGE : sous la marque chat, sans forme juridique d'aucun côté, un mot du
             dictionnaire et son pluriel sont un mot, le correcteur du téléphone ôtant ou ajoutant le s
             (« Chukwuemeka Stores », « Chukwuemeka Store », jeu 10). Dès qu'un côté porte une forme, le
             pluriel est l'orthographe déposée au registre, et « Provisions Store » n'est pas « Provisions
             Stores Limited » (jeu 10, 27/09, deux boutiques) ; un navire non plus (voir `simMot`) */
          if (v <= 0.5 && chat && sansForme && !navire && (formePlurielle(x, y) || formePlurielle(y, x))
            && DICTIONNAIRE.has(x.length < y.length ? x : y)) v = 0.9;
          if (v < 0.9 && !autreNom && X.abreges[i] && x.length < y.length && (y.startsWith(x) || abrege(x, y))) v = 0.9;
          if (v < 0.9 && !autreNom && Y.abreges[j] && y.length < x.length && (x.startsWith(y) || abrege(y, x))) v = 0.9;
          /* l'abréviation ALLEMANDE, syllabique, l'umlaut écrit ue (« Sueddt. » pour Süddeutsche : voir `abregeAllemand`) */
          if (v < 0.9 && !autreNom && germanique && X.abreges[i] && x.length < y.length && abregeAllemand(x, y)) v = 0.9;
          if (v < 0.9 && !autreNom && germanique && Y.abreges[j] && y.length < x.length && abregeAllemand(y, x)) v = 0.9;
          if (v < 0.9 && !autreNom && dernierX && tronque(x, y)) v = 0.9;
          if (v < 0.9 && !autreNom && dernierY && tronque(y, x)) v = 0.9;
          /* deux lectures de sinogrammes différents sont des homophones (« 新海 », « 鑫海 » : xinhai
             tous deux), et un homophone est un autre mot */
          if (nx !== "" && ny !== "" && nx !== ny) v = Math.min(v, 0.5);
          memo?.set(cle, equivalent ? v + 2 : v);
        }
        /* le mot corrigé par un téléphone (voir `motAutocorrige`) : hors du cache des mots, dont la clé ne porte pas le reste du nom */
        if (v < 0.9 && autocorrige !== undefined && ((x === autocorrige[0] && y === autocorrige[1]) || (x === autocorrige[1] && y === autocorrige[0]))) { v = 0.9; equivalent = false; }
        /* DEUX MOTS DE MÉTIER JAPONAIS DIFFÉRENTS traduits au même mot anglais, ou à deux mots voisins (« Bōeki » et
           « Shōji », trading tous deux ; « Kōgyō » et « Sangyō », industry ; « Tekkō » et « Tekkōsho », steel et
           steelworks) : au registre japonais ce sont deux raisons sociales, et l'auteur des jeux les compte ainsi
           (jeu 11, 28/09 : « Yūki Bōeki K.K. » face à « Yūki Shōji K.K. » à 1,000, « Nambu Tekko » face à « Nambu
           Tekkosho » à 0,910 par le dernier mot coupé). Les deux sources se comparent sous le pli des romanisations,
           pour que « boueki » reste « boeki » ; hors du cache, dont la clé ne porte que les mots traduits */
        const sx = X.sources[i]!, sy = Y.sources[j]!;
        if (japonais && sx !== "" && sy !== "" && pliJaponais(sx) !== pliJaponais(sy)) { v = Math.min(v, 0.5); equivalent = false; }
        if (v > m) { m = v; meilleurY = j; equivalentM = equivalent; }
      }
      /* une civilité que l'autre nom écrit à part et que celui-ci SOUDE au mot suivant (« sripelangi »
         pour « Sri Pelangi »), ou l'inverse : le même mot, la civilité en plus (jeu 9, 27/09 : 0,529).
         Il faut que l'autre côté l'ait écrite : « Srinivas » n'est pas « Nivas » */
      if (m < 1) {
        const x = X.mots[i]!;
        for (const c of Y.civilites) {
          const k = x.startsWith(c) && x.length >= c.length + 4 ? Y.mots.indexOf(x.slice(c.length)) : -1;
          if (k >= 0) { m = 1; meilleurY = k; equivalentM = false; break; }
        }
        if (m < 1) for (const c of X.civilites) {
          const k = Y.mots.indexOf(c + x);
          if (k >= 0) { m = 1; meilleurY = k; equivalentM = false; break; }
        }
      }
      /* LE SIGLE D'UNE LOCUTION (voir `sigleDe`) : le sigle est de ce côté, et ses lettres sont les initiales de mots
         consécutifs de l'autre nom (« C&F » face à « Clearing and Forwarding ») ; ou de l'autre, et ce mot est l'un de
         ceux qu'il abrège. Hors du cache des mots, dont la clé ne porte pas les voisins */
      if (m < 0.9) {
        if (X.sigles[i]) {
          const j0 = sigleDe(X.mots[i]!, Y.mots, X.mots);
          if (j0 >= 0) { m = 0.9; meilleurY = j0; equivalentM = false; }
        }
        if (m < 0.9) for (let j = 0; j < Y.mots.length; j++) {
          if (!Y.sigles[j]) continue;
          const i0 = sigleDe(Y.mots[j]!, X.mots, Y.mots);
          if (i0 >= 0 && i >= i0 && i < i0 + Y.mots[j]!.length) { m = 0.9; meilleurY = j; equivalentM = false; break; }
        }
      }
      /* LE COMPOSÉ ET SON MEMBRE TRADUIT : « Holz-Handel » se prépare « holz trading » (le tiret coupe, la table traduit
         handel) quand « Holzhandel » reste un mot, que `compose` rapproche de « holz » seul ; « trading » restait orphelin
         (jeu 4, tour 10 : 0,680). Sous la marque germanique, un mot traduit dont la SOURCE ferme ou ouvre un composé de
         l'autre nom, l'autre membre du composé étant le voisin de ce mot-ci, est porté par ce composé, au crédit d'une
         romanisation. Hors du cache des mots, dont la clé ne porte pas les voisins */
      if (m < CREDIT_ROMANISATION && germanique && X.traduits[i] && X.sources[i] !== "") {
        const src = X.sources[i]!;
        const voisins = [X.mots[i - 1], X.mots[i + 1]].filter((w): w is string => w !== undefined && w.length >= 4);
        const k = Y.mots.findIndex((w) => w.length >= src.length + 4
          && ((w.endsWith(src) && voisins.includes(w.slice(0, -src.length))) || (w.startsWith(src) && voisins.includes(w.slice(src.length)))));
        if (k >= 0) { m = CREDIT_ROMANISATION; meilleurY = k; equivalentM = false; }
      }
      if (m < 0.8) { orphelins[cote] = true; orphelinsMots[cote].push(X.mots[i]!); }
      /* un mot géographique en tête (« Fujian Quanzhou Xingtai Shoes ») n'est pas un mot en
         trop : la province se dit ou s'omet pour la même société chinoise */
      /* un mot de pays ou de région du monde est distinctif quel que soit son poids : « UK Limited »
         n'est pas « Limited » */
      /* ni un mot que les tables ont traduit quand il OUVRE le nom : dans l'ordre roman, les mots d'activité
         précèdent le nom propre (« Comercial Pereira e Filhos », « Exportação de Café de Huambo »), et le nom
         d'usage les omet (jeu 10 : plafonnés à 0,800 par l'IDF du mot traduit). En queue, le même mot traduit
         dit une société sœur (« Северный Янтарь Логистик », jeu 8), et plafonne comme tout orphelin rare ;
         ni l'adjectif régional d'un registre au plancher (voir `regionsAuPlancher`) */
      if (m < 0.8 && (X.poids[i]! >= SEUIL_RARE * X.poidsMax || PAYS_MOTS.has(X.mots[i]!)) && !(i <= 1 && REGIONS.has(X.mots[i]!))
        && !(X.traduits[i] && i < descripteurX) && !X.decor[i]) orphelinRare = true;
      /* un mot équivalent par sa romanisation n'est pas ambigu */
      /* ni une particule : « del » aligné sur « de » n'est pas un mot court ambigu, c'est une
         particule sautée (« Compañía Naviera del Golfo » contre « … Naviera Golfo », 27/09) ;
         et la signature d'une faute de frappe (`fauteDeFrappe` : deux lettres inversées, une lettre
         tombée) lève le plafond, hors du chinois et du coréen, où une lettre de plus ou de moins est
         une autre syllabe (Xin, Xing) */
      /* ni, sous la marque nordique, la seule lettre tombée : elle y est un morphème, un autre lieu ou une autre famille
         (« Nordvik », « Norvik » ; « Nielsen », « Nilsen » : jeu 12, 27/09, 0,857), et le plafond tient ; deux lettres inversées
         (« Nordhvan » pour Nordhavn, un vrai nom du même jeu perdu quand toute la signature se fermait) ou une lettre doublée
         restent la faute d'un clavier (voir `lettreTombee`) */
      /* et sous la marque japonaise, jusqu'à dix lettres : deux mots romanisés que `pliJaponais` n'égale pas et qui
         diffèrent d'une syllabe sont deux mots (« Shirakaba », « Shirakawa » : le bouleau et la rivière ; jeu 11,
         28/09 : 0,889, une fausse alerte forte hors de portée du plafond à huit lettres) */
      /* et un mot que le dictionnaire connaît, augmenté d'UNE lettre finale qu'il ne connaît plus (« Amber », « Amberg » : jeu 12,
         27/09, 0,890 puis 0,817 sans la coupe), est ambigu comme deux mots inconnus : aucun suffixe anglais ne tient en une
         lettre hors le s du pluriel, qui a sa règle ; c'est un autre mot (la ville d'Amberg) autant qu'une faute (voir `lettreAjoutee`) */
      const ambiguJusqua = japonais ? 10 : 8;
      const inconnus = (!lemme(X.mots[i]!) && !lemme(Y.mots[meilleurY >= 0 ? meilleurY : 0]!)) || (meilleurY >= 0 && lettreAjoutee(X.mots[i]!, Y.mots[meilleurY]!));
      if (m > 0.5 && m < 0.9 && !equivalentM && meilleurY >= 0 && X.mots[i]!.length <= ambiguJusqua && Y.mots[meilleurY]!.length <= ambiguJusqua
        && inconnus && !PARTICULES.has(X.mots[i]!) && !PARTICULES.has(Y.mots[meilleurY]!)
        && (chinois || coreen || (nordique && lettreTombee(X.mots[i]!, Y.mots[meilleurY]!)) || !fauteDeFrappe(X.mots[i]!, Y.mots[meilleurY]!))) motAmbigu = true;
      /* LA LETTRE CHANGÉE D'UN NAVIRE (voir `lettreChangee`) : sous la marque navire, deux mots écrits à UNE lettre près, qu'aucune
         marque n'explique, sont deux coques, comme le pluriel et le numéro le sont déjà (« MT Forcados Wind », « MT Forcardos Wind » :
         jeu 10, tour 12, 0,889, une fausse alerte forte que la signature d'une lettre tombée levait). Le plafond du mot ambigu tient
         alors quelle que soit la longueur du mot, qu'il soit ou non du dictionnaire, et quoi que dise la signature d'une faute de
         frappe. Restent des fautes, hors de la règle : la lettre-jalon d'une lecture optique (« KEMUN1NG », « CHIRIQU? » : `simMot`
         vaut 1), une équivalence de romanisation (`equivalentM` : les plis arabe, slave, indien ; « Nakhoda », « Nakhuda »), et le
         crédit de la faute d'un clavardage (0,9 exactement, au-dessus du chemin de la distance : « Halyard », « Halyaro » ; « Pride »,
         « Prode » ; « Bahr », « Bahar », trois vrais navires des jeux 5, 8 et 15 pour une seule autre coque, « Esperança », « Esperancé »,
         mesuré au tour 12). Le prix, dit : « M/V Tarnhelm Star » face à « M/V Tarnhem Star » (jeu 8), une lettre tombée que son auteur
         tient pour une faute, redescend au possible */
      /* Et le e final que le squelette tait (« Real », « Reale » : jeu 16, tour 12, 0,955 par deux squelettes égaux) : un mot du
         dictionnaire suivi d'UNE lettre qu'il ne connaît plus est ambigu (voir `lettreAjoutee`, « Park », « Parke »), et le squelette
         égal ne le sauve pas sous la marque navire. Deux mots inconnus au même squelette restent un mot (« Zolotaya », « Zolotaja » ;
         « Cheonji », « Chonji » : deux vrais navires du jeu 8 sans marque slave ni coréenne, perdus quand tout squelette égal comptait) */
      if (navire && meilleurY >= 0 && m > 0.5 && m < 1 && !equivalentM && !PARTICULES.has(X.mots[i]!) && !PARTICULES.has(Y.mots[meilleurY]!)
        && lettreChangee(X.mots[i]!, Y.mots[meilleurY]!)
        && (m < 0.9 || (X.squelettes[i] === Y.squelettes[meilleurY] && lettreAjoutee(X.mots[i]!, Y.mots[meilleurY]!)))) motAmbigu = true;
      if (m >= 0.9 && X.poids[i]! >= 0.5 * X.poidsMax) rareCouvert[cote] = true;
      if (X.parentheses[i]) { parenthese[cote] = true; if (m >= 0.8) parentheseReconnue[cote] = true; }
      if (Y.mots.some((y) => qualificatifSoude(X.mots[i]!, y, Y.mots))) qualificatifSoudeVu = true;
      /* la queue d'un composé slave (« Elevatorstroy » face à « Elevator ») range la paire au possible, comme le
         qualificatif soudé ; hors du cache des mots, qui ne porte pas ce drapeau */
      if (slave && Y.mots.some((y) => queueDeComposeSlave(X.mots[i]!, y) || queueDeComposeSlave(y, X.mots[i]!))) qualificatifSoudeVu = true;
      s += X.poids[i]! * apport(m);
    }
    return s;
  };
  const cA = cote(A, B, 0);
  /* SORTIE ANTICIPÉE : le côté B parfait, la contenance parfaite, le bloc à son maximum ;
     si même cela n'atteint pas ce que le criblage demande, inutile d'aller plus loin */
  if (options.auMoins !== undefined) {
    const plafond = Math.max((cA + B.total) / (A.total + B.total), FACTEUR_CONTENANCE,
      A.mots.length !== B.mots.length ? 1 : 0);
    if (plafond < options.auMoins) return 0;
  }
  const cB = cote(B, A, 1);
  if (nomCommercial !== undefined) {
    const depose = nomCommercial === 0 ? 1 : 0;
    if ([A, B][nomCommercial]!.mots.length >= 2 && orphelinsMots[nomCommercial]!.length === 0 && orphelinsMots[depose].length > 0
      && orphelinsMots[depose].every((w) => PAYS_MOTS.has(w) || QUALIFICATIFS_DE_REGISTRE.has(w))) orphelinRare = false;
  }
  let s = (cA + cB) / (A.total + B.total);
  /* UN MOT ORPHELIN DE CHAQUE CÔTÉ (« Logistics » contre « Engineering », « Nigeria » contre
     « Ghana ») : les deux noms ont chacun ce que l'autre n'a pas, c'est la signature d'une
     société sœur, pas d'une graphie. Un mot en trop d'un seul côté (un nom abrégé, un nom
     coupé) ne déclenche rien. */
  if (orphelins[0] && orphelins[1]) s *= 0.9;
  if (orphelinRare || motAmbigu) s = Math.min(s, FACTEUR_CONTENANCE);
  /* le bloc ne joue pas quand l'écart de longueur des deux blocs est exactement un mot sans
     répondant : ce n'est pas une soudure, c'est un mot en plus (« Ingredients UK Limited »
     contre « Ingredients Limited », mesuré le 27/09) */
  const ecart = Math.abs(A.bloc.length - B.bloc.length);
  /* une particule sautée n'est pas un mot en plus : « khalfan muhannadi autoparts » face à « Khalfan Al Muhannadi Auto Parts »
     (jeu 14, 29/09 : 0,542, le bloc fermé par « al », deux lettres, l'écart exact des deux blocs) */
  const motEnPlus = ecart > 0 && (A.bloc.length > B.bloc.length ? orphelinsMots[0] : orphelinsMots[1]).some((w) => w.length === ecart && !PARTICULES.has(w));
  /* la première lettre compte double ici aussi (mesuré le 27/09 : « Eliron Logistics »
     contre « Oboronlogistics » passait à 0,80 sans elle). Sous BLOC_MIN, le bloc ne compte
     pas : deux chaînes qui diffèrent d'un cinquième ne sont pas les mêmes mots autrement
     coupés, et c'est cette borne qui permet à l'index de ne comparer que les blocs proches */
  /* une soudure ou une coupure de mots ne change pas les lettres : deux blocs qui diffèrent de
     plus de deux caractères en longueur ont un MOT de plus d'un côté, pas une espace (mesuré le
     27/09 : « …Thanh Dat » et « …Thanh Dat Phat » passaient à 0,824 par le bloc) */
  const similitude = (a: string, b: string) => {
    const L = Math.max(a.length, b.length);
    if (Math.abs(a.length - b.length) > 2) return 0;
    return 1 - (distanceOsa(a, b) + (a[0] === b[0] ? 0 : 1)) / L;
  };
  /* et une recoupure déplace des espaces, pas des lettres : les mots restés sans répondant d'un côté, collés, doivent être
     ceux de l'autre côté collés, à la tolérance du bloc près. « Petro Link » reste « Petrolink », « Spannmåls Export »
     « Spannmålsexport » ; « Gemi Kiral Ama » (une ligne SWIFT coupée dans Kiralama) n'est pas « Gemi Kurtarma » (jeu 12,
     27/09 : 0,857 par le bloc, quatre éditions d'un mot diluées dans vingt-huit lettres) */
  /* Sous les marques qui regroupent des syllabes ou romanisent (chinois, cantonais, japonais, coréen, arabe, hébreu, indien,
     tamoul, indonésien et malais, un côté lu dans des sinogrammes, une forme de Singapour où les noms hokkien et teochew
     s'écrivent en syllabes), le bloc garde son droit : « Kuang Yu » est « Guangyu », « Soon Heng » est « Shun Hing »,
     « Tek Leong » est « Delong » (treize vrais noms perdus quand la règle valait partout, mesuré le 27/09 sur les jeux 3, 5,
     7 et 9). Ailleurs, les lettres sont des lettres */
  const syllabes = voyellesLibres || cantonais || japonais || tamoul || thai || birman || khmer || indonesien || A.marques.natifs.size > 0 || B.marques.natifs.size > 0
    || A.marques.pays.includes("SG") || B.marques.pays.includes("SG");
  const oA = orphelinsMots[0].join(""), oB = orphelinsMots[1].join("");
  const memesLettres = syllabes || oA === "" || oB === ""
    || similitude(oA, oB) >= BLOC_MIN || similitude(orphelinsMots[0].map(squelette).join(""), orphelinsMots[1].map(squelette).join("")) >= BLOC_MIN;
  if (A.mots.length !== B.mots.length && !motEnPlus && memesLettres) {
    /* et sous la marque thaïe, les deux blocs sous le pli des graphies (« Charoen Sap Nawi » face à « Jaroensub Navee » : tour 18, jeu 22, 0,360,
       cinq lettres sur quatorze quand le pli n'en laisse qu'une) */
    const meilleur = Math.max(similitude(A.bloc, B.bloc), Math.min(0.95, similitude(A.blocSq, B.blocSq)),
      thai ? Math.min(0.95, similitude(pliThai(A.bloc), pliThai(B.bloc))) : 0);
    /* UNE SOUDURE ET UNE LETTRE CHANGÉE SONT DEUX GESTES : sur un bloc de BLOC_COURT lettres au plus, un bloc qui n'est pas exact
       ne dépasse pas le niveau des plafonds. « Petrolink » reste « Petro Link » (1,000) ; « Astral » n'est plus « AZ Ural » ni
       « Yangtze » « Yang Su » au niveau fort (0,833 tous deux le 04/10/2026, sur un vrai pétrolier criblé contre un alias faible
       de l'OFAC et un nom de la liste ITAR) : ils restent à relire. Les marques qui regroupent des syllabes gardent leur droit,
       comme plus haut. Mesuré sur l'apprentissage : un vrai nom de moins au fort sur 4 170 (3 816), aucun sur l'échantillon
       GLEIF ; sans borne de longueur, seize de moins pour une fausse alerte de moins. */
    const borne = meilleur < 1 && !syllabes && Math.max(A.bloc.length, B.bloc.length) <= BLOC_COURT ? Math.min(meilleur, FACTEUR_CONTENANCE) : meilleur;
    if (meilleur >= BLOC_MIN) s = Math.max(s, borne);
  }
  /* ET LE BLOC SOUS LA CLÉ D'EMPRUNT : une écriture qui prononce soude souvent le nom en un mot (« 삼성디스플레이 » : samseongdiseupeullei,
     « มาร์เก็ตเอนี่แวร์ » : maketeniwae) que le nom latin écrit en deux (« Samsung Display », « Market Anyware ») ; les deux blocs sous la
     même clé, de cinq consonnes au moins, valent la clé d'un mot (voir `clesEmprunt` ; registre GLEIF, 30/09/2026). Comme le bloc, seulement
     quand le nombre de mots diffère : à nombre égal, les mots se comparent un à un */
  if (emprunt !== "" && A.mots.length !== B.mots.length) {
    if (memeEmprunt(A.bloc, B.bloc, emprunt, 5)) s = Math.max(s, CREDIT_EMPRUNT);
  }
  /* LA CONTENANCE : un nom entier retrouvé DANS l'autre (« Quarrington Metals FZE » dans
     « Quarrington Metals FZE, Jebel Ali Free Zone, Dubai »). La question du criblage n'est pas
     « ces deux noms sont-ils égaux » mais « le nom listé est-il là ». Deux mots au moins, et un
     mot rare parmi ceux retrouvés : sinon « Global Trading » serait contenu partout. Plafonnée
     à FACTEUR_CONTENANCE : une contenance seule reste une alerte POSSIBLE, parce qu'une filiale
     (« Quarnby Logistics (Shanghai) ») contient aussi le nom de sa mère. */
  const contenance = Math.max(
    A.mots.length >= 2 && rareCouvert[0] ? cA / A.total : 0,
    B.mots.length >= 2 && rareCouvert[1] ? cB / B.total : 0);
  s = Math.max(s, FACTEUR_CONTENANCE * contenance);
  /* une parenthèse à laquelle l'autre nom ne répond par aucun mot : une filiale, pas une
     graphie ; comme un conflit de marques, elle abaisse (× 0,8) sans annuler */
  const filiale = (parenthese[0] && !parentheseReconnue[0]) || (parenthese[1] && !parentheseReconnue[1]);
  /* un numéro d'un seul côté, des marques en conflit, une filiale, un qualificatif de groupe
     soudé : la méthode a une raison précise de douter, et le candidat se range au niveau
     POSSIBLE, quelle que soit la ressemblance des mots ; il n'est pas effacé (un groupe ouvre
     des homonymes ailleurs) */
  /* les deux raisons sociales d'une société finlandaise (un générique finnois d'un côté, le suédois de l'autre : voir
     `raisonsBilingues`) : Oy et Ab y nomment la même société, et le seul conflit de pays ne plafonne pas ; les autres conflits
     (familles, désignations, succursales) gardent leur mot */
  const conflit = raisonsBilingues(A.sources, B.sources)
    ? marquesEnConflit({ ...A.marques, pays: [] }, { ...B.marques, pays: [] }) : marquesEnConflit(A.marques, B.marques);
  return A.numeros === B.numeros && !conflit && !filiale && !qualificatifSoudeVu
    ? s : Math.min(s, FACTEUR_CONTENANCE);
}

export const FACTEUR_CONTENANCE = 0.8;
/** L'article et la filiation arabes : le mot qui les suit est un mot arabe, quoi qu'en dise le dictionnaire anglais, qui connaît
 *  « amin » et « ameen » comme deux mots (voir `anglais` dans scorePrepares, et `apresArticleVu` dans l'index). */
export const ARTICLES_ARABES: ReadonlySet<string> = new Set(["al", "el", "ul", "bin", "bint", "ibn", "abu", "abou", "abd", "abdul", "abdel",
  "abdal", "umm", "dar", "bayt", "beit", "bani"]);
/** Un mot est RARE quand son poids atteint cette part du poids d'un mot inconnu des listes :
 *  « Shipping » (439 entrées sur 33 393) l'est tout juste, « Trading » (826) ne l'est pas. */
export const SEUIL_RARE = 0.45;
/** Le bloc (mots collés ou coupés) ne compte qu'à partir de cette similarité. */
export const BLOC_MIN = 0.8;
/** Un bloc COURT : à cette longueur ou moins, une lettre changée dans un nom soudé pèse un sixième du nom au moins. */
export const BLOC_COURT = 8;

/** Les qualificatifs de groupe qu'un nom SOUDE à son radical : « Agroholding », « Agroinvest »,
 *  « Uraltrade ». Écrit en un mot à part (« Dorreval Chemicals Holdings »), le qualificatif est
 *  un mot rare sans répondant, et le plafond des orphelins range déjà la paire au niveau
 *  possible ; soudé, il n'était plus un mot, et la règle du dernier mot coupé lisait le radical
 *  nu comme un début tronqué (mesuré le 27/09 : « Rakhmatullin Agroholding LLC » contre
 *  « Rakhmatullin Agro LLC » à 0,907, la holding face à la société qui exploite). */
const QUALIFICATIFS_SOUDES: ReadonlySet<string> = new Set(["holding", "holdings", "group", "invest", "trade", "export", "import", "industries"]);

/** Les QUALIFICATIFS qu'un registre ajoute au nom commercial en le déposant, avec le mot de pays et la forme :
 *  « Balogun Global Ventures » est déposé « Balogun Global Ventures Enterprises Limited », « Chukwu Petroleum
 *  Services » « … Services Integrated Limited », « Nwosu Farm Produce » « … Produce & Sons Limited » (jeu 10).
 *  Ils ne disent rien de plus que le nom commercial ; ce sont eux, et le pays, qu'un nom commercial sans
 *  forme a le droit de ne pas porter (voir `scorePrepares`). */
const QUALIFICATIFS_DE_REGISTRE: ReadonlySet<string> = new Set(["enterprise", "enterprises", "integrated", "venture", "ventures",
  "global", "international", "general", "sons", "brothers", "limited", "company", "co"]);
/* ni « Holdings » ni « Group » : la holding est une autre société que celle qui exploite (« Chelyabinsk Metal
   Works » face à « Chelyabinsk Metal Works Holdings JSC », jeu 7 ; voir aussi QUALIFICATIFS_SOUDES) */
/** Les membres génériques d'un composé allemand ou néerlandais : ce qui reste quand le nom d'usage a gardé
 *  l'autre membre (« Stahl » de Stahlrohr, « maschinen » de Textilmaschinen, « handel » de Metaalhandel). */
const GENERIQUES_COMPOSES: ReadonlySet<string> = new Set(["handel", "handels", "technik", "techniek", "maschinen", "maschine", "machines",
  "machine", "gesellschaft", "groep", "gruppe", "werk", "werke", "bau", "industrie", "stahl", "staal", "metall", "metaal", "chemie",
  "chemische", "agro", "expeditie", "overslag", "fabrik", "fabriek", "anlagen", "systeme", "service", "transport", "logistik",
  "logistiek", "vertrieb", "vertriebs", "produktion", "produkte", "materiaal", "materialen", "handelsgroep", "import", "export"]);
/** Les formes sous lesquelles `court` peut être un membre d'un composé : lui-même, et sans son pluriel
 *  (« machines » dans « Machinehandel »). L'index cherche sous les mêmes (voir cribler.ts). */
export function membres(court: string): string[] {
  const m = [court];
  if (court.endsWith("es")) m.push(court.slice(0, -2));
  if (court.endsWith("s")) m.push(court.slice(0, -1));
  return m;
}
/** `long` est-il un COMPOSÉ dont `court` (quatre lettres au moins, son pluriel ôté) est le premier ou le
 *  dernier membre ? Le reste est un générique connu, ou un membre d'au moins quatre lettres quand `court`
 *  n'est pas un mot anglais (« Logic » ne commence pas « Logistics » : voir l'abréviation d'usage). Ne vaut
 *  que sous la marque allemande ou néerlandaise (voir `scorePrepares`). */
export function compose(long: string, court: string): boolean {
  for (const c of membres(court)) {
    if (c.length < 4 || long.length < c.length + 3) continue;
    const reste = long.startsWith(c) ? long.slice(c.length) : long.endsWith(c) ? long.slice(0, long.length - c.length) : "";
    if (reste === "") continue;
    if (GENERIQUES_COMPOSES.has(reste) || (reste.length >= 4 && !lemme(court))) return true;
  }
  return false;
}
/** La QUEUE d'un composé nordique est un générique : « handel » de Kornhandel, « export » de Spannmålsexport, avec ou sans
 *  le s de liaison suédois ; « vester » de Brøndbyvester n'en est pas un, c'est un autre lieu (jeu 12, 27/09 : 0,850 par le
 *  crédit d'abréviation d'usage). Sous la marque nordique, le crédit du mot qui en commence un autre l'exige. */
export function queueGenerique(long: string, court: string): boolean {
  const q = long.slice(court.length), sansLiant = q.startsWith("s") ? q.slice(1) : q;
  return GENERIQUES_COMPOSES.has(q) || GENERIQUES_NORDIQUES.has(q) || GENERIQUES_COMPOSES.has(sansLiant) || GENERIQUES_NORDIQUES.has(sansLiant);
}
/** Deux COMPOSÉS À QUEUES DISTINCTES : la même tête (quatre lettres au moins) et deux queues d'au moins quatre lettres qui
 *  sont deux génériques différents (« Spannmålsexport », « Spannmålsimport » : export et import) ou deux mots anglais distincts
 *  (« Timberline », « Timberland » : line et land, que `composesDistincts` ne voyait pas parce que le dictionnaire connaît
 *  Timberland d'un bloc). La règle des composés dit qu'un composé est le même nom que son membre ; elle ne dit jamais que
 *  deux composés à queues différentes le sont (jeu 12, 27/09 : 0,867 et 0,842, deux fausses alertes fortes par la seule
 *  distance, les mots dépassant les huit lettres du plafond d'ambiguïté). Le geste d'une faute de frappe entre les deux
 *  queues reste une faute (« Silverline », « Silverlien » : voir `composesDistincts`). */
export function composesAQueuesDistinctes(a: string, b: string, voyellesLibres = true): boolean {
  if (a === b || a.length < 8 || b.length < 8 || a.slice(0, 4) !== b.slice(0, 4)) return false;
  const generique = (q: string) => GENERIQUES_COMPOSES.has(q) || GENERIQUES_NORDIQUES.has(q);
  for (let k = 4; k <= Math.min(a.length, b.length) - 4; k++) {
    if (a[k - 1] !== b[k - 1]) return false;
    const qa = a.slice(k), qb = b.slice(k);
    /* deux queues égales ne disent rien (« Tekhnoexport », « Technoexport » : la tête diffère, pas la queue) ; le geste
       d'une faute entre les deux queues reste une faute */
    if (qa === qb || gesteDeFrappe(qa, qb)) continue;
    if ((generique(qa) && generique(qb)) || motsDistincts(qa, qb, voyellesLibres)) return true;
  }
  return false;
}
/** LE MOT QU'UN TÉLÉPHONE A CORRIGÉ : les deux noms n'ont qu'un mot chacun que l'autre n'a pas, et ces deux mots sont deux mots
 *  du dictionnaire de même longueur qui ne diffèrent que par deux lettres inversées, le geste d'une faute de frappe (« Mian »,
 *  « Main » : jeu 14, « Mian Tufail Cutlery Works » à 0,796), quand un nom propre commun aux deux noms, que le dictionnaire
 *  ignore, ancre la paire (Tufail). Le dictionnaire dit que deux mots anglais à une lettre près sont deux mots (Marlin, Merlin :
 *  voir `motsDistincts`) ; deux lettres inversées dans un mot long sont déjà une faute entre deux mots du dictionnaire (voir
 *  `composesDistincts`), et ici c'est le reste du nom qui tient les deux mots ensemble. PAS LA SUBSTITUTION D'UNE LETTRE, même
 *  sous cette ancre : mesurée le 28/09 sur les quatorze jeux, elle gagnait sept vrais noms du jeu 14 (« Harrington Miming »,
 *  « Ibrahim Spare Parts », « Nkechi General Store », « Radcliffe Agri Experts », « Burj Al Rival »...) et levait six fausses
 *  alertes fortes de la même forme exacte dans les jeux plus anciens (« Cardow Paints », « Cardow Prints » ; « Pellmoor Timber
 *  Exports », « Pellmoor Timber Experts » ; « Kavrelli Wine », « Kavrelli Wire »...) : les jeux se contredisent sur cette forme,
 *  aucun mécanisme ne les sépare. Une lettre de plus ou de moins reste un autre mot (« Supplies », « Suppliers »). L'ancre
 *  n'est ni un numéro, ni un pays, ni une région, ni une syllabe isolée. Renvoie les deux mots dans l'ordre (A, B). */
export function motAutocorrige(A: NomPrepare, B: NomPrepare): readonly [string, string] | undefined {
  const seulsA = A.mots.filter((w) => !B.mots.includes(w)), seulsB = B.mots.filter((w) => !A.mots.includes(w));
  if (seulsA.length !== 1 || seulsB.length !== 1) return undefined;
  const x = seulsA[0]!, y = seulsB[0]!;
  if (x.length < 4 || x.length !== y.length || !gesteDeFrappe(x, y)) return undefined;
  if (lemme(x) === undefined || lemme(y) === undefined) return undefined;
  const ancre = A.mots.some((w) => w !== x && w.length >= 4 && B.mots.includes(w) && lemme(w) === undefined && !/\d/.test(w)
    && !PARTICULES.has(w) && !PAYS_MOTS.has(w) && !REGIONS.has(w) && !estSyllabeIsolee(w));
  return ancre ? [x, y] : undefined;
}
/** La longueur du DESCRIPTEUR qui ouvre un nom : la suite des mots traduits, des particules et des adjectifs
 *  régionaux avant le premier mot que les tables ne connaissent pas (« Comércio e Importação Ferreira » : deux ;
 *  « Ferreira Comércio » : zéro). */
export function descripteur(X: NomPrepare): number {
  let n = 0;
  while (n < X.mots.length && (X.traduits[n] || X.decor[n] || PARTICULES.has(X.mots[n]!))) n++;
  return n;
}
/** `X` avec ses adjectifs régionaux, et ses patronymes (tour 13), au plancher, si `Y` n'en porte aucun ; sinon `X` tel quel, sans la
 *  marque de décor (deux noms qui portent chacun un adjectif régional, ou chacun un patronyme, se distinguent par lui). */
function regionsAuPlancher(X: NomPrepare, Y: NomPrepare): NomPrepare {
  if (!X.decor.some(Boolean)) return X;
  if (Y.decor.some(Boolean)) return { ...X, decor: X.decor.map(() => false) };
  const poids = X.poids.map((p, i) => (X.decor[i] ? 1 : p));
  return { ...X, poids, total: poids.reduce((s, p) => s + p, 0) };
}

/** `colle` est-il `radical` suivi d'un qualificatif de groupe soudé, face à un nom (`autres`,
 *  les mots de l'autre côté) qui porte le radical nu et nulle part le qualificatif ? Trois
 *  lettres de radical au moins ; et « Agro Holding » en deux mots face à « Agroholding » n'est
 *  qu'une soudure, que le bloc lit. */
export function qualificatifSoude(colle: string, radical: string, autres: readonly string[]): boolean {
  if (radical.length < 3 || colle.length <= radical.length || !colle.startsWith(radical)) return false;
  const q = colle.slice(radical.length);
  if (!QUALIFICATIFS_SOUDES.has(q)) return false;
  return !autres.some((w) => w.length >= 4 && (w.startsWith(q) || q.startsWith(w)));
}

/**
 * Deux noms que leurs marques disent différents : des formes juridiques de pays DISJOINTS
 * (« GmbH » contre « Inc. »), de familles disjointes (« Limited » contre « S.A. de C.V. »), de
 * désignations distinctes d'un même registre (« Corp. » contre « Inc. »),
 * ou un navire (préfixe « M/V ») contre une société (forme juridique). Comme un numéro d'un seul côté, le conflit abaisse (× 0,8), il n'annule pas :
 * un groupe sanctionné ouvre des homonymes ailleurs, et le relecteur doit les voir.
 */
/** Un squelette sous la marque hébraïque ou grecque : le X (ch, sh) lu h, et le h final d'un mot de quatre lettres au moins ôté,
 *  parce que `squelette` ôte celui de « -ah » et garde le X de « -ach » (voir `scorePrepares`). */
function squeletteSansChet(sq: string): string {
  return sq.replace(/X/g, "h").replace(/(?<=.{3})h$/, "");
}
export function marquesEnConflit(a: Marques, b: Marques): boolean {
  if (a.pays.length && b.pays.length && !a.pays.some((p) => b.pays.includes(p))) return true;
  /* « X Pty Ltd » ou « X Sdn Bhd » face à « X Ltd » nu : la société privée et une autre
     société du même nom (la cotée, l'étrangère), quand les deux portent une forme */
  /* (sauf quand la forme d'un côté est écrite en chinois, 有限公司, qui ne dit pas le statut : voir `priveInconnu`) */
  if (a.prive !== b.prive && a.familles.length && b.familles.length && !a.priveInconnu && !b.priveInconnu) return true;
  if (a.familles.length && b.familles.length && !a.familles.some((p) => b.familles.includes(p))) return true;
  /* « X Corp. » face à « X Inc. » : deux désignations d'un même registre, deux dépôts (voir DESIGNATIONS) */
  if (a.designations.length && b.designations.length && !a.designations.some((d) => b.designations.includes(d))) return true;
  /* deux filiations (« Bint » face à « Ibn »), deux types de navire (« Tug » face à « Barge »), une succursale
     d'un seul côté (« X - Penang Branch » face à « X (Penang) ») : le possible, jamais le fort (jeu 9) */
  if (a.filiation && b.filiation && a.filiation !== b.filiation) return true;
  /* la filiation inversée : le fils de l'un est le père de l'autre (« Hakim Ben Youssef », « Youssef Ben Hakim », jeu 14) */
  if (a.filiationOrdre && b.filiationOrdre && a.filiationOrdre !== b.filiationOrdre && a.filiationOrdre === b.filiationOrdre.split(">").reverse().join(">")) return true;
  if (a.typeNavire && b.typeNavire && a.typeNavire !== b.typeNavire) return true;
  if (!succursalesCompatibles(a.succursale, b.succursale)) return true;
  return (a.navire && b.societe) || (b.navire && a.societe);
}

/** Deux mentions de succursale nomment-elles la même chose ? La même, oui ; une mention d'un seul côté,
 *  non ; le siège face à une succursale, non ; deux lieux différents, non ; une succursale dont le nom ne dit
 *  pas le lieu (« branch ») reste compatible avec un lieu, pas avec le siège (voir `mentionDeSuccursale`). */
export function succursalesCompatibles(a: string, b: string): boolean {
  if (a === b) return true;
  if (a === "" || b === "" || a === "siege" || b === "siege") return false;
  return a === "branch" || b === "branch";
}

/**
 * LE CHAMP DE 35 CARACTÈRES. Un message de paiement (SWIFT, champs « 35x ») coupe le nom du
 * bénéficiaire à 35 caractères, souvent au milieu d'un mot : « Beijing Zhongshang Dingsheng
 * Mechan ». Comparé au nom entier, le nom coupé perd tous les mots qui manquent. Quand un nom
 * a exactement cette longueur (34 si la coupe est tombée sur une espace) et que l'autre est
 * plus long, on le compare AUSSI au début de l'autre coupé à la même longueur, et on garde le
 * meilleur des deux scores.
 */
export const LONGUEUR_CHAMP = 35;
/** Les largeurs de champ qui coupent un nom : AIS (20), les systèmes à 25, 30, 40, 50 caractères,
 *  et SWIFT (35). Une coupe tombée sur une espace donne une lettre de moins. */
export const LONGUEURS_CHAMP: readonly number[] = [20, 25, 30, 35, 40, 50, 60];
export function estCoupe(brut: string): boolean {
  const n = brut.trim().length;
  return LONGUEURS_CHAMP.some((L) => n === L || n === L - 1);
}

/** `court` a-t-il l'air d'être le DÉBUT coupé de `long` ? La longueur ne suffit pas : un nom
 *  de 34 caractères n'est pas coupé pour autant (« Selvaggio Maritime Holdings I S.A. », mesuré
 *  le 27/09 : comparé au début de « … III S.A. », il perdait son numéro). Le début de l'autre
 *  doit être le même texte, à deux caractères près, casse et espaces mis à part. */
export function sembleCoupe(court: string, long: string): boolean {
  if (!estCoupe(court) || long.trim().length <= court.trim().length) return false;
  /* un champ coupe le texte TEL QUEL : le début du nom entier est le nom coupé, à la casse, aux
     accents et à la ponctuation près, sans autre écart (tolérer deux lettres prenait « Denki
     K.K. » pour « Denki S.A.S. » coupé à vingt, mesuré le 27/09) */
  const n = (x: string) => normaliser(plier(x)).replace(/\s+/g, " ").trim();
  const c = n(court), l = n(long);
  if (!l.startsWith(c) || l.length <= c.length) return false;
  /* la coupe tombe AU MILIEU d'un mot (un champ coupe sans regarder), et ce qui suit n'est
     pas un numéro : « Istrenna Venture II » n'est pas « Istrenna Venture III » coupé, ni
     « Kerrindale Express 3 » un « Kerrindale Express 30 » (mesuré le 27/09 sur le jeu 5) */
  const suite = l.slice(c.length);
  if (/^(?:\s*)(?:\d+|[ivx]+)(?![\p{L}])/u.test(suite)) return false;
  /* la coupe ne tombe pas DANS une forme juridique qui en commence une autre, ni dans le pluriel d'un
     mot du dictionnaire : « … d'Import-Export SA » (34 caractères) n'est pas « … SARL » coupé, ce sont deux
     sociétés ; « Patience Provisions Store » (25) n'est pas « … Stores Limited » coupé (jeu 10, 27/09 :
     deux fausses alertes à 1,000 par cette seule porte) */
  const dernierMot = c.split(" ").at(-1) ?? "";
  const reste = /^\p{L}+/u.exec(suite)?.[0] ?? "";
  if (reste !== "" && ((FORMES.has(dernierMot) && FORMES.has(dernierMot + reste)) || (DICTIONNAIRE.has(dernierMot) && /^(?:s|es)$/.test(reste)))) return false;
  /* ni dans un composé dont la suite est un qualificatif de groupe ou une queue slave : « OOO Salskiy Elevator » (vingt
     caractères, la largeur AIS) n'est pas « OOO Salskiy Elevatorstroy » coupé, c'est le silo face à l'entreprise qui le
     construit (jeu 12, 28/09 : 1,000 par cette seule porte) ; « X Agro » n'est pas « X Agroholding » coupé */
  if (reste !== "" && (QUALIFICATIFS_SOUDES.has(reste) || QUEUES_SLAVES.has(reste))) return false;
  /* à 35 (le champ SWIFT), la coupe peut tomber sur une limite de mot ; aux autres largeurs,
     plus rares, on exige qu'elle tombe au milieu d'un mot (« Thornbury Chemical Corporation »
     en trente n'est pas « … Corporation of Canada » coupé) */
  const n0 = court.trim().length;
  if (n0 === LONGUEUR_CHAMP || n0 === LONGUEUR_CHAMP - 1) return /^\s?\p{L}/u.test(suite);
  return /^\p{L}/u.test(suite);
}

/** Le score de deux noms BRUTS, déjà préparés, règle du champ de 35 comprise. */
export function scoreBrut(f: Frequences, a: string, A: NomPrepare, b: string, B: NomPrepare, options: OptionsScore = {}): number {
  let s = scorePrepares(A, B, options);
  const ta = a.trim(), tb = b.trim();
  /* le nom coupé à la longueur de l'autre est CE nom, tronqué : la coupe emporte avec les derniers mots la
     mention de succursale qu'ils portaient, et le nom coupé la garde (jeu 10, 27/09 : « …, Maputo Branch »
     coupé à 34 lettres rejoignait « …, Durban Branch » à 1,000, sans plus rien dire de sa succursale). Ses
     formes, elles, se lisent sur le texte coupé, tel que le champ le montre : « FOSHAN JINYUAN CERAMIC SA »
     est « … Sanitary Ware Co., Ltd. » coupé à 25, et son « SA » n'est pas une forme en conflit avec Ltd */
  const coupeDe = (brut: string, entier: NomPrepare, L: number): NomPrepare => {
    const c = preparerNom(f, brut.slice(0, L), entier.marques.lecture);
    return { ...c, marques: { ...c.marques, succursale: entier.marques.succursale } };
  };
  if (sembleCoupe(ta, tb)) s = Math.max(s, scorePrepares(A, coupeDe(tb, B, ta.length), options));
  if (sembleCoupe(tb, ta)) s = Math.max(s, scorePrepares(coupeDe(ta, A, tb.length), B, options));
  return s;
}

/**
 * LES VARIANTES D'UN NOM TEL QU'UN DOCUMENT L'ÉCRIT. Un connaissement, un virement, une
 * facture ajoutent au nom ce qui n'en fait pas partie, et le nom listé se perd dedans :
 *  - un AUTRE nom annoncé : « ex- », « f/k/a », « formerly », « a.k.a. », « dba », « t/a »,
 *    « trading as » ; chaque nom est une variante, et chacun est criblé ;
 *  - des annotations : le pavillon (« (PANAMA FLAG) », « - LIBERIA FLAG »), l'état
 *    (« (in liquidation) »), la succursale (« , Singapore Branch »), la boîte postale et ce qui
 *    suit, le type de navire (« (BULK CARRIER) », « LNG CARRIER » en fin), un numéro de voyage
 *    en fin (« V.031W », « 0412N ») ;
 *  - une adresse après la forme juridique (« Quarrington Metals FZE, Jebel Ali Free Zone »).
 * Le nom tel qu'écrit reste toujours une variante : on ajoute des lectures, on n'en retire
 * aucune. Un « (Shanghai) » n'est PAS retiré : c'est souvent une filiale, pas une annotation.
 */
