/**
 * TOUR 9, VOIE LOCALE : ce que le jeu 13 a appris. Chaque règle gardée a ici la paire qui l'a motivée ; les scores
 * sont ceux de la méthode entière (préparation, variantes, score), au seuil FORT de 0,81 et au plafond POSSIBLE
 * de 0,80. Le jeu 13 est en apprentissage : rien ici ne vaut verdict.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreNoms, preparerNom, lecturesDe } from "./entites.ts";
import { frequencesDesListes } from "./frequences.ts";

const f = frequencesDesListes();
const score = (a: string, b: string) => scoreNoms(f, a, b);
const mots = (n: string) => { const l = lecturesDe(n)[0]!; return preparerNom(f, l.texte, l.lecture).mots; };
const FORT = 0.81;

test("tour 9 : une abréviation développée se traduit comme le mot entier (Tic., San., İth., İhr.)", () => {
  assert.deepEqual(mots("Yavuzlar Deniz Tasimaciligi Tic. AS"), mots("Yavuzlar Deniz Taşımacılığı Ticaret A.Ş."), "mesuré à 0,704 avant : ticaret d'un côté, trading de l'autre");
  assert.ok(mots("Bafra Un San. A.Ş.").includes("industry"), "« San. » avec son point est Sanayi");
  assert.ok(!mots("San Miguel Brewery Inc").includes("industry"), "sans point, San reste San Miguel");
  for (const [a, b] of [
    ["Yavuzlar Deniz Taşımacılığı Ticaret A.Ş.", "Yavuzlar Deniz Tasimaciligi Tic. AS"],
    ["Kıyıboyu Tarım Ürünleri İth. İhr. Ltd. Şti.", "Kiyiboyu Tarim Urunleri Ithalat Ihracat Limited Sirketi"],
    ["Bafra Un Sanayi A.Ş.", "Bafra Un San. A.Ş."],
  ] as const) assert.ok(score(a, b) >= FORT, `${a} / ${b} : ${score(a, b).toFixed(3)}`);
});

test("tour 9 : sous la marque slave, un mot du commerce se traduit sous toutes ses romanisations, et -khim est -chem", () => {
  for (const [a, b] of [
    ["AO Zaryanskiy Khimicheskiy Kombinat", "AO Zarianskii Khimicheskii Kombinat"],
    ["OOO Volzhskiy Agrokhim", "Volzhsky Agrochem LLC"],
  ] as const) assert.ok(score(a, b) >= FORT, `${a} / ${b} : ${score(a, b).toFixed(3)}`);
});

test("tour 9 : les génériques danois et norvégiens du poisson, et l'adjectif nordique", () => {
  assert.ok(score("NORDIC FISH EXPORT AS", "Nordisk Fiskeeksport A/S") >= FORT, "mesuré à 0,169 avant");
});
