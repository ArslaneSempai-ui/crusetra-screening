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

/* ─────────────────────────── la préparation ─────────────────────────── */

/** Formes juridiques d'un mot, telles que la normalisation les laisse (minuscules, sans
 *  points, lettres isolées rejointes : « S.A. » → « sa », « A.Ş. » → « as »). « Compañía »,
 *  « Compagnie », « Cía », « Cie » et « Établissements » sont le mot « société » : retirés
 *  comme lui. */
const FORMES = new Set([
  /* anglophones */ "llc", "pllc", "ltd", "limited", "ltee", "inc", "incorporated", "corp", "corporation",
  "co", "company", "plc", "llp", "lp", "pvt", "pte", "pty",
  /* le mot « société » */ "compania", "companhia", "compagnie", "cia", "cie", "etablissements", "ets",
  "establishment", "establishments", "societe", "ste", "borisat", "sherkat", "sherkate", "sharikat", "sharika",
  "shirkat", "shirka", "aktiebolag", "aktieselskab", "aksjeselskap", "osakeyhtio",
  /* Europe */ "gmbh", "kg", "ohg", "ug", "ag", "se", "sa", "sas", "sasu", "sarl", "eurl", "snc",
  "sprl", "bvba", "srl", "spa", "sl", "slu", "sau", "bv", "nv", "vof", "oy", "oyj", "ab", "as",
  "asa", "aps", "kft", "zrt", "nyrt", "sro", "doo", "ad", "eood", "ood",
  /* Amérique latine */ "ltda", "eireli", "cv", "sapi", "sac", "saa",
  /* Russie et CEI */ "ooo", "oao", "zao", "pao", "ao", "jsc", "pjsc", "ojsc", "cjsc", "too",
  /* Ukraine, Grèce, Vietnam, Thaïlande */ "prat", "pat", "tov", "ae", "epe", "ike", "tnhh", "chamkat", "jamkat",
  /* désignations russes */ "npp", "npo", "npk", "npf", "pkf",
  /* Turquie */ "sti",
  /* Golfe */ "fze", "fzco", "fzc", "fzllc", "fz", "wll", "spc", "est",
  /* Asie */ "sdn", "bhd", "berhad", "kk", "jusikhoesa", "chusikhoesa",
]);
/** Formes qui ne se placent QU'À LA FIN d'un nom : en tête, le même jeton est autre chose
 *  (« Ag. Prokopis » est « Agios », « As-Salam » un article arabe). Les formes russes, elles,
 *  se placent devant (« OOO Kamaflot ») et restent retirées partout. */
const FORMES_FINALES = new Set(["ag", "se", "sa", "as", "ad", "ab", "sl", "kg", "nv", "bv", "oy",
  "spa", "srl", "sas", "snc", "sac", "sti", "est", "kk", "cv", "ae", "epe", "ike"]);
/** Les formes écrites en plusieurs mots, retirées AVANT les mots isolés (sinon « liability »
 *  resterait seul au milieu du nom). Les translittérations russes sont parmi les mots les
 *  plus fréquents des listes : « obshchestvo » figure dans 1 361 entrées sur 33 393
 *  (mesuré le 27/09/2026 sur les cinq listes), sans rien dire de qui est désigné. */
const PHRASES = [
  " obshchestvo s ogranichennoi otvetstvennostyu ", " obshchestvo s ogranichennoy otvetstvennostyu ",
  " tovarishchestvo s ogranichennoi otvetstvennostyu ",
  " publichnoe aktsionernoe obshchestvo ", " zakrytoe aktsionernoe obshchestvo ",
  " otkrytoe aktsionernoe obshchestvo ", " aktsionernoe obshchestvo ",
  " public joint stock company ", " closed joint stock company ", " open joint stock company ",
  " joint stock company ", " limited liability company ", " limited liability partnership ",
  " private limited ", " public limited company ", " proprietary limited ",
  " with limited liability ", " sole proprietorship ",
  " free zone establishment ", " free zone company ", " free zone limited liability company ",
  " gesellschaft mit beschrankter haftung ", " aktiengesellschaft ", " kommanditgesellschaft ",
  " societe anonyme ", " societe a responsabilite limitee ", " societe par actions simplifiee ",
  " sociedad anonima cerrada ", " sociedad anonima ", " sociedad limitada ",
  " sociedad de responsabilidad limitada ",
  " sociedade anonima ", " sociedade limitada ", " limitada ", " s de rl de cv ", " s de rl ",
  " sa de cv ", " de cv ", " spol s ro ", " spol sro ",
  " societa per azioni ", " societa a responsabilita limitata ",
  " besloten vennootschap ", " naamloze vennootschap ", " sp zoo ", " sp z oo ",
  " anonim sirketi ", " limited sirketi ", " sirketi ",
  " sendirian berhad ", " sendirian ",
  " kabushiki kaisha ", " kabushikigaisha ", " godo kaisha ", " yugen kaisha ",
  " chusik hoesa ", " jusik hoesa ", " gufen youxian gongsi ", " youxian gongsi ", " youxian zeren gongsi ",
  " cong ty tnhh ", " cong ty co phan ", " cong ty ",
  " spolka z ograniczona odpowiedzialnoscia ", " spolka akcyjna ", " spolka jawna ",
  " borisat chamkat ", " borisat jamkat ",
  /* les désignations russes d'entreprise, sigle ou en toutes lettres : NPP (entreprise
     scientifique et de production), NPO, NPK, PKF, PO. Comme une forme, elles disent le
     statut, pas le nom : « NPP Ilmenostat » est « Ilmenostat ». */
  " nauchno proizvodstvennoe predpriyatie ", " nauchno proizvodstvennoe obedinenie ",
  " nauchno proizvodstvennyi kompleks ", " nauchno proizvodstvennaya firma ",
  " proizvodstvenno kommercheskaya firma ", " proizvodstvennoe obedinenie ",
  " scientific production enterprise ", " scientific production association ",
  " scientific and production enterprise ", " scientific and production association ",
  " research and production enterprise ", " research and production association ",
  " production and commercial firm ", " production association ",
];
/** Les locutions d'usage abrégées en bloc : leur sens tient à leurs voisins (« San » seul
 *  est aussi « saint » en espagnol ; « San. ve Tic. » est toujours « Sanayi ve Ticaret »). */
const LOCUTIONS: readonly [string, string][] = [
  [" san ve tic ", " sanayi ticaret "], [" san tic ", " sanayi ticaret "],
  [" ind e com ", " industria comercio "], [" ind com ", " industria comercio "],
  [" imp exp ", " import export "], [" imp and exp ", " import export "],
  [" import and export ", " import export "],
  [" torgovy dom ", " trading house "], [" torgovyi dom ", " trading house "], [" torgovyy dom ", " trading house "],
  /* vietnamien : thương mại (commerce), xuất nhập khẩu (import-export), sản xuất (production),
     dịch vụ (services), vận tải (transport), công nghiệp (industrie), kỹ thuật (technique) */
  [" thuong mai ", " trading "], [" xuat nhap khau ", " import export "], [" san xuat ", " production "],
  [" dich vu ", " services "], [" van tai ", " transport "], [" cong nghiep ", " industry "], [" ky thuat ", " technology "],
  [" det may ", " textile garment "], [" giay da ", " leather shoes "], [" thep ", " steel "], [" xay dung ", " construction "],
  [" co khi ", " mechanical "], [" dien tu ", " electronics "], [" thuy san ", " seafood "], [" nong san ", " agricultural products "],
  [" mot thanh vien ", " "], [" mtv ", " "],
  /* polonais : les descripteurs d'entreprise, en sigle ou en toutes lettres, ne nomment pas */
  [" przedsiebiorstwo produkcyjno handlowo uslugowe ", " "], [" przedsiebiorstwo handlowo uslugowe ", " "],
  [" przedsiebiorstwo produkcyjno handlowe ", " "], [" przedsiebiorstwo wielobranzowe ", " "],
  [" firma handlowo uslugowa ", " "], [" firma handlowa ", " "], [" zaklad produkcyjno handlowy ", " "],
  [" pphu ", " "], [" phu ", " "], [" fhu ", " "], [" zph ", " "], [" phpu ", " "],
];
/**
 * LES MOTS GÉNÉRIQUES DU COMMERCE, TRADUITS. Une société chinoise a un nom officiel en
 * caractères, une romanisation (« Jiangsu Mingluochen Maoyi Youxian Gongsi ») et un nom
 * anglais (« Jiangsu Mingluochen Trading Co., Ltd. ») ; les documents et les listes portent
 * l'un ou l'autre. Les mots traduits ici sont ceux du VOCABULAIRE COMMERCIAL (trading,
 * industry, technology, precision…), jamais le nom propre : traduits, ils pèsent peu (ils
 * sont partout dans les listes) et le nom propre décide, comme il doit.
 */
const TRADUCTIONS: ReadonlyMap<string, string> = new Map(Object.entries({
  /* chinois (pinyin) */ maoyi: "trading", jinchukou: "import export", keji: "technology", dianzi: "electronics",
  gongye: "industry", shiye: "industrial", zhizao: "manufacturing", jituan: "group", guoji: "international",
  wuliu: "logistics", huoyun: "freight", hangyun: "shipping", chuanwu: "shipping", jixie: "machinery", luntai: "tire",
  huagong: "chemical", fangzhi: "textile", fuzhuang: "garment", shipin: "food", jinshu: "metal",
  gangtie: "steel", suliao: "plastic", jianzhu: "construction", nengyuan: "energy", fazhan: "development",
  touzi: "investment", kongzhi: "holdings", konggu: "holdings", shangmao: "trading", jingmao: "trading",
  /* japonais */ kogyo: "industry", kougyou: "industry", shoji: "trading", shouji: "trading", sangyo: "industry",
  sangyou: "industry", seisakusho: "works", boeki: "trading", boueki: "trading", denki: "electric",
  kagaku: "chemical", seiko: "precision", seikou: "precision", jidosha: "automotive", unyu: "transport",
  kaiun: "shipping", kaihatsu: "development", tsusho: "trading", tsuusho: "trading",
  /* coréen */ sanop: "industry", sanup: "industry", muyeok: "trading", muyok: "trading", jeongmil: "precision",
  jungmil: "precision", jeonja: "electronics", junja: "electronics", hwahak: "chemical", mulryu: "logistics",
  haeun: "shipping", gaebal: "development", tongsang: "trading",
  /* persan et arabe */ bazargani: "trading", tejarat: "trade", tejarati: "trading", sanati: "industrial",
  tolid: "production", tolidi: "production", tijara: "trading", tijarah: "trading", tijariya: "trading",
  tijariyah: "trading", sinaiya: "industrial", sinaiyah: "industrial", lil: "",
  muqawalat: "contracting", mukawalat: "contracting", muassasat: "", moassasat: "", muassasa: "", moassasa: "",
  /* « fils » et « frères » dans les langues du commerce */
  sinovi: "sons", synowie: "sons", sohne: "sons", soehne: "sons", hijos: "sons", fils: "sons", figli: "sons",
  filhos: "sons", zonen: "sons", sonner: "sons", oglu: "sons", ogullari: "sons",
  freres: "brothers", fratelli: "brothers", irmaos: "brothers", brueder: "brothers", bruder: "brothers",
  bracia: "brothers", hermanos: "brothers", gebruder: "brothers", ikhwan: "brothers",
}));

/** Les abréviations d'usage, ramenées au mot entier ; les mots de liaison disparaissent
 *  (« & », « and », « et », « ve », « und », « y », « e », « for », « of », « the »). */
/* Des Map, jamais des objets littéraux : un nom listé contient « constructor » ou
   « toString », et `objet[mot]` rendait alors une fonction héritée (mesuré le 27/09 :
   « .split is not a function » au premier criblage des cinq listes). */
const ABREVIATIONS: ReadonlyMap<string, string> = new Map(Object.entries({
  intl: "international", bros: "brothers", mfg: "manufacturing", mgmt: "management",
  svcs: "services", assoc: "associates", st: "saint", capt: "captain", sta: "santa", sto: "santo",
  gle: "generale", gal: "general", fres: "freres", entreprises: "enterprises", entreprise: "enterprise", les: "",
  hnos: "brothers", gebr: "brothers", hk: "hong kong",
  /* les nombres écrits en lettres deviennent des chiffres : « Nine Willows » est « 9 Willows » */
  zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8",
  nine: "9", ten: "10", eleven: "11", twelve: "12",
  /* mots de liaison, ézafé persan, titres de civilité indiens (« Shree », « M/s. ») */
  and: "", et: "", ve: "", und: "", y: "", e: "", i: "", ye: "", for: "", of: "", the: "",
  shri: "", shree: "", sri: "", sree: "", smt: "",
}));
/**
 * Les lettres que la décomposition Unicode ne ramène PAS à leur base : « ı » turc, « ł »
 * polonais, « ø » danois, « đ » croate, « ß », les ligatures. `normaliser` retire les marques
 * combinantes, mais ces lettres-là n'en ont pas : sans cette table, « Łódź » ne rencontre
 * jamais « Lodz » (mesuré : 0,40 sur le jeu d'apprentissage). Elle vit ici et non dans
 * `normaliser`, que les sept paliers de personnes partagent : la changer là déplacerait le
 * relevé public scellé.
 */
const LETTRES_SANS_BASE: Readonly<Record<string, string>> = {
  "ı": "i", "İ": "I", "ł": "l", "Ł": "L", "ø": "o", "Ø": "O", "đ": "d", "Đ": "D", "ħ": "h", "Ħ": "H",
  "ß": "ss", "æ": "ae", "Æ": "AE", "œ": "oe", "Œ": "OE", "þ": "th", "Þ": "Th", "ð": "d", "Ð": "D",
};
function plier(nom: string): string {
  /* le cyrillique et l'arabe sont translittérés ICI, avant l'analyse des formes : « ООО » doit
     être lu « OOO » pour être une forme (mesuré le 27/09 : sinon il restait un mot rare sans
     répondant, et « ООО Северный Транзит » plafonnait au possible face à « OOO Severny Tranzit ») */
  const latin = /[\u0400-\u04ff\u0600-\u06ff]/.test(nom) ? translitterer(nom.toLowerCase()) : nom;
  return grec(latin.replace(/[ıİłŁøØđĐħĦßæÆœŒþÞðÐ]/g, (c) => LETTRES_SANS_BASE[c] ?? c));
}

/**
 * LE GREC, translittéré (ELOT 743, la norme des passeports et des registres grecs) : les
 * armateurs et les listes écrivent « Αφοί Λευκαδίτη Ναυτιλιακή » et « Afoi Lefkaditi
 * Naftiliaki ». Les digrammes d'abord (αυ, ευ devant une consonne sourde : af, ef ; ου : ou ;
 * μπ : b ; ντ : d ; γκ : g), puis lettre à lettre. Ici et non dans la couche commune des
 * personnes, dont le relevé public est scellé.
 */
const GREC_LETTRES: Readonly<Record<string, string>> = {
  α: "a", β: "v", γ: "g", δ: "d", ε: "e", ζ: "z", η: "i", θ: "th", ι: "i", κ: "k", λ: "l", μ: "m", ν: "n",
  ξ: "x", ο: "o", π: "p", ρ: "r", σ: "s", ς: "s", τ: "t", υ: "y", φ: "f", χ: "ch", ψ: "ps", ω: "o",
};
function grec(nom: string): string {
  if (!/[\u0370-\u03ff]/.test(nom)) return nom;
  const bas = nom.normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase();
  return bas
    .replace(/(α|ε)υ(?=[θκξπστφχψ]|$|[^\p{L}])/gu, (_, v: string) => (v === "α" ? "af" : "ef"))
    .replace(/(α|ε)υ/g, (_, v: string) => (v === "α" ? "av" : "ev"))
    .replace(/ου/g, "ou").replace(/(?<![\p{L}])μπ/gu, "b").replace(/μπ/g, "mp")
    .replace(/(?<![\p{L}])ντ/gu, "d").replace(/ντ/g, "nt").replace(/γκ/g, "g").replace(/γγ/g, "ng")
    .replace(/[α-ω]/g, (c) => GREC_LETTRES[c] ?? c);
}

/**
 * LES CONFUSIONS D'UNE LECTURE OPTIQUE (OCR) : un mot fait de lettres où traînent un 0, un 1,
 * un 5 ou un 8 était « o », « l », « s », « b » (« C0LBROOK », « E5BRAND », « 8EARING ») ; un numéro court où traînent
 * un « o » ou un « l » était un chiffre (« BELLAMARE 1O »). Hors de ces deux cas, rien ne
 * bouge : « S1187 » reste un numéro de coque, « 3M » un nom.
 */
function ocr(j: string): string {
  if (!/\d/.test(j) || !/\p{L}/u.test(j)) return j;
  const lettres = j.replace(/\d/g, ""), chiffres = j.replace(/\D/g, "");
  /* des chiffres EN FIN de mot sont un numéro (« No18 », « TCB1207 »), pas une lecture fautive */
  if (j.length >= 4 && lettres.length >= 2 && /^[0158]+$/.test(chiffres) && !/\d$/.test(j)) return j.replace(/0/g, "o").replace(/1/g, "l").replace(/5/g, "s").replace(/8/g, "b");
  if (j.length <= 4 && /^[olis]+$/.test(lettres)) return j.replace(/o/g, "0").replace(/[li]/g, "1").replace(/s/g, "5");
  return j;
}

/** Préfixes et codes de type de navire, seulement EN TÊTE et seulement s'il reste un nom
 *  derrière : M/V, M/T, M/S, M/Y, S/Y, SS, FV, RV, LPG/C, LNG/C. */
const PREFIXES_NAVIRE = new Set(["mv", "mt", "ms", "my", "sy", "ss", "mts", "fv", "rv", "tb", "lpgc", "lngc", "tug", "barge", "tugboat"]);
const PHRASES_NAVIRE = [" motor vessel ", " motor tanker ", " motor ship ", " motor yacht ",
  " sailing yacht ", " steam ship ", " lpg carrier ", " lng carrier ", " lpg tanker ", " fishing vessel ",
  " bulk carrier ", " container ship ", " oil tanker ", " chemical tanker ", " hopper barge ", " tug barge "];
/** L'article arabe assimilé : « Ash-Shuraymi », « As-Salam », « Ad-Dawha » sont « Al ». */
const ARTICLES_ASSIMILES = new Set(["as", "ash", "ad", "adh", "ar", "at", "ath", "az", "an",
  /* à la française (Maghreb) : « Ech-Chourouk », « Er-Rahma » */ "ech", "es", "ed", "er", "et", "ez", "en"]);

/**
 * Les PAYS d'une forme juridique, quand elle en a. On retire la forme pour comparer les
 * noms, mais on garde ce qu'elle dit : « Wexmoor Engineering GmbH » et « Wexmoor Engineering
 * Inc. » sont deux sociétés, allemande et américaine. Une forme partagée par plusieurs pays
 * en porte plusieurs (S.R.L. : Italie, Roumanie, Argentine, Pérou…) ; il y a conflit quand
 * les deux ensembles sont DISJOINTS. Les formes de partout (Ltd, LLC, Co., Corp., S.A.,
 * Private Limited) n'en portent pas, et les TRADUCTIONS d'une même forme restent compatibles :
 * « OOO » et « LLC », « Co., Ltd. » et « Youxian Gongsi », « Pte. Ltd. » et « Private Limited ».
 */
const PAYS_DES_FORMES: ReadonlyMap<string, readonly string[]> = (() => {
  const t = new Map<string, string[]>();
  const poser = (pays: string[], formes: string[]) => { for (const f of formes) t.set(f, [...(t.get(f) ?? []), ...pays]); };
  poser(["DE", "AT", "CH"], ["gmbh", "ag", "gesellschaft mit beschrankter haftung", "aktiengesellschaft"]);
  poser(["DE", "AT"], ["kg", "ohg", "kommanditgesellschaft"]);
  poser(["DE"], ["ug"]);
  poser(["FR"], ["sasu", "eurl", "societe par actions simplifiee", "etablissements", "ets"]);
  poser(["FR", "LU", "MA", "TN", "LB"], ["sarl", "societe a responsabilite limitee"]);
  poser(["FR", "CO"], ["sas"]);
  poser(["FR", "IT"], ["snc"]);
  poser(["BE"], ["sprl", "bvba"]);
  poser(["NL"], ["bv", "vof", "besloten vennootschap"]);
  poser(["NL", "BE"], ["nv", "naamloze vennootschap"]);
  poser(["IT", "RO", "AR", "PE", "BO", "UY"], ["srl", "societa a responsabilita limitata"]);
  poser(["IT"], ["spa", "societa per azioni"]);
  poser(["ES"], ["sl", "slu", "sau", "sociedad limitada"]);
  poser(["MX"], ["sa de cv", "de cv", "cv", "sapi", "s de rl de cv", "s de rl"]);
  poser(["CZ", "SK"], ["spol s ro", "spol sro"]);
  poser(["PE"], ["sac", "saa", "sociedad anonima cerrada"]);
  poser(["BR", "CO", "CL", "PT"], ["ltda", "limitada", "sociedade limitada"]);
  poser(["BR"], ["eireli"]);
  poser(["RU", "BY", "KZ", "UZ", "UA", "KG", "TJ", "AM", "AZ", "GE"], ["ooo", "oao", "zao", "pao", "ao", "jsc", "pjsc", "ojsc", "cjsc", "too",
    "obshchestvo s ogranichennoi otvetstvennostyu", "obshchestvo s ogranichennoy otvetstvennostyu",
    "tovarishchestvo s ogranichennoi otvetstvennostyu", "publichnoe aktsionernoe obshchestvo",
    "zakrytoe aktsionernoe obshchestvo", "otkrytoe aktsionernoe obshchestvo", "aktsionernoe obshchestvo",
    "public joint stock company", "closed joint stock company", "open joint stock company", "joint stock company"]);
  poser(["TR"], ["sti", "anonim sirketi", "limited sirketi", "sirketi"]);
  poser(["TR", "NO", "DK", "EE"], ["as"]);
  poser(["NO"], ["asa"]); poser(["DK"], ["aps"]);
  poser(["AE", "SA", "QA", "BH", "KW", "OM"], ["fze", "fzco", "fzc", "fzllc", "fz", "wll", "spc", "est",
    "establishment", "establishments", "free zone establishment", "free zone company",
    "free zone limited liability company", "with limited liability"]);
  poser(["MY"], ["sdn", "bhd", "berhad", "sendirian berhad", "sendirian"]);
  poser(["SG"], ["pte"]);
  poser(["AU", "ZA"], ["pty", "proprietary limited"]);
  poser(["IN", "PK", "LK", "BD"], ["pvt"]);
  poser(["IN", "PK", "LK", "BD", "SG", "NG", "ZA", "AU", "NZ", "KE"], ["private limited"]);
  poser(["JP"], ["kk", "kabushiki kaisha", "kabushikigaisha", "godo kaisha", "yugen kaisha"]);
  poser(["KR"], ["chusik hoesa", "jusik hoesa", "jusikhoesa", "chusikhoesa"]);
  poser(["CN", "HK", "TW"], ["youxian gongsi", "gufen youxian gongsi", "youxian zeren gongsi"]);
  poser(["US", "CA", "PH"], ["inc", "incorporated", "pllc"]);
  poser(["CA"], ["ltee"]); poser(["SE"], ["aktiebolag"]); poser(["DK"], ["aktieselskab"]); poser(["NO"], ["aksjeselskap"]); poser(["FI"], ["osakeyhtio"]);
  poser(["UK", "IE", "NG", "LK", "ZA"], ["plc", "public limited company"]);
  poser(["PL"], ["sp zoo", "sp z oo", "spolka z ograniczona odpowiedzialnoscia", "spolka akcyjna", "spolka jawna"]);
  poser(["VN"], ["tnhh", "cong ty tnhh", "cong ty co phan"]);
  poser(["TH"], ["borisat chamkat", "borisat jamkat", "chamkat", "jamkat"]);
  poser(["IR"], ["sherkat", "sherkate"]);
  poser(["UA"], ["prat", "pat", "tov"]);
  poser(["RU", "BY", "KZ", "UA"], ["npp", "npo", "npk", "npf", "pkf", "nauchno proizvodstvennoe predpriyatie",
    "nauchno proizvodstvennoe obedinenie", "nauchno proizvodstvennyi kompleks", "nauchno proizvodstvennaya firma",
    "proizvodstvenno kommercheskaya firma", "proizvodstvennoe obedinenie"]);
  poser(["GR", "CY"], ["ae", "epe", "ike"]);
  poser(["FI"], ["oy", "oyj"]); poser(["SE"], ["ab"]); poser(["HU"], ["kft", "zrt", "nyrt"]);
  poser(["CZ", "SK"], ["sro"]); poser(["RS", "HR", "BA", "SI", "ME", "MK"], ["doo"]);
  poser(["BG", "RS", "MK"], ["ad"]); poser(["BG"], ["eood", "ood"]);
  return t;
})();

/**
 * LA FAMILLE d'une forme juridique : ce qu'elle dit de la société au-delà du pays. Une
 * « Limited » et une « S.A. de C.V. » ne sont pas la même personne morale même quand rien
 * ne dit leur pays ; une « LLC » et une « Pty Ltd » non plus. Les familles : ltd (société
 * privée à responsabilité limitée à l'anglaise), llc, corp (société par actions), part
 * (société de personnes), est (établissement individuel). Une forme que l'usage traduit de
 * plusieurs façons en porte plusieurs (« OOO » s'écrit LLC ou Ltd dans les documents russes ;
 * « K.K. » Co., Ltd., Corporation ou Inc.), et il y a conflit quand les deux ensembles sont
 * DISJOINTS. « Co. » et « Company » seuls n'en portent aucune.
 */
const FAMILLES_DES_FORMES: ReadonlyMap<string, readonly string[]> = (() => {
  const t = new Map<string, string[]>();
  const poser = (familles: string[], formes: string[]) => { for (const f of formes) t.set(f, [...(t.get(f) ?? []), ...familles]); };
  poser(["ltd"], ["ltd", "limited", "ltee", "pvt", "pte", "pty", "sdn", "sendirian", "sendirian berhad", "private limited",
    "proprietary limited", "youxian gongsi", "youxian zeren gongsi", "borisat chamkat", "borisat jamkat", "chamkat", "jamkat"]);
  poser(["ltd", "corp"], ["bhd", "berhad", "kk", "kabushiki kaisha", "kabushikigaisha", "jusikhoesa", "chusikhoesa",
    "chusik hoesa", "jusik hoesa", "gufen youxian gongsi", "oy", "ab", "aktiebolag", "aktieselskab", "aksjeselskap", "osakeyhtio"]);
  poser(["ltd", "llc"], ["ooo", "tov", "ltda", "limitada", "sociedade limitada", "eireli", "tnhh", "cong ty tnhh", "sti", "limited sirketi"]);
  /* le TOO kazakh (товарищество с ограниченной ответственностью) se traduit LLP, LLC ou Ltd */
  poser(["ltd", "llc", "part"], ["too", "tovarishchestvo s ogranichennoi otvetstvennostyu"]);
  poser(["llc"], ["llc", "pllc", "gmbh", "ug", "sarl", "eurl", "sprl", "bvba", "srl", "sl", "slu", "bv", "aps", "kft", "sro",
    "doo", "eood", "ood", "epe", "ike", "wll", "spc", "s de rl", "s de rl de cv",
    "limited liability company", "obshchestvo s ogranichennoi otvetstvennostyu", "obshchestvo s ogranichennoy otvetstvennostyu",
    "gesellschaft mit beschrankter haftung",
    "societe a responsabilite limitee", "sociedad limitada", "sociedad de responsabilidad limitada",
    "societa a responsabilita limitata", "besloten vennootschap", "sp zoo", "sp z oo", "spolka z ograniczona odpowiedzialnoscia",
    "godo kaisha", "yugen kaisha", "with limited liability", "spol s ro", "spol sro"]);
  /* la zone franche est un registre à part : une FZE et une LLC du même nom sont deux sociétés */
  poser(["fz"], ["fze", "fzco", "fzc", "fzllc", "fz", "free zone establishment", "free zone company",
    "free zone limited liability company"]);
  poser(["corp"], ["inc", "incorporated", "corp", "corporation", "plc", "public limited company", "ag", "se", "sa", "sas", "sasu",
    "spa", "sau", "nv", "oyj", "as", "asa", "zrt", "nyrt", "ad", "cv", "sapi", "sac", "saa", "oao", "zao", "pao", "ao", "jsc",
    "pjsc", "ojsc", "cjsc", "prat", "pat", "ae", "joint stock company", "public joint stock company", "closed joint stock company",
    "open joint stock company", "aktsionernoe obshchestvo", "publichnoe aktsionernoe obshchestvo",
    "zakrytoe aktsionernoe obshchestvo", "otkrytoe aktsionernoe obshchestvo", "aktiengesellschaft", "societe anonyme",
    "societe par actions simplifiee", "sociedad anonima", "sociedad anonima cerrada", "sociedade anonima",
    "societa per azioni", "naamloze vennootschap", "anonim sirketi", "spolka akcyjna", "cong ty co phan", "sa de cv", "de cv"]);
  poser(["part"], ["llp", "lp", "kg", "ohg", "snc", "vof", "limited liability partnership", "kommanditgesellschaft", "spolka jawna"]);
  poser(["est"], ["est", "establishment", "establishments", "sole proprietorship"]);
  return t;
})();

/** Les provinces et grandes villes de Chine, qui ouvrent le nom d'une société chinoise et s'omettent
 *  aussi souvent qu'elles se disent : « Fujian Quanzhou Xingtai Shoes » est « Quanzhou Xingtai Shoes ». */
const REGIONS: ReadonlySet<string> = new Set([
  "anhui", "beijing", "chongqing", "fujian", "gansu", "guangdong", "guangxi", "guizhou", "hainan", "hebei",
  "heilongjiang", "henan", "hubei", "hunan", "jiangsu", "jiangxi", "jilin", "liaoning", "neimenggu", "ningxia",
  "qinghai", "shaanxi", "shandong", "shanghai", "shanxi", "sichuan", "tianjin", "xinjiang", "xizang", "yunnan",
  "zhejiang", "hongkong", "macau", "taiwan", "shenzhen", "guangzhou", "dongguan", "foshan", "zhongshan", "ningbo",
  "hangzhou", "wenzhou", "yiwu", "suzhou", "wuxi", "nanjing", "qingdao", "yantai", "weifang", "xiamen", "quanzhou",
  "fuzhou", "wuhan", "changsha", "zhengzhou", "chengdu", "xian", "dalian", "shenyang", "harbin", "kunming", "nanning",
  "hefei", "jinan", "shijiazhuang", "taizhou", "jiaxing", "shaoxing", "zhuhai", "huizhou", "jiangmen", "shantou",
]);

/** Ce que la préparation a retiré, et qui reste une information ; et la LANGUE que le nom
 *  laisse voir (l'article arabe, une forme japonaise, une province chinoise), qui décide où
 *  les variations de romanisation sont créditées. */
export type Marques = { pays: readonly string[]; familles: readonly string[]; navire: boolean; societe: boolean;
  arabe: boolean; japonais: boolean; chinois: boolean };

const MARQUEURS_ARABES = new Set(["al", "el", "ul", "bin", "bint", "ibn", "abu", "abou", "abd", "abdul", "abdel", "abdal", "umm",
  "sharikat", "sharika", "shirkat", "muassasat", "moassasat", "muassasa", "tijara", "tijarah", "tijariya", "sherkat", "bazargani",
  "tejarat", "sanati", "lil", "wa", "bani", "dar", "beit", "bayt"]);
const MARQUEURS_JAPONAIS = new Set(["kk", "kabushiki", "kaisha", "kabushikigaisha", "godo", "yugen", "kogyo", "kougyou", "shoji",
  "shouji", "sangyo", "sangyou", "seisakusho", "boeki", "boueki", "denki", "kagaku", "seiko", "jidosha", "unyu", "kaiun", "kaihatsu",
  "tsusho", "maru"]);
const MARQUEURS_CHINOIS = new Set(["youxian", "gongsi", "gufen", "zeren", "maoyi", "jinchukou", "keji", "dianzi", "gongye", "shiye",
  "zhizao", "jituan", "guoji", "wuliu", "huoyun", "hangyun", "jixie", "huagong", "fangzhi", "fuzhuang", "shipin", "jinshu",
  "gangtie", "suliao", "jianzhu", "nengyuan", "fazhan", "touzi", "kongzhi", "konggu", "shangmao", "jingmao", "luntai"]);

/**
 * Un nom de société ou de navire, prêt pour la comparaison. Les lettres isolées successives
 * sont d'abord rejointes (« F.Z.E. » → « fze », « M/V » → « mv », « A.K. » → « ak ») pour
 * que la ponctuation ne décide de rien. Jamais vide : un nom fait tout entier de formes
 * juridiques (« Company Limited ») se rend normalisé plutôt que de disparaître.
 */
export function preparerEntite(nom: string): string {
  return analyserEntite(nom).texte;
}

/** La préparation, avec ce qu'elle a retiré (les pays des formes juridiques, un préfixe de
 *  navire, une forme de société) et les mots que leur auteur a ABRÉGÉS d'un point. */
export function analyserEntite(nom: string): { texte: string; abreges: ReadonlySet<string>; parentheses: ReadonlySet<string> } & Marques {
  /* L'apostrophe DANS un mot le soude (« O'Brien », « Ch'iao ») : en faire une frontière
     de mot fabriquerait des jetons d'une ou deux lettres qui ne désignent rien. « F.lli »
     (fratelli) et « LPG/C » (LPG carrier) ont une ponctuation qui porte le sens : lus avant. */
  const soude = plier(nom)
    .replace(/int'l/gi, "international").replace(/\bF\.lli\b/gi, "Fratelli")
    /* « Mt. » et « Ft. » avec leur point sont Mount et Fort ; sans point, « MT » est un pétrolier */
    .replace(/^Mt\.\s+/i, "Mount ").replace(/\bFt\.\s+/gi, "Fort ")
    /* « S.à r.l. », « S.à.r.l. » : la forme luxembourgeoise et française, avec son accent et
       son espace, que le sigle général ne reconnaît pas */
    .replace(/\bS\.?\s?[àa]\.?\s?r\.?\s?l\.?(?!\p{L})/giu, "SARL")
    /* « (P) Ltd. » et « (Pvt.) Ltd. », la société privée indienne : une forme, pas une filiale */
    .replace(/\(\s*P(?:vt)?\.?\s*\)\s*(?=Ltd|Limited)/gi, "Pvt ")
    .replace(/\b(LPG|LNG)\s*\/\s*C\b/gi, "$1C")
    .replace(/(\p{L})['’ʼ`](\p{L})/gu, "$1$2")
    /* Les lettres séparées par un point ou une barre forment UN sigle (« S.A. », « F.Z.E. »,
       « M/V », « A.K. ») : on les soude ici, sur le texte, parce qu'après la normalisation une
       espace et un point se confondent, et « Holdings I S.A. » devenait « Holdings ISA » (le
       numéro I fondu dans la forme, mesuré le 27/09 contre « Holdings III S.A. »). */
    .replace(/(?<!\p{L})\p{L}(?:[./]\s?\p{L}(?!\p{L}))+\.?/gu, (m) => m.replace(/[./\s]/g, ""));
  /* Un mot suivi d'un point est une ABRÉVIATION écrite comme telle (« Petrochem. », « Dist. »,
     « Capt. ») : le mot entier qu'il commence lui correspond (voir `scorePrepares`). */
  const abreges = new Set([...soude.matchAll(/(\p{L}{2,})\./gu)].map((m) => normaliser(m[1]!)));
  /* Les mots ENTRE PARENTHÈSES : « Quarnby Logistics (Shanghai) », « Tervalo Shipping (Hong
     Kong) ». Dans un nom de société, la parenthèse désigne le plus souvent une entité du
     groupe, distincte ; si l'autre nom n'a rien qui y réponde, on ne parle pas de la même
     (voir `scorePrepares`). Les mêmes tables que le nom entier, pour retrouver ces mots
     tels que la préparation les laisse. */
  const parentheses = new Set([...soude.matchAll(/\(([^()]+)\)/g)]
    .flatMap((m) => jetons(normaliser(plier(m[1]!))).flatMap((j) => (ABREVIATIONS.get(j) ?? TRADUCTIONS.get(j) ?? j).split(" ")))
    .filter((j) => j !== "" && !FORMES.has(j)));
  /* Lettres et chiffres collés se séparent : « No18 » → « No 18 », « LANQIAOFENG16 » →
     « LANQIAOFENG 16 » ; le numéro d'un navire devient un jeton que la règle des numéros lit. */
  const brut = jetons(jetons(normaliser(soude)).map(ocr).join(" ")
    .replace(/(\p{L})(\d)/gu, "$1 $2").replace(/(\d)(\p{L})/gu, "$1 $2"));
  const joints = brut;
  /* « No. », « Nr. », « Number » devant un numéro ne sont que le mot « numéro ». */
  const sansNo = joints.filter((j, i) => !(/^(no|nr|num|number)$/.test(j) && /^\d+$/.test(joints[i + 1] ?? "")));
  /* L'article arabe assimilé devient « al » AVANT le retrait des formes : sinon « As »
     d'« As-Salam » partirait comme une forme juridique. */
  const articles = sansNo.map((j, i) =>
    ARTICLES_ASSIMILES.has(j) && i + 1 < sansNo.length && sansNo[i + 1]!.startsWith(j.slice(1)) ? "al" : j);
  let texte = ` ${articles.join(" ")} `;
  /* une locution dont les mots portent un point d'abréviation (« Imp. e Exp. », « San. ve
     Tic. ») se développe, et ses mots développés gardent la marque : « import » abrégé lit
     encore « importadora », « sanayi » lit « sanayi » */
  for (const [de, vers] of LOCUTIONS) {
    if (!texte.includes(de)) continue;
    if (de.trim().split(" ").some((m) => abreges.has(m))) for (const m of vers.trim().split(" ")) abreges.add(m);
    texte = texte.split(de).join(vers);
  }
  let navire = false;
  for (const p of PHRASES_NAVIRE) {
    if (texte.startsWith(p) && texte.length > p.length) { navire = true; texte = " " + texte.slice(p.length); }
  }
  const pays = new Set<string>();
  const familles = new Set<string>();
  let societe = false;
  /* « Co., Ltd. », les deux mots ensemble, est la forme des sociétés d'Asie de l'Est et du
     Sud-Est (有限公司, 株式会社, 주식회사, TNHH) : une « Sdn. Bhd. » ou une « GmbH » du même nom
     est une autre société (mesuré le 27/09 sur le jeu 5) */
  if (/ co (ltd|limited) /.test(texte)) for (const k of ["CN", "HK", "TW", "MO", "JP", "KR", "TH", "VN", "ID", "MM", "KH"]) pays.add(k);
  for (const p of PHRASES) {
    if (!texte.includes(p)) continue;
    societe = true;
    for (const k of PAYS_DES_FORMES.get(p.trim()) ?? []) pays.add(k);
    for (const k of FAMILLES_DES_FORMES.get(p.trim()) ?? []) familles.add(k);
    texte = texte.split(p).join(" ");
  }
  const mots = texte.trim().split(/ +/).flatMap((j) => (j === "i" ? j : (ABREVIATIONS.get(j) ?? TRADUCTIONS.get(j) ?? j)).split(" "));
  /* « IP Tavrizyan A.G. » : l'entrepreneur individuel russe (ИП), ukrainien (ФОП, ЧП),
     kazakh (ИП) porte un NOM DE PERSONNE et ses initiales ; « A.G. » n'y est pas une
     Aktiengesellschaft. Après ce sigle, les mots courts restent des mots. */
  const entrepreneur = ["ip", "fop", "chp", "flp", "spd"].includes(mots[0] ?? "");
  let t = mots.filter((j, i) => {
    if (j === "") return false;
    if (!FORMES.has(j)) return true;
    if (entrepreneur && i > 0 && j.length <= 3) return true;
    if (i === 0 && FORMES_FINALES.has(j) && mots.length > 1) return true;
    societe = true;
    for (const k of PAYS_DES_FORMES.get(j) ?? []) pays.add(k);
    for (const k of FAMILLES_DES_FORMES.get(j) ?? []) familles.add(k);
    return false;
  });
  if (t.length > 1 && PREFIXES_NAVIRE.has(t[0]!)) { navire = true; t = t.slice(1); }
  /* « i » (« et », en serbe, croate, polonais) ne s'efface qu'ENTRE deux mots : en dernière
     position, formes juridiques ôtées, c'est le chiffre romain I (« Holdings I S.A. », mesuré
     le 27/09 : il disparaissait et « Holdings I » ne se distinguait plus de « Holdings III ») */
  t = t.filter((j, i) => j !== "i" || i === t.length - 1);
  const tousLesMots = mots;
  const arabe = /[\u0600-\u06ff]/.test(nom) || tousLesMots.some((j) => MARQUEURS_ARABES.has(j));
  const japonais = tousLesMots.some((j) => MARQUEURS_JAPONAIS.has(j));
  const chinois = pays.has("CN") || REGIONS.has(t[0] ?? "") || tousLesMots.some((j) => MARQUEURS_CHINOIS.has(j));
  return { texte: t.length > 0 ? t.join(" ") : normaliser(soude), abreges, parentheses,
    pays: [...pays].sort(), familles: [...familles].sort(), navire, societe, arabe, japonais, chinois };
}

/** Les jetons d'un nom brut : préparation d'entité, puis le pipeline commun des paliers
 *  (translittération des écritures cyrillique et arabe comprise). */
export function jetonsEntite(nom: string): string[] {
  return jetons(preparer(preparerEntite(nom)));
}

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
const DICTIONNAIRE: ReadonlySet<string> = new Set(
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
  return r;
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
 */
export function motsDistincts(a: string, b: string): boolean {
  const a2 = BRITANNIQUE.get(a) ?? a, b2 = BRITANNIQUE.get(b) ?? b;
  if (a2 === b2 || a2.length < 4 || b2.length < 4) return false;
  if (lemme(a2) === undefined || lemme(b2) === undefined) return false;
  if (voyellesRomanes(a2) === voyellesRomanes(b2)) return false;
  const ra = racines(a2), rb = racines(b2);
  return !rb.some((r) => ra.includes(r));
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
function numero(j: string): string | undefined {
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
    /* orthographes britannique et américaine : harbour, centre, catalogue, cheque */
    .replace(/our$/, "or").replace(/re$/, "er").replace(/ogue$/, "og").replace(/que$/, "k")
    /* les digrammes d'abord : chacun rend UNE consonne, avant que les lettres simples bougent */
    .replace(/^hs/, "x").replace(/^dj/, "j")
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
    .replace(/w/g, "v").replace(/q/g, "k").replace(/g/g, "k").replace(/b/g, "p").replace(/d/g, "t").replace(/[yj]/g, "i")
    /* les voyelles : eo coréen, ou et oo (u), ue et oe (ü, ö, ø), ae (ä, æ), les finales -ah, -eh, -e */
    .replace(/eo/g, "o").replace(/(ou|oo|ue)/g, "u").replace(/oe/g, "o").replace(/ae/g, "a")
    .replace(/(ah|eh)$/, (x) => x[0]!).replace(/(?<=.{3})e$/, "")
    .replace(/(.)\1+/g, "$1");
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
function syllabeChinoise(mot: string): string {
  if (mot.length > 6 || !/^[bcdfghjklmnpqrstwxyz]{0,3}[aeiou]{1,3}(?:ng|n|r)?$/.test(mot)) return mot;
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
export function variationVocalique(sqA: string, sqB: string): boolean {
  if (sqA.length !== sqB.length || sqA === sqB) return false;
  /* une voyelle ; deux à partir de sept lettres (« mohamed », « muhamad ») */
  const tolere = sqA.length >= 7 ? 2 : 1;
  /* seules les paires qu'une romanisation confond : a, e, i entre elles ; o et u entre eux.
     a et u ne se confondent pas (« Jinyang », « Jinyoung » sont deux noms, mesuré le 27/09) */
  const classe = (c: string) => ("aei".includes(c) ? "a" : "ou".includes(c) ? "o" : "");
  let ecarts = 0;
  for (let i = 0; i < sqA.length; i++) {
    if (sqA[i] === sqB[i]) continue;
    const ca = classe(sqA[i]!), cb = classe(sqB[i]!);
    if (ca === "" || ca !== cb || ++ecarts > tolere) return false;
  }
  return ecarts >= 1;
}

/** Un nom préparé UNE fois : ses mots, leurs poids, leurs clés, ses numéros, son bloc. */
export type NomPrepare = {
  mots: readonly string[]; poids: readonly number[]; total: number;
  /** le poids d'un mot qu'aucune liste ne porte : l'échelle de la rareté */
  poidsMax: number;
  squelettes: readonly string[]; replis: readonly string[];
  /** les mots que leur auteur a abrégés d'un point (« Petrochem. ») */
  abreges: readonly boolean[];
  /** les mots écrits entre parenthèses (« (Shanghai) ») */
  parentheses: readonly boolean[];
  numeros: string; bloc: string;
  /** le bloc des squelettes : la comparaison des mots collés s'y fait, pour que « Aldeeb »
   *  et « Al Dheeb » ne paient pas leur romanisation en plus de leur espace */
  blocSq: string;
  marques: Marques;
};

const SANS_MARQUES: Marques = { pays: [], familles: [], navire: false, societe: false, arabe: false, japonais: false, chinois: false };

export function preparerNom(f: Frequences, nom: string): NomPrepare {
  const a = analyserEntite(nom);
  return depuisJetons(f, jetons(preparer(a.texte)),
    { pays: a.pays, familles: a.familles, navire: a.navire, societe: a.societe, arabe: a.arabe, japonais: a.japonais, chinois: a.chinois },
    a.abreges, a.parentheses);
}

export function depuisJetons(f: Frequences, J: readonly string[], marques: Marques = SANS_MARQUES,
  abreges: ReadonlySet<string> = new Set(), parentheses: ReadonlySet<string> = new Set()): NomPrepare {
  /* Un chiffre romain n'est un NUMÉRO qu'en fin de nom (« Karina II », « Star I ») : au milieu,
     « I » est un mot (« Shun I Fa », le « yi » chinois en Wade-Giles, mesuré le 27/09 : la
     règle des numéros le lisait « 1 » et rendait 0 face à « Shun Yi Fa No. 232 »). */
  const num = (j: string, i: number) => /^\d+$/.test(j) ? String(Number(j)) : i === J.length - 1 ? numero(j) : undefined;
  const mots = J.filter((j, i) => !num(j, i));
  const poids = mots.map((m) => poidsDuMot(f, m));
  return {
    mots, poids, total: poids.reduce((s, p) => s + p, 0), poidsMax: poidsDuMot(f, "\u0000"),
    squelettes: mots.map(squelette),
    replis: mots.map((m) => voyelles(squelette(m))),
    abreges: mots.map((m) => abreges.has(m)),
    parentheses: mots.map((m) => parentheses.has(m)),
    numeros: J.map(num).filter(Boolean).sort().join(" "),
    bloc: mots.join(""), blocSq: mots.map(squelette).join(""),
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
export function simMot(a: string, b: string, sqA: string, sqB: string): number {
  if (a === b) return 1;
  if (abrege(a, b) || abrege(b, a)) return 0.9;
  if (motsDistincts(a, b)) return 0.5;
  if (sqA === sqB) return 0.95;
  /* la longueur seule tranche : deux mots dont les longueurs diffèrent de moitié ne se
     rapprochent jamais au-dessus de 0,5, et la distance d'édition n'a pas à se calculer */
  const L = Math.max(a.length, b.length), Ls = Math.max(sqA.length, sqB.length);
  const ecrit = Math.abs(a.length - b.length) * 2 > L ? 0
    : Math.max(0, 1 - (distanceOsa(a, b) + (a[0] === b[0] ? 0 : 1)) / L);
  const romanise = Math.abs(sqA.length - sqB.length) * 2 > Ls ? 0
    : Math.max(0, Math.min(0.95, 1 - (distanceOsa(sqA, sqB) + (sqA[0] === sqB[0] ? 0 : 1)) / Ls));
  return Math.max(ecrit, romanise);
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

/** Le dernier mot d'un nom coupé par un champ de longueur fixe (35 caractères dans un
 *  message de paiement) est un DÉBUT de mot : « Engineer » pour « Engineering ». Vrai à
 *  partir de quatre lettres, et seulement pour le dernier mot. */
export function tronque(dernier: string, long: string): boolean {
  if (long.length <= dernier.length || !long.startsWith(dernier)) return false;
  /* trois lettres suffisent quand le mot entier est long (« Pro » pour « Prosperity ») */
  return dernier.length >= 4 || (dernier.length === 3 && long.length >= 7);
}

/**
 * Ce qu'un mot apporte au score : sa similarité, TRANCHÉE. Un mot à moitié ressemblant
 * (« north » et « south », 0,6) n'est pas à moitié le même mot : il est un autre mot. Sous
 * 0,5 un mot n'apporte rien ; au-dessus, l'écart à 1 compte double.
 */
export function apport(sim: number): number {
  return sim >= 1 ? 1 : Math.max(0, (sim - 0.5) / 0.5);
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
  if (A.mots.length === 0 || B.mots.length === 0) {
    return A.mots.length === B.mots.length && A.numeros === B.numeros && A.numeros !== "" ? 1 : 0;
  }
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
  /* la variation de voyelle et le repli ne sont crédités que là où une romanisation les
     produit : l'arabe et le persan (a, e, i ; o, u), le japonais (ō, ū : o, ou, oo, u). En
     allemand, en espagnol, en vietnamien, en chinois, une voyelle de plus ou de moins est un
     autre mot (Meier, Mayer ; Solaris, Solares ; Phuong, Phong ; Jinyang, Jinyoung : mesuré) */
  const romanisation = A.marques.arabe || B.marques.arabe || A.marques.japonais || B.marques.japonais;
  /* en pinyin, l'initiale est un phonème : Jin n'est pas Yin, Chang n'est pas Shang ; seules les
     paires d'aspiration du Wade-Giles se confondent (k, g ; t, d ; p, b ; ts, z, c ; ch, zh, j, q ; hs, x) */
  const chinois = A.marques.chinois || B.marques.chinois;
  const memo = options.memo;
  const cote = (X: NomPrepare, Y: NomPrepare, cote: 0 | 1) => {
    let s = 0;
    for (let i = 0; i < X.mots.length; i++) {
      let m = 0, meilleurY = -1;
      const dernierX = i === X.mots.length - 1;
      for (let j = 0; j < Y.mots.length && m < 1; j++) {
        const x = X.mots[i]!, y = Y.mots[j]!;
        const dernierY = j === Y.mots.length - 1;
        /* la clé porte tout ce qui décide : les deux mots, leurs marques d'abréviation, et
           leur position de dernier mot (la troncature ne vaut que pour lui) */
        const cle = memo ? `${x}|${y}|${X.abreges[i] ? 1 : 0}${Y.abreges[j] ? 1 : 0}${dernierX ? 1 : 0}${dernierY ? 1 : 0}${romanisation ? 1 : 0}${chinois ? 1 : 0}` : "";
        let v = memo?.get(cle);
        if (v === undefined) {
          v = simMot(x, y, X.squelettes[i]!, Y.squelettes[j]!);
          const autreSyllabe = chinois && x !== y && !initialesChinoisesCompatibles(x, y);
          if (autreSyllabe) v = Math.min(v, 0.5);
          if (!autreSyllabe && romanisation && v < CREDIT_ROMANISATION && !tousDeuxAnglais(x, y)
            && (X.replis[i] === Y.replis[j] || variationVocalique(X.squelettes[i]!, Y.squelettes[j]!))) v = CREDIT_ROMANISATION;
          /* un mot abrégé d'un point correspond au mot entier qu'il commence, ou dont il garde
             les lettres dans l'ordre depuis l'initiale (« Petrochem. », « Dist. », « Capt. ») ;
             dans les DEUX sens, sinon le côté entier ne rendait qu'un demi-crédit */
          if (v < 0.9 && X.abreges[i] && x.length < y.length && (y.startsWith(x) || abrege(x, y))) v = 0.9;
          if (v < 0.9 && Y.abreges[j] && y.length < x.length && (x.startsWith(y) || abrege(y, x))) v = 0.9;
          if (v < 0.9 && dernierX && tronque(x, y)) v = 0.9;
          if (v < 0.9 && dernierY && tronque(y, x)) v = 0.9;
          memo?.set(cle, v);
        }
        if (v > m) { m = v; meilleurY = j; }
      }
      if (m < 0.8) orphelins[cote] = true;
      /* un mot géographique en tête (« Fujian Quanzhou Xingtai Shoes ») n'est pas un mot en
         trop : la province se dit ou s'omet pour la même société chinoise */
      if (m < 0.8 && X.poids[i]! >= SEUIL_RARE * X.poidsMax && !(i === 0 && REGIONS.has(X.mots[i]!))) orphelinRare = true;
      if (m > 0.5 && m < 0.9 && m !== CREDIT_ROMANISATION && X.mots[i]!.length <= 8 && meilleurY >= 0
        && !lemme(X.mots[i]!) && !lemme(Y.mots[meilleurY]!)) motAmbigu = true;
      if (m >= 0.9 && X.poids[i]! >= 0.5 * X.poidsMax) rareCouvert[cote] = true;
      if (X.parentheses[i]) { parenthese[cote] = true; if (m >= 0.8) parentheseReconnue[cote] = true; }
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
  let s = (cA + cB) / (A.total + B.total);
  /* UN MOT ORPHELIN DE CHAQUE CÔTÉ (« Logistics » contre « Engineering », « Nigeria » contre
     « Ghana ») : les deux noms ont chacun ce que l'autre n'a pas, c'est la signature d'une
     société sœur, pas d'une graphie. Un mot en trop d'un seul côté (un nom abrégé, un nom
     coupé) ne déclenche rien. */
  if (orphelins[0] && orphelins[1]) s *= 0.9;
  if (orphelinRare || motAmbigu) s = Math.min(s, FACTEUR_CONTENANCE);
  if (A.mots.length !== B.mots.length) {
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
    const meilleur = Math.max(similitude(A.bloc, B.bloc), Math.min(0.95, similitude(A.blocSq, B.blocSq)));
    if (meilleur >= BLOC_MIN) s = Math.max(s, meilleur);
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
  /* un numéro d'un seul côté, des marques en conflit, une filiale : la méthode a une raison
     précise de douter, et le candidat se range au niveau POSSIBLE, quelle que soit la
     ressemblance des mots ; il n'est pas effacé (un groupe ouvre des homonymes ailleurs) */
  return A.numeros === B.numeros && !marquesEnConflit(A.marques, B.marques) && !filiale ? s : Math.min(s, FACTEUR_CONTENANCE);
}

export const FACTEUR_CONTENANCE = 0.8;
/** Un mot est RARE quand son poids atteint cette part du poids d'un mot inconnu des listes :
 *  « Shipping » (439 entrées sur 33 393) l'est tout juste, « Trading » (826) ne l'est pas. */
export const SEUIL_RARE = 0.45;
/** Le bloc (mots collés ou coupés) ne compte qu'à partir de cette similarité. */
export const BLOC_MIN = 0.8;

/**
 * Deux noms que leurs marques disent différents : des formes juridiques de pays DISJOINTS
 * (« GmbH » contre « Inc. »), de familles disjointes (« Limited » contre « S.A. de C.V. »),
 * ou un navire (préfixe « M/V ») contre une société (forme juridique). Comme un numéro d'un seul côté, le conflit abaisse (× 0,8), il n'annule pas :
 * un groupe sanctionné ouvre des homonymes ailleurs, et le relecteur doit les voir.
 */
export function marquesEnConflit(a: Marques, b: Marques): boolean {
  if (a.pays.length && b.pays.length && !a.pays.some((p) => b.pays.includes(p))) return true;
  if (a.familles.length && b.familles.length && !a.familles.some((p) => b.familles.includes(p))) return true;
  return (a.navire && b.societe) || (b.navire && a.societe);
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
  return /^\p{L}/u.test(suite) && !/^(?:\d+|[ivx]+)(?![\p{L}])/u.test(suite);
}

/** Le score de deux noms BRUTS, déjà préparés, règle du champ de 35 comprise. */
export function scoreBrut(f: Frequences, a: string, A: NomPrepare, b: string, B: NomPrepare, options: OptionsScore = {}): number {
  let s = scorePrepares(A, B, options);
  const ta = a.trim(), tb = b.trim();
  if (sembleCoupe(ta, tb)) s = Math.max(s, scorePrepares(A, preparerNom(f, tb.slice(0, ta.length)), options));
  if (sembleCoupe(tb, ta)) s = Math.max(s, scorePrepares(preparerNom(f, ta.slice(0, tb.length)), B, options));
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
const ANNONCES = /\s*(?:\b(?:a\.?\s?k\.?\s?a\.?|f\/?\s?k\/?\s?a\.?|formerly(?:\s+known\s+as)?|d\/?\s?b\/?\s?a\.?|doing\s+business\s+as|t\/a|trading\s+as)(?=[\s:])|(?<=\p{L}[\s,]*)\bex[-.\s]+(?=\p{L}))\s*:?\s*/giu;
const ANNOTATIONS: readonly RegExp[] = [
  /\([^()]*\b(?:flag|liquidation|administration|receivership|bankrupt\w*|dissolved|struck\s+off|carrier|tanker|vessel|bulk|container|branch)\b[^()]*\)/giu,
  /\s*[-–,;(]\s*[\p{L}. ]{2,25}\bflag(?:ged)?\)?\s*$/iu,
  /,\s*[^,]*\bbranch\b.*$/iu,
  /\s+branch$/iu,
  /[\s,]+p\.?\s*o\.?\s*box\b.*$/iu,
  /\s+(?:in|under)\s+(?:liquidation|administration|receivership)$/iu,
  /\(\s*(?:in\s+)?(?:lay-?up|laid\s+up|for\s+scrap|scrapped|arrested|detained|under\s+arrest|idle)\s*\)$/iu,
  /\s+c\/o\s+.*$/iu,
  /* les partenaires d'une société de personnes italienne : « S.n.c. di Perrone Luigi & C. » */
  /\s+di\s+[\p{L}.' ]+&\s*c\.?\s*$/iu,
  /\s+v\.?\s?\d{2,4}[nsew]?$/iu,
  /\s+\d{3,4}[nsew]$/iu,
  /\s+(?:bulk\s+carrier|lng\s+carrier|lpg\s+carrier|oil\s+tanker|chemical\s+tanker|container\s+ship|general\s+cargo)$/iu,
  /* un code pavillon à trois lettres entre parenthèses en fin de nom : (MHL), (PAN), (LBR).
     Deux lettres ((UK), (HK)) restent : c'est le plus souvent une filiale. */
  /\s*\([A-Z]{3}\)\s*$/u,
];
/** Les pavillons de complaisance et registres de navires, en anglais, tels que la normalisation
 *  les laisse. PAS les pays où une société ouvre des filiales (Singapore, Hong Kong, China, UK,
 *  USA, Germany…) : « Blue Star Shipping (Singapore) » est une filiale, « OCEAN LARKSPUR
 *  (PANAMA) » un pavillon. */
const PAVILLONS: ReadonlySet<string> = new Set(["panama", "liberia", "marshall islands", "malta", "bahamas", "cyprus",
  "bermuda", "cayman islands", "cayman", "antigua", "antigua and barbuda", "st kitts", "st kitts and nevis", "st vincent",
  "st vincent and the grenadines", "vanuatu", "cook islands", "tuvalu", "palau", "sierra leone", "togo", "cameroon", "gabon",
  "comoros", "tanzania", "mongolia", "belize", "honduras", "bolivia", "cambodia", "moldova", "gibraltar", "isle of man",
  "madeira", "curacao", "jamaica", "barbados", "dominica", "san marino", "faroe islands", "jersey", "guernsey", "bvi",
  "british virgin islands", "kiribati", "samoa", "niue", "sao tome", "sao tome and principe", "gambia", "guinea bissau",
  "mhl", "pan", "lbr", "mlt", "bhs", "cyp", "atg", "vut", "khm", "tgo", "cmr", "gab", "sle", "tza", "mng", "blz", "hnd", "bol"]);

export function variantes(brut: string): string[] {
  const vues = new Set<string>([brut.trim()]);
  /* les suffixes SWIFT à la barre oblique (« LUCENT CORRIDOR/V.088W/HK », « …CO LTD/NANNING/CN ») :
     retirés un à un tant qu'il reste deux mots devant */
  let sansBarres = brut.trim();
  while (/\/[^\s/]{1,20}$/.test(sansBarres) && sansBarres.replace(/\/[^\s/]{1,20}$/, "").trim().split(/\s+/).length >= 2) {
    sansBarres = sansBarres.replace(/\/[^\s/]{1,20}$/, "").trim();
  }
  if (sansBarres !== brut.trim()) brut = sansBarres;
  /* un nom annoncé entre parenthèses : « LUNARIS DAWN (EX-SELVANA) » */
  const sansParentheseAnnoncee = brut.replace(
    /\(\s*(?:ex[-.\s]+|f\/?k\/?a\.?\s*|formerly\s+(?:known\s+as\s+)?|a\.?k\.?a\.?\s*)([^()]*)\)/giu, (_, x: string) => ` | ${x} `);
  const parties = sansParentheseAnnoncee.split("|").flatMap((p) => p.split(ANNONCES))
    .map((p) => p.trim()).filter((p) => p.length > 0);
  for (let p of parties) {
    let avant: string;
    do { avant = p; for (const r of ANNOTATIONS) p = p.replace(r, "").trim(); } while (p !== avant);
    /* une adresse derrière la forme juridique : « … FZE, Jebel Ali Free Zone, Dubai »,
       « … B.V., ROTTERDAM » ; ou, derrière un nom de navire, son port d'immatriculation en un
       ou deux mots : « SIROCCO MARINER, MONROVIA » */
    const virgule = p.indexOf(",");
    if (virgule > 0) {
      const tete = p.slice(0, virgule), queue = p.slice(virgule + 1).trim();
      const dernier = jetons(normaliser(tete.replace(/(?<!\p{L})\p{L}(?:[./]\s?\p{L}(?!\p{L}))+\.?/gu, (m) => m.replace(/[./\s]/g, "")))).at(-1) ?? "";
      const motsQueue = jetons(normaliser(queue.replace(/(?<!\p{L})\p{L}(?:[./]\s?\p{L}(?!\p{L}))+\.?/gu, (m) => m.replace(/[./\s]/g, ""))));
      const queueEstForme = motsQueue.length > 0 && motsQueue.every((m) => FORMES.has(m) || m === "de" || m === "z" || m === "oo");
      const queuePorteUneForme = motsQueue.some((m) => FORMES.has(m));
      /* derrière une forme : l'adresse s'ôte ; sans forme devant, un ou deux mots sans forme
         derrière la virgule sont un port ou une ville (« SIROCCO MARINER, MONROVIA »), mais
         « Marks, Spencer Ltd » garde Spencer : la forme est dans la queue */
      if (queue.length > 0 && !queueEstForme && (FORMES.has(dernier)
        || (!queuePorteUneForme && /^[\p{L} .'-]{2,30}$/u.test(queue) && motsQueue.length <= 2 && !p.includes("&")
          && tete.trim().split(/\s+/).length >= 2))) p = tete.trim();
    }
    /* un pays entre parenthèses en fin de nom de navire : « OCEAN LARKSPUR (PANAMA) » ; pour une
       société, la même parenthèse serait une filiale, mais aucune forme ne la suit ici */
    p = p.replace(/\s*\(\s*([\p{L} ]{3,30})\s*\)\s*$/u, (m, pays: string) => (PAVILLONS.has(normaliser(pays)) ? "" : m)).trim();
    if (p.length > 0 && /\p{L}/u.test(p)) vues.add(p);
  }
  return [...vues];
}

/** Le score de deux noms BRUTS : le meilleur sur toutes leurs variantes. */
export function scoreNoms(f: Frequences, a: string, b: string): number {
  let meilleur = 0;
  for (const va of variantes(a)) {
    const A = preparerNom(f, va);
    for (const vb of variantes(b)) meilleur = Math.max(meilleur, scoreBrut(f, va, A, vb, preparerNom(f, vb)));
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

/** Le plancher du rappel, à la borne BASSE de Wilson : un criblage qui rate un nom listé
 *  coûte plus cher que dix alertes à relire, donc on exige d'abord de ne pas rater. */
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
