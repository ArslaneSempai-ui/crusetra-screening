import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/*
 * THE README WITHOUT AN EM DASH (Arslane, 12/09/2026), the same guard as cascade-routing's.
 *
 * The house rule is « never an em dash » : the site's assembler refuses one, the tools'
 * outputs lost theirs, and the READMEs followed. A rule that lives in a memory comes back the
 * day someone types a dash into a block string of src/readme.ts ; a rule that lives here
 * refuses the commit. This case reads the page a buyer reads, not the generator : whatever the
 * source of a dash (README.md prose, readme.ts, a data module a block prints), it lands in
 * the same file. The witness case proves the guard looks : a dash planted in the prose must
 * be seen, or the green above means nothing. Two lists stay empty here on purpose ; the day
 * one grows, it carries the reason and the pass that empties it again.
 */
const README = fileURLToPath(new URL("../README.md", import.meta.url));

/** Blocks whose text is data quoted verbatim (documents the model read), not this repository's prose. */
const BLOCS_DE_DONNEES: string[] = [];

/** Lines still allowed to carry a dash, each with the pass that removes it. */
const PERMIS: string[] = [];

/** The README with the data blocks blanked, line numbers preserved. */
function proseSeule(texte: string): string[] {
  const lignes = texte.split("\n");
  const vus = new Set<string>();
  let dans: string | null = null;
  return lignes.map((l) => {
    const ouvre = /^<!-- figures:(\w+) -->$/.exec(l);
    if (ouvre && BLOCS_DE_DONNEES.includes(ouvre[1]!)) { dans = ouvre[1]!; vus.add(dans); return ""; }
    if (dans && l === `<!-- /figures:${dans} -->`) { dans = null; return ""; }
    return dans ? "" : l;
  }).concat(BLOCS_DE_DONNEES.filter((b) => !vus.has(b)).map((b) => `BLOC ABSENT : ${b}`));
}

function fautifs(lignes: string[]): string[] {
  return lignes
    .map((l, i) => [i + 1, l] as const)
    .filter(([, l]) => l.includes("—") && !PERMIS.some((p) => l.includes(p)))
    .map(([n, l]) => `README.md:${n}  ${l.trim().slice(0, 90)}`);
}

test("le README ne porte aucun cadratin", () => {
  const lignes = proseSeule(readFileSync(README, "utf8"));
  assert.deepEqual(lignes.filter((l) => l.startsWith("BLOC ABSENT")), [],
    "un bloc de données a disparu du README : l'exclusion ne s'applique plus à rien, vérifier readme.ts.");
  for (const p of PERMIS) {
    assert.ok(lignes.some((l) => l.includes(p)),
      `« ${p} » n'est plus dans le README : le permis est périmé, retirer l'entrée de PERMIS.`);
  }
  assert.deepEqual(fautifs(lignes), [],
    "un cadratin est revenu dans le README. Prose : corriger README.md ; bloc engendré : corriger la\n"
    + "  chaîne dans src/readme.ts (ou le fichier PARTAGÉ, dans identite) puis `npm run figures`.");
});

test("témoin : un cadratin glissé dans la prose est vu", () => {
  const avec = readFileSync(README, "utf8") + "\nA planted line — the guard must name it.\n";
  const vus = fautifs(proseSeule(avec));
  assert.equal(vus.length, 1, `le témoin n'est pas vu (${vus.length} fautif(s)) : la garde ne regarde pas.`);
  assert.match(vus[0]!, /A planted line/);
});
