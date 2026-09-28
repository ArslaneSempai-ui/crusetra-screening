/**
 * PROMOUVOIR : la ligne du juge lue dans un registre minuscule écrit ici, la phrase de provenance
 * comparée au mot à mot du jeu 16 (la seule lecture d'un vrai fichier, et c'est une provenance,
 * pas une paire), l'insertion dans CHEMINS_APPRENTISSAGE sur un extrait. Rien n'est promu ici.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { aujourdhui, fichierDuJeu, insererChemin, ligneDuJuge, nombreEnLettres, phraseDuJuge, prochainNumero, provenancePromue, type Juge } from "./promouvoir.ts";
import { CHEMINS_APPRENTISSAGE } from "./entites.ts";

const REGISTRE = [
  "| date | method (entites / cribler) | held-out set (sha256) | pairs | strong level | found | false alerts |",
  "|---|---|---|---|---|---|---|",
  "| 2026-09-27 12h | v6 4ce80263 / f23ecac0 | set #3 c53a55c5, becomes paires-entites-5.json | 200 + 200 | 0.81 | 167/200 [78-88 %] | 25/200 [9-18 %] |",
  "| 2026-09-28 | v16 ebbd2990 / 6ad910de / ecritures bdd60326 | set #14 ee673be7 (Mombasa brief, by document; overlap: 0 pairs, 0 names), becomes paires-entites-15.json | 200 + 200 | strong 0.81 | 141/200 [64-76 %] | 2/200 [0-4 %] |",
  "| | | | | possible 0.80 | 173/200 [81-91 %] | 23/200 [8-17 %] |",
  "| 2026-09-28 | v17 fa808a1c / a91bf0c8 / ecritures bdd60326 | set #15 f44d2a17 (Abidjan brief, in five parts; 8 pairs identical but for case), becomes paires-entites-16.json | 200 + 200 | strong 0.81 | 171/200 [80-90 %] | 8/200 [2-8 %] |",
  "| | | | | possible 0.80 | 188/200 [90-97 %] | 35/200 [13-23 %] |",
  "",
  "v6 on set #3 at other thresholds: 0.70 found 182 with 52 false.",
].join("\n");

test("promouvoir : la ligne du juge, ses trois empreintes, ses deux niveaux", () => {
  const j = ligneDuJuge(REGISTRE, 15);
  assert.ok(j);
  assert.deepEqual([j.version, j.sha, j.entites, j.cribler, j.ecritures], ["v17", "f44d2a17", "fa808a1c", "a91bf0c8", "bdd60326"]);
  assert.deepEqual(j.fort, { seuil: "0.81", trouves: { n: 171, sur: 200, bas: 80, haut: 90 }, fausses: { n: 8, sur: 200, bas: 2, haut: 8 } });
  assert.deepEqual(j.possible, { seuil: "0.80", trouves: { n: 188, sur: 200, bas: 90, haut: 97 }, fausses: { n: 35, sur: 200, bas: 13, haut: 23 } });
  assert.equal(ligneDuJuge(REGISTRE, 14)?.version, "v16");
  assert.equal(ligneDuJuge(REGISTRE, 1), null, "« set #1 » ne doit pas se lire dans « set #15 »");
  assert.equal(ligneDuJuge(REGISTRE, 3), null, "une ligne d'un autre âge, sans ecritures ni niveau possible, ne se lit pas");
  assert.equal(ligneDuJuge(REGISTRE.replace("| | | | | possible 0.80 | 188", "| | | | | possibl 0.80 | 188"), 15), null, "sans sa ligne possible, la ligne forte ne suffit pas");
});

test("promouvoir : la phrase du juge est, mot pour mot, celle de la provenance du jeu 16", () => {
  const j = ligneDuJuge(REGISTRE, 15) as Juge;
  const phrase = phraseDuJuge(15, j, "2026-09-29");
  const seize = JSON.parse(readFileSync(new URL("./paires-entites-16.json", import.meta.url), "utf8")) as { provenance: string };
  /* le jeu 16, écrit à la main, range le recouvrement au milieu de la phrase de l'auteur ; l'outil le met en
     tête de la sienne. Le mot à mot se compare donc à partir du jugement, et le recouvrement à part. */
  const [recouvrement, jugement] = phrase.split(/(?<=names\.) (?=Judged once)/);
  assert.equal(recouvrement, "Overlap with the fifteen earlier training sets: 0 pairs, 0 names.");
  assert.ok(seize.provenance.toLowerCase().includes("overlap with the fifteen earlier training sets: 0 pairs, 0 names"));
  assert.ok(seize.provenance.endsWith(" " + jugement), `attendu en fin de provenance :\n${jugement}\nlu :\n${seize.provenance.slice(-jugement!.length - 1)}`);
  assert.ok(phrase.includes("fa808a1c…"), "les points de suspension sont U+2026");
  const unePaire = phraseDuJuge(19, j, "2026-09-28", { paires: 1, noms: 1 });
  assert.ok(unePaire.startsWith("Overlap with the nineteen earlier training sets: 1 pair, 1 name. Judged once"), unePaire);
  assert.ok(phraseDuJuge(19, j, "2026-09-28", { paires: 2, noms: 3 }).startsWith("Overlap with the nineteen earlier training sets: 2 pairs, 3 names."));
  assert.ok(!phrase.includes("..."));
  assert.ok(!phrase.includes("\u2014"));
});

test("promouvoir : la provenance promue ferme celle de l'auteur d'un point, jamais de deux", () => {
  const j = ligneDuJuge(REGISTRE, 15) as Juge;
  const sansPoint = provenancePromue("blind test set #15, authored blind; no pair was read", 15, j, "2026-09-29");
  assert.ok(sansPoint.startsWith("blind test set #15, authored blind; no pair was read. Overlap with the fifteen earlier training sets: 0 pairs, 0 names. Judged once"));
  const avecPoint = provenancePromue("blind test set #15, authored blind.  ", 15, j, "2026-09-29");
  assert.ok(avecPoint.startsWith("blind test set #15, authored blind. Overlap with"));
  assert.ok(avecPoint.endsWith("promoted to training set 16 on 2026-09-29, so it no longer measures anything held out."));
});

test("promouvoir : la ligne s'insère après celle du jeu N, une seule fois, et l'ancre doit exister", () => {
  const source = [
    "export const CHEMINS_APPRENTISSAGE = [",
    '  new URL("./paires-entites.json", import.meta.url),',
    '  new URL("./paires-entites-2.json", import.meta.url),',
    "];",
  ].join("\n");
  const apres2 = insererChemin(source, 2).split("\n");
  assert.equal(apres2[3], '  new URL("./paires-entites-3.json", import.meta.url),');
  assert.equal(apres2.length, 5);
  const apres1 = insererChemin(source.split("\n").filter((l) => !l.includes("-2.json")).join("\n"), 1).split("\n");
  assert.equal(apres1[2], '  new URL("./paires-entites-2.json", import.meta.url),', "le premier jeu s'appelle paires-entites.json");
  assert.throws(() => insererChemin(source, 1), /already lists paires-entites-2.json/);
  assert.throws(() => insererChemin(source, 7), /no line for paires-entites-7.json/);
  assert.deepEqual([fichierDuJeu(1), fichierDuJeu(16)], ["paires-entites.json", "paires-entites-16.json"]);
  /* le prochain numéro d'apprentissage est le dernier listé plus un : le jeu aveugle 21 devient le jeu d'apprentissage 21 */
  assert.equal(prochainNumero(source), 3);
  /* sur le vrai entites.ts : le dernier listé plus un, quel que soit le nombre de jeux promus depuis */
  assert.equal(prochainNumero(readFileSync(new URL("./entites.ts", import.meta.url), "utf8")), CHEMINS_APPRENTISSAGE.length + 1);
  const j21 = ligneDuJuge(REGISTRE, 15) as Juge;
  assert.ok(phraseDuJuge(21, j21, "2026-09-28", { paires: 0, noms: 0 }, 21).includes("promoted to training set 21 on 2026-09-28"));
});

test("promouvoir : les nombres en lettres jusqu'à vingt, la date locale", () => {
  assert.deepEqual([nombreEnLettres(1), nombreEnLettres(15), nombreEnLettres(20), nombreEnLettres(21)], ["one", "fifteen", "twenty", "21"]);
  assert.equal(aujourdhui(new Date(2026, 8, 28, 23, 50)), "2026-09-28");
  assert.equal(aujourdhui(new Date(2026, 0, 3)), "2026-01-03");
});
