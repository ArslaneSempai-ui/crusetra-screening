/* AJOUTÉ tel quel dans les quatre dépôts de la famille (cascade-screening, -monitoring,
   -scoring, -dossier) — le fichier est le MÊME dans les quatre : le corriger dans l'un
   impose de le recopier dans les trois autres, comme la couche qu'il garde. */
/*
 * LE GARDIEN DE LA COUCHE IDENTITE, pour un dépôt EXCLU de la diffusion.
 *
 * Le trou, mesuré le 12/09/2026 : ce dépôt porte cli.ts, figures.ts et interval.ts avec
 * l'en-tête « PARTAGÉ — la source est ~/Documents/identite », il est EXCLU de la diffusion
 * (depots.json d'identite, comme toute la famille cascade), et AUCUN test ne comparait sa
 * copie à la source. Une dérive y restait invisible : npm test vert sur une couche que
 * personne ne regardait — le périmètre du gardien, la faute déjà payée le 21/08 (« le titre
 * promettait la couche, le corps regardait deux fichiers »).
 *
 * La forme suit registre.test.ts des dépôts du portfolio :
 *   - la liste des fichiers gardés se DÉDUIT du disque (tout fichier de code de src/
 *     présent aussi à la racine d'identite, tests exclus), jamais codée en dur ;
 *   - le contenu se compare EXACT (readFileSync ===), aucune normalisation ;
 *   - la source se trouve par IDENTITE= ou ../../identite, et un clone seul obtient un
 *     SKIP NOMMÉ — un saut muet serait un mensonge poli ;
 *   - le diagnostic distingue par les dates de modification : « source en avance »
 *     (recopier À LA MAIN depuis identite : ce dépôt est exclu de la diffusion, elle ne
 *     viendra pas le faire) et « dérive locale » (corriger DANS identite, puis recopier —
 *     une correction locale ne voyagera pas).
 *
 * Le détecteur porte son témoin, joué sur des dossiers fabriqués : s'il ne voyait plus une
 * copie divergente dans les deux directions, son zéro ne prouverait rien.
 *
 * NOTE de périmètre : la couche de FAMILLE (empreinte.ts, sceller.ts, verifier-rapport.mjs,
 * partagés entre les cinq dépôts cascade sans passer par identite) n'est pas gardée ici —
 * elle n'a pas de source déclarée unique ; c'est un territoire à part, dit au chef le 12/09.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync, statSync, utimesSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { tmpdir } from "node:os";

const racine = fileURLToPath(new URL("..", import.meta.url));

/** Un fichier de code, jamais un test : la couche, pas les harnais. */
const codePartage = (nom: string) =>
  /\.(ts|mjs|js|css)$/.test(nom) && !/\.test\.(ts|mjs)$/.test(nom) && !nom.endsWith(".d.ts");

/** Les retards entre une source (racine d'identite) et une copie (src/ d'ici), avec leur
 *  cause lue sur les dates : la SOURCE plus récente a avancé ; la COPIE plus récente a
 *  dérivé localement. */
export function retards(sourceDir: string, copieDir: string): { compares: number; fautes: string[] } {
  let compares = 0;
  const fautes: string[] = [];
  for (const nom of readdirSync(copieDir).filter(codePartage)) {
    const la = join(sourceDir, nom);
    if (!existsSync(la)) continue;
    const ici = join(copieDir, nom);
    compares++;
    if (readFileSync(ici, "utf8") === readFileSync(la, "utf8")) continue;
    const cause = statSync(la).mtimeMs > statSync(ici).mtimeMs
      ? "source en avance : recopier À LA MAIN depuis identite — ce dépôt est EXCLU de la "
        + "diffusion (depots.json), elle ne viendra pas le faire"
      : "dérive locale : corriger DANS identite puis recopier — une correction faite ici "
        + "ne voyagera pas";
    fautes.push(`${nom} (${cause})`);
  }
  return { compares, fautes };
}

test("le détecteur voit une copie divergente, dans les deux directions : témoin", () => {
  const d = mkdtempSync(join(tmpdir(), "couche-temoin-"));
  try {
    const source = join(d, "source"), copie = join(d, "copie");
    for (const dir of [source, copie]) {
      mkdirSync(dir);
      writeFileSync(join(dir, "interval.ts"), "export const wilson = 1;\n");
    }
    assert.deepEqual(retards(source, copie).fautes, [], "identiques : aucun retard attendu");
    assert.equal(retards(source, copie).compares, 1, "le témoin doit avoir comparé");

    writeFileSync(join(source, "interval.ts"), "export const wilson = 2;\n");
    utimesSync(join(copie, "interval.ts"), new Date(0), new Date(0));
    const avance = retards(source, copie).fautes;
    assert.equal(avance.length, 1);
    assert.match(avance[0]!, /source en avance/, "la source plus récente doit se nommer");

    writeFileSync(join(copie, "interval.ts"), "export const wilson = 3;\n");
    utimesSync(join(source, "interval.ts"), new Date(0), new Date(0));
    const derive = retards(source, copie).fautes;
    assert.equal(derive.length, 1);
    assert.match(derive[0]!, /dérive locale/, "la copie plus récente doit se nommer");
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test("les couches partagées sont bien celles d'identite (dépôt exclu : recopie à la main)", (t) => {
  const source = [
    process.env["IDENTITE"],
    fileURLToPath(new URL("../../identite/", import.meta.url)),
  ].filter((x): x is string => typeof x === "string" && x.length > 0)
    .map((x) => (x.endsWith("/") ? x : x + "/"))
    .find((x) => existsSync(x + "interval.ts"));
  if (!source) {
    return t.skip("dépôt cloné seul : identite n'est pas là, aucune couche n'a été comparée.\n"
      + "  Pour le faire tourner ici : IDENTITE=<chemin vers identite> npm test");
  }
  const r = retards(source, racine + "src/");
  assert.ok(r.compares >= 3,
    `${r.compares} fichier(s) comparé(s) : la couche en porte au moins trois (cli, figures, `
    + "interval) — un balayage qui en lit moins ne regarde pas");
  assert.deepEqual(r.fautes, [],
    "des copies de la couche identite ont divergé ; la cause et le geste sont dans chaque ligne");
});
