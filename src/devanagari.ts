/**
 * LA DEVANAGARI (tour 9, voie écritures) : le hindi, le marathi, le népalais, écrits dans l'abugida du nord de l'Inde,
 * ramenés aux lettres latines de leurs registres (« गुप्ता अनिल कुमार » : Gupta Anil Kumar). Pures tables et fonctions
 * sans état : ecritures.ts les importe, elles n'importent rien.
 *
 * Une consonne porte un « a » qu'on n'écrit pas (l'inhérent), qu'un signe de voyelle remplace (कु ku, का ka) et qu'un
 * virama éteint (प्त pt). Le hindi ne PRONONCE pas cet « a » en fin de mot (कुमार kumar, pas kumara ; सिंह singh ; कौर
 * kaur), ni au milieu quand une voyelle le précède et qu'une voyelle suit la consonne d'après (हरप्रीत harpreet, pas
 * harapreet ; कमलनाथ kamalnath : la règle VC_CV, lue de droite à gauche pour que deux schwas voisins alternent). Après
 * un groupe final (चन्द्र chandra, मिश्रा mishra) il reste. L'anusvara (ं) est la nasale du lieu de la consonne qui
 * suit : ng devant une vélaire ou h (सिंह singh), m devant une labiale, n ailleurs. Les longues s'écrivent comme l'usage
 * indien les écrit (ी ee, ू oo : Harpreet, Sunita ou Suneeta se replient dans `squeletteLongue`, sous la marque indienne).
 */

/** Les consonnes, avec la lettre ou le digramme que les registres écrivent ; les nukta (क़ ख़ ग़ ज़ ड़ ढ़ फ़) sous leurs codes
 *  précomposés (U+0958 à U+095F) et sous leur forme décomposée (consonne + ़), que la normalisation NFD produit. */
const CONSONNES: ReadonlyMap<string, string> = new Map(Object.entries({
  "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "ng", "च": "ch", "छ": "chh", "ज": "j", "झ": "jh", "ञ": "n",
  "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n", "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n",
  "प": "p", "फ": "ph", "ब": "b", "भ": "bh", "म": "m", "य": "y", "र": "r", "ल": "l", "ळ": "l", "व": "v",
  "श": "sh", "ष": "sh", "स": "s", "ह": "h",
  "क़": "q", "ख़": "kh", "ग़": "gh", "ज़": "z", "ड़": "r", "ढ़": "rh", "फ़": "f", "य़": "y", "ऩ": "n", "ऱ": "r", "ऴ": "l",
}));
/** La nukta sous sa forme décomposée : la consonne nue et son point font la consonne pointée. */
const NUKTA: ReadonlyMap<string, string> = new Map(Object.entries({
  "क": "q", "ख": "kh", "ग": "gh", "ज": "z", "ड": "r", "ढ": "rh", "फ": "f", "य": "y", "न": "n", "र": "r", "ळ": "l",
}));
/** Les voyelles indépendantes, en tête de mot ou après une autre voyelle (अनिल anil, ईश eesh). */
const VOYELLES: ReadonlyMap<string, string> = new Map(Object.entries({
  "अ": "a", "आ": "a", "इ": "i", "ई": "ee", "उ": "u", "ऊ": "oo", "ऋ": "ri", "ए": "e", "ऐ": "ai", "ओ": "o", "औ": "au",
  "ऑ": "o", "ऍ": "e", "ऎ": "e", "ऒ": "o", "ॠ": "ri", "ऌ": "li",
}));
/** Les signes de voyelle portés par une consonne (मात्रा). */
const SIGNES: ReadonlyMap<string, string> = new Map(Object.entries({
  "ा": "a", "ि": "i", "ी": "ee", "ु": "u", "ू": "oo", "ृ": "ri", "े": "e", "ै": "ai", "ो": "o", "ौ": "au",
  "ॉ": "o", "ॅ": "e", "ॆ": "e", "ॊ": "o", "ॄ": "ri", "ॢ": "li",
}));
const VIRAMA = "्", ANUSVARA = "ं", CHANDRABINDU = "ँ", VISARGA = "ः", SIGNE_NUKTA = "़", AVAGRAHA = "ऽ";
const VELAIRES = new Set(["k", "kh", "g", "gh", "ng", "h"]), LABIALES = new Set(["p", "ph", "b", "bh", "m", "f"]);

/** Le bloc de la devanagari (U+0900 à U+097F), dandas et chiffres compris. */
export const DEVANAGARI = /[ऀ-ॿ]/u;

/** Une unité d'écriture : une consonne et la voyelle qu'elle porte (« a » l'inhérent, « » sous un virama), ou une
 *  voyelle seule (consonne vide), avec la nasale qui la coiffe. */
type Unite = { c: string; v: string; inherente: boolean; nasale: boolean; visarga: boolean };

function unites(mot: string): Unite[] {
  const l = [...mot.normalize("NFD")];
  const sortie: Unite[] = [];
  for (let i = 0; i < l.length; i++) {
    const ch = l[i]!;
    let k = CONSONNES.get(ch);
    if (k !== undefined && l[i + 1] === SIGNE_NUKTA) { k = NUKTA.get(ch) ?? k; i++; }
    if (k !== undefined) {
      const suite = l[i + 1] ?? "";
      let v = "a", inherente = true;
      if (suite === VIRAMA) { v = ""; inherente = false; i++; }
      else if (SIGNES.has(suite)) { v = SIGNES.get(suite)!; inherente = false; i++; }
      sortie.push({ c: k, v, inherente, nasale: false, visarga: false });
      continue;
    }
    const voy = VOYELLES.get(ch);
    if (voy !== undefined) { sortie.push({ c: "", v: voy, inherente: false, nasale: false, visarga: false }); continue; }
    if (ch === ANUSVARA || ch === CHANDRABINDU) { if (sortie.length > 0) sortie[sortie.length - 1]!.nasale = true; continue; }
    if (ch === VISARGA) { if (sortie.length > 0) sortie[sortie.length - 1]!.visarga = true; continue; }
    if (ch === AVAGRAHA || ch === SIGNE_NUKTA) continue;
    /* tout autre caractère traverse inchangé, comme dans la couche commune */
    sortie.push({ c: ch, v: "", inherente: false, nasale: false, visarga: false });
  }
  return sortie;
}

/** Un mot en devanagari, en lettres latines, le schwa tombé là où le hindi ne le dit pas. */
export function devanagariEnLatin(mot: string): string {
  const u = unites(mot);
  /* la voyelle de l'unité i, telle qu'elle sera écrite (« » sous un virama ou un schwa tombé) */
  const aUneVoyelle = (i: number) => i >= 0 && i < u.length && u[i]!.v !== "";
  /* le schwa final tombe après UNE consonne (कुमार kumar), pas après un groupe (चन्द्र chandra) */
  const dernier = u.length - 1;
  if (dernier >= 1 && u[dernier]!.inherente && u[dernier]!.c !== "" && u[dernier - 1]!.v !== "") u[dernier]!.v = "";
  /* les schwas du milieu, de droite à gauche : VC_CV, la consonne d'après (ou le groupe qu'elle ouvre) portant une voyelle */
  for (let i = dernier - 1; i >= 1; i--) {
    if (!u[i]!.inherente || u[i]!.c === "" || u[i]!.nasale) continue;
    if (!aUneVoyelle(i - 1)) continue;
    /* un virama écrit ouvre un groupe qu'on traverse (प्र) ; un schwa que la règle vient de faire tomber, non : les deux
       voisins alternent (कमलनाथ kamalnath, pas kamlnath) */
    let k = i + 1;
    while (k < u.length && u[k]!.c !== "" && u[k]!.v === "" && !u[k]!.inherente) k++;
    if (k < u.length && u[k]!.c !== "" && u[k]!.v !== "") u[i]!.v = "";
  }
  let s = "";
  for (let i = 0; i < u.length; i++) {
    const x = u[i]!;
    s += x.c + x.v;
    if (x.nasale) {
      const suivant = u[i + 1]?.c ?? "";
      s += VELAIRES.has(suivant) ? "ng" : LABIALES.has(suivant) ? "m" : "n";
    }
    if (x.visarga) s += "h";
  }
  return s;
}

/** Les mots du commerce écrits en devanagari, en hindi (व्यापार, उद्योग) et en anglais écrit en devanagari (प्राइवेट
 *  लिमिटेड, ट्रेडिंग), et les civilités : les mêmes lemmes que les tables de la préparation. Les mots d'un nom hindi
 *  sont séparés d'espaces, les clés se lisent mot entier. */
export const GENERIQUES_DEVANAGARI: ReadonlyMap<string, string> = new Map(Object.entries({
  /* les formes */ "प्राइवेट लिमिटेड": "private limited", "प्रा. लि.": "pvt ltd", "प्रा.लि.": "pvt ltd", "प्रा लि": "pvt ltd",
  "लिमिटेड": "limited", "लि.": "ltd", "प्राइवेट": "pvt", "पब्लिक": "public", "कंपनी": "company", "कम्पनी": "company",
  "कॉर्पोरेशन": "corporation", "एंड": "", "ऐंड": "", "एण्ड": "", "और": "", "एवं": "",
  /* le commerce, en hindi */ "व्यापार": "trading", "व्यापारी": "traders", "उद्योग": "industries", "निर्यात": "export",
  "आयात": "import", "निर्माण": "construction", "परिवहन": "transport", "सेवाएं": "services", "समूह": "group", "भारत": "india",
  "भारतीय": "indian", "हिन्दुस्तान": "hindustan", "हिंदुस्तान": "hindustan", "मिल": "mill", "मिल्स": "mills", "पुत्र": "sons",
  "बंधु": "brothers", "ब्रदर्स": "brothers", "सन्स": "sons", "संस": "sons",
  /* l'anglais écrit en devanagari */ "ट्रेडिंग": "trading", "ट्रेडर्स": "traders", "इंडस्ट्रीज": "industries", "इंडस्ट्रीज़": "industries",
  "इंडस्ट्री": "industry", "एंटरप्राइजेज": "enterprises", "एंटरप्राइजेस": "enterprises", "एक्सपोर्ट्स": "exports", "एक्सपोर्ट": "export",
  "इम्पोर्ट": "import", "इंटरनेशनल": "international", "इंडिया": "india", "ग्रुप": "group", "होल्डिंग्स": "holdings",
  "लॉजिस्टिक्स": "logistics", "शिपिंग": "shipping", "मरीन": "marine", "मैरीटाइम": "maritime", "सर्विसेज": "services", "सर्विसेस": "services",
  "टेक्सटाइल्स": "textiles", "टेक्सटाइल": "textile", "स्टील": "steel", "स्टील्स": "steels", "मेटल्स": "metals", "केमिकल्स": "chemicals",
  "फार्मा": "pharma", "फार्मास्युटिकल्स": "pharmaceuticals", "इंजीनियरिंग": "engineering", "कंस्ट्रक्शन": "construction",
  "इन्फ्रास्ट्रक्चर": "infrastructure", "मोटर्स": "motors", "ऑटो": "auto", "ट्रांसपोर्ट": "transport", "एजेंसीज": "agencies",
  "एजेंसी": "agency", "ओवरसीज": "overseas", "ग्लोबल": "global", "प्रोडक्ट्स": "products", "टेक्नोलॉजीज": "technologies",
  "सिस्टम्स": "systems", "पावर": "power", "एनर्जी": "energy", "इलेक्ट्रॉनिक्स": "electronics", "इलेक्ट्रिकल्स": "electricals",
  "प्लास्टिक्स": "plastics", "फूड्स": "foods", "फूड": "food", "पेपर": "paper", "मर्चेंट्स": "merchants", "एक्सपोर्टर्स": "exporters",
  /* les civilités, que la préparation retire (CIVILITES) */ "श्री": "shri", "श्रीमती": "smt", "मेसर्स": "messrs",
}).map(([k, v]) => [k.normalize("NFD"), v] as const));
