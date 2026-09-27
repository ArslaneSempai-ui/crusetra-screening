/**
 * TOUR 9, VOIE ABRÉVIATIONS : un nom déposé long, raccourci sur un document d'expédition. Le sigle d'une locution
 * (« C&F », « T/C », « C.I. »), le style d'un nom qui tronque plusieurs mots autour d'une esperluette (« Consol & Log »,
 * « Chart & Brok »), le raccourci d'un clavardage (« diamnd exp », « pls confirm order »), le générique français de
 * l'armement (« Compagnie Maritime »), la forme vietnamienne sous sa marque (« May »), la coque en construction
 * (« N/B », « NEWBUILDING HULL NO. »). Chaque règle gardée a ici la paire qui l'a motivée ; les scores sont ceux de la
 * méthode entière, au seuil FORT de 0,81.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreNoms, analyserEntite, preparerNom, lecturesDe, variantes, sigleDe } from "./entites.ts";
import { frequencesDesListes } from "./frequences.ts";
import { estVietnamien } from "./vietnamien.ts";

const f = frequencesDesListes();
const score = (a: string, b: string) => scoreNoms(f, a, b);
const mots = (n: string) => { const l = lecturesDe(n)[0]!; return preparerNom(f, l.texte, l.lecture).mots; };
const FORT = 0.81;
const fort = (a: string, b: string) => assert.ok(score(a, b) >= FORT, `${a} / ${b} : ${score(a, b).toFixed(3)}, attendu au fort`);
const sous = (a: string, b: string) => assert.ok(score(a, b) < FORT, `${a} / ${b} : ${score(a, b).toFixed(3)}, attendu sous le fort`);

test("tour 9, abréviations : un sigle écrit (C&F, T/C, C.I.) vaut les mots consécutifs dont il porte les initiales", () => {
  assert.ok(analyserEntite("Lagos C&F Agency Ltd").sigles.has("cf"), "l'esperluette soude le sigle et le retient");
  assert.ok(analyserEntite("Gulf of Guinea T/C Svcs Ltd").sigles.has("tc"), "la barre aussi");
  assert.ok(analyserEntite("C.I. Cafe del Tolima SAS").sigles.has("ci"), "le point aussi");
  assert.ok(!analyserEntite("Lagos CF Agency Ltd").sigles.has("cf"), "sans ponctuation, « CF » n'est pas un sigle écrit");
  assert.deepEqual(mots("Lagos C&F Agency Ltd"), ["lagos", "cf", "agency"]);
  assert.equal(sigleDe("cf", ["lagos", "clearing", "forwarding", "agency"], ["lagos", "cf", "agency"]), 1);
  assert.equal(sigleDe("ci", ["comercializadora", "internacional", "cafe", "del", "tolima"], ["ci", "cafe", "del", "tolima"]), 0);
  assert.equal(sigleDe("tc", ["time", "charter", "services"], ["tc", "services"]), 0);
  assert.equal(sigleDe("cf", ["lagos", "clearing", "forwarding"], ["lagos", "clearing", "cf"]), -1, "un mot écrit de ce côté n'est pas abrégé");
  assert.equal(sigleDe("cf", ["lagos", "co", "forwarding"], ["lagos", "cf"]), -1, "deux lettres ne font pas un mot de la locution");
  /* mesurés à 0,496, 0,584 et 0,574 avant la règle (jeux 10 et 5) */
  fort("Lagos Clearing and Forwarding Agency Limited", "Lagos C&F Agency Ltd");
  fort("Gulf of Guinea Time Charter Services Limited", "Gulf of Guinea T/C Svcs Ltd");
  fort("Comercializadora Internacional Café del Tolima S.A.S.", "C.I. Cafe del Tolima SAS");
  /* le sigle sans ponctuation n'ouvre rien, et deux sigles d'initiales restent deux personnes */
  sous("Lagos Clearing and Forwarding Agency Limited", "Lagos CF Agency Ltd");
  sous("N.K. Bansal & Co.", "S.K. Bansal & Co.");
  sous("C.I. Flores de Rionegro S.A.S.", "C.I. Flores de Rionegro Dos S.A.S.");
});

test("tour 9, abréviations : un nom qui tronque un mot en tronque d'autres, même des mots du dictionnaire (Consol & Log, Chart & Brok)", () => {
  /* mesurés à 0,531 et 0,612 avant la règle (jeu 10) : « Consol » et « Chart » sont des mots anglais, la réserve du
     dictionnaire les tenait ; « Log » (dernier mot coupé) et « Brok » (quatre lettres inconnues) donnent le signal */
  fort("Tema Consolidators and Logistics Limited", "Tema Consol & Log Ltd");
  fort("West Coast Chartering and Brokerage Limited", "West Coast Chart & Brok Ltd");
  /* sans le signal, un mot du dictionnaire qui en commence un autre reste un autre mot */
  sous("Chart Brokerage Ltd", "Chartering Brokerage Ltd");
  sous("Golden Star Logistics", "Golden Starlight Logistics");
});

test("tour 9, abréviations : le raccourci d'un clavardage, « diamnd exp » et la demande derrière le nom", () => {
  assert.ok(variantes("sanghvi diamnd exp mumbai pls confirm order").includes("sanghvi diamnd exp mumbai"), "« pls confirm order » est une demande, pas le nom");
  assert.ok(variantes("Sanghvi Diamond Exports pls check thx").includes("Sanghvi Diamond Exports"));
  assert.ok(!variantes("Order Fulfilment Services Ltd").includes(""), "« Order » seul, sans mot de politesse, reste dans le nom");
  assert.deepEqual(variantes("Order Fulfilment Services Ltd"), ["Order Fulfilment Services Ltd"]);
  /* mesuré à 0,562 avant la règle (jeu 13) : « exp » de trois lettres n'était lu qu'en dernier mot */
  fort("sanghvi diamnd exp mumbai pls confirm order", "Sanghvi Diamond Exports, Mumbai");
  /* les pièges du même jeu : une autre maison, un import face à un export ; et un mot de trois lettres n'abrège qu'un mot
     anglais, jamais un patronyme (« Eze », « Ezenwa ») ni une syllabe chinoise (« Xin », « Xinhai ») */
  sous("sanghvi diamnd exp mumbai pls confirm order", "sanghvi diamond trdrs mumbai pls confirm order");
  sous("sanghvi diamnd exp mumbai", "sanghvi diamnd imp mumbai");
  sous("Delivery for Amaka Eze", "Delivery for Amaka Ezenwa");
  sous("Da Xin Trading", "Da Xinhai Trading");
});

test("tour 9, abréviations : « Compagnie Maritime X » est « X Shipping Company » ; « maritime » seul ne se traduit pas", () => {
  assert.ok(mots("Compagnie Maritime Beaurivage").includes("shipping"));
  assert.ok(mots("Beaurivage Maritime").includes("maritime"), "en anglais, X Maritime et X Shipping sont deux sociétés d'un groupe");
  /* mesuré à 0,585 avant la règle (jeu 7) */
  fort("Compagnie Maritime Beaurivage", "Beaurivage Shipping Company");
  sous("Beaurivage Maritime", "Beaurivage Shipping");
});

test("tour 9, abréviations : sous la marque vietnamienne, « May » est la confection ; sans elle, c'est un mot anglais", () => {
  assert.equal(estVietnamien("Công Ty May Gia Huy TP. Hồ Chí Minh", " cong ty may gia huy hochiminh "), true, "les tons empilés sur un circonflexe");
  assert.equal(estVietnamien("Cong ty TNHH Det May Nam Phuong", " cong ty tnhh det may nam phuong "), true, "la forme, sans les signes");
  assert.equal(estVietnamien("May Trading Ltd", " may trading ltd "), false);
  assert.equal(estVietnamien("Côte d'Ivoire Négoce", " cote ivoire negoce "), false, "le seul circonflexe est du français");
  assert.ok(mots("Công Ty May Gia Huy TP. Hồ Chí Minh").includes("garment"));
  assert.ok(mots("May Trading Ltd").includes("may"));
  /* mesuré à 0,672 avant la règle (jeu 7) */
  fort("HO CHI MINH CITY GIA HUY GARMENT", "Công Ty May Gia Huy TP. Hồ Chí Minh");
  sous("May Trading Ltd", "Garment Trading Ltd");
});

test("tour 9, abréviations : la coque en construction, « N/B » avec sa barre et « NEWBUILDING HULL NO. », est un navire et son numéro", () => {
  const nb = analyserEntite("N/B S1187"), hull = analyserEntite("NEWBUILDING HULL NO. S-1187");
  assert.equal(nb.navire, true); assert.equal(nb.texte, "s 1187");
  assert.equal(hull.navire, true); assert.equal(hull.texte, "s 1187");
  assert.equal(analyserEntite("NB Steel Ltd").navire, false, "sans sa barre, NB est une initiale");
  /* mesuré à 0,278 avant la règle (jeu 4) */
  fort("NEWBUILDING HULL NO. S-1187", "N/B S1187");
  sous("NEWBUILDING HULL NO. S-1187", "N/B S1188");
});
