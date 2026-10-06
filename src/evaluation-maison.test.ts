/**
 * LE COMPTEUR CHANGE DE MAISON, PAS DE DATE (Crusetra, 5 octobre 2026).
 *
 * Le marqueur de premier usage vivait dans ~/.cascade ; il vit désormais dans ~/.crusetra.
 * Un client qui évaluait déjà ne doit rien voir bouger : ni un compteur remis à zéro (trente
 * jours offerts par un renommage), ni un compteur prolongé (une date plus récente qui
 * effacerait la vraie). Chaque cas ci-dessous est une de ces deux façons de mentir, jouée sur
 * des dossiers temporaires : le vrai ~/.cascade du poste n'est jamais lu ici.
 *
 * Ces cas vivent dans screening seul, la source de `evaluation.ts` : `evaluation.test.ts`
 * appartient à la famille de cascade, et le compteur qu'il éprouve là-bas n'est pas celui-ci.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FICHIER_ANCIEN, FICHIER_DEFAUT, lignesEvaluation, marquer } from "./evaluation.ts";

/** Les deux maisons d'un poste fabriqué : la nouvelle et l'ancienne, vides au départ. */
function poste(): { nouveau: string; ancien: string } {
  const d = mkdtempSync(join(tmpdir(), "eval-maison-"));
  return {
    nouveau: join(d, ".crusetra", "premiere-utilisation-screening.json"),
    ancien: join(d, ".cascade", "premiere-utilisation-screening.json"),
  };
}

function poser(fichier: string, iso: string): void {
  mkdirSync(join(fichier, ".."), { recursive: true });
  writeFileSync(fichier, JSON.stringify({ premiereUtilisation: iso }, null, 2) + "\n");
}

const lue = (fichier: string): string =>
  (JSON.parse(readFileSync(fichier, "utf8")) as { premiereUtilisation: string }).premiereUtilisation;

const AUJOURDHUI = new Date("2026-10-06T09:00:00Z");

test("le chemin par défaut est la nouvelle maison, et l'ancienne garde son nom", () => {
  assert.match(FICHIER_DEFAUT.replaceAll("\\", "/"), /\/\.crusetra\/premiere-utilisation-screening\.json$/);
  assert.match(FICHIER_ANCIEN.replaceAll("\\", "/"), /\/\.cascade\/premiere-utilisation-screening\.json$/,
    "lire un autre nom que celui où les clients ont écrit, c'est remettre leur compteur à zéro");
});

test("seule l'ancienne maison existe : sa date est gardée, reportée dans la nouvelle, et l'ancienne n'est pas touchée", () => {
  const p = poste();
  poser(p.ancien, "2026-09-10T08:00:00.000Z");
  const avant = readFileSync(p.ancien);
  const u = marquer(p.nouveau, AUJOURDHUI, p.ancien);
  assert.equal(u.premiere, "2026-09-10T08:00:00.000Z",
    "un renommage qui remet le compteur à zéro offre trente jours à qui n'en a plus");
  assert.equal(u.neuf, false);
  assert.equal(u.avarie, false);
  assert.equal(lue(p.nouveau), "2026-09-10T08:00:00.000Z", "la date passe dans la nouvelle maison");
  assert.deepEqual(readFileSync(p.ancien), avant, "l'ancien marqueur est lu, jamais réécrit");
});

test("les deux maisons existent : la date la plus ancienne l'emporte, dans un sens comme dans l'autre", () => {
  const a = poste();
  poser(a.ancien, "2026-08-01T00:00:00.000Z");
  poser(a.nouveau, "2026-09-20T00:00:00.000Z");
  assert.equal(marquer(a.nouveau, AUJOURDHUI, a.ancien).premiere, "2026-08-01T00:00:00.000Z",
    "la date récente de la nouvelle maison prolongerait l'évaluation");
  assert.equal(lue(a.nouveau), "2026-08-01T00:00:00.000Z", "et la nouvelle maison retient la vraie date");

  const b = poste();
  poser(b.ancien, "2026-09-20T00:00:00.000Z");
  poser(b.nouveau, "2026-08-01T00:00:00.000Z");
  const avant = readFileSync(b.nouveau);
  const u = marquer(b.nouveau, AUJOURDHUI, b.ancien);
  assert.equal(u.premiere, "2026-08-01T00:00:00.000Z", "l'ancienne maison ne rajeunit pas une date déjà connue");
  assert.equal(u.neuf, false);
  assert.deepEqual(readFileSync(b.nouveau), avant, "rien à reporter : rien n'est réécrit");
});

test("seule la nouvelle maison existe : elle fait foi, et l'ancienne n'est jamais créée", () => {
  const p = poste();
  poser(p.nouveau, "2026-09-25T00:00:00.000Z");
  assert.equal(marquer(p.nouveau, AUJOURDHUI, p.ancien).premiere, "2026-09-25T00:00:00.000Z");
  assert.equal(existsSync(p.ancien), false);

  const vierge = poste();
  const u = marquer(vierge.nouveau, AUJOURDHUI, vierge.ancien);
  assert.equal(u.neuf, true, "aucune maison : le premier usage, c'est aujourd'hui");
  assert.equal(lue(vierge.nouveau), AUJOURDHUI.toISOString());
  assert.equal(existsSync(vierge.ancien), false, "le nouveau marqueur s'écrit dans la nouvelle maison seulement");
});

test("une nouvelle maison illisible ne remet pas à zéro un compteur que l'ancienne connaît", () => {
  const p = poste();
  poser(p.ancien, "2026-09-01T00:00:00.000Z");
  mkdirSync(join(p.nouveau, ".."), { recursive: true });
  writeFileSync(p.nouveau, "{pas du json");
  const u = marquer(p.nouveau, AUJOURDHUI, p.ancien);
  assert.equal(u.premiere, "2026-09-01T00:00:00.000Z");
  assert.equal(u.avarie, false, "dire « the clock restarts today » serait faux : la date est connue");
  assert.equal(lue(p.nouveau), "2026-09-01T00:00:00.000Z");
});

test("le client au jour 36 avant le renommage est au jour 36 après, et la porte suivante est sur crusetra.com", () => {
  const p = poste();
  poser(p.ancien, "2026-09-01T09:00:00.000Z");
  const tout = lignesEvaluation(p.nouveau, AUJOURDHUI, p.ancien).join(" ");
  assert.match(tout, /day 36 since first use \(2026-09-01\)/);
  assert.match(tout, /thirty days have passed/);
  assert.match(tout, /https:\/\/crusetra\.com\/engagement\.html/);
});
