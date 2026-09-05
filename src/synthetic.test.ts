import { test } from "node:test";
import assert from "node:assert/strict";
import { tirage, variantes, jeuSynthetique, NATURES, type Nature } from "./synthetic.ts";

test("le générateur est déterministe : même graine, même suite ; autre graine, autre suite", () => {
  const a = tirage(42), b = tirage(42), c = tirage(43);
  const sa = [a(), a(), a()], sb = [b(), b(), b()], sc = [c(), c(), c()];
  assert.deepEqual(sa, sb);
  assert.notDeepEqual(sa, sc);
  for (const v of sa) assert.ok(v >= 0 && v < 1);
});

test("mêmes variantes à même graine, et chaque nature applicable est présente et distincte du nom", () => {
  /* Un nom riche : diacritiques, lettre double, trois jetons — toutes les natures s'appliquent. */
  const nom = "José Müller Haddad";
  const une = variantes(nom, 20260905, NATURES.length);
  const deux = variantes(nom, 20260905, NATURES.length);
  assert.deepEqual(une, deux, "deux passes à la même graine doivent rendre les MÊMES variantes");

  const natures = new Set(une.map((v) => v.nature));
  /* Sur un nom latin sans son translittérable ni alternance de romanisation, ces deux
     natures passent leur tour — elles ont leurs propres cas plus bas. */
  const inapplicables: Nature[] = ["transliterated", "alt-transliteration"];
  for (const n of NATURES.filter((x) => !inapplicables.includes(x))) {
    assert.ok(natures.has(n), `nature absente sur un nom où elle s'applique : ${n}`);
  }
  for (const n of inapplicables) assert.ok(!natures.has(n), `${n} ne s'applique pas à ce nom latin`);
  for (const v of une) {
    assert.notEqual(v.variante, nom, `la variante « ${v.nature} » est égale au nom d'origine`);
    assert.ok(v.variante.length > 0, "aucune variante vide");
  }
  assert.equal(new Set(une.map((v) => v.variante)).size, une.length, "aucune variante en double");
});

test("chaque nature fait ce que son étiquette annonce", () => {
  const nom = "José Müller Haddad";
  const par = new Map<Nature, string>(variantes(nom, 7, NATURES.length).map((v) => [v.nature, v.variante]));
  assert.equal(par.get("no-diacritics"), "Jose Muller Haddad");
  assert.equal(par.get("reversed-order"), "Haddad Müller José");
  assert.match(par.get("initial")!, /^(J\. Müller Haddad|José M\. Haddad)$/);
  assert.equal(par.get("omission")!.length, nom.length - 1);
  assert.equal(par.get("insertion")!.length, nom.length + 1);
  assert.equal(par.get("doubled-letter")!.length, nom.length + 1);
  assert.equal(par.get("undoubled-letter")!.length, nom.length - 1);
  assert.equal(par.get("substitution")!.length, nom.length);
  assert.equal(par.get("transposition")!.length, nom.length);
});

test("une nature inapplicable passe son tour au lieu de rendre le nom inchangé", () => {
  /* « Smith » : un seul jeton, sans diacritique, sans double lettre — trois natures muettes. */
  const v = variantes("Smith", 11, 20);
  const natures = new Set(v.map((x) => x.nature));
  assert.ok(!natures.has("reversed-order"), "un seul jeton n'a pas d'ordre à inverser");
  assert.ok(!natures.has("no-diacritics"), "sans diacritique, ôter ne change rien : rendre le nom égal serait un faux cas");
  assert.ok(!natures.has("undoubled-letter"), "aucune lettre double à dédoubler");
  assert.ok(!natures.has("initial"), "pas de prénom à abréger");
  for (const x of v) assert.notEqual(x.variante, "Smith");
});

test("un nom vide se refuse : l'appelant tient une mauvaise entrée de liste", () => {
  assert.throws(() => variantes("  ", 1, 3), /empty name has no variants/);
});

test("un nom cyrillique porte sa romanisation R1 comme variante — jamais une variante de casse seule", () => {
  const v = variantes("Мухаммед Морозов", 20260905, NATURES.length);
  const t = v.find((x) => x.nature === "transliterated");
  assert.ok(t, "la nature transliterated doit s'appliquer à un nom cyrillique");
  assert.equal(t!.variante, "mukhammed morozov", "la romanisation est celle de la table de R1, sur la minuscule");
  /* Et sur du latin pur, « José » → « josé » ne compte PAS : une variante qui ne diffère
     que par la casse serait un faux cas que les matchers absorbent par construction. */
  assert.ok(!variantes("José Müller", 3, 20).some((x) => x.nature === "transliterated"));
});

test("l'alternance de romanisation remplace UNE occurrence documentée, casse suivie", () => {
  /* « Mukhammed Morozov » : seule la paire kh↔h s'applique — l'attendu est exact. */
  const v = variantes("Mukhammed Morozov", 20260905, NATURES.length);
  const alt = v.find((x) => x.nature === "alt-transliteration");
  assert.ok(alt, "kh est dans le nom : l'alternance doit s'appliquer");
  assert.equal(alt!.variante, "Muhammed Morozov");
  const V = variantes("MUKHAMMED", 7, 30).find((x) => x.nature === "alt-transliteration");
  assert.equal(V?.variante, "MUHAMMED", "en capitales, le remplacement suit la casse");
  assert.ok(!variantes("Smith", 5, 30).some((x) => x.nature === "alt-transliteration"),
    "aucune paire applicable : la nature passe son tour");
});

test("au parNom par défaut, la sélection s'étale : les familles de queue ne sont pas mortes", () => {
  /*
   * LA TROUVAILLE DE LA RELECTURE CROISÉE : l'ancienne sélection prenait le PRÉFIXE des
   * natures — sur 200 vrais noms OFAC, zéro no-diacritics, zéro translittération au
   * parNom par défaut, pendant que la doc promettait chaque famille. Ce cas épingle les
   * deux directions : le préfixe n'est plus systématique, et l'agrégat exerce la queue.
   */
  const noms = ["José GARCÍA", "Mukhammed ALIYEV", "François MÜLLER", "Khalid HADDAD",
    "Ivan PETROV", "Nadia OKONKWO", "Piotr NOVAK", "Sofia ROSSI"];
  const jeu = jeuSynthetique(noms, 20260905, 6);
  const naturesDuJeu = new Set(jeu.map((c) => c.nature));
  /* Les familles LARGEMENT applicables doivent sortir dans l'agrégat au défaut. La plus
     rare (alt-transliteration : deux noms sur huit la portent) se teste à part, sur des
     graines fixes — exiger la plus rare dans un petit jeu testerait ma chance, pas la
     propriété. */
  for (const attendue of ["no-diacritics", "doubled-letter", "undoubled-letter"] as const) {
    assert.ok(naturesDuJeu.has(attendue),
      `la famille « ${attendue} » n'apparaît pas dans un jeu de ${jeu.length} cas où elle s'applique — la sélection est redevenue un préfixe`);
  }
  const graines2 = [1, 2, 3, 4, 5, 6, 7, 8];
  assert.ok(graines2.some((g) => variantes("Mukhammed ALIYEV", g, 6).some((v) => v.nature === "alt-transliteration")),
    "huit graines sur un nom à deux alternances (kh, iy) et jamais d'alt-transliteration retenue");
  /* Et sur UN nom riche, la sélection de 6 parmi 9 applicables n'est pas toujours les six
     premières : au moins une graine d'un petit jeu fixe doit retenir une nature de queue. */
  const PREFIXE = new Set(["substitution", "omission", "insertion", "transposition", "reversed-order", "initial"]);
  const graines = [1, 2, 3, 4, 5, 6, 7, 8];
  assert.ok(graines.some((g) => variantes("José Müller Haddad", g, 6).some((v) => !PREFIXE.has(v.nature))),
    "huit graines de suite ne retiennent que le préfixe : l'étalement ne fonctionne pas");
});

test("un nom qui porte un trait REÇOIT sa variante — les natures du trait sont garanties", () => {
  /* L'arbitrage du Chef, épinglé tel quel : ces présences sont GARANTIES, pas probables. */
  const garcia = variantes("José García", 20260905, 6);
  assert.ok(garcia.some((v) => v.nature === "no-diacritics"),
    "un nom à diacritiques doit recevoir sa variante sans diacritiques au parNom par défaut");
  const dmitri = variantes("Дмитрий Иванов", 20260905, 6);
  assert.ok(dmitri.some((v) => v.nature === "transliterated"),
    "un nom cyrillique doit recevoir sa romanisation");
  const alt = dmitri.find((v) => v.nature === "alt-transliteration");
  assert.ok(alt, "…et une romanisation ALTERNATIVE : l'alternance se joue dans la romanisation, pas dans le cyrillique");
  assert.match(alt!.variante, /^[a-z .'-]+$/,
    "l'alternative d'un nom cyrillique est latine (translittérer d'abord, alterner ensuite)");
  assert.notEqual(alt!.variante, dmitri.find((v) => v.nature === "transliterated")!.variante,
    "l'alternative doit différer de la romanisation de la table");
  /* Et sur plusieurs graines, la garantie tient — c'est une propriété, pas un coup de dé. */
  for (const g of [1, 2, 3]) {
    assert.ok(variantes("José García", g, 6).some((v) => v.nature === "no-diacritics"), `graine ${g}`);
  }
});

test("l'insertion peut tomber en fin de nom", () => {
  /* Micro de la relecture : les positions de lettres seules interdisaient la dernière
     place. Sur « A », les positions sont maintenant 0 et 1 : sur un petit jeu de graines
     fixes, une insertion doit finir APRÈS le A. */
  const graines = Array.from({ length: 12 }, (_, i) => i + 1);
  const enFin = graines.some((g) =>
    variantes("A", g, 20).some((v) => v.nature === "insertion" && v.variante[0] === "A"));
  assert.ok(enFin, "douze graines et aucune insertion après la dernière lettre : la fin du nom reste interdite");
});

test("le jeu synthétique est stable sous retrait d'une entrée, et chaque cas porte son étiquette", () => {
  const avant = jeuSynthetique(["Ivan PETROV", "ANGLO-CARIBBEAN CO."], 20260905, 4);
  const apres = jeuSynthetique(["Ivan PETROV"], 20260905, 4);
  assert.deepEqual(apres, avant.filter((c) => c.nom_liste === "Ivan PETROV"),
    "retirer une entrée ne doit pas recomposer les variantes des autres — la graine dérive du nom");
  for (const c of avant) {
    assert.ok(NATURES.includes(c.nature));
    assert.notEqual(c.variante, c.nom_liste);
  }
  assert.ok(avant.filter((c) => c.nom_liste === "Ivan PETROV").length >= 4,
    "un nom à deux jetons porte au moins n variantes demandées");
});
