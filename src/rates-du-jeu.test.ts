/**
 * LES RATÉS D'UN JEU : le filtre et le rendu, sur une mesure de six lignes écrite ici et un jeu de
 * cinq paires. Aucune mesure n'est lancée : le script filtre ce que mesure-entites imprime, et
 * c'est ce filtre qu'on prouve (les niveaux gardés, la nature du jeu, l'ordre, les totaux).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleImprimee, lignesDuJeu, rendre, type Paire } from "./rates-du-jeu.ts";

const MESURE = [
  "16 jeux d'apprentissage, 2770 paires vraies, 2770 pièges · poids des 33393 entrées listées",
  "FORT      seuil 0.81 : vrais noms 2562/2770 (92.5 %) · fausses alertes 66/2770 (2.4 %)",
  "  jeu 1 (paires-entites.json) : fort R60/60 FP0/60 · possible R60/60 FP4/60",
  "temps 61234 ms",
  "  FAUSSE-F 0.811 added-word                   Zia Corporation (Pvt) Ltd  /  Zia Trading Corporation (Pvt) Ltd",
  "  RATÉ     0.413 whatsapp-name-abbreviation   Chinedu Phone Accessories Nigeria Limited  /  Chinedu Phones",
  "  RATÉ     0.000 missing-space                Ets Abou Khalil et Fils  /  EtsAbouKhalil etFils",
  "  fausse-p 0.800 sister-ship                  Hong Da 1  /  Hong Da 8",
  "  possible 0.800 abn-residue                  Beaumont Iron Ore Pty Ltd (ABN 45 123 456 789)  /  Beaumont Iron Ore Pty Ltd",
  "  possible 0.800 missing-space                Other Set Pair  /  OtherSetPair",
  "",
].join("\n");

/* la nature vient du JEU, pas de la ligne : les deux ratés du chat portent ici une nature commune */
const JEU: Paire[] = [
  { a: "Zia Corporation (Pvt) Ltd", b: "Zia Trading Corporation (Pvt) Ltd", nature: "added-word" },
  { a: "Chinedu Phone Accessories Nigeria Limited", b: "Chinedu Phones", nature: "chat-typing" },
  { a: "Ets Abou Khalil et Fils", b: "EtsAbouKhalil etFils", nature: "chat-typing" },
  { a: "Hong Da 1", b: "Hong Da 8", nature: "sister-ship" },
  { a: "Beaumont Iron Ore Pty Ltd (ABN 45 123 456 789)", b: "Beaumont Iron Ore Pty Ltd", nature: "abn-residue" },
];

test("rates-du-jeu : les lignes du jeu, groupées par sa nature, sans les fausses-p ni les paires d'un autre jeu", () => {
  const groupes = lignesDuJeu(MESURE, JEU);
  assert.deepEqual(groupes.map((g) => [g.nature, g.lignes.length]), [["chat-typing", 2], ["abn-residue", 1], ["added-word", 1]]);
  assert.deepEqual(groupes[0]!.lignes.map((l) => [l.niveau, l.score]), [["RATÉ", "0.000"], ["RATÉ", "0.413"]]);
  assert.equal(groupes[2]!.lignes[0]!.niveau, "FAUSSE-F");
  const tout = groupes.flatMap((g) => g.lignes.map((l) => l.texte));
  assert.ok(!tout.some((t) => t.includes("Hong Da")), "une fausse alerte au seul niveau possible n'est pas une cible");
  assert.ok(!tout.some((t) => t.includes("Other Set")), "une paire d'un autre jeu ne paraît pas");
});

test("rates-du-jeu : le rendu, une ligne par paire et les trois totaux, rien d'autre", () => {
  const lignes = rendre(lignesDuJeu(MESURE, JEU));
  assert.deepEqual(lignes, [
    "chat-typing (2)",
    "  RATÉ     0.000  Ets Abou Khalil et Fils  /  EtsAbouKhalil etFils",
    "  RATÉ     0.413  Chinedu Phone Accessories Nigeria Limited  /  Chinedu Phones",
    "abn-residue (1)",
    "  possible 0.800  Beaumont Iron Ore Pty Ltd (ABN 45 123 456 789)  /  Beaumont Iron Ore Pty Ltd",
    "added-word (1)",
    "  FAUSSE-F 0.811  Zia Corporation (Pvt) Ltd  /  Zia Trading Corporation (Pvt) Ltd",
    "total: 2 RATÉ, 1 FAUSSE-F, 1 possible",
  ]);
  assert.deepEqual(rendre([]), ["total: 0 RATÉ, 0 FAUSSE-F, 0 possible"], "un jeu sans raté rend ses totaux, et eux seuls");
});

test("rates-du-jeu : dans un groupe, les ratés avant les fausses alertes fortes avant les possibles, puis par score", () => {
  const mesure = [
    "  possible 0.800 n  A  /  B",
    "  FAUSSE-F 0.900 n  C  /  D",
    "  RATÉ     0.700 n  E  /  F",
    "  RATÉ     0.300 n  G  /  H",
    "  FAUSSE-F 0.850 n  I  /  J",
  ].join("\n");
  const jeu: Paire[] = [["A", "B"], ["C", "D"], ["E", "F"], ["G", "H"], ["I", "J"]].map(([a, b]) => ({ a: a!, b: b!, nature: "n" }));
  assert.deepEqual(lignesDuJeu(mesure, jeu)[0]!.lignes.map((l) => l.texte), ["G  /  H", "E  /  F", "I  /  J", "C  /  D", "A  /  B"]);
  assert.equal(cleImprimee({ a: "A", b: "B" }), "A  /  B");
});
