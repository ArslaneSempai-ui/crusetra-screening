/**
 * `npm run sceller -- <record> --check` VÉRIFIE ET N'ÉCRIT JAMAIS (parcours client du 5 octobre 2026).
 *
 * Prouvé ce soir-là sur une copie : sans --check, passer un relevé édité au sceller disait « The content had changed
 * since the last seal. You have just declared that the current content is the one that stands. » et réécrivait le
 * scellé, code 0. La page Screening et nos réponses promettent pourtant « a seal anyone can check ». Ce cas est rouge
 * sur a4c53bf (le drapeau y est refusé comme inconnu) et prouve les trois issues de --check, puis le contrôle positif :
 * sans le drapeau, le même fichier édité EST rescellé, le geste que le drapeau sépare.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { empreinteDuReleve } from "./empreinte.ts";

const CMD = fileURLToPath(new URL("./sceller.ts", import.meta.url));
const lancer = (args: string[]) => {
  const r = spawnSync(process.execPath, [CMD, ...args], { encoding: "utf8" });
  return { code: r.status, texte: (r.stdout ?? "") + (r.stderr ?? "") };
};

test("sceller --check : 0 quand le scellé tient, 1 et rien d'écrit quand il ne tient plus ou manque ; sans --check le fichier édité est rescellé", () => {
  const d = mkdtempSync(join(tmpdir(), "sceller-check-"));
  try {
    const bon: Record<string, unknown> = { genre: "temoin", totaux: { lignes: 3, forts: 1 } };
    bon.empreinte = empreinteDuReleve(bon);
    const fBon = join(d, "bon.json");
    writeFileSync(fBon, JSON.stringify(bon, null, 2));
    const tient = lancer([fBon, "--check"]);
    assert.equal(tient.code, 0, tient.texte);
    assert.match(tient.texte, /already sealed, and the seal matches/);
    assert.equal(readFileSync(fBon, "utf8"), JSON.stringify(bon, null, 2), "--check ne réécrit pas un fichier intact");

    /* édité après scellement : le scellé porté ne correspond plus au contenu */
    const edite = { ...bon, totaux: { lignes: 4, forts: 1 } };
    const fEdite = join(d, "edite.json");
    const texteEdite = JSON.stringify(edite, null, 2);
    writeFileSync(fEdite, texteEdite);
    const casse = lancer([fEdite, "--check"]);
    assert.equal(casse.code, 1, casse.texte);
    assert.match(casse.texte, /SEAL DOES NOT MATCH: the file carries [0-9a-f]{16}, its content hashes to [0-9a-f]{16}/);
    assert.match(casse.texte, /edited after it was sealed/);
    assert.match(casse.texte, /Nothing was written \(--check\)/);
    assert.equal(readFileSync(fEdite, "utf8"), texteEdite, "--check ne doit pas réécrire le scellé d'un fichier édité");

    /* jamais scellé */
    const fNu = join(d, "nu.json");
    const texteNu = JSON.stringify({ genre: "temoin" });
    writeFileSync(fNu, texteNu);
    const nu = lancer([fNu, "--check"]);
    assert.equal(nu.code, 1, nu.texte);
    assert.match(nu.texte, /NOT SEALED: the file carries no seal/);
    assert.equal(readFileSync(fNu, "utf8"), texteNu, "--check ne pose pas de scellé");

    /* le contrôle positif : sans --check, le même fichier édité est rescellé, et le dit */
    const resceller = lancer([fEdite]);
    assert.equal(resceller.code, 0, resceller.texte);
    assert.match(resceller.texte, /seal REPLACED/);
    assert.notEqual(readFileSync(fEdite, "utf8"), texteEdite, "sans --check le scellé est redéclaré");
    assert.equal(lancer([fEdite, "--check"]).code, 0, "et le fichier rescellé tient de nouveau sous --check");

    /* le drapeau inconnu reste refusé : --check n'a pas ouvert la porte à tous */
    const inconnu = lancer([fBon, "--verifie"]);
    assert.equal(inconnu.code, 2, inconnu.texte);
    assert.match(inconnu.texte, /Unknown option/);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});
