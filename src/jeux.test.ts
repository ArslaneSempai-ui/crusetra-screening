/**
 * THE PRIVATE DOOR, ÉPROUVÉE. The witness of the public/private split: no moved set is tracked, no file under src/
 * or verification/ carries more than 20 labelled objects (the allow list names the exceptions), the samples are what
 * their rule says, and a missing private set is a named refusal or a named skip, never a silent pass.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { CHEMIN_PRIVE, estPrive, urlPrive, cheminPrive, raisonDAbsence, JeuPriveAbsent, ECHANTILLONS, echantillon } from "./jeux.ts";
import { tirer, echantillonDe, SOURCES } from "./echantillonner.ts";
import type { JeuDePaires } from "./measure.ts";

const RACINE = fileURLToPath(new URL("..", import.meta.url));
const suivis = (): string[] => execFileSync("git", ["-C", RACINE, "ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);

/** The files that may carry more than 20 labelled objects, each with its reason. S5 of public-prive empties this list. */
export const AUTORISES: Record<string, string> = {
  "src/fixtures/paires-parallele.json": "60 synthetic pairs that test the parallel measure against the sequential one; no training value",
};

function compterVerdicts(x: unknown): number {
  if (Array.isArray(x)) return x.reduce<number>((n, y) => n + compterVerdicts(y), 0);
  if (x && typeof x === "object") {
    const o = x as Record<string, unknown>;
    return ("verdict" in o ? 1 : 0) + Object.values(o).reduce<number>((n, y) => n + compterVerdicts(y), 0);
  }
  return 0;
}

test("no moved private set is tracked by git", () => {
  const encore = suivis().filter(estPrive);
  assert.deepEqual(encore, [], `these labelled sets belong in crusetra-jeux, not here: ${encore.join(", ")}`);
});

test("no tracked json or csv under src/ or verification/ carries more than 20 labelled objects, but the allow list", () => {
  const trop: string[] = [];
  for (const f of suivis().filter((f) => /^(?:src|verification)\/.*\.(?:json|csv)$/.test(f) && !(f in AUTORISES))) {
    const texte = readFileSync(join(RACINE, f), "utf8");
    const n = f.endsWith(".json") ? compterVerdicts(JSON.parse(texte)) : (texte.match(/\bmatch\b|\bdifferent\b/g) ?? []).length;
    if (n > 20) trop.push(`${f} (${n})`);
  }
  assert.deepEqual(trop, [], `a labelled set above 20 rows is not public: ${trop.join(", ")}`);
});

test("the guard sees an oversize file: 21 labelled objects are counted", () => {
  assert.equal(compterVerdicts({ paires: Array.from({ length: 21 }, () => ({ a: "x", b: "y", verdict: "match" })) }), 21);
});

test("the allow list names only tracked files, each with a reason", () => {
  const suivi = new Set(suivis());
  for (const [f, raison] of Object.entries(AUTORISES)) { assert.ok(suivi.has(f), `${f} is allowed but not tracked`); assert.ok(raison.length > 10); }
});

test("CHEMIN_PRIVE matches the 35 moved paths and nothing near them", () => {
  const oui = ["src/paires-etiquetees.json", "src/paires-entites.json", "src/paires-entites-23.json", "src/paires-gleif-apprentissage.json",
    "src/paires-gleif-apprentissage-juges.json", "verification/paires-gleif.json", "verification/paires-gleif-4-juges.json",
    "verification/paires-gleif-juges.json", "verification/paires-entites-verdict.json"];
  for (const p of oui) assert.ok(CHEMIN_PRIVE.test(p), p);
  for (const p of ["src/fixtures/paires-parallele.json", "src/paires-entites.ts", "verification/echantillon-gleif-20.json", "verification/methode-gelee-gleif-2.json",
    "src/echantillons/paires-entites-20.json", "contrib/opensanctions/cascade-name-pairs.csv"]) assert.ok(!CHEMIN_PRIVE.test(p), p);
});

test("a missing private set is a named refusal that says where to look", () => {
  const avant = process.env.CRUSETRA_JEUX;
  process.env.CRUSETRA_JEUX = mkdtempSync(join(tmpdir(), "jeux-vide-"));
  try {
    assert.throws(() => cheminPrive("src/paires-entites.json"), (e: Error) => e instanceof JeuPriveAbsent && /private set absent/.test(e.message) && /CRUSETRA_JEUX/.test(e.message));
    assert.match(String(raisonDAbsence("src/paires-entites.json", "src/paires-entites-2.json")), /^private set absent \(2 of 2/);
    assert.throws(() => urlPrive("src/cribler.ts"), /not one of the private sets/);
  } finally { if (avant === undefined) delete process.env.CRUSETRA_JEUX; else process.env.CRUSETRA_JEUX = avant; }
});

test("the three public samples hold 10 match and 10 different, well formed, with the rule written in the file", () => {
  for (const nom of Object.keys(ECHANTILLONS) as (keyof typeof ECHANTILLONS)[]) {
    const jeu = echantillon(nom) as JeuDePaires & { echantillon: { graine: string; regle: string; sourceSha256: string } };
    const paires = jeu.paires;
    assert.ok(paires.every((p) => typeof p.a === "string" && typeof p.b === "string" && typeof p.nature === "string" && (p.verdict === "match" || p.verdict === "different")), nom);
    assert.equal(paires.length, 20, nom);
    assert.equal(paires.filter((p) => p.verdict === "match").length, 10, nom);
    assert.match(jeu.echantillon.graine, new RegExp(`^${nom}-`));
    assert.match(jeu.echantillon.regle, /SHA-256/);
    assert.match(jeu.echantillon.sourceSha256, /^[0-9a-f]{64}$/);
  }
});

test("the draw is a pure function of the seed: same input, same rows; another seed, other rows", () => {
  const paires = Array.from({ length: 60 }, (_, i) => ({ a: `a${i}`, b: `b${i}`, verdict: (i % 2 ? "match" : "different") as "match" | "different", nature: "t" }));
  assert.deepEqual(tirer(paires, "s1"), tirer(paires, "s1"));
  assert.notDeepEqual(tirer(paires, "s1"), tirer(paires, "s2"));
  assert.equal(tirer(paires, "s1").length, 20);
});

test("the committed samples are the draw of the private sets", { skip: raisonDAbsence(...Object.values(SOURCES).flat()) }, () => {
  for (const nom of Object.keys(ECHANTILLONS) as (keyof typeof ECHANTILLONS)[]) {
    assert.equal(readFileSync(new URL(`../${ECHANTILLONS[nom]}`, import.meta.url), "utf8"), echantillonDe(nom), nom);
  }
});
