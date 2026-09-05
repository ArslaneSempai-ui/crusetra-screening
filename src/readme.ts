/**
 * Le README qui ne peut pas périmer : ses tables sont GÉNÉRÉES, jamais tapées.
 *
 *   npm run figures            réécrit les blocs entre marqueurs
 *   node src/readme.ts --check refuse si un bloc ne correspond plus au code (la suite le lance)
 *
 * Deux blocs pour commencer, la forme de cascade-routing :
 *   commandes  la table des commandes, dans l'ordre où elles ont un sens
 *   tests      « N tests across M files » compté DANS LES SOURCES, jamais recopié
 *
 * Chaque commande ajoutée par un lot ajoute sa ligne ICI, pas dans le README : le README
 * suit. Un lot qui ajoute un test n'a rien à faire : le compte suit tout seul.
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { run, table } from "./figures.ts";

/* ─── les commandes, dans l'ordre où elles ont un sens ─── */
export const COMMANDES: [string, string][] = [
  ["npm ci --ignore-scripts", "install exactly the versions the lockfile pins, and run no install script from any dependency — the only command besides `listes -- --fetch` that needs the network"],
  ["npm run test", "types, the README blocks, the licence inventory, and the suite — start here; it runs with the network cut"],
  ["npm run measure:yours -- --alerts=<csv> [--screened=<csv> | --volume=N]", "your own alert history: recall and false-alert rate per matcher and threshold, with n and interval; a sealed record and a report beside your file, never a name"],
  ["npm run optimise -- --from=<record> --recall=<min>", "the frontier: fewest alerts with the recall lower bound held, or `--alert-budget=<N>` for the highest bounded recall under a monthly alert budget"],
  ["npm run sceller -- <record.json>", "seal a record: the fingerprint that makes a silently edited measurement fail loudly — the same fingerprint as cascade-routing"],
  ["npm run verify -- <report>", "check that a report was issued by the holder of the suite's public key, `cle-publique.pem`, without asking us"],
  ["npm run licences", "regenerate `LICENCES.md`, the licence of every shipped package — `--check` fails the suite when the table drifts"],
];

/* ─── le compte des tests, lu dans les sources ─── */
const dossier = fileURLToPath(new URL(".", import.meta.url));

/** Les extensions de fichiers de test que le script `test` de package.json lance vraiment. */
export function extensionsLancees(scriptTest: string): string[] {
  return [...scriptTest.matchAll(/src\/\*(\.test\.[a-z]+)/g)].map((m) => m[1]!);
}

/** Compte les `test(` dans les fichiers que la commande de test lance — pas dans ceux qu'on
 *  aurait choisis ici. */
export function compterLesCas(dossierSrc: string, scriptTest: string): { n: number; fichiers: string[] } {
  const extensions = extensionsLancees(scriptTest);
  const fichiers = readdirSync(dossierSrc).filter((f) => extensions.some((e) => f.endsWith(e))).sort();
  let n = 0;
  for (const f of fichiers) {
    const src = readFileSync(join(dossierSrc, f), "utf8");
    n += [...src.matchAll(/^\s*test\s*\(/gm)].length;
  }
  return { n, fichiers };
}

const scriptTest = String(JSON.parse(
  readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8"),
).scripts?.test ?? "");

/* TÉMOIN AVANT LE COMPTE : si le motif cesse de lire le script, le compte porterait sur un
   ensemble choisi ici plutôt que sur celui qui tourne. */
if (extensionsLancees(scriptTest).length < 2) {
  throw new Error("the `test` script in package.json no longer names the test extensions it runs; the count would lie.");
}
const { n, fichiers } = compterLesCas(dossier, scriptTest);
if (n < 5) throw new Error(`${n} tests counted across ${fichiers.length} file(s): the reading failed.`);

const blocs = {
  commandes: table(["Command", "What it does, in the order that makes sense"],
    COMMANDES.map(([c, quoi]) => [`\`${c}\``, quoi])),
  tests: `**${n} tests** across ${fichiers.length} files, counted from the sources rather than typed here.`,
};

run(fileURLToPath(new URL("../README.md", import.meta.url)), blocs);
