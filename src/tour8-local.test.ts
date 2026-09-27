/**
 * TOUR 8, VOIE LOCALE : ce que le jeu 12 a appris. Chaque règle gardée a ici la paire qui l'a motivée ; les
 * scores sont ceux de la méthode entière (préparation, variantes, score), au seuil FORT de 0,81 et au plafond
 * POSSIBLE de 0,80. Le jeu 12 est en apprentissage : rien ici ne vaut verdict.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreNoms, partieDuDocument, lecturesDe, plurielTurc } from "./entites.ts";
import { frequencesDesListes } from "./frequences.ts";

const f = frequencesDesListes();
const score = (a: string, b: string) => scoreNoms(f, a, b);
const FORT = 0.81;
const POSSIBLE = 0.80;

test("tour 8 : les formes nordiques et baltes, en ligne ou en toutes lettres, devant ou derrière", () => {
  for (const [a, b] of [
    ["Oy Jääkarhu Logistics Ab", "Jaakarhu Logistics Oy"],
    ["Oy Suomen Viljaterminaali Ab", "Suomen Viljaterminaali Oy"],
    ["Kristiansen Fragt ApS", "Kristiansen Fragt Anpartsselskab"],
    ["AS Tallinna Laevaagentuur", "Tallinna Laevaagentuur AS"],
    ["Nordström & Lindqvist AB (publ)", "Nordstrom och Lindqvist AB"],
    ["Mäkelä & Hyvönen Kuljetus Oy", "Makela ja Hyvonen Kuljetus Oy"],
  ] as const) assert.ok(score(a, b) >= FORT, `${a} / ${b} : ${score(a, b).toFixed(3)}`);
});

test("tour 8 : le turc du commerce, traduit ou abrégé (Dış Ticaret, Çelik, Şti.)", () => {
  for (const [a, b] of [
    ["Tirebolu Çelik Ticaret Ltd. Şti.", "Tirebolu Steel Trading Ltd."],
    ["Beyazkaya Lojistik ve Dış Ticaret Ltd. Şti.", "Beyazkaya Lojistik ve Dis Tic. Ltd. Sti."],
    ["Erdoğmuş Hurda Metal Dış Ticaret A.Ş.", "Erdogmus Hurda Metal Dis Tic. A.S."],
    ["For and on behalf of AKSOYLAR CELIK DIS TICARET A.S.", "Aksoylar Çelik Dış Ticaret A.Ş."],
    ["0ZKAYA NAKL1YAT LTD. ST1.", "Özkaya Nakliyat Ltd. Şti."],
  ] as const) assert.ok(score(a, b) >= FORT, `${a} / ${b} : ${score(a, b).toFixed(3)}`);
});

test("tour 8 : les cadres d'un message (champ SWIFT, clavardage, à l'attention de, pour le compte de)", () => {
  for (const [a, b] of [
    ["59:/ACC 0042771 KIRMIZIGUL GIDA LTD STI", "Kırmızıgül Gıda Ltd. Şti."],
    ["REF FT2231-0915 /BNF/ KAYALAR UN SANAYI AS", "Kayalar Un Sanayi A.Ş."],
    ["1/POLTAVSKA ZERNOVA KOMPANIIA TOV 2/VUL. SHKILNA 7 3/UA/POLTAVA", "TOV Poltavska Zernova Kompaniia"],
    ["can u check odessa grainlink tov asap", "TOV Odesa Grainlink"],
    ["hi pls check laaksonen viljakuljetus oy thx", "Laaksonen Viljakuljetus Oy"],
    ["ATTN MR. KORHONEN / MERIVIRTA OY", "Merivirta Oy"],
    ["TOKATLIGIL DENIZCILIK A.S. (THE SELLER)", "Tokatlıgil Denizcilik A.Ş."],
  ] as const) assert.ok(score(a, b) >= FORT, `${a} / ${b} : ${score(a, b).toFixed(3)}`);
});

test("tour 8 : l'adresse d'export collée au nom (ville, code postal, code pays, port)", () => {
  for (const [a, b] of [
    ["POHJOISRANNIKON VILJAKAUPPA OY HAMIN ANTIE 12 49400 HAMINA FI", "Pohjoisrannikon Viljakauppa Oy"],
    ["SJÖGRIND LOGISTIK AB (PUBL) GOTEBORG SE", "Sjögrind Logistik AB"],
    ["Dunarea Verde Grain Logistics S.R.L. / Constanta Port Gate 7", "Dunarea Verde Grain Logistics SRL"],
    ["NOTIFY PARTY - Marinero Ship Agency SRL Constanta Romania", "Marinero Ship Agency SRL"],
  ] as const) assert.ok(score(a, b) >= FORT, `${a} / ${b} : ${score(a, b).toFixed(3)}`);
});

test("tour 8 : le navire d'un connaissement, et le pluriel turc qui en fait une autre coque", () => {
  assert.ok(score("B/L: SHIPPED ON BOARD M/V SARI KAYA", "SARI KAYA") >= FORT);
  assert.ok(score("M/V ÖZLEM ANA - OWNERS ACCOUNT", "OZLEM ANA") >= FORT);
  assert.ok(score("B/L: SHIPPED ON BOARD M/V SARI KAYA", "SARI KAYALAR") <= POSSIBLE, "mesuré à 0,899 avant : le dernier mot lu comme coupé");
  assert.ok(score("MV SARI KAYA", "MV SARI KAYALAR") <= POSSIBLE);
  assert.ok(plurielTurc("kayalar", "kaya") && plurielTurc("denizler", "deniz"));
  assert.ok(!plurielTurc("kaya", "kayalar") && !plurielTurc("lar", "") && !plurielTurc("kayalar", "kayalar"));
});

test("tour 8 : deux parties d'un même document ne sont jamais la même personne", () => {
  assert.equal(partieDuDocument("Femi Alade Import Export Company Limited (Applicant)"), "applicant");
  assert.equal(partieDuDocument("/BENEFICIARY/ KAYALAR UN SANAYI AS"), "beneficiary");
  assert.equal(partieDuDocument("Consignee: Marinero Ship Agency SRL"), "consignee");
  assert.equal(partieDuDocument("Alade Femi Export Import Company Limited"), "");
  assert.ok(lecturesDe("X Trading Ltd (THE SELLER)").every((l) => l.partie === "seller"), "la propriété est portée par toutes les lectures");
  assert.ok(score("Femi Alade Import Export Company Limited (Applicant)", "Alade Femi Export Import Company Limited (Beneficiary)") <= POSSIBLE,
    "mesuré à 0,900 avant : les mots alignés dans n'importe quel ordre");
  assert.ok(score("Femi Alade Import Export Company Limited (Applicant)", "Femi Alade Import Export Company Limited") >= FORT, "une partie d'un seul côté ne dit rien");
});
