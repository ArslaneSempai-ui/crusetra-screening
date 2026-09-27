/**
 * TOUR 11, VOIE LOCALE : ce que le jeu 15 a appris (l'Afrique de l'Est et le Pakistan sur les documents). Chaque règle
 * gardée a ici la paire qui l'a motivée ; les scores sont ceux de la méthode entière, au seuil FORT de 0,81 et au plafond
 * POSSIBLE de 0,80. Le jeu 15 est en apprentissage : rien ici ne vaut verdict.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreNoms, variantes } from "./entites.ts";
import { frequencesDesListes } from "./frequences.ts";

const f = frequencesDesListes();
const score = (a: string, b: string) => scoreNoms(f, a, b);
const FORT = 0.81;

test("tour 11 : la lettre du pays des registres d'Afrique de l'Est devant la forme, et le Pak du Pakistan", () => {
  for (const [a, b] of [
    ["Patel Hardware (K) Ltd", "Patel Hardware Kenya Ltd"], ["Msasani Fisheries (T) Ltd", "Msasani Fisheries Tanzania Limited"],
    ["Nakasero Pharma (U) Ltd", "Nakasero Pharma Uganda Limited"], ["Shah Bros. (K) Ltd", "Shah Brothers Kenya Limited"],
    ["Pak Hosiery Knitwear (Pvt) Ltd", "Pakistan Hosiery Knitwear (Pvt) Ltd"], ["Hyderabad Bangle Makers (Pvt) Ltd", "Hyderabad Bangle Makers Private Ltd"],
  ] as const) assert.ok(score(a, b) >= FORT, `${a} / ${b} : ${score(a, b).toFixed(3)}`);
  assert.ok(score("Kenya Tea Packers (K) Ltd", "Tanzania Tea Packers (T) Ltd") < FORT, "deux pays, deux sociétés");
  assert.ok(score("Pak Chŏng-su Trading", "Bak Jeong-su Trading") >= FORT, "hors du Pakistan, Pak reste le nom coréen (perdu le 29/09 quand l'abréviation valait partout)");
});

test("tour 11 : les étiquettes d'un paiement mobile et les résidus de registre devant ou derrière le nom", () => {
  assert.ok(variantes("JazzCash: BILAL AUTO PRTS").includes("BILAL AUTO PRTS"));
  assert.ok(variantes("SECP Reg. 0012345 Hyderabad Bangle Makers (Pvt) Ltd").includes("Hyderabad Bangle Makers (Pvt) Ltd"));
  assert.ok(variantes("Muhammad Aslam Traders (CNIC 42101-1234567-1)").includes("Muhammad Aslam Traders"));
  for (const [a, b] of [
    ["Easypaisa acct: Hafiz Ghee Trdrs", "Hafiz Ghee Traders"], ["Till: NJUGUNA HRDWARE", "Njuguna Hardware"], ["JazzCash: BILAL AUTO PRTS", "Bilal Auto Parts"],
    ["SECP Reg. 0012345 Hyderabad Bangle Makers (Pvt) Ltd", "Hyderabad Bangle Makers Private Ltd"],
    ["Muhammad Aslam Traders (CNIC 42101-1234567-1)", "Mohammed Aslam Traders"],
  ] as const) assert.ok(score(a, b) >= FORT, `${a} / ${b} : ${score(a, b).toFixed(3)}`);
});

test("tour 11 : les abréviations d'un clavardage est-africain, la coopérative, le cap d'un navire, le port derrière un préfixe", () => {
  for (const [a, b] of [
    ["MaliyaEnt", "Maliya Enterprises"], ["Mombasa Rd Tyres Ltd", "Mombasa Road Tyres Ltd"], ["Md. Ilyas & Brothers", "Muhammad Ilyas & Bros."],
    ["MUKURWEINI CEREAL GROWERS COOPERATIVE SOC LTD", "Mukurweini Cereal Growers Co-operative Society Limited"],
    ["MV Cap Delgado Trader", "MV Cabo Delgado Trader"], ["Tug Nyati", "Tug Nyati (Mombasa)"], ["A1i Bros Karachi", "Ali Bros Karachi"],
  ] as const) assert.ok(score(a, b) >= FORT, `${a} / ${b} : ${score(a, b).toFixed(3)}`);
  assert.ok(!variantes("Quarnby Logistics (Shanghai)").includes("Quarnby Logistics"), "derrière une raison sociale, la ville entre parenthèses reste une filiale");
});
