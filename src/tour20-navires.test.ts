/**
 * TOUR 20, UN VRAI PÉTROLIER (04/10/2026) : les défauts qu'un navire désigné a montrés, chacun avec sa garde. La clé d'emprunt
 * qui respecte la place des voyelles en cyrillique et en grec ; le ъ bulgare devant une consonne ; le bloc court qui n'est pas
 * exact, plafonné ; la queue qui nomme le navire d'un armateur ; l'alias faible, jamais au fort. Les noms sont inventés, sauf
 * les mots de la langue (Capital, Management).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreNoms, variantes, clesEmpruntSyllabes, memeEmprunt, preparerEntite, frequencesDe, SEUIL_POSSIBLE } from "./entites.ts";
import { Index, cribler } from "./cribler.ts";
import { frequencesDesListes } from "./frequences.ts";
import type { EntreeListe } from "./listes.ts";

const f = frequencesDesListes();
const score = (a: string, b: string) => scoreNoms(f, a, b);
const FORT = 0.81;

test("tour 20 : la clé d'emprunt porte la place des voyelles en cyrillique et en grec", () => {
  assert.deepEqual(clesEmpruntSyllabes("capital"), ["k.p.t.l"]);
  assert.deepEqual(clesEmpruntSyllabes("trade"), ["tr.t"], "la voyelle finale est à part : le e muet");
  /* les mêmes consonnes, d'autres syllabes : deux mots */
  assert.equal(memeEmprunt("astral", "strela", "r", 3, true), false);
  assert.equal(memeEmprunt("yangtze", "eniks", "r", 3, true), false);
  assert.equal(memeEmprunt("pilica", "pavlik", "r", 3, true), false);
  /* le mot anglais prononcé garde ses syllabes, à une voyelle réduite près dès quatre consonnes */
  assert.equal(memeEmprunt("synergy", "sinerdzhi", "r", 3, true), true);
  assert.equal(memeEmprunt("management", "menidzhmant", "r", 3, true), true);
  assert.equal(memeEmprunt("management", "menidzhmant", "r", 3), false, "jamais sur un bloc");
  /* le kana, le hangul et le thaï intercalent des voyelles : la clé nue y reste la règle */
  assert.equal(memeEmprunt("display", "diseupeullei", "n", 3), true);
  assert.ok(score("Astral", "Производственное Объединение \"Стрела\"") < SEUIL_POSSIBLE);
  assert.ok(score("Veluwezoom", "АО “Плазма”") < SEUIL_POSSIBLE);
  assert.ok(score("Синерджи Кепитъл", "Synergy Capital Ltd") >= FORT);
});

test("tour 20 : le ъ bulgare devant une consonne est une voyelle, le signe dur russe reste muet", () => {
  assert.equal(preparerEntite("Кепитъл"), "kepital");
  assert.equal(preparerEntite("Мениджмънт"), "menidzhmant");
  assert.equal(preparerEntite("объект"), "obekt");
  assert.equal(preparerEntite("Банкъ"), "bank");
});

test("tour 20 : une soudure et une lettre changée, sur un bloc court, restent à relire", () => {
  assert.equal(score("Petrolink", "Petro Link"), 1);
  const s = score("Astral", "AZ Ural");
  assert.ok(s < FORT && s >= SEUIL_POSSIBLE, `0,833 avant la borne : ${s}`);
  assert.ok(score("Yangtze", "Yang Su") < FORT);
});

test("tour 20 : la queue qui nomme le navire d'un armateur n'est pas une adresse", () => {
  const a = "Northgate Maritime Management Company, Limited - Navire Kang Sol";
  assert.ok(score(a, "Northgate Maritime Management Company, Limited - Navire Chol Bong 2") < SEUIL_POSSIBLE, "deux navires d'un même armateur");
  assert.equal(score(a, "Kang Sol"), 1, "le navire criblé sous son nom rencontre l'entrée");
  assert.ok(variantes(a).includes("Kang Sol"));
  assert.ok(!variantes(a).includes("Northgate Maritime Management Company"));
  assert.ok(score("Example Shipping Ltd (vessel: Sea Rose)", "MV Sea Rose") >= FORT);
  /* la garde : « Vessel » dans un nom sans forme devant lui reste un mot du nom */
  assert.ok(!variantes("Blue Vessel Trading").includes("Trading"));
  /* et l'adresse derrière la forme tombe toujours */
  assert.ok(variantes("Northgate Trading Company, 12 Harbour Road, Limassol").includes("Northgate Trading Company"));
});

test("tour 20 : un candidat trouvé par un alias faible ne dépasse pas le niveau possible", () => {
  const entrees: EntreeListe[] = [
    { source: "OFAC", id: "1", nom: "NORTHGATE AUTOMOBILE PLANT JOINT STOCK COMPANY", alias: ["QUARVEX"], type: "entity", aliasFaibles: ["QUARVEX"] },
    { source: "OFAC", id: "2", nom: "SOUTHMERE AUTOMOBILE PLANT JOINT STOCK COMPANY", alias: ["ZELTRIX"], type: "entity" },
  ];
  const fx = frequencesDe(entrees.map((e) => [e.nom, ...e.alias]));
  const ix = new Index(fx, entrees, SEUIL_POSSIBLE);
  const seuils = { fort: FORT, possible: SEUIL_POSSIBLE };
  const faible = cribler({ ligne: 1, nom: "Quarvex" }, ix, seuils);
  assert.equal(faible.statut, "possible");
  assert.equal(faible.candidats[0]!.score, SEUIL_POSSIBLE);
  assert.equal(faible.candidats[0]!.aliasFaible, true);
  const ordinaire = cribler({ ligne: 2, nom: "Zeltrix" }, ix, seuils);
  assert.equal(ordinaire.statut, "strong", "un alias ordinaire désigne");
  /* et l'index ne perd rien : la comparaison exhaustive rend le même résultat */
  assert.deepEqual(cribler({ ligne: 1, nom: "Quarvex" }, ix, seuils, true).candidats, faible.candidats);
});
