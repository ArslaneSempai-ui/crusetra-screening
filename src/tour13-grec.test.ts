/**
 * TOUR 13, VOIE GRECQUE : ce que le jeu 17 a appris des noms grecs sur les documents. La seconde convention latine (ELOT 743
 * face à la graphie phonétique et à la latine), le greeklish des clavardages (h pour η, x pour χ, u pour υ, 8 pour θ, 3 pour ξ),
 * les capitales latines jumelles des grecques, les mots du commerce grec et les formes qui se traduisent, les résidus des
 * documents grecs. Chaque règle gardée a ici la paire qui l'a motivée ; les scores sont ceux de la méthode entière, au seuil
 * FORT de 0,81 et au plafond POSSIBLE de 0,80. Le jeu 17 est en apprentissage : rien ici ne vaut verdict.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreNoms, analyserEntite, pliGrec, clesGrecques, memeSuiteGrecque, CREDIT_GREC, lecturesDe } from "./entites.ts";
import { lireGreeklish } from "./greeklish.ts";
import { frequencesDesListes } from "./frequences.ts";

const f = frequencesDesListes();
const score = (a: string, b: string) => scoreNoms(f, a, b);
const FORT = 0.81;
const fort = (paires: readonly (readonly [string, string])[]) => {
  for (const [a, b] of paires) assert.ok(score(a, b) >= FORT, `${a} / ${b} : ${score(a, b).toFixed(3)}`);
};

test("tour 13 : le pli grec lit l'ELOT, la graphie phonétique, la latine et le greeklish comme une même suite de lettres", () => {
  /* χ, τζ et l'esprit rude : le ch est lu h AVANT le h de tête, pour que Hadji- soit Chatzi- */
  assert.equal(pliGrec("chatzimichalis"), pliGrec("hadjimichalis"));
  assert.equal(pliGrec("hellas"), pliGrec("ellas"));
  assert.equal(pliGrec("vlachos"), pliGrec("vlahos"));
  assert.equal(pliGrec("psarros"), pliGrec("psaros"));
  /* ξ écrit x ou ks ; αυ, ευ écrits au, af ; ντ en tête écrit d ; γ devant ι ou ε écrit y ; le oe latin */
  assert.equal(pliGrec("xenofontos"), pliGrec("ksenofontos"));
  assert.equal(pliGrec("naftiki"), pliGrec("nautiki"));
  assert.equal(pliGrec("ntoumas"), pliGrec("doumas"));
  assert.equal(pliGrec("giannoulatos"), pliGrec("yannoulatos"));
  assert.equal(pliGrec("mavrogenis"), pliGrec("mavroyenis"));
  assert.equal(pliGrec("georgios"), pliGrec("yeoryios"));
  assert.equal(pliGrec("kymothoe"), pliGrec("kimothoi"));
  /* le greeklish est une seconde clé, pas une décision sur le nom : x y est χ, h y est η, u seul y est υ */
  assert.ok(memeSuiteGrecque("isxyros", "ischyros"));
  assert.ok(memeSuiteGrecque("psuxountakis", "psychountakis"));
  assert.ok(memeSuiteGrecque("emporikh", "emporiki"));
  assert.ok(memeSuiteGrecque("naulomesitikh", "navlomesitiki"));
  assert.ok(memeSuiteGrecque("kymothoh", "kymothoi"));
  assert.ok(!memeSuiteGrecque("xenofontos", "chenofontos") || clesGrecques("xenofontos").length === 2, "deux clés au plus par mot");
  assert.ok(!memeSuiteGrecque("domokos", "lagoudakis"));
  assert.equal(CREDIT_GREC, 0.95, "la même suite de lettres grecques vaut un squelette égal, comme le cyrillique");
  fort([
    ["Xenofontos Naftiki E.P.E.", "Ksenofontos Nautiki EPE"], ["Chatzimichalis Ship Supplies I.K.E.", "Hadjimichalis Ship Supplies IKE"],
    ["ΒΛΑΧΟΣ & ΨΑΡΡΟΣ Ο.Ε.", "Vlahos & Psaros O.E."], ["ΓΙΑΝΝΟΥΛΑΤΟΣ ΤΡΟΦΟΔΟΣΙΑΙ Ο.Ε.", "Yannoulatos Trofodosiai O.E."],
    ["Mavroyenis Marine Insurance Brokers E.P.E.", "Mavrogenis Marine Insurance Brokers Ltd"],
    ["Ntoumas Stevedoring I.K.E.", "Doumas Stevedoring IKE"], ["Doumas Steve doring", "Ntoumas Stevedoring I.K.E."],
    ["psuxountakis naulomesitikh", "Psychountakis Chartering Ltd"], ["stamatogianis emporikh", "Stamatogiannis Emporiki E.P.E."],
  ]);
});

test("tour 13 : la marque grecque vient d'une forme, d'un mot du commerce sous l'une de ses graphies, du σχ du greeklish", () => {
  assert.ok(analyserEntite("Ntoumas Stevedoring I.K.E.").hebreuOuGrec, "la forme Ι.Κ.Ε.");
  assert.ok(analyserEntite("Ksenofontos Nautiki EPE").hebreuOuGrec, "la forme et le mot plié");
  assert.ok(analyserEntite("stamatogianis emporikh").hebreuOuGrec, "le mot du commerce en greeklish");
  assert.ok(analyserEntite("ISXYROS 5 tug").hebreuOuGrec, "le σχ du greeklish");
  /* et le type de navire écrit nu derrière le numéro est le type, pas un mot du nom ; sans numéro, il nomme */
  assert.equal(analyserEntite("ISXYROS 5 tug").texte, "isxyros 5");
  assert.ok(analyserEntite("ISXYROS 5 tug").navire);
  assert.equal(analyserEntite("Ocean Tug Ltd").texte, "ocean tug");
  fort([["Tug Ischyros 5", "ISXYROS 5 tug"]]);
  assert.ok(analyserEntite("Maroulis Efodiastiki S.A.").hebreuOuGrec, "le mot du commerce grec");
  assert.ok(!analyserEntite("Harlowe Grain Corporation").hebreuOuGrec);
  assert.ok(!analyserEntite("Ke Trading Co Ltd").hebreuOuGrec, "les marqueurs courts ne se plient pas");
  /* l'Ε.Π.Ε. et l'Ι.Κ.Ε. se traduisent Ltd autant que LLC ; l'Ε.Ν.Ε. et l'Ανώνυμη Εταιρεία sont la société par actions */
  assert.deepEqual([...analyserEntite("Mavroyenis Brokers E.P.E.").familles].sort(), ["llc", "ltd"]);
  assert.deepEqual([...analyserEntite("ΘΕΟΦΑΝΩ Ε.Ν.Ε.").familles], ["corp"]);
  assert.equal(analyserEntite("Theofano Special Maritime Enterprise").texte, "theofano");
  assert.equal(analyserEntite("ΛΑΓΟΥΔΑΚΗΣ ΑΝΩΝΥΜΗ ΕΜΠΟΡΙΚΗ ΕΤΑΙΡΕΙΑ").texte, "lagoudakis trading");
  fort([
    ["ΘΕΟΦΑΝΩ Ε.Ν.Ε.", "Theofano Special Maritime Enterprise"], ["ΛΑΓΟΥΔΑΚΗΣ ΑΝΩΝΥΜΗ ΕΜΠΟΡΙΚΗ ΕΤΑΙΡΕΙΑ", "Lagoudakis Emporiki A.E."],
  ]);
});

test("tour 13 : les mots du commerce grec se traduisent, sous leurs autres graphies aussi quand le nom est présumé grec", () => {
  assert.equal(analyserEntite("Ksenofontos Nautiki EPE").texte, "ksenofontos shipping");
  assert.equal(analyserEntite("psuxountakis naulomesitikh").texte, "psuxountakis chartering");
  assert.equal(analyserEntite("Afoi Karagianni O.E.").texte, "brothers karagianni");
  assert.equal(analyserEntite("DOMOKOS ALEVROMYLOI A.E.").texte, "domokos flour mills");
  assert.equal(analyserEntite("ΧΑΤΖΗΚΩΣΤΑΣ ΣΙΤΗΡΑ ΛΤΔ").texte, "chatzikostas grain");
  /* le mot du commerce grec est lui-même le marqueur, sous n'importe laquelle de ses graphies ; un mot qui n'en est pas un ne se
     traduit pas par le seul pli (« Nafta » n'est pas naftiki) */
  assert.equal(analyserEntite("Nautiki Holdings").texte, "shipping holdings");
  assert.equal(analyserEntite("Nafta Holdings").texte, "nafta holdings");
  fort([
    ["ΧΑΤΖΗΚΩΣΤΑΣ ΣΙΤΗΡΑ ΛΤΔ", "Hadjikostas Grains Ltd"], ["DOMOKOS ALEVROMYLOI A.E.", "DOMOKOS FLOUR MILLS SA"],
    ["ΨΥΧΟΥΝΤΑΚΗΣ ΝΑΥΛΟΜΕΣΙΤΙΚΗ Ε.Π.Ε.", "Psychountakis Chartering Ltd"], ["Afoi Karagianni O.E.", "Karagianni Brothers O.E."],
    ["afoi karagianni", "Karagianni Bros O.E."],
  ]);
});

test("tour 13 : les capitales latines jumelles des grecques dans un mot grec", () => {
  assert.equal(analyserEntite("MAPOYΛHΣ EΦOΔIAΣTIKH A.E.").texte, "maroulis supplies");
  assert.equal(analyserEntite("ΜARSHALL ΜARINE").texte, "marshall marine", "un mot qui porte d'autres lettres latines n'est pas touché");
  fort([["MAPOYΛHΣ EΦOΔIAΣTIKH A.E.", "Maroulis Efodiastiki S.A."]]);
});

test("tour 13 : les chiffres du greeklish (8 θ, 3 ξ, 4 ψ), lus avant l'arabizi et la lecture optique", () => {
  assert.equal(lireGreeklish("kymo8oh avra", false, false).texte, "kymothoh avra");
  assert.equal(lireGreeklish("3enofontos naftiki epe", true, false).texte, "xenofontos naftiki epe");
  assert.equal(lireGreeklish("3enofontos naftiki epe", false, false).texte, "3enofontos naftiki epe", "le 3 attend la présomption");
  assert.equal(lireGreeklish("Curtume Font4nelli", false, false).texte, "Curtume Font4nelli", "le 4 aussi : l'optique le lit a");
  assert.equal(lireGreeklish("sa3d al 8asimi", false, true).texte, "sa3d al 8asimi", "sous un marqueur arabe, c'est l'arabizi");
  assert.equal(lireGreeklish("8AHARI TRADING", false, false).texte, "8AHARI TRADING", "en capitales, c'est le B d'un document scanné");
  assert.equal(lireGreeklish("8abatunde 8ros. Ltd", false, false).texte, "8abatunde 8ros. Ltd", "une capitale dans le nom : le 8 est un B mal lu");
  assert.equal(lireGreeklish("Kymo8oh Avra", true, false).texte, "Kymothoh Avra", "sauf sous la présomption grecque");
  assert.equal(lireGreeklish("Mutiara 18", true, false).texte, "Mutiara 18", "un numéro reste un numéro");
  assert.ok(analyserEntite("8alassopori shipmanagement").hebreuOuGrec, "un chiffre lu marque le nom");
  fort([
    ["kymo8oh avra", "ΚΥΜΟΘΟΗ ΑΥΡΑ"], ["8alassopori shipmanagement", "Thalassopori Shipmanagement S.A."],
    ["3enofontos naftiki epe", "ΞΕΝΟΦΩΝΤΟΣ ΝΑΥΤΙΚΗ Ε.Π.Ε."],
    /* ce que l'arabizi et l'optique lisaient avant reste lu */
    ["Curtume Fontanelli", "Curtume Font4nelli"], ["Mo7ammed Sa3eed Trading", "Mohammed Saeed Trading"], ["8AHARI TRADING", "BAHARI TRADING"],
    ["Babatunde Bros. Ltd", "8abatunde 8ros. Ltd"], ["MV Bramblewick", "MV 8ramblewick"], ["Wuxi Tongli Bearing Co., Ltd.", "Wuxi Tongli 8earing Co., Ltd."],
  ]);
});

test("tour 13 : les résidus des documents grecs (δ.τ., Τιμολόγιο προς, ΑΦΜ, ΔΟΥ)", () => {
  const textes = (b: string) => lecturesDe(b).map((l) => l.texte);
  assert.ok(textes("ΚΑΣΤΡΙΝΑΚΗΣ ΝΑΥΤΙΛΙΑΚΗ Ε.Π.Ε. δ.τ. «ΠΟΝΤΟΠΟΡΟΣ»").includes("ΚΑΣΤΡΙΝΑΚΗΣ ΝΑΥΤΙΛΙΑΚΗ Ε.Π.Ε."));
  assert.ok(textes("Τιμολόγιο προς: ΜΑΡΟΥΛΗΣ ΕΦΟΔΙΑΣΤΙΚΗ Α.Ε.").includes("ΜΑΡΟΥΛΗΣ ΕΦΟΔΙΑΣΤΙΚΗ Α.Ε."));
  assert.ok(textes("ΑΦΜ 998124567 ΛΙΜΕΝΑΡΧΙΔΗΣ ΝΑΥΤΙΛΙΑΚΗ Α.Ε. ΔΟΥ ΦΑΕ ΠΕΙΡΑΙΑ").includes("ΛΙΜΕΝΑΡΧΙΔΗΣ ΝΑΥΤΙΛΙΑΚΗ Α.Ε."));
  fort([
    ["ΚΑΣΤΡΙΝΑΚΗΣ ΝΑΥΤΙΛΙΑΚΗ Ε.Π.Ε. δ.τ. «ΠΟΝΤΟΠΟΡΟΣ»", "Kastrinakis Naftiliaki E.P.E."],
    ["Τιμολόγιο προς: ΜΑΡΟΥΛΗΣ ΕΦΟΔΙΑΣΤΙΚΗ Α.Ε.", "Maroulis Efodiastiki S.A."],
    ["ΑΦΜ 998124567 ΛΙΜΕΝΑΡΧΙΔΗΣ ΝΑΥΤΙΛΙΑΚΗ Α.Ε. ΔΟΥ ΦΑΕ ΠΕΙΡΑΙΑ", "Limenarchidis Naftiliaki S.A."],
  ]);
});
