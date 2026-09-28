/**
 * TOUR 15, VOIE LOCALE (régime réduit) : les résidus latins des documents d'Osaka et de Busan (jeu 19). Chaque règle gardée
 * a ici la paire qui l'a motivée ; les scores sont ceux de la méthode entière, au seuil FORT de 0,81 et au plafond POSSIBLE
 * de 0,80. Le jeu 19 est en apprentissage : rien ici ne vaut verdict.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreNoms, variantes } from "./entites.ts";
import { frequencesDesListes } from "./frequences.ts";

const f = frequencesDesListes();
const score = (a: string, b: string) => scoreNoms(f, a, b);
const FORT = 0.81;
const POSSIBLE = 0.80;

test("tour 15 : le port d'attache derrière un nom de navire nu, entre parenthèses ou nu, jamais derrière une société", () => {
  assert.ok(variantes("Shirane Glory (Kobe)").includes("Shirane Glory"));
  assert.ok(variantes("M/T Tsuyukusa Crest (Kobe)").includes("M/T Tsuyukusa Crest"));
  assert.ok(variantes("TAKANAMI STAR ULSAN").includes("TAKANAMI STAR"));
  assert.ok(variantes("KIRISAMEMARU KOBE").includes("KIRISAME MARU"), "le maru collé, puis le port");
  assert.ok(!variantes("Quarnby Logistics (Shanghai)").includes("Quarnby Logistics"), "un mot du commerce fait une société : la ville est une filiale");
  for (const [a, b] of [
    ["Ferry Mizu Kagami", "Ferry Mizukagami (Kobe)"], ["EUNPA HO BUSAN", "Eunpa Ho"], ["M/T Tsuyukusa Crest (Kobe)", "Tsuyukusa Crest"],
    ["Shirane Glory (Kobe)", "Shirane Glory"], ["TAKANAMI STAR ULSAN", "Takanami Star"], ["KIRISAMEMARU KOBE", "Kirisame Maru"],
  ] as const) assert.ok(score(a, b) >= FORT, `${a} / ${b} : ${score(a, b).toFixed(3)}`);
  assert.ok(score("Quarnby Logistics (Shanghai)", "Quarnby Logistics") <= POSSIBLE);
});

test("tour 15 : le BRN coréen, l'adresse collée à la forme, l'usine et l'agence sans tiret, le ho devant le numéro, PCTC", () => {
  assert.ok(variantes("KAMITSURU BOEKI KK3-5-12 KITAHAMA CHUO-KU OSAKA").includes("KAMITSURU BOEKI KK"));
  assert.ok(variantes("Garam Cheolgang Co., Ltd. BRN 214-86-53907").includes("Garam Cheolgang Co., Ltd."));
  assert.ok(variantes("GEUMNAE HWAHAK CO LTD ULSAN PLANT").includes("GEUMNAE HWAHAK CO LTD"));
  for (const [a, b] of [
    ["Garam Cheolgang Co., Ltd. BRN 214-86-53907", "Garam Cheolgang Co., Ltd."], ["Yongdu No. 7", "Yongdu Ho No. 7"], ["PCTC Umisachi Ace", "Umisachi Ace"],
    ["GEUMNAE HWAHAK CO LTD ULSAN PLANT", "GEUMNAE HWAHAK CO LTD"], ["KAMITSURU BOEKI KK3-5-12 KITAHAMA CHUO-KU OSAKA", "Kamitsuru Boeki Co., Ltd."],
    ["Hyorim Logistics Co., Ltd. Ulsan Branch", "Hyorim Logistics Co., Ltd."],
  ] as const) assert.ok(score(a, b) >= FORT, `${a} / ${b} : ${score(a, b).toFixed(3)}`);
  assert.ok(score("0ZKAYA NAKL1YAT LTD. ST1.", "Özkaya Nakliyat Ltd. Şti.") >= FORT, "STL comme abréviation cassait la forme optique ST1 : retiré le 29/09");
});

test("tour 15 : l'abréviation sans point n'est crue que d'un mot courant, jamais d'un nom propre (livre de mille contreparties)", () => {
  /* « LST » retrouvait ses trois lettres dans « Lieselotte » : 14 des 20 possibles du livre de mille étaient un navire
     d'un seul mot face à un sigle de trois lettres. Un mot courant abrégé (Invst, Srvcs, Vsl Ops, Inds, Fwd) reste fort. */
  for (const [a, b] of [
    ["Lieselotte", "LST LTD"], ["Lahnstein", "LST LTD"], ["Lingestroom", "LST LTD"], ["Aarestern", "Aktsionernoe Obshchestvo AST"],
    ["Andromachi", "ARCH COMPANY"], ["Roerstreek", "JOINT STOCK COMPANY RSK"], ["Samothraki", "AO SRK"], ["Veluwezoom", "AO VZM"],
    ["Pelješac", "PSC"],
  ] as const) assert.ok(score(a, b) < POSSIBLE, `${a} / ${b} : ${score(a, b).toFixed(3)}`);
  for (const [a, b] of [
    ["Kibet Invst Ltd", "Kibet Investments Ltd"], ["Shaheen Bahri Marine Srvcs", "Shaheen Bahri Marine Services"],
    ["Cape Route Vsl Ops Ltd", "Cape Route Vessel Operators Limited"], ["Oduya Agro Allied Inds Ltd", "Oduya Agro-Allied Industries Limited"],
    ["Bonny Freight Fwd Ltd", "Bonny Freight Forwarders Ltd"],
  ] as const) assert.ok(score(a, b) >= FORT, `${a} / ${b} : ${score(a, b).toFixed(3)}`);
  /* limite connue : un sigle qui COMMENCE le mot (« TRO » / Trondheimsleia, « SCH » / Schokland) reste un possible */
  assert.equal(score("Trondheimsleia", "TRO"), POSSIBLE);
});
