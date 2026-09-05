/**
 * LA MESURE PUBLIQUE, ÉPROUVÉE — le jeu, l'arithmétique, le scellé, le droit d'écraser.
 *
 * L'arithmétique n'est PAS vérifiée sur les vrais matchers : leurs scores changeraient avec
 * eux et le témoin suivrait au lieu de juger. Elle est vérifiée sur un matcher SCRIPTÉ dont
 * les scores sont écrits ici — rappel et faux positifs se recomptent à la main sur cinq
 * paires. Le reste — scellé, provenance, palier absent — s'éprouve sur le VRAI relevé.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validerPaires, mesurerPaires, mesurePublique, rapportMd, exigerDroitDEcraser,
  ASSEZ_PAR_VERDICT, SEUILS_MONTRES, type JeuDePaires, type PaireEtiquetee } from "./measure.ts";
import { SEUILS, type Matcher, type PalierId, type Registre } from "./matcher.ts";
import { empreinteDuReleve, scelleIntact } from "./empreinte.ts";

const CMD = realpathSync(fileURLToPath(new URL("./measure.ts", import.meta.url)));
const RACINE = fileURLToPath(new URL("..", import.meta.url));

const JEU = JSON.parse(readFileSync(fileURLToPath(new URL("./paires-etiquetees.json", import.meta.url)), "utf8")) as JeuDePaires;

function paireDe(sur: Partial<PaireEtiquetee>[]): JeuDePaires {
  const base = (i: number, v: "match" | "different"): PaireEtiquetee =>
    ({ a: `a${i}`, b: `b${i}`, verdict: v, nature: "typo" });
  const paires = [
    ...Array.from({ length: ASSEZ_PAR_VERDICT }, (_, i) => base(i, "match")),
    ...Array.from({ length: ASSEZ_PAR_VERDICT }, (_, i) => base(100 + i, "different")),
  ];
  sur.forEach((x, i) => Object.assign(paires[i]!, x));
  return { quoi: "essai", provenance: "authored", avertissement: "", paires };
}

test("le jeu livré est valide : comptes, vocabulaire, natures, aucun doublon dans les deux sens", () => {
  const paires = validerPaires(JEU);
  const nMatch = paires.filter((x) => x.verdict === "match").length;
  assert.ok(nMatch >= ASSEZ_PAR_VERDICT && paires.length - nMatch >= ASSEZ_PAR_VERDICT,
    `${nMatch} match / ${paires.length - nMatch} different : le jeu ne borne rien sous ${ASSEZ_PAR_VERDICT} de chaque`);
  /* Les négatifs DURS existent : un jeu de négatifs faciles rendrait tous les paliers
     brillants, et la mesure publique vendrait un mensonge poli. */
  for (const nature of ["near-string", "sibling", "same-given-name"]) {
    assert.ok(paires.some((x) => x.verdict === "different" && x.nature === nature),
      `aucun négatif « ${nature} » : la moitié dure du jeu a disparu`);
  }
  for (const nature of ["transliteration", "token-order", "initials", "typo"]) {
    assert.ok(paires.some((x) => x.verdict === "match" && x.nature === nature),
      `aucune paire « ${nature} » côté match`);
  }
});

test("un jeu fautif est refusé en nommant la faute — et le jeu propre passe", () => {
  assert.throws(() => validerPaires(paireDe([{ verdict: "maybe" as "match" }])),
    /"maybe"/, "le verdict hors vocabulaire est cité");
  assert.throws(() => validerPaires(paireDe([{ a: "X", b: "Y" }, { a: "Y", b: "X" }])),
    /duplicated pair/, "le doublon inversé est un doublon : la même question pèserait deux fois");
  assert.throws(() => validerPaires(paireDe([{ nature: " " }])), /empty name or an empty nature/);
  const tronque = paireDe([]);
  tronque.paires = tronque.paires.slice(0, ASSEZ_PAR_VERDICT + 5);
  assert.throws(() => validerPaires(tronque), new RegExp(`at least ${ASSEZ_PAR_VERDICT} of EACH`));
  /* CONTRE-ÉPREUVE : un validateur qui refuserait tout passerait les quatre cas ci-dessus. */
  assert.equal(validerPaires(paireDe([])).length, ASSEZ_PAR_VERDICT * 2);
});

test("l'arithmétique, recomptée à la main sur un matcher scripté", () => {
  /* Cinq paires, cinq scores écrits ici : à 0,60 le rappel est 2/3 (0,55 tombe) et les faux
     positifs 1/2 (0,70 passe) ; à 0,90 : 1/3 et 0/2. Si la mesure rend autre chose, c'est
     ELLE qui a tort — aucun matcher réel ne peut brouiller ce témoin. */
  const scores = new Map([["a1 b1", 1.0], ["a2 b2", 0.8], ["a3 b3", 0.55], ["a4 b4", 0.7], ["a5 b5", 0.3]]);
  const scripte: Matcher = {
    id: "exact", description: "scripté pour le témoin", rang: 1,
    score: (a, b) => scores.get(`${a} ${b}`)!,
  };
  const r: Registre = new Map<PalierId, Matcher>([["exact", scripte]]);
  const paires: PaireEtiquetee[] = [
    { a: "a1", b: "b1", verdict: "match", nature: "t" },
    { a: "a2", b: "b2", verdict: "match", nature: "t" },
    { a: "a3", b: "b3", verdict: "match", nature: "t" },
    { a: "a4", b: "b4", verdict: "different", nature: "t" },
    { a: "a5", b: "b5", verdict: "different", nature: "t" },
  ];
  const t = mesurerPaires(r, paires)["exact"]!;
  assert.deepEqual([t["0.60"]!.rappel.succes, t["0.60"]!.rappel.n], [2, 3]);
  assert.deepEqual([t["0.60"]!.fauxPositifs.succes, t["0.60"]!.fauxPositifs.n], [1, 2]);
  assert.deepEqual([t["0.90"]!.rappel.succes, t["0.90"]!.fauxPositifs.succes], [1, 0]);
  /* Le seuil est INCLUSIF : un score égal au seuil passe — 0,55 à 0,55. Fixé ici pour que
     la frontière du lot R3 et cette mesure lisent la grille du même côté. */
  assert.equal(t["0.55"]!.rappel.succes, 3);
  /* Et la grille est ENTIÈRE : 51 seuils, pas seulement ceux que le md montre. */
  assert.equal(Object.keys(t).length, SEUILS.length);
});

test("le relevé réel : scellé qui se vérifie, cellules complètes, grille entière", async () => {
  const m = await mesurePublique("2026-09-05", "0000000");
  m.empreinte = empreinteDuReleve(m);
  assert.ok(scelleIntact(m as unknown as Record<string, unknown>));
  /* Un octet bougé, le scellé ment — sinon il ne scelle rien. */
  const abime = JSON.parse(JSON.stringify(m)) as typeof m;
  abime.authored.nMatch += 1;
  assert.equal(scelleIntact(abime as unknown as Record<string, unknown>), false);
  /* Chaque cellule porte son n et ses bornes dans [0, 1] : un taux nu n'entre pas ici. */
  let cellules = 0;
  for (const table of Object.values(m.authored.tables)) {
    for (const c of Object.values(table)) {
      for (const x of [c.rappel, c.fauxPositifs]) {
        cellules++;
        assert.ok(x.n > 0 && x.bas >= 0 && x.haut <= 1 && x.bas <= x.taux && x.taux <= x.haut);
      }
    }
  }
  assert.equal(cellules, Object.keys(m.authored.tables).length * SEUILS.length * 2,
    "des cellules manquent : la grille n'est pas entière");
});

test("deux mesures, même relevé : rien d'aléatoire n'est entré", async () => {
  const a = await mesurePublique("2026-09-05", "0000000");
  const b = await mesurePublique("2026-09-05", "0000000");
  assert.equal(empreinteDuReleve(a), empreinteDuReleve(b),
    "deux exécutions divergent : quelque chose tire au sort, et le relevé publié n'est plus reproductible");
});

test("le palier absent est NOMMÉ — dans le relevé et dans la page — au lieu de planter", async () => {
  const m = await mesurePublique("2026-09-05", "0000000");
  assert.deepEqual(m.paliers.absents, ["embed"],
    "les absents du relevé doivent être exactement ceux que le registre ne porte pas");
  const md = rapportMd(m);
  assert.match(md, /Not in tonight's registry: `embed`/,
    "la page ne dit pas l'absent : un lecteur croirait la colonne complète");
  /* La moitié synthétique a DEUX états légitimes, et la page doit dire lequel : absente
     (synthetic.ts pas dans l'arbre) → le constat écrit, jamais une section muette ;
     présente → la section déclarée avec ses comptes. Écrit pour l'état absent le soir du
     5 septembre ; l'intégration a apporté synthetic.ts et ce cas a rougi sur un état
     désormais vrai. */
  if ("absent" in m.synthetic) {
    assert.match(md, /NOT measured/,
      "la moitié synthétique absente doit être un constat écrit, pas une section muette");
  } else {
    assert.match(md, /## Synthetic variants \(declared\)/,
      "la moitié synthétique mesurée doit avoir sa section, déclarée comme telle");
    assert.match(md, new RegExp(`${m.synthetic.nMatch} match, ${m.synthetic.nDifferent} different`),
      "la section synthétique doit porter ses comptes, pas seulement des tables");
  }
  /* Les colonnes montrées existent toutes dans la grille : une colonne annoncée qui
     manquerait rendrait `undefined` en cellule. */
  for (const s of SEUILS_MONTRES) assert.ok(SEUILS.includes(s), `${s} montré mais hors grille`);
});

test("le relevé publié dans le dépôt est celui que la commande scelle, et il est intact", () => {
  const publie = JSON.parse(readFileSync(join(RACINE, "releve-public.json"), "utf8")) as Record<string, unknown>;
  assert.ok(scelleIntact(publie),
    "releve-public.json ne correspond plus à son scellé : il a été édité sans être remesurés");
  /* Le md publié vient du même relevé : même compte de paires en tête. */
  const md = readFileSync(join(RACINE, "RELEVE-PUBLIC.md"), "utf8");
  const a = publie["authored"] as { nMatch: number; nDifferent: number };
  assert.match(md, new RegExp(`${a.nMatch} match, ${a.nDifferent} different`));
});

test("un relevé scellé refuse l'écrasement muet ; abîmé ou absent, il se réécrit", () => {
  const d = mkdtempSync(join(tmpdir(), "screening-mesure-"));
  const chemin = join(d, "releve-public.json");
  /* Absent : rien à protéger. */
  assert.doesNotThrow(() => exigerDroitDEcraser(chemin, []));
  /* Scellé intact : refus sans le drapeau, passage avec. */
  const m = { version: 1, x: 42 } as Record<string, unknown>;
  m.empreinte = empreinteDuReleve(m);
  writeFileSync(chemin, JSON.stringify(m));
  assert.throws(() => exigerDroitDEcraser(chemin, []), /--yes-overwrite/);
  assert.doesNotThrow(() => exigerDroitDEcraser(chemin, ["--yes-overwrite"]));
  /* Abîmé : plus fiable, donc plus protégé — le refus ne doit pas garder un relevé faux. */
  writeFileSync(chemin, JSON.stringify({ ...m, x: 43 }));
  assert.doesNotThrow(() => exigerDroitDEcraser(chemin, []));
});

test("la COMMANDE refuse au point d'appel : relevé publié présent, sortie 1, message sans pile", () => {
  /* Le témoin passe par la commande réelle — le relevé du dépôt est scellé, donc elle doit
     refuser SANS RIEN ÉCRIRE. On lit l'horodatage avant et après plutôt que de croire. */
  const avant = readFileSync(join(RACINE, "releve-public.json"), "utf8");
  const r = spawnSync(process.execPath, [CMD], { encoding: "utf8", timeout: 120_000 });
  assert.equal(r.status, 1, `la commande devait refuser (statut ${r.status}) :\n${r.stdout}${r.stderr}`);
  assert.match(r.stderr, /--yes-overwrite/, "le refus nomme le geste qui délie");
  assert.doesNotMatch(r.stderr, /at .*measure\.ts/, "une pile se lit comme un plantage, pas un refus");
  assert.equal(readFileSync(join(RACINE, "releve-public.json"), "utf8"), avant,
    "le refus a quand même écrit : le relevé publié a bougé sur une commande relancée par accident");
});
