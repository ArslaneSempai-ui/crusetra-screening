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
import { nommeUneSociete } from "./preparation.ts";
import { FORMES } from "./preparation.ts";
import { FORMES_SLAVES } from "./preparation.ts";
import { REGIONS } from "./preparation.ts";
import { FACTEUR_CONTENANCE } from "./score.ts";
import { succursalesCompatibles } from "./score.ts";
import { pliCantonais } from "./mots.ts";
import { plier } from "./preparation.ts";

const ANNONCES = /[\s,;]*(?:\b(?:a[./]?\s?k[./]?\s?a\.?|f[./]?\s?k[./]?\s?a\.?|formerly(?:\s+known\s+as|\s+called)?|also\s+known\s+as|previously\s+(?:known\s+as|called)|now\s+trading\s+as|d[./]?\s?b[./]?\s?a\.?|doing\s+business\s+as|t\/a|trading\s+as|now\s+known\s+as|n\.?k\.?a\.?|antes|anciennement|vormals|ehemals|voorheen|anteriormente|dawniej)(?=[\s:,])|(?<=\p{L}[\s,]*)\bex[-.\s]+(?=\p{L})|(?<![\p{L}])(?:δ\.?\s?τ\.?|διακριτικ[οό]ς\s+τ[ίι]τλος)(?=[\s:,«"]))\s*:?\s*/giu;
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
  /^\s*(?:applicant|beneficiary|consignee|shipper|notify(?:\s+party)?|(?:towing|ocean|feeder|mother|export|carrying|performing|delivery)\s+vessel|vessel(?:\s*\/\s*voy(?:age)?)?|b\/l|bill\s+of\s+lading|carrier|charterers?|drawee|drawer|accountee|buyer|seller|exporter|importer|charterer|owners?|issuing\s+bank|advising\s+bank|supplier|customer|payee|payer|remitter|ordering\s+customer|account\s+party|principal|agent|counterparty|debtor|creditor|insured|assured|manufacturer|producer|receiver|forwarder)\s*[:\-\u2013]\s*/iu,
  /^\s*(?:by\s+order\s+of|on\s+behalf\s+of|for\s+(?:the\s+)?account\s+of|to\s+the\s+order\s+of|in\s+favou?r\s+of)\s*:?\s*/iu,
  /* « SHIPPED ON BOARD MV RONG YUAN TAI 16 AT FANGCHENG » : la mention d'embarquement devant le navire */
  /^\s*(?:shipped\s+on\s+board|laden\s+on\s+board|loaded\s+on\s+board|on\s+board|per\s+(?:vessel|m\/?v|m\/?t))\s*:?\s*/iu,
  /* l'étiquette d'un champ SWIFT collée au nom : « :50:BALOGUN VENTURES », « :59A:… » (jeu 10) */
  /^\s*:?\d{2}[a-z]?:\s*(?:\/(?:[a-z]{2,4}\s*)?[a-z0-9]{4,34}\s+)?/iu,
  /* « REF FT2231-0915 /BNF/ », « /NAME/ », « 1/ » du champ 50F structuré (jeu 12) */
  /^\s*ref\.?\s*[a-z0-9\-/]{4,}\s+(?:\/(?:bnf|ben|beneficiary)\/\s*)?/iu,
  /^\s*\/name\/\s*/iu,
  /^\s*1\/\s*/u,
  /* une signature ou un cadre de conversation autour du nom (jeu 12) : « For and on behalf of X »,
     « can u check X asap », « hi pls check X thx » */
  /^\s*for\s+and\s+on\s+behalf\s+of\s+/iu,
  /^\s*(?:hi|hello|hey|bonjour|salut)?[,\s]*(?:(?:can|could|pouvez|peux)\s+(?:u|you|tu|vous)\s+)?(?:pls|please|svp|stp)?\s*(?:check|screen|verify|look\s+at|v[eé]rifie[rz]?|regarde[rz]?)\s+/iu,
  /* les étiquettes entre barres et le détail d'un paiement (jeu 11) : « /BENEFICIARY/ », « /RFB/INV 4471 PAGO A » */
  /^\s*\/(?:beneficiary|benef|applicant|ordering\s+customer|by\s+order\s+of|acc|acct)\/\s*/iu,
  /^\s*(?:\/rfb\/|\/inv\/)?\s*(?:inv(?:oice)?\s*\d+\s*)?(?:pago\s+a|payment\s+(?:to|for)|paiement\s+[aà])\s+/iu,
  /* une citation de registre devant le nom : « Registro Público de Panamá, Tomo 1245, Folio 332, Asiento 1 — »,
     « Corporate Number 8011001077453 — » */
  /^\s*(?:registro\s+p[uú]blico\b[^—–]*|corporate\s+number\s+\d+\s*)[—–-]\s*/iu,
  /^\s*att(?:n|ention)?\.?\s*:?\s+[^,/]{1,40}[,/]\s*/iu,
  /^\s*(?:our|your|yr|their)?\s*ref(?:erence)?\.?\s*(?:no\.?|#)?\s*:?\s*[a-z0-9][a-z0-9\-/.]{2,}\s+/iu,
  /^\s*(?:l\/c|lc|dc|b\/l|bl|inv(?:oice)?|p\/?o|contract|order)\s*(?:no\.?|#)\s*:?\s*[a-z0-9][a-z0-9\-/.]{2,}\s+/iu,
  /^\s*(?:n\/b\s+)?hull\s*(?:no\.?\s*)?[a-z]{0,3}-?\d+\s+(?=\p{L}{3,})/iu,
  /* jeu 15 : l'étiquette d'un paiement mobile devant le nom (« JazzCash: », « Easypaisa acct: », « Till: », « M-Pesa Paybill 123 »),
     et la citation du registre pakistanais (« SECP Reg. 0012345 ») */
  /^\s*(?:jazzcash|easypaisa|m-?pesa|mpesa|tigo\s*pesa|airtel\s*money|mtn\s*momo|momo|paybill|till)\s*(?:acct|account|a\/c|no\.?|number|#)?\.?\s*:?\s*(?:\d{4,}\s*)?[:\-]?\s*/iu,
  /^\s*(?:secp|cac|brela|ursb|kra|fbr)\s+reg(?:istration|\.)?\s*(?:no\.?|#)?\s*:?\s*[a-z0-9\-/]{3,}\s+/iu,
  /* les étiquettes grecques d'un document devant le nom (jeu 17, tour 13) : « Τιμολόγιο προς: » (facture à), « Προς: », « Επωνυμία: »
     (raison sociale), « Πλοιοκτήτης: » (armateur), « Διαχειριστής: », « Ναυλωτής: », « Αγοραστής: », « Πωλητής: », « Δικαιούχος: »,
     « Αποστολέας: », « Παραλήπτης: », « Πελάτης: », « Προμηθευτής: » ; le deux-points ou le tiret est exigé, comme en anglais ;
     et le numéro fiscal grec devant le nom (« ΑΦΜ 998124567 … », neuf chiffres) */
  /^\s*(?:τιμολ[οό]γιο\s+προς|απ[οό]δειξη\s+προς|προς|επωνυμ[ιί]α|πλοιοκτ[ηή]τ(?:ης|ρια)|διαχειρ[ιί]στ(?:ης|ρια)|ναυλωτ[ηή]ς|αγοραστ[ηή]ς|πωλητ[ηή]ς|δικαιο[υύ]χος|αποστολ[εέ]ας|παραλ[ηή]πτης|πελ[αά]της|προμηθευτ[ηή]ς)\s*[:\-\u2013]\s*/iu,
  /^\s*(?:α\.?\s?φ\.?\s?μ\.?|afm)\s*:?\s*(?:el\s?)?\d{9}\s+/iu,
  /* « CPTE NO 4455 ETS OUATTARA » (jeu 16) : le numéro de compte devant le nom, en français, espagnol, portugais, anglais */
  /^\s*(?:cpte|compte|cta|cuenta|conta|a\/c|acct|account)\.?\s*(?:no\.?|n[°º]|nr\.?|#)?\s*:?\s*[a-z0-9\-/]{3,}\s+/iu,
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
  /* le numéro fiscal grec derrière le nom (« ΑΦΜ 998124567 »), et le bureau des impôts qui le suit ou le précède (« ΔΟΥ ΦΑΕ ΠΕΙΡΑΙΑ » :
     jeu 17, tour 13, 0,800 par les mots orphelins) */
  /\s+(?:α\.?\s?φ\.?\s?μ\.?|afm)\s*:?\s*(?:el\s?)?\d{9}\b.*$/iu,
  /\s+δ\.?\s?ο\.?\s?υ\.?\s+[\p{L}' .-]{2,40}\s*$/iu,
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
  /* les champs d'un registre de navires derrière une virgule, étiquette puis valeur, jusqu'à trois de suite : « , flag
     Russia, port Rostov-on-Don », « , home port Astrakhan », « , port of registry Taganrog » (jeu 12, 28/09 : « T/H VOLNA
     DONA-2208 » face à « VOLNA DONA 2208, flag Russia, port Rostov-on-Don » à 0,599, cinq mots rares sans répondant) */
  /(?:,\s*(?:flag(?:ged)?|pavillon|bandera|(?:home\s*)?port(?:\s+of\s+registry)?|registry|homeport)\s*:?\s*[\p{L} .'-]{2,30}){1,3}\s*$/iu,
  /* jeu 14 : le numéro ENI d'une barge du Rhin (huit chiffres), avec ou sans parenthèse ; « T.A.V. » (ter attentie van),
     l'attention néerlandaise, et tout ce qui la suit */
  /\s*\(?\s*ENI\s*:?\s*\d{8}\s*\)?\s*$/iu,
  /* jeu 17 : le pavillon derrière une barre (« / Liberia »), son code entre parenthèses en queue (« (LR) », « (TR) »), la
     phrase turque « (Türk bayraklı) », l'immatriculation maltaise « (Malta) C 84512 », et le type de navire derrière une
     virgule (« , dumb barge ») */
  /\s*\/\s*(?:liberia|panama|malta|marshall\s+islands|cyprus|greece|turkey|bahamas|singapore|hong\s+kong|antigua(?:\s+and\s+barbuda)?|st\.?\s*kitts|vanuatu|togo|palau|cameroon|sierra\s+leone|comoros|tanzania|moldova|belize|cook\s+islands|gibraltar|madeira|norway|denmark|netherlands|germany|italy|spain|portugal|france|united\s+kingdom|russia|ukraine|georgia|azerbaijan|kazakhstan|iran|india|china|japan|korea|philippines|indonesia|malaysia|thailand|vietnam)\s*$/iu,
  /\s*\((?:LR|LBR|PA|PAN|MT|MLT|MH|MHL|CY|CYP|GR|GRC|TR|TUR|BS|BHS|SG|SGP|HK|HKG|VU|TG|PW|KM|BZ|GI|AG|KN|TZ|MD|CK|NO|DK|NL|DE|IT|ES|PT|FR|GB|UK|RU|UA|GE|AZ|KZ|IR|IN|CN|JP|KR|PH|ID|MY|TH|VN)\)\s*$/u,
  /\s*\((?:t[üu]rk|turkish|greek|liberian|panamanian|maltese|cypriot)\s+(?:bayrakl[ıi]|flag(?:ged)?)\)\s*$/iu,
  /\s*\(\s*malta\s*\)\s*C\s*\d{4,6}\s*$/iu,
  /\s*,\s*(?:dumb\s+|pusher\s+|motor\s+|tank\s+)?(?:barge|tug|tanker|bulker|bulk\s+carrier|pusher|lighter)\s*$/iu,
  /* jeu 15 : le CNIC pakistanais, le PIN kényan, le TIN et le NTN entre parenthèses derrière le nom */
  /\s*\(\s*(?:cnic|kra\s*pin|pin|tin|ntn|gstin|cin)\s*:?\s*[a-z0-9\-]{6,20}\s*\)\s*$/iu,
  /* « Curtume Bianchi Ltda - ME » (jeu 16) : la taille d'entreprise brésilienne (ME, EPP, MEI) derrière la forme */
  /(?<=\b(?:ltda|eireli|s\.?a\.?|me)\.?)\s*[-\u2013(]\s*(?:me|epp|mei)\s*\)?\s*$/iu,
  /\s+t\.?\s?a\.?\s?v\.?\s+.*$/iu,
  /* « Kenanga Pacific Sdn. Bhd. - Penang Branch » : la succursale après un tiret ; « Succursale de Genève », « Sucursal Lima » ;
     et le siège ou le bureau derrière une virgule ou un tiret (« , Head Office », « , Hauptsitz », « , Havengebied Kantoor ») :
     ce qu'ils nommaient, la variante le garde en mention (voir `mentionDeSuccursale`) */
  new RegExp(`\\s+[-\\u2013]\\s+[^,]*(?<![\\p{L}])(?:${[...SUCCURSALES].join("|")}|${MOTS_DE_SIEGE}|${MOTS_DE_BUREAU})(?![\\p{L}])(?!\\s*\\d).*$`, "iu"),
  /* la même mention entre parenthèses (« (Bureau de Douala) », « (Succursale de Sikasso) », jeu 16) */
  new RegExp(`\\s*\\((?:${[...SUCCURSALES].join("|")}|${MOTS_DE_SIEGE}|${MOTS_DE_BUREAU})\\s+(?:de\\s+la|de|du|des|da|do|of|di|van|von|in|en|a|\\u00e0)\\s+[^()]{2,30}\\)\\s*$`, "iu"),
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
  /* jeu 12 : « , port Rostov-on-Don », « - OWNERS ACCOUNT », « (THE SELLER) », « (publ) », les lignes 2/ et 3/ du champ 50F,
     la politesse d'un message (« asap », « thx ») */
  /,\s*port\s*:?\s*[\p{L} .'-]{2,30}\s*$/iu,
  /\s*[-\u2013]\s*owners?\s+acc(?:oun)?t\s*$/iu,
  /\s*\(\s*(?:the\s+)?(?:seller|buyer|shipper|consignee|applicant|beneficiary|carrier|charterer|owner|agent|notify\s+party|principal|supplier|customer)s?\s*\)/giu,
  /\s*\(\s*publ\.?\s*\)/giu,
  /\s+2\/\s*\S.*$/u,
  /[\s,]+(?:asap|thx|thanks|tks|pls|please|svp|merci)\s*[.!]?\s*$/iu,
  /* la demande d'un clavardage derrière le nom : « pls confirm order », « please check asap », « kindly advise » (jeu 13,
     tour 9 : « sanghvi diamnd exp mumbai pls confirm order » à 0,562, trois mots rares sans répondant). Le mot de politesse
     est exigé devant le verbe : « Order » ou « Check » seuls peuvent être des mots du nom */
  /[\s,]+(?:pls|plz|please|kindly|svp)\s+(?:confirm|check|advise|verify|screen|revert|approve|proceed|look|help|send|share)\b.*$/iu,
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
  /* l'adresse japonaise derrière le nom, que le signe postal 〒 ouvre toujours (« Kimura Sōko Kabushiki Kaisha 〒105-0022
     東京都港区海岸1-2-3 », jeu 11 : lue en pinyin, elle faisait un mot rare et des numéros d'un seul côté) */
  /\s*〒.*$/u,
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
  /* les ports d'attache du Rhin, de la Meuse et de l'Escaut, écrits seuls derrière le nom d'une barge (jeu 14) */
  "werkendam", "dordrecht", "rotterdam", "kampen", "zwijndrecht", "papendrecht", "sliedrecht", "hardinxveld", "nijmegen", "antwerpen",
  "gent", "duisburg", "mannheim", "basel", "lobith", "millingen", "deventer", "zwolle", "maasbracht", "terneuzen", "vlissingen",
  "moerdijk", "krimpen", "alblasserdam", "gorinchem", "tiel", "wanssum", "roermond", "venlo", "arnhem", "doesburg", "hasselt",
  "meppel", "harlingen", "delfzijl", "groningen", "lemmer", "urk", "emmerich", "wesel", "koblenz", "ludwigshafen", "karlsruhe",
  "kehl", "strasbourg", "mulhouse", "amsterdam", "utrecht", "den bosch", "hertogenbosch", "brugge", "liege", "luik", "namur",
  /* l'océan Indien et l'Afrique de l'Est (jeu 15) */
  "mombasa", "kilindini", "dar es salaam", "zanzibar", "tanga", "mtwara", "kampala", "kisumu", "lamu", "malindi", "karachi", "gwadar",
  "port qasim", "muscat", "salalah", "aden", "djibouti", "berbera", "mogadishu", "kismayo", "beira", "nacala", "durban", "maputo",
  /* l'Afrique de l'Ouest francophone et l'Atlantique sud (jeu 16) */
  "abidjan", "port bouet", "bouet", "vridi", "treichville", "cocody", "dakar", "bamako", "ouagadougou", "douala", "lome", "cotonou",
  "conakry", "san pedro", "santos", "paranagua", "rio grande", "itajai", "vitoria", "salvador", "recife", "fortaleza", "manaus",
  "buenos aires", "rosario", "bahia blanca", "montevideo", "valparaiso", "callao", "guayaquil", "cartagena", "barranquilla",
  /* la Grèce, Chypre, la Turquie et l'Asie centrale (jeu 17) */
  "piraeus", "pireas", "peiraias", "thessaloniki", "volos", "patras", "heraklion", "limassol", "lemesos", "larnaca", "famagusta",
  "samsun", "mersin", "izmir", "iskenderun", "trabzon", "gemlik", "aliaga", "ambarli", "tekirdag", "bandirma", "istanbul",
  "almaty", "astana", "pavlodar", "aktau", "atyrau", "shymkent", "tashkent", "bishkek", "bukhara", "samarkand",
  "riga", "hamina", "kotka", "helsinki", "turku", "tallinn", "klaipeda", "constanta", "poti", "batumi", "goteborg", "gothenburg", "stockholm",
  "oslo", "copenhagen", "aarhus", "gdansk", "gdynia", "varna", "burgas", "odesa", "odessa", "mykolaiv", "kherson", "izmail", "samsun",
  "trabzon", "novorossiysk", "rostov", "taganrog", "izmir",
  "sharjah", "ajman", "fujairah", "dubai", "abu dhabi", "jeddah", "riyadh", "dammam", "muscat", "doha", "manama", "kuwait",
  "karachi", "lahore", "mumbai", "chennai", "kolkata", "colombo", "chittagong", "jakarta", "surabaya", "medan", "dumai", "belawan",
  "klang", "penang", "johor", "kuching", "bangkok", "laem", "chabang", "haiphong", "hochiminh", "saigon", "manila", "cebu",
  "shanghai", "ningbo", "qingdao", "tianjin", "shenzhen", "guangzhou", "xiamen", "dalian", "fangcheng", "hongkong", "kaohsiung",
  "busan", "incheon", "tokyo", "yokohama", "kobe", "osaka", "rotterdam", "antwerp", "antwerpen", "hamburg", "bremen", "bremerhaven",
  "felixstowe", "southampton", "havre", "marseille", "genoa", "genova", "piraeus", "istanbul", "izmir", "mersin", "alexandria",
  "lagos", "apapa", "tema", "abidjan", "mombasa", "durban", "santos", "houston", "newark", "savannah", "vancouver"]);
/** Les codes pays à deux lettres qu'un export colle derrière la ville. */
const CODES_PAYS: ReadonlySet<string> = new Set(["fi", "se", "no", "dk", "ee", "lv", "lt", "pl", "de", "nl", "be", "fr", "es", "it", "pt", "ro",
  "bg", "gr", "tr", "ua", "ru", "ge", "us", "uk", "gb", "ie", "ch", "at", "cz", "sk", "hu", "sg", "my", "id", "th", "vn", "cn", "hk", "jp", "kr",
  "in", "pk", "ae", "sa", "qa", "eg", "ma", "ng", "gh", "ke", "za", "br", "ar", "cl", "mx", "pa", "co", "pe", "au", "nz", "ca"]);
const FORME_EN_LIGNE = /\b(?:co\.?,?\s*ltd\.?|co(?=\.)|limited|ltd\.?|inc\.?|llc|l\.l\.c\.|corp\.?|corporation|oy|ab|aps|ou|sia|uab|ltda|lda|sarl|sas|kft|tov|pao|zao|a\.s\.|a\/s|gmbh|s\.?a\.?|b\.?v\.?|n\.?v\.?|pte\.?\s*ltd\.?|pvt\.?\s*ltd\.?|sdn\.?\s*bhd\.?|s\.?p\.?a\.?|s\.?r\.?l\.?|a\.?s\.?|plc|kk|k\.k\.|jsc|ooo|fze|fzco|est\.?)\b/giu;

/** Une variante d'un nom brut, et ce qu'elle est. `ancien` : un nom que le document annonce comme un
 *  AUTRE nom du même (« ex », « f/k/a », « formerly », « a.k.a. », « t/a ») ; un ancien nom d'un seul côté
 *  reste la même coque (« MV Warri Osprey » face à « MV Apapa Falcon (ex Warri Osprey) »), mais un ancien
 *  nom retrouvé des DEUX côtés sous deux noms actuels différents est une coque vendue et renommée, ou
 *  deux coques qui ont porté ce nom : le possible, jamais le fort (jeu 10, 27/09 : cinq paires de navires à
 *  1,000 par leur seul ancien nom). `mention` : ce que nommait la mention de succursale que la variante a
 *  perdue (voir `mentionDeSuccursale`), « » sinon. */
export type VarianteTypee = { texte: string; ancien: boolean; mention: string;
  /** les numéros de registre du nom brut (voir `numeroDeRegistre`), portés par toutes ses variantes */
  registre: string;
  /** la PARTIE d'un document que le nom brut porte en étiquette : « (Applicant) », « /BENEFICIARY/ », « Consignee: »,
   *  « (THE SELLER) », « - DRAWEE ». L'applicant et le bénéficiaire d'un même crédit sont deux personnes par
   *  construction, quels que soient les mots (jeu 12 : « Femi Alade Import Export Company Limited (Applicant) »
   *  face à « Alade Femi Export Import Company Limited (Beneficiary) », 0,90 sans cette propriété) ; l'étiquette
   *  est ôtée des textes, la propriété la garde, `plafondDesLectures` la lit. Une seule partie par nom brut. */
  partie: string;
  /** le PAYS D'IMMATRICULATION écrit entre parenthèses en queue du nom (« Evdokimos Navigation Corp. (Liberia) ») : deux pays
   *  différents sont deux sociétés d'un même armateur (jeu 17, 28/09 : 1,000 face à « (Marshall Islands) », la parenthèse
   *  ôtée des deux côtés) ; la propriété la garde, `plafondDesLectures` la lit ; un pays d'un seul côté ne dit rien */
  paysRegistre: string };
/** Les pays qu'un registre de navires ou d'armateurs écrit entre parenthèses derrière le nom, et leur code. */
const PAYS_DE_REGISTRE: ReadonlyMap<string, string> = new Map(Object.entries({
  liberia: "LR", panama: "PA", malta: "MT", "marshall islands": "MH", cyprus: "CY", greece: "GR", turkey: "TR", bahamas: "BS", singapore: "SG",
  "hong kong": "HK", bermuda: "BM", "cayman islands": "KY", "british virgin islands": "VG", bvi: "VG", gibraltar: "GI", "isle of man": "IM",
  luxembourg: "LU", switzerland: "CH", monaco: "MC", uae: "AE", "united arab emirates": "AE", dubai: "AE", seychelles: "SC", mauritius: "MU",
  vanuatu: "VU", belize: "BZ", delaware: "US", nevada: "US", wyoming: "US", "cook islands": "CK", samoa: "WS", "st vincent": "VC", "st kitts": "KN",
  antigua: "AG", togo: "TG", palau: "PW", comoros: "KM", "sierra leone": "SL", cameroon: "CM", tanzania: "TZ", moldova: "MD", georgia: "GE",
}));
export function paysDeRegistre(brut: string): string {
  const m = /\(\s*([\p{L} .']{3,25}?)\s*\)\s*$/u.exec(brut);
  return m ? PAYS_DE_REGISTRE.get(normaliser(m[1]!)) ?? "" : "";
}
/** La partie d'un document qu'un nom brut nomme, en minuscules, ou « » : les trois formes d'étiquette
 *  (parenthèse, barres SWIFT, tête ou queue de ligne). Le nom NE dit rien de sa partie : rien. */
export function partieDuDocument(brut: string): string {
  const m = /(?:^|[\s(\/\-\u2013])(?:the\s+)?(applicant|beneficiary|seller|buyer|shipper|consignee|drawee|drawer|remitter|payee|ordering\s+customer)s?\s*(?:[:)\/\-\u2013]|$)/iu.exec(brut);
  return m ? m[1]!.toLowerCase().replace(/\s+/g, " ") : "";
}
/** Les formes et génériques qu'un export en capitales colle à la queue d'un nom sans espaces, du plus long au plus
 *  court, trois lettres au moins (les formes de deux lettres, SA, BV, AS, couperaient « MIMOSA ») ; ce qui reste devant
 *  garde six lettres au moins ; « IMP » et « EXP » seuls n'y sont pas (« NORTHSHRIMP » perdait « IMP »). */
const QUEUES_COLLEES = ["ENTERPRISES", "INDUSTRIES", "ENTERPRISE", "HOLDINGS", "TRADING", "TRADERS", "EXPORTS", "IMPORTS", "PTYLTD", "PTELTD",
  "PVTLTD", "SDNBHD", "IMPEXP", "EXPIMP", "EXPORT", "IMPORT", "COLTD", "FOODS", "GROUP", "GMBH", "CORP", "MCHJ", "OSOO",
  /* et les mots du commerce des céréales d'Asie centrale et leurs russismes, que le même champ colle entre le nom et la forme
     (« ATBASARASTYKTREID », « JETYSUAGROTREIDTOO », jeu 17, tour 13) : détachés, ils se traduisent comme ceux de l'autre nom */
  "LOGISTIKA", "EKSPORT", "TRANZIT", "SERVIS", "ASTYK", "ASTYQ", "SAVDO", "SAUDA", "TREID", "AGRO",
  "LTD", "LLC", "INC", "PLC", "BHD",
  /* et les formes de la CEI et d'Asie centrale (« JETYSUAGROTREIDTOO ») */
  "TOO", "OOO", "LLP", "JSC", "ZAO", "OAO"];
const QUEUES_EN_MOTS: ReadonlyMap<string, string> = new Map([["PTYLTD", "PTY LTD"], ["PTELTD", "PTE LTD"], ["PVTLTD", "PVT LTD"],
  ["SDNBHD", "SDN BHD"], ["IMPEXP", "IMP EXP"], ["EXPIMP", "EXP IMP"], ["COLTD", "CO LTD"]]);
export function decollerLesQueues(s: string): string {
  const queues: string[] = [];
  let tete = s;
  for (;;) {
    const q = QUEUES_COLLEES.find((x) => tete.endsWith(x) && tete.length - x.length >= 6);
    if (q === undefined) break;
    tete = tete.slice(0, -q.length); queues.unshift(QUEUES_EN_MOTS.get(q) ?? q);
  }
  return queues.length ? [tete, ...queues].join(" ") : s;
}
/** Les formes qu'une casse mêlée écrit sans les coller à rien : jamais coupées (« mbH » coupé en « mb H » perdait le conflit GmbH
 *  contre & Co. KG, mesuré le 29/09). */
const FORMES_A_CASSE: ReadonlySet<string> = new Set(["gmbh", "mbh", "kgaa", "gesmbh", "ggmbh", "ohg", "ekg", "sprl", "bvba", "cvba", "scrl", "sagl", "plc"]);
/** Les mots de rue que l'adresse d'un export colle au nom, et les codes d'État ou de province qui suivent une ville. */
const RUES = ["AVENIDA", "STRASSE", "STREET", "ROUTE", "CALLE", "ROAD", "RUA", "RUE", "ULITSA", "PROSPEKT", "KOCHASI", "UL"];
const CODES_ETATS: ReadonlySet<string> = new Set(["SP", "RJ", "PR", "SC", "RS", "MG", "BA", "PE", "CE", "ES", "GO", "PA", "AM", "MT", "MS",
  "WA", "NSW", "QLD", "VIC", "SA", "TAS", "NT", "ACT", "ON", "QC", "BC", "AB"]);
/** Un nom en capitales dont le dernier mot porte une ville, un port ou une rue collés : « FRERESABIDJAN » rend « FRERES », « SCHMIDTRUA15 »
 *  rend « SCHMIDT », « TANAKASANTOS SP » rend « TANAKA » ; quatre lettres de nom au moins devant, la ville cinq au moins. */
export function decollerLAdresse(s: string): string {
  const rue = new RegExp(`^(.*?\\p{L}{4,}?)(?:${RUES.join("|")})(?:\\s*\\d.*|\\s+(?:DE|DA|DO|DOS|DAS|DES|DU|DEL|DE\\s+LA)\\s+.*|\\.\\S.*|\\s*)$`, "u");
  const m = rue.exec(s);
  if (m) return m[1]!.trim();
  const mots = s.split(/\s+/);
  /* « FILSPORT BOUET » : le port en deux mots, son premier collé au nom */
  if (mots.length >= 2 && PORTS_ET_QUARTIERS.has(mots[mots.length - 1]!.toLowerCase()) && /\p{L}{4,}(?:PORT|PORTO|PUERTO)$/u.test(mots[mots.length - 2]!)) {
    return [...mots.slice(0, -2), mots[mots.length - 2]!.replace(/(?:PORT|PORTO|PUERTO)$/u, "")].join(" ");
  }
  for (let i = mots.length - 1; i >= 0 && i >= mots.length - 2; i--) {
    const j = mots[i]!;
    for (const v of PORTS_ET_QUARTIERS) {
      const V = v.toUpperCase().replace(/ /g, "");
      if (V.length >= 5 && j.endsWith(V) && j.length - V.length >= 4) {
        const tete = [...mots.slice(0, i), j.slice(0, -V.length)];
        const reste = mots.slice(i + 1);
        if (reste.length === 0 || (reste.length === 1 && CODES_ETATS.has(reste[0]!))) return tete.join(" ");
      }
    }
  }
  return s;
}
/** LA VILLE DERRIÈRE UN NOM EN CAPITALES DONT LA FORME EST EN TÊTE (« OSOO ISSYK-KUL AGRO TRANZIT BISHKEK », « MCHJ ZARAFSHON UN SAVDO
 *  SAMARKAND », « AO … PAVLODAR KAZAKHSTAN », jeu 17, tour 13 : un mot rare orphelin, 0,688 et 0,800), ou juste devant la ville dans une
 *  variante décollée (« JETYSU AGRO TREID TOO ALMATY », que la règle de la ville nue, lue sur le nom écrit, ne voit pas) : un port ou une
 *  ville connus (PORTS_ET_QUARTIERS), suivis ou non de leur pays, derrière deux mots de nom au moins. En casse mêlée « Almaty » est un mot
 *  du nom. */
const PAYS_D_ASIE_CENTRALE = /^(?:kazakhstan|uzbekistan|kyrgyzstan|tajikistan|turkmenistan)$/;
function sansVilleEnQueue(t: string): string {
  if (/\p{Ll}/u.test(t)) return t;
  const mots = t.split(/\s+/);
  if (mots.length < 4) return t;
  const dernier = () => normaliser(mots[mots.length - 1]!);
  if (PAYS_MOTS.has(dernier()) || PAYS_D_ASIE_CENTRALE.test(dernier())) mots.pop();
  const formeEnTete = FORMES.has(normaliser(mots[0]!)), formeDevant = FORMES.has(normaliser(mots[mots.length - 2] ?? ""));
  /* la ponctuation qui séparait la ville tombe avec elle (« PT PKS RIMBA KENARI, DUMAI » rend « PT PKS RIMBA KENARI », jeu 5) */
  return mots.length >= 4 && (formeEnTete || formeDevant) && PORTS_ET_QUARTIERS.has(dernier()) ? mots.slice(0, -1).join(" ").replace(/[\s,;:\-\u2013]+$/u, "") : t;
}
let LIEU_DEVANT_BRANCH: RegExp | undefined;
/* construit à l'appel et non au chargement : FORMES vient de la préparation, qui importe ce fichier (voir CARTE.md, le cycle) */
/** Le lieu devant « branch », sans virgule ni tiret : derrière la forme (« Kano Merchant Bank Limited Sabon Gari Branch », un ou deux mots),
 *  ou le dernier mot d'un nom dont la forme de la CEI est en tête (« AO Uly Dala Agro Holding Almaty Branch »). */
function lieuDevantBranch(): RegExp {
  return (LIEU_DEVANT_BRANCH ??= new RegExp(`^(\\S+(?:\\s+\\S+)+?\\s+(?:${[...FORMES].join("|")})\\.?)\\s+[\\p{L}-]{3,}(?:\\s+[\\p{L}-]{3,})?\\s+branch\\s*$`
    + `|^((?:${[...FORMES_SLAVES].join("|")})\\s+\\S+(?:\\s+\\S+)+?)\\s+[\\p{L}-]{3,}\\s+branch\\s*$`, "iu"));
}
/** Les variantes d'un nom brut, textes seuls (voir `variantesTypees`). */
export function variantes(brut: string): string[] {
  return variantesTypees(brut).map((v) => v.texte);
}
export function variantesTypees(brut: string): VarianteTypee[] {
  const vues = new Map<string, VarianteTypee>();
  /* les astérisques d'un message de banque (« *** COMPANIA … *** PANAMA », jeu 11) ne sont que du décor */
  /* UN TAMPON SCANNÉ épelle les lettres (« M A L H O T R A  B R O S », jeu 13, 0,515) : les lettres seules séparées d'une
     espace se soudent et les doubles espaces séparent les mots, lu AVANT que les espaces se resserrent ; « S A S » et
     « J P Morgan » gardent leur soudure (préparation) */
  const tampon = /^(?:\p{L} )+\p{L}(?:\s{2,}(?:\p{L} )+\p{L})+\s*$/u.test(brut) ? brut.trim().split(/\s{2,}/).map((m) => m.replace(/ /g, "")).join(" ") : undefined;
  brut = brut.replace(/\*+/g, " ").replace(/\s{2,}/g, " ").trim();
  /* « (ex-Lindos Harrier until 2019) » (jeu 17) : la durée de l'ancien nom n'est pas le nom */
  brut = brut.replace(/\s+(?:until|till|up\s+to|bis|hasta|jusqu'(?:en|[aà]))\s+(?:\d{1,2}\/)?\d{4}(?=\s*[),]|$)/giu, "");
  /* une ligne de 35 caractères qui finit par une lettre seule après une conjonction (« SANAYI VE T », jeu 17) : la lettre est la
     tête d'un mot coupé, elle tombe */
  if (!/\p{Ll}/u.test(brut) && brut.length >= 30 && brut.length <= 36) brut = brut.replace(/\s+(?:VE|AND|UND|ET|EN|E|Y|I|OG|OCH)\s+\p{L}$/u, "");
  /* « (Amharic: ተስፋዬ በቀለ ንግድ) » : l'étiquette de langue s'efface, la parenthèse native reste (jeu 10) */
  brut = brut.replace(/\(\s*(?:amharic|arabic|chinese|japanese|korean|thai|hebrew|russian|greek|hindi|tamil|persian|farsi|urdu|bengali|in\s+\p{L}+)\s*:\s*/giu, "(");
  /* une adresse collée à la forme sans espace, champ 59 : « Company Limited45 Marina Road » (jeu 10) */
  /* le numéro de la rue est un nombre entier suivi d'une espace ou d'une ponctuation, jamais de lettres : « Sa3eed » n'est pas
     « S.A. » collé au 3 d'une adresse, c'est l'ayn de l'arabizi (jeu 14 ; voir arabizi.ts) */
  brut = brut.replace(/\b(limited|ltd|plc|inc|llc|corp|gmbh|bv|nv|sa|sarl|lda|ltda|pty|bhd)\.?(?=\d+(?![\p{L}\d]))/giu, "$1 ");
  const registre = numeroDeRegistre(brut);
  const partie = partieDuDocument(brut);
  const paysRegistre = paysDeRegistre(brut);
  const poser = (texte: string, ancien: boolean, mention: string) => { if (!vues.has(texte)) vues.set(texte, { texte, ancien, mention, registre, partie, paysRegistre }); };
  poser(brut.trim(), false, "");
  /* UN NOM SANS ESPACES (jeu 13, 28/09 : « CarmichaelExportsPtyLtd » à 0,482, « GUANGZHOUFENGYUANIMPEXP » et
     « WEIFANGHENGTAIFOODSCOLTD » à 0,000 face à leurs noms écrits) : les majuscules intérieures coupent les mots ; en
     capitales, les formes et génériques collés en queue se détachent un à un (COLTD, PTYLTD, IMPEXP), et le reste demeure
     un bloc que le score compare aux mots de l'autre nom ressoudés (voir le bloc dans scorePrepares) */
  const seul = brut.trim();
  if (!/\s/.test(seul) && /\p{L}{8,}/u.test(seul)) {
    if (/\p{Ll}\p{Lu}/u.test(seul)) poser(seul.replace(/(\p{Ll})(\p{Lu})/gu, "$1 $2").replace(/(\p{Lu}+)(\p{Lu}\p{Ll})/gu, "$1 $2"), false, "");
    else if (!/\p{Ll}/u.test(seul)) { const d = decollerLesQueues(seul); if (d !== seul) poser(d, false, ""); }
  }
  /* plusieurs jetons dont l'un colle deux mots par sa casse (« EtsAbouKhalil etFils », jeu 16) : chaque jeton de huit lettres,
     ou qui commence par une minuscule, se coupe à ses majuscules intérieures ; « GmbH », « KGaA », « McDonald » restent entiers */
  if (/\s/.test(seul) && /\p{Ll}\p{Lu}/u.test(seul)) {
    const coupe = seul.split(/\s+/).map((j) => (/\p{Ll}\p{Lu}/u.test(j) && (j.length >= 8 || (/^\p{Ll}/u.test(j) && j.length >= 5)) && !FORMES_A_CASSE.has(j.toLowerCase()) ? j.replace(/(\p{Ll})(\p{Lu})/gu, "$1 $2") : j)).join(" ");
    if (coupe !== seul) poser(coupe, false, "");
  }
  /* un nom tout en capitales où une ville, un port ou une rue est collé au dernier mot (« ETS KONE ET FRERESABIDJAN »,
     « FRIGORIFICO WERNER SCHMIDTRUA15 », « IMPORTADORA TANAKASANTOS SP », jeu 16) : l'adresse tombe, le nom reste */
  if (!/\p{Ll}/u.test(seul) && /\p{Lu}{8,}/u.test(seul)) { const d = decollerLAdresse(seul); if (d !== seul) poser(d, false, ""); }
  /* le D' d'un nom tout en capitales est l'élision autant que le nom (« ESPOIR D'ABIDJAN », « D'ANGELO », jeu 16) : la variante
     sans lui s'ajoute, le nom tel qu'écrit reste */
  if (!/\p{Ll}/u.test(seul) && /(?<!\p{L})D['’](?=\p{L})/u.test(seul)) poser(seul.replace(/(?<!\p{L})D['’](?=\p{L})/gu, ""), false, "");
  if (tampon !== undefined) poser(tampon, false, "");
  /* le registre écrit la personne nom d'abord : « Okeke, Chidi Building Materials » (jeu 10) */
  const inverse = /^([\p{Lu}][\p{L}'-]+),\s+([\p{Lu}][\p{L}'-]+)\s+(\p{L}.*)$/u.exec(brut.trim());
  if (inverse) poser(`${inverse[2]} ${inverse[1]} ${inverse[3]}`, false, "");
  /* LA SUCCURSALE À LA RUSSE : « Филиал ТОО «Ертіс Астық Флот» в г. Павлодар » (« Filial … v g. Pavlodar »), le mot devant et la ville
     derrière, sans virgule ni tiret que `mentionDeSuccursale` saurait lire ; ou l'adjectif de ville devant le mot (« Павлодарский филиал
     ТОО «X» »). La variante est la société, et la mention garde la ville (jeu 17, tour 13 : 0,685, « filial », « v », « g », « pavlodar »
     quatre mots orphelins ; la succursale face au nom nu est la même personne) */
  const filiale = /^\s*(?:(\p{Lu}[\p{L}-]+(?:ский|ская|skiy|skaya|skii|skaia))\s+)?(?:филиал|філія|filial|filiya|filiala)\s+(.+?)(?:\s+(?:в|у|v|u)\s+(?:г\.?|м\.?|g\.?|городе|gorode|city of)\s*(\p{L}[\p{L}-]+))?\s*$/iu.exec(brut.trim());
  if (filiale && filiale[2] && (filiale[1] || filiale[3]) && /\p{L}{3,}/u.test(filiale[2])) {
    const ville = filiale[3] ?? filiale[1]!.replace(/(?:ский|ская|skiy|skaya|skii|skaia)$/iu, "");
    poser(filiale[2], false, normaliser(plier(ville)));
  }
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
  /* la même parenthèse d'écriture native N'IMPORTE OÙ dans le nom (« Aoyagi Seisakusho (アオヤギ製作所) Co., Ltd. »,
     « (株)Kuramochi Kōgyō », jeu 11) : le nom sans elle est une lecture de plus, son contenu une autre ; la fin de nom
     ci-dessus n'en est que le cas où rien ne suit. Rien n'est retiré : le nom tel qu'écrit reste une variante */
  for (const m of brut.trim().matchAll(/\(([^()]+)\)/gu)) {
    const dedans = m[1]!.trim();
    const dehors = `${brut.trim().slice(0, m.index)} ${brut.trim().slice(m.index! + m[0].length)}`.replace(/\s{2,}/g, " ").trim();
    if (dedans !== "" && /\p{L}/u.test(dehors) && nonLatin.test(dedans) !== nonLatin.test(dehors)) { poser(dehors, false, ""); poser(dedans, false, ""); }
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
    /* LE LIEU DEVANT « BRANCH », sans virgule ni tiret (« Kano Merchant Bank Limited Sabon Gari Branch » ; « AO Uly Dala Agro Holding Almaty
       Branch », jeu 17, tour 13 : « almaty » orphelin, 0,800 face au nom nu) : la mention le garde (`mentionDeSuccursale`, lue plus haut), le
       texte le perd, et la succursale face au nom nu est la même personne, le fort. Lu AVANT les annotations, dont l'une ôte « branch » seul */
    p = p.replace(lieuDevantBranch(), (m, forme: string | undefined, tete: string | undefined) => forme ?? tete ?? m);
    do { avant = p; for (const r of ANNOTATIONS) p = p.replace(r, "").replace(/\s{2,}/g, " ").trim(); } while (p !== avant);
    /* la ville derrière un nom en capitales dont la forme est en tête (voir `sansVilleEnQueue`) */
    p = sansVilleEnQueue(p);
    /* et les mots de douze capitales au moins qui collent une forme ou un générique à leur queue (« JETYSUAGROTREIDTOO ALMATY », « TOO
       ATBASARASTYKTREID », jeu 17, tour 13 : 0,292, la forme jamais lue) : détachés ICI, après les annotations, pour que la ville collée
       derrière parte aussi ; une variante de plus, le nom tel qu'écrit reste */
    if (/\s/.test(p) && !/\p{Ll}/u.test(p) && /\p{Lu}{12,}/u.test(p)) {
      const d = sansVilleEnQueue(p.split(/\s+/).map((t) => (/^\p{Lu}{12,}$/u.test(t) ? decollerLesQueues(t) : t)).join(" "));
      if (d !== p) poser(d, ancien, mentionDe(d));
    }
    /* « MV RONG YUAN TAI 16 AT FANGCHENG » : derrière un navire préfixé, « at » et un lieu sont le port d'embarquement */
    p = p.replace(/^((?:m\/?v|m\/?t|ms|fv|f\/v|tb|bg|km|tug|barge)\.?\s+.{3,60}?)\s+at\s+[\p{L} .'-]{2,30}$/iu, "$1");
    /* l'adresse d'un export en fin de ligne (jeu 12) : une ville connue et un code pays (« GOTEBORG SE »), un code postal
       (« RIGA LV-1045 », « 49400 HAMINA FI »), une ville derrière une barre (« / Constanta Port Gate 7 ») */
    p = p.replace(/\s+([\p{L}-]{3,})\s+([a-z]{2})\s*$/iu, (m, ville: string, code: string) =>
      (PORTS_ET_QUARTIERS.has(normaliser(ville)) && CODES_PAYS.has(code.toLowerCase()) ? "" : m));
    p = p.replace(/\s+[a-z]{2}-\d{4,5}\b.*$/iu, "").replace(/\s+\d{4,5}\s+[\p{L}-]{3,}\s+[a-z]{2}\s*$/iu, "");
    p = p.replace(/\s+\/\s*([\p{L}-]{3,})\b.*$/u, (m, ville: string) => (PORTS_ET_QUARTIERS.has(normaliser(ville)) ? "" : m));
    /* la ville nue derrière une forme juridique (« ANONIM SIRKETI SAMSUN », « SITIRA LTD LIMASSOL CY », jeu 17) : une adresse */
    p = p.replace(/(\b(?:a\.?[sş]\.?|ltd\.?|limited|llc|inc\.?|gmbh|s\.?a\.?|s\.?r\.?l\.?|ltda\.?|sirketi|[sş]ti\.?|e\.?p\.?e\.?|a\.?e\.?|o\.?e\.?|i\.?k\.?e\.?|too|llp)\s+)([\p{L}' -]{3,25}?)(?:\s+[A-Z]{2})?\s*$/iu, (m, forme: string, ville: string) => (PORTS_ET_QUARTIERS.has(normaliser(ville)) ? forme.trimEnd() : m));
    /* le port d'attache écrit SEUL derrière une virgule ou un tiret (« Lekstern, Werkendam », « Dintelreiger - Rotterdam »,
       jeu 14) : un port connu, rien d'autre ; entre parenthèses, seulement derrière UN mot (« IJsselkwak (Kampen) »), parce
       que derrière une raison sociale la ville entre parenthèses est une filiale (« Quarnby Logistics (Shanghai) », jeu 11) */
    p = p.replace(/\s*(?:,|\s[-\u2013]\s)\s*([\p{L}' -]{3,25}?)\s*$/u, (m, ville: string) => (PORTS_ET_QUARTIERS.has(normaliser(ville)) ? "" : m));
    p = p.replace(/^((?:(?:mv|mt|ms|msv|fv|tb|tug|barge|mts|tms|gms|m\.v\.|m\.t\.)\s+)?\S+)\s+\(([\p{L}' -]{3,25})\)\s*$/iu, (m, seul: string, ville: string) => (PORTS_ET_QUARTIERS.has(normaliser(ville)) ? seul : m));
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
    /* L'ENSEIGNE ET SON PROPRIÉTAIRE : « Marisquería El Puerto (Pescados Anzures, S. de R.L.) ». Une parenthèse en
       fin de nom qui porte une forme juridique ET un nom devant elle est la personne morale derrière le nom
       commercial : un second nom, pas une filiale (« (Shanghai) », que le score plafonne) ni une forme entre
       parenthèses (« (Private Joint Stock) », que la préparation ôte). L'enseigne seule et le propriétaire seul
       sont deux variantes de plus, le nom tel qu'écrit reste (jeu 11, 27/09 : 0,800 face au propriétaire seul,
       « marisqueria » et « puerto » deux mots rares sans répondant, la parenthèse lue comme une filiale) */
    const proprietaire = /^(.*?\p{L}.*?)\s*\(([^()]*\p{L}[^()]*)\)$/u.exec(p);
    if (proprietaire && nommeUneSociete(proprietaire[2]!)) {
      poser(proprietaire[1]!.trim(), ancien, mentionDe(proprietaire[1]!));
      poser(proprietaire[2]!.trim(), ancien, mentionDe(proprietaire[2]!));
    }
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
export type LectureDe = { texte: string; lecture: Lecture; ancien: boolean; mention: string; registre: string; partie: string; paysRegistre: string };
export function lecturesDe(brut: string): LectureDe[] {
  const vues = new Map<string, LectureDe>();
  const poser = (l: LectureDe) => { const k = `${l.lecture}|${l.texte}`; if (!vues.has(k)) vues.set(k, l); };
  for (const v of variantesTypees(brut)) {
    const { ancien, mention, registre, partie, paysRegistre } = v;
    poser({ texte: v.texte, lecture: "mandarin", ancien, mention, registre, partie, paysRegistre });
    if (/[\u4e00-\u9fff]/u.test(v.texte) && !estJaponais(v.texte)) {
      poser({ texte: v.texte, lecture: "cantonais", ancien, mention, registre, partie, paysRegistre });
      /* et la troisième, en hokkien de Singapour et de Malaisie (« 金福隆33 » : Kim Hock Leong 33, jeu 13) */
      poser({ texte: v.texte, lecture: "hokkien", ancien, mention, registre, partie, paysRegistre });
      for (const s of substitutions(v.texte)) poser({ ...s, ancien, mention, registre, partie, paysRegistre });
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
  /* deux parties d'un même document (l'applicant et le bénéficiaire d'un crédit) : deux personnes par construction */
  if (a.partie !== "" && b.partie !== "" && a.partie !== b.partie) return FACTEUR_CONTENANCE;
  /* deux pays d'immatriculation entre parenthèses : deux sociétés d'un même groupe (« (Liberia) », « (Marshall Islands) », jeu 17) */
  if (a.paysRegistre !== "" && b.paysRegistre !== "" && a.paysRegistre !== b.paysRegistre) return FACTEUR_CONTENANCE;
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
    const rm = romaniser(suite, "mandarin"), rc = romaniser(suite, "cantonais"), rh = romaniser(suite, "hokkien");
    const propresM = rm.texte.trim().split(/ +/).filter((j) => rm.natifs.has(j));
    const propresC = rc.texte.trim().split(/ +/).filter((j) => rc.natifs.has(j));
    const propresH = rh.texte.trim().split(/ +/).filter((j) => rh.natifs.has(j));
    if (propresM.length === 0 || propresC.length === 0 || propresH.length === 0) continue;
    const mandarin = propresM.join("");
    /* la lecture mandarine, soudée, retrouvée dans une suite de mots latins (« Yongcheng », « Zhang Xing ») : les deux
       lectures syllabiques se substituent (« Cheung Hing », et « Teo Heng » en hokkien, jeu 13) */
    for (let i = 0; i < cles.length; i++) {
      let colle = "";
      for (let k = i; k < cles.length && colle.length < mandarin.length; k++) {
        colle += cles[k]!;
        if (colle === mandarin) {
          sorties.push({ texte: remplacer(i, k, propresC), lecture: "cantonais" });
          sorties.push({ texte: remplacer(i, k, propresH), lecture: "hokkien" });
          break;
        }
      }
    }
    /* une lecture syllabique, cantonaise ou hokkien, retrouvée au pli près (« Wing Fung », « Man Lee » ; « Eng Hong ») :
       les deux autres lectures se substituent, et le nom latin tel quel est une lecture de ce dialecte */
    const syllabique = (propres: readonly string[], lecture: Lecture, autres: readonly (readonly [readonly string[], Lecture])[]) => {
      for (let i = 0; i + propres.length <= cles.length; i++) {
        if (propres.every((s, t) => cles[i + t] !== "" && pliCantonais(cles[i + t]!) === pliCantonais(s))) {
          for (const [par, l] of autres) sorties.push({ texte: remplacer(i, i + propres.length - 1, par), lecture: l });
          sorties.push({ texte: latin, lecture });
        }
      }
    };
    syllabique(propresC, "cantonais", [[[mandarin], "mandarin"], [propresH, "hokkien"]]);
    syllabique(propresH, "hokkien", [[[mandarin], "mandarin"], [propresC, "cantonais"]]);
  }
  return sorties;
}

/** Le score de deux noms BRUTS : le meilleur sur toutes leurs variantes, sous toutes leurs lectures. */
