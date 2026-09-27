/**
 * TOUR 10, VOIE ARABE-FRANÇAIS : un nom arabe ou persan romanisé sous la convention française du Maghreb et du Levant (ou pour w,
 * ch pour sh, c dur, e pour la voyelle brève, l'article réduit à son l, la voyelle initiale élidée) face à l'anglaise du Golfe
 * (w, sh, q, ee et oo, Abdul, Est.). Chaque règle gardée a ici la paire qui l'a motivée (jeu 14, en apprentissage : rien ici ne
 * vaut verdict) ; les scores sont ceux de la méthode entière, au seuil FORT de 0,81 et au plafond POSSIBLE de 0,80.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  scoreNoms, analyserEntite, preparerNom, lecturesDe, squelette, squeletteArabe, variationVocalique, voyelleSauteeArabe, articleReduit,
  scinderAbd,
} from "./entites.ts";
import { frequencesDesListes } from "./frequences.ts";

const f = frequencesDesListes();
const score = (a: string, b: string) => scoreNoms(f, a, b);
const mots = (n: string) => { const l = lecturesDe(n)[0]!; return preparerNom(f, l.texte, l.lecture).mots; };
const FORT = 0.81;
const fort = (a: string, b: string) => assert.ok(score(a, b) >= FORT, `${a} / ${b} : ${score(a, b).toFixed(3)} (fort attendu)`);
const sousLeFort = (a: string, b: string) => assert.ok(score(a, b) < FORT, `${a} / ${b} : ${score(a, b).toFixed(3)} (sous le fort attendu)`);

test("tour 10, arabe-français : le squelette arabe plie ou et w, aw et o, ei et ai, le c dur et la finale -eh, entre mots latins seulement", () => {
  for (const [a, b] of [["ouahbi", "wahbi"], ["chaouki", "shawqi"], ["toufic", "tawfiq"], ["hawsani", "hosani"], ["hosseini", "husaini"],
    ["saleh", "salih"], ["daoud", "dawood"], ["daoud", "daud"], ["zein", "zain"]]) {
    assert.equal(squeletteArabe(a!), squeletteArabe(b!), `${a} / ${b}`);
  }
  /* ce que le pli ne fond pas : b et f, a et i, Saleh et Salah */
  assert.notEqual(squeletteArabe("bahr"), squeletteArabe("fahr"));
  assert.notEqual(squeletteArabe("hamad"), squeletteArabe("hamid"));
  assert.notEqual(squeletteArabe("saleh"), squeletteArabe("salah"));
  /* un mot lu dans l'écriture native (کاوه : kawh) garde son w : les conventions latines ne s'y plient pas (Kaveh n'est pas Kouh) */
  assert.equal(squeletteArabe("kawh"), squeletteArabe("kouh"), "entre deux mots latins, aw et ou se ferment de même");
  assert.notEqual(squeletteArabe("kawh", true, false), squeletteArabe("kouh", true, false), "un côté natif : non");
  sousLeFort("بازرگانی سپید کاوه کیش", "Sefid Kouh Trading Kish");
  for (const [a, b] of [["Toufic Haddad Est.", "Tawfiq Haddad Establishment"], ["Hosseini Kashani Trading Co.", "Husaini Kashani Trading Co."],
    ["Ibrahim Al Hawsani Est.", "Ebrahim Alhosani Establishment"], ["Abdel Karim Saleh Foodstuff Trading L.L.C.", "Abd Al-Kareem Salih Foodstuff Trading LLC"]]) fort(a!, b!);
  sousLeFort("Al Bahr Trading Est.", "Al Fahr Trading Est.");
  sousLeFort("Hamad Al Saud Trading Est.", "Hamid Al Saud Trading Est.");
  sousLeFort("Al Saleh Trading Est.", "Al Salah Trading Est.");
});

test("tour 10, arabe-français : le schwa (e, u) sous la marque arabe, la voyelle sautée en tête ou après la consonne initiale, l'article réduit à son l", () => {
  assert.ok(variationVocalique("iusef", "iusuf", true), "Youssef, Yusuf sous la marque");
  assert.ok(!variationVocalique("iusef", "iusuf"), "hors de la marque, e et u sont deux voyelles");
  for (const [a, b] of [["prahim", "iprahim"], ["smail", "ismail"], ["mhairi", "muhairi"], ["krim", "karim"], ["fatma", "fatima"]]) {
    assert.ok(voyelleSauteeArabe(a!, b!), `${a} / ${b}`);
  }
  /* Amr et Amir, Nasr et Nasir restent deux noms : la voyelle perdue n'y suit pas la consonne initiale */
  assert.ok(!voyelleSauteeArabe("amr", "amir"));
  assert.ok(!voyelleSauteeArabe("nasr", "nasir"));
  for (const [l, nu] of [["lamine", "amin"], ["lamine", "amine"], ["larbi", "arbi"], ["lhoussine", "houssine"]]) assert.ok(articleReduit(l!, nu!), `${l} / ${nu}`);
  assert.ok(!articleReduit("logistics", "ogistics"), "un mot du dictionnaire n'a pas d'article");
  assert.ok(!articleReduit("lina", "ina"), "quatre lettres : rien à couper");
  for (const [a, b] of [["Mohamed Lamine Ould Brahim Transit", "Muhammad al-Amin wuld Ibrahim Transit"], ["Tariq Al Muhairi Contracting", "Tarek El Mheiri Contracting"],
    ["Chouaki Abdelkrim & Fils SARL", "Shouaki Abdulkarim & Fils SARL"]]) fort(a!, b!);
});

test("tour 10, arabe-français : le nom théophore sous une seule suite, la filiation sous un seul mot, la filiation abrégée", () => {
  assert.deepEqual(scinderAbd("abdelkarim"), ["abd", "al", "karim"]);
  assert.deepEqual(scinderAbd("abdulaziz"), ["abd", "al", "aziz"]);
  assert.deepEqual(scinderAbd("abdurrahman"), ["abd", "al", "rahman"]);
  assert.deepEqual(scinderAbd("abdul"), ["abd", "al"]);
  assert.deepEqual(scinderAbd("abdel"), ["abd", "al"]);
  for (const j of ["abdullah", "abdou", "abdi", "abdomen", "abd"]) assert.equal(scinderAbd(j), undefined, j);
  assert.deepEqual(mots("Abdelkarim Tahar Logistique"), ["abd", "al", "karim", "tahar", "logistics"]);
  assert.deepEqual(mots("Abdul Kareem Taher Logistics"), ["abd", "al", "kareem", "taher", "logistics"]);
  assert.ok(mots("Abdullah Al Otaiba Trading").includes("abdullah"), "Abdullah reste entier");
  /* bin, ibn, ben, ould, wuld sont un mot ; B. entre deux noms est bin, sous un marqueur arabe ou une forme malaise */
  assert.deepEqual(mots("Ubaid ibn Sultan Al-Kitbi Contracting"), ["ubaid", "bin", "sultan", "al", "kitbi", "contracting"]);
  assert.ok(mots("Mohamed Lamine Ould Brahim Transit").includes("bin"), "Ould est bin");
  assert.deepEqual(mots("Saeed B. Hamad Trading Est."), ["saeed", "bin", "hamad", "trading"]);
  assert.deepEqual(mots("Aminah Bt. Yusof Enterprise Sdn. Bhd."), ["aminah", "bint", "yusof", "enterprise"]);
  assert.ok(mots("Saeed B. Hamad Trading").includes("b"), "sans marqueur arabe ni forme malaise, l'initiale reste une initiale");
  for (const [a, b] of [["Abdelkarim Tahar Logistique", "Abdul Kareem Taher Logistics"], ["Obaid bin Sultan Al Ketbi Contracting", "Ubaid ibn Sultan Al-Kitbi Contracting"],
    ["Saeed Bin Hamad Trading Establishment", "Saeed B. Hamad Trading Est."]]) fort(a!, b!);
  /* Karim et Hakim sont deux noms, et le conflit de filiation se lit toujours sur le genre */
  sousLeFort("Abdelkarim Tahar Logistique", "Abdelhakim Tahar Logistique");
  sousLeFort("Bint Al Nakhuda Trading", "Ibn Al Nakhuda Trading");
});

test("tour 10, arabe-français : les marqueurs, l'établissement du Golfe, les villes d'Iran, les prénoms ; Iyer et ses graphies ; le ou français en tête", () => {
  for (const nom of ["Toufic Haddad Est.", "Ebrahim Alhosani Establishment", "Youssef Chaouki Négoce", "Hosseini Kashani Trading Co.",
    "Mohamed Lamine Ould Brahim Transit", "Sidi Bouzid Agro"]) assert.ok(analyserEntite(nom).arabe, `${nom} doit être marqué arabe`);
  for (const nom of ["Nord Est Logistique", "Blue Star Shipping", "Hekmat Zoghbi & Co.", "Ouahbi Lahlou Négoce"]) assert.ok(!analyserEntite(nom).arabe, `${nom} ne doit pas être marqué arabe`);
  assert.deepEqual(mots("Ebrahim Alhosani Establishment"), ["ebrahim", "al", "hosani"], "l'article collé se détache sous la forme du Golfe");
  /* Iyer, Iyar, Aiyar : une graphie (GRAPHIES_INDIENNES), sans marque */
  assert.deepEqual(mots("Iyar & Subramaniam Exports"), mots("Iyer & Subramaniam Exports"));
  fort("Iyer & Subramaniam Exports", "Iyar & Subramaniam Exports");
  /* le w que le français écrit ou devant une voyelle, en tête de mot : lu au squelette, sans marque */
  assert.equal(squelette("ouahbi"), squelette("wahbi"));
  assert.equal(squelette("ouest"), squelette("west"));
  assert.equal(squelette("louis"), squelette("luis"), "à l'intérieur du mot, ou reste u");
  assert.notEqual(squelette("ouyang").slice(0, 1), "v", "Ouyang est chinois");
  fort("Ouahbi Lahlou Négoce", "Wahbi Lahlou Negoce");
  /* la particule sautée n'est pas un mot en plus : le bloc lit « autoparts » */
  fort("khalfan muhannadi autoparts", "Khalfan Al Muhannadi Auto Parts");
});

test("tour 10, arabe-français : ce qui reste hors de portée, mesuré (négoce, deux maisons sans marqueur, le natif)", () => {
  /* « négoce » n'est pas traduit : deux maisons que l'auteur tient à part le seraient devenues une (voir TRADUCTIONS) */
  sousLeFort("Benabdallah Trading Co", "Ben Abdallah Négoce");
  sousLeFort("El Tayeb Trading (Khartoum)", "Ettayeb Négoce (Khartoum)");
  assert.ok(score("Youssef Chaouki Négoce", "Yusuf Shawqi Trading") < FORT, "le prix de négoce non traduit");
  /* les graphies maghrébines que l'auteur tient à part restent où elles étaient */
  assert.ok(mots("Elfassi Textiles SARL").includes("elfassi"));
  /* aucun marqueur d'aucun côté : les voyelles restent des voyelles */
  sousLeFort("Hekmat Zoghbi & Co.", "Hikmat Zughbi and Company");
});
