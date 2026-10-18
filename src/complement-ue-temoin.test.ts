/*
 * WITNESS: Council Implementing Regulation (EU) 2026/2193 (28 September 2026, Annex IV entries 99 to 108 of Regulation
 * 2024/1485) is not in the EU consolidated feed yet. A name from entry 99 must be found by a client screening anyway, and
 * once the feed carries the same entry it must be found once, not twice. These two cases use nothing but the screening
 * entry point (`executer`), so they run unchanged against the commit before the supplement existed.
 */
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { executer, versCsv } from "./cribler.ts";
import { analyser, fichierDe, SOURCES, type LigneManifeste, type Manifeste } from "./listes.ts";

const ICI = fileURLToPath(new URL(".", import.meta.url));
const OFAC = readFileSync(join(ICI, "fixtures", "ofac.xml"), "utf8");
const MAINTENANT = new Date("2026-10-18T09:00:00Z");

/** A fresh EU file (generated 17 October, newest publication 16 October) holding `entites`: [numberTitle, wholeName] pairs. */
const xmlUe = (entites: [string, string][]): string => [
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`,
  `<export xmlns="http://eu.europa.ec/fpi/fsd/export" generationDate="2026-10-17T10:00:00">`,
  `  <sanctionEntity designationDetails="" logicalId="742">`,
  `    <regulation regulationType="regulation" organisationType="council" publicationDate="2026-10-16" entryIntoForceDate="2014-07-31" numberTitle="833/2014 (OJ L229)" programme="RUS" logicalId="902"/>`,
  `    <subjectType code="enterprise" classificationCode="E"/>`,
  `    <nameAlias firstName="" middleName="" lastName="" wholeName="Zaporozhye Heavy Machinery JSC" function="" title="" nameLanguage="EN" strong="true" regulationLanguage="en" logicalId="903"/>`,
  `  </sanctionEntity>`,
  ...entites.flatMap(([titre, nom], i) => [
    `  <sanctionEntity designationDetails="" logicalId="${9000 + i}">`,
    `    <regulation regulationType="regulation" organisationType="council" publicationDate="2026-09-28" entryIntoForceDate="2026-09-28" numberTitle="${titre}" programme="RUS" logicalId="${9100 + i}"/>`,
    `    <subjectType code="person" classificationCode="P"/>`,
    `    <nameAlias firstName="" middleName="" lastName="" wholeName="${nom}" function="" title="" nameLanguage="EN" strong="true" regulationLanguage="en" logicalId="${9200 + i}"/>`,
    `  </sanctionEntity>`,
  ]),
  `</export>`,
  ``,
].join("\n");

const racines: string[] = [];
after(() => { for (const d of racines) rmSync(d, { recursive: true, force: true }); });

function ligne(source: "OFAC" | "EU", texte: string, plus: Record<string, unknown> = {}): LigneManifeste {
  const def = SOURCES.find((s) => s.source === source)!;
  return {
    source, titre: def.titre, url: "https://example.invalid/x", format: def.format, disponible: true, telechargeLe: "2026-10-17T08:00:00.000Z",
    sha256: createHash("sha256").update(texte).digest("hex"), octets: Buffer.byteLength(texte), entrees: analyser(def.format, texte, source).length, ...plus,
  } as LigneManifeste;
}

/** Screen "[name removed]" against a throwaway root whose EU file holds `entites`; the candidates found. */
function criblageDe(entites: [string, string][]) {
  const dossier = realpathSync(mkdtempSync(join(tmpdir(), "complement-ue-")));
  racines.push(dossier);
  mkdirSync(join(dossier, "data", "listes"), { recursive: true });
  const ue = xmlUe(entites);
  writeFileSync(join(dossier, "data", "listes", fichierDe(SOURCES.find((s) => s.source === "OFAC")!)), OFAC);
  writeFileSync(join(dossier, "data", "listes", fichierDe(SOURCES.find((s) => s.source === "EU")!)), ue);
  const m: Manifeste = {
    version: 1, genereLe: "2026-10-17T08:00:00.000Z",
    listes: [ligne("OFAC", OFAC), ligne("EU", ue, { fraicheur: { fichierGenereLe: "2026-10-17", fichierPublieLe: "2026-10-16", rssAnnonceLe: "2026-10-17" } })],
  };
  writeFileSync(join(dossier, "listes-manifest.json"), JSON.stringify(m, null, 2) + "\n");
  mkdirSync(join(dossier, "run"));
  const fichier = join(dossier, "run", "contreparties.csv");
  writeFileSync(fichier, "name\nVyacheslav Sergeevich Kirillov\n");
  return executer(fichier, undefined, MAINTENANT, undefined, { racine: dossier }).criblage;
}
const candidats = (entites: [string, string][]) => criblageDe(entites).resultats[0]!.candidats.filter((c) => /kirillov/i.test(c.nomListe));

test("witness: a name from entry 99 of Regulation 2026/2193 is found while the EU feed does not carry it", () => {
  const trouves = candidats([]);
  assert.equal(trouves.length, 1, `expected one hit for Kirillov, got ${trouves.length}`);
  assert.equal(trouves[0]!.source, "EU");
});

test("witness: a feed that carries the same entry yields one hit, not two", () => {
  const trouves = candidats([["2026/2193 (OJ L, 2026/2193, 28.9.2026)", "[name removed]"]]);
  assert.equal(trouves.length, 1, `expected one hit for Kirillov, got ${trouves.length}`);
  assert.deepEqual(trouves[0]!.ids, ["9000"], "the hit that remains is the feed's own entry");
});

test("a hit from the supplement says so in the record and in the spreadsheet, and the coverage line says it once", () => {
  const c = criblageDe([]);
  const k = c.resultats[0]!.candidats.find((x) => /kirillov/i.test(x.nomListe))!;
  assert.deepEqual(k.complement, { celex: "32026R2193", annexe: "IV", entree: 99, luLe: "2026-10-18", url: "https://publications.europa.eu/resource/celex/32026R2193" });
  assert.match(k.designation!.champ!, /Official Journal \(CELEX 32026R2193, Annex IV, entry 99, read 2026-10-18\), not from the EU feed/);
  assert.match(versCsv(c), /Official Journal \(CELEX 32026R2193, Annex IV, entry 99, read 2026-10-18\), not from the EU feed/);
  const lignes = c.reserves.filter((r) => /Official Journal/.test(r));
  assert.equal(lignes.length, 1);
  assert.match(lignes[0]!, /^10 EU entries \(Council Implementing Regulation \(EU\) 2026\/2193, CELEX 32026R2193, Annex IV, entries 99 to 108\) come from the Official Journal, read on 2026-10-18, and not from the EU feed/);
});

test("a hit from the feed itself carries no supplement mark, and the coverage line counts only the entries still read from the Official Journal", () => {
  const c = criblageDe([["2026/2193 (OJ L, 2026/2193, 28.9.2026)", "[name removed]"]]);
  const k = c.resultats[0]!.candidats.find((x) => /kirillov/i.test(x.nomListe))!;
  assert.equal(k.complement, undefined);
  assert.deepEqual(c.complementUe?.entrees, [100, 101, 102, 103, 104, 105, 106, 107, 108]);
  assert.deepEqual(c.complementUe?.dejaDansLeFlux, [99]);
  assert.match(c.reserves.find((r) => /Official Journal/.test(r))!, /^9 EU entries .*entries 100 to 108\).* Of the same act, entry 99 is already in the feed and read from it\.$/);
});
