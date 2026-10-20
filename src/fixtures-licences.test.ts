import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { DOSSIER_FIXTURES, EDITEUR_DES_FIXTURES, manquesDesFixtures, phraseDesFixtures } from "./fixtures-licences.ts";

test("every fixture is named with its publisher, and LICENCES.md and the README say each keeps its licence", () => {
  assert.deepEqual(manquesDesFixtures(), []);
  const phrase = phraseDesFixtures();
  for (const f of readdirSync(DOSSIER_FIXTURES)) assert.ok(phrase.includes(`\`${f}\``), `${f} is named in the sentence`);
  for (const doc of ["../LICENCES.md", "../README.md"]) assert.ok(readFileSync(new URL(doc, import.meta.url), "utf8").includes(phrase), `${doc} carries the sentence`);
});

test("a fixture added without its publisher, or a publisher left without its file, is named", () => {
  const fichiers = Object.keys(EDITEUR_DES_FIXTURES);
  assert.match(manquesDesFixtures([...fichiers, "nouvelle.xml"]).join(" "), /nouvelle\.xml has no publisher/);
  assert.match(manquesDesFixtures(fichiers.filter((f) => f !== "onu.xml")).join(" "), /names onu\.xml, which is not in src\/fixtures/);
});
