/**
 * TOUR 12, VOIE LOCALE : ce que le jeu 16 a appris (l'Afrique de l'Ouest francophone et le Brésil sur les documents). Chaque
 * règle gardée a ici la paire qui l'a motivée ; les scores sont ceux de la méthode entière, au seuil FORT de 0,81 et au
 * plafond POSSIBLE de 0,80. Le jeu 16 est en apprentissage : rien ici ne vaut verdict.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreNoms, variantes, decollerLAdresse } from "./entites.ts";
import { frequencesDesListes } from "./frequences.ts";

const f = frequencesDesListes();
const score = (a: string, b: string) => scoreNoms(f, a, b);
const FORT = 0.81;

test("tour 12 : l'adresse collée au dernier mot d'un export en capitales, la ville, la rue, l'État", () => {
  assert.equal(decollerLAdresse("ETS KONE ET FRERESABIDJAN"), "ETS KONE ET FRERES");
  assert.equal(decollerLAdresse("FRIGORIFICO WERNER SCHMIDTRUA15"), "FRIGORIFICO WERNER SCHMIDT");
  assert.equal(decollerLAdresse("IMPORTADORA TANAKASANTOS SP"), "IMPORTADORA TANAKA");
  assert.equal(decollerLAdresse("ETS BAH COMMERCEROUTE DE KATI"), "ETS BAH COMMERCE");
  assert.equal(decollerLAdresse("ETS ABOU KHALIL ET FILSPORT BOUET"), "ETS ABOU KHALIL ET FILS");
  assert.equal(decollerLAdresse("NEWCASTLE BULK TERMINAL"), "NEWCASTLE BULK TERMINAL", "une ville en tête ou entière n'est pas une adresse collée");
  for (const [a, b] of [
    ["ETS KONE ET FRERESABIDJAN", "ETS KONE ET FRERES"], ["IMPORTADORA TANAKASANTOS SP", "IMPORTADORA TANAKA"], ["FRIGORIFICO WERNER SCHMIDTRUA15", "FRIGORIFICO WERNER SCHMIDT"],
  ] as const) assert.ok(score(a, b) >= FORT, `${a} / ${b} : ${score(a, b).toFixed(3)}`);
});

test("tour 12 : les jetons collés par leur casse, le D' en capitales, l'élision sans apostrophe", () => {
  assert.ok(variantes("EtsAbouKhalil etFils").includes("Ets Abou Khalil et Fils"));
  assert.ok(!variantes("Hoffmann Handelsgesellschaft mbH & Co. KG").some((v) => v.includes("mb H")), "mbH n'est pas coupé (le conflit GmbH / KG en dépendait, 29/09)");
  assert.ok(variantes("M/V ESPOIR D'ABIDJAN").includes("M/V ESPOIR ABIDJAN"));
  for (const [a, b] of [
    ["Ets Abou Khalil et Fils", "EtsAbouKhalil etFils"], ["MV Espoir d'Abidjan", "M/V ESPOIR D'ABIDJAN"], ["D'Angelo Trading", "D'ANGELO TRADING"],
    ["Cie Sénégalaise d'Import-Export", "Cie Senegalaise dImport Export"], ["STE SENEGALAISE D IMPORT EXPORT", "SOCIETE SENEGALAISE D'IMPORT-EXPORT"],
  ] as const) assert.ok(score(a, b) >= FORT, `${a} / ${b} : ${score(a, b).toFixed(3)}`);
});

test("tour 12 : l'optique (l pour I, 4 pour a), la lettre doublée, le compte et le RCCM, la taille brésilienne, NM", () => {
  for (const [a, b] of [
    ["Cie Ivoirienne du Cajou", "Cie lvoirienne du Cajou"], ["Taizhou Lübang Sanitary Ware Co., Ltd.", "Taizhou Lvbang Sanitary Ware Co., Ltd."],
    ["Curtume Fontanelli", "Curtume Font4nelli"], ["Comercio de Graos Rossetti", "Comercioo de Graos Rossetti"],
    ["CPTE NO 4455 ETS OUATTARA ET CIE", "ETS OUATTARA ET CIE"], ["SARL BAMAKO NEGOCE/RCCM ML BKO 2015", "SARL BAMAKO NEGOCE"],
    ["Curtume Bianchi Ltda - ME", "Curtume Bianchi Ltda"], ["N/M Cajueiro Atlântico", "NM Cajueiro Atlântico"],
  ] as const) assert.ok(score(a, b) >= FORT, `${a} / ${b} : ${score(a, b).toFixed(3)}`);
});

test("tour 12 : la mention de succursale en portugais, espagnol et français, derrière un tiret ou entre parenthèses", () => {
  for (const [a, b] of [
    ["Comercial del Sur S.A. - Depósito de Salta", "Comercial del Sur S.A."], ["Comércio de Soja Weissmann Ltda", "Comércio de Soja Weissmann Ltda - Agência de Cascavel"],
    ["Ets Sanogo et Traoré - Point de vente de Ségou", "Ets Sanogo et Traoré"], ["Groupe Camerounais du Cacao (Bureau de Douala)", "Groupe Camerounais du Cacao"],
    ["Société Malienne du Bétail (Succursale de Sikasso)", "Société Malienne du Bétail"],
  ] as const) assert.ok(score(a, b) >= FORT, `${a} / ${b} : ${score(a, b).toFixed(3)} (mesuré à 0,800 avant)`);
  assert.ok(score("Quarnby Logistics (Shanghai)", "Quarnby Logistics") <= 0.80, "la ville seule entre parenthèses reste une filiale");
});
