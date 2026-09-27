/**
 * TOUR 10, VOIE LOCALE : ce que le jeu 14 a appris (les barges du Rhin, les abréviations néerlandaises, la filiation
 * ordonnée). Chaque règle gardée a ici la paire qui l'a motivée ; les scores sont ceux de la méthode entière, au seuil
 * FORT de 0,81 et au plafond POSSIBLE de 0,80. Le jeu 14 est en apprentissage : rien ici ne vaut verdict.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreNoms, analyserEntite, variantes } from "./entites.ts";
import { frequencesDesListes } from "./frequences.ts";

const f = frequencesDesListes();
const score = (a: string, b: string) => scoreNoms(f, a, b);
const FORT = 0.81;
const POSSIBLE = 0.80;

test("tour 10 : les barges du Rhin, leur préfixe, leur type, leur numéro ENI et leur port d'attache", () => {
  assert.ok(variantes("Lekstern (ENI 02325518)").includes("Lekstern"), "le numéro ENI est une annotation");
  assert.ok(variantes("Lekstern, Werkendam").includes("Lekstern"), "le port d'attache seul derrière la virgule");
  assert.ok(variantes("IJsselkwak (Kampen)").includes("IJsselkwak"), "le port d'attache entre parenthèses");
  assert.ok(!variantes("Lekstern, Terpenland").includes("Lekstern"), "un mot inconnu derrière la virgule n'est pas un port d'attache");
  assert.equal(analyserEntite("Duwbak Rijnreus 71").typeNavire, "barge");
  assert.equal(analyserEntite("Rijnreus 7 (duwboot)").typeNavire, "tug");
  for (const [a, b] of [
    ["GMS IJsselkwak", "IJsselkwak (Kampen)"], ["TMS Waalpluvier ENI 02331457", "Waalpluvier"], ["Dintelreiger - Rotterdam", "Dintelreiger"],
    ["Merwedekoet, Dordrecht", "MTS Merwedekoet"], ["Duwbak Rijnreus 71", "Rijnreus 71"], ["Stroomkracht 4", "Duwboot Stroomkracht IV"],
    ["Waalpluvier (ex Vlietzwaluw)", "TMS Waalpluvier"],
  ] as const) assert.ok(score(a, b) >= FORT, `${a} / ${b} : ${score(a, b).toFixed(3)} (mesuré entre 0,464 et 0,667 avant)`);
  assert.ok(score("MTS Rijnkrekel", "MTS Rijnkrekels") <= POSSIBLE, "dans un nom de navire, le pluriel de tout mot est une autre coque (0,818 avant)");
});

test("tour 10 : les abréviations à point d'un nom néerlandais, et ses génériques", () => {
  for (const [a, b] of [
    ["Int. Exp. Mij. Zuidervliet B.V.", "Internationale Expeditie Maatschappij Zuidervliet B.V."],
    ["Internat. Expeditiemij. Zuidervliet", "Internationale Expeditie Maatschappij Zuidervliet B.V."],
    ["Wed. J. Veldbraak & Zn.", "Weduwe J. Veldbraak en Zonen"], ["Gebr. Kleinhekking Transp.", "Gebroeders Kleinhekking Transport"],
    ["Hand. Wijnbergen-Posthuma", "Handelsonderneming Wijnbergen-Posthuma"], ["Scheepv. Mij. Oostervliet", "Scheepvaartmaatschappij Oostervliet"],
    ["Alg. Transp. Mij. Noordervliet", "Algemene Transportmaatschappij Noordervliet"],
    ["Van der Meulenhoek Agrotrade B.V.", "V.d. Meulenhoek Agrotrade BV"], ["Süddeutsche Kunststoffwerke Riedlinger GmbH", "Sueddt. Kunststoffwerke Riedlinger GmbH"],
    ["COÖPERATIEVE ZUIVELHANDEL TERPENLAND U.A. T.A.V. CREDITEURENADMINISTRATIE", "Coöperatieve Zuivelhandel Terpenland U.A."],
    ["Terbraak Logistiek B.V.", "Terbraak Logistics B.V."], ["Hunan Xiangtan Ruilong Heavy Industry Co., Ltd.", "Hunan Xiangtan Ruilong Hvy Ind Co Ltd"],
  ] as const) assert.ok(score(a, b) >= FORT, `${a} / ${b} : ${score(a, b).toFixed(3)}`);
  assert.ok(score("Guangzhou Fengyuan Imp. & Exp. Co., Ltd.", "GUANGZHOUFENGYUANIMPEXP") >= FORT, "hors du néerlandais, « Exp. » reste l'export");
});

test("tour 10 : la filiation ordonnée, le fils de l'un étant le père de l'autre", () => {
  assert.equal(analyserEntite("Hakim Ben Youssef Import").filiationOrdre, "hakim>youssef");
  assert.equal(analyserEntite("Yusof Abdullah Trading").filiationOrdre, "");
  for (const [a, b] of [
    ["Hakim Ben Youssef Import", "Youssef Ben Hakim Import"], ["Saeed bin Hamdan Al Qaddouri Trading", "Hamdan bin Saeed Al Qaddouri Trading"],
    ["Sidi Mohamed Ould Ahmed Transport", "Sidi Ahmed Ould Mohamed Transport"],
  ] as const) assert.ok(score(a, b) <= POSSIBLE, `${a} / ${b} : ${score(a, b).toFixed(3)} (mesuré à 1,000 avant)`);
  assert.ok(score("Yusof bin Abdullah Trading", "Yusof Abdullah Trading") >= FORT, "la particule omise d'un côté ne perd rien");
  assert.ok(score("Saeed bin Hamdan Trading", "Said bin Hamdan Trading") >= FORT, "une graphie du fils n'inverse rien");
});
