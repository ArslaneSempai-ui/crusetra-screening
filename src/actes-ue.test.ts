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
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { actesDuFlux, manquants, numerosDeLActe, sonderFlux } from "./actes-ue.ts";
import * as Actes from "./actes-ue.ts";

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

/* ───────────────────────────────────────────────────────────────────────────────────────────────
 * THE JOURNAL WATCH: `node src/listes.ts --actes`, the one network door that asks which acts exist.
 *
 * The EU file we hold can stop before an act (the one of 28 September 2026, absent from the file generated on 12 October)
 * and nothing in it says so. `--actes` asks the Publications Office catalogue, with ONE public question that carries no name
 * and nothing of the client, for the acts titled as restrictive measures that it dates from a margin before the newest
 * publication in the file on disk, and names those whose number no numberTitle of the file carries.
 *
 * These cases run the real command in a throwaway copy of the modules it needs, with a `fetch` that never touches the
 * network (the way src/listes-jeton.test.ts does), in a working directory of its own, and then read everything the run left
 * behind: standard output and error, the exit code, the request the stub saw, and the files under the working directory. The
 * catalogue answers below are written by hand in the W3C shape of a SPARQL JSON result with invented acts and numbers; none
 * is copied from the Office's. The feeds are the hand-built ones above.
 *
 * What the command promises, and what the cases hold it to: exit 1 when an act of the answer is named by no numberTitle of
 * the file; exit 0 when none is AND at least one act of the answer is named by the file (an answer that shares nothing with
 * the file cannot show that the question works); exit 2 when it could not ask or read (the Office refusing, timing out,
 * answering a page, a body too large, too many rows, a file it cannot read as a complete EU file), with NOTHING written, so a
 * failed check never reads as "no act is missing". Each act is named, none is a verdict: a renewal can add no listing.
 * ─────────────────────────────────────────────────────────────────────────────────────────────── */

const ICI = fileURLToPath(new URL(".", import.meta.url));
const SPARQL_HOTE = "publications.europa.eu";
const SPARQL_CHEMIN = "/webapi/rdf/sparql";

/** The `fetch` the child gets: no network. Every request is logged (never a body it did not receive); the catalogue is answered by mode. */
const FAUSSE_RECUPERATION_GUET = `
import { appendFileSync, readFileSync } from "node:fs";
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  appendFileSync(process.env.STUB_LOG, JSON.stringify({
    url: u, method: init.method ?? "GET", headers: Object.fromEntries(new Headers(init.headers ?? {})), body: init.body ?? null,
    signal: init.signal instanceof AbortSignal, redirect: init.redirect ?? null,
  }) + "\\n");
  if (u.endsWith("/public/rss")) return new Response(readFileSync(process.env.STUB_RSS));
  if (!u.startsWith("https://publications.europa.eu/webapi/rdf/sparql")) return new Response(readFileSync(process.env.STUB_EU));
  const mode = process.env.STUB_MODE;
  const corps = readFileSync(process.env.STUB_REPONSE);
  if (mode === "http403") return new Response("forbidden", { status: 403 });
  if (mode === "http500") return new Response("server error", { status: 500 });
  if (mode === "http206") return new Response(corps, { status: 206 });
  if (mode === "throws") throw new TypeError("fetch failed (connect ECONNRESET)");
  if (mode === "timeout") { const e = new Error("The operation was aborted due to timeout"); e.name = "TimeoutError"; throw e; }
  if (mode === "html") return new Response("<html><body>Please verify you are human</body></html>", { status: 200, headers: { "content-type": "text/html" } });
  if (mode === "garbage") return new Response(new Uint8Array([0, 1, 2, 255, 254, 123, 34]), { status: 200 });
  if (mode === "oversize") {
    /* ENDLESS: a valid answer, then blanks for ever, paced so that a reader with no cap grows slowly and is stopped by the
       test's timeout, not by the machine. Only the cap, applied while the body is read, can end this one in time. */
    const bloc = new Uint8Array(64 * 1024).fill(32);
    return new Response(new ReadableStream({
      start(c) { c.enqueue(new Uint8Array(corps)); },
      async pull(c) { await new Promise((r) => setTimeout(r, 5)); c.enqueue(bloc); },
    }), { status: 200 });
  }
  if (mode === "partial-sql") return new Response(corps, { status: 200, headers: { "content-type": "application/sparql-results+json", "X-SQL-State": "S1TAT", "X-SQL-Message": "Anytime query: partial result" } });
  if (mode === "partial-name") return new Response(corps, { status: 200, headers: { "content-type": "application/sparql-results+json", "X-Result-Partial": "true" } });
  if (mode === "warning") return new Response(corps, { status: 200, headers: { "content-type": "application/sparql-results+json", "Warning": '110 - "Response is Stale"' } });
  if (mode === "content-range") return new Response(corps, { status: 200, headers: { "content-type": "application/sparql-results+json", "Content-Range": "bytes 0-99/100" } });
  if (mode === "truncated-name") return new Response(corps, { status: 200, headers: { "content-type": "application/sparql-results+json", "X-Results-Truncated": "1" } });
  if (mode === "oversize-header") return new Response(corps, { status: 200, headers: { "content-length": process.env.STUB_OCTETS } });
  return new Response(corps, { status: 200, headers: { "content-type": "application/sparql-results+json" } });
};
`;

/** listes.ts and every module it imports, found by reading the imports, so a new import cannot silently break the copy. */
function fermetureDe(depart: string): string[] {
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

type Requete = { url: string; method: string; headers: Record<string, string>; body: unknown; signal: boolean; redirect: string | null };
type Lancement = {
  /** the EU file written to data/listes/eu.xml of the throwaway root; null: none */
  eu?: string | null;
  /** the catalogue answer the stub gives */
  reponse?: string;
  mode?: string;
  args?: string[];
  env?: Record<string, string>;
  /** files that exist in the working directory before the run: relative path to content */
  avant?: Record<string, string>;
  /** run in the root of the copy (as `--fetch` is) instead of in a working directory of its own */
  dansLaRacine?: boolean;
  /** how long the child may run before the test kills it (ms) */
  delai?: number;
};
type Resultat = {
  statut: number | null; sortie: string; erreurs: string; requetes: Requete[];
  /** every file under the working directory, relative, with its content */
  fichiers: Record<string, string>;
  racine: string;
  cwd: string;
  lire: (chemin: string) => string;
};

const fichiersSousDossier = (dossier: string, base = dossier): string[] =>
  readdirSync(dossier, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? fichiersSousDossier(join(dossier, e.name), base) : [join(dossier, e.name).slice(base.length + 1).split(sep).join("/")]);

/** One run of the real command, then everything it left behind is read; the throwaway root is removed before this returns. */
function lancerGuet({ eu = fluxGuet(), reponse = reponseCatalogue([CAT_A, CAT_B, CAT_C]), mode = "ok", args = ["--actes"], env = {}, avant = {}, dansLaRacine = false, delai = 120_000 }: Lancement = {}): Resultat {
  /* realpath: on macOS tmpdir() is a symlink, and `isMain` compares the resolved module URL with argv[1]. */
  const racine = realpathSync(mkdtempSync(join(tmpdir(), "guet-ue-")));
  try {
    mkdirSync(join(racine, "src"));
    for (const f of fermetureDe("listes.ts")) cpSync(join(ICI, f), join(racine, "src", f));
    cpSync(join(ICI, "..", "package.json"), join(racine, "package.json"));
    mkdirSync(join(racine, "data", "listes"), { recursive: true });
    if (eu !== null) writeFileSync(join(racine, "data", "listes", "eu.xml"), eu);
    writeFileSync(join(racine, "fausse-recuperation.mjs"), FAUSSE_RECUPERATION_GUET);
    writeFileSync(join(racine, "reponse.json"), reponse);
    writeFileSync(join(racine, "requetes.log"), "");
    const cwd = dansLaRacine ? racine : join(racine, "cwd");
    mkdirSync(cwd, { recursive: true });
    mkdirSync(join(racine, "home"));
    for (const [chemin, contenu] of Object.entries(avant)) {
      mkdirSync(join(cwd, chemin, ".."), { recursive: true });
      writeFileSync(join(cwd, chemin), contenu);
    }
    const environnement: Record<string, string | undefined> = { ...process.env };
    for (const n of ["CRUSETRA_EU_TOKEN", "CASCADE_EU_TOKEN", "CRUSETRA_OFFLINE", "CASCADE_OFFLINE"]) delete environnement[n];
    Object.assign(environnement, {
      HOME: join(racine, "home"), USERPROFILE: join(racine, "home"),
      STUB_LOG: join(racine, "requetes.log"), STUB_MODE: mode, STUB_REPONSE: join(racine, "reponse.json"),
      STUB_OCTETS: String(Actes.PLAFOND_OCTETS_CATALOGUE + 1), STUB_EU: join(racine, "data", "listes", "eu.xml"),
      STUB_RSS: join(ICI, "fixtures", "ue-rss.xml"),
    }, env);
    const r = spawnSync(process.execPath,
      ["--import", pathToFileURL(join(racine, "fausse-recuperation.mjs")).href, join(racine, "src", "listes.ts"), ...args],
      { cwd, encoding: "utf8", env: environnement, timeout: delai, maxBuffer: 64 * 1024 * 1024 });
    const requetes = readFileSync(join(racine, "requetes.log"), "utf8").split("\n").filter((l) => l.length > 0).map((l) => JSON.parse(l) as Requete);
    /* run in the root of the copy, the modules and the stub files are there too: only the manifest is of interest */
    const sousCwd = dansLaRacine ? ["listes-manifest.json"].filter((f) => existsSync(join(cwd, f))) : fichiersSousDossier(cwd);
    const fichiers = Object.fromEntries(sousCwd.map((f) => [f, readFileSync(join(cwd, f), "utf8")]));
    return { statut: r.status, sortie: r.stdout, erreurs: r.stderr, requetes, fichiers, racine, cwd, lire: (c) => readFileSync(join(racine, c), "utf8") };
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
}

/* ───────────────────────── the feed and the catalogue answer, by hand ───────────────────────── */

/** Three acts the catalogue knows: the first two are named by the feed, the third is not. */
type LigneCatalogue = { celex: string; title: string; date: string };
const CAT_A: LigneCatalogue = { celex: "32026R9001", date: "2026-06-12", title: "Council Implementing Regulation (EU) 2026/9001 of 12 June 2026 implementing Regulation (EU) 2099/1 concerning restrictive measures in view of the situation in Examplia" };
const CAT_B: LigneCatalogue = { celex: "32026R9002", date: "2026-06-10", title: "Council Regulation (EU) 2026/9002 of 10 June 2026 amending Regulation (EU) 2099/2 concerning restrictive measures against the invented regime of Testland" };
const CAT_C: LigneCatalogue = { celex: "32026R9003", date: "2026-09-28", title: "Council Implementing Regulation (EU) 2026/9003 of 28 September 2026 implementing Regulation (EU) 2099/1 concerning restrictive measures in view of the situation in Examplia" };

/** A SPARQL JSON result of the shape the W3C defines, one binding per act. A row may carry fewer columns, to build the odd ones. */
const reponseCatalogue = (lignes: (Partial<LigneCatalogue> & { celex?: string })[]): string => JSON.stringify({
  head: { link: [], vars: ["celex", "title", "date"] },
  results: {
    bindings: lignes.map((l) => ({
      ...(l.celex === undefined ? {} : { celex: { type: "literal", datatype: "http://www.w3.org/2001/XMLSchema#string", value: l.celex } }),
      ...(l.title === undefined ? {} : { title: { type: "literal", value: l.title } }),
      ...(l.date === undefined ? {} : { date: { type: "literal", datatype: "http://www.w3.org/2001/XMLSchema#date", value: l.date } }),
    })),
  },
});

const ACTE_A_FLUX: Acte = { numberTitle: "2026/9001 (OJ L202609001)", publicationDate: "2026-06-12", programme: "RUS" };
const ACTE_B_FLUX: Acte = { numberTitle: "2026/9002 (OJ L202609002)", publicationDate: "2026-06-10", programme: "BLR" };
/** The file of the cases: it names 2026/9001 (published 2026-06-12, the file's newest day: the one act of that day) and 2026/9002, and it was generated on 2026-10-12. */
const fluxGuet = (): string => flux([entite(1, [ACTE_A_FLUX]), entite(2, [ACTE_B_FLUX])]);

/** The day the question starts at, computed here and not by the code under test. */
const debutAttendu = (): string => new Date(Date.UTC(2026, 5, 12) - Actes.MARGE_JOURS * 86_400_000).toISOString().slice(0, 10);

const lignesAbsent = (sortie: string): string[] => sortie.split("\n").filter((l) => l.startsWith("ABSENT "));
const aujourdhui = (): string => new Date().toISOString().slice(0, 10);
/** The one file the run wrote under donnees/listes/, whichever side of midnight it ran. */
function fichierEcrit(r: Resultat): { chemin: string; contenu: unknown } {
  const chemins = Object.keys(r.fichiers);
  assert.equal(chemins.length, 1, `one file written, got ${JSON.stringify(chemins)}`);
  assert.match(chemins[0]!, /^donnees\/listes\/\d{4}-\d{2}-\d{2}\.json$/);
  return { chemin: chemins[0]!, contenu: JSON.parse(r.fichiers[chemins[0]!]!) };
}

/* ───────────────────────── the witness of the plan ───────────────────────── */

test("--actes on a catalogue answer of three acts, one absent from the feed: the output names exactly that one and exits 1", () => {
  const r = lancerGuet();
  assert.equal(r.statut, 1, r.erreurs);
  const absents = lignesAbsent(r.sortie);
  assert.equal(absents.length, 1, r.sortie);
  assert.match(absents[0]!, /^ABSENT 2026\/9003 \(CELEX 32026R9003, 2026-09-28\): Council Implementing Regulation \(EU\) 2026\/9003 of 28 September 2026/);
  assert.ok(!/ABSENT 2026\/900[12]\b/.test(r.sortie), "the two acts the feed names are not listed");
  assert.match(r.sortie, /none is a verdict/, "the output says that each act is named and none is a verdict");
  assert.doesNotMatch(r.erreurs, /could not be done|Nothing was written/, "the check ran: no refusal on stderr");
});

test("--actes lists only the implementing regulations; decisions and amending regulations are counted in one line, not listed, and the exit is still 1", () => {
  const DECISION: LigneCatalogue = { celex: "32026D9010", date: "2026-09-29", title: "Council Decision (CFSP) 2026/9010 of 29 September 2026 amending Decision 2099/3/CFSP concerning restrictive measures in view of the situation in Examplia" };
  const MODIFICATIF: LigneCatalogue = { celex: "32026R9011", date: "2026-09-30", title: "Council Regulation (EU) 2026/9011 of 30 September 2026 amending Regulation (EU) 2099/1 concerning restrictive measures in view of the situation in Examplia" };
  const DECISION_EXEC: LigneCatalogue = { celex: "32026D9012", date: "2026-10-01", title: "Council Implementing Decision (CFSP) 2026/9012 of 1 October 2026 implementing Decision 2099/3/CFSP concerning restrictive measures in view of the situation in Examplia" };
  const r = lancerGuet({ reponse: reponseCatalogue([CAT_A, CAT_C, DECISION, MODIFICATIF, DECISION_EXEC]) });
  assert.equal(r.statut, 1, r.erreurs);
  assert.deepEqual(lignesAbsent(r.sortie).map((l) => /^ABSENT (\S+)/.exec(l)![1]), ["2026/9003"], r.sortie);
  const autres = r.sortie.split("\n").filter((l) => l.startsWith("OTHER "));
  assert.equal(autres.length, 1, r.sortie);
  assert.match(autres[0]!, /^OTHER 3 act\(s\) \(decisions, amending regulations\) are named by no numberTitle of the file and not listed/);
  assert.match(r.sortie, /4 act\(s\) of the answer are named by no numberTitle/, "the closing line still counts every absent act");
  /* the day file keeps every absent act: only the screen is short */
  assert.equal((fichierEcrit(r).contenu as { actes_absents: unknown[] }).actes_absents.length, 4);
  /* no implementing regulation absent: no ABSENT line, the summary alone, and the exit is still 1 */
  const seuls = lancerGuet({ reponse: reponseCatalogue([CAT_A, DECISION]) });
  assert.equal(seuls.statut, 1, seuls.erreurs);
  assert.deepEqual(lignesAbsent(seuls.sortie), []);
  assert.equal(seuls.sortie.split("\n").filter((l) => l.startsWith("OTHER 1 act(s)")).length, 1, seuls.sortie);
});

test("--actes with every act of the answer named by the feed: exit 0, nothing listed as absent, and the empty list is written", () => {
  const r = lancerGuet({ reponse: reponseCatalogue([CAT_A, CAT_B]) });
  assert.equal(r.statut, 0, r.erreurs);
  assert.deepEqual(lignesAbsent(r.sortie), []);
  assert.match(r.sortie, /Every act of the answer is named in the file/);
  assert.deepEqual(fichierEcrit(r).contenu, { actes_absents: [] });
});

test("a number near-miss does not hide the absent act: the feed carries 2026/900, 2026/90030 and 12026/9003, and 2026/9003 is still named", () => {
  const voisins = flux([
    entite(1, [ACTE_A_FLUX]), entite(2, [{ numberTitle: "2026/900 (OJ L1)", publicationDate: "2026-06-11" }]),
    entite(3, [{ numberTitle: "2026/90030 (OJ L2)", publicationDate: "2026-06-11" }]), entite(4, [{ numberTitle: "12026/9003 (OJ L3)", publicationDate: "2026-06-11" }]),
  ]);
  const r = lancerGuet({ eu: voisins, reponse: reponseCatalogue([CAT_A, CAT_C]) });
  assert.equal(r.statut, 1, r.erreurs);
  assert.equal(lignesAbsent(r.sortie).length, 1, r.sortie);
  assert.match(lignesAbsent(r.sortie)[0]!, /^ABSENT 2026\/9003 /);
  /* and the other way: an act the catalogue calls 2026/900 is not carried by a feed that has only 2026/9001 */
  const court = lancerGuet({ reponse: reponseCatalogue([CAT_A, { celex: "32026R0900", date: "2026-06-11", title: "Council Implementing Regulation (EU) 2026/900 concerning restrictive measures against the invented regime of Testland" }]) });
  assert.equal(court.statut, 1, court.erreurs);
  assert.match(lignesAbsent(court.sortie)[0]!, /^ABSENT 2026\/900 \(CELEX 32026R0900,/);
});

/* ───────────────────────── a failure to ask or to read is exit 2, and nothing is written as "no act missing" ───────────────────────── */

const FICHIER_DU_JOUR = `donnees/listes/${aujourdhui()}.json`;
const FICHIER_AVANT = JSON.stringify({ ue_2193: { note: "hand-written, must stay as it was" } });

test("the Office refusing (HTTP 403, HTTP 500, a timeout, a network error), or answering garbage, is exit 2 with nothing written and nothing claimed", () => {
  const cas: [string, Lancement, RegExp][] = [
    ["HTTP 403", { mode: "http403" }, /HTTP 403/],
    ["HTTP 500", { mode: "http500" }, /HTTP 500/],
    ["HTTP 206, a part of an answer", { mode: "http206" }, /HTTP 206/],
    ["a timeout", { mode: "timeout" }, /did not answer|timed out/i],
    ["a network error", { mode: "throws" }, /network/i],
    ["a captcha page with status 200", { mode: "html" }, /not JSON|JSON/],
    ["bytes that are not text", { mode: "garbage" }, /not JSON|JSON/],
    ["JSON of the wrong shape", { reponse: JSON.stringify({ error: "quota exceeded" }) }, /results|bindings|shape/i],
    ["JSON text that is not an object", { reponse: "[1,2,3]" }, /results|bindings|shape/i],
    ["an empty answer", { reponse: "" }, /JSON/],
  ];
  for (const [nom, lancement, motif] of cas) {
    const r = lancerGuet({ ...lancement, avant: { [FICHIER_DU_JOUR]: FICHIER_AVANT } });
    assert.equal(r.statut, 2, `${nom}: exit ${r.statut}\n${r.sortie}\n${r.erreurs}`);
    assert.match(r.erreurs, motif, `${nom}: the reason is said on stderr`);
    assert.equal(lignesAbsent(r.sortie).length, 0, nom);
    assert.doesNotMatch(r.sortie, /Every act|no act is missing|none is absent/i, `${nom}: stdout claims nothing`);
    assert.deepEqual(r.fichiers, { [FICHIER_DU_JOUR]: FICHIER_AVANT }, `${nom}: the file that existed is untouched and nothing else is written`);
  }
});

test("a body past the cap is refused whether the Office announces it or streams it, even a stream that never ends: exit 2, nothing written", () => {
  /* the streamed body NEVER ends: only the cap applied while it is read can stop the command, so a check that reads the
     whole body before comparing its size would hang until the timeout below kills it, and the exit code would not be 2 */
  const infini = lancerGuet({ mode: "oversize", delai: 20_000 });
  assert.equal(infini.statut, 2, `an endless body: exit ${infini.statut}\n${infini.sortie}${infini.erreurs}`);
  assert.match(infini.erreurs, /larger than/);
  assert.deepEqual(infini.fichiers, {});
  const annonce = lancerGuet({ mode: "oversize-header" });
  assert.equal(annonce.statut, 2, `${annonce.sortie}${annonce.erreurs}`);
  assert.match(annonce.erreurs, /larger than/);
  assert.deepEqual(annonce.fichiers, {});
});

test("more rows than the limit (the answer may be cut short), or none at all, or none readable: exit 2, never 'nothing missing'", () => {
  const actes = (n: number): LigneCatalogue[] => Array.from({ length: n }, (_, i) => ({ celex: `3${2000 + (i % 10)}R${String(1000 + i).padStart(4, "0")}`, date: "2026-07-01", title: `Council Implementing Regulation concerning restrictive measures in view of the invented regime number ${i}` }));
  const trop = lancerGuet({ reponse: reponseCatalogue([CAT_A, ...actes(Actes.LIMITE_LIGNES_CATALOGUE)]) });
  assert.equal(trop.statut, 2, trop.sortie + trop.erreurs);
  assert.match(trop.erreurs, /more than/i);
  assert.deepEqual(trop.fichiers, {});
  const juste = lancerGuet({ reponse: reponseCatalogue([CAT_A, ...actes(Actes.LIMITE_LIGNES_CATALOGUE - 1)]) });
  assert.equal(juste.statut, 1, "exactly the limit is read: the acts the feed does not name are absent");
  assert.equal(lignesAbsent(juste.sortie).length, Actes.LIMITE_LIGNES_CATALOGUE - 1);
  const aucune = lancerGuet({ reponse: reponseCatalogue([]) });
  assert.equal(aucune.statut, 2, "an answer with no act cannot show that the question works: it does not read as 'nothing missing'");
  assert.match(aucune.erreurs, /answer incomplete/i, "the file's own newest act is not in an empty answer");
  assert.deepEqual(aucune.fichiers, {});
  const illisibles = lancerGuet({ reponse: reponseCatalogue([CAT_A, { celex: "32026R9001R(01)", date: "2026-06-10", title: "Corrigendum concerning restrictive measures" }, { date: "2026-06-10", title: "no celex at all" }]) });
  assert.equal(illisibles.statut, 2, "rows that cannot be read and no act proven absent: not 'nothing missing'");
  assert.match(illisibles.erreurs, /could not be read/i);
  assert.deepEqual(illisibles.fichiers, {});
});

test("an EU file it cannot read as a complete, dated EU file is exit 2 before any request: missing, cut short, or dates that cannot be trusted", () => {
  const complet = fluxGuet();
  const cas: Record<string, string | null> = {
    "no file": null,
    "an empty file": "",
    "a file cut before its end": complet.slice(0, complet.indexOf("</export>")),
    "a publication later than the generation": flux([entite(1, [{ numberTitle: "2026/9001 (OJ L1)", publicationDate: "2026-12-31" }])]),
    "no valid publication date": flux([entite(1, [{ numberTitle: "2026/9001 (OJ L1)" }])]),
  };
  /* the control: with a good file the same command does ask, so the refusals below are the file's and not a command that never ran */
  assert.equal(lancerGuet().requetes.length, 1);
  for (const [nom, eu] of Object.entries(cas)) {
    const r = lancerGuet({ eu });
    assert.equal(r.statut, 2, `${nom}: ${r.sortie}${r.erreurs}`);
    assert.equal(r.requetes.length, 0, `${nom}: nothing is asked of the Office about a file that cannot be read`);
    assert.deepEqual(r.fichiers, {}, nom);
    assert.match(r.erreurs, /The EU file data\/listes\/eu\.xml cannot be used/, nom);
  }
});

/* ───────────────────────── the door: one question, nothing else, and only when asked ───────────────────────── */

test("the one request: a single GET of the catalogue endpoint whose only parameter is the question, with no cookie, no credential, no name, a timeout armed, and the window read from the file", () => {
  const r = lancerGuet({ env: { CRUSETRA_EU_TOKEN: "FAKE-TOKEN-0000" } });
  assert.equal(r.statut, 1, r.erreurs);
  assert.equal(r.requetes.length, 1, "exactly one request leaves");
  assert.ok(!JSON.stringify(r.requetes).includes("FAKE-TOKEN-0000"), "a personal token set in the environment never rides in this request: the catalogue is public and takes none");
  assert.ok(!r.sortie.includes("FAKE-TOKEN-0000") && !r.erreurs.includes("FAKE-TOKEN-0000"));
  const q = r.requetes[0]!;
  const u = new URL(q.url);
  assert.equal(q.method, "GET");
  assert.equal(q.body, null);
  assert.equal(u.protocol, "https:");
  assert.equal(u.host, SPARQL_HOTE);
  assert.equal(u.pathname, SPARQL_CHEMIN);
  assert.deepEqual([...u.searchParams.keys()], ["query"], "the question is the only thing in the address");
  assert.deepEqual(Object.keys(q.headers).filter((h) => /cookie|authorization|token|key/i.test(h)), [], "no cookie and no credential");
  assert.match(q.headers["accept"] ?? "", /sparql-results\+json/);
  assert.equal(q.signal, true, "a timeout is armed");
  assert.equal(q.redirect, "error", "an answer that redirects somewhere else is not followed");
  const question = u.searchParams.get("query")!;
  assert.ok(question.includes(`"${debutAttendu()}"^^xsd:date`), `the window starts the margin before the newest publication of the file: ${debutAttendu()}`);
  assert.match(question, /restrictive measure/);
  for (const nom of ["Alpha Example1", "Alpha Example2", "Example1", "2026/9001", "9001", "OJ L2026"]) assert.ok(!question.includes(nom), `the question carries nothing of the file but a day: ${nom}`);
  assert.equal(question, Actes.requeteCatalogue(debutAttendu()), "the code asks the question the module builds");
});

test("--actes obeys the offline flags under both names, and refuses to be combined with another mode or given a value: exit 2, no request", () => {
  for (const env of [{ CRUSETRA_OFFLINE: "1" }, { CASCADE_OFFLINE: "1" }, { CRUSETRA_OFFLINE: "0", CASCADE_OFFLINE: "1" }] as Record<string, string>[]) {
    const r = lancerGuet({ env });
    assert.equal(r.statut, 2, JSON.stringify(env));
    assert.equal(r.requetes.length, 0, JSON.stringify(env));
    assert.match(r.erreurs, /forbids? the network/, JSON.stringify(env));
    assert.deepEqual(r.fichiers, {});
  }
  for (const args of [["--actes", "--fetch"], ["--actes", "--only=EU"], ["--actes=1"], ["--actes=EU", "--fetch"], ["--actes", "--nimportequoi"]]) {
    const r = lancerGuet({ args });
    assert.equal(r.statut, 2, `${args.join(" ")}: ${r.sortie}${r.erreurs}`);
    assert.equal(r.requetes.length, 0, args.join(" "));
    assert.deepEqual(r.fichiers, {}, args.join(" "));
  }
  const sansDrapeau = lancerGuet({ args: [] });
  assert.equal(sansDrapeau.requetes.length, 0, "no flag, no request: the listing of what is on disk stays offline");
});

/* ───────────────────────── odd rows: counted, said, never hidden ───────────────────────── */

test("a row the code cannot read as an act is reported with the others, and an act whose date does not parse is still compared and reported", () => {
  const r = lancerGuet({ reponse: reponseCatalogue([
    CAT_A,
    CAT_C,
    { celex: "32026R9003R(01)", date: "2026-09-29", title: "Corrigendum to Council Implementing Regulation concerning restrictive measures" },
    { celex: "32026L9004", date: "2026-09-29", title: "Directive (EU) 2026/9004 on the invented matter of restrictive measures" },
    { date: "2026-09-29", title: "a row with no CELEX" },
    { celex: "32026R9005", date: "soon", title: "Council Implementing Regulation (EU) 2026/9005 concerning restrictive measures against the invented regime of Testland" },
    { celex: "32026R9006", date: "2026-02-30", title: "Council Implementing Regulation (EU) 2026/9006 concerning restrictive measures against the invented regime of Testland" },
  ]) });
  assert.equal(r.statut, 1, r.erreurs);
  assert.deepEqual(lignesAbsent(r.sortie).map((l) => /^ABSENT (\S+)/.exec(l)![1]), ["2026/9003", "2026/9005", "2026/9006"], "dated acts first, by date; the acts with no readable date after them");
  const lignes = r.sortie.split("\n");
  assert.equal(lignes.filter((l) => l.startsWith("UNREADABLE ")).length, 3, "the corrigendum, the directive and the row with no CELEX are each said");
  assert.ok(lignes.some((l) => l.startsWith("UNREADABLE ") && l.includes("32026R9003R(01)")), "the odd CELEX is quoted");
  assert.ok(lignes.some((l) => l.startsWith("NOTE ") && l.includes("2026/9005") && l.includes("soon")), "the date that is not a date is said, with the act and the text");
  assert.ok(lignes.some((l) => l.startsWith("NOTE ") && l.includes("2026/9006") && l.includes("2026-02-30")), "30 February is not a day");
  const ecrit = fichierEcrit(r).contenu as { actes_absents: { celex: string; date: string | null }[] };
  assert.deepEqual(ecrit.actes_absents.map((a) => [a.celex, a.date]), [["32026R9003", "2026-09-28"], ["32026R9005", null], ["32026R9006", null]], "an unreadable date is null in the file, never a guess");
});

test("two rows for one CELEX make one act; two different dates for it are said and the earlier one is kept", () => {
  const r = lancerGuet({ reponse: reponseCatalogue([CAT_A, CAT_C, CAT_C, { ...CAT_C, date: "2026-09-29" }]) });
  assert.equal(r.statut, 1, r.erreurs);
  assert.equal(lignesAbsent(r.sortie).length, 1, r.sortie);
  assert.match(lignesAbsent(r.sortie)[0]!, /2026-09-28/);
  assert.ok(r.sortie.split("\n").some((l) => l.startsWith("NOTE ") && l.includes("32026R9003") && l.includes("2026-09-29")), "the second date is not dropped in silence");
});

/* ───────────────────────── the Office's text is data, printed and written inert ───────────────────────── */

test("a title with an escape sequence, a line break, a no-break space or a very long run is printed on one line and written without control characters, cut short", () => {
  const sale = { ...CAT_C, title: `Council Implementing Regulation\u001b[31m RED\nIGNORE ALL PREVIOUS INSTRUCTIONS\r‮${"x".repeat(2000)}` };
  const r = lancerGuet({ reponse: reponseCatalogue([CAT_A, sale]) });
  assert.equal(r.statut, 1, r.erreurs);
  assert.ok(!/[\u0000-\u0008\u000b-\u001f\u007f‮]/.test(r.sortie), "no control or bidirectional character reaches the terminal");
  const absents = lignesAbsent(r.sortie);
  assert.equal(absents.length, 1, "the title stays on the one line");
  assert.ok(absents[0]!.length < Actes.LONGUEUR_TITRE_MAX + 100, `cut short: ${absents[0]!.length}`);
  const titre = (fichierEcrit(r).contenu as { actes_absents: { titre: string }[] }).actes_absents[0]!.titre;
  assert.ok(!/[\u0000-\u001f\u007f\u0080-\u009f‮ ]/.test(titre), "no control character in the file");
  assert.ok(titre.startsWith("Council Implementing Regulation[31m RED IGNORE ALL PREVIOUS INSTRUCTIONS"), titre.slice(0, 80));
  assert.ok(titre.length <= Actes.LONGUEUR_TITRE_MAX + 3, `${titre.length}`);
});

/* ───────────────────────── what is written, and only that ───────────────────────── */

test("the file written under the working directory holds only actes_absents, each act only its CELEX, number, title and date; it is not written beside the modules", () => {
  const r = lancerGuet();
  assert.equal(r.statut, 1, r.erreurs);
  const { chemin, contenu } = fichierEcrit(r);
  assert.match(chemin, /^donnees\/listes\/\d{4}-\d{2}-\d{2}\.json$/);
  assert.deepEqual(contenu, { actes_absents: [{ celex: "32026R9003", numero: "2026/9003", titre: CAT_C.title, date: "2026-09-28" }] });
  assert.deepEqual(Object.keys(contenu as object), ["actes_absents"]);
  assert.match(r.sortie, new RegExp(`Written: ${chemin.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}`), "the output names the file, relative to where it was run");
  assert.ok(!r.sortie.includes(r.cwd) && !r.sortie.includes(r.racine), "no absolute path of the machine in the output");
});

test("a file of that day that already holds other keys keeps them: only actes_absents is replaced; a file that is not a JSON object is refused and left as it was", () => {
  const jour = aujourdhui();
  const chemin = `donnees/listes/${jour}.json`;
  const existant = JSON.stringify({ hash: "abc", ue_2193: { note: "by hand" }, actes_absents: [{ celex: "32000R0001", numero: "2000/1", titre: "old", date: "2000-01-01" }] });
  const r = lancerGuet({ avant: { [chemin]: existant } });
  if (aujourdhui() !== jour) return;   /* the run crossed midnight: the file of the new day is another file */
  assert.equal(r.statut, 1, r.erreurs);
  const lu = JSON.parse(r.fichiers[chemin]!) as Record<string, unknown>;
  assert.deepEqual(Object.keys(lu), ["hash", "ue_2193", "actes_absents"], "the other keys stay, in their place");
  assert.deepEqual(lu["ue_2193"], { note: "by hand" });
  assert.deepEqual((lu["actes_absents"] as { celex: string }[]).map((a) => a.celex), ["32026R9003"], "the list is replaced, not appended to");
  for (const [nom, contenu] of Object.entries({ "a list": "[1,2]", "text": "not json at all", "a number": "7" })) {
    const m = lancerGuet({ avant: { [chemin]: contenu } });
    if (aujourdhui() !== jour) return;
    assert.equal(m.statut, 2, `${nom}: ${m.sortie}${m.erreurs}`);
    assert.equal(m.fichiers[chemin], contenu, `${nom}: left as it was`);
    assert.match(m.erreurs, /not a JSON object/i, nom);
  }
});

/* ───────────────────────── the manifest row of the EU list carries the act numbers of the file's year ───────────────────────── */

test("--fetch --only=EU records in the EU row the distinct act numbers of the file's year (public, short), and none of another year", () => {
  const eu = flux([
    entite(1, [ACTE_RUSSIE, ], [RESUME_ANCIEN]), entite(2, [ACTE_ANCIEN], [{ numberTitle: "2026/87 (OJ L202600087)", publicationDate: "2026-01-09" }]),
    entite(3, [ACTE_A_FLUX, ACTE_B_FLUX]), entite(4, [{ numberTitle: "2026/9001 (OJ L202609001)", publicationDate: "2026-06-10" }]),
  ]);
  const r = lancerGuet({ eu, args: ["--fetch", "--only=EU"], dansLaRacine: true });
  assert.equal(r.statut, 0, r.sortie + r.erreurs);
  const manifeste = JSON.parse(r.fichiers["listes-manifest.json"]!) as { listes: { source: string; actes?: string[] }[] };
  const ligne = manifeste.listes.find((l) => l.source === "EU")!;
  assert.deepEqual(ligne.actes, ["2026/87", "2026/431", "2026/9001", "2026/9002"], "numeric order, each once, the year of the generationDate only");
  assert.equal(r.requetes.filter((q) => new URL(q.url).host === SPARQL_HOTE).length, 0, "a fetch does not ask the catalogue");
});

test("actesDeLAnnee: the year is the file's generation year, read not typed; no generationDate gives none, a year with no act gives an empty list", () => {
  assert.deepEqual(Actes.actesDeLAnnee(fluxAvecActe()), ["2026/431", "2026/2193"]);
  assert.deepEqual(Actes.actesDeLAnnee(flux([entite(1, [ACTE_ANCIEN])])), [], "a file generated in 2026 that names no 2026 act");
  assert.equal(Actes.actesDeLAnnee(flux([entite(1, [ACTE_RUSSIE])], null)), null, "no generationDate: no year to take");
  assert.deepEqual(Actes.actesDeLAnnee(flux([entite(1, [ACTE_RUSSIE])], "2027-01-05T10:00:00")), [], "in 2027 the 2026 acts are not this year's");
  assert.equal(Actes.actesDeLAnnee("not xml"), null);
});

/* ───────────────────────── the pure parts, offline ───────────────────────── */

test("numeroDeCelex reads the CELEX of a regulation or a decision as year/number and refuses every other shape; debutDeFenetre steps back by the margin and across a month", () => {
  assert.equal(Actes.numeroDeCelex("32026R2193"), "2026/2193");
  assert.equal(Actes.numeroDeCelex("32026R0431"), "2026/431");
  assert.equal(Actes.numeroDeCelex("32026R0007"), "2026/7");
  assert.equal(Actes.numeroDeCelex("32026D0431"), "2026/431", "a decision is asked too: the file names some by their number");
  for (const mauvais of ["", "32026R2193R(01)", "32026L0431", "02014R0833-20260724", "32026R", "3202R2193", "32026r2193", "32026R2193 ", "x32026R2193", "32026R21a3"]) {
    assert.equal(Actes.numeroDeCelex(mauvais), null, JSON.stringify(mauvais));
  }
  assert.equal(Actes.debutDeFenetre("2026-06-12"), debutAttendu());
  assert.equal(Actes.debutDeFenetre("2026-03-03", 5), "2026-02-26");
  assert.equal(Actes.debutDeFenetre("2026-01-02", 7), "2025-12-26", "across a year");
  assert.throws(() => Actes.debutDeFenetre("2026-02-30"), /day/, "an impossible day is refused, not rolled into March");
  assert.throws(() => Actes.requeteCatalogue('2026-01-01"^^xsd:date) } # injected'), /day/, "the question takes a day and nothing else");
});

test("lireReponseCatalogue: strict JSON, a row cap, rows read one by one; what it cannot read is returned, not hidden", () => {
  const ok = Actes.lireReponseCatalogue(reponseCatalogue([CAT_A, CAT_C]));
  assert.ok(!("refus" in ok));
  if ("refus" in ok) return;
  assert.deepEqual(ok.actes.map((a) => a.numero), ["2026/9001", "2026/9003"]);
  assert.deepEqual(ok.illisibles, []);
  for (const mauvais of ["", "x", "{", "null", "[]", "{}", '{"results":{}}', '{"results":{"bindings":"no"}}', `{"results":{"bindings":[]}}x`]) {
    assert.ok("refus" in Actes.lireReponseCatalogue(mauvais), JSON.stringify(mauvais));
  }
  const vide = Actes.lireReponseCatalogue(reponseCatalogue([]));
  assert.ok(!("refus" in vide) && vide.actes.length === 0, "an empty list is read as empty; whether that proves anything is for the comparison");
  const rangs = Array.from({ length: Actes.LIMITE_LIGNES_CATALOGUE + 1 }, (_, i) => ({ celex: `32026R${String(1000 + i).padStart(4, "0")}`, date: "2026-07-01", title: "restrictive measures" }));
  assert.ok("refus" in Actes.lireReponseCatalogue(reponseCatalogue(rangs)), "one row over the limit may mean a cut answer");
  assert.ok(!("refus" in Actes.lireReponseCatalogue(reponseCatalogue(rangs.slice(1)))), "the limit itself is read");
  const gros = " ".repeat(Actes.PLAFOND_OCTETS_CATALOGUE + 1);
  assert.ok("refus" in Actes.lireReponseCatalogue(reponseCatalogue([CAT_A]) + gros), "a text past the cap is refused even when it would parse");
  /* the values are data: a binding whose value is not text, or a row that is not an object, is a row that cannot be read */
  const etrange = Actes.lireReponseCatalogue(JSON.stringify({ results: { bindings: [{ celex: { value: 32026 }, title: { value: "t" }, date: { value: "2026-01-01" } }, "oops", null, { celex: { value: "32026R9001" }, title: { value: "restrictive measures" }, date: { value: "2026-06-10" } }] } }));
  assert.ok(!("refus" in etrange));
  if ("refus" in etrange) return;
  assert.equal(etrange.actes.length, 1);
  assert.equal(etrange.illisibles.length, 3);
});

test("controler: it can say 'nothing missing' only when an act of the answer is proven named by the file; the exit code follows", () => {
  const q = Actes.preparerQuestion(fluxGuet());
  assert.ok(!("refus" in q));
  if ("refus" in q) return;
  assert.equal(q.debut, debutAttendu());
  assert.equal(q.newestPublicationDate, "2026-06-12");
  assert.equal(q.generationDate, "2026-10-12");
  const cas: [string, string, number][] = [
    ["one absent", reponseCatalogue([CAT_A, CAT_B, CAT_C]), 1],
    ["all named", reponseCatalogue([CAT_A, CAT_B]), 0],
    ["no row", reponseCatalogue([]), 2],
    ["only unreadable rows", reponseCatalogue([{ celex: "bad", date: "2026-01-01", title: "t" }]), 2],
    ["one named, one unreadable", reponseCatalogue([CAT_A, { celex: "bad", date: "2026-01-01", title: "t" }]), 2],
    ["one absent and one unreadable", reponseCatalogue([CAT_A, CAT_C, { celex: "bad", date: "2026-01-01", title: "t" }]), 1],
  ];
  for (const [nom, reponse, code] of cas) {
    const c = Actes.controler(q, reponse);
    assert.ok(!("refus" in c), nom);
    if ("refus" in c) continue;
    assert.equal(Actes.codeDeSortie(c), code, nom);
  }
  assert.ok("refus" in Actes.controler(q, "not json"));
  assert.ok("refus" in Actes.preparerQuestion(""), "a text that is not a complete EU file gives no question");
  assert.ok("refus" in Actes.preparerQuestion(flux([entite(1, [{ numberTitle: "2026/1 (OJ L1)", publicationDate: "2026-12-31" }])])), "dates that cannot be trusted give no question");
});

/* ───────────────────────────────────────────────────────────────────────────────────────────────
 * AFTER THE REVIEW OF 1f12f6b: a partial answer must not read as a complete one, a duplicate number must be said, the day file's
 * other keys must keep their bytes, and the documents must name what the command records.
 * ─────────────────────────────────────────────────────────────────────────────────────────────── */

test("an answer the Office flags as partial is refused whatever its body says: X-SQL-State, X-SQL-Message, or any header named partial or truncated is exit 2, nothing written", () => {
  /* the body is a COMPLETE-LOOKING answer that would read as 'all present, exit 0': only the headers can refuse it */
  const complete = reponseCatalogue([CAT_A, CAT_B]);
  const controle = lancerGuet({ reponse: complete });
  assert.equal(controle.statut, 0, `the same body without a flag is exit 0, so a refusal below is the header's: ${controle.erreurs}`);
  for (const [mode, entete] of [["partial-sql", "x-sql-"], ["partial-name", "x-result-partial"], ["truncated-name", "x-results-truncated"], ["warning", "warning"], ["content-range", "content-range"]] as const) {
    const r = lancerGuet({ reponse: complete, mode });
    assert.equal(r.statut, 2, `${mode}: exit ${r.statut}\n${r.sortie}${r.erreurs}`);
    assert.match(r.erreurs, /partial/i, mode);
    assert.ok(r.erreurs.toLowerCase().includes(entete), `${mode}: the header is named (${entete})`);
    assert.doesNotMatch(r.sortie, /Every act|no act is missing/i, mode);
    assert.deepEqual(r.fichiers, {}, `${mode}: nothing written`);
  }
  assert.equal(Actes.enteteDePartiel(["content-type", "date"]), null);
  assert.equal(Actes.enteteDePartiel(["content-type", "X-SQL-Message"]), "X-SQL-Message");
  assert.equal(Actes.enteteDePartiel(["x-Is-Partial-Content"]), "x-Is-Partial-Content");
  assert.equal(Actes.enteteDePartiel(["x-truncated"]), "x-truncated");
  assert.equal(Actes.enteteDePartiel(["Warning"]), "Warning", "a Warning header says the answer is not the plain one");
  assert.equal(Actes.enteteDePartiel(["date", "Content-Range"]), "Content-Range", "a Content-Range header says it is a part");
  assert.equal(Actes.enteteDePartiel(["accept-ranges", "content-disposition"]), null, "the headers the Office sends on a whole answer are not flags");
});

test("the canary: every act the file carries that is dated on its newest publication day must be in the answer, else exit 2 'answer incomplete' naming them, even when an act is absent", () => {
  /* the feed carries two acts on its newest day, 2026/9001 and 2026/9004; the answer holds only the first */
  const deuxCanaris = flux([entite(1, [ACTE_A_FLUX]), entite(2, [ACTE_B_FLUX]), entite(3, [{ numberTitle: "2026/9004 (OJ L202609004)", publicationDate: "2026-06-12", programme: "RUS" }])]);
  const CAT_D: LigneCatalogue = { celex: "32026D9004", date: "2026-06-12", title: "Council Decision (CFSP) 2026/9004 concerning restrictive measures in view of the situation in Examplia" };
  const entiere = lancerGuet({ eu: deuxCanaris, reponse: reponseCatalogue([CAT_A, CAT_B, CAT_D]) });
  assert.equal(entiere.statut, 0, `the control: both canary acts present, nothing absent: ${entiere.erreurs}`);
  for (const [reponse, absentsVus] of [[reponseCatalogue([CAT_A, CAT_B]), 0], [reponseCatalogue([CAT_A, CAT_B, CAT_C]), 1]] as const) {
    const r = lancerGuet({ eu: deuxCanaris, reponse });
    assert.equal(r.statut, 2, `exit ${r.statut}\n${r.sortie}${r.erreurs}`);
    assert.match(r.erreurs, /answer incomplete/i);
    assert.match(r.erreurs, /2026\/9004/, "the missing canary act is named");
    assert.doesNotMatch(r.erreurs, /2026\/9001\b/, "the canary act the answer does hold is not named as missing");
    assert.match(r.erreurs, /2026-06-12/, "the day it is judged on is said");
    assert.deepEqual(r.fichiers, {}, "the day file is not written on an incomplete answer");
    /* an absent act is a true finding even from an answer that lost rows (it can lose rows, it cannot invent an act): shown, and labelled */
    assert.equal(lignesAbsent(r.sortie).length, absentsVus, `the absent acts of an incomplete answer are shown: ${r.sortie}`);
    assert.doesNotMatch(r.sortie, /Every act|no act is missing/i);
    if (absentsVus > 0) {
      const lignes = r.sortie.split("\n");
      const etiquette = lignes.findIndex((l) => l.startsWith("INCOMPLETE ANSWER"));
      assert.ok(etiquette >= 0, `the report says it comes from an incomplete answer: ${r.sortie}`);
      assert.ok(etiquette < lignes.findIndex((l) => l.startsWith("ABSENT ")), "the label comes before the acts");
      assert.match(lignesAbsent(r.sortie)[0]!, /^ABSENT 2026\/9003 \(CELEX 32026R9003, 2026-09-28\)/);
    } else {
      assert.ok(!r.sortie.includes("INCOMPLETE ANSWER"), "nothing to label when nothing is absent");
    }
  }
  /* the pure functions agree */
  const q = Actes.preparerQuestion(deuxCanaris);
  assert.ok(!("refus" in q));
  if ("refus" in q) return;
  const c = Actes.controler(q, reponseCatalogue([CAT_A, CAT_B]));
  assert.ok(!("refus" in c));
  if ("refus" in c) return;
  assert.deepEqual(c.canari, { jour: "2026-06-12", total: 2, manquants: ["2026/9004"] });
  assert.equal(Actes.codeDeSortie(c), 2);
  assert.match(Actes.refusDuControle(c) ?? "", /answer incomplete/i);
  /* a file whose newest-day act has no act number in its title has nothing to check: no canary, no refusal on that account */
  const sansNumero = flux([entite(1, [{ numberTitle: "UNLI 26.03.2026 - 2", publicationDate: "2026-06-12" }]), entite(2, [ACTE_B_FLUX])]);
  const q2 = Actes.preparerQuestion(sansNumero);
  assert.ok(!("refus" in q2));
  if ("refus" in q2) return;
  const c2 = Actes.controler(q2, reponseCatalogue([CAT_B]));
  assert.ok(!("refus" in c2));
  if ("refus" in c2) return;
  assert.deepEqual(c2.canari, { jour: "2026-06-12", total: 0, manquants: [] });
});

test("two CELEX with one act number (a regulation and a decision numbered alike) are said in a NOTE: the match is on the number, so one carried number would hide both", () => {
  const DECISION: LigneCatalogue = { celex: "32026D9003", date: "2026-09-28", title: "Council Decision (CFSP) 2026/9003 concerning restrictive measures in view of the situation in Examplia" };
  /* both absent: both listed, and the shared number said */
  const absents = lancerGuet({ reponse: reponseCatalogue([CAT_A, CAT_C, DECISION]) });
  assert.equal(absents.statut, 1, absents.erreurs);
  assert.equal(lignesAbsent(absents.sortie).length, 1, "only the implementing regulation is listed; the decision is counted");
  assert.ok(absents.sortie.split("\n").some((l) => l.startsWith("OTHER 1 act(s)")), absents.sortie);
  const notes = absents.sortie.split("\n").filter((l) => l.startsWith("NOTE "));
  assert.equal(notes.length, 1, absents.sortie);
  assert.match(notes[0]!, /2026\/9003/);
  assert.match(notes[0]!, /32026D9003/);
  assert.match(notes[0]!, /32026R9003/);
  assert.match(notes[0]!, /one carried number would hide both|hide both/i);
  /* the feed carries the number: neither is reported, and the NOTE is still printed, which is the tripwire */
  const portes = lancerGuet({ reponse: reponseCatalogue([CAT_A, { ...CAT_A, celex: "32026D9001", title: "Council Decision (CFSP) 2026/9001 concerning restrictive measures" }]) });
  assert.equal(portes.statut, 0, portes.erreurs);
  assert.ok(portes.sortie.split("\n").some((l) => l.startsWith("NOTE ") && l.includes("32026D9001") && l.includes("32026R9001")), portes.sortie);
  /* no number shared, no note */
  assert.ok(!lancerGuet().sortie.split("\n").some((l) => l.startsWith("NOTE ")));
});

/* ───────────────────────── the day file keeps the bytes of every key but its own ───────────────────────── */

const ABSENT_A: Actes.ActeCatalogue = { celex: "32026R9003", numero: "2026/9003", titre: "An invented act", date: "2026-09-28" };

/** A day file as the listes role writes it by hand: four-space indent, a number past what a double holds, escapes, an odd block. */
const A_LA_MAIN = [
  "{",
  '    "hash": "abc",',
  '    "octets": 12345678901234567890,',
  '    "ue_2193": {',
  '        "note":   "d\\u00e9j\\u00e0 vu",',
  '        "figures": [1.0, 2.50, 1e3, 12345678901234567890],',
  '        "vide": {}',
  "    },",
  '    "fin": null',
  "}",
  "",
].join("\n");

function avecDossier<T>(f: (racine: string) => T): T {
  const racine = realpathSync(mkdtempSync(join(tmpdir(), "jour-ue-")));
  try { return f(racine); } finally { rmSync(racine, { recursive: true, force: true }); }
}
const poser = (racine: string, jour: string, contenu: string): string => {
  mkdirSync(join(racine, "donnees", "listes"), { recursive: true });
  writeFileSync(join(racine, "donnees", "listes", `${jour}.json`), contenu);
  return join(racine, "donnees", "listes", `${jour}.json`);
};

test("a day file written by hand keeps every byte of its other keys: indent, a number past a double, escapes and the whole ue_2193 block; only actes_absents is added or replaced", () => {
  avecDossier((racine) => {
    /* added: the original text is a prefix of the new one up to its last member, and its closing is untouched */
    const chemin = poser(racine, "2026-10-14", A_LA_MAIN);
    const r = Actes.ecrireActesAbsents(racine, "2026-10-14", [ABSENT_A]);
    assert.ok(!("refus" in r), JSON.stringify(r));
    const apres = readFileSync(chemin, "utf8");
    const coupe = A_LA_MAIN.indexOf('"fin": null') + '"fin": null'.length;
    assert.ok(apres.startsWith(A_LA_MAIN.slice(0, coupe)), "every byte up to the last member is the original's");
    assert.ok(apres.endsWith("\n}\n"), "the closing is the original's");
    assert.ok(apres.includes('"octets": 12345678901234567890,'), "the large number is not rounded");
    assert.ok(apres.includes(A_LA_MAIN.slice(A_LA_MAIN.indexOf('    "ue_2193"'), A_LA_MAIN.indexOf('    "fin"'))), "the ue_2193 block is byte-identical");
    const lu = JSON.parse(apres) as Record<string, unknown>;
    assert.deepEqual(lu["actes_absents"], [{ celex: "32026R9003", numero: "2026/9003", titre: "An invented act", date: "2026-09-28" }]);
    assert.deepEqual(Object.keys(lu), ["hash", "octets", "ue_2193", "fin", "actes_absents"]);
    /* replaced: only the value changes, the bytes before and after it are the previous text's */
    const r2 = Actes.ecrireActesAbsents(racine, "2026-10-14", []);
    assert.ok(!("refus" in r2));
    const encore = readFileSync(chemin, "utf8");
    const i = apres.indexOf('"actes_absents": ') + '"actes_absents": '.length;
    assert.equal(encore.slice(0, i), apres.slice(0, i), "everything before the value is the previous text's");
    assert.equal(encore.slice(i), "[]\n}\n", "the value is replaced and the closing is untouched");
    /* replaced in the middle of the object: the keys after it are untouched too */
    const milieu = '{\n  "a": 1,\n  "actes_absents": [ "old",\n    "list" ],\n  "z":   99999999999999999999\n}';
    const chemin2 = poser(racine, "2026-10-15", milieu);
    assert.ok(!("refus" in Actes.ecrireActesAbsents(racine, "2026-10-15", [ABSENT_A])));
    const t = readFileSync(chemin2, "utf8");
    assert.ok(t.startsWith('{\n  "a": 1,\n  "actes_absents": ['), t);
    assert.ok(t.endsWith(',\n  "z":   99999999999999999999\n}'), "the key after it keeps its spaces and its large number");
  });
});

test("the day file in other shapes: a one-line object, an empty object, a file with no final newline, a duplicated key; a file that cannot be merged without a rewrite is left alone", () => {
  avecDossier((racine) => {
    for (const [nom, original] of Object.entries({ "inline": '{"a":1,"b":[1,2]}', "empty": "{}", "empty and spaced": "{\n}\n", "no final newline": '{\n  "a": 1\n}', "trailing spaces": '{ "a" : 1 }  \n\n' })) {
      const chemin = poser(racine, "2026-10-14", original);
      const r = Actes.ecrireActesAbsents(racine, "2026-10-14", [ABSENT_A]);
      assert.ok(!("refus" in r), `${nom}: ${JSON.stringify(r)}`);
      const apres = readFileSync(chemin, "utf8");
      const lu = JSON.parse(apres) as Record<string, unknown>;
      assert.equal((lu["actes_absents"] as unknown[]).length, 1, nom);
      const avant = JSON.parse(original) as Record<string, unknown>;
      for (const [k, v] of Object.entries(avant)) assert.deepEqual(lu[k], v, `${nom}: ${k}`);
      if (nom === "inline") assert.ok(apres.startsWith('{"a":1,"b":[1,2], "actes_absents": '), apres);
    }
    /* a key given twice: the one JSON.parse reads is the one replaced */
    const chemin = poser(racine, "2026-10-16", '{\n  "actes_absents": [1],\n  "x": 2,\n  "actes_absents": [2]\n}\n');
    assert.ok(!("refus" in Actes.ecrireActesAbsents(racine, "2026-10-16", [])));
    const t = readFileSync(chemin, "utf8");
    assert.equal(t, '{\n  "actes_absents": [1],\n  "x": 2,\n  "actes_absents": []\n}\n');
  });
});

test("a day that is not a day writes nothing: '../escape', a bad date and an empty string are refused before any path is built", () => {
  avecDossier((racine) => {
    for (const mauvais of ["../escape", "../../escape", "2026-13-45", "2026-02-30", "", "2026-10-14/../x", "2026-10-1", "2026-10-14 "]) {
      const r = Actes.ecrireActesAbsents(racine, mauvais, [ABSENT_A]);
      assert.ok("refus" in r, JSON.stringify(mauvais));
      assert.deepEqual(readdirSync(racine), [], `${JSON.stringify(mauvais)}: nothing was created under the root`);
      assert.ok(!existsSync(join(racine, "..", "escape.json")), "nothing outside the root either");
    }
  });
});

test("a day file that begins with a byte order mark is refused with that reason and left byte for byte as it was", () => {
  avecDossier((racine) => {
    mkdirSync(join(racine, "donnees", "listes"), { recursive: true });
    const chemin = join(racine, "donnees", "listes", "2026-10-14.json");
    const octets = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('{"a":1}')]);
    writeFileSync(chemin, octets);
    const r = Actes.ecrireActesAbsents(racine, "2026-10-14", [ABSENT_A]);
    assert.ok("refus" in r, JSON.stringify(r));
    if (!("refus" in r)) return;
    assert.match(r.refus, /byte order mark/i, "the reason is the mark, not 'not a JSON object'");
    assert.doesNotMatch(r.refus, /not a JSON object/);
    assert.ok(readFileSync(chemin).equals(octets), "the file is as it was");
  });
});

test("a day file that is not valid UTF-8 is refused and left byte for byte as it was: no other key's bytes are replaced by U+FFFD", () => {
  avecDossier((racine) => {
    mkdirSync(join(racine, "donnees", "listes"), { recursive: true });
    const chemin = join(racine, "donnees", "listes", "2026-10-14.json");
    const octets = Buffer.concat([Buffer.from('{"a": "'), Buffer.from([0xff, 0xfe, 0xe9]), Buffer.from('", "b": 1}\n')]);
    writeFileSync(chemin, octets);
    const r = Actes.ecrireActesAbsents(racine, "2026-10-14", [ABSENT_A]);
    assert.ok("refus" in r, JSON.stringify(r));
    if (!("refus" in r)) return;
    assert.match(r.refus, /UTF-8/);
    assert.ok(readFileSync(chemin).equals(octets), "the file is as it was, its odd bytes included");
  });
});

/* ───────────────────────── the documents name what the command records, and the local data stays out of git ───────────────────────── */

test("README and DATA-FLOW name the EU row's actes field (one line per act number of the file's year, not bounded), the partial-answer refusal and the canary", () => {
  const lire = (...p: string[]) => readFileSync(join(ICI, "..", ...p), "utf8");
  for (const [nom, texte] of [["README.md", lire("README.md")], ["doc/DATA-FLOW.md", lire("doc", "DATA-FLOW.md")]] as const) {
    assert.match(texte, /`actes`/, `${nom} names the field`);
    assert.match(texte, /one line per/i, `${nom} says how long the field is`);
    assert.match(texte, /partial/i, `${nom} says that a partial answer is refused`);
    assert.match(texte, /answer incomplete|incomplete answer|newest publication day/i, `${nom} says the canary`);
  }
  assert.match(lire("doc", "DATA-FLOW.md"), /single (?:Journal )?numbering|one number per act|numbers? acts? in one sequence/i, "DATA-FLOW states the reliance on one number per act");
  const dataFlow = lire("doc", "DATA-FLOW.md");
  assert.match(dataFlow, /canary[^.]*brittle|brittle[^.]*canary/i, "DATA-FLOW says the canary is brittle");
  assert.match(dataFlow, /1210\/2003/, "and names the act whose title it cannot return");
  assert.match(dataFlow, /Warning/, "and the Warning and Content-Range headers");
});

test("donnees/ is ignored by git, so the output of --actes cannot be added by a careless `git add`", (t) => {
  const r = spawnSync("git", ["check-ignore", "-q", "--", "donnees/listes/2026-10-14.json"], { cwd: join(ICI, ".."), encoding: "utf8", timeout: 30_000 });
  if (r.error !== undefined || r.status === 128) return t.skip("git cannot check ignore rules here");
  assert.equal(r.status, 0, "donnees/ is not in .gitignore");
});

test("no file under donnees/ is tracked: the output of --actes is local data, and a commit that adds it turns the suite red", (t) => {
  const r = spawnSync("git", ["ls-files", "--", "donnees"], { cwd: join(ICI, ".."), encoding: "utf8", timeout: 30_000 });
  if (r.error !== undefined || r.status !== 0) return t.skip("git cannot list the files here");
  assert.equal(r.stdout.trim(), "", "tracked files under donnees/: remove them from the index (git rm --cached) or keep the folder out of the commit");
});
