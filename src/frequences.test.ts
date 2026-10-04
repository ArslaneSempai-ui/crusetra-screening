/**
 * THE COMMITTED FREQUENCY TABLE IS THE COUNT THE CODE MAKES NOW. The table is named by the manifest only, so a rule that
 * changes how a name is cut into words leaves it stale without a sign: on 4 October 2026 the committed table differed from
 * a fresh count on 122 of 58,593 words, and every measurement tool weighed those words as the screener no longer did (see
 * src/frequences.ts). This guard counts the lists again whenever they are on disk and refuses a table that differs.
 * On a fresh clone, without the lists, it says so and skips: the table is then the only copy of the weights.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { cheminDeLaTable, compterLesListes, ecarts, lireTable } from "./frequences.ts";
import { fichierDe, lireManifeste, SOURCES } from "./listes.ts";

test("the differences of two counts: none between equal counts, every moved word and the entries otherwise (the witness)", () => {
  const a = { entrees: 3, df: new Map([["trading", 2], ["tsentr", 1]]) };
  assert.deepEqual(ecarts(a, { entrees: 3, df: new Map([["trading", 2], ["tsentr", 1]]) }), []);
  /* the shape of the defect of 4 October: one word cut another way, the same entries */
  assert.deepEqual(ecarts(a, { entrees: 3, df: new Map([["trading", 2], ["tsentar", 1]]) }), ["tsentar", "tsentr"]);
  assert.deepEqual(ecarts(a, { entrees: 4, df: new Map([["trading", 2], ["tsentr", 1]]) }), ["entries: 3 in the table, 4 counted now"]);
  assert.deepEqual(ecarts(a, { entrees: 3, df: new Map([["trading", 3], ["tsentr", 1]]) }), ["trading"]);
});

test("the committed table is the count the code makes now from the lists on disk", (t) => {
  const m = lireManifeste();
  if (!m) return t.skip("no listes-manifest.json: no table to check");
  const racine = fileURLToPath(new URL("..", import.meta.url));
  const absentes = SOURCES.filter((s) => m.listes.some((l) => l.source === s.source && l.disponible))
    .filter((s) => !existsSync(join(racine, "data", "listes", fichierDe(s)))).map((s) => s.source);
  if (absentes.length) return t.skip(`lists not on disk (${absentes.join(", ")}): the committed table is the only copy of the weights here`);
  const chemin = cheminDeLaTable();
  assert.ok(existsSync(chemin), `${chemin.pathname} is missing while the lists are on disk: node src/frequences.ts --refaire`);
  const d = ecarts(lireTable(chemin), compterLesListes(m));
  assert.deepEqual(d.length, 0, `the committed table is not the count the code makes now (${d.length} differences, first: ${d.slice(0, 5).join(", ")}): node src/frequences.ts --refaire, then commit the table`);
});
