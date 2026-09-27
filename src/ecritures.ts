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
 *     caractères (`natifs`), et le score les regarde quand les deux côtés en ont.
 *
 * Le JAPONAIS reste tel quel : un kanji a plusieurs lectures (« 霜月 » se lit Shimotsuki, pas
 * Shuangyue), et une lecture chinoise d'un nom japonais ne rencontrerait rien. Le THAÏ aussi :
 * sa romanisation (voyelles implicites, voyelles écrites avant la consonne, tons) demande un
 * moteur que ce fichier ne prétend pas être.
 *
 * Tout caractère hors des tables traverse INCHANGÉ, comme dans la couche commune : une table
 * qui remplacerait l'inconnu par du vide ferait converger deux noms différents.
 */
import { readFileSync } from "node:fs";

export type Abjad = "" | "arabe" | "hebreu";
export type Romanise = { texte: string; natifs: Map<string, string> };

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
  "서플라이": "supply", "시스템": "systems", "코리아": "korea",
}));

/** Le persan écrit ک et ی là où l'arabe écrit ك et ي : une seule lettre pour les deux, dans
 *  les clés des tables comme dans les noms (mesuré le 27/09 : « شرکت » écrit avec ک ne rencontrait
 *  pas le nom unifié, et restait un mot rare sans répondant). */
function unifierLettres(s: string): string {
  return s.replace(/ک/g, "ك").replace(/ی/g, "ي").replace(/ۀ/g, "ه");
}

/** Arabe et persan : la forme (شركة, شرکت, ذ.م.م.), les qualificatifs du commerce (للتجارة,
 *  بازرگانی), la conjonction. Les clés persanes s'écrivent avec ک et ی, unifiés comme le nom. */
const GENERIQUES_ARABES: ReadonlyMap<string, string> = new Map(Object.entries({
  /* formes */ "شركة": "sharikat", "الشركة": "sharikat", "شرکت": "sherkat", "مؤسسة": "muassasat", "المؤسسة": "muassasat",
  "ذمم": "llc", "شذمم": "llc", "سهامی": "sahami", "خاص": "khas", "عام": "amm", "محدود": "limited", "المحدودة": "limited",
  /* le commerce */ "للتجارة": "trading", "التجارة": "trading", "تجارة": "trading", "تجارية": "trading", "التجارية": "trading",
  "بازرگانی": "trading", "تجاری": "trading", "تجارت": "trade",
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

const CLES_HANZI = alternative(GENERIQUES_HANZI);
function hanzi(nom: string, natifs: Map<string, string>): string {
  return nom.replace(CLES_HANZI, (m) => ` ${GENERIQUES_HANZI.get(m) ?? m} `)
    .replace(/[\u4e00-\u9fff]+/gu, (suite) => {
      /* le nom propre : ses caractères se lisent d'une traite (« 沧澜 » : canglan), et le jeton
         garde ses caractères pour que le score distingue les homophones */
      const lecture = [...suite].map(pinyinDe).join("");
      if (/^[a-z]+$/.test(lecture)) natifs.set(lecture, suite);
      return ` ${lecture} `;
    });
}

/* ─────────────────────────── les abjads ─────────────────────────── */

/** Arabe et persan : translittération consonantique (ALA-LC simplifiée, sans diacritiques
 *  latins), le ʿayn et la hamza tombent. Les lettres persanes s'ajoutent (پ چ ژ گ) ; ک et ی
 *  persans sont unifiés à ك et ي avant la lecture. */
const ARABE: ReadonlyMap<string, string> = new Map(Object.entries({
  "ا": "a", "أ": "a", "إ": "a", "آ": "a", "ٱ": "a", "ء": "", "ؤ": "w", "ئ": "y", "ب": "b", "ت": "t", "ث": "th", "ج": "j",
  "ح": "h", "خ": "kh", "د": "d", "ذ": "dh", "ر": "r", "ز": "z", "س": "s", "ش": "sh", "ص": "s", "ض": "d", "ط": "t", "ظ": "z",
  "ع": "", "غ": "gh", "ف": "f", "ق": "q", "ك": "k", "ل": "l", "م": "m", "ن": "n", "ه": "h", "ة": "a", "و": "w", "ي": "y",
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
 * orot) ; le ה final hébreu est une voyelle et tombe. Un « h » qui suivrait une lettre avec
 * laquelle il formerait un digramme (d + ه, k + ה) est séparé par un a (« dahb », jamais
 * « dhb » qui se lirait ذ), pour que la lecture des consonnes ne se trompe pas de lettre.
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
      if (!enTete && !doublee) l = faible;
      else if (doublee && lettres[i - 1] === c) l = faible;
    }
    if (hebreu && c === "ה" && i === lettres.length - 1 && i > 0) l = "";
    if (l === "h" && /[tdkszgcp]$/.test(sortie)) l = "ah";
    sortie += l;
  }
  return sortie;
}

const CLES_ARABES = alternative(GENERIQUES_ARABES);
function arabe(nom: string): string {
  return unifier(nom)
    .replace(new RegExp(`(?<![\\p{L}])(?:${CLES_ARABES.source})(?![\\p{L}])`, "gu"), (m) => ` ${GENERIQUES_ARABES.get(m) ?? m} `)
    .replace(/[\u0600-\u06ff]+/gu, (mot) => {
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
 * b et p, d et t, y et j ; v, w et b, comme le hindi et l'hébreu), voyelles retirées, lettres
 * doublées repliées APRÈS le retrait des voyelles (« Sepiddasht » et « spiddsht » : sptXt).
 * En hébreu, ח s'écrit ch, kh ou h, et n'est pas ש (sh) : ch rejoint h avant les digrammes
 * (« Shachar » et « shchr » : Xhr ; replier sh sur h aussi laissait une clé de deux lettres).
 */
export function cleAbjad(mot: string, hebreu: boolean): string {
  let m = mot.replace(/[vw]/g, "b");
  if (hebreu) m = m.replace(/(?<!s)ch/g, "h");
  m = m.replace(/(tsch|sch|tch|ch|sh)/g, "X").replace(/kh/g, "h").replace(/zh/g, "j").replace(/(th|dh)/g, "t").replace(/ph/g, "f")
    .replace(/gh/g, "k").replace(/ck/g, "k").replace(/(ts|tz|z)/g, "s").replace(/c(?=[ei])/g, "s").replace(/[cq]/g, "k")
    .replace(/g/g, "k").replace(/b/g, "p").replace(/d/g, "t").replace(/[yj]/g, "i");
  return m.replace(/[aeiou]/g, "").replace(/(.)\1+/g, "$1");
}

/** L'abjad dans lequel un nom est écrit, s'il l'est. */
export function abjadDe(nom: string): Abjad {
  return /[\u0600-\u06ff]/u.test(nom) ? "arabe" : /[\u0590-\u05ff]/u.test(nom) ? "hebreu" : "";
}

/* ─────────────────────────── l'entrée ─────────────────────────── */

/**
 * Un nom, ses écritures non latines ramenées à des jetons latins ; `natifs` donne, pour chaque
 * jeton lu dans des sinogrammes, les caractères qu'il a lus. Un nom latin ressort tel quel.
 */
export function romaniser(nom: string): Romanise {
  const natifs = new Map<string, string>();
  let t = nom;
  if (/[\uac00-\ud7a3]/u.test(t)) t = hangul(t);
  if (/[\u4e00-\u9fff]/u.test(t) && !estJaponais(t)) t = hanzi(t, natifs);
  if (/[\u0590-\u05ff]/u.test(t)) t = hebreu(t);
  if (/[\u0600-\u06ff]/u.test(t)) t = arabe(t);
  return { texte: t, natifs };
}
