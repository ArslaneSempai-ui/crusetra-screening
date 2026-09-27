/* TOUR 10, VOIE « FORMES » : les formes juridiques du Golfe et du Benelux, et quand deux formes sont deux
   immatriculations (jeu 14, avec des paires plus anciennes des jeux 4, 5 et 13). Chaque règle a ici la paire qui l'a
   motivée, avec le chiffre mesuré avant elle. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  scoreNoms, analyserEntite, marquesEnConflit, numeroDeRegistre, abregeAllemand, pliUmlaut, FREQUENCES_UNIFORMES,
} from "./entites.ts";

const score = (a: string, b: string) => scoreNoms(FREQUENCES_UNIFORMES, a, b);
const m = (n: string) => analyserEntite(n);

test("tour 10, formes : FZE, FZCO et FZ-LLC sont trois immatriculations d'une même zone franche (jeu 14)", () => {
  assert.deepEqual(m("Sadeem Crescent Marine FZE").designations, ["fze"]);
  assert.deepEqual(m("Sadeem Crescent Marine FZCO").designations, ["fzco"]);
  const fzllc = m("Qasr Al Dana Marine Engineering FZ-LLC");
  assert.deepEqual(fzllc.designations, ["fzllc"], "le tiret coupe FZ-LLC en deux jetons : une locution les rejoint");
  assert.deepEqual(fzllc.familles, ["fz"], "la zone franche, pas la LLC continentale");
  for (const [a, b] of [
    ["Sadeem Crescent Marine FZE", "Sadeem Crescent Marine FZCO"],
    ["QASR AL DANA MARINE ENGG FZE", "Qasr Al Dana Marine Engineering FZ-LLC"],
    ["SHIPPER: WEIDENHOF CHEMICALS TRADING FZE, P.O. BOX 262410, JEBEL ALI, DUBAI", "Weidenhof Chemicals Trading FZCO"],
    ["Silver Dune Logistics FZE", "Silver Dune Logistics DMCC"],
    ["Nasmat Tarfa Shipping FZ-LLC", "Nasmat Tarfa Shipping LLC"],
  ]) assert.ok(score(a!, b!) < 0.81, `${a} / ${b} : deux immatriculations, le possible au plus (mesuré à 0,955 et 1,000 avant)`);
  /* la forme en toutes lettres porte la désignation de son sigle */
  for (const [a, b] of [
    ["Sadeem Crescent Marine F.Z.E.", "Sadeem Crescent Marine Free Zone Establishment"],
    ["Burj Sanad Lubricants FZCO", "Burj Sanad Lubricants Free Zone Company"],
    ["Nasmat Tarfa Shipping FZ-LLC", "Nasmat Tarfa Shipping Free Zone Limited Liability Company"],
  ]) assert.equal(score(a!, b!), 1, `${a} / ${b}`);
  assert.equal(m("Nasmat Tarfa Shipping Free Zone Limited Liability Company").texte, "nasmat tarfa shipping", "lue avant la LLC qu'elle contient");
});

test("tour 10, formes : la S.P.C. et la W.L.L. de Bahreïn sont deux immatriculations ; la L.L.C. ne s'oppose à aucune", () => {
  assert.deepEqual(m("Durrat Al Hadeel Trading S.P.C.").designations, ["spc"]);
  assert.deepEqual(m("Ghaymat Sahil Trading W.L.L.").designations, ["wll"]);
  assert.ok(score("Durrat Al Hadeel Trading S.P.C.", "Durrat Al Hadeel Trading W.L.L.") < 0.81, "mesuré à 1,000 avant");
  assert.ok(score("Ghaymat Sahil Trading W.L.L.", "Ghaymat Sahil Trading S.P.C.") < 0.81, "mesuré à 1,000 avant");
  assert.equal(score("Ghaymat Sahil Trading W.L.L.", "Ghaymat Sahil Trading Company With Limited Liability"), 1);
  assert.equal(score("Rimal Horizon Trading W.L.L.", "Rimal Horizon Trading L.L.C."), 1, "la L.L.C. rend aussi la W.L.L. du Koweït et du Qatar");
  assert.equal(marquesEnConflit(m("Rimal Horizon Trading W.L.L."), m("Rimal Horizon Trading L.L.C.")), false);
});

test("tour 10, formes : « Co » et « Corp » sous Pty et Pvt sont deux noms déposés ; ailleurs « Co » ne porte rien", () => {
  assert.deepEqual(m("Trivedi Trading Co Pvt Ltd").designations, ["co"]);
  assert.deepEqual(m("Sawamura Kogyo Co., Ltd.").designations, [], "sans qualificatif privé, Co., Ltd. rend un K.K. comme Corporation");
  assert.ok(score("Trivedi Trading Co Pvt Ltd", "Trivedi Trading Corp Pvt Ltd") < 0.81, "mesuré à 1,000 avant");
  assert.ok(score("Blackwood Cattle Co Pty Ltd", "Blackwood Cattle Corp Pty Ltd") < 0.81, "mesuré à 1,000 avant");
  assert.equal(score("Trivedi Trading Co Pvt Ltd", "Trivedi Trading Pvt Ltd"), 1, "la désignation d'un seul côté ne s'oppose à rien");
  assert.equal(score("Trivedi Trading Co Pvt Ltd", "Trivedi Trading Company Private Limited"), 1);
});

test("tour 10, formes : la forme soudée au nom par un clavardage se détache (« HoornbeekTransportBV », jeu 14)", () => {
  const a = m("HoornbeekTransportBV");
  assert.deepEqual(a.familles, ["llc"]);
  assert.deepEqual(a.pays, ["NL"]);
  assert.equal(a.texte, "hoornbeektransport", "le reste du nom demeure soudé : le bloc le lit");
  assert.ok(score("HoornbeekTransportBV", "Hoornbeek Transport N.V.") < 0.81, "la BV n'est pas la NV ; mesuré à 0,900 avant");
  assert.equal(score("HoornbeekTransportBV", "Hoornbeek Transport B.V."), 1);
  assert.equal(score("CarmichaelExportsPtyLtd", "Carmichael Exports Pty Ltd"), 1);
  assert.deepEqual(m("Vogel Kunststofftechnik GmbH").familles, ["llc"], "la GmbH garde sa casse et n'est pas coupée");
});

test("tour 10, formes : la Belgique, la NV et la SA d'une même société, le numéro KBO, la logistique", () => {
  assert.equal(m("Scheldemond Expédition SA").texte, "scheldemond forwarding", "expédition est expeditie est forwarding");
  assert.ok(score("Scheldemond Expeditie NV", "Scheldemond Expédition SA") >= 0.81, "mesuré à 0,450 avant");
  assert.equal(numeroDeRegistre("Kempenvaart BV (KBO 0712.448.391)"), "0712448391");
  assert.equal(numeroDeRegistre("Kempenvaart BV (BCE BE 0712.448.391)"), "0712448391", "le nom français du registre, et le préfixe de pays");
  assert.ok(score("Kempenvaart BV", "Kempenvaart BV (KBO 0712.448.391)") >= 0.81, "mesuré à 0,667 avant");
  assert.ok(score("Kempenvaart BV (KBO 0712.448.391)", "Kempenvaart BV (KBO 0845.112.907)") < 0.81, "deux numéros, deux dépôts");
  assert.ok(score("Terbraak Logistiek B.V.", "Terbraak Logistics B.V.") >= 0.81, "mesuré à 0,700 avant");
  assert.ok(score("Terbraak Logistiek Venlo B.V.", "Terbraak Logistiek Venray B.V.") < 0.81, "deux lieux restent deux sociétés");
});

test("tour 10, formes : le composé allemand écrit en deux porte son membre traduit (« Holzhandel », « Holz-Handel », jeu 4)", () => {
  assert.equal(m("Drevenka Holz-Handel GmbH").texte, "drevenka holz trading");
  assert.ok(score("Drevenka Holzhandel GmbH", "Drevenka Holz-Handel GmbH") >= 0.81, "mesuré à 0,680 avant");
  assert.ok(score("Van Dijk Metaal-Handel B.V.", "Van Dijk Metaalhandel B.V.") >= 0.81);
  assert.ok(score("Drevenka Holzhandel GmbH", "Drevenka Stahlhandel GmbH") < 0.81, "une autre tête, un autre commerce");
});

test("tour 10, formes : l'abréviation allemande écrite avec son point, l'umlaut écrit ue (« Sueddt. », jeu 5)", () => {
  assert.equal(pliUmlaut("sueddeutsche"), "suddeutsche");
  assert.equal(abregeAllemand("sueddt", "suddeutsche"), true);
  assert.equal(abregeAllemand("norddt", "norddeutsche"), true);
  assert.equal(abregeAllemand("sun", "sunshine"), false, "trois lettres : trop court");
  assert.equal(abregeAllemand("stahl", "steamer"), false, "les lettres ne s'y suivent pas");
  assert.ok(score("Süddeutsche Kunststoffwerke Riedlinger GmbH", "Sueddt. Kunststoffwerke Riedlinger GmbH") >= 0.81, "mesuré à 0,600 avant");
  assert.ok(score("Norddt. Kunststoffwerke Riedlinger GmbH", "Norddeutsche Kunststoffwerke Riedlinger GmbH") >= 0.81);
});
