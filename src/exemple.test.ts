/**
 * L'EXEMPLE REJOUÉ (scripts/exemple.sh) : ce qu'on peut prouver sans criblage ni commit. La syntaxe
 * zsh passe ; sans ses deux arguments le script refuse avant la première étape (set -u) ; les deux
 * sujets de commit, le co-auteur et le passage par commettre.sh sont dans le texte, et aucun cadratin.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(new URL("../scripts/exemple.sh", import.meta.url));
/* Le script d'exemple est un outil de développeur écrit en zsh : là où zsh manque (Windows), son test
 * est sauté et le dit, au lieu d'échouer sur un shell que le client ne lance jamais. */
const ZSH = spawnSync("zsh", ["--version"], { encoding: "utf8" }).status === 0;

test("exemple.sh : la syntaxe passe, et sans ses arguments il refuse avant toute étape", { skip: ZSH ? false : "zsh is not installed on this machine" }, () => {
  const syntaxe = spawnSync("zsh", ["-n", SCRIPT], { encoding: "utf8" });
  assert.equal(syntaxe.status, 0, syntaxe.stderr);
  const sansRien = spawnSync("zsh", [SCRIPT], { encoding: "utf8" });
  assert.notEqual(sansRien.status, 0);
  assert.match(sansRien.stderr, /round/);
  assert.equal(sansRien.stdout, "", "aucune étape ne doit avoir parlé");
  const sansCommit = spawnSync("zsh", [SCRIPT, "twelve"], { encoding: "utf8" });
  assert.notEqual(sansCommit.status, 0);
  assert.match(sansCommit.stderr, /commit/);
  assert.equal(sansCommit.stdout, "");
});

test("exemple.sh : les deux sujets de commit, le co-auteur, set -u, commettre.sh, et pas un cadratin", () => {
  const texte = readFileSync(SCRIPT, "utf8");
  assert.match(texte, /^set -u$/m);
  assert.ok(texte.includes('"Example screening fixture refreshed on the round-$round matcher"'));
  assert.ok(texte.includes('"Example record refreshed after round $round"'));
  assert.equal((texte.match(/Co-Authored-By: Claude Fable 5\.1 <noreply@anthropic\.com>/g) ?? []).length, 1, "le co-auteur vit dans une variable, écrite à la fin des deux messages");
  assert.equal((texte.match(/print -r -- "\$cosign"/g) ?? []).length, 2);
  assert.ok(texte.includes("zsh scripts/commettre.sh -q -F"));
  assert.ok(texte.includes("--names=exemple/contreparties-exemple.csv"));
  assert.ok(texte.includes('--client="Example Forwarding Inc. (invented)"'));
  assert.ok(texte.includes("git add exemple/contreparties-exemple.screening.json README.md") || texte.includes("git add $releve README.md"));
  assert.ok(!texte.includes("\u2014"));
});
