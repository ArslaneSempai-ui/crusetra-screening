/**
 * LES SIX MATCHERS, ÉPROUVÉS SUR DES PAIRES ÉCRITES À LA MAIN.
 *
 * Trois promesses portent le registre : chaque score vit dans [0, 1] ; deux appels rendent
 * la même valeur ; score(a, b) = score(b, a). Elles sont éprouvées EN BOUCLE sur toutes les
 * paires du fichier et tous les paliers — pas sur un exemple aimable par matcher.
 *
 * Les valeurs attendues sont de deux natures, et chaque cas dit laquelle : EXACTES quand
 * elles se calculent à la main (Jaccard, distance d'édition, les paires canoniques de
 * Jaro-Winkler publiées avec l'algorithme) ; en BORNES ENCADRÉES quand l'algorithme est
 * approximatif — et alors la paire proche doit dominer la paire sans rapport, sinon la
 * borne haute seule serait un vert qu'un matcher constant à 0,9 passerait aussi.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { registre } from "./matchers/index.ts";
import { normaliser, jetons } from "./matchers/normaliser.ts";
import { translitterer } from "./matchers/translitteration.ts";
import { preparer } from "./matchers/preparer.ts";
import { jaro } from "./matchers/jaro-winkler.ts";
import { distanceOsa } from "./matchers/damerau.ts";
import { clePhonetique, cleDuNom } from "./matchers/phonetic.ts";
import { trigrammes } from "./matchers/ngrams.ts";
import { exigerScore, PALIERS, type PalierId } from "./matcher.ts";

const R = registre();
const score = (id: PalierId, a: string, b: string) => R.get(id)!.score(a, b);
const proche = (x: number, attendu: number) =>
  assert.ok(Math.abs(x - attendu) < 1e-3, `${x} attendu ${attendu} (±0,001)`);

test("la normalisation : casse, diacritiques, ponctuation, espaces — et l'ordre resté intact", () => {
  assert.equal(normaliser("  José   NÚÑEZ "), "jose nunez");
  assert.equal(normaliser("O'Brien, J.-P."), "o brien j p");
  /* L'ordre des jetons n'est PAS trié : c'est le rôle de `tokens`, pas de la normalisation.
     Une normalisation qui trierait donnerait raison à `exact` sur une paire qu'il doit rater. */
  assert.equal(normaliser("Smith John"), "smith john");
  assert.notEqual(normaliser("Smith John"), normaliser("John Smith"));
  assert.deepEqual(jetons("jose nunez"), ["jose", "nunez"]);
  assert.deepEqual(jetons(""), [], "un nom vide rend zéro jeton, pas un jeton vide");
});

test("la translittération : cyrillique et arabe par les tables, l'inconnu traverse intact", () => {
  assert.equal(preparer("Дмитрий"), "dmitrii");
  assert.equal(preparer("Пётр Чайковский"), "petr chaikovskii");
  assert.equal(preparer("محمد"), "mhmd");
  /* Le ʿayn tombe sans couper le nom : une apostrophe deviendrait une frontière de jeton. */
  assert.equal(preparer("عبدالله"), "bdallh");
  /* HORS TABLES, INTACT : remplacer l'inconnu par du vide ferait converger deux noms
     différents vers la même chaîne. Les sinogrammes traversent, et restent distincts. */
  assert.equal(translitterer("王伟"), "王伟");
  assert.notEqual(preparer("王伟"), preparer("李娜"));
});

test("exact : 1 après normalisation, 0 pour tout le reste — les deux moitiés", () => {
  assert.equal(score("exact", "José Núñez", "jose nunez"), 1);
  assert.equal(score("exact", "  O'Brien ", "o brien"), 1);
  /* Le contre-pied est la moitié qui compte : chacune de ces paires est le TERRITOIRE d'un
     palier au-dessus, et `exact` doit la rater pour que la frontière ait quelque chose à
     montrer. */
  assert.equal(score("exact", "Smith John", "John Smith"), 0);
  assert.equal(score("exact", "Jhon Smith", "John Smith"), 0);
  assert.equal(score("exact", "J. Smith", "John Smith"), 0);
});

test("tokens : l'ordre indifférent, les initiales appariées, le Jaccard exact à la main", () => {
  assert.equal(score("tokens", "Smith John", "John Smith"), 1);
  assert.equal(score("tokens", "J. Smith", "John Smith"), 1, "l'initiale s'apparie au nom entier");
  /* Jaccard calculé à la main : {anna, maria, lopez} ∩ {anna, lopez} → m = 2,
     2 / (3 + 2 − 2) = 2/3. */
  proche(score("tokens", "Anna Maria Lopez", "Anna Lopez"), 2 / 3);
  assert.equal(score("tokens", "John Smith", "Maria Garcia"), 0);
  /* L'initiale ne s'apparie PAS à n'importe quoi : « j » contre « maria » n'a rien. */
  assert.equal(score("tokens", "J.", "Maria"), 0);
});

test("jaro-winkler : les paires canoniques publiées avec l'algorithme, à 0,001 près", () => {
  /* MARTHA / MARHTA et DWAYNE / DUANE sont les exemples de la littérature : si notre
     implémentation s'en écarte, elle porte le nom d'un algorithme qu'elle n'est pas. */
  proche(jaro("martha", "marhta"), 0.9444);
  proche(score("jaro-winkler", "MARTHA", "MARHTA"), 0.9611);
  proche(jaro("dwayne", "duane"), 0.8222);
  proche(score("jaro-winkler", "DWAYNE", "DUANE"), 0.84);
  assert.equal(score("jaro-winkler", "abc", "xyz"), 0, "aucun caractère commun : zéro");
});

test("damerau : la distance à la main, la transposition à un, et la variante OSA assumée", () => {
  assert.equal(distanceOsa("jhon", "john"), 1, "la transposition adjacente compte UN");
  proche(score("damerau", "Jhon Smith", "John Smith"), 1 - 1 / 10);
  proche(score("damerau", "Smith", "Smyth"), 1 - 1 / 5);
  /* LA LIMITE DE LA VARIANTE, ÉPINGLÉE : « ca » → « abc » coûte 3 en OSA là où le Damerau
     complet dit 2. Le fichier l'assume par écrit ; ce témoin refuse qu'elle change en
     silence — dans un sens comme dans l'autre. */
  assert.equal(distanceOsa("ca", "abc"), 3);
});

test("phonetic : les squelettes qui doivent se rejoindre, et ceux qui n'ont RIEN LU", () => {
  assert.equal(clePhonetique("smith"), clePhonetique("smyth"));
  assert.equal(score("phonetic", "Smith", "Smyth"), 1);
  assert.equal(score("phonetic", "Jon", "John"), 1);
  assert.equal(cleDuNom(preparer("Дмитрий")), cleDuNom(preparer("Dmitri")),
    "le même nom dans deux écritures rend le même squelette, via la translittération");
  /* Deux clés VIDES — script hors tables — sont SANS AVIS, jamais « identiques » : un 1 ici
     ferait converger deux noms chinois quelconques. */
  assert.equal(cleDuNom(preparer("王伟")), "");
  assert.equal(score("phonetic", "王伟", "李娜"), 0);
  assert.ok(score("phonetic", "Mohammed", "محمد") >= 0.7,
    "deux romanisations du même nom gardent un squelette voisin");
});

test("ngrams : identiques à 1, proches au-dessus, sans rapport en dessous — l'ÉCART est le témoin", () => {
  assert.equal(score("ngrams", "John Smith", "john smith"), 1);
  const typo = score("ngrams", "Jhon Smith", "John Smith");
  const rien = score("ngrams", "John Smith", "Véronique Dupont");
  assert.ok(typo > 0.5, `la faute de frappe garde la majorité des trigrammes (${typo})`);
  assert.ok(rien < 0.2, `deux noms sans rapport ne partagent presque rien (${rien})`);
  assert.ok(typo > rien + 0.3,
    "sans écart entre la paire proche et la paire sans rapport, un matcher constant passerait les deux bornes");
  /* Une initiale seule a UN trigramme (« j » bordé) : rien n'est un cas spécial muet. */
  assert.equal(trigrammes("j").size, 1);
});

test("chaque palier sépare la paire translittérée de la paire sans rapport", () => {
  /* La translittération n'est pas l'affaire du seul palier phonétique : sur « Дмитрий » /
     « Dmitri », les paliers de CHAÎNE doivent faire mieux que sur deux noms étrangers l'un
     à l'autre — c'est le travail que les tables achètent pour toute la colonne.

     `tokens` N'EST PAS DANS LA BOUCLE, et ce retrait est un fait appris de ce témoin : sur
     une paire à UN SEUL jeton près d'un caractère (« dmitrii » / « dmitri »), le Jaccard
     rend 0 des deux côtés — les ensembles ne partagent rien et l'initiale ne s'applique
     pas. Ce n'est pas un défaut : c'est la forme du palier, dont le territoire est l'ordre
     et les initiales, et la frontière mesurée du lot R3 le montrera mieux qu'une exigence
     fausse ici. */
  for (const id of ["jaro-winkler", "damerau", "phonetic", "ngrams"] as const) {
    const paire = score(id, "Дмитрий", "Dmitri");
    const rien = score(id, "Дмитрий", "Véronique Dupont");
    assert.ok(paire > rien,
      `${id} : la paire translittérée (${paire.toFixed(3)}) ne domine pas la paire sans rapport (${rien.toFixed(3)})`);
  }
});

/* ─── Les trois promesses du registre, en boucle sur toutes les paires du fichier ─── */

const PAIRES: readonly [string, string][] = [
  ["John Smith", "John Smith"], ["José Núñez", "jose nunez"], ["Smith John", "John Smith"],
  ["Jhon Smith", "John Smith"], ["J. Smith", "John Smith"], ["Дмитрий", "Dmitri"],
  ["محمد", "Mohammed"], ["John Smith", "Véronique Dupont"], ["", ""], ["", "John"],
  ["j", "j"], ["王伟", "李娜"], ["Anna-Maria O'Brien", "anna maria obrien"],
  ["Пётр Чайковский", "Petr Chaikovskii"], ["عبدالله", "Abdallah"],
];

test("tout score vit dans [0, 1], sur toutes les paires, tous les paliers", () => {
  for (const [id, m] of R) {
    for (const [a, b] of PAIRES) {
      const s = m.score(a, b);
      assert.ok(Number.isFinite(s) && s >= 0 && s <= 1, `${id}("${a}", "${b}") = ${s}`);
    }
  }
});

test("deux appels, même valeur : aucun matcher ne porte d'état", () => {
  for (const [id, m] of R) {
    for (const [a, b] of PAIRES) {
      assert.equal(m.score(a, b), m.score(a, b), `${id}("${a}", "${b}") varie entre deux appels`);
    }
  }
});

test("score(a, b) = score(b, a), sur toutes les paires, tous les paliers", () => {
  /* Jaro n'est pas symétrique dans certaines écritures ; celle-ci l'est, et les cinq autres
     algorithmes le promettent par construction. La boucle le VÉRIFIE au lieu de le croire —
     l'appariement des initiales de `tokens` est précisément le genre d'endroit où une
     asymétrie se glisse à une paire près. */
  for (const [id, m] of R) {
    for (const [a, b] of PAIRES) {
      assert.equal(m.score(a, b), m.score(b, a), `${id} n'est pas symétrique sur ("${a}", "${b}")`);
    }
  }
});

test("le registre porte EXACTEMENT les six paliers livrés, et le dit", () => {
  /* `embed` n'est pas livré ce soir : le modèle local et ses poids épinglés viendront quand
     le reste sera vert. Le registre le dit par son contenu — et ce témoin tombera le jour où
     `embed` arrive, pour être mis à jour en conscience, pas par surprise. */
  assert.deepEqual([...R.keys()], ["exact", "tokens", "jaro-winkler", "damerau", "phonetic", "ngrams"]);
  assert.deepEqual(
    PALIERS.filter((p) => !R.has(p)), ["embed"],
    "les paliers absents du registre doivent être exactement ceux qu'on sait absents");
  /* Les rangs suivent l'ordre du contrat, du plus bête au plus cher. */
  const rangs = [...R.values()].map((m) => m.rang);
  assert.deepEqual(rangs, [...rangs].sort((x, y) => x - y), "le registre n'est plus ordonné par coût");
});

test("exigerScore refuse ce qui n'est pas un score, en nommant le matcher — et laisse passer les scores", () => {
  for (const bon of [0, 0.5, 1]) assert.equal(exigerScore(bon, "exact", "a", "b"), bon);
  for (const mauvais of [NaN, -0.1, 1.2, Infinity]) {
    assert.throws(() => exigerScore(mauvais, "damerau", "a", "b"), /matcher "damerau" returned/,
      `${mauvais} doit être refusé : un score hors [0, 1] est un défaut du matcher, pas une valeur`);
  }
});
