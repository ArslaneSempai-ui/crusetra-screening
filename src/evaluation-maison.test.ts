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
 *
 * UNE HORLOGE PAR OUTIL (6 octobre 2026). Le module désignait un marqueur par défaut, celui
 * de Screening, et Monitoring l'appelait sans nommer le sien : l'évaluation de l'un
 * consommait les trente jours de l'autre. Les cas de la fin prouvent que chaque outil lit ses
 * deux marqueurs (nouvelle maison, puis ancienne ; la date la plus ancienne gagne) et jamais
 * ceux d'un autre. Le témoin qui lance les VRAIES commandes vit dans chaque dépôt :
 * horloge-par-outil.test.ts.
 *
 * LE CHOIX POUR L'ÉVALUATEUR DONT SEUL LE MARQUEUR DE SCREENING PORTE UNE DATE. Ce fichier ne
 * nomme aucun outil ; sa date est le premier lancement de Screening OU de Monitoring, et rien
 * ne permet de savoir lequel. Monitoring, Scoring et Dossier ne le relisent donc PAS : leur
 * horloge part de leur prochain lancement. Le reprendre aurait voulu une exception permanente
 * (relire le marqueur d'un autre outil, avec une date butoir pour ne pas recréer le défaut
 * chez chaque nouvel évaluateur) au profit d'une population vide : au 6 octobre 2026, aucun
 * client payant n'existe, et Scoring et Dossier n'affichaient aucune horloge. La règle du
 * renommage reste entière pour le marqueur PROPRE de chaque outil : jamais remis à zéro,
 * jamais prolongé. Et le compteur reste un rappel : la licence compte depuis le vrai premier
 * usage, quoi que ce fichier affiche.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as module from "./evaluation.ts";
import { OUTILS, lignesEvaluation, lignesEvaluationDe, marquer, marqueursDe, type Outil } from "./evaluation.ts";

/** Les deux maisons d'un poste fabriqué : la nouvelle et l'ancienne, vides au départ. */
function poste(outil: Outil = "screening"): { nouveau: string; ancien: string } {
  const { fichier, ancien } = marqueursDe(outil, mkdtempSync(join(tmpdir(), "eval-maison-")));
  return { nouveau: fichier, ancien };
}

function poser(fichier: string, iso: string): void {
  mkdirSync(join(fichier, ".."), { recursive: true });
  writeFileSync(fichier, JSON.stringify({ premiereUtilisation: iso }, null, 2) + "\n");
}

const lue = (fichier: string): string =>
  (JSON.parse(readFileSync(fichier, "utf8")) as { premiereUtilisation: string }).premiereUtilisation;

const AUJOURDHUI = new Date("2026-10-06T09:00:00Z");

test("chaque outil a ses deux marqueurs à son nom, et Screening garde le nom où ses clients ont écrit", () => {
  const vus = new Set<string>();
  for (const outil of OUTILS) {
    const { fichier, ancien } = marqueursDe(outil);
    assert.match(fichier.replaceAll("\\", "/"), new RegExp(`/\\.crusetra/premiere-utilisation-${outil}\\.json$`));
    assert.match(ancien.replaceAll("\\", "/"), new RegExp(`/\\.cascade/premiere-utilisation-${outil}\\.json$`));
    vus.add(fichier).add(ancien);
  }
  assert.equal(vus.size, 2 * OUTILS.length, "deux outils qui partagent un fichier partagent leurs trente jours");
  assert.match(marqueursDe("screening").ancien.replaceAll("\\", "/"), /\/\.cascade\/premiere-utilisation-screening\.json$/,
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

/* ─── une horloge par outil (6 octobre 2026) ─── */

const maisonFabriquee = (): string => mkdtempSync(join(tmpdir(), "eval-outils-"));

test("aucun chemin par défaut vers lequel retomber : le fichier se nomme, ou rien ne compte", () => {
  assert.equal("FICHIER_DEFAUT" in module, false,
    "un marqueur par défaut est celui d'UN outil, prêté sans bruit aux trois autres");
  assert.equal("FICHIER_ANCIEN" in module, false);
  assert.equal(marquer.length, 1, "marquer() sans fichier retomberait de nouveau sur un défaut");
  assert.equal(lignesEvaluation.length, 1, "lignesEvaluation() sans fichier retomberait de nouveau sur un défaut");
  assert.throws(() => marqueursDe("routing" as Outil), /no evaluation clock is defined for "routing"/,
    "Routing tient son propre compteur ; un nom inconnu ne doit pas fabriquer un marqueur");
});

/* Une propriété, un test : le compte de ce dépôt se lit dans les sources (readme.ts), et un
   test écrit dans une boucle compterait une fois pour quatre exécutions. Les quatre outils
   sont donc parcourus DANS le test, et chaque message nomme l'outil qui a failli. */
test("chaque outil : les marqueurs des trois autres outils ne touchent pas son horloge", () => {
  for (const outil of OUTILS) {
    const maison = maisonFabriquee();
    const autres: string[] = OUTILS.filter((o) => o !== outil).flatMap((o) => Object.values(marqueursDe(o, maison)));
    for (const f of autres) poser(f, "2026-01-01T09:00:00.000Z");
    const avant: Buffer[] = autres.map((f) => readFileSync(f));
    const tout = lignesEvaluationDe(outil, AUJOURDHUI, maison).join(" ");
    assert.match(tout, /day 1 of 30 since first use \(2026-10-06\)/,
      `${outil} : son horloge a pris la date d'un autre outil (le choix pour le marqueur de Screening est écrit en tête)`);
    assert.equal(lue(marqueursDe(outil, maison).fichier), AUJOURDHUI.toISOString(), outil);
    assert.deepEqual(autres.map((f) => readFileSync(f)), avant, `${outil} : le marqueur d'un autre outil a été réécrit`);
    assert.deepEqual(readdirSync(join(maison, ".crusetra")).sort(),
      OUTILS.map((o) => `premiere-utilisation-${o}.json`).sort(),
      `${outil} : un seul fichier neuf, le marqueur de cet outil`);
    assert.equal(existsSync(marqueursDe(outil, maison).ancien), false, `${outil} : l'ancienne maison n'est jamais écrite`);
  }
});

test("chaque outil : sa nouvelle maison, puis son ancienne, et la date la plus ancienne gagne", () => {
  for (const outil of OUTILS) {
    const seulAncien = maisonFabriquee();
    const a = marqueursDe(outil, seulAncien);
    poser(a.ancien, "2026-09-01T09:00:00.000Z");
    const octets = readFileSync(a.ancien);
    assert.match(lignesEvaluationDe(outil, AUJOURDHUI, seulAncien).join(" "), /day 36 since first use \(2026-09-01\)/,
      `${outil} : un renommage qui remet le compteur à zéro offre trente jours à qui n'en a plus`);
    assert.equal(lue(a.fichier), "2026-09-01T09:00:00.000Z", `${outil} : la date passe dans la nouvelle maison`);
    assert.deepEqual(readFileSync(a.ancien), octets, `${outil} : l'ancien marqueur est lu, jamais réécrit`);

    const ancienPlusTot = maisonFabriquee();
    const b = marqueursDe(outil, ancienPlusTot);
    poser(b.ancien, "2026-08-01T00:00:00.000Z");
    poser(b.fichier, "2026-09-20T00:00:00.000Z");
    assert.match(lignesEvaluationDe(outil, AUJOURDHUI, ancienPlusTot).join(" "), /since first use \(2026-08-01\)/,
      `${outil} : la date récente de la nouvelle maison prolongerait l'évaluation`);
    assert.equal(lue(b.fichier), "2026-08-01T00:00:00.000Z", outil);

    const nouveauPlusTot = maisonFabriquee();
    const c = marqueursDe(outil, nouveauPlusTot);
    poser(c.ancien, "2026-09-20T00:00:00.000Z");
    poser(c.fichier, "2026-08-01T00:00:00.000Z");
    const avant = readFileSync(c.fichier);
    assert.match(lignesEvaluationDe(outil, AUJOURDHUI, nouveauPlusTot).join(" "), /since first use \(2026-08-01\)/,
      `${outil} : l'ancienne maison ne rajeunit pas une date déjà connue`);
    assert.deepEqual(readFileSync(c.fichier), avant, `${outil} : rien à reporter, rien n'est réécrit`);

    const seulNouveau = maisonFabriquee();
    const d = marqueursDe(outil, seulNouveau);
    poser(d.fichier, "2026-09-25T00:00:00.000Z");
    assert.match(lignesEvaluationDe(outil, AUJOURDHUI, seulNouveau).join(" "), /day 12 of 30 since first use \(2026-09-25\)/, outil);
    assert.equal(existsSync(d.ancien), false, `${outil} : l'ancienne maison n'est jamais créée`);
  }
});
