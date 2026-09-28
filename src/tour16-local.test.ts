/**
 * TOUR 16, VOIE LOCALE : les résidus des documents de Houston et de Toronto (jeu 20). Le français du Canada traduit
 * ses mots de métier, la Limitée en toutes lettres et la S.E.N.C. du Québec, le limited partnership et le « Ltd., Part. »
 * thaï, les numéros EIN, NEQ, BN et le numéro officiel ON d'un navire canadien, les étiquettes Fedwire, ORIG et REF PO,
 * le compte collé derrière une barre, le nom d'exploitation annoncé par « o/a », l'ATB du golfe du Mexique, les villes
 * des Grands Lacs et du Saint-Laurent derrière la forme, l'entrepôt abrégé et l'« INCOR » d'une ligne coupée.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreNoms, variantes } from "./entites.ts";
import { frequencesDesListes } from "./frequences.ts";

const f = frequencesDesListes();
const score = (a: string, b: string) => scoreNoms(f, a, b);
const FORT = 0.81;
const POSSIBLE = 0.80;

test("tour 16 : les vingt-cinq paires du jeu 20 que les tables étendues font passer au fort", () => {
  for (const [a, b] of [
    ["10552301 CANADA INC BN 733120552RC0001", "10552301 Canada Inc."],
    ["Portes et Fenêtres Bourassa Inc.", "Bourassa Windows and Doors Inc."],
    ["2718281 Ontario Inc. o/a Maple Ridge Landscaping", "2718281 Ontario Inc."],
    ["6120448 MANITOBA LTD O/A PRAIRIE SKY GREENHOUSES", "6120448 Manitoba Ltd."],
    ["Toitures Chiasson Ltée", "Chiasson Roofing Ltd."],
    ["Manufacture de meubles Beaulieu Ltée", "Beaulieu Furniture Manufacturing Ltd."],
    ["GRAND BEND BOAT WORKS LTD*GODERICH", "Grand Bend Boatworks Ltd."],
    ["Sabourin Forest Products Ltd.", "Produits forestiers Sabourin Ltée"],
    ["Distribution alimentaire Gauthier Inc.", "Gauthier Food Distribution Inc."],
    ["Bayou Vista Cold Whse LLC", "Bayou Vista Cold Warehouse LLC"],
    ["ISHIKAWA BEARING DISTRIBUTORS INCOR", "Ishikawa Bearing Distributors Inc."],
    ["METAUX RECYCLES SIROIS INC LAVAL QC", "Métaux recyclés Sirois Inc."],
    ["FERREIRA STEVEDORING CO/ACCT 77120", "Ferreira Stevedoring Company"],
    ["ATB Sabine Ranger", "Sabine Ranger"],
    ["Les Aciers Beauport Inc. / Beauport Steel Inc.", "Beauport Steel Inc."],
    ["Georgian Bay Pioneer", "GEORGIAN BAY PIONEER (ON 1188220)"],
    ["Nakamura Precision Tooling Inc. (EIN 76-0448213)", "Nakamura Precision Tooling Inc"],
    ["Wieczorek Machine Works Inc.", "Wieczorek Machine Works Inc (EIN 38-1177920)"],
    ["{5000}D 0447120933 HRABOWSKI RAIL SERVICES INC 2101 MCCARTY ST HOUSTON TX", "Hrabowski Rail Services, Inc."],
    ["Delgadillo Mobile Home Movers LP", "Delgadillo Mobile Home Movers Limited Partnership"],
    ["Fromagerie des Cantons Ltée", "Fromagerie des Cantons Limitée"],
    ["Atelier d'usinage Bergevin Inc.", "Atelier d'Usinage Bergevin Inc. (NEQ 1172233458)"],
    ["Marquette Steward (ON 1287744)", "Marquette Steward"],
    ["ORIG:TRANSPORT LETOURNEAU INC", "Transport Létourneau Inc."],
    ["Nakhon Pathom Somboon Karnchang Limited Partnership", "Nakhon Pathom Somboon Karnchang Ltd., Part."],
  ] as const) assert.ok(score(a, b) >= FORT, `${a} / ${b} : ${score(a, b).toFixed(3)}`);
});

test("tour 16 : la société de personnes n'est pas la société par actions, et le nom d'exploitation est une variante", () => {
  /* « Gagnon et Bérubé, S.E.N.C. » face à « Gagnon et Bérubé Inc. » : deux immatriculations (jeu 20, 1,000 avant) */
  assert.ok(score("Gagnon et Bérubé, S.E.N.C.", "Gagnon et Bérubé Inc.") <= POSSIBLE);
  assert.ok(score("Delgadillo Mobile Home Movers Limited Partnership", "Delgadillo Mobile Home Movers Ltd.") <= POSSIBLE, "un limited partnership n'est pas une Ltd");
  const v = variantes("2718281 Ontario Inc. o/a Maple Ridge Landscaping");
  assert.ok(v.includes("2718281 Ontario Inc."), v.join(" | "));
  assert.ok(v.some((x) => /^Maple Ridge Landscaping$/i.test(x)), v.join(" | "));
  /* les onze limites connues du jeu 20 sont dans doc/LIMITES.md : un navire nu au pluriel ou à une lettre près reste ce qu'il est */
  assert.ok(score("Atchafalaya Ranger", "Atchafalaya Rangers") >= FORT, "limite connue : le pluriel d'un navire sans signe de navire");
});
