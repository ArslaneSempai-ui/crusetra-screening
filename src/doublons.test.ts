/**
 * LES CLÉS EN DOUBLE : le script lancé tel que le chef le lance, sur des fixtures écrites dans un
 * dossier temporaire ; un doublon sur la même ligne, un sur deux lignes, un dernier sans virgule,
 * et des valeurs faites pour tromper un parseur naïf (une virgule, une accolade, un deux-points
 * dans une chaîne, un gabarit, un commentaire devant la clé).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(new URL("../scripts/doublons.mjs", import.meta.url));
const lancer = (...args: string[]) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });
const dossier = mkdtempSync(join(tmpdir(), "doublons-"));
const fixture = (nom: string, texte: string): string => { const f = join(dossier, nom); writeFileSync(f, texte); return f; };

const MEME_LIGNE = [
  "const T: ReadonlyMap<string, string> = new Map(Object.entries({",
  '  "alpha": "a", "beta": "b, with comma", "alpha": "c", "gamma": "g",',
  "}));",
  "",
].join("\n");

const DEUX_LIGNES = [
  "/* une table */",
  "export const U = new Map(Object.entries({",
  '  /* les métiers */ "水産": "suisan", "工業": "kogyo",',
  '  "商事": "shoji", "水産": "suisan",',
  '  "海運": "kaiun", // une virgule, et un deux-points : dans un commentaire',
  '  "工業": "kogyo",',
  "} as Record<string, string>));",
  'const autre = Object.entries({ x: 1, y: "{ not a key: 2 }", z: `${"a"}`, x: 3 });',
  "",
].join("\n");

test("doublons : un doublon sur la même ligne est nommé avec ses deux lignes, et le script sort en 1", () => {
  const f = fixture("meme-ligne.ts", MEME_LIGNE);
  const r = lancer(f);
  assert.equal(r.status, 1, r.stderr);
  assert.equal(r.stdout, `${f}:2  "alpha" already at line 2\n`);
});

test("doublons : --corriger retire la seconde occurrence et garde la ligne quand d'autres clés y vivent", () => {
  const f = fixture("meme-ligne-corrige.ts", MEME_LIGNE);
  const r = lancer("--corriger", f);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, `${f}:2  removed "alpha": "c" (kept line 2)\n1 duplicate key(s) removed\n`);
  assert.equal(readFileSync(f, "utf8"), MEME_LIGNE.replace(' "alpha": "c",', ""));
  const relance = lancer(f);
  assert.equal(relance.status, 0);
  assert.equal(relance.stdout, "no duplicate key in 1 file(s)\n");
});

test("doublons : sur deux lignes, la ligne vidée part, la ligne partagée reste, le dernier sans virgule part avec la sienne", () => {
  const f = fixture("deux-lignes.ts", DEUX_LIGNES);
  const trouve = lancer(f);
  assert.equal(trouve.status, 1);
  assert.deepEqual(trouve.stdout.trimEnd().split("\n"), [
    `${f}:4  "水産" already at line 3`,
    `${f}:6  "工業" already at line 3`,
    `${f}:8  "x" already at line 8`,
  ]);
  const corrige = lancer("--corriger", f);
  assert.equal(corrige.status, 0, corrige.stderr);
  assert.equal(readFileSync(f, "utf8"), [
    "/* une table */",
    "export const U = new Map(Object.entries({",
    '  /* les métiers */ "水産": "suisan", "工業": "kogyo",',
    '  "商事": "shoji",',
    '  "海運": "kaiun", // une virgule, et un deux-points : dans un commentaire',
    "} as Record<string, string>));",
    'const autre = Object.entries({ x: 1, y: "{ not a key: 2 }", z: `${"a"}` });',
    "",
  ].join("\n"));
  assert.equal(lancer(f).status, 0, "une seconde passe ne trouve plus rien");
});

test("doublons : un fichier sans doublon sort en 0, un drapeau inconnu ou aucun fichier en 2", () => {
  const f = fixture("propre.ts", 'const P = new Map(Object.entries({ "a": 1, "b": 2 }));\nconst Q = new Map(Object.entries({ "a": 3 }));\n');
  const r = lancer(f);
  assert.equal(r.status, 0);
  assert.equal(r.stdout, "no duplicate key in 1 file(s)\n");
  assert.equal(lancer("--fix", f).status, 2);
  assert.equal(lancer().status, 2);
  const ouvert = fixture("ouvert.ts", "const O = new Map(Object.entries({ a: 1,\n");
  const casse = lancer(ouvert);
  assert.equal(casse.status, 2);
  assert.match(casse.stderr, /never closes/);
});
