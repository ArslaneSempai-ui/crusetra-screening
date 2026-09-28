import { test } from "node:test";
import assert from "node:assert/strict";
import { batirReleve, differences, lireVerdicts, JEUX_AVEUGLES, JEU_REALISTE, RESERVES, type Apprentissage, type Livre } from "./releve-entites.ts";

const cellule = (succes: number, n: number) => ({ succes, n, taux: succes / n, bas: 0, haut: 1 });
const apprentissage: Apprentissage = { jeux: 2, paires: 4, pieges: 4, fort: { seuil: 0.81, trouves: cellule(3, 4), fausses: cellule(0, 4) }, possible: { seuil: 0.8, trouves: cellule(4, 4), fausses: cellule(1, 4) } };
const juge = (n: number, realiste: boolean) => ({ jeu: n, realiste, version: "v9", sha: "abcd1234", entites: "aaaaaaaa", cribler: "bbbbbbbb", ecritures: "cccccccc",
  fort: { seuil: "0.81", trouves: { n: 1, sur: 2, bas: 0, haut: 1 }, fausses: { n: 0, sur: 2, bas: 0, haut: 1 } },
  possible: { seuil: "0.80", trouves: { n: 2, sur: 2, bas: 0, haut: 1 }, fausses: { n: 1, sur: 2, bas: 0, haut: 1 } } });
const livre: Livre = { fichier: "a.csv", sha256: "0".repeat(64), releve: "a.json", sceau: "1".repeat(16), commit: "c", emisLe: "t", lignes: 1000, forts: 3, possibles: 13, sansCorrespondance: 984, aveugle: true, note: "n" };

test("releve-entites : le relevé porte ses cinq parts, ses réserves, et jamais un chiffre tapé", () => {
  const r = batirReleve({ date: "2026-09-28", commit: "d0332ab", apprentissage, verdictRealiste: juge(20, true), verdictsAveugles: [juge(12, false)], livres: [livre] });
  assert.equal(r.version, 1);
  assert.deepEqual(Object.keys(r), ["version", "quoi", "date", "commit", "apprentissage", "verdictRealiste", "verdictsAveugles", "livres", "reserves"]);
  assert.deepEqual(r.reserves, [...RESERVES]);
  assert.equal(r.empreinte, undefined, "le scellé vient de npm run sceller, jamais d'ici");
  /* les différences : tout sauf la date, le commit et le scellé */
  const relu = batirReleve({ date: "2026-10-01", commit: "ffffff0", apprentissage, verdictRealiste: juge(20, true), verdictsAveugles: [juge(12, false)], livres: [livre] });
  assert.deepEqual(differences(r, relu), []);
  const bouge = batirReleve({ ...{ date: r.date, commit: r.commit, apprentissage, verdictRealiste: juge(20, true), verdictsAveugles: [juge(12, false)] }, livres: [{ ...livre, forts: 4 }] });
  assert.deepEqual(differences(r, bouge), ["livres"]);
});

test("releve-entites : les verdicts se lisent dans un registre, et un jeu absent refuse en le nommant", () => {
  const ligne = (n: number) => `| 2026-09-28 | v9 aaaaaaaa / bbbbbbbb / ecritures cccccccc | ${n === JEU_REALISTE ? "realistic " : ""}set #${n} abcd1234 (brief) | 200 + 200 | strong 0.81 | 1/2 [0-1 %] | 0/2 [0-1 %] |\n| | | | | possible 0.80 | 2/2 [0-1 %] | 1/2 [0-1 %] |\n`;
  const registre = [JEU_REALISTE, ...JEUX_AVEUGLES].map(ligne).join("");
  const v = lireVerdicts(registre);
  assert.equal(v.realiste.jeu, 20); assert.equal(v.realiste.realiste, true);
  assert.deepEqual(v.aveugles.map((x) => x.jeu), [...JEUX_AVEUGLES]);
  assert.throws(() => lireVerdicts(registre.replace("set #23", "set #99")), /no judge row for set #23/);
});
