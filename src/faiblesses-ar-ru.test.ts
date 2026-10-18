/**
 * Weaknesses of the matcher on Arabic and Russian names (plan faiblesses-ar-ru). Synthetic or public-list names only.
 * S2: the ALA-LC half rings (U+02BF ayn, U+02BE hamza) are marks, not letters.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreNoms, preparerNom, lecturesDe } from "./entites.ts";
import { frequencesDesListes } from "./frequences.ts";

const f = frequencesDesListes();
const mots = (n: string) => { const l = lecturesDe(n)[0]!; return preparerNom(f, l.texte, l.lecture).mots; };

test("faiblesses ar-ru, half rings: an ALA-LC name scores like its plain spelling", () => {
  const s = scoreNoms(f, "ʿAbd al-Ḥabīb Alizai", "[name removed]");
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
  const sali = `Dm${CY.u}tr${CY.o} ${CY.U}${CY.e}vh${CY.e}n${CY.o}v${CY.u}${CY.c}h Sh${CY.e}v${CY.c}h${CY.e}nk${CY.o}`;
  assert.deepEqual(mots(sali), mots("Dmytro Yevhenovych Shevchenko"));
  assert.deepEqual(mots(`Ale${CY.x}ander ${CY.p}etrov`), mots("Alexander Petrov"));
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
