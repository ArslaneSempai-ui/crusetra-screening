/**
 * LES VARIANTES D'UN NOM TEL QU'UN DOCUMENT L'ÉCRIT : annonces, préfixes et annotations, adresses, pavillons,
 * les variantes typées (ancien nom, mention, numéro de registre) et les lectures d'un nom (mandarin, cantonais).
 * Découpé de entites.ts le 28/09/2026 : entites.ts reste la façade qui réexporte tout, aucun import ailleurs ne change.
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
import { SUCCURSALES } from "./preparation.ts";
import { MOTS_DE_SIEGE } from "./preparation.ts";
import { MOTS_DE_BUREAU } from "./preparation.ts";
import { REGISTRES } from "./preparation.ts";
import { numeroDeRegistre } from "./preparation.ts";
import { mentionDeSuccursale } from "./preparation.ts";
import { FORMES } from "./preparation.ts";
import { REGIONS } from "./preparation.ts";
import { FACTEUR_CONTENANCE } from "./score.ts";
import { succursalesCompatibles } from "./score.ts";
import { pliCantonais } from "./mots.ts";

const ANNONCES = /[\s,;]*(?:\b(?:a[./]?\s?k[./]?\s?a\.?|f[./]?\s?k[./]?\s?a\.?|formerly(?:\s+known\s+as|\s+called)?|also\s+known\s+as|previously\s+(?:known\s+as|called)|now\s+trading\s+as|d[./]?\s?b[./]?\s?a\.?|doing\s+business\s+as|t\/a|trading\s+as|now\s+known\s+as|n\.?k\.?a\.?|antes|anciennement|vormals|ehemals|voorheen|anteriormente|dawniej)(?=[\s:,])|(?<=\p{L}[\s,]*)\bex[-.\s]+(?=\p{L}))\s*:?\s*/giu;
/** La même annonce, capturée : `split` rend alors les parties ET l'annonce qui les sépare, pour savoir
 *  laquelle est le nom actuel (voir `variantesTypees`). */
const ANNONCES_CAPTUREE = new RegExp(`(${ANNONCES.source})`, ANNONCES.flags);
/** Ce qu'un document met DEVANT le nom : l'étiquette du champ (« SHIPPER: », « NOTIFY PARTY - »,
 *  « VESSEL: MV … », « by order of »), la personne à qui s'adresse le pli (« Attn. Mr. Sørensen, »),
 *  une référence bancaire (« OUR REF 71-33920-LC », « L/C No. 4412 »), un numéro de coque devant
 *  un nom de navire (« Hull No. 2287 Halbrook Reliance »). Le deux-points ou le tiret est exigé
 *  derrière une étiquette : sans lui, « Owner » ou « Agent » sont des mots du nom. Mesuré le 27/09
 *  sur le jeu 8 : quatorze vrais noms tenus à 0,80 par ces seuls résidus. */
const PREFIXES: readonly RegExp[] = [
  /^\s*(?:applicant|beneficiary|consignee|shipper|notify(?:\s+party)?|(?:towing|ocean|feeder|mother|export|carrying|performing|delivery)\s+vessel|vessel(?:\s*\/\s*voy(?:age)?)?|carrier|charterers?|drawee|drawer|accountee|buyer|seller|exporter|importer|charterer|owners?|issuing\s+bank|advising\s+bank|supplier|customer|payee|payer|remitter|ordering\s+customer|account\s+party|principal|agent|counterparty|debtor|creditor|insured|assured|manufacturer|producer|receiver|forwarder)\s*[:\-\u2013]\s*/iu,
  /^\s*(?:by\s+order\s+of|on\s+behalf\s+of|for\s+(?:the\s+)?account\s+of|to\s+the\s+order\s+of|in\s+favou?r\s+of)\s*:?\s*/iu,
  /* « SHIPPED ON BOARD MV RONG YUAN TAI 16 AT FANGCHENG » : la mention d'embarquement devant le navire */
  /^\s*(?:shipped\s+on\s+board|laden\s+on\s+board|loaded\s+on\s+board|on\s+board|per\s+(?:vessel|m\/?v|m\/?t))\s*:?\s*/iu,
  /* l'étiquette d'un champ SWIFT collée au nom : « :50:BALOGUN VENTURES », « :59A:… » (jeu 10) */
  /^\s*:?\d{2}[a-z]?:\s*(?:\/[a-z0-9]{6,34}\s+)?/iu,
  /* les étiquettes entre barres et le détail d'un paiement (jeu 11) : « /BENEFICIARY/ », « /RFB/INV 4471 PAGO A » */
  /^\s*\/(?:beneficiary|benef|applicant|ordering\s+customer|by\s+order\s+of|acc|acct)\/\s*/iu,
  /^\s*(?:\/rfb\/|\/inv\/)?\s*(?:inv(?:oice)?\s*\d+\s*)?(?:pago\s+a|payment\s+(?:to|for)|paiement\s+[aà])\s+/iu,
  /* une citation de registre devant le nom : « Registro Público de Panamá, Tomo 1245, Folio 332, Asiento 1 — »,
     « Corporate Number 8011001077453 — » */
  /^\s*(?:registro\s+p[uú]blico\b[^—–]*|corporate\s+number\s+\d+\s*)[—–-]\s*/iu,
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
  /* les registres du Panama, du Mexique, de la Colombie, du Brésil et du Japon derrière le nom (jeu 11) : après un
     tiret, une barre ou entre parenthèses, « Folio », « Ficha », « Tomo », « Matrícula », « NIT », « RUC », « RFC »,
     « CURP », « CNPJ », « CUIT », un téléphone, un compte (« CTA »), « IMO N/A CALL SIGN … FLAG … », l'adresse
     japonaise après son 〒, « as agents only », « persona física con actividad empresarial », le code pays
     derrière la forme (« CO LTD JP »), et « POL … POD … » séparés par des tirets */
  /* la barre et le tiret simple sont des SÉPARATEURS, entourés d'espaces : « 2014/117230/07 » et « PMA-45678-B » restent entiers */
  /(?:\s*[—–]\s*|\s+-\s+)(?:folio|ficha|tomo|asiento|matr[ií]cula|nit|ruc|rfc|curp|cnpj|cuit|nif|tel|t[eé]l[eé]phone|cta|cuenta|corporate\s+number)\b.*$/iu,
  /\s+\/\s*(?:folio|ficha|matr[ií]cula|nit|ruc|rfc|curp|cnpj|cuit|nif|tel|cta|cuenta|voy(?:age)?|loadport|pol|pod|\d)[^\n]*$/iu,
  /\s+(?:rfc|curp|cnpj|nit|ruc|cuit|nif)\s*:?\s*[a-z0-9][a-z0-9.\/-]{5,}\b.*$/iu,
  /\s*\(\s*(?:ruc|rfc|nit|cnpj|cuit|tel|t[eé]l|fax|imo)\b[^)]*\)/giu,
  /\s+imo\s*(?:n\/a|\d{7})\b.*$/iu,
  /\s+as\s+agents?\s+only\s*$/iu,
  /\s+〒?\s*\d{3}-\d{4}\s+[\u3000-\u9fff].*$/u,
  /\s+persona\s+(?:f[ií]sica|moral)\b.*$/iu,
  /(?<=\b(?:ltd|limited|inc|llc|gmbh|kk|sa|plc|bv|nv|ag)\.?)\s+(?:jp|us|uk|de|fr|cn|kr|sg|hk|pa|mx|br|tr|ru|ua|nl|be|it|es|pt|ch|at|dk|se|no|fi)\s*$/iu,
  /\s*[—–-]\s*pol\s+[\p{L} .'-]{2,30}\s*[—–-]\s*pod\s+[\p{L} .'-]{2,30}\s*$/iu,
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
  /* « Kenanga Pacific Sdn. Bhd. - Penang Branch » : la succursale après un tiret ; « Succursale de Genève », « Sucursal Lima » ;
     et le siège ou le bureau derrière une virgule ou un tiret (« , Head Office », « , Hauptsitz », « , Havengebied Kantoor ») :
     ce qu'ils nommaient, la variante le garde en mention (voir `mentionDeSuccursale`) */
  new RegExp(`\\s+[-\\u2013]\\s+[^,]*(?<![\\p{L}])(?:${[...SUCCURSALES].join("|")}|${MOTS_DE_SIEGE}|${MOTS_DE_BUREAU})(?![\\p{L}])(?!\\s*\\d).*$`, "iu"),
  new RegExp(`,\\s*[^,]*(?<![\\p{L}])(?:${[...SUCCURSALES].join("|")}|${MOTS_DE_SIEGE}|${MOTS_DE_BUREAU})(?![\\p{L}])(?!\\s*\\d).*$`, "iu"),
  /\s+branch$/iu,
  /* le siège écrit sans virgule en fin de nom : « X Limited Head Office » */
  /\s+(?:head\s*office|headquarters?|hauptsitz|hoofdkantoor|hoofdzetel|si[e\u00e8]ge\s+social)$/iu,
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
  /* le numéro de registre, entre parenthèses ou derrière la forme (voir REGISTRES) : ôté du texte, gardé en
     propriété de la variante (`registre`) */
  ...REGISTRES.map((r) => new RegExp(r.source, "iu")),
];
/** Les pays et régions du monde qu'une société met dans son nom pour dire sa filiale. */
export const PAYS_MOTS: ReadonlySet<string> = new Set(["uk", "usa", "us", "america", "american", "americas", "china", "chinese", "india", "indian",
  "germany", "german", "deutschland", "france", "french", "italy", "italia", "italian", "spain", "espana", "japan", "nippon", "korea",
  "canada", "mexico", "brasil", "brazil", "australia", "singapore", "malaysia", "thailand", "vietnam", "indonesia", "philippines",
  "turkey", "turkiye", "egypt", "nigeria", "kenya", "ghana", "zambia", "tanzania", "poland", "polska", "netherlands", "holland",
  "belgium", "sweden", "norway", "denmark", "finland", "austria", "switzerland", "ireland", "portugal", "greece", "hellas", "russia",
  "ukraine", "kazakhstan", "uae", "emirates", "qatar", "oman", "kuwait", "bahrain", "saudi", "arabia", "iran", "iraq", "israel",
  "pakistan", "bangladesh", "lanka", "nepal", "taiwan", "hongkong", "macau", "argentina", "chile", "peru", "colombia", "venezuela",
  "europe", "europa", "european", "asia", "asian", "africa", "african", "pacific", "atlantic", "nordic", "baltic", "benelux", "iberia",
  "latam", "apac", "emea", "gulf", "middle", "east", "west", "north", "south", "overseas", "global", "worldwide",
  /* les pays que les adjectifs de nationalité des registres francophones d'Afrique disent (voir PAYS_ADJECTIFS) */
  "ivoire", "burkina", "mali", "senegal", "cameroun", "gabon", "togo", "benin", "niger", "guinee", "tunisie", "maroc", "algerie", "congo"]);
/** Les ADJECTIFS DE NATIONALITÉ des registres francophones d'Afrique (« Société Ivoirienne des Bois Tropicaux »,
 *  « Société Burkinabè de Céréales ») : le nom d'usage les remplace par le pays ou son sigle (« Céréales Burkina »,
 *  « Bois Tropicaux CI », jeu 10). L'adjectif devient le mot du pays ; le sigle en queue du nom aussi (SIGLES_PAYS).
 *  Ces mots de pays sont dans PAYS_MOTS : d'un seul côté, ils disent une filiale. */
export const PAYS_ADJECTIFS: ReadonlyMap<string, string> = new Map(Object.entries({
  ivoirien: "ivoire", ivoirienne: "ivoire", malien: "mali", malienne: "mali", burkinabe: "burkina", senegalais: "senegal",
  senegalaise: "senegal", camerounais: "cameroun", camerounaise: "cameroun", gabonais: "gabon", gabonaise: "gabon",
  togolais: "togo", togolaise: "togo", beninois: "benin", beninoise: "benin", nigerien: "niger", nigerienne: "niger",
  guineen: "guinee", guineenne: "guinee", tunisien: "tunisie", tunisienne: "tunisie", marocain: "maroc", marocaine: "maroc",
  algerien: "algerie", algerienne: "algerie", congolais: "congo", congolaise: "congo", ghaneen: "ghana", ghaneenne: "ghana",
  kenyan: "kenya", kenyane: "kenya",
}));
/** Le sigle du pays en QUEUE d'un nom d'usage (« Bois Tropicaux CI ») ; en tête, « C.I. » est la Comercializadora
 *  Internacional colombienne et reste un mot. */
export const SIGLES_PAYS: ReadonlyMap<string, string> = new Map([["ci", "ivoire"], ["bf", "burkina"], ["sn", "senegal"], ["cm", "cameroun"]]);

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

/** Une variante d'un nom brut, et ce qu'elle est. `ancien` : un nom que le document annonce comme un
 *  AUTRE nom du même (« ex », « f/k/a », « formerly », « a.k.a. », « t/a ») ; un ancien nom d'un seul côté
 *  reste la même coque (« MV Warri Osprey » face à « MV Apapa Falcon (ex Warri Osprey) »), mais un ancien
 *  nom retrouvé des DEUX côtés sous deux noms actuels différents est une coque vendue et renommée, ou
 *  deux coques qui ont porté ce nom : le possible, jamais le fort (jeu 10, 27/09 : cinq paires de navires à
 *  1,000 par leur seul ancien nom). `mention` : ce que nommait la mention de succursale que la variante a
 *  perdue (voir `mentionDeSuccursale`), « » sinon. */
export type VarianteTypee = { texte: string; ancien: boolean; mention: string;
  /** les numéros de registre du nom brut (voir `numeroDeRegistre`), portés par toutes ses variantes */
  registre: string };
/** Les variantes d'un nom brut, textes seuls (voir `variantesTypees`). */
export function variantes(brut: string): string[] {
  return variantesTypees(brut).map((v) => v.texte);
}
export function variantesTypees(brut: string): VarianteTypee[] {
  const vues = new Map<string, VarianteTypee>();
  /* les astérisques d'un message de banque (« *** COMPANIA … *** PANAMA », jeu 11) ne sont que du décor */
  brut = brut.replace(/\*+/g, " ").replace(/\s{2,}/g, " ").trim();
  /* « (Amharic: ተስፋዬ በቀለ ንግድ) » : l'étiquette de langue s'efface, la parenthèse native reste (jeu 10) */
  brut = brut.replace(/\(\s*(?:amharic|arabic|chinese|japanese|korean|thai|hebrew|russian|greek|hindi|tamil|persian|farsi|urdu|bengali|in\s+\p{L}+)\s*:\s*/giu, "(");
  /* une adresse collée à la forme sans espace, champ 59 : « Company Limited45 Marina Road » (jeu 10) */
  brut = brut.replace(/\b(limited|ltd|plc|inc|llc|corp|gmbh|bv|nv|sa|sarl|lda|ltda|pty|bhd)\.?(?=\d)/giu, "$1 ");
  const registre = numeroDeRegistre(brut);
  const poser = (texte: string, ancien: boolean, mention: string) => { if (!vues.has(texte)) vues.set(texte, { texte, ancien, mention, registre }); };
  poser(brut.trim(), false, "");
  /* le registre écrit la personne nom d'abord : « Okeke, Chidi Building Materials » (jeu 10) */
  const inverse = /^([\p{Lu}][\p{L}'-]+),\s+([\p{Lu}][\p{L}'-]+)\s+(\p{L}.*)$/u.exec(brut.trim());
  if (inverse) poser(`${inverse[2]} ${inverse[1]} ${inverse[3]}`, false, "");
  /* la forme native entre parenthèses, ou l'inverse : « BAKU OIL EXPORT (Бакинский …) »,
     « 青岛海鑫国际物流有限公司 (Qingdao Haixin International Logistics Co., Ltd.) », « Katz Miriam (כץ מרים) » :
     deux écritures du même nom, chacune une variante, aucune filiale */
  /* et l'arménien, le géorgien, l'éthiopien (amharique, jeu 10), le birman, le lao */
  const nonLatin = /[\u0370-\u03ff\u0400-\u04ff\u0530-\u058f\u0590-\u05ff\u0600-\u06ff\u0900-\u0dff\u0e00-\u0eff\u1000-\u10ff\u1100-\u11ff\u1200-\u137f\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/u;
  const paren = /^(.*?)\s*\(([^()]+)\)\s*$/u.exec(brut.trim());
  if (paren && paren[1]!.trim() && paren[2]!.trim() && (nonLatin.test(paren[1]!) !== nonLatin.test(paren[2]!))) {
    poser(paren[1]!.trim(), false, "");
    poser(paren[2]!.trim(), false, "");
  }
  /* les suffixes SWIFT à la barre oblique (« LUCENT CORRIDOR/V.088W/HK », « …CO LTD/NANNING/CN ») :
     retirés un à un tant qu'il reste deux mots devant */
  let sansBarres = brut.trim();
  /* mais « A/S », « K/S », « S/A » sont des formes (une lettre, la barre, une lettre) : pas un suffixe SWIFT ;
     et un suffixe SWIFT ne porte jamais de parenthèse : « (Reg. No. 2014/117230/07) » est un numéro de
     registre, que l'annotation ôte entier (jeu 10, 27/09 : la barre mangeait « /07) » puis « /117230 ») */
  while (/\/[^\s/()]{1,20}$/.test(sansBarres) && !/(?:^|\s)\p{L}\/\p{L}$/u.test(sansBarres)
    && sansBarres.replace(/\/[^\s/()]{1,20}$/, "").trim().split(/\s+/).length >= 2) {
    sansBarres = sansBarres.replace(/\/[^\s/()]{1,20}$/, "").trim();
  }
  if (sansBarres !== brut.trim()) brut = sansBarres;
  /* un nom annoncé entre parenthèses : « LUNARIS DAWN (EX-SELVANA) » */
  const sansParentheseAnnoncee = brut.replace(
    /\(\s*(?:ex[-.\s]+|f\/?k\/?a\.?\s*|formerly\s+(?:known\s+as\s+)?|previously\s+(?:known\s+as\s+)?|also\s+known\s+as\s+|a\.?k\.?a\.?\s*|(?:antes|anciennement|anc\.|vormals|ehem\.|ehemals|voorheen|anteriormente|dawniej)\s+)([^()]*)\)/giu, (_, x: string) => ` | ${x} `);
  /* chaque partie et ce qu'elle est : le nom ACTUEL est la première partie du premier bloc, sauf quand
     l'annonce qui la suit dit « now known as », « now trading as », « n.k.a. » (alors c'est la seconde) ;
     toute autre partie, et tout nom annoncé entre parenthèses, est un ancien nom ou un autre nom */
  const parties: { texte: string; ancien: boolean }[] = [];
  sansParentheseAnnoncee.split("|").forEach((bloc, k) => {
    const morceaux = bloc.split(ANNONCES_CAPTUREE);
    const actuel = k > 0 ? -1 : /\bnow\b|\bn\.?k\.?a/iu.test(morceaux[1] ?? "") ? 2 : 0;
    for (let i = 0; i < morceaux.length; i += 2) {
      const texte = (morceaux[i] ?? "").trim();
      if (texte.length > 0) parties.push({ texte, ancien: i !== actuel });
    }
  });
  for (const partie of parties) {
    let p = partie.texte;
    const ancien = partie.ancien;
    let avant: string;
    /* les préfixes de champ ne s'ôtent que s'il reste un nom derrière (deux lettres au moins) */
    do { avant = p; for (const r of PREFIXES) { const q = p.replace(r, "").trim(); if (/\p{L}{2}/u.test(q)) p = q; } } while (p !== avant);
    /* ce que nomme la mention de succursale du nom tel qu'écrit : la variante qui l'a perdue le garde */
    const mention = mentionDeSuccursale(p);
    const mentionDe = (x: string) => (mention !== "" && mentionDeSuccursale(x) === "" ? mention : "");
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
      /* « …mbH, Zweigniederlassung Bremen » : la succursale derrière la virgule n'est pas une adresse, c'est la marque
         que le score doit voir (jeu 10 : la succursale et son siège, jugés différents, mesurés à 1,000 le 27/09
         quand « mbH » devenu une forme faisait ôter la queue) */
      const queueSuccursale = motsQueue.some((m) => SUCCURSALES.has(m));
      /* derrière une forme : l'adresse s'ôte ; sans forme devant, un ou deux mots sans forme
         derrière la virgule sont un port ou une ville (« SIROCCO MARINER, MONROVIA »), mais
         « Marks, Spencer Ltd » garde Spencer : la forme est dans la queue */
      if (queue.length > 0 && !queueEstForme && !queueSuccursale && (FORMES.has(dernier)
        || (!queuePorteUneForme && /^[\p{L} .'-]{2,30}$/u.test(queue) && motsQueue.length <= 2 && !p.includes("&")
          && tete.trim().split(/\s+/).length >= 2))) p = tete.trim();
    }
    /* un pays entre parenthèses en fin de nom de navire : « OCEAN LARKSPUR (PANAMA) » ; pour une
       société, la même parenthèse serait une filiale, mais aucune forme ne la suit ici */
    p = p.replace(/\s*\(\s*([\p{L} ]{3,30})\s*\)\s*$/u, (m, pays: string) => (PAVILLONS.has(normaliser(pays)) ? "" : m)).trim();
    if (p.length > 0 && /\p{L}/u.test(p)) poser(p, ancien, mentionDe(p));
    /* le suffixe coréen des navires, 호 (« 세월호 », « 파이오니어호 ») : le nom sans lui est une lecture
       de plus, jamais la seule (« 금호 », Kumho, garde son 호, qui est son nom) */
    if (/[\uac00-\ud7a3]{2,}호$/u.test(p)) poser(p.replace(/호$/u, "").trim(), ancien, mentionDe(p));
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
      if (queue.length > 0 && adresse && /^[\p{L}\d .,'-]{2,60}$/u.test(queue) && !new RegExp(FORME_EN_LIGNE.source, "iu").test(queue)
        && p.slice(0, dernier.index).trim().split(/\s+/).length >= 1) {
        poser(p.slice(0, fin).trim(), ancien, mentionDe(p.slice(0, fin)));
      }
    }
    /* un pavillon nu en fin de nom de navire : « MERIDIAN GLORY LIBERIA » */
    const mots = p.split(/\s+/);
    if (mots.length >= 3 && PAVILLONS.has(normaliser(mots[mots.length - 1]!))) poser(mots.slice(0, -1).join(" "), ancien, mentionDe(p));
    if (mots.length >= 4 && PAVILLONS.has(normaliser(mots.slice(-2).join(" ")))) poser(mots.slice(0, -2).join(" "), ancien, mentionDe(p));
  }
  return [...vues.values()];
}

/** Une variante et la lecture qu'on en fait : un nom en sinogrammes se lit en mandarin ET en
 *  cantonais (voir ecritures.ts) ; un nom latin n'a qu'une lecture, sauf celles que lui donnent
 *  les sinogrammes qu'il porte (`substitutions`). C'est ici que l'index et le score prennent
 *  leurs lectures : tout ce qui s'ajoute ici est vu des deux. */
export type LectureDe = { texte: string; lecture: Lecture; ancien: boolean; mention: string; registre: string };
export function lecturesDe(brut: string): LectureDe[] {
  const vues = new Map<string, LectureDe>();
  const poser = (l: LectureDe) => { const k = `${l.lecture}|${l.texte}`; if (!vues.has(k)) vues.set(k, l); };
  for (const v of variantesTypees(brut)) {
    const { ancien, mention, registre } = v;
    poser({ texte: v.texte, lecture: "mandarin", ancien, mention, registre });
    if (/[\u4e00-\u9fff]/u.test(v.texte) && !estJaponais(v.texte)) {
      poser({ texte: v.texte, lecture: "cantonais", ancien, mention, registre });
      for (const s of substitutions(v.texte)) poser({ ...s, ancien, mention, registre });
    }
  }
  return [...vues.values()];
}

/** Le PLAFOND que deux lectures imposent à leur score : un ancien nom des deux côtés, ou deux mentions de
 *  succursale qui ne nomment pas la même chose (voir `VarianteTypee`), rangent la paire au possible ; sinon 1.
 *  Le score d'entité et le criblage (cribler.ts) l'appliquent tous deux, pour que l'index et le témoin
 *  exhaustif voient la même chose. */
export function plafondDesLectures(a: LectureDe, b: LectureDe): number {
  if (a.ancien && b.ancien) return FACTEUR_CONTENANCE;
  if (a.mention !== "" && b.mention !== "" && !succursalesCompatibles(a.mention, b.mention)) return FACTEUR_CONTENANCE;
  /* deux numéros de registre différents : deux dépôts du même nom (« (RC 884213) », « (RC 918532) »), ou la
     succursale allemande et son siège, chacun à son Amtsgericht ; un numéro d'un seul côté ne dit rien */
  if (a.registre !== "" && b.registre !== "" && a.registre !== b.registre) return FACTEUR_CONTENANCE;
  return 1;
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
function substitutions(v: string): { texte: string; lecture: Lecture }[] {
  const suites = v.match(/[\u4e00-\u9fff]+/gu) ?? [];
  const latin = v.replace(/\(\s*[\u4e00-\u9fff]+\s*\)|[\u4e00-\u9fff]+/gu, " ").replace(/\s{2,}/g, " ").trim();
  if (suites.length === 0 || !/\p{L}{2}/u.test(latin)) return [];
  const sorties: { texte: string; lecture: Lecture }[] = [{ texte: latin, lecture: "mandarin" }];
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
