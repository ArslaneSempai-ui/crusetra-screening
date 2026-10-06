/**
 * AUCUN CHEMIN DE POSTE DANS CE QUE LE DÉPÔT LIVRE. Un « /Users/<nom>/… » dans un fichier suivi par git dit
 * le nom d'une machine et casse sur toute autre (deux l'étaient le 28/09/2026 : le dossier des jeux aveugles
 * et celui du dépôt licencié, remplacés par un chemin RELATIF au dépôt, déplaçable par une variable
 * d'environnement). La règle vise ce que git LIVRE : sans git, le test se saute en le disant.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = fileURLToPath(new URL("../", import.meta.url));
/** Le dossier personnel d'un utilisateur, sous macOS, Windows ou Linux. */
export const CHEMIN_DE_POSTE = /(?:\/Users\/|[A-Za-z]:\\Users\\|\/home\/)[A-Za-z0-9._-]+[\\/]/;
const BINAIRE = /\.(?:png|jpe?g|gz|mp4|pdf|woff2?|ico)$/i;

/** Les lignes fautives, `fichier:ligne: texte`, parmi les fichiers suivis. */
export function chemins(racine: string, suivis: readonly string[]): string[] {
  return suivis.filter((f) => !BINAIRE.test(f)).flatMap((f) =>
    readFileSync(join(racine, f), "utf8").split("\n")
      .flatMap((l, i) => (CHEMIN_DE_POSTE.test(l) ? [`${f}:${i + 1}: ${l.trim().slice(0, 100)}`] : [])));
}

test("le détecteur voit un chemin de poste sous les trois systèmes, et laisse passer un chemin relatif : témoin", () => {
  /* Les témoins sont assemblés par morceaux : écrits en clair, ce fichier se refuserait lui-même. */
  for (const l of ["/Users" + "/qui/Documents/x", "C:" + "\\Users\\qui\\x", "/home" + "/qui/x"]) assert.match(l, CHEMIN_DE_POSTE, l);
  for (const l of ["../jeux-aveugles", "${depot:h}/cascade-licencie", "/usr/bin/env", "data/listes/ofac.xml", "~/.crusetra/x"]) {
    assert.doesNotMatch(l, CHEMIN_DE_POSTE, l);
  }
  const d = mkdtempSync(join(tmpdir(), "chemins-"));
  try {
    writeFileSync(join(d, "sain.txt"), "npm run listes -- --fetch\n");
    writeFileSync(join(d, "fautif.txt"), "a\nb\nx=" + "/Users" + "/qui/x\n");
    assert.deepEqual(chemins(d, ["sain.txt"]), []);
    assert.equal(chemins(d, ["sain.txt", "fautif.txt"]).length, 1, "la garde doit savoir refuser, sinon son vert est vide");
    assert.match(chemins(d, ["fautif.txt"])[0]!, /^fautif\.txt:3: /);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test("tout fichier que ce dépôt livre est sans chemin de poste", (t) => {
  let suivis: string[];
  try {
    suivis = execFileSync("git", ["-C", RACINE, "ls-files"], { encoding: "utf8" }).split("\n").filter(Boolean);
  } catch {
    return t.skip("pas un dépôt git ici : la règle vise ce que le dépôt LIVRE, et sans git elle ne sait pas ce qui l'est");
  }
  assert.deepEqual(chemins(RACINE, suivis), []);
});
