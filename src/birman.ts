/**
 * LE BIRMAN SUR LES DOCUMENTS (tour 18, jeu 22). Une raison sociale de Yangon s'écrit dans son écriture (ဇော်မင်းထွန်း
 * ဆောက်လုပ်ရေး ကုမ္ပဏီလီမိတက်), dans le latin du registre (Zaw Min Htun Construction Co., Ltd.) et dans le latin d'usage,
 * qui n'a pas de norme : la même syllabe s'écrit Htun ou Tun, Myint ou Myin, Nwe ou Nway, Yadana ou Yadanar, Oo ou U. Ce
 * fichier ne tient que des TABLES DU MONDE : l'alphabet, les formes juridiques, les mots du commerce, les mots pâlis des
 * noms (ရတနာ Yadana, မင်္ဂလာ Mingala, သီရိ Thiri), les syllabes de noms les plus portées et les civilités.
 *
 * L'écriture birmane est un abugida : chaque consonne porte un a, que des signes remplacent (ာ a, ိ i, ု u, ေ e, ဲ e,
 * ော aw, ို o), qu'un ် (asat) éteint pour faire une finale (င် in, န် an, က် et, တ် at, ယ် e), et que des médianes
 * modifient (ျ ြ y, ွ w, ှ h). La lecture suit L'USAGE LATIN des registres et des passeports, pas la MLCTS : ကျော် Kyaw,
 * အောင် Aung, နိုင် Naing, ထွန်း Htun, သိန်း Thein, ဖြိုး Phyo. Les tons (့ း) tombent, sauf qu'un ton grinçant sur une
 * finale nasale s'écrit d'ordinaire par un t (မြင့် Myint, ခန့် Khant, ညွန့် Nyunt). Les syllabes sortent SÉPARÉES
 * par des espaces, comme le latin les écrit ([name removed]) ; les mots pâlis, que le latin soude (Yadana, Mingala,
 * Thiri, Zeyar), se lisent par la table. La sonorisation entre voyelles (ရတနာ yadana, pas yatana) ne se règle pas :
 * les mots où elle s'entend sont dans la table.
 */

/** Les consonnes, dans la graphie d'usage : ဆ s (San, Swe), ရ y (Yangon, Ywe ; r dans les mots pâlis, par la table),
 *  သ th (Thein, Thu), ထ ht (Htun, Htwe), ဖ ph (Phyo), အ le support d'une voyelle. */
const BIRMAN_CONSONNES: ReadonlyMap<string, string> = new Map(Object.entries({
  "က": "k", "ခ": "kh", "ဂ": "g", "ဃ": "g", "င": "ng", "စ": "s", "ဆ": "s", "ဇ": "z", "ဈ": "z", "ဉ": "ny", "ည": "ny",
  "ဋ": "t", "ဌ": "ht", "ဍ": "d", "ဎ": "d", "ဏ": "n", "တ": "t", "ထ": "ht", "ဒ": "d", "ဓ": "d", "န": "n",
  "ပ": "p", "ဖ": "ph", "ဗ": "b", "ဘ": "b", "မ": "m", "ယ": "y", "ရ": "y", "လ": "l", "ဝ": "w", "သ": "th", "ဟ": "h", "ဠ": "l", "အ": "",
}));
/** La classe d'une consonne éteinte en finale : k (က ခ ဂ), t (စ ဇ ဋ ဌ ဍ ဎ တ ထ ဒ ဓ သ), p (ပ ဖ ဗ ဘ), ng (င), n (ဉ ဏ န), m (မ),
 *  y (ယ), ny (ည), l (လ) ; ဟ ရ ဝ éteints ne s'entendent pas. */
const BIRMAN_FINALES: ReadonlyMap<string, string> = new Map(Object.entries({
  "က": "k", "ခ": "k", "ဂ": "k", "ဃ": "k", "င": "ng", "စ": "t", "ဇ": "t", "ဈ": "t", "ဉ": "n", "ည": "ny", "ဋ": "t", "ဌ": "t", "ဍ": "t", "ဎ": "t",
  "ဏ": "n", "တ": "t", "ထ": "t", "ဒ": "t", "ဓ": "t", "န": "n", "ပ": "p", "ဖ": "p", "ဗ": "p", "ဘ": "p", "မ": "m", "ယ": "y", "လ": "l", "ဠ": "l",
  "သ": "t", "ဟ": "", "ရ": "", "ဝ": "", "အ": "",
}));
/** Les voyelles indépendantes. */
const BIRMAN_INDEPENDANTES: ReadonlyMap<string, string> = new Map(Object.entries({
  "ဣ": "i", "ဤ": "i", "ဥ": "u", "ဦ": "u", "ဧ": "aye", "ဩ": "aw", "ဪ": "aw",
}));
/** Les signes de voyelle, codés d'une lettre : ာ ါ A, ိ i, ီ I, ု u, ူ U, ေ e, ဲ E, ံ M (l'anusvara). */
const BIRMAN_SIGNES: ReadonlyMap<string, string> = new Map([
  ["ာ", "A"], ["ါ", "A"], ["ိ", "i"], ["ီ", "I"], ["ု", "u"], ["ူ", "U"], ["ေ", "e"], ["ဲ", "E"], ["ံ", "M"],
]);
/** Les médianes : ျ ြ y, ွ w, ှ h. */
const BIRMAN_MEDIANES: ReadonlyMap<string, string> = new Map([["ျ", "y"], ["ြ", "y"], ["ွ", "w"], ["ှ", "h"]]);

/** Une consonne birmane et ce qui l'habille : médianes, signes de voyelle, asat (်), virama (္, la consonne empilée), ton
 *  grinçant (့). Le ton haut (း) tombe. */
type UniteBirmane = { c: string; med: string; voy: string; asat: boolean; virama: boolean; grincant: boolean };

function unitesBirmanes(mot: string): UniteBirmane[] {
  const u: UniteBirmane[] = [];
  for (const c of mot) {
    if (BIRMAN_CONSONNES.has(c)) { u.push({ c, med: "", voy: "", asat: false, virama: false, grincant: false }); continue; }
    const d = u[u.length - 1];
    if (!d) continue;
    const m = BIRMAN_MEDIANES.get(c);
    if (m !== undefined) { if (!d.med.includes(m)) d.med += m; continue; }
    const v = BIRMAN_SIGNES.get(c);
    if (v !== undefined) { if (!d.voy.includes(v)) d.voy += v; continue; }
    if (c === "်") d.asat = true;
    else if (c === "္") d.virama = true;
    else if (c === "့") d.grincant = true;
  }
  return u;
}

/** L'attaque d'une syllabe : la consonne et ses médianes (ကျ ky, ချ ch, ဂျ gy, ပြ py, ဖြ phy, မြ my ; မှ hm, နှ hn, လှ hl, ငှ hng,
 *  ညှ hny, ရှ ယှ လျှ sh ; ွ w). */
function attaqueBirmane(t: UniteBirmane): string {
  let base = BIRMAN_CONSONNES.get(t.c) ?? "";
  const y = t.med.includes("y"), h = t.med.includes("h"), w = t.med.includes("w");
  if (h) {
    if (t.c === "ရ" || t.c === "ယ" || (t.c === "လ" && y)) base = "sh";
    else if (["မ", "န", "င", "ည", "လ", "ဝ"].includes(t.c)) base = "h" + base;
  } else if (y) {
    const p = new Map([["က", "ky"], ["ခ", "ch"], ["ဂ", "gy"], ["ဃ", "gy"], ["ပ", "py"], ["ဖ", "phy"], ["ဗ", "by"], ["ဘ", "by"], ["မ", "my"], ["လ", "ly"]]);
    base = p.get(t.c) ?? base + "y";
  }
  if (w && !base.endsWith("w")) base += "w";
  return base;
}

/** La rime d'une syllabe dans la graphie d'usage : la voyelle écrite (ou le a implicite) et la finale. `w` dit que l'attaque
 *  porte la médiane ွ, qui s'écrit u devant une finale nasale (ထွန်း Htun, ကျွန်း Kyun) : la rime la consomme alors. */
function rimeBirmane(voy: string, fin: string, grincant: boolean, w: boolean): { rime: string; sansW: boolean } {
  const a = voy.includes("A"), i = voy.includes("i") || voy.includes("I"), u = voy.includes("u") || voy.includes("U");
  const e = voy.includes("e"), ai = voy.includes("E"), m = voy.includes("M");
  let r = "";
  let sansW = false;
  switch (fin) {
    case "": r = e && a ? "aw" : e ? "e" : ai ? "e" : i && u ? "o" : u && m ? "one" : m ? "an" : i ? "i" : u ? "u" : "a"; break;
    case "ng": r = e && a ? "aung" : i && u ? "aing" : u ? "aung" : "in"; if (grincant) r += "t"; break;
    case "n": case "m":
      if (i) r = "ein"; else if (u) r = "one"; else if (w) { r = "un"; sansW = true; } else r = "an";
      if (grincant && !r.endsWith("e")) r += "t";
      break;
    case "k": r = e && a ? "auk" : i && u ? "aik" : u ? "oke" : i ? "eik" : "et"; break;
    case "t": r = i ? "eik" : u ? "ote" : e ? "it" : "at"; break;
    case "p": r = i ? "eik" : u ? "oke" : "at"; break;
    case "y": r = "e"; break;
    case "ny": r = grincant ? "e" : "i"; break;
    case "l": r = i && u ? "o" : "al"; break;
    default: r = "a";
  }
  return { rime: r, sansW };
}

/** Un mot birman, syllabe par syllabe, chaque syllabe un jeton ([name removed]). Une consonne nue éteinte (် ou ္) est la finale
 *  de la syllabe qui précède ; l'asat porté par la consonne d'une voyelle écrite devant (ော် aw) n'éteint rien. */
export function birmanEnLatin(mot: string): string {
  const u = unitesBirmanes(mot);
  const n = u.length;
  const finale = (k: number) => k < n && (u[k]!.asat || u[k]!.virama) && u[k]!.voy === "" && u[k]!.med === "";
  const syllabes: string[] = [];
  let i = 0;
  while (i < n) {
    const t = u[i]!;
    if (finale(i)) { i++; continue; }
    let attaque = attaqueBirmane(t);
    let fin = "", grincant = t.grincant;
    if (finale(i + 1)) { fin = BIRMAN_FINALES.get(u[i + 1]!.c) ?? ""; grincant = grincant || u[i + 1]!.grincant; i++; }
    const { rime, sansW } = rimeBirmane(t.voy, fin, grincant, t.med.includes("w"));
    if (sansW) attaque = attaque.replace(/w$/, "");
    /* la voyelle e sans consonne (အေး, ဧ) s'écrit Aye */
    syllabes.push(attaque === "" && rime === "e" ? "aye" : attaque + rime);
    i++;
  }
  return syllabes.join(" ");
}

/** Les mots birmans que le registre anglais TRADUIT (formes, commerce, lieux) ou soude (les mots pâlis des noms : Yadana,
 *  Mingala, Thiri, Zeyar, Myitta, Naga, Nadi, Nila). Les plus longs se lisent d'abord ; « လုပ်ငန်း » (l'entreprise, l'activité)
 *  ne s'écrit pas en anglais (« သစ်လုပ်ငန်း » est Timber, « ငါးလုပ်ငန်း » Fishery). */
const GENERIQUES_BIRMANS: ReadonlyMap<string, string> = new Map(Object.entries({
  /* formes */ "ကုမ္ပဏီလီမိတက်": "co ltd", "ကုမ္ပဏီ လီမိတက်": "co ltd", "ကုမ္ပဏီ": "company", "လီမိတက်": "limited",
  "အများနှင့်သက်ဆိုင်သောကုမ္ပဏီ": "public company", "အများပိုင်ကုမ္ပဏီ": "public company", "ပုဂ္ဂလိက": "private",
  "ကော်ပိုရေးရှင်း": "corporation", "အုပ်စု": "group", "လုပ်ငန်းစု": "group", "ဂရု": "group", "ဟိုးလ်ဒင်း": "holdings", "ဦးပိုင်": "holdings",
  /* civilités */ "ဦး": "u", "ဒေါ်": "daw", "ဆရာ": "saya",
  /* la conjonction et la famille */ "နှင့်သားများ": "and sons", "နှင့်": "and", "သားများ": "sons", "ညီအစ်ကိုများ": "brothers", "ညီအစ်ကို": "brothers",
  /* le commerce */ "ကုန်သွယ်ရေး": "trading", "ကုန်သွယ်မှု": "trading", "ကုန်သွယ်": "trading", "ရောင်းဝယ်ရေး": "trading", "ကုန်စည်": "goods",
  "ဆောက်လုပ်ရေးပစ္စည်း": "building materials", "ဆောက်လုပ်ရေး": "construction", "ဆောက်လုပ်": "construction",
  "သစ်လုပ်ငန်း": "timber", "သစ်တော": "forest", "သစ်": "timber", "ငါးလုပ်ငန်း": "fishery", "ငါး": "fish",
  "ရေထွက်ပစ္စည်း": "marine products", "ရေထွက်": "fishery", "ရေလုပ်ငန်း": "fishery",
  "ကုန်ထုတ်လုပ်ငန်း": "production", "ကုန်ထုတ်": "production", "ထုတ်လုပ်ရေး": "manufacturing", "ထုတ်လုပ်မှု": "manufacturing", "ထုတ်လုပ်": "manufacturing",
  "သယ်ယူပို့ဆောင်ရေး": "logistics", "ပို့ဆောင်ရေး": "logistics", "သယ်ယူ": "transport",
  "ရေကြောင်းဝန်ဆောင်မှု": "marine services", "ရေကြောင်း": "marine", "ဝန်ဆောင်မှု": "services",
  "ရေနံနှင့်သဘာဝဓာတ်ငွေ့": "oil and gas", "ရေနံ": "petroleum", "သဘာဝဓာတ်ငွေ့": "gas",
  "စားသောက်ကုန်": "foodstuff", "အစားအသောက်": "food", "အစားအစာ": "food", "ဘိလပ်မြေ": "cement", "ဆန်စက်": "rice mill", "ဆန်": "rice", "စပါး": "paddy",
  "စိုက်ပျိုးရေး": "agriculture", "စိုက်ပျိုး": "agriculture", "မွေးမြူရေး": "livestock", "လယ်ယာ": "farm",
  "စက်မှုလုပ်ငန်း": "industry", "စက်မှု": "industrial", "စက်ရုံ": "factory", "အထည်ချုပ်": "garment", "အထည်": "garment", "ချည်မျှင်": "textile",
  "ဆေးဝါး": "pharmaceutical", "ဆေး": "pharma", "ကျောက်မျက်ရတနာ": "gems", "ကျောက်မျက်": "gems", "သတ္တုတွင်း": "mining", "သတ္တု": "mining",
  "ရွှေတွင်း": "gold mine", "ကျောက်": "stone", "လျှပ်စစ်": "electric", "စွမ်းအင်": "energy", "ဓာတ်အား": "power",
  "အိမ်ခြံမြေ": "real estate", "ဟိုတယ်": "hotel", "ခရီးသွားလုပ်ငန်း": "tourism", "ခရီးသွား": "travel", "ဘဏ်": "bank", "အာမခံ": "insurance",
  "ငွေရေးကြေးရေး": "finance", "ကုန်တင်": "cargo", "သင်္ဘောကုမ္ပဏီ": "shipping company", "သင်္ဘော": "ship", "ရေယာဉ်": "vessel", "ဆိပ်ကမ်း": "port",
  "လေကြောင်း": "airline", "မော်တော်": "motor", "ယာဉ်": "vehicle", "နိုင်ငံတကာ": "international", "အပြည်ပြည်ဆိုင်ရာ": "international",
  "ကမ္ဘာ့": "global", "ကမ္ဘာ": "global", "အထွေထွေ": "general", "ဖွံ့ဖြိုးရေး": "development", "ဖွံ့ဖြိုး": "development",
  "ရင်းနှီးမြှုပ်နှံမှု": "investment", "နည်းပညာ": "technology", "အင်ဂျင်နီယာ": "engineering", "ဓာတုဗေဒ": "chemical", "ဓာတု": "chemical",
  "သံမဏိ": "steel", "သံ": "iron", "ပလတ်စတစ်": "plastic", "စက္ကူ": "paper", "ရာဘာ": "rubber", "ဆီအုန်း": "palm oil", "ကော်ဖီ": "coffee",
  "လက်ဖက်": "tea", "ပဲ": "beans", "ဆား": "salt", "သကြား": "sugar", "ကြံ": "sugarcane", "လုပ်ငန်း": "",
  /* les lieux */ "မြန်မာနိုင်ငံ": "myanmar", "မြန်မာ့": "myanmar", "မြန်မာ": "myanmar", "ရန်ကုန်": "yangon", "မန္တလေး": "mandalay",
  "နေပြည်တော်": "naypyidaw", "ပဲခူး": "bago", "မော်လမြိုင်": "mawlamyine", "ပုသိမ်": "pathein", "စစ်တွေ": "sittwe", "တောင်ကြီး": "taunggyi",
  "မုံရွာ": "monywa", "မကွေး": "magway", "ထားဝယ်": "dawei", "မြိတ်": "myeik", "ကျောက်ဖြူ": "kyaukphyu", "သီလဝါ": "thilawa",
  "ဧရာဝတီ": "ayeyarwady", "ဧရာ": "ayeyar", "သံလွင်": "thanlwin", "ရခိုင်": "rakhine", "ရှမ်း": "shan", "ကချင်": "kachin", "ကရင်": "kayin",
  "စစ်ကိုင်း": "sagaing", "တနင်္သာရီ": "tanintharyi",
  /* les mots pâlis des noms, que le latin soude et sonorise */ "ရတနာ": "yadana", "မင်္ဂလာ": "mingala", "သီရိ": "thiri", "ဇေယျာ": "zeya",
  "မေတ္တာ": "myitta", "နဂါး": "naga", "နဒီ": "nadi", "နီလာ": "nila", "ပုလဲ": "pale", "သုခ": "thukha", "ဓန": "dhana", "သီဟ": "thiha",
  "ဇမ္ဗူ": "zabu", "မဏိ": "mani", "သဇင်": "thazin", "ပဒုမ္မာ": "padoma", "စန္ဒာ": "sanda", "ဝဏ္ဏ": "wunna", "ရာဇာ": "yaza", "မဟာ": "maha",
  "သုဓမ္မာ": "thudhamma", "ဘုန်း": "phone", "သူရ": "thura", "ပညာ": "pyinnya", "သစ္စာ": "thissa", "စေတနာ": "saytana", "ဂုဏ်": "gon",
}));

function alternative(table: ReadonlyMap<string, string>): RegExp {
  const cles = [...table.keys()].sort((a, b) => b.length - a.length).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`(?:${cles.join("|")})(?![\\u102b-\\u103e])`, "gu");
}
const CLES_BIRMANES = alternative(GENERIQUES_BIRMANS);
/** Le birman : les chiffres, les mots de la table d'abord (les plus longs devant), puis chaque suite de lettres birmanes syllabe
 *  par syllabe ; la ponctuation birmane (၊ ။) est une espace. */
export function birman(nom: string): string {
  return nom.replace(/[၀-၉]/gu, (c) => String(c.codePointAt(0)! - 0x1040))
    .replace(/[၊။]/gu, " ")
    .replace(CLES_BIRMANES, (m) => ` ${GENERIQUES_BIRMANS.get(m) ?? m} `)
    .replace(/[ဣ-ဪ]/gu, (c) => ` ${BIRMAN_INDEPENDANTES.get(c) ?? c} `)
    .replace(/[က-႟ꩠ-ꩿ]+/gu, (mot) => ` ${birmanEnLatin(mot)} `);
}

/* ─────────────────────────── le latin, sous une présomption ─────────────────────────── */

/** Les syllabes de noms birmans les plus portées, dans leurs graphies d'usage, les lieux, la monnaie : ce qui dit le birman dans un
 *  nom latin sans son écriture. Une table du monde. « lin », « min », « san », « ma », « ko », « u », « shan » n'y comptent pas :
 *  ce sont aussi des syllabes chinoises, japonaises ou des civilités (voir `presomptionBirmane`). */
export const SYLLABES_BIRMANES: ReadonlySet<string> = new Set([
  "[name removed]", "myint", "myin", "hlaing", "hlain", "htun", "tun", "naing", "nai", "soe", "khin", "nwe", "nway", "aye", "win", "thein",
  "maung", "tin", "oo", "nyunt", "htwe", "htway", "myat", "myatt", "kaung", "phyo", "pyo", "pyae", "pyay", "zin", "thu", "htay", "htet", "htat",
  "yadana", "yadanar", "mingala", "mingalar", "thiri", "zeya", "zeyar", "zayar", "myitta", "myittar", "shwe", "myo", "myoe", "ngwe", "ngway",
  "kyi", "hla", "mya", "moe", "hnin", "sein", "linn", "than", "thant", "kyal", "kyae", "kye", "mye", "myay", "ayeyar", "ayeyarwady", "kyun",
  "sone", "soan", "thiha", "thura", "wunna", "sanda", "thazin", "nilar", "nila", "nadi", "yaza", "kabar", "saya", "sayar", "daw", "khant",
  "thet", "htoo", "htoe", "nyein", "yin", "lwin", "toe", "chit", "kyawt", "myaing", "hein", "paing", "thaw", "thu", "thuza", "phone", "hpone",
  "yangon", "rangoon", "mandalay", "naypyidaw", "myanmar", "myanma", "burma", "burmese", "bago", "pegu", "mawlamyine", "moulmein", "pathein",
  "bassein", "sittwe", "akyab", "taunggyi", "monywa", "magway", "dawei", "tavoy", "myeik", "mergui", "kyaukphyu", "thilawa", "thanlyin",
  "hlaingthaya", "mingaladon", "kachin", "rakhine", "arakan", "kayin", "kayah", "sagaing", "tanintharyi", "tenasserim", "irrawaddy", "thanlwin",
  "kyat", "mmk",
]);
/** Les syllabes de la table qui, seules ou à deux, ne suffisent pas : trop courtes ou trop communes ailleurs (Win, Tin, Than sont
 *  des mots anglais). Une syllabe FORTE (quatre lettres au moins, hors du dictionnaire) suffit seule : Kyaw, Aung, Hlaing, Htun. */
const SYLLABES_FAIBLES: ReadonlySet<string> = new Set(["win", "tin", "than", "thu", "oo", "nai", "soe", "zin", "moe", "myo", "aye", "toe", "yin", "hla", "mya", "kyi", "daw", "tun", "chit", "thaw", "thet", "hein"]);
/** Le nom est birman par ses syllabes : une syllabe forte (quatre lettres au moins, que `estMotAnglais` ne connaît pas), ou deux
 *  syllabes de la table (« Soe Than Nai and Sons Trading » : soe, than, nai). */
export function presomptionBirmane(mots: readonly string[], estMotAnglais: (m: string) => boolean): boolean {
  const vues = mots.filter((m) => SYLLABES_BIRMANES.has(m));
  if (vues.some((m) => m.length >= 4 && !SYLLABES_FAIBLES.has(m) && !estMotAnglais(m))) return true;
  return vues.length >= 2;
}
/** LE NOM BIRMAN SOUDÉ d'un clavardage (« kaungmyathtwe ») coupé en ses syllabes, quand le mot entier se lit en syllabes de la table,
 *  trois au moins dont une forte : le mot soudé est alors sa propre présomption. Les plus longues d'abord ; undefined sinon (tour 18,
 *  jeu 22 : « kaungmyathtwe co » face à « kaungmyatnwe co » à 0,818, une lettre dans treize, quand Htwe et Nwe sont deux syllabes). */
export function couperSyllabesBirmanes(mot: string, estMotAnglais: (m: string) => boolean): string[] | undefined {
  const memo = new Map<number, string[] | null>();
  const couper = (i: number): string[] | null => {
    if (i === mot.length) return [];
    const vu = memo.get(i);
    if (vu !== undefined) return vu;
    let trouve: string[] | null = null;
    for (let L = Math.min(8, mot.length - i); L >= 2; L--) {
      const s = mot.slice(i, i + L);
      if (!SYLLABES_BIRMANES.has(s)) continue;
      const reste = couper(i + L);
      if (reste !== null) { trouve = [s, ...reste]; break; }
    }
    memo.set(i, trouve);
    return trouve;
  };
  const r = couper(0);
  return r !== null && r.length >= 3 && r.some((m) => m.length >= 4 && !SYLLABES_FAIBLES.has(m) && !estMotAnglais(m)) ? r : undefined;
}
/** Les civilités birmanes devant un nom de personne (U, Daw, Ko, Ma, Maung, Saya) : ôtées en tête, sous la présomption
 *  (jeu 22 : « U Kyaw Zaw Htun Trading » face à « Kyaw Zaw Tun Trading », 0,576, « u » mot rare sans répondant). */
export const HONORIFIQUES_BIRMANS: ReadonlySet<string> = new Set(["u", "daw", "ko", "ma", "maung", "saya", "sayar", "sayama", "sayarma"]);

/** LA MÊME SYLLABE BIRMANE SOUS DEUX GRAPHIES : l'aspirée écrite ou non (Htun, Tun ; Phyo, Pyo), la voyelle e écrite ay ou ae
 *  (Nwe, Nway ; Pyae, Pyay ; Mye, Myay), la longue écrite avec un r muet (Yadana, Yadanar ; Zeyar, Zeya), le o écrit oe ou oa
 *  (Soe, So ; Sone, Soan), l'i écrit ee, Oo et U, la finale nasale avec ou sans son t (Myint, Myin), le g de -ng (Hlaing, Hlain)
 *  et la nasale de -aing perdue (Naing, Nai), ယ် écrit al ou e (Kyal, Kye), le e final muet d'une syllabe fermée (Sone, Son), le
 *  e et le a d'une syllabe fermée (Htet, Htat ; Zeyar, Zayar), les lettres doublées (Myatt, Linn). Sous la présomption birmane
 *  seulement, et la clé vaut un squelette égal (CREDIT_BIRMAN), comme les kana. */
export function pliBirman(m: string): string {
  return m.replace(/^ht/, "t").replace(/ph/g, "p")
    .replace(/ay(?![aeiou])|ae/g, "e").replace(/oe|oa/g, "o").replace(/ee/g, "i").replace(/^oo$/, "u")
    .replace(/(?<=[aeiou])r$/, "").replace(/al$/, "e")
    .replace(/nt$/, "n").replace(/ng$/, "n").replace(/ain$/, "ai")
    .replace(/(?<=[^aeiou])e$/, "").replace(/e/g, "a").replace(/(.)\1+/g, "$1");
}
export const CREDIT_BIRMAN = 0.95;
