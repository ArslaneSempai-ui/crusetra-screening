/**
 * TOUR 9, VOIE ROMANISATIONS : les graphies latines d'un même nom sous deux conventions (jeu 13). Chaque règle gardée a ici la
 * paire qui l'a motivée ; les scores sont ceux de la méthode entière, au seuil FORT de 0,81 et au plafond POSSIBLE de 0,80.
 * Le jeu 13 est en apprentissage : rien ici ne vaut verdict.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  scoreNoms, preparerEntite, analyserEntite, preparerNom, lecturesDe, squeletteArabe, clesSlaves, memeSuiteCyrillique, pliSlave, pliThai,
} from "./entites.ts";
import { GRAPHIES_INDIENNES } from "./indien.ts";
import { frequencesDesListes } from "./frequences.ts";

const f = frequencesDesListes();
const score = (a: string, b: string) => scoreNoms(f, a, b);
const mots = (n: string) => { const l = lecturesDe(n)[0]!; return preparerNom(f, l.texte, l.lecture).mots; };
const FORT = 0.81;
const fort = (a: string, b: string) => assert.ok(score(a, b) >= FORT, `${a} / ${b} : ${score(a, b).toFixed(3)} (fort attendu)`);
const sousLeFort = (a: string, b: string) => assert.ok(score(a, b) < FORT, `${a} / ${b} : ${score(a, b).toFixed(3)} (sous le fort attendu)`);

test("tour 9, romanisations : le patronyme bengali, le clan du nord et la ville du Raj sont une graphie (GRAPHIES_INDIENNES)", () => {
  assert.equal(preparerEntite("Bandyopadhyay Trading House"), preparerEntite("Banerjee Trading House"));
  assert.equal(preparerEntite("Kaveri Nandan Castings Pvt Ltd"), preparerEntite("Cauvery Nandan Castings Pvt Ltd"));
  for (const [a, b] of [["Bandyopadhyay Trading House", "Banerjee Trading House"], ["Chatterjee Iron & Steel Traders", "Chattopadhyay Iron & Steel Traders"],
    ["Rathore Marble Industries", "Rathod Marble Industries"], ["Kaveri Nandan Castings Pvt Ltd", "Cauvery Nandan Castings Pvt Ltd"],
    ["Mukhopadhyay & Sons", "Mukherjee & Sons"], ["Bombay Dyeing Co", "Mumbai Dyeing Co"]]) fort(a!, b!);
  /* la table ne se boucle pas : chaque forme retenue est absente des clés */
  for (const v of new Set(GRAPHIES_INDIENNES.values())) assert.ok(!GRAPHIES_INDIENNES.has(v), `${v} est à la fois clé et forme retenue`);
  /* Tiwari et Tripathi sont deux patronymes : la limite, mesurée à 0,615 le 28/09 */
  sousLeFort("Tiwari Grain Traders", "Tripathi Grain Traders");
});

test("tour 9, romanisations : l'article arabe collé se détache, les mots du commerce se lisent sous leurs voyelles, bawabat est gate", () => {
  assert.deepEqual(mots("Moassasat Shehab Aldeeb Altejaria"), ["shehab", "al", "deeb", "al", "trading"]);
  /* un mot que le dictionnaire connaît ne se coupe pas, même sous un nom arabe */
  assert.ok(mots("Al Noor Alliance Trading").includes("alliance"));
  /* sans marqueur arabe, rien ne se coupe : « Elfassi » reste entier */
  assert.ok(mots("Elfassi Textiles SARL").includes("elfassi"));
  assert.deepEqual(mots("Mu'assasat Bawabat Najd lil-Muqawalat"), ["gate", "najd", "contracting"]);
  fort("Muassasat Shihab Al Dheeb Al Tijariya", "Moassasat Shehab Aldeeb Altejaria");
  fort("Mu'assasat Bawabat Najd lil-Muqawalat", "Najd Gate Contracting Est.");
});

test("tour 9, romanisations : sous la marque arabe, o et u sont une lettre, le p persan un f, et le mot après l'article est arabe", () => {
  for (const [a, b] of [["nour", "noor"], ["noor", "nur"], ["kohsar", "koohsar"], ["khuzama", "khozama"], ["sepid", "sefid"], ["pars", "fars"]]) {
    assert.equal(squeletteArabe(a!), squeletteArabe(b!), `${a} / ${b}`);
  }
  /* ce que le squelette arabe ne fond pas : b et f, a et i */
  assert.notEqual(squeletteArabe("bahr"), squeletteArabe("fahr"));
  assert.notEqual(squeletteArabe("hamad"), squeletteArabe("hamid"));
  for (const [a, b] of [["Nour El Khuzama", "Noor Al Khozama"], ["SEPID KOHSAR", "SEFID KOOHSAR"], ["AL AMEEN SHIPPING LTD", "Al-Amin Shipping Limited"],
    ["Nujoom Al Rimalah", "Nojoum Al Rimala"]]) fort(a!, b!);
  /* deux mots du dictionnaire restent deux mots loin de l'article (Green, Grin), et b n'est pas f */
  sousLeFort("Al Salam Green Trading", "Al Salam Grin Trading");
  sousLeFort("Al Bahr Trading", "Al Fahr Trading");
  sousLeFort("Hamad Al Saud Trading", "Hamid Al Saud Trading");
});

test("tour 9, romanisations : la romanisation allemande du cyrillique est une clé de plus du pli slave, et -tekhnika marque slave", () => {
  assert.ok(clesSlaves("sawod").includes(pliSlave("zavod")), "Sawod est Завод");
  assert.ok(clesSlaves("chimtechnika").includes(pliSlave("khimtekhnika")), "Chimtechnika est Химтехника");
  assert.deepEqual(clesSlaves("werbodolskyj"), [pliSlave("verbodolskyi")], "sans lettre propre au système, la seule clé standard");
  for (const [a, b] of [["puschkin", "pushkin"], ["kasan", "kazan"], ["saporoschje", "zaporozhye"], ["tschaikowski", "chaikovskiy"]]) {
    assert.ok(memeSuiteCyrillique(a!, b!), `${a} / ${b}`);
  }
  /* ce que les clés ne confondent pas : deux lieux, et le s initial sans autre trace allemande */
  assert.ok(!memeSuiteCyrillique("rostov", "rostok"));
  assert.ok(!memeSuiteCyrillique("sever", "zever"));
  assert.ok(analyserEntite("Chimtechnika").slave && analyserEntite("Khimtekhnika").slave, "la queue -tekhnika marque slave");
  fort("Khimtekhnika", "Chimtechnika");
  fort("PrAT Verbodolskyi Kabelnyi Zavod", "PrAT Werbodolskyj Kabelnyj Sawod");
  assert.ok(mots("PrAT Werbodolskyj Kabelnyj Sawod").includes("plant"), "Sawod se traduit comme zavod");
  sousLeFort("Zhukov Marine OOO", "Shukov Marine OOO");
});

test("tour 9, romanisations : le thaï en RTGS et en graphie d'usage est un mot sous la marque thaïe seulement", () => {
  for (const [a, b] of [["phrachan", "prajan"], ["ngoen", "ngern"], ["charoenphol", "charoenpol"], ["wichai", "vichai"], ["porn", "phon"],
    ["kaew", "kaeo"], ["soemsuk", "sermsuk"], ["witthaya", "wittaya"]]) assert.equal(pliThai(a!), pliThai(b!), `${a} / ${b}`);
  assert.notEqual(pliThai("thong"), pliThai("thang"));
  for (const nom of ["Phrachan Ngoen", "Bangkok Rungreung Food Co., Ltd.", "Samut Sakhon Chaiyaphruek Frozen Food Co., Ltd.", "บริษัท สยามโชคชัย กรุ๊ป จำกัด"]) {
    assert.ok(analyserEntite(nom).thai, `${nom} doit être marqué thaï`);
  }
  for (const nom of ["Blue Star Shipping", "Prajan Ngern", "Nguyen Van Duc Export Co."]) assert.ok(!analyserEntite(nom).thai, `${nom} ne doit pas être marqué thaï`);
  fort("Phrachan Ngoen", "Prajan Ngern");
  fort("Kittiwat Charoenphol Industry Co., Ltd.", "Kittiwat Charoenpol Industry Co., Ltd.");
  /* sans la marque (aucun ph devant r, aucun marqueur), le pli ne s'ouvre pas */
  sousLeFort("Prajan Ngern Trading", "Prachan Ngoen Trading");
});
