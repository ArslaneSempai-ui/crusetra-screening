/*
 * THE EU FILE IS JUDGED WHEN IT ARRIVES, AND A STALE ONE SAYS SO IN THE MANIFEST.
 *
 * The EU feed can freeze: on 12 October 2026 the file on disk was generated that day while the newest publicationDate
 * in it was 23 July. The day we downloaded it says nothing about that, and `listes --fetch` wrote a clean row. The rule
 * (scripts/fraicheur-ue.mjs, its logic in src/fraicheur-ue.ts): the feed lags when the newest publicationDate is more
 * than SEUIL_RETARD_UE_JOURS days behind the generationDate; exactly the limit is not stale. Every date below is built
 * from that constant, so the limit is typed in one place.
 *
 * The cases that run the real command (`--fetch --only=EU`) do it in a throwaway copy of the modules it needs, with a
 * FAKE token and a `fetch` that never touches the network (the harness of listes-jeton.test.ts), then read what the run
 * left behind. The stale mark is the manifest's existing `avertissement` field: the row stays available, the file is
 * still written and its hash still recorded, and `--fetch` prints the line under the row. No new field.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { fraicheurUE, SEUIL_RETARD_UE_JOURS, TOLERANCE_APRES_GENERATION_UE_JOURS } from "./fraicheur-ue.ts";

const FAUX_JETON = "FAKE-TOKEN-0000";
const ICI = fileURLToPath(new URL(".", import.meta.url));
const SCRIPT = join(ICI, "..", "scripts", "fraicheur-ue.mjs");
const URL_UE_ECRITE = "https://webgate.ec.europa.eu/fsd/fsf/public/files/xmlFullSanctionsList_1_1/content?token=[username]";

/** The day the file says it was generated, and the day that many days earlier. */
const GENERATION = "2026-10-12";
const JOUR_MS = 24 * 60 * 60 * 1000;
const avant = (jours: number): string => new Date(Date.parse(GENERATION) - jours * JOUR_MS).toISOString().slice(0, 10);

/** An EU file with the shape of the real one (root `generationDate`, a regulation `publicationDate`), either date left out on request. */
const xmlUe = (generation: string | null, publication: string | null): string => [
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`,
  `<export xmlns="http://eu.europa.ec/fpi/fsd/export"${generation === null ? "" : ` generationDate="${generation}T10:00:00"`}>`,
  `  <sanctionEntity designationDetails="" logicalId="13">`,
  `    <regulation regulationType="regulation" organisationType="commission"${publication === null ? "" : ` publicationDate="${publication}"`} entryIntoForceDate="2011-03-03" numberTitle="270/2011 (OJ L58)" programme="EGY" logicalId="401"/>`,
  `    <subjectType code="person" classificationCode="P"/>`,
  `    <nameAlias firstName="Mohamed" middleName="" lastName="Kalos" wholeName="Mohamed Kalos Tutelov Turopem" function="" title="" nameLanguage="EN" strong="true" regulationLanguage="en" logicalId="19"/>`,
  `  </sanctionEntity>`,
  `</export>`,
  ``,
].join("\n");

/** The same file with more regulations in it, each carrying one publicationDate value exactly as given. */
const avecPublications = (xml: string, ...valeurs: string[]): string =>
  xml.replace("</export>", valeurs.map((v) => `<regulation publicationDate="${v}"/>\n`).join("") + "</export>");

/* ───────────────────────────── the rule, on its own ───────────────────────────── */

test("the rule: lagging by less than the limit and by exactly the limit is fresh, one day more is stale", () => {
  const limite = SEUIL_RETARD_UE_JOURS;
  for (const [jours, perime] of [[limite - 1, false], [limite, false], [limite + 1, true]] as const) {
    const r = fraicheurUE(xmlUe(GENERATION, avant(jours)));
    assert.equal(r.perime, perime, `${jours} days`);
    assert.equal(r.retard, jours);
    assert.equal(r.gen, GENERATION);
    assert.equal(r.max, avant(jours));
  }
});

test("the rule takes the NEWEST publicationDate of the file, not the first", () => {
  const xml = xmlUe(GENERATION, avant(SEUIL_RETARD_UE_JOURS + 30)).replace("</export>",
    `<regulation publicationDate="${avant(1)}"/>\n<regulation publicationDate="${avant(SEUIL_RETARD_UE_JOURS + 60)}"/>\n</export>`);
  const r = fraicheurUE(xml);
  assert.equal(r.max, avant(1));
  assert.equal(r.perime, false);
});

test("a publication date later than the generation date by more than the tolerance is stale with the dates named, not a negative lag that hides a frozen feed", () => {
  /* the probe of the review: a frozen feed (newest real publication 23 July) and one stray year */
  for (const stray of ["2062-07-23", "2099-01-01", "9999-12-31"]) {
    const r = fraicheurUE(avecPublications(xmlUe("2026-10-12", "2026-07-23"), stray));
    assert.equal(r.perime, true, stray);
    assert.equal(r.retard, null, `${stray}: no lag is claimed`);
    assert.equal(r.max, stray);
    assert.match(r.raison ?? "", /publication date later than generation date/, stray);
    assert.ok(r.raison!.includes(stray) && r.raison!.includes("2026-10-12"), `${stray}: the reason names both dates: ${r.raison}`);
  }
});

test("a publication exactly the tolerance after the generation date stays fresh, one day more is stale", () => {
  const dedans = fraicheurUE(xmlUe(GENERATION, avant(-TOLERANCE_APRES_GENERATION_UE_JOURS)));
  assert.equal(dedans.perime, false);
  assert.equal(dedans.retard, -TOLERANCE_APRES_GENERATION_UE_JOURS);
  const dehors = fraicheurUE(xmlUe(GENERATION, avant(-TOLERANCE_APRES_GENERATION_UE_JOURS - 1)));
  assert.equal(dehors.perime, true);
  assert.match(dehors.raison ?? "", /publication date later than generation date/);
});

test("one impossible publicationDate that sorts highest neither hides a fresh one nor turns the verdict into 'unreadable': it is reported", () => {
  const r = fraicheurUE(avecPublications(xmlUe(GENERATION, avant(SEUIL_RETARD_UE_JOURS + 30)), avant(1), "2026-13-45"));
  assert.equal(r.max, avant(1), "the newest VALID date is taken");
  assert.equal(r.perime, false);
  assert.equal(r.retard, 1);
  assert.ok((r.raison ?? "").includes("2026-13-45"), `the invalid value is named: ${r.raison}`);
  assert.ok(!/unreadable|missing/.test(r.raison ?? ""), `the reason does not say the dates are unreadable or missing: ${r.raison}`);
});

test("invalid publicationDates are named next to a stale verdict, and a file with no valid one is stale", () => {
  const vieux = fraicheurUE(avecPublications(xmlUe(GENERATION, avant(SEUIL_RETARD_UE_JOURS + 30)), "2026-13-45", "2026-02-30"));
  assert.equal(vieux.perime, true);
  assert.equal(vieux.max, avant(SEUIL_RETARD_UE_JOURS + 30), "the newest valid date, not the highest string");
  assert.equal(vieux.retard, SEUIL_RETARD_UE_JOURS + 30);
  assert.ok(vieux.raison!.includes("2026-13-45"), `the invalid value is named: ${vieux.raison}`);
  const aucune = fraicheurUE(xmlUe(GENERATION, "2026-13-45"));
  assert.equal(aucune.perime, true);
  assert.equal(aucune.max, null);
  assert.equal(aucune.retard, null);
  assert.ok(aucune.raison!.includes("2026-13-45"), `the invalid value is named: ${aucune.raison}`);
});

test("a publicationDate in datetime form is read by its date part, as the generationDate is; a malformed one is invalid, not missing", () => {
  for (const forme of ["2026-10-10T08:15:00", "2026-10-10T08:15:00.000+02:00", "2026-10-10T06:15:00Z"]) {
    const r = fraicheurUE(xmlUe(GENERATION, forme));
    assert.equal(r.max, "2026-10-10", forme);
    assert.equal(r.perime, false, forme);
    assert.equal(r.retard, 2, forme);
  }
  const r = fraicheurUE(xmlUe(GENERATION, "2026-10-10Tnoon"));
  assert.equal(r.perime, true);
  assert.ok(r.raison!.includes("2026-10-10Tnoon"), `the malformed value is named: ${r.raison}`);
});

test("the rule fails closed: a missing date, an impossible day and an out-of-range month are stale with a reason, never fresh", () => {
  const cas: [string, string][] = [
    ["no dates at all", xmlUe(null, null)],
    ["no generationDate", xmlUe(null, avant(1))],
    ["no publicationDate", xmlUe(GENERATION, null)],
    /* V8 reads 30 February as 2 March: against a generationDate of 5 March that is 3 days, and "fresh". It is not a day. */
    ["an impossible calendar day", xmlUe("2026-03-05", "2026-02-30")],
    ["a month that does not exist", xmlUe(GENERATION, "2026-13-45")],
  ];
  for (const [nom, xml] of cas) {
    const r = fraicheurUE(xml);
    assert.equal(r.perime, true, nom);
    assert.equal(r.retard, null, nom);
    assert.ok(typeof r.raison === "string" && r.raison.length > 0, `${nom}: the reason is given`);
  }
});

test("the rule on the real shape of 12 October 2026: generated that day, newest publication 23 July", () => {
  const r = fraicheurUE(xmlUe("2026-10-12", "2026-07-23"));
  assert.deepEqual(r, { perime: true, gen: "2026-10-12", max: "2026-07-23", retard: 81 });
});

/* ───────────────────── the script keeps its command line and its exit codes ───────────────────── */

test("scripts/fraicheur-ue.mjs: exit 1 on a stale file, 0 on a fresh one, 1 on a file with no dates, and --selftest passes", () => {
  const dossier = realpathSync(mkdtempSync(join(tmpdir(), "fraicheur-script-")));
  try {
    const lancer = (xml: string) => {
      const f = join(dossier, "ue.xml");
      writeFileSync(f, xml);
      return spawnSync(process.execPath, [SCRIPT, f], { encoding: "utf8", timeout: 60_000 });
    };
    const vieux = lancer(xmlUe(GENERATION, avant(SEUIL_RETARD_UE_JOURS + 1)));
    assert.equal(vieux.status, 1, vieux.stderr);
    assert.equal(JSON.parse(vieux.stdout).perime, true);
    const frais = lancer(xmlUe(GENERATION, avant(SEUIL_RETARD_UE_JOURS)));
    assert.equal(frais.status, 0, frais.stderr);
    assert.equal(JSON.parse(frais.stdout).perime, false);
    const sans = lancer(xmlUe(null, null));
    assert.equal(sans.status, 1, sans.stderr);
    const temoin = spawnSync(process.execPath, [SCRIPT, "--selftest"], { encoding: "utf8", timeout: 60_000 });
    assert.equal(temoin.status, 0, temoin.stderr);
    assert.match(temoin.stdout, /witness ok/);
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
});

/* ───────────────────────── the wiring: `listes --fetch` marks the row ───────────────────────── */

/** listes.ts and every module it imports, found by reading the imports (the harness of listes-jeton.test.ts). */
function fermeture(depart: string): string[] {
  const vus = new Set<string>();
  const pile = [depart];
  while (pile.length > 0) {
    const f = pile.pop()!;
    if (vus.has(f)) continue;
    vus.add(f);
    for (const m of readFileSync(join(ICI, f), "utf8").matchAll(/from "\.\/([^"]+)"/g)) pile.push(m[1]!);
  }
  return [...vus];
}

const fichiersSous = (dossier: string): string[] =>
  readdirSync(dossier, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? fichiersSous(join(dossier, e.name)) : [join(dossier, e.name)]);

/** The `fetch` the child process gets: no network. It records whether the request carried the token, never the token. */
const FAUSSE_RECUPERATION = `
import { readFileSync, writeFileSync } from "node:fs";
globalThis.fetch = async (url) => {
  writeFileSync(process.env.STUB_SEEN, String(url).includes(process.env.STUB_TOKEN) ? "carried" : "did not carry");
  return new Response(readFileSync(process.env.STUB_BODY));
};
`;

type Ligne = { source: string; disponible: boolean; url: string; telechargeLe?: string; sha256?: string; entrees?: number; avertissement?: string };
type Lancement = { args?: string[]; manifesteAvant?: unknown; corps: string };

/** One run of the real command in a throwaway root. The fake token is in the environment; the body is what the "server" answers. */
function lancer({ args = ["--fetch", "--only=EU"], manifesteAvant, corps }: Lancement): { racine: string; sortie: string; erreurs: string; statut: number | null; lignes: Ligne[] } {
  /* realpath: on macOS tmpdir() is a symlink, and `isMain` compares the resolved module URL with argv[1]. */
  const racine = realpathSync(mkdtempSync(join(tmpdir(), "fraicheur-ue-")));
  mkdirSync(join(racine, "src"));
  for (const f of fermeture("listes.ts")) cpSync(join(ICI, f), join(racine, "src", f));
  cpSync(join(ICI, "..", "package.json"), join(racine, "package.json"));
  writeFileSync(join(racine, "fausse-recuperation.mjs"), FAUSSE_RECUPERATION);
  writeFileSync(join(racine, "corps.xml"), corps);
  if (manifesteAvant !== undefined) writeFileSync(join(racine, "listes-manifest.json"), JSON.stringify(manifesteAvant, null, 2) + "\n");
  mkdirSync(join(racine, "home"));
  const env: Record<string, string | undefined> = { ...process.env };
  for (const n of ["CASCADE_EU_TOKEN", "CRUSETRA_OFFLINE", "CASCADE_OFFLINE"]) delete env[n];
  Object.assign(env, {
    CRUSETRA_EU_TOKEN: FAUX_JETON, HOME: join(racine, "home"), USERPROFILE: join(racine, "home"),
    STUB_TOKEN: FAUX_JETON, STUB_BODY: join(racine, "corps.xml"), STUB_SEEN: join(racine, "seen.txt"),
  });
  const r = spawnSync(process.execPath,
    ["--import", pathToFileURL(join(racine, "fausse-recuperation.mjs")).href, join(racine, "src", "listes.ts"), ...args],
    { cwd: racine, encoding: "utf8", env, timeout: 60_000 });
  const chemin = join(racine, "listes-manifest.json");
  const lignes = existsSync(chemin) ? (JSON.parse(readFileSync(chemin, "utf8")) as { listes: Ligne[] }).listes : [];
  return { racine, sortie: r.stdout, erreurs: r.stderr, statut: r.status, lignes };
}

/** Every place the fake token is after a run: a file under the throwaway root, standard output, standard error. */
function fuitesDe(racine: string, sortie: string, erreurs: string): string[] {
  const fuites: string[] = [];
  for (const f of fichiersSous(racine)) if (readFileSync(f).includes(FAUX_JETON)) fuites.push(`file ${relative(racine, f)}`);
  if (sortie.includes(FAUX_JETON)) fuites.push("standard output");
  if (erreurs.includes(FAUX_JETON)) fuites.push("standard error");
  return fuites;
}

/** The checks every run owes: the download happened, the request still carried the token, the token is written nowhere. */
function verifierLeTrajet(r: ReturnType<typeof lancer>): Ligne {
  assert.equal(r.statut, 0, `exit code ${r.statut}:\n${r.erreurs.slice(0, 600)}`);
  assert.equal(readFileSync(join(r.racine, "seen.txt"), "utf8"), "carried", "the request must still carry the token: the download needs it");
  assert.deepEqual(fuitesDe(r.racine, r.sortie, r.erreurs), [], "the token reached these places");
  const ue = r.lignes.find((l) => l.source === "EU")!;
  assert.equal(ue.url, URL_UE_ECRITE, "the address keeps its placeholder");
  assert.equal(ue.disponible, true, "a stale file is still a downloaded file: the row stays available");
  assert.ok(existsSync(join(r.racine, "data", "listes", "eu.xml")), "the file is still written");
  return ue;
}

/** A fetch whose newest publicationDate lags the generationDate by `jours` days; `perime` says whether the row must come out stale. */
function lancerEtVerifierLeRetard(jours: number, perime: boolean): void {
  const r = lancer({ corps: xmlUe(GENERATION, avant(jours)) });
  try {
    const ue = verifierLeTrajet(r);
    if (perime) {
      assert.match(ue.avertissement ?? "", /^stale: /, "the row carries the stale warning");
      assert.ok(ue.avertissement!.includes(avant(jours)) && ue.avertissement!.includes(GENERATION), "the warning names the two dates");
      assert.ok(ue.avertissement!.includes(`${SEUIL_RETARD_UE_JOURS} days`), "the warning names the limit");
      assert.ok(r.sortie.includes(`⚠ ${ue.avertissement}`), `the fetch prints the line:\n${r.sortie}`);
    } else {
      assert.equal(ue.avertissement, undefined, "a file within the limit leaves the row as it was: no warning");
      assert.ok(!/stale/i.test(r.sortie), `nothing is said about staleness:\n${r.sortie}`);
    }
  } finally {
    rmSync(r.racine, { recursive: true, force: true });
  }
}

/* Explicit cases, not a loop: the README counts `test(` in the sources and must equal what runs. */
test("EU fetch, newest publication one day past the limit: the row is marked stale with both dates, the line is printed, the fake token is written nowhere", () => {
  lancerEtVerifierLeRetard(SEUIL_RETARD_UE_JOURS + 1, true);
});

test("EU fetch, newest publication exactly at the limit: the row stays fresh, nothing is printed about it", () => {
  lancerEtVerifierLeRetard(SEUIL_RETARD_UE_JOURS, false);
});

test("EU fetch, newest publication one day inside the limit: the row stays fresh", () => {
  lancerEtVerifierLeRetard(SEUIL_RETARD_UE_JOURS - 1, false);
});

test("EU fetch, a file with no dates: stale with the reason (fail closed), never fresh", () => {
  const r = lancer({ corps: xmlUe(null, null) });
  try {
    const ue = verifierLeTrajet(r);
    assert.match(ue.avertissement ?? "", /^stale: .*missing/, "the row is stale and says what is missing");
    assert.ok(r.sortie.includes(`⚠ ${ue.avertissement}`), `the fetch prints the line:\n${r.sortie}`);
  } finally {
    rmSync(r.racine, { recursive: true, force: true });
  }
});

test("EU fetch, a frozen feed with one stray publicationDate in the year 2062: marked stale, the dates named, not masked by a negative lag", () => {
  const r = lancer({ corps: avecPublications(xmlUe(GENERATION, "2026-07-23"), "2062-07-23") });
  try {
    const ue = verifierLeTrajet(r);
    assert.match(ue.avertissement ?? "", /^stale: .*publication date later than generation date/, "the row is stale");
    assert.ok(ue.avertissement!.includes("2062-07-23") && ue.avertissement!.includes(GENERATION), `the warning names the two dates: ${ue.avertissement}`);
    assert.ok(r.sortie.includes(`⚠ ${ue.avertissement}`), `the fetch prints the line:\n${r.sortie}`);
  } finally {
    rmSync(r.racine, { recursive: true, force: true });
  }
});

test("EU fetch, one impossible publicationDate next to a fresh one: the row stays fresh", () => {
  const r = lancer({ corps: avecPublications(xmlUe(GENERATION, avant(SEUIL_RETARD_UE_JOURS + 30)), avant(1), "2026-13-45") });
  try {
    const ue = verifierLeTrajet(r);
    assert.equal(ue.avertissement, undefined, "a valid publication inside the limit proves the feed is live: no warning");
    assert.ok(!/stale/i.test(r.sortie), `nothing is said about staleness:\n${r.sortie}`);
  } finally {
    rmSync(r.racine, { recursive: true, force: true });
  }
});

/** The EU row of a manifest written by an earlier fetch. */
const LIGNE_UE_AVANT: Ligne = {
  source: "EU", disponible: true, url: URL_UE_ECRITE, telechargeLe: "2026-09-01T00:00:00.000Z", sha256: "0".repeat(64), entrees: 1,
  ...{ titre: "EU consolidated financial sanctions list (FSF, XML v1.1)", format: "eu-fsf-xml-1.1", octets: 1 },
};
const manifesteAvec = (ue: Ligne): unknown => ({ version: 1, genereLe: "2026-09-01T00:00:00.000Z", listes: [ue] });

test("a stale file on arrival does not leave a previously fresh row fresh: the new download date does not clear the mark", () => {
  const r = lancer({ corps: xmlUe(GENERATION, avant(SEUIL_RETARD_UE_JOURS + 1)), manifesteAvant: manifesteAvec(LIGNE_UE_AVANT) });
  try {
    const ue = verifierLeTrajet(r);
    assert.ok(ue.telechargeLe! > LIGNE_UE_AVANT.telechargeLe!, "the row was rewritten by this download");
    assert.notEqual(ue.sha256, LIGNE_UE_AVANT.sha256);
    assert.match(ue.avertissement ?? "", /^stale: /, "a row fresh before is stale now, though it was downloaded today");
  } finally {
    rmSync(r.racine, { recursive: true, force: true });
  }
});

test("a row marked stale and kept as recorded by --only=UN comes out of the next manifest still marked", () => {
  const marquee: Ligne = { ...LIGNE_UE_AVANT, avertissement: `stale: newest publicationDate ${avant(SEUIL_RETARD_UE_JOURS + 1)}, generationDate ${GENERATION}` };
  const r = lancer({ args: ["--fetch", "--only=UN"], corps: readFileSync(join(ICI, "fixtures", "onu.xml"), "utf8"), manifesteAvant: manifesteAvec(marquee) });
  try {
    assert.equal(r.statut, 0, r.erreurs.slice(0, 400));
    assert.match(r.sortie, /EU\s+kept as recorded/);
    assert.deepEqual(r.lignes.find((l) => l.source === "EU"), marquee, "the kept row is the one recorded, mark included");
    assert.deepEqual(fuitesDe(r.racine, r.sortie, r.erreurs), [], "the token reached these places");
  } finally {
    rmSync(r.racine, { recursive: true, force: true });
  }
});
