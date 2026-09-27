/**
 * TOUR 13, VOIE LOCALE : ce que le jeu 17 a appris hors du grec et de l'Asie centrale (les voies). Chaque règle gardée a ici
 * la paire qui l'a motivée ; les scores sont ceux de la méthode entière, au seuil FORT de 0,81 et au plafond POSSIBLE de
 * 0,80. Le jeu 17 est en apprentissage : rien ici ne vaut verdict.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreNoms, variantes, analyserEntite, paysDeRegistre } from "./entites.ts";
import { frequencesDesListes } from "./frequences.ts";

const f = frequencesDesListes();
const score = (a: string, b: string) => scoreNoms(f, a, b);
const FORT = 0.81;
const POSSIBLE = 0.80;

test("tour 13 : deux pays d'immatriculation entre parenthèses sont deux sociétés d'un même armateur", () => {
  assert.equal(paysDeRegistre("Evdokimos Navigation Corp. (Liberia)"), "LR");
  assert.equal(paysDeRegistre("Quarnby Logistics (Shanghai)"), "", "une ville n'est pas un pays d'immatriculation");
  assert.ok(score("Evdokimos Navigation Corp. (Liberia)", "Evdokimos Navigation Corp. (Marshall Islands)") <= POSSIBLE, "mesuré à 1,000 avant");
  assert.ok(score("Evdokimos Navigation Corp. (Liberia)", "Evdokimos Navigation Corp.") >= FORT, "un pays d'un seul côté ne dit rien");
});

test("tour 13 : un nom sans forme qui finit par un numéro est une coque de flotte numérotée", () => {
  assert.equal(analyserEntite("Myrtoan Grain 4").navire, true);
  assert.equal(analyserEntite("Studio 54 Productions").navire, false, "le numéro au milieu ne fait pas un navire");
  assert.equal(analyserEntite("Terminal 2 Cargo Services").navire, false);
  assert.ok(score("Myrtoan Grain 4", "Myrtoan Grains 4") <= POSSIBLE, "mesuré à 0,952 avant");
  assert.ok(score("Pontic Bulker No. 3", "Pontic Bulkers 3") <= POSSIBLE, "mesuré à 0,902 avant");
  assert.ok(score("Studio 54 Productions", "Studio 54 Production") >= FORT);
});

test("tour 13 : pavillons, immatriculation maltaise, durée d'un ancien nom, type derrière une virgule, ville nue derrière la forme", () => {
  assert.ok(variantes("Anatoli Breeze / Liberia").includes("Anatoli Breeze"));
  assert.ok(variantes("REMZI KAPTAN II (TR)").includes("REMZI KAPTAN II"));
  assert.ok(variantes("Thyella Bay Shipping Ltd (Malta) C 84512").includes("Thyella Bay Shipping Ltd"));
  assert.ok(variantes("Theodosia K (ex-Lindos Harrier until 2019)").includes("Lindos Harrier"));
  assert.ok(variantes("IRINI-3, dumb barge").includes("IRINI-3"));
  for (const [a, b] of [
    ["Remzi Kaptan 2", "REMZI KAPTAN II (TR)"], ["Theodosia K (ex-Lindos Harrier until 2019)", "Lindos Harrier"], ["Anatoli Breeze / Liberia", "Anatoli Breeze (LR)"],
    ["Thyella Bay Shipping Ltd (Malta) C 84512", "Thyella Bay Shipping Limited"], ["Ordu Kızı", "ORDU KIZI (Türk bayraklı)"], ["Barge Irini 3", "IRINI-3, dumb barge"],
    ["ALACAM UN VE YEM SANAYI TICARET ANONIM SIRKETI SAMSUN", "Alaçam Un ve Yem San. Tic. A.Ş."], ["CHATZIKOSTAS SITIRA LTD LIMASSOL CY", "CHATZIKOSTAS SITIRA LTD"],
  ] as const) assert.ok(score(a, b) >= FORT, `${a} / ${b} : ${score(a, b).toFixed(3)}`);
});

test("tour 13 : les abréviations maritimes anglaises, l'optique lnc, la rue russe collée, la lettre coupée à 35", () => {
  for (const [a, b] of [
    ["Kyveli Blk Shpg Inc", "KYVELI BULK SHIPPING INCORPORATED"], ["Mesogeios Shp Svcs", "Mesogeios Ship Services E.P.E."], ["Arktouro5 Carriers lnc", "Arktouros Carriers Inc."],
    ["AO PAVLODAR DAN ONIMDERIUL.TORAIGYROVA 64 PAVLODAR KAZAKHSTAN", "AO PAVLODAR DAN ONIMDERI"], ["YAVUZELI DEGIRMENCILIK SANAYI VE T", "Yavuzeli Değirmencilik San. ve Tic. A.Ş."],
  ] as const) assert.ok(score(a, b) >= FORT, `${a} / ${b} : ${score(a, b).toFixed(3)}`);
});
