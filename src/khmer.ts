/**
 * LE KHMER SUR LES DOCUMENTS (tour 18, jeu 22). Une raison sociale de Phnom Penh s'écrit dans son écriture (ក្រុមហ៊ុន កំពត ពន្លឺ
 * ទឹកត្រី ឯ.ក), dans le latin du registre (Kampot Ponleu Fish Sauce Co., Ltd.) et dans un latin d'usage sans norme, où la même
 * syllabe s'écrit Pich ou Pech, Chhouk ou Chouk, Sambath ou Sambat, Ponleu ou Ponlue. Ce fichier ne tient que des TABLES DU
 * MONDE : l'alphabet et ses deux séries, les formes, les mots du commerce, les toponymes, les mots pâlis et sanskrits des noms
 * (សម្បត្តិ Sambath, រស្មី Reaksmey, ភក្តី Pheakdey, សុវណ្ណ Sovann, រតនៈ Rotanak), et les marqueurs d'un nom latin.
 *
 * L'écriture khmère est un abugida à DEUX SÉRIES : la même voyelle se lit autrement selon la consonne qu'elle habille (កា ka,
 * គា kea ; កុ ko, គុ ku ; កី kei, គី ki), et la voyelle implicite est a dans la première série, o dans la seconde (សុខ Sok,
 * វិបុល Vibol). Une consonne souscrite (្) fait un groupe avec la sienne (ក្រ kr, ត្រ tr) et prend la série de la consonne
 * dominante ; une consonne nue devant une autre ferme la syllabe (កំពត Kampot, មាស Meas). Les mots pâlis se lisent par la table :
 * leur graphie latine est une convention (Sambath, Reaksmey), pas une lecture.
 */

/** Les consonnes : la lettre latine et sa série (1 : voyelle implicite a ; 2 : o). ស ហ អ et les sonantes prennent la série
 *  de leur souscrite dans un groupe. */
const KHMER_CONSONNES: ReadonlyMap<string, readonly [string, 1 | 2]> = new Map(Object.entries({
  "ក": ["k", 1], "ខ": ["kh", 1], "គ": ["k", 2], "ឃ": ["kh", 2], "ង": ["ng", 2], "ច": ["ch", 1], "ឆ": ["chh", 1], "ជ": ["ch", 2],
  "ឈ": ["chh", 2], "ញ": ["nh", 2], "ដ": ["d", 1], "ឋ": ["th", 1], "ឌ": ["d", 2], "ឍ": ["th", 2], "ណ": ["n", 1], "ត": ["t", 1],
  "ថ": ["th", 1], "ទ": ["t", 2], "ធ": ["th", 2], "ន": ["n", 2], "ប": ["b", 1], "ផ": ["ph", 1], "ព": ["p", 2], "ភ": ["ph", 2],
  "ម": ["m", 2], "យ": ["y", 2], "រ": ["r", 2], "ល": ["l", 2], "វ": ["v", 2], "ស": ["s", 1], "ហ": ["h", 1], "ឡ": ["l", 1], "អ": ["", 1],
} as Record<string, readonly [string, 1 | 2]>));
/** Les consonnes qui, en tête d'un groupe, prennent la série de leur souscrite. */
const KHMER_SOUPLES: ReadonlySet<string> = new Set(["ស", "ហ", "អ", "ម", "ន", "ង", "ញ", "យ", "រ", "ល", "វ"]);
/** La finale d'une consonne : le r final s'écrit (Angkor), le ញ nh, le ស s. */
const KHMER_FINALES: ReadonlyMap<string, string> = new Map(Object.entries({
  "ក": "k", "ខ": "k", "គ": "k", "ឃ": "k", "ង": "ng", "ច": "ch", "ឆ": "ch", "ជ": "ch", "ឈ": "ch", "ញ": "nh", "ដ": "t", "ឋ": "th", "ឌ": "t",
  "ឍ": "th", "ណ": "n", "ត": "t", "ថ": "th", "ទ": "t", "ធ": "th", "ន": "n", "ប": "p", "ផ": "p", "ព": "p", "ភ": "p", "ម": "m", "យ": "y",
  "រ": "r", "ល": "l", "វ": "v", "ស": "s", "ហ": "h", "ឡ": "l", "អ": "",
}));
/** Les voyelles dépendantes, première et seconde série. */
const KHMER_VOYELLES: ReadonlyMap<string, readonly [string, string]> = new Map(Object.entries({
  "ា": ["a", "ea"], "ិ": ["i", "i"], "ី": ["ei", "i"], "ឹ": ["oe", "ue"], "ឺ": ["eu", "eu"], "ុ": ["o", "u"], "ូ": ["ou", "u"], "ួ": ["uo", "uo"],
  "ើ": ["ae", "eu"], "ឿ": ["oea", "oea"], "ៀ": ["ie", "ie"], "េ": ["e", "e"], "ែ": ["ae", "ae"], "ៃ": ["ai", "ey"], "ោ": ["ao", "ou"], "ៅ": ["au", "ov"],
  "ំ": ["am", "um"], "ះ": ["ah", "eah"], "ៈ": ["ak", "ok"],
} as Record<string, readonly [string, string]>));
/** Les voyelles indépendantes. */
const KHMER_INDEPENDANTES: ReadonlyMap<string, string> = new Map(Object.entries({
  "ឥ": "e", "ឦ": "ei", "ឧ": "o", "ឩ": "ou", "ឪ": "ov", "ឫ": "rue", "ឬ": "rue", "ឭ": "lue", "ឮ": "lue", "ឯ": "ae", "ឰ": "ai", "ឱ": "ao", "ឳ": "au",
}));

/** Une consonne khmère et ce qui l'habille : ses souscrites, ses signes de voyelle (dans l'ordre écrit), un changement de série
 *  (៉ vers la première, ៊ vers la seconde), un ៍ qui l'éteint, un ់ qui abrège. */
type UniteKhmere = { c: string; sous: string[]; voy: string; serie: 1 | 2 | 0; morte: boolean };

function unitesKhmeres(mot: string): UniteKhmere[] {
  const u: UniteKhmere[] = [];
  const lettres = [...mot];
  for (let i = 0; i < lettres.length; i++) {
    const c = lettres[i]!;
    if (c === "្") { const s = lettres[i + 1]; const d = u[u.length - 1]; if (s !== undefined && d && KHMER_CONSONNES.has(s)) { d.sous.push(s); i++; } continue; }
    if (KHMER_CONSONNES.has(c)) { u.push({ c, sous: [], voy: "", serie: 0, morte: false }); continue; }
    const d = u[u.length - 1];
    if (!d) continue;
    if (KHMER_VOYELLES.has(c)) d.voy += c;
    else if (c === "៉") d.serie = 1;
    else if (c === "៊") d.serie = 2;
    else if (c === "៍") d.morte = true;
  }
  return u;
}

/** Une syllabe : attaque (la consonne et ses souscrites), voyelle selon la série, finale. */
function serieDe(t: UniteKhmere): 1 | 2 {
  if (t.serie !== 0) return t.serie;
  const s = t.sous[0];
  if (s !== undefined && KHMER_SOUPLES.has(t.c)) return KHMER_CONSONNES.get(s)![1];
  return KHMER_CONSONNES.get(t.c)![1];
}
function voyelleKhmere(voy: string, serie: 1 | 2, implicite: boolean): string {
  if (voy === "") return implicite ? (serie === 1 ? "a" : "o") : "";
  /* les voyelles composées écrites en deux signes : ុំ om/um, ាំ am/oam, ុះ oh/uh, េះ eh, ោះ aoh/uoh, ិះ eh/ih */
  const composees = new Map<string, readonly [string, string]>([["ុំ", ["om", "um"]], ["ាំ", ["am", "oam"]], ["ុះ", ["oh", "uh"]], ["េះ", ["eh", "eh"]], ["ោះ", ["aoh", "uoh"]], ["ិះ", ["eh", "ih"]]]);
  const c = composees.get(voy);
  if (c !== undefined) return c[serie - 1];
  return [...voy].map((v) => KHMER_VOYELLES.get(v)?.[serie - 1] ?? "").join("");
}

/** Un mot khmer, syllabe par syllabe, en un seul jeton (le latin soude : Kampot, Chanthou, Sovann). Une consonne nue (sans
 *  voyelle ni souscrite) devant une consonne habillée, ou en fin de mot, est la finale de la syllabe qui précède ; en tête de
 *  syllabe elle porte la voyelle implicite. Le ្រ final est muet (ពេជ្រ pech). */
export function khmerEnLatin(mot: string): string {
  const u = unitesKhmeres(mot);
  const n = u.length;
  const nue = (k: number) => k < n && u[k]!.voy === "" && u[k]!.sous.length === 0 && !u[k]!.morte;
  let s = "";
  let i = 0;
  while (i < n) {
    const t = u[i]!;
    if (t.morte) { i++; continue; }
    const serie = serieDe(t);
    const attaque = KHMER_CONSONNES.get(t.c)![0] + t.sous.map((c) => KHMER_CONSONNES.get(c)![0]).join("");
    /* une consonne nue en fin de mot après une syllabe déjà lue n'ouvre rien : elle a été prise en finale */
    let fin = "";
    const fermante = i + 1 < n && nue(i + 1) && (i + 2 >= n || !nue(i + 2));
    /* une finale portée par une souscrite (ជ្រ, ត្ថ) en fin de mot : la consonne principale se lit, la souscrite se tait */
    const finaleSouscrite = i + 1 < n && i + 1 === n - 1 && u[i + 1]!.voy === "" && u[i + 1]!.sous.length > 0 && !u[i + 1]!.morte;
    if (fermante || finaleSouscrite) { fin = KHMER_FINALES.get(u[i + 1]!.c) ?? ""; i++; }
    /* la voyelle ៈ appelle une consonne finale k dans les mots pâlis (រតនៈ rotanak) : elle la porte elle-même */
    s += attaque + voyelleKhmere(t.voy, serie, true) + fin;
    i++;
  }
  return s;
}

/** Les mots khmers que le registre anglais TRADUIT (formes, commerce, lieux) ou écrit d'une graphie convenue (les mots pâlis et
 *  sanskrits des noms). Les plus longs se lisent d'abord. */
const GENERIQUES_KHMERS: ReadonlyMap<string, string> = new Map(Object.entries({
  /* formes */ "ក្រុមហ៊ុន": "company", "ឯ.ក": "ltd", "ឯកជនទទួលខុសត្រូវមានកម្រិត": "ltd", "ឯកជន": "private", "មហាជន": "plc", "សហគ្រាស": "enterprise",
  "សាខា": "branch", "ក្រុម": "group", "អង្គការ": "organisation",
  /* le commerce */ "ពាណិជ្ជកម្ម": "trading", "ជំនួញ": "trading", "ដឹកជញ្ជូន": "transport", "ភស្តុភារ": "logistics", "កសិកម្ម": "agriculture",
  "ទឹកត្រី": "fish sauce", "ត្រី": "fish", "អង្ករ": "rice", "ស្រូវ": "rice", "នាំចូលនាំចេញ": "import export", "នាំចូល នាំចេញ": "import export",
  "នាំចូល": "import", "នាំចេញ": "export", "សំណង់": "construction", "សាងសង់": "construction", "ឧស្សាហកម្ម": "industry", "ផលិតកម្ម": "production",
  "ផលិត": "production", "សេវាកម្ម": "services", "អភិវឌ្ឍន៍": "development", "វិនិយោគ": "investment", "អន្តរជាតិ": "international", "ធនាគារ": "bank",
  "ធានារ៉ាប់រង": "insurance", "សណ្ឋាគារ": "hotel", "ទេសចរណ៍": "tourism", "សម្ភារៈ": "materials", "គ្រឿងសំណង់": "building materials", "រ៉ែ": "mining",
  "ថាមពល": "energy", "ប្រេង": "oil", "ឧស្ម័ន": "gas", "សំលៀកបំពាក់": "garment", "កាត់ដេរ": "garment", "វាយនភណ្ឌ": "textile", "ម្ហូបអាហារ": "food",
  "អាហារ": "food", "ភេសជ្ជៈ": "beverage", "ឈើ": "timber", "កៅស៊ូ": "rubber", "ដំណាំ": "crops", "ស្ករ": "sugar", "កាហ្វេ": "coffee", "ជាតិ": "national",
  "សេដ្ឋកិច្ច": "economic", "ពាណិជ្ជ": "commercial",
  /* les lieux */ "កម្ពុជា": "cambodia", "ខ្មែរ": "khmer", "ភ្នំពេញ": "phnom penh", "កំពត": "kampot", "កំពង់ចាម": "kampong cham", "កំពង់សោម": "kampong som",
  "កំពង់": "kampong", "សៀមរាប": "siem reap", "បាត់ដំបង": "battambang", "ព្រះសីហនុ": "preah sihanouk", "សីហនុ": "sihanouk", "កណ្ដាល": "kandal",
  "តាកែវ": "takeo", "កោះកុង": "koh kong", "កែប": "kep", "ព្រៃវែង": "prey veng", "ស្វាយរៀង": "svay rieng", "ក្រចេះ": "kratie", "ពោធិ៍សាត់": "pursat",
  "មេគង្គ": "mekong", "ទន្លេសាប": "tonle sap", "អង្គរ": "angkor",
  /* les mots pâlis et sanskrits des noms, dans leur graphie convenue */ "សម្បត្តិ": "sambath", "រស្មី": "reaksmey", "ភក្តី": "pheakdey", "ធីតា": "thida",
  "សុវណ្ណ": "sovann", "រតនៈ": "rotanak", "រតនា": "ratana", "សុភា": "sophea", "សុផល": "sophal", "សុភ័ក្ត": "sopheak", "ចន្ទ": "chan", "រិទ្ធ": "rith",
  "សុរិយា": "soriya", "វណ្ណា": "vanna", "រ័ត្ន": "roat", "បូរី": "borey", "ពិសិដ្ឋ": "piseth", "ចម្រើន": "chamroeun", "សេរី": "serey", "ដារ៉ា": "dara",
  "បញ្ញា": "panha", "កុសល": "kosal", "សុធា": "sothea", "សុគន្ធ": "sokun", "សុវត្ថិ": "sovath", "វុទ្ធី": "vuthy", "ខេមរា": "khemara", "ធារី": "theary",
  "សិរី": "serey",
}));

function alternative(table: ReadonlyMap<string, string>): RegExp {
  const cles = [...table.keys()].sort((a, b) => b.length - a.length).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`(?:${cles.join("|")})(?![\\u17b4-\\u17d3])`, "gu");
}
const CLES_KHMERES = alternative(GENERIQUES_KHMERS);
/** Le khmer : les chiffres, les mots de la table d'abord, les voyelles indépendantes, puis chaque suite de lettres syllabe par
 *  syllabe en un jeton ; la ponctuation (។ ៕) est une espace. */
export function khmer(nom: string): string {
  return nom.replace(/[០-៩]/gu, (c) => String(c.codePointAt(0)! - 0x17e0))
    .replace(/[។៕៖]/gu, " ")
    .replace(CLES_KHMERES, (m) => ` ${GENERIQUES_KHMERS.get(m) ?? m} `)
    .replace(/[ក-ឳ឴-៓]+/gu, (mot) => ` ${[...mot].map((c) => KHMER_INDEPENDANTES.get(c) ?? c).join("").replace(/[ក-ហឡអ][ក-ហឡអ្ា-៍]*/gu, khmerEnLatin)} `);
}

/* ─────────────────────────── le latin, sous une présomption ─────────────────────────── */

/** Les mots qui marquent un nom khmer romanisé : le pays, ses villes et provinces, le fleuve, la monnaie. */
export const MARQUEURS_KHMERS: ReadonlySet<string> = new Set([
  "cambodia", "cambodian", "kampuchea", "khmer", "phnom", "penh", "phnompenh", "kampot", "kampong", "angkor", "siem", "reap", "siemreap",
  "battambang", "sihanoukville", "sihanouk", "preah", "kandal", "takeo", "kratie", "pursat", "kohkong", "kep", "pailin", "banteay", "meanchey",
  "ratanakiri", "mondulkiri", "svay", "rieng", "prey", "veng", "stung", "treng", "tonle", "bavet", "poipet", "riel", "chhouk", "sovann", "reaksmey",
  "pheakdey", "sambath", "rotanak", "ratanak", "chanthou", "sokha", "sophea", "sopheap", "vibol", "ponleu",
]);
/** Un mot latin qui dit le khmer : un marqueur, le chh initial (Chhouk, Chhay, Chhun : la seconde série aspirée, qu'aucune autre
 *  orthographe latine n'écrit en tête), ou le ea d'un mot de cinq lettres au moins (Meas, Reaksmey, Pheakdey : la voyelle ា de
 *  seconde série) ; le dictionnaire anglais écarte ses mots (voir `analyserEntite`). */
export function estMarqueurKhmer(j: string): boolean {
  return MARQUEURS_KHMERS.has(j) || (j.length >= 4 && j.startsWith("chh")) || (j.length >= 5 && /ea/.test(j) && !/ean$|ear|eat/.test(j));
}
/** LA MÊME SYLLABE KHMÈRE SOUS DEUX GRAPHIES : chh et ch (Chhouk, Chouk), ea et a (Reaksmey, Raksmei ; Meas, Mas), ou et u
 *  (Chanthou, Chanthu ; Chhouk, Chuk), eu, ue et oe (Ponleu, Ponlue), th final et t (Sambath, Sambat), ey et ei finaux lus i,
 *  e et i (Pich, Pech), la voyelle implicite de la première syllabe o ou a (Rotanak, Ratanak), les lettres doublées (Sovann, Sovan). Sous la présomption khmère seulement, et la clé vaut un
 *  squelette égal (CREDIT_KHMER). */
export function pliKhmer(m: string): string {
  /* la voyelle implicite de la première syllabe, écrite o ou a (Rotanak, Ratanak : រតនៈ) */
  return m.replace(/^([^aeiou]+)o(?=[^aeiou][aeiou])/, "$1a").replace(/chh/g, "ch").replace(/ea/g, "a").replace(/ou/g, "u").replace(/eu|ue|oe/g, "u").replace(/th$/, "t")
    .replace(/ey$|y$/, "i").replace(/ei/g, "i").replace(/e/g, "i").replace(/(.)\1+/g, "$1");
}
export const CREDIT_KHMER = 0.95;
