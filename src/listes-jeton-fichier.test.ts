/*
 * THE EU TOKEN MAY LIVE IN A FILE, ~/.cascade/eu-token, AND THE FILE IS TRUSTED ONLY WHEN IT LOOKS LIKE A SECRET.
 *
 * The order is CRUSETRA_EU_TOKEN, then CASCADE_EU_TOKEN (its deprecated name), then the file, then the public generic
 * token. The file is read only when it exists, is a regular file (a symbolic link is ignored, not followed), belongs to
 * the current user and has no permission bit for the group or others (mode 600 or stricter). A file that exists and
 * fails one of those rules is ignored with ONE warning per process that names the path and the rule, never the value
 * and never its length. The value is trimmed; an empty one is ignored. On win32 a file mode means nothing, so the file
 * is never read there: the variables only.
 *
 * The value is a secret like the variables: it goes in the request and nowhere else. These cases run the real command
 * (`--fetch --only=EU`) in a throwaway copy of the modules it needs, with a throwaway HOME and a FAKE token, and a
 * `fetch` that never touches the network, and then read everything the run left behind: the manifest, every file, standard
 * output and standard error, including when the download fails. The real home of the person who runs the suite is
 * never read: every run below sets its own HOME, and `jetonUe` called with an explicit environment reads no file.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, constants as fsConstants, cpSync, existsSync, fstatSync, closeSync, mkdirSync, mkdtempSync, openSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as listes from "./listes.ts";

const FAUX_JETON = "FAKE-TOKEN-0000";
const FAUX_JETON_ENV = "FAKE-ENV-TOKEN-1111";
/** A fake value of an unusual length, so that "its length" can be searched for in what a run prints. */
const FAUX_JETON_LONG = `${FAUX_JETON}-${"x".repeat(15)}`;
const LONGUEUR_LONG = String(FAUX_JETON_LONG.length);
const GENERIQUE = listes.jetonUe({});
const ICI = fileURLToPath(new URL(".", import.meta.url));
const URL_UE_ECRITE = "https://webgate.ec.europa.eu/fsd/fsf/public/files/xmlFullSanctionsList_1_1/content?token=[username]";
const PEUT_CHMOD = process.platform !== "win32";
const SAUT_WIN = PEUT_CHMOD ? false : "file modes mean nothing on win32: the file is never read there";

/* ───────────────────────────── the rules, on the reader alone ───────────────────────────── */

/** A throwaway home with `.cascade/eu-token` laid out as asked; its parent folder is returned too, for removal. */
type Pose = { contenu: string; mode?: number } | { lienVers: string } | { dossier: true } | { fifo: true } | null;
function maisonAvec(pose: Pose): { base: string; maison: string; chemin: string } {
  const base = realpathSync(mkdtempSync(join(tmpdir(), "jeton-lecteur-")));
  const maison = join(base, "home");
  mkdirSync(join(maison, ".cascade"), { recursive: true });
  const chemin = join(maison, ".cascade", "eu-token");
  if (pose === null) return { base, maison, chemin };
  if ("dossier" in pose) mkdirSync(chemin);
  else if ("fifo" in pose) execFileSync("mkfifo", [chemin]);
  else if ("lienVers" in pose) symlinkSync(pose.lienVers, chemin);
  else { writeFileSync(chemin, pose.contenu); if (PEUT_CHMOD) chmodSync(chemin, pose.mode ?? 0o600); }
  return { base, maison, chemin };
}

/** What the reader says for a file laid out as asked, in a home that is removed afterwards. */
function lire(pose: Pose, plateforme?: string, uid?: number): { r: ReturnType<typeof listes.lireJetonFichier>; chemin: string } {
  const { base, maison, chemin } = maisonAvec(pose);
  try {
    return { r: listes.lireJetonFichier(maison, plateforme, uid), chemin };
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
}

/** The warning a refused file gives: it names the path and says which rule failed, and it never carries the value or its length. */
function assertAvertissement(r: ReturnType<typeof listes.lireJetonFichier>, chemin: string, regle: RegExp): void {
  assert.equal(r.etat, "ignore", JSON.stringify(r));
  const a = (r as { avertissement: string }).avertissement;
  assert.ok(a.includes("~/.cascade/eu-token"), `the warning names the file in its tilde form: ${a}`);
  assert.ok(!a.includes(chemin) && !a.includes(chemin.slice(0, chemin.indexOf(".cascade"))), `the warning never writes the absolute path: ${a}`);
  assert.match(a, regle, a);
  assert.ok(!a.includes(FAUX_JETON), "the warning never carries the value");
  assert.ok(!new RegExp(`\\b${LONGUEUR_LONG}\\b`).test(a), `the warning never carries the length: ${a}`);
  assert.ok(!a.includes("\n"), "the warning is one line");
}

test("the reader: a file at 600 gives its value trimmed, whatever surrounds it", { skip: SAUT_WIN }, () => {
  const { r } = lire({ contenu: `  \t${FAUX_JETON}\r\n\n` });
  assert.deepEqual(r, { etat: "lu", valeur: FAUX_JETON });
});

test("the reader: a file stricter than 600 is read too (the rule is no group or other bit, not exactly 600)", { skip: SAUT_WIN }, () => {
  assert.deepEqual(lire({ contenu: FAUX_JETON, mode: 0o400 }).r, { etat: "lu", valeur: FAUX_JETON });
});

test("the reader: no file means nothing to say, not a warning", () => {
  assert.deepEqual(lire(null).r, { etat: "absent" });
});

test("the reader: any group or other permission bit refuses the file, with the rule and the path in the warning and nothing of the value", { skip: SAUT_WIN }, () => {
  for (const mode of [0o644, 0o640, 0o604, 0o660, 0o666, 0o755, 0o601, 0o610]) {
    const { r, chemin } = lire({ contenu: FAUX_JETON_LONG, mode });
    assertAvertissement(r, chemin, /group or others/);
    assert.ok((r as { avertissement: string }).avertissement.includes(mode.toString(8)), `the mode seen is named (${mode.toString(8)})`);
  }
});

test("the reader: a symbolic link is ignored, even when its target is a perfect file", { skip: SAUT_WIN }, () => {
  const base = realpathSync(mkdtempSync(join(tmpdir(), "jeton-lien-")));
  try {
    const cible = join(base, "cible");
    writeFileSync(cible, FAUX_JETON_LONG);
    chmodSync(cible, 0o600);
    const { r, chemin } = lire({ lienVers: cible });
    assertAvertissement(r, chemin, /not a regular file/);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("the reader: a folder where the file should be is not a regular file", { skip: SAUT_WIN }, () => {
  const { r, chemin } = lire({ dossier: true });
  assertAvertissement(r, chemin, /not a regular file/);
});

test("the reader: a file owned by someone else is refused", { skip: SAUT_WIN }, () => {
  const { r, chemin } = lire({ contenu: FAUX_JETON_LONG }, undefined, (process.getuid?.() ?? 0) + 1);
  assertAvertissement(r, chemin, /not owned by the current user/);
});

test("the reader: an empty or whitespace-only file gives no token, and says so without saying how long it was", { skip: SAUT_WIN }, () => {
  for (const contenu of ["", "   \n\t\r\n"]) {
    const { r, chemin } = lire({ contenu });
    assertAvertissement(r, chemin, /empty/);
  }
});

test("the reader: a file nobody can read is ignored with the error code, not a crash", { skip: SAUT_WIN || (process.getuid?.() === 0 ? "root reads any file" : false) }, () => {
  const { r, chemin } = lire({ contenu: FAUX_JETON_LONG, mode: 0 });
  assertAvertissement(r, chemin, /cannot be read \(EACCES\)/);
});

test("the reader: a value larger than a token can be is ignored, with no length in the warning; a value exactly at the cap is read", { skip: SAUT_WIN }, () => {
  const gros = lire({ contenu: "x".repeat(listes.PLAFOND_OCTETS_JETON_FICHIER + 1) });
  assertAvertissement(gros.r, gros.chemin, /larger than a token/);
  const enorme = lire({ contenu: "x".repeat(10 * listes.PLAFOND_OCTETS_JETON_FICHIER) });
  assertAvertissement(enorme.r, enorme.chemin, /larger than a token/);
  assert.equal(lire({ contenu: "x".repeat(listes.PLAFOND_OCTETS_JETON_FICHIER) }).r.etat, "lu");
});

test("the reader: a value with a space, a line break, a tab or a control character inside is ignored (the URL parser strips a newline, so it would reach the wire as another string than the one held for redaction)", { skip: SAUT_WIN }, () => {
  for (const contenu of ["abc def", "abc\ndef", "abc\r\ndef", "abc\tdef", "abc\u0007def", "abc\u0000def", "abc\u2003def"]) {
    const { r, chemin } = lire({ contenu });
    assertAvertissement(r, chemin, /single word/);
  }
  assert.equal(lire({ contenu: "abc-def_123.XYZ\n" }).r.etat, "lu", "a token with its usual punctuation, and a final newline, is still read");
});

test("the reader: a FIFO where the file should be is ignored without blocking, and the descriptor the reader opens refuses it too (opened without blocking, never through a link)", { skip: SAUT_WIN }, () => {
  const { r, chemin } = lire({ fifo: true });
  assertAvertissement(r, chemin, /not a regular file/);
  assert.ok((listes.OUVERTURE_JETON_FICHIER & fsConstants.O_NONBLOCK) !== 0 && (listes.OUVERTURE_JETON_FICHIER & fsConstants.O_NOFOLLOW) !== 0, "the file is opened with O_NONBLOCK and O_NOFOLLOW");
  /* what a FIFO swapped in between the check and the open would meet: the open returns at once, and fstat says it is no regular file */
  const { base, chemin: fifo } = maisonAvec({ fifo: true });
  try {
    const fd = openSync(fifo, listes.OUVERTURE_JETON_FICHIER);
    try { assert.equal(fstatSync(fd).isFile(), false); } finally { closeSync(fd); }
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("the reader: on win32 a file mode means nothing, so the file is never read there, even a perfect one", () => {
  const { base, maison } = maisonAvec({ contenu: FAUX_JETON });
  try {
    assert.deepEqual(listes.lireJetonFichier(maison, "win32"), { etat: "absent" });
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("jetonUe with an explicit environment reads no file: only a call on the process's own environment does", () => {
  /* the existing cases call jetonUe({}) and expect the generic token: they must not depend on the home of whoever runs the suite */
  assert.equal(listes.jetonUe({}), GENERIQUE);
  assert.equal(listes.jetonUe({ CRUSETRA_EU_TOKEN: FAUX_JETON_ENV }), FAUX_JETON_ENV);
});

/* ───────────────────────────── the command, run for real in a throwaway root ───────────────────────────── */

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

/** The `fetch` the child process gets: no network. It records whether the request carried the token it expected, never the token. */
const FAUSSE_RECUPERATION = `
import { readFileSync, writeFileSync } from "node:fs";
globalThis.fetch = async (url) => {
  if (String(url).endsWith("/public/rss")) return new Response(readFileSync(process.env.STUB_RSS));
  const envoye = new URL(String(url)).searchParams.get("token");
  writeFileSync(process.env.STUB_SEEN, envoye === process.env.STUB_EXPECT ? "expected" : "other");
  if (process.env.STUB_MODE === "throws") throw new Error("connect ECONNRESET while fetching " + url);
  if (process.env.STUB_MODE === "bare") throw new Error("the proxy refused the key " + envoye + " for the host");
  if (process.env.STUB_MODE === "http500") return new Response("server error", { status: 500 });
  return new Response(readFileSync(process.env.STUB_BODY));
};
`;

type Mode = "ok" | "http500" | "throws" | "bare";
type Lancement = {
  pose?: Pose; mode?: Mode; args?: string[]; corps?: string;
  /** the token the request is expected to carry */
  attendu: string;
  /** variables set for the child, on top of a clean environment */
  env?: Record<string, string>;
};
type Course = { base: string; racine: string; maison: string; chemin: string; sortie: string; erreurs: string; statut: number | null; vu: string | null };

function lancer({ pose = null, mode = "ok", args = ["--fetch", "--only=EU"], corps = "ue.xml", attendu, env: sup = {} }: Lancement): Course {
  /* the home sits BESIDE the run root, so that a scan of the root does not find the token file the case laid down itself */
  const { base, maison, chemin } = maisonAvec(pose);
  const racine = join(base, "run");
  mkdirSync(join(racine, "src"), { recursive: true });
  for (const f of fermeture("listes.ts")) cpSync(join(ICI, f), join(racine, "src", f));
  cpSync(join(ICI, "..", "package.json"), join(racine, "package.json"));
  writeFileSync(join(racine, "fausse-recuperation.mjs"), FAUSSE_RECUPERATION);
  const env: Record<string, string | undefined> = { ...process.env };
  for (const n of ["CRUSETRA_EU_TOKEN", "CASCADE_EU_TOKEN", "CRUSETRA_OFFLINE", "CASCADE_OFFLINE"]) delete env[n];
  Object.assign(env, {
    HOME: maison, USERPROFILE: maison,
    STUB_MODE: mode, STUB_EXPECT: attendu, STUB_BODY: join(ICI, "fixtures", corps), STUB_SEEN: join(racine, "seen.txt"),
    STUB_RSS: join(ICI, "fixtures", "ue-rss.xml"),
  }, sup);
  const r = spawnSync(process.execPath,
    ["--import", pathToFileURL(join(racine, "fausse-recuperation.mjs")).href, join(racine, "src", "listes.ts"), ...args],
    { cwd: racine, encoding: "utf8", env, timeout: 60_000 });
  const vu = existsSync(join(racine, "seen.txt")) ? readFileSync(join(racine, "seen.txt"), "utf8") : null;
  return { base, racine, maison, chemin, sortie: r.stdout, erreurs: r.stderr, statut: r.status, vu };
}

/** Every place one of the fake values is after a run: a file under the run root, standard output, standard error. */
function fuitesDe(c: Course, valeurs: readonly string[]): string[] {
  const fuites: string[] = [];
  for (const v of valeurs) {
    for (const f of fichiersSous(c.racine)) if (readFileSync(f).includes(v)) fuites.push(`${v}: file ${relative(c.racine, f)}`);
    if (c.sortie.includes(v)) fuites.push(`${v}: standard output`);
    if (c.erreurs.includes(v)) fuites.push(`${v}: standard error`);
  }
  return fuites;
}

type LigneUe = { url: string; disponible: boolean; erreur?: string };
const ligneUe = (c: Course): LigneUe => (JSON.parse(readFileSync(join(c.racine, "listes-manifest.json"), "utf8")) as { listes: (LigneUe & { source: string })[] }).listes.find((l) => l.source === "EU")!;

/** The warnings of a run: the lines of standard error that name the token file. */
const avertissementsDe = (c: Course): string[] => c.erreurs.split("\n").filter((l) => l.includes("eu-token"));

const nettoyer = (c: Course): void => rmSync(c.base, { recursive: true, force: true });

test("EU fetch with the token in ~/.cascade/eu-token at 600: its trimmed value is sent in the request and written nowhere", { skip: SAUT_WIN }, () => {
  const c = lancer({ pose: { contenu: `  ${FAUX_JETON}\r\n` }, attendu: FAUX_JETON });
  try {
    assert.equal(c.statut, 0, `exit code ${c.statut}:\n${c.erreurs.slice(0, 600)}`);
    assert.equal(c.vu, "expected", "the request carries the value of the file, trimmed");
    assert.deepEqual(fuitesDe(c, [FAUX_JETON]), [], "the token reached these places");
    assert.equal(ligneUe(c).url, URL_UE_ECRITE, "the manifest keeps the placeholder");
    assert.deepEqual(avertissementsDe(c), [], `a good file says nothing:\n${c.erreurs}`);
  } finally {
    nettoyer(c);
  }
});

test("EU fetch with the file at 644: ignored with one warning that names the path and the rule, the public generic token is sent, nothing of the value is printed", { skip: SAUT_WIN }, () => {
  const c = lancer({ pose: { contenu: FAUX_JETON_LONG, mode: 0o644 }, attendu: GENERIQUE });
  try {
    assert.equal(c.statut, 0, `exit code ${c.statut}:\n${c.erreurs.slice(0, 600)}`);
    assert.equal(c.vu, "expected", "the request carries the public generic token, not the value of the refused file");
    const a = avertissementsDe(c);
    assert.equal(a.length, 1, `exactly one warning:\n${c.erreurs}`);
    assert.ok(a[0]!.includes("~/.cascade/eu-token") && !a[0]!.includes(c.maison), `the warning names the file by its tilde form: ${a[0]}`);
    assert.match(a[0]!, /group or others/);
    assert.match(a[0]!, /644/);
    assert.deepEqual(fuitesDe(c, [FAUX_JETON, FAUX_JETON_LONG]), [], "the value reached these places");
    assert.ok(!new RegExp(`\\b${LONGUEUR_LONG}\\b`).test(a[0]!), `the warning does not carry the length: ${a[0]}`);
  } finally {
    nettoyer(c);
  }
});

test("EU fetch with the file a symbolic link to a perfect file: ignored with one warning, the public generic token is sent", { skip: SAUT_WIN }, () => {
  const cible = join(realpathSync(mkdtempSync(join(tmpdir(), "jeton-cible-"))), "cible");
  writeFileSync(cible, FAUX_JETON);
  chmodSync(cible, 0o600);
  const c = lancer({ pose: { lienVers: cible }, attendu: GENERIQUE });
  try {
    assert.equal(c.statut, 0, `exit code ${c.statut}:\n${c.erreurs.slice(0, 600)}`);
    assert.equal(c.vu, "expected", "the request carries the public generic token: the link was not followed");
    const a = avertissementsDe(c);
    assert.equal(a.length, 1, `exactly one warning:\n${c.erreurs}`);
    assert.match(a[0]!, /not a regular file/);
    assert.deepEqual(fuitesDe(c, [FAUX_JETON]), []);
  } finally {
    nettoyer(c);
    rmSync(join(cible, ".."), { recursive: true, force: true });
  }
});

test("EU fetch with CRUSETRA_EU_TOKEN set and a perfect file: the variable wins, the file is not even read", { skip: SAUT_WIN }, () => {
  const c = lancer({ pose: { contenu: FAUX_JETON }, attendu: FAUX_JETON_ENV, env: { CRUSETRA_EU_TOKEN: FAUX_JETON_ENV } });
  try {
    assert.equal(c.statut, 0, `exit code ${c.statut}:\n${c.erreurs.slice(0, 600)}`);
    assert.equal(c.vu, "expected", "the request carries the variable, not the file");
    assert.deepEqual(fuitesDe(c, [FAUX_JETON, FAUX_JETON_ENV]), []);
    assert.equal(ligneUe(c).url, URL_UE_ECRITE);
  } finally {
    nettoyer(c);
  }
});

test("EU fetch with only CASCADE_EU_TOKEN set (the deprecated name) and a file at 644: the variable wins and the file is not looked at, so no warning", { skip: SAUT_WIN }, () => {
  const c = lancer({ pose: { contenu: FAUX_JETON, mode: 0o644 }, attendu: FAUX_JETON_ENV, env: { CASCADE_EU_TOKEN: FAUX_JETON_ENV } });
  try {
    assert.equal(c.statut, 0, `exit code ${c.statut}:\n${c.erreurs.slice(0, 600)}`);
    assert.equal(c.vu, "expected");
    assert.deepEqual(avertissementsDe(c), [], `a file that is not consulted is not complained about:\n${c.erreurs}`);
    assert.deepEqual(fuitesDe(c, [FAUX_JETON, FAUX_JETON_ENV]), []);
  } finally {
    nettoyer(c);
  }
});

test("EU fetch with an empty file: the public generic token is sent", { skip: SAUT_WIN }, () => {
  const c = lancer({ pose: { contenu: " \n\t\n" }, attendu: GENERIQUE });
  try {
    assert.equal(c.statut, 0, `exit code ${c.statut}:\n${c.erreurs.slice(0, 600)}`);
    assert.equal(c.vu, "expected", "an empty file gives no token: the generic one is used");
  } finally {
    nettoyer(c);
  }
});

test("EU fetch of another source never reads the token file: a file at 644 draws no warning", { skip: SAUT_WIN }, () => {
  const c = lancer({ pose: { contenu: FAUX_JETON, mode: 0o644 }, attendu: GENERIQUE, args: ["--fetch", "--only=UN"], corps: "onu.xml" });
  try {
    assert.equal(c.statut, 0, `exit code ${c.statut}:\n${c.erreurs.slice(0, 600)}`);
    assert.deepEqual(avertissementsDe(c), [], `the token is read when the EU request is built, and only then:\n${c.erreurs}`);
  } finally {
    nettoyer(c);
  }
});

test("no absolute home path reaches the manifest, standard output or standard error of a run with a temporary HOME (a refused file, then a failed download)", { skip: SAUT_WIN }, () => {
  const c = lancer({ pose: { contenu: FAUX_JETON, mode: 0o644 }, mode: "http500", attendu: GENERIQUE });
  try {
    const manifeste = readFileSync(join(c.racine, "listes-manifest.json"), "utf8");
    for (const [nom, texte] of [["the manifest", manifeste], ["standard output", c.sortie], ["standard error", c.erreurs]] as const) {
      assert.ok(!texte.includes(c.maison) && !texte.includes(c.base), `${nom} holds the home path:\n${texte.slice(0, 600)}`);
    }
    assert.ok(manifeste.includes("~/.cascade/eu-token") && c.sortie.includes("~/.cascade/eu-token"), "the way out names the file by its tilde form, in the manifest and on the screen");
    assert.ok(c.erreurs.includes("~/.cascade/eu-token"), "and so does the warning");
  } finally {
    nettoyer(c);
  }
});

/* The download fails three ways; the value of the file is a held token in all of them. The third one quotes the value
   WITHOUT a `token=` in front of it (a proxy, a library): only the held-token rule can catch that. */
function verifierEchec(mode: "http500" | "throws" | "bare"): void {
  const c = lancer({ pose: { contenu: FAUX_JETON }, mode, attendu: FAUX_JETON });
  try {
    assert.equal(c.vu, "expected", "the request carried the value of the file");
    assert.equal(c.statut, 1, `exit code ${c.statut}`);
    assert.deepEqual(fuitesDe(c, [FAUX_JETON]), [], "the token reached these places");
    const ue = ligneUe(c);
    assert.equal(ue.disponible, false);
    assert.equal(ue.url, URL_UE_ECRITE);
    if (mode === "http500") assert.equal(ue.erreur, "HTTP 500");
    if (mode === "throws") assert.match(ue.erreur ?? "", /^network: connect ECONNRESET while fetching https:\/\/webgate\.ec\.europa\.eu\/.*token=\[username\]/);
    if (mode === "bare") assert.equal(ue.erreur, "network: the proxy refused the key [username] for the host", "the held value is replaced where it stands");
  } finally {
    nettoyer(c);
  }
}

/* Explicit cases, not a loop: the README counts `test(` in the sources and must equal what runs. */
test("EU fetch with the token in the file, HTTP 500: the value is written nowhere", { skip: SAUT_WIN }, () => verifierEchec("http500"));
test("EU fetch with the token in the file, the network error quotes the address: the value is written nowhere", { skip: SAUT_WIN }, () => verifierEchec("throws"));
test("EU fetch with the token in the file, the error quotes the bare value: the value is a held token and goes", { skip: SAUT_WIN }, () => verifierEchec("bare"));

/* ───────────────────────────── once per process, and held from the read on ───────────────────────────── */

/** A probe module run in the throwaway root: it asks for the token three times, with the file changed in between. */
const SONDE = `
import { writeFileSync } from "node:fs";
import { jetonUe, urlSansJeton } from "./src/listes.ts";
const texte = "the proxy refused " + process.env.PROBE_VALUE + " for the host";
const avant = urlSansJeton(texte, {});
const a = jetonUe(process.env);
writeFileSync(process.env.PROBE_FILE, "CHANGED-AFTER-THE-FIRST-READ");
const b = jetonUe(process.env);
const c = jetonUe(process.env);
console.log(JSON.stringify({
  redactionReadsNothing: avant === texte,
  readOnce: a === b && b === c,
  held: urlSansJeton(texte, {}) === "the proxy refused [username] for the host",
}));
`;

function sonder(mode: number): { sortie: Record<string, boolean>; erreurs: string; base: string } {
  const { base, maison, chemin } = maisonAvec({ contenu: FAUX_JETON, mode });
  const racine = join(base, "run");
  mkdirSync(join(racine, "src"), { recursive: true });
  for (const f of fermeture("listes.ts")) cpSync(join(ICI, f), join(racine, "src", f));
  cpSync(join(ICI, "..", "package.json"), join(racine, "package.json"));
  writeFileSync(join(racine, "sonde.mjs"), SONDE);
  const env: Record<string, string | undefined> = { ...process.env };
  for (const n of ["CRUSETRA_EU_TOKEN", "CASCADE_EU_TOKEN"]) delete env[n];
  Object.assign(env, { HOME: maison, USERPROFILE: maison, PROBE_FILE: chemin, PROBE_VALUE: FAUX_JETON });
  const r = spawnSync(process.execPath, [join(racine, "sonde.mjs")], { cwd: racine, encoding: "utf8", env, timeout: 60_000 });
  assert.equal(r.status, 0, r.stderr);
  return { sortie: JSON.parse(r.stdout) as Record<string, boolean>, erreurs: r.stderr, base };
}

test("the file is read once per process, not before the token is asked for, and its value is a held token from that read on", { skip: SAUT_WIN }, () => {
  const { sortie, erreurs, base } = sonder(0o600);
  try {
    assert.equal(sortie.redactionReadsNothing, true, "redacting a text before any request reads no file");
    assert.equal(sortie.readOnce, true, "the second and third asks give the value of the first read, though the file changed");
    assert.equal(sortie.held, true, "the value read counts as a held token: a bare mention of it is replaced");
    assert.ok(!erreurs.includes("eu-token"), `a good file says nothing:\n${erreurs}`);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("a refused file draws one warning per process, however many times the token is asked for", { skip: SAUT_WIN }, () => {
  const { erreurs, base } = sonder(0o644);
  try {
    assert.equal(erreurs.split("\n").filter((l) => l.includes("eu-token")).length, 1, erreurs);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});
