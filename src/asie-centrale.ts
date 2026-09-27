/**
 * L'ASIE CENTRALE SUR LES DOCUMENTS : le kazakh, l'ouzbek et le kirghiz (tour 13, jeu 17). Une même raison sociale
 * s'y écrit en cyrillique national (Ақжайық Ұн Диірмені), en cyrillique tapé au clavier russe, qui n'a pas le қ
 * (Акжайык Ун Диирмени), dans le latin ancien des documents, qui romanise ce clavier russe (Akzhaiyk Un Diirmeni), dans
 * le latin kazakh de 2017 aux apostrophes (Ko'ks'etau Bi'dai' Eksport JS'S), celui de 2018 aux accents aigus (Ońtústik
 * Astyq JShS) et celui de 2021 (Şyğys Nan Önımderı JŞS, Qyzyljar Dän Terminal), et l'ouzbek latin garde ses apostrophes
 * et son x (Bug'doy, Buxoro, Xorazm) là où le russe écrit Bukhara et Khorezm.
 *
 * Le parti : tout se ramène au CLAVIER RUSSE et à son latin ancien, que le pli slave (`pliSlave`, mots.ts) et la marque
 * slave (preparation.ts) lisent déjà pour le russe et l'ukrainien ; ce fichier ne tient que des TABLES DU MONDE, un
 * alphabet, des toponymes sous leurs deux noms officiels, les mots du commerce d'une langue. Les formes juridiques
 * (ТОО, ЖШС, JŞS, МЧЖ, ОсОО, ЖК) vivent avec les autres dans FORMES (preparation.ts).
 */

/** LES LETTRES CYRILLIQUES QUE LE RUSSE N'A PAS, ramenées à la lettre du clavier russe : le kazakh (ә ғ қ ң ө ұ ү һ ; son
 *  і est déjà celui de l'ukrainien), l'ouzbek (ў ғ қ ҳ), le kirghiz (ң ө ү), le tadjik (ҷ ӯ ӣ ғ қ ҳ), le tatar et le
 *  bachkir (җ ҡ ҙ ҫ). « Ақжайық » devient « Акжайык », ce qu'un opérateur tape au clavier russe et ce que le latin ancien
 *  des documents romanise (Akzhaiyk). Lu AVANT la table de translittération, qui laisse passer l'inconnu tel quel (mesuré
 *  le 30/09 : « aқzhaiyқ », deux lettres cyrilliques orphelines dans un mot latin, 0,480 face à « Akzhaiyk »). */
const LETTRES_TURCIQUES: ReadonlyMap<string, string> = new Map(Object.entries({
  "ә": "а", "ғ": "г", "қ": "к", "ң": "н", "ө": "о", "ұ": "у", "ү": "у", "һ": "х",
  "ў": "у", "ҳ": "х", "ҷ": "ч", "ӯ": "у", "ӣ": "и", "җ": "ж", "ҡ": "к", "ҙ": "з", "ҫ": "с",
}));
const LETTRES_TURCIQUES_RE = /[әғқңөұүһўҳҷӯӣҗҡҙҫӘҒҚҢӨҰҮҺЎҲҶӮӢҖҠҘҪ]/gu;
/** « АҚ » (акционерлік қоғам, la société par actions kazakhe), écrit en capitales avec son қ : la forme AQ du latin de 2021,
 *  et non le mot « ақ » (blanc) que « Ақ Бидай » porte en tête ; lu avant que le қ ne devienne un к et « АҚ » un « ak »
 *  qui est partout des initiales (A.K.). */
const FORME_AQ = /(?<![\p{L}])АҚ(?![\p{L}])/gu;
export function plierCyrilliqueTurcique(nom: string): string {
  if (!/[Ѐ-ӿ]/.test(nom)) return nom;
  return nom.replace(FORME_AQ, "AQ").replace(LETTRES_TURCIQUES_RE, (c) => {
    const bas = LETTRES_TURCIQUES.get(c.toLowerCase());
    if (bas === undefined) return c;
    return c === c.toLowerCase() ? bas : bas.toUpperCase();
  });
}

/** LES LETTRES LATINES GLISSÉES DANS UN MOT CYRILLIQUE par une lecture optique ou un clavier mêlé (« ATБACAP ACTЫK TPEЙД » :
 *  Атбасар Астык Трейд, jeu 17, 0,336) : les homoglyphes, ces capitales et minuscules que les deux alphabets dessinent pareil
 *  (le i latin et le і ukrainien et kazakh compris). Un mot qui mêle les deux écritures et dont chaque lettre latine est un
 *  homoglyphe est un mot cyrillique ; une seule lettre latine qui n'en est pas un (« DigitalСервис ») le laisse tel quel. */
const HOMOGLYPHES: ReadonlyMap<string, string> = new Map(Object.entries({
  A: "А", a: "а", B: "В", C: "С", c: "с", E: "Е", e: "е", H: "Н", K: "К", k: "к", M: "М", O: "О", o: "о", P: "Р", p: "р",
  T: "Т", X: "Х", x: "х", Y: "У", y: "у", I: "І", i: "і",
}));
export function lireMelangeCyrillique(nom: string): string {
  if (!/[Ѐ-ӿ]/.test(nom) || !/[A-Za-z]/.test(nom)) return nom;
  return nom.replace(/\p{L}+/gu, (m) => {
    if (!/[Ѐ-ӿ]/.test(m) || !/[A-Za-z]/.test(m)) return m;
    if ([...m].some((c) => /[A-Za-z]/.test(c) && !HOMOGLYPHES.has(c))) return m;
    return [...m].map((c) => HOMOGLYPHES.get(c) ?? c).join("");
  });
}

/**
 * LES TROIS ALPHABETS LATINS DU KAZAKH, lus dans le latin ancien des documents. La normalisation ramène déjà à la lettre
 * de base ce qui porte un accent (ä ö ü ū ñ ğ ı, ń ǵ ó ú á : Öñdeu devient ondeu, comme Ondeu) ; restent ce qu'elle
 * lirait de travers : le ş et le ç de 2021 (Şyğys : Shygys, pas Sygys), le ý de 2018 (у : Taý, Tau), et les apostrophes
 * de 2017, qui font une lettre avec la précédente (s' est ш, c' ч, g' ғ, n' ң, a' ә, o' ө, u' ү, i' и, y' у) là où la
 * préparation soude « O'Brien » en ôtant l'apostrophe (« Ko'ks'etau » devenait « Koksetau », 0,661 face à Көкшетау).
 * Sous une PRÉSOMPTION seulement, parce que ş et ç sont turcs et roumains, ý tchèque et islandais, et que l'apostrophe
 * est arabe (Sa'id, As'ad) ou chinoise (Xi'an) : une forme kazakhe écrite dans l'un de ces alphabets (JŞS, JShS, JS'S,
 * AQ), la lettre ǵ qui n'est qu'à 2018, le ń avec un ý ou un ú (Ońtústik). Rien de plus lâche : deux apostrophes dont
 * l'une suit une consonne lisaient « As'ad Sa'id » en « Ashad Said » (mesuré le 30/09) ; le latin de 2017 sans sa forme
 * reste hors de portée.
 */
const APOSTROPHE = "['’ʼ`‘]";
const PRESOMPTION_KAZAKHE = new RegExp(`(?<![\\p{L}])(?:JŞS|JShS|JS${APOSTROPHE}S|AQ)(?![\\p{L}])|[ǵǴ]|(?=.*[ńŃ])(?=.*[ýÝúÚ])`, "u");
const DIGRAMMES_2017 = new RegExp(`([scgnaouiySCGNAOUIY])${APOSTROPHE}(?=\\p{L}|\\s|$)`, "gu");
const LECTURE_2017: ReadonlyMap<string, string> = new Map(Object.entries({
  s: "sh", c: "ch", g: "g", n: "n", a: "a", o: "o", u: "u", i: "i", y: "u",
  S: "Sh", C: "Ch", G: "G", N: "N", A: "A", O: "O", U: "U", I: "I", Y: "U",
}));
export function lireLatinKazakh(nom: string): string {
  if (!/[şŞçÇýÝ]|['’ʼ`‘]/u.test(nom)) return nom;
  if (!PRESOMPTION_KAZAKHE.test(nom)) return nom;
  return nom.replace(DIGRAMMES_2017, (_, l: string) => LECTURE_2017.get(l) ?? l)
    .replace(/ş/g, "sh").replace(/Ş/g, "Sh").replace(/ç/g, "ch").replace(/Ç/g, "Ch").replace(/ý/g, "u").replace(/Ý/g, "U");
}

/** LES TOPONYMES D'ASIE CENTRALE sous leur nom national et leur nom russe, en radical, le national ramené au russe AVANT le
 *  pli (comme LIEUX_UKRAINIENS) : Farg'ona et Fergana, Buxoro et Bukhara, Xorazm et Khorezm, Qashqadaryo et Kashkadarya,
 *  Surxon et Surkhan, Toshkent et Tashkent ; Türkistan et Turkestan, Shymkent et Chimkent, Ysyk-Köl et Issyk-Kul. Une même
 *  société porte l'un sur son extrait ouzbek et l'autre sur sa facture en russe (jeu 17 : « Fergana Don Mahsulotlari LLC »
 *  face à « Фарғона Дон Маҳсулотлари МЧЖ » à 0,499). Les graphies que le pli rejoint déjà (Samarqand, Samarkand ; Aqtöbe,
 *  Aktobe) n'y sont pas. Un radical court (kol, kul : le lac) ne vaut que mot entier. */
export const LIEUX_TURCIQUES: readonly (readonly [string, string])[] = [
  ["fargona", "fergana"], ["farghona", "fergana"], ["buxoro", "bukhara"], ["bukhoro", "bukhara"], ["xorazm", "khorezm"], ["khorazm", "khorezm"],
  ["qashqadaryo", "kashkadarya"], ["kashkadaryo", "kashkadarya"], ["surxon", "surkhan"], ["surkhon", "surkhan"], ["surxondaryo", "surkhandarya"],
  ["toshkent", "tashkent"], ["andijon", "andijan"], ["navoiy", "navoi"], ["jizzax", "jizzakh"], ["sirdaryo", "syrdarya"], ["zarafshon", "zarafshan"],
  ["qoraqalpog", "karakalpak"], ["turkistan", "turkestan"], ["shymkent", "chimkent"], ["kokshetau", "kokchetav"], ["qaragandy", "karaganda"],
  ["karagandy", "karaganda"], ["oskemen", "ust-kamenogorsk"], ["ysyk", "issyk"], ["kol", "kul"], ["xujand", "khujand"],
];

/** LES MOTS DU COMMERCE du kazakh, de l'ouzbek et du kirghiz, et les toponymes, qui marquent un nom d'Asie centrale (la
 *  marque slave, preparation.ts : le pli des romanisations du cyrillique s'ouvre sur lui) : astyq (le grain), diirmeni
 *  (le moulin), önimderi (les produits), sauda et savdo (le commerce), treid, servis et tranzit (l'anglais et le français
 *  translittérés du russe), bug'doy (le blé), guruch (le riz), mahsulotlari (les produits), tasymal (le transport), azyq
 *  (les vivres), korxona (l'entreprise), jamiyat (la société). PAS un (la farine), dän (le grain), nan (le pain), don :
 *  deux ou trois lettres que l'anglais et l'espagnol écrivent aussi. */
export const MARQUEURS_TURCIQUES: ReadonlySet<string> = new Set([
  "astyq", "astyk", "diirmeni", "diyrmeni", "dirmeni", "onimderi", "onimder", "sauda", "savdo", "treid", "servis", "tranzit", "eksport",
  "bugdoy", "bugdoi", "guruch", "mahsulotlari", "mahsulot", "makhsulotlari", "tasymal", "azyq", "azyk", "korxona", "korkhona",
  "jamiyat", "jamiyati", "zhamiyat", "seriktestik", "kasipker", "kompaniyasy", "kompaniyasi", "logistika", "zhem",
  "xorazm", "khorezm", "buxoro", "bukhara", "fargona", "fergana", "qashqadaryo", "kashkadarya", "surxon", "surkhan", "toshkent", "tashkent",
  "samarqand", "samarkand", "andijon", "andijan", "navoiy", "jizzax", "jizzakh", "sirdaryo", "syrdarya", "zarafshon", "zarafshan",
  "qyzylorda", "kyzylorda", "aqtobe", "aktobe", "atyrau", "oskemen", "semey", "shymkent", "chimkent", "kokshetau", "pavlodar",
  "karaganda", "qaragandy", "kostanay", "qostanai", "almaty", "astana", "taraz", "turkistan", "turkestan", "aktau", "mangystau",
  "mangistau", "bishkek", "talas", "naryn", "dushanbe", "khujand", "jetysu", "zhetysu", "jambyl", "zhambyl", "aqmola", "akmola",
]);
/** Leur traduction, sous la marque slave et le pli (voir TRADUCTIONS_SLAVES) : ce que le registre anglais de la même
 *  société écrit. « Treid » est trade (jeu 17 : « TOO Jetysu Agro Treid » face à « Jetysu Agro Trade LLP »), « servis »
 *  service, « tranzit » transit. Le possessif de l'izafet (terminali, kompaniyasi) rejoint le mot nu. */
export const TRADUCTIONS_TURCIQUES: ReadonlyMap<string, string> = new Map(Object.entries({
  treid: "trade", servis: "service", tranzit: "transit", astyq: "grain", diirmeni: "mill", onimderi: "products", sauda: "trading",
  savdo: "trading", bugdoy: "wheat", guruch: "rice", mahsulotlari: "products", mahsulot: "products", tasymal: "transport",
  azyq: "food", korxona: "enterprise", terminali: "terminal", kompaniyasy: "", kompaniyasi: "", jamiyati: "",
  /* жем (le fourrage) : sous sa clé, parce que « Jem » du latin de 2021 rejoignait par le pli le « yem » turc des tables (feed) et
     « Zhem » rien, un côté traduit et l'autre non (mesuré : « Qostanai Jem Azyq JŞS » perdu face à « Kostanai Zhem Azyk LLP ») */
  zhem: "feed",
}));
