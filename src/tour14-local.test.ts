/**
 * TOUR 14, VOIE LOCALE (régime réduit : pas de voie d'agent) : ce que le jeu 18 a appris, Trieste et les Balkans sur les
 * documents. Chaque règle gardée a ici la paire qui l'a motivée ; les scores sont ceux de la méthode entière, au seuil FORT
 * de 0,81 et au plafond POSSIBLE de 0,80. Le jeu 18 est en apprentissage : rien ici ne vaut verdict.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreNoms, variantes, analyserEntite, associeDeLaSociete } from "./entites.ts";
import { frequencesDesListes } from "./frequences.ts";

const f = frequencesDesListes();
const score = (a: string, b: string) => scoreNoms(f, a, b);
const FORT = 0.81;
const POSSIBLE = 0.80;

test("tour 14 : deux associés d'une société de personnes italienne sont deux sociétés, le même associé une seule", () => {
  assert.equal(associeDeLaSociete("Alpina Trasporti S.a.s. di Qualizza Renzo & C."), "qualizza");
  assert.equal(associeDeLaSociete("Carnica Trasporti Snc di Bront Livio e C."), "bront");
  assert.equal(associeDeLaSociete("Alpina Trasporti S.a.s."), "");
  assert.ok(score("Alpina Trasporti S.a.s. di Qualizza Renzo & C.", "Alpina Trasporti S.a.s. di Petris Renzo & C.") <= POSSIBLE, "mesuré à 1,000 avant");
  assert.ok(score("Carnica Trasporti S.n.c. di Bront Livio & C.", "Carnica Trasporti S.n.c. di Molaro Livio & C.") <= POSSIBLE);
  assert.ok(score("Carnica Trasporti S.n.c. di Bront Livio & C.", "Carnica Trasporti Snc di Bront Livio e C.") >= FORT, "mesuré à 0,800 avant : « e C. »");
});

test("tour 14 : les barges du Danube et leurs numéros, l'OOD et l'EOOD, le code postal qui veut sa ville", () => {
  assert.equal(analyserEntite("Teglenica NS-2234").navire, true);
  assert.ok(variantes("Teglenica NS-2234").length === 1, "NS-2234 n'est pas un code postal nordique sans ville derrière lui");
  assert.ok(variantes("Nordvik AS FI-00100 Helsinki").includes("Nordvik AS"), "le code postal suivi de sa ville tombe toujours");
  assert.ok(score("Teglenica NS-2234", "Teglenica NS-2235") <= POSSIBLE, "mesuré à 1,000 avant");
  assert.ok(score("Ivanov Trans OOD", "Ivanov Trans EOOD") <= POSSIBLE, "mesuré à 1,000 avant : deux désignations bulgares");
  assert.ok(score("Ivanov Trans OOD", "Ivanov Trans O.O.D.") >= FORT);
});

test("tour 14 : les noms bilingues de Trieste et de Koper, le đ, le ъ bulgare, les formes hongroises épelées", () => {
  for (const [a, b] of [
    ["Jadranska Plovba d.o.o.", "Navigazione Adriatica d.o.o."], ["Obalna Špedicija d.o.o.", "Spedizione Costiera d.o.o."],
    ["Kraška Avtoprevozništvo d.d.", "Autotrasporti del Carso d.d."], ["Đorđević Trans d.o.o.", "Djordjevic Trans d.o.o."],
    ["Дунав Търговия ООД", "Dunav Targovia OOD"], ["MARITSA CHEMICALS AD", "МАРИЦА ХИМИКАЛИ АД"],
    ["Tisza Kereskedelmi Kft.", "Tisza Kereskedelmi Korlátolt Felelősségű Társaság"],
  ] as const) assert.ok(score(a, b) >= FORT, `${a} / ${b} : ${score(a, b).toFixed(3)}`);
  assert.ok(score("NAMDINH TEXTILE GARMENT CORP", "Tổng Công Ty Dệt May Nam Định") >= FORT, "le đ vietnamien reste un d (perdu le 29/09 quand le pli valait partout)");
});

test("tour 14 : les résidus des documents balkaniques (référence de crédit, ville et pays, matični broj) et l'italien abrégé", () => {
  assert.ok(variantes("MARITSA CHEMICALS AD DOC CREDIT REF 88213/24").includes("MARITSA CHEMICALS AD"));
  assert.ok(variantes("Dunav Trgovina d.o.o. maticni broj 20345678").includes("Dunav Trgovina d.o.o."));
  for (const [a, b] of [
    ["NOVISADPETROLEUMDOO/LCREF20240099", "Novi Sad Petroleum d.o.o."], ["SLAVONIJAFOODSDD,OSIJEK,HR", "Slavonija Foods d.d., Osijek, Hrvatska"],
    ["MARITSA CHEMICALS AD DOC CREDIT REF 88213/24", "Maritsa Chemicals AD"], ["VOJVODINA GRAIN TRADING DOO REF LC/2024/778", "Vojvodina Grain Trading d.o.o."],
    ["Dunav Trgovina d.o.o., MB 20345678", "Dunav Trgovina d.o.o. maticni broj 20345678"], ["POSAVINA TIMBER DOO, MB 71234567", "Posavina Timber d.o.o. maticni broj 71234567"],
    ["Sped. Rossetti", "Spedizioni Rossetti"], ["Trasp. Delton", "Trasporti Delton"], ["Zanut Trasp srl trieste", "Zanut Trasporti S.r.l., Trieste"],
  ] as const) assert.ok(score(a, b) >= FORT, `${a} / ${b} : ${score(a, b).toFixed(3)}`);
});
