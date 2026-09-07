/* PARTAGÉ DANS LA FAMILLE CASCADE — source : cascade-screening
   Les dépôts de la famille (cascade, -screening, -monitoring, -scoring, -dossier) en portent
   une copie identique AU BYTE. Corrigez-le dans la source, puis recopiez : la famille est
   EXCLUE de la diffusion d'identite (depots.json), aucune diffusion ne viendra le faire à
   votre place. `couche-famille.test.ts` compare les octets, nomme la direction du retard, et
   refuse aussi un fichier identique dans deux dépôts qui ne porte PAS cet en-tête — c'est
   ainsi qu'une copie neuve se déclare au lieu de dériver en silence. */
/**
 * Les cas hostiles du lecteur — rapatriés de cascade-routing avec le lecteur lui-même.
 * Chacun correspond à un défaut payé dans le dépôt d'origine ; un lecteur ré-extrait qui
 * n'en réussirait pas un aurait perdu une cicatrice en route.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { lireTable, cellule, apercu } from "./csv.ts";

test("une virgule dans une cellule entre guillemets ne coupe pas la ligne", () => {
  const t = lireTable('a,b\n"x, y",z\n');
  assert.deepEqual(t.lignes, [["x, y", "z"]]);
});

test("un guillemet doublé est un guillemet", () => {
  const t = lireTable('a,b\n"il a dit ""bonjour""",z\n');
  assert.deepEqual(t.lignes[0]![0], 'il a dit "bonjour"');
});

test("un retour à la ligne dans une cellule ne crée pas un cas, et les numéros restent VRAIS", () => {
  /* Le défaut d'origine : un texte cité sur trois lignes décalait tous les index, et le
     client cherchait « line 7 » au mauvais endroit de son propre export. */
  const t = lireTable('a,b\n"un\ntexte\ncité",z\ncourt,w\n');
  assert.equal(t.lignes.length, 2);
  assert.deepEqual(t.numeros, [2, 5], "la seconde ligne de données commence bien à la ligne 5 du fichier");
});

test("les fins de ligne Windows sont acceptées", () => {
  const t = lireTable("a,b\r\nx,y\r\n");
  assert.deepEqual(t.lignes, [["x", "y"]]);
});

test("une marque d'ordre d'octets ne casse pas le nom de la première colonne", () => {
  const t = lireTable("﻿a,b\nx,y\n");
  assert.deepEqual(t.noms, ["a", "b"]);
});

test("les lignes vides sont ignorées, pas comptées comme des lignes", () => {
  const t = lireTable("a,b\n\nx,y\n\n\n");
  assert.equal(t.lignes.length, 1);
});

test("un guillemet jamais refermé est refusé EN NOMMANT sa ligne d'ouverture", () => {
  assert.throws(() => lireTable('a,b\nx,y\nz,"jamais refermé\nw,v\n'), (e: Error) => {
    assert.match(e.message, /Line 3 .* opens a quote that is never closed/);
    assert.match(e.message, /sed -n '3p'/, "le refus donne le geste qui trouve la ligne");
    return true;
  });
});

test("un en-tête qui nomme deux fois la même colonne est refusé, pas deviné", () => {
  assert.throws(() => lireTable("a,b,b\nx,y,z\n"), /names the same column twice: "b"/);
});

test("une cellule d'un mégaoctet est signalée, pas tue — et la garde compte des octets réels", () => {
  const grosse = "щ".repeat(600_000);   /* 600 k caractères cyrilliques ≈ 1,2 Mo réels */
  const t = lireTable(`a,b\n"${grosse}",z\n`);
  assert.equal(t.demesurees.length, 1, "la cellule cyrillique dépasse le mégaoctet en octets réels");
  /* Contre-épreuve : la même longueur en latin pèse 600 ko et ne doit PAS être signalée —
     sinon la garde compte des caractères en les appelant des octets. */
  const latine = "a".repeat(600_000);
  assert.equal(lireTable(`a,b\n"${latine}",z\n`).demesurees.length, 0);
});

test("une ligne plus longue que l'en-tête est écartée et nommée ; une plus courte est gardée et comptée", () => {
  const t = lireTable("a,b\nx,y,z\nseule\n");
  assert.deepEqual(t.ecartees, [{ ligne: 2, cellules: 3 }]);
  assert.deepEqual(t.courtes, [{ ligne: 3, cellules: 1 }]);
  assert.deepEqual(t.lignes, [["seule"]]);
});

test("un fichier vide est refusé : pas d'en-tête, pas de lecture", () => {
  assert.throws(() => lireTable(""), /file is empty/);
  assert.throws(() => lireTable("\n\n"), /file is empty/);
});

test("cellule() : la barre ne casse pas le tableau, l'accent grave ne referme pas le code", () => {
  assert.equal(cellule("a|b"), "`a\\|b`");
  assert.equal(cellule("a`b"), "`a'b`");
  assert.equal(cellule("x\\|y"), "`x\\\\\\|y`", "les backslashes devant la barre restent pairs");
});

test("apercu() porte le compte de ce qu'il écarte", () => {
  assert.equal(apercu(["a", "b", "c"], 2), "a, b, and 1 more");
  assert.equal(apercu(["a", "b"], 2), "a, b");
});
