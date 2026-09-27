/**
 * LES ÉCRITURES NON LATINES D'UN NOM DE SOCIÉTÉ OU DE NAVIRE : le hangul, l'arabe et le
 * persan, l'hébreu, les sinogrammes, ramenés à des jetons latins AVANT la préparation
 * commune (formes juridiques, mots du commerce, poids), pour qu'un nom écrit dans sa langue
 * passe par les mêmes tables qu'un nom romanisé ou traduit.
 *
 * Trois natures d'écriture, trois traitements :
 *
 *   - le HANGUL est un alphabet syllabique : chaque syllabe se décompose par arithmétique
 *     (bloc U+AC00, initiale, médiane, finale) et se lit selon la romanisation révisée de
 *     2000, celle des registres coréens ; « 새벽별 » rend « saebyeokbyeol » sans table ;
 *   - l'ARABE, le PERSAN et l'HÉBREU sont des abjads : ils n'écrivent pas les voyelles brèves.
 *     Une translittération lettre à lettre rend des consonnes (« بحر » : bhr), et le côté
 *     latin (« Bahr ») se compare sur ses consonnes seulement, par `cleAbjad` ;
 *   - les SINOGRAMMES se lisent par une table (pinyin sans ton, `pinyin.txt`), un caractère
 *     à la fois ; les mots du commerce (远洋, 航运, 有限公司) se traduisent avant, et le reste,
 *     le nom propre, devient UN jeton (« 沧澜 » : canglan). Deux noms de caractères différents
 *     peuvent se lire pareil (« 新海 », « 鑫海 », homophones) : chaque jeton garde ses
 *     caractères (`natifs`), et le score les regarde quand les deux côtés en ont. Hong Kong,
 *     le Guangdong et Macao romanisent en CANTONAIS (永成 : Wing Shing, pas Yongcheng) : la
 *     même table existe en jyutping (`jyutping.txt`), et un nom en sinogrammes se lit DEUX
 *     fois (`Lecture`), en mandarin, puis en cantonais syllabe par syllabe dans la graphie du
 *     gouvernement de Hong Kong (`hongkong`), là où le mandarin soude le nom propre : les
 *     registres de Hong Kong écrivent « Wing Shing », ceux du continent « Yongcheng ». Chaque
 *     lecture est une variante que l'index voit (`lecturesDe`, entites.ts).
 *
 *   - le THAÏ écrit ses voyelles autour de la consonne, ou pas du tout (la voyelle implicite),
 *     et le côté latin les écrit comme il l'entend (Chokdee, Chokdi ; Charoen, Jaroen) : la
 *     lecture suit la romanisation royale (RTGS), et le mot se compare sur ses consonnes,
 *     comme un mot venu d'un abjad (mode « thai » de `cleAbjad`) ;
 *   - le TAMOUL est un abugida : consonne + signe de voyelle, ் (virama) pour la consonne
 *     seule ; la sonorité ne s'écrit pas (க : k ou g), et le squelette la replie déjà.
 *
 * Le JAPONAIS reste tel quel : un kanji a plusieurs lectures (« 霜月 » se lit Shimotsuki, pas
 * Shuangyue), et une lecture chinoise d'un nom japonais ne rencontrerait rien.
 *
 * Tout caractère hors des tables traverse INCHANGÉ, comme dans la couche commune : une table
 * qui remplacerait l'inconnu par du vide ferait converger deux noms différents.
 */
import { readFileSync } from "node:fs";

/** L'écriture dont un mot se compare sur ses consonnes : les deux abjads, et le thaï (voir
 *  `cleAbjad`), dont la lecture écrit des voyelles que le côté latin n'écrit pas pareil. */
export type Abjad = "" | "arabe" | "hebreu" | "thai";
export type Romanise = { texte: string; natifs: Map<string, string> };
/** La lecture d'un nom en sinogrammes : le mandarin (pinyin, le nom propre soudé) ou le cantonais
 *  (jyutping en graphie de Hong Kong, syllabe par syllabe). Un nom latin se lit pareil sous les deux. */
export type Lecture = "mandarin" | "cantonais";

/* ─────────────────────────── les mots du commerce, par écriture ─────────────────────────── */

/* Des Map, jamais des objets littéraux : voir ABREVIATIONS dans entites.ts. Les valeurs sont
   les mots que les tables d'entites.ts connaissent déjà (formes, TRADUCTIONS, anglais). */

/** Coréen : la forme juridique et le vocabulaire commercial, écrits collés au nom propre
 *  (« 새벽별물류 » : Saebyeokbyeol + logistique). */
const GENERIQUES_HANGUL: ReadonlyMap<string, string> = new Map(Object.entries({
  "주식회사": "jusikhoesa", "유한회사": "yuhanhoesa", "물류": "logistics", "무역": "trading", "통상": "trading",
  "상사": "trading", "산업": "industry", "공업": "industrial", "정밀": "precision", "전자": "electronics", "화학": "chemical",
  "해운": "shipping", "기계": "machinery", "건설": "construction", "개발": "development", "식품": "food", "제약": "pharmaceutical",
  "에너지": "energy", "그룹": "group", "국제": "international", "조선": "shipbuilding", "철강": "steel", "섬유": "textile",
  "자동차": "automotive", "엔지니어링": "engineering", "홀딩스": "holdings", "인터내셔널": "international", "마린": "marine",
  "서플라이": "supply", "시스템": "systems", "코리아": "korea", "자원": "resources",
}));

/** Le persan écrit ک et ی là où l'arabe écrit ك et ي : une seule lettre pour les deux, dans
 *  les clés des tables comme dans les noms (mesuré le 27/09 : « شرکت » écrit avec ک ne rencontrait
 *  pas le nom unifié, et restait un mot rare sans répondant). L'alif porte ou non sa hamza
 *  (أ, إ, آ, ٱ) selon la frappe : un seul alif, la lecture est la même (« الإطارات », « الاطارات »). */
function unifierLettres(s: string): string {
  return s.replace(/ک/g, "ك").replace(/ی/g, "ي").replace(/ۀ/g, "ه").replace(/[أإآٱ]/g, "ا");
}

/** Arabe et persan : la forme (شركة, شرکت, ذ.م.م.), les qualificatifs du commerce (للتجارة,
 *  بازرگانی), la conjonction. Les clés persanes s'écrivent avec ک et ی, unifiés comme le nom. */
const GENERIQUES_ARABES: ReadonlyMap<string, string> = new Map(Object.entries({
  /* formes ; les sigles du Golfe s'écrivent pointés (ذ.م.م., ش.م.ح.) et `unifier` les soude */
  "شركة": "sharikat", "الشركة": "sharikat", "شرکت": "sherkat", "مؤسسة": "muassasat", "المؤسسة": "muassasat",
  "ذمم": "llc", "شذمم": "llc", "شمح": "fzco", "ممح": "fze", "شمع": "pjsc", "ششو": "spc", "سهامی": "sahami", "خاص": "khas",
  "عام": "amm", "محدود": "limited", "المحدودة": "limited", "قابضة": "holdings",
  /* les particules de filiation, comme le côté latin les écrit : « مؤسسة سعيد بن حمد » est
     « Saeed Bin Hamad Est. » (jeu 9 : lues lettre à lettre, « bn » ne rencontrait pas « bin ») */
  "بن": "bin", "ابن": "ibn", "بنت": "bint", "ابو": "abu", "ام": "umm",
  /* le commerce */ "للتجارة": "trading", "التجارة": "trading", "تجارة": "trading", "تجارية": "trading", "التجارية": "trading",
  "بازرگانی": "trading", "تجاری": "trading", "تجارت": "trading", "العامة": "general", "عامة": "general",
  /* les marchandises et les métiers que le nom anglais TRADUIT (jeu 9 : « لتجارة خردة المعادن » est
     « Scrap Metal Trading », « لتجارة الإطارات » « Tyres Trading »). Pas les mots qu'il translittère :
     « الذهب » reste Al Dhahab dans « Rimal Al Dhahab », « النور » Al Noor, « الفجر » Al Fajr */
  "خردة": "scrap", "المعادن": "metals", "معادن": "metals", "الإطارات": "tyres", "إطارات": "tyres", "العطور": "perfumes",
  "عطور": "perfumes", "السكر": "sugar", "سكر": "sugar", "الأرز": "rice", "الرز": "rice", "أرز": "rice", "الخدمات": "services",
  "البتروكيماويات": "petrochemicals", "بتروكيماويات": "petrochemicals", "المواد": "materials",
  "مواد": "materials", "الغذائية": "food", "غذائية": "food", "الأغذية": "food", "أغذية": "food", "البناء": "building",
  "بناء": "building", "الملابس": "garments", "ملابس": "garments", "الإلكترونيات": "electronics", "إلكترونيات": "electronics",
  "السيارات": "automotive", "سيارات": "automotive", "قطع الغيار": "spare parts", "قطع غيار": "spare parts",
  "الطاقة": "energy", "طاقة": "energy", "النفط": "oil", "نفط": "oil", "الأسماك": "fish", "أسماك": "fish",
  /* le persan : ses métiers, et Kish, l'île franche que les noms portent */
  "پخش": "distribution", "کیش": "kish",
  /* l'industrie et la production */ "الصناعية": "industrial", "صناعية": "industrial", "للصناعة": "industry", "الصناعة": "industry",
  "صنعتی": "industrial", "صنایع": "industries", "صنعت": "industry", "تولیدی": "production", "تولید": "production",
  /* la mer */ "الملاحة": "shipping", "للملاحة": "shipping", "الملاحية": "shipping", "للشحن": "shipping", "الشحن": "shipping",
  "کشتیرانی": "shipping", "بحری": "marine", "البحرية": "marine", "البحري": "marine", "دریایی": "marine",
  /* le reste du vocabulaire courant */ "للمقاولات": "contracting", "المقاولات": "contracting", "الدولية": "international",
  "الدولي": "international", "بین المللی": "international", "القابضة": "holdings", "للاستثمار": "investment",
  "الاستثمار": "investment", "سرمایه گذاری": "investment", "للنقل": "transport", "النقل": "transport", "حمل و نقل": "transport",
  "اللوجستية": "logistics", "مجموعة": "group", "گروه": "group", "الهندسية": "engineering", "مهندسی": "engineering",
  "ساختمانی": "construction", "خدمات": "services", "پتروشیمی": "petrochemical", "البتروكيماوية": "petrochemical",
  "فولاد": "steel", "نفت": "oil", "توسعه": "development", "التنمية": "development", "أبناء": "sons", "ابناء": "sons",
  "إخوان": "brothers", "اخوان": "brothers", "وشركاه": "", "و": "",
}).map(([k, v]) => [unifierLettres(k), v] as const));

/** Hébreu : la forme (בע״מ, sans ses guillemets), le commerce, la famille. */
const GENERIQUES_HEBREUX: ReadonlyMap<string, string> = new Map(Object.entries({
  "בעמ": "ltd", "חברה": "company", "חברת": "company", "תעשיות": "industries", "תעשייה": "industry", "תעשיה": "industry",
  "אחים": "brothers", "ובניו": "sons", "ובנו": "sons", "ושות": "", "מסחר": "trading", "סחר": "trade", "שיווק": "marketing",
  "ייצור": "production", "יצור": "production", "הנדסה": "engineering", "בנייה": "construction", "בניה": "construction",
  "השקעות": "investments", "אחזקות": "holdings", "קבוצת": "group", "קבוצה": "group", "בינלאומי": "international",
  "שירותים": "services", "לוגיסטיקה": "logistics", "ספנות": "shipping", "ימי": "marine", "טכנולוגיות": "technologies",
}));

/** Sinogrammes, simplifiés et traditionnels : les formes (股份有限公司 avant 有限公司 avant 公司 :
 *  les clés se lisent de la plus longue à la plus courte), le vocabulaire du commerce, et les
 *  lieux dont la romanisation d'usage n'est pas le pinyin (台中 Taichung, 香港 Hong Kong). */
const GENERIQUES_HANZI: ReadonlyMap<string, string> = new Map(Object.entries({
  /* formes */ "股份有限公司": "gufen youxian gongsi", "有限责任公司": "youxian zeren gongsi", "有限責任公司": "youxian zeren gongsi",
  "有限公司": "youxian gongsi", "公司": "company", "集团": "group", "集團": "group",
  /* le commerce */ "贸易": "trading", "貿易": "trading", "商贸": "trading", "商貿": "trading", "经贸": "trading", "經貿": "trading",
  "进出口": "import export", "進出口": "import export", "国际": "international", "國際": "international",
  "科技": "technology", "电子": "electronics", "電子": "electronics", "工业": "industry", "工業": "industry",
  "实业": "industrial", "實業": "industrial", "制造": "manufacturing", "製造": "manufacturing", "物流": "logistics",
  "货运": "freight", "貨運": "freight", "航运": "shipping", "航運": "shipping", "海运": "shipping", "海運": "shipping",
  "船务": "shipping", "船務": "shipping", "远洋": "ocean", "遠洋": "ocean", "机械": "machinery", "機械": "machinery",
  "精密": "precision", "工具": "tools", "化工": "chemical", "纺织": "textile", "紡織": "textile", "服装": "garment",
  "服裝": "garment", "食品": "food", "金属": "metal", "金屬": "metal", "钢铁": "steel", "鋼鐵": "steel", "塑料": "plastic",
  "塑膠": "plastics", "塑胶": "plastics", "建筑": "construction", "建築": "construction", "能源": "energy", "发展": "development",
  "發展": "development", "投资": "investment", "投資": "investment", "控股": "holdings", "轮胎": "tire", "輪胎": "tire",
  "水产": "seafood", "水產": "seafood", "汽车": "automotive", "汽車": "automotive", "医药": "pharmaceutical", "醫藥": "pharmaceutical",
  /* le commerce de Singapour et de Malaisie écrit en chinois (jeu 9, 27/09 : 协和电器供应私人有限公司,
     聯成廢金屬回收有限公司, 宝吉棕榈油贸易私人有限公司) : les mots que le côté anglais écrit */
  "电器": "electrical", "電器": "electrical", "供应": "supplies", "供應": "supplies", "橡胶": "rubber", "橡膠": "rubber",
  "糖业": "sugar", "糖業": "sugar", "废金属": "scrap metal", "廢金屬": "scrap metal", "回收": "recycling",
  /* 廢金屬回收 est le métier du recyclage des métaux, que l'anglais nomme « Metal Recycling » ou « Recycling
     Metals » sans dire « scrap » : la locution entière avant ses mots (jeu 9 : 聯成廢金屬回收有限公司) */
  "废金属回收": "metal recycling", "廢金屬回收": "metal recycling",
  "海产": "seafood", "海產": "seafood", "五金": "hardware", "文具": "stationery", "棕榈油": "palm oil", "棕櫚油": "palm oil",
  /* la société privée de Singapour (Pte. Ltd.) et de Malaisie (Sdn. Bhd.) : 私人有限公司, lue avant 有限公司 */
  "私人有限公司": "siren youxian gongsi",
  /* « (马) » dans un nom malaisien est « (M) », Malaysia, comme le côté anglais l'abrège */
  "(马)": "(m)", "(馬)": "(m)", "（马）": "(m)", "（馬）": "(m)", "马来西亚": "malaysia", "馬來西亞": "malaysia", "新加坡": "singapore",
  /* les lieux que l'usage n'écrit pas en pinyin */ "台中": "taichung", "臺中": "taichung", "台北": "taipei", "臺北": "taipei",
  "高雄": "kaohsiung", "新竹": "hsinchu", "基隆": "keelung", "香港": "hongkong", "澳门": "macau", "澳門": "macau",
  "九龙": "kowloon", "九龍": "kowloon", "中国": "china", "中國": "china",
}));

/** Les formes japonaises, et le mot « société » (会社) que le chinois n'emploie pas pour les
 *  siennes : un nom qui les porte est japonais (ou coréen écrit en caractères), pas chinois. */
const FORMES_JAPONAISES = /株式会社|有限会社|合同会社|合資会社|合名会社|会社/u;

/** Un nom japonais : des kana, ou une forme japonaise. Ses kanji ne se lisent pas ici. */
export function estJaponais(nom: string): boolean {
  return /[\u3040-\u30ff]/u.test(nom) || FORMES_JAPONAISES.test(nom);
}

/** Les clés d'une table, de la plus longue à la plus courte, en une seule alternative. */
function alternative(table: ReadonlyMap<string, string>): RegExp {
  const cles = [...table.keys()].sort((a, b) => b.length - a.length).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(cles.join("|"), "gu");
}

/* ─────────────────────────── le hangul ─────────────────────────── */

/* Romanisation révisée du coréen (2000) : initiales, médianes, finales du bloc U+AC00, dans
   l'ordre du standard (une syllabe = ((initiale × 21) + médiane) × 28 + finale). */
const INITIALES = ["g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s", "ss", "", "j", "jj", "ch", "k", "t", "p", "h"];
const MEDIANES = ["a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i"];
/** la finale devant une consonne ou en fin de mot : une occlusive s'écrit k, t, p */
const FINALES = ["", "k", "k", "k", "n", "n", "n", "t", "l", "k", "m", "l", "l", "l", "p", "l", "m", "p", "p", "t", "t", "ng", "t", "t", "k", "t", "p", "t"];
/** la même finale devant une voyelle (la syllabe suivante commence par ㅇ muet) : elle se
 *  prononce, et s'écrit, comme une initiale (« 물어 » : mureo, pas muteo) */
const FINALES_LIEES = ["", "g", "kk", "ks", "n", "nj", "nh", "d", "r", "lg", "lm", "lb", "ls", "lt", "lp", "lh", "m", "b", "bs", "s", "ss", "ng", "j", "ch", "k", "t", "p", "h"];
const INITIALE_MUETTE = 11, INITIALE_R = 5, FINALE_L = 8, FINALE_N = 4;

/** Une suite de syllabes hangul, en romanisation révisée, sans espace. */
export function hangulEnLatin(syllabes: string): string {
  const codes = [...syllabes].map((c) => c.codePointAt(0)! - 0xac00);
  let sortie = "";
  for (let k = 0; k < codes.length; k++) {
    const i = codes[k]!;
    const L = Math.floor(i / 588), V = Math.floor((i % 588) / 28), T = i % 28;
    const suivant = codes[k + 1];
    const Lsuivant = suivant === undefined ? -1 : Math.floor(suivant / 588);
    const Tprecedent = k === 0 ? 0 : codes[k - 1]! % 28;
    /* ㄹ après une finale ㄹ ou ㄴ s'écrit l (« 물류 » : mullyu, « 신라 » : silla) */
    const initiale = L === INITIALE_R && (Tprecedent === FINALE_L || Tprecedent === FINALE_N) ? "l" : INITIALES[L]!;
    const finale = Lsuivant === INITIALE_MUETTE ? FINALES_LIEES[T]! : Lsuivant === INITIALE_R && T === FINALE_N ? "l" : FINALES[T]!;
    sortie += initiale + MEDIANES[V]! + finale;
  }
  return sortie;
}

const CLES_HANGUL = alternative(GENERIQUES_HANGUL);
function hangul(nom: string): string {
  return nom.replace(CLES_HANGUL, (m) => ` ${GENERIQUES_HANGUL.get(m) ?? m} `).replace(/[\uac00-\ud7a3]+/gu, hangulEnLatin);
}

/* ─────────────────────────── les sinogrammes ─────────────────────────── */

/**
 * LA TABLE DU PINYIN : une lecture par caractère des sinogrammes unifiés (U+4E00 à U+9FFF,
 * 20 992 codes), sans ton, la ligne i portant la lecture de U+4E00 + i (vide quand le
 * caractère n'en a pas).
 *
 * Provenance : la transformation Han-Latin d'ICU 78.3 (données Unicode 17.0), dérivée du champ
 * kMandarin de la base Unihan, produite sur cette machine par
 *   uconv -x Han-Latin  (un caractère par ligne), puis NFD, marques retirées, minuscules.
 * Les données ICU et Unihan sont sous la licence Unicode (UNICODE LICENSE V3), qui permet la
 * redistribution avec mention : « Copyright © 1991-2025 Unicode, Inc. Unicode and the Unicode
 * Logo are registered trademarks of Unicode, Inc. in the United States and other countries. »
 * L'empreinte du fichier est vérifiée par la suite.
 */
export const CHEMIN_PINYIN = new URL("./pinyin.txt", import.meta.url);
const PINYIN: readonly string[] = readFileSync(CHEMIN_PINYIN, "utf8").split("\n");

/** La lecture pinyin d'un caractère, ou lui-même s'il n'en a pas (il traverse inchangé). */
export function pinyinDe(caractere: string): string {
  const cp = caractere.codePointAt(0)!;
  return (cp >= 0x4e00 && cp <= 0x9fff ? PINYIN[cp - 0x4e00] : "") || caractere;
}

/**
 * LA TABLE DU JYUTPING : la lecture cantonaise des mêmes 20 992 codes, sans ton, dans la même
 * disposition que `pinyin.txt` (ligne i : U+4E00 + i, vide quand le champ manque : 169 codes).
 *
 * Provenance : le champ kCantonese de la base Unihan, Unicode 18.0.0 (Unihan_Readings.txt dans
 * Unihan.zip, unicode.org/Public/UCD/latest/ucd/, sha256 4c93ea9c…d43e), produit sur cette
 * machine le 27/09/2026 par un script de quinze lignes : pour chaque ligne « U+XXXX kCantonese
 * lecture » dont le code est dans le bloc unifié, la lecture sans son chiffre de ton ; aucun
 * code n'y porte deux lectures (compté : zéro valeur à espace). Les données Unihan sont sous la
 * licence Unicode (UNICODE LICENSE V3), même mention que le pinyin. L'empreinte du fichier est
 * vérifiée par la suite.
 */
export const CHEMIN_JYUTPING = new URL("./jyutping.txt", import.meta.url);
const JYUTPING: readonly string[] = readFileSync(CHEMIN_JYUTPING, "utf8").split("\n");

/** La lecture jyutping d'un caractère, sans ton, ou vide s'il n'en a pas. */
export function jyutpingDe(caractere: string): string {
  const cp = caractere.codePointAt(0)!;
  return (cp >= 0x4e00 && cp <= 0x9fff ? JYUTPING[cp - 0x4e00] : "") || "";
}

/**
 * Une syllabe jyutping dans la GRAPHIE DU GOUVERNEMENT DE HONG KONG, celle des registres et des
 * enseignes : les initiales non aspirées s'écrivent p, t, k (bou : Po ; dak : Tak ; gam : Kam),
 * z et c s'écrivent ch (zoeng : Cheung), j s'écrit y (jan : Yan), aa s'écrit a (maan : Man),
 * oe s'écrit eu (zoeng : Cheung), eo s'écrit u (seon : Sun), yu s'écrit u, et uen, uet devant n
 * et t (zyu : Chu ; lyun : Luen ; syut : Suet), ou s'écrit o (bou : Po). Ce que cette graphie
 * laisse libre (sh ou s, ts ou ch, ue ou u, ee ou ei) se replie au score, dans `pliCantonais`
 * (entites.ts).
 */
export function hongkong(syllabe: string): string {
  return syllabe.replace(/^gw/, "kw").replace(/^[zc]/, "ch").replace(/^j/, "y").replace(/^g/, "k").replace(/^b/, "p").replace(/^d/, "t")
    .replace(/aa/, "a").replace(/oe/, "eu").replace(/eo/, "u").replace(/(?<=[a-z])yun$/, "uen").replace(/(?<=[a-z])yut$/, "uet")
    .replace(/(?<=[a-z])yu/, "u").replace(/ou$/, "o");
}

const CLES_HANZI = alternative(GENERIQUES_HANZI);
const SINOGRAMMES = /[\u4e00-\u9fff]+/gu;
function hanzi(nom: string, natifs: Map<string, string>, lecture: Lecture): string {
  const generiques = nom.replace(CLES_HANZI, (m) => ` ${GENERIQUES_HANZI.get(m) ?? m} `);
  /* le nom propre en mandarin : ses caractères se lisent d'une traite (« 沧澜 » : canglan), et le
     jeton garde ses caractères pour que le score distingue les homophones */
  const mandarin = (suite: string) => {
    const l = [...suite].map(pinyinDe).join("");
    if (/^[a-z]+$/.test(l)) natifs.set(l, suite);
    return ` ${l} `;
  };
  if (lecture === "mandarin") return generiques.replace(SINOGRAMMES, mandarin);
  /* en cantonais : syllabe par syllabe, comme Hong Kong écrit ses noms (« 永成 » : wing sing),
     chaque syllabe gardant son caractère ; un caractère sans lecture cantonaise (169 codes du
     bloc) garde sa lecture mandarine plutôt que de traverser en sinogramme, cette lecture
     n'étant qu'une seconde chance. Ce qui est entre parenthèses est un lieu (深圳), que Hong
     Kong même nomme en mandarin : il se lit comme dans l'autre lecture. */
  const cantonais = (suite: string) => [...suite].map((c) => {
    const j = jyutpingDe(c);
    const l = j === "" ? pinyinDe(c) : hongkong(j);
    if (/^[a-z]+$/.test(l)) natifs.set(l, c);
    return ` ${l} `;
  }).join("");
  return generiques.replace(/\([^()]*\)/gu, (p) => p.replace(SINOGRAMMES, mandarin)).replace(SINOGRAMMES, cantonais);
}

/* ─────────────────────────── le thaï ─────────────────────────── */

/**
 * LE THAÏ, en romanisation générale royale (RTGS, celle des registres et des routes), sans
 * les tons. Un alphabet où la voyelle s'écrit avant, après, au-dessus ou au-dessous de la
 * consonne, ou pas du tout (la voyelle implicite : o dans une syllabe fermée, a devant une
 * syllabe écrite), où un ์ (thanthakhat) éteint la consonne qu'il coiffe, et où les mots
 * d'un nom se collent (« น้ำตาลรุ่งโรจน์ » : sucre + Rungrot). Le côté latin écrit les voyelles
 * comme il l'entend (Chokdee, Chokdi ; Charoen, Jaroen) et les aspirées avec ou sans h
 * (Kenanga, Khenangka) : un mot thaï se compare sur ses consonnes, comme un mot venu d'un
 * abjad (`cleAbjad`, mode « thai »), et la lecture sert au bloc et à la distance écrite.
 * Une suite de consonnes nues a parfois deux lectures (« ราชบุรี » se lit rat-cha-bu-ri, la
 * finale redoublée en initiale) : aucune règle ne les départage, la clé consonantique les
 * absorbe.
 */

/** Les consonnes : valeur en tête de syllabe, valeur en finale (RTGS). En finale, ส ซ ศ ษ
 *  gardent s et ล ฬ gardent l, contre la norme (t, n) : les noms thaïs de sociétés sont pleins
 *  de mots anglais écrits en thaï (เคสเตรล kestrel, สตีล steel, โฮเทล hotel), que le côté latin
 *  écrit en anglais (mesuré le 27/09 à poids uniformes : « อันดามัน เคสเตรล » lu khettren tombait
 *  à 0,563 face à « MV ANDAMAN KESTREL », 0,950 lu khestrel ; les six autres paires thaïes
 *  ne bougeaient pas). La voyelle implicite, elle, ne change aucun score des sept paires,
 *  émise ou non : la clé consonantique l'absorbe, et la lecture RTGS reste lisible. */
const THAI_CONSONNES: ReadonlyMap<string, readonly [string, string]> = new Map(Object.entries({
  "ก": ["k", "k"], "ข": ["kh", "k"], "ฃ": ["kh", "k"], "ค": ["kh", "k"], "ฅ": ["kh", "k"], "ฆ": ["kh", "k"], "ง": ["ng", "ng"],
  "จ": ["ch", "t"], "ฉ": ["ch", "t"], "ช": ["ch", "t"], "ซ": ["s", "s"], "ฌ": ["ch", "t"], "ญ": ["y", "n"], "ฎ": ["d", "t"],
  "ฏ": ["t", "t"], "ฐ": ["th", "t"], "ฑ": ["th", "t"], "ฒ": ["th", "t"], "ณ": ["n", "n"], "ด": ["d", "t"], "ต": ["t", "t"],
  "ถ": ["th", "t"], "ท": ["th", "t"], "ธ": ["th", "t"], "น": ["n", "n"], "บ": ["b", "p"], "ป": ["p", "p"], "ผ": ["ph", "p"],
  "ฝ": ["f", "p"], "พ": ["ph", "p"], "ฟ": ["f", "p"], "ภ": ["ph", "p"], "ม": ["m", "m"], "ย": ["y", "i"], "ร": ["r", "n"],
  "ฤ": ["ru", ""], "ล": ["l", "l"], "ฦ": ["lu", ""], "ว": ["w", "o"], "ศ": ["s", "s"], "ษ": ["s", "s"], "ส": ["s", "s"],
  "ห": ["h", ""], "ฬ": ["l", "l"], "อ": ["", "o"], "ฮ": ["h", ""],
} as Record<string, readonly [string, string]>));
/** Les groupes de consonnes lus d'un souffle (กร, ปล, คว), ceux des mots anglais (ฟร, บล, ดร),
 *  et ทร, สร, lus s dans les mots thaïs (ทรัพย์ sap, สร้าง sang) ; ศร reste sr (ศรี, « Sri »). */
const THAI_GROUPES: ReadonlyMap<string, string> = new Map(Object.entries({
  "กร": "kr", "กล": "kl", "กว": "kw", "ขร": "khr", "ขล": "khl", "ขว": "khw", "คร": "khr", "คล": "khl", "คว": "khw",
  "ตร": "tr", "ปร": "pr", "ปล": "pl", "ผล": "phl", "พร": "phr", "พล": "phl", "ฟร": "fr", "ฟล": "fl", "บร": "br", "บล": "bl",
  "ดร": "dr", "ทร": "s", "สร": "s", "ศร": "sr",
}));
/** Les sonantes devant lesquelles un ห muet change le ton (หน, หม, หล, หว, หย, หง, หร, หญ). */
const THAI_SONANTES: ReadonlySet<string> = new Set(["ง", "ญ", "น", "ม", "ย", "ร", "ล", "ว"]);
/** Les consonnes qui ne ferment jamais une syllabe (ฉ ฌ ผ ฝ ห ฮ) : nues, elles en ouvrent une. */
const THAI_JAMAIS_FINALES: ReadonlySet<string> = new Set(["ฉ", "ฌ", "ผ", "ฝ", "ห", "ฮ"]);
/** Les voyelles écrites DEVANT la consonne : เ แ โ ใ ไ. */
const THAI_PREPOSEES: ReadonlySet<string> = new Set(["เ", "แ", "โ", "ใ", "ไ"]);
/** Les signes écrits après, au-dessus ou au-dessous de la consonne, codés d'une lettre : ะ a,
 *  า A, ั n (elle appelle une finale), ำ m, ิ i, ี I, ึ v, ื V, ุ u, ู U, ็ x (bref), ํ m (avec
 *  son า), ๅ rien. */
const THAI_SIGNES: ReadonlyMap<string, string> = new Map([
  ["ะ", "a"], ["า", "A"], ["ั", "n"], ["ำ", "m"], ["ิ", "i"], ["ี", "I"], ["ึ", "v"],
  ["ื", "V"], ["ุ", "u"], ["ู", "U"], ["็", "x"], ["ํ", "m"], ["ๅ", ""],
]);

/** Une consonne thaïe et ce qui l'habille : la voyelle écrite devant, les signes écrits après
 *  (codés), un ton, un ์ qui l'éteint. Les tons tombent, ๆ et ฯ aussi. */
type UniteThai = { c: string; pre: string; signes: string; ton: boolean; morte: boolean };

function unitesThai(mot: string): UniteThai[] {
  const u: UniteThai[] = [];
  let pre = "";
  for (const c of mot) {
    if (THAI_PREPOSEES.has(c)) { pre = c; continue; }
    if (THAI_CONSONNES.has(c)) { u.push({ c, pre, signes: "", ton: false, morte: false }); pre = ""; continue; }
    const d = u[u.length - 1];
    if (!d) continue;
    const code = THAI_SIGNES.get(c);
    if (code !== undefined) { if (!(code === "A" && d.signes.endsWith("m"))) d.signes += code; }
    else if (c >= "่" && c <= "๋") d.ton = true;
    else if (c === "์") d.morte = true;
  }
  return u;
}

/** Un mot thaï, syllabe par syllabe, en RTGS sans les tons. */
export function thaiEnLatin(mot: string): string {
  const u = unitesThai(mot);
  const n = u.length;
  /* une consonne NUE : ni voyelle devant, ni signe, ni ton, ni ์ ; elle seule peut être une finale */
  const nue = (k: number) => k < n && u[k]!.pre === "" && u[k]!.signes === "" && !u[k]!.ton && !u[k]!.morte;
  /* une consonne nue qui PEUT fermer la syllabe précédente */
  const fermante = (k: number) => nue(k) && !THAI_JAMAIS_FINALES.has(u[k]!.c);
  let s = "";
  let i = 0;
  let finaleLue = false;
  while (i < n) {
    let t = u[i]!;
    if (t.morte) { i++; continue; }
    /* une consonne nue devant une consonne éteinte l'est aussi (จันทร์ chan, ศาสตร์ sat), et un ร
       nu qui reste en fin de mot après une finale déjà lue (เพชร phet, สมัคร samak) */
    if (i > 0 && nue(i) && finaleLue && ((i + 1 < n && u[i + 1]!.morte) || (i === n - 1 && t.c === "ร"))) { i++; continue; }
    const pre = t.pre;
    finaleLue = false;
    /* ห muet devant une sonante : la consonne qui suit porte la syllabe et la voyelle écrite devant */
    if (t.c === "ห" && t.signes === "" && !t.ton && i + 1 < n && THAI_SONANTES.has(u[i + 1]!.c) && u[i + 1]!.pre === "" && !u[i + 1]!.morte) {
      i++; t = u[i]!;
    }
    let init = THAI_CONSONNES.get(t.c)![0];
    let voy = "", fin = "";
    let finale = true;
    /* ว entre deux consonnes nues est la voyelle ua (สวน suan, ควร khuan) */
    if (pre === "" && t.signes === "" && !t.ton && i + 2 < n && u[i + 1]!.c === "ว" && nue(i + 1) && fermante(i + 2)) {
      s += init + "ua" + THAI_CONSONNES.get(u[i + 2]!.c)![1]; i += 3; finaleLue = true; continue;
    }
    /* la seconde consonne d'un faux groupe porte un signe qui ne se lit qu'avec la voyelle écrite
       devant (เ-ิ, เ-็, เ-า, เ-ะ, เ-ีย, เ-ือ ; แ-็, แ-ะ ; โ-ะ), ou elle est nue devant une finale qui
       clôt le mot ou la syllabe (แสดง sadaeng, เกษม kasem), sauf ร (เพชร phet) */
    const liee = (k: number) => {
      const sg = u[k]!.signes;
      if (pre === "เ") return sg.includes("i") || sg.includes("x") || sg.includes("A") || sg.includes("a")
        || (sg.includes("I") && nue(k + 1) && u[k + 1]!.c === "ย") || (sg.includes("V") && nue(k + 1) && u[k + 1]!.c === "อ");
      if (pre === "แ" || pre === "โ") return sg.includes("x") || sg.includes("a");
      return false;
    };
    /* le mot finit là : plus rien, ou une consonne éteinte, ou un ร nu qui restera muet (เกษตร kaset) */
    const finDeMot = (k: number) => k >= n || u[k]!.morte || (k === n - 1 && nue(k) && u[k]!.c === "ร");
    /* un groupe (กร, ปล, ฟร) : avec une voyelle devant (la seconde nue, ou liée à cette voyelle :
       เสริม soem, mais เสรี seri), un signe ou un ton sur la seconde, ou une finale derrière ; sinon
       la seconde est la finale (นคร nakhon) ; jamais devant รร (กรรม kam) */
    if (t.signes === "" && !t.ton && i + 1 < n && u[i + 1]!.pre === "" && !u[i + 1]!.morte && THAI_GROUPES.has(t.c + u[i + 1]!.c)
      && (pre !== "" ? nue(i + 1) || liee(i + 1) : u[i + 1]!.signes !== "" || u[i + 1]!.ton || (i + 2 < n && !u[i + 2]!.morte))
      && !(u[i + 1]!.c === "ร" && nue(i + 2) && u[i + 2]!.c === "ร")) {
      init = THAI_GROUPES.get(t.c + u[i + 1]!.c)!; i++; t = u[i]!;
    } else if (pre !== "" && t.signes === "" && !t.ton && i + 1 < n && u[i + 1]!.pre === "" && !u[i + 1]!.morte
      && (liee(i + 1) || (nue(i + 1) && fermante(i + 2) && u[i + 2]!.c !== "ร" && finDeMot(i + 3)))) {
      /* un faux groupe sous une voyelle écrite devant (เจริญ charoen, เฉลิม chaloem) : la première
         consonne prend un a, la voyelle passe à la seconde */
      s += init + "a"; i++; t = u[i]!; init = THAI_CONSONNES.get(t.c)![0];
    }
    const sg = t.signes;
    const suivante = (c: string) => nue(i + 1) && u[i + 1]!.c === c;
    if (pre === "เ") {
      /* เ : เ-าะ o, เ-า ao, เ-ะ e, เ-ีย ia, เ-ือ uea, เ-ิ oe, เ-็ e, เ-อ oe, เ-ย oei, เ-ว eo, เ- e */
      if (sg.includes("A") && sg.includes("a")) { voy = "o"; finale = false; }
      else if (sg.includes("A")) { voy = "ao"; finale = false; }
      else if (sg.includes("a")) { voy = "e"; finale = false; }
      else if (sg.includes("I") && suivante("ย")) { voy = "ia"; i++; }
      else if (sg.includes("V") && suivante("อ")) { voy = "uea"; i++; }
      else if (sg.includes("i")) voy = "oe";
      else if (sg.includes("x")) voy = "e";
      else if (sg === "" && suivante("อ")) { voy = "oe"; i++; finale = false; }
      else if (sg === "" && suivante("ย")) { voy = "oei"; i++; finale = false; }
      else if (sg === "" && suivante("ว")) { voy = "eo"; i++; finale = false; }
      else voy = "e";
    } else if (pre === "แ") {
      /* แ : แ-ะ ae, แ-ว aeo, แ- ae */
      if (sg.includes("a")) { voy = "ae"; finale = false; }
      else if (sg === "" && suivante("ว")) { voy = "aeo"; i++; finale = false; }
      else voy = "ae";
    } else if (pre === "โ") {
      /* โ : o, ouvert avec ะ */
      voy = "o"; if (sg.includes("a")) finale = false;
    } else if (pre !== "") {
      /* ใ ไ : ai, avec ou sans ย (ไทย thai) */
      voy = "ai"; finale = false; if (suivante("ย")) i++;
    } else if (sg.includes("m")) { voy = "am"; finale = false; }
    else if (sg.includes("a")) { voy = "a"; finale = false; }
    else if (sg.includes("n")) { if (suivante("ว")) { voy = "ua"; i++; finale = false; } else voy = "a"; }
    else if (sg.includes("A")) voy = "a";
    else if (sg.includes("i") || sg.includes("I")) voy = "i";
    else if (sg.includes("v")) voy = "ue";
    else if (sg.includes("V")) { voy = "ue"; if (suivante("อ")) { i++; finale = false; } }
    else if (sg.includes("u") || sg.includes("U")) voy = "u";
    else if (sg.includes("x")) voy = "o";
    else if (t.c === "ฤ" || t.c === "ฦ") voy = "";
    else if (suivante("อ")) { voy = "o"; i++; }
    else if (suivante("ร") && nue(i + 2) && u[i + 2]!.c === "ร") {
      /* รร : a devant une finale (กรรม kam), an sinon (สรร san, บรรทุก banthuk) */
      i += 2; if (fermante(i + 1)) voy = "a"; else { voy = "an"; finale = false; }
    } else {
      /* la voyelle implicite : a devant une syllabe écrite (สยาม sayam), o dans une syllabe
         fermée (คน khon, ขนส่ง khonsong), a puis o sur trois consonnes nues (ถนน thanon) */
      let k = 0;
      while (fermante(i + 1 + k)) k++;
      /* la consonne qui suit ouvre elle-même une syllabe (อุตสาหกรรม utsahakam, สวน dans un mot) :
         la nôtre reste ouverte */
      if (k >= 1 && nue(i + 2) && ((nue(i + 3) && u[i + 2]!.c === "ร" && u[i + 3]!.c === "ร") || (u[i + 2]!.c === "ว" && fermante(i + 3)))) k = 0;
      if (k === 0 || k === 2) { voy = "a"; finale = false; } else voy = "o";
    }
    if (finale && fermante(i + 1)) { i++; fin = THAI_CONSONNES.get(u[i]!.c)![1]; finaleLue = true; }
    s += init + voy + fin;
    i++;
  }
  return s;
}

/** Thaï : les formes (บริษัท … จำกัด, มหาชน, หจก.), le préfixe de navire, le vocabulaire du
 *  commerce, et les mots anglais écrits en thaï (กรุ๊ป, โฟรเซ่น, แพ็คเกจจิ้ง), collés au nom propre
 *  comme en hangul. « ไทย » et « สยาม » : l'usage latin (Thai, Siam) n'est pas la lecture. */
const GENERIQUES_THAI: ReadonlyMap<string, string> = new Map(Object.entries({
  /* les formes */ "บริษัท": "borisat", "บจก": "borisat", "จำกัด": "jamkat", "มหาชน": "pcl", "บมจ": "borisat pcl",
  "ห้างหุ้นส่วนจำกัด": "lp", "หจก": "lp", "ห้างหุ้นส่วนสามัญ": "partnership", "สหกรณ์": "cooperative", "และ": "", "แอนด์": "",
  /* les navires */ "เรือลำเลียง": "barge", "เรือลากจูง": "tug", "เรือบรรทุก": "mv", "เรือประมง": "fv",
  /* le commerce, en thaï */ "การค้า": "trading", "ค้าขาย": "trading", "การพาณิชย์": "commerce", "พาณิชย์": "commercial",
  "อุตสาหกรรม": "industry", "การขนส่ง": "transport", "ขนส่ง": "transport", "โลจิสติกส์": "logistics", "การเดินเรือ": "navigation",
  "เดินเรือ": "shipping", "อาหารทะเล": "seafood", "อาหาร": "food", "น้ำตาล": "sugar", "น้ำมัน": "oil", "เหล็ก": "steel", "เคมี": "chemical",
  "พลังงาน": "energy", "การก่อสร้าง": "construction", "ก่อสร้าง": "construction", "วิศวกรรม": "engineering", "การพัฒนา": "development",
  "พัฒนา": "development", "ผลิตภัณฑ์": "products", "เครื่องจักร": "machinery", "การลงทุน": "investment", "บริการ": "services",
  "สิ่งทอ": "textile", "ยานยนต์": "automotive", "ประมง": "fishing", "ปิโตรเลียม": "petroleum", "ปิโตรเคมี": "petrochemical",
  "พลาสติก": "plastic", "กระดาษ": "paper", "กลุ่ม": "group", "นานาชาติ": "international", "สากล": "international",
  "ระหว่างประเทศ": "international", "ธุรกิจ": "business", "ประเทศไทย": "thailand", "ไทยแลนด์": "thailand", "ไทย": "thai",
  "สยาม": "siam", "กรุงเทพมหานคร": "bangkok", "กรุงเทพฯ": "bangkok", "กรุงเทพ": "bangkok",
  /* les mots anglais écrits en thaï */ "กรุ๊ป": "group", "อินเตอร์เนชั่นแนล": "international", "อินเตอร์": "inter",
  "เอ็นจิเนียริ่ง": "engineering", "เทรดดิ้ง": "trading", "โฮลดิ้งส์": "holdings", "โฮลดิ้ง": "holding", "มาร์เก็ตติ้ง": "marketing",
  "เซอร์วิสเซส": "services", "เซอร์วิส": "service", "ซัพพลาย": "supply", "ซีฟู้ด": "seafood", "ฟู้ดส์": "foods", "ฟู้ด": "food",
  "โฟรเซ่น": "frozen", "แพ็คเกจจิ้ง": "packaging", "แพคเกจจิ้ง": "packaging", "แปซิฟิก": "pacific", "สตีล": "steel", "เคมีคอล": "chemical",
  "เทคโนโลยี": "technology", "คอนสตรัคชั่น": "construction", "ดีเวลลอปเม้นท์": "development", "ชิปปิ้ง": "shipping", "มารีน": "marine",
  "เอ็กซ์ปอร์ต": "export", "อิมปอร์ต": "import", "เอ็นเตอร์ไพรส์": "enterprise", "คอร์ปอเรชั่น": "corporation", "อินดัสทรี": "industry",
  "อินดัสเตรียล": "industrial", "โปรดักส์": "products", "แมชชีนเนอรี่": "machinery", "เท็กซ์ไทล์": "textile",
}));

const CLES_THAI = alternative(GENERIQUES_THAI);
function thai(nom: string): string {
  return nom.replace(/[๐-๙]/gu, (c) => String(c.codePointAt(0)! - 0x0e50))
    /* « เรือ » seul en tête, suivi d'une espace, est le préfixe de navire ; dans un mot c'est une
       syllabe (เรือน ruean), et il n'est pas dans la table */
    .replace(/^\s*เรือ(?=\s)/u, " mv ")
    .replace(CLES_THAI, (m) => ` ${GENERIQUES_THAI.get(m) ?? m} `)
    .replace(/[฀-๿]+/gu, thaiEnLatin);
}

/* ─────────────────────────── le tamoul ─────────────────────────── */

/**
 * LE TAMOUL, un abugida : chaque consonne porte un a, qu'un signe remplace (கா ka, கி ki) et
 * que le ் (virama) éteint (க் k). La sonorité ne s'écrit pas (க : k ou g, ட : t ou d, ப : p ou
 * b) : la lecture rend la sourde, que le squelette replie déjà (g : k, d : t, b : p). Les
 * longues s'écrivent comme l'usage latin (ீ ee, ூ oo : Meenakshi, Annapoorani), et le
 * sanskrit du tamoul (kṣ écrit ட்ச : லட்சுமி Lakshmi, மீனாட்சி Meenakshi) se replie au crédit,
 * dans `pliTamoul` (entites.ts). Les mots anglais écrits en tamoul (டெக்ஸ்டைல்ஸ், டிரேடர்ஸ்) et
 * les mots du commerce se traduisent avant ; les mots d'un nom tamoul sont séparés d'espaces.
 */
const GENERIQUES_TAMOUL: ReadonlyMap<string, string> = new Map(Object.entries({
  /* les formes */ "பிரைவேட் லிமிடெட்": "private limited", "பப்ளிக் லிமிடெட்": "public limited", "பிரைவேட்": "pvt", "லிமிடெட்": "limited",
  "லிமிடட்": "limited", "நிறுவனம்": "company", "கம்பெனி": "company", "கார்ப்பரேஷன்": "corporation", "அண்ட்": "", "மற்றும்": "",
  /* le commerce, en tamoul */ "வர்த்தகம்": "trading", "வியாபாரம்": "trading", "வியாபாரிகள்": "merchants", "வியாபாரி": "merchant",
  "வணிகம்": "trading", "வணிகர்கள்": "merchants", "தொழிற்சாலை": "works", "தொழில்": "industry", "ஏற்றுமதி": "export",
  "ஏற்றுமதியாளர்கள்": "exporters", "இறக்குமதி": "import", "போக்குவரத்து": "transport", "கப்பல்": "shipping", "அரிசி": "rice",
  "ஜவுளி": "textiles", "ஜவுளிகள்": "textiles", "மில்": "mill", "மில்ஸ்": "mills", "மகன்கள்": "sons", "சகோதரர்கள்": "brothers",
  "சர்வதேச": "international", "இந்தியா": "india", "தமிழ்நாடு": "tamilnadu",
  /* les mots anglais écrits en tamoul */ "டெக்ஸ்டைல்ஸ்": "textiles", "டெக்ஸ்டைல்": "textile", "டிரேடர்ஸ்": "traders",
  "டிரேடிங்": "trading", "எக்ஸ்போர்ட்ஸ்": "exports", "எக்ஸ்போர்ட்": "export", "இம்போர்ட்ஸ்": "imports", "க்ரூப்": "group",
  "குரூப்": "group", "ஓரியண்ட்": "orient", "காயர்": "coir", "ஹோல்டிங்ஸ்": "holdings", "இண்டஸ்ட்ரீஸ்": "industries",
  "இண்டஸ்ட்ரி": "industry", "இன்டர்நேஷனல்": "international", "லாஜிஸ்டிக்ஸ்": "logistics", "சர்வீசஸ்": "services",
  "என்டர்பிரைசஸ்": "enterprises", "ஸ்பின்னிங்": "spinning", "ஸ்டீல்": "steel", "மெரைன்": "marine", "ஷிப்பிங்": "shipping",
  "சன்ஸ்": "sons", "பிரதர்ஸ்": "brothers", "எஞ்சினியரிங்": "engineering", "கன்ஸ்ட்ரக்ஷன்": "construction",
  "மெர்ச்சன்ட்ஸ்": "merchants", "ஏஜென்சீஸ்": "agencies", "ஃபுட்ஸ்": "foods", "ஃபுட்": "food",
}).map(([k, v]) => [k.normalize("NFC"), v] as const));
const TAMOUL_CONSONNES: ReadonlyMap<string, string> = new Map(Object.entries({
  "க": "k", "ங": "ng", "ச": "s", "ஜ": "j", "ஞ": "ny", "ட": "t", "ண": "n", "த": "th", "ந": "n", "ன": "n", "ப": "p",
  "ம": "m", "ய": "y", "ர": "r", "ற": "r", "ல": "l", "ள": "l", "ழ": "zh", "வ": "v", "ஶ": "sh", "ஷ": "sh", "ஸ": "s", "ஹ": "h",
}));
const TAMOUL_VOYELLES: ReadonlyMap<string, string> = new Map(Object.entries({
  "அ": "a", "ஆ": "a", "இ": "i", "ஈ": "ee", "உ": "u", "ஊ": "oo", "எ": "e", "ஏ": "e", "ஐ": "ai", "ஒ": "o", "ஓ": "o", "ஔ": "au",
}));
/** Les signes de voyelle (ா ி ீ ு ூ ெ ே ை ொ ோ ௌ) ; les composés ொ ோ ௌ tiennent en un code après NFC. */
const TAMOUL_SIGNES: ReadonlyMap<string, string> = new Map([
  ["ா", "a"], ["ி", "i"], ["ீ", "ee"], ["ு", "u"], ["ூ", "oo"], ["ெ", "e"], ["ே", "e"],
  ["ை", "ai"], ["ொ", "o"], ["ோ", "o"], ["ௌ", "au"],
]);
const VIRAMA = "்", AYTHAM = "ஃ";

/** Un mot tamoul, consonne par consonne, avec la voyelle que chacune porte. */
export function tamoulEnLatin(mot: string): string {
  const l = [...mot.normalize("NFC")];
  let s = "";
  let f = false;
  for (let i = 0; i < l.length; i++) {
    const c = l[i]!;
    const v = TAMOUL_VOYELLES.get(c);
    if (v !== undefined) { s += v; continue; }
    /* ஃ devant ப fait un f (ஃபுட் food) ; seul, il tombe */
    if (c === AYTHAM) { f = l[i + 1] === "ப"; continue; }
    const k = TAMOUL_CONSONNES.get(c);
    if (k === undefined) continue;
    /* ச se lit s, et ch après une consonne éteinte (ட்ச, ஞ்ச : Meenatchi, Kanchi) ; ஞ éteint est n */
    s += f ? "f" : c === "ச" && l[i - 1] === VIRAMA ? "ch" : c === "ஞ" && l[i + 1] === VIRAMA ? "n" : k;
    f = false;
    const suite = l[i + 1] ?? "";
    if (suite === VIRAMA) i++;
    else if (TAMOUL_SIGNES.has(suite)) { s += TAMOUL_SIGNES.get(suite)!; i++; }
    else s += "a";
  }
  return s;
}

const CLES_TAMOUL = alternative(GENERIQUES_TAMOUL);
function tamoul(nom: string): string {
  return nom.normalize("NFC").replace(/[௦-௯]/gu, (c) => String(c.codePointAt(0)! - 0x0be6))
    .replace(new RegExp(`(?<![\\u0b80-\\u0bff])(?:${CLES_TAMOUL.source})(?![\\u0b80-\\u0bff])`, "gu"), (m) => ` ${GENERIQUES_TAMOUL.get(m) ?? m} `)
    .replace(/[஀-௿]+/gu, tamoulEnLatin);
}

/* ─────────────────────────── les abjads ─────────────────────────── */

/** Arabe et persan : translittération consonantique (ALA-LC simplifiée, sans diacritiques
 *  latins), la hamza tombe. Le ʿayn se lit « a » : la romanisation l'écrit par une voyelle ou
 *  une apostrophe, jamais par une consonne (« سعيد » [name removed] ; « علي » Ali ; « سعد » Saad),
 *  et la clé consonantique (`cleAbjad`) retire ce « a » comme elle retire les voyelles (jeu 9,
 *  27/09 : lu vide, « سعيد » rendait « sid », que « Saeed » ne rencontrait pas : « مؤسسة سعيد بن حمد
 *  للتجارة » à 0,472 face à « Saeed Bin Hamad Trading Est. »). Les lettres persanes
 *  s'ajoutent (پ چ ژ گ) ; ک et ی persans sont unifiés à ك et ي avant la lecture. */
const ARABE: ReadonlyMap<string, string> = new Map(Object.entries({
  "ا": "a", "أ": "a", "إ": "a", "آ": "a", "ٱ": "a", "ء": "", "ؤ": "w", "ئ": "y", "ب": "b", "ت": "t", "ث": "th", "ج": "j",
  "ح": "h", "خ": "kh", "د": "d", "ذ": "dh", "ر": "r", "ز": "z", "س": "s", "ش": "sh", "ص": "s", "ض": "d", "ط": "t", "ظ": "z",
  "ع": "a", "غ": "gh", "ف": "f", "ق": "q", "ك": "k", "ل": "l", "م": "m", "ن": "n", "ه": "h", "ة": "a", "و": "w", "ي": "y",
  "ى": "a", "پ": "p", "چ": "ch", "ژ": "zh", "گ": "g", "ڤ": "v", "ھ": "h", "ە": "h", "ۀ": "h",
}));
/** Hébreu : consonnes seules, les finales avec leur forme ordinaire ; א et ע tombent. */
const HEBREU: ReadonlyMap<string, string> = new Map(Object.entries({
  "א": "", "ב": "b", "ג": "g", "ד": "d", "ה": "h", "ו": "v", "ז": "z", "ח": "ch", "ט": "t", "י": "y", "כ": "k", "ך": "k",
  "ל": "l", "מ": "m", "ם": "m", "נ": "n", "ן": "n", "ס": "s", "ע": "", "פ": "p", "ף": "p", "צ": "ts", "ץ": "ts", "ק": "k",
  "ר": "r", "ש": "sh", "ת": "t",
}));
/** Les chiffres arabes orientaux et persans, en chiffres : un numéro de navire reste un numéro. */
const CHIFFRES: ReadonlyMap<string, string> = new Map([..."٠١٢٣٤٥٦٧٨٩"].map((c, i) => [c, String(i)] as const)
  .concat([..."۰۱۲۳۴۵۶۷۸۹"].map((c, i) => [c, String(i)] as const)));

/** Persan unifié à l'arabe (ک, ی, ۀ), marques de voyelles brèves et tatwil retirés, guillemets
 *  hébreux (geresh, gershayim) retirés du dedans des mots, sigles pointés soudés (« ذ.م.م. »). */
function unifier(nom: string): string {
  return unifierLettres(nom).replace(/[\u064b-\u0652\u0670\u0640\u200c\u200d]/gu, (c) => (c === "\u200c" || c === "\u200d" ? " " : ""))
    .replace(/[۰-۹٠-٩]/gu, (c) => CHIFFRES.get(c) ?? c)
    .replace(/(?<=[\u0590-\u05ff])[׳״'"’](?=[\u0590-\u05ff])/gu, "")
    .replace(/(?<![\p{L}])[\u0600-\u06ff](?:\.\s?[\u0600-\u06ff](?![\p{L}]))+\.?/gu, (m) => m.replace(/[.\s]/g, ""));
}

/**
 * Un mot d'un abjad, lettre à lettre. Les lettres faibles و et ي (ו et י en hébreu) sont une
 * consonne en tête de mot ou doublées, une voyelle longue ailleurs (« نجوم » : nujum, « אורות » :
 * orot) ; en arabe, elles sont aussi une consonne à côté d'un alif ou devant l'autre lettre
 * faible, parce que deux voyelles longues ne se suivent pas (« روابي » rawabi, « کاوه » kaveh,
 * « سويدي » suwaidi ; jeu 9, 27/09 : lues voyelles, « ruabi » et « kauh » perdaient la consonne
 * que le côté latin écrit). Le ה final hébreu est une voyelle et tombe. Un « h » qui suivrait
 * une lettre avec laquelle il formerait un digramme (d + ه, k + ה) est séparé par un a (« dahb »,
 * jamais « dhb » qui se lirait ذ), pour que la lecture des consonnes ne se trompe pas de lettre.
 */
function motAbjad(mot: string, table: ReadonlyMap<string, string>, hebreu: boolean): string {
  const lettres = [...mot];
  let sortie = "";
  for (let i = 0; i < lettres.length; i++) {
    const c = lettres[i]!;
    let l = table.get(c);
    if (l === undefined) { sortie += c; continue; }
    const faible = hebreu ? (c === "ו" ? "o" : c === "י" ? "i" : "") : (c === "و" ? "u" : c === "ي" ? "i" : "");
    if (faible !== "") {
      const enTete = i === 0, doublee = lettres[i + 1] === c || lettres[i - 1] === c;
      const consonneArabe = !hebreu && (lettres[i + 1] === "ا" || lettres[i - 1] === "ا"
        || (c === "و" && lettres[i + 1] === "ي") || (c === "ي" && lettres[i + 1] === "و"));
      if (!enTete && !doublee && !consonneArabe) l = faible;
      else if (doublee && lettres[i - 1] === c) l = faible;
    }
    if (hebreu && c === "ה" && i === lettres.length - 1 && i > 0) l = "";
    if (l === "h" && /[tdkszgcp]$/.test(sortie)) l = "ah";
    sortie += l;
  }
  return sortie;
}

const CLES_ARABES = alternative(GENERIQUES_ARABES);

/**
 * Le mot générique qu'un mot arabe porte SOUS sa préposition et son article. « لتجارة »
 * (li-tijarat, « pour le commerce ») et « للتجارة » (lil-tijara, li + al) sont le mot تجارة ;
 * « المعادن » (al-ma'adin) est معادن. La table ne liste pas chaque mot sous chacun de ses
 * habits : le ل, le لل (qui vaut ل + ال, l'alif élidé) et le ال s'ôtent avant la lecture, et
 * seul un mot que la table connaît confirme la lecture. Un nom propre n'y passe pas : « ليوا »
 * (Liwa) et « لبنان » (Lubnan) commencent par un ل qui leur appartient, et ils restent entiers.
 * Jeu 9, 27/09 : « لتجارة » restait « ltjara », un mot rare sans répondant, dans quatre noms.
 */
function generiqueArabe(mot: string): string | undefined {
  const direct = GENERIQUES_ARABES.get(mot);
  if (direct !== undefined) return direct;
  const nus: string[] = [];
  if (mot.startsWith("لل")) nus.push("ال" + mot.slice(2), mot.slice(2));
  else if (mot.startsWith("ل")) nus.push(mot.slice(1));
  if (mot.startsWith("ال")) nus.push(mot.slice(2));
  for (const nu of nus) {
    if (nu.length < 2) continue;
    const g = GENERIQUES_ARABES.get(nu);
    if (g !== undefined) return g;
  }
  return undefined;
}

function arabe(nom: string): string {
  return unifier(nom)
    /* les clés de plusieurs mots d'abord (« حمل و نقل », « قطع الغيار ») : un mot seul les couperait */
    .replace(new RegExp(`(?<![\\p{L}])(?:${CLES_ARABES.source})(?![\\p{L}])`, "gu"), (m) => ` ${GENERIQUES_ARABES.get(m) ?? m} `)
    .replace(/[\u0600-\u06ff]+/gu, (mot) => {
      const generique = generiqueArabe(mot);
      if (generique !== undefined) return ` ${generique} `;
      /* l'article ال et le لل (« pour le ») en tête d'un mot d'au moins deux autres lettres
         deviennent un mot : « الذهب » se lit « al dhahab » comme le côté latin l'écrit */
      if (mot.length > 3 && mot.startsWith("ال")) return `al ${motAbjad(mot.slice(2), ARABE, false)}`;
      if (mot.length > 3 && mot.startsWith("لل")) return `lil ${motAbjad(mot.slice(2), ARABE, false)}`;
      return motAbjad(mot, ARABE, false);
    });
}

const CLES_HEBREUX = alternative(GENERIQUES_HEBREUX);
function hebreu(nom: string): string {
  return unifier(nom)
    .replace(new RegExp(`(?<![\\p{L}])(?:${CLES_HEBREUX.source})(?![\\p{L}])`, "gu"), (m) => ` ${GENERIQUES_HEBREUX.get(m) ?? m} `)
    .replace(/[\u0590-\u05ff]+/gu, (mot) => motAbjad(mot, HEBREU, true));
}

/**
 * LA CLÉ CONSONANTIQUE d'un mot latin, pour le comparer à un mot venu d'un abjad : les
 * consonnes seules, ramenées aux classes que le squelette connaît (sh et ch, kh et h, q et k,
 * b et p, d et t), voyelles retirées, lettres doublées repliées APRÈS le retrait des voyelles
 * (« Sepiddasht » et « spiddsht » : sptXt).
 * En hébreu, ב s'écrit b ou v et ו v ou w : v, w et b sont une lettre ; y et j (י) une voyelle ;
 * ח s'écrit ch, kh ou h, et n'est pas ש (sh) : ch rejoint h avant les digrammes (« Shachar » et
 * « shchr » : Xhr ; replier sh sur h aussi laissait une clé de deux lettres).
 * En arabe et en persan, و est sa propre lettre (w, ou v en persan : « Kaveh », « Kavir »),
 * pas ب ; et ج (j, dj à la française) est une consonne que ي (y, une voyelle) n'est pas. Jeu 9,
 * 27/09 : j replié sur i, « Nujoom » et « njum » n'avaient plus que deux consonnes (nm), sous
 * la longueur qui vaut le crédit ; w replié sur b, « Rawabi » et « rwabi » de même (rp).
 */
export function cleAbjad(mot: string, abjad: Abjad): string {
  /* arabe et persan : v est و, dj est ج (voie arabe) ; hébreu : v et w sont ב, ch est ח ; thaï : le côté latin
     écrit les aspirées avec ou sans h (Kenanga, Khenangka ; Pattaya, Phatthaya), จ s'écrit ch ou j et se lit t
     en finale (Rungroj, Rungrot) : kh, ph, th sont k, p, t, j est ch, et un ch final est t */
  let m = abjad === "hebreu" ? mot.replace(/[vw]/g, "b").replace(/(?<!s)ch/g, "h")
    : abjad === "thai" ? mot.replace(/[vw]/g, "b").replace(/kh/g, "k").replace(/ph/g, "p").replace(/th/g, "t").replace(/j/g, "ch").replace(/ch$/, "t")
    : mot.replace(/v/g, "w").replace(/dj/g, "j");
  m = m.replace(/(tsch|sch|tch|ch|sh)/g, "X").replace(/kh/g, "h").replace(/zh/g, "j").replace(/(th|dh)/g, "t").replace(/ph/g, "f")
    .replace(/gh/g, "k").replace(/ck/g, "k").replace(/(ts|tz|z)/g, "s").replace(/c(?=[ei])/g, "s").replace(/[cq]/g, "k")
    .replace(/g/g, "k").replace(/b/g, "p").replace(/d/g, "t").replace(abjad === "hebreu" ? /[yj]/g : /y/g, "i");
  return m.replace(/[aeiou]/g, "").replace(/(.)\1+/g, "$1");
}

/** La clé d'un mot latin dont la finale « -at » ou « -et » peut être une ta marbuta (ة) lue en
 *  annexion : « Zahrat Al Waha » (زهرة الواحة, la fleur de l'oasis), que le côté abjad lit
 *  « zahra », la ة rendue « a ». La même clé, sans ce t ; undefined quand la finale n'est pas
 *  celle-là. Jeu 9, 27/09 : « Zahrat Al Waha Petrochem FZE » et « زهرة الواحة للبتروكيماويات م.م.ح »
 *  restaient plafonnés au possible (0,800), « zahrat » un mot court à une lettre de « zahra ». */
export function cleAbjadSansTa(mot: string): string | undefined {
  return mot.length >= 4 && /[ae]t$/.test(mot) ? cleAbjad(mot.slice(0, -1), "arabe") : undefined;
}

/** L'abjad dans lequel un nom est écrit, s'il l'est ; le thaï compte ici (voir `cleAbjad`). */
export function abjadDe(nom: string): Abjad {
  return /[\u0600-\u06ff]/u.test(nom) ? "arabe" : /[\u0590-\u05ff]/u.test(nom) ? "hebreu" : /[\u0e00-\u0e7f]/u.test(nom) ? "thai" : "";
}

/* ─────────────────────────── l'entrée ─────────────────────────── */

/**
 * Un nom, ses écritures non latines ramenées à des jetons latins ; `natifs` donne, pour chaque
 * jeton lu dans des sinogrammes, les caractères qu'il a lus. Un nom latin ressort tel quel.
 */
export function romaniser(nom: string, lecture: Lecture = "mandarin"): Romanise {
  const natifs = new Map<string, string>();
  let t = nom;
  if (/[\uac00-\ud7a3]/u.test(t)) t = hangul(t);
  if (/[\u4e00-\u9fff]/u.test(t) && !estJaponais(t)) t = hanzi(t, natifs, lecture);
  if (/[\u0590-\u05ff]/u.test(t)) t = hebreu(t);
  if (/[\u0600-\u06ff]/u.test(t)) t = arabe(t);
  if (/[\u0e00-\u0e7f]/u.test(t)) t = thai(t);
  if (/[\u0b80-\u0bff]/u.test(t)) t = tamoul(t);
  return { texte: t, natifs };
}
