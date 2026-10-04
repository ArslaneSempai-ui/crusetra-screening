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
import { DEVANAGARI, GENERIQUES_DEVANAGARI, devanagariEnLatin } from "./devanagari.ts";
import { hokkienDe } from "./hokkien.ts";
import { FORMES_KANJI, MOTS_KANJI, KANJI, numeralKanji, romajiNumeral } from "./kanji.ts";
import { kana } from "./kana.ts";
import { hanjaDe, teteCoreenne, assimilerCoreen } from "./hanja.ts";
import { georgien, armenien } from "./caucase.ts";
import { birman } from "./birman.ts";
import { khmer } from "./khmer.ts";
import { laoEnThai } from "./lao.ts";

/** L'écriture dont un mot se compare sur ses consonnes : les deux abjads, et le thaï (voir
 *  `cleAbjad`), dont la lecture écrit des voyelles que le côté latin n'écrit pas pareil. */
export type Abjad = "" | "arabe" | "hebreu" | "thai";
export type Romanise = { texte: string; natifs: Map<string, string> };
/** La lecture d'un nom en sinogrammes : le mandarin (pinyin, le nom propre soudé), le cantonais
 *  (jyutping en graphie de Hong Kong, syllabe par syllabe), ou le hokkien et le teochew de Singapour et de Malaisie
 *  (hokkien.ts, syllabe par syllabe aussi : « 金福隆 » Kim Hock Leong), ou le sino-coréen des hanja (hanja.ts, le nom propre
 *  soudé comme le mandarin : « 大輪 » Daeryun ; tour 15). Un nom latin se lit pareil sous les quatre. */
export type Lecture = "mandarin" | "cantonais" | "hokkien" | "hanja";

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
  /* tour 15 (jeu 19) : l'industrie lourde (중공업 : « 대륜중공업 » face à « Daeryun Heavy Industries », 0,129, le 중 restant
     collé au nom), l'électricité, la pêche, le papier, les spiritueux, la distribution, le transport ; et la forme abrégée
     entre parenthèses, « (주) » (㈜ s'y ramène par la compatibilité Unicode, voir `romaniser`) et « (유) » */
  "중공업": "heavy industries", "전기": "electric", "수산": "fisheries", "제지": "paper", "주류": "liquor", "유통": "distribution",
  "운수": "transport", "운송": "transport", "제철": "steel", "금속": "metal", "해양": "marine", "종합": "general",
  "(주)": "jusikhoesa", "(유)": "yuhanhoesa",
  /* les mentions d'établissement collées au lieu (부산지점 Busan jijeom, 인천공장 Incheon gongjang) : un mot à part, que
     `mentionDeSuccursale` lit (SUCCURSALES_COLLEES, preparation.ts) */
  "지점": "jijeom", "영업소": "yeongeopso", "공장": "gongjang", "사업소": "saeopso", "출장소": "chuljangso",
  /* les mots anglais écrits en hangul, tels que les navires et les sociétés coréennes les portent (jeu 13 : « 해솔 파이오니어호 »
     est « MT HAESOL PIONEER », 0,583 lu paionieo) : la transcription coréenne d'un mot anglais ne se replie sur aucune
     règle (파이오니어 : pa-i-o-ni-eo), il faut le mot. Deux syllabes au moins par clé, jamais une seule */
  "파이오니어": "pioneer", "스타": "star", "오션": "ocean", "글로벌": "global", "퍼시픽": "pacific", "아시아": "asia",
  "익스프레스": "express", "캐리어": "carrier", "프론티어": "frontier", "하모니": "harmony", "빅토리": "victory", "챌린저": "challenger",
  "네비게이터": "navigator", "파워": "power", "로지스틱스": "logistics", "쉬핑": "shipping", "라인": "line", "탱커": "tanker",
  "트레이딩": "trading", "인더스트리": "industry", "테크놀로지": "technology", "서비스": "services", "센터": "center",
  "컴퍼니": "company", "코퍼레이션": "corporation", "스틸": "steel", "케미칼": "chemical", "오토": "auto", "모터스": "motors",
  "일렉트로닉스": "electronics", "푸드": "food", "파트너스": "partners", "리더": "leader", "드림": "dream", "블루": "blue",
  "골든": "golden", "실버": "silver", "다이아몬드": "diamond", "크리스탈": "crystal", "이글": "eagle", "타이거": "tiger",
  "드래곤": "dragon", "피닉스": "phoenix", "유니버설": "universal", "그린": "green", "브릿지": "bridge", "하버": "harbor",
  "아일랜드": "island", "오리엔트": "orient", "이스턴": "eastern", "웨스턴": "western", "노던": "northern", "서던": "southern",
  "프라임": "prime", "로얄": "royal", "프린스": "prince", "스피릿": "spirit", "호프": "hope", "에이스": "ace", "제니스": "zenith",
  "갤럭시": "galaxy", "머스크": "maersk", "에버그린": "evergreen", "글로리": "glory", "포춘": "fortune", "럭키": "lucky", "타이어": "tire",
  /* tour 15 (jeu 19 : « 하늘 오로라 » face à « Haneul Aurora », 0,466 lu orora) */
  "오로라": "aurora", "호라이즌": "horizon", "크레스트": "crest", "벤처": "venture", "하이웨이": "highway", "벌커": "bulker", "페리": "ferry",
  "코발트": "cobalt", "선라이즈": "sunrise", "아이리스": "iris", "빅토리아": "victoria", "리버티": "liberty", "프리덤": "freedom",
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
  /* les marchandises du Golfe que le nom anglais traduit (jeu 21, tour 17) : les articles sanitaires (الأدوات الصحية), les tissus
     (الأقمشة), les dattes (التمور), les pièces de rechange sous leur préposition (لقطع الغيار, li + قطع الغيار), les denrées
     (المواد الغذائية : « Foodstuff », le mot des raisons sociales du Golfe, jamais « food materials »), et la ش.م.م d'Oman */
  "الأدوات الصحية": "sanitary ware", "للأدوات الصحية": "sanitary ware", "أدوات صحية": "sanitary ware", "الصحية": "sanitary", "صحية": "sanitary",
  "الأدوات": "tools", "أدوات": "tools", "لقطع الغيار": "spare parts", "الأقمشة": "textiles", "أقمشة": "textiles", "للأقمشة": "textiles",
  "التمور": "dates", "تمور": "dates", "للتمور": "dates", "شمم": "llc", "المواد الغذائية": "foodstuff", "للمواد الغذائية": "foodstuff",
  /* les autres sigles des registres du Golfe, tels que leurs noms arabes les écrivent (registre GLEIF, 30/09/2026) : la DMCC
     (م.د.م.س, مركز دبي للسلع المتعددة), la société par actions privée (ش.م.خ, P.S.C.), la « zone franche » (منطقة حرة) qui fait
     d'une ذ.م.م une FZ-LLC, et la « Limited » anglaise écrite en lettres arabes (ليمتد) */
  "مدمس": "dmcc", "شمخ": "psc", "منطقة حرة": "fz", "المنطقة الحرة": "fz", "ليمتد": "limited", "ليميتد": "limited",
  "مواد غذائية": "foodstuff", "الحلويات": "sweets", "حلويات": "sweets", "المجوهرات": "jewellery", "مجوهرات": "jewellery", "الذهب والمجوهرات": "gold and jewellery",
}).map(([k, v]) => [unifierLettres(k), v] as const));

/** LE PERSAN (jeu 21, tour 17) : les marchandises que le nom anglais traduit (پسته pistachio, زعفران saffron, کاشی tile, سرامیک
 *  ceramic, فرش carpets, خرما dates, نساجی textiles), les qualificatifs (طلایی golden, دستباف handwoven, دارویی medicinal), les métiers.
 *  À part des mots arabes, et lus MOT ENTIER seulement, sans l'article ni la préposition que `generiqueArabe` ôte : « الزعفران »
 *  (Bayt Al Zaafaran, une maison d'épices du Golfe) reste un nom, comme son registre anglais l'écrit, et « زعفران » persan est le
 *  safran de « Kavir Golden Saffron ». Ni کویر (Kavir) ni دشت (Dasht), que l'anglais garde comme des noms. */
const GENERIQUES_PERSANS: ReadonlyMap<string, string> = new Map(Object.entries({
  "کاشی": "tile", "سرامیک": "ceramic", "کاشی و سرامیک": "tile ceramic", "پسته": "pistachio", "زعفران": "saffron", "طلایی": "golden",
  "طلائی": "golden", "فرش": "carpets", "فرش دستباف": "handwoven carpets", "دستباف": "handwoven", "گیاهان دارویی": "medicinal herbs",
  "گیاهان": "herbs", "دارویی": "medicinal", "داروئی": "medicinal", "خرما": "dates", "خرمای": "dates", "نساجی": "textiles", "صادرات": "export",
  "واردات": "import", "کشاورزی": "agriculture", "غذایی": "food", "مواد غذایی": "foodstuff", "لبنیات": "dairy", "میوه": "fruit", "خشکبار": "dried fruits",
  "آجیل": "nuts", "عسل": "honey", "چای": "tea", "برنج": "rice", "روغن": "oil", "قند": "sugar", "شکر": "sugar", "شیرینی": "confectionery",
  "نان": "bread", "گوشت": "meat", "ماهی": "fish", "میگو": "shrimp", "سنگ": "stone", "سیمان": "cement", "آجر": "brick", "شیشه": "glass",
  "چرم": "leather", "کفش": "shoes", "پوشاک": "garments", "پارچه": "fabric", "قالی": "carpet", "گلیم": "kilim", "صنایع دستی": "handicrafts",
  "معدن": "mine", "معدنی": "mineral", "فلز": "metal", "فلزات": "metals", "آهن": "iron", "چوب": "wood", "کاغذ": "paper", "شیمیایی": "chemical",
  "پلاستیک": "plastic", "بسته بندی": "packaging", "داروسازی": "pharmaceutical", "پزشکی": "medical", "الکترونیک": "electronics", "برق": "electric",
  "ماشین سازی": "machinery", "لوازم": "equipment", "قطعات": "parts", "خودرو": "automotive", "ساختمان": "building", "خدماتی": "services",
  "بندر": "port", "کشتی": "ship", "گردشگری": "tourism", "هتل": "hotel", "بیمه": "insurance", "بانک": "bank", "عمران": "construction",
  "فنی مهندسی": "engineering", "فنی": "technical",
}).map(([k, v]) => [unifierLettres(k), v] as const));

/** Hébreu : la forme (בע״מ, sans ses guillemets), le commerce, la famille, les marchandises que le nom anglais traduit (jeu 21,
 *  tour 17 : אריזות packaging, הובלות transport, פלסטיק plastic, חלקים parts, בית בד olive press, פירות ים seafood), et les mots
 *  anglais écrits en hébreu (אקספרס express, לוגיסטיקה logistics). L'article ה et la conjonction ו collés devant un mot de la
 *  table se lisent dans `generiqueHebreu` (האחים : brothers, ושיווק : and marketing). Les clés de plusieurs mots avant les mots. */
const GENERIQUES_HEBREUX: ReadonlyMap<string, string> = new Map(Object.entries({
  "בעמ": "ltd", "חברה": "company", "חברת": "company", "תעשיות": "industries", "תעשייה": "industry", "תעשיה": "industry",
  "אחים": "brothers", "ובניו": "sons", "ובנו": "sons", "בניו": "sons", "ושות": "", "מסחר": "trading", "סחר": "trade", "שיווק": "marketing",
  /* la filiation (בן, « Ben »), écrite en lettres pour prendre le chemin du côté latin, où « ben » devient « bin » (voir FILIATION_M) :
     lue « bn », elle ne le rejoignait plus (« יצחק בן עמי חשמל » à 0,750 face à « Yitzhak Ben Ami Electric », tour 17) */
  "בן": "ben", "בת": "bat",
  "ייצור": "production", "יצור": "production", "הנדסה": "engineering", "בנייה": "construction", "בניה": "construction",
  "השקעות": "investments", "אחזקות": "holdings", "קבוצת": "group", "קבוצה": "group", "בינלאומי": "international", "בינלאומית": "international",
  "שירותים": "services", "לוגיסטיקה": "logistics", "ספנות": "shipping", "ימי": "marine", "טכנולוגיות": "technologies", "טכנולוגיה": "technology",
  /* les marchandises et les métiers */ "אריזות": "packaging", "אריזה": "packaging", "הובלות": "transport", "הובלה": "transport", "יבוא": "import",
  "יצוא": "export", "פלסטיק": "plastic", "פלסטיקה": "plastics", "חלקים": "parts", "מדויקים": "precision", "מדוייקים": "precision", "חומרי בניין": "building materials",
  "חומרי בנין": "building materials", "חומרים": "materials", "עבודות": "works", "עבודות מתכת": "metal works", "אבן": "stone", "חשמל": "electric",
  "בית בד": "olive press", "תוצרת": "produce", "טרייה": "fresh", "טריה": "fresh", "רפואית": "medical", "רפואי": "medical", "פירות ים": "seafood",
  "פירות": "fruits", "ירקות": "vegetables", "סוכנויות": "agencies", "סוכנות": "agency", "מזון": "food", "כשר": "kosher", "פתרונות": "solutions",
  "אקספרס": "express", "מתכת": "metal", "מתכות": "metals", "טקסטיל": "textiles", "מוצרי": "products", "מוצרים": "products", "השקיה": "irrigation",
  "חקלאות": "agriculture", "חקלאי": "agricultural", "חקלאית": "agricultural", "דלק": "fuel", "אנרגיה": "energy", "בניין": "building", "בנין": "building",
  "נדלן": "real estate", "ייעוץ": "consulting", "יעוץ": "consulting", "מחשבים": "computers", "תוכנה": "software", "רהיטים": "furniture",
  "ביטוח": "insurance", "נכסים": "properties", "כללי": "general", "כללית": "general", "מעבדות": "laboratories", "מעבדה": "laboratory",
  "הפצה": "distribution", "אספקה": "supply", "ציוד": "equipment", "כלים": "tools", "מכונות": "machinery", "רכב": "automotive", "תחבורה": "transport",
  "מטענים": "cargo", "נמל": "port", "דיג": "fishing", "דגים": "fish", "בשר": "meat", "חלב": "dairy", "מאפיה": "bakery", "יין": "wine", "יינות": "wines",
  "יקב": "winery", "יקבי": "winery", "שמן": "oil", "זית": "olive", "זיתים": "olives", "פרחים": "flowers", "משתלה": "nursery", "מלון": "hotel",
  "תיירות": "tourism", "נסיעות": "travel", "בנק": "bank", "אופנה": "fashion", "ביגוד": "clothing", "הלבשה": "clothing", "נעליים": "shoes",
  "עור": "leather", "זכוכית": "glass", "נייר": "paper", "דפוס": "printing", "גומי": "rubber", "כימיקלים": "chemicals", "תרופות": "pharmaceuticals",
  "פארמה": "pharma", "קוסמטיקה": "cosmetics", "אלקטרוניקה": "electronics", "תקשורת": "communications", "אבטחה": "security", "ניקיון": "cleaning",
  "אחזקה": "maintenance", "אדריכלות": "architecture", "קבלנות": "contracting", "קבלן": "contractor", "פיתוח": "development", "עץ": "timber",
  "מפעלי": "works", "מפעל": "works", "מרכז": "center", "יצרני": "manufacturers", "פיננסים": "finance", "מימון": "finance", "יזמות": "ventures",
}));
/** Le mot générique qu'un mot hébreu porte sous son article ה ou sa conjonction ו collés : « האחים » (ha-achim) est
 *  « brothers », « ושיווק » (ve-shivuk) « and marketing ». Un nom propre n'y passe pas : « הגליל » (HaGalil) reste entier,
 *  comme le côté latin l'écrit, parce que seul un mot de la table confirme la lecture. */
function generiqueHebreu(mot: string): string | undefined {
  const direct = GENERIQUES_HEBREUX.get(mot);
  if (direct !== undefined) return direct;
  if (mot.length < 4) return undefined;
  if (mot.startsWith("ו")) { const g = GENERIQUES_HEBREUX.get(mot.slice(1)); if (g !== undefined) return g === "" ? "and" : `and ${g}`; }
  if (mot.startsWith("ה")) { const g = GENERIQUES_HEBREUX.get(mot.slice(1)); if (g !== undefined) return g; }
  return undefined;
}

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
  /* les kanji des métiers japonais, dans leurs graphies japonaises (産, 鉄), tels qu'un nom latin les porte entre
     parenthèses sans kana ni forme (« Nishihama Machinery Co., Ltd. (西浜機械) », jeu 11) : les mêmes lemmes que
     TRADUCTIONS_JAPONAISES. Un nom que ses kana ou sa forme disent japonais ne lit pas ses kanji (voir `estJaponais`) */
  "製作所": "manufacturing", "造船": "shipbuilding", "倉庫": "warehouse", "港運": "stevedoring", "水産": "fisheries",
  "鉄工": "steel", "鐵工": "steel", "鉄工所": "steelworks", "鐵工所": "steelworks",
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
const FORMES_JAPONAISES = /株式会社|有限会社|合同会社|合資会社|合名会社|会社|\(株\)|\(有\)|㈱|㈲/u;

/** Un nom japonais : des kana, une forme japonaise, ou le 丸 en queue d'un nom de navire (« 霧雨丸 », « 第八星風丸 » : tour 15,
 *  jeu 19, lus en mandarin à 0,000 face à « Kirisame Maru », « Hoshikaze Maru No. 8 »). Ses kanji se lisent dans kanji.ts. */
export function estJaponais(nom: string): boolean {
  return /[\u3040-\u30ff]/u.test(nom) || FORMES_JAPONAISES.test(nom) || /丸\s*$/u.test(nom.trim());
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
  /* l'assimilation nasale de la romanisation révisée (백록 baengnok, 국민 gungmin : tour 15, jeu 19, « 백록화학 » lu baekrok face à
     « Baengnok Chemical », 0,585) ; `pliCoreen` la rejoue sur le côté latin écrit lettre à lettre */
  return assimilerCoreen(sortie);
}

const CLES_HANGUL = alternative(GENERIQUES_HANGUL);
function hangul(nom: string): string {
  /* « 제7 용두호 » : 제 devant un chiffre est le « No. » des navires coréens (tour 15, jeu 19 : « je » restait un mot rare) */
  return nom.replace(/제\s*(?=\d)/gu, " no ").replace(CLES_HANGUL, (m) => ` ${GENERIQUES_HANGUL.get(m) ?? m} `).replace(/[\uac00-\ud7a3]+/gu, hangulEnLatin);
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
     Kong même nomme en mandarin : il se lit comme dans l'autre lecture. En hokkien de même,
     dans la graphie des registres de Singapour (« 金福隆 » : kim hock leong, jeu 13), un caractère
     hors de la table (hokkien.ts) gardant sa lecture mandarine. */
  const syllabique = (suite: string) => [...suite].map((c) => {
    const j = lecture === "cantonais" ? jyutpingDe(c) : hokkienDe(c);
    const l = j === "" ? pinyinDe(c) : lecture === "cantonais" ? hongkong(j) : j;
    if (/^[a-z]+$/.test(l)) natifs.set(l, c);
    return ` ${l} `;
  }).join("");
  return generiques.replace(/\([^()]*\)/gu, (p) => p.replace(SINOGRAMMES, mandarin)).replace(SINOGRAMMES, syllabique);
}

/**
 * LE PINYIN ÉCRIT SYLLABE PAR SYLLABE (« hang zhou lin jiang tou zi fa zhan you xian gong si ») : la translittération
 * automatique d'un registre, un jeton par caractère, là où la lecture mandarine des caractères SOUDE le nom propre et
 * TRADUIT les mots du commerce (« 杭州临江投资发展有限公司 » : hangzhoulinjiang investment development youxian gongsi).
 * Les deux écritures d'un même nom ne se rencontraient pas (registre GLEIF, 30/09/2026 : 43 des 49 noms chinois jugés
 * « même nom » face à leur pinyin restaient sous le possible). Ce pinyin se lit donc comme les caractères : les suites
 * de syllabes qui sont celles d'un mot de GENERIQUES_HANZI (sa lecture, caractère par caractère) deviennent ce mot, et
 * chaque suite restante, parenthèse par parenthèse, devient UN jeton. Rien n'est deviné : la règle ne vaut que pour un
 * nom dont TOUS les jetons (quatre au moins) sont des syllabes de la table du pinyin, et la lecture s'ajoute aux autres
 * (`lecturesDe`, variantes.ts), elle n'en retire aucune.
 */
const SYLLABES_PINYIN: ReadonlySet<string> = new Set(PINYIN.filter((l) => /^[a-z]+$/.test(l)));
let GENERIQUES_EN_PINYIN: readonly (readonly [readonly string[], string])[] | undefined;
function generiquesEnPinyin(): readonly (readonly [readonly string[], string])[] {
  GENERIQUES_EN_PINYIN ??= [...GENERIQUES_HANZI].filter(([k]) => /^[一-鿿]{2,}$/u.test(k))
    .map(([k, v]) => [[...k].map(pinyinDe), v] as const).sort((a, b) => b[0].length - a[0].length);
  return GENERIQUES_EN_PINYIN;
}
export function pinyinSyllabique(nom: string): string | undefined {
  const plie = nom.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  if (/[^a-z\s().,'-]/.test(plie)) return undefined;
  const groupes = plie.split(/([()])/).reduce<{ dedans: boolean; syllabes: string[] }[]>((acc, morceau) => {
    if (morceau === "(") acc.push({ dedans: true, syllabes: [] });
    else if (morceau === ")") acc.push({ dedans: false, syllabes: [] });
    else acc[acc.length - 1]!.syllabes.push(...morceau.split(/[\s.,'-]+/).filter(Boolean));
    return acc;
  }, [{ dedans: false, syllabes: [] }]).filter((g) => g.syllabes.length > 0);
  const toutes = groupes.flatMap((g) => g.syllabes);
  if (toutes.length < 4 || !toutes.every((s) => SYLLABES_PINYIN.has(s))) return undefined;
  const lire = (syllabes: readonly string[]): string => {
    const sortie: string[] = [];
    let suite = "";
    for (let i = 0; i < syllabes.length;) {
      const g = generiquesEnPinyin().find(([cle]) => cle.every((s, k) => syllabes[i + k] === s));
      if (g === undefined) { suite += syllabes[i]; i++; continue; }
      if (suite !== "") { sortie.push(suite); suite = ""; }
      sortie.push(g[1]);
      i += g[0].length;
    }
    if (suite !== "") sortie.push(suite);
    return sortie.join(" ");
  };
  return groupes.map((g) => (g.dedans ? `(${lire(g.syllabes)})` : lire(g.syllabes))).join(" ");
}

/* ─────────────────────────── les hanja ─────────────────────────── */

/** Les formes et les mots du commerce d'un nom coréen écrit en hanja (« 大輪重工業株式會社 », « 瑞林海運 ») : la forme coréenne
 *  (jusikhoesa, comme le hangul 주식회사) et les mêmes lemmes anglais que GENERIQUES_HANGUL. Traditionnels d'abord, et les
 *  graphies japonaises qu'un document coréen emprunte (産, 学, 鉄). */
const GENERIQUES_HANJA: ReadonlyMap<string, string> = new Map(Object.entries({
  "株式會社": "jusikhoesa", "株式会社": "jusikhoesa", "有限會社": "yuhanhoesa", "有限会社": "yuhanhoesa",
  "重工業": "heavy industries", "工業": "industrial", "商事": "trading", "海運": "shipping", "化學": "chemical", "化学": "chemical",
  "機械": "machinery", "電機": "electric", "電氣": "electric", "電気": "electric", "電子": "electronics", "精密": "precision",
  "産業": "industry", "產業": "industry", "水産": "fisheries", "水產": "fisheries", "食品": "food", "製藥": "pharmaceutical",
  "製薬": "pharmaceutical", "製紙": "paper", "鐵鋼": "steel", "鉄鋼": "steel", "製鐵": "steel", "製鉄": "steel", "物流": "logistics",
  "貿易": "trading", "通商": "trading", "建設": "construction", "造船": "shipbuilding", "纖維": "textile", "繊維": "textile",
  "酒類": "liquor", "開發": "development", "開発": "development", "實業": "industrial", "実業": "industrial", "運輸": "transport",
  "運送": "transport", "流通": "distribution", "金屬": "metal", "金属": "metal", "海洋": "marine", "國際": "international",
  "国際": "international", "大韓": "daehan", "韓國": "hanguk", "韓国": "hanguk",
}));
const CLES_HANJA = alternative(GENERIQUES_HANJA);
/** Un nom en sinogrammes lu en sino-coréen (hanja.ts) : la forme et les métiers traduits, puis chaque suite de caractères soudée
 *  en un nom propre (« 大輪 » : daeryun, « 白鹿 » : baengnok), la règle du son initial sur son premier caractère et l'assimilation
 *  nasale sur le mot, chaque jeton gardant ses caractères (`natifs`). Un caractère hors table garde sa lecture mandarine. */
function hanja(nom: string, natifs: Map<string, string>): string {
  return nom.replace(CLES_HANJA, (m) => ` ${GENERIQUES_HANJA.get(m) ?? m} `).replace(SINOGRAMMES, (suite) => {
    const l = assimilerCoreen([...suite].map((c, i) => { const h = hanjaDe(c) || pinyinDe(c); return i === 0 ? teteCoreenne(h) : h; }).join(""));
    if (/^[a-z]+$/.test(l)) natifs.set(l, suite);
    return ` ${l} `;
  });
}

/* ─────────────────────────── le japonais ─────────────────────────── */

/** Un nom japonais en kanji (voir kanji.ts) : la forme, puis les mots faits (métiers en lecture sino-japonaise, lieux),
 *  puis chaque kanji sous sa lecture de nom propre, soudés par suite (« 株式会社霜月水産 » : kabushiki kaisha shimotsuki
 *  suisan, jeu 13). Un kanji hors table reste lui-même dans son mot. Les kana restent tels quels. */
const CLES_FORMES_KANJI = alternative(FORMES_KANJI), CLES_MOTS_KANJI = alternative(MOTS_KANJI);
/** Les kanji, et les petits ヶ et ヵ des noms de lieux (千鳥ヶ瀬 Chidorigase), qui se lisent dans leur mot. */
const SINOGRAMMES_JAPONAIS = /[\u4e00-\u9fff\u30f5\u30f6]+/gu;
const PETITS_KE: ReadonlyMap<string, string> = new Map([["ヶ", "ga"], ["ヵ", "ka"]]);
function japonais(nom: string): string {
  return nom.replace(CLES_FORMES_KANJI, (m) => ` ${FORMES_KANJI.get(m) ?? m} `)
    /* le numéro d'un navire, 第 et son numéral (第八星風丸 : daihachi hoshikaze maru, que la règle du maru lit « No. 8 » ; 第十一 :
       daijuichi ; tour 15, jeu 19), lu en lettres pour que 第一 reste Daiichi dans une raison sociale */
    .replace(/第([一二三四五六七八九十]+)/gu, (m, n: string) => { const v = numeralKanji(n); return v === undefined ? m : ` dai${romajiNumeral(v)} `; })
    /* le 丸 en queue nomme le navire : un mot à part (« 霧雨丸 » : kirisame maru), quand 丸信 est Marushin dans son mot */
    .replace(/丸\s*$/u, " maru ")
    .replace(CLES_MOTS_KANJI, (m) => ` ${MOTS_KANJI.get(m) ?? m} `)
    .replace(SINOGRAMMES_JAPONAIS, (suite) => ` ${[...suite].map((c) => KANJI.get(c) ?? PETITS_KE.get(c) ?? c).join("")} `);
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
  /* tour 18 (jeu 22) : les mots que le latin ÉCRIT À PART dans un nom que le thaï soude, et que le lecteur ne coupe pas (รัตนสมุทร :
     Rattana Samut ; โรงสีข้าวสุวรรณมงคล : Rice Mill Suwan Mongkhon), les mots sanskrits dont la lecture syllabique se trompe (สุวรรณ,
     มงคล, เกียรติ, สมบูรณ์, อุดม, วัฒนา, วิเศษ, โภคภัณฑ์), les provinces (สงขลา), la branche et le siège (สาขา, สำนักงานใหญ่), et
     d'autres mots du commerce et mots anglais écrits en thaï */
  "รัตน": "rattana", "สมุทร": "samut", "ศรี": "si", "ทอง": "thong", "ตะวัน": "tawan", "ใต้": "tai", "เพชร": "phet", "สุวรรณ": "suwan",
  "มงคล": "mongkhon", "เกียรติ": "kiat", "สมบูรณ์": "sombun", "อุดม": "udom", "วัฒนา": "watthana", "วัฒน์": "wat", "วิเศษ": "wiset",
  "โภคภัณฑ์": "phokhaphan", "สงขลา": "songkhla",
  "ห้องเย็น": "cold storage", "เคมีภัณฑ์": "chemical", "ปาล์มออยล์": "palm oil", "ปาล์ม": "palm", "ออยล์": "oil", "ยางพารา": "rubber",
  "โรงสีข้าว": "rice mill", "โรงสี": "rice mill", "ข้าว": "rice", "อัญมณี": "gems", "เครื่องดื่ม": "beverage", "การประมง": "fishery",
  "สาขาที่": "branch", "สาขา": "branch", "สำนักงานใหญ่": "head office", "การเกษตร": "agriculture", "เกษตร": "agriculture", "ประกันภัย": "insurance",
  "ธนาคาร": "bank", "โรงแรม": "hotel", "ท่องเที่ยว": "tourism", "เหมืองแร่": "mining", "อสังหาริมทรัพย์": "real estate", "ปูนซีเมนต์": "cement",
  "ซีเมนต์": "cement", "แก๊ส": "gas", "ค้าปลีก": "retail", "ค้าส่ง": "wholesale", "ออร์คิด": "orchid", "ฟีดเดอร์": "feeder", "อินเตอร์เทรด": "intertrade",
  "เทรด": "trade", "อะโกร": "agro", "ทัวร์": "tours",
  /* les mots anglais écrits en thaï */ "กรุ๊ป": "group", "อินเตอร์เนชั่นแนล": "international", "อินเตอร์": "inter",
  "เอ็นจิเนียริ่ง": "engineering", "เทรดดิ้ง": "trading", "โฮลดิ้งส์": "holdings", "โฮลดิ้ง": "holding", "มาร์เก็ตติ้ง": "marketing",
  "เซอร์วิสเซส": "services", "เซอร์วิส": "service", "ซัพพลาย": "supply", "ซีฟู้ด": "seafood", "ฟู้ดส์": "foods", "ฟู้ด": "food",
  "โฟรเซ่น": "frozen", "แพ็คเกจจิ้ง": "packaging", "แพคเกจจิ้ง": "packaging", "แปซิฟิก": "pacific", "สตีล": "steel", "เคมีคอล": "chemical",
  "เทคโนโลยี": "technology", "คอนสตรัคชั่น": "construction", "ดีเวลลอปเม้นท์": "development", "ชิปปิ้ง": "shipping", "มารีน": "marine",
  "เอ็กซ์ปอร์ต": "export", "อิมปอร์ต": "import", "เอ็นเตอร์ไพรส์": "enterprise", "คอร์ปอเรชั่น": "corporation", "อินดัสทรี": "industry",
  "อินดัสเตรียล": "industrial", "โปรดักส์": "products", "แมชชีนเนอรี่": "machinery", "เท็กซ์ไทล์": "textile",
}));

/** Les clés thaïes ne se lisent pas devant un signe de voyelle ou de ton : « ไทย » suivi d'un signe est une autre syllabe (tour 18). */
const CLES_THAI = new RegExp(`(?:${alternative(GENERIQUES_THAI).source})(?![\\u0e30-\\u0e3a\\u0e47-\\u0e4e])`, "gu");
function thai(nom: string): string {
  return nom.replace(/[๐-๙]/gu, (c) => String(c.codePointAt(0)! - 0x0e50))
    /* « เรือ » seul en tête, suivi d'une espace, est le préfixe de navire ; dans un mot c'est une
       syllabe (เรือน ruean), et il n'est pas dans la table */
    .replace(/^\s*เรือ(?=\s)/u, " mv ")
    /* une consonne seule suivie d'un point est une initiale (« ส.เพชรสมุทร » : S. Phet Samut, tour 18, jeu 22) */
    .replace(/(?<![฀-๿])([ก-ฮ])\./gu, (_m, c: string) => ` ${THAI_CONSONNES.get(c)![0]}. `)
    .replace(CLES_THAI, (m) => ` ${GENERIQUES_THAI.get(m) ?? m} `)
    .replace(/[฀-๿]+/gu, thaiEnLatin);
}
/** Le lao : chaque suite de lettres lao ramenée aux lettres thaïes (lao.ts, mots du commerce compris), lue par le lecteur thaï, puis
 *  écrite comme Vientiane romanise (แ e, non ae : ຄຳແສງ Khamseng ; เ-ิ eu, non oe : ຈະເລີນ Chaleun). */
function lao(nom: string): string {
  return nom.replace(/[຀-໿]+/gu, (suite) => thai(laoEnThai(suite)).replace(/ae/g, "e").replace(/oe/g, "eu"));
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

/* ─────────────────────────── la devanagari ─────────────────────────── */

/** Le hindi et ses voisins en devanagari (voir devanagari.ts) : les mots du commerce d'abord, mot entier, puis chaque mot
 *  lettre à lettre, le schwa tombé comme les registres l'écrivent (« गुप्ता अनिल कुमार » : gupta anil kumar, jeu 13). Le
 *  danda (।) est une ponctuation, les chiffres devanagari des chiffres. */
const CLES_DEVANAGARI = alternative(GENERIQUES_DEVANAGARI);
function devanagari(nom: string): string {
  return nom.normalize("NFD").replace(/[०-९]/gu, (c) => String(c.codePointAt(0)! - 0x0966)).replace(/[।॥]/gu, " ")
    .replace(new RegExp(`(?<![\\u0900-\\u097f])(?:${CLES_DEVANAGARI.source})(?![\\u0900-\\u097f])`, "gu"), (m) => ` ${GENERIQUES_DEVANAGARI.get(m) ?? m} `)
    .replace(/[\u0900-\u097f]+/gu, devanagariEnLatin);
}

/* ─────────────────────────── les abjads ─────────────────────────── */

/** Arabe et persan : translittération consonantique (ALA-LC simplifiée, sans diacritiques
 *  latins), la hamza tombe. Le ʿayn se lit « a » : la romanisation l'écrit par une voyelle ou
 *  une apostrophe, jamais par une consonne (« سعيد » Saeed, Sa'id ; « علي » Ali ; « سعد » Saad),
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
/** Hébreu : consonnes seules, les finales avec leur forme ordinaire ; א et ע tombent. Le ח se lit kh, jamais ch : « ch » est aussi
 *  le צ׳ des noms étrangers (Gurevich), et « יצחק » lu « ytschk » faisait un sch de son ts + ch (tour 17). */
const HEBREU: ReadonlyMap<string, string> = new Map(Object.entries({
  "א": "", "ב": "b", "ג": "g", "ד": "d", "ה": "h", "ו": "v", "ז": "z", "ח": "kh", "ט": "t", "י": "y", "כ": "k", "ך": "kh",
  "ל": "l", "מ": "m", "ם": "m", "נ": "n", "ן": "n", "ס": "s", "ע": "", "פ": "p", "ף": "p", "צ": "ts", "ץ": "ts", "ק": "k",
  "ר": "r", "ש": "sh", "ת": "t",
}));
/** Les lettres hébraïques que le geresh (׳, ou l'apostrophe qui le remplace) fait sonner comme une lettre étrangère : ג׳ est j
 *  (ג׳ורג׳ : George), צ׳ ch (גורביץ׳ : Gurevich, רבינוביץ׳ : Rabinovich), ז׳ zh (ז׳אק : Jacques), ת׳ th, ד׳ dh, ח׳ et כ׳ kh (ח׳ורי :
 *  Khoury, le خ arabe), ו׳ w. */
const GERESH_HEBREU: ReadonlyMap<string, string> = new Map(Object.entries({
  "ג": "j", "צ": "ch", "ץ": "ch", "ז": "zh", "ת": "th", "ד": "dh", "ח": "kh", "כ": "kh", "ך": "kh", "ו": "w",
}));
const GERESH = /[׳'’]/;
/** Les chiffres arabes orientaux et persans, en chiffres : un numéro de navire reste un numéro. */
const CHIFFRES: ReadonlyMap<string, string> = new Map([..."٠١٢٣٤٥٦٧٨٩"].map((c, i) => [c, String(i)] as const)
  .concat([..."۰۱۲۳۴۵۶۷۸۹"].map((c, i) => [c, String(i)] as const)));

/** Persan unifié à l'arabe (ک, ی, ۀ), marques de voyelles brèves et tatwil retirés, guillemets
 *  hébreux (geresh, gershayim) retirés du dedans des mots, sigles pointés soudés (« ذ.م.م. »). */
function unifier(nom: string): string {
  return unifierLettres(nom).replace(/[\u064b-\u0652\u0670\u0640\u200c\u200d]/gu, (c) => (c === "\u200c" || c === "\u200d" ? " " : ""))
    .replace(/[۰-۹٠-٩]/gu, (c) => CHIFFRES.get(c) ?? c)
    .replace(/(?<=[\u0590-\u05ff])[״"](?=[\u0590-\u05ff])/gu, "")
    /* le geresh reste derrière une lettre dont il fait un digramme (voir GERESH_HEBREU) ; ailleurs il tombe (« בע'מ ») */
    .replace(/(?<=[\u0590-\u05ff])(?<![גזצץתדחכךו])[׳'’](?=[\u0590-\u05ff])/gu, "")
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

const CLES_PERSANES = alternative(GENERIQUES_PERSANS);
/**
 * LES LETTRES LATINES ÉPELÉES DANS UNE AUTRE ÉCRITURE : un sigle latin (« MEA », « DWC », « LTD », « SFI », « NBB ») que le nom
 * natif écrit par le NOM de chaque lettre, tel qu'il se prononce en anglais (« ام اي ايه », « دي دبليو سي », « إل تي دي » ;
 * « ЭсЭфАй » ; « エヌビービー » ; « 티엔케이 »). Le côté latin écrit le sigle. Une suite de DEUX noms de lettres au moins se lit
 * comme le sigle ; un nom de lettre seul reste un mot (« في » est aussi « dans », « ام » la mère d'Umm Al Quwain). Les tables
 * sont les noms des lettres de l'alphabet latin dans chaque écriture, rien d'autre. Registre GLEIF, 30/09/2026 : une vingtaine
 * de noms jugés « même nom » portaient un sigle ainsi épelé.
 */
/* lue AVANT `unifier`, qui confond les alifs : « إي » (E) et « آي » (I) ne se distinguent que par leur hamza et leur madda ;
   le yā' final s'écrit ي, ى ou ی selon la frappe, une seule clé (`cleEpelee`) */
const cleEpelee = (m: string) => m.replace(/[ىی]/g, "ي").replace(/ک/g, "ك");
const LETTRES_EPELEES_ARABES: ReadonlyMap<string, string> = new Map(Object.entries({
  "ايه": "a", "أيه": "a", "إيه": "a", "بي": "b", "پي": "p", "سي": "c", "دي": "d",
  "اي": "e", "إي": "e", "إف": "f", "اف": "f", "جي": "g", "إتش": "h", "اتش": "h", "ايتش": "h", "إيتش": "h",
  "آي": "i", "أي": "i", "جيه": "j", "جاي": "j", "كيه": "k", "كاي": "k", "إل": "l", "ال": "l", "ايل": "l", "إم": "m", "ام": "m",
  "إن": "n", "ان": "n", "أو": "o", "او": "o", "كيو": "q", "آر": "r", "ار": "r", "إس": "s", "اس": "s", "تي": "t",
  "يو": "u", "في": "v", "ڤي": "v", "دبليو": "w", "دبليوو": "w", "إكس": "x", "اكس": "x", "واي": "y", "زد": "z", "زي": "z",
}).map(([k, v]) => [cleEpelee(k), v] as const));
/** Les formes juridiques qu'un nom natif épelle derrière son sigle, sans rien qui les sépare (« دي بي ال تي دي » : DB LTD) : la
 *  forme se détache du sigle, pour être lue comme une forme. L'arabe n'a pas de p : son بي est B ou P (`bLuP`). */
const FORMES_EPELEES: readonly string[] = ["fzco", "pjsc", "ltd", "llc", "llp", "plc", "inc", "fze", "fzc", "dwc", "jsc", "lp"];
function detacherLaForme(sigle: string, bLuP: boolean): string {
  for (const f of FORMES_EPELEES) {
    const queue = sigle.slice(-f.length);
    if (queue === f || (bLuP && queue.replace(/b/g, "p") === f)) return sigle.length === f.length ? f : `${sigle.slice(0, -f.length)} ${f}`;
  }
  return sigle;
}
/** Les mots d'une écriture à espaces (l'arabe, le cyrillique) : chaque suite d'au moins deux mots qui sont tous des noms de
 *  lettres latines devient le sigle ; `cle` ramène le mot à la forme des clés de la table. */
export function siglesEpeles(nom: string, table: ReadonlyMap<string, string>, lettres: RegExp, cle: (mot: string) => string = (m) => m, bLuP = false): string {
  /* les mots et ce qui les sépare ; une espace, un tiret ou un point séparent deux lettres d'un même sigle, un guillemet ou une
     parenthèse le ferment */
  const mots = nom.split(/([^\p{L}\p{N}]+)/u);
  const lien = (x: string) => /^[\s.\-\u2013]+$/u.test(x);
  const sortie: string[] = [];
  for (let i = 0; i < mots.length;) {
    const suite: string[] = [];
    let k = i;
    while (k < mots.length && (k % 2 === 1 ? suite.length > 0 && lien(mots[k]!) && k + 1 < mots.length && lettres.test(mots[k + 1]!) && table.has(cle(mots[k + 1]!))
      : lettres.test(mots[k]!) && table.has(cle(mots[k]!)))) {
      if (k % 2 === 0) suite.push(table.get(cle(mots[k]!))!);
      k++;
    }
    if (suite.length >= 2) { sortie.push(` ${detacherLaForme(suite.join(""), bLuP)} `); i = k; }
    else { sortie.push(mots[i]!); i++; }
  }
  return sortie.join("");
}
/** Les noms des lettres latines en cyrillique, tels que le russe, le bulgare et l'ukrainien les disent (« ЭсЭфАй » : SFI ; « АЙ ДЖИ » :
 *  IG), et les noms allemands que les registres de l'Est emploient aussi (« ЕрФауЦе » : RVC). Pas « и » (E), qui est « et ». */
export const LETTRES_EPELEES_CYRILLIQUES: ReadonlyMap<string, string> = new Map(Object.entries({
  "эй": "a", "ей": "a", "би": "b", "бе": "b", "си": "c", "це": "c", "ди": "d", "эф": "f", "еф": "f", "джи": "g", "ге": "g", "эйч": "h",
  "ейч": "h", "ха": "h", "ай": "i", "джей": "j", "йот": "j", "кей": "k", "кэй": "k", "ка": "k", "эл": "l", "ел": "l", "эль": "l", "ель": "l",
  "эм": "m", "ем": "m", "эн": "n", "ен": "n", "оу": "o", "пи": "p", "пе": "p", "кью": "q", "кю": "q", "ар": "r", "эр": "r", "ер": "r",
  "эс": "s", "ес": "s", "ти": "t", "те": "t", "ю": "u", "ви": "v", "фау": "v", "дабълю": "w", "даблю": "w", "экс": "x", "екс": "x",
  "икс": "x", "уай": "y", "вай": "y", "зет": "z", "зед": "z", "зи": "z", "цет": "z",
}));
/** Un mot cyrillique fait de noms de lettres collés, chacun sa capitale (« ЭсЭфАй », « ДиПи ») : le sigle, lu d'un coup. */
export function lettresCollees(mot: string): string {
  const parts = mot.split(/(?<=\p{Ll})(?=\p{Lu})/u);
  return parts.length >= 2 && parts.every((x) => LETTRES_EPELEES_CYRILLIQUES.has(x.toLowerCase()))
    ? detacherLaForme(parts.map((x) => LETTRES_EPELEES_CYRILLIQUES.get(x.toLowerCase())!).join(""), false) : mot;
}
/** Les noms des lettres latines en katakana (エー, ビー, シー, ディー…), en hangul (에이, 비, 씨, 디… ; pas 이, 지, 오, 유, syllabes
 *  trop courantes des mots coréens) et en thaï (เอ, บี, ซี, ดี…). Ces écritures COLLENT le sigle au mot qui suit (« エヌビービー
 *  ポルトリース », « 에스엔글로벌 ») : le sigle se lit en TÊTE d'une suite, deux lettres au moins, le reste de la suite restant un mot. */
const LETTRES_EPELEES_KANA: ReadonlyMap<string, string> = new Map(Object.entries({
  "エー": "a", "エイ": "a", "ビー": "b", "シー": "c", "ディー": "d", "デー": "d", "イー": "e", "エフ": "f", "ジー": "g", "エイチ": "h", "エッチ": "h",
  "アイ": "i", "ジェー": "j", "ジェイ": "j", "ケー": "k", "ケイ": "k", "エル": "l", "エム": "m", "エヌ": "n", "オー": "o", "ピー": "p",
  "キュー": "q", "アール": "r", "エス": "s", "ティー": "t", "テー": "t", "ユー": "u", "ブイ": "v", "ヴィ": "v", "ヴイ": "v",
  "ダブリュー": "w", "エックス": "x", "ワイ": "y", "ゼット": "z", "ズィー": "z", "ゼッド": "z",
}));
const LETTRES_EPELEES_HANGUL: ReadonlyMap<string, string> = new Map(Object.entries({
  "에이": "a", "비": "b", "씨": "c", "디": "d", "에프": "f", "에이치": "h", "아이": "i", "제이": "j", "케이": "k", "엘": "l", "엠": "m",
  "엔": "n", "피": "p", "큐": "q", "알": "r", "에스": "s", "티": "t", "브이": "v", "더블유": "w", "엑스": "x", "와이": "y", "제트": "z",
}));
const LETTRES_EPELEES_THAIES: ReadonlyMap<string, string> = new Map(Object.entries({
  "เอ": "a", "บี": "b", "ซี": "c", "ดี": "d", "อี": "e", "เอฟ": "f", "จี": "g", "เอช": "h", "ไอ": "i", "เจ": "j", "เค": "k", "แอล": "l",
  "เอ็ม": "m", "เอ็น": "n", "โอ": "o", "พี": "p", "คิว": "q", "อาร์": "r", "เอส": "s", "ที": "t", "ยู": "u", "วี": "v", "ดับเบิลยู": "w",
  "เอ็กซ์": "x", "วาย": "y", "แซด": "z",
}));
/** Le sigle en tête d'une suite collée : les noms de lettres les plus longs d'abord (エイチ avant エイ), un séparateur (・) permis entre
 *  deux ; deux lettres au moins, sinon la suite reste telle quelle. `entier` : la suite entière doit être le sigle (le thaï, dont les
 *  mots commencent trop souvent par ces syllabes : ดี « bon », ที « à »). */
function siglePrefixe(suite: string, table: ReadonlyMap<string, string>, entier = false): string {
  const noms = [...table.keys()].sort((a, b) => b.length - a.length);
  let reste = suite, sigle = "";
  for (;;) {
    const r = reste.replace(/^[・･\s]+/u, "");
    const n = noms.find((x) => r.startsWith(x));
    if (n === undefined) break;
    sigle += table.get(n)!;
    reste = r.slice(n.length);
  }
  if (sigle.length < 2 || (entier && reste.trim() !== "")) return suite;
  return ` ${detacherLaForme(sigle, false)} ${reste}`;
}
export function siglesEnTete(nom: string, ecriture: "kana" | "hangul" | "thai"): string {
  if (ecriture === "kana") return nom.replace(/[\u30a0-\u30ff・･]+/gu, (m) => siglePrefixe(m, LETTRES_EPELEES_KANA));
  if (ecriture === "hangul") return nom.replace(/[\uac00-\ud7a3]+/gu, (m) => siglePrefixe(m, LETTRES_EPELEES_HANGUL));
  return nom.replace(/[\u0e00-\u0e7f]+/gu, (m) => siglePrefixe(m, LETTRES_EPELEES_THAIES, true));
}
/** Les sigles du Golfe écrits lettre par lettre SANS point (« ش م ح », « ذ م م ») : les lettres isolées qui se suivent se soudent
 *  quand leur soudure est une forme de la table, comme `unifier` soude la forme pointée (« ش.م.ح ») */
function siglesArabesEspaces(nom: string): string {
  return nom.replace(/(?<![\p{L}])[\u0600-\u06ff](?![\p{L}])(?:\s+[\u0600-\u06ff](?![\p{L}]))+/gu, (m) => {
    const soude = m.replace(/\s+/g, "");
    return GENERIQUES_ARABES.has(soude) ? soude : m;
  });
}
function arabe(nom: string): string {
  return siglesArabesEspaces(unifier(siglesEpeles(nom, LETTRES_EPELEES_ARABES, /^[\u0600-\u06ff]+$/u, cleEpelee, true)))
    /* les mots persans d'abord, entiers (voir GENERIQUES_PERSANS), puis les clés arabes de plusieurs mots (« حمل و نقل », « قطع الغيار ») :
       un mot seul les couperait */
    .replace(new RegExp(`(?<![\\p{L}])(?:${CLES_PERSANES.source})(?![\\p{L}])`, "gu"), (m) => ` ${GENERIQUES_PERSANS.get(m) ?? m} `)
    .replace(new RegExp(`(?<![\\p{L}])(?:${CLES_ARABES.source})(?![\\p{L}])`, "gu"), (m) => ` ${GENERIQUES_ARABES.get(m) ?? m} `)
    .replace(/[\u0600-\u06ff]+/gu, (mot) => {
      const generique = generiqueArabe(mot);
      if (generique !== undefined) return ` ${generique} `;
      /* l'article ال et le لل (« pour le ») en tête d'un mot d'au moins deux autres lettres
         deviennent un mot : « الذهب » se lit « al dhahab » comme le côté latin l'écrit */
      if (mot.length > 3 && mot.startsWith("ال")) return `al ${motAbjad(mot.slice(2), ARABE, false)}`;
      if (mot.length > 3 && mot.startsWith("لل")) return `lil ${motAbjad(mot.slice(2), ARABE, false)}`;
      /* le nom théophore soudé (« عبدالرحمن », « عبدالعزيز ») : « abd », « al » et le nom, comme le côté latin le scinde (voir
         `scinderAbd`, quatre lettres au moins derrière l'article) ; « عبدالله » reste entier, comme « Abdullah » et « Abdulla » */
      if (mot.length >= 8 && mot.startsWith("عبدال")) return `abd al ${motAbjad(mot.slice(5), ARABE, false)}`;
      return motAbjad(mot, ARABE, false);
    });
}

const CLES_HEBREUX = alternative(GENERIQUES_HEBREUX);
/**
 * Un mot hébreu, lettre à lettre. Le ו est une consonne (v) en tête de mot, devant un autre ו (le premier des deux : שיווק,
 * shivuk) et devant un י (לויצקי : Levitski, jamais « loitski » ; tour 17) ; ailleurs il est la voyelle o ou u (דוברת : dobrt,
 * אורות : orot). Le י est une consonne (y) en tête et devant un autre י, la voyelle i ailleurs. Le כ se lit k en tête de mot et kh
 * ailleurs (ברכה : brakha, comme « Bracha » et « Brakha » l'écrivent), le ך toujours kh. Le ה final est une voyelle et tombe. Une
 * lettre suivie d'un geresh se lit dans GERESH_HEBREU. Un « h » qui suivrait une lettre avec laquelle il formerait un digramme
 * (t + ה) est séparé par un a, pour que la lecture des consonnes ne se trompe pas de lettre.
 */
function motHebreu(mot: string): string {
  const lettres = [...mot];
  let sortie = "";
  for (let i = 0; i < lettres.length; i++) {
    const c = lettres[i]!;
    if (GERESH.test(c)) continue;
    const geresh = GERESH.test(lettres[i + 1] ?? "");
    let l = geresh ? GERESH_HEBREU.get(c) ?? HEBREU.get(c) : HEBREU.get(c);
    if (l === undefined) { sortie += c; continue; }
    if (!geresh && c === "ו") l = i === 0 || lettres[i + 1] === "ו" || lettres[i + 1] === "י" ? "v" : "o";
    if (!geresh && c === "י") l = i === 0 || lettres[i + 1] === "י" ? "y" : "i";
    /* le כ est kh sauf en tête du mot ou de son radical, derrière une lettre de préfixe (ה, ו, ב, ל, מ, ש : הכרמל, ha-Karmel) où l'article
       le double et le durcit (« HADAR HACARMEL » perdu face à הדר הכרמל, mesuré le 28/09) */
    if (!geresh && c === "כ" && i > 0 && !(i === 1 && "הובלמש".includes(lettres[0]!))) l = "kh";
    if (c === "ה" && i === lettres.length - 1 && i > 0) l = "";
    if (l === "h" && /[tdkszgcp]$/.test(sortie)) l = "ah";
    sortie += l;
  }
  return sortie;
}
function hebreu(nom: string): string {
  return unifier(nom)
    .replace(new RegExp(`(?<![\\p{L}])(?:${CLES_HEBREUX.source})(?![\\p{L}])`, "gu"), (m) => ` ${GENERIQUES_HEBREUX.get(m) ?? m} `)
    .replace(/[\u0590-\u05ff]+(?:[׳'’][\u0590-\u05ff]*)*/gu, (mot) => {
      const generique = generiqueHebreu(mot);
      if (generique !== undefined) return ` ${generique} `;
      return motHebreu(mot);
    });
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
  return clePleine(mot, abjad).replace(/[aeiou]/g, "").replace(/(.)\1+/g, "$1");
}
/** LA CLÉ COURTE d'un mot de moins de trois consonnes (« Ben », « Ami », « Bay », « Tzur », « Yazd », « Khoury », « Haddad » dont le
 *  double d se replie) : les mêmes consonnes que `cleAbjad`, et les voyelles que l'abjad ÉCRIT (ו et و : o et u, une classe ;
 *  י et ي : i ; le aw anglais que l'hébreu écrit ו : « Dawn », דון), les autres retirées. Deux consonnes seules se rencontrent
 *  trop ; deux consonnes et les mêmes voyelles longues sont un mot (tour 17, jeu 21 : « Or Hagalim » passait, « Tzur Amitai
 *  Logistics » restait à 0,313, « Zohar Bay » à 0,564). Le score et l'index l'emploient ensemble (voir CREDIT_ABJAD). */
export function cleAbjadVoyelles(mot: string, abjad: Abjad): string {
  return clePleine(mot, abjad).replace(/(ou|oo|u)/g, "o").replace(/[ae]/g, "").replace(/(.)\1+/g, "$1");
}
/** Les consonnes d'un mot ramenées à leurs classes, voyelles encore en place : ce que les deux clés partagent. */
function clePleine(mot: string, abjad: Abjad): string {
  /* l'orthographe ANGLAISE d'un mot que l'abjad écrit comme il se prononce (« سولوشنز » solutions, « נאנומושן » Nanomotion) : -tion
     et -sion se disent shn, qu'aucune lecture d'un abjad n'écrit ; et, en arabe seulement, le g doux devant e, i, y se dit j
     (« داميج » damage), quand l'hébreu garde le g dur de ses noms (« Negev », « Segev » : ג) (registre GLEIF, 30/09/2026) */
  if (abjad !== "thai") mot = mot.replace(/[ts]ion/g, "shn");
  if (abjad === "arabe") mot = mot.replace(/g(?=[eiy])/g, "j");
  if (abjad === "hebreu") return cleHebraique(mot);
  /* arabe et persan : v est و, dj est ج (voie arabe), x est ks (إكسبرس : Express) ; thaï : le côté latin
     écrit les aspirées avec ou sans h (Kenanga, Khenangka ; Pattaya, Phatthaya), จ s'écrit ch ou j et se lit t
     en finale (Rungroj, Rungrot) : kh, ph, th sont k, p, t, j est ch, et un ch final est t */
  let m = abjad === "thai" ? mot.replace(/[vw]/g, "b").replace(/kh/g, "k").replace(/ph/g, "p").replace(/th/g, "t").replace(/j/g, "ch").replace(/ch$/, "t")
    : mot.replace(/x/g, "ks").replace(/v/g, "w").replace(/dj/g, "j")
      /* le ه final d'Allah (عبدالله, نصرالله) que l'anglais écrit ou non (« Abdullah », « Abdulla ») : derrière un double l, il tombe
         des deux côtés (jeu 21, tour 17 : « عبدالله قاسم الزرعوني » face à « Abdulla Qasim Al Zarooni » à 0,714) */
      .replace(/(?<=ll[aeiou]?)h$/, "");
  return m.replace(/(tsch|sch|tch|ch|sh)/g, "X").replace(/kh/g, "h").replace(/zh/g, "j").replace(/(th|dh)/g, "t").replace(/ph/g, "f")
    .replace(/gh/g, "k").replace(/ck/g, "k").replace(/(ts|tz|z)/g, "s").replace(/c(?=[ei])/g, "s").replace(/[cq]/g, "k")
    .replace(/g/g, "k").replace(/b/g, "p").replace(/d/g, "t").replace(/y/g, "i");
}
/**
 * LA CLÉ HÉBRAÏQUE d'un mot, celle que la lecture de l'écriture (`motHebreu`) et les graphies latines partagent (tour 17,
 * jeu 21). Les lettres que l'hébreu écrit d'une seule lettre sont une classe : ב, ו et פ (b, v, w, p, f : « Dovrat » et דוברת,
 * « Ofira » et אופירה) ; ח, כ et ה (ch, kh, h : « Chaim », « Haim » ; « Bracha », « Brakha ») ; צ, ז, ס et ש (ts, tz, z, s, sh :
 * le שׂ se lit s, « Sorek » et שורק) ; ט et ת (t, th) ; ק, כ et ג (k, q, c, g) ; ד (d) ; י (y, j : une voyelle). Le ch de צ׳
 * (« Gurevich », « Rabinovitch ») rejoint le ח, parce que la lecture l'écrit ch aussi ; sch et sh sont le ש. Le w après une
 * voyelle et devant une consonne est la voyelle ו (« Dawn », דון : don ; le aw se lit o, « Brown », בראון), pas un ב. Le x est
 * ks (« Express », אקספרס). Le y et le j se lisent AVANT que le ג׳ ne compte, parce que « Yosef » et « Josef » sont un même יוסף.
 * Les voyelles restent en place ici : `cleAbjad` les retire, `cleAbjadVoyelles` garde celles que l'hébreu écrit.
 */
function cleHebraique(mot: string): string {
  return mot.replace(/x/g, "ks").replace(/ph/g, "f").replace(/f/g, "p")
    .replace(/aw(?![aeiou])/g, "o").replace(/(?<=[aeiou])w(?![aeiou])/g, "").replace(/[vw]/g, "b")
    .replace(/(tsch|tch|sch|sh|ch|kh)/g, (d) => (d === "sch" || d === "sh" ? "X" : "h"))
    .replace(/(th|dh)/g, "t").replace(/(ts|tz|z)/g, "s").replace(/c(?=[ei])/g, "s").replace(/[cq]/g, "k").replace(/g/g, "k")
    .replace(/b/g, "p").replace(/d/g, "t").replace(/[yj]/g, "i").replace(/X/g, "s");
}

/** La clé d'un mot latin dont la finale « -at » ou « -et » peut être une ta marbuta (ة) lue en
 *  annexion : « Zahrat Al Waha » (زهرة الواحة, la fleur de l'oasis), que le côté abjad lit
 *  « zahra », la ة rendue « a ». La même clé, sans ce t ; undefined quand la finale n'est pas
 *  celle-là. Jeu 9, 27/09 : « Zahrat Al Waha Petrochem FZE » et « زهرة الواحة للبتروكيماويات م.م.ح »
 *  restaient plafonnés au possible (0,800), « zahrat » un mot court à une lettre de « zahra ». */
export function cleAbjadSansTa(mot: string): string | undefined {
  return mot.length >= 4 && /[ae]t$/.test(mot) ? cleAbjad(mot.slice(0, -1), "arabe") : undefined;
}

/** La clé d'un mot latin dont le « v » est un ف : l'arabe n'a pas de v, et il écrit les mots anglais qu'il emprunte avec
 *  un ف (« سيلفر » Silver, « سيفن » Seven, « فيكتوري » Victory), là où le persan écrit son v par و (« Kaveh » : la clé
 *  ordinaire, v lu w). La même clé, v lu f ; undefined quand le mot n'a pas de v. Jeu 13, 27/09 : « Silver Dune Logistics
 *  FZCO » restait à 0,450 face à « سيلفر ديون للخدمات اللوجستية ش.م.ح », slwr contre slfr. */
export function cleAbjadVLuF(mot: string): string | undefined {
  return mot.includes("v") ? cleAbjad(mot.replace(/v/g, "f"), "arabe") : undefined;
}

/** L'abjad dans lequel un nom est écrit, s'il l'est ; le thaï compte ici (voir `cleAbjad`). */
export function abjadDe(nom: string): Abjad {
  return /[\u0600-\u06ff]/u.test(nom) ? "arabe" : /[\u0590-\u05ff]/u.test(nom) ? "hebreu" : /[\u0e00-\u0eff]/u.test(nom) ? "thai" : "";
}

/* ─────────────────────────── l'entrée ─────────────────────────── */

/**
 * Un nom, ses écritures non latines ramenées à des jetons latins ; `natifs` donne, pour chaque
 * jeton lu dans des sinogrammes, les caractères qu'il a lus. Un nom latin ressort tel quel.
 */
export function romaniser(nom: string, lecture: Lecture = "mandarin"): Romanise {
  const natifs = new Map<string, string>();
  /* les formes de compatibilité d'Asie de l'Est, ramenées à leurs lettres (tour 15, jeu 19) : le latin pleine chasse d'un document
     japonais (ＫＡＺＡＭＡＴＳＵ : KAZAMATSU), l'espace idéographique, les formes encerclées ㈱ et ㈜ ((株), (주)), le katakana demi-chasse */
  let t = nom.replace(/[\u3000\u3200-\u33ff\uff00-\uffef]/gu, (c) => c.normalize("NFKC"));
  const japonaisEcrit = estJaponais(t);
  if (/[\uac00-\ud7a3]/u.test(t)) t = hangul(siglesEnTete(t, "hangul"));
  /* les kana (kana.ts) : les kanji d'un nom japonais se lisent d'abord, parce que ヶ vit dans leur mot, puis chaque suite de kana ;
     la marque japonaise se lit sur le nom tel qu'écrit, avant que ses kana ne deviennent des lettres */
  if (/[\u3040-\u30ff]/u.test(t)) { t = siglesEnTete(t, "kana"); if (japonaisEcrit && /[\u4e00-\u9fff]/u.test(t)) t = japonais(t); t = kana(t); }
  if (/[\u4e00-\u9fff]/u.test(t) && !japonaisEcrit) t = lecture === "hanja" ? hanja(t, natifs) : hanzi(t, natifs, lecture);
  else if (/[\u4e00-\u9fff]/u.test(t)) t = japonais(t);
  if (/[\u0590-\u05ff]/u.test(t)) t = hebreu(t);
  if (/[\u0600-\u06ff]/u.test(t)) t = arabe(t);
  /* le géorgien (mkhedruli et mtavruli) et l'arménien, lus dans caucase.ts (tour 17, jeu 21) */
  if (/[\u10a0-\u10ff\u1c90-\u1cbf]/u.test(t)) t = georgien(t);
  if (/[\u0530-\u058f]/u.test(t)) t = armenien(t);
  /* le birman, le khmer et le lao (tour 18, jeu 22 : birman.ts, khmer.ts, lao.ts ; le lao se lit par le lecteur thaï, lettre pour lettre) */
  if (/[\u1000-\u109f\uaa60-\uaa7f]/u.test(t)) t = birman(t);
  if (/[\u1780-\u17ff]/u.test(t)) t = khmer(t);
  if (/[\u0e80-\u0eff]/u.test(t)) t = lao(t);
  if (/[\u0e00-\u0e7f]/u.test(t)) t = thai(siglesEnTete(t, "thai"));
  if (/[\u0b80-\u0bff]/u.test(t)) t = tamoul(t);
  if (DEVANAGARI.test(t)) t = devanagari(t);
  return { texte: t, natifs };
}
