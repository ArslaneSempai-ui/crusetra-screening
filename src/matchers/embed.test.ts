/**
 * LE PALIER `embed`, ÉPROUVÉ DANS SES DEUX ÉTATS — poids présents, poids absents.
 *
 * Un clone neuf n'a pas les poids : la moitié « présents » de ce fichier s'y déclare
 * ignorée EN NOMMANT le geste qui la remplit, et la moitié « absents » y tourne. Sur une
 * machine garnie, tout tourne. Aucun des deux états ne rend un vert sans avoir regardé :
 * chaque saut est un skip nommé, jamais un cas qui passe à vide.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { embed, rechaufferEmbed, oublierLesVecteurs } from "./embed.ts";
import { registre, registreComplet } from "./index.ts";
import { poidsSurPlace, FICHIERS, MODELE } from "../poids.ts";
import { PALIERS } from "../matcher.ts";

const GARNIS = poidsSurPlace();

test("le manifeste des poids est complet et épinglé : quatre fichiers, octets et sha256", () => {
  assert.equal(FICHIERS.length, 4);
  for (const f of FICHIERS) {
    assert.match(f.sha256, /^[0-9a-f]{64}$/, `${f.chemin} : le sha256 n'a pas la forme d'un sha256`);
    assert.ok(f.octets > 0);
  }
  assert.ok(FICHIERS.some((f) => f.chemin === "onnx/model.onnx" && f.octets === 470_268_533),
    "le model.onnx épinglé n'a plus les octets de la révision de la maison");
  assert.equal(MODELE.revision, "761b726dd34f",
    "la révision n'est plus celle que cascade-routing épingle : une seule paire dépôt/révision par maison");
});

test("poids absents : le palier est ABSENT et nommé, jamais deviné ni téléchargé", { skip: GARNIS && "poids présents sur cette machine : l'état absent est éprouvé sur un clone neuf" }, () => {
  const r = registreComplet();
  assert.equal(r.has("embed"), false, "sans poids, embed ne doit pas être au registre");
  assert.deepEqual(PALIERS.filter((p) => !r.has(p)), ["embed"]);
});

test("le registre de base ne bouge JAMAIS : six paliers synchrones, avec ou sans poids", () => {
  /* your-alerts note sans réchauffer : embed dans registre() planterait chez un client
     dont les poids sont là. L'adoption côté client est UNE ligne, chez son propriétaire. */
  assert.deepEqual([...registre().keys()], ["exact", "tokens", "jaro-winkler", "damerau", "phonetic", "ngrams"]);
});

test("à froid, un score est un REFUS nommé — jamais un calcul improvisé", { skip: !GARNIS && "poids absents : npm run poids -- --fetch" }, () => {
  oublierLesVecteurs();
  assert.throws(() => embed.score("Ivan Petrov", "Petr Ivanov"), /rechaufferEmbed/,
    "le refus doit nommer le geste qui manque, pas planter dans la bibliothèque");
  /* L'égalité après normalisation n'a pas besoin de vecteurs : 1 exact, même à froid. */
  assert.equal(embed.score("José Núñez", "jose nunez"), 1);
});

test("réchauffé : déterministe, symétrique, dans [0, 1], et l'écriture est SON territoire", { skip: !GARNIS && "poids absents : npm run poids -- --fetch" }, async () => {
  oublierLesVecteurs();
  const NOMS = ["Дмитрий Соколов", "Dmitri Sokolov", "محمد حسن", "Mohammed Hassan",
    "John Smith", "Véronique Dupont", "王伟", "李娜"];
  await rechaufferEmbed(NOMS);
  const r = registreComplet();
  assert.equal(r.has("embed"), true);
  const m = r.get("embed")!;
  for (const a of NOMS) for (const b of NOMS) {
    const s = m.score(a, b);
    assert.ok(s >= 0 && s <= 1, `score(${a}, ${b}) = ${s}`);
    assert.equal(s, m.score(a, b), "deux appels divergent : un cache ne tire pas au sort");
    assert.equal(s, m.score(b, a), `asymétrie sur (${a}, ${b})`);
  }
  /* Ce que les tables de translittération ne savent pas, lui le voit : la paire
     inter-écritures domine la paire sans rapport, dans les deux écritures éprouvées. */
  const cyril = m.score("Дмитрий Соколов", "Dmitri Sokolov");
  const arabe = m.score("محمد حسن", "Mohammed Hassan");
  const rien = m.score("John Smith", "Véronique Dupont");
  assert.ok(cyril > rien, `cyrillique↔latin (${cyril.toFixed(3)}) ne domine pas la paire sans rapport (${rien.toFixed(3)})`);
  assert.ok(arabe > rien, `arabe↔latin (${arabe.toFixed(3)}) ne domine pas la paire sans rapport (${rien.toFixed(3)})`);
  /* L'identique rend 1 EXACT : le cosinus flottant de deux vecteurs égaux rend 0,999… et
     raterait le seuil 1,00 — la leçon de ngrams, payée une fois, tenue partout. */
  assert.equal(m.score("John Smith", "john smith"), 1);
});

test("le réchauffement passe par le membre de couture, et la mesure publique le fait", { skip: !GARNIS && "poids absents : npm run poids -- --fetch" }, async () => {
  const m = registreComplet().get("embed")!;
  assert.equal(typeof m.rechauffer, "function", "embed au registre complet doit porter rechauffer()");
  oublierLesVecteurs();
  await m.rechauffer!(["Anna Kowalska", "Anna Kowalski"]);
  const s = m.score("Anna Kowalska", "Anna Kowalski");
  assert.ok(s > 0 && s <= 1);
  /* Et les six paliers de chaînes n'ont PAS ce membre : rien ne change pour eux. */
  for (const [id, x] of registre()) assert.equal(x.rechauffer, undefined, `${id} porte un rechauffer inattendu`);
});
