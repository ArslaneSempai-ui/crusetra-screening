/**
 * LES TABLES NORDIQUES (tour 8, voie navires-nordique) : les pays de la marque, les génériques du commerce
 * finnois et suédois qui se composent, le génitif finnois des ports et des villes, les patronymes.
 * Pures tables et fonctions sans état : la préparation et le score les importent, elles n'importent rien.
 */

/** Les pays de la MARQUE NORDIQUE : les formes Oy, Ab, AS, A/S, ApS, AB, OÜ, SIA, UAB, ou le pays écrit. « AS »
 *  est aussi la Turquie (A.Ş.) : la marque y est posée à tort, et les règles qu'elle ouvre ne parlent que de
 *  patronymes en -sen et de composés, que le turc n'écrit pas. */
export const PAYS_NORDIQUES: ReadonlySet<string> = new Set(["FI", "SE", "NO", "DK", "EE", "LV", "LT", "IS"]);

/** Les GÉNÉRIQUES du commerce en finnois, en suédois, en danois et en norvégien, et leur mot anglais : une société
 *  finlandaise porte deux raisons sociales, l'une en finnois, l'autre en suédois (« Satamapalvelu Kotka Oy »,
 *  « Hamntjänst Kotka Ab » : jeu 12, 0,450), et ces langues COMPOSENT leurs mots (satama + palvelu, hamn + tjänst,
 *  spannmål + s + export). Les queues anglaises et allemandes des composés (export, transport, handel) y sont pour
 *  que le composé se coupe ; seules, TRADUCTIONS les connaît déjà et passe avant. */
export const GENERIQUES_NORDIQUES: ReadonlyMap<string, string> = new Map(Object.entries({
  /* finnois */ satama: "port", palvelu: "services", palvelut: "services", vilja: "grain", kuljetus: "transport",
  terminaali: "terminal", kauppa: "trading", logistiikka: "logistics", rahti: "freight", varustamo: "shipping", huolinta: "forwarding",
  /* suédois */ hamn: "port", tjanst: "services", tjanster: "services", spannmal: "grain", frakt: "freight",
  /* danois et norvégien */ havn: "port", havne: "port", tjeneste: "services", tjenester: "services", fragt: "freight",
  fisk: "fish", fiske: "fish", fiskeri: "fisheries", eksport: "export", nordisk: "nordic", nordiske: "nordic",
  norsk: "norwegian", norske: "norwegian", dansk: "danish", danske: "danish", svensk: "swedish", svenska: "swedish", suomen: "finnish",
  /* les queues que les trois langues empruntent telles quelles */ export: "export", import: "import", transport: "transport",
  terminal: "terminal", service: "services", handel: "trading", logistik: "logistics", spedition: "forwarding", rederi: "shipping",
}));
/** Les génériques qui ne s'écrivent qu'en finnois : la trace du finnois dans un nom sans forme (voir `estFinnois`). */
const FINNOIS: ReadonlySet<string> = new Set(["satama", "palvelu", "palvelut", "vilja", "kuljetus", "terminaali", "kauppa", "logistiikka",
  "rahti", "varustamo", "huolinta"]);
/** Les génériques qui ne s'écrivent qu'en suédois (voir `estSuedois`). */
const SUEDOIS: ReadonlySet<string> = new Set(["hamn", "tjanst", "tjanster", "spannmal", "frakt"]);

/** Les queues anglaises de la table : seules, ce sont des mots anglais que rien ne traduit ni ne marque. */
const QUEUES_ANGLAISES: ReadonlySet<string> = new Set(["export", "import", "transport", "terminal", "service"]);

/** Les deux membres d'un COMPOSÉ nordique : chacun un générique de la table, quatre lettres au moins, le suédois liant
 *  parfois d'un s (« spannmålsexport ») ; ou le générique seul, suivi ou non de ce s (« Spannmåls Export », écrit
 *  coupé). Une queue anglaise seule n'est pas un mot nordique : undefined. */
export function membresNordiques(mot: string): readonly [string, string] | readonly [string] | undefined {
  if (GENERIQUES_NORDIQUES.has(mot)) return QUEUES_ANGLAISES.has(mot) ? undefined : [mot];
  if (mot.endsWith("s") && GENERIQUES_NORDIQUES.has(mot.slice(0, -1)) && !QUEUES_ANGLAISES.has(mot.slice(0, -1))) return [mot.slice(0, -1)];
  for (let k = 4; k <= mot.length - 4; k++) {
    const tete = mot.slice(0, k);
    if (!GENERIQUES_NORDIQUES.has(tete)) continue;
    const queue = mot.slice(k), sansLiant = queue.startsWith("s") ? queue.slice(1) : "";
    if (GENERIQUES_NORDIQUES.has(queue)) return [tete, queue];
    if (sansLiant.length >= 4 && GENERIQUES_NORDIQUES.has(sansLiant)) return [tete, sansLiant];
  }
  return undefined;
}
/** La traduction d'un générique nordique ou d'un composé de deux (« satamapalvelu » : « port services »,
 *  « hamntjänst » : « port services », « viljasatama » : « grain port ») ; undefined sinon. */
export function traductionNordique(mot: string): string | undefined {
  const m = membresNordiques(mot);
  return m === undefined ? undefined : m.map((x) => GENERIQUES_NORDIQUES.get(x)!).join(" ");
}
/** Le mot est finnois : un générique finnois, seul ou membre d'un composé. */
export function estFinnois(mot: string): boolean {
  const m = membresNordiques(mot);
  return m !== undefined && m.some((x) => FINNOIS.has(x));
}
/** Le mot est suédois : un générique suédois, seul ou membre d'un composé. */
export function estSuedois(mot: string): boolean {
  const m = membresNordiques(mot);
  return m !== undefined && m.some((x) => SUEDOIS.has(x));
}
/** LES DEUX RAISONS SOCIALES d'une société finlandaise : l'une traduit un générique finnois, l'autre le générique suédois
 *  (« Satamapalvelu Kotka Oy », « Hamntjänst Kotka Ab » : jeu 12). Les formes Oy et Ab y nomment la même société de Finlande,
 *  pas deux pays ; sans ce signal, « Hallström Precision AB » face à « … Oy » reste deux sociétés (jeux 8 et 12, quatre paires).
 *  `sources` : les mots d'origine des mots traduits de chaque côté. */
export function raisonsBilingues(sourcesA: readonly string[], sourcesB: readonly string[]): boolean {
  const fi = (l: readonly string[]) => l.some(estFinnois), sv = (l: readonly string[]) => l.some(estSuedois);
  return (fi(sourcesA) && sv(sourcesB)) || (sv(sourcesA) && fi(sourcesB));
}

/** LE GÉNITIF FINNOIS des ports et des villes, ramené au nominatif : le registre écrit « Porin Viljasatama Oy »
 *  (le port à grains DE Pori) et le nom d'usage « Pori Viljasatama » (jeu 12, 0,800 : « porin » et « pori » un mot
 *  court ambigu). Le -n du génitif change la consonne du radical (Turku, Turun ; Helsinki, Helsingin ; Lahti,
 *  Lahden ; Pietarsaari, Pietarsaaren) : aucun pli ne le rend, d'où une table, celle des ports et des villes qui
 *  nomment des sociétés. Ne vaut que sous un nom finnois (forme Oy, ou générique finnois : voir `analyserEntite`). */
export const GENITIFS_FINNOIS: ReadonlyMap<string, string> = new Map(Object.entries({
  helsingin: "helsinki", turun: "turku", porin: "pori", kotkan: "kotka", haminan: "hamina", oulun: "oulu", vaasan: "vaasa",
  rauman: "rauma", kemin: "kemi", tornion: "tornio", kokkolan: "kokkola", pietarsaaren: "pietarsaari", naantalin: "naantali",
  hangon: "hanko", porvoon: "porvoo", loviisan: "loviisa", tampereen: "tampere", lahden: "lahti", kuopion: "kuopio",
  jyvaskylan: "jyvaskyla", joensuun: "joensuu", lappeenrannan: "lappeenranta", uudenkaupungin: "uusikaupunki",
  kaskisten: "kaskinen", raahen: "raahe", inkoon: "inkoo", espoon: "espoo", vantaan: "vantaa", imatran: "imatra",
  kouvolan: "kouvola", mikkelin: "mikkeli", rovaniemen: "rovaniemi", savonlinnan: "savonlinna", seinajoen: "seinajoki",
  hameenlinnan: "hameenlinna", kajaanin: "kajaani", varkauden: "varkaus", salon: "salo", keravan: "kerava", hyvinkaan: "hyvinkaa",
}));

/** Un PATRONYME nordique : -sen (Danemark, Norvège), -son et -sson (Suède, Islande), -zen ; six lettres au moins. */
const PATRONYME = /^\p{L}{3,}(?:ss?en|ss?on|zen)$/u;
/** Deux patronymes nordiques DIFFÉRENTS sont deux familles : Rasmussen et Rasmusson, Kristiansen et Kristiansson,
 *  Pedersen et Petersen, Nielsen et Nilsson (jeu 12 : 0,889, 0,909, 0,950 ; d et t ne font qu'une classe au
 *  squelette). Le registre danois, norvégien ou suédois écrit le patronyme tel quel ; une lettre y est une
 *  autre famille, pas une romanisation. Sous la marque nordique seulement (voir `scorePrepares`). */
export function patronymesDistincts(a: string, b: string): boolean {
  return a !== b && PATRONYME.test(a) && PATRONYME.test(b);
}
