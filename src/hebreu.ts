/**
 * L'HÉBREU ROMANISÉ ET LE CLAVARDAGE ISRAÉLIEN (tour 17, jeu 21). L'écriture hébraïque se lit dans ecritures.ts ; ici vit
 * ce qu'un nom écrit en lettres latines porte de l'hébreu : les mots du commerce qu'un clavardage translittère au lieu de
 * traduire (« hevrat dovrat plastik » est « Dovrat Plastics Ltd », « Shaltiel Hovalot Ltd » « Shaltiel Transport Ltd »), la
 * forme בע"מ écrite « baam », et les prénoms qui sont souvent la seule trace de la langue dans un nom de société (« Chaim
 * Shapiro Metal Works » face à « Haim Shapiro Metal Works » : ch et h ne sont un même ח que sous la marque hébraïque).
 * Des tables du monde : les mots d'une langue, ses prénoms les plus portés, pas ceux du jeu.
 */

/** Les prénoms hébreux les plus portés, sous leurs graphies anglaise et française (ch, kh, h pour ח ; tz, ts, z pour צ),
 *  hors de ceux que d'autres langues portent aussi (David, Sara, Dan, Tal, Gil, Guy, Roni). */
export const PRENOMS_HEBREUX: ReadonlySet<string> = new Set([
  "chaim", "haim", "hayim", "khaim", "moshe", "moche", "yitzhak", "itzhak", "yitschak", "yitzchak", "yitshak", "itzik", "avraham", "avram",
  "yaakov", "yakov", "yacov", "shlomo", "yosef", "yossef", "yossi", "yehuda", "yehudah", "menachem", "menahem", "mordechai", "mordechay",
  "mordekhai", "eliyahu", "eliahu", "shmuel", "baruch", "barukh", "tzvi", "zvi", "yehezkel", "yechezkel", "yechiel", "yehiel", "yoav",
  "yonatan", "yoram", "yuval", "zeev", "aryeh", "arieh", "chanan", "hanan", "nachum", "nahum", "nachman", "nahman", "pinchas", "pinhas",
  "reuven", "tuvia", "tzadok", "zadok", "elchanan", "elhanan", "nissim", "ovadia", "ovadya", "rachamim", "rakhamim", "shimon", "shaul",
  "shlomi", "yair", "yaron", "itamar", "gilad", "eitan", "eytan", "doron", "ronen", "tomer", "avner", "shaltiel", "yitzhaki", "nachshon",
  "bracha", "brakha", "beracha", "rivka", "rivkah", "chana", "tzipora", "tzipi", "zipora", "shoshana", "shoshanna", "chaya", "malka",
  "yael", "yaffa", "yafa", "tova", "tovah", "orit", "dalia", "dalya", "michal", "tamar", "shira", "hadas", "hadassa", "hadassah", "batya",
  "batsheva", "devora", "dvora", "ahuva", "aviva", "nechama", "nehama", "penina", "pnina", "tehila", "zehava", "ziva", "ronit", "sigalit",
  "yardena", "ayelet", "meital", "ofra", "osnat", "revital", "rinat", "shlomit", "tikva", "vered", "yehudit", "nurit", "galit", "irit",
]);

/** Les mots hébreux du commerce et de la société, romanisés comme un clavardage ou un registre les écrit : la société de (חברת,
 *  « hevrat », « chevrat »), la forme (בע"מ, « baam »), les transports (הובלות, « hovalot »), l'emballage (אריזות, « arizot »), le
 *  commerce (סחר, מסחר), la commercialisation (שיווק), l'import et l'export (יבוא, יצוא), les industries (תעשיות), la construction
 *  (בניה), les services (שירותים), la navigation (ספנות), l'alimentation (מזון), les pièces (חלקים), les travaux (עבודות). */
export const TRADUCTIONS_HEBRAIQUES: ReadonlyMap<string, string> = new Map(Object.entries({
  hevrat: "", chevrat: "", khevrat: "", hevra: "", chevra: "", baam: "ltd", hovalot: "transport", hovala: "transport", hovalah: "transport",
  arizot: "packaging", ariza: "packaging", arizah: "packaging", sachar: "trade", sakhar: "trade", mischar: "trading", miskhar: "trading",
  mishar: "trading", shivuk: "marketing", shivouk: "marketing", yevu: "import", yevou: "import", yitzu: "export", yetzu: "export", yitsu: "export",
  taasiyot: "industries", taasiot: "industries", taasiya: "industry", taasia: "industry", bniya: "construction", bniyah: "construction",
  binyan: "building", sherutim: "services", sheirutim: "services", sapanut: "shipping", spanut: "shipping", mazon: "food", chalakim: "parts",
  khalakim: "parts", halakim: "parts", avodot: "works", pitronot: "solutions", logistika: "logistics", achzakot: "holdings", akhzakot: "holdings",
  hashkaot: "investments", kvutzat: "group", kvutsat: "group", tozeret: "produce", totzeret: "produce",
}));

/** Un mot latin qui dit l'hébreu : un mot du commerce hébreu, un prénom, ou le tz en tête d'un mot de quatre lettres au moins
 *  (Tzur, Tzemach, Tzipora : le צ initial, qu'aucune autre orthographe latine n'écrit en tête de mot). */
export function estMarqueurHebreu(j: string): boolean {
  return TRADUCTIONS_HEBRAIQUES.has(j) || PRENOMS_HEBREUX.has(j) || (j.length >= 4 && j.startsWith("tz"));
}
