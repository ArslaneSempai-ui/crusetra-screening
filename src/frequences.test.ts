/**
 * THE WORD-WEIGHT TABLE IS PINNED, AND IT IS THE COUNT THE CODE MAKES NOW. Two guards. The pinned table (src/frequences.ts,
 * TABLE_GELEE) must be on disk with the recorded hash, and it is what every measurement and every screening reads:
 * a table that differs is refused, never read (the witness below proves the refusal on a copy whose bytes differ).
 * And the table is named by nothing that sees the code that cuts a name into words: on 4 October 2026 the committed
 * table differed from a fresh count on 122 of 58,593 words, and every measurement tool weighed those words as the
 * screener no longer did. So whenever the seven pinned lists are on disk at the content hash the table was counted on,
 * the table must equal a fresh count over them; when they are not, the test says why and skips.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { TABLE_GELEE, cheminDeLaTableGelee, compterLesListes, ecarts, frequencesDesListes, lireTable, lireTableVerifiee, listesGeleesSurDisque } from "./frequences.ts";
import { fichierDe, lireManifeste, SOURCES } from "./listes.ts";

test("the differences of two counts: none between equal counts, every moved word and the entries otherwise (the witness)", () => {
  const a = { entrees: 3, df: new Map([["trading", 2], ["tsentr", 1]]) };
  assert.deepEqual(ecarts(a, { entrees: 3, df: new Map([["trading", 2], ["tsentr", 1]]) }), []);
  /* the shape of the defect of 4 October: one word cut another way, the same entries */
  assert.deepEqual(ecarts(a, { entrees: 3, df: new Map([["trading", 2], ["tsentar", 1]]) }), ["tsentar", "tsentr"]);
  assert.deepEqual(ecarts(a, { entrees: 4, df: new Map([["trading", 2], ["tsentr", 1]]) }), ["entries: 3 in the table, 4 counted now"]);
  assert.deepEqual(ecarts(a, { entrees: 3, df: new Map([["trading", 3], ["tsentr", 1]]) }), ["trading"]);
});

test("the pinned table is committed, hashes as recorded, and is what the measurements read", () => {
  const chemin = cheminDeLaTableGelee();
  assert.ok(existsSync(chemin), `${chemin.pathname} is missing: the weights every published figure depends on are not in the tree`);
  assert.equal(createHash("sha256").update(readFileSync(chemin)).digest("hex"), TABLE_GELEE.sha256, "the committed table is not the one the figures were measured on");
  const f = frequencesDesListes();
  assert.equal(f.entrees, TABLE_GELEE.entrees);
  assert.equal(f.df.size, TABLE_GELEE.mots);
  assert.deepEqual(TABLE_GELEE.listes.map((l) => l.source), ["OFAC", "OFAC-CONS", "CSL", "UN", "EU", "UK", "EU-VESSELS"], "the seven sources the table was counted on");
  assert.equal(TABLE_GELEE.listes.reduce((n, l) => n + l.entrees, 0), TABLE_GELEE.entrees, "the entries of the seven lists add up to the table's");
});

test("witness: a table whose bytes differ from the pinned hash is refused, and the refusal names both hashes", () => {
  const d = mkdtempSync(join(tmpdir(), "table-"));
  const copie = join(d, "frequences.essai.json");
  writeFileSync(copie, JSON.stringify({ entrees: 2, df: [["trading", 2]] }));
  const sha = createHash("sha256").update(readFileSync(copie)).digest("hex");
  assert.equal(lireTableVerifiee(pathToFileURL(copie), sha).entrees, 2, "the sane path must read, or the refusal below proves nothing");
  assert.throws(() => lireTableVerifiee(pathToFileURL(copie), TABLE_GELEE.sha256), new RegExp(`not the pinned table \\(sha256 ${sha.slice(0, 12)}, pinned ${TABLE_GELEE.sha256.slice(0, 12)}\\)`));
  assert.throws(() => lireTableVerifiee(pathToFileURL(join(d, "absente.json")), TABLE_GELEE.sha256), /is missing from data\//);
});

test("the pinned lists on disk: present at the recorded hash, or named with the reason", () => {
  const m = { version: 1 as const, genereLe: "x", listes: TABLE_GELEE.listes.map((l) => ({ source: l.source, titre: "t", url: "u", format: "f", disponible: true as const, telechargeLe: "d", sha256: l.sha256, octets: 1, entrees: l.entrees })) };
  assert.deepEqual(listesGeleesSurDisque(m, () => true).presentes.length, 7);
  assert.deepEqual(listesGeleesSurDisque(m, (s) => s !== "UK").absentes, ["UK (not on disk)"]);
  const rafraichi = { ...m, listes: m.listes.map((l) => (l.source === "UN" ? { ...l, sha256: "0".repeat(64) } : l)) };
  assert.match(listesGeleesSurDisque(rafraichi, () => true).absentes[0]!, /^UN \(refreshed since the table was counted/);
  assert.equal(listesGeleesSurDisque(null, () => true).absentes.length, 7);
});

test("the pinned table is the count the code makes now from the pinned lists on disk", (t) => {
  const m = lireManifeste();
  if (!m) return t.skip("no listes-manifest.json: no table to check");
  const racine = fileURLToPath(new URL("..", import.meta.url));
  const { presentes, absentes } = listesGeleesSurDisque(m, (source) => existsSync(join(racine, "data", "listes", fichierDe(SOURCES.find((s) => s.source === source)!))));
  if (absentes.length) return t.skip(`pinned lists not on disk as counted (${absentes.join("; ")}): the committed table is the only copy of the weights here`);
  const d = ecarts(lireTable(cheminDeLaTableGelee()), compterLesListes(m, presentes));
  assert.deepEqual(d.length, 0, `the pinned table is not the count the code makes now over the pinned lists (${d.length} differences, first: ${d.slice(0, 5).join(", ")}): the code that cuts names into words moved; pin a recounted table on purpose and measure again`);
});
