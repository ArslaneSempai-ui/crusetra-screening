/**
 * LA MESURE EN PARALLÈLE, ÉPROUVÉE : sur une fixture de soixante paires tirées des jeux
 * d'apprentissage (src/fixtures/paires-parallele.json, une sur cent), les fils et le fil unique
 * doivent donner le même score à chaque paire ; la table assemblée des scores doit être celle de
 * `mesurerPaires` sur le palier lui-même ; `mesurerJeuxParallele` doit rendre la mesure de
 * `mesurerJeux` ; le témoin exhaustif sur des fils doit rendre les résultats du criblage exhaustif
 * sur un fil, le fil principal prenant sa part. Tout tourne sans data/ : les poids viennent de la
 * fixture, et voyagent avec la tâche.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { scorerPaires, tableDepuisScores, mesurerJeuxParallele, criblerExhaustif, repartir, nombreDeFils, filsDuTemoin } from "./mesure-parallele.ts";
import { scoreNoms, palierEntite, mesurerJeux, frequencesDe, FREQUENCES_UNIFORMES, CHEMINS_APPRENTISSAGE } from "./entites.ts";
import { mesurerPaires, type PaireEtiquetee } from "./measure.ts";
import { Index, cribler, type Contrepartie } from "./cribler.ts";
import type { EntreeListe } from "./listes.ts";

const FIXTURE = JSON.parse(readFileSync(new URL("./fixtures/paires-parallele.json", import.meta.url), "utf8")) as { paires: PaireEtiquetee[] };
const PAIRES = FIXTURE.paires;
/* des poids non uniformes, tirés des noms de la fixture, pour que la pondération par la rareté joue */
const f = frequencesDe(PAIRES.map((p) => [p.a, p.b]));

test("mesure-parallele : la fixture a soixante paires environ, des deux verdicts, et des scores qui s'étalent", () => {
  assert.ok(PAIRES.length >= 50 && PAIRES.length <= 70, `${PAIRES.length} paires`);
  assert.ok(PAIRES.some((p) => p.verdict === "match") && PAIRES.some((p) => p.verdict === "different"));
  const scores = PAIRES.map((p) => scoreNoms(f, p.a, p.b));
  assert.ok(scores.some((s) => s >= 0.81) && scores.some((s) => s < 0.5), "une fixture où tous les scores se ressemblent ne prouverait rien");
});

test("mesure-parallele : les fils et le fil unique donnent le même score à chaque paire", async () => {
  const unFil = PAIRES.map((p) => scoreNoms(f, p.a, p.b));
  const fils = await scorerPaires(f, PAIRES, { fils: 4 });
  assert.equal(fils.fils, 4);
  assert.deepEqual(fils.scores, unFil);
  assert.ok(fils.demarrage > 0 && fils.durees.length === 4, "le démarrage et la durée de chaque fil sont rendus");
});

test("mesure-parallele : un seul fil, plus de fils que de paires, aucune paire : l'ordre et le compte tiennent", async () => {
  const cinq = PAIRES.slice(0, 5);
  const unFil = cinq.map((p) => scoreNoms(f, p.a, p.b));
  assert.deepEqual((await scorerPaires(f, cinq, { fils: 1 })).scores, unFil);
  const trop = await scorerPaires(f, cinq, { fils: 100 });
  assert.equal(trop.fils, 5, "jamais de fil vide : le nombre de fils est ramené au nombre de paires");
  assert.deepEqual(trop.scores, unFil);
  assert.deepEqual(await scorerPaires(f, [], { fils: 3 }), { fils: 0, demarrage: 0, durees: [], scores: [] });
});

test("mesure-parallele : la répartition met chaque pièce dans un seul fil, et la place se reconstruit", () => {
  const pieces = Array.from({ length: 11 }, (_, i) => i);
  const parts = repartir(pieces, 4);
  assert.deepEqual(parts, [[0, 4, 8], [1, 5, 9], [2, 6, 10], [3, 7]]);
  assert.deepEqual(pieces.map((_, i) => parts[i % 4]![Math.floor(i / 4)]), pieces);
  assert.deepEqual(repartir(pieces, 20).length, 11);
  assert.deepEqual(repartir([], 3), []);
});

test("mesure-parallele : la table assemblée des scores est celle de mesurerPaires sur le palier lui-même", () => {
  const p = palierEntite(f);
  const attendue = mesurerPaires(new Map([[p.id, p]]), PAIRES)[p.id]!;
  const scores = PAIRES.map((x) => p.score(x.a, x.b));
  assert.deepEqual(tableDepuisScores(PAIRES, scores), attendue);
  assert.throws(() => tableDepuisScores(PAIRES, scores.slice(1)), /did not answer for every pair/);
});

test("mesure-parallele : mesurerJeuxParallele rend la mesure de mesurerJeux sur le premier jeu d'apprentissage", async () => {
  const brut = readFileSync(CHEMINS_APPRENTISSAGE[0]!, "utf8");
  const attendue = mesurerJeux(FREQUENCES_UNIFORMES, [brut]);
  const m = await mesurerJeuxParallele(FREQUENCES_UNIFORMES, [brut], { fils: 3 });
  assert.deepEqual({ jeux: m.jeux, table: m.table }, attendue);
  assert.equal(m.scores.length, m.paires.length);
  assert.equal(m.paires.length, attendue.jeux[0]!.match + attendue.jeux[0]!.different);
});

test("mesure-parallele : le témoin exhaustif sur des fils rend les résultats du fil unique, le fil principal prenant sa part", async () => {
  /* une « liste » faite des noms b de la fixture, cherchée avec les noms a : comme cribler.test.ts, sans data/ */
  const entrees: EntreeListe[] = PAIRES.map((x, i) => ({ source: "OFAC", id: String(1000 + i), nom: x.b, alias: [], type: "entity" }));
  const fl = frequencesDe(entrees.map((e) => [e.nom]));
  const seuils = { fort: 0.81, possible: 0.74 };
  const index = new Index(fl, entrees, seuils.possible);
  const requetes: Contrepartie[] = PAIRES.map((x, i) => ({ ligne: i + 2, nom: x.a }));
  const unFil = requetes.map((c) => JSON.stringify(cribler(c, index, seuils, true)));
  let parLePrincipal = 0;
  const e = await criblerExhaustif(fl, entrees, seuils, requetes, { fils: 2, principal: (c) => { parLePrincipal++; return cribler(c, index, seuils, true); } });
  assert.equal(e.fils, 2);
  assert.equal(parLePrincipal, 20, "trois voies pour soixante requêtes : le fil principal en prend vingt");
  assert.deepEqual(e.resultats, unFil);
  assert.ok(unFil.filter((r) => !r.includes('"no-match"')).length > requetes.length / 2, "un témoin où rien ne passe le seuil ne prouverait rien");
  const sansPrincipal = await criblerExhaustif(fl, entrees, seuils, requetes.slice(0, 7), { fils: 3 });
  assert.equal(sansPrincipal.fils, 3);
  assert.deepEqual(sansPrincipal.resultats, unFil.slice(0, 7));
});

test("mesure-parallele : le nombre de fils suit la machine, et le témoin ne dépasse ni la machine ni la mémoire", () => {
  assert.equal(nombreDeFils(), Math.max(1, availableParallelism() - 1));
  assert.ok(filsDuTemoin() >= 1 && filsDuTemoin() <= nombreDeFils());
});
