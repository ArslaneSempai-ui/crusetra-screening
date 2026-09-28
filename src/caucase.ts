/**
 * LE CAUCASE SUR LES DOCUMENTS : le géorgien et l'arménien (tour 17, jeu 21). Une même raison sociale s'y écrit dans son
 * alphabet (შპს კოლხეთი ფიდერ ლაინზი, « Մելքոնյան Կոնսալթ » ՍՊԸ), dans le latin du registre anglais (Kolkheti Feeder Lines
 * LLC, Melkonyan Consult LLC), dans le latin ancien des documents (Mcxeta pour Mtskheta, Tchanturia pour Chanturia), et,
 * pour l'arménien, dans le latin que le russe a transmis (Akopyan pour Hakobyan, Oganesyan pour Hovhannisyan, Dzhanoyan
 * pour Djanoyan). Ce fichier ne tient que des TABLES DU MONDE : deux alphabets, les formes juridiques des deux registres,
 * les mots du commerce des deux langues et les mots anglais qu'elles écrivent dans leurs lettres (ტრეიდი, Էքսպրես).
 *
 * Le géorgien (mkhedruli) s'écrit sans capitales et note toutes ses voyelles : la lecture suit le système national de 2002
 * sans ses apostrophes (ც ts, წ ts, ჩ ch, ჭ ch, ხ kh, ღ gh, ყ q, ძ dz, ჟ zh, ჯ j), celui que les registres anglais écrivent.
 * Le ფ se lit p (Supsa, Poti, Japaridze) ; dans un mot anglais écrit en géorgien il est un f (ფიდერი, feeder), et ces mots
 * se lisent par la table, pas lettre à lettre. Le génitif (-ის, -ს) que porte le nom du fondateur ou de la ville dans une
 * raison sociale (კიკნაველიძის ღვინის მარნები : les caves à vin DE Kiknavelidze) se replie sur le nominatif pour les
 * suffixes de patronyme (-ძის : -dze, -შვილის : -shvili) et perd son s ailleurs (წყალტუბოს : Tskaltubo).
 *
 * L'arménien oriental note ses voyelles aussi : la lecture suit la translittération d'usage des registres (թ t, ծ ts, ց ts,
 * ձ dz, ղ gh, ճ ch, չ ch, ջ j, խ kh, շ sh, ժ zh), le ու lu u, le ե initial ye, le ո initial vo, le և ev. Le russe a
 * transmis les patronymes sans leur h initial (Հակոբյան : Hakobyan, Акопян : Akopyan) et avec son дж (Ջանոյան : Janoyan,
 * Djanoyan, Dzhanoyan) ; le vieux latin français écrit -ian pour -yan et c pour ts (Caturyan) : `plierPatronymeArmenien`
 * ramène le mot en -yan à une seule graphie, sous la présomption arménienne seulement.
 */

/** Les lettres géorgiennes (mkhedruli, U+10D0 à U+10FF ; les capitales mtavruli passent par toLowerCase). */
const GEORGIEN: ReadonlyMap<string, string> = new Map(Object.entries({
  "ა": "a", "ბ": "b", "გ": "g", "დ": "d", "ე": "e", "ვ": "v", "ზ": "z", "თ": "t", "ი": "i", "კ": "k", "ლ": "l", "მ": "m",
  "ნ": "n", "ო": "o", "პ": "p", "ჟ": "zh", "რ": "r", "ს": "s", "ტ": "t", "უ": "u", "ფ": "p", "ქ": "k", "ღ": "gh", "ყ": "q",
  "შ": "sh", "ჩ": "ch", "ც": "ts", "ძ": "dz", "წ": "ts", "ჭ": "ch", "ხ": "kh", "ჯ": "j", "ჰ": "h",
  /* les lettres anciennes et dialectales */ "ჱ": "e", "ჲ": "y", "ჳ": "w", "ჴ": "q", "ჵ": "o", "ჶ": "f", "ჷ": "e", "ჸ": "", "ჹ": "g", "ჺ": "h",
}));

/** Les mots géorgiens que le registre anglais TRADUIT : les formes (შპს, სს, კს), la conjonction, la famille, le commerce,
 *  et les mots anglais écrits en lettres géorgiennes avec leur -ი de nominatif (ტრეიდი, კარგო, ლაინზი, ბილდინგი), rendus
 *  au mot anglais et non lus lettre à lettre (le ფ y est un f, le აი un i long : « ლაითი » light, « პრაიდი » pride). */
const GENERIQUES_GEORGIENS: ReadonlyMap<string, string> = new Map(Object.entries({
  /* formes : la société à responsabilité limitée (შპს), la société par actions (სს), la société en commandite (კს), la société en
     nom collectif (სპს), l'entrepreneur individuel (ი/მ), la coopérative */
  "შპს": "llc", "შ.პ.ს.": "llc", "შ.პ.ს": "llc", "სს": "jsc", "ს.ს.": "jsc", "კს": "lp", "სპს": "gp", "ი/მ": "ie", "ინდ. მეწარმე": "ie",
  "ინდივიდუალური მეწარმე": "ie", "კოოპერატივი": "cooperative", "შეზღუდული პასუხისმგებლობის საზოგადოება": "llc", "სააქციო საზოგადოება": "jsc",
  /* la conjonction et la famille */ "და": "and", "ძმები": "brothers", "ძმა": "brother", "შვილები": "sons", "და შვილები": "and sons",
  /* le commerce */ "კომპანია": "company", "კომპანიები": "companies", "ჯგუფი": "group", "ღვინო": "wine", "ღვინის": "wine", "ღვინოები": "wines",
  "მარანი": "cellar", "მარნები": "cellars", "ხილი": "fruit", "ხილის": "fruit", "ბოსტნეული": "vegetables", "თხილი": "nut", "თხილის": "nut",
  "ნავთობი": "oil", "ნავთობის": "oil", "გაზი": "gas", "ჩაი": "tea", "წყალი": "water", "წყლები": "waters", "მინერალური": "mineral",
  "სამშენებლო": "construction", "მშენებლობა": "construction", "ვაჭრობა": "trading", "სავაჭრო": "trading", "წარმოება": "production",
  "საწარმო": "enterprise", "ტრანსპორტი": "transport", "სატრანსპორტო": "transport", "გადაზიდვები": "transport", "ლოგისტიკა": "logistics",
  "ექსპორტი": "export", "იმპორტი": "import", "საერთაშორისო": "international", "ბანკი": "bank", "სადაზღვევო": "insurance", "აგრო": "agro",
  "სასოფლო": "agricultural", "სამეურნეო": "farming", "მეღვინეობა": "winery", "მეღვინეობის": "winery", "სასმელები": "beverages", "პური": "bread",
  "რძე": "milk", "რძის": "dairy", "ხორცი": "meat", "თევზი": "fish", "ქვა": "stone", "ცემენტი": "cement", "ლითონი": "metal", "ფოლადი": "steel",
  "ხე": "timber", "ტყე": "forest", "ქაღალდი": "paper", "ქიმია": "chemical", "ქიმიური": "chemical", "მინა": "glass", "ტყავი": "leather",
  "ავეჯი": "furniture", "ტექსტილი": "textile", "ტანსაცმელი": "clothing", "ფარმაცია": "pharmacy", "სამედიცინო": "medical", "ტურიზმი": "tourism",
  "სასტუმრო": "hotel", "ენერგეტიკა": "energy", "ელექტრო": "electro", "მანქანები": "machinery", "ტექნიკა": "equipment", "მომსახურება": "services",
  "საკონსულტაციო": "consulting", "უძრავი ქონება": "real estate", "პორტი": "port", "ნავსადგური": "port", "გემი": "ship", "საზღვაო": "marine",
  "სამთო": "mining", "მადანი": "ore", "ოქრო": "gold", "ქართული": "georgian", "საქართველო": "georgia", "საქართველოს": "georgia",
  /* les mots anglais écrits en géorgien : le commerce */
  "ტრეიდი": "trade", "ტრეიდინგი": "trading", "ტრეიდერი": "trader", "კარგო": "cargo", "ლაინზი": "lines", "ლაინი": "line", "ბილდინგი": "building",
  "ლოჯისტიკი": "logistics", "ლოჯისტიკა": "logistics", "ლოჯისტიკს": "logistics", "ტრანსი": "trans", "ფიდერი": "feeder", "ფიდერ": "feeder", "სერვისი": "service",
  "სერვისები": "services", "გრუპი": "group", "ჰოლდინგი": "holding", "ჰოლდინგს": "holdings", "ინტერნეიშენალი": "international", "ინტერნეშენალი": "international",
  "ინდუსტრიალი": "industrial", "ინდუსტრია": "industry", "მეტალი": "metal", "მეტალურგია": "metallurgy", "ექსპრესი": "express", "შიპინგი": "shipping",
  "მარინი": "marine", "ტერმინალი": "terminal", "ენერჯი": "energy", "კონსტრაქშენი": "construction", "დეველოპმენტი": "development", "ინვესტი": "invest",
  "ინვესტმენტი": "investment", "ფარმა": "pharma", "ფუდი": "food", "ფუდს": "foods", "პლასტიკი": "plastic", "მედიკალი": "medical", "გლობალი": "global",
  "სითი": "city", "ტექნოლოჯი": "technology", "ტექნოლოგია": "technology", "კონსალტინგი": "consulting", "მენეჯმენტი": "management", "სოლუშენს": "solutions",
  "სისტემს": "systems", "სისტემები": "systems", "პროდაქტს": "products", "სუფლაი": "supply", "სერვის": "service", "ბიზნესი": "business",
  /* les mots anglais des noms de navires, écrits en géorgien (jeu 21 : ბრიჯი, პრაიდი, გლორი, სპირიტი, ლედი, ბრიზი, ლაითი) */
  "ბრიჯი": "bridge", "პრაიდი": "pride", "გლორი": "glory", "სპირიტი": "spirit", "ლედი": "lady", "ბრიზი": "breeze", "ლაითი": "light", "სთარი": "star",
  "სტარი": "star", "ქუინი": "queen", "პრინცესა": "princess", "ოუშენი": "ocean", "დრიმი": "dream", "ვიქტორი": "victory", "ჰორიზონტი": "horizon",
  "სანრაიზი": "sunrise", "ფენიქსი": "phoenix", "ატლასი": "atlas", "ლიდერი": "leader", "ჩემპიონი": "champion", "ჰარმონია": "harmony", "ფორჩუნი": "fortune",
  "ჰოუპი": "hope", "ფრიდომი": "freedom", "ლიბერთი": "liberty", "იუნიონი": "union", "ბეი": "bay", "ვინდი": "wind", "სქაი": "sky", "სან": "sun",
  "მუნი": "moon", "ვეივი": "wave", "პიონერი": "pioneer", "ექსპლორერი": "explorer", "ვოიაჯერი": "voyager", "ნავიგატორი": "navigator", "კეპიტალი": "capital",
}));

/** Les suffixes de patronyme géorgien au génitif, et le nominatif que le registre anglais écrit : -ძის (Kiknavelidzis) est -dze,
 *  -შვილის -shvili, -იას -ia, -ურის -uri, -ავას -ava, -უას -ua, -ელის -eli. */
const GENITIFS_GEORGIENS: readonly (readonly [string, string])[] = [
  ["dzis", "dze"], ["shvilis", "shvili"], ["ias", "ia"], ["uris", "uri"], ["avas", "ava"], ["uas", "ua"], ["elis", "eli"],
];
/** Le génitif géorgien replié sur le nominatif : un suffixe de patronyme, ou le s d'un nom en voyelle (Tskaltubos : Tskaltubo,
 *  Batumis : Batumi). Six lettres au moins : un mot court en -s est un mot. */
function nominatifGeorgien(mot: string): string {
  if (mot.length < 6) return mot;
  for (const [g, n] of GENITIFS_GEORGIENS) if (mot.endsWith(g)) return mot.slice(0, -g.length) + n;
  if (/[aeiou]s$/.test(mot)) return mot.slice(0, -1);
  return mot;
}

function alternative(table: ReadonlyMap<string, string>): RegExp {
  const cles = [...table.keys()].sort((a, b) => b.length - a.length).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`(?<![\\p{L}])(?:${cles.join("|")})(?![\\p{L}])`, "gu");
}
const CLES_GEORGIENNES = alternative(GENERIQUES_GEORGIENS);
/** Le géorgien : les mots du commerce d'abord (les clés de plusieurs mots avant les mots seuls), puis lettre à lettre, puis le
 *  génitif replié. Les guillemets géorgiens („ “) et tout caractère hors table traversent inchangés. */
export function georgien(nom: string): string {
  return nom.toLowerCase()
    .replace(CLES_GEORGIENNES, (m) => ` ${GENERIQUES_GEORGIENS.get(m) ?? m} `)
    .replace(/[ა-ჿ]+/gu, (mot) => nominatifGeorgien([...mot].map((c) => GEORGIEN.get(c) ?? c).join("")));
}

/** Les lettres arméniennes (minuscules, U+0561 à U+0587 ; les capitales passent par toLowerCase). Le ե initial se lit ye, le ո
 *  initial vo, le ու u : voir `motArmenien`. */
const ARMENIEN: ReadonlyMap<string, string> = new Map(Object.entries({
  "ա": "a", "բ": "b", "գ": "g", "դ": "d", "ե": "e", "զ": "z", "է": "e", "ը": "y", "թ": "t", "ժ": "zh", "ի": "i", "լ": "l", "խ": "kh",
  "ծ": "ts", "կ": "k", "հ": "h", "ձ": "dz", "ղ": "gh", "ճ": "ch", "մ": "m", "յ": "y", "ն": "n", "շ": "sh", "ո": "o", "չ": "ch",
  "պ": "p", "ջ": "j", "ռ": "r", "ս": "s", "վ": "v", "տ": "t", "ր": "r", "ց": "ts", "ւ": "v", "փ": "p", "ք": "k", "օ": "o", "ֆ": "f", "և": "ev",
}));
/** Les mots arméniens que le registre anglais TRADUIT : les formes (ՍՊԸ la SARL, ԲԲԸ la société par actions ouverte, ՓԲԸ la
 *  fermée, ԱՁ l'entrepreneur individuel), la conjonction և, la famille, le commerce, et les mots anglais écrits en arménien
 *  (Թրեյդ, Էքսպրես, Կոնսալթ, Տեքստիլ). En minuscules : le nom est abaissé avant la lecture. */
const GENERIQUES_ARMENIENS: ReadonlyMap<string, string> = new Map(Object.entries({
  /* formes */ "սպը": "llc", "ս.պ.ը.": "llc", "ս.պ.ը": "llc", "բբը": "ojsc", "բ.բ.ը.": "ojsc", "փբը": "cjsc", "փ.բ.ը.": "cjsc", "աձ": "ie", "ա.ձ.": "ie",
  "հձ": "gp", "կձ": "lp", "ընկերություն": "company", "ընկ.": "company", "ընկ": "company", "սահմանափակ պատասխանատվությամբ ընկերություն": "llc",
  "բաց բաժնետիրական ընկերություն": "ojsc", "փակ բաժնետիրական ընկերություն": "cjsc", "անհատ ձեռնարկատեր": "ie", "անհատ ձեռներեց": "ie",
  /* la conjonction et la famille */ "և": "and", "եւ": "and", "որդիներ": "sons", "եղբայրներ": "brothers", "և որդիներ": "and sons",
  /* le commerce */ "առևտուր": "trading", "առեւտուր": "trading", "առևտրային": "trading", "արտադրություն": "production", "արտադրական": "production",
  "արտահանում": "export", "ներմուծում": "import", "շինարարություն": "construction", "շինարարական": "construction", "շինանյութ": "building materials",
  "կաթ": "milk", "կաթնամթերք": "dairy", "մետաղ": "metal", "մետաղներ": "metals", "մետաղի": "metal", "ձուկ": "fish", "ձկան": "fish", "ձկնաբուծություն": "fish farming",
  "վերամշակում": "processing", "վերամշակման": "processing", "գինի": "wine", "գինու": "wine", "կոնյակ": "brandy", "գործարան": "factory", "կոմբինատ": "kombinat",
  "խումբ": "group", "միջազգային": "international", "հայկական": "armenian", "հայաստան": "armenia", "հայաստանի": "armenia", "երևան": "yerevan",
  "երեւան": "yerevan", "գյումրի": "gyumri", "վանաձոր": "vanadzor", "հանք": "mine", "հանքային": "mineral", "ոսկի": "gold", "ապակի": "glass",
  "փայտ": "timber", "կաշի": "leather", "կահույք": "furniture", "դեղ": "pharmacy", "դեղագործական": "pharmaceutical", "դեղատուն": "pharmacy",
  "բժշկական": "medical", "տուրիզմ": "tourism", "սննդամթերք": "food", "սնունդ": "food", "հաց": "bread", "հացամթերք": "bakery", "պանիր": "cheese",
  "միս": "meat", "մսամթերք": "meat products", "ջուր": "water", "քար": "stone", "ցեմենտ": "cement", "մեքենա": "machine", "մեքենաշինություն": "machinery",
  "էլեկտրոնիկա": "electronics", "քիմիա": "chemical", "քիմիական": "chemical", "թուղթ": "paper", "տեքստիլ": "textile", "գյուղատնտեսություն": "agriculture",
  "գյուղատնտեսական": "agricultural", "տրանսպորտ": "transport", "փոխադրում": "transport", "փոխադրումներ": "transport", "ծառայություններ": "services",
  "ծառայություն": "service", "խորհրդատվություն": "consulting", "ներդրում": "investment", "ներդրումներ": "investments", "բանկ": "bank", "ապահովագրություն": "insurance",
  "անշարժ գույք": "real estate", "էներգետիկա": "energy", "նավթ": "oil", "գազ": "gas", "ոսկերչություն": "jewellery", "ադամանդ": "diamond",
  /* les mots anglais écrits en arménien */ "թրեյդ": "trade", "թրեյդինգ": "trading", "էքսպրես": "express", "էքսպորտ": "export", "իմպորտ": "import",
  "ագրո": "agro", "տրանս": "trans", "կոնսալթ": "consult", "կոնսալթինգ": "consulting", "ֆարմ": "pharm", "ֆարմա": "pharma", "գրուպ": "group",
  "հոլդինգ": "holding", "ինտերնեյշնլ": "international", "ինթերնեյշնլ": "international", "լոգիստիկ": "logistics", "լոգիստիկա": "logistics",
  "սերվիս": "service", "կարգո": "cargo", "էներջի": "energy", "պլաստիկ": "plastic", "ինդուստրի": "industry", "ինվեստ": "invest", "դևելոփմենթ": "development",
  "մենեջմենթ": "management", "թեքնոլոջի": "technology", "սոլյուշնս": "solutions", "սիսթեմս": "systems", "գլոբալ": "global", "մարին": "marine",
  "շիփինգ": "shipping", "թերմինալ": "terminal", "ֆուդ": "food", "թեքստիլ": "textile", "մեդիկալ": "medical", "սթար": "star", "ուայն": "wine",
}));
const CLES_ARMENIENNES = alternative(GENERIQUES_ARMENIENS);
/** Un mot arménien lettre à lettre : ու est u, ե en tête ye, ո en tête vo (Որդիներ : vordiner), և en tête yev. */
function motArmenien(mot: string): string {
  const u = mot.replace(/ու/g, "u");
  let sortie = "";
  const lettres = [...u];
  for (let i = 0; i < lettres.length; i++) {
    const c = lettres[i]!;
    if (i === 0 && c === "ե") { sortie += "ye"; continue; }
    if (i === 0 && c === "ո") { sortie += "vo"; continue; }
    if (i === 0 && c === "և") { sortie += "yev"; continue; }
    sortie += ARMENIEN.get(c) ?? c;
  }
  return sortie;
}
/** L'arménien : les mots du commerce d'abord, puis lettre à lettre. Les guillemets (« ») et la ponctuation arménienne (՝ ։) traversent. */
export function armenien(nom: string): string {
  return nom.toLowerCase()
    .replace(CLES_ARMENIENNES, (m) => ` ${GENERIQUES_ARMENIENS.get(m) ?? m} `)
    .replace(/[ա-և]+/gu, motArmenien);
}

/* ─────────────────────────── le latin, sous une présomption ─────────────────────────── */

/** Les mots qui marquent un nom géorgien romanisé : les toponymes (villes, régions, fleuves, ports), la forme, les mots du
 *  commerce et les mots anglais avec leur -i géorgien (bildingi, treidi). Pas « georgia » (l'État américain, la baie
 *  Georgian) ni les suffixes en -ia. */
export const MARQUEURS_GEORGIENS: ReadonlySet<string> = new Set([
  "shps", "sakartvelo", "kartuli", "tbilisi", "batumi", "poti", "kutaisi", "rustavi", "zugdidi", "gori", "telavi", "mtskheta", "kolkheti",
  "kolkhida", "adjara", "achara", "ajara", "guria", "imereti", "kakheti", "samegrelo", "svaneti", "racha", "javakheti", "kvemo", "shida",
  "rioni", "enguri", "inguri", "mtkvari", "supsa", "khobi", "chorokhi", "anaklia", "kobuleti", "senaki", "ozurgeti", "akhaltsikhe", "borjomi",
  "tskaltubo", "kvareli", "sighnaghi", "signagi", "kazbegi", "gvino", "ghvino", "gvinis", "ghvinis", "marani", "marnebi", "dzmebi", "treidi",
  "treidingi", "bildingi", "kavkasioni", "kavkasia",
]);
/** Leur traduction, sous la présomption géorgienne : le vin (ღვინო, gvino ou ghvino selon qui romanise), la cave, les frères, et les
 *  mots anglais avec leur -i (jeu 21 : « Tsiklauri Gvino LLC » face à « Tsiklauri Wine LLC », « Mcxeta Bildingi » face à
 *  « Mtskheta Building »). */
export const TRADUCTIONS_GEORGIENNES: ReadonlyMap<string, string> = new Map(Object.entries({
  gvino: "wine", ghvino: "wine", gvinis: "wine", ghvinis: "wine", marani: "cellar", marnebi: "cellars", dzmebi: "brothers", treidi: "trade",
  treidingi: "trading", treideri: "trader", bildingi: "building", kompania: "company", metali: "metal", logistiki: "logistics", lojistiki: "logistics",
  transi: "trans", servisi: "service", grupi: "group", jgupi: "group", eksporti: "export", importi: "import", khili: "fruit", navtobi: "oil",
  sasmeli: "beverages", meghvineoba: "winery",
}));
/** Un mot latin qui dit le géorgien : un marqueur, ou un patronyme en -dze ou -shvili (six lettres au moins), suffixes qu'aucune
 *  autre langue n'écrit. */
export function estMarqueurGeorgien(j: string): boolean {
  return MARQUEURS_GEORGIENS.has(j) || (j.length >= 6 && /(dze|shvili)$/.test(j));
}
/** LE LATIN ANCIEN DU GÉORGIEN, lu dans le système national : c pour ც (ts), x pour ხ (kh), tch pour ჭ ou ჩ (ch) ; « Mcxeta »
 *  est Mtskheta (jeu 21). Sous la présomption géorgienne, sur un mot que le dictionnaire ignore et qui porte le « cx » (voir
 *  `analyserEntite`) : « Cargo » garde son c, « Euxine » son x. */
export function lireLatinGeorgien(mot: string): string {
  return mot.replace(/tch/g, "ch").replace(/c(?![hk])/g, "ts").replace(/x/g, "kh");
}

/** Les mots qui marquent un nom arménien romanisé : le pays, ses villes et ses lacs, la forme et les mots du commerce. */
export const MARQUEURS_ARMENIENS: ReadonlySet<string> = new Set([
  "armenia", "hayastan", "yerevan", "erevan", "gyumri", "vanadzor", "ararat", "sevan", "artsakh", "lchashen", "gavar", "dilijan", "kapan", "goris",
  "abovyan", "echmiadzin", "etchmiadzin", "ejmiatsin", "armavir", "hrazdan", "ashtarak", "ijevan", "masis", "artashat", "spitak", "syunik", "lori",
  "tavush", "shirak", "kotayk", "aragatsotn", "vayots", "dzor", "gegharkunik", "metagh", "veramshakum", "dzkan", "spe", "spy", "bbe", "pbe",
]);
/** Leur traduction, sous la présomption arménienne : le métal (մետաղ), le lait (կաթ), le poisson (ձուկ, ձկան au génitif), la
 *  transformation (վերամշակում), le vin (գինի), la conjonction (և : yev), et les mots anglais translittérés (jeu 21 : « Gyumri
 *  Metagh LLC » face à « Gyumri Metal LLC », « lchashen dzkan veramshakum » face à « Lchashen Fish Processing CJSC »). */
export const TRADUCTIONS_ARMENIENNES: ReadonlyMap<string, string> = new Map(Object.entries({
  metagh: "metal", kat: "milk", dzuk: "fish", dzkan: "fish", veramshakum: "processing", gini: "wine", yev: "and", vordiner: "sons",
  yeghbayrner: "brothers", ynkerutyun: "company", enkerutyun: "company", arevtur: "trading", artadrutyun: "production", shinararutyun: "construction",
  tekstil: "textile", konsalt: "consult", panir: "cheese", hats: "bread",
}));
/** Un mot latin qui dit l'arménien : un marqueur, ou un patronyme en -yan (six lettres au moins) ou en -ian (neuf au moins :
 *  « Khachatrian », « Melkonian » ; jamais « Canadian », « Christian », que le dictionnaire ou les adjectifs de pays tiennent). */
export function estMarqueurArmenien(j: string): boolean {
  return MARQUEURS_ARMENIENS.has(j) || (j.length >= 6 && j.endsWith("yan")) || (j.length >= 9 && j.endsWith("ian"));
}
/** Les prénoms arméniens que le russe écrit autrement, en tête du patronyme : Հովհաննես (Hovhannes, Hovhannis) est Оганес. */
const RACINES_RUSSES: readonly (readonly [RegExp, string])[] = [[/^hovhann[ie]s/, "oganes"], [/^hovannes/, "oganes"], [/^ohan/, "ogan"]];
/** LE PATRONYME ARMÉNIEN SOUS UNE SEULE GRAPHIE : -ian (le vieux latin) devient -yan ; dj et dzh (le дж russe) sont j ; x est kh ;
 *  tch est ch ; le c initial du vieux latin est ts (Caturyan : Tsaturyan) ; le prénom que le russe écrit autrement se replie
 *  (Hovhannisyan : Oganesyan) ; et le h initial que le russe n'a pas tombe devant une voyelle (Hakobyan : Akopyan, Harutyunyan :
 *  Arutyunyan) ou devient g devant une consonne (Hrant : Grant). Sous la présomption arménienne, sur le mot en -yan seulement. */
export function plierPatronymeArmenien(mot: string): string {
  let m = mot.replace(/ian$/, "yan").replace(/dzh|dj/g, "j").replace(/x/g, "kh").replace(/tch/g, "ch").replace(/^c(?=[aou])/, "ts");
  for (const [re, r] of RACINES_RUSSES) m = m.replace(re, r);
  return m.replace(/^h(?=[aeiouy])/, "").replace(/^h(?=[^aeiouy])/, "g");
}
