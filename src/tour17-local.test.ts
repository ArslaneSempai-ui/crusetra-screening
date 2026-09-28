/**
 * TOUR 17, VOIE LOCALE : les résidus latins des documents de Haïfa et de Tbilissi (jeu 21). Le compte en tête derrière une
 * barre, le pays nu et l'adresse du Caucase derrière la forme, les numéros de registre en écriture native (ՀՎՀՀ, ს/კ, ח.פ.,
 * شماره ثبت), la société par actions iranienne (PJS, sahami khas), les ports de la mer Noire et du Levant derrière un navire
 * numéroté ou préfixé, en toute casse.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreNoms, variantes } from "./entites.ts";
import { frequencesDesListes } from "./frequences.ts";

const f = frequencesDesListes();
const score = (a: string, b: string) => scoreNoms(f, a, b);
const FORT = 0.81;
const POSSIBLE = 0.80;

test("tour 17 : les résidus du jeu 21 que les tables étendues font passer au fort", () => {
  for (const [a, b] of [
    ["/0012345678 GIDEON PELEG FWD LTD", "Gideon Peleg Forwarding Ltd"],
    ["/40702810 TEVOSYAN AGRO TRADE LLC", "Tevosyan Agro Trade LLC"],
    ["/0011223344 MOMBASA COCONUT OIL REFINERS LTD P O BOX 90123 MOMBASA KENYA", "Mombasa Coconut Oil Refiners Limited"],
    ["AVETISYAN PHARM LLC ARMENIA", "Avetisyan Pharm LLC"],
    ["LCHASHEN FISH PROCESSING CJSC14 NAIRI STR GAVAR AM", "Lchashen Fish Processing CJSC"],
    ["MAMISTVALOV TEXTILES LTD HAIFA", "Mamistvalov Textiles Ltd"],
    ["Nasim-e Shomal Trading Co. PJS", "Nasim Shomal Trading Company (Sahami Khas)"],
    ["EUXINE PORTER", "M/V EUXINE PORTER Batumi"],
    ["GALIM SHUTTLE 3 (Ashdod)", "Galim Shuttle 3"],
    ["KOLKHETI FEEDER 6 (Poti)", "Kolkheti Feeder 6"],
    ["MV ZOHAR BAY Ashdod", "Zohar Bay"],
  ] as const) assert.ok(score(a, b) >= FORT, `${a} / ${b} : ${score(a, b).toFixed(3)}`);
  /* le numéro de registre natif est lu comme tel : la variante sans lui existe, et le numéro est porté */
  assert.ok(variantes("שמרון אריזות בע\"מ ח.פ. 513904826").some((v) => !/513904826/.test(v)));
  assert.ok(variantes("«Մելքոնյան Կոնսալթ» ՍՊԸ ՀՎՀՀ 02581473").some((v) => !/02581473/.test(v)));
  assert.ok(variantes("შპს ღოღობერიძე ტრეიდი ს/კ 404871236").some((v) => !/404871236/.test(v)));
});

test("tour 17 : ce que les règles de port ne touchent pas, et les limites connues du jeu 21", () => {
  /* un port nu derrière un navire préfixé d'UN mot n'est pas retiré : « MV OCEAN BOSTON » garde Boston */
  assert.ok(!variantes("MV OCEAN BOSTON").includes("MV OCEAN"));
  /* la société entre parenthèses garde sa ville : une filiale, pas un port d'attache */
  assert.ok(!variantes("Quarnby Logistics (Batumi)").includes("Quarnby Logistics"));
  /* limites connues (doc/LIMITES.md, jeu 21) : le navire nu au pluriel ou à une lettre, le nom propre court à une lettre près */
  assert.ok(score("RIONI TRADER", "RIONI TRADERS") >= FORT);
  assert.equal(score("Elkayam Timber Ltd", "Elkayan Timber Ltd"), POSSIBLE);
});
