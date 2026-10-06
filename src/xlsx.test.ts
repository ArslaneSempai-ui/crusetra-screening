/**
 * LE LECTEUR .XLSX, ÉPROUVÉ SUR DEUX FIXTURES QUI ONT LA FORME RÉELLE DES CLASSEURS (extraites des téléchargements du
 * 05/10/2026 : les mêmes en-têtes, les mêmes styles de date, les chaînes partagées, la légende au-dessus du tableau du
 * MFAT), et sur ce qu'il doit refuser : un fichier qui n'est pas un zip, une feuille qui n'existe plus.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { colonneDe, dateExcel, lireClasseur, ouvrirZip, tableParEntete } from "./xlsx.ts";

const fixture = (n: string) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url));

test("xlsx : la colonne d'une référence, et le numéro de série Excel rendu en date", () => {
  assert.equal(colonneDe("A1"), 0);
  assert.equal(colonneDe("Z9"), 25);
  assert.equal(colonneDe("AA12"), 26);
  assert.equal(dateExcel(45827), "2025-06-19", "la date de sanction des navires du MFAT");
  assert.equal(dateExcel(44638), "2022-03-18");
  assert.equal(dateExcel(61), "1900-03-01", "le système 1900 et son faux 29 février : à partir de 61 les séries sont justes");
});

test("xlsx : le registre du MFAT se lit par en-tête sous sa légende, ses dates deviennent des dates, ses chaînes partagées se résolvent", () => {
  const [registre, navires] = lireClasseur(fixture("mfat.xlsx"), ["Russia Sanctions Register", "Ships"]);
  assert.equal(registre!.lignes[0]!.cellules[0], "Sanction Type", "la légende est au-dessus du tableau, et elle est rendue telle quelle");
  const lignes = tableParEntete(registre!, ["Type", "Unique Identifier", "First name", "Last name"]);
  const putin = lignes.find((l) => l.par("Unique Identifier") === "IND-1")!;
  assert.equal(putin.par("Last name"), "Putin");
  assert.equal(putin.par("Date of Sanction"), "2022-03-18", "un numéro de série au style date devient AAAA-MM-JJ");
  assert.equal(putin.par("DOB"), "1952-10-07");
  assert.equal(putin.par("Colonne absente"), "", "une colonne inconnue se lit vide, elle ne lance pas");
  const ships = tableParEntete(navires!, ["Type", "Unique Identifier", "IMO Number"]);
  assert.deepEqual(ships.map((l) => [l.par("IMO Number"), l.par("Name of Ship as of Date of Sanction"), l.par("Date of Sanction"), l.par("Record Deleted Flag")]),
    [["9288693", "Andaman Skies", "2025-06-19", ""], ["9288746", "Udaya", "2025-06-19", ""], ["9281011", "Moti", "2025-06-19", "Yes"]]);
});

test("xlsx : la feuille du DFAT se lit par position, ses booléens et ses nombres restent des textes", () => {
  const [feuille] = lireClasseur(fixture("dfat.xlsx"), [0]);
  assert.equal(feuille!.nom, "Consolidated List - 2_10_2026", "le nom de la feuille porte la date : on ne la demande pas par son nom");
  const lignes = tableParEntete(feuille!, ["Reference", "Name of Individual or Entity", "Type"]);
  const akhund = lignes[0]!;
  assert.equal(akhund.par("Reference"), "2");
  assert.equal(akhund.par("Control Date"), "2026-04-14");
  assert.equal(akhund.par("Travel Ban"), "TRUE");
  const navire = lignes.find((l) => l.par("Reference") === "8227")!;
  assert.equal(navire.par("IMO Number"), "9288693", "un numéro OMI est un nombre dans le classeur : il reste sept chiffres, pas une date");
});

test("xlsx : ce qui n'est pas un classeur se refuse en le disant, et une feuille disparue nomme celles qui existent", () => {
  assert.throws(() => ouvrirZip(Buffer.from("<html>not a workbook</html>")), /not a zip file/);
  assert.throws(() => lireClasseur(fixture("mfat.xlsx"), ["Vessels"]), /no sheet named "Vessels" \(it has: "Russia Sanctions Register", "Ships"\)/);
  assert.throws(() => lireClasseur(fixture("dfat.xlsx"), [3]), /no sheet at position 3/);
  assert.throws(() => tableParEntete(lireClasseur(fixture("dfat.xlsx"), [0])[0]!, ["Reference", "Colonne qui n'existe pas"]), /no header row with the columns/);
});
