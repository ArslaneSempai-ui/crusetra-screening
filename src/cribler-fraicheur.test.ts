/*
 * A CLIENT SCREENING REFUSES WHEN THE EU LIST IS STALE, AND A TEST OVERRIDE CAN NEVER PRODUCE A SEALED CLIENT RECORD.
 *
 * Decided on 14 October 2026: when the EU list is stale, a client screening refuses the run with a message that names the
 * list and its dates; no report is produced. The daily update of the lists exists, and this refusal is the net if it fails.
 * The rule is src/fraicheur-ue.ts (see listes-fraicheur.test.ts for the rule itself, on every edge). What these cases
 * pin is the DECISION: it is made from the manifest (the inputs recorded when the file arrived, and the clock of the run),
 * never from the network, it concerns the EU list and no other, and a refusal writes nothing.
 *
 * THE OVERRIDE. `executer` takes an option, `essaiListeUePerimee`, for tests only: the command line has no such flag, no
 * usage text and no document names it. Under it a stale EU list is let through, and what comes back is a TEST RUN: it
 * carries the mark `essai`, it is not sealed, and the sealing path (`scellerLeReleve`) and the writer of the report
 * (`exigerReleveScelle`) both refuse it. So a record a client could receive cannot come out of an override.
 *
 * The clock is injected (`maintenant`), as `executer` already takes it for the date of the record, so every edge is
 * tested at the day with no flag in the production code. The cases that run the command line do it in a throwaway copy
 * of the sources, with a manifest whose EU row is years old, so that they hold on any day.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { executer, exigerReleveScelle, scellerLeReleve, type Criblage } from "./cribler.ts";
import { scelleIntact } from "./empreinte.ts";
import { analyser, fichierDe, refusFraicheurUe, RefusListePerimee, SOURCES, type LigneManifeste, type Manifeste } from "./listes.ts";
import { SEUIL_RETARD_UE_JOURS, type FraicheurEnregistree } from "./fraicheur-ue.ts";

const FAUX_JETON = "FAKE-TOKEN-0000";
const ICI = fileURLToPath(new URL(".", import.meta.url));
const JOUR_MS = 24 * 60 * 60 * 1000;
const avant = (jours: number, depuis: string): string => new Date(Date.parse(depuis) - jours * JOUR_MS).toISOString().slice(0, 10);
const horloge = (jour: string): Date => new Date(`${jour}T09:00:00Z`);
const TITRE_UE = SOURCES.find((s) => s.source === "EU")!.titre;

/** An EU file in the shape of the real one, generated on `gen` (a day). */
const xmlUe = (gen: string, publication: string): string => [
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`,
  `<export xmlns="http://eu.europa.ec/fpi/fsd/export" generationDate="${gen}T10:00:00">`,
  `  <sanctionEntity designationDetails="" logicalId="742">`,
  `    <regulation regulationType="regulation" organisationType="council" publicationDate="${publication}" entryIntoForceDate="2014-07-31" numberTitle="833/2014 (OJ L229)" programme="RUS" logicalId="902"/>`,
  `    <subjectType code="enterprise" classificationCode="E"/>`,
  `    <nameAlias firstName="" middleName="" lastName="" wholeName="Zaporozhye Heavy Machinery JSC" function="" title="" nameLanguage="EN" strong="true" regulationLanguage="en" logicalId="903"/>`,
  `  </sanctionEntity>`,
  `</export>`,
  ``,
].join("\n");

const OFAC = readFileSync(join(ICI, "fixtures", "ofac.xml"), "utf8");

/** A row of the manifest for a file on disk. */
function ligneDe(source: "OFAC" | "EU", texte: string, jour: string, plus: Record<string, unknown> = {}): LigneManifeste {
  const def = SOURCES.find((s) => s.source === source)!;
  return {
    source, titre: def.titre, url: source === "EU" ? "https://webgate.ec.europa.eu/x/content?token=[username]" : "https://ofac.example/sdn.xml", format: def.format,
    disponible: true, telechargeLe: `${jour}T08:00:00.000Z`, sha256: createHash("sha256").update(texte).digest("hex"),
    octets: Buffer.byteLength(texte), entrees: analyser(def.format, texte, source).length, ...plus,
  } as LigneManifeste;
}

type Racine = { dossier: string; fichier: string };
/** A throwaway root holding a manifest, the list files it names, and a counterparty file. */
function racineAvec(ue: { gen: string; publication: string; fraicheur?: FraicheurEnregistree | "absente"; telecharge?: string }): Racine {
  const dossier = realpathSync(mkdtempSync(join(tmpdir(), "cribler-fraicheur-")));
  mkdirSync(join(dossier, "data", "listes"), { recursive: true });
  const texteUe = xmlUe(ue.gen, ue.publication);
  writeFileSync(join(dossier, "data", "listes", fichierDe(SOURCES.find((s) => s.source === "OFAC")!)), OFAC);
  writeFileSync(join(dossier, "data", "listes", fichierDe(SOURCES.find((s) => s.source === "EU")!)), texteUe);
  const fraicheur = ue.fraicheur === "absente" ? undefined : ue.fraicheur ?? { fichierGenereLe: ue.gen, fichierPublieLe: ue.publication, rssAnnonceLe: ue.gen };
  const m: Manifeste = {
    version: 1, genereLe: `${ue.telecharge ?? ue.gen}T08:00:00.000Z`,
    listes: [ligneDe("OFAC", OFAC, ue.telecharge ?? ue.gen), ligneDe("EU", texteUe, ue.telecharge ?? ue.gen, fraicheur ? { fraicheur } : {})],
  };
  writeFileSync(join(dossier, "listes-manifest.json"), JSON.stringify(m, null, 2) + "\n");
  mkdirSync(join(dossier, "run"));
  const fichier = join(dossier, "run", "contreparties.csv");
  writeFileSync(fichier, "name\nZaporozhye Heavy Machinery\nAcme Freight Forwarding\n");
  return { dossier, fichier };
}

const sansTrace = (r: Racine): void => rmSync(r.dossier, { recursive: true, force: true });
/** What the run left next to the counterparty file: nothing but the file itself, when nothing was written. */
const cote = (r: Racine): string[] => readdirSync(join(r.dossier, "run"));

/* ───────────────────────── the decision, on the manifest and a clock ───────────────────────── */

/** A manifest with one EU row carrying `f`, and an old OFAC row (another source: never judged this way). */
function manifeste(f: FraicheurEnregistree | undefined, plus: Record<string, unknown> = {}): Manifeste {
  return {
    version: 1, genereLe: "2026-10-01T00:00:00.000Z",
    listes: [
      ligneDe("OFAC", OFAC, "2020-01-01"),
      { ...ligneDe("EU", xmlUe("2026-10-12", "2026-07-23"), "2026-10-12"), ...(f ? { fraicheur: f } : {}), ...plus } as LigneManifeste,
    ],
  };
}
const ligne = (gen: string | null, pub: string | null, rss: string | null, plus: Partial<FraicheurEnregistree> = {}): FraicheurEnregistree =>
  ({ fichierGenereLe: gen, fichierPublieLe: pub, rssAnnonceLe: rss, ...plus });

test("a quiet week is no reason to refuse: the feed and the file agree, nothing new for ten days, generated yesterday", () => {
  const aujourdhui = "2026-10-14";
  const gen = avant(1, aujourdhui);
  assert.equal(refusFraicheurUe(manifeste(ligne(gen, avant(10, gen), gen)), horloge(aujourdhui)), null);
});

test("the real shape of 14 October 2026 (generated 12 October, newest publication 23 July, the feed on 12 October) is not refused", () => {
  assert.equal(refusFraicheurUe(manifeste(ligne("2026-10-12", "2026-07-23", "2026-10-12")), horloge("2026-10-14")), null);
});

test("the feed announces a newer file than the one on disk: refused, the message names the list and both dates", () => {
  const m = refusFraicheurUe(manifeste(ligne("2026-10-08", "2026-07-23", "2026-10-12")), horloge("2026-10-14"));
  assert.ok(m !== null);
  assert.ok(m.includes(TITRE_UE), `the message names the list: ${m}`);
  for (const jour of ["2026-10-08", "2026-10-12", "2026-07-23", "2026-10-14"]) assert.ok(m.includes(jour), `the message names ${jour}:\n${m}`);
  assert.match(m, /no report is produced/);
});

test("the update failed (the file was generated eight days before the day of the run): refused; exactly seven days is not", () => {
  const aujourdhui = "2026-10-20";
  const huit = avant(SEUIL_RETARD_UE_JOURS + 1, aujourdhui);
  const refus = refusFraicheurUe(manifeste(ligne(huit, avant(30, huit), huit)), horloge(aujourdhui));
  assert.ok(refus !== null && refus.includes(huit) && refus.includes(aujourdhui) && refus.includes(`${SEUIL_RETARD_UE_JOURS} days`), String(refus));
  const sept = avant(SEUIL_RETARD_UE_JOURS, aujourdhui);
  assert.equal(refusFraicheurUe(manifeste(ligne(sept, avant(30, sept), sept)), horloge(aujourdhui)), null, "exactly the limit is not a refusal");
});

test("an unchanged file nine days old, downloaded yesterday with the feed agreeing, is not refused (the EU had nothing new; the update did not fail)", () => {
  const aujourdhui = "2026-10-21";
  const gen = avant(SEUIL_RETARD_UE_JOURS + 2, aujourdhui);
  assert.equal(refusFraicheurUe(manifeste(ligne(gen, avant(40, gen), gen, { confirmeLe: avant(1, aujourdhui) })), horloge(aujourdhui)), null);
});

test("the same file whose last good download was eight days ago is refused, and the message names the download day", () => {
  const aujourdhui = "2026-10-21";
  const gen = avant(SEUIL_RETARD_UE_JOURS + 2, aujourdhui);
  const dernier = avant(SEUIL_RETARD_UE_JOURS + 1, aujourdhui);
  const m = refusFraicheurUe(manifeste(ligne(gen, avant(40, gen), gen, { confirmeLe: dernier })), horloge(aujourdhui));
  assert.ok(m !== null && m.includes(dernier) && m.includes(aujourdhui) && m.includes(`${SEUIL_RETARD_UE_JOURS} days`) && m.includes(TITRE_UE), String(m));
  assert.match(m, /last download that confirmed it against the feed/);
});

test("exactly seven days since the last good download is not a refusal; the real shape of 14 October 2026 (generated 12th, downloaded 14th, feed 12th) is not either", () => {
  const aujourdhui = "2026-10-21";
  const gen = avant(SEUIL_RETARD_UE_JOURS + 2, aujourdhui);
  assert.equal(refusFraicheurUe(manifeste(ligne(gen, avant(40, gen), gen, { confirmeLe: avant(SEUIL_RETARD_UE_JOURS, aujourdhui) })), horloge(aujourdhui)), null);
  assert.equal(refusFraicheurUe(manifeste(ligne("2026-10-12", "2026-07-23", "2026-10-12", { confirmeLe: "2026-10-14" })), horloge("2026-10-14")), null);
});

test("a download made while the feed day is newer than the file does not count as fresh: the old confirmation stands and the refusal names both", () => {
  const aujourdhui = "2026-10-21";
  const gen = avant(SEUIL_RETARD_UE_JOURS + 2, aujourdhui);
  const dernier = avant(SEUIL_RETARD_UE_JOURS + 1, aujourdhui);
  const jourFlux = avant(2, aujourdhui);
  const m = refusFraicheurUe(manifeste(ligne(gen, avant(40, gen), jourFlux, { confirmeLe: dernier })), horloge(aujourdhui));
  assert.ok(m !== null && m.includes(dernier) && m.includes(jourFlux), String(m));
});

test("a feed that could not be read when the list was downloaded is not a refusal by itself, and the message of a refusal says it", () => {
  const aujourdhui = "2026-10-14";
  const gen = avant(1, aujourdhui);
  const f = ligne(gen, avant(10, gen), null, { rssIllisible: "HTTP 503" });
  assert.equal(refusFraicheurUe(manifeste(f), horloge(aujourdhui)), null);
  const vieux = refusFraicheurUe(manifeste({ ...f, fichierGenereLe: avant(SEUIL_RETARD_UE_JOURS + 2, aujourdhui) }), horloge(aujourdhui));
  assert.ok(vieux !== null && vieux.includes("HTTP 503"), String(vieux));
});

test("the refusal concerns the EU list only: an ancient list of another source, an EU row marked unavailable and a manifest with no EU row are not refused here", () => {
  const frais = ligne("2026-10-13", "2026-10-01", "2026-10-13");
  assert.equal(refusFraicheurUe(manifeste(frais), horloge("2026-10-14")), null, "the OFAC row of the manifest is from 2020");
  const indisponible: Manifeste = { version: 1, genereLe: "2026-10-01T00:00:00.000Z", listes: [{ source: "EU", titre: TITRE_UE, url: "u", format: "eu-fsf-xml-1.1", disponible: false, verifieLe: "2020-01-01T00:00:00.000Z", erreur: "HTTP 500", issue: "x" }] };
  assert.equal(refusFraicheurUe(indisponible, horloge("2026-10-14")), null, "an unavailable list is reported as not screened, as before");
  assert.equal(refusFraicheurUe({ version: 1, genereLe: "2026-10-01T00:00:00.000Z", listes: [ligneDe("OFAC", OFAC, "2020-01-01")] }, horloge("2026-10-14")), null);
});

test("the message carries no token, even when a row of an old manifest quoted one in the reason the feed could not be read", () => {
  const f = ligne("2026-09-01", "2026-08-01", null, { rssIllisible: `network: connect ECONNRESET while fetching https://h/rss?token=${FAUX_JETON}; the key ${FAUX_JETON} was refused` });
  const m = refusFraicheurUe(manifeste(f), horloge("2026-10-14"), undefined, { CRUSETRA_EU_TOKEN: FAUX_JETON });
  assert.ok(m !== null && m.includes("ECONNRESET"), String(m));
  assert.ok(!m.includes(FAUX_JETON), `no token in the message:\n${m}`);
});

test("a row written before the inputs were recorded is judged on the dates of the file on disk (the feed unknown): old is refused, recent is not, a missing file is left to the loader", () => {
  const recent = racineAvec({ gen: "2026-10-12", publication: "2026-07-23", fraicheur: "absente" });
  const ancien = racineAvec({ gen: "2026-09-01", publication: "2026-07-23", fraicheur: "absente" });
  try {
    const lire = (r: Racine) => JSON.parse(readFileSync(join(r.dossier, "listes-manifest.json"), "utf8")) as Manifeste;
    assert.equal(refusFraicheurUe(lire(recent), horloge("2026-10-14"), recent.dossier), null);
    const m = refusFraicheurUe(lire(ancien), horloge("2026-10-14"), ancien.dossier);
    assert.ok(m !== null && m.includes("2026-09-01"), String(m));
    rmSync(join(ancien.dossier, "data", "listes", "eu.xml"));
    assert.equal(refusFraicheurUe(lire(ancien), horloge("2026-10-14"), ancien.dossier), null, "lireListe names the missing file in its own refusal");
  } finally {
    sansTrace(recent);
    sansTrace(ancien);
  }
});

/* ───────────────────────── the screening itself ───────────────────────── */

test("executer refuses a stale EU list: the error names the list and its dates, and nothing is written next to the file", () => {
  const r = racineAvec({ gen: "2026-10-01", publication: "2026-07-23" });
  try {
    assert.throws(
      () => executer(r.fichier, undefined, horloge("2026-10-14"), undefined, { racine: r.dossier }),
      (e: unknown) => e instanceof RefusListePerimee && e.message.includes(TITRE_UE) && e.message.includes("2026-10-01") && e.message.includes("2026-10-14"));
    assert.deepEqual(cote(r), ["contreparties.csv"], "no report, no spreadsheet, no sealed record");
  } finally {
    sansTrace(r);
  }
});

test("executer refuses on the feed too: the file is two days old, the feed announces a newer one", () => {
  const r = racineAvec({ gen: "2026-10-12", publication: "2026-07-23", fraicheur: { fichierGenereLe: "2026-10-06", fichierPublieLe: "2026-07-23", rssAnnonceLe: "2026-10-12" } });
  try {
    assert.throws(() => executer(r.fichier, undefined, horloge("2026-10-14"), undefined, { racine: r.dossier }), RefusListePerimee);
  } finally {
    sansTrace(r);
  }
});

/* A run of the screening costs seconds (it measures its thresholds on the training sets), so each of the three runs the
   cases below need is made once, on first use, and read by every case that needs it. */
const CLIENT = "Example Forwarding Inc. (invented)";

let frais: Criblage | undefined;
/** The screening of a FRESH list, as the command would make it. */
function unRunFrais(): Criblage {
  if (frais === undefined) {
    const r = racineAvec({ gen: "2026-10-12", publication: "2026-07-23" });
    try {
      frais = executer(r.fichier, CLIENT, horloge("2026-10-14"), undefined, { racine: r.dossier }).criblage;
    } finally {
      sansTrace(r);
    }
  }
  return frais;
}

let essai: { criblage: Criblage; ecritsAuCote: string[] } | undefined;
/** The screening of a STALE list under the test override, and what it left next to the counterparty file. */
function unRunEssai(): { criblage: Criblage; ecritsAuCote: string[] } {
  if (essai === undefined) {
    const r = racineAvec({ gen: "2026-10-01", publication: "2026-07-23" });
    try {
      const { criblage } = executer(r.fichier, CLIENT, horloge("2026-10-14"), undefined, { racine: r.dossier, essaiListeUePerimee: true });
      essai = { criblage, ecritsAuCote: cote(r) };
    } finally {
      sansTrace(r);
    }
  }
  return essai;
}

test("a fresh manifest is screened as before: the record is produced, sealed, with no trace of the test mark", () => {
  const criblage = unRunFrais();
  assert.equal(criblage.essai, undefined);
  assert.equal(scelleIntact(criblage as unknown as Record<string, unknown>), true);
  assert.deepEqual(criblage.listes.map((l) => l.source), ["OFAC", "EU"]);
  assert.deepEqual(Object.keys(criblage.listes[1]!), ["source", "titre", "url", "telechargeLe", "sha256", "entrees", "licence"], "the sealed row of a list carries the same fields as before: the freshness inputs are not part of the record");
  assert.equal(criblage.totaux.lignes, 2);
  assert.doesNotThrow(() => exigerReleveScelle(criblage));
});

test("the override is accepted for a test run on a stale list: what comes back carries the test mark and no seal, and nothing is written", () => {
  const { criblage, ecritsAuCote } = unRunEssai();
  assert.match(criblage.essai ?? "", /TEST RUN/);
  assert.equal(criblage.empreinte, undefined, "no seal");
  assert.equal(scelleIntact(criblage as unknown as Record<string, unknown>), false);
  assert.equal(criblage.totaux.lignes, 2, "the screening itself ran");
  assert.deepEqual(ecritsAuCote, ["contreparties.csv"]);
});

test("a sealed client record can never come out of the override: the sealing path and the writer of the report both refuse a test run", () => {
  const { criblage } = unRunEssai();
  const { empreinte: _sans, ...sansSceau } = criblage;
  assert.throws(() => scellerLeReleve(sansSceau), /test run/i, "the sealing path refuses a record carrying the test mark");
  assert.throws(() => scellerLeReleve({ ...sansSceau, essai: "anything" }), /test run/i);
  assert.throws(() => exigerReleveScelle(criblage), /test run/i, "the writer refuses it");
  /* and a mark cannot be washed off by sealing by hand: a record with a seal AND the mark is still refused */
  assert.throws(() => exigerReleveScelle({ ...criblage, empreinte: "0123456789abcdef" }), /test run/i);
  /* the witness that the refusal is the mark and not a broken path: the same record without the mark seals */
  const { essai: _marque, ...sansMarque } = sansSceau;
  assert.equal(scelleIntact(scellerLeReleve(sansMarque) as unknown as Record<string, unknown>), true, "the sealing path itself is not broken: a record WITHOUT the mark seals");
});

test("the override on a FRESH list changes nothing: the record is the same as without it, sealed", () => {
  const r = racineAvec({ gen: "2026-10-12", publication: "2026-07-23" });
  try {
    const { criblage } = executer(r.fichier, CLIENT, horloge("2026-10-14"), undefined, { racine: r.dossier, essaiListeUePerimee: true });
    assert.equal(criblage.essai, undefined);
    assert.deepEqual(criblage, unRunFrais(), "the record of a normal run, field for field");
  } finally {
    sansTrace(r);
  }
});

/* ───────────────────────── the command line ───────────────────────── */

/** The sources, copied (no test, no node_modules) to a throwaway root with a manifest and the files it names. */
function racineDeCommande(ue: { gen: string; publication: string }): Racine {
  const r = racineAvec(ue);
  mkdirSync(join(r.dossier, "src"));
  cpSync(ICI, join(r.dossier, "src"), { recursive: true, filter: (s) => !/\.test\.(ts|mjs)$/.test(s) });
  cpSync(join(ICI, "..", "package.json"), join(r.dossier, "package.json"));
  return r;
}

const fichiersSous = (dossier: string): string[] =>
  readdirSync(dossier, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? fichiersSous(join(dossier, e.name)) : [join(dossier, e.name)]);

/** A `fetch` that records that it was called and fails: screening is offline, so a run that reaches it has broken that promise. */
const FETCH_INTERDIT = `
import { appendFileSync } from "node:fs";
globalThis.fetch = async (url) => { appendFileSync(process.env.FETCH_LOG, String(url) + "\\n"); throw new Error("no network at screening time"); };
`;

function commande(r: Racine, ...plus: string[]): { statut: number | null; sortie: string; erreurs: string; appelsReseau: string } {
  const env: Record<string, string | undefined> = { ...process.env };
  for (const n of ["CASCADE_EU_TOKEN", "CRUSETRA_OFFLINE", "CASCADE_OFFLINE"]) delete env[n];
  const journal = join(r.dossier, "fetch-appele.txt");
  writeFileSync(join(r.dossier, "fetch-interdit.mjs"), FETCH_INTERDIT);
  Object.assign(env, { CRUSETRA_EU_TOKEN: FAUX_JETON, HOME: join(r.dossier, "home"), USERPROFILE: join(r.dossier, "home"), FETCH_LOG: journal });
  const p = spawnSync(process.execPath, ["--import", pathToFileURL(join(r.dossier, "fetch-interdit.mjs")).href, join(r.dossier, "src", "cribler.ts"), `--names=${r.fichier}`, ...plus],
    { cwd: r.dossier, encoding: "utf8", env, timeout: 120_000 });
  return { statut: p.status, sortie: p.stdout, erreurs: p.stderr, appelsReseau: existsSync(journal) ? readFileSync(journal, "utf8") : "" };
}

test("npm run cribler on a stale EU list: non-zero exit, a message that names the list and its dates, no report, no spreadsheet, no sealed record, no token", () => {
  /* a file generated in 2020 is stale on any day this suite will ever run */
  const r = racineDeCommande({ gen: "2020-01-10", publication: "2019-12-20" });
  try {
    const c = commande(r);
    assert.equal(c.statut, 1, `exit code ${c.statut}:\n${c.erreurs.slice(0, 800)}`);
    assert.ok(c.erreurs.includes(TITRE_UE) && c.erreurs.includes("2020-01-10"), `the message names the list and the date:\n${c.erreurs}`);
    assert.match(c.erreurs, /Nothing was screened and nothing was written/);
    assert.ok(!/screened against/.test(c.sortie), `nothing was screened:\n${c.sortie}`);
    assert.deepEqual(cote(r), ["contreparties.csv"], "no report and no sealed record beside the file");
    const nouveaux = fichiersSous(r.dossier).map((f) => relative(r.dossier, f)).filter((f) => /screening\.(json|csv)$/.test(f));
    assert.deepEqual(nouveaux, [], "no report anywhere under the root");
    assert.ok(!c.sortie.includes(FAUX_JETON) && !c.erreurs.includes(FAUX_JETON), "no token in what was printed");
    assert.equal(c.appelsReseau, "", "the refusal asked the network nothing: it is decided from the manifest and the clock");
  } finally {
    sansTrace(r);
  }
});

test("the command line has no override: the flag is refused as unknown, the usage text and the documents do not name the option", () => {
  const r = racineDeCommande({ gen: "2020-01-10", publication: "2019-12-20" });
  try {
    for (const drapeau of ["--essai-liste-ue-perimee", "--essaiListeUePerimee", "--allow-stale-eu"]) {
      const c = commande(r, drapeau);
      assert.equal(c.statut, 2, drapeau);
      assert.match(c.erreurs, /Unknown option/);
    }
    const usage = spawnSync(process.execPath, [join(r.dossier, "src", "cribler.ts")], { cwd: r.dossier, encoding: "utf8" });
    assert.ok(!/essai|override|stale/i.test(usage.stderr), `the usage text does not mention it:\n${usage.stderr}`);
  } finally {
    sansTrace(r);
  }
  const clients = [join(ICI, "..", "README.md"), ...readdirSync(join(ICI, "..", "doc")).filter((f) => f.endsWith(".md")).map((f) => join(ICI, "..", "doc", f))];
  for (const f of clients) assert.ok(!/essaiListeUePerimee/.test(readFileSync(f, "utf8")), `${relative(ICI, f)} must not name the test override`);
  assert.ok(existsSync(join(ICI, "cribler.ts")));
});

test("the command asks for a sealed record before it writes anything, and never passes the override", () => {
  const src = readFileSync(join(ICI, "cribler.ts"), "utf8");
  const principal = src.slice(src.indexOf("function principal()"));
  assert.ok(principal.includes("executer(fichier, arg(\"client\"), new Date(), precedent)"), "the command calls executer with no options");
  assert.ok(!principal.includes("essaiListeUePerimee"), "the command never names the override");
  const exige = principal.indexOf("exigerReleveScelle(c)");
  const ecrit = principal.indexOf("writeFileSync(cheminJson");
  assert.ok(exige !== -1 && ecrit !== -1 && exige < ecrit, "exigerReleveScelle comes before the first write");
});
