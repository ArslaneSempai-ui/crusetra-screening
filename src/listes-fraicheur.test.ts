/*
 * THE EU LIST IS STALE ONLY WHEN THE EU FEED OR THE CLOCK SAYS SO, NEVER BECAUSE THE EU HAD NOTHING TO PUBLISH.
 *
 * The rule (src/fraicheur-ue.ts): the EU file is stale when (a) the EU feed announces a file published more than
 * TOLERANCE_APRES_GENERATION_UE_JOURS days after the generationDate of the file we hold, or (b) its generationDate is more
 * than SEUIL_RETARD_UE_JOURS days before the day of the run (the daily update failed), or (c) a date in it cannot be
 * trusted. The first version of this file judged the gap between the newest publicationDate and the generationDate; a
 * quiet quarter (the file generated on 12 October 2026 held nothing published after 23 July) would have refused a client
 * for nothing, so that rule is gone.
 *
 * WHY THE FEED IS COMPARED WITH THE GENERATION DATE AND NOT WITH THE NEWEST publicationDate. The feed was read on 14 October
 * 2026 to learn its shape: its items are the published FILES, one per format (PDF, CSV, XML), each with a pubDate that is
 * the moment the file was published, and a link whose path names the file. The item of the XML v1.1 file was published on
 * 12 October 2026, 33 minutes after the generationDate of the file we hold, and carried the SHA-1 of its bytes, which is
 * the SHA-1 of the file on disk. The feed announces no regulation publication, so a date in it can only be compared with
 * the generationDate: compared with the newest publicationDate (23 July) it would be "newer" on every download.
 * Every fixture below is built by hand in that shape; none copies the feed.
 *
 * The cases that run the real command (`--fetch --only=EU`) do it in a throwaway copy of the modules it needs, with a FAKE
 * token and a `fetch` that never touches the network (the harness of listes-jeton.test.ts), then read what the run left
 * behind. The manifest row records the inputs of the rule (`fraicheur`) and, when the rule holds, the existing
 * `avertissement` field says so; the row stays available. The clock of the rule is a parameter in every case that
 * is not a run of the command, so the limit is tested at the day.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  enregistrerFraicheurUe, jourDe, jugerFraicheurUe, lireDatesUe, SEUIL_RETARD_UE_JOURS, TOLERANCE_APRES_GENERATION_UE_JOURS, type FraicheurEnregistree,
} from "./fraicheur-ue.ts";
import { analyserRssUe, refusFraicheurUe, URL_RSS_UE, type LigneManifeste, type Manifeste } from "./listes.ts";

const FAUX_JETON = "FAKE-TOKEN-0000";
const ICI = fileURLToPath(new URL(".", import.meta.url));
const SCRIPT = join(ICI, "..", "scripts", "fraicheur-ue.mjs");
const URL_UE_ECRITE = "https://webgate.ec.europa.eu/fsd/fsf/public/files/xmlFullSanctionsList_1_1/content?token=[username]";

const JOUR_MS = 24 * 60 * 60 * 1000;
/** The day `jours` days before `depuis` (after it when negative). */
const avant = (jours: number, depuis: string): string => new Date(Date.parse(depuis) - jours * JOUR_MS).toISOString().slice(0, 10);
/** The clock of a case: that day, in the morning (UTC). */
const horloge = (jour: string): Date => new Date(`${jour}T09:00:00Z`);

/** The day the file in the shape of 12 October 2026 says it was generated. */
const GENERATION = "2026-10-12";

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

/** One item of the feed, in the shape of the real one: the title of the format, a link whose path names the file, the moment of publication. */
const item = (titre: string, fichier: string, jour: string): string => [
  `    <item>`,
  `      <title>${titre}</title>`,
  `      <link>https://webgate.ec.europa.eu/fsd/fsf/public/files/${fichier}/content?token=[username]</link>`,
  `      <pubDate>${new Date(`${jour}T11:00:23Z`).toUTCString()}</pubDate>`,
  `    </item>`,
].join("\n");

/** A feed with the XML v1.1 item published on `v11` (absent when null) and the other formats on `autres`. */
const rssUe = (v11: string | null, autres: string = GENERATION): string => [
  `<?xml version="1.0" encoding="UTF-8"?>`,
  `<rss version="2.0">`,
  `  <channel>`,
  `    <title>Hand-built feed of the EU sanctions files</title>`,
  `    <link>${URL_RSS_UE}</link>`,
  item("PDF - v1.0", "pdfFullSanctionsList", autres),
  ...(v11 === null ? [] : [item("XML (Based on XSD) - v1.1", "xmlFullSanctionsList_1_1", v11)]),
  item("XML (Based on XSD) - v1.0", "xmlFullSanctionsList", autres),
  `  </channel>`,
  `</rss>`,
  ``,
].join("\n");

/** The recorded inputs of a row. */
const ligne = (gen: string | null, pub: string | null, rss: string | null, plus: Partial<FraicheurEnregistree> = {}): FraicheurEnregistree =>
  ({ fichierGenereLe: gen, fichierPublieLe: pub, rssAnnonceLe: rss, ...plus });

/* ───────────────────────────── the file's own dates ───────────────────────────── */

test("the file's dates: the newest publicationDate of the file, not the first, and the generationDate", () => {
  const xml = avecPublications(xmlUe(GENERATION, avant(30, GENERATION)), avant(1, GENERATION), avant(60, GENERATION));
  assert.deepEqual(lireDatesUe(xml), { gen: GENERATION, max: avant(1, GENERATION) });
});

test("the file's dates: a gap of any size between publication and generation is not a defect (a quiet quarter is not a frozen feed)", () => {
  assert.deepEqual(lireDatesUe(xmlUe(GENERATION, "2026-07-23")), { gen: GENERATION, max: "2026-07-23" }, "the shape of 12 October 2026: 81 days apart, nothing wrong");
});

test("the file's dates: a publication later than the generation by more than the tolerance is a defect with the dates named, not a negative gap that hides a frozen feed", () => {
  for (const stray of ["2062-07-23", "2099-01-01", "9999-12-31"]) {
    const d = lireDatesUe(avecPublications(xmlUe(GENERATION, "2026-07-23"), stray));
    assert.equal(d.max, stray);
    assert.match(d.defaut ?? "", /publication date later than generation date/, stray);
    assert.ok(d.defaut!.includes(stray) && d.defaut!.includes(GENERATION), `${stray}: the defect names both dates: ${d.defaut}`);
  }
});

test("the file's dates: a publication exactly the tolerance after the generation date stays trusted, one day more is a defect", () => {
  assert.equal(lireDatesUe(xmlUe(GENERATION, avant(-TOLERANCE_APRES_GENERATION_UE_JOURS, GENERATION))).defaut, undefined);
  assert.match(lireDatesUe(xmlUe(GENERATION, avant(-TOLERANCE_APRES_GENERATION_UE_JOURS - 1, GENERATION))).defaut ?? "", /publication date later than generation date/);
});

test("the file's dates: one impossible publicationDate that sorts highest neither hides a fresh one nor turns the verdict into 'unreadable'", () => {
  const d = lireDatesUe(avecPublications(xmlUe(GENERATION, avant(40, GENERATION)), avant(1, GENERATION), "2026-13-45"));
  assert.deepEqual(d, { gen: GENERATION, max: avant(1, GENERATION) }, "the newest VALID date is taken and nothing is flagged");
});

test("the file's dates: with no valid publicationDate the defect names the invalid values", () => {
  const d = lireDatesUe(avecPublications(xmlUe(GENERATION, "2026-13-45"), "2026-02-30"));
  assert.equal(d.max, null);
  assert.ok(d.defaut!.includes("2026-13-45") && d.defaut!.includes("2026-02-30"), `the invalid values are named: ${d.defaut}`);
});

test("the file's dates: a publicationDate in datetime form is read by its date part, as the generationDate is; a malformed one is invalid, not missing", () => {
  for (const forme of ["2026-10-10T08:15:00", "2026-10-10T08:15:00.000+02:00", "2026-10-10T06:15:00Z"]) {
    assert.deepEqual(lireDatesUe(xmlUe(GENERATION, forme)), { gen: GENERATION, max: "2026-10-10" }, forme);
  }
  const d = lireDatesUe(xmlUe(GENERATION, "2026-10-10Tnoon"));
  assert.ok(d.defaut!.includes("2026-10-10Tnoon"), `the malformed value is named: ${d.defaut}`);
});

test("the file's dates fail closed: a missing date, an impossible day and an out-of-range month are a defect with a reason, never trusted", () => {
  const cas: [string, string][] = [
    ["no dates at all", xmlUe(null, null)],
    ["no generationDate", xmlUe(null, avant(1, GENERATION))],
    ["no publicationDate", xmlUe(GENERATION, null)],
    /* V8 reads 30 February as 2 March: against a generationDate of 5 March that is 3 days, and "fresh". It is not a day. */
    ["an impossible calendar day", xmlUe("2026-03-05", "2026-02-30")],
    ["a month that does not exist", xmlUe(GENERATION, "2026-13-45")],
  ];
  for (const [nom, xml] of cas) {
    const d = lireDatesUe(xml);
    assert.ok(typeof d.defaut === "string" && d.defaut.length > 0, `${nom}: the defect is given`);
  }
});

/* ───────────────────────────── the rule, on the recorded inputs and an injected clock ───────────────────────────── */

test("a quiet week: the feed and the file agree, nothing was published for ten days, the file was generated yesterday: not stale", () => {
  const aujourdhui = "2026-10-14";
  const gen = avant(1, aujourdhui);
  const f = enregistrerFraicheurUe(xmlUe(gen, avant(10, gen)), { jour: gen });
  assert.deepEqual(f, { fichierGenereLe: gen, fichierPublieLe: avant(10, gen), rssAnnonceLe: gen });
  assert.deepEqual(jugerFraicheurUe(f, horloge(aujourdhui)), { perime: false, motifs: [], ageJours: 1 });
});

test("(a) the feed announces a file newer than the one we hold: stale, the reason names both dates", () => {
  const gen = "2026-10-08";
  const v = jugerFraicheurUe(ligne(gen, "2026-07-23", "2026-10-12"), horloge("2026-10-14"));
  assert.equal(v.perime, true);
  assert.equal(v.ageJours, 6, "by the clock alone this file is within the limit: only the feed makes it stale");
  assert.equal(v.motifs.length, 1);
  assert.ok(v.motifs[0]!.includes("2026-10-12") && v.motifs[0]!.includes(gen), `the reason names the announced date and the generation date: ${v.motifs[0]}`);
});

test("(a) the feed's date exactly the tolerance after the generation date is the publication delay, not a newer file; one day more is", () => {
  const gen = "2026-10-08";
  assert.equal(jugerFraicheurUe(ligne(gen, "2026-07-23", avant(-TOLERANCE_APRES_GENERATION_UE_JOURS, gen)), horloge("2026-10-10")).perime, false);
  assert.equal(jugerFraicheurUe(ligne(gen, "2026-07-23", avant(-TOLERANCE_APRES_GENERATION_UE_JOURS - 1, gen)), horloge("2026-10-10")).perime, true);
});

test("(a) the feed and the file on the same day, the real shape of 14 October 2026 (generated 12 October, newest publication 23 July): not stale", () => {
  const v = jugerFraicheurUe(ligne("2026-10-12", "2026-07-23", "2026-10-12"), horloge("2026-10-14"));
  assert.deepEqual(v, { perime: false, motifs: [], ageJours: 2 });
});

test("(a) the realistic lag of 14 October 2026: the file was generated 28 September, the feed announces a file of 12 October: stale, naming both", () => {
  const v = jugerFraicheurUe(ligne("2026-09-28", "2026-07-23", "2026-10-12"), horloge("2026-10-14"));
  assert.equal(v.perime, true);
  assert.ok(v.motifs.some((m) => m.includes("2026-10-12") && m.includes("2026-09-28") && /feed/.test(m)), `the feed reason names both dates: ${v.motifs.join(" | ")}`);
});

test("(a) a feed announcement OLDER than the file we hold proves nothing about a lag: not stale (the numbers of the brief, 28 September against a file of 12 October)", () => {
  /* The brief wrote this case as a refusal. It cannot be one: the feed lists the file as it stands, so an older date than
     our file's own generation means the feed is behind us, not that we are behind it. */
  assert.equal(jugerFraicheurUe(ligne("2026-10-12", "2026-07-23", "2026-09-28"), horloge("2026-10-14")).perime, false);
});

test("(b) the update failed: a file generated one day more than the limit before the day of the run is stale, the reason names its date; exactly the limit is not", () => {
  const aujourdhui = "2026-10-20";
  for (const [jours, perime] of [[SEUIL_RETARD_UE_JOURS - 1, false], [SEUIL_RETARD_UE_JOURS, false], [SEUIL_RETARD_UE_JOURS + 1, true]] as const) {
    const gen = avant(jours, aujourdhui);
    const v = jugerFraicheurUe(ligne(gen, avant(jours + 5, aujourdhui), gen), horloge(aujourdhui));
    assert.equal(v.perime, perime, `${jours} days`);
    assert.equal(v.ageJours, jours);
    if (perime) assert.ok(v.motifs[0]!.includes(gen) && v.motifs[0]!.includes(aujourdhui) && v.motifs[0]!.includes(`${SEUIL_RETARD_UE_JOURS} days`), `the reason names the generation day, the day of the run and the limit: ${v.motifs[0]}`);
  }
});

test("(b) the clock is read in UTC days: the same file is fresh at the end of the limit's last day and stale at the first instant after it", () => {
  const f = ligne("2026-10-01", "2026-09-01", "2026-10-01");
  assert.equal(jugerFraicheurUe(f, new Date("2026-10-08T23:59:59Z")).perime, false);
  assert.equal(jugerFraicheurUe(f, new Date("2026-10-09T00:00:00Z")).perime, true);
});

test("both reasons are listed at once when both hold", () => {
  const v = jugerFraicheurUe(ligne("2026-10-01", "2026-09-01", "2026-10-10"), horloge("2026-10-14"));
  assert.equal(v.perime, true);
  assert.equal(v.motifs.length, 2, v.motifs.join(" | "));
});

test("(c) fail closed: a defect recorded for the file, a missing date, a generation date in the future, a recorded date that is not a day: stale, never fresh", () => {
  const aujourdhui = "2026-10-14";
  const cas: [string, FraicheurEnregistree][] = [
    ["a recorded defect", ligne("2026-10-13", "2026-10-01", "2026-10-13", { fichierDefaut: "publication date later than generation date: newest publicationDate 2062-07-23, generationDate 2026-10-13" })],
    ["no generation date", ligne(null, "2026-10-01", "2026-10-13")],
    ["no publication date", ligne("2026-10-13", null, "2026-10-13")],
    ["a generation date after the day of the run by more than the tolerance", ligne(avant(-TOLERANCE_APRES_GENERATION_UE_JOURS - 1, aujourdhui), "2026-10-01", null)],
    ["a generation date that is not a day", ligne("2026-02-30", "2026-01-01", null)],
    ["a recorded feed date that is not a day", ligne("2026-10-13", "2026-10-01", "2026-13-45")],
  ];
  for (const [nom, f] of cas) {
    const v = jugerFraicheurUe(f, horloge(aujourdhui));
    assert.equal(v.perime, true, nom);
    assert.ok(v.motifs.length > 0 && v.motifs.every((m) => m.length > 0), `${nom}: a reason is given`);
  }
  /* and the limit of that last check: a generation date exactly the tolerance after the day of the run is the time zone, not a defect */
  assert.equal(jugerFraicheurUe(ligne(avant(-TOLERANCE_APRES_GENERATION_UE_JOURS, aujourdhui), "2026-10-01", null), horloge(aujourdhui)).perime, false);
});

test("a feed that could not be read when the file arrived is recorded as such and is not a reason to refuse by itself", () => {
  const aujourdhui = "2026-10-14";
  const gen = avant(1, aujourdhui);
  const f = enregistrerFraicheurUe(xmlUe(gen, avant(10, gen)), { illisible: "HTTP 503" });
  assert.deepEqual(f, { fichierGenereLe: gen, fichierPublieLe: avant(10, gen), rssAnnonceLe: null, rssIllisible: "HTTP 503" });
  assert.equal(jugerFraicheurUe(f, horloge(aujourdhui)).perime, false);
  assert.equal(jugerFraicheurUe(f, horloge(avant(-SEUIL_RETARD_UE_JOURS - 1, gen))).perime, true, "the clock rule still holds when the feed is unknown");
});

/* ───────────────────────────── reading the feed ───────────────────────────── */

/** The address we download, as the manifest writes it: the feed item whose path is its path is ours. */
const CHEMIN_FICHIER_UE = URL_UE_ECRITE;

test("the feed: the item of OUR file is the one read, the day of its pubDate in UTC, whatever the other formats were published", () => {
  assert.deepEqual(analyserRssUe(rssUe("2026-10-12", "2026-12-01"), CHEMIN_FICHIER_UE), { jour: "2026-10-12" });
  assert.deepEqual(analyserRssUe(rssUe("2026-10-12", "2020-01-01"), CHEMIN_FICHIER_UE), { jour: "2026-10-12" });
});

test("the feed: a pubDate keeps its UTC day, in whatever zone it is written in", () => {
  const xml = rssUe(null).replace("</channel>", [
    "    <item>",
    "      <title>XML (Based on XSD) - v1.1</title>",
    "      <link>https://webgate.ec.europa.eu/fsd/fsf/public/files/xmlFullSanctionsList_1_1/content?token=[username]</link>",
    "      <pubDate>Tue, 13 Oct 2026 01:30:00 +0200</pubDate>",
    "    </item>",
    "  </channel>",
  ].join("\n"));
  assert.deepEqual(analyserRssUe(xml, CHEMIN_FICHIER_UE), { jour: "2026-10-12" }, "01:30 at +0200 on the 13th is the 12th in UTC");
});

test("the feed: two items for our file give the newest; no item for it, no item at all, a text that is not a feed and an unreadable pubDate are each said, not guessed", () => {
  const deux = rssUe("2026-10-10").replace("</channel>", item("XML (Based on XSD) - v1.1", "xmlFullSanctionsList_1_1", "2026-10-11") + "\n  </channel>");
  assert.deepEqual(analyserRssUe(deux, CHEMIN_FICHIER_UE), { jour: "2026-10-11" });
  const sans = analyserRssUe(rssUe(null), CHEMIN_FICHIER_UE);
  assert.ok("illisible" in sans && sans.illisible.includes("/fsd/fsf/public/files/xmlFullSanctionsList_1_1/content"), JSON.stringify(sans));
  assert.ok("illisible" in analyserRssUe("<rss><channel></channel></rss>", CHEMIN_FICHIER_UE));
  assert.ok("illisible" in analyserRssUe("<html><body>maintenance</body></html>", CHEMIN_FICHIER_UE));
  assert.ok("illisible" in analyserRssUe(rssUe("2026-10-12").replace(/<pubDate>[^<]*<\/pubDate>/g, "<pubDate>soon</pubDate>"), CHEMIN_FICHIER_UE));
});

/* ───────────────────────── the script keeps its command line and its exit codes ───────────────────────── */

type Script = { statut: number | null; sortie: string; erreurs: string };
function script(xml: string | null, ...args: string[]): Script {
  const dossier = realpathSync(mkdtempSync(join(tmpdir(), "fraicheur-script-")));
  try {
    const f = join(dossier, "ue.xml");
    if (xml !== null) writeFileSync(f, xml);
    const r = spawnSync(process.execPath, [SCRIPT, ...(xml === null ? [] : [f]), ...args], { encoding: "utf8", timeout: 60_000 });
    return { statut: r.status, sortie: r.stdout, erreurs: r.stderr };
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
}

test("scripts/fraicheur-ue.mjs on the file alone: the clock and the validity of the dates; a quiet quarter is exit 0, a file older than the limit is exit 1", () => {
  const aujourdhui = "2026-10-14";
  const quieteParLeFichier = script(xmlUe("2026-10-12", "2026-07-23"), `--today=${aujourdhui}`);
  assert.equal(quieteParLeFichier.statut, 0, quieteParLeFichier.erreurs);
  assert.equal(JSON.parse(quieteParLeFichier.sortie).perime, false);
  assert.equal(JSON.parse(quieteParLeFichier.sortie).gen, "2026-10-12");
  assert.equal(JSON.parse(quieteParLeFichier.sortie).max, "2026-07-23");
  const vieux = script(xmlUe(avant(SEUIL_RETARD_UE_JOURS + 1, aujourdhui), "2026-07-23"), `--today=${aujourdhui}`);
  assert.equal(vieux.statut, 1, vieux.erreurs);
  assert.equal(JSON.parse(vieux.sortie).perime, true);
  assert.match(JSON.parse(vieux.sortie).raison, /daily update/);
  const limite = script(xmlUe(avant(SEUIL_RETARD_UE_JOURS, aujourdhui), "2026-07-23"), `--today=${aujourdhui}`);
  assert.equal(limite.statut, 0, "exactly the limit is not stale");
  const sans = script(xmlUe(null, null), `--today=${aujourdhui}`);
  assert.equal(sans.statut, 1, "a file with no dates is stale");
});

test("scripts/fraicheur-ue.mjs with --rss-newest also applies the feed rule; --selftest passes; a bad flag or day is exit 2", () => {
  const aujourdhui = "2026-10-14";
  const xml = xmlUe("2026-10-08", "2026-07-23");
  const accord = script(xml, `--today=${aujourdhui}`, "--rss-newest=2026-10-08");
  assert.equal(accord.statut, 0, accord.erreurs);
  assert.equal(JSON.parse(accord.sortie).rss, "2026-10-08");
  const plusRecent = script(xml, `--today=${aujourdhui}`, "--rss-newest=2026-10-12");
  assert.equal(plusRecent.statut, 1, plusRecent.erreurs);
  assert.match(JSON.parse(plusRecent.sortie).raison, /feed/);
  const separe = script(xml, "--today", aujourdhui, "--rss-newest", "2026-10-12");
  assert.equal(separe.statut, 1, `the value may be the next argument: ${separe.erreurs}`);
  assert.equal(JSON.parse(separe.sortie).rss, "2026-10-12");
  assert.equal(script(xml, "--rss-newest").statut, 2, "a value flag with no value is refused, not ignored");
  assert.equal(script(xml, "--nimportequoi").statut, 2, "an unknown flag is refused by the shared helper");
  assert.equal(script(xml, "--rss-newest=2026-13-45").statut, 2, "a day that does not exist is refused");
  assert.equal(script(xml, "--today=yesterday").statut, 2);
  const temoin = spawnSync(process.execPath, [SCRIPT, "--selftest"], { encoding: "utf8", timeout: 60_000 });
  assert.equal(temoin.status, 0, temoin.stderr);
  assert.match(temoin.stdout, /witness ok/);
});

/* ───────────────────────── the wiring: `listes --fetch` records the inputs and marks the row ───────────────────────── */

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

/** The `fetch` the child process gets: no network. The feed and the file are answered apart; the order of the two calls is logged. */
const FAUSSE_RECUPERATION = `
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
globalThis.fetch = async (url) => {
  const adresse = String(url);
  if (adresse.endsWith("/public/rss")) {
    appendFileSync(process.env.STUB_LOG, "rss " + adresse + "\\n");
    if (process.env.STUB_RSS_MODE === "http503") return new Response("down", { status: 503 });
    if (process.env.STUB_RSS_MODE === "throws") throw new Error("connect ECONNRESET while fetching " + adresse);
    return new Response(readFileSync(process.env.STUB_RSS));
  }
  appendFileSync(process.env.STUB_LOG, "file\\n");
  writeFileSync(process.env.STUB_SEEN, adresse.includes(process.env.STUB_TOKEN) ? "carried" : "did not carry");
  return new Response(readFileSync(process.env.STUB_BODY));
};
`;

type Ligne = {
  source: string; disponible: boolean; url: string; telechargeLe?: string; sha256?: string; entrees?: number; avertissement?: string;
  fraicheur?: FraicheurEnregistree;
};
type Lancement = { args?: string[]; manifesteAvant?: unknown; corps: string; rss?: string; modeRss?: "ok" | "http503" | "throws" };

/** One run of the real command in a throwaway root. The fake token is in the environment; the body is what the "server" answers. */
function lancer({ args = ["--fetch", "--only=EU"], manifesteAvant, corps, rss = rssUe(jourDe(new Date())), modeRss = "ok" }: Lancement): {
  racine: string; sortie: string; erreurs: string; statut: number | null; lignes: Ligne[]; journal: string[];
} {
  /* realpath: on macOS tmpdir() is a symlink, and `isMain` compares the resolved module URL with argv[1]. */
  const racine = realpathSync(mkdtempSync(join(tmpdir(), "fraicheur-ue-")));
  mkdirSync(join(racine, "src"));
  for (const f of fermeture("listes.ts")) cpSync(join(ICI, f), join(racine, "src", f));
  cpSync(join(ICI, "..", "package.json"), join(racine, "package.json"));
  writeFileSync(join(racine, "fausse-recuperation.mjs"), FAUSSE_RECUPERATION);
  writeFileSync(join(racine, "corps.xml"), corps);
  writeFileSync(join(racine, "rss.xml"), rss);
  if (manifesteAvant !== undefined) writeFileSync(join(racine, "listes-manifest.json"), JSON.stringify(manifesteAvant, null, 2) + "\n");
  mkdirSync(join(racine, "home"));
  const env: Record<string, string | undefined> = { ...process.env };
  for (const n of ["CASCADE_EU_TOKEN", "CRUSETRA_OFFLINE", "CASCADE_OFFLINE"]) delete env[n];
  Object.assign(env, {
    CRUSETRA_EU_TOKEN: FAUX_JETON, HOME: join(racine, "home"), USERPROFILE: join(racine, "home"),
    STUB_TOKEN: FAUX_JETON, STUB_BODY: join(racine, "corps.xml"), STUB_SEEN: join(racine, "seen.txt"),
    STUB_RSS: join(racine, "rss.xml"), STUB_RSS_MODE: modeRss, STUB_LOG: join(racine, "journal.txt"),
  });
  const r = spawnSync(process.execPath,
    ["--import", pathToFileURL(join(racine, "fausse-recuperation.mjs")).href, join(racine, "src", "listes.ts"), ...args],
    { cwd: racine, encoding: "utf8", env, timeout: 60_000 });
  const chemin = join(racine, "listes-manifest.json");
  const lignes = existsSync(chemin) ? (JSON.parse(readFileSync(chemin, "utf8")) as { listes: Ligne[] }).listes : [];
  const journal = existsSync(join(racine, "journal.txt")) ? readFileSync(join(racine, "journal.txt"), "utf8").split("\n").filter(Boolean) : [];
  return { racine, sortie: r.stdout, erreurs: r.stderr, statut: r.status, lignes, journal };
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
function verifierLeTrajet(r: ReturnType<typeof lancer>, journal: string[] = ["rss " + URL_RSS_UE, "file"]): Ligne {
  assert.equal(r.statut, 0, `exit code ${r.statut}:\n${r.erreurs.slice(0, 600)}`);
  assert.equal(readFileSync(join(r.racine, "seen.txt"), "utf8"), "carried", "the request for the file must still carry the token: the download needs it");
  assert.deepEqual(r.journal, journal, "the feed is read once, BEFORE the file, with no token in its address");
  assert.deepEqual(fuitesDe(r.racine, r.sortie, r.erreurs), [], "the token reached these places");
  const ue = r.lignes.find((l) => l.source === "EU")!;
  assert.equal(ue.url, URL_UE_ECRITE, "the address keeps its placeholder");
  assert.equal(ue.disponible, true, "a stale file is still a downloaded file: the row stays available");
  assert.ok(existsSync(join(r.racine, "data", "listes", "eu.xml")), "the file is still written");
  return ue;
}

/** The row the command wrote, as the manifest a screening would read. */
const leManifesteEcrit = (ue: Ligne): Manifeste => ({ version: 1, genereLe: new Date().toISOString(), listes: [ue as unknown as LigneManifeste] });

/** A fetch of today, with the file generated `age` days ago, its newest publication `ecart` days before that, and the feed announcing `rssAge` days ago. */
function lancerEtVerifier(age: number, ecart: number, rssAge: number | null, verifier: (ue: Ligne, r: ReturnType<typeof lancer>, gen: string, rss: string | null) => void, plus: Partial<Lancement> = {}): void {
  const aujourdhui = jourDe(new Date());
  const gen = avant(age, aujourdhui);
  const rss = rssAge === null ? null : avant(rssAge, aujourdhui);
  const r = lancer({ corps: xmlUe(gen, avant(ecart, gen)), rss: rssUe(rss), ...plus });
  try {
    verifier(verifierLeTrajet(r), r, gen, rss);
  } finally {
    rmSync(r.racine, { recursive: true, force: true });
  }
}

/* Explicit cases, not a loop: the README counts `test(` in the sources and must equal what runs. */
test("EU fetch in a quiet week (generated yesterday, nothing published for ten days, the feed agrees): the inputs are recorded, no warning, nothing said about staleness", () => {
  lancerEtVerifier(1, 10, 1, (ue, r, gen, rss) => {
    assert.deepEqual(ue.fraicheur, { fichierGenereLe: gen, fichierPublieLe: avant(10, gen), rssAnnonceLe: rss });
    assert.equal(refusFraicheurUe(leManifesteEcrit(ue), new Date()), null, "the screening reads the row the command wrote: a quiet week is not refused");
    assert.equal(ue.avertissement, undefined, "a quiet week no longer warns");
    assert.ok(!/stale|⚠/i.test(r.sortie), `nothing is said about staleness:\n${r.sortie}`);
  });
});

test("EU fetch when the feed announces a newer file than the one downloaded: the row is marked stale with both dates, and the line is printed", () => {
  lancerEtVerifier(4, 10, 0, (ue, r, gen, rss) => {
    assert.match(ue.avertissement ?? "", /^stale: /, "the row carries the stale warning");
    assert.ok(ue.avertissement!.includes(gen) && ue.avertissement!.includes(rss!), `the warning names both dates: ${ue.avertissement}`);
    assert.ok(r.sortie.includes(`⚠ ${ue.avertissement}`), `the fetch prints the line:\n${r.sortie}`);
    assert.equal(ue.fraicheur?.rssAnnonceLe, rss);
    const refus = refusFraicheurUe(leManifesteEcrit(ue), new Date());
    assert.ok(refus !== null && refus.includes(gen) && refus.includes(rss!), `the screening refuses on the row the command wrote, naming both dates: ${refus}`);
  });
});

test("EU fetch of a file generated more than the limit ago while the feed agrees (the update failed upstream): marked stale, the limit named", () => {
  lancerEtVerifier(SEUIL_RETARD_UE_JOURS + 3, 20, SEUIL_RETARD_UE_JOURS + 3, (ue, r) => {
    assert.match(ue.avertissement ?? "", /^stale: .*daily update/);
    assert.ok(ue.avertissement!.includes(`${SEUIL_RETARD_UE_JOURS} days`), "the warning names the limit");
    assert.ok(r.sortie.includes(`⚠ ${ue.avertissement}`));
  });
});

test("EU fetch when the feed answers HTTP 503: recorded with its reason, one warning line, the file judged by its own dates, the row available", () => {
  lancerEtVerifier(1, 10, null, (ue, r, gen) => {
    assert.deepEqual(ue.fraicheur, { fichierGenereLe: gen, fichierPublieLe: avant(10, gen), rssAnnonceLe: null, rssIllisible: "HTTP 503" });
    assert.match(ue.avertissement ?? "", /^the EU feed could not be read \(HTTP 503\)/, "the warning says it, and does not say 'stale'");
    assert.ok(!/stale/.test(ue.avertissement!));
    assert.ok(r.sortie.includes(`⚠ ${ue.avertissement}`), `the fetch prints the line:\n${r.sortie}`);
  }, { modeRss: "http503" });
});

test("EU fetch when the feed read fails on the network: recorded, the error text redacted like every other, the row available", () => {
  lancerEtVerifier(1, 10, null, (ue) => {
    assert.equal(ue.fraicheur?.rssAnnonceLe, null);
    assert.equal(ue.fraicheur?.rssIllisible, `network: connect ECONNRESET while fetching ${URL_RSS_UE}`);
  }, { modeRss: "throws" });
});

test("EU fetch when the feed lists no item for the file: recorded as unreadable with the path looked for, not guessed from another format", () => {
  const aujourdhui = jourDe(new Date());
  const r = lancer({ corps: xmlUe(avant(1, aujourdhui), avant(10, aujourdhui)), rss: rssUe(null) });
  try {
    const ue = verifierLeTrajet(r);
    assert.equal(ue.fraicheur?.rssAnnonceLe, null);
    assert.match(ue.fraicheur?.rssIllisible ?? "", /\/fsd\/fsf\/public\/files\/xmlFullSanctionsList_1_1\/content/);
  } finally {
    rmSync(r.racine, { recursive: true, force: true });
  }
});

test("EU fetch, a file with no dates: stale with the reason (fail closed), the defect recorded", () => {
  const r = lancer({ corps: xmlUe(null, null) });
  try {
    const ue = verifierLeTrajet(r);
    assert.match(ue.avertissement ?? "", /^stale: .*generationDate missing/, "the row is stale and says what is missing");
    assert.match(ue.fraicheur?.fichierDefaut ?? "", /generationDate missing/);
    assert.ok(r.sortie.includes(`⚠ ${ue.avertissement}`), `the fetch prints the line:\n${r.sortie}`);
  } finally {
    rmSync(r.racine, { recursive: true, force: true });
  }
});

test("EU fetch, one stray publicationDate in the year 2062: marked stale, the dates named, not masked by a negative gap", () => {
  const aujourdhui = jourDe(new Date());
  const gen = avant(1, aujourdhui);
  const r = lancer({ corps: avecPublications(xmlUe(gen, "2026-07-23"), "2062-07-23"), rss: rssUe(gen) });
  try {
    const ue = verifierLeTrajet(r);
    assert.match(ue.avertissement ?? "", /^stale: .*publication date later than generation date/);
    assert.ok(ue.avertissement!.includes("2062-07-23") && ue.avertissement!.includes(gen), `the warning names the two dates: ${ue.avertissement}`);
  } finally {
    rmSync(r.racine, { recursive: true, force: true });
  }
});

test("EU fetch, one impossible publicationDate next to a valid one: no warning, nothing recorded as a defect", () => {
  const aujourdhui = jourDe(new Date());
  const gen = avant(1, aujourdhui);
  const r = lancer({ corps: avecPublications(xmlUe(gen, avant(40, gen)), avant(2, gen), "2026-13-45"), rss: rssUe(gen) });
  try {
    const ue = verifierLeTrajet(r);
    assert.equal(ue.avertissement, undefined);
    assert.equal(ue.fraicheur?.fichierDefaut, undefined);
    assert.equal(ue.fraicheur?.fichierPublieLe, avant(2, gen));
  } finally {
    rmSync(r.racine, { recursive: true, force: true });
  }
});

/** The EU row of a manifest written by an earlier fetch. */
const LIGNE_UE_AVANT: Ligne = {
  source: "EU", disponible: true, url: URL_UE_ECRITE, telechargeLe: "2026-09-01T00:00:00.000Z", sha256: "0".repeat(64), entrees: 1,
  ...{ titre: "EU consolidated financial sanctions list (FSF, XML v1.1)", format: "eu-fsf-xml-1.1", octets: 1 },
  fraicheur: { fichierGenereLe: "2026-09-01", fichierPublieLe: "2026-08-20", rssAnnonceLe: "2026-09-01" },
};
const manifesteAvec = (ue: Ligne): unknown => ({ version: 1, genereLe: "2026-09-01T00:00:00.000Z", listes: [ue] });

test("a stale file on arrival does not leave a previously fresh row fresh: the new download rewrites the inputs and the mark", () => {
  const aujourdhui = jourDe(new Date());
  const gen = avant(SEUIL_RETARD_UE_JOURS + 4, aujourdhui);
  const r = lancer({ corps: xmlUe(gen, avant(5, gen)), rss: rssUe(gen), manifesteAvant: manifesteAvec(LIGNE_UE_AVANT) });
  try {
    const ue = verifierLeTrajet(r);
    assert.ok(ue.telechargeLe! > LIGNE_UE_AVANT.telechargeLe!, "the row was rewritten by this download");
    assert.notEqual(ue.sha256, LIGNE_UE_AVANT.sha256);
    assert.equal(ue.fraicheur?.fichierGenereLe, gen, "the inputs are those of this download");
    assert.match(ue.avertissement ?? "", /^stale: /, "a row fresh before is stale now, though it was downloaded today");
  } finally {
    rmSync(r.racine, { recursive: true, force: true });
  }
});

test("a row marked stale and kept as recorded by --only=UN comes out of the next manifest still marked, inputs included", () => {
  const marquee: Ligne = { ...LIGNE_UE_AVANT, avertissement: "stale: the file was generated on 2026-09-01, 40 days before today (2026-10-11)", fraicheur: { fichierGenereLe: "2026-09-01", fichierPublieLe: "2026-08-20", rssAnnonceLe: "2026-10-05" } };
  const r = lancer({ args: ["--fetch", "--only=UN"], corps: readFileSync(join(ICI, "fixtures", "onu.xml"), "utf8"), manifesteAvant: manifesteAvec(marquee) });
  try {
    assert.equal(r.statut, 0, r.erreurs.slice(0, 400));
    assert.match(r.sortie, /EU\s+kept as recorded/);
    assert.deepEqual(r.lignes.find((l) => l.source === "EU"), marquee, "the kept row is the one recorded, mark and inputs included");
    assert.deepEqual(r.journal, ["file"], "the feed is read for the EU row only: nothing is asked of it when another source is downloaded");
    assert.deepEqual(fuitesDe(r.racine, r.sortie, r.erreurs), [], "the token reached these places");
  } finally {
    rmSync(r.racine, { recursive: true, force: true });
  }
});

/* ───────────────────────── the documents say what the code does ───────────────────────── */

test("the README and DATA-FLOW state the rule the code applies: the limits read from the constants, the refusal, and no sentence of the earlier rule", () => {
  const jours = (n: number): string => `${n} day${n === 1 ? "" : "s"}`;
  const lire = (...chemin: string[]): string => readFileSync(join(ICI, "..", ...chemin), "utf8").replace(/\s+/g, " ");
  for (const [nom, texte] of [["README.md", lire("README.md")], ["doc/DATA-FLOW.md", lire("doc", "DATA-FLOW.md")]] as const) {
    assert.ok(texte.includes(`more than ${jours(SEUIL_RETARD_UE_JOURS)}`), `${nom} gives the limit of the clock rule from the constant`);
    assert.ok(texte.includes(`more than ${jours(TOLERANCE_APRES_GENERATION_UE_JOURS)}`), `${nom} gives the tolerance from the constant`);
    assert.match(texte, /refuses to run/, `${nom} says that a client screening refuses`);
    assert.match(texte, /quiet week/, `${nom} says that a quiet week is not stale`);
    assert.ok(!/does not read (?:that|this) field/.test(texte), `${nom} no longer says that a client screening does not read the mark`);
    assert.ok(!/behind its generationDate/.test(texte), `${nom} no longer states the earlier rule (publication against generation)`);
  }
});
