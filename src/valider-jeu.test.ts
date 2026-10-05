/**
 * VALIDER UN JEU AVEUGLE : les comptes et les refus, sur des jeux minuscules écrits ici. Aucune
 * mesure, aucun vrai jeu : ce que le script garantit tient dans ses fonctions, et le test les
 * prend une à une. Le témoin final : un refus ne cite jamais un nom.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  analyserJeu, cleDePaire, copier, dossierJeuxAveugles, lireAttendu, nettoyerCadratins, normaliserNom, numeroDuJeu, refusDeStructure,
  PHRASE_CADRATINS, type JeuBrut, type Nom, type PaireBrute,
} from "./valider-jeu.ts";

const jeu = (paires: PaireBrute[], reste: Partial<JeuBrut> = {}): JeuBrut => ({
  quoi: "company and vessel name pairs", provenance: "blind test set #99, authored by a separate agent that never saw the matcher",
  avertissement: "judge once, aggregates only", paires, ...reste,
});
const texte = (j: unknown): string => JSON.stringify(j, null, 2) + "\n";

/** Un jeu aux comptes attendus : 200 vraies paires, 200 pièges, tous les noms distincts, inventés. */
function jeuComplet(): JeuBrut {
  const paires: PaireBrute[] = [];
  for (let i = 0; i < 200; i++) {
    paires.push({ a: `Alpha Trading ${i} Ltd`, b: `Alpha Trading ${i} Limited`, verdict: "match", nature: "legal-form" });
    paires.push({ a: `Beta Shipping ${i} SA`, b: `Gamma Shipping ${i} SA`, verdict: "different", nature: "different-word" });
  }
  return jeu(paires);
}
/** Le même, une paire remplacée. */
const avec = (p: PaireBrute, reste: Partial<JeuBrut> = {}): JeuBrut => { const j = jeuComplet(); j.paires[0] = p; return { ...j, ...reste }; };

test("valider-jeu : la normalisation efface diacritiques, casse et ponctuation ; la clé ignore l'ordre", () => {
  assert.equal(normaliserNom("Société Générale, S.A."), "societegeneralesa");
  assert.equal(normaliserNom("  ETS   KONÉ & FRÈRES  "), "etskonefreres");
  assert.equal(normaliserNom("Hong-Da 1"), normaliserNom("Hong Da 1"));
  assert.notEqual(normaliserNom("Hong Da 1"), normaliserNom("Hong Da 18"));
  assert.equal(cleDePaire({ a: "Hong Da 8", b: "hong-da 1" }), cleDePaire({ a: "Hong Da 1", b: "HONG DA 8" }));
});

test("valider-jeu : un jeu aux comptes attendus passe, et la ligne porte ses neuf champs", () => {
  const brut = texte(jeuComplet());
  const { compte, refus } = analyserJeu(brut, []);
  assert.deepEqual(refus, []);
  assert.ok(compte);
  assert.deepEqual(Object.keys(compte), ["paires", "match", "different", "memePaire", "memeNom", "identiquesCasse", "quasiDoublons", "cadratins", "sha256"]);
  assert.deepEqual([compte.paires, compte.match, compte.different, compte.memePaire, compte.memeNom, compte.identiquesCasse, compte.quasiDoublons, compte.cadratins],
    [400, 200, 200, 0, 0, 0, 0, 0]);
  assert.equal(compte.sha256, createHash("sha256").update(brut).digest("hex"));
});

test("valider-jeu : le recouvrement avec l'apprentissage se voit à travers un accent, une majuscule et une virgule", () => {
  const apprentissage: Nom[][] = [[{ a: "Société Générale S.A.", b: "Societe Generale" }], [{ a: "Ets Koné", b: "Etablissements Kone" }]];
  const memePaire = analyserJeu(texte(avec({ a: "SOCIETE GENERALE, SA", b: "societe generale", verdict: "match", nature: "x" })), apprentissage);
  assert.equal(memePaire.compte?.memePaire, 1);
  assert.equal(memePaire.compte?.memeNom, 2);
  /* une ou deux paires en recouvrement (un nom inventé deux fois, jeu 19) : un avertissement à écrire dans la ligne du Juge, pas un refus */
  assert.equal(memePaire.refus.length, 0, memePaire.refus.join(" · "));
  assert.ok(memePaire.attention.some((r) => /overlap with the 2 training sets: 1 pair\(s\), 2 name\(s\)/.test(r)), memePaire.attention.join(" · "));
  const unNom = analyserJeu(texte(avec({ a: "Ets Kone", b: "Ets Kone Abidjan", verdict: "match", nature: "x" })), apprentissage);
  assert.equal(unNom.compte?.memePaire, 0);
  assert.equal(unNom.compte?.memeNom, 1);
  assert.equal(unNom.refus.length, 0);
  assert.equal(unNom.attention.length, 1);
  /* au-delà de deux paires, c'est une fuite : refus */
  const f = jeuComplet();
  f.paires[0] = { a: "Société Générale S.A.", b: "Societe Generale", verdict: "match", nature: "x" };
  f.paires[1] = { a: "Ets Koné", b: "Etablissements Kone", verdict: "match", nature: "x" };
  f.paires[2] = { a: "SOCIETE GENERALE, SA", b: "societe generale", verdict: "different", nature: "x" };
  const fuite = analyserJeu(texte(f), apprentissage);
  assert.ok(fuite.refus.some((r) => /overlap with the 2 training sets: 3 pair\(s\)/.test(r)), fuite.refus.join(" · "));
});

test("valider-jeu : identiques à la casse près et quasi-doublons sont comptés et avertis, les cadratins refusés", () => {
  const j = jeuComplet();
  j.paires[0] = { a: "Delta Foods Ltd", b: "DELTA  foods ltd", verdict: "different", nature: "case" };
  j.paires[1] = { a: "Ets Koné Frères", b: "Ets Kone Freres SARL", verdict: "match", nature: "accent" };
  j.paires[2] = { a: "ETS KONE FRERES", b: "Ets Kone Freres, SARL", verdict: "match", nature: "accent" };
  j.paires[3] = { a: "Ferme\u2014Sud SA", b: "Ferme Sud SA", verdict: "match", nature: "dash" };
  const { compte, refus, attention } = analyserJeu(texte(j), []);
  assert.equal(compte?.identiquesCasse, 1);
  assert.equal(compte?.quasiDoublons, 2);
  assert.equal(compte?.cadratins, 1);
  assert.ok(!refus.some((r) => /identical but for case/.test(r)), "la casse avertit, ne refuse pas (jeux 15 et 17)");
  assert.ok(attention.some((r) => /1 pair\(s\) identical but for case/.test(r)), attention.join(" · "));
  assert.ok(refus.some((r) => /1 em dash\(es\) in the file \(1 inside names/.test(r)), refus.join(" · "));
  /* avec --copier, le cadratin d'un nom sera remplacé : il ne refuse plus ; celui d'une provenance, si */
  const copie = analyserJeu(texte(j), [], { copier: true });
  assert.ok(!copie.refus.some((r) => /em dash/.test(r)), copie.refus.join(" · "));
  const dansLaProvenance = analyserJeu(texte({ ...jeuComplet(), provenance: "blind test set #99 \u2014 authored blind" }), [], { copier: true });
  assert.ok(dansLaProvenance.refus.some((r) => /1 em dash\(es\) outside names/.test(r)), dansLaProvenance.refus.join(" · "));
});

test("valider-jeu : la structure refuse une clé de trop, une clé manquante, une paire incomplète, un verdict inconnu, un compte faux", () => {
  const base = jeuComplet();
  assert.equal(refusDeStructure(base), null);
  assert.match(refusDeStructure({ ...base, extra: 1 }) ?? "", /top-level keys are \[avertissement, extra, paires, provenance, quoi\]/);
  const { avertissement: _a, ...sans } = base;
  assert.match(refusDeStructure(sans) ?? "", /expected exactly/);
  assert.match(refusDeStructure(jeu([{ a: "x", b: "y", verdict: "match" } as PaireBrute])) ?? "", /pair #1 lacks nature/);
  assert.match(refusDeStructure([]) ?? "", /not a JSON object/);
  const inconnu = analyserJeu(texte(avec({ a: "Un", b: "Deux", verdict: "maybe", nature: "x" })), []);
  assert.ok(inconnu.refus.some((r) => /1 pair\(s\) carry a verdict outside match\/different/.test(r)));
  assert.ok(inconnu.refus.some((r) => /400 pairs, 199 match, 200 different: expected 400\/200\/200/.test(r)));
  const petit = analyserJeu(texte(jeu([{ a: "Un", b: "Deux", verdict: "match", nature: "x" }])), []);
  assert.deepEqual(petit.refus, ["1 pairs, 1 match, 0 different: expected 400/200/200"]);
  assert.match(analyserJeu("{ not json", []).refus[0]!, /not valid JSON/);
});

test("valider-jeu : --attendu accepte les comptes d'un jeu realiste, et rien d'autre ne les accepte", () => {
  const paires: PaireBrute[] = [];
  for (let i = 0; i < 4; i++) paires.push({ a: `Alpha ${i}`, b: `Alpha ${i} Ltd`, verdict: "match", nature: "x" });
  for (let i = 0; i < 2; i++) paires.push({ a: `Beta ${i}`, b: `Gamma ${i}`, verdict: "different", nature: "x" });
  const j = texte(jeu(paires, { provenance: "realistic set #20, authored blind" }));
  assert.deepEqual(analyserJeu(j, [], { attendu: { paires: 6, match: 4, different: 2 } }).refus, []);
  assert.deepEqual(analyserJeu(j, []).refus, ["6 pairs, 4 match, 2 different: expected 400/200/200"]);
  assert.equal(numeroDuJeu("realistic set #20, authored blind"), 20);
  assert.deepEqual(lireAttendu("--attendu=600/400/200"), { paires: 600, match: 400, different: 200 });
  assert.equal(lireAttendu(undefined), undefined);
  assert.throws(() => lireAttendu("--attendu=600/400/100"), /match \+ different/);
  assert.throws(() => lireAttendu("--attendu=six"), /expected --attendu/);
});

test("valider-jeu : les cadratins des noms deviennent un tiret, et la provenance le dit une fois", () => {
  const j = jeu([{ a: "Foo\u2014Bar", b: "Baz \u2014 Qux", verdict: "match", nature: "x" }, { a: "Sans", b: "Rien", verdict: "different", nature: "y" }]);
  const { jeu: propre, remplaces } = nettoyerCadratins(j);
  assert.equal(remplaces, 2);
  assert.deepEqual([propre.paires[0]!.a, propre.paires[0]!.b, propre.paires[1]!.a], ["Foo - Bar", "Baz - Qux", "Sans"]);
  assert.ok(propre.provenance.endsWith(` ${PHRASE_CADRATINS}`));
  assert.equal(nettoyerCadratins(propre).jeu.provenance, propre.provenance, "la phrase ne se répète pas");
  const intact = nettoyerCadratins(jeu([{ a: "Sans", b: "Rien", verdict: "match", nature: "x" }]));
  assert.equal(intact.remplaces, 0);
  assert.ok(!intact.jeu.provenance.includes(PHRASE_CADRATINS));
});

test("valider-jeu : CRUSETRA_JEUX_AVEUGLES déplace les jeux, CASCADE_JEUX_AVEUGLES (l'ancien nom) à défaut", () => {
  const defaut = dossierJeuxAveugles({});
  assert.match(defaut, /jeux-aveugles$/, "sans variable, le dossier voisin du dépôt");
  assert.equal(dossierJeuxAveugles({ CASCADE_JEUX_AVEUGLES: "/ancien" }), "/ancien", "l'ancien nom reste lu");
  assert.equal(dossierJeuxAveugles({ CRUSETRA_JEUX_AVEUGLES: "/neuf" }), "/neuf");
  assert.equal(dossierJeuxAveugles({ CRUSETRA_JEUX_AVEUGLES: "/neuf", CASCADE_JEUX_AVEUGLES: "/ancien" }), "/neuf",
    "le nouveau nom passe devant");
});

test("valider-jeu : le numéro du jeu vient de sa provenance", () => {
  assert.equal(numeroDuJeu("blind test set #15, authored on 2026-09-29"), 15);
  assert.equal(numeroDuJeu("a set without a number"), null);
});

test("valider-jeu : la copie part sous son numéro, octets intacts sans cadratin, jamais par-dessus une autre", () => {
  const dossier = mkdtempSync(join(tmpdir(), "valider-jeu-"));
  const j = jeuComplet();
  const brut = texte(j);
  const c = copier(brut, j, dossier);
  assert.equal(c.chemin, join(dossier, "jeu99-aveugle.json"));
  assert.equal(readFileSync(c.chemin, "utf8"), brut);
  assert.equal(c.sha256, createHash("sha256").update(brut).digest("hex"));
  assert.equal(c.remplaces, 0);
  assert.throws(() => copier(brut, j, dossier), /not overwritten/);
  /* avec un cadratin dans un nom : la copie n'en porte plus, et sa provenance le dit */
  const k = avec({ a: "Ferme\u2014Sud SA", b: "Ferme Sud SA", verdict: "match", nature: "dash" }, { provenance: "blind test set #98, authored blind" });
  const d = copier(texte(k), k, dossier);
  const relu = JSON.parse(readFileSync(d.chemin, "utf8")) as JeuBrut;
  assert.equal(d.remplaces, 1);
  assert.ok(!readFileSync(d.chemin, "utf8").includes("\u2014"));
  assert.equal(relu.paires[0]!.a, "Ferme - Sud SA");
  assert.ok(relu.provenance.endsWith(PHRASE_CADRATINS));
  assert.throws(() => copier(brut, { ...j, provenance: "no number here" }, dossier), /blind test set #N/);
  assert.ok(!existsSync(join(dossier, "jeuNaN-aveugle.json")));
});

test("témoin : un refus ne cite jamais un nom du jeu", () => {
  const noms = ["Zorglub Maritime Ltd", "Zorglub Maritime Limited", "Xanthippe Foods", "XANTHIPPE FOODS", "Quux\u2014Corp"];
  const fixtures: JeuBrut[] = [
    avec({ a: noms[0]!, b: noms[1]!, verdict: "maybe", nature: "x" }),
    avec({ a: noms[2]!, b: noms[3]!, verdict: "different", nature: "x" }),
    avec({ a: noms[4]!, b: noms[0]!, verdict: "match", nature: "x" }),
    jeu([{ a: noms[0]!, b: noms[1]!, verdict: "match", nature: "x" }]),
    jeu([{ a: noms[0]!, b: noms[1]!, verdict: "match" } as PaireBrute]),
  ];
  const apprentissage: Nom[][] = [[{ a: noms[0]!, b: noms[1]! }]];
  for (const f of fixtures) {
    const { refus } = analyserJeu(texte(f), apprentissage);
    assert.ok(refus.length > 0, "la fixture devait être refusée");
    for (const r of refus) for (const n of noms) assert.ok(!r.toLowerCase().includes(n.toLowerCase().slice(0, 8)), `un nom paraît dans le refus : ${r}`);
  }
});
