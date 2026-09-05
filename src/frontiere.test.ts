/**
 * LA FRONTIÈRE RÉSEAU DE CET OUTIL, TENUE PAR UN TEST ET PAS PAR UNE PHRASE.
 *
 * La promesse du README : « nothing of yours goes up ». Un seul fichier a le droit de
 * toucher le réseau, le téléchargeur des listes publiques (`listes.ts`) : la liste descend,
 * rien ne monte. Tout autre site d'envoi fait tomber ce cas AVANT qu'un client l'exécute.
 *
 * Le détecteur porte son témoin : s'il ne voyait plus un `fetch(` planté dans une chaîne,
 * le zéro qu'il rend ne prouverait rien.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const dossier = fileURLToPath(new URL(".", import.meta.url));

/** Les seuls fichiers autorisés à toucher le réseau, et pourquoi. */
const AUTORISES: Record<string, string> = {
  "listes.ts": "le téléchargeur des listes publiques : la liste descend, rien ne monte",
  "poids.ts": "le téléchargeur des poids du palier embed : quatre fichiers épinglés (octets et "
    + "sha256), tirés par la seule commande `npm run poids -- --fetch`, jamais pendant "
    + "l'installation ni les tests, refusés sous le drapeau hors-ligne : le poids descend, "
    + "rien ne monte",
};

const MOTIF = /\bfetch\s*\(|from\s+"node:(?:http|https|net|dns|tls|dgram|http2)"|from\s+"undici"|require\(\s*"(?:node:)?(?:http|https|net|dns|tls)"\s*\)|new\s+WebSocket\s*\(/g;

/** Les numéros de ligne où un module touche le réseau. */
export function sitesReseau(src: string): number[] {
  const lignes: number[] = [];
  for (const m of src.matchAll(MOTIF)) lignes.push(src.slice(0, m.index!).split("\n").length);
  return lignes;
}

test("le détecteur voit un site réseau planté : témoin positif", () => {
  assert.deepEqual(sitesReseau(`const x = 1;\nconst r = await fetch("https://a.example");`), [2]);
  assert.deepEqual(sitesReseau(`import { request } from "node:https";`), [1]);
  assert.deepEqual(sitesReseau(`const ws = new WebSocket("ws://a");`), [1]);
  assert.deepEqual(sitesReseau(`const s = "fetched"; const t = "prefetch";`), [],
    "un mot qui contient fetch sans être un appel ne doit pas compter");
});

test("aucun module ne touche le réseau, hors le téléchargeur de listes", () => {
  const fichiers = readdirSync(dossier).filter((n) => /\.(ts|mjs)$/.test(n) && !/\.test\.(ts|mjs)$/.test(n));
  assert.ok(fichiers.length >= 6, `${fichiers.length} fichier(s) lus : la lecture a échoué.`);
  const fautifs: string[] = [];
  for (const n of fichiers) {
    const lignes = sitesReseau(readFileSync(join(dossier, n), "utf8"));
    if (lignes.length > 0 && !(n in AUTORISES)) fautifs.push(`${n}:${lignes.join(",")}`);
  }
  assert.deepEqual(fautifs, [],
    `site(s) réseau hors du téléchargeur : ${fautifs.join(" ")}.\n`
    + "  → « nothing of yours goes up » deviendrait une phrase, plus un fait. Un nouveau site\n"
    + "    d'envoi s'ajoute à AUTORISES avec sa raison, ou ne s'ajoute pas.");
});

test("le téléchargeur, quand il existe, obéit à CASCADE_OFFLINE", () => {
  const chemin = join(dossier, "listes.ts");
  if (!existsSync(chemin)) return;   /* pas encore écrit : rien à exiger, rien à feindre */
  const src = readFileSync(chemin, "utf8");
  assert.match(src, /CASCADE_OFFLINE/,
    "listes.ts touche le réseau sans lire CASCADE_OFFLINE : la mesure hors ligne ne peut pas le retenir.");
});
