/*
 * THE EU TOKEN NEVER REACHES A FILE, A LOG LINE OR AN ERROR.
 *
 * On 13 October 2026 `node src/listes.ts --fetch --only=EU`, run with CRUSETRA_EU_TOKEN set to a personal EU Login
 * token, wrote the URL it had fetched, token included, into the committed listes-manifest.json. The URL of the EU
 * source was built with the token inside it, and the manifest line, the sealed record and the error texts all copied
 * that URL.
 *
 * These cases run the real command (`--fetch --only=EU`) in a throwaway copy of the modules it needs, with a FAKE
 * token and a `fetch` that never touches the network, and then read everything the run left behind: the manifest, the
 * downloaded file, every other file, standard output and standard error. The fake token may appear nowhere but in the
 * request itself, which must still carry it (a fix that stops sending the token would "pass" by breaking the download).
 * Two more runs start from an OLD-STYLE manifest, the kind the code before the fix wrote, with the fake token in the
 * `erreur` and `issue` of a row: it must not reach standard output, and it must not be carried into the next manifest.
 *
 * PATHS THAT HAVE ONLY A RULE WITNESS, NO RUN WITNESS (the rule at the end and SOURCES holding the placeholder are
 * what guard them): the `url` of each sealed `listes[]` row in cribler.ts `executer` (it needs the real lists on disk
 * and measures its thresholds over the training sets, minutes of work), and the last-resort `console.error` of
 * listes.ts `principal` (no stubbed fetch can make an error that reaches it quote the address). The reason a sealed
 * record gives for a list that was not screened does have its own case below.
 *
 * The last cases are a rule, not a run: no module reads the `url` of a SOURCES entry except through `urlSansJeton`, to
 * write or show it, or `urlDeTelechargement`, to send the request. The rule follows how an entry is BOUND (loop
 * variable, callback parameter, result of `find` or an index, parameter typed SourceListe), whatever the variable is
 * called, and reads every folder under src. It does not see a destructuring (`const { url } = entry`), a bracket read
 * (`entry["url"]`) or an alias (`const t = entry`): the run cases are what catch those.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const FAUX_JETON = "FAKE-TOKEN-0000";
const ICI = fileURLToPath(new URL(".", import.meta.url));
const URL_UE_ECRITE = "https://webgate.ec.europa.eu/fsd/fsf/public/files/xmlFullSanctionsList_1_1/content?token=[username]";

/** The `fetch` the child process gets: no network. It records, without ever writing the token, whether the request carried it. */
const FAUSSE_RECUPERATION = `
import { readFileSync, writeFileSync } from "node:fs";
globalThis.fetch = async (url) => {
  const porte = String(url).includes(process.env.STUB_TOKEN);
  writeFileSync(process.env.STUB_SEEN, porte ? "carried" : "did not carry");
  if (process.env.STUB_MODE === "throws") throw new Error("connect ECONNRESET while fetching " + url);
  if (process.env.STUB_MODE === "http500") return new Response("server error", { status: 500 });
  return new Response(readFileSync(process.env.STUB_BODY));
};
`;

/** listes.ts and every module it imports, found by reading the imports, so a new import cannot silently break the copy. */
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

type Mode = "ok" | "http500" | "throws";
type Lancement = { mode?: Mode; args?: string[]; manifesteAvant?: string; corps?: string };

function lancer({ mode = "ok", args = ["--fetch", "--only=EU"], manifesteAvant, corps = "ue.xml" }: Lancement): { racine: string; sortie: string; erreurs: string; statut: number | null } {
  /* realpath: on macOS tmpdir() is a symlink, and `isMain` compares the resolved module URL with argv[1]. */
  const racine = realpathSync(mkdtempSync(join(tmpdir(), "jeton-ue-")));
  mkdirSync(join(racine, "src"));
  for (const f of fermeture("listes.ts")) cpSync(join(ICI, f), join(racine, "src", f));
  cpSync(join(ICI, "..", "package.json"), join(racine, "package.json"));
  writeFileSync(join(racine, "fausse-recuperation.mjs"), FAUSSE_RECUPERATION);
  if (manifesteAvant !== undefined) writeFileSync(join(racine, "listes-manifest.json"), manifesteAvant);
  mkdirSync(join(racine, "home"));
  const env: Record<string, string | undefined> = { ...process.env };
  for (const n of ["CASCADE_EU_TOKEN", "CRUSETRA_OFFLINE", "CASCADE_OFFLINE"]) delete env[n];
  Object.assign(env, {
    CRUSETRA_EU_TOKEN: FAUX_JETON, HOME: join(racine, "home"), USERPROFILE: join(racine, "home"),
    STUB_MODE: mode, STUB_TOKEN: FAUX_JETON, STUB_BODY: join(ICI, "fixtures", corps), STUB_SEEN: join(racine, "seen.txt"),
  });
  const r = spawnSync(process.execPath,
    ["--import", pathToFileURL(join(racine, "fausse-recuperation.mjs")).href, join(racine, "src", "listes.ts"), ...args],
    { cwd: racine, encoding: "utf8", env, timeout: 60_000 });
  return { racine, sortie: r.stdout, erreurs: r.stderr, statut: r.status };
}

/** Every place the fake token is after a run: a file under the throwaway root, standard output, standard error. */
function fuitesDe(racine: string, sortie: string, erreurs: string): string[] {
  const fuites: string[] = [];
  for (const f of fichiersSous(racine)) {
    if (readFileSync(f).includes(FAUX_JETON)) fuites.push(`file ${relative(racine, f)}`);
  }
  if (sortie.includes(FAUX_JETON)) fuites.push("standard output");
  if (erreurs.includes(FAUX_JETON)) fuites.push("standard error");
  return fuites;
}

/** One run of the real command, then everything it left behind is read. */
function verifier(mode: Mode): void {
  const { racine, sortie, erreurs, statut } = lancer({ mode });
  try {
    assert.ok(existsSync(join(racine, "seen.txt")), `the command never reached the download (exit ${statut}):\n${erreurs.slice(0, 600)}`);
    assert.equal(readFileSync(join(racine, "seen.txt"), "utf8"), "carried", "the request must still carry the token: the download needs it");
    assert.equal(statut, mode === "ok" ? 0 : 1, `exit code ${statut}`);
    assert.deepEqual(fuitesDe(racine, sortie, erreurs), [], "the token reached these places");

    const manifeste = JSON.parse(readFileSync(join(racine, "listes-manifest.json"), "utf8")) as { listes: { source: string; url: string; erreur?: string }[] };
    const ue = manifeste.listes.find((l) => l.source === "EU")!;
    assert.equal(ue.url, URL_UE_ECRITE, "the manifest keeps the address with the placeholder the documentation uses");
    if (mode === "throws") {
      assert.match(ue.erreur ?? "", /^network: connect ECONNRESET while fetching https:\/\/webgate\.ec\.europa\.eu\//, "the error keeps its diagnosis; only the token goes");
    }
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
}

/** A manifest as the code BEFORE the fix wrote it: the EU row unavailable, the fake token in its url, erreur and issue. */
const MANIFESTE_ANCIEN = JSON.stringify({
  version: 1, genereLe: "2026-10-13T17:00:00.000Z",
  listes: [{
    source: "EU", titre: "EU consolidated financial sanctions list (FSF, XML v1.1)",
    url: `https://webgate.ec.europa.eu/fsd/fsf/public/files/xmlFullSanctionsList_1_1/content?token=${FAUX_JETON}`,
    format: "eu-fsf-xml-1.1", disponible: false, verifieLe: "2026-10-13T17:00:00.000Z",
    erreur: `network: connect ECONNRESET while fetching https://webgate.ec.europa.eu/x?token=${FAUX_JETON}`,
    issue: `key ${FAUX_JETON} was refused; run --fetch again.`,
  }],
}, null, 2) + "\n";

/* Three explicit cases, not a loop: the README counts `test(` in the sources and must equal what runs. */
test("EU fetch, download succeeds: the fake token is sent in the request and written nowhere", () => verifier("ok"));
test("EU fetch, HTTP 500: the fake token is sent in the request and written nowhere", () => verifier("http500"));
test("EU fetch, the network error quotes the address: the fake token is sent in the request and written nowhere", () => verifier("throws"));

test("an old-style manifest with the token in erreur and issue is listed without it (npm run listes, no flag)", () => {
  const { racine, sortie, erreurs, statut } = lancer({ args: [], manifesteAvant: MANIFESTE_ANCIEN });
  try {
    assert.equal(statut, 0, `exit code ${statut}:\n${erreurs.slice(0, 400)}`);
    assert.match(sortie, /UNAVAILABLE \(checked 2026-10-13\): network: connect ECONNRESET while fetching https:\/\/webgate\.ec\.europa\.eu\/x\?token=\[username\]/, "the line is printed, with the token gone");
    assert.match(sortie, /was refused; run --fetch again/, "the diagnosis around the token survives");
    assert.deepEqual(fuitesDe(racine, sortie, erreurs).filter((f) => f !== "file listes-manifest.json"), [], "the token reached these places");
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test("an old-style manifest is not carried into the next one: a row kept as recorded comes out without the token", () => {
  const { racine, sortie, erreurs, statut } = lancer({ args: ["--fetch", "--only=UN"], manifesteAvant: MANIFESTE_ANCIEN, corps: "onu.xml" });
  try {
    assert.equal(statut, 0, `exit code ${statut}:\n${erreurs.slice(0, 400)}`);
    assert.match(sortie, /EU\s+kept as recorded/);
    assert.deepEqual(fuitesDe(racine, sortie, erreurs), [], "the token reached these places");
    const manifeste = JSON.parse(readFileSync(join(racine, "listes-manifest.json"), "utf8")) as { listes: { source: string; url: string; issue?: string }[] };
    const ue = manifeste.listes.find((l) => l.source === "EU")!;
    assert.equal(ue.url, URL_UE_ECRITE);
    assert.equal(ue.issue, "key [username] was refused; run --fetch again.", "the row is kept, only the token is gone");
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test("the reason a sealed record gives for a list it did not screen carries no token, even from an old-style row", async () => {
  const { raisonNonCriblee } = await import("./cribler.ts");
  const ligne = {
    erreur: `network: connect ECONNRESET while fetching https://h/x?token=${FAUX_JETON}`,
    issue: `key ${FAUX_JETON} was refused; run --fetch again.`,
  };
  const raison = raisonNonCriblee(ligne, { CRUSETRA_EU_TOKEN: FAUX_JETON });
  assert.equal(raison, "network: connect ECONNRESET while fetching https://h/x?token=[username]. key [username] was refused; run --fetch again.");
});

/* ───────────────────────────── the rule: where a source URL may be read ───────────────────────────── */

const APPELS_PERMIS = ["urlSansJeton(", "urlDeTelechargement("];
const echapper = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The 1-based lines of `texte` that read `.url` on an entry of SOURCES with neither `urlSansJeton(` nor
 * `urlDeTelechargement(` right before it. An entry is found by how it is bound; a collection is SOURCES or anything
 * typed `SourceListe[]` (a `sources` parameter).
 */
function lignesQuiLisentUneUrlDeSource(texte: string): number[] {
  const collections = new Set(["SOURCES"]);
  for (const m of texte.matchAll(/\b(\w+)\s*:\s*(?:readonly\s+)?(?:Partial<|Pick<|Omit<)?SourceListe\b[^,;)=]*?\[\]/g)) collections.add(m[1]!);
  const entrees = new Set<string>();
  for (const m of texte.matchAll(/\b(\w+)\s*:\s*(?:Partial<|Pick<|Omit<)?SourceListe\b(?![^,;)=]*\[\])/g)) entrees.add(m[1]!);
  for (const c of [...collections].map(echapper)) {
    for (const m of texte.matchAll(new RegExp(`for\\s*\\(\\s*(?:const|let)\\s+(\\w+)\\s+of\\s+${c}\\b`, "g"))) entrees.add(m[1]!);
    for (const m of texte.matchAll(new RegExp(`\\b${c}\\s*\\.\\s*(?:find|findLast|filter|map|some|every|forEach|flatMap)\\s*\\(\\s*\\(?\\s*(\\w+)`, "g"))) entrees.add(m[1]!);
    for (const m of texte.matchAll(new RegExp(`(?:const|let)\\s+(\\w+)\\s*=\\s*${c}\\s*(?:\\.\\s*find\\b|\\[)`, "g"))) entrees.add(m[1]!);
  }
  const lignes: number[] = [];
  texte.split("\n").forEach((l, i) => {
    const lectures: number[] = [];
    for (const n of entrees) for (const m of l.matchAll(new RegExp(`(?<![\\w.])${echapper(n)}\\s*\\.\\s*url\\b`, "g"))) lectures.push(m.index);
    for (const c of [...collections].map(echapper)) {
      for (const m of l.matchAll(new RegExp(`\\b${c}\\s*\\.\\s*find\\b.*\\)\\s*!?\\s*\\.\\s*url\\b`, "g"))) lectures.push(m.index);
      for (const m of l.matchAll(new RegExp(`\\b${c}\\s*\\[[^\\]]*\\]\\s*!?\\s*\\.\\s*url\\b`, "g"))) lectures.push(m.index);
    }
    if (lectures.some((at) => !APPELS_PERMIS.some((a) => l.slice(0, at).endsWith(a)))) lignes.push(i + 1);
  });
  return lignes;
}

/** `file:line` for every offending read in the non-test .ts and .mjs files under `dossier`, folders included. */
function lecturesNonProtegees(dossier: string): string[] {
  const hors: string[] = [];
  for (const f of fichiersSous(dossier)) {
    if (!/\.(ts|mjs)$/.test(f) || /\.test\./.test(f) || f.includes(`${sep}node_modules${sep}`)) continue;
    for (const n of lignesQuiLisentUneUrlDeSource(readFileSync(f, "utf8"))) hors.push(`${relative(dossier, f).split(sep).join("/")}:${n}`);
  }
  return hors;
}

test("rule detector: finds a source URL read under any variable name and in any folder, lets the two functions and other .url through", () => {
  const mauvais: [string, number][] = [
    ["for (const source of SOURCES) console.log(source.url);", 1],
    ["const urls = SOURCES.map((x) => x.url);", 1],
    ['const def = SOURCES.find((x) => x.source === "EU")!;\nwrite(def.url);', 2],
    ["export const f = (src: SourceListe) => src.url;", 1],
    ['const u = SOURCES.find((x) => x.source === "EU")!.url;', 1],
    ["export function g(liste: readonly SourceListe[]) { return liste.map((e) => e.url); }", 1],
    ["const premiere = SOURCES[0]!.url;", 1],
    ["for (const s of SOURCES) { write(urlSansJeton(s.url)); write(s.url); }", 1],
  ];
  for (const [t, ligne] of mauvais) assert.deepEqual(lignesQuiLisentUneUrlDeSource(t), [ligne], t);
  const permis = [
    "for (const s of SOURCES) write(urlSansJeton(s.url));",
    "export const h = (s: SourceListe) => fetch(urlDeTelechargement(s.url));",
    "SOURCES.map((s) => s.licence.url);",
    'const ici = new URL(".", import.meta.url);',
    "const x = LEI2.url;",
  ];
  for (const t of permis) assert.deepEqual(lignesQuiLisentUneUrlDeSource(t), [], t);

  const racine = realpathSync(mkdtempSync(join(tmpdir(), "regle-url-")));
  try {
    mkdirSync(join(racine, "a", "b"), { recursive: true });
    writeFileSync(join(racine, "a", "b", "mal.ts"), "for (const e of SOURCES) console.log(e.url);\n");
    writeFileSync(join(racine, "a", "b", "mal.test.ts"), "for (const e of SOURCES) console.log(e.url);\n");
    writeFileSync(join(racine, "bien.ts"), "for (const e of SOURCES) console.log(urlSansJeton(e.url));\n");
    assert.deepEqual(lecturesNonProtegees(racine), ["a/b/mal.ts:1"], "a read in a nested folder is found; a test file is not read");
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});

test("rule: a source URL is read only through urlSansJeton (to write or show it) or urlDeTelechargement (to request it)", () => {
  assert.deepEqual(lecturesNonProtegees(ICI), [], "these lines read a source URL without redacting it");
});
