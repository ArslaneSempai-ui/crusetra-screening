/*
 * THE EU SUPPLEMENT (src/complement-ue.ts) IS TRANSCRIBED FROM THE OFFICIAL JOURNAL, NOT GUESSED.
 * The fixture src/fixtures/ue-2026-2193-annex-iv.txt is the verbatim text of Annex IV entries 99 to 108 as fetched on
 * 18 October 2026; src/fixtures/ue-2026-2193-source.json names the document and its sha256. Every transcribed name, alias
 * and date of birth must occur in that text, and nothing the text does not print may be added.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import "./cribler.ts"; // loads the engine modules in their working order before src/complement-ue.ts reads the preparation
import {
  LIGNES_2193, entreesComplementUe, sansCeuxDuFlux, numerosEnTexte, URL_2193, CELEX_2193, LU_LE_2193, DATE_INSCRIPTION_2193, idComplement,
} from "./complement-ue.ts";
import type { EntreeListe } from "./listes.ts";

const ICI = fileURLToPath(new URL(".", import.meta.url));
const texte = readFileSync(join(ICI, "fixtures", "ue-2026-2193-annex-iv.txt"), "utf8");
const source = JSON.parse(readFileSync(join(ICI, "fixtures", "ue-2026-2193-source.json"), "utf8")) as Record<string, string | number>;
const lignesDuTexte = texte.split("\n");

/** The block of one entry in the text: from « ‘99. » (or « 100. ») to the line before the next entry number. */
function bloc(entree: number): string[] {
  const debut = lignesDuTexte.findIndex((l) => l === `${entree}.` || l === `‘${entree}.`);
  assert.ok(debut >= 0, `entry ${entree} is in the text`);
  const fin = lignesDuTexte.findIndex((l, i) => i > debut && /^(?:‘)?\d+\.$/.test(l));
  return lignesDuTexte.slice(debut, fin < 0 ? undefined : fin);
}

test("the fixture names the document it was cut from: address, sha256 of the whole document, day read", () => {
  assert.equal(source.url, URL_2193);
  assert.equal(source.celex, CELEX_2193);
  assert.equal(source.readOn, LU_LE_2193);
  assert.match(String(source.sha256), /^[0-9a-f]{64}$/);
});

test("the supplement holds exactly entries 99 to 108, ten natural persons", () => {
  assert.deepEqual(LIGNES_2193.map((l) => l.entree), [99, 100, 101, 102, 103, 104, 105, 106, 107, 108]);
  assert.match(texte, /^In\sAnnex\sIV\sto\sRegulation\s\(EU\)\s2024\/1485,\sthe\sfollowing\sentries\sare\sadded\sunder\sthe\sheading\s‘A\.\sNatural\spersons’:/);
});

test("every transcribed name, alias and date of birth occurs verbatim in the fixture, inside its own entry", () => {
  for (const l of LIGNES_2193) {
    const b = bloc(l.entree);
    assert.ok(b.includes(l.nom), `entry ${l.entree}: name "${l.nom}" is a line of its entry`);
    for (const a of l.alias) assert.ok(b.includes(`(${a})`), `entry ${l.entree}: alias "${a}" is printed in brackets under the name`);
    assert.ok(b.includes(`DOB: ${l.naissance}`), `entry ${l.entree}: date of birth ${l.naissance} is printed`);
    assert.ok(texte.includes(l.nom) && l.alias.every((a) => texte.includes(a)) && texte.includes(l.naissance));
    assert.ok(b.includes(DATE_INSCRIPTION_2193) || b.includes(`${DATE_INSCRIPTION_2193}’`), `entry ${l.entree}: date of listing ${DATE_INSCRIPTION_2193}`);
  }
});

test("nothing is carried that the text does not print: no entry has more aliases than the one printed form, and the entries are the ten of the text", () => {
  const nomsImprimes = lignesDuTexte.filter((l) => /^[A-Z][A-Za-z]+ [A-Z][A-Za-z]+ [A-Z]{3,}$/.test(l));
  assert.deepEqual(LIGNES_2193.map((l) => l.nom), nomsImprimes);
  for (const l of LIGNES_2193) assert.equal(l.alias.length, 1);
  const bracketed = lignesDuTexte.filter((l) => /^\(.+\)$/.test(l));
  assert.equal(bracketed.length, LIGNES_2193.length);
});

test("each entry carries its source (CELEX, annex, entry number, day read) and a stable id", () => {
  for (const e of entreesComplementUe()) {
    assert.equal(e.source, "EU");
    assert.equal(e.type, "person");
    assert.equal(e.complement?.celex, "32026R2193");
    assert.equal(e.complement?.annexe, "IV");
    assert.equal(e.complement?.luLe, "2026-10-18");
    assert.equal(e.id, idComplement(e.complement!.entree));
    assert.match(e.designation!.champ!, new RegExp(`entry ${e.complement!.entree}, read 2026-10-18`));
  }
});

/* ───────────── "the same entry": the act's number in the feed AND the same name under the engine's preparation ───────────── */

const deFlux = (id: string, nom: string, reglements: string[] | undefined, alias: string[] = []): EntreeListe =>
  ({ source: "EU", id, nom, alias, type: "person", ...(reglements ? { reglements } : {}) });
const entree99 = () => entreesComplementUe().filter((e) => e.complement!.entree === 99);
const reste = (flux: EntreeListe[]) => sansCeuxDuFlux(entreesComplementUe(), flux).dansLeFlux.map((e) => e.complement!.entree);

test("same entry: the act's number and the same name, whatever the case, the word order or the alias it sits in", () => {
  assert.deepEqual(reste([deFlux("1", "Vyacheslav Sergeevich KIRILLOV", ["2026/2193 (OJ L, 2026/2193, 28.9.2026)"])]), [99]);
  assert.deepEqual(reste([deFlux("1", "Kirillov Vyacheslav Sergeevich", ["2026/2193 (OJ L)"])]), [99]);
  assert.deepEqual(reste([deFlux("1", "Someone Else", ["833/2014 (OJ L229)", "2026/2193 (OJ L)"], ["vyacheslav sergeevich kirillov"])]), [99]);
});

test("not the same entry: the name under another act, the act with another name, an act number that only starts alike, a feed without regulations", () => {
  assert.deepEqual(reste([deFlux("1", "Vyacheslav Sergeevich KIRILLOV", ["833/2014 (OJ L229)"])]), []);
  assert.deepEqual(reste([deFlux("1", "Vyacheslav Sergeevich KIRILLOV", undefined)]), []);
  assert.deepEqual(reste([deFlux("1", "Somebody Unrelated Person", ["2026/2193 (OJ L)"])]), []);
  assert.deepEqual(reste([deFlux("1", "Vyacheslav Sergeevich KIRILLOV", ["2026/21930 (OJ L)"])]), []);
  assert.deepEqual(reste([deFlux("1", "Vyacheslav Sergeevich KIRILLOV", ["2025/2193 (OJ L)"])]), []);
});

test("a supplement entry is never dropped because of another supplement entry", () => {
  const supp = entreesComplementUe();
  const { gardees, dansLeFlux } = sansCeuxDuFlux(supp, supp);
  assert.equal(gardees.length, 10);
  assert.equal(dansLeFlux.length, 0);
  assert.equal(entree99().length, 1);
});

test("numerosEnTexte", () => {
  assert.equal(numerosEnTexte([99, 100, 108]), "99, 100, 108");
  assert.equal(numerosEnTexte([100, 101, 102]), "100 to 102");
  assert.equal(numerosEnTexte([99]), "99");
});
