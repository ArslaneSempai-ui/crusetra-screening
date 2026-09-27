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
  "shirkat", "shirka", "aktiebolag", "aktieselskab", "aksjeselskap", "osakeyhtio", "scea", "gaec", "earl", "dac",
  "pcl", "teoranta", "teo", "cuideachta", "sapi", "sau",
  /* Europe */ "gmbh", "kg", "ohg", "ug", "ag", "se", "sa", "sas", "sasu", "sarl", "eurl", "snc",
  "sprl", "bvba", "srl", "spa", "sl", "slu", "sau", "bv", "nv", "vof", "oy", "oyj", "ab", "as",
  "asa", "aps", "kft", "zrt", "nyrt", "sro", "doo", "ad", "eood", "ood",
  /* Amérique latine */ "ltda", "eireli", "cv", "sapi", "sac", "saa",
  /* Russie et CEI */ "ooo", "oao", "zao", "pao", "ao", "jsc", "pjsc", "ojsc", "cjsc", "too",
  /* Ukraine, Grèce, Vietnam, Thaïlande */ "prat", "pat", "tov", "ae", "epe", "ike", "oe", "ee", "sia", "tnhh", "chamkat", "jamkat",
  /* désignations russes */ "npp", "npo", "npk", "npf", "pkf",
  /* Indonésie, en tête seulement (voir le filtre) */ "pt", "ud",
  /* Turquie */ "sti",
  /* Golfe */ "fze", "fzco", "fzc", "fzllc", "fz", "wll", "spc", "est",
  /* les zones franches de Dubaï et des Émirats, écrites comme une forme (« Orchid Ridge Commodities DMCC ») */
  "dmcc", "jafza", "dafza", "difc", "dso", "dwc", "rakez", "kizad",
  /* Azerbaïdjan, Liban */ "mmc", "sal",
  /* Asie */ "sdn", "bhd", "berhad", "kk", "jusikhoesa", "chusikhoesa", "yuhanhoesa", "tbk",
]);
/** Formes qui ne se placent QU'À LA FIN d'un nom : en tête, le même jeton est autre chose
 *  (« Ag. Prokopis » est « Agios », « As-Salam » un article arabe). Les formes russes, elles,
 *  se placent devant (« OOO Kamaflot ») et restent retirées partout. */
const FORMES_FINALES = new Set(["ag", "se", "sa", "as", "ad", "ab", "sl", "kg", "nv", "bv", "oy",
  "spa", "srl", "sas", "snc", "sac", "sti", "est", "kk", "cv", "ae", "epe", "ike",
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
  " usaha dagang ", " commanditaire vennootschap ", " perseroan komanditer ", " sole proprietor company ", " sole proprietorship company ",
  " joint stock company ", " limited liability company ", " limited liability partnership ",
  " private limited ", " public limited company ", " proprietary limited ",
  " with limited liability ", " sole proprietorship ",
  " free zone establishment ", " free zone company ", " free zone limited liability company ",
  " gesellschaft mit beschrankter haftung ", " aktiengesellschaft ", " kommanditgesellschaft ",
  " societe anonyme ", " societe a responsabilite limitee ", " societe par actions simplifiee ",
  " sociedad anonima cerrada ", " sociedad anonima ", " sociedad limitada ",
  " sociedad de responsabilidad limitada ",
  " sociedad anonima promotora de inversion de capital variable ", " sociedad anonima promotora de inversion ",
  " sociedad anonima unipersonal ", " sociedad anonima de capital variable ",
  " sociedade anonima ", " sociedade limitada ", " limitada ", " s de rl de cv ", " s de rl ",
  " sa de cv ", " de cv ", " spol s ro ", " spol sro ",
  " societa per azioni ", " societa a responsabilita limitata ",
  " besloten vennootschap ", " naamloze vennootschap ", " sp zoo ", " sp z oo ",
  " anonim sirketi ", " limited sirketi ", " sirketi ",
  " sendirian berhad ", " sendirian ",
  " kabushiki kaisha ", " kabushikigaisha ", " godo kaisha ", " yugen kaisha ",
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
].sort((a, b) => b.length - a.length);   /* les plus longues d'abord : « sociedad anonima » ne doit pas manger « sociedad anonima unipersonal » */
/** Les locutions d'usage abrégées en bloc : leur sens tient à leurs voisins (« San » seul
 *  est aussi « saint » en espagnol ; « San. ve Tic. » est toujours « Sanayi ve Ticaret »). */
const LOCUTIONS: readonly [string, string][] = [
  [" san ve tic ", " sanayi ticaret "], [" san tic ", " sanayi ticaret "],
  [" ind e com ", " industria comercio "], [" ind com ", " industria comercio "],
  [" imp exp ", " import export "], [" imp and exp ", " import export "],
  [" import and export ", " import export "],
  [" torgovy dom ", " trading house "], [" torgovyi dom ", " trading house "], [" torgovyy dom ", " trading house "],
  /* malais, indonésien, vietnamien, arabe romanisé (jeu 9) */
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
  [" fabrika ", " factory "], [" neft ", " oil "], [" khimiya ", " chemical "], [" khimicheskiy ", " chemical "],
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
}));
/** Les graphies d'une romanisation persane ou arabe que la table ne liste pas une à une : gh pour
 *  g (« Bazarghani »), une voyelle longue doublée (« Tejaarat », « Bazaargani »). Le repli ne touche
 *  que la CLÉ cherchée, parmi les mots persans et arabes : un nom propre reste tel quel. */
function pliGenerique(j: string): string {
  return j.replace(/gh/g, "g").replace(/aa/g, "a").replace(/ee/g, "i").replace(/oo/g, "u");
}
function traduction(j: string): string | undefined {
  const t = TRADUCTIONS.get(j);
  if (t !== undefined) return t;
  const p = pliGenerique(j);
  return p === j ? undefined : TRADUCTIONS_ARABES.get(p);
}
const TRADUCTIONS: ReadonlyMap<string, string> = new Map(Object.entries({
  /* chinois (pinyin) */ maoyi: "trading", jinchukou: "import export", keji: "technology", dianzi: "electronics",
  gongye: "industry", shiye: "industrial", zhizao: "manufacturing", jituan: "group", guoji: "international",
  wuliu: "logistics", huoyun: "freight", hangyun: "shipping", chuanwu: "shipping", jixie: "machinery", luntai: "tire",
  huagong: "chemical", fangzhi: "textile", fuzhuang: "garment", shipin: "food", jinshu: "metal",
  gangtie: "steel", suliao: "plastic", jianzhu: "construction", nengyuan: "energy", fazhan: "development",
  touzi: "investment", kongzhi: "holdings", konggu: "holdings", shangmao: "trading", jingmao: "trading",
  yuanyang: "ocean", jingmi: "precision", haiyun: "shipping", gongju: "tools",
  /* japonais */ kogyo: "industry", kougyou: "industry", shoji: "trading", shouji: "trading", sangyo: "industry",
  sangyou: "industry", seisakusho: "works", boeki: "trading", boueki: "trading", denki: "electric",
  kagaku: "chemical", seiko: "precision", seikou: "precision", jidosha: "automotive", unyu: "transport",
  kaiun: "shipping", kaihatsu: "development", tsusho: "trading", tsuusho: "trading",
  /* coréen */ sanop: "industry", sanup: "industry", muyeok: "trading", muyok: "trading", jeongmil: "precision",
  jungmil: "precision", jeonja: "electronics", junja: "electronics", hwahak: "chemical", mulryu: "logistics",
  haeun: "shipping", gaebal: "development", tongsang: "trading",
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
  /* turc */ kardesler: "brothers", nakliyat: "transport", tasimacilik: "transport", ticaret: "trading", sanayi: "industry",
  denizcilik: "shipping", gida: "food", tekstil: "textile", insaat: "construction", lojistik: "logistics", ihracat: "export",
  ithalat: "import", madencilik: "mining", enerji: "energy", kimya: "chemical", yatirim: "investment", tarim: "agriculture",
  /* italien */ spedizioni: "forwarding", trasporti: "transport", navigazione: "navigation", commercio: "trading",
  commerciale: "commercial", industriale: "industrial", industrie: "industries", costruzioni: "construction",
  /* espagnol et portugais */ comercio: "trading", comercial: "commercial", naviera: "shipping", transportes: "transport",
  industrias: "industries", sucesores: "successors", navegacao: "navigation", navegacion: "navigation", construcciones: "construction",
  alimentos: "food", alimentacion: "food", pesquera: "fishing", agricola: "agricultural", agropecuaria: "agricultural",
  /* allemand et néerlandais */ handel: "trading", handels: "trading", handelsgesellschaft: "trading", spedition: "forwarding",
  schifffahrt: "shipping", schiffahrt: "shipping", reederei: "shipping", werke: "works", werk: "works", bau: "construction",
  scheepvaart: "shipping", rederij: "shipping", expeditie: "forwarding", scheepsreparatie: "ship repair",
  /* polonais et tchèque */ zaklady: "works", zaklad: "works", chemiczne: "chemical", handlowy: "trading", handlowa: "trading",
  handlowe: "trading", przemysl: "industry", przemyslowe: "industrial", budowlane: "construction", transportowe: "transport",
  spedycja: "forwarding", logistyka: "logistics", zegluga: "shipping", stavebni: "construction", obchodni: "trading",
  /* grec translittéré (« Ναυτιλιακή Εταιρεία » est « Shipping Company ») */ naftiliaki: "shipping", naftiki: "shipping",
  etaireia: "", etairia: "", emporiki: "trading", viomichaniki: "industrial", viomichania: "industry", techniki: "technical",
  kataskevastiki: "construction", metaforiki: "transport", touristiki: "tourism",
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
}));

/** Les PARTICULES des langues du commerce : articles et prépositions qui lient les mots d'un nom
 *  sans rien désigner. Elles ne disparaissent pas (« de la Rúa » les porte), mais leur poids est
 *  le plancher : les listes sont surtout anglaises, « del » y est rare, et l'IDF en faisait un mot
 *  rare orphelin quand un côté l'omettait (« Compañía Naviera del Golfo » contre « Compañía
 *  Naviera Golfo », mesuré le 27/09 : plafonné à 0,80 pour une particule sautée). */
const PARTICULES: ReadonlySet<string> = new Set(["de", "del", "des", "du", "della", "delle", "dei", "degli", "dello", "di", "da",
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
const FILIATION_M: ReadonlySet<string> = new Set(["bin", "ibn", "ben", "ould", "wad", "wld"]);
const FILIATION_F: ReadonlySet<string> = new Set(["bint", "binti", "ibnat"]);
/** Les mots qui font d'un nom la succursale d'un autre : la même personne morale (« X - Penang Branch »
 *  est X), mais pas la filiale « X (Penang) Sdn. Bhd. » ; d'un seul côté, le nom tel qu'écrit se range au
 *  possible, et sa variante sans la mention rejoint X (jeu 9). */
const SUCCURSALES: ReadonlySet<string> = new Set(["branch", "succursale", "sucursal", "filiale", "filial", "zweigniederlassung",
  "niederlassung", "sucursales"]);

/** Les abréviations d'usage, ramenées au mot entier ; les mots de liaison disparaissent
 *  (« & », « and », « et », « ve », « und », « y », « e », « for », « of », « the »). */
/* Des Map, jamais des objets littéraux : un nom listé contient « constructor » ou
   « toString », et `objet[mot]` rendait alors une fonction héritée (mesuré le 27/09 :
   « .split is not a function » au premier criblage des cinq listes). */
const ABREVIATIONS: ReadonlyMap<string, string> = new Map(Object.entries({
  intl: "international", bros: "brothers", mfg: "manufacturing", mgmt: "management",
  svcs: "services", assoc: "associates", st: "saint", capt: "captain", sta: "santa", sto: "santo",
  /* les abréviations d'un clavardage ou d'un connaissement, sans point ni majuscules (jeu 9, 27/09 :
     « najmat alsahel electronics trdg llc », « mulji devshi n sons gen trading ») */
  gle: "generale", gal: "general", fres: "freres", entreprises: "enterprises", entreprise: "enterprise", les: "",
  td: "trading house", nlle: "nouvelle", nouv: "nouvelle",
  hnos: "brothers", gebr: "brothers", hk: "hongkong",
  /* les abréviations d'un crédit documentaire et d'un registre (jeu 9) : « Gen Trdg », « Grp Hldgs », « JV », « PKS » */
  jv: "joint venture", grp: "group", hldgs: "holdings", hldg: "holding", gen: "general", trdg: "trading", trdng: "trading",
  bldg: "building", mfrs: "manufacturers", pks: "palm oil mill", bnt: "bint",
  /* le registre nigérian et les affrètements (jeu 10) : « Nig. Ltd », « Shipmgmt » */
  nig: "nigeria", shipmgmt: "ship management",
  /* les prénoms et civilités malais : « Mohd » est Mohamad ; Haji, Dato', Datuk, Encik, Puan ne désignent personne */
  mohd: "mohamad", muhd: "muhammad", haji: "", hajjah: "", hj: "", hjh: "", dato: "", datuk: "", datin: "", encik: "", puan: "", tuan: "",
  /* les nombres écrits en lettres deviennent des chiffres : « Nine Willows » est « 9 Willows » */
  zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8",
  nine: "9", ten: "10", eleven: "11", twelve: "12",
  /* mots de liaison, ézafé persan, titres de civilité indiens (« Shree », « M/s. ») */
  and: "", et: "", ve: "", und: "", y: "", e: "", i: "", ye: "", kai: "", for: "", of: "", the: "",
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
function plier(nom: string): string {
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
  /* « AUT0 » (trois lettres) et « ELECTR0NIC5 » (des chiffres au milieu ET à la fin) : quand le mot
     corrigé est un mot du dictionnaire, c'est une lecture fautive, pas un numéro (jeu 10, 27/09) */
  const commeUnMot = j.replace(/0/g, "o").replace(/1/g, "i").replace(/5/g, "s").replace(/8/g, "b");
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

/** Préfixes et codes de type de navire, seulement EN TÊTE et seulement s'il reste un nom
 *  derrière : M/V, M/T, M/S, M/Y, S/Y, SS, FV, RV, LPG/C, LNG/C. */
const PREFIXES_NAVIRE = new Set(["mv", "mt", "ms", "my", "sy", "ss", "mts", "fv", "rv", "tb", "lpgc", "lngc", "tug", "barge", "tugboat",
  /* l'Asie du Sud-Est (jeu 9) : BG et TK (barge, tongkang), TB (tug boat), KM (kapal motor), LCT, SPOB */
  "bg", "tk", "km", "kmp", "klm", "lct", "spob", "mtug", "mfv",
  "tanker", "vessel", "roro", "ferry", "dredger", "trawler"]);
/** Le TYPE que le préfixe déclare quand il en déclare un : un remorqueur et sa barge portent souvent le
 *  même nom (« Tug Heron Reef », « Barge Heron Reef 2 » ; jeu 9 : « BARGE THONG CHAROEN 9 » et « TUG THONG
 *  CHAROEN 9 » jugés deux navires, quand « TB » et « TUG » écrivent le même). MV et MT ne disent rien ici. */
const TYPES_NAVIRE: ReadonlyMap<string, string> = new Map([["tug", "tug"], ["tb", "tug"], ["tugboat", "tug"], ["mtug", "tug"],
  ["barge", "barge"], ["bg", "barge"], ["tk", "barge"]]);
const PHRASES_NAVIRE = [" motor vessel ", " motor tanker ", " motor ship ", " motor yacht ",
  " sailing yacht ", " steam ship ", " lpg carrier ", " lng carrier ", " lpg tanker ", " fishing vessel ",
  " bulk carrier ", " container ship ", " oil tanker ", " chemical tanker ", " hopper barge ", " tug barge ", " ro ro vessel ",
  " ro ro ship ", " roro vessel ", " ro ro ", " general cargo ship ", " general cargo vessel ", " offshore supply vessel ", " supply vessel "];
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
  poser(["BR"], ["eireli"]);
  poser(["RU", "BY", "KZ", "UZ", "UA", "KG", "TJ", "AM", "AZ", "GE"], ["ooo", "oao", "zao", "pao", "ao", "jsc", "pjsc", "ojsc", "cjsc", "too",
    "obshchestvo s ogranichennoi otvetstvennostyu", "obshchestvo s ogranichennoy otvetstvennostyu",
    "tovarishchestvo s ogranichennoi otvetstvennostyu", "publichnoe aktsionernoe obshchestvo",
    "zakrytoe aktsionernoe obshchestvo", "otkrytoe aktsionernoe obshchestvo", "aktsionernoe obshchestvo"]);
  /* « joint stock company » écrit en anglais n'a PAS de pays : la Pologne (« Spółka Akcyjna »), le
     Vietnam, le Golfe, la Bulgarie le traduisent ainsi ; le lier à la CEI faisait un conflit de pays
     entre « Sokołowiec Chemical Works Spółka Akcyjna » et « … Joint-Stock Company » (27/09) */
  poser(["TR"], ["sti", "anonim sirketi", "limited sirketi", "sirketi"]);
  poser(["TR", "NO", "DK", "EE"], ["as"]);
  poser(["NO"], ["asa"]); poser(["DK"], ["aps"]);
  poser(["AE"], ["dmcc", "jafza", "dafza", "difc", "dso", "dwc", "rakez", "kizad"]);
  poser(["AE", "SA", "QA", "BH", "KW", "OM"], ["fze", "fzco", "fzc", "fzllc", "fz", "wll", "spc", "sole proprietor company", "sole proprietorship company", "est",
    "sole proprietor company", "sole proprietorship company",
    "establishment", "establishments", "free zone establishment", "free zone company",
    "free zone limited liability company", "with limited liability"]);
  poser(["MY"], ["sdn", "bhd", "berhad", "sendirian berhad", "sendirian"]);
  poser(["SG"], ["pte"]);
  poser(["AU", "ZA"], ["pty", "proprietary limited"]);
  poser(["IN", "PK", "LK", "BD"], ["pvt"]);
  poser(["IN", "PK", "LK", "BD", "SG", "NG", "ZA", "AU", "NZ", "KE"], ["private limited"]);
  poser(["JP"], ["kk", "kabushiki kaisha", "kabushikigaisha", "godo kaisha", "yugen kaisha"]);
  poser(["KR"], ["chusik hoesa", "jusik hoesa", "jusikhoesa", "chusikhoesa", "yuhanhoesa"]);
  poser(["CN", "HK", "TW"], ["youxian gongsi", "gufen youxian gongsi", "youxian zeren gongsi"]);
  /* 私人有限公司 : la société privée de Singapour (Pte. Ltd.) et de Malaisie (Sdn. Bhd.), en chinois */
  poser(["SG", "MY"], ["siren youxian gongsi"]);
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
  poser(["GR", "CY"], ["ae", "epe", "ike", "oe", "ee", "sia"]);
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
    "proprietary limited", "youxian gongsi", "youxian zeren gongsi", "siren youxian gongsi", "borisat chamkat", "borisat jamkat", "chamkat", "jamkat"]);
  poser(["ltd", "corp"], ["bhd", "berhad", "kk", "kabushiki kaisha", "kabushikigaisha", "jusikhoesa", "chusikhoesa",
    "chusik hoesa", "jusik hoesa", "gufen youxian gongsi", "oy", "ab", "aktiebolag", "aktieselskab", "aksjeselskap", "osakeyhtio"]);
  poser(["ltd", "llc"], ["ooo", "tov", "ltda", "limitada", "sociedade limitada", "eireli", "tnhh", "cong ty tnhh", "sti", "limited sirketi", "yuhanhoesa"]);
  /* le TOO kazakh (товарищество с ограниченной ответственностью) se traduit LLP, LLC ou Ltd */
  poser(["ltd", "llc", "part"], ["too", "tovarishchestvo s ogranichennoi otvetstvennostyu", "tovarishchestvo s ogranichennoy otvetstvennostyu"]);
  poser(["ltd", "corp"], ["pt", "perseroan terbatas", "tbk", "ud", "usaha dagang", "commanditaire vennootschap", "perseroan komanditer", "pcl", "public company limited", "teoranta", "teo", "dac", "designated activity company"]);
  poser(["corp"], ["private joint stock company", "private joint stock", "public joint stock", "closed joint stock", "open joint stock",
    "sherkat sahami khas", "sherkate sahami khas", "sahami khas", "sahami amm",
    "sociedad anonima promotora de inversion de capital variable", "sociedad anonima promotora de inversion",
    "sociedad anonima unipersonal", "sociedad anonima de capital variable"]);
  poser(["part"], ["scea", "gaec", "earl"]);
  poser(["llc"], ["llc", "pllc", "gmbh", "ug", "sarl", "eurl", "sprl", "bvba", "srl", "sl", "slu", "bv", "aps", "kft", "sro",
    "doo", "eood", "ood", "epe", "ike", "wll", "spc", "mmc", "s de rl", "s de rl de cv",
    "limited liability company", "obshchestvo s ogranichennoi otvetstvennostyu", "obshchestvo s ogranichennoy otvetstvennostyu",
    "gesellschaft mit beschrankter haftung",
    "societe a responsabilite limitee", "sociedad limitada", "sociedad de responsabilidad limitada",
    "societa a responsabilita limitata", "besloten vennootschap", "sp zoo", "sp z oo", "spolka z ograniczona odpowiedzialnoscia",
    "godo kaisha", "yugen kaisha", "with limited liability", "spol s ro", "spol sro"]);
  /* la zone franche est un registre à part : une FZE et une LLC du même nom sont deux sociétés */
  poser(["fz"], ["fze", "fzco", "fzc", "fzllc", "fz", "dmcc", "jafza", "dafza", "difc", "dso", "dwc", "rakez", "kizad",
    "free zone establishment", "free zone company",
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
const PHRASES_PRIVEES = new Set(["private limited", "proprietary limited", "sendirian berhad", "siren youxian gongsi"]);
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
  ["inc", "inc"], ["incorporated", "inc"], ["corp", "corp"], ["corporation", "corp"],
  /* les zones franches des Émirats : « Silver Dune Logistics FZCO » et « Silver Dune Logistics DMCC » sont deux
     dépôts dans deux zones (jeu 9) ; FZE, FZCO, FZC, FZ-LLC sont les formes d'une même zone, une seule désignation */
  ["fze", "fz"], ["fzco", "fz"], ["fzc", "fz"], ["fzllc", "fz"], ["fz", "fz"],
  ["dmcc", "dmcc"], ["jafza", "jafza"], ["dafza", "dafza"], ["difc", "difc"], ["dso", "dso"], ["dwc", "dwc"], ["rakez", "rakez"], ["kizad", "kizad"],
]);

/** Ce que la préparation a retiré, et qui reste une information ; et la LANGUE que le nom
 *  laisse voir (l'article arabe, une forme japonaise, une province chinoise), qui décide où
 *  les variations de romanisation sont créditées. */
export type Marques = { pays: readonly string[]; familles: readonly string[]; navire: boolean; societe: boolean;
  arabe: boolean; japonais: boolean; chinois: boolean; coreen: boolean; hebreuOuGrec: boolean; indien: boolean; hispanique: boolean;
  /** un nom écrit en tamoul : ses lettres latines viennent de `romaniser`, et le sanskrit du
   *  tamoul se replie au crédit (voir `pliTamoul`) */
  tamoul: boolean;
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
  /** le nom porte « branch », « succursale » : la mention d'un seul côté range la paire au possible */
  succursale: boolean;
  /** le type que le préfixe de navire déclare (« tug », « barge ») : deux types sont deux navires */
  typeNavire: string;
  /** le numéro de registre écrit entre parenthèses : deux numéros différents sont deux dépôts */
  registre: string;
  /** la marque d'un CLAVARDAGE : tout en minuscules, ou en casse mixte sans le moindre point, virgule
   *  ni parenthèse (« Kim Send Hardware & Building Materials Pre Ltd ») ; celui qui tape ne ponctue pas
   *  et son téléphone corrige ses mots (voir `scorePrepares`). Un export en majuscules n'en est pas un,
   *  ni un nom qui porte une annotation entre parenthèses (« Chin Hong Trading Pte Ltd (振丰贸易) ») */
  chat: boolean;
  /** le nom est écrit dans un abjad (arabe et persan, hébreu) : ses mots n'ont pas de voyelles,
   *  et se comparent aux consonnes de l'autre côté (voir `cleAbjad`) */
  abjad: Abjad;
  /** le nom est lu en cantonais (la seconde lecture d'un nom en sinogrammes, ou une lecture
   *  cantonaise substituée aux mots d'un nom latin) : ses syllabes se replient sur la graphie de
   *  Hong Kong (`pliCantonais`) */
  cantonais: boolean;
  /** la forme est écrite en chinois (有限公司) : elle ne dit pas si la société est privée
   *  (Pte. Ltd., Sdn. Bhd.) ou non, et ne se met pas en conflit là-dessus */
  priveInconnu: boolean;
  /** pour un jeton lu dans des sinogrammes, les caractères lus : deux lectures égales de
   *  caractères différents sont des homophones (« 新海 », « 鑫海 »), pas le même mot */
  natifs: ReadonlyMap<string, string> };

const MARQUEURS_ARABES = new Set(["al", "el", "ul", "bin", "bint", "ibn", "abu", "abou", "abd", "abdul", "abdel", "abdal", "umm",
  "sharikat", "sharika", "shirkat", "muassasat", "moassasat", "muassasa", "tijara", "tijarah", "tijariya", "sherkat", "bazargani",
  "tejarat", "sanati", "lil", "wa", "bani", "dar", "beit", "bayt"]);
/** Le persan sans article : ses mots d'affaires et ses lieux. */
const MARQUEURS_PERSANS = new Set(["sanat", "sanaat", "sanati", "sanaye", "sanayeh", "tolid", "tolidi", "farayand", "sahami", "khas",
  "amm", "tejarat", "tejarati", "bazargani", "pishro", "sherkat", "sherkate", "iran", "irani", "tehran", "tabriz", "isfahan", "esfahan",
  "shiraz", "mashhad", "karaj", "bandar", "abbas", "qeshm", "kish", "khazar", "pars", "parsian", "parsi", "novin", "omran", "toseh",
  "tosee", "naft", "fulad", "foolad", "madan", "khorshid", "khurshid", "sepid", "sefid", "mehr", "sepehr", "aria", "arya", "lavazem"]);
const MARQUEURS_COREENS = new Set(["tongsang", "sanop", "sanup", "muyeok", "muyok", "jeongmil", "jungmil", "jeonja", "junja", "hwahak",
  "mulryu", "haeun", "gaebal", "hanguk", "hankook", "hankuk", "korea", "korean", "daehan", "seoul", "busan", "pusan", "incheon", "inchon",
  "daegu", "taegu", "ulsan", "gwangju", "kwangju", "daejeon", "taejon", "gyeonggi", "kyonggi", "kyunggi", "chungcheong", "jeolla",
  "gyeongsang", "kyongsang", "kyung", "gyeong", "kyoung", "hwaseong", "hwasung", "cheonan", "chonan", "pyeongtaek", "pyongtaek"]);
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
  "textil", "textiles", "quimica", "metalicas", "mexico", "espana", "brasil", "peru", "colombia", "chile", "argentina", "venezuela"]);
const MARQUEURS_HEBREUX = new Set(["yam", "kfar", "kokhav", "kochav", "yarden", "shachar", "shahar", "galil", "hagalil", "kibbutz",
  "moshav", "negev", "haifa", "aviv", "ashdod", "eilat", "israel", "israeli", "beit", "bet", "tzafrir", "zafrir", "sde", "sdeh"]);
const MARQUEURS_GRECS = new Set(["kai", "sia", "naftiliaki", "naftiki", "emporiki", "viomichaniki", "techniki", "kataskevastiki", "ellas",
  "hellas", "elliniki", "hellenic", "piraeus", "pireas", "athens", "athina", "thessaloniki", "patras", "afoi", "aphoi", "adelfoi", "kapetan"]);
const SUFFIXES_GRECS = /(akis|opoulos|poulos|ides|idis|iadis|iotis|iki|ikos|ellis)$/;
const MARQUEURS_JAPONAIS = new Set(["kk", "kabushiki", "kaisha", "kabushikigaisha", "godo", "yugen", "kogyo", "kougyou", "shoji",
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
  "shokuhin", "seiyaku", "yakuhin", "tsushin", "tetsudo", "kumiai", "kyokai", "kogaku"]);
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
export function analyserEntite(nom: string, lecture: Lecture = "mandarin"): { texte: string; abreges: ReadonlySet<string>; parentheses: ReadonlySet<string>; civilites: ReadonlySet<string> } & Marques {
  /* L'apostrophe DANS un mot le soude (« O'Brien », « Ch'iao ») : en faire une frontière
     de mot fabriquerait des jetons d'une ou deux lettres qui ne désignent rien. « F.lli »
     (fratelli) et « LPG/C » (LPG carrier) ont une ponctuation qui porte le sens : lus avant. */
  const rom = romaniser(nom, lecture);
  let soude = plierLatin(rom.texte)
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
  /* LE NUMÉRO DE REGISTRE entre parenthèses (« (RC 884213) », « (Reg. No. 2014/117230/07) », « (HRB 33871,
     Amtsgericht Köln) », « (KvK 05234871) ») : une MARQUE, pas un résidu. Le même nom sous deux numéros est
     deux dépôts (jeu 10, 27/09 : cinq paires) ; le nom sans numéro face au nom numéroté est le même (le nom
     commercial et le registre). Présent des deux côtés et différent, conflit ; d'un seul côté, rien. */
  let registre = "";
  soude = soude.replace(REGISTRE, (_, num: string) => { registre = num.replace(/[^0-9a-z]/gi, "").toLowerCase(); return " "; });
  const parentheses = new Set([...soude.matchAll(/\(([^()]+)\)/g)]
    .flatMap((m) => {
      let dedans = ` ${jetons(normaliser(plier(m[1]!))).join(" ")} `;
      for (const [de, vers] of LOCUTIONS) dedans = dedans.split(de).join(vers);
      return dedans.trim().split(/ +/).flatMap((j) => (CIVILITES.has(j) ? "" : ABREVIATIONS.get(j) ?? traduction(j) ?? j).split(" "));
    })
    .filter((j) => j !== "" && !FORMES.has(j)));
  /* Lettres et chiffres collés se séparent : « No18 » → « No 18 », « LANQIAOFENG16 » →
     « LANQIAOFENG 16 » ; le numéro d'un navire devient un jeton que la règle des numéros lit. */
  const brut = jetons(jetons(normaliser(soude)).map(ocr).join(" ")
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
  const separes = texte.trim().split(/ +/);
  const motsBruts = separes.flatMap((j, i) => {
    if (j === "i") return [j];
    if (CIVILITES.has(j)) { civilites.add(j); return []; }
    /* « li » (ل, « pour ») devant un mot du commerce arabe est la préposition, comme « lil » :
       « Li Tijarat Al Aruz » est « Rice Trading » (jeu 9) ; devant tout autre mot c'est un nom (« Li Ning ») */
    if (j === "li" && TRADUCTIONS_ARABES.has(separes[i + 1] ?? "")) return [];
    return (ABREVIATIONS.get(j) ?? traduction(j) ?? j).split(" ");
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
  let t = mots.filter((j, i) => {
    if (j === "") return false;
    /* « PT » (perseroan terbatas) se place en tête, ou en queue après une virgule (« Sinar Kaloka
       Abadi, PT ») ; ailleurs c'est un mot */
    if ((j === "pt" || j === "ud") && i > 0 && i !== mots.length - 1) return true;
    if (!FORMES.has(j)) return true;
    if (entrepreneur && i > 0 && j.length <= 3) return true;
    /* une forme de fin en tête reste un mot (« Ag. Prokopis », « As-Salam »), sauf écrite
       avec son point d'abréviation : « Est. Nasser Al-Dhufairi » est un établissement */
    /* et « S.A. des Filatures de Montrouge », « S.p.A. di Navigazione », « N.V. van der Meulen » : la forme
       abrégée en tête, suivie d'une particule, est la forme (le français et l'italien la placent devant) */
    /* et « CV Cahaya Bintang Timur Jaya » : le CV indonésien (commanditaire vennootschap) se place en tête, comme PT */
    if (i === 0 && FORMES_FINALES.has(j) && mots.length > 1 && !(j === "est" && abreges.has(j))
      && !(PARTICULES.has(mots[1] ?? "") && mots.length > 2) && !(j === "cv" && mots.length > 2)) return true;
    societe = true;
    for (const k of PAYS_DES_FORMES.get(j) ?? []) pays.add(k);
    for (const k of FAMILLES_DES_FORMES.get(j) ?? []) familles.add(k);
    const d = DESIGNATIONS.get(j);
    if (d !== undefined) designations.add(d);
    return false;
  });
  /* un sigle en tête fait des initiales des mots qui suivent (« IMZ Industrias Metalicas
     Zacoalco ») : il ne dit rien de plus qu'eux, il s'ôte */
  if (t.length >= 3 && t[0]!.length >= 2 && t[0]!.length <= 6 && t[0] === t.slice(1, 1 + t[0]!.length).map((m) => m[0]).join("")) t = t.slice(1);
  let typeNavire = "";
  if (t.length > 1 && PREFIXES_NAVIRE.has(t[0]!)) { navire = true; typeNavire = TYPES_NAVIRE.get(t[0]!) ?? ""; t = t.slice(1); }
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
  /* les marqueurs se lisent AVANT la traduction (« tongsang », « shoji » deviennent « trading ») et
     avant le retrait des civilités (« Shree ») */
  const tousLesMots = [...articles, ...mots];
  const arabe = /[\u0600-\u06ff]/.test(nom) || tousLesMots.some((j) => MARQUEURS_ARABES.has(j) || MARQUEURS_PERSANS.has(j));
  /* un nom écrit en kana ou avec une forme japonaise, en sinogrammes, en hangul, est de cette
     langue avant tout marqueur : ses jetons viennent de `romaniser` (ecritures.ts) */
  const japonais = estJaponais(nom) || tousLesMots.some((j) => MARQUEURS_JAPONAIS.has(j));
  const chinois = pays.has("CN") || REGIONS.has(t[0] ?? "") || ecritEnSinogrammes || lecture === "cantonais"
    || tousLesMots.some((j) => MARQUEURS_CHINOIS.has(j));
  const coreen = /[\uac00-\ud7a3]/u.test(nom) || tousLesMots.some((j) => MARQUEURS_COREENS.has(j));
  const hebreuOuGrec = /[\u0370-\u03ff\u0590-\u05ff]/.test(nom)
    || tousLesMots.some((j) => MARQUEURS_HEBREUX.has(j) || MARQUEURS_GRECS.has(j) || (j.length >= 6 && SUFFIXES_GRECS.test(j)));
  const prive = tousLesMots.some((j) => QUALIFICATIFS_PRIVES.has(j)) || privePhrase;
  /* un nom écrit en tamoul est indien : le crédit v, w, b vaut pour lui (வ s'écrit v ou w) */
  const tamoul = TAMOUL.test(nom);
  const indien = tamoul || tousLesMots.some((j) => MARQUEURS_INDIENS.has(j));
  const hispanique = ["MX", "ES", "BR", "PE", "CO", "CL", "AR", "PT", "UY", "BO"].some((k) => pays.has(k)) || tousLesMots.some((j) => MARQUEURS_HISPANIQUES.has(j));
  const majuscules = !/\p{Ll}/u.test(nom) && /\p{Lu}/u.test(nom) && t.length >= 2;
  const filiation = tousLesMots.some((j) => FILIATION_M.has(j)) ? "m" : tousLesMots.some((j) => FILIATION_F.has(j)) ? "f" : "";
  const succursale = tousLesMots.some((j) => SUCCURSALES.has(j));
  const chat = t.length >= 2 && !majuscules && (!/\p{Lu}/u.test(nom) || !/[.,()]/.test(nom));
  return { texte: t.length > 0 ? t.join(" ") : normaliser(soude), abreges, parentheses, civilites,
    pays: [...pays].sort(), familles: [...familles].sort(), designations: [...designations].sort(), navire, societe, arabe, japonais, chinois, coreen,
    hebreuOuGrec, indien, hispanique, tamoul, prive, majuscules, chat, abjad: abjadDe(nom), cantonais: lecture === "cantonais", priveInconnu,
    natifs: rom.natifs, filiation, succursale, typeNavire, registre };
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
  /* les orthographes britanniques que la règle générale ramène à l'américaine du dictionnaire :
     -re, -er (sabre, centre, fibre) ; -our, -or (harbour, colour) ; -ogue, -og (catalogue). Sans
     cette racine, « Sabre » n'était pas un mot anglais, et « Sable » et « Sabre » passaient pour
     une faute de frappe (mesuré le 27/09 sur le jeu 8 : 0,839, une fausse alerte forte) */
  if (m.endsWith("re")) r.push(m.slice(0, -2) + "er");
  if (m.endsWith("our")) r.push(m.slice(0, -3) + "or");
  if (m.endsWith("ogue")) r.push(m.slice(0, -4) + "og");
  return r;
}
/** Le PLURIEL ANGLAIS d'un mot du dictionnaire est le même mot : « Metals » et « Metal », « Industries »
 *  et « Industry », « Supplies » et « Supply » (jeu 9, 27/09 : 廢金屬 traduit « metal » face à « Recycling
 *  Metals » restait à 0,833, une lettre de différence sur six, et le nom sous le niveau fort). Le seul
 *  pluriel, jamais -ing ni -er : « Trading » et « Traders » restent deux mots (voir `racines`). */
export function pluriel(long: string, court: string): boolean {
  return long !== court && DICTIONNAIRE.has(court)
    && (long === court + "s" || long === court + "es" || (court.endsWith("y") && long === court.slice(0, -1) + "ies"));
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
    .replace(/^hs/, "x")
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
export function variationVocalique(sqA: string, sqB: string): boolean {
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
    (x === "e" && "ai".includes(y)) || (y === "e" && "ai".includes(x)) || ("ou".includes(x) && "ou".includes(y));
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
  /** les civilités que la préparation a ôtées (« sri », « shree ») : un clavardage les soude au mot
   *  qui suit, et le score ne le lit que si l'autre nom les a écrites (voir CIVILITES) */
  civilites: readonly string[];
  /** le bloc des squelettes : la comparaison des mots collés s'y fait, pour que « Aldeeb »
   *  et « Al Dheeb » ne paient pas leur romanisation en plus de leur espace */
  blocSq: string;
  marques: Marques;
};

const SANS_MARQUES: Marques = { pays: [], familles: [], designations: [], navire: false, societe: false, arabe: false, japonais: false, chinois: false,
  coreen: false, hebreuOuGrec: false, indien: false, hispanique: false, tamoul: false, prive: false, majuscules: false, chat: false, abjad: "", cantonais: false,
  priveInconnu: false, natifs: new Map(), filiation: "", succursale: false, typeNavire: "", registre: "" };

export function preparerNom(f: Frequences, nom: string, lecture: Lecture = "mandarin"): NomPrepare {
  const a = analyserEntite(nom, lecture);
  const { texte: _t, abreges, parentheses, civilites, ...marques } = a;
  return depuisJetons(f, jetons(preparer(a.texte)), marques, abreges, parentheses, civilites);
}

export function depuisJetons(f: Frequences, J: readonly string[], marques: Marques = SANS_MARQUES,
  abreges: ReadonlySet<string> = new Set(), parentheses: ReadonlySet<string> = new Set(), civilites: ReadonlySet<string> = new Set()): NomPrepare {
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
    parentheses: mots.map((m) => parentheses.has(m)),
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
export function simMot(a: string, b: string, sqA: string, sqB: string, voyellesLibres = true): number {
  if (a === b) return 1;
  /* la lettre perdue d'un encodage (« seʔora » pour Señora) tient lieu d'une lettre, et d'une
     seule : le mot vaut l'égalité quand tout le reste est égal, lettre pour lettre */
  if ((porteUnJalon(a) || porteUnJalon(b)) && lettrePerdue(a, b)) return 1;
  if (pluriel(a, b) || pluriel(b, a)) return 0.95;
  if (abrege(a, b) || abrege(b, a)) return 0.9;
  if (motsDistincts(a, b, voyellesLibres) || composesDistincts(a, b, voyellesLibres)) return 0.5;
  if (initialeLueOptiquement(a, b)) return 0.95;
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
  return gesteDeFrappe(a, b);
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
  /* deux noms lus dans des sinogrammes se comparent sous la MÊME lecture : le mandarin de l'un
     face au cantonais de l'autre ne dit rien (jeu 9, 27/09 : 源成 en mandarin, yuancheng, face à
     源盛 en cantonais, yuen sing, passait à 0,857 par le bloc, hors de la garde des homophones) */
  if (A.marques.natifs.size > 0 && B.marques.natifs.size > 0 && A.marques.cantonais !== B.marques.cantonais) return 0;
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
  /* un qualificatif de groupe soudé à son radical d'un côté (« Agroholding »), le radical nu
     de l'autre (« Agro ») : la holding face à la société qui exploite (voir QUALIFICATIFS_SOUDES) */
  let qualificatifSoudeVu = false;
  const orphelinsMots: [string[], string[]] = [[], []];
  /* la variation de voyelle et le repli ne sont crédités que là où une romanisation les
     produit : l'arabe et le persan (a, e, i ; o, u), le japonais (ō, ū : o, ou, oo, u). En
     allemand, en espagnol, en vietnamien, en chinois, une voyelle de plus ou de moins est un
     autre mot (Meier, Mayer ; Solaris, Solares ; Phuong, Phong ; Jinyang, Jinyoung : mesuré) */
  const romanisation = A.marques.arabe || B.marques.arabe || A.marques.japonais || B.marques.japonais;
  /* l'Indonésie et la Malaisie (PT, CV, UD, Tbk, Sdn Bhd) : l'orthographe d'avant 1972 (tj, dj, oe) et la
     moderne s'écrivent avec le même squelette, et c'est le squelette qui fait foi (« Tjahaja Soerya Kentjana »,
     « Cahaya Surya Kencana », jeu 9) */
  const indonesien = ["ID", "MY"].some((k) => A.marques.pays.includes(k) || B.marques.pays.includes(k));
  /* la voyelle d'appui d'un groupe final de consonnes (« Bahr », « Bahar ») n'est que de l'arabe */
  const arabe = A.marques.arabe || B.marques.arabe;
  const japonais = A.marques.japonais || B.marques.japonais, coreen = A.marques.coreen || B.marques.coreen;
  const hebreuOuGrec = A.marques.hebreuOuGrec || B.marques.hebreuOuGrec, indien = A.marques.indien || B.marques.indien;
  const hispanique = A.marques.hispanique || B.marques.hispanique;
  const tamoul = A.marques.tamoul || B.marques.tamoul;
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
  /* là où une romanisation écrit les voyelles librement, deux mots anglais qui n'en diffèrent que
     par une ne sont pas deux mots (Amir, Emir ; Lung, Long en Wade-Giles et en pinyin, mesuré le
     27/09 sur le jeu 4) ; sans aucune marque de langue, si (Marlin, Merlin ; voir `motsDistincts`).
     L'espagnol et le portugais écrivent leurs voyelles : leur marque n'ouvre rien */
  const voyellesLibres = romanisation || hebreuOuGrec || chinois || coreen || indien;
  /* un côté écrit dans un abjad (arabe et persan, hébreu) n'a pas de voyelles : ses mots se
     comparent aux consonnes du côté latin (`cleAbjad`), et l'égalité vaut un squelette égal */
  const abjad = A.marques.abjad || B.marques.abjad;
  const memo = options.memo;
  const cote = (X: NomPrepare, Y: NomPrepare, cote: 0 | 1) => {
    let s = 0;
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
        const cle = memo ? `${x}|${y}|${X.abreges[i] ? 1 : 0}${Y.abreges[j] ? 1 : 0}${dernierX ? 1 : 0}${dernierY ? 1 : 0}${romanisation ? 1 : 0}${arabe ? 1 : 0}${chinois ? 1 : 0}${cantonais ? 1 : 0}${japonais ? 1 : 0}${coreen ? 1 : 0}${hebreuOuGrec ? 1 : 0}${indien ? 1 : 0}${tamoul ? 1 : 0}${hispanique ? 1 : 0}${X.marques.majuscules ? 1 : 0}${Y.marques.majuscules ? 1 : 0}${chat ? 1 : 0}|${abjad}|${nx}|${ny}` : "";
        /* le cache code l'équivalence de romanisation en ajoutant 2 à la valeur (elle est dans [0, 1]) */
        const enCache = memo?.get(cle);
        let v = enCache === undefined ? undefined : enCache >= 2 ? enCache - 2 : enCache;
        let equivalent = enCache !== undefined && enCache >= 2;
        if (v === undefined) {
          v = simMot(x, y, X.squelettes[i]!, Y.squelettes[j]!, voyellesLibres);
          const pliC = cantonais && x !== y && !tousDeuxAnglais(x, y) && pliCantonais(x) === pliCantonais(y);
          const autreSyllabe = chinois && x !== y && !pliC && !initialesChinoisesCompatibles(x, y);
          if (autreSyllabe) v = Math.min(v, 0.5);
          /* une équivalence de romanisation, dans le contexte de la langue : elle vaut au moins
             CREDIT_ROMANISATION, et elle lève l'ambiguïté du mot court (voir plus bas) */
          equivalent = !autreSyllabe && x !== y && !tousDeuxAnglais(x, y) && (pliC
            || (romanisation && (X.replis[i] === Y.replis[j] || variationVocalique(X.squelettes[i]!, Y.squelettes[j]!)
              || voyelleSautee(X.squelettes[i]!, Y.squelettes[j]!)))
            || (arabe && voyelleEpenthetique(X.squelettes[i]!, Y.squelettes[j]!))
            /* et « oe » y était « u » (« Soerya », « Surya ») : o et u ne font qu'une classe sous cette marque */
            || (indonesien && X.squelettes[i]!.replace(/o/g, "u") === Y.squelettes[j]!.replace(/o/g, "u"))
            || (japonais && pliJaponais(x) === pliJaponais(y))
            || (coreen && pliCoreen(x) === pliCoreen(y))
            /* v, w, b : hindi, hébreu, espagnol, portugais ; sous leur contexte, au crédit et non au
               squelette, pour que Fabre reste distinct de Favre */
            || ((indien || hispanique) && pliIndien(x) === pliIndien(y))
            /* le tamoul et son sanskrit (Lakshmi, லட்சுமி latchumi), sa sonorité non écrite */
            || (tamoul && pliTamoul(x) === pliTamoul(y))
            || (hebreuOuGrec && (X.squelettes[i]!.replace(/X/g, "h") === Y.squelettes[j]!.replace(/X/g, "h") || pliIndien(x) === pliIndien(y))));
          if (equivalent) v = Math.max(v, CREDIT_ROMANISATION);
          /* la voyelle d'appui (« Bahr », « Bahar ») ne change pas le mot arabe, quand une voyelle
             substituée peut en faire un autre : son crédit est au-dessus (CREDIT_APPUI) */
          if (arabe && x !== y && !tousDeuxAnglais(x, y) && voyelleEpenthetique(X.squelettes[i]!, Y.squelettes[j]!)) v = Math.max(v, CREDIT_APPUI);
          /* les mêmes consonnes qu'un mot venu d'un abjad : ce côté n'a jamais eu de voyelles à
             comparer, c'est l'égalité de squelette de son écriture (« بحر » bhr et « Bahr »,
             « הנגב » hngb et « HaNegev »). Mesuré le 27/09 sur les paires des jeux 6 et 8 : au
             crédit de 0,85, « بحر الذهب » restait à 0,744, « سپیددشت » à 0,787 et « שחר הגליל » à
             0,700, sous le possible, chaque mot du nom propre n'apportant que 0,7 */
          if (abjad !== "" && x !== y && !tousDeuxAnglais(x, y)) {
            const kx = cleAbjad(x, abjad), ky = cleAbjad(y, abjad);
            /* et la ta marbuta (ة), « -at » en annexion d'un côté, « -a » de l'autre (« Zahrat », « zahra ») */
            const memes = (kx.length >= 3 && kx === ky) || (abjad === "arabe"
              && ((ky.length >= 3 && cleAbjadSansTa(x) === ky) || (kx.length >= 3 && cleAbjadSansTa(y) === kx)));
            if (memes) { equivalent = true; v = Math.max(v, CREDIT_ABJAD); }
          }
          /* la voyelle longue ī écrite ee ou i : le même mot au squelette près (« Naseem », « Nasim » ;
             « Waleed », « Walid »), sous les marques arabe et indienne, et il vaut un squelette égal
             (0,95), pas une variation (jeu 9, 27/09 : « Naseem Al Bahar » et « Nasim Al Bahr », deux mots
             au crédit de 0,85, restaient à 0,715) */
          if (v < 0.95 && (arabe || indien) && x !== y && !tousDeuxAnglais(x, y) && (x.includes("ee") || y.includes("ee"))
            && squeletteLongue(x) === squeletteLongue(y)) { equivalent = true; v = 0.95; }
          /* dans un export tout en majuscules, un mot court qu'aucun dictionnaire ne connaît et
             qui commence un mot long de l'autre nom est une abréviation sans point (« HVY IND ») */
          if (v < 0.9 && ((X.marques.majuscules && x.length >= 2 && x.length <= 9 && y.length >= x.length + 3 && y.length >= 6 && y.startsWith(x) && !lemme(x))
            || (Y.marques.majuscules && y.length >= 2 && y.length <= 9 && x.length >= y.length + 3 && x.length >= 6 && x.startsWith(y) && !lemme(y)))) v = 0.9;
          /* un mot abrégé d'un point correspond au mot entier qu'il commence, ou dont il garde
             les lettres dans l'ordre depuis l'initiale (« Petrochem. », « Dist. », « Capt. ») ;
             dans les DEUX sens, sinon le côté entier ne rendait qu'un demi-crédit */
          /* un mot d'au moins quatre lettres qu'aucun dictionnaire ne connaît et qui COMMENCE un mot
             de l'autre nom plus long d'au moins trois lettres est une abréviation d'usage, sans point
             ni majuscules (« Agri Supplies » pour Agricultural Supplies) : un crédit partiel, celui
             d'une romanisation, pas celui d'un mot égal. Hors des noms chinois, coréens et japonais,
             où une syllabe qui en commence une autre est un autre mot (Hua, Huaxin) */
          if (v < CREDIT_ROMANISATION && !chinois && !coreen && !japonais
            && ((x.length >= 4 && y.length >= x.length + 3 && y.startsWith(x) && !lemme(x))
              || (y.length >= 4 && x.length >= y.length + 3 && x.startsWith(y) && !lemme(y)))) v = CREDIT_ROMANISATION;
          /* LA FAUTE D'UN CLAVARDAGE : sous la marque chat, un mot que le dictionnaire connaît face à un
             mot qu'il ne connaît pas, à UNE lettre près hors l'initiale (substituée, tombée, doublée,
             inversée), est la faute d'un pouce ou le correcteur d'un téléphone qui a fait un mot anglais
             d'un nom (« Kim Send » pour Kim Seng, jeu 9, 27/09 : 0,720), pas deux mots. Deux mots que le
             dictionnaire connaît restent deux mots (Marlin, Merlin ; Rail, Mail), deux qu'il ignore restent
             ambigus (Phuong, Phong) ; l'initiale reste l'initiale (Qadir, Nadir) ; et deux syllabes isolées
             sont deux syllabes, marque chinoise ou pas (Heng, Hong : mesuré le 27/09 sur le jeu 9, « Chin
             Heng Trading » et « Chin Hong Trading » montaient à 0,919 sur la variante sans leurs
             sinogrammes). Mesuré sur les neuf jeux : aucun piège ne monte */
          if (v < 0.9 && chat && !chinois && !coreen && !japonais && x.length >= 4 && y.length >= 4 && x[0] === y[0]
            && !(estSyllabeIsolee(x) && estSyllabeIsolee(y))
            && (lemme(x) === undefined) !== (lemme(y) === undefined) && distanceOsa(x, y) === 1) v = 0.9;
          if (v < 0.9 && X.abreges[i] && x.length < y.length && (y.startsWith(x) || abrege(x, y))) v = 0.9;
          if (v < 0.9 && Y.abreges[j] && y.length < x.length && (x.startsWith(y) || abrege(y, x))) v = 0.9;
          if (v < 0.9 && dernierX && tronque(x, y)) v = 0.9;
          if (v < 0.9 && dernierY && tronque(y, x)) v = 0.9;
          /* deux lectures de sinogrammes différents sont des homophones (« 新海 », « 鑫海 » : xinhai
             tous deux), et un homophone est un autre mot */
          if (nx !== "" && ny !== "" && nx !== ny) v = Math.min(v, 0.5);
          memo?.set(cle, equivalent ? v + 2 : v);
        }
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
      if (m < 0.8) { orphelins[cote] = true; orphelinsMots[cote].push(X.mots[i]!); }
      /* un mot géographique en tête (« Fujian Quanzhou Xingtai Shoes ») n'est pas un mot en
         trop : la province se dit ou s'omet pour la même société chinoise */
      /* un mot de pays ou de région du monde est distinctif quel que soit son poids : « UK Limited »
         n'est pas « Limited » */
      if (m < 0.8 && (X.poids[i]! >= SEUIL_RARE * X.poidsMax || PAYS_MOTS.has(X.mots[i]!)) && !(i <= 1 && REGIONS.has(X.mots[i]!))) orphelinRare = true;
      /* un mot équivalent par sa romanisation n'est pas ambigu */
      /* ni une particule : « del » aligné sur « de » n'est pas un mot court ambigu, c'est une
         particule sautée (« Compañía Naviera del Golfo » contre « … Naviera Golfo », 27/09) ;
         et la signature d'une faute de frappe (`fauteDeFrappe` : deux lettres inversées, une lettre
         tombée) lève le plafond, hors du chinois et du coréen, où une lettre de plus ou de moins est
         une autre syllabe (Xin, Xing) */
      if (m > 0.5 && m < 0.9 && !equivalentM && meilleurY >= 0 && X.mots[i]!.length <= 8 && Y.mots[meilleurY]!.length <= 8
        && !lemme(X.mots[i]!) && !lemme(Y.mots[meilleurY]!) && !PARTICULES.has(X.mots[i]!) && !PARTICULES.has(Y.mots[meilleurY]!)
        && (chinois || coreen || !fauteDeFrappe(X.mots[i]!, Y.mots[meilleurY]!))) motAmbigu = true;
      if (m >= 0.9 && X.poids[i]! >= 0.5 * X.poidsMax) rareCouvert[cote] = true;
      if (X.parentheses[i]) { parenthese[cote] = true; if (m >= 0.8) parentheseReconnue[cote] = true; }
      if (Y.mots.some((y) => qualificatifSoude(X.mots[i]!, y, Y.mots))) qualificatifSoudeVu = true;
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
  /* le bloc ne joue pas quand l'écart de longueur des deux blocs est exactement un mot sans
     répondant : ce n'est pas une soudure, c'est un mot en plus (« Ingredients UK Limited »
     contre « Ingredients Limited », mesuré le 27/09) */
  const ecart = Math.abs(A.bloc.length - B.bloc.length);
  const motEnPlus = ecart > 0 && (A.bloc.length > B.bloc.length ? orphelinsMots[0] : orphelinsMots[1]).some((w) => w.length === ecart);
  if (A.mots.length !== B.mots.length && !motEnPlus) {
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
  /* un numéro d'un seul côté, des marques en conflit, une filiale, un qualificatif de groupe
     soudé : la méthode a une raison précise de douter, et le candidat se range au niveau
     POSSIBLE, quelle que soit la ressemblance des mots ; il n'est pas effacé (un groupe ouvre
     des homonymes ailleurs) */
  return A.numeros === B.numeros && !marquesEnConflit(A.marques, B.marques) && !filiale && !qualificatifSoudeVu
    ? s : Math.min(s, FACTEUR_CONTENANCE);
}

export const FACTEUR_CONTENANCE = 0.8;
/** Un mot est RARE quand son poids atteint cette part du poids d'un mot inconnu des listes :
 *  « Shipping » (439 entrées sur 33 393) l'est tout juste, « Trading » (826) ne l'est pas. */
export const SEUIL_RARE = 0.45;
/** Le bloc (mots collés ou coupés) ne compte qu'à partir de cette similarité. */
export const BLOC_MIN = 0.8;

/** Les qualificatifs de groupe qu'un nom SOUDE à son radical : « Agroholding », « Agroinvest »,
 *  « Uraltrade ». Écrit en un mot à part (« Dorreval Chemicals Holdings »), le qualificatif est
 *  un mot rare sans répondant, et le plafond des orphelins range déjà la paire au niveau
 *  possible ; soudé, il n'était plus un mot, et la règle du dernier mot coupé lisait le radical
 *  nu comme un début tronqué (mesuré le 27/09 : « Rakhmatullin Agroholding LLC » contre
 *  « Rakhmatullin Agro LLC » à 0,907, la holding face à la société qui exploite). */
const QUALIFICATIFS_SOUDES: ReadonlySet<string> = new Set(["holding", "holdings", "group", "invest", "trade", "export", "import", "industries"]);

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
  if (a.typeNavire && b.typeNavire && a.typeNavire !== b.typeNavire) return true;
  if (a.succursale !== b.succursale) return true;
  if (a.registre && b.registre && a.registre !== b.registre) return true;
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
  if (/^(?:\s*)(?:\d+|[ivx]+)(?![\p{L}])/u.test(suite)) return false;
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
  if (sembleCoupe(ta, tb)) s = Math.max(s, scorePrepares(A, preparerNom(f, tb.slice(0, ta.length), B.marques.cantonais ? "cantonais" : "mandarin"), options));
  if (sembleCoupe(tb, ta)) s = Math.max(s, scorePrepares(preparerNom(f, ta.slice(0, tb.length), A.marques.cantonais ? "cantonais" : "mandarin"), B, options));
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
const ANNONCES = /[\s,;]*(?:\b(?:a[./]?\s?k[./]?\s?a\.?|f[./]?\s?k[./]?\s?a\.?|formerly(?:\s+known\s+as|\s+called)?|also\s+known\s+as|previously\s+(?:known\s+as|called)|now\s+trading\s+as|d[./]?\s?b[./]?\s?a\.?|doing\s+business\s+as|t\/a|trading\s+as|now\s+known\s+as|n\.?k\.?a\.?|antes|anciennement|vormals|ehemals|voorheen|anteriormente|dawniej)(?=[\s:,])|(?<=\p{L}[\s,]*)\bex[-.\s]+(?=\p{L}))\s*:?\s*/giu;
/** Ce qu'un document met DEVANT le nom : l'étiquette du champ (« SHIPPER: », « NOTIFY PARTY - »,
 *  « VESSEL: MV … », « by order of »), la personne à qui s'adresse le pli (« Attn. Mr. Sørensen, »),
 *  une référence bancaire (« OUR REF 71-33920-LC », « L/C No. 4412 »), un numéro de coque devant
 *  un nom de navire (« Hull No. 2287 Halbrook Reliance »). Le deux-points ou le tiret est exigé
 *  derrière une étiquette : sans lui, « Owner » ou « Agent » sont des mots du nom. Mesuré le 27/09
 *  sur le jeu 8 : quatorze vrais noms tenus à 0,80 par ces seuls résidus. */
const PREFIXES: readonly RegExp[] = [
  /^\s*(?:applicant|beneficiary|consignee|shipper|notify(?:\s+party)?|(?:towing|ocean|feeder|mother|export|carrying|performing|delivery)\s+vessel|vessel(?:\s*\/\s*voy(?:age)?)?|carrier|drawee|drawer|accountee|buyer|seller|exporter|importer|charterer|owners?|issuing\s+bank|advising\s+bank|supplier|customer|payee|payer|remitter|ordering\s+customer|account\s+party|principal|agent|counterparty|debtor|creditor|insured|assured|manufacturer|producer|receiver|forwarder)\s*[:\-\u2013]\s*/iu,
  /^\s*(?:by\s+order\s+of|on\s+behalf\s+of|for\s+(?:the\s+)?account\s+of|to\s+the\s+order\s+of|in\s+favou?r\s+of)\s*:?\s*/iu,
  /* « SHIPPED ON BOARD MV RONG YUAN TAI 16 AT FANGCHENG » : la mention d'embarquement devant le navire */
  /^\s*(?:shipped\s+on\s+board|laden\s+on\s+board|loaded\s+on\s+board|on\s+board|per\s+(?:vessel|m\/?v|m\/?t))\s*:?\s*/iu,
  /* l'étiquette d'un champ SWIFT collée au nom : « :50:BALOGUN VENTURES », « :59A:… » (jeu 10) */
  /^\s*:\d{2}[a-z]?:\s*/iu,
  /^\s*att(?:n|ention)?\.?\s*:?\s+[^,]{1,40},\s*/iu,
  /^\s*(?:our|your|yr|their)?\s*ref(?:erence)?\.?\s*(?:no\.?|#)?\s*:?\s*[a-z0-9][a-z0-9\-/.]{2,}\s+/iu,
  /^\s*(?:l\/c|lc|dc|b\/l|bl|inv(?:oice)?|p\/?o|contract|order)\s*(?:no\.?|#)\s*:?\s*[a-z0-9][a-z0-9\-/.]{2,}\s+/iu,
  /^\s*(?:n\/b\s+)?hull\s*(?:no\.?\s*)?[a-z]{0,3}-?\d+\s+(?=\p{L}{3,})/iu,
];
const ANNOTATIONS: readonly RegExp[] = [
  /\([^()]*\b(?:flag|liquidation|liquidaci[oó]n|liquidazione|liquida[çc][aã]o|liquidatie|likvidation|konkurs|faillite|fallimento|insolven\w*|administration|receivership|receivers?|bankrupt\w*|dissolved|struck\s+off|under\s+arrest|arrested|detained|carrier|tanker|vessel|bulk|container|branch|office|built|blt|established|founded|est(?:d)?\.?\s*(?:in\s+)?\d{4}|since\s+\d{4}|(?:h\/n|hull\s*(?:no\.?)?)\s*[a-z]{0,3}-?\d+)\b[^()]*\)/giu,
  /* une année entre parenthèses, seule ou datée : « (Est. 1887) Ltd », « (built 2015, Panama) », « (1994) » */
  /\(\s*(?:est(?:d|ablished)?\.?|founded|since|built|blt|constructed|delivered)\s*(?:in\s+)?(?:1[89]|20)\d{2}\s*(?:,\s*[\p{L} .'-]{2,30})?\)/giu,
  /* mais une année SEULE entre parenthèses reste : « Negev Drip Systems (2014) Ltd » est la société
     successeur de « Negev Drip Systems Ltd » (Israël, Royaume-Uni ; jeux 5 à 7) */
  /* ce qui suit le nom d'un navire sur un connaissement : « , Port of Loading: Antwerp », « POD Piraeus » */
  /[\s,]+(?:port\s+of\s+(?:loading|discharge|destination|delivery|call|registry)|loading\s+port|discharge\s+port)\s*:?\s*[\p{L} .'-]{2,30}\s*$/iu,
  /* ce qu'un message de banque colle derrière le nom (jeu 10) : « REF LC0193045 », « A/C 331276 »,
     « -BENEF », « -ACCT BENEF » ; et derrière un navire, son indicatif « CS:5NCT7 » et son
     immatriculation de pêche « (GHA-1893) » ; derrière une société, son numéro de registre
     « (RC 884213) », « (Reg. No. 2014/117230/07) », « (HRB 33871, Amtsgericht Köln) », « (KvK 05234871) » */
  /\s+(?:ref(?:erence)?\.?|a\/c|acct\.?|account\s+no\.?)\s*:?\s*(?=[a-z0-9\-/]*\d)[a-z0-9\-/]{3,}\s*$/iu,
  /\s*[-\u2013]\s*(?:acct\s+)?(?:benef(?:iciary)?|applicant|remitter|ordering\s+cust(?:omer)?|drawee|drawer|payee)\s*$/iu,
  /\s+(?:cs|c\/s|call\s*sign)\s*:?\s*[a-z0-9]{4,7}\s*$/iu,
  /\s*\(\s*[a-z]{2,3}-?\d{2,6}\s*\)\s*$/iu,
  /* les sigles POL et POD exigent leurs deux-points : sans eux, « pol » avalait Polska, Polyfab,
     Polymers (mesuré le 27/09 : quatre fausses alertes fortes d'un coup) */
  /[\s,]+\b(?:pol|pod)\s*:\s*[\p{L} .'-]{2,30}\s*$/iu,
  /\s*[-–,;(]\s*[\p{L}. ]{2,25}\bflag(?:ged)?\)?\s*$/iu,
  /* « Kenanga Pacific Sdn. Bhd. - Penang Branch » : la succursale après un tiret ; « Succursale de Genève », « Sucursal Lima » */
  /\s+[-\u2013]\s+[^,]*\b(?:branch|succursale|sucursal|filiale|zweigniederlassung|representative\s+office|liaison\s+office)\b.*$/iu,
  /,\s*[^,]*\bbranch\b.*$/iu,
  /\s+branch$/iu,
  /* la cargaison derrière le nom d'un expéditeur ou d'un navire : « - CPO IN BULK », « - 500 MT RICE IN BAGS » */
  /\s+[-\u2013]\s+[\p{L}\d ]{2,40}?\bin\s+(?:bulk|bags|drums|containers?|cartons|jumbo\s+bags)\s*$/iu,
  /\s+[-\u2013]\s+(?:cpo|cpko|pko|ffb|rbd\s+palm\s+\w+|crude\s+palm\s+oil|palm\s+kernel\s+oil)\b.*$/iu,
  /[\s,]+p\.?\s*o\.?\s*box\b.*$/iu,
  /\s+(?:in|under)\s+(?:liquidation|administration|receivership)$/iu,
  /\(\s*(?:in\s+)?(?:lay-?up|laid\s+up|for\s+scrap|scrapped|arrested|detained|under\s+arrest|idle)(?:\s*,\s*[\p{L} .'-]{2,30})?\s*\)$/iu,
  /\s+c\/o\s+.*$/iu,
  /* une ville et son État entre parenthèses : « (Beaumont, TX) » ; un numéro de voyage : « VOY 0931 » ;
     la liquidation dans les langues du commerce ; « , flag: Marshall Islands » */
  /\s*\(\s*[\p{L} .'-]{2,30},\s*[A-Z]{2}\s*\)\s*$/u,
  /\s+voy\.?\s*\d{2,5}[a-z]?\s*$/iu,
  /\s+(?:in|en|em)\s+(?:liquidazione|liquidation|liquidación|liquidacion|liquidação|liquidacao|liquidatie|likvidation)\s*$/iu,
  /,\s*flag\s*:?\s*[\p{L} ]{2,30}\s*$/iu,
  /* les résidus des champs d'un connaissement : « NOTIFY PARTY », « SAME AS CONSIGNEE ABOVE »,
     « ATTN MR LI » ; un numéro de coque ; « VOYAGE 9 » ; « ROOM 302 », « UNIT 4B », « BLDG 2 » */
  /\s+(?:notify(?:\s+party)?\s*)?(?:same\s+as\s+(?:consignee|shipper|notify|above|applicant)(?:\s+above)?)\s*$/iu,
  /\s+notify(?:\s+party)?\s*$/iu,
  /\s+att(?:n|ention)?\.?:?\s+.*$/iu,
  /* un numéro de coque après un NOM : « Atlantic Pioneer, Hull No. 482 » ; mais « NEWBUILDING HULL
     NO. H2217 » n'a que son numéro pour nom, il le garde */
  /(?<=\p{L}{3,}\s+(?:\p{L}+\s+)*)[\s,]+(?:n\/b\s+)?hull\s*(?:no\.?\s*)?[a-z]{0,3}-?\d+\s*$/iu,
  /[\s,/]+voy(?:age)?\.?\s*(?:no\.?\s*)?\d{1,5}[a-z]?\s*$/iu,
  /\s+(?:room|rm|unit|bldg|building|floor|fl|suite|ste|office|off|plot|shop)\.?\s*\d+[a-z]?\s*$/iu,
  /\s+(?:in\s+)?lay-?up\s*$/iu,
  /* les partenaires d'une société de personnes italienne : « S.n.c. di Perrone Luigi & C. » */
  /\s+di\s+[\p{L}.' ]+&\s*c\.?\s*$/iu,
  /\s+v\.?\s?\d{2,4}[nsew]?$/iu,
  /\s+\d{3,4}[nsew]$/iu,
  /\s+(?:bulk\s+carrier|lng\s+carrier|lpg\s+carrier|oil\s+tanker|chemical\s+tanker|container\s+ship|general\s+cargo)$/iu,
  /* un code pavillon à trois lettres entre parenthèses en fin de nom : (MHL), (PAN), (LBR).
     Deux lettres ((UK), (HK)) restent : c'est le plus souvent une filiale. */
  /\s*\([A-Z]{3}\)\s*$/u,
];
/** Les pays et régions du monde qu'une société met dans son nom pour dire sa filiale. */
const PAYS_MOTS: ReadonlySet<string> = new Set(["uk", "usa", "us", "america", "american", "americas", "china", "chinese", "india", "indian",
  "germany", "german", "deutschland", "france", "french", "italy", "italia", "italian", "spain", "espana", "japan", "nippon", "korea",
  "canada", "mexico", "brasil", "brazil", "australia", "singapore", "malaysia", "thailand", "vietnam", "indonesia", "philippines",
  "turkey", "turkiye", "egypt", "nigeria", "kenya", "ghana", "zambia", "tanzania", "poland", "polska", "netherlands", "holland",
  "belgium", "sweden", "norway", "denmark", "finland", "austria", "switzerland", "ireland", "portugal", "greece", "hellas", "russia",
  "ukraine", "kazakhstan", "uae", "emirates", "qatar", "oman", "kuwait", "bahrain", "saudi", "arabia", "iran", "iraq", "israel",
  "pakistan", "bangladesh", "lanka", "nepal", "taiwan", "hongkong", "macau", "argentina", "chile", "peru", "colombia", "venezuela",
  "europe", "europa", "european", "asia", "asian", "africa", "african", "pacific", "atlantic", "nordic", "baltic", "benelux", "iberia",
  "latam", "apac", "emea", "gulf", "middle", "east", "west", "north", "south", "overseas", "global", "worldwide"]);

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

/** Les formes juridiques telles qu'un export en majuscules les écrit, pour couper une adresse
 *  qui les suit sans virgule : « DAEHAN SHIPPING CO LTD BUSAN KOREA ». */
/** Les ports, villes et quartiers du commerce, comme SIGNAL d'adresse derrière une forme (« … CO. BANDAR
 *  ABBAS », « … CO LLC DEIRA ») : ils ne s'ôtent jamais d'un nom par eux-mêmes. */
const PORTS_ET_QUARTIERS: ReadonlySet<string> = new Set(["bandar", "kota", "jebel", "deira", "bur", "ras", "jlt", "musaffah",
  "sharjah", "ajman", "fujairah", "dubai", "abu dhabi", "jeddah", "riyadh", "dammam", "muscat", "doha", "manama", "kuwait",
  "karachi", "lahore", "mumbai", "chennai", "kolkata", "colombo", "chittagong", "jakarta", "surabaya", "medan", "dumai", "belawan",
  "klang", "penang", "johor", "kuching", "bangkok", "laem", "chabang", "haiphong", "hochiminh", "saigon", "manila", "cebu",
  "shanghai", "ningbo", "qingdao", "tianjin", "shenzhen", "guangzhou", "xiamen", "dalian", "fangcheng", "hongkong", "kaohsiung",
  "busan", "incheon", "tokyo", "yokohama", "kobe", "osaka", "rotterdam", "antwerp", "antwerpen", "hamburg", "bremen", "bremerhaven",
  "felixstowe", "southampton", "havre", "marseille", "genoa", "genova", "piraeus", "istanbul", "izmir", "mersin", "alexandria",
  "lagos", "apapa", "tema", "abidjan", "mombasa", "durban", "santos", "houston", "newark", "savannah", "vancouver"]);
const FORME_EN_LIGNE = /\b(?:co\.?,?\s*ltd\.?|co(?=\.)|limited|ltd\.?|inc\.?|llc|l\.l\.c\.|corp\.?|corporation|gmbh|s\.?a\.?|b\.?v\.?|n\.?v\.?|pte\.?\s*ltd\.?|pvt\.?\s*ltd\.?|sdn\.?\s*bhd\.?|s\.?p\.?a\.?|s\.?r\.?l\.?|a\.?s\.?|plc|kk|k\.k\.|jsc|ooo|fze|fzco|est\.?)\b/giu;

export function variantes(brut: string): string[] {
  const vues = new Set<string>([brut.trim()]);
  /* « (Amharic: ተስፋዬ በቀለ ንግድ) » : l'étiquette de langue s'efface, la parenthèse native reste (jeu 10) */
  brut = brut.replace(/\(\s*(?:amharic|arabic|chinese|japanese|korean|thai|hebrew|russian|greek|hindi|tamil|persian|farsi|urdu|bengali|in\s+\p{L}+)\s*:\s*/giu, "(");
  /* une adresse collée à la forme sans espace, champ 59 : « Company Limited45 Marina Road » (jeu 10) */
  brut = brut.replace(/\b(limited|ltd|plc|inc|llc|corp|gmbh|bv|nv|sa|sarl|lda|ltda|pty|bhd)\.?(?=\d)/giu, "$1 ");
  /* le registre écrit la personne nom d'abord : « Okeke, Chidi Building Materials » (jeu 10) */
  const inverse = /^([\p{Lu}][\p{L}'-]+),\s+([\p{Lu}][\p{L}'-]+)\s+(\p{L}.*)$/u.exec(brut.trim());
  if (inverse) vues.add(`${inverse[2]} ${inverse[1]} ${inverse[3]}`);
  /* la forme native entre parenthèses, ou l'inverse : « BAKU OIL EXPORT (Бакинский …) »,
     « 青岛海鑫国际物流有限公司 (Qingdao Haixin International Logistics Co., Ltd.) », « Katz Miriam (כץ מרים) » :
     deux écritures du même nom, chacune une variante, aucune filiale */
  /* et l'arménien, le géorgien, l'éthiopien (amharique, jeu 10), le birman, le lao */
  const nonLatin = /[\u0370-\u03ff\u0400-\u04ff\u0530-\u058f\u0590-\u05ff\u0600-\u06ff\u0900-\u0dff\u0e00-\u0eff\u1000-\u10ff\u1100-\u11ff\u1200-\u137f\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/u;
  const paren = /^(.*?)\s*\(([^()]+)\)\s*$/u.exec(brut.trim());
  if (paren && paren[1]!.trim() && paren[2]!.trim() && (nonLatin.test(paren[1]!) !== nonLatin.test(paren[2]!))) {
    vues.add(paren[1]!.trim());
    vues.add(paren[2]!.trim());
  }
  /* les suffixes SWIFT à la barre oblique (« LUCENT CORRIDOR/V.088W/HK », « …CO LTD/NANNING/CN ») :
     retirés un à un tant qu'il reste deux mots devant */
  let sansBarres = brut.trim();
  /* mais « A/S », « K/S », « S/A » sont des formes (une lettre, la barre, une lettre) : pas un suffixe SWIFT */
  while (/\/[^\s/]{1,20}$/.test(sansBarres) && !/(?:^|\s)\p{L}\/\p{L}$/u.test(sansBarres)
    && sansBarres.replace(/\/[^\s/]{1,20}$/, "").trim().split(/\s+/).length >= 2) {
    sansBarres = sansBarres.replace(/\/[^\s/]{1,20}$/, "").trim();
  }
  if (sansBarres !== brut.trim()) brut = sansBarres;
  /* un nom annoncé entre parenthèses : « LUNARIS DAWN (EX-SELVANA) » */
  const sansParentheseAnnoncee = brut.replace(
    /\(\s*(?:ex[-.\s]+|f\/?k\/?a\.?\s*|formerly\s+(?:known\s+as\s+)?|previously\s+(?:known\s+as\s+)?|also\s+known\s+as\s+|a\.?k\.?a\.?\s*|(?:antes|anciennement|anc\.|vormals|ehem\.|ehemals|voorheen|anteriormente|dawniej)\s+)([^()]*)\)/giu, (_, x: string) => ` | ${x} `);
  const parties = sansParentheseAnnoncee.split("|").flatMap((p) => p.split(ANNONCES))
    .map((p) => p.trim()).filter((p) => p.length > 0);
  for (let p of parties) {
    let avant: string;
    /* les préfixes de champ ne s'ôtent que s'il reste un nom derrière (deux lettres au moins) */
    do { avant = p; for (const r of PREFIXES) { const q = p.replace(r, "").trim(); if (/\p{L}{2}/u.test(q)) p = q; } } while (p !== avant);
    /* une annotation ôtée au milieu du nom (« (Est. 1887) Ltd ») laisse deux espaces : une seule */
    do { avant = p; for (const r of ANNOTATIONS) p = p.replace(r, "").replace(/\s{2,}/g, " ").trim(); } while (p !== avant);
    /* « MV RONG YUAN TAI 16 AT FANGCHENG » : derrière un navire préfixé, « at » et un lieu sont le port d'embarquement */
    p = p.replace(/^((?:m\/?v|m\/?t|ms|fv|f\/v|tb|bg|km|tug|barge)\.?\s+.{3,60}?)\s+at\s+[\p{L} .'-]{2,30}$/iu, "$1");
    /* une adresse derrière la forme juridique : « … FZE, Jebel Ali Free Zone, Dubai »,
       « … B.V., ROTTERDAM » ; ou, derrière un nom de navire, son port d'immatriculation en un
       ou deux mots : « SIROCCO MARINER, MONROVIA » ; ou une adresse reconnaissable à ses mots
       (étage, rue, immeuble, zone, boîte) ou à ses chiffres : « …, 7th Floor, Dhanlaxmi Chambers, Surat » */
    const virgule = p.indexOf(",");
    if (virgule > 0 && /\b(?:floor|street|st\.|road|rd\.|avenue|ave\.|building|bldg|tower|chambers|plot|block|unit|suite|zone|area|estate|park|p\.?o\.? box|no\.\s*\d|\d{2,})/iu.test(p.slice(virgule + 1))
      && !/\b(?:ltd|limited|inc|llc|corp|s\.?a\.?|gmbh|co\.?)\b/iu.test(p.slice(virgule + 1))) {
      p = p.slice(0, virgule).trim();
    }
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
    /* le suffixe coréen des navires, 호 (« 세월호 », « 파이오니어호 ») : le nom sans lui est une lecture
       de plus, jamais la seule (« 금호 », Kumho, garde son 호, qui est son nom) */
    if (/[\uac00-\ud7a3]{2,}호$/u.test(p)) vues.add(p.replace(/호$/u, "").trim());
    /* une adresse sans virgule derrière la forme juridique, dans un export : ce qui suit la
       dernière forme, quand ce sont des mots et non une autre forme, s'ôte */
    let dernier: RegExpExecArray | null = null;
    for (const m of p.matchAll(FORME_EN_LIGNE)) dernier = m;
    if (dernier && dernier.index !== undefined && dernier.index > 0) {
      const fin = dernier.index + dernier[0].length;
      const queue = p.slice(fin).trim();
      const motsQueue = jetons(normaliser(queue));
      /* la queue doit porter un signal d'ADRESSE (pays, ville, pavillon, chiffre, mot de bâtiment)
         et aucune forme : « de C.V. » n'est pas une adresse, « of Canada Ltd. » non plus */
      const adresse = motsQueue.some((m) => PAYS_MOTS.has(m) || PAVILLONS.has(m) || REGIONS.has(m) || PORTS_ET_QUARTIERS.has(m) || /^\d+[a-z]?$/.test(m)
        || /^(?:room|rm|unit|bldg|building|floor|fl|suite|ste|street|st|road|rd|avenue|ave|zone|area|district|city|port|tower|plaza|plot|block)$/.test(m));
      if (queue.length > 0 && adresse && /^[\p{L}\d .'-]{2,40}$/u.test(queue) && !new RegExp(FORME_EN_LIGNE.source, "iu").test(queue)
        && p.slice(0, dernier.index).trim().split(/\s+/).length >= 1) {
        vues.add(p.slice(0, fin).trim());
      }
    }
    /* un pavillon nu en fin de nom de navire : « MERIDIAN GLORY LIBERIA » */
    const mots = p.split(/\s+/);
    if (mots.length >= 3 && PAVILLONS.has(normaliser(mots[mots.length - 1]!))) vues.add(mots.slice(0, -1).join(" "));
    if (mots.length >= 4 && PAVILLONS.has(normaliser(mots.slice(-2).join(" ")))) vues.add(mots.slice(0, -2).join(" "));
  }
  return [...vues];
}

/** Une variante et la lecture qu'on en fait : un nom en sinogrammes se lit en mandarin ET en
 *  cantonais (voir ecritures.ts) ; un nom latin n'a qu'une lecture, sauf celles que lui donnent
 *  les sinogrammes qu'il porte (`substitutions`). C'est ici que l'index et le score prennent
 *  leurs lectures : tout ce qui s'ajoute ici est vu des deux. */
export type LectureDe = { texte: string; lecture: Lecture };
export function lecturesDe(brut: string): LectureDe[] {
  const vues = new Map<string, LectureDe>();
  const poser = (l: LectureDe) => { const k = `${l.lecture}|${l.texte}`; if (!vues.has(k)) vues.set(k, l); };
  for (const v of variantes(brut)) {
    poser({ texte: v, lecture: "mandarin" });
    if (/[\u4e00-\u9fff]/u.test(v) && !estJaponais(v)) {
      poser({ texte: v, lecture: "cantonais" });
      for (const s of substitutions(v)) poser(s);
    }
  }
  return [...vues.values()];
}

/**
 * UN NOM LATIN QUI PORTE SES SINOGRAMMES, en queue ou entre parenthèses (« Yongcheng Trading
 * (Shenzhen) Co Ltd 永成 », « Wing Fung Provision Trading Pte Ltd (荣丰) », « Zhang Xing Seafood
 * Trading Pte Ltd 张兴海产 ») : les caractères sont l'écriture native des mots distinctifs du nom,
 * et leurs lectures en sont d'autres graphies. Quand la lecture mandarine des caractères (soudée)
 * est une suite de mots latins du nom, la lecture cantonaise se substitue à ces mots (« Wing Sing
 * Trading (Shenzhen) Co Ltd », lue en cantonais) ; quand c'est la lecture cantonaise qui les
 * retrouve (au pli près), la mandarine se substitue (« Rongfeng Provision Trading Pte Ltd »), et
 * le nom latin tel quel est une lecture cantonaise (« Shun Hing » face à « Soon Heng »). Le nom
 * latin sans ses caractères est une lecture de plus. Jeu 9, 27/09 : « Wing Shing Trading
 * (Shenzhen) Co., Ltd. » restait à 0,305 face au premier, la lecture des caractères ne faisant
 * qu'un jeton de plus, en double du mot qu'elle écrit.
 */
function substitutions(v: string): LectureDe[] {
  const suites = v.match(/[\u4e00-\u9fff]+/gu) ?? [];
  const latin = v.replace(/\(\s*[\u4e00-\u9fff]+\s*\)|[\u4e00-\u9fff]+/gu, " ").replace(/\s{2,}/g, " ").trim();
  if (suites.length === 0 || !/\p{L}{2}/u.test(latin)) return [];
  const sorties: LectureDe[] = [{ texte: latin, lecture: "mandarin" }];
  const mots = latin.split(" ");
  const cles = mots.map((m) => jetons(normaliser(m)).join(""));
  const majuscule = (s: string) => s[0]!.toUpperCase() + s.slice(1);
  const remplacer = (de: number, a: number, par: readonly string[]) => [...mots.slice(0, de), ...par.map(majuscule), ...mots.slice(a + 1)].join(" ");
  for (const suite of suites) {
    /* les mots du commerce des caractères (海产, 有限公司) ne se substituent à rien : seuls les
       jetons qui gardent leurs caractères (`natifs`) sont le nom propre */
    const rm = romaniser(suite, "mandarin"), rc = romaniser(suite, "cantonais");
    const propresM = rm.texte.trim().split(/ +/).filter((j) => rm.natifs.has(j));
    const propresC = rc.texte.trim().split(/ +/).filter((j) => rc.natifs.has(j));
    if (propresM.length === 0 || propresC.length === 0) continue;
    const mandarin = propresM.join("");
    /* la lecture mandarine, soudée, retrouvée dans une suite de mots latins (« Yongcheng », « Zhang Xing ») */
    for (let i = 0; i < cles.length; i++) {
      let colle = "";
      for (let k = i; k < cles.length && colle.length < mandarin.length; k++) {
        colle += cles[k]!;
        if (colle === mandarin) { sorties.push({ texte: remplacer(i, k, propresC), lecture: "cantonais" }); break; }
      }
    }
    /* la lecture cantonaise, syllabe par syllabe, retrouvée au pli près (« Wing Fung », « Man Lee ») */
    for (let i = 0; i + propresC.length <= cles.length; i++) {
      if (propresC.every((s, t) => cles[i + t] !== "" && pliCantonais(cles[i + t]!) === pliCantonais(s))) {
        sorties.push({ texte: remplacer(i, i + propresC.length - 1, [mandarin]), lecture: "mandarin" });
        sorties.push({ texte: latin, lecture: "cantonais" });
      }
    }
  }
  return sorties;
}

/** Le score de deux noms BRUTS : le meilleur sur toutes leurs variantes, sous toutes leurs lectures. */
export function scoreNoms(f: Frequences, a: string, b: string): number {
  let meilleur = 0;
  for (const la of lecturesDe(a)) {
    const A = preparerNom(f, la.texte, la.lecture);
    for (const lb of lecturesDe(b)) meilleur = Math.max(meilleur, scoreBrut(f, la.texte, A, lb.texte, preparerNom(f, lb.texte, lb.lecture)));
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
export function pliJaponais(m: string): string {
  return m.replace(/tsu/g, "tu").replace(/chi/g, "ti").replace(/shi/g, "si").replace(/fu/g, "hu").replace(/ji/g, "zi").replace(/zu/g, "du")
    .replace(/sh(?=[aou])/g, "sy").replace(/ch(?=[aou])/g, "ty").replace(/j(?=[aou])/g, "zy")
    .replace(/o(?:h(?![aeiou])|o|u)/g, "o").replace(/uu/g, "u").replace(/(.)\1+/g, "$1");
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

/** Le cantonais en jyutping, en graphie du gouvernement de Hong Kong et dans les graphies d'usage de
 *  Singapour et de Malaisie : les paires d'aspiration (g, k ; b, p ; d, t), s et sh, ch, ts, z et c, j et
 *  y ; les voyelles que ces graphies écrivent librement (aa, a ; oe, eu, eo, ue, oo, u ; ei, ee, ay, i ;
 *  ung, ong ; eng, ing : la Seng Heng Bank de Macao est 誠興, sing hing) ; un h final après voyelle
 *  (Wah, Poh). Une seule clé, comparée sous la marque `cantonais` seulement. */
export function pliCantonais(m: string): string {
  return m.replace(/^ts/, "ch").replace(/^[zc](?!h)/, "ch").replace(/^sh/, "s").replace(/^j/, "y").replace(/^gw/, "kw")
    .replace(/^g/, "k").replace(/^b/, "p").replace(/^d/, "t")
    .replace(/aa/g, "a").replace(/oe|eo|eu|ue|oo/g, "u").replace(/(?<=[a-z])yu/g, "u").replace(/ei|ee|ay/g, "i")
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
/** Ce que vaut la voyelle d'appui d'un groupe final de consonnes (`voyelleEpenthetique` : « Bahr »,
 *  « Bahar ») : entre la variation d'une voyelle (0,85 : une voyelle substituée peut faire un autre
 *  mot, Hamad et Hamid) et le squelette égal (0,95), parce qu'elle ne change pas le mot arabe, بحر
 *  dans les deux graphies. À 0,85, « Naseem Al Bahar 3 » et « Nasim Al Bahr 3 » restaient à 0,808
 *  (jeu 9, 27/09) : deux mots au crédit de romanisation ne font pas un nom fort. */
export const CREDIT_APPUI = 0.9;
/** Ce que vaut l'égalité des consonnes face à un mot écrit dans un abjad : autant qu'un
 *  squelette égal (0,95), parce que ce côté-là n'a pas de voyelles à mettre en défaut. */
export const CREDIT_ABJAD = 0.95;

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
