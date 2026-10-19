/**
 * Weaknesses of the matcher on Arabic and Russian names (plan faiblesses-ar-ru). Synthetic or public-list names only.
 * S2: the ALA-LC half rings (U+02BF ayn, U+02BE hamza) are marks, not letters.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreNoms, preparerNom, lecturesDe } from "./entites.ts";
import { frequencesDesListes } from "./frequences.ts";
import { Index, cribler } from "./cribler.ts";
import type { EntreeListe } from "./listes.ts";

const f = frequencesDesListes();
const mots = (n: string) => { const l = lecturesDe(n)[0]!; return preparerNom(f, l.texte, l.lecture).mots; };

test("faiblesses ar-ru, half rings: an ALA-LC name scores like its plain spelling", () => {
  const s = scoreNoms(f, "ʿAbd al-Ḥelīz Varkem", "[name removed]");
  assert.ok(s >= 0.81, `half ring query: ${s.toFixed(3)} (strong expected)`);
});

test("faiblesses ar-ru, half rings: a half ring inside or before a word leaves the same words", () => {
  assert.deepEqual(mots("Saʿīd Jalili"), mots("Said Jalili"));
  assert.deepEqual(mots("ʿAli Hamdan"), mots("Ali Hamdan"));
  assert.deepEqual(mots("Muʾmin Karim"), mots("Mumin Karim"));
});

test("faiblesses ar-ru, half rings: the digraph marks of other registers are kept", () => {
  assert.notDeepEqual(mots("Koʻks Etau"), mots("Koks Etau"));
});

// S3: Cyrillic look-alike letters typed inside a Latin name (U+0443 u, U+043E o, U+0423 U, U+0435 e, U+0441 c, U+0440 p, U+0445 x)
const CY = { u: "у", o: "о", U: "У", e: "е", c: "с", p: "р", x: "х" };

test("faiblesses ar-ru, look-alikes: a Latin name with Cyrillic twins reads as the Latin name", () => {
  const sali = `K${CY.u}lv${CY.o}r M${CY.o}stra${CY.c}h${CY.u}${CY.e}v Dul${CY.e}${CY.p}an${CY.o}va`;
  assert.deepEqual(mots(sali), mots("Kylvor Mostrachyev Dulepanova"));
  assert.deepEqual(mots(`M${CY.o}rvan${CY.e}sh K${CY.e}l${CY.p}${CY.o}r`), mots("Morvanesh Kelpor"));
});

test("faiblesses ar-ru, look-alikes: the tour 13 mixed words read as before", () => {
  assert.deepEqual(mots("ATБACAP ACTЫK TPEЙД"), mots("Атбасар Астык Трейд"));
  assert.deepEqual(mots("DigitalСервис"), ["digitalservis"]);
});

test("faiblesses ar-ru, look-alikes: one Cyrillic letter with no Latin twin leaves the word read by sound", () => {
  /* the final U+0431 (b) has no twin: the word keeps its sound reading, kh for U+0445 */
  assert.deepEqual(mots("Ale\u0445andr\u0431"), ["alekhandrb"]);
  assert.deepEqual(mots("Ale\u0445andr"), ["alexandr"]);
});

// S4: the patronymic in second position of a listed "Given Patronymic FAMILY"
test("faiblesses ar-ru, patronymic: a given plus family query reaches strong against a listed patronymic name", () => {
  const s = scoreNoms(f, "Liliia Arkhipova", "Liliya Valeryevna ARKHIPOVA");
  assert.ok(s >= 0.81, `patronymic dropped: ${s.toFixed(3)} (strong expected)`);
});

test("faiblesses ar-ru, patronymic: a two-word listed name ending in -ovich is not a patronymic", () => {
  const a = scoreNoms(f, "Ivan Abramovich", "Ivan Petrovich Abramovich");
  const b = scoreNoms(f, "Ivan Petrovich Abramovich", "Ivan Abramovich");
  assert.ok(a >= 0.81 && b >= 0.81, `${a.toFixed(3)} ${b.toFixed(3)}`);
  assert.ok(scoreNoms(f, "Boris Abramovich", "Ivan Abramovich") < 0.81);
});

// W4: a short person-shaped query meeting a listed ENTITY whose other words are only name particles stays at possible
const seuilsW4 = { fort: 0.81, possible: 0.74 };
const listeW4 = (type: "entity" | "person", nom = "AL SAMIR AND AL NADIR LLC"): EntreeListe[] => [{ source: "OFAC", id: "w4", nom, alias: [], type }];
const niveauW4 = (nom: string, e: EntreeListe[]) => {
  const ix = new Index(f, e, seuilsW4.possible);
  const r = cribler({ ligne: 2, nom }, ix, seuilsW4);
  return { statut: r.statut, score: r.candidats[0]?.score ?? 0 };
};

test("faiblesses ar-ru, entity cap: two person-name words against an entity of the same names stay possible, never strong", () => {
  const r = niveauW4("Samir Al Nadyr", listeW4("entity"));
  assert.equal(r.statut, "possible", `${r.statut} ${r.score}`);
});

test("faiblesses ar-ru, entity cap: the same names listed as a PERSON stay strong", () => {
  const r = niveauW4("Samir Al Nadyr", listeW4("person", "AL SAMIR AL NADIR"));
  assert.equal(r.statut, "strong", `${r.statut} ${r.score}`);
});

test("faiblesses ar-ru, entity cap: a legal form in the query, or three name words, leaves the entity match as it was", () => {
  assert.equal(niveauW4("Samir Al Nadyr LLC", listeW4("entity")).statut, "strong");
  assert.equal(niveauW4("Samir Al Nadyr Hamza", listeW4("entity", "AL SAMIR AND AL NADIR AND AL HAMZA LLC")).statut, "strong");
});

test("faiblesses ar-ru, entity cap: an entity with a business word left over is not capped by this rule", () => {
  assert.equal(niveauW4("Samir Al Nadir", listeW4("entity", "SAMIR AL NADIR TRADING LLC")).statut, "strong");
});

test("faiblesses ar-ru, entity cap: an exact entity match, a business word in the query, or a form in a later reading are untouched", () => {
  assert.equal(niveauW4("Rosneft Trading", listeW4("entity", "ROSNEFT TRADING")).statut, "strong");
  assert.equal(niveauW4("Hamza Trading", listeW4("entity", "AL HAMZA TRADING LLC")).statut, "strong");
  assert.equal(niveauW4("Ali Hamza Trading LLC (formerly Ali Hamza)", listeW4("entity", "ALI HAMZA LLC")).statut, "strong");
});
