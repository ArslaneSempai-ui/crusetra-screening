/*
 * THE EU FILE MUST SAY WHICH ACTS IT CARRIES, AND THE CHECK MUST FAIL LOUD WHEN AN EXPECTED ACT IS NOT AMONG THEM.
 *
 * Why: the EU file we hold can stop before a regulation (the act of 28 September 2026 that adds ten persons was absent
 * from the file generated on 12 October, see eu-2193/PLAN.md), and nothing in the screening said so: an absent act looks
 * exactly like a quiet week. `src/actes-ue.ts` lists the acts the file names (`numberTitle`) and answers "which expected
 * act number is in none of them", on the act NUMBER as a token, never as a substring (2026/219 is not 2026/2193, and
 * 12026/2193 is not either).
 *
 * Every feed below is built by hand in the shape of the real file (a root with a generationDate, one `regulation` per
 * entity, `regulationSummary` children under the name aliases); none copies the real file, and the persons are invented.
 * The cases that run the command write their feed to a throwaway directory first. The command is run with a node child
 * process and reads one file: no network, no home directory.
 *
 * What the command promises, and what the cases below hold it to: exit 1 when an expected act is missing, exit 0 when
 * every one is carried, exit 2 when the command line is wrong or the file cannot be read as a complete EU file (a
 * truncated download would otherwise look like "the act is missing", or worse, an empty file like "nothing to check").
 * It never exits 0 on a file it could not parse.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { actesDuFlux, manquants, numerosDeLActe, sonderFlux } from "./actes-ue.ts";

const CLI = fileURLToPath(new URL("./actes-ue.ts", import.meta.url));

/* ───────────────────────── feeds, by hand, in the real shape ───────────────────────── */

type Acte = { numberTitle: string; publicationDate?: string; programme?: string };

/** One `regulation` attribute list: the date attribute is left out when the case has none. */
const attributs = (a: Acte, id: number): string =>
  `regulationType="regulation" organisationType="council"${a.publicationDate === undefined ? "" : ` publicationDate="${a.publicationDate}"`}`
  + ` entryIntoForceDate="2026-02-24"${a.numberTitle === "" ? "" : ` numberTitle="${a.numberTitle}"`} programme="${a.programme ?? "RUS"}" logicalId="${id}"`;

/** An entity: its regulations (the real file carries one, a case may carry two) and the summaries under its name alias. */
const entite = (id: number, reglements: Acte[], resumes: Acte[] = []): string => [
  `    <sanctionEntity designationDetails="" unitedNationId="" euReferenceNumber="EU.${id}.${id}" logicalId="${id}">`,
  `        <remark>invented for a test</remark>`,
  ...reglements.map((a, i) => `        <regulation ${attributs(a, 900 + id * 10 + i)}>\n            <publicationUrl>http://eur-lex.europa.eu/example</publicationUrl>\n        </regulation>`),
  `        <subjectType code="person" classificationCode="P"/>`,
  `        <nameAlias firstName="Alpha" middleName="" lastName="Example${id}" wholeName="Alpha Example${id}" function="" gender="M" title="" nameLanguage="" strong="true" regulationLanguage="en" logicalId="${id}1">`,
  ...resumes.map((a) => `            <regulationSummary regulationType="regulation"${a.publicationDate === undefined ? "" : ` publicationDate="${a.publicationDate}"`}${a.numberTitle === "" ? "" : ` numberTitle="${a.numberTitle}"`} publicationUrl="http://eur-lex.europa.eu/example"/>`),
  `        </nameAlias>`,
  `    </sanctionEntity>`,
].join("\n");

const GENERATION = "2026-10-12T12:27:34.779+02:00";

/** A complete EU file around the entities given. */
const flux = (entites: string[], generation: string | null = GENERATION): string => [
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`,
  `<export xmlns="http://eu.europa.ec/fpi/fsd/export"${generation === null ? "" : ` generationDate="${generation}"`} globalFileId="1">`,
  ...entites,
  `</export>`,
  ``,
].join("\n");

const ACTE_RUSSIE: Acte = { numberTitle: "2026/431 (OJ L202600431)", publicationDate: "2026-02-23", programme: "RUS" };
const ACTE_ANCIEN: Acte = { numberTitle: "2025/206 (L 202500206)", publicationDate: "2025-03-01", programme: "BLR" };
const RESUME_ANCIEN: Acte = { numberTitle: "2024/1488 (OJ L202401488)", publicationDate: "2024-05-29" };
const ACTE_ATTENDU: Acte = { numberTitle: "2026/2193 (OJ L202602193)", publicationDate: "2026-09-28", programme: "RUS" };

/** The feed as the file stood before the act: two entities, none carrying 2026/2193. */
const fluxSansActe = (): string => flux([entite(1, [ACTE_RUSSIE]), entite(2, [ACTE_ANCIEN], [RESUME_ANCIEN])]);

/** The same feed with three entities carrying 2026/2193 (one cites it twice, one only in a summary). */
const fluxAvecActe = (): string => flux([
  entite(1, [ACTE_RUSSIE]), entite(2, [ACTE_ANCIEN], [RESUME_ANCIEN]),
  entite(3, [ACTE_ATTENDU], [ACTE_ATTENDU]),
  entite(4, [ACTE_ATTENDU]),
  entite(5, [ACTE_RUSSIE], [ACTE_ATTENDU]),
]);

/* ───────────────────────── the command ───────────────────────── */

type Sortie = { statut: number | null; sortie: string; erreurs: string };

/** Writes `contenu` (when not null) to a throwaway directory and runs the command on it with the arguments given. */
function lancer(contenu: string | null, ...args: string[]): Sortie {
  const dossier = realpathSync(mkdtempSync(join(tmpdir(), "actes-ue-")));
  try {
    const f = join(dossier, "eu.xml");
    if (contenu !== null) writeFileSync(f, contenu);
    const r = spawnSync(process.execPath, [CLI, ...(contenu === null ? [] : [f]), ...args], { encoding: "utf8", timeout: 60_000 });
    return { statut: r.status, sortie: r.stdout, erreurs: r.stderr };
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
}

/** The one JSON line the command prints. */
function ligne(r: Sortie): Record<string, unknown> {
  const lignes = r.sortie.split("\n").filter((l) => l.length > 0);
  assert.equal(lignes.length, 1, `exactly one line on stdout, got: ${JSON.stringify(r.sortie)}`);
  return JSON.parse(lignes[0]!) as Record<string, unknown>;
}

/* ───────────────────────── the witness of the plan ───────────────────────── */

test("a feed without the act lists 2026/2193 as missing: exit 1, one JSON line with the four numbers and the missing list", () => {
  const r = lancer(fluxSansActe(), "--attendu=2026/2193");
  assert.equal(r.statut, 1, r.erreurs);
  const j = ligne(r);
  assert.equal(j["generationDate"], "2026-10-12");
  assert.equal(j["entries"], 2);
  assert.equal(j["newestPublicationDate"], "2026-02-23");
  assert.deepEqual(j["expected"], { "2026/2193": 0 });
  assert.deepEqual(j["missing"], ["2026/2193"]);
});

test("a feed whose numberTitle is 2026/2193 (OJ L202602193) lists none missing: exit 0, each entity counted once however often it cites the act", () => {
  const r = lancer(fluxAvecActe(), "--attendu=2026/2193");
  assert.equal(r.statut, 0, r.erreurs);
  const j = ligne(r);
  assert.deepEqual(j["missing"], []);
  assert.deepEqual(j["expected"], { "2026/2193": 3 }, "entities 3, 4 and 5 cite it; entity 3 cites it twice and counts once");
  assert.equal(j["entries"], 5);
  assert.equal(j["newestPublicationDate"], "2026-09-28");
});

test("--attendu repeats and may take its value as the next argument; the exit follows the missing list, the count is given for each", () => {
  const r = lancer(fluxAvecActe(), "--attendu=2026/2193", "--attendu", "2026/9999", "--attendu=2026/431");
  assert.equal(r.statut, 1, r.erreurs);
  const j = ligne(r);
  assert.deepEqual(j["expected"], { "2026/2193": 3, "2026/9999": 0, "2026/431": 2 });
  assert.deepEqual(j["missing"], ["2026/9999"]);
  assert.equal(lancer(fluxAvecActe(), "--attendu=2026/2193", "--attendu=2026/431").statut, 0);
  assert.deepEqual(ligne(lancer(fluxAvecActe(), "--attendu=2026/2193", "--attendu=2026/2193"))["expected"], { "2026/2193": 3 }, "a repeated number is asked once");
});

/* ───────────────────────── the act number is a token, not a substring ───────────────────────── */

const feedAvecTitre = (numberTitle: string): string => flux([entite(1, [{ numberTitle, publicationDate: "2026-09-28" }])]);

test("near-miss numbers are not the act: 2026/219, 2026/21930, 12026/2193, 2193/2026 and the like do not count as 2026/2193", () => {
  for (const titre of [
    "2026/219 (OJ L202600219)", "2026/21930 (OJ L202621930)", "12026/2193 (OJ L12026219)", "2193/2026 (OJ L2193)",
    "2026/2193/5 (OJ L5)", "x2026/2193 (OJ L1)", "2026//2193 (OJ L1)", "2026-2193 (OJ L1)", "L2026/2193", "(OJ L202602193)", "",
  ]) {
    assert.deepEqual(manquants(["2026/2193"], actesDuFlux(feedAvecTitre(titre))), ["2026/2193"], JSON.stringify(titre));
  }
  const sans = lancer(feedAvecTitre("2026/21930 (OJ L202621930)"), "--attendu=2026/2193");
  assert.equal(sans.statut, 1, sans.erreurs);
  /* and the other way round: a longer expected number is not carried by the shorter act */
  for (const attendu of ["2026/219", "2026/21930", "12026/2193", "2193/2026", "6/2193", "2026/193"]) {
    assert.deepEqual(manquants([attendu], actesDuFlux(feedAvecTitre("2026/2193 (OJ L202602193)"))), [attendu], attendu);
  }
});

test("the forms the real file uses for an act number still count: no space before the bracket, a corrigendum, a second number, a suffix", () => {
  for (const titre of [
    "2026/2193 (OJ L202602193)", "2026/2193(OJ L202602193)", "2026/2193 corrigendum", "2026/2193 (OJ L202602193) [corr. 28.03.2026]",
    "2024/753-corr 2026/2193 (OJ L12042024)", "2026/2193/CFSP (OJ L1)", "2026/2193 (OJ L202602193) (2)", "2026/2193.",
    "2026&#47;2193 (OJ L202602193)", "2026&#x2F;2193 (OJ L202602193)",
  ]) {
    assert.deepEqual(manquants(["2026/2193"], actesDuFlux(feedAvecTitre(titre))), [], JSON.stringify(titre));
  }
  assert.deepEqual(numerosDeLActe("2024/753-corr 2024/90233 (OJ L12042024)"), ["2024/753", "2024/90233"]);
  assert.deepEqual(numerosDeLActe("2003/902/EC (OJ L340)"), ["2003/902"]);
  assert.deepEqual(numerosDeLActe("UNLI 26.03.2026 - 2"), [], "a title that carries no act number gives none");
});

/* ───────────────────────── a file it cannot read as a complete EU file is exit 2, never 0 ───────────────────────── */

test("an empty, garbage, non-EU, truncated or entity-less file is exit 2 with nothing on stdout, never 0", () => {
  const complet = fluxAvecActe();
  const fichiers: Record<string, string> = {
    "empty file": "",
    "garbage": "this is not xml \u0000\u0001 ✓",
    "an HTML page": "<html><body>Service unavailable</body></html>",
    "another list's XML": `<?xml version="1.0"?>\n<sdnList><sdnEntry><uid>1</uid><lastName>Example</lastName></sdnEntry></sdnList>\n`,
    "an EU file cut before its end": complet.slice(0, complet.indexOf("</export>")),
    "an EU file cut in the middle of an entity": complet.slice(0, complet.indexOf("<subjectType", complet.indexOf("logicalId=\"3\""))) + "\n</export>\n",
    "a root with no generationDate": flux([entite(1, [ACTE_ATTENDU])], null),
    "an EU root with no entity": flux([]),
    "a self-closed entity that would swallow the next one": flux([entite(1, [ACTE_RUSSIE]).replace(/>\s*<remark>[\s\S]*$/, "/>"), entite(2, [ACTE_ATTENDU])]),
  };
  for (const [nom, contenu] of Object.entries(fichiers)) {
    const r = lancer(contenu, "--attendu=2026/2193");
    assert.equal(r.statut, 2, `${nom}: ${r.sortie}${r.erreurs}`);
    assert.equal(r.sortie, "", `${nom}: nothing is printed on stdout`);
    assert.ok(r.erreurs.length > 0, `${nom}: the refusal is said on stderr`);
  }
  /* the same witness in the function: a refusal is a value, not a throw, and it names why */
  assert.ok("refus" in sonderFlux("", ["2026/2193"]));
  assert.ok("refus" in sonderFlux(complet.slice(0, complet.indexOf("</export>")), ["2026/2193"]));
  assert.ok(!("refus" in sonderFlux(complet, ["2026/2193"])), "the complete file is read");
});

test("an unreadable path or a directory is exit 2", () => {
  const dossier = realpathSync(mkdtempSync(join(tmpdir(), "actes-ue-")));
  try {
    mkdirSync(join(dossier, "dir"));
    for (const chemin of [join(dossier, "absent.xml"), join(dossier, "dir")]) {
      const r = spawnSync(process.execPath, [CLI, chemin, "--attendu=2026/2193"], { encoding: "utf8", timeout: 60_000 });
      assert.equal(r.status, 2, r.stderr);
      assert.equal(r.stdout, "");
    }
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
});

test("a wrong command line is exit 2: no file, two files, no --attendu, a number that is not N/N, a flag with no value, an unknown flag", () => {
  const xml = fluxAvecActe();
  assert.equal(lancer(null, "--attendu=2026/2193").statut, 2, "no file");
  assert.equal(lancer(xml).statut, 2, "no --attendu: a check that checks nothing must not read as a pass");
  for (const mauvais of ["2026-2193", "2026/", "/2193", "abc", "", "2026/2193 ", "2026/2193,2026/2194", " 2026/2193", "2026/21a3", "２０２６/２１９３"]) {
    const r = lancer(xml, `--attendu=${mauvais}`);
    assert.equal(r.statut, 2, `--attendu=${JSON.stringify(mauvais)}: ${r.sortie}`);
  }
  assert.equal(lancer(xml, "--attendu").statut, 2, "--attendu with no value");
  assert.equal(lancer(xml, "--attendu", "--attendu=2026/2193").statut, 2, "--attendu followed by a flag is not a value");
  const r = lancer(xml, "--nimportequoi", "--attendu=2026/2193");
  assert.equal(r.statut, 2, "an unknown flag is refused by the shared helper");
  assert.match(r.erreurs, /--nimportequoi/);
  assert.match(r.erreurs, /--attendu/, "the refusal lists the flag that exists");
  const dossier = realpathSync(mkdtempSync(join(tmpdir(), "actes-ue-")));
  try {
    const un = join(dossier, "a.xml");
    const deux = join(dossier, "b.xml");
    writeFileSync(un, xml);
    writeFileSync(deux, xml);
    assert.equal(spawnSync(process.execPath, [CLI, un, deux, "--attendu=2026/2193"], { encoding: "utf8", timeout: 60_000 }).status, 2, "two files");
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
});

/* ───────────────────────── odd entities are counted, not dropped, and what is odd is said ───────────────────────── */

const FLUX_ETRANGE = flux([
  entite(1, [{ numberTitle: "2026/100 (OJ L1)", publicationDate: "2026-03-01" }, { numberTitle: "2026/101 (OJ L2)", publicationDate: "2026-03-02T10:00:00", programme: "BLR" }]),
  entite(2, [{ numberTitle: "2026/102 (OJ L3)" }]),
  entite(3, [{ numberTitle: "2026/103 (OJ L4)", publicationDate: "2026-02-30" }]),
  entite(4, [{ numberTitle: "2026/100 (OJ L1)", publicationDate: "2026-03-01" }], [{ numberTitle: "2026/104 (OJ L5)", publicationDate: "soon" }]),
  entite(5, [{ numberTitle: "", publicationDate: "2026-03-03" }]),
]);

test("two acts in one entity, an entity with no publicationDate, an invalid date and a regulation with no numberTitle: counted without crashing", () => {
  const actes = actesDuFlux(FLUX_ETRANGE);
  const par = (titre: string) => actes.find((a) => a.numberTitle === titre);
  assert.deepEqual(actes.map((a) => a.numberTitle), ["2026/100 (OJ L1)", "2026/101 (OJ L2)", "2026/102 (OJ L3)", "2026/103 (OJ L4)", "2026/104 (OJ L5)"]);
  assert.equal(par("2026/100 (OJ L1)")!.entites, 2, "entities 1 and 4");
  assert.equal(par("2026/101 (OJ L2)")!.entites, 1, "the second act of entity 1 counts for that entity too");
  assert.equal(par("2026/101 (OJ L2)")!.publicationDate, "2026-03-02", "a datetime counts by its day");
  assert.deepEqual(par("2026/101 (OJ L2)")!.programmes, ["BLR"]);
  assert.equal(par("2026/102 (OJ L3)")!.publicationDate, null, "no publicationDate: counted, with no date");
  assert.equal(par("2026/102 (OJ L3)")!.entites, 1);
  assert.equal(par("2026/103 (OJ L4)")!.publicationDate, null, "30 February is not a day");
  assert.equal(par("2026/103 (OJ L4)")!.invalidDates, 1);
  assert.equal(par("2026/104 (OJ L5)")!.invalidDates, 1);
  assert.equal(par("2026/100 (OJ L1)")!.invalidDates, 0);
});

test("the probe reports the invalid dates, the acts with no date and the regulations with no number; it does not hide them in the newest date", () => {
  const s = sonderFlux(FLUX_ETRANGE, ["2026/100"]);
  assert.ok(!("refus" in s));
  if ("refus" in s) return;
  assert.equal(s.entries, 5);
  assert.equal(s.acts, 5);
  assert.equal(s.newestPublicationDate, "2026-03-03", "the newest VALID date, whatever sorts higher among the invalid ones");
  assert.equal(s.invalidPublicationDates.count, 2);
  assert.deepEqual([...s.invalidPublicationDates.examples].sort(), ["2026-02-30", "soon"]);
  assert.equal(s.actsWithoutValidDate, 3, "2026/102 (no date), 2026/103 and 2026/104 (invalid)");
  assert.equal(s.withoutNumberTitle, 1);
  assert.deepEqual(s.missing, []);
  const r = lancer(FLUX_ETRANGE, "--attendu=2026/100");
  assert.equal(r.statut, 0, r.erreurs);
  const j = ligne(r);
  assert.deepEqual(j["invalidPublicationDates"], { count: 2, examples: ["2026-02-30", "soon"] });
  assert.equal(j["withoutNumberTitle"], 1);
  assert.equal(j["actsWithoutValidDate"], 3);
});

test("a feed whose every date is invalid still reports its acts; the newest date is null and the defect is said", () => {
  const tout = flux([entite(1, [{ numberTitle: "2026/200 (OJ L1)", publicationDate: "2026-13-45" }]), entite(2, [{ numberTitle: "2026/201 (OJ L2)" }])]);
  const s = sonderFlux(tout, ["2026/200", "2026/999"]);
  assert.ok(!("refus" in s));
  if ("refus" in s) return;
  assert.equal(s.newestPublicationDate, null);
  assert.match(s.datesDefect ?? "", /publicationDate/);
  assert.deepEqual(s.missing, ["2026/999"]);
  assert.equal(lancer(tout, "--attendu=2026/200").statut, 0, "the act is carried; the dates are another matter and are reported");
});

test("the printed values are the file's own text kept inert: an invalid date with control characters is quoted as JSON, cut short, and the line stays one line", () => {
  const sale = flux([entite(1, [{ numberTitle: "2026/300 (OJ L1)", publicationDate: "\u001b[31mred" + "x".repeat(200) }])]);
  const r = lancer(sale, "--attendu=2026/300");
  assert.equal(r.statut, 0, r.erreurs);
  const j = ligne(r);
  const exemple = (j["invalidPublicationDates"] as { examples: string[] }).examples[0]!;
  assert.ok(exemple.length <= 40, `cut short: ${exemple.length}`);
  assert.ok(!r.sortie.includes("\u001b"), "no raw escape reaches the terminal");
});

/* ───────────────────────── the pure function does what the command prints ───────────────────────── */

test("actesDuFlux and manquants are pure and agree with the command: no act, no crash on a non-feed", () => {
  assert.deepEqual(actesDuFlux(""), []);
  assert.deepEqual(actesDuFlux("not xml"), []);
  assert.deepEqual(manquants(["2026/2193"], []), ["2026/2193"]);
  assert.deepEqual(manquants([], actesDuFlux(fluxAvecActe())), []);
  assert.deepEqual(manquants(["2026/2193", "2026/2193", "2026/431"], actesDuFlux(fluxSansActe())), ["2026/2193"], "a repeated number is listed once");
  const a = actesDuFlux(fluxAvecActe());
  assert.deepEqual(manquants(["2026/2193"], a), []);
  const acte = a.find((x) => x.numberTitle.startsWith("2026/2193"))!;
  assert.deepEqual({ ...acte }, { numberTitle: "2026/2193 (OJ L202602193)", publicationDate: "2026-09-28", invalidDates: 0, programmes: ["RUS"], entites: 3 });
});
