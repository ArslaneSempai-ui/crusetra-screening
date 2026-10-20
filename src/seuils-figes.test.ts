/**
 * WITNESS of the frozen thresholds. A clone without the private folder screens with the two thresholds frozen in
 * src/seuils-figes.json (sealed); with the folder the engine chooses them again and refuses if its choice differs.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { empreinteDuReleve } from "./empreinte.ts";
import { raisonDAbsence, JEUX_DU_CRIBLAGE } from "./jeux.ts";

const SANS_JEUX = raisonDAbsence(...JEUX_DU_CRIBLAGE);
const ICI = fileURLToPath(new URL(".", import.meta.url));
const FIGE = join(ICI, "seuils-figes.json");
const ABSENT = "/nonexistent-crusetra-jeux";

type Sortie = { seuils?: { fort: number; possible: number }; lignes?: { nom: string; statut: string; premier: string | null }[]; refus?: string };
function lancer(env: Record<string, string>, fige?: string): Sortie {
  const r = spawnSync(process.execPath, [join(ICI, "temoin-seuils-figes-run.ts"), ...(fige ? [fige] : [])],
    { encoding: "utf8", env: { ...process.env, ...env }, timeout: 300_000 });
  assert.equal(r.status, 0, `the runner failed: ${r.stderr}`);
  return JSON.parse(r.stdout.trim().split("\n").pop()!) as Sortie;
}
const avecDossier = () => ({ CRUSETRA_JEUX: process.env.CRUSETRA_JEUX ?? "" });

const sansDossier = lancer({ CRUSETRA_JEUX: ABSENT });

test("without the private folder the 20 sample rows are screened with the frozen thresholds", () => {
  assert.equal(sansDossier.refus, undefined, String(sansDossier.refus));
  assert.equal(sansDossier.lignes?.length, 20);
  const f = JSON.parse(readFileSync(FIGE, "utf8")) as { seuils: { fort: number; possible: number } };
  assert.deepEqual(sansDossier.seuils, f.seuils);
});

test("with the private folder the verdicts (level and first candidate) are the same as without it", { skip: SANS_JEUX }, () => {
  const avec = lancer(avecDossier());
  assert.equal(avec.refus, undefined, String(avec.refus));
  assert.deepEqual(avec.lignes, sansDossier.lignes);
  assert.deepEqual(avec.seuils, sansDossier.seuils);
});

test("a frozen file whose content was edited is refused (seal mismatch), with or without the folder", () => {
  const dossier = mkdtempSync(join(tmpdir(), "figes-"));
  try {
    const f = JSON.parse(readFileSync(FIGE, "utf8")) as { seuils: { fort: number } };
    f.seuils.fort = 0.5;
    const chemin = join(dossier, "touche.json");
    writeFileSync(chemin, JSON.stringify(f, null, 2));
    const s = lancer({ CRUSETRA_JEUX: ABSENT }, chemin);
    assert.match(s.refus ?? "", /seal[\s\S]*Nothing was screened/);
  } finally { rmSync(dossier, { recursive: true, force: true }); }
});

test("a frozen file that is sealed but differs from what the private sets give is refused, naming the drift", { skip: SANS_JEUX }, () => {
  const dossier = mkdtempSync(join(tmpdir(), "figes-"));
  try {
    const f = JSON.parse(readFileSync(FIGE, "utf8")) as Record<string, unknown> & { seuils: { fort: number } };
    f.seuils.fort = Math.round((f.seuils.fort + 0.05) * 100) / 100;
    f.empreinte = empreinteDuReleve(f);
    const chemin = join(dossier, "derive.json");
    writeFileSync(chemin, JSON.stringify(f, null, 2));
    const s = lancer(avecDossier(), chemin);
    assert.match(s.refus ?? "", /differ[\s\S]*seuils[\s\S]*Nothing was screened/);
  } finally { rmSync(dossier, { recursive: true, force: true }); }
});
