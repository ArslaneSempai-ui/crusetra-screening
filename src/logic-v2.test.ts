/**
 * LE PALIER FACULTATIF logic-v2, éprouvé SANS nomenklatura : le pont est remplacé par un processus de doublure (node, un script
 * écrit dans un dossier temporaire) qui parle le même protocole. Présent, il note toutes les paires d'un coup et sa version va
 * au relevé ; absent, il est nommé avec sa raison et rien ne plante ; un pont qui rend un compte faux est refusé. Et le vrai
 * pont (scripts/logic_v2.py) n'installe rien et n'ouvre aucune connexion : lu ici, ligne à ligne.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { logicV2, lancerLePont, interpreteNomme, PONT, SEUIL_DOCUMENTE } from "./matchers/logic-v2.ts";
import { PALIERS, PALIERS_FACULTATIFS, type Matcher, type PalierId } from "./matcher.ts";
import { mesurer, type Alerte } from "./your-alerts.ts";
import { rendreRapport } from "./rapport.ts";

const dossier = mkdtempSync(join(tmpdir(), "logic-v2-doublure-"));
const doublure = (nom: string, corps: string): string => { const p = join(dossier, nom); writeFileSync(p, corps); return p; };
/* le protocole du pont : la version d'abord, puis un score par paire ; ici 1 pour deux noms égaux, 0.75 sinon */
const BON = doublure("bon.mjs", `
import { readFileSync } from "node:fs";
const paires = readFileSync(0, "utf8").split("\\n").filter(Boolean).map((l) => JSON.parse(l));
console.log(JSON.stringify({ nomenklatura: "9.9.9-doublure", schema: process.argv[2] }));
for (const p of paires) console.log(p.a === p.b ? "1.0" : "0.75");
`);
const ABSENT = doublure("absent.mjs", `console.error("nomenklatura is not importable by this Python: ModuleNotFoundError: No module named 'nomenklatura'"); process.exit(3);`);
const FAUX = doublure("faux.mjs", `console.log(JSON.stringify({ nomenklatura: "9.9.9-doublure" })); console.log("0.5");`);
const node = process.execPath;

test("logic-v2 : hors contrat, facultatif, et le contrat des sept paliers ne bouge pas", () => {
  assert.deepEqual([...PALIERS_FACULTATIFS], ["logic-v2"]);
  assert.ok(!(PALIERS as readonly string[]).includes("logic-v2"));
  assert.equal(SEUIL_DOCUMENTE, 0.7);
});

test("logic-v2 : sans interpréteur nommé, ou sans nomenklatura, le palier est absent et dit pourquoi", () => {
  const sans = logicV2(undefined);
  assert.equal(sans.present, false);
  assert.match((sans as { raison: string }).raison, /^CRUSETRA_LOGIC_V2_PYTHON is not set/);
  const pasInstalle = logicV2(node, "LegalEntity", ABSENT);
  assert.equal(pasInstalle.present, false);
  assert.match((pasInstalle as { raison: string }).raison, /nomenklatura is not importable/);
  const introuvable = logicV2(join(dossier, "no-such-python"), "LegalEntity", BON);
  assert.equal(introuvable.present, false);
  assert.match((introuvable as { raison: string }).raison, /could not be started/);
});

test("logic-v2 : CRUSETRA_LOGIC_V2_PYTHON d'abord, CASCADE_LOGIC_V2_PYTHON (l'ancien nom) à défaut, et le message dit le nouveau", () => {
  assert.deepEqual(interpreteNomme({}), { python: undefined, variable: "CRUSETRA_LOGIC_V2_PYTHON" });
  assert.deepEqual(interpreteNomme({ CASCADE_LOGIC_V2_PYTHON: node }), { python: node, variable: "CASCADE_LOGIC_V2_PYTHON" });
  assert.deepEqual(interpreteNomme({ CRUSETRA_LOGIC_V2_PYTHON: node }), { python: node, variable: "CRUSETRA_LOGIC_V2_PYTHON" });
  assert.deepEqual(interpreteNomme({ CRUSETRA_LOGIC_V2_PYTHON: node, CASCADE_LOGIC_V2_PYTHON: "/ailleurs" }),
    { python: node, variable: "CRUSETRA_LOGIC_V2_PYTHON" }, "le nouveau nom passe devant");
  /* nommé par l'ancien nom, le palier est présent : l'alias marche de bout en bout */
  const ancien = interpreteNomme({ CASCADE_LOGIC_V2_PYTHON: node });
  assert.equal(logicV2(ancien.python, "LegalEntity", BON, ancien.variable).present, true);
  /* et un échec sous l'ancien nom le dit, avec le nouveau à côté */
  const casse = interpreteNomme({ CASCADE_LOGIC_V2_PYTHON: join(dossier, "no-such-python") });
  const r = logicV2(casse.python, "LegalEntity", BON, casse.variable);
  assert.equal(r.present, false);
  assert.match((r as { raison: string }).raison,
    /the Python named by CASCADE_LOGIC_V2_PYTHON \(the deprecated name of CRUSETRA_LOGIC_V2_PYTHON\) could not be started/);
});

test("logic-v2 : présent, il note les paires d'un coup, refuse une paire non préparée, et un compte faux", () => {
  const l = logicV2(node, "Person", BON);
  assert.ok(l.present);
  if (!l.present) return;
  assert.equal(l.version(), "9.9.9-doublure");
  assert.equal(l.schema, "Person");
  assert.equal(l.matcher.id, "logic-v2");
  assert.throws(() => l.matcher.score("a", "b"), /preparerPaires/);
  l.matcher.preparerPaires!([{ a: "Zeltrix Ltd", b: "Zeltrix Ltd" }, { a: "Zeltrix Ltd", b: "Quarvex Ltd" }]);
  assert.equal(l.matcher.score("Zeltrix Ltd", "Zeltrix Ltd"), 1);
  assert.equal(l.matcher.score("Zeltrix Ltd", "Quarvex Ltd"), 0.75);
  const r = lancerLePont(node, "LegalEntity", [{ a: "x", b: "y" }, { a: "x", b: "z" }], FAUX);
  assert.match((r as { raison: string }).raison, /1 score\(s\) for 2 pair\(s\)/);
});

test("logic-v2 : dans la mesure d'un historique, un palier de plus, sa version au relevé, sa limite au rapport", () => {
  const l = logicV2(node, "LegalEntity", BON);
  assert.ok(l.present);
  if (!l.present) return;
  const exact: Matcher = { id: "exact", description: "exact", rang: 1, score: (a, b) => (a === b ? 1 : 0) };
  const alertes: Alerte[] = [
    { id: "A1", nomFiltre: "Zeltrix Ltd", entreeListe: "Zeltrix Ltd", source: "OFAC", disposition: "match" },
    { id: "A2", nomFiltre: "Zeltrix Ltd", entreeListe: "Quarvex Ltd", source: "OFAC", disposition: "false_positive" },
  ];
  const registre = new Map<PalierId, Matcher>([["exact", exact], [l.matcher.id, l.matcher]]);
  const m = mesurer(alertes, registre, "alertes.csv", "0".repeat(64), null, "2026-10-04T00:00:00.000Z",
    { "logic-v2": { present: true, nomenklatura: l.version()!, schema: l.schema } });
  assert.equal(m.verdicts["A1"]!.scores["logic-v2"], 1);
  assert.equal(m.verdicts["A2"]!.scores["logic-v2"], 0.75);
  assert.ok(m.paliers["logic-v2"], "le palier a sa table");
  assert.ok(!m.absents.includes("logic-v2" as PalierId), "un palier facultatif n'est jamais un absent du contrat");
  const rapport = rendreRapport(m);
  assert.match(rapport, /logic-v2 is nomenklatura 9\.9\.9-doublure/);
  assert.match(rapport, /the two names only/);
  assert.ok(!rapport.includes("Zeltrix"), "aucun nom dans le rapport");
  /* absent : dit avec sa raison, et la mesure tient sans lui */
  const sans = mesurer(alertes, new Map<PalierId, Matcher>([["exact", exact]]), "alertes.csv", "0".repeat(64), null, "2026-10-04T00:00:00.000Z",
    { "logic-v2": { present: false, raison: "CRUSETRA_LOGIC_V2_PYTHON is not set" } });
  assert.equal(sans.paliers["logic-v2"], undefined);
  assert.match(rendreRapport(sans), /Optional matcher logic-v2 \(nomenklatura\) absent, said rather than guessed: CRUSETRA_LOGIC_V2_PYTHON is not set/);
  /* et un relevé d'avant ce palier, sans le champ, se rend comme avant */
  assert.ok(!rendreRapport(mesurer(alertes, new Map<PalierId, Matcher>([["exact", exact]]), "alertes.csv", "0".repeat(64), null)).includes("logic-v2"));
});

test("logic-v2 : le vrai pont n'installe rien et n'ouvre aucune connexion", () => {
  const pont = readFileSync(PONT, "utf8");
  const code = pont.split("\n").filter((l) => !l.trim().startsWith("#")).join("\n").replace(/"""[\s\S]*?"""/, "");
  for (const interdit of [/\bimport\s+(?:socket|urllib|http|requests|subprocess|ssl|ftplib)\b/, /\bpip\b/, /\bos\.system\b/, /\bopen\s*\(/, /urlopen|urlretrieve/]) {
    assert.ok(!interdit.test(code), `scripts/logic_v2.py : ${interdit}`);
  }
  assert.match(pont, /return 3/, "nomenklatura absent : code 3, une ligne, aucun score");
});
