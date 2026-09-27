/**
 * LA PRÉPARATION D'UN NOM D'ENTITÉ ET SES TABLES : formes juridiques, phrases, locutions, traductions,
 * particules, abréviations, marqueurs de langue, préfixes de navires ; analyserEntite, preparerEntite, jetonsEntite.
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
import { DEVANAGARI } from "./devanagari.ts";
import { wadeGiles } from "./wadegiles.ts";
/* une déclaration de fonction : elle traverse le cycle mots.ts → preparation.ts, et n'est appelée qu'à la première demande */
import { pliJaponais } from "./mots.ts";
import { pliSlave, clesSlaves } from "./mots.ts";
import { traductionNordique, estFinnois, GENITIFS_FINNOIS } from "./nordique.ts";
import { GRAPHIES_INDIENNES } from "./indien.ts";
import { TRADUCTIONS_SWAHILIES } from "./swahili.ts";
import { estVietnamien, LOCUTIONS_VIETNAMIENNES } from "./vietnamien.ts";
import { lireArabizi } from "./arabizi.ts";
import { lemme } from "./mots.ts";
import { porteUnJalon } from "./score.ts";
import { lettrePerdue } from "./score.ts";
import { LU_UN } from "./score.ts";
import { PERDU } from "./score.ts";
import { PAYS_ADJECTIFS } from "./variantes.ts";
import { SIGLES_PAYS } from "./variantes.ts";

/* ─────────────────────────── la préparation ─────────────────────────── */

/** Formes juridiques d'un mot, telles que la normalisation les laisse (minuscules, sans
 *  points, lettres isolées rejointes : « S.A. » → « sa », « A.Ş. » → « as »). « Compañía »,
 *  « Compagnie », « Cía », « Cie » et « Établissements » sont le mot « société » : retirés
 *  comme lui. */
export const FORMES = new Set([
  /* anglophones */ "llc", "pllc", "ltd", "limited", "ltee", "inc", "incorporated", "corp", "corporation",
  "co", "company", "plc", "llp", "lp", "pvt", "pte", "pty",
  /* « Corporación » et « Corporação » en tête d'un nom hispanophone ou lusophone sont le « Corp. » que le nom d'usage
     abrège (jeu 11, 27/09 : « Corporación Marítima del Pacífico Central » à 0,800 face à « Corp. Marítima … »,
     « corporacion » mot rare sans répondant) : la même désignation que « Corporation » (voir DESIGNATIONS) */
  "corporacion", "corporacao",
  /* le mot « société » */ "compania", "companhia", "compagnie", "cia", "cie", "etablissements", "ets",
  "establishment", "establishments", "societe", "ste", "sociedad", "sociedade", "borisat", "sherkat", "sherkate", "sharikat", "sharika",
  "shirkat", "shirka", "aktiebolag", "aktieselskab", "aksjeselskap", "osakeyhtio", "scea", "gaec", "earl", "dac",
  "pcl", "teoranta", "teo", "cuideachta", "sapi", "sau",
  /* Europe ; « mbH » est le « GmbH » d'une « Gesellschaft mbH » ou « Handelsgesellschaft mbH » ; « KGaA », « GbR »,
     « SCE » sont des sociétés de personnes et de coopérateurs ; « Lda » la Limitada portugaise, angolaise, mozambicaine */
  "mbh", "kgaa", "gbr", "sce", "lda",
  /* Europe */ "gmbh", "kg", "ohg", "ug", "ag", "se", "sa", "sas", "sasu", "sarl", "eurl", "snc",
  "sprl", "bvba", "srl", "spa", "sl", "slu", "sau", "bv", "nv", "vof", "oy", "oyj", "ab", "as",
  "asa", "aps", "kft", "zrt", "nyrt", "sro", "doo", "ad", "eood", "ood",
  /* Amérique latine ; « Lda » au Portugal, en Angola, au Mozambique (jeu 10) */ "ltda", "lda", "eireli", "cv", "sapi", "sac", "saa",
  /* Russie et CEI */ "ooo", "oao", "zao", "pao", "ao", "jsc", "pjsc", "ojsc", "cjsc", "too",
  /* Ukraine, Grèce, Vietnam, Thaïlande */ "prat", "pat", "tov", "ae", "epe", "ike", "oe", "ee", "sia", "tnhh", "chamkat", "jamkat",
  /* Estonie (OÜ, écrit « OU » dans un export sans trémas : en queue seulement, voir le filtre), Lituanie (UAB) ; la SIA lettone
     est déjà là sous la grecque */ "ou", "uab",
  /* désignations russes */ "npp", "npo", "npk", "npf", "pkf",
  /* Indonésie, en tête seulement (voir le filtre) */ "pt", "ud",
  /* Turquie */ "sti",
  /* Golfe */ "fze", "fzco", "fzc", "fzllc", "fz", "wll", "spc", "est",
  /* les zones franches de Dubaï et des Émirats, écrites comme une forme (« Orchid Ridge Commodities DMCC ») */
  "dmcc", "jafza", "dafza", "difc", "dso", "dwc", "rakez", "kizad",
  /* Azerbaïdjan, Liban */ "mmc", "sal",
  /* Asie */ "sdn", "bhd", "berhad", "kk", "jusikhoesa", "chusikhoesa", "yuhanhoesa", "tbk",
  /* les sigles japonais de la Gōdō Kaisha (G.K.) et de la Yūgen Kaisha (Y.K.), comme K.K. (jeu 11) */ "gk", "yk",
]);
/** Formes qui ne se placent QU'À LA FIN d'un nom : en tête, le même jeton est autre chose
 *  (« Ag. Prokopis » est « Agios », « As-Salam » un article arabe). Les formes russes, elles,
 *  se placent devant (« OOO Kamaflot ») et restent retirées partout. */
const FORMES_FINALES = new Set(["ag", "se", "sa", "as", "ad", "ab", "sl", "kg", "nv", "bv", "oy",
  "spa", "srl", "sas", "snc", "sac", "sti", "est", "kk", "gk", "yk", "cv", "ae", "epe", "ike",
  /* « Teo. » (Teoranta) ferme un nom irlandais ; en tête, « Teo » est une syllabe teochew (« Teo Heng », jeu 9) */
  "teo"]);
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
  " private joint stock company ",
  /* la même forme entre parenthèses, sans le mot company : « Golestan Nakhl Trading Co. (Private Joint
     Stock) » ; lue comme une filiale, elle plafonnait la paire au possible (jeu 9, 27/09 : 0,800) */
  " private joint stock ", " public joint stock ", " closed joint stock ", " open joint stock ",
  " sherkat sahami khas ", " sherkate sahami khas ", " sahami khas ", " sahami khass ", " sahami amm ",
  " public company limited ", " designated activity company ", " perseroan terbatas ",
  " osauhing ", " aktsiaselts ", " anpartsselskab ", " sabiedriba ar ierobezotu atbildibu ", " uzdaroji akcine bendrove ",
  " usaha dagang ", " commanditaire vennootschap ", " perseroan komanditer ", " sole proprietor company ", " sole proprietorship company ",
  /* la FZ-LLC, que le tiret coupe en deux jetons, et sa forme en toutes lettres : lues AVANT la « limited liability
     company » qu'elles contiennent, sinon il restait « free zone » et la famille llc (tour 10) */
  " fz llc ", " free zone limited liability company ",
  " joint stock company ", " limited liability company ", " limited liability partnership ",
  " private limited ", " private ltd ", " pvt limited ", " public limited company ", " proprietary limited ",
  " with limited liability ", " sole proprietorship ",
  " free zone establishment ", " free zone company ",
  " gesellschaft mit beschrankter haftung ", " aktiengesellschaft ", " kommanditgesellschaft ",
  /* LA GMBH & CO. KG : la société en commandite dont la GmbH est l'associée commanditée est une AUTRE
     personne morale que cette GmbH (« Vogel Kunststofftechnik GmbH » et « … GmbH & Co. KG », jeu 10, 27/09 :
     1,000, le « & Co. KG » fondu dans les formes et la famille « llc » partagée). Lue en bloc, avant les
     mots isolés, elle porte la seule famille des sociétés de personnes ; « & » est déjà une espace ici, et
     « und », « and » s'écrivent encore */
  " gmbh co kg ", " gmbh und co kg ", " gmbh and co kg ", " mbh co kg ", " mbh und co kg ", " mbh and co kg ",
  " ag co kg ", " ag und co kg ", " se co kg ", " se und co kg ", " gmbh co ohg ", " mbh co ohg ", " gmbh co kgaa ",
  " gmbh co ", " mbh co ", " co kg ", " co ohg ", " und co kg ", " and co kg ",
  /* et la forme allemande écrite avec son préfixe de commerce (« Handelsgesellschaft mbH » est une GmbH, voie registres) */
  " handelsgesellschaft mbh co kg ", " gesellschaft mbh co kg ",
  " societe anonyme ", " societe a responsabilite limitee ", " societe par actions simplifiee ",
  " sociedad anonima cerrada ", " sociedad anonima ", " soc anon ", " sociedad limitada ",
  " sociedad de responsabilidad limitada ",
  " sociedad anonima promotora de inversion de capital variable ", " sociedad anonima promotora de inversion ",
  " sociedad anonima unipersonal ", " sociedad anonima de capital variable ",
  " sociedade anonima ", " sociedade limitada ", " limitada ", " s de rl de cv ", " s de rl ",
  /* l'EIRELI brésilienne en toutes lettres, que le registre met devant le nom (« Empresa Individual de Responsabilidade
     Limitada Duarte Pescados » face à « Duarte Pescados EIRELI », jeu 11, 27/09 : 0,800, « empresa individual
     responsabilidade » trois mots rares sans répondant, « limitada » seule étant lue) */
  " empresa individual de responsabilidade limitada ",
  " sa de cv ", " de cv ", " spol s ro ", " spol sro ",
  " societa per azioni ", " societa a responsabilita limitata ",
  " besloten vennootschap ", " naamloze vennootschap ", " sp zoo ", " sp z oo ",
  " anonim sirketi ", " limited sirketi ", " sirketi ",
  " sendirian berhad ", " sendirian ",
  " kabushiki kaisha ", " kabushikigaisha ", " godo kaisha ", " yugen kaisha ",
  /* le rendaku écrit : « Kabushiki Gaisha », « Gōdō Gaisha », « Yūgen Gaisha » (jeu 11 : « Kabushiki Gaisha Morioka Tekkō » à 0,800) */
  " kabushiki gaisha ", " godo gaisha ", " yugen gaisha ",
  " chusik hoesa ", " jusik hoesa ", " gufen youxian gongsi ", " siren youxian gongsi ", " youxian gongsi ", " youxian zeren gongsi ",
  " cong ty tnhh ", " cong ty co phan ", " cong ty ",
  " spolka z ograniczona odpowiedzialnoscia ", " spolka akcyjna ", " spolka jawna ",
  " borisat chamkat ", " borisat jamkat ",
  " tovarishchestvo s ogranichennoy otvetstvennostyu ",
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
  /* les formes ukrainiennes en toutes lettres, sous les deux romanisations (nationale : « Tovarystvo z Obmezhenoiu
     Vidpovidalnistiu » ; BGN : « … Obmezhenoyu Vidpovidalnistyu ») : le TOV, le PrAT et le PAT que le registre écrit
     devant le nom (jeu 12, 28/09 : face à « TOV Prychornomorskyi Terminal », 0,800, quatre mots rares sans répondant) */
  " tovarystvo z obmezhenoiu vidpovidalnistiu ", " tovarystvo z obmezhenoyu vidpovidalnistyu ",
  " pryvatne aktsionerne tovarystvo ", " publichne aktsionerne tovarystvo ", " aktsionerne tovarystvo ",
].sort((a, b) => b.length - a.length);   /* les plus longues d'abord : « sociedad anonima » ne doit pas manger « sociedad anonima unipersonal » */
/** Les locutions d'usage abrégées en bloc : leur sens tient à leurs voisins (« San » seul
 *  est aussi « saint » en espagnol ; « San. ve Tic. » est toujours « Sanayi ve Ticaret »). */
const LOCUTIONS: readonly [string, string][] = [
  [" san ve tic ", " sanayi ticaret "], [" san tic ", " sanayi ticaret "],
  [" ind e com ", " industria comercio "], [" ind com ", " industria comercio "],
  [" imp exp ", " import export "], [" imp and exp ", " import export "],
  [" import and export ", " import export "],
  /* le générique français de l'armement, « Compagnie Maritime X », que le nom anglais écrit « X Shipping Company » (jeu 7 :
     « Compagnie Maritime Beaurivage » à 0,585 face à « Beaurivage Shipping Company »). Le mot « compagnie » reste, pour
     que la forme se lise ; « maritime » SEUL ne se traduit pas : en anglais, « X Maritime » et « X Shipping » sont deux
     sociétés d'un même groupe (voir TRADUCTIONS) */
  [" compagnie maritime ", " compagnie shipping "], [" cie maritime ", " cie shipping "],
  [" torgovy dom ", " trading house "], [" torgovyi dom ", " trading house "], [" torgovyy dom ", " trading house "],
  /* malais, indonésien, vietnamien, arabe romanisé (jeu 9) */
  [" dis ticaret ", " trading "], [" dis tic ", " trading "], [" sanayi ve ticaret ", " industry trading "],
  /* jeu 15 : « Co-operative Society » s'écrit aussi « Cooperative » et « Coop » ; le cap d'un nom de navire en trois langues */
  [" co operative ", " cooperative "], [" co op ", " cooperative "], [" mv cap ", " mv cape "], [" mv cabo ", " mv cape "], [" mv capo ", " mv cape "],
  [" mt cap ", " mt cape "], [" mt cabo ", " mt cape "], [" mv kaap ", " mv cape "],
  [" kelapa sawit ", " palm oil "], [" minyak kelapa sawit ", " palm oil "], [" minyak sawit ", " palm oil "],
  [" isirong sawit ", " palm kernel "], [" buah sawit ", " palm fruit "],
  [" cao su ", " rubber "], [" phan phoi ", " distribution "], [" thuc pham ", " food "], [" may mac ", " garment "],
  [" hai san ", " seafood "], [" dau tu ", " investment "], [" thiet bi ", " equipment "], [" vat tu ", " materials "], [" kinh doanh ", " trading "],
  [" al aruz ", " rice "], [" al arz ", " rice "], [" al sukkar ", " sugar "], [" al amma ", " general "], [" al qabidha ", " holding "],
  [" li tijarat ", " trading "], [" li tijarah ", " trading "], [" lil tijara ", " trading "], [" lil tijarah ", " trading "],
  /* vietnamien : thương mại (commerce), xuất nhập khẩu (import-export), sản xuất (production),
     dịch vụ (services), vận tải (transport), công nghiệp (industrie), kỹ thuật (technique) */
  [" thuong mai ", " trading "], [" xuat nhap khau ", " import export "], [" san xuat ", " production "],
  [" dich vu ", " services "], [" van tai ", " transport "], [" cong nghiep ", " industry "], [" ky thuat ", " technology "],
  [" det may ", " textile garment "], [" giay da ", " leather shoes "], [" thep ", " steel "], [" xay dung ", " construction "],
  [" co khi ", " mechanical "], [" dien tu ", " electronics "], [" thuy san ", " seafood "], [" nong san ", " agricultural products "],
  [" mot thanh vien ", " "], [" mtv ", " "], [" one member ", " "],
  /* les sigles d'un clavardage vietnamien : « cty cp » est « công ty cổ phần », la société par actions,
     que la phrase retire ensuite (jeu 9, 27/09 : « cty cp phan phoi minh khang » plafonné à 0,800, « cp »
     mot rare orphelin) ; « phân phối » (distribution) est un mot du commerce, traduit comme les autres */
  [" cty cp ", " cong ty co phan "], [" cong ty cp ", " cong ty co phan "], [" phan phoi ", " distribution "],
  [" xnk ", " import export "], [" cty ", " "], [" tong cong ty ", " "], [" hop tac xa ", " cooperative "], [" htx ", " cooperative "],
  [" det lua ", " silk weaving "], [" lua ", " silk "], [" gao ", " rice "], [" nhua ", " plastics "], [" go ", " wood "],
  [" tp ho chi minh ", " hochiminh "], [" ho chi minh city ", " hochiminh "], [" ho chi minh ", " hochiminh "], [" tp ", " "],
  [" thanh pho ", " "], [" ha noi ", " hanoi "], [" hai phong ", " haiphong "], [" da nang ", " danang "], [" nam dinh ", " namdinh "],
  [" can tho ", " cantho "], [" sai gon ", " saigon "], [" binh duong ", " binhduong "], [" dong nai ", " dongnai "],
  /* villes thaïes et chinoises que les documents soudent */
  [" chiang mai ", " chiangmai "], [" hat yai ", " hatyai "], [" hong kong ", " hongkong "],
  /* russe : les mots génériques d'entreprise, translittérés, vers l'anglais */
  [" stal ", " steel "], [" treiding ", " trading "], [" treyding ", " trading "], [" torgovlya ", " trade "],
  [" promyshlennost ", " industry "], [" promyshlennaya ", " industrial "], [" zavod ", " plant "], [" kombinat ", " works "],
  [" fabrika ", " factory "], [" neft ", " oil "], [" khimiya ", " chemical "], [" khimicheskiy ", " chemical "], [" khimicheskii ", " chemical "], [" khimicheskij ", " chemical "], [" himicheskiy ", " chemical "],
  [" himiceskij ", " chemical "], [" khimichnyi ", " chemical "], [" khimichnyy ", " chemical "], [" khimichna ", " chemical "],
  [" metallurgicheskiy ", " metallurgical "], [" mashinostroitelny ", " machine building "], [" stroitelstvo ", " construction "],
  [" sudokhodnaya kompaniya ", " shipping "], [" sudokhodstvo ", " shipping "], [" morskoy ", " marine "], [" gruppa ", " group "],
  [" kompaniya ", " "], [" kompania ", " "], [" firma ", " "],
  /* polonais : les descripteurs d'entreprise, en sigle ou en toutes lettres, ne nomment pas */
  [" przedsiebiorstwo produkcyjno handlowo uslugowe ", " "], [" przedsiebiorstwo handlowo uslugowe ", " "],
  [" przedsiebiorstwo produkcyjno handlowe ", " "], [" przedsiebiorstwo wielobranzowe ", " "],
  [" firma handlowo uslugowa ", " "], [" firma handlowa ", " "], [" zaklad produkcyjno handlowy ", " "],
  [" pphu ", " "], [" phu ", " "], [" fhu ", " "], [" zph ", " "], [" phpu ", " "], [" ph ", " "],
  [" przedsiebiorstwo handlowe ", " "], [" przedsiebiorstwo produkcyjne ", " "], [" przedsiebiorstwo uslugowe ", " "],
];
/**
 * LES MOTS GÉNÉRIQUES DU COMMERCE, TRADUITS. Une société chinoise a un nom officiel en
 * caractères, une romanisation (« Jiangsu Mingluochen Maoyi Youxian Gongsi ») et un nom
 * anglais (« Jiangsu Mingluochen Trading Co., Ltd. ») ; les documents et les listes portent
 * l'un ou l'autre. Les mots traduits ici sont ceux du VOCABULAIRE COMMERCIAL (trading,
 * industry, technology, precision…), jamais le nom propre : traduits, ils pèsent peu (ils
 * sont partout dans les listes) et le nom propre décide, comme il doit.
 */
/** Le persan et l'arabe romanisés, à part : « li » ne s'y lit préposition que devant l'un de ces
 *  mots, et le repli des graphies (`pliGenerique`) ne cherche que parmi eux. Tejarat (تجارت) et
 *  tijara (تجارة) sont « trading » : le nom anglais d'une société de commerce le dit ainsi, jamais
 *  « trade » (jeu 9, 27/09 : « Pesteh Kavir Kerman Trading Co. » et « Peste Kavir Kerman Tejarat Co. » à
 *  0,770, « trade » orphelin face à « trading »). */
const TRADUCTIONS_ARABES: ReadonlyMap<string, string> = new Map(Object.entries({
  bazargani: "trading", tejarat: "trading", tejarati: "trading", tijarat: "trading", sanati: "industrial",
  tolid: "production", tolidi: "production", tijara: "trading", tijarah: "trading", tijariya: "trading",
  tijariyah: "trading", sinaiya: "industrial", sinaiyah: "industrial", lil: "",
  muqawalat: "contracting", mukawalat: "contracting", muassasat: "", moassasat: "", muassasa: "", moassasa: "",
  liltijara: "trading", liltijarah: "trading", liltijariya: "trading", liltijarat: "trading", litijara: "trading",
  litijarah: "trading", litijarat: "trading", lilmuqawalat: "contracting", lilsinaa: "industry",
  lilsinaah: "industry", handasiya: "engineering", handasiyah: "engineering", alhandasiya: "al engineering",
  /* la holding (القابضة), les services (الخدمات), le riz (الأرز) : les mots que le nom anglais traduit
     (« Sharikat Rawasi Al Najd Al Qabidha » est « Rawasi Al Najd Holding Company », jeu 9) */
  qabidha: "holding", qabida: "holding", qabidah: "holding", khadamat: "services", khidmat: "services", aruz: "rice",
  /* la porte (بوابة), que le nom anglais traduit (jeu 13 : « Mu'assasat Bawabat Najd lil-Muqawalat » est « Najd Gate Contracting Est. ») */
  bawabat: "gate", bawaba: "gate", bawabah: "gate", bawwabat: "gate", bawwaba: "gate",
}));
/** Les graphies d'une romanisation persane ou arabe que la table ne liste pas une à une : gh pour
 *  g (« Bazarghani »), une voyelle longue doublée (« Tejaarat », « Bazaargani »), la voyelle brève écrite e ou i, o ou u
 *  (« Tejaria », « Tijariya » ; « Tolid », « Tulid »), le y de la nisba écrit ou non (« Tijariya », « Tijaria »). Le repli
 *  ne touche que la CLÉ cherchée, parmi les mots persans et arabes pliés de même (`traductionsArabesPliees`) : un nom
 *  propre reste tel quel (jeu 13, 28/09 : « Altejaria » face à « Al Tijariya », un côté traduit et l'autre non). */
function pliGenerique(j: string): string {
  return j.replace(/gh/g, "g").replace(/aa/g, "a").replace(/ee/g, "i").replace(/oo/g, "u").replace(/e/g, "i").replace(/o/g, "u").replace(/y/g, "i")
    .replace(/(.)\1+/g, "$1");
}
let TRADUCTIONS_ARABES_PLIEES: ReadonlyMap<string, string> | undefined;
function traductionsArabesPliees(): ReadonlyMap<string, string> {
  if (!TRADUCTIONS_ARABES_PLIEES) TRADUCTIONS_ARABES_PLIEES = new Map([...TRADUCTIONS_ARABES].map(([k, v]) => [pliGenerique(k), v]));
  return TRADUCTIONS_ARABES_PLIEES;
}
/** Les mots de métier des raisons sociales japonaises, romanisés, et le lemme anglais que le nom traduit écrit : un
 *  seul par mot (jeu 11, 28/09). Leurs autres graphies ne se listent pas une à une : le pli des deux romanisations et
 *  des voyelles longues (`pliJaponais`) les ramène à la clé (« kougyou », « kogyou » : kogyo ; « syouzi » : shoji ;
 *  « boueki » : boeki), sous un nom que sa forme ou un autre mot dit japonais (voir `traduction`). */
const TRADUCTIONS_JAPONAISES: ReadonlyMap<string, string> = new Map(Object.entries({
  kogyo: "industry", shoji: "trading", sangyo: "industry", boeki: "trading", denki: "electric",
  kagaku: "chemical", seiko: "precision", jidosha: "automotive", unyu: "transport", kaiun: "shipping", kaihatsu: "development",
  tsusho: "trading",
  /* le nom anglais d'un 製作所 est « Manufacturing » (jeu 11 : « Kitazono Seisakusho » face à « Kitazono Manufacturing »),
     pas « Works » ; les métiers de la mer et de l'atelier : suisan (水産, pêche), kōun (港運, manutention portuaire),
     sōko (倉庫), kikai (機械), zōsen (造船), denshi (電子), tekkō (鉄工) et tekkōsho (鉄工所, l'usine), kōmuten (工務店) */
  seisakusho: "manufacturing", suisan: "fisheries", koun: "stevedoring", soko: "warehouse", kikai: "machinery", zosen: "shipbuilding",
  denshi: "electronics", tekko: "steel", tekkosho: "steelworks", komuten: "construction",
}));
let TRADUCTIONS_JAPONAISES_PLIEES: ReadonlyMap<string, string> | undefined;
function traductionsJaponaisesPliees(): ReadonlyMap<string, string> {
  if (!TRADUCTIONS_JAPONAISES_PLIEES) TRADUCTIONS_JAPONAISES_PLIEES = new Map([...TRADUCTIONS_JAPONAISES].map(([k, v]) => [pliJaponais(k), v]));
  return TRADUCTIONS_JAPONAISES_PLIEES;
}
/** La traduction d'un mot du commerce ; `japonais` : le nom porte une forme ou un mot japonais, et ses mots de métier
 *  se cherchent aussi sous le pli des deux romanisations (« Oomura Kogyou K.K. » : kogyou restait un mot rare orphelin
 *  face à « industry », jeu 11, 28/09 : 0,361). Sans cette marque, « Teko » n'est pas « tekko » et reste un nom. */
function traduction(j: string, japonais = false, slave = false): string | undefined {
  const t = TRADUCTIONS.get(j);
  if (t !== undefined) return t;
  /* un générique finnois, suédois, danois ou norvégien, seul ou composé de deux (« satamapalvelu », « hamntjänst » : port
     services), les deux raisons sociales d'une société finlandaise (voir nordique.ts) */
  const n = traductionNordique(j);
  if (n !== undefined) return n;
  const a = traductionsArabesPliees().get(pliGenerique(j));
  if (a !== undefined) return a;
  /* et sous la marque slave, les mots du commerce et les grades sous le pli des romanisations du cyrillique */
  /* sous chacune de ses clés, l'allemande comprise (« Sawod » est zavod, plant : voir `clesSlaves`) */
  if (slave) for (const k of clesSlaves(j)) { const s = TRADUCTIONS.get(k) ?? traductionsSlavesPliees().get(k); if (s !== undefined) return s; }
  if (!japonais) return undefined;
  return traductionsJaponaisesPliees().get(pliJaponais(j));
}
export const TRADUCTIONS: ReadonlyMap<string, string> = new Map(Object.entries({
  /* français (Maghreb, Levant, Afrique de l'Ouest) : « Logistique » est logistics (tour 10, jeu 14 : « Abdelkarim Tahar Logistique »
     face à « Abdul Kareem Taher Logistics »). PAS « négoce » : traduit en trading, il faisait de « Ben Abdallah Négoce » et de
     « Benabdallah Trading Co », d'« Ettayeb Négoce » et d'« El Tayeb Trading » deux alertes fortes, que l'auteur du jeu tient pour deux
     maisons (mesuré le 29/09 : deux fausses alertes fortes pour un vrai nom gagné) */
  logistique: "logistics",
  /* chinois (pinyin) */ maoyi: "trading", jinchukou: "import export", keji: "technology", dianzi: "electronics",
  gongye: "industry", shiye: "industrial", zhizao: "manufacturing", jituan: "group", guoji: "international",
  wuliu: "logistics", huoyun: "freight", hangyun: "shipping", chuanwu: "shipping", jixie: "machinery", luntai: "tire",
  huagong: "chemical", fangzhi: "textile", fuzhuang: "garment", shipin: "food", jinshu: "metal",
  gangtie: "steel", suliao: "plastic", jianzhu: "construction", nengyuan: "energy", fazhan: "development",
  touzi: "investment", kongzhi: "holdings", konggu: "holdings", shangmao: "trading", jingmao: "trading",
  yuanyang: "ocean", jingmi: "precision", haiyun: "shipping", gongju: "tools",
  /* japonais : voir TRADUCTIONS_JAPONAISES, une clé par mot, ses graphies par le pli */ ...Object.fromEntries(TRADUCTIONS_JAPONAISES),
  /* coréen */ sanop: "industry", sanup: "industry", muyeok: "trading", muyok: "trading", jeongmil: "precision",
  jungmil: "precision", jeonja: "electronics", junja: "electronics", hwahak: "chemical", mulryu: "logistics",
  haeun: "shipping", gaebal: "development", tongsang: "trading",
  /* 중공업, l'industrie lourde, en romanisation révisée et en McCune-Reischauer (jeu 11 : « Pomyung Junggongeop »
     face à « Bomyeong Heavy Industries », 0,300) */
  junggongeop: "heavy industries", chunggongop: "heavy industries", chunggongeop: "heavy industries",
  /* persan et arabe : voir TRADUCTIONS_ARABES */ ...Object.fromEntries(TRADUCTIONS_ARABES),
  /* « fils » et « frères » dans les langues du commerce */
  sinovi: "sons", synowie: "sons", sohne: "sons", soehne: "sons", hijos: "sons", fils: "sons", figli: "sons",
  filhos: "sons", zonen: "sons", sonner: "sons", oglu: "sons", ogullari: "sons",
  freres: "brothers", fratelli: "brothers", irmaos: "brothers", brueder: "brothers", bruder: "brothers",
  bracia: "brothers", hermanos: "brothers", gebruder: "brothers", ikhwan: "brothers",
  /* les mots génériques des langues européennes du commerce, ramenés au lemme anglais que
     les listes écrivent (jeu 8, 27/09 : « Kardeşler Nakliyat » contre « Brothers Transport »,
     « Spedizioni » contre « Forwarding », « Zakłady Chemiczne » contre « Chemical Works »).
     « maritime » n'y est pas : c'est aussi un mot anglais, et « X Maritime » et « X Shipping »
     sont deux sociétés d'un même groupe */
  /* néerlandais (jeu 14) : la maatschappij est la « company », qui ne pèse rien ; les composés en -maatschappij gardent leur
     métier ; l'expéditeur, le marchand de fourrage, le loueur de grues */
  maatschappij: "", transportmaatschappij: "transport", scheepvaartmaatschappij: "shipping", expeditiemaatschappij: "forwarding",
  expeditiemij: "forwarding", veevoer: "feed", kraanverhuur: "crane hire", zuivelhandel: "dairy trading", logistiek: "logistics",
  algemene: "general", internationale: "international", gebroeders: "brothers",
  scheepsbenodigdheden: "ship supplies", cooperatieve: "cooperative", suddeutsche: "suddeutsche",
  /* turc */ kardesler: "brothers", nakliyat: "transport", tasimacilik: "transport", ticaret: "trading", sanayi: "industry",
  ithalati: "import", ihracati: "export",
  /* russe : les composés en -khim (хим, la chimie), que l'anglais rend -chem (jeu 13 : « Agrokhim » / « Agrochem ») */
  agrokhim: "agrochem", neftekhim: "petrochem", khimprom: "chemical", khimreaktiv: "chemical", khimvolokno: "chemical",
  denizcilik: "shipping", gida: "food", tekstil: "textile", insaat: "construction", lojistik: "logistics", ihracat: "export",
  ithalat: "import", madencilik: "mining", enerji: "energy", kimya: "chemical", yatirim: "investment", tarim: "agriculture",
  /* italien */ spedizioni: "forwarding", trasporti: "transport", navigazione: "navigation", commercio: "trading",
  commerciale: "commercial", industriale: "industrial", industrie: "industries", costruzioni: "construction",
  /* espagnol et portugais */ comercio: "trading", comercial: "commercial", naviera: "shipping", transportes: "transport",
  industrias: "industries", sucesores: "successors", navegacao: "navigation", navegacion: "navigation", construcciones: "construction",
  alimentos: "food", alimentacion: "food", pesquera: "fishing", agricola: "agricultural", agropecuaria: "agricultural",
  /* les noms d'activité des registres lusophones et hispanophones (« Exportação de Café de Huambo », « Comércio e
     Importação Ferreira », jeu 10) : la table n'avait que l'adjectif (« exportadora ») */
  exportacao: "export", importacao: "import", exportacoes: "export", importacoes: "import", exportacion: "export",
  importacion: "import", exportaciones: "export", importaciones: "import",
  /* PAS les noms d'activité en -dora (« transportadora », « comercializadora », « distribuidora ») ni « marítima »,
     « servicios », « seguros » : mesuré le 27/09 sur les onze jeux, les traduire ne gagnait aucune paire (les deux
     côtés les écrivent dans la même langue) et en perdait trois : « Comer. » n'abrège plus « comercializadora »
     devenue « trading », le poids d'« exportadora » devenu « export » laissait « Compañía Exportadora de Tubería
     Galvanizada del Norte » sous son champ coupé, et « Marítimas » face à « Marítima » rapprochait la holding de
     la société qui exploite */
  /* allemand et néerlandais */ handel: "trading", handels: "trading", handelsgesellschaft: "trading", spedition: "forwarding",
  schifffahrt: "shipping", schiffahrt: "shipping", reederei: "shipping", werke: "works", werk: "works", bau: "construction",
  scheepvaart: "shipping", rederij: "shipping", expeditie: "forwarding", scheepsreparatie: "ship repair",
  /* le français de Belgique et du Luxembourg : « Scheldemond Expédition SA » est « Scheldemond Expeditie NV », la même
     société sous ses deux raisons sociales (jeu 14, tour 10 : 0,450, « expedition » resté un mot rare orphelin face à
     « forwarding ») ; et la logistique, en néerlandais et en français (« Terbraak Logistiek B.V. », « Terbraak
     Logistics B.V. » : 0,700) */
  expedition: "forwarding", expeditions: "forwarding",
  /* les registres néerlandais et allemand (jeu 10) : la société de commerce en un mot, et l'adjectif face au
     radical que le nom d'usage garde (« Chemische » et « Chemie », « Agrarische » et « Agro ») */
  handelsmaatschappij: "trading", handelsgroep: "trading", handelsonderneming: "trading",
  chemische: "chemical", chemisch: "chemical", chemie: "chemical", agrarische: "agro", agrarisch: "agro", overslag: "transshipment",
  /* afrikaans (jeu 10 : « Voedsel Verwerking » est « Food Processing », « Boerdery » est « Farming ») ; « Eiendoms
     Beperk » et son sigle « (Edms) Bpk » sont la forme « (Pty) Ltd ». « Bou » seul n'y est pas : c'est aussi l'arabe
     maghrébin « Bou » (Abu), et il ne se traduit que sous une forme sud-africaine (voir `analyserEntite`) */
  voedsel: "food", verwerking: "processing", konstruksie: "construction", vervoer: "transport", boerdery: "farming",
  boumateriaal: "building materials", maatskappy: "company", beperk: "ltd", eiendoms: "pty", edms: "pty", bpk: "ltd",
  vervaardiging: "manufacturing", ingenieurs: "engineering", myn: "mining", landbou: "agriculture", visserye: "fisheries",
  hout: "timber", staal: "steel", chemies: "chemical", dienste: "services", beleggings: "investments", groep: "group",
  nywerhede: "industries", produkte: "products", handelaars: "traders", vervoerdienste: "transport services",
  /* polonais et tchèque */ zaklady: "works", zaklad: "works", chemiczne: "chemical", handlowy: "trading", handlowa: "trading",
  handlowe: "trading", przemysl: "industry", przemyslowe: "industrial", budowlane: "construction", transportowe: "transport",
  spedycja: "forwarding", logistyka: "logistics", zegluga: "shipping", stavebni: "construction", obchodni: "trading",
  /* grec translittéré (« Ναυτιλιακή Εταιρεία » est « Shipping Company ») */ naftiliaki: "shipping", naftiki: "shipping",
  /* et les génériques de la mer que le nom anglais TRADUIT (jeu 13 : « Ελλάς Ναυτικά Λιπαντικά » est « Hellas Marine Lubricants ») */
  naftika: "marine", naftiko: "marine", naftikos: "marine", lipantika: "lubricants",
  etaireia: "", etairia: "", emporiki: "trading", viomichaniki: "industrial", viomichania: "industry", techniki: "technical",
  kataskevastiki: "construction", metaforiki: "transport", touristiki: "tourism",
  /* turc (jeu 12 : « Gemicilik » est « Shipping », « Çelik Ticaret » est « Steel Trading ») ; « un » (farine) n'y est pas,
     c'est l'article français */
  gemicilik: "shipping", komur: "coal", celik: "steel", urunleri: "products", urun: "product", yem: "feed", hububat: "grain",
  tahil: "grain", zahire: "grain", hurda: "scrap", depolama: "storage", gemi: "ship", kiralama: "chartering", kurtarma: "salvage",
  liman: "port", deniz: "marine", demir: "iron", bakir: "copper", pamuk: "cotton", findik: "hazelnut", tutun: "tobacco",
  seker: "sugar", tuz: "salt", kagit: "paper", mobilya: "furniture", boya: "paint", plastik: "plastic", ambalaj: "packaging",
  /* scandinave */ rederi: "shipping", brodre: "brothers", broder: "brothers", handelsbolag: "trading",
  /* malais et indonésien (jeu 9 : « Kilang Beras » est « Rice Mill », « Syarikat Getah » est « Rubber Company ») */
  kilang: "mill", pabrik: "mill", beras: "rice", padi: "paddy", getah: "rubber", sawit: "palm", minyak: "oil",
  perdagangan: "trading", perniagaan: "trading", dagang: "trading", pembinaan: "construction", pengangkutan: "transport",
  perkapalan: "shipping", pelayaran: "shipping", industri: "industries", logistik: "logistics", elektrik: "electrical",
  makanan: "food", sumber: "resources", pertanian: "agriculture", perikanan: "fisheries", pembangunan: "development",
  kejuruteraan: "engineering", teknologi: "technology", hartanah: "property", pelaburan: "investment", perusahaan: "enterprise",
  pengeluaran: "manufacturing", pembekal: "supplier", pembekalan: "supply", perabot: "furniture", kayu: "timber",
  syarikat: "company", kumpulan: "group",
  /* l'arabe romanisé des marchandises : « Li Tijarat Al Aruz » est « Rice Trading » (les locutions font le reste) */
  aruz: "rice", sukkar: "sugar", sukar: "sugar", hadid: "steel", mawad: "materials", khadamat: "services", khidmat: "services",
  naql: "transport", shahn: "shipping", aghdhiya: "food", malabis: "garments", utoor: "perfumes", otoor: "perfumes",
  itarat: "tyres", khurda: "scrap", maadin: "metals", qabidha: "holding", qabida: "holding",
  /* swahili : voir TRADUCTIONS_SWAHILIES (swahili.ts), une table du monde des mots de métier sous leurs classes nominales */
  ...Object.fromEntries(TRADUCTIONS_SWAHILIES),
  /* ourdou et hindi (jeu 15, tour 11 : « Bismillah Karkhana-e-Sabun » est « Bismillah Soap Factory », 0,322, deux mots rares
     orphelins de chaque côté) : l'usine (کارخانہ), le savon, l'étoffe, le fer, le marché, le magasin, l'industrie et le commerce en
     sanskrit (udyog, vyapar) et en persan (sanat). L'izafat « -e- » que le tiret coupe est déjà un mot de liaison (voir
     ABREVIATIONS), et l'ordre du complément (le nom, puis ce qu'il fait) est celui que l'alignement des mots ignore. « Mills »
     s'écrit tel quel des deux côtés et ne se traduit pas ; « tijarat » est plus haut, avec l'arabe */
  karkhana: "factory", karkhane: "factory", sabun: "soap", kapra: "cloth", kapda: "cloth", loha: "iron", mandi: "market",
  bhandar: "store", bhandaar: "store", udyog: "industry", udhyog: "industry", vyapar: "trading", vyapaar: "trading", vyaapar: "trading",
  sanat: "industry", sanaat: "industry", sahakari: "cooperative",
}));

/* construit ici, à côté de TRADUCTIONS, pour qu'aucun module chargé avant la préparation ne le lise trop tôt (découpage du 28/09) */
/** Les MOTS DU COMMERCE dont le pluriel ne change pas la société : les cibles anglaises de TRADUCTIONS
 *  (« metal », « industry », « supply »), et les qualificatifs qu'un registre écrit au pluriel ou non
 *  (« Enterprises », « Holdings », « Products », « Solutions »). Hors de cette liste, un pluriel est un
 *  autre nom : « Bonny Egret » et « Bonny Egrets » sont deux navires, « Provisions Store » et
 *  « Provisions Stores » deux boutiques, « Yusuf Provisions Shop » et « … Shops » aussi (jeu 10, 27/09 :
 *  six fausses alertes fortes du pluriel ouvert à tout le dictionnaire au tour cinq). */
/** Les ENSEIGNES que TRADUCTIONS rend (« duka » : shop, « bhandar » : store) et qui ne passent pas pour autant dans les génériques au
 *  pluriel : « Shop » et « Shops », « Store » et « Stores » restent deux boutiques (jeu 10, ci-dessous), quelle que soit la langue qui
 *  les a écrites (tour 11) */
const ENSEIGNES: ReadonlySet<string> = new Set(["shop", "shops", "store", "stores", "boutique", "boutiques"]);
export const GENERIQUES_AU_PLURIEL: ReadonlySet<string> = new Set([
  ...[...TRADUCTIONS.values()].flatMap((v) => v.split(" ")).filter((m) => m.length >= 3 && !ENSEIGNES.has(m)),
  "industries", "supplies", "services", "products", "systems", "solutions", "enterprises", "holdings", "investments",
  "resources", "textiles", "foods", "exports", "imports", "traders", "merchants", "metals", "chemicals", "materials",
  "logistics", "technologies", "machines", "industry", "supply", "service", "product", "system", "solution", "enterprise",
  "investment", "resource", "food", "trader", "merchant", "machine",
  /* les noms d'agent du commerce, qu'un registre met au pluriel ou non (« Contractors », « Engineers ») */
  "engineer", "engineers", "contractor", "contractors", "consultant", "consultants", "builder", "builders", "developer", "developers",
  "distributor", "distributors", "supplier", "suppliers", "exporter", "exporters", "importer", "importers", "manufacturer",
  "manufacturers", "producer", "producers", "associate", "associates", "partner", "partners", "agent", "agents", "broker", "brokers",
  "dealer", "dealers", "grower", "growers", "planter", "planters", "miller", "millers", "printer", "printers", "packer", "packers",
  "farmer", "farmers", "forwarder", "forwarders", "shipper", "shippers", "carrier", "carriers", "operator", "operators",
  "wholesaler", "wholesalers", "retailer", "retailers", "refiner", "refiners", "tanner", "tanners", "weaver", "weavers",
  /* les marchandises et les métiers, ce qu'une société vend ou fait : au pluriel ou non, c'est la même
     (« Valve Co. », « Valves Co. » ; « Fuel Supply », « Fuels Supply » ; « Malting », « Maltings »). Jamais
     l'enseigne elle-même : « Store », « Shop », « Boutique » au pluriel sont une autre boutique */
  "valve", "valves", "fuel", "fuels", "provision", "provisions", "venture", "ventures", "malting", "maltings", "part", "parts",
  "spare", "spares", "motor", "motors", "pump", "pumps", "pipe", "pipes", "cable", "cables", "wire", "wires", "paint", "paints",
  "coating", "coatings", "fertilizer", "fertilizers", "seed", "seeds", "grain", "grains", "feed", "feeds", "mineral", "minerals",
  "ore", "ores", "log", "logs", "board", "boards", "panel", "panels", "brick", "bricks", "tile", "tiles", "polymer", "polymers",
  "resin", "resins", "paper", "papers", "fabric", "fabrics", "shoe", "shoes", "bag", "bags", "tool", "equipment", "equipments",
  "instrument", "instruments", "device", "devices", "component", "components", "accessory", "accessories", "commodity",
  "commodities", "beverage", "beverages", "drink", "drinks", "fruit", "fruits", "vegetable", "vegetables", "nut", "nuts", "spice",
  "spices", "cosmetic", "cosmetics", "pharmaceutical", "pharmaceuticals", "medicine", "medicines", "drug", "drugs", "vehicle",
  "vehicles", "truck", "trucks", "tyre", "tire", "tires", "battery", "batteries", "lubricant", "lubricants", "solvent", "solvents",
  "dye", "dyes", "pigment", "pigments", "ceramic", "ceramics", "mill", "mills", "farm", "farms", "estate", "estates", "plantation",
  "plantations", "fishery", "mine", "mines", "quarry", "quarries", "foundry", "foundries", "workshop", "workshops", "warehouse",
  "warehouses", "depot", "depots", "terminal", "terminals", "work", "tanker", "tankers", "trawler", "trawlers", "cargo", "cargoes",
  /* la quincaillerie, l'enseigne de toute l'Afrique de l'Est et du sous-continent (« Shamji Hardware », « Otieno Hardware ») */
  "hardware",
]);

/** Les PARTICULES des langues du commerce : articles et prépositions qui lient les mots d'un nom
 *  sans rien désigner. Elles ne disparaissent pas (« de la Rúa » les porte), mais leur poids est
 *  le plancher : les listes sont surtout anglaises, « del » y est rare, et l'IDF en faisait un mot
 *  rare orphelin quand un côté l'omettait (« Compañía Naviera del Golfo » contre « Compañía
 *  Naviera Golfo », mesuré le 27/09 : plafonné à 0,80 pour une particule sautée). */
export const PARTICULES: ReadonlySet<string> = new Set(["de", "del", "des", "du", "della", "delle", "dei", "degli", "dello", "di", "da",
  "do", "das", "la", "le", "les", "el", "los", "las", "al", "van", "der", "den", "von", "zu", "zum", "zur", "ten", "ter",
  "het", "fur", "na",
  /* la filiation arabe et malaise : « bin », « bint », « binti », « ibn », « ben », « ould » lient deux noms ;
     un côté qui l'omet (« Yusof bin Abdullah » contre « Yusof Abdullah », jeu 9) ne perd rien, mais « Bint »
     face à « Ibn » (« Bint Al Nakhuda », « Ibn Al Nakhuda », deux navires) est un CONFLIT : voir `filiation` */
  "bin", "bint", "binti", "ibn", "ben", "ould",
  /* le swahili : « Usafirishaji wa Bahari » et « Usafirishaji Bahari » (jeu 10) */
  "wa", "ya", "za", "cha", "kwa"]);
/* PAS « dos » (« Flores de Rionegro Dos » est le deuxième d'une série) : mesuré le 27/09 */
/** La filiation que le nom écrit : « m » pour bin, ibn, ben, ould ; « f » pour bint, binti. */
const FILIATION_M: ReadonlySet<string> = new Set(["bin", "ibn", "ben", "ould", "wuld", "wad", "wld"]);
const FILIATION_F: ReadonlySet<string> = new Set(["bint", "binti", "ibnat"]);
/** LE NOM THÉOPHORE (عبد, l'article, un nom de Dieu) sous ses graphies : le Maghreb colle et écrit el (« Abdelkarim »), le Golfe écrit
 *  ul, à part ou collé (« Abdul Kareem », « Abdulaziz »), l'article s'assimile devant r, s, n, t, z, d et double la consonne
 *  (« Abdurrahman », « Abdessalam »). Rend « abd », « al » et le nom, ou « abd » et « al » seuls pour « Abdul », « Abdel », « Abdur »
 *  écrits à part, pour que le nom (Karim, Aziz) se compare seul (tour 10, jeu 14 : « Abdelkarim Tahar Logistique » face à
 *  « Abdul Kareem Taher Logistics » à 0,332). Undefined quand le mot n'a pas cette forme ou que moins de quatre lettres suivent
 *  l'article : « Abdullah », « Abdou », « Abdi » restent entiers. */
export function scinderAbd(j: string): string[] | undefined {
  if (!j.startsWith("abd") || j.length < 5) return undefined;
  let i = 3;
  while (i < 5 && i < j.length && "aeiou".includes(j[i]!)) i++;
  if (i === 3) return undefined;
  const c = j[i];
  let reste: string;
  if (c === "l") reste = j.slice(i + 1);
  else if (c !== undefined && "rsntzd".includes(c) && (j[i + 1] === c || i + 1 === j.length)) reste = j.slice(i + 1);
  else return undefined;
  if (reste === "") return ["abd", "al"];
  return reste.length >= 4 ? ["abd", "al", reste] : undefined;
}
/** Les mots qui font d'un nom la succursale d'un autre : la même personne morale (« X - Penang Branch »
 *  est X), mais pas la filiale « X (Penang) Sdn. Bhd. » ; d'un seul côté, le nom tel qu'écrit se range au
 *  possible, et sa variante sans la mention rejoint X (jeu 9). */
export const SUCCURSALES: ReadonlySet<string> = new Set(["branch", "subesi", "sube", "branches", "succursale", "sucursale", "sucursal", "filiale", "filial", "filiaal",
  "zweigniederlassung", "niederlassung", "zweigstelle", "sucursales"]);
/** Les mots du SIÈGE, dans les langues des registres, tels qu'un document les écrit derrière une virgule ou un
 *  tiret (« , Head Office », « , Hauptsitz », « , Hoofdkantoor », « , Siège social », « , Sede central ») ; et ceux
 *  d'un bureau ou d'une agence, qui ne sont une succursale que derrière une virgule ou un tiret (« Office »
 *  seul est un mot du nom : « Office National des Ports »). Une même source pour l'annotation qui les ôte et
 *  pour la mention qu'elle laisse (voir `mentionDeSuccursale`). */
export const MOTS_DE_SIEGE = "head\\s*office|headquarters?|hq|hauptsitz|hauptverwaltung|zentrale|hoofdkantoor|hoofdzetel|si[e\u00e8]ge(?:\\s+social)?|sede\\s+(?:central|social|legale|principal)|casa\\s+matriz|hovedkontor|huvudkontor|registered\\s+office|main\\s+office|central\\s+office|principal\\s+office";
export const MOTS_DE_BUREAU = "representative\\s+office|liaison\\s+office|branch\\s+office|agence|agencia|agenzia|kantoor|office|bureau|oficina|ufficio";
const SIEGE = new RegExp(`(?<![\\p{L}])(?:${MOTS_DE_SIEGE})(?![\\p{L}])`, "iu");
const BUREAU = new RegExp(`(?<![\\p{L}])(?:${[...SUCCURSALES].join("|")}|${MOTS_DE_BUREAU})(?![\\p{L}])`, "iu");
/** Les mots vides d'une mention de succursale : ce qui reste est le lieu. */
const VIDES_DE_MENTION: ReadonlySet<string> = new Set(["of", "the", "de", "di", "du", "des", "del", "della", "la", "le", "les", "van", "der",
  "den", "het", "and", "in", "at", "a", "en"]);

/** LE NUMÉRO DE REGISTRE qu'une douane ou une facture ajoute au nom déposé : le RC et le BN du CAC nigérian
 *  (« (RC 884213) »), le « Reg. No. 2014/117230/07 » du CIPC sud-africain, le HRB et le HRA d'un Amtsgericht
 *  (« (HRB 22045, AG Leipzig) »), le KvK néerlandais, le KBO ou BCE belge (« (KBO 0712.448.391) », jeu 14, tour 10 :
 *  0,667, le numéro lu comme trois jetons), le CIN, l'UEN, l'ACN, le CNPJ ; entre parenthèses, ou
 *  derrière la forme. Lus comme des jetons, ils faisaient un NUMÉRO d'un seul côté et la paire plafonnait au
 *  possible (jeu 10, 27/09 : dix paires) ; ôtés sans mémoire, deux dépôts du même nom sous deux numéros se
 *  confondaient (jeu 10 : cinq paires à 1,000). Le numéro est donc une propriété de toutes les variantes du
 *  nom (`VarianteTypee.registre`) : deux numéros différents, deux dépôts, le possible au plus. */
export const REGISTRES: readonly RegExp[] = [
  /\(\s*(?:rc|bn|cac|cipc|hrb|hra|kvk|kbo|bce|ondernemingsnummer|ondernemingsnr|crn|cin|uen|acn|abn|brn|cnpj|cuit|ruc|nit|siren|siret)\s*(?:no\.?|nr\.?|number|#)?\s*:?\s*(?:[a-z]{1,2}\s?)?\d[\d/.\-]{2,}[^()]*\)/giu,
  /\(\s*reg(?:istration|istered)?\.?\s*(?:no\.?|nr\.?|number|#)?\s*:?\s*[a-z]?\d[\d/.\-]{2,}[^()]*\)/giu,
  /(?<=\b(?:ltd|limited|plc|inc|llc|gmbh|bhd|bv|nv)\.?)[\s,]+(?:rc|bn|hrb|hra|kvk|kbo|bce|reg(?:istration)?\.?\s*(?:no\.?|nr\.?|number)?)\s*[:.]?\s*[a-z]?\d[\d/.\-]{3,}\s*$/giu,
  /* le numéro de société japonais (法人番号, treize chiffres), entre parenthèses ou en tête, suivi d'un tiret ou d'un deux-points
     (« Corporate Number 8011001077453 », puis le nom, jeu 11 : un numéro d'un seul côté, 0,800) */
  /(?:\(\s*)?(?:法人番号|corporate\s+number|hojin\s+bango)\s*:?\s*\d{13}(?:\s*\)|\s*[-\u2013\u2014:])?/giu,
];
/** Les numéros de registre d'un nom brut, chiffres seuls, triés ; « » sans numéro. */
export function numeroDeRegistre(brut: string): string {
  const nums = new Set<string>();
  for (const r of REGISTRES) for (const m of brut.matchAll(r)) {
    const n = /\d[\d/.\-]*/.exec(m[0])?.[0].replace(/\D/g, "");
    if (n) nums.add(n);
  }
  return [...nums].sort().join(" ");
}

/**
 * CE QUE NOMME une mention de succursale : « siege » pour le siège (« Hauptsitz », « Head Office »,
 * « Hoofdkantoor », « Nairobi Head Office »), le LIEU de la succursale quand une virgule, un tiret ou une
 * forme juridique le délimite (« , Speicherstadt Branch » : « speicherstadt » ; « - Penang Branch » :
 * « penang » ; « Limited Sabon Gari Branch » : « sabon gari » ; « , Havengebied Kantoor » : « havengebied »),
 * « branch » quand le nom dit la succursale sans dire laquelle, et « » sans mention. Deux mentions qui ne
 * nomment pas la même chose sont deux établissements d'une même personne morale, et pas le même
 * compte, la même caisse, la même immatriculation locale : le siège n'est pas la succursale de la
 * Speicherstadt, celle de Cotonou n'est pas celle de Lomé (jeu 10, 27/09 : dix paires à 1,000 dont la
 * variante sans mention rejoignait l'autre). Une mention d'un seul côté, elle, reste la même personne
 * morale (« X - Penang Branch » est X, jeu 9). Une adresse (« Office 12 ») ne nomme rien.
 */
export function mentionDeSuccursale(brut: string): string {
  /* le numéro de registre s'ôte d'abord : « Zweigniederlassung Leipzig (HRB 22045, AG Leipzig) » nomme Leipzig */
  brut = REGISTRES.reduce((t, r) => t.replace(r, ""), brut);
  const lieu = (segment: string): string => {
    const mots = jetons(normaliser(plier(segment)));
    if (mots.some((m) => /^\d+$/.test(m))) return "";
    const reste = mots.filter((m) => !SUCCURSALES.has(m) && !VIDES_DE_MENTION.has(m) && !BUREAU.test(m));
    return reste.length > 0 && reste.length <= 3 ? reste.join(" ") : "branch";
  };
  const segments = brut.split(/\s*,\s*|\s+[-\u2013]\s+/u);
  for (const s of segments.slice(1)) {
    if (SIEGE.test(s)) return "siege";
    if (BUREAU.test(s)) { const l = lieu(s); if (l !== "") return l; }
  }
  const tete = segments[0] ?? "";
  if (SIEGE.test(tete) && !/(?<![\p{L}])(?:hq|zentrale)(?![\p{L}])/iu.test(tete)) return "siege";
  const mots = jetons(normaliser(plier(tete)));
  const i = mots.findIndex((m) => SUCCURSALES.has(m));
  if (i < 0) return "";
  /* sans virgule, le lieu suit la forme juridique : « Kano Merchant Bank Limited Sabon Gari Branch » */
  let j = -1;
  for (let k = 0; k < i; k++) if (FORMES.has(mots[k]!)) j = k;
  const place = j >= 0 ? mots.slice(j + 1, i).filter((m) => !VIDES_DE_MENTION.has(m)) : [];
  return place.length > 0 && place.length <= 3 ? place.join(" ") : "branch";
}

/** Les ADJECTIFS RÉGIONAUX que le Handelsregister et la KvK écrivent devant un nom (« Rheinische Rheinstahl
 *  Stahlrohr », « Overijsselse Visser Agrarische Handelsmaatschappij ») : une décoration du registre, que le nom
 *  d'usage omet toujours (« Rheinstahl Rohr », « Visser Agro »). Comme une particule, l'adjectif pèse le plancher
 *  quand l'autre nom n'en porte aucun ; deux noms qui en portent chacun un autre sont deux sociétés (« Rheinische
 *  Industrietechnik » et « Westfälische Industrietechnik », jeu 10), et l'adjectif garde alors son poids
 *  (voir `regionsAuPlancher`). La famille des suffixes (-ische, -sche, -se) se reconnaît sur le radical d'un
 *  Land allemand ou d'une province néerlandaise ; les formes en -er des villes s'énumèrent. */
const REGIONS_DE_REGISTRE: ReadonlySet<string> = new Set([
  "rheinische", "westfalische", "bayerische", "niedersachsische", "sachsische", "hessische", "badische", "schwabische",
  "hanseatische", "norddeutsche", "suddeutsche", "ostdeutsche", "westdeutsche", "mitteldeutsche", "nordrhein",
  "thuringer", "berliner", "hamburger", "bremer", "munchner", "kolner", "frankfurter", "stuttgarter", "dusseldorfer",
  "nurnberger", "leipziger", "dresdner", "hannoversche", "oldenburger",
  "overijsselse", "brabantse", "zeeuwse", "gelderse", "hollandse",
  "friese", "groningse", "limburgse", "utrechtse", "drentse", "flevolandse", "twentse", "amsterdamse", "rotterdamse", "haagse",
]);
const RACINES_REGIONALES: ReadonlySet<string> = new Set(["rhein", "westfal", "bayer", "niedersachs", "sachs", "hess", "bad", "schwab",
  "hanseat", "norddeutsch", "suddeutsch", "ostdeutsch", "westdeutsch", "mitteldeutsch", "thuring", "pfalz", "saarland", "brandenburg",
  "mecklenburg", "holstein", "schleswig", "frank", "ostfries", "oldenburg", "hannover", "markisch", "lausitz", "allgau",
  "overijssel", "brabant", "zeeuw", "gelder", "holland", "groning", "limburg", "utrecht", "drent", "flevoland", "twent",
  "amsterdam", "rotterdam", "haag", "veluw", "betuw", "achterhoek"]);
const SUFFIXES_REGIONAUX: readonly string[] = ["ische", "ischer", "ischen", "isches", "sche", "scher", "schen", "sches", "se"];
/** Le point cardinal soudé à l'adjectif (« Noord-Brabantse », « Zuid-Hollandse ») : la normalisation le sépare. */
export const POINTS_CARDINAUX: ReadonlySet<string> = new Set(["noord", "zuid", "oost", "west", "nord", "sud", "ost"]);
export function regionDeRegistre(m: string): boolean {
  if (REGIONS_DE_REGISTRE.has(m)) return true;
  for (const s of SUFFIXES_REGIONAUX) {
    if (m.length - s.length >= 3 && m.endsWith(s) && RACINES_REGIONALES.has(m.slice(0, -s.length))) return true;
  }
  return false;
}

/** Les abréviations d'usage, ramenées au mot entier ; les mots de liaison disparaissent
 *  (« & », « and », « et », « ve », « und », « y », « e », « for », « of », « the »). */
/* Des Map, jamais des objets littéraux : un nom listé contient « constructor » ou
   « toString », et `objet[mot]` rendait alors une fonction héritée (mesuré le 27/09 :
   « .split is not a function » au premier criblage des cinq listes). */
/** Ce qui fait d'un nom un nom NÉERLANDAIS : une forme ou un mot du registre ; sous cette marque seulement, « Exp. » est
 *  l'expeditie et non l'export, « Hand. » la handelsonderneming, « Alg. » algemene, « Int. » internationale (jeu 14). */
const MARQUEURS_NEERLANDAIS: ReadonlySet<string> = new Set(["bv", "nv", "vof", "mij", "maatschappij", "handel", "handelsonderneming",
  "scheepvaart", "expeditie", "gebroeders", "gebr", "weduwe", "wed", "zonen", "zn", "transportmaatschappij", "veevoer", "kraanverhuur",
  "expeditiemij", "scheepsbenodigdheden", "zuivelhandel", "logistiek", "cooperatieve", "ua"]);
/** Ce qui fait d'un nom un nom PAKISTANAIS : la forme privée du sous-continent, une ville, un registre (jeu 15). */
const MARQUEURS_PAKISTANAIS: ReadonlySet<string> = new Set(["pvt", "private", "pakistan", "karachi", "lahore", "sialkot", "faisalabad",
  "islamabad", "rawalpindi", "peshawar", "gujranwala", "multan", "hyderabad", "quetta", "secp", "ntn", "cnic", "jazzcash", "easypaisa"]);
const ABREVIATIONS_NEERLANDAISES: ReadonlyMap<string, string> = new Map(Object.entries({
  exp: "forwarding", hand: "trading", alg: "general", scheepv: "shipping", int: "international", exped: "forwarding", handelsond: "trading",
}));
const ABREVIATIONS: ReadonlyMap<string, string> = new Map(Object.entries({
  intl: "international", bros: "brothers", mfg: "manufacturing", mgmt: "management",
  svcs: "services", assoc: "associates", st: "saint", capt: "captain", sta: "santa", sto: "santo",
  /* les abréviations d'un clavardage ou d'un connaissement, sans point ni majuscules (jeu 9, 27/09 :
     « najmat alsahel electronics trdg llc », « mulji devshi n sons gen trading ») */
  gle: "generale", gal: "general", fres: "freres", entreprises: "enterprises", entreprise: "enterprise", les: "",
  td: "trading house", nlle: "nouvelle", nouv: "nouvelle",
  hnos: "brothers", gebr: "brothers", hk: "hongkong",
  /* néerlandais et allemand (jeu 14) : « Mij. » la maatschappij, « Transp. », « Internat. », « Wed. » la veuve, « Zn. » les fils,
     « V.d. » van der, « Sueddt. » süddeutsche ; « Hvy » heavy (pas « Ind », qui est Industrial autant qu'Industry :
     six paires perdues à la mesure du 28/09, le crédit d'abréviation par le début le lit déjà) */
  mij: "", transp: "transport", internat: "international", wed: "weduwe", zn: "zonen", vd: "van der", sueddt: "suddeutsche",
  hvy: "heavy",
  /* l'Afrique de l'Est et le Pakistan (jeu 15) : « Ent » enterprises, « Rd » road, « Soc » society, « Pak » Pakistan, « Md. »
     Muhammad, les consonnes d'un clavardage (« Trdrs », « Prts »), « Coop » et « Co-op » */
  ent: "enterprises", rd: "road", soc: "society", md: "muhammad", trdrs: "traders", prts: "parts",
  coop: "cooperative", "co-op": "cooperative", hrdware: "hardware", hdware: "hardware",
  /* « Nig. Ltd », le suffixe du registre nigérian (CAC) : « Okafor Integrated Resources Nig. Ltd » (jeu 10) */
  nig: "nigeria",
  /* les abréviations d'un crédit documentaire et d'un registre (jeu 9) : « Gen Trdg », « Grp Hldgs », « JV », « PKS » */
  jv: "joint venture", grp: "group", hldgs: "holdings", hldg: "holding", gen: "general", trdg: "trading", trdng: "trading",
  bldg: "building", mfrs: "manufacturers", pks: "palm oil mill", bnt: "bint",
  /* les affrètements (jeu 10) : « Shipmgmt » ; « Nig. » est plus haut, avec la voie formes */
  shipmgmt: "ship management",
  /* les abréviations du registre turc (jeu 12) : « San. Tic. Ltd. Şti. », « İth. İhr. », « Nak. » ; les conjonctions
     nordiques (« och », « og », « ja ») et la mention « (publ) » d'une société suédoise cotée */
  tic: "ticaret", ith: "ithalat", ihr: "ihracat", nak: "nakliyat", muh: "muhendislik", turz: "turizm", teks: "tekstil",
  /* PAS « san » (San Miguel), « ins » (Ins. Co.), « paz » (La Paz), « tas », « mad » : des mots d'ailleurs */
  och: "", og: "", ja: "", publ: "",
  /* les abréviations de Muhammad : « Mohd » et « Muhd » en Malaisie, « Md. » au Bangladesh et au Pakistan (jeu 15, tour 11 : « Md. Ilyas
     & Brothers » face à « Muhammad Ilyas & Bros. » à 0,635, « md » mot rare orphelin) ; toutes rendues « muhammad », que le squelette
     arabe rejoint à Mohamed et Mohammed ; Haji, Dato', Datuk, Encik, Puan ne désignent personne */
  mohd: "muhammad", muhd: "muhammad", haji: "", hajjah: "", hj: "", hjh: "", dato: "", datuk: "", datin: "", encik: "", puan: "", tuan: "",
  /* les nombres écrits en lettres deviennent des chiffres : « Nine Willows » est « 9 Willows » */
  zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8",
  nine: "9", ten: "10", eleven: "11", twelve: "12",
  /* mots de liaison, ézafé persan, titres de civilité indiens (« Shree », « M/s. ») */
  and: "", et: "", ve: "", und: "", y: "", e: "", i: "", ye: "", kai: "", for: "", of: "", the: "",
  /* « en », le « et » néerlandais et afrikaans (« Expeditie en Overslag », « Bou en Konstruksie », jeu 10) */
  en: "",
}));
/** Les CIVILITÉS indiennes d'une maison de commerce (« Shree », « Shri », « Sri », « Smt. ») : retirées
 *  comme un mot de liaison, mais RETENUES, parce qu'un clavardage les soude au mot qui suit
 *  (« sripelangi distributors » pour « Sri Pelangi Distributors ») et que le score doit savoir que
 *  l'autre nom l'a écrite (voir `scorePrepares`). */
export const CIVILITES: ReadonlySet<string> = new Set(["shri", "shree", "sri", "sree", "smt"]);
/**
 * LE VOCABULAIRE DU MÉTIER : les mots que la préparation connaît par leurs tables (formes juridiques,
 * locutions, traductions, abréviations), rangés par longueur. Un mot qu'une lecture optique a abîmé
 * (« LIRNITED », « L1MITED », « C?NG TY ») ne se reconnaît qu'à cette aune : rendu à ce vocabulaire,
 * il redevient la forme ou le mot générique que les tables retirent ou traduisent. Les nombres en
 * lettres n'en sont pas : « T?N » n'est pas « ten », et un numéro d'un seul côté plafonnerait la paire.
 * Construit à la première demande : les tables qu'il lit sont déclarées au-dessus.
 */
let VOCABULAIRE_DU_METIER: ReadonlyMap<number, readonly string[]> | undefined;
function vocabulaireDuMetier(): ReadonlyMap<number, readonly string[]> {
  if (VOCABULAIRE_DU_METIER) return VOCABULAIRE_DU_METIER;
  const mots = new Set<string>(FORMES);
  for (const p of PHRASES) for (const m of p.trim().split(" ")) mots.add(m);
  for (const [de, vers] of LOCUTIONS) {
    /* une locution qui ne fait que SOUDER un lieu (« da nang » : « danang ») n'apprend pas un mot du
       métier : « nang » y ferait concurrence à « nong » (de « nong san »), et « N?ng » resterait perdu */
    const v = vers.trim();
    if (v !== "" && !v.includes(" ") && de.replace(/ /g, "").includes(v)) continue;
    for (const m of de.trim().split(" ")) mots.add(m);
  }
  for (const m of TRADUCTIONS.keys()) mots.add(m);
  for (const [m, vers] of ABREVIATIONS) if (!/^\d+$/.test(vers)) mots.add(m);
  const parLongueur = new Map<number, string[]>();
  for (const m of mots) {
    const l = parLongueur.get(m.length);
    if (l) l.push(m); else parLongueur.set(m.length, [m]);
  }
  VOCABULAIRE_DU_METIER = parLongueur;
  return parLongueur;
}
/** Le mot est connu : du vocabulaire du métier, ou du dictionnaire anglais (`lemme`). */
function motConnu(m: string): boolean {
  return (vocabulaireDuMetier().get(m.length) ?? []).includes(m) || lemme(m) !== undefined;
}

/**
 * LES DIGRAMMES D'UNE LECTURE OPTIQUE : « rn » lu pour m (« LIRNITED »), « cl » pour d (« LTCL »),
 * « vv » pour w (« VVORKS »). Un mot que rien ne connaît, et qui, le digramme rendu, est une forme,
 * un mot du métier ou un mot du dictionnaire, est ce mot ; il faut le rendre AVANT la lecture des
 * formes, sinon « Lirnited » restait un mot rare sans répondant (mesuré le 27/09 sur le jeu 9 :
 * « WING SHING GROUP HOLDINGS LIRNITED » plafonné à 0,800). Jamais l'inverse, et jamais sur un mot
 * connu : « Carnowell » reste Carnowell, « Warner » reste Warner (le squelette lit déjà rn comme m
 * entre deux noms propres, au score).
 */
const DIGRAMMES_OPTIQUES: readonly (readonly [string, string])[] = [["rn", "m"], ["cl", "d"], ["vv", "w"]];
function digrammeOptique(j: string): string {
  if (j.length < 4 || !/\p{L}/u.test(j) || /\d/.test(j) || motConnu(j)) return j;
  for (const [lu, vrai] of DIGRAMMES_OPTIQUES) {
    if (!j.includes(lu)) continue;
    const rendu = j.split(lu).join(vrai);
    if (motConnu(rendu)) return rendu;
  }
  return j;
}

/**
 * UNE FORME ABÎMÉE D'UN « ? » : le mot autour du « ? » (« LT? » : « lt » et « » ; « L?D » : « l » et
 * « d »), complété par rien (le point d'une abréviation mal lu : « Ltd? ») ou par une lettre, est-il
 * une forme juridique ? Deux lettres au moins autour du « ? » : « S? » serait n'importe quoi. Rendu
 * en minuscules, ce que la normalisation fait de toute façon ; undefined si rien ne complète.
 */
const LETTRES = "abcdefghijklmnopqrstuvwxyz";
function formeAbimee(avant: string, apres: string): string | undefined {
  const a = normaliser(avant), b = normaliser(apres);
  if (a.length + b.length < 2) return undefined;
  if (FORMES.has(a + b)) return a + b;
  for (const c of LETTRES) if (FORMES.has(a + c + b)) return a + c + b;
  return undefined;
}

/**
 * UN MOT À LETTRE-JALON QUE LE VOCABULAIRE DU MÉTIER CONNAÎT D'UNE SEULE FAÇON : « cʔng » est « cong »
 * (de « cong ty »), « nʔng » est « nong » (de « nong san »), « lʕmited » est « limited ». Rendu au mot,
 * il retrouve sa table : la forme part, la locution se traduit, comme sur l'autre nom (mesuré le 27/09
 * sur le jeu 9 : « C?NG TY TNHH » gardait « cʔng ty » pour deux mots rares, 0,800 ; « N?ng san » ne
 * rencontrait plus « agricultural products », 0,400). Deux mots du vocabulaire qui conviennent, et le
 * jalon reste (« ʔʔc » est « inc », « llc », « sac » : on ne choisit pas) ; un nom propre n'est jamais
 * touché, le score lit son jalon (`lettrePerdue`).
 */
function motDuMetierPerdu(j: string): string {
  if (!porteUnJalon(j)) return j;
  const perdus = j.split(PERDU).length - 1;
  let trouve: string | undefined;
  for (let L = j.length; L <= j.length + perdus; L++) {
    for (const m of vocabulaireDuMetier().get(L) ?? []) {
      if (!lettrePerdue(j, m)) continue;
      if (trouve !== undefined) return j;
      trouve = m;
    }
  }
  return trouve ?? j;
}

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
  "ß": "ss", "æ": "ae", "Æ": "AE", "œ": "oe", "Œ": "OE", "þ": "th", "Þ": "Th", "ð": "d", "Ð": "D", "ə": "e", "Ə": "E",
};
export function plier(nom: string): string {
  return plierLatin(romaniser(nom).texte);
}
/** Le cyrillique est translittéré ICI, avant l'analyse des formes : « ООО » doit être lu
 *  « OOO » pour être une forme (mesuré le 27/09 : sinon il restait un mot rare sans répondant,
 *  et « ООО Северный Транзит » plafonnait au possible face à « OOO Severny Tranzit »). Les
 *  autres écritures (hangul, arabe et persan, hébreu, sinogrammes) ont déjà été lues par
 *  `romaniser` (ecritures.ts), qui rend des jetons latins et traduit leurs mots du commerce. */
function plierLatin(nom: string): string {
  const latin = /[\u0400-\u04ff]/.test(nom) ? translitterer(nom.toLowerCase()) : nom;
  return grec(latin.replace(/[ıİłŁøØđĐħĦßæÆœŒþÞðÐəƏ]/g, (c) => LETTRES_SANS_BASE[c] ?? c));
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
 * un 5 ou un 8 était « o », « l » ou « i », « s », « b » (« C0LBROOK », « E5BRAND », « 8EARING »,
 * « 8AHARI ») ; un numéro court où traînent un « o » ou un « l » était un chiffre (« BELLAMARE 1O »,
 * « MUTIARA l2 »). Hors de ces deux cas, rien ne bouge : « S1187 » reste un numéro de coque,
 * « 3M » un nom.
 *
 * Le 1 est la seule lecture AMBIGUË : un l minuscule ou une I capitale, que la casse perdue à la
 * normalisation ne départage plus (« KEMUN1NG » est Kemuning, « Trai1 » est Trail). Il devient la
 * lettre-jalon LU_UN, que le score lit comme un i ou un l et rien d'autre (`lettrePerdue`). Lu « l »
 * d'office, « kemunlng » face à « kemuning » restait un mot ambigu plafonné au possible (mesuré le
 * 27/09 sur le jeu 9 : « MT C0RAL KEMUN1NG » à 0,800, « JAT1 LESTAR1 NU5ANTARA » à 0,727).
 */
function ocr(j: string): string {
  if (j === "000") return "ooo";
  if (!/\d/.test(j) || !/\p{L}/u.test(j)) return j;
  const enLettres = (m: string) => m.replace(/0/g, "o").replace(/1/g, LU_UN).replace(/5/g, "s").replace(/8/g, "b");
  /* un seul 1, 0 ou 5 à la fin d'un mot d'au moins quatre lettres est un l, un o, un s mal lus
     (« Trai1 ») ; deux chiffres ou plus sont un numéro (« TCB1207 ») */
  if (/^\p{L}{4,}[105]$/u.test(j)) return enLettres(j);
  /* « A1i » (jeu 15) : un 1 entre deux lettres d'un mot de trois, un nom court mal lu, jamais un numéro */
  if (/^\p{L}1\p{L}$/u.test(j)) return enLettres(j);
  /* « AUT0 » (trois lettres) et « ELECTR0NIC5 » (des chiffres au milieu ET à la fin) : quand le mot
     corrigé est un mot du dictionnaire, c'est une lecture fautive, pas un numéro (jeu 10, 27/09) */
  const commeUnMot = j.replace(/0/g, "o").replace(/1/g, "i").replace(/5/g, "s").replace(/8/g, "b");
  if (FORMES.has(commeUnMot)) return enLettres(j);   /* « ST1 » est « Şti », une forme (jeu 12) */
  if (/^\p{L}+[0158](?:\p{L}+[0158]?)*$/u.test(j) && /\p{L}{3,}/u.test(j) && lemme(commeUnMot)) return enLettres(j);
  const lettres = j.replace(/\d/g, ""), chiffres = j.replace(/\D/g, "");
  /* des chiffres EN FIN de mot sont un numéro (« No18 », « TCB1207 »), pas une lecture fautive */
  if (j.length >= 4 && lettres.length >= 2 && /^[0158]+$/.test(chiffres) && !/\d$/.test(j)) return enLettres(j);
  if (j.length <= 4 && /^[olis]+$/.test(lettres)) return j.replace(/o/g, "0").replace(/[li]/g, "1").replace(/s/g, "5");
  /* un chiffre confondu EN TÊTE d'un mot court (« 8G » pour BG, le préfixe d'une barge) : un numéro
     ne commence pas par un chiffre que suivent des lettres qui ne sont pas elles-mêmes des chiffres
     mal lus ; les mots d'ordre (« 1st », « 8th ») passent aussi, des deux côtés de la comparaison */
  if (/^[0158]\p{L}+$/u.test(j)) return enLettres(j);
  return j;
}

/**
 * LA LECTURE OPTIQUE D'UN DOCUMENT EN CAPITALES (registres panaméens et béliziens, jeu 11) : une lecture
 * optique rend la capitale I par un l minuscule (« lSLA », « LlMlTED », « MARlS », « NAVlERA »), le chiffre
 * romain II par « ll » (« DON RAM0N ll »), et le S d'un sigle à points par un 5 (« 5.A. »). La casse est ce
 * qui les trahit : dans un nom qui n'a aucune minuscule hors ce l, un l minuscule ne peut pas être une lettre
 * du nom. `ocr` et `digrammeOptique` travaillent après la mise en minuscules, où « lsla » et « isla » ne se
 * distinguent plus, et « 5.A. » y est déjà un numéro et une lettre : ces lectures-là se rendent AVANT, sur
 * le nom brut (mesuré le 27/09 : « lSLA GRANDE CHARTERS LlMlTED » à 0,520 face à « Isla Grande Charters
 * Limited », « NAVlERA PUNTA CHAME 5.A. » à 0,645). Un nom qui porte une autre minuscule (« Al Fassi »,
 * « GmbH », « McDonald ») n'est pas touché ; deux capitales au moins, sinon rien ne dit que le document
 * est en capitales.
 */
function capitalesLuesOptiquement(nom: string): string {
  if (!nom.includes("l") || /(?!l)\p{Ll}/u.test(nom) || (nom.match(/\p{Lu}/gu)?.length ?? 0) < 2) return nom;
  return nom
    /* un sigle à points où traîne un 0, un 1, un 5 ou un 8 (« 5.A. », « 5.A. DE C.V. ») : O, I, S, B */
    .replace(/(?<![\p{L}\d])(?:[\p{Lu}0158]\.){2,}(?![\p{L}\d])/gu,
      (m) => (/\p{Lu}/u.test(m) && /\d/.test(m) ? m.replace(/0/g, "O").replace(/1/g, "I").replace(/5/g, "S").replace(/8/g, "B") : m))
    .replace(/l/g, "I");
}

/** Préfixes et codes de type de navire, seulement EN TÊTE et seulement s'il reste un nom
 *  derrière : M/V, M/T, M/S, M/Y, S/Y, SS, FV, RV, LPG/C, LNG/C. */
const PREFIXES_NAVIRE = new Set(["mv", "mt", "ms", "my", "sy", "ss", "mts", "fv", "rv", "tb", "lpgc", "lngc", "tug", "barge", "tugboat",
  /* le Rhin et la Meuse (jeu 14) : TMS (Tankmotorschiff), GMS (Gütermotorschiff), MSV, la duwbak (barge poussée), le duwboot
     (pousseur) et le sleepboot (remorqueur), écrits devant le nom ou entre parenthèses derrière */
  "tms", "gms", "msv", "duwbak", "duwboot", "sleepboot",
  /* l'Asie du Sud-Est (jeu 9) : BG et TK (barge, tongkang), TB (tug boat), KM (kapal motor), LCT, SPOB */
  "bg", "tk", "km", "kmp", "klm", "lct", "spob", "mtug", "mfv",
  "tanker", "vessel", "roro", "ferry", "dredger", "trawler",
  /* le monde hispanophone et lusophone (jeu 11) : MN (motonave, « M/N » ou « MN RÍO CHAGRES » sans sa barre), et le
     type écrit en toutes lettres devant le nom (« Barcaza Manglar 3 », « Remolcador Titán del Canal », « Lancha »,
     « Pesquero », « Buque », « Navio », « Motonave ») ; B/M, N/M et R/M, écrits avec leur barre, sont rendus MV et TUG
     avant (voir `analyserEntite`) */
  "mn", "motonave", "barcaza", "remolcador", "rebocador", "lancha", "pesquero", "buque", "navio", "velero", "yate",
  /* la coque en construction : « NEWBUILDING S-1187 », « N/B S1187 » rendu ici (voir `analyserEntite`) ; son numéro de
     chantier est le numéro que la règle des numéros lit */
  "newbuilding"]);
/** Le TYPE que le préfixe déclare quand il en déclare un : un remorqueur et sa barge portent souvent le
 *  même nom (« Tug Heron Reef », « Barge Heron Reef 2 » ; jeu 9 : « BARGE THONG CHAROEN 9 » et « TUG THONG
 *  CHAROEN 9 » jugés deux navires, quand « TB » et « TUG » écrivent le même). MV et MT ne disent rien ici.
 *  « Barcaza » est la barge, « Remolcador » et « Rebocador » le remorqueur (jeu 11 : « Tug Poderoso » face à
 *  « Barge Poderoso », deux coques ; face à « R/M Poderoso », la même). */
const TYPES_NAVIRE: ReadonlyMap<string, string> = new Map([["tug", "tug"], ["tb", "tug"], ["tugboat", "tug"], ["mtug", "tug"],
  ["duwbak", "barge"], ["duwboot", "tug"], ["sleepboot", "tug"],
  ["barge", "barge"], ["bg", "barge"], ["tk", "barge"], ["barcaza", "barge"], ["remolcador", "tug"], ["rebocador", "tug"]]);
const PHRASES_NAVIRE = [" motor vessel ", " motor tanker ", " motor ship ", " motor yacht ",
  " sailing yacht ", " steam ship ", " lpg carrier ", " lng carrier ", " lpg tanker ", " fishing vessel ",
  " bulk carrier ", " container ship ", " oil tanker ", " chemical tanker ", " hopper barge ", " tug barge ", " ro ro vessel ",
  " ro ro ship ", " roro vessel ", " ro ro ", " general cargo ship ", " general cargo vessel ", " offshore supply vessel ", " supply vessel ",
  /* la coque en construction désignée par son numéro de chantier (« NEWBUILDING HULL NO. S-1187 », « Hull No. 2287 … ») : les
     plus longues d'abord, « hull no » seul ensuite ; jamais « hull » seul, c'est aussi une ville (Hull Blyth) */
  " newbuilding hull no ", " newbuilding hull number ", " newbuilding hull ", " new building hull no ", " new building hull ",
  " new building ", " hull no ", " hull number "];
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
  poser(["DE", "AT"], ["kg", "ohg", "kommanditgesellschaft", "gmbh co kg", "gmbh und co kg", "gmbh and co kg", "mbh co kg", "mbh und co kg",
    "mbh and co kg", "ag co kg", "ag und co kg", "se co kg", "se und co kg", "gmbh co ohg", "mbh co ohg", "gmbh co kgaa", "gmbh co", "mbh co",
    "co kg", "co ohg", "und co kg", "and co kg", "kgaa", "gesellschaft mbh co kg", "handelsgesellschaft mbh co kg"]);
  poser(["DE", "AT", "CH"], ["mbh"]); poser(["DE"], ["gbr"]);
  poser(["PT", "AO", "MZ", "CV"], ["lda"]);
  poser(["DE"], ["ug"]);
  poser(["FR"], ["sasu", "eurl", "societe par actions simplifiee", "etablissements", "ets", "scea", "gaec", "earl"]);
  poser(["IE"], ["dac", "designated activity company", "teoranta", "teo", "cuideachta"]);
  poser(["TH"], ["pcl", "public company limited"]);
  poser(["ID"], ["pt", "perseroan terbatas", "tbk", "ud", "usaha dagang", "perseroan komanditer"]);
  poser(["IR"], ["sherkat sahami khas", "sherkate sahami khas", "sahami khas", "sahami khass", "sahami amm"]);
  poser(["AZ"], ["mmc"]); poser(["LB"], ["sal"]);
  poser(["FR", "LU", "MA", "TN", "LB"], ["sarl", "societe a responsabilite limitee"]);
  poser(["FR", "CO"], ["sas"]);
  poser(["FR", "IT"], ["snc"]);
  poser(["BE"], ["sprl", "bvba"]);
  poser(["NL"], ["bv", "vof", "besloten vennootschap"]);
  poser(["NL", "BE"], ["nv", "naamloze vennootschap"]);
  poser(["IT", "RO", "AR", "PE", "BO", "UY"], ["srl", "societa a responsabilita limitata"]);
  poser(["IT"], ["spa", "societa per azioni"]);
  poser(["ES"], ["sl", "slu", "sau", "sociedad limitada"]);
  poser(["MX"], ["sa de cv", "de cv", "cv", "sapi", "s de rl de cv", "s de rl", "sociedad anonima promotora de inversion de capital variable",
    "sociedad anonima promotora de inversion", "sociedad anonima de capital variable"]);
  poser(["CZ", "SK"], ["spol s ro", "spol sro"]);
  poser(["PE"], ["sac", "saa", "sociedad anonima cerrada"]);
  poser(["BR", "CO", "CL", "PT"], ["ltda", "limitada", "sociedade limitada"]);
  poser(["PT", "AO", "MZ", "CV"], ["lda"]);
  poser(["BR"], ["eireli", "empresa individual de responsabilidade limitada"]);
  poser(["RU", "BY", "KZ", "UZ", "UA", "KG", "TJ", "AM", "AZ", "GE"], ["ooo", "oao", "zao", "pao", "ao", "jsc", "pjsc", "ojsc", "cjsc", "too",
    "obshchestvo s ogranichennoi otvetstvennostyu", "obshchestvo s ogranichennoy otvetstvennostyu",
    "tovarishchestvo s ogranichennoi otvetstvennostyu", "publichnoe aktsionernoe obshchestvo",
    "zakrytoe aktsionernoe obshchestvo", "otkrytoe aktsionernoe obshchestvo", "aktsionernoe obshchestvo"]);
  /* « joint stock company » écrit en anglais n'a PAS de pays : la Pologne (« Spółka Akcyjna »), le
     Vietnam, le Golfe, la Bulgarie le traduisent ainsi ; le lier à la CEI faisait un conflit de pays
     entre « Sokołowiec Chemical Works Spółka Akcyjna » et « … Joint-Stock Company » (27/09) */
  poser(["TR"], ["sti", "anonim sirketi", "limited sirketi", "sirketi"]);
  poser(["TR", "NO", "DK", "EE"], ["as"]);
  poser(["NO"], ["asa"]); poser(["DK"], ["aps"]); poser(["EE"], ["ou"]); poser(["LT"], ["uab"]);
  poser(["AE"], ["dmcc", "jafza", "dafza", "difc", "dso", "dwc", "rakez", "kizad"]);
  poser(["AE", "SA", "QA", "BH", "KW", "OM"], ["fze", "fzco", "fzc", "fzllc", "fz", "wll", "spc", "sole proprietor company", "sole proprietorship company", "est",
    "sole proprietor company", "sole proprietorship company",
    "establishment", "establishments", "free zone establishment", "free zone company",
    "free zone limited liability company", "fz llc", "with limited liability"]);
  poser(["MY"], ["sdn", "bhd", "berhad", "sendirian berhad", "sendirian"]);
  poser(["SG"], ["pte"]);
  poser(["AU", "ZA"], ["pty", "proprietary limited"]);
  poser(["IN", "PK", "LK", "BD"], ["pvt"]);
  poser(["IN", "PK", "LK", "BD", "SG", "NG", "ZA", "AU", "NZ", "KE"], ["private limited", "private ltd", "pvt limited"]);
  poser(["JP"], ["kk", "gk", "yk", "kabushiki kaisha", "kabushikigaisha", "kabushiki gaisha", "godo kaisha", "godo gaisha", "yugen kaisha", "yugen gaisha"]);
  poser(["KR"], ["chusik hoesa", "jusik hoesa", "jusikhoesa", "chusikhoesa", "yuhanhoesa"]);
  poser(["CN", "HK", "TW"], ["youxian gongsi", "gufen youxian gongsi", "youxian zeren gongsi"]);
  /* 私人有限公司 : la société privée de Singapour (Pte. Ltd.) et de Malaisie (Sdn. Bhd.), en chinois */
  poser(["SG", "MY"], ["siren youxian gongsi"]);
  poser(["US", "CA", "PH"], ["inc", "incorporated", "pllc"]);
  poser(["CA"], ["ltee"]); poser(["SE"], ["aktiebolag"]); poser(["DK"], ["aktieselskab"]); poser(["NO"], ["aksjeselskap"]); poser(["FI"], ["osakeyhtio"]);
  poser(["EE"], ["ou", "osauhing", "aktsiaselts"]); poser(["DK"], ["anpartsselskab"]); poser(["LV"], ["sia", "sabiedriba ar ierobezotu atbildibu"]);
  poser(["LT"], ["uab", "uzdaroji akcine bendrove"]);
  poser(["UK", "IE", "NG", "LK", "ZA"], ["plc", "public limited company"]);
  poser(["PL"], ["sp zoo", "sp z oo", "spolka z ograniczona odpowiedzialnoscia", "spolka akcyjna", "spolka jawna"]);
  poser(["VN"], ["tnhh", "cong ty tnhh", "cong ty co phan"]);
  poser(["TH"], ["borisat chamkat", "borisat jamkat", "chamkat", "jamkat"]);
  poser(["IR"], ["sherkat", "sherkate"]);
  poser(["UA"], ["prat", "pat", "tov", "tovarystvo z obmezhenoiu vidpovidalnistiu", "tovarystvo z obmezhenoyu vidpovidalnistyu",
    "pryvatne aktsionerne tovarystvo", "publichne aktsionerne tovarystvo", "aktsionerne tovarystvo"]);
  poser(["RU", "BY", "KZ", "UA"], ["npp", "npo", "npk", "npf", "pkf", "nauchno proizvodstvennoe predpriyatie",
    "nauchno proizvodstvennoe obedinenie", "nauchno proizvodstvennyi kompleks", "nauchno proizvodstvennaya firma",
    "proizvodstvenno kommercheskaya firma", "proizvodstvennoe obedinenie"]);
  poser(["GR", "CY"], ["ae", "epe", "ike", "oe", "ee"]);
  /* « SIA » est la société lettone (sabiedrība ar ierobežotu atbildību) autant que le « & Cie » grec (ΣΙΑ) */
  poser(["GR", "CY", "LV"], ["sia"]);
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
    "proprietary limited", "private ltd", "pvt limited", "youxian gongsi", "youxian zeren gongsi", "siren youxian gongsi", "borisat chamkat", "borisat jamkat", "chamkat", "jamkat"]);
  poser(["ltd", "corp"], ["bhd", "berhad", "kk", "kabushiki kaisha", "kabushikigaisha", "kabushiki gaisha", "jusikhoesa", "chusikhoesa",
    "chusik hoesa", "jusik hoesa", "gufen youxian gongsi", "oy", "ab", "aktiebolag", "aktieselskab", "aksjeselskap", "osakeyhtio"]);
  /* et la Yūgen Kaisha (有限会社), que l'anglais rend « Co., Ltd. » ou « Y.K. » */
  poser(["ltd", "llc"], ["ooo", "tov", "ltda", "lda", "limitada", "sociedade limitada", "eireli", "osauhing", "anpartsselskab",
    "sabiedriba ar ierobezotu atbildibu", "uzdaroji akcine bendrove", "ou", "sia", "uab", "aps", "tnhh", "cong ty tnhh", "sti", "limited sirketi",
    "yuhanhoesa", "yugen kaisha", "yugen gaisha", "yk", "empresa individual de responsabilidade limitada",
    "tovarystvo z obmezhenoiu vidpovidalnistiu", "tovarystvo z obmezhenoyu vidpovidalnistyu"]);
  /* l'AT ukrainien (акціонерне товариство), PrAT et PAT : la société par actions, comme JSC et AO */
  poser(["corp"], ["pryvatne aktsionerne tovarystvo", "publichne aktsionerne tovarystvo", "aktsionerne tovarystvo"]);
  /* le TOO kazakh (товарищество с ограниченной ответственностью) se traduit LLP, LLC ou Ltd */
  poser(["ltd", "llc", "part"], ["too", "tovarishchestvo s ogranichennoi otvetstvennostyu", "tovarishchestvo s ogranichennoy otvetstvennostyu"]);
  poser(["ltd", "corp"], ["pt", "perseroan terbatas", "tbk", "ud", "usaha dagang", "commanditaire vennootschap", "perseroan komanditer", "pcl", "public company limited", "teoranta", "teo", "dac", "designated activity company"]);
  poser(["corp"], ["private joint stock company", "private joint stock", "public joint stock", "closed joint stock", "open joint stock",
    "sherkat sahami khas", "sherkate sahami khas", "sahami khas", "sahami amm",
    "sociedad anonima promotora de inversion de capital variable", "sociedad anonima promotora de inversion",
    "sociedad anonima unipersonal", "sociedad anonima de capital variable"]);
  poser(["part"], ["scea", "gaec", "earl"]);
  poser(["llc"], ["llc", "pllc", "gmbh", "mbh", "gesellschaft mbh", "handelsgesellschaft mbh", "ug", "sarl", "eurl", "sprl", "bvba", "srl", "sl", "slu", "bv", "aps", "kft", "sro",
    "doo", "eood", "ood", "epe", "ike", "wll", "spc", "mmc", "s de rl", "s de rl de cv",
    "limited liability company", "obshchestvo s ogranichennoi otvetstvennostyu", "obshchestvo s ogranichennoy otvetstvennostyu",
    "gesellschaft mit beschrankter haftung",
    "societe a responsabilite limitee", "sociedad limitada", "sociedad de responsabilidad limitada",
    "societa a responsabilita limitata", "besloten vennootschap", "sp zoo", "sp z oo", "spolka z ograniczona odpowiedzialnoscia",
    "godo kaisha", "godo gaisha", "gk", "with limited liability", "spol s ro", "spol sro"]);
  /* la zone franche est un registre à part : une FZE et une LLC du même nom sont deux sociétés */
  poser(["fz"], ["fze", "fzco", "fzc", "fzllc", "fz llc", "fz", "dmcc", "jafza", "dafza", "difc", "dso", "dwc", "rakez", "kizad",
    "free zone establishment", "free zone company",
    "free zone limited liability company"]);
  poser(["corp"], ["inc", "incorporated", "corp", "corporation", "corporacion", "corporacao", "plc", "public limited company", "ag", "se", "sa", "sas", "sasu",
    "spa", "sau", "nv", "oyj", "as", "asa", "zrt", "nyrt", "ad", "cv", "sapi", "sac", "saa", "oao", "zao", "pao", "ao", "jsc",
    "pjsc", "ojsc", "cjsc", "prat", "pat", "ae", "joint stock company", "public joint stock company", "closed joint stock company",
    "open joint stock company", "aktsionernoe obshchestvo", "publichnoe aktsionernoe obshchestvo",
    "zakrytoe aktsionernoe obshchestvo", "otkrytoe aktsionernoe obshchestvo", "aktiengesellschaft", "societe anonyme",
    "societe par actions simplifiee", "sociedad anonima", "soc anon", "sociedad anonima cerrada", "sociedade anonima",
    "societa per azioni", "naamloze vennootschap", "anonim sirketi", "spolka akcyjna", "cong ty co phan", "sa de cv", "de cv"]);
  poser(["part"], ["llp", "lp", "kg", "ohg", "snc", "vof", "limited liability partnership", "kommanditgesellschaft", "spolka jawna",
    /* les sociétés de personnes allemandes dont une société de capitaux est l'associée : une autre personne que celle-ci */
    "gmbh co kg", "gmbh und co kg", "gmbh and co kg", "mbh co kg", "mbh und co kg", "mbh and co kg", "ag co kg", "ag und co kg",
    "se co kg", "se und co kg", "gmbh co ohg", "mbh co ohg", "gmbh co kgaa", "gmbh co", "mbh co", "co kg", "co ohg", "und co kg",
    "and co kg", "kgaa", "gbr", "sce", "gesellschaft mbh co kg", "handelsgesellschaft mbh co kg"]);
  poser(["llc"], ["mbh"]);
  poser(["ltd", "llc"], ["lda"]);
  poser(["est"], ["est", "establishment", "establishments", "sole proprietorship"]);
  return t;
})();

/** Les provinces et grandes villes de Chine, qui ouvrent le nom d'une société chinoise et s'omettent
 *  aussi souvent qu'elles se disent : « Fujian Quanzhou Xingtai Shoes » est « Quanzhou Xingtai Shoes ». */
export const REGIONS: ReadonlySet<string> = new Set([
  "anhui", "beijing", "chongqing", "fujian", "gansu", "guangdong", "guangxi", "guizhou", "hainan", "hebei",
  "heilongjiang", "henan", "hubei", "hunan", "jiangsu", "jiangxi", "jilin", "liaoning", "neimenggu", "ningxia",
  "qinghai", "shaanxi", "shandong", "shanghai", "shanxi", "sichuan", "tianjin", "xinjiang", "xizang", "yunnan",
  "zhejiang", "hongkong", "macau", "taiwan", "shenzhen", "guangzhou", "dongguan", "foshan", "zhongshan", "ningbo",
  "hangzhou", "wenzhou", "yiwu", "suzhou", "wuxi", "nanjing", "qingdao", "yantai", "weifang", "xiamen", "quanzhou",
  "fuzhou", "wuhan", "changsha", "zhengzhou", "chengdu", "xian", "dalian", "shenyang", "harbin", "kunming", "nanning",
  "hefei", "jinan", "shijiazhuang", "taizhou", "jiaxing", "shaoxing", "zhuhai", "huizhou", "jiangmen", "shantou",
  "nanhai", "shunde", "baoan", "longgang", "pudong", "minhang", "jiading", "xiaoshan", "yuhang", "binjiang", "cixi", "yuyao",
  "jinjiang", "shishi", "changle", "fuqing", "panyu", "huadu", "nansha", "zengcheng", "tongzhou", "kunshan", "zhangjiagang",
  "changzhou", "nantong", "yangzhou", "xuzhou", "linyi", "zibo", "dongying", "weihai", "rizhao", "tangshan", "baoding",
]);

const QUALIFICATIFS_PRIVES = new Set(["pty", "pte", "pvt", "sdn", "sendirian"]);
/** Un mot de trois lettres à UNE substitution de pte, pty ou pvt, hors des formes : ce qualificatif
 *  (voir `analyserEntite`, devant Ltd). Sinon le mot lui-même. */
function qualificatifAbime(j: string): string {
  if (j.length !== 3 || FORMES.has(j)) return j;
  return ["pte", "pty", "pvt"].find((q) => [...q].filter((c, i) => c !== j[i]).length === 1) ?? j;
}
const PHRASES_PRIVEES = new Set(["private limited", "private ltd", "pvt limited", "proprietary limited", "sendirian berhad", "siren youxian gongsi"]);
/** Les formes chinoises qui, ÉCRITES EN CARACTÈRES, ne disent ni le pays ni le statut privé (voir `analyserEntite`). */
const FORMES_CHINOISES = new Set(["youxian gongsi", "youxian zeren gongsi"]);
const PAYS_DU_CHINOIS_ECRIT = ["CN", "HK", "TW", "MO", "SG", "MY"];

/** Dans le registre nord-américain, une société par actions se désigne « Inc. » ou « Corp. »,
 *  et la désignation fait partie du nom déposé : « Harlowe Grain Corporation » et « Harlowe
 *  Grain Inc. » sont deux sociétés (jeu 8, quatre paires jugées différentes ; les jeux 1 à 7
 *  n'en jugent aucune dans l'autre sens). Les familles ne les séparent pas, toutes deux
 *  « corp », et « Inc. » traduit aussi bien un K.K. ou une JSC : la désignation est plus fine
 *  que la famille, et ne se lit que là où un registre la garde distincte. Les deux écritures
 *  d'une même désignation (« Inc. », « Incorporated » ; « Corp. », « Corporation ») restent une. */
const DESIGNATIONS: ReadonlyMap<string, string> = new Map([
  ["inc", "inc"], ["incorporated", "inc"], ["corp", "corp"], ["corporation", "corp"], ["corporacion", "corp"], ["corporacao", "corp"],
  /* les zones franches des Émirats : « Silver Dune Logistics FZCO » et « Silver Dune Logistics DMCC » sont deux
     dépôts dans deux zones (jeu 9). Et dans une même zone, la FZE (un seul actionnaire), la FZCO ou FZC (plusieurs)
     et la FZ-LLC sont trois immatriculations : « Sadeem Crescent Marine FZE » n'est pas « Sadeem Crescent Marine
     FZCO » (jeu 14, tour 10 : trois paires jugées différentes à 0,955 et 1,000, aucune dans l'autre sens sur les
     quatorze jeux). « FZ » seul ne dit pas laquelle : aucune désignation. La forme en toutes lettres porte la
     désignation de son sigle */
  ["fze", "fze"], ["free zone establishment", "fze"], ["fzco", "fzco"], ["fzc", "fzco"], ["free zone company", "fzco"],
  ["fzllc", "fzllc"], ["fz llc", "fzllc"], ["free zone limited liability company", "fzllc"],
  ["dmcc", "dmcc"], ["jafza", "jafza"], ["dafza", "dafza"], ["difc", "difc"], ["dso", "dso"], ["dwc", "dwc"], ["rakez", "rakez"], ["kizad", "kizad"],
  /* Bahreïn : la S.P.C. (un seul associé) et la W.L.L. (plusieurs) sont deux immatriculations d'une même famille
     (« Durrat Al Hadeel Trading S.P.C. », « … W.L.L. » : jeu 14, tour 10, deux paires à 1,000) ; la L.L.C., qui rend
     aussi la W.L.L. du Koweït et du Qatar en anglais, n'en porte aucune et ne se met en conflit avec aucune des deux */
  ["spc", "spc"], ["sole proprietor company", "spc"], ["sole proprietorship company", "spc"],
  ["wll", "wll"], ["with limited liability", "wll"],
]);

/** Ce que la préparation a retiré, et qui reste une information ; et la LANGUE que le nom
 *  laisse voir (l'article arabe, une forme japonaise, une province chinoise), qui décide où
 *  les variations de romanisation sont créditées. */
export type Marques = { pays: readonly string[]; familles: readonly string[]; navire: boolean; societe: boolean;
  arabe: boolean; japonais: boolean; chinois: boolean; coreen: boolean; hebreuOuGrec: boolean; indien: boolean; hispanique: boolean;
  /** un nom écrit en tamoul : ses lettres latines viennent de `romaniser`, et le sanskrit du
   *  tamoul se replie au crédit (voir `pliTamoul`) */
  tamoul: boolean;
  /** un nom thaï : son écriture, une province ou un port, sa forme (borisat, chamkat), un mot du commerce, ou un mot que le
   *  dictionnaire ignore et qui écrit ph devant r ou l (« Phrachan », « Chaiyaphruek » : la RTGS seule l'écrit). Sous cette marque,
   *  la RTGS et la graphie d'usage d'un même mot sont un mot (voir `pliThai`) */
  thai: boolean;
  /** un nom russe, ukrainien ou d'un autre pays d'écriture cyrillique : le cyrillique lui-même, une forme de la CEI ou
   *  d'Ukraine (OOO, TOV, ZAO, PAO, AT…), un mot du commerce translittéré (zavod, torgovyy, morskoy, flot), un grade
   *  de navire (kapitan, matros), le T/H du teplokhod, ou un suffixe de nom propre (-ov, -skiy, -enko, -chuk). Sous
   *  cette marque, deux romanisations d'une même suite cyrillique sont un mot (voir `pliSlave`) */
  slave: boolean;
  /** un qualificatif de société privée (Pty, Pte, Pvt, Sdn, (P)) : « X Pty Ltd » n'est pas « X Ltd » */
  prive: boolean;
  /** les désignations écrites qu'un même registre garde distinctes dans une même famille
   *  (« Inc. » et « Corp. », voir DESIGNATIONS) */
  designations: readonly string[];
  /** le nom entier est en majuscules et compte plusieurs mots : un export de système, où les
   *  mots courts sont souvent abrégés sans point (« HVY IND ») */
  majuscules: boolean;
  /** la filiation écrite (« m » bin, ibn ; « f » bint, binti) : deux filiations sont deux personnes */
  filiation: string;
  /** le nom avant et le nom après la particule (« hakim>youssef ») : inversés d'un nom à l'autre, deux personnes */
  filiationOrdre: string;
  /** le nom porte « branch », « succursale », « head office » : ce que la mention NOMME (voir
   *  `mentionDeSuccursale`), « » sans mention ; d'un seul côté, ou deux mentions différentes, la paire se
   *  range au possible */
  succursale: string;
  /** le type que le préfixe de navire déclare (« tug », « barge ») : deux types sont deux navires */
  typeNavire: string;
  /** la marque d'un CLAVARDAGE : tout en minuscules, ou en casse mixte sans le moindre point, virgule
   *  ni parenthèse (« Kim Send Hardware & Building Materials Pre Ltd ») ; celui qui tape ne ponctue pas
   *  et son téléphone corrige ses mots (voir `scorePrepares`). Un export en majuscules n'en est pas un,
   *  ni un nom qui porte une annotation entre parenthèses (« Chin Hong Trading Pte Ltd (振丰贸易) ») */
  chat: boolean;
  /** le nom est écrit dans un abjad (arabe et persan, hébreu) : ses mots n'ont pas de voyelles,
   *  et se comparent aux consonnes de l'autre côté (voir `cleAbjad`) */
  abjad: Abjad;
  /** le nom est lu en cantonais ou en hokkien (la seconde ou la troisième lecture d'un nom en sinogrammes, ou une
   *  lecture syllabique substituée aux mots d'un nom latin) : ses syllabes se replient sur la graphie de
   *  Hong Kong et sur celle de Singapour (`pliCantonais`) */
  cantonais: boolean;
  /** la lecture sous laquelle le nom a été préparé (mandarin, cantonais, hokkien) : ce qu'il faut pour le relire
   *  pareil, coupé (voir `scoreBrut`) ou depuis l'index */
  lecture: Lecture;
  /** la forme est écrite en chinois (有限公司) : elle ne dit pas si la société est privée
   *  (Pte. Ltd., Sdn. Bhd.) ou non, et ne se met pas en conflit là-dessus */
  priveInconnu: boolean;
  /** pour un jeton lu dans des sinogrammes, les caractères lus : deux lectures égales de
   *  caractères différents sont des homophones (« 新海 », « 鑫海 »), pas le même mot */
  natifs: ReadonlyMap<string, string> };

const MARQUEURS_ARABES = new Set(["al", "el", "ul", "bin", "bint", "ibn", "abu", "abou", "abd", "abdul", "abdel", "abdal", "umm",
  "sharikat", "sharika", "shirkat", "muassasat", "moassasat", "muassasa", "tijara", "tijarah", "tijariya", "sherkat", "bazargani",
  "tejarat", "sanati", "lil", "wa", "bani", "dar", "beit", "bayt",
  /* la filiation et les titres du Maghreb et du Sahel (« Ould », « Sidi », « Moulay », « Hadj », « Cheikh »), sous la graphie
     française et l'anglaise (tour 10, jeu 14 : « Mohamed Lamine Ould Brahim Transit » sans aucun marqueur) */
  "ould", "wuld", "wld", "sidi", "moulay", "hadj", "hajj", "haj", "sheikh", "shaikh", "cheikh",
  /* les prénoms arabes les plus portés, sous les graphies française (Maghreb, Levant), anglaise (Golfe) et malaise : le nom
     d'un négociant marocain ou libanais n'a souvent ni article ni forme (« Youssef Chaouki Négoce », « Hosseini Kashani »), et
     le prénom est la seule trace de la langue. Une table du monde : les dix prénoms, pas ceux du jeu. Ni Omar, ni Ali, ni Said
     (Amérique latine, Italie, l'anglais « said ») */
  "mohamed", "mohammed", "mohammad", "muhammad", "muhammed", "mohamad", "muhamad", "mhamed", "ahmed", "ahmad",
  "youssef", "yousef", "yousuf", "yusuf", "yusef", "youcef", "yossef", "yusof", "ibrahim", "brahim", "ebrahim",
  "hussein", "hussain", "husain", "hossein", "hocine", "hassan", "hasan", "abdallah", "abdullah", "abdellah",
  "mahmoud", "mahmud", "mahmood", "mustafa", "mostafa", "moustapha", "mostefa", "fatima", "fatma", "khalid", "khaled",
  /* les noms du Pakistan et de la côte swahilie, que l'ourdou et le kutchi romanisent à leur façon : le serviteur (غلام : « Ghulam »,
     « Gulam »), le don (بخش : « Bakhsh », « Bux », voir GRAPHIES_INDIENNES), le capitaine de boutre (ناخدا : « Nakhoda », « Nakhuda »),
     la tribu de Quraych (« Qureshi », « Quraishi », « Kureishi ») : un boutre ou une tannerie de Karachi n'a souvent ni article ni
     forme, et ces mots sont la seule trace de la langue (jeu 15, tour 11 : « MV Nakhoda Salim » face à « M.V. Nakhuda Saleem » à
     0,716, o et u, ee et i refusés sans marque). Une table du monde : les mots, pas ceux du jeu */
  "ghulam", "gulam", "bakhsh", "baksh", "bux", "buksh", "nakhoda", "nakhuda", "qureshi", "quraishi", "kureishi", "quraish", "quresh"]);
/** Le persan sans article : ses mots d'affaires et ses lieux. */
const MARQUEURS_PERSANS = new Set(["sanat", "sanaat", "sanati", "sanaye", "sanayeh", "tolid", "tolidi", "farayand", "sahami", "khas",
  "amm", "tejarat", "tejarati", "bazargani", "pishro", "sherkat", "sherkate", "iran", "irani", "tehran", "tabriz", "isfahan", "esfahan",
  "shiraz", "mashhad", "karaj", "bandar", "abbas", "qeshm", "kish", "khazar", "pars", "parsian", "parsi", "novin", "omran", "toseh",
  "tosee", "naft", "fulad", "foolad", "madan", "khorshid", "khurshid", "sepid", "sefid", "mehr", "sepehr", "aria", "arya", "lavazem",
  /* les autres villes et provinces d'Iran, et la nisba en -i qu'un nom de famille en tire (« Kashani », « Yazdi », « Tabrizi ») :
     tour 10, jeu 14, « Hosseini Kashani Trading Co. » sans autre trace du persan */
  "kashan", "kashani", "qom", "qomi", "yazd", "yazdi", "kerman", "kermani", "kermanshah", "ahvaz", "ahwaz", "rasht", "rashti",
  "zanjan", "hamedan", "hamadan", "hamedani", "ardabil", "qazvin", "qazvini", "semnan", "urmia", "bushehr", "chabahar", "anzali",
  "gilan", "gilani", "mazandaran", "khorasan", "khorasani", "khuzestan", "hormozgan", "tabrizi", "shirazi", "tehrani", "isfahani",
  "esfahani", "mashhadi"]);
const MARQUEURS_COREENS = new Set(["tongsang", "sanop", "sanup", "muyeok", "muyok", "jeongmil", "jungmil", "jeonja", "junja", "hwahak",
  "junggongeop", "chunggongop", "chunggongeop",
  "mulryu", "haeun", "gaebal", "hanguk", "hankook", "hankuk", "korea", "korean", "daehan", "seoul", "busan", "pusan", "incheon", "inchon",
  "daegu", "taegu", "ulsan", "gwangju", "kwangju", "daejeon", "taejon", "gyeonggi", "kyonggi", "kyunggi", "chungcheong", "jeolla",
  "gyeongsang", "kyongsang", "kyung", "gyeong", "kyoung", "hwaseong", "hwasung", "cheonan", "chonan", "pyeongtaek", "pyongtaek"]);
/** L'écriture thaïe, par sa propriété Unicode. */
const THAI = /\p{Script=Thai}/u;
/** Les mots qui marquent un nom thaï romanisé (voir `Marques.thai`) : le pays, ses provinces et ses ports (Bangkok, Samut Prakan,
 *  Laem Chabang, Rayong, Chonburi, Map Ta Phut), la forme (borisat, chamkat, mahachon : บริษัท จำกัด มหาชน), les mots du commerce
 *  (phanit, karnkha, utsahakam), les mots d'enseigne (Siam, Charoen, Ruam, Sahakit). Une table du monde, pas du jeu. */
const MARQUEURS_THAIS = new Set(["thai", "thailand", "siam", "siamese", "bangkok", "krung", "krungthep", "samut", "prakan", "sakhon", "songkhram",
  "nakhon", "pathom", "ratchasima", "sawan", "pathum", "thani", "nonthaburi", "rayong", "chonburi", "chachoengsao", "laem", "chabang",
  "songkhla", "hatyai", "phuket", "pattaya", "ayutthaya", "chiangmai", "chiangrai", "chiang", "lampang", "khon", "kaen", "udon", "ubon",
  "ratchathani", "saraburi", "lopburi", "kanchanaburi", "ratchaburi", "phetchaburi", "prachuap", "khiri", "chumphon", "ranong", "krabi",
  "satun", "phatthalung", "narathiwat", "yala", "pattani", "maptaphut", "sriracha", "siracha", "borisat", "chamkat", "jamkat", "mahachon",
  "phanit", "panich", "panit", "karnkha", "kanka", "utsahakam", "utsahakit", "charoen", "jaroen", "ruam", "sahakit", "sahakij", "sahaphat"]);
/** L'écriture tamoule (U+0B80 à U+0BFF). */
const TAMOUL = /[\u0b80-\u0bff]/u;
const MARQUEURS_INDIENS = new Set(["pvt", "india", "indian", "bharat", "bharati", "hindustan", "udyog", "vyapar", "mumbai", "bombay",
  "delhi", "chennai", "madras", "kolkata", "calcutta", "bangalore", "bengaluru", "hyderabad", "pune", "ahmedabad", "surat", "jaipur",
  "gujarat", "maharashtra", "tamil", "nadu", "kerala", "punjab", "rajasthan", "karnataka", "andhra", "telangana", "bengal", "noida",
  "gurgaon", "gurugram", "ludhiana", "kanpur", "coimbatore", "tirupur", "jodhpur", "agra", "kathiawar", "shree", "shri", "sri",
  "lal", "bhai", "kumar", "singh", "sahib", "chand", "das", "prasad", "devi", "ram", "krishna", "ganesh", "lakshmi", "laxmi",
  "agro", "agrotech", "kesari", "masala", "basmati", "handloom", "handicrafts", "jute", "sarees", "saree"]);
const MARQUEURS_HISPANIQUES = new Set(["distribuidora", "comercial", "comercializadora", "industrias", "industria", "hermanos", "hijos",
  "compania", "companhia", "sociedad", "sociedade", "exportadora", "importadora", "agropecuaria", "agricola", "del", "los", "las",
  "grupo", "corporacion", "fabrica", "productos", "servicios", "transportes", "construcciones", "alimentos", "minera", "pesquera",
  "textil", "textiles", "quimica", "metalicas", "mexico", "espana", "brasil", "peru", "colombia", "chile", "argentina", "venezuela",
  /* les enseignes et les métiers (jeu 11 : « Ferretería El Faro » n'avait que la marque arabe de son « El ») */
  "ferreteria", "marisqueria", "panaderia", "carniceria", "pescaderia", "libreria", "papeleria", "zapateria", "cerrajeria",
  "lavanderia", "farmacia", "abarrotes", "talleres", "taller", "servicos", "transportadora", "constructora", "inmobiliaria",
  "agroindustrias", "seguros", "maritima", "maritimos", "naviera", "remolcador", "barcaza", "pesquero", "lancha", "buque",
  "motonave", "panama", "panameno", "panamena", "mexicana", "mexicano", "brasileira", "brasileiro"]);
const MARQUEURS_HEBREUX = new Set(["yam", "kfar", "kokhav", "kochav", "yarden", "shachar", "shahar", "galil", "hagalil", "kibbutz",
  "moshav", "negev", "haifa", "aviv", "ashdod", "eilat", "israel", "israeli", "beit", "bet", "tzafrir", "zafrir", "sde", "sdeh"]);
const MARQUEURS_GRECS = new Set(["kai", "sia", "naftiliaki", "naftiki", "emporiki", "viomichaniki", "techniki", "kataskevastiki", "ellas",
  "hellas", "elliniki", "hellenic", "piraeus", "pireas", "athens", "athina", "thessaloniki", "patras", "afoi", "aphoi", "adelfoi", "kapetan"]);
const SUFFIXES_GRECS = /(akis|opoulos|poulos|ides|idis|iadis|iotis|iki|ikos|ellis)$/;
const MARQUEURS_JAPONAIS = new Set(["kk", "gk", "yk", "kabushiki", "kaisha", "gaisha", "kabushikigaisha", "godo", "yugen", "kogyo", "kougyou", "shoji",
  "shouji", "sangyo", "sangyou", "seisakusho", "boeki", "boueki", "denki", "kagaku", "seiko", "jidosha", "unyu", "kaiun", "kaihatsu",
  "tsusho", "maru",
  /* les mots de métier des raisons sociales japonaises, romanisés : suisan (pêche et produits de la
     mer), gyogyo (pêcherie), bussan (produits, négoce), shokai et shoten (maison de commerce),
     kensetsu (construction), kikai (machines), kinzoku (métaux), seizo (fabrication), zosen
     (chantier naval), senpaku (navires), sekiyu (pétrole), shokuhin (alimentaire), seiyaku et
     yakuhin (pharmacie), tsushin (télécommunications), tetsudo (chemin de fer), kumiai
     (coopérative), kyokai (association), kogaku (optique). Sans marque, le pli des deux
     romanisations (`pliJaponais`) ne s'applique pas : « Shimotsuki Suisan » et « Simotuki Suisan »
     restaient au possible (mesuré le 27/09 sur le jeu 8 : 0,800) */
  "suisan", "gyogyo", "bussan", "shokai", "shoten", "kensetsu", "kikai", "kinzoku", "seizo", "zosen", "senpaku", "sekiyu",
  "shokuhin", "seiyaku", "yakuhin", "tsushin", "tetsudo", "kumiai", "kyokai", "kogaku",
  /* les métiers traduits au tour 7 (jeu 11) : manutention portuaire, entrepôt, électronique, sidérurgie, bâtiment */
  "koun", "soko", "denshi", "tekko", "tekkosho", "komuten"]);
/** Les numéraux ordinaux japonais des navires, 第一 à 第十, sous leur clé `pliJaponais` (daiichi et daiiti, daishichi et
 *  daisiti, daikyu et daikyuu s'y rejoignent) : le chiffre que « No. N » écrit. */
const NUMERAUX_DAI: ReadonlyMap<string, string> = new Map(Object.entries({
  daiichi: "1", daini: "2", daisan: "3", daiyon: "4", daishi: "4", daigo: "5", dairoku: "6", dainana: "7", daishichi: "7",
  daihachi: "8", daikyu: "9", daiju: "10",
}).map(([k, v]) => [pliJaponais(k), v]));
/** Les mots translittérés du russe et de l'ukrainien qui marquent un nom slave (voir `Marques.slave`) : les mots du
 *  commerce (torgovyy, zavod, kompaniya, morskoy, rechnoy, flot, sklad, stroy), les mots des formes écrites en toutes
 *  lettres (obshchestvo, tovarystvo), les grades qu'un navire porte en tête (kapitan, shkiper, matros, botsman).
 *  PAS les mots que l'anglais écrit pareil (terminal, port, elevator, agro, dom) : ils marqueraient la moitié
 *  des listes, et le pli des romanisations s'ouvrirait sur des noms anglais. */
const MARQUEURS_SLAVES = new Set(["torgovyy", "torgovyi", "torgovy", "torgovyj", "torgovaya", "torgovaia", "torgovaja", "torgovlya",
  "zavod", "zavoda", "kompaniya", "kompaniia", "kompanija", "kompania", "morskoy", "morskoi", "morskoj", "morskaya", "morskaia",
  "morskaja", "morska", "morske", "rechnoy", "rechnoi", "rechnoj", "recnoj", "recnoi", "richkovyi", "richkovyy", "richkova",
  "flot", "flota", "sklad", "stroy", "stroi", "stroj", "sudokhodnaya", "sudokhodstvo", "promyshlennost", "promyshlennaya",
  "kombinat", "fabrika", "gruppa", "predpriyatie", "obedinenie", "pidpryiemstvo", "obshchestvo", "tovarishchestvo", "tovarystvo",
  "aktsionernoe", "aktsionerne", "publichnoe", "publichne", "pryvatne", "zakrytoe", "otkrytoe", "nauchno", "proizvodstvennoe",
  "proizvodstvenno", "kapitan", "shkiper", "matros", "botsman", "bocman", "teplokhod", "teplohod"]);
/** Les formes de la CEI et d'Ukraine, telles que le nom les écrit (voir FORMES) : elles marquent un nom slave. */
const FORMES_SLAVES = new Set(["ooo", "oao", "zao", "pao", "ao", "too", "tov", "prat", "pat", "npp", "npo", "npk", "npf", "pkf", "fop", "chp", "flp", "spd"]);
/** Les suffixes des noms propres slaves (Petrov, Belyaev, Tkachyov, Petrova ; Brodsky, Salskiy, Kubanskaya, Donskaja,
 *  Rostovskoye ; Shevchenko, Kovalchuk, Semenyuk ; Ivanovich, Petrović) : sur un mot d'au moins six lettres que le
 *  dictionnaire ignore (« whisky », « husky », « Geneva », « nova » sont des mots anglais). Et les queues des composés
 *  soviétiques (Khimtekhnika, Agroprom, Uralmash, Rosneft, Elevatorstroy : voir QUEUES_SLAVES), sous leur graphie allemande
 *  aussi (« Chimtechnika », jeu 13 : un mot seul, sans forme, que rien ne marquait). */
const SUFFIXES_SLAVES = /(?:[oe]v|[oe]va|iov|yov|sk(?:iy|ii|ij|y|yi|yy|aya|aja|aia|a|oye|oe|oy|oi|oj)|enko|chuk|[yi]uk|[oe]v[iy]ch|vic|tekhnika|technika|khim|chim|prom|snab|sbyt|mash|energo|montazh|remont|komplekt|avto|neft|stro[yij])$/;
function suffixeSlave(j: string): boolean {
  return j.length >= 6 && SUFFIXES_SLAVES.test(j) && lemme(j) === undefined;
}
/** Le T/H et le T/KH du teplokhod (теплоход, le navire à moteur) devant un nom de navire, écrits avec leur barre :
 *  le M/V des documents russes (jeu 12, 28/09 : « T/H NIZHNEDONSK-1408 » face à « NIZHNEDONSK 1408 » à 0,775, « th »
 *  mot rare sans répondant ; « T/KH AZOVSKIY RUBEZH 7 » à 0,800). */
const TEPLOKHOD = /(?<![\p{L}])t\/(?:kh|h)(?![\p{L}])/iu;
/** Les mots du commerce et les grades des navires russes et ukrainiens, sous une clé par mot : leurs graphies se
 *  rejoignent par `pliSlave` (morskoy, morskoi, morskoj ; rechnoy, rečnoj), et la table ne se lit que sous la
 *  marque slave (voir `traduction`). « Kompaniia » et « Kompanija » sont le « Kompaniya » que LOCUTIONS ôte déjà.
 *  Les grades : « Kapitan Semenyuk » et « Capt. Semenyuk » sont un navire (jeu 12, 28/09 : 0,494). */
const TRADUCTIONS_SLAVES: ReadonlyMap<string, string> = new Map(Object.entries({
  morskoy: "marine", morskaya: "marine", rechnoy: "river", rechnaya: "river", richkovyi: "river", richkova: "river",
  kompaniya: "", flot: "fleet", sklad: "warehouse", stroy: "construction", torgovyy: "trading", torgovaya: "trading",
  kapitan: "captain", shkiper: "skipper", matros: "seaman", botsman: "boatswain", bosun: "boatswain",
  /* les génériques russes que LOCUTIONS traduit déjà sous leur graphie standard : ici pour leurs clés allemandes (« Sawod »,
     « Fabrika », « Kombinat » : voir `clesSlaves` dans `traduction`), jeu 13, 28/09 */
  zavod: "plant", kombinat: "works", fabrika: "factory", promyshlennost: "industry", promyshlennaya: "industrial", stal: "steel",
  neft: "oil", khimiya: "chemical", khimicheskiy: "chemical", metallurgicheskiy: "metallurgical", stroitelstvo: "construction",
  sudokhodstvo: "shipping", gruppa: "group", torgovlya: "trade", firma: "",
}));
let TRADUCTIONS_SLAVES_PLIEES: ReadonlyMap<string, string> | undefined;
function traductionsSlavesPliees(): ReadonlyMap<string, string> {
  if (!TRADUCTIONS_SLAVES_PLIEES) {
    /* les entrées de TRADUCTIONS qu'une autre romanisation écrit autrement (« khimicheskiy », « khimicheskii », « himiceskij » :
       chemical), pliées aussi, sans écraser celles de TRADUCTIONS_SLAVES (jeu 13, 28/09 : « AO Zarianskii Khimicheskii
       Kombinat » à 0,582 face à « Khimicheskiy », un côté traduit et l'autre non) */
    const m = new Map<string, string>();
    for (const [k, v] of TRADUCTIONS) { const p = pliSlave(k); if (p !== k && !m.has(p)) m.set(p, v); }
    for (const [k, v] of TRADUCTIONS_SLAVES) m.set(pliSlave(k), v);
    TRADUCTIONS_SLAVES_PLIEES = m;
  }
  return TRADUCTIONS_SLAVES_PLIEES;
}
const MARQUEURS_CHINOIS = new Set(["youxian", "gongsi", "gufen", "zeren", "maoyi", "jinchukou", "keji", "dianzi", "gongye", "shiye",
  "zhizao", "jituan", "guoji", "wuliu", "huoyun", "hangyun", "jixie", "huagong", "fangzhi", "fuzhuang", "shipin", "jinshu",
  "gangtie", "suliao", "jianzhu", "nengyuan", "fazhan", "touzi", "kongzhi", "konggu", "shangmao", "jingmao", "luntai"]);

/**
 * Un nom de société ou de navire, prêt pour la comparaison. Les lettres isolées successives
 * sont d'abord rejointes (« F.Z.E. » → « fze », « M/V » → « mv », « A.K. » → « ak ») pour
 * que la ponctuation ne décide de rien. Jamais vide : un nom fait tout entier de formes
 * juridiques (« Company Limited ») se rend normalisé plutôt que de disparaître.
 */
export function preparerEntite(nom: string, lecture: Lecture = "mandarin"): string {
  return analyserEntite(nom, lecture).texte;
}

/** La préparation, avec ce qu'elle a retiré (les pays des formes juridiques, un préfixe de
 *  navire, une forme de société) et les mots que leur auteur a ABRÉGÉS d'un point. */
const REGISTRE = /\(\s*(?:rc|reg\.?(?:\s*no\.?)?|registration\s*(?:no\.?)?|hrb|hra|kvk|cipc|cac|eori|company\s*no\.?|co\.?\s*reg\.?\s*no\.?|crn|tin|vat|nif|nit|cnpj|cuit|rfc|siret|siren|folio)\s*:?\s*([a-z0-9][a-z0-9\/\-. ]*?)(?:,\s*amtsgericht\s+[\p{L} .-]+)?\s*\)/iu;
export function analyserEntite(nom: string, lecture: Lecture = "mandarin"): { texte: string; abreges: ReadonlySet<string>; parentheses: ReadonlySet<string>; civilites: ReadonlySet<string>; traduits: ReadonlySet<string>;
  /** les SIGLES écrits comme tels, des lettres séparées d'un point, d'une barre ou d'une esperluette (« C&F », « T/C », « C.I. »),
   *  soudés en un mot : les initiales d'une locution que l'autre nom écrit en toutes lettres (voir `scorePrepares`) */
  sigles: ReadonlySet<string>;
  /** pour chaque mot traduit, le mot romanisé qu'il traduit (« trading » : « boeki ») : deux mots de métier japonais
   *  différents traduits au même mot anglais sont deux raisons sociales (voir `scorePrepares`) */
  sources: ReadonlyMap<string, string> } & Marques {
  /* la casse d'un document en capitales se lit avant tout : après, elle est perdue (voir `capitalesLuesOptiquement`) */
  nom = capitalesLuesOptiquement(nom);
  /* L'apostrophe DANS un mot le soude (« O'Brien », « Ch'iao ») : en faire une frontière
     de mot fabriquerait des jetons d'une ou deux lettres qui ne désignent rien. « F.lli »
     (fratelli) et « LPG/C » (LPG carrier) ont une ponctuation qui porte le sens : lus avant. */
  /* et le Wade-Giles, que son apostrophe d'aspiration signe, se récrit en pinyin AVANT que cette apostrophe et le tiret
     ne partent (« Chen-ch'iao » : Zhenqiao, jeu 13 ; voir wadegiles.ts) */
  const rom = romaniser(wadeGiles(nom), lecture);
  /* le T/H ou T/KH du teplokhod devant un navire russe (voir TEPLOKHOD) : le M/V des documents russes, rendu tel quel
     avant la soudure des sigles (« T/H » y deviendrait « th », un mot ; « T/KH » deux mots), et une marque slave */
  const teplokhod = TEPLOKHOD.test(rom.texte);
  const sigles = new Set<string>();
  let soude = plierLatin(teplokhod ? rom.texte.replace(new RegExp(TEPLOKHOD.source, "giu"), "MV") : rom.texte)
    /* un « ? » dans une forme juridique ou à sa fin (« LT? », « L?D », « Ltd? ») : la lettre perdue
       ou le point mal lu d'une forme, complétée AVANT que le « ? » final ne parte en ponctuation
       (mesuré le 27/09 sur le jeu 9 : « (PVT) LT? » laissait un mot « lt » orphelin, 0,800) */
    .replace(/(?<![\p{L}?])(\p{L}*)\?(\p{L}*)(?![\p{L}?])/gu, (m, avant: string, apres: string) => formeAbimee(avant, apres) ?? m)
    /* la lettre qu'un encodage a PERDUE : un « ? » dans un mot ou en tête (« SE?ORA » pour
       Señora, « ?ugowski » pour Ługowski) devient la lettre-jalon PERDU, que la normalisation
       laisse passer ; le score la lit comme UNE lettre inconnue (`lettrePerdue`). Une suite de
       « ? » vaut autant de lettres (« T?n ??c » pour Tân Đức : Đ et ứ perdus, un jalon chacun ;
       mesuré le 27/09 sur le jeu 9, la suite partait en ponctuation et « ??c » devenait « c »).
       Jamais un « ? » seul ni en fin de mot : là c'est une ponctuation, elle part avec les autres */
    .replace(/\?(?=\?*\p{L})/gu, PERDU)
    .replace(/int'l/gi, "international").replace(/\bF\.lli\b/gi, "Fratelli")
    /* UNE FORME SOUDÉE AU NOM par un clavardage (« HoornbeekTransportBV », jeu 14) : la forme en capitales, ou dans sa
       casse propre (GmbH, Ltd, Inc), collée derrière une minuscule et suivie de rien, se détache pour être lue comme
       forme ; « HoornbeekTransport » reste soudé, le bloc le lit. Sans cela, la BV n'était pas lue et la paire montait
       à 0,900 face à « Hoornbeek Transport N.V. », deux immatriculations (tour 10). Un nom tout en capitales n'a pas de
       minuscule devant sa forme : il n'est pas touché */
    .replace(/(\p{Ll})(BV|NV|GmbH|AG|LLC|LLP|Ltd|LTD|Inc|INC|PLC|Oy|AB|AS|SA|SAS|SARL|KG|SL|SRL|Srl|SpA|Bhd|Pty|Pte|Pvt)(?![\p{L}\d])/gu, "$1 $2")
    /* « M/s. » et « Messrs. », la civilité indienne et britannique d'une maison de commerce */
    .replace(/^\s*(?:M\/s\.?|Messrs\.?)\s+/i, "")
    /* « Mt. » et « Ft. » avec leur point sont Mount et Fort ; sans point, « MT » est un pétrolier */
    .replace(/^Mt\.\s+/i, "Mount ").replace(/\bFt\.\s+/gi, "Fort ")
    /* « S.à r.l. », « S.à.r.l. » : la forme luxembourgeoise et française, avec son accent et
       son espace, que le sigle général ne reconnaît pas */
    .replace(/\bS\.?\s?[àa]\.?\s?r\.?\s?l\.?(?!\p{L})/giu, "SARL")
    /* « (P) Ltd. » et « (Pvt.) Ltd. », la société privée indienne : une forme, pas une filiale */
    .replace(/\(\s*P(?:vt)?\.?\s*\)\s*(?=Ltd|Limited)/gi, "Pvt ")
    .replace(/\b(LPG|LNG)\s*\/\s*C\b/gi, "$1C")
    /* les préfixes de navire hispanophones et lusophones, avec leur barre (jeu 11) : B/M (buque a motor) et N/M (navio a
       motor) sont le M/V des registres anglophones ; R/M (remolcador) est un remorqueur. La barre est exigée pour ceux-là :
       sans elle, « BM » et « RM » en tête sont les initiales d'un fondateur, pas un navire. M/N (motonave) s'écrit aussi
       sans barre dans les registres panaméens (« MN RÍO CHAGRES ») : il est dans PREFIXES_NAVIRE comme MV (mesuré le
       27/09 : « M/N ESTRELLA DEL CARIBE » à 0,800 face à « MV Estrella del Caribe », « mn » mot rare sans répondant) */
    .replace(/(?<![\p{L}\d])(?:B\/M|N\/M)(?![\p{L}])/giu, "MV").replace(/(?<![\p{L}\d])R\/M(?![\p{L}])/giu, "TUG")
    /* « Patel Hardware (K) Ltd », « Msasani Fisheries (T) Ltd », « Nakasero Pharma (U) Ltd » : la lettre du pays dans les registres
       d'Afrique de l'Est, devant la forme (jeu 15) ; écrite en toutes lettres, elle rejoint « Kenya Ltd » et « Kenya Limited » */
    .replace(/\(\s*K\s*\)(?=\s*(?:ltd|limited)\b)/giu, "(Kenya)").replace(/\(\s*T\s*\)(?=\s*(?:ltd|limited)\b)/giu, "(Tanzania)")
    .replace(/\(\s*U\s*\)(?=\s*(?:ltd|limited)\b)/giu, "(Uganda)").replace(/\(\s*Z\s*\)(?=\s*(?:ltd|limited)\b)/giu, "(Zambia)")
    .replace(/\(\s*EA\s*\)(?=\s*(?:ltd|limited)\b)/giu, "(East Africa)")
    /* la coque en construction, « N/B » (newbuilding) devant son numéro de chantier (« N/B S1187 » face à « NEWBUILDING HULL
       NO. S-1187 », jeu 4 : 0,278, « nb » et « hull » mots rares sans répondant) : la barre est exigée, comme pour B/M ;
       sans elle, « NB » en tête est une initiale */
    .replace(/(?<![\p{L}\d])N\/B(?![\p{L}])/giu, "NEWBUILDING");
  /* les chiffres de l'arabizi (« Mo7ammed », « Al 3'ubaiba », « 5alfan ») lus en lettres AVANT la normalisation, qui
     couperait l'apostrophe de 3', et avant `ocr`, qui lirait le 5 comme un s (voir arabizi.ts) ; le 5 et le 8, que la lecture
     optique lit aussi, exigent un marqueur arabe parmi les mots et un nom hors des capitales */
  const arabizi = /\d/.test(soude) ? lireArabizi(soude, jetons(normaliser(soude)).some((j) => MARQUEURS_ARABES.has(j))) : { texte: soude, lu: false };
  soude = arabizi.texte
    /* l'élision française et italienne (« d'Import-Export », « l'Industrie », « Côte d'Ivoire ») : la préposition ou
       l'article tombe et le mot reste entier (jeu 10, 27/09 : « dimport » face à « import », 0,728). La minuscule d
       seulement : « D'Angelo », « D'Souza » sont des noms, soudés comme « O'Brien » */
    .replace(/(?<!\p{L})(?:d|l|L)['’ʼ`](?=\p{L})/gu, "")
    .replace(/(\p{L})['’ʼ`](\p{L})/gu, "$1$2")
    /* Les lettres séparées par un point ou une barre forment UN sigle (« S.A. », « F.Z.E. »,
       « M/V », « A.K. ») : on les soude ici, sur le texte, parce qu'après la normalisation une
       espace et un point se confondent, et « Holdings I S.A. » devenait « Holdings ISA » (le
       numéro I fondu dans la forme, mesuré le 27/09 contre « Holdings III S.A. »). */
    /* et par une esperluette, avec ou sans espaces (« C&F », « P & I », « L&T ») : l'esperluette seule devenait une espace,
       et « C&F » deux lettres isolées que la forme épelée resoudait sans savoir que c'était un sigle. Le sigle soudé est
       RETENU (`sigles`) : ce sont les initiales d'une locution que l'autre nom peut écrire en toutes lettres (« Clearing
       and Forwarding », « Time Charter », « Comercializadora Internacional » ; jeux 5 et 10, tour 9) */
    .replace(/(?<!\p{L})\p{L}(?:[./]\s?\p{L}(?!\p{L})|\s?&\s?\p{L}(?!\p{L}))+\.?/gu, (m) => {
      const s = m.replace(/[./&\s]/g, "");
      if (s.length >= 2 && s.length <= 4) sigles.add(normaliser(s));
      return s;
    });
  /* Un mot suivi d'un point est une ABRÉVIATION écrite comme telle (« Petrochem. », « Dist. »,
     « Capt. ») : le mot entier qu'il commence lui correspond (voir `scorePrepares`). */
  const abreges = new Set([...soude.matchAll(/(\p{L}{2,})\./gu)].map((m) => normaliser(m[1]!)));
  /* le nom est japonais par ses kana, sa forme ou l'un de ses mots (la marque `japonais`, lue ici avant les tables :
     ses mots de métier se traduisent aussi sous le pli des deux romanisations, voir `traduction`) */
  const japonaisPresume = estJaponais(nom) || jetons(normaliser(plier(soude))).some((j) => MARQUEURS_JAPONAIS.has(j));
  const neerlandais = jetons(normaliser(soude)).some((j) => MARQUEURS_NEERLANDAIS.has(j)) || ["hand", "scheepv", "exped", "handelsond"].some((j) => abreges.has(j));
  const pakistanais = jetons(normaliser(soude)).some((j) => MARQUEURS_PAKISTANAIS.has(j));
  /* le nom est slave par son écriture, sa forme, un mot du commerce translittéré, un grade, le teplokhod ou un suffixe
     de nom propre (voir `Marques.slave`) : lue ici, avant les tables, parce que ses mots du commerce se traduisent sous
     le pli des romanisations du cyrillique et que « AT » en tête y est une forme */
  const slave = /[Ѐ-ӿ]/.test(nom) || teplokhod
    || jetons(normaliser(plier(soude))).some((j) => MARQUEURS_SLAVES.has(j) || FORMES_SLAVES.has(j) || suffixeSlave(j));
  /* LE TYPE DU NAVIRE ENTRE PARENTHÈSES en fin de nom (« PRIDONYE-41 (barge) », « (tug) », « (tanker) ») : ce que le
     préfixe dit devant (« barge PRIDONYE 41 »), et non une filiale (jeu 12, 28/09 : 0,667, la parenthèse sans répondant
     et « barge » mot rare orphelin) */
  let typeNavire = "", navireEcrit = false;
  const typeEntreParentheses = /\s*\(\s*(\p{L}+)\s*\)\s*$/u.exec(soude);
  if (typeEntreParentheses !== null && PREFIXES_NAVIRE.has(normaliser(typeEntreParentheses[1]!)) && typeEntreParentheses.index > 0) {
    navireEcrit = true;
    typeNavire = TYPES_NAVIRE.get(normaliser(typeEntreParentheses[1]!)) ?? "";
    soude = soude.slice(0, typeEntreParentheses.index);
  }
  /* Les mots ENTRE PARENTHÈSES : « Quarnby Logistics (Shanghai) », « Tervalo Shipping (Hong
     Kong) ». Dans un nom de société, la parenthèse désigne le plus souvent une entité du
     groupe, distincte ; si l'autre nom n'a rien qui y réponde, on ne parle pas de la même
     (voir `scorePrepares`). Les mêmes tables que le nom entier, pour retrouver ces mots
     tels que la préparation les laisse. */
  const parentheses = new Set([...soude.matchAll(/\(([^()]+)\)/g)]
    .flatMap((m) => {
      let dedans = ` ${jetons(normaliser(plier(m[1]!))).join(" ")} `;
      for (const [de, vers] of LOCUTIONS) dedans = dedans.split(de).join(vers);
      return dedans.trim().split(/ +/).flatMap((j) => (CIVILITES.has(j) ? "" : ABREVIATIONS.get(j) ?? traduction(j, japonaisPresume, slave) ?? j).split(" "));
    })
    .filter((j) => j !== "" && !FORMES.has(j)));
  /* Lettres et chiffres collés se séparent : « No18 » → « No 18 », « LANQIAOFENG16 » →
     « LANQIAOFENG 16 » ; le numéro d'un navire devient un jeton que la règle des numéros lit. */
  /* une forme ÉPELÉE avec des espaces (« S A S », « S de R L », « S A de C V », jeu 11) : les lettres seules qui se
     suivent se soudent, comme le font déjà les points (« S.A.S. ») ; « J P Morgan » devient « JP Morgan », rien de plus */
  const brut = jetons(jetons(normaliser(soude).replace(/\b\p{L}(?: \p{L})+\b/gu, (m) => m.replace(/ /g, ""))).map(ocr).join(" ")
    .replace(/(\p{L})(\d)/gu, "$1 $2").replace(/(\d)(\p{L})/gu, "$1 $2")).map(digrammeOptique).map(motDuMetierPerdu);
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
  /* sous la marque vietnamienne (l'écriture ou la forme), les génériques qui sont aussi des mots d'ailleurs : « May » est
     la confection, « Dệt » le tissage (voir vietnamien.ts) */
  if (estVietnamien(nom, texte)) for (const [de, vers] of LOCUTIONS_VIETNAMIENNES) texte = texte.split(de).join(vers);
  let navire = false;
  for (const p of PHRASES_NAVIRE) {
    if (texte.startsWith(p) && texte.length > p.length) { navire = true; texte = " " + texte.slice(p.length); }
  }
  const pays = new Set<string>();
  const familles = new Set<string>();
  const designations = new Set<string>();
  let societe = false;
  let privePhrase = false;
  let priveInconnu = false;
  const ecritEnSinogrammes = /[\u4e00-\u9fff]/u.test(nom) && !estJaponais(nom);
  /* « Co., Ltd. », les deux mots ensemble, est la forme des sociétés d'Asie de l'Est et du
     Sud-Est (有限公司, 株式会社, 주식회사, TNHH) : une « Sdn. Bhd. » ou une « GmbH » du même nom
     est une autre société (mesuré le 27/09 sur le jeu 5) */
  if (/ co (ltd|limited) /.test(texte)) for (const k of ["CN", "HK", "TW", "MO", "JP", "KR", "TH", "VN", "ID", "MM", "KH"]) pays.add(k);
  for (const p of PHRASES) {
    if (!texte.includes(p)) continue;
    societe = true;
    if (PHRASES_PRIVEES.has(p.trim())) privePhrase = true;
    for (const k of PAYS_DES_FORMES.get(p.trim()) ?? []) pays.add(k);
    for (const k of FAMILLES_DES_FORMES.get(p.trim()) ?? []) familles.add(k);
    /* la forme en toutes lettres porte la désignation de son sigle (« Free Zone Establishment » : fze, tour 10) */
    const designation = DESIGNATIONS.get(p.trim());
    if (designation !== undefined) designations.add(designation);
    /* 有限公司 ÉCRIT EN CARACTÈRES est la forme de toute société à responsabilité limitée de langue
       chinoise : de Chine, de Hong Kong, de Taïwan, de Macao, mais aussi de Singapour (Pte. Ltd.)
       et de Malaisie (Sdn. Bhd.), et elle ne dit pas si la société est privée. Romanisée
       (« Youxian Gongsi »), elle reste continentale. Jeu 9, 27/09 : « 金成电器(马)有限公司 » face
       à « Kam Sing Electrical (M) Sdn. Bhd. » se mettait en conflit de pays et de statut. */
    if (ecritEnSinogrammes && FORMES_CHINOISES.has(p.trim())) {
      for (const k of PAYS_DU_CHINOIS_ECRIT) pays.add(k);
      priveInconnu = true;
    }
    texte = texte.split(p).join(" ");
  }
  const civilites = new Set<string>();
  /* LE MOT COUPÉ PAR UN SAUT DE LIGNE d'un export en capitales (« DIS TIC ARET », « KIRAL AMA », « TICAR ET », jeu 12) :
     deux jetons voisins dont la soudure est un mot connu (une forme, un mot des tables, un mot anglais) quand l'un des
     deux au moins ne l'est pas ; jamais dans un nom écrit en minuscules, où deux mots sont deux mots */
  const enCapitales = !/\p{Ll}/u.test(nom) && /\p{Lu}/u.test(nom);
  const connu = (w: string) => FORMES.has(w) || TRADUCTIONS.has(w) || ABREVIATIONS.has(w) || lemme(w) !== undefined;
  const coupes = texte.trim().split(/ +/);
  const separes: string[] = [];
  for (let i = 0; i < coupes.length; i++) {
    const a = coupes[i]!, b = coupes[i + 1];
    if (enCapitales && b !== undefined && a.length >= 2 && (b.length >= 2 || (b === "s" && a.length >= 5)) && (!connu(a) || !connu(b)) && connu(a + b)) { separes.push(a + b); i++; }
    else separes.push(a);
  }
  /* les mots que les tables ont TRADUITS (« Comercial », « Exportação », « Handelsmaatschappij ») : des mots
     du métier par construction, qu'un nom d'usage omet sans être une autre société (voir `scorePrepares`) */
  const traduits = new Set<string>();
  const sources = new Map<string, string>();
  const sudAfricain = separes.some((j) => j === "pty" || j === "edms" || j === "eiendoms" || j === "bpk" || j === "beperk" || j === "maatskappy");
  /* le nom est arabe ou persan par son écriture ou l'un de ses mots (l'article, la filiation, un mot d'affaires) : lu ici pour
     l'article collé, avant la marque `arabe` que les mêmes marqueurs posent plus bas */
  /* et l'ÉTABLISSEMENT du Golfe (« Est. » abrégé, « Establishment » : la مؤسسة, la forme des maisons de commerce des Émirats, d'Arabie,
     du Qatar, de Bahreïn, du Koweït et d'Oman) marque le nom arabe comme « Co., Ltd. » marque le nom d'Asie de l'Est (tour 10, jeu 14 :
     « Ebrahim Alhosani Establishment », « Toufic Haddad Est. », sans article ni prénom marqueur). « Est » sans son point reste l'est */
  const etablissementDuGolfe = separes.some((j) => j === "establishment" || j === "establishments" || (j === "est" && abreges.has(j)));
  /* et un nom théophore, collé ou non (« Abdelkarim », « Abdurrahman » : voir `scinderAbd`), est arabe par lui-même */
  const arabePresume = /\p{Script=Arabic}/u.test(nom) || etablissementDuGolfe
    || separes.some((j) => MARQUEURS_ARABES.has(j) || MARQUEURS_PERSANS.has(j) || (scinderAbd(j) !== undefined && !connu(j)));
  /* la forme malaise (Sdn. Bhd.) : la filiation s'y abrège aussi (« B. », « Bt. ») */
  const malaisPresume = separes.some((j) => j === "sdn" || j === "bhd" || j === "berhad");
  const motsBruts = separes.flatMap((j, i) => {
    if (j === "i") return [j];
    if (CIVILITES.has(j)) { civilites.add(j); return []; }
    /* « li » (ل, « pour ») devant un mot du commerce arabe est la préposition, comme « lil » :
       « Li Tijarat Al Aruz » est « Rice Trading » (jeu 9) ; devant tout autre mot c'est un nom (« Li Ning ») */
    if (j === "li" && TRADUCTIONS_ARABES.has(separes[i + 1] ?? "")) return [];
    /* « Bou » (« Bou en Konstruksie ») n'est l'afrikaans « building » que sous une forme sud-africaine :
       ailleurs c'est l'arabe maghrébin « Abu » (« Bou Regreg ») */
    if (j === "bou" && sudAfricain) { traduits.add("building"); return ["building"]; }
    /* les abréviations à point d'un nom néerlandais (jeu 14 : « Int. Exp. Mij. Zuidervliet B.V. », « Hand. Wijnbergen »,
       « Alg. Transp. Mij. », « Scheepv. Mij. ») : « Exp. » y est l'expeditie, pas l'export ; « Hand. » la handelsonderneming */
    if (neerlandais && abreges.has(j) && ABREVIATIONS_NEERLANDAISES.has(j)) {
      const t = ABREVIATIONS_NEERLANDAISES.get(j)!;
      for (const x of t.split(" ")) if (x !== "") { traduits.add(x); if (!sources.has(x)) sources.set(x, j); }
      return t.split(" ");
    }
    /* « Pak » est le Pakistan sous un nom pakistanais (« Pak Hosiery Knitwear (Pvt) Ltd », jeu 15) ; ailleurs c'est le nom
       coréen Pak (« Pak Chŏng-su Trading », perdu à la mesure du 29/09 quand l'abréviation valait partout) */
    if (j === "pak" && pakistanais) { traduits.add("pakistan"); return ["pakistan"]; }
    /* « San. » avec son point est « Sanayi » (jeu 13 : « Bafra Un San. A.Ş. ») ; sans point, « San » reste San Miguel */
    if (j === "san" && abreges.has(j)) { traduits.add("industry"); if (!sources.has("industry")) sources.set("industry", j); return ["industry"]; }
    /* L'ARTICLE COLLÉ d'un nom arabe (« Aldeeb », « Altejaria », « Almarai ») : « al » et le mot, que les tables lisent ensuite
       (jeu 13, 28/09 : « Moassasat Shehab Aldeeb Altejaria » face à « … Al Dheeb Al Tijariya » à 0,205, deux mots sans répondant).
       Quatre lettres au moins derrière l'article, et jamais un mot que le dictionnaire, les formes ou les tables connaissent
       (Alliance, Alpine, Alhandasiya) */
    if (arabePresume && j.length >= 6 && j.startsWith("al") && !connu(j) && !MARQUEURS_ARABES.has(j) && !MARQUEURS_PERSANS.has(j)) {
      const reste = j.slice(2), t = traduction(reste, japonaisPresume, slave);
      if (t === undefined) return ["al", reste];
      for (const m of t.split(" ")) if (m !== "") { traduits.add(m); if (!sources.has(m)) sources.set(m, reste); }
      return ["al", ...t.split(" ").filter((m) => m !== "")];
    }
    /* LE NOM THÉOPHORE (« Abdelkarim », « Abdul Kareem », « Abdurrahman ») : « abd », « al » et le nom, une seule suite sous toutes les
       graphies (voir `scinderAbd`) ; jamais un mot que le dictionnaire connaît (abdomen) */
    const abd = scinderAbd(j);
    if (abd !== undefined && !connu(j)) return abd;
    /* LA FILIATION SOUS UN SEUL MOT : bin, ibn, ben, ould, wuld (ولد), wad sont « bin », bint, binti, ibnat « bint ». Deux graphies
       d'une même particule ne sont pas deux mots orphelins (tour 10, jeu 14 : « Obaid bin Sultan Al Ketbi » face à « Ubaid ibn
       Sultan Al-Kitbi » à 0,779, bin et ibn orphelins de part et d'autre, le nom au dixième) ; le conflit de filiation
       (« Bint » face à « Ibn ») se lit sur le genre, pas sur la graphie (voir FILIATION_M, FILIATION_F) */
    if (FILIATION_M.has(j)) return ["bin"];
    if (FILIATION_F.has(j)) return ["bint"];
    /* LA FILIATION ABRÉGÉE : « Saeed B. Hamad » est Saeed bin Hamad, « Aminah Bt. Yusof » Aminah binti Yusof, dans le Golfe et en
       Malaisie ; une lettre seule ENTRE deux noms, sous un marqueur arabe ou une forme malaise (jeu 14, 29/09 : « Saeed Bin Hamad
       Trading Establishment » face à « Saeed B. Hamad Trading Est. » à 0,762, « b » initiale rare sans répondant) */
    if ((j === "b" || j === "bt" || j === "bte" || j === "bti") && (arabePresume || malaisPresume) && i > 0 && i + 1 < separes.length
      && separes[i - 1]!.length >= 3 && separes[i + 1]!.length >= 3 && !FORMES.has(separes[i - 1]!) && !FORMES.has(separes[i + 1]!)) {
      return [j === "b" ? "bin" : "bint"];
    }
    const a = ABREVIATIONS.get(j);
    /* une abréviation développée se traduit comme le mot entier : « Tic. » est ticaret, donc trading (jeu 13, 28/09 :
       « Tasimaciligi Tic. AS » à 0,704 face à « Ticaret A.Ş. », l'un traduit et l'autre non) */
    if (a !== undefined) return a.split(" ").flatMap((m) => {
      const t = m === "" ? undefined : traduction(m, japonaisPresume, slave);
      if (t === undefined) return [m];
      for (const x of t.split(" ")) if (x !== "") { traduits.add(x); if (!sources.has(x)) sources.set(x, j); }
      return t.split(" ");
    });
    const p = PAYS_ADJECTIFS.get(j);
    if (p !== undefined) return [p];
    const t = traduction(j, japonaisPresume, slave);
    if (t === undefined) return [j];
    for (const m of t.split(" ")) if (m !== "") { traduits.add(m); if (!sources.has(m)) sources.set(m, j); }
    return t.split(" ");
  });
  /* LE QUALIFICATIF PRIVÉ ABÎMÉ : « Pre Ltd » pour Pte Ltd, le correcteur d'un téléphone ayant fait un
     mot du sigle (jeu 9, 27/09 : « Kim Send Hardware & Building Materials Pre Ltd », « pre » mot rare
     orphelin, 0,720). Devant « Ltd » ou « Limited », un mot de trois lettres qui n'est pas une forme et
     ne diffère de pte, pty ou pvt que par UNE lettre substituée est ce qualificatif : rien d'autre de
     trois lettres ne précède Ltd dans l'usage. Le prix, assumé : « Happy Pet Ltd » y perd son « Pet ». */
  const mots = motsBruts.map((j, i) => (motsBruts[i + 1] === "ltd" || motsBruts[i + 1] === "limited") ? qualificatifAbime(j) : j);
  /* « IP Tavrizyan A.G. » : l'entrepreneur individuel russe (ИП), ukrainien (ФОП, ЧП),
     kazakh (ИП) porte un NOM DE PERSONNE et ses initiales ; « A.G. » n'y est pas une
     Aktiengesellschaft. Après ce sigle, les mots courts restent des mots. */
  const entrepreneur = ["ip", "fop", "chp", "flp", "spd"].includes(mots[0] ?? "");
  /* sous un qualificatif de société privée (Pty, Pte, Pvt, Sdn), le registre garde « Co » et « Corp » dans le nom déposé :
     « Trivedi Trading Co Pvt Ltd » n'est pas « Trivedi Trading Corp Pvt Ltd », « Blackwood Cattle Co Pty Ltd » n'est pas
     « … Corp Pty Ltd » (jeux 13 et 14, tour 10 : quatre paires jugées différentes à 1,000 ; aucune paire des quatorze jeux
     ne tient un « Co » pour un « Corp » sous ces qualificatifs). Hors de ces registres, « Co., Ltd. » et « Corporation »
     rendent tous deux un K.K. ou une 有限公司, et « Co » ne porte aucune désignation */
  const priveDesMots = mots.some((j) => QUALIFICATIFS_PRIVES.has(j));
  let t = mots.filter((j, i) => {
    if (j === "") return false;
    /* « PT » (perseroan terbatas) se place en tête, ou en queue après une virgule (« Sinar Kaloka
       Abadi, PT ») ; ailleurs c'est un mot */
    if ((j === "pt" || j === "ud") && i > 0 && i !== mots.length - 1) return true;
    /* « AT » en tête d'un nom slave est l'акціонерне товариство ukrainien, le JSC (jeu 12, 28/09 : « AT Pivdennyi
       Portovyi Zavod » face à « JSC Pivdennyy Portovyy Zavod » à 0,788, « at » mot rare orphelin) ; ailleurs,
       c'est l'anglais « at » ou l'article arabe assimilé (voir ARTICLES_ASSIMILES, lu avant) */
    if (j === "at" && i === 0 && slave && mots.length > 1) { societe = true; pays.add("UA"); familles.add("corp"); return false; }
    /* « OÜ » (osaühing) s'écrit « OU » sans son tréma : une forme en QUEUE seulement ; ailleurs « ou » est un mot (le
       « ou » français, le nom chinois Ou) */
    if (j === "ou" && i !== mots.length - 1) return true;
    if (!FORMES.has(j)) return true;
    if (entrepreneur && i > 0 && j.length <= 3) return true;
    /* une forme de fin en tête reste un mot (« Ag. Prokopis », « As-Salam »), sauf écrite
       avec son point d'abréviation : « Est. Nasser Al-Dhufairi » est un établissement */
    /* et « S.A. des Filatures de Montrouge », « S.p.A. di Navigazione », « N.V. van der Meulen » : la forme
       abrégée en tête, suivie d'une particule, est la forme (le français et l'italien la placent devant) */
    /* et « CV Cahaya Bintang Timur Jaya » : le CV indonésien (commanditaire vennootschap) se place en tête, comme PT */
    if (i === 0 && FORMES_FINALES.has(j) && mots.length > 1 && !(j === "est" && abreges.has(j))
      && !(PARTICULES.has(mots[1] ?? "") && mots.length > 2) && !(j === "cv" && mots.length > 2)
      /* « Oy Suomen Viljaterminaali Ab » (le finnois met Oy devant et Ab derrière), « AS Tallinna Laevaagentuur »
         (l'estonien met AS devant, en capitales ; « As-Salam » garde son article, minuscule après le A) (jeu 12) */
      && !(j === "oy" && mots.length > 2 && ["ab", "oy"].includes(mots[mots.length - 1] ?? ""))
      && !(j === "as" && mots.length > 2 && /^\s*AS\s+\p{Lu}/u.test(nom))) return true;
    societe = true;
    for (const k of PAYS_DES_FORMES.get(j) ?? []) pays.add(k);
    for (const k of FAMILLES_DES_FORMES.get(j) ?? []) familles.add(k);
    const d = DESIGNATIONS.get(j);
    if (d !== undefined) designations.add(d);
    if (priveDesMots && (j === "co" || j === "company")) designations.add("co");
    return false;
  });
  /* un sigle en tête fait des initiales des mots qui suivent (« IMZ Industrias Metalicas
     Zacoalco ») : il ne dit rien de plus qu'eux, il s'ôte */
  if (t.length >= 3 && t[0]!.length >= 2 && t[0]!.length <= 6 && t[0] === t.slice(1, 1 + t[0]!.length).map((m) => m[0]).join("")) t = t.slice(1);
  if (navireEcrit) navire = true;
  if (t.length > 1 && PREFIXES_NAVIRE.has(t[0]!)) { navire = true; typeNavire = TYPES_NAVIRE.get(t[0]!) ?? ""; t = t.slice(1); }
  /* LA NUMÉROTATION JAPONAISE DES NAVIRES : « Dai 8 Kōfuku Maru », « Daini Tsurumi Maru » (第二鶴見丸) sont « Kofuku Maru
     No. 8 », « Tsurumi Maru No. 2 ». Le préfixe 第 (dai) devant un chiffre s'ôte, le numéral en lettres (daiichi… daiju,
     sous les deux romanisations) devient son chiffre, et ce chiffre est le numéro que la règle des numéros lit. En tête
     d'un nom de navire japonais seulement, celui qui porte « Maru » : « Daiichi Sankyo » et « Daigo Sangyo » sont des
     sociétés, « Dai Duong » un nom vietnamien (jeu 11, 28/09 : trois paires à 0,800, « dai » ou « daini » mot rare sans
     répondant). Et « Maru » (丸) nomme un navire : la marque `navire`, comme un préfixe M/V, pour que le navire et
     l'armateur du même nom ne se confondent pas */
  const maru = japonaisPresume && t.length >= 2 && t.includes("maru");
  if (maru) {
    if (t[0] === "dai" && /^\d+$/.test(t[1]!)) t = t.slice(1);
    else { const n = NUMERAUX_DAI.get(pliJaponais(t[0]!)); if (n !== undefined) t = [n, ...t.slice(1)]; }
  }
  if (maru) navire = true;
  /* « i » (« et », en serbe, croate, polonais) ne s'efface qu'ENTRE deux mots : en dernière
     position, formes juridiques ôtées, c'est le chiffre romain I (« Holdings I S.A. », mesuré
     le 27/09 : il disparaissait et « Holdings I » ne se distinguait plus de « Holdings III ») */
  /* et le « I » du Wade-Giles (« Shun I Fa », yi) vit parmi des monosyllabes : le « i » slave
     ne s'efface qu'à côté d'un mot d'au moins cinq lettres */
  t = t.filter((j, i) => j !== "i" || i === t.length - 1 || !((t[i - 1]?.length ?? 0) >= 5 || (t[i + 1]?.length ?? 0) >= 5));
  /* « n » ENTRE deux mots est le « and » d'un clavardage (« Mulji Devshi n Sons ») ; écrit avec son
     point (« N. Kumar Traders »), c'est une initiale, qui reste ; en tête ou en queue aussi (mesuré le
     27/09 sur le jeu 9 : « mulji devshi n sons gen trading » à 0,689, « n » mot rare sans répondant) */
  const initialeN = /(?<![\p{L}.])n\.(?!\p{L})/iu.test(soude);
  t = t.filter((j, i) => j !== "n" || i === 0 || i === t.length - 1 || initialeN);
  /* « d » ou « l » seul devant un mot est l'élision dont un système a ôté l'apostrophe (« Societe Malienne d
     Import-Export ») ; écrit avec son point (« L. Dupont »), c'est une initiale, qui reste */
  const initialeDL = /(?<![\p{L}.])[dl]\.(?!\p{L})/iu.test(soude);
  t = t.filter((j, i) => (j !== "d" && j !== "l") || i === t.length - 1 || initialeDL);
  /* le sigle du pays en queue d'un nom d'usage ouest-africain (« Bois Tropicaux CI ») dit le pays que l'adjectif
     de nationalité du nom déposé écrit en tête (« Société Ivoirienne des Bois Tropicaux ») : voir PAYS_ADJECTIFS */
  if (t.length >= 2) { const s = SIGLES_PAYS.get(t[t.length - 1]!); if (s !== undefined) t[t.length - 1] = s; }
  /* le génitif finnois d'un port ou d'une ville (« Porin », « Turun », « Helsingin ») ramené au nominatif, sous un nom
     finnois seulement : la forme Oy, ou un générique finnois parmi les mots (voir GENITIFS_FINNOIS) */
  if (pays.has("FI") || separes.some(estFinnois)) t = t.map((j) => GENITIFS_FINNOIS.get(j) ?? j);
  /* le patronyme bengali sous sa forme sanskrite ou anglicisée (« Bandyopadhyay », « Banerjee »), le clan du nord dont la finale
     hésite (« Rathore », « Rathod »), la ville et le fleuve sous leur nom d'aujourd'hui ou celui du Raj (« Kaveri », « Cauvery ») :
     une seule graphie, sans marque, la graphie elle-même étant la trace (voir GRAPHIES_INDIENNES, jeu 13) */
  t = t.map((j) => GRAPHIES_INDIENNES.get(j) ?? j);
  /* les marqueurs se lisent AVANT la traduction (« tongsang », « shoji » deviennent « trading ») et
     avant le retrait des civilités (« Shree ») */
  const tousLesMots = [...articles, ...mots];
  /* et un mot lu en arabizi est la trace d'un nom arabe, marqueur ou pas (« mo7ammed trading ») */
  const arabe = /[\u0600-\u06ff]/.test(nom) || etablissementDuGolfe || arabizi.lu || tousLesMots.some((j) => MARQUEURS_ARABES.has(j) || MARQUEURS_PERSANS.has(j));
  /* un nom écrit en kana ou avec une forme japonaise, en sinogrammes, en hangul, est de cette
     langue avant tout marqueur : ses jetons viennent de `romaniser` (ecritures.ts) */
  const japonais = estJaponais(nom) || tousLesMots.some((j) => MARQUEURS_JAPONAIS.has(j));
  const chinois = pays.has("CN") || REGIONS.has(t[0] ?? "") || ecritEnSinogrammes || lecture !== "mandarin"
    || tousLesMots.some((j) => MARQUEURS_CHINOIS.has(j));
  /* et, sous une forme d'Asie de l'Est (« Co., Ltd. », pays KR possible) et hors d'un nom japonais, un mot que le
     dictionnaire ignore et qui écrit le digramme « eo » (ㅓ en romanisation révisée : Cheonghae, Seorim, Gyeongbo) :
     ni le japonais ni le pinyin ne l'écrivent, et c'est la seule trace du coréen dans « Cheonghae Marine Co., Ltd. »
     (jeu 11, 28/09 : 0,807 face à « Chunghae Marine », le pli coréen fermé faute de marque ; mesuré sur les onze
     jeux, les vingt et un noms que ce digramme marque sont tous coréens) */
  const coreen = /[\uac00-\ud7a3]/u.test(nom) || tousLesMots.some((j) => MARQUEURS_COREENS.has(j))
    || (pays.has("KR") && !japonais && t.some((j) => j.includes("eo") && lemme(j) === undefined));
  const hebreuOuGrec = /[\u0370-\u03ff\u0590-\u05ff]/.test(nom)
    || tousLesMots.some((j) => MARQUEURS_HEBREUX.has(j) || MARQUEURS_GRECS.has(j) || (j.length >= 6 && SUFFIXES_GRECS.test(j)));
  const prive = tousLesMots.some((j) => QUALIFICATIFS_PRIVES.has(j)) || privePhrase;
  /* un nom écrit en tamoul est indien : le crédit v, w, b vaut pour lui (வ s'écrit v ou w) */
  const tamoul = TAMOUL.test(nom);
  /* et un nom écrit en devanagari (hindi, marathi, népalais) l'est aussi : ee et i, v et w s'y replient (jeu 13) */
  /* et le suffixe -jee de l'orthographe du Raj (« Shamjee », « Banerjee », « Mukherjee » : l'honorifique -ji du Gujarat et du Kutch,
     le -ji des patronymes bengalis, écrits avec le ee anglais) sur un mot que le dictionnaire ignore : la seule trace de l'Inde
     dans « Shamjee Hardware Ltd » (jeu 15, tour 11 : face à « Shamji Hardware Ltd » à 0,794, ee et i deux voyelles sans marque) */
  const indien = tamoul || DEVANAGARI.test(nom) || tousLesMots.some((j) => MARQUEURS_INDIENS.has(j))
    || t.some((j) => j.length >= 5 && j.endsWith("jee") && lemme(j) === undefined);
  /* un nom thaï : l'écriture, un marqueur, ou le ph devant r ou l d'un mot que le dictionnaire ignore (voir `Marques.thai`) */
  const thai = THAI.test(nom) || tousLesMots.some((j) => MARQUEURS_THAIS.has(j)) || t.some((j) => j.length >= 5 && /ph[rl]/.test(j) && lemme(j) === undefined);
  const hispanique = ["MX", "ES", "BR", "PE", "CO", "CL", "AR", "PT", "UY", "BO"].some((k) => pays.has(k)) || tousLesMots.some((j) => MARQUEURS_HISPANIQUES.has(j));
  const majuscules = !/\p{Ll}/u.test(nom) && /\p{Lu}/u.test(nom) && t.length >= 2;
  const filiation = tousLesMots.some((j) => FILIATION_M.has(j)) ? "m" : tousLesMots.some((j) => FILIATION_F.has(j)) ? "f" : "";
  const succursale = mentionDeSuccursale(soude);
  /* la filiation ORDONNÉE : « Hakim Ben Youssef » est le fils de Youssef, « Youssef Ben Hakim » le fils de Hakim, deux personnes
     dont les mots sont les mêmes (jeu 14, 28/09 : trois paires à 1,000) ; le nom avant et le nom après la particule */
  const iFiliation = tousLesMots.findIndex((j) => FILIATION_M.has(j) || FILIATION_F.has(j));
  const filiationOrdre = iFiliation > 0 && iFiliation < tousLesMots.length - 1 ? `${tousLesMots[iFiliation - 1]}>${tousLesMots[iFiliation + 1]}` : "";
  const chat = t.length >= 2 && !majuscules && (!/\p{Lu}/u.test(nom) || !/[.,()]/.test(nom));
  return { texte: t.length > 0 ? t.join(" ") : normaliser(soude), abreges, parentheses, civilites, traduits, sources, sigles,
    pays: [...pays].sort(), familles: [...familles].sort(), designations: [...designations].sort(), navire, societe, arabe, japonais, chinois, coreen,
    hebreuOuGrec, indien, hispanique, tamoul, thai, prive, majuscules, chat, abjad: abjadDe(nom), cantonais: lecture !== "mandarin", lecture, priveInconnu,
    natifs: rom.natifs, filiation, filiationOrdre, succursale, typeNavire, slave };
}

/** Le texte d'une parenthèse NOMME-T-IL UNE SOCIÉTÉ : une forme juridique, et devant elle un nom qui n'est pas
 *  lui-même un mot du métier (« Pescados Anzures, S. de R.L. » oui ; « Private Joint Stock », « S.A. » non : tout y
 *  est forme) ? C'est ce qui distingue le propriétaire d'une enseigne (voir `variantesTypees`) d'une forme
 *  mise entre parenthèses, que PHRASES et FORMES lisent déjà. */
export function nommeUneSociete(texte: string): boolean {
  const a = analyserEntite(texte);
  if (!a.societe) return false;
  const vocabulaire = vocabulaireDuMetier();
  return a.texte.split(" ").some((m) => m.length >= 3 && !PARTICULES.has(m) && !(vocabulaire.get(m.length) ?? []).includes(m));
}

/** Les jetons d'un nom brut : préparation d'entité, puis le pipeline commun des paliers
 *  (translittération des écritures cyrillique et arabe comprise). */
export function jetonsEntite(nom: string): string[] {
  return jetons(preparer(preparerEntite(nom)));
}
