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
