/**
 * TOUR 11, VOIE SWAHILI-OURDOU : les mots du commerce en swahili, en ourdou et en hindi que le nom anglais traduit ; les noms
 * arabes et persans que le Pakistan et la côte swahilie romanisent à leur façon (Bux, Nakhuda, Quraishi, Shamjee, Md.), lus
 * par les plis arabe et indien déjà là ; et l'homophone qu'un téléphone écrit sous la marque chat (Steal, Hardwear). Chaque
 * règle gardée a ici la paire qui l'a motivée (jeu 15, en apprentissage : rien ici ne vaut verdict) ; les scores sont ceux de
 * la méthode entière, au seuil FORT de 0,81 et au plafond POSSIBLE de 0,80.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  scoreNoms, analyserEntite, preparerNom, lecturesDe, TRADUCTIONS, GENERIQUES_AU_PLURIEL, pluriel, pliAi, squeletteLongue,
  clePhonetique, homophoneCorrige,
} from "./entites.ts";
import { frequencesDesListes } from "./frequences.ts";

const f = frequencesDesListes();
const score = (a: string, b: string) => scoreNoms(f, a, b);
const mots = (n: string) => { const l = lecturesDe(n)[0]!; return preparerNom(f, l.texte, l.lecture).mots; };
const FORT = 0.81;
const fort = (a: string, b: string) => assert.ok(score(a, b) >= FORT, `${a} / ${b} : ${score(a, b).toFixed(3)} (fort attendu)`);
const sousLeFort = (a: string, b: string) => assert.ok(score(a, b) < FORT, `${a} / ${b} : ${score(a, b).toFixed(3)} (sous le fort attendu)`);

test("tour 11, swahili : les mots de métier sous leurs classes nominales se traduisent (swahili.ts), kampuni est la company", () => {
  assert.equal(TRADUCTIONS.get("usafirishaji"), "transport");
  assert.equal(TRADUCTIONS.get("wakulima"), "farmers");
  assert.deepEqual(mots("Kampuni ya Usafirishaji Pwani Ltd").filter((m) => m !== "ya"), ["transport", "coast"]);
  assert.ok(analyserEntite("Kampuni ya Usafirishaji Pwani Ltd").societe, "kampuni rend la forme");
  fort("Kampuni ya Usafirishaji Pwani Ltd", "Pwani Transport Company Ltd");
  fort("Wakulima wa Meru Society Ltd", "Meru Farmers Society Ltd");
});

test("tour 11, ourdou et hindi : karkhana-e-sabun est soap factory, udyog et udhyog sont industry, l'enseigne traduite reste une enseigne", () => {
  assert.deepEqual(mots("Bismillah Karkhana-e-Sabun"), ["bismillah", "factory", "soap"]);
  fort("Bismillah Karkhana-e-Sabun", "Bismillah Soap Factory");
  /* la graphie udhyog (jeu 15) : traduire udyog seul perdait la paire, l'autre côté gardant un mot rare orphelin (mesuré le 30/09) */
  fort("Shree Kanak Kaveri Chawal Udyog Pvt. Ltd.", "Shri Kanak Kaveri Chaval Udhyog Private Limited");
  /* « duka » rend shop, « bhandar » store : ni shop ni store ne deviennent des génériques au pluriel (voir ENSEIGNES) */
  for (const m of ["shop", "shops", "store", "stores"]) assert.ok(!GENERIQUES_AU_PLURIEL.has(m), `${m} n'est pas un générique au pluriel`);
  assert.ok(!pluriel("shops", "shop"));
  assert.ok(!pluriel("stores", "store"));
  sousLeFort("Yusuf Provisions Shop", "Yusuf Provisions Shops Limited");
});

test("tour 11, marqueurs : Nakhoda, Ghulam, Bux, Qureshi marquent l'arabe, et les plis arabes lisent o et u, ee et i", () => {
  assert.ok(analyserEntite("MV Nakhoda Salim").arabe);
  assert.ok(analyserEntite("Qureshi Leather Works (Pvt) Ltd").arabe);
  fort("MV Nakhoda Salim", "M.V. Nakhuda Saleem");
});

test("tour 11, graphies : Bux, Buksh, Baksh sont Bakhsh (GRAPHIES_INDIENNES), sans marque", () => {
  assert.deepEqual(mots("MSV Ghulam Ali Bux"), ["ghulam", "ali", "bakhsh"]);
  fort("MSV Ghulam Ali Bux", "MSV Gulam Ali Bakhsh");
});

test("tour 11, Md., Mohd., Muhd sont Muhammad, et marquent l'arabe comme lui", () => {
  assert.deepEqual(mots("Md. Ilyas & Brothers"), ["muhammad", "ilyas", "brothers"]);
  assert.ok(analyserEntite("Md. Ilyas & Brothers").arabe);
  assert.deepEqual(mots("Mohd Yusof Trading"), ["muhammad", "yusof", "trading"]);
  fort("Md. Ilyas & Brothers", "Muhammad Ilyas & Bros.");
});

test("tour 11, le suffixe -jee du Raj marque l'Inde, et ee vaut i sous cette marque", () => {
  assert.ok(analyserEntite("Shamjee Hardware Ltd").indien);
  assert.ok(!analyserEntite("Shamji Hardware Ltd").indien, "ji seul ne marque rien (Kenji, Fuji)");
  fort("Shamji Hardware Ltd", "Shamjee Hardware Ltd");
});

test("tour 11, la diphtongue ai lue e (pliAi) sous les marques arabe et indienne : Qureshi, Quraishi", () => {
  assert.equal(squeletteLongue(pliAi("quraishi")), squeletteLongue(pliAi("qureshi")));
  assert.equal(squeletteLongue(pliAi("shaikh")), squeletteLongue(pliAi("shekh")));
  assert.equal(squeletteLongue(pliAi("kureishi")), squeletteLongue(pliAi("qureshi")), "ei aussi (Kureishi)");
  fort("Kureishi Leather Works (Pvt) Ltd", "Qureshi Leather Works (Pvt) Ltd");
  assert.notEqual(squeletteLongue(pliAi("hamad")), squeletteLongue(pliAi("hamid")), "a et i restent deux lettres");
  fort("Qureshi Leather Works (Pvt) Ltd", "Quraishi Leather Works (Pvt) Ltd");
  /* deux mots anglais ne se plient pas, marque ou pas */
  sousLeFort("Saint Traders Pvt Ltd", "Sent Traders Pvt Ltd");
});

test("tour 11, l'homophone d'un clavardage : le mot du commerce et son homophone du dictionnaire, jamais deux mots qui n'en sont pas", () => {
  assert.equal(clePhonetique("steal"), clePhonetique("steel"));
  assert.equal(clePhonetique("hardwear"), clePhonetique("hardware"));
  assert.notEqual(clePhonetique("supplies"), clePhonetique("suppliers"));
  /* le son, pas les lettres : ce qu'une clé sans voyelles fondait à tort (trois fausses alertes fortes, mesuré le 30/09) */
  for (const [a, b] of [["grain", "green"], ["resins", "raisins"], ["exports", "experts"], ["parts", "ports"], ["miming", "mining"]]) {
    assert.notEqual(clePhonetique(a!), clePhonetique(b!), `${a} / ${b}`);
  }
  assert.ok(homophoneCorrige("steel", "steal"));
  assert.ok(homophoneCorrige("hardware", "hardwear"), "hard + wear, deux mots du dictionnaire soudés");
  /* Cypress et Cyprus : aucun n'est un mot du commerce, l'arbre et l'île restent deux maisons (jeu 13), quoi que dise la clé */
  assert.ok(!homophoneCorrige("cyprus", "cypress") && !homophoneCorrige("cypress", "cyprus"));
  /* Marin n'est pas un mot du dictionnaire : Marine ne le corrige pas */
  assert.ok(!homophoneCorrige("marine", "marin"));
  fort("Karachi Steal Pipes", "Karachi Steel Pipes");
  fort("Otieno Hardwear Ltd", "Otieno Hardware Ltd");
});
