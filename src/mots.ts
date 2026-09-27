/**
 * LES MOTS : fréquences et poids, le dictionnaire anglais et ses racines, pluriel et gérondif, mots distincts et
 * composés, numéros, squelette et classes de voyelles, plis de romanisation et crédits.
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
import { jetonsEntite } from "./preparation.ts";
import { GENERIQUES_AU_PLURIEL } from "./preparation.ts";
import { gesteDeFrappe } from "./score.ts";
import { MOTS_HISPANIQUES } from "./mots-hispaniques.ts";
export { MOTS_HISPANIQUES } from "./mots-hispaniques.ts";

/* ─────────────────────────── les poids des mots ─────────────────────────── */

/**
 * Combien d'entrées des listes portent chaque mot. Un mot que des centaines d'entrées
 * portent (« trading » : 826, « shipping » : 439) ne désigne personne ; un mot qu'aucune ne
 * porte désigne quelqu'un. Les poids viennent DES LISTES criblées, pas des paires : ils sont
 * refaits à chaque criblage, sur les fichiers dont le relevé porte l'empreinte.
 */
export type Frequences = { entrees: number; df: ReadonlyMap<string, number> };

export function frequencesDe(entrees: Iterable<readonly string[]>): Frequences {
  const df = new Map<string, number>();
  let n = 0;
  for (const noms of entrees) {
    n++;
    const vus = new Set<string>();
    for (const nom of noms) for (const j of jetonsEntite(nom)) vus.add(j);
    for (const j of vus) df.set(j, (df.get(j) ?? 0) + 1);
  }
  return { entrees: n, df };
}

/** Sans liste (un jeu de paires mesuré à vide), tous les mots pèsent pareil : dit, pas caché. */
export const FREQUENCES_UNIFORMES: Frequences = { entrees: 0, df: new Map() };

/** La fréquence inverse lissée, jamais nulle : 1 + ln((N + 1) / (df + 1)). */
export function poidsDuMot(f: Frequences, mot: string): number {
  return 1 + Math.log((f.entrees + 1) / ((f.df.get(mot) ?? 0) + 1));
}

/* ─────────────────────────── les mots réels ─────────────────────────── */

/**
 * LE DICTIONNAIRE ANGLAIS : `mots-anglais.txt.gz`, les 202 954 mots de quatre à quinze lettres
 * de la liste web2 (Webster's Second International, 1934 ; domaine public, livrée avec
 * FreeBSD et macOS), embarquée pour que deux machines donnent le même relevé.
 *
 * Ce qu'il sert à dire : « Exports » et « Experts », « Mining » et « Milling », « Paints » et
 * « Prints » ne sont pas une faute de frappe l'un de l'autre. Ce sont deux mots, et un
 * analyste le voit au premier coup d'œil ; sans dictionnaire, une lettre de différence sur
 * sept vaut 0,86, et deux sociétés sœurs deviennent une alerte forte (mesuré le 27/09 : sept
 * fausses alertes fortes de cette seule espèce sur les jeux d'apprentissage).
 *
 * La règle ne s'applique PAS quand la différence est celle qu'une romanisation produit
 * (« Amir » et « Emir » sont tous deux des mots anglais et le même mot arabe), ni quand
 * les deux mots ont la même racine (« Trader », « Traders », « Trading »).
 */
export const DICTIONNAIRE: ReadonlySet<string> = new Set(
  gunzipSync(readFileSync(new URL("./mots-anglais.txt.gz", import.meta.url))).toString("utf8").split("\n").filter((m) => m.length > 0));

/** Les racines possibles d'un mot anglais : lui-même, sans son pluriel, sans -ing, -ed, -er.
 *  En cache : le criblage pose la question des dizaines de milliers de fois sur les mêmes mots. */
const CACHE_RACINES = new Map<string, string[]>();
function racines(m: string): string[] {
  const deja = CACHE_RACINES.get(m);
  if (deja) return deja;
  const r = calculerRacines(m);
  CACHE_RACINES.set(m, r);
  return r;
}
function calculerRacines(m: string): string[] {
  const r = [m];
  if (m.endsWith("ies")) r.push(m.slice(0, -3) + "y");
  if (m.endsWith("es")) r.push(m.slice(0, -2));
  if (m.endsWith("s")) r.push(m.slice(0, -1));
  if (m.endsWith("ing")) r.push(m.slice(0, -3), m.slice(0, -3) + "e");
  if (m.endsWith("ed")) r.push(m.slice(0, -2), m.slice(0, -1));
  if (m.endsWith("er") || m.endsWith("or")) r.push(m.slice(0, -2), m.slice(0, -1));
  if (m.endsWith("ers") || m.endsWith("ors")) r.push(m.slice(0, -3), m.slice(0, -2));
  /* les orthographes britanniques que la règle générale ramène à l'américaine du dictionnaire :
     -re, -er (sabre, centre, fibre) ; -our, -or (harbour, colour) ; -ogue, -og (catalogue). Sans
     cette racine, « Sabre » n'était pas un mot anglais, et « Sable » et « Sabre » passaient pour
     une faute de frappe (mesuré le 27/09 sur le jeu 8 : 0,839, une fausse alerte forte) */
  if (m.endsWith("re")) r.push(m.slice(0, -2) + "er");
  if (m.endsWith("our")) r.push(m.slice(0, -3) + "or");
  if (m.endsWith("ogue")) r.push(m.slice(0, -4) + "og");
  return r;
}
/** Le PLURIEL ANGLAIS d'un mot du commerce est le même mot : « Metals » et « Metal », « Industries »
 *  et « Industry », « Supplies » et « Supply » (jeu 9, 27/09 : 廢金屬 traduit « metal » face à « Recycling
 *  Metals » restait à 0,833, une lettre de différence sur six, et le nom sous le niveau fort). Le seul
 *  pluriel, jamais -ing ni -er : « Trading » et « Traders » restent deux mots (voir `racines`) ; et seulement
 *  un mot du commerce (GENERIQUES_AU_PLURIEL) : le pluriel d'un mot distinctif est un autre nom. */
export function pluriel(long: string, court: string): boolean {
  return DICTIONNAIRE.has(court) && (GENERIQUES_AU_PLURIEL.has(court) || GENERIQUES_AU_PLURIEL.has(long)) && formePlurielle(long, court);
}
/** Le PLURIEL TURC d'un mot (-lar, -ler) est un autre nom, comme le pluriel anglais hors des génériques du commerce :
 *  « Kaptan » et « Kaptanlar », « Martı » et « Martılar » sont deux navires (jeu 12, 27/09 : 0,895 et 0,894, le crédit
 *  d'abréviation par le début lisant le mot court comme le début du long). Un radical d'au moins quatre lettres
 *  qu'aucun dictionnaire ne connaît, et un mot long qui n'est pas anglais non plus (« Handler » n'est pas le pluriel
 *  de « Hand ») ; un générique traduit n'arrive pas ici, TRADUCTIONS l'a rendu en anglais. */
export function plurielTurc(long: string, court: string): boolean {
  if (court.length < 4 || long.length !== court.length + 3 || !long.startsWith(court)) return false;
  const suffixe = long.slice(court.length);
  if (suffixe !== "lar" && suffixe !== "ler") return false;
  return lemme(court) === undefined && lemme(long) === undefined;
}
/** La FORME d'un pluriel anglais, sans regarder le dictionnaire : -s, -es, -y en -ies. */
export function formePlurielle(long: string, court: string): boolean {
  return long !== court && (long === court + "s" || long === court + "es" || (court.endsWith("y") && long === court.slice(0, -1) + "ies"));
}
/** Le GÉRONDIF ANGLAIS d'un mot du dictionnaire est le même mot du métier : « Trading » et « Trade », « Shipping »
 *  et « Ship », « Farming » et « Farm » (jeu 10, 27/09 : « Handel en Vervoer » traduit « trading transport » face à
 *  « Trade and Transport » restait à 0,403). Les deux mots au dictionnaire, jamais un nom propre ; -ing seul,
 *  avec le e final tombé ou la consonne doublée ; jamais -er ni -ers (« Traders » reste un autre mot). */
export function gerondif(long: string, court: string): boolean {
  if (long === court || court.length < 3 || !long.endsWith("ing") || !DICTIONNAIRE.has(court) || !DICTIONNAIRE.has(long)) return false;
  const c = court[court.length - 1]!;
  return long === court + "ing" || (c === "e" && long === court.slice(0, -1) + "ing") || long === court + c + "ing";
}
/** Le lemme d'un mot s'il est anglais : sa première racine au dictionnaire ; sinon undefined. */
const CACHE_LEMMES = new Map<string, string | undefined>();
export function lemme(m: string): string | undefined {
  if (m.length < 4) return undefined;
  if (CACHE_LEMMES.has(m)) return CACHE_LEMMES.get(m);
  const l = racines(m).find((r) => DICTIONNAIRE.has(r));
  CACHE_LEMMES.set(m, l);
  return l;
}
/** Les voyelles qu'une romanisation confond, repliées : a, e, i, y d'un côté, o et u de l'autre. */
const voyellesRomanes = (m: string) => m.replace(/[aeiy]+/g, "a").replace(/[ou]+/g, "o");

/**
 * Deux mots anglais DISTINCTS : chacun au dictionnaire (orthographe britannique ramenée à
 * l'américaine), de racines différentes, et qui ne diffèrent pas par ces seules voyelles
 * qu'une romanisation confond. « Wine » et « Wire » oui, « Cold » et « Gold » oui ; « Trader »
 * et « Traders » non ; « Amir » et « Emir » non ; « Aluminium » et « Aluminum » non.
 *
 * L'exemption des voyelles est celle d'une ROMANISATION (Amir, Emir : le même mot arabe ; Lung,
 * Long : la même syllabe chinoise) : elle ne vaut que là où le nom en porte une (`voyellesLibres`,
 * les marques de langue du nom, hors l'espagnol). Ailleurs, deux mots anglais qui ne diffèrent que par une voyelle
 * sont deux mots (mesuré le 27/09 sur le jeu 8 : « Marlin Fisheries » et « Merlin Fisheries »
 * passaient à 0,835, une fausse alerte forte).
 */
export function motsDistincts(a: string, b: string, voyellesLibres = true): boolean {
  const a2 = BRITANNIQUE.get(a) ?? a, b2 = BRITANNIQUE.get(b) ?? b;
  if (a2 === b2 || a2.length < 4 || b2.length < 4) return false;
  if (lemme(a2) === undefined || lemme(b2) === undefined) return false;
  if (voyellesLibres && voyellesRomanes(a2) === voyellesRomanes(b2)) return false;
  const ra = racines(a2), rb = racines(b2);
  return !rb.some((r) => ra.includes(r));
}

/**
 * Deux mots ESPAGNOLS OU PORTUGAIS distincts : chacun dans le vocabulaire des raisons sociales
 * (MOTS_HISPANIQUES), et l'un n'est pas le pluriel de l'autre. « Faro » et « Foro », « Manzana » et
 * « Manzano », « Sureste » et « Suroeste » sont deux mots comme « Wine » et « Wire » : le dictionnaire
 * anglais n'en connaît qu'un des deux, et la faute d'un clavardage ou la signature d'une lettre
 * tombée en faisait le même (jeu 11, 27/09 : trois fausses alertes fortes). Pas d'exemption des
 * voyelles : l'espagnol et le portugais écrivent les leurs, une voyelle de plus est un autre mot.
 * Le pluriel roman (-s, -es ; luz, luces) reste à `simMot` et à ses règles du pluriel.
 */
export function motsHispaniquesDistincts(a: string, b: string): boolean {
  if (a === b || a.length < 4 || b.length < 4) return false;
  if (!MOTS_HISPANIQUES.has(a) || !MOTS_HISPANIQUES.has(b)) return false;
  const [court, long] = a.length <= b.length ? [a, b] : [b, a];
  if (long === court + "s" || long === court + "es" || (court.endsWith("z") && long === court.slice(0, -1) + "ces")) return false;
  return true;
}

/** Les deux moitiés d'un mot COMPOSÉ anglais que le dictionnaire ne connaît pas d'un bloc :
 *  « ironbridge » (iron, bridge), « northgate » (north, gate). Chaque moitié est un mot du
 *  dictionnaire (donc d'au moins quatre lettres, voir `lemme`). En cache : le criblage pose la
 *  question des milliers de fois sur les mêmes mots. */
const CACHE_MOITIES = new Map<string, readonly (readonly [string, string])[]>();
function moities(m: string): readonly (readonly [string, string])[] {
  const deja = CACHE_MOITIES.get(m);
  if (deja) return deja;
  const r: (readonly [string, string])[] = [];
  if (m.length >= 8 && lemme(m) === undefined) {
    for (let k = 4; k <= m.length - 4; k++) {
      const tete = m.slice(0, k), queue = m.slice(k);
      if (lemme(tete) !== undefined && lemme(queue) !== undefined) r.push([tete, queue]);
    }
  }
  CACHE_MOITIES.set(m, r);
  return r;
}
/** Deux composés anglais DISTINCTS : une moitié commune, l'autre deux mots distincts (`motsDistincts`).
 *  Ce que le dictionnaire dit de « bridge » et « ridge », il le dit d'« Ironbridge » et « Ironridge »
 *  (mesuré le 27/09 sur le jeu 8 : 0,900, une fausse alerte forte, hors de portée du plafond
 *  d'ambiguïté qui s'arrête à huit lettres). SAUF quand les deux moitiés qui diffèrent ne sont
 *  séparées que par le geste d'une faute de frappe (`gesteDeFrappe`) : dans un mot long, deux
 *  lettres inversées ou une lettre doublée sont une faute, même si elles font un mot du
 *  dictionnaire (mesuré le 27/09 sur le jeu 1 : « Silverlien » pour Silverline, « Brightwatter »
 *  pour Brightwater, deux vrais noms perdus sans cette exception). */
export function composesDistincts(a: string, b: string, voyellesLibres = true): boolean {
  if (a === b) return false;
  for (const [ta, qa] of moities(a)) {
    for (const [tb, qb] of moities(b)) {
      if ((ta === tb && motsDistincts(qa, qb, voyellesLibres) && !gesteDeFrappe(qa, qb))
        || (qa === qb && motsDistincts(ta, tb, voyellesLibres) && !gesteDeFrappe(ta, tb))) return true;
    }
  }
  return false;
}

/** La ñ ÉCRITE NY (« Nunyez », « Castanyeda », « Penya ») : un clavier sans tilde, ou l'usage catalan, l'écrit ainsi ;
 *  les listes écrivent n (« Nunez »). Le pli ôte le y d'un « ny » que suit une voyelle, la seule place de la ñ ; « Danny »
 *  et « Tony » gardent le leur. Sous la marque hispanique seulement (voir `scorePrepares`), et l'index cherche sous le
 *  même pli (cribler.ts). Mesuré le 27/09 sur le jeu 11 : « Transportes Nuñez e Hijos » face à « Transportes Nunyez e
 *  Hijos » à 0,800, « nunez » et « nunyez » un mot court ambigu. */
export function pliEnye(m: string): string {
  return m.replace(/ny(?=[aeiou])/g, "n");
}

/** Les deux mots sont anglais : le dictionnaire les connaît tous les deux. Le repli des
 *  voyelles d'une romanisation ne leur est pas appliqué : « Grain » et « Green » ne sont pas
 *  « Najm » et « Nejm ». */
export function tousDeuxAnglais(a: string, b: string): boolean {
  return lemme(BRITANNIQUE.get(a) ?? a) !== undefined && lemme(BRITANNIQUE.get(b) ?? b) !== undefined;
}

/* ─────────────────────────── le score ─────────────────────────── */

const ROMAINS: ReadonlyMap<string, string> = new Map(Object.entries({
  i: "1", ii: "2", iii: "3", iv: "4", v: "5", vi: "6", vii: "7", viii: "8", ix: "9", x: "10",
  xi: "11", xii: "12", xiii: "13", xiv: "14", xv: "15",
}));
/** Le numéro d'un jeton (« 7 », « 07 », « vii » → « 7 »), ou undefined s'il n'en est pas un. */
export function numero(j: string): string | undefined {
  return /^\d+$/.test(j) ? String(Number(j)) : ROMAINS.get(j);
}

/**
 * Le squelette d'un mot latin : les variantes de ROMANISATION ramenées à une seule forme.
 * « х » russe s'écrit kh, ch ou h ; « в » s'écrit v ou w ; « ق » q ou k ; « й », « ы » et
 * « и » y, i ou j ; « у » u ou ou ; « ж » zh ou j ; le « x » pinyin s'écrit « hs » en
 * Wade-Giles ; l'article arabe s'écrit al, el ou ul ; « ش » s'écrit sh ou ch (à la
 * française) ; « غ » gh, « ق » q ou g (dans le Golfe) ; le coréen s'écrit Gyeongbo
 * (romanisation révisée) ou Kyongbo (McCune-Reischauer) ; le persan finit en -eh ou -e,
 * l'arabe en -ah ou -a ; l'hébreu écrit tz ou z, le grec th ou t ; et une lecture optique
 * lit « rn » pour « m ». Ce n'est pas une identité : deux squelettes égaux valent 0,95, pas 1.
 */
export function squelette(mot: string): string {
  if (mot === "el" || mot === "ul" || mot === "il") return "al";
  const m = BRITANNIQUE.get(mot) ?? mot;
  return syllabeChinoise(m)
    /* le w que le français écrit ou devant une voyelle, en tête de mot (« Ouahbi », « Wahbi » ; « Ouattara », « Wattara » ; « Ouest »,
       « West ») : la graphie du Maghreb et de l'Afrique de l'Ouest, lue sans marque, la graphie elle-même étant la trace ; oua et oue
       seulement (« Ouyang » est chinois, « oui » et « Louis » gardent leur u) (tour 10, jeu 14 : « Ouahbi Lahlou Négoce » face à « Wahbi
       Lahlou Negoce » à 0,672, sans aucun marqueur arabe) */
    .replace(/^ou(?=[ae])/, "w")
    /* orthographes britannique et américaine : harbour, centre, catalogue, cheque */
    .replace(/our$/, "or").replace(/re$/, "er").replace(/ogue$/, "og").replace(/que$/, "k")
    /* les digrammes d'abord : chacun rend UNE consonne, avant que les lettres simples bougent */
    .replace(/^hs/, "x")
    /* χρ en tête s'écrit chr (Chrysafi, Christos) ou hr (Hrisafi, Hristos) : aucun mot anglais ne commence par hr
       (jeu 13 : « EVDOKIA CHRYSAFI » face à « EVDOKIA HRISAFI », 0,563, ch et h deux classes) */
    .replace(/^chr/, "hr")
    /* l'orthographe indonésienne d'avant 1972 : « Tjahaja Soerya Kentjana » est « Cahaya Surya Kencana » (jeu 9) ;
       tj est c, dj est j (oe est déjà u par la classe des voyelles) */
    .replace(/dj/g, "j").replace(/tj/g, "c")
    /* deux classes, pas une : ش s'écrit sh, ch (à la française), sch (à l'allemande), tch ;
       х s'écrit kh ou h. Les fondre toutes en h faisait de Shing et Hing le même mot (mesuré
       le 27/09 : Tak Shing / Tak Hing à 0,957) */
    .replace(/(tsch|sch|tch|ch|sh)/g, "X").replace(/kh/g, "h")
    /* zh reste ж (j) : le lire comme le ch du Wade-Giles gagnait un nom chinois glué et en
       perdait deux russes, et lire le q pinyin comme ch' cassait le q arabe (mesuré le 27/09) */
    .replace(/zh/g, "j").replace(/(th|dh)/g, "t").replace(/ph/g, "f").replace(/gh/g, "k").replace(/ck/g, "k")
    .replace(/rn/g, "m")
    /* les lettres simples : ц s'écrit ts, tz, c ou z ; c devant e, i est s ; q, g, k ; w, v ; y, j, i */
    .replace(/(ts|tz|z)/g, "s").replace(/c(?=[ei])/g, "s")
    /* les paires d'aspiration du chinois, du coréen et du thaï : g, k ; b, p ; d, t */
    /* le v du pinyin saisi au clavier est ü (« Lvbang » : Lübang) */
    .replace(/(?<=[ln])v(?=[^aeiou]|$)/g, "u")
    .replace(/w/g, "v").replace(/q/g, "k").replace(/g/g, "k").replace(/b/g, "p").replace(/d/g, "t").replace(/[yj]/g, "i")
    /* les voyelles : eo coréen, ou et oo (u), ue et oe (ü, ö, ø), ae (ä, æ), les finales -ah, -eh, -e */
    .replace(/eo/g, "o").replace(/(ou|oo|ue)/g, "u").replace(/oe/g, "o").replace(/ae/g, "a")
    .replace(/(ah|eh)$/, (x) => x[0]!).replace(/(?<=.{3})e$/, "")
    .replace(/(.)\1+/g, "$1");
}

/**
 * Le squelette d'un mot, sa voyelle longue ī écrite ee lue i (« Naseem » : nasim, comme « Nasim »).
 * En arabe, en persan, en hindi romanisés, ee et i sont la même voyelle, comme oo et u que le
 * squelette plie partout ; en anglais, ee est une autre voyelle (« Greenholt », « Grainholt » :
 * mesuré le 27/09 sur le jeu 4, 0,915 quand le squelette pliait ee partout, une fausse alerte forte).
 * D'où ce squelette à part, sous les marques arabe et indienne seulement (voir `scorePrepares`),
 * et jamais entre deux mots anglais.
 */
export function squeletteLongue(mot: string): string {
  return squelette(mot.replace(/ee/g, "i"));
}

/**
 * Le squelette d'un mot sous la MARQUE ARABE : les voyelles longues repliées (`squeletteLongue`), et o et u fondus, parce
 * qu'aucune lettre arabe ne les distingue (la ḍamma s'écrit o ou u, و s'écrit u, ou, oo ou o : « Noor », « Nour », « Nur » ;
 * « Kohsar », « Koohsar » ; « Khuzama », « Khozama »), quand a et i sont deux lettres (Hamad et Hamid) et restent à la
 * variation d'une voyelle. Deux squelettes égaux ici valent un squelette égal (0,95), pas cette variation (0,85) : jeu 13,
 * 28/09, « Nour El Khuzama » face à « Noor Al Khozama » à 0,717 et « Sepid Kohsar » face à « Sefid Koohsar » à 0,659, deux
 * mots au crédit de romanisation, quand deux mots à 0,85 ne font pas un nom fort (voir `apport`). `persan` : p et f
 * fondus aussi, le پ persan que l'arabe écrit ف (« Sepid », « Sefid » ; « Pars », « Fars »), AVANT que le squelette ne fonde
 * b et p, pour que Bahr reste distinct de Fahr.
 *
 * Tour 10 (jeu 14) : la convention FRANÇAISE du Maghreb et du Levant face à l'anglaise du Golfe. و s'écrit w (v au squelette)
 * ou ou (u au squelette) : « Ouahbi », « Wahbi » ; la diphtongue aw s'écrit aw, aou, ou ou o, les parlers la fermant en ō :
 * « Chaouki », « Shawqi » ; « Toufic », « Tawfiq » ; « Hawsani », « Hosani » ; la diphtongue ay s'écrit ai, ay, ei ou ey :
 * « Hosseini », « Husaini » ; « Mheiri », « Muhairi » ; et le c dur de la graphie française est ق ou ك (« Toufic », « Chaouki »),
 * le squelette n'ayant lu que le c doux. Toutes fondues ici, sous la marque arabe seulement, et jamais entre deux mots anglais.
 */
/** Et la voyelle brève devant un ح ou un ه FINAL, écrite e ou i (« Saleh », « Salih » ; « Fateh », « Fatih ») : le squelette lit
 *  la finale -eh comme le ه persan et la retire, si bien que « Saleh » (sal) et « Salih » (salih) ne se ressemblaient plus ; ici, -eh
 *  après une consonne se lit -ih AVANT le squelette. « Salah » (صلاح, un autre nom) garde sa finale -ah (jeu 14, 29/09 : « Abdel Karim
 *  Saleh Foodstuff Trading » face à « Abd Al-Kareem Salih … » à 0,800, le mot ambigu plafonné).
 *  `latin` faux : le mot est lu dans une écriture native (arabe, persan), et sa romanisation est la nôtre (`romaniser`) : و y est
 *  toujours w, aucune voyelle brève n'y est écrite, et les conventions latines n'ont rien à y plier ; seuls o et u, p et f se
 *  fondent, comme au tour 9 (jeu 9, 29/09 : « بازرگانی سپید کاوه کیش » lu kawh face à « Sefid Kouh Trading Kish », deux maisons,
 *  montait au fort quand aw s'y fermait en u). */
export function squeletteArabe(mot: string, persan = true, latin = true): string {
  const base = persan ? mot.replace(/ph/g, "f").replace(/p/g, "f") : mot;
  if (!latin) return squeletteLongue(base).replace(/o/g, "u");
  return squeletteLongue(base.replace(/(?<=[^aeiou])eh$/, "ih"))
    .replace(/v/g, "u").replace(/[ao]u/g, "u").replace(/ei/g, "ai").replace(/c/g, "k")
    .replace(/o/g, "u").replace(/(.)\1+/g, "$1");
}

/** Les orthographes britanniques que les règles générales ne ramènent pas à l'américaine. */
const BRITANNIQUE: ReadonlyMap<string, string> = new Map(Object.entries({
  aluminium: "aluminum", sulphur: "sulfur", tyre: "tire", tyres: "tires", grey: "gray", mould: "mold",
  moulding: "molding", plough: "plow", programme: "program", jewellery: "jewelry", storey: "story",
  kerb: "curb", draught: "draft", defence: "defense", licence: "license", practise: "practice",
  whisky: "whiskey", pyjamas: "pajamas", tonne: "ton", tonnes: "tons", manoeuvre: "maneuver",
  aeroplane: "airplane", cosy: "cozy", enrol: "enroll", instalment: "installment", skilful: "skillful",
  artefact: "artifact", furore: "furor", speciality: "specialty", carburettor: "carburetor",
  cheque: "check", cheques: "checks", catalogue: "catalog", theatre: "theater", centre: "center",
  litre: "liter", metre: "meter", fibre: "fiber", calibre: "caliber", harbour: "harbor", colour: "color",
  labour: "labor", honour: "honor", flavour: "flavor", armour: "armor", vapour: "vapor",
}));

/**
 * UNE SYLLABE CHINOISE, du Wade-Giles au pinyin. Taïwan et les vieux registres écrivent
 * Kaohsiung, Hsinchu, Chiu, Lung ; la Chine continentale Gaoxiong, Xinzhu, Qiu, Long. Sans
 * l'apostrophe d'aspiration (que les documents perdent), t/d, p/b, k/g, ch/zh/j/q se
 * confondent : on les fond, pour une syllabe isolée seulement (une attaque, un noyau, une
 * finale n, ng ou r), là où l'ambiguïté est celle du système et pas celle d'un mot anglais.
 */
/** Une SYLLABE ISOLÉE, telle que le chinois, le vietnamien, le coréen ou le malais l'écrivent : une
 *  attaque, un noyau, une finale n, ng ou r, six lettres au plus. Deux syllabes à une lettre près sont
 *  deux syllabes (Heng, Hong ; Phong, Phuong), quoi que le dictionnaire anglais en dise. */
export function estSyllabeIsolee(mot: string): boolean {
  return mot.length <= 6 && /^[bcdfghjklmnpqrstwxyz]{0,3}[aeiou]{1,3}(?:ng|n|r)?$/.test(mot);
}
function syllabeChinoise(mot: string): string {
  if (!estSyllabeIsolee(mot)) return mot;
  return mot
    .replace(/^hs/, "x").replace(/^(?:ts|tz|c)(?=[aeiou])/, "z").replace(/^(?:ch|zh|q|j)/, "ch")
    .replace(/^t/, "d").replace(/^p/, "b").replace(/^k/, "g")
    .replace(/ung$/, "ong").replace(/ien$/, "ian").replace(/ih$/, "i").replace(/ueh$/, "ue");
}

/**
 * Le squelette, voyelles repliées : les romanisations de l'arabe et du persan hésitent entre
 * o et u, entre e et i (« Nujoom », « Nojoum » ; « Khorshid », « Khurshid »), et ج s'écrit g
 * en Égypte, j ailleurs (« Gawhara », « Jawhara »). Ce repli ne vaut QUE pour une égalité
 * exacte, et jamais entre deux mots anglais : mesuré, en rapprochement approché il rendait
 * « grain » et « green » voisins à 0,8, et replier a sur i faisait de « Greenholt » et
 * « Grainholt » le même mot.
 */
export function voyelles(sq: string): string {
  return sq.replace(/^k(?=[aeiou])/, "i").replace(/o/g, "u").replace(/e/g, "i").replace(/(.)\1+/g, "$1");
}

/** Deux squelettes qui ne diffèrent que par une voyelle substituée (« najm », « nejm » ;
 *  « khorshid », « khurshid »), ou deux dans un mot long : la variation d'une romanisation,
 *  pas un autre mot. */
/** `schwa` : sous la marque arabe seulement, e se confond aussi avec u. La graphie française du Maghreb écrit e toute voyelle
 *  brève réduite (« Youssef », « Youcef » pour Yusuf ; « Mebarki » pour Mubaraki), quand le Golfe écrit la voyelle arabe
 *  (jeu 14, 29/09 : « Youssef Chaouki » face à « Yusuf Shawqi » à 0,377). Hors de cette marque, e et u restent deux voyelles. */
export function variationVocalique(sqA: string, sqB: string, schwa = false): boolean {
  if (sqA.length !== sqB.length || sqA === sqB) return false;
  /* une voyelle ; deux à partir de sept lettres (« mohamed », « muhamad ») */
  const tolere = sqA.length >= 7 ? 2 : 1;
  /* seules les paires qu'une romanisation confond : o et u entre eux ; e avec a, e avec i (la
     voyelle brève, que l'arabe n'écrit pas, se romanise e ou a, e ou i : Khaled, Khalid ; Mohammed,
     Mohammad). Mais PAS a avec i directement : là c'est une voyelle longue, que l'arabe écrit, ا
     contre ي (« Rashid » رشيد et « Rashad » رشاد, Hamid et Hamad, Jamil et Jamal, Karim et Karam :
     deux noms chacun ; jeu 9, 27/09 : Rashid et Rashad à 0,923, une fausse alerte forte). a et u ne
     se confondent pas non plus (« Jinyang », « Jinyoung » sont deux noms, mesuré le 27/09) */
  const confondues = (x: string, y: string) =>
    (x === "e" && "ai".includes(y)) || (y === "e" && "ai".includes(x)) || ("ou".includes(x) && "ou".includes(y))
    || (schwa && ((x === "e" && y === "u") || (x === "u" && y === "e")));
  let ecarts = 0;
  for (let i = 0; i < sqA.length; i++) {
    if (sqA[i] === sqB[i]) continue;
    if (!confondues(sqA[i]!, sqB[i]!) || ++ecarts > tolere) return false;
  }
  return ecarts >= 1;
}

/**
 * Deux squelettes dont le plus long n'a qu'une voyelle de plus, a ou e, écrite entre ses deux
 * dernières lettres, deux consonnes (« bahr », « bahar » ; « nasr », « naser » ; « fahd », « fahad » ;
 * « badr », « bader ») : la voyelle d'appui que les parlers arabes glissent dans un groupe final de
 * consonnes, et que la romanisation écrit ou n'écrit pas. Quatre lettres au moins au mot court, et
 * jamais i, o, u : « Amr » et « Amir » sont deux noms (عمرو, أمير), « Nasr » et « Nasir » aussi (نصر,
 * ناصر) ; « Saad » et « Said » (سعد, سعيد) n'ont pas la voyelle entre deux consonnes. Crédité sous la
 * marque arabe seulement (jeu 9, 27/09 : « Naseem Al Bahar » et « Nasim Al Bahr » restaient à 0,666).
 */
export function voyelleEpenthetique(sqA: string, sqB: string): boolean {
  const [court, long] = sqA.length < sqB.length ? [sqA, sqB] : [sqB, sqA];
  if (long.length !== court.length + 1 || court.length < 4) return false;
  const n = long.length, consonne = (c: string) => !"aeiou".includes(c);
  if (!"ae".includes(long[n - 2]!) || !consonne(long[n - 3]!) || !consonne(long[n - 1]!)) return false;
  return long.slice(0, n - 2) + long[n - 1] === court;
}

/** Le japonais sous ses deux romanisations, Kunrei (Nihon-shiki) et Hepburn : la même suite de kana s'écrit
 *  si ou shi, ti ou chi, tu ou tsu, hu ou fu, zi ou ji, di ou ji (ぢ), du ou zu (づ), sya ou sha, tya ou cha,
 *  zya ou ja, dya ou ja ; le n devant b, m, p que le Hepburn traditionnel écrit m (« Nanbu », « Nambu » ;
 *  « Shinpo », « Shimpo » ; « Honma », « Homma ») ; et la voyelle longue, que le macron perd à la
 *  normalisation (ō : o) et que l'usage écrit oo, ou ou oh (« Ōmura », « Oomura » ; « Kōgyō », « Kogyou » ;
 *  « Ōtsuki », « Ohtsuki »), ū écrite u ou uu. Une seule clé, comparée sous la marque `japonais` (jeu 11,
 *  28/09 : « Huzimoto Sangyō » face à « Fujimoto Sangyo » à 0,295, « Sinwa Kōgyō » face à « Shinwa Kogyo »
 *  à 0,798 : le pli ne suffisait pas à lever le mot rare, et la règle chinoise des initiales le précédait). */
export function pliJaponais(m: string): string {
  return m.replace(/tsu/g, "tu").replace(/chi/g, "ti").replace(/shi/g, "si").replace(/fu/g, "hu").replace(/ji/g, "zi").replace(/di/g, "zi").replace(/zu/g, "du")
    .replace(/sh(?=[aou])/g, "sy").replace(/ch(?=[aou])/g, "ty").replace(/j(?=[aou])/g, "zy").replace(/dy(?=[aou])/g, "zy")
    .replace(/m(?=[bmp])/g, "n")
    .replace(/o(?:h(?![aeiou])|o|u)/g, "o").replace(/uu/g, "u").replace(/(.)\1+/g, "$1");
}
/** Le grec sous ses romanisations, ELOT 743 (celle de `grec`, preparation.ts) et l'usage anglais des armateurs : χ écrit
 *  ch, kh ou h ; υ écrit y, i ou u ; η, ι, υ, ει, οι toutes i ; αι e ; ου u ; φ ph ou f ; θ th ; β v ou b ; l'esprit rude que
 *  l'anglais écrit h en tête et que le grec n'écrit plus (Hellas, Ellas ; Hermes, Ermis) ; les doubles. Au crédit (0,85), sous
 *  la marque grecque ou hébraïque seulement (jeu 13 : « Ελλάς Ναυτικά Λιπαντικά Α.Ε. » lu ellas face à « Hellas Marine
 *  Lubricants SA », 0,111). */
export function pliGrec(m: string): string {
  return m.replace(/^h(?=[aeiouy])/, "").replace(/ch|kh/g, "h").replace(/ph/g, "f").replace(/th/g, "t").replace(/ou/g, "u")
    .replace(/ei|oi|y/g, "i").replace(/ai/g, "e").replace(/[vw]/g, "b").replace(/(.)\1+/g, "$1");
}
/** Le hindi (व : v, w, b), l'hébreu (ב : b, v), l'espagnol et le portugais (b, v) : une seule lettre au
 *  niveau du crédit (0,85), pas du squelette : Fabre et Favre restent sous le niveau fort. */
export function pliIndien(m: string): string {
  return m.replace(/[vw]/g, "b").replace(/(.)\1+/g, "$1");
}
/** Le tamoul en lettres latines : le sanskrit que son écriture adapte (kṣ s'écrit ட்ச, avec le u que
 *  l'écriture glisse entre deux consonnes : Lakshmi, லட்சுமி latchumi ; Meenakshi, மீனாட்சி meenatchi),
 *  ச lu s ou ch, ழ écrit zh ou l, la sonorité qui ne s'écrit pas (k, g ; t, d ; p, b ; th, dh), வ écrit
 *  v, w ou b, les longues doublées (ee, oo) ou non. Au crédit (0,85), pas au squelette. */
export function pliTamoul(m: string): string {
  return m.replace(/ksh/g, "tch").replace(/tchu(?=[^aeiou])/g, "tch").replace(/(sh|ch)/g, "s").replace(/zh/g, "l")
    .replace(/(th|dh)/g, "t").replace(/d/g, "t").replace(/g/g, "k").replace(/b/g, "p").replace(/[vw]/g, "b")
    .replace(/ee/g, "i").replace(/oo/g, "u").replace(/aa/g, "a").replace(/(.)\1+/g, "$1");
}
/** Le coréen en romanisation révisée et en McCune-Reischauer : eo, o, u (ㅓ, ㅗ, ㅜ) ; eu, u ; ae, e ;
 *  g, k ; d, t ; b, p ; j, ch ; r, l (ㄹ). */
export function pliCoreen(m: string): string {
  return m.replace(/eo/g, "o").replace(/eu/g, "u").replace(/ae/g, "e").replace(/oo|ou|u/g, "o").replace(/y(?=[aeiou])/g, "")
    .replace(/g/g, "k").replace(/d/g, "t").replace(/b/g, "p").replace(/j/g, "ch").replace(/r/g, "l").replace(/(.)\1+/g, "$1");
}

/** Les seules VOYELLES du coréen sous ses deux systèmes : ㅓ écrite eo (romanisation révisée), ŏ ou u (McCune-Reischauer et
 *  l'usage : Chung, Sung, Hyundai), ㅡ eu ou u, ㅐ ae ou e, ㅜ u ou oo. Deux mots égaux sous ce seul pli sont le même mot coréen
 *  sous deux systèmes, et leur crédit est celui de la voyelle d'appui (CREDIT_APPUI, 0,9), au-dessus des consonnes de
 *  `pliCoreen` (0,85 : b et p, g et k écrivent aussi deux consonnes, ㅂ et ㅍ, ㄱ et ㅋ). Jeu 11, 28/09 : « Cheonghae Marine »
 *  face à « Chunghae Marine » restait à 0,807 au crédit de 0,85, le mot générique tirant le nom sous le fort. */
export function pliVoyellesCoreennes(m: string): string {
  return m.replace(/eo/g, "o").replace(/eu/g, "u").replace(/ae/g, "e").replace(/oo|ou|u/g, "o").replace(/(.)\1+/g, "$1");
}

/** Le cantonais en jyutping, en graphie du gouvernement de Hong Kong et dans les graphies d'usage de
 *  Singapour et de Malaisie : les paires d'aspiration (g, k ; b, p ; d, t), s et sh, ch, ts, z et c, j et
 *  y ; les voyelles que ces graphies écrivent librement (aa, a ; oe, eu, eo, ue, oo, u ; ei, ee, ay, i ;
 *  ung, ong ; eng, ing : la Seng Heng Bank de Macao est 誠興, sing hing) ; un h final après voyelle
 *  (Wah, Poh). Et les flottements du hokkien écrit à Singapour et en Malaisie (tour 9 : la troisième lecture,
 *  hokkien.ts) : ck et k (Hock, Hok ; Teck, Tek), eo et io (Leong, Liong ; Keong, Kiong), oa et ua (Hoat, Huat),
 *  qu et kw (Quek, Kwek). Une seule clé, comparée sous la marque `cantonais` seulement. */
export function pliCantonais(m: string): string {
  return m.replace(/^ts/, "ch").replace(/^[zc](?!h)/, "ch").replace(/^sh/, "s").replace(/^j/, "y").replace(/^gw/, "kw").replace(/^qu/, "kw")
    .replace(/^g/, "k").replace(/^b/, "p").replace(/^d/, "t").replace(/ck/g, "k")
    .replace(/aa/g, "a").replace(/oe|eo|eu|ue|oo|io/g, "u").replace(/oa/g, "ua").replace(/(?<=[a-z])yu/g, "u").replace(/ei|ee|ay/g, "i")
    .replace(/ung/g, "ong").replace(/eng/g, "ing").replace(/(?<=[aeiou])h$/, "").replace(/(.)\1+/g, "$1");
}

const PAIRES_ASPIRATION: readonly [string, string][] = [["k", "g"], ["t", "d"], ["p", "b"], ["c", "z"], ["c", "j"], ["z", "j"],
  ["c", "q"], ["q", "j"], ["z", "q"], ["h", "x"], ["j", "q"]];
export function initialesChinoisesCompatibles(x: string, y: string): boolean {
  const a = x[0]!, b = y[0]!;
  if (a === b) return true;
  return PAIRES_ASPIRATION.some(([p, q]) => (a === p && b === q) || (a === q && b === p));
}

/** Ce que vaut une égalité de romanisation au niveau du repli (voyelles repliées, variation
 *  d'une voyelle) : moins qu'un squelette égal (0,95). À 0,9 il faisait de Meier et Mayer,
 *  de Solaris et Solares, le même mot (mesuré le 27/09 sur le jeu 5). */
export const CREDIT_ROMANISATION = 0.85;
/** Ce que vaut la même suite de kana sous deux romanisations (`pliJaponais` : « Sinwa », « Shinwa » ; « Huzimoto »,
 *  « Fujimoto » ; « Ōmura », « Oomura ») : autant qu'un squelette égal (0,95), pas une variation de voyelle, parce que
 *  Kunrei et Hepburn écrivent les mêmes kana et que le nom anglais d'une société japonaise laisse tomber son macron.
 *  Au crédit de 0,85, un nom d'un seul mot propre et d'un mot de métier restait à 0,798 (jeu 11, 28/09 : « Sinwa
 *  Kōgyō K.K. » face à « Shinwa Kogyo Co., Ltd. », « Zyōnan Kōgyō » face à « Jonan Kogyo »). */
export const CREDIT_KANA = 0.95;
/** Les suffixes d'établissement du japonais : -sho (所, 場 : l'atelier, l'usine), -jo (場), -sha (社), -kan (館), -do (堂).
 *  Sous la marque japonaise, un mot qui n'est l'autre qu'augmenté de l'un d'eux est une AUTRE raison sociale (« Tekkō »,
 *  « Tekkōsho » ; « Kōki », « Kōkisho »), pas le mot coupé par un champ ni son abréviation (jeu 11, 28/09 : « Nambu Tekko »
 *  face à « Nambu Tekkosho » à 0,900 par la règle du dernier mot coupé). Trois lettres de radical au moins. */
const SUFFIXES_ETABLISSEMENT: ReadonlySet<string> = new Set(["sho", "jo", "sha", "kan", "do"]);
export function suffixeEtablissement(court: string, long: string): boolean {
  return court.length >= 3 && long.length > court.length && long.startsWith(court) && SUFFIXES_ETABLISSEMENT.has(long.slice(court.length));
}
/** Une voyelle brève SAUTÉE par une romanisation de l'arabe (« Fatima », « Fatma » ; jeu 9) : les deux
 *  squelettes ne diffèrent que par une voyelle intérieure de plus, sur des mots d'au moins cinq lettres
 *  (« Amir » et « Amr » restent deux noms). */
export function voyelleSautee(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) !== 1) return false;
  const [long, court] = a.length > b.length ? [a, b] : [b, a];
  if (court.length < 5) return false;
  for (let i = 1; i < long.length - 1; i++) {
    if ("aeiou".includes(long[i]!) && long.slice(0, i) + long.slice(i + 1) === court) return true;
  }
  return false;
}
/** La voyelle brève sautée SOUS LA MARQUE ARABE, lue sur le squelette arabe (`squeletteArabe`, pour que « Mheiri » rejoigne
 *  « Muhairi » une fois ei et ai fondus), et en TÊTE de mot aussi : le Maghreb élide la voyelle initiale (« Brahim », « Ibrahim » ;
 *  « Smail », « Ismail »), et la voyelle brève de la PREMIÈRE syllabe, juste après la consonne initiale (« Krim », « Karim » ;
 *  « Slimane », « Sulaiman » ; « Mheiri », « Muhairi »), dès quatre lettres au mot court : c'est la voyelle que le parler maghrébin
 *  perd. Cinq lettres au moins ailleurs, comme `voyelleSautee` : « Amr » et « Amir » restent deux noms, la voyelle perdue n'y suit
 *  pas la consonne initiale (jeu 14, 29/09 : « Tariq Al Muhairi » face à « Tarek El Mheiri » à 0,622, « Ould Brahim » face à « wuld
 *  Ibrahim » à 0,427, « Chouaki Abdelkrim » face à « Shouaki Abdulkarim » à 0,800 une fois le nom théophore coupé). */
export function voyelleSauteeArabe(a: string, b: string): boolean {
  if (voyelleSautee(a, b)) return true;
  if (Math.abs(a.length - b.length) !== 1) return false;
  const [long, court] = a.length > b.length ? [a, b] : [b, a];
  if (court.length >= 5 && "aeiou".includes(long[0]!) && long.slice(1) === court) return true;
  return court.length >= 4 && !"aeiou".includes(long[0]!) && "aeiou".includes(long[1]!) && long[0] + long.slice(2) === court;
}
/** L'ARTICLE MAGHRÉBIN RÉDUIT À SON L et collé au nom (« Lamine » : al-Amin ; « Larbi », « Lakhdar », « Lhoussine ») : `l` est ce
 *  mot, `nu` le nom écrit sans l'article (« Amin », l'article « al » à part ou absent). Un mot en l suivi d'une voyelle ou d'un h,
 *  cinq lettres au moins, que le dictionnaire ignore (Logistics, Location, Leather restent des mots), dont le reste a le squelette
 *  arabe de l'autre. Lu au score, sous la marque arabe, pour qu'un seul côté marqué suffise et qu'un « Lotfi » sans article ne se
 *  coupe jamais (jeu 14, 29/09 : « Mohamed Lamine Ould Brahim Transit » face à « Muhammad al-Amin wuld Ibrahim Transit » à 0,598,
 *  « lamine » et « amin » orphelins rares). */
export function articleReduit(l: string, nu: string): boolean {
  return l.length >= 5 && nu.length >= 4 && /^l[aeiouh]/.test(l) && lemme(l) === undefined && squeletteArabe(l.slice(1)) === squeletteArabe(nu);
}
/** Ce que vaut la voyelle d'appui d'un groupe final de consonnes (`voyelleEpenthetique` : « Bahr »,
 *  « Bahar ») : entre la variation d'une voyelle (0,85 : une voyelle substituée peut faire un autre
 *  mot, Hamad et Hamid) et le squelette égal (0,95), parce qu'elle ne change pas le mot arabe, بحر
 *  dans les deux graphies. À 0,85, « Naseem Al Bahar 3 » et « Nasim Al Bahr 3 » restaient à 0,808
 *  (jeu 9, 27/09) : deux mots au crédit de romanisation ne font pas un nom fort. */
export const CREDIT_APPUI = 0.9;
/** Ce que vaut l'égalité des consonnes face à un mot écrit dans un abjad : autant qu'un
 *  squelette égal (0,95), parce que ce côté-là n'a pas de voyelles à mettre en défaut. */
export const CREDIT_ABJAD = 0.95;

/** Les NOMS DE LIEUX que l'ukrainien et le russe écrivent chacun à leur manière, en radical, pour que l'adjectif
 *  les suive (« Mykolaivskyi », « Nikolaevskiy » ; « Chornomorska », « Chernomorska » ; « Odeskyi », « Odesskiy ») :
 *  la forme ukrainienne, ramenée à la russe AVANT le pli (voir `pliSlave`). Une même douane écrit le port dans
 *  l'une ou l'autre langue selon le document (jeu 12, 28/09 : « TOV Mykolaivskyi Kombikormovyi Zavod » face à
 *  « Nikolaevskiy Kombikormovyy Zavod LLC » à 0,662). Pivdennyi est le port Youjny (Южный), traduit et non
 *  transcrit. */
const LIEUX_UKRAINIENS: readonly (readonly [string, string])[] = [
  ["mykolaiv", "nikolaev"], ["kyiv", "kiev"], ["kyyiv", "kiev"], ["kharkiv", "kharkov"], ["dnipropetrovsk", "dnepropetrovsk"],
  ["dnipro", "dnepr"], ["chornomor", "chernomor"], ["odesa", "odessa"], ["lviv", "lvov"], ["zaporizhzh", "zaporozh"],
  ["pivdenn", "yuzhn"], ["luhansk", "lugansk"], ["ternopil", "ternopol"], ["chernihiv", "chernigov"], ["rivne", "rovno"],
  ["vinnytsia", "vinnitsa"], ["kropyvnytsk", "kropivnitsk"], ["berdiansk", "berdyansk"], ["skadovsk", "skadovsk"],
];
/**
 * LE CYRILLIQUE SOUS SES ROMANISATIONS : BGN/PCGN (zh, sh, ch, ts, shch, kh, y, yu, ya, ye en tête), ISO 9 et la
 * translittération scientifique dont la normalisation a perdu les diacritiques (ž, š, č, c, šč, h, j, ju, ja : z, s,
 * c, c, sc, h, j, ju, ja), le système national ukrainien (iu, ia, ii, yi), l'allemande (sch, tsch, w) ; ë écrit yo,
 * jo ou e (Tkachyov, Tkachev) ; й, ы, и, ј confondus en i ; e, ye ou ie après une voyelle ou un signe mou (Nikolayev,
 * Nikolaev ; Vasilyev, Vasiliev, Vasilev) ; les finales -iy, -ii, -ij, -yi, -yy, -y d'un même ий ; x pour ks
 * (Agroexport, Agroeksport). Une seule clé, comparée
 * sous la marque `slave` seulement, et elle vaut un squelette égal (CREDIT_CYRILLIQUE) : c'est la même suite de
 * lettres cyrilliques sous deux systèmes, pas un autre mot (jeu 12, 28/09 : « ZAO Shchekinskiy Metallosklad » face à
 * « ZAO Ščekinskij Metallosklad » à 0,675, « OOO Kubanskaya Zhatva » face à « OOO Kubanskaja Žatva » à 0,783, le
 * squelette séparant sh et h, zh et z). Le c y confond ц et č, que l'ISO sans diacritique confond déjà.
 */
export function pliSlave(m: string): string {
  let r = m;
  for (const [ua, ru] of LIEUX_UKRAINIENS) if (r.startsWith(ua)) { r = ru + r.slice(ua.length); break; }
  return r.replace(/shch/g, "sc").replace(/tsch/g, "c").replace(/sch/g, "s").replace(/tch/g, "c").replace(/zh/g, "z").replace(/sh/g, "s")
    .replace(/ch/g, "c").replace(/ts/g, "c").replace(/kh/g, "h").replace(/x/g, "ks").replace(/w/g, "v")
    .replace(/[yj]o/g, "e").replace(/[yj]/g, "i").replace(/ie/g, "e").replace(/(.)\1+/g, "$1");
}
/**
 * LA ROMANISATION ALLEMANDE du cyrillique (Duden : ж et ш sch, ч tsch, х ch, ц z, в w, й j ; з s en tête et entre voyelles,
 * с ss entre voyelles et s ailleurs), celle des registres d'Europe centrale et des documents suisses et autrichiens (jeu 13,
 * 28/09 : « Chimtechnika » face à « Khimtekhnika » à 0,450, « PrAT Werbodolskyj Kabelnyj Sawod » face à « PrAT Verbodolskyi
 * Kabelnyi Zavod » à 0,593). Le pli standard lit déjà sch, tsch, w et j ; il lit ch comme ч et s comme с. Les CLÉS d'un mot
 * sont sa clé standard et ses lectures sous le système allemand ramenées au pli : ch lu х, z lu ц, le s entre voyelles lu з,
 * le ss lu с, sch lu ш ou ж (Puschkin, Breschnew : deux clés) ; et, le s initial étant з ou с (Sawod, Завод ; Sokolow,
 * Соколов), les deux lectures quand le mot commence par s et une voyelle et montre le système ailleurs. Un mot sans lettre
 * propre au système n'a que sa clé standard. Deux mots sont la même suite cyrillique (`memeSuiteCyrillique`) quand la clé
 * standard de l'un est parmi les clés de l'autre.
 */
export function clesSlaves(m: string): readonly string[] {
  const standard = pliSlave(m);
  const lu = m.replace(/tsch/g, "\u0001").replace(/sch/g, "\u0002").replace(/(?<=[aeiouy])s(?=[aeiouy])/g, "\u0003").replace(/ss/g, "s")
    .replace(/ch/g, "kh").replace(/z/g, "ts").replace(/\u0001/g, "ch").replace(/\u0003/g, "z");
  /* sch est ш ou ж (Puschkin, Breschnew, Saporoschje) : les deux lectures ; et le s initial lu з aussi, seulement quand le mot
     montre le système allemand ailleurs (w, sch, tsch, ss, j devant voyelle : « Sawod », « Sokolow ») : sans cette trace,
     « Sever » n'est pas « Zever » (mesuré à 0,930 sans la réserve, 28/09) */
  const lectures = [lu.replace(/\u0002/g, "sh"), lu.replace(/\u0002/g, "zh")];
  if (/^s[aeiouy]/.test(lu) && /w|sch|ss|j[aeiou]/.test(m)) for (const l of [...lectures]) lectures.push("z" + l.slice(1));
  return [...new Set([standard, ...lectures.map(pliSlave)])];
}
export function memeSuiteCyrillique(x: string, y: string): boolean {
  const px = pliSlave(x), py = pliSlave(y);
  return px === py || clesSlaves(x).includes(py) || clesSlaves(y).includes(px);
}
/** Ce que vaut la même suite de lettres cyrilliques sous deux romanisations (`pliSlave`) : un squelette égal (0,95),
 *  comme les kana. À 0,85, deux mots au crédit ne font pas un nom fort (« Kubanskaya Zhatva », « Kubanskaja Žatva » :
 *  0,800). */
export const CREDIT_CYRILLIQUE = 0.95;
/** LE THAÏ en romanisation générale royale (RTGS) et dans les graphies d'usage, que l'état civil et les registres écrivent chacun à
 *  leur manière : l'aspiration marquée ou non (ph, p ; th, t ; kh, k : « Phrachan », « Prajan » ; « Charoenphol », « Charoenpol »),
 *  จ écrit ch ou j, ว écrit w ou v (« Wichai », « Vichai »), เ-อ écrit oe ou er (« Ngoen », « Ngern »), อือ ue ou eu, แ ae ou a, le r
 *  muet qui allonge la voyelle devant une consonne ou en finale (« Porn », « Phon » ; « Charn », « Chan »), le l final prononcé n
 *  (« Phol », « Phon »), les longues doublées (ee, oo, aa) ou non, le w final écrit o (« Kaew », « Kaeo »), ay écrit ai. Une seule
 *  clé, comparée sous la marque `thai` seulement, et elle vaut un squelette égal (CREDIT_THAI) : les mêmes lettres thaïes sous
 *  deux systèmes, comme les kana et le cyrillique (jeu 13, 28/09 : « Phrachan Ngoen » face à « Prajan Ngern » à 0,203 ; à 0,85,
 *  deux mots au crédit ne font pas un nom fort). */
export function pliThai(m: string): string {
  return m.replace(/ph/g, "p").replace(/th/g, "t").replace(/kh/g, "k").replace(/ch/g, "j").replace(/v/g, "w")
    .replace(/oe/g, "e").replace(/er/g, "e").replace(/ue|eu/g, "u").replace(/ae/g, "a")
    .replace(/r(?=[^aeiou]|$)/g, "").replace(/l$/, "n").replace(/ee/g, "i").replace(/oo/g, "u").replace(/aa/g, "a")
    .replace(/(?<=[aeiou])w$/, "o").replace(/ay$/, "ai").replace(/(.)\1+/g, "$1");
}
export const CREDIT_THAI = 0.95;
/** LES QUEUES DES COMPOSÉS SLAVES : -stroy (строй, la construction), -prom (l'industrie), -snab (l'approvisionnement),
 *  -sbyt (la vente), -mash (les machines), -energo, -montazh, -remont, -servis, -torg, -trans, -eksport, -invest.
 *  Sous la marque slave, un mot qui n'est l'autre qu'augmenté de l'une d'elles est une AUTRE raison sociale
 *  (« Elevator », « Elevatorstroy » : le silo et l'entreprise qui le construit), pas le mot coupé par un champ ni son
 *  abréviation (jeu 12, 28/09 : « OOO Salskiy Elevator » face à « OOO Salskiy Elevatorstroy » à 1,000, le nom de vingt
 *  caractères lu comme le nom entier coupé par un champ AIS). Quatre lettres de radical au moins. */
export const QUEUES_SLAVES: ReadonlySet<string> = new Set(["stroy", "stroi", "stroj", "prom", "snab", "sbyt", "mash", "energo", "montazh",
  "remont", "servis", "torg", "trans", "eksport", "export", "import", "invest", "tekh", "tekhnika", "komplekt", "avto", "khim", "neft", "gaz"]);
export function queueDeComposeSlave(court: string, long: string): boolean {
  return court.length >= 4 && long.length > court.length && long.startsWith(court) && QUEUES_SLAVES.has(long.slice(court.length));
}
/** LE RADICAL D'UN ADJECTIF SLAVE DE LIEU : « Kubanskaya », « Kurganskaya », « Salskiy », « Temryukskiy », « Mykolaivskyi »
 *  sont un nom de lieu et le même suffixe (-skiy, -skaya, -skoye, -skyi, -ska…). C'est le radical qui nomme : deux
 *  radicaux à deux lettres près sont deux lieux, quand les mots entiers, longs de leur suffixe commun, se ressemblaient à
 *  0,82 (jeu 12, 28/09 : « OOO Kubanskaya Zhatva » face à « OOO Kurganskaya Zhatva » à 0,818, une fausse alerte forte).
 *  Rendu sur la clé du pli, avec le suffixe replié pour exiger le même ; trois lettres de radical au moins. */
export function radicalSlave(m: string): { radical: string; suffixe: string } | undefined {
  const r = /^(.{3,})(ski|skaia|skoe|skoi|ska|ske|sko)$/.exec(pliSlave(m));
  return r ? { radical: r[1]!, suffixe: r[2]! } : undefined;
}

/** Le plancher du rappel, à la borne BASSE de Wilson : un criblage qui rate un nom listé
 *  coûte plus cher que dix alertes à relire, donc on exige d'abord de ne pas rater. */

/** L'UMLAUT ÉCRIT EN DEUX LETTRES : ä, ö, ü s'écrivent ae, oe, ue quand le clavier ou le système ne les a pas
 *  (« Sueddeutsche », « Muenchen »), et la normalisation les a déjà pliés en a, o, u de l'autre côté. Le pli ramène les
 *  deux graphies à la seconde. Il touche aussi un « ue » qui n'est pas un umlaut (« Bauer » devient « baur »), ce qui ne
 *  gêne pas une comparaison où les deux côtés le subissent ; il ne sert que sous la marque germanique (tour 10). */
export function pliUmlaut(m: string): string {
  return m.replace(/ae/g, "a").replace(/oe/g, "o").replace(/ue/g, "u");
}
