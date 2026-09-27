/**
 * TOUR 12, VOIE NAVIRES-LETTRE : la lettre changée d'un nom de navire. Sous la marque navire, deux mots à une lettre
 * près qu'aucune marque n'explique sont deux coques (le plafond du possible), quand la lettre qu'une marque explique
 * (le jalon d'une lecture optique, un pli de romanisation, le crédit d'un clavardage) reste une faute. Chaque règle
 * a la paire qui l'a motivée et la vraie paire qu'elle ne doit pas perdre.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreNoms, lettreChangee, analyserEntite, PERDU } from "./entites.ts";
import { frequencesDesListes } from "./frequences.ts";

const f = frequencesDesListes();
const score = (a: string, b: string) => scoreNoms(f, a, b);
const FORT = 0.81;
const POSSIBLE = 0.80;

test("lettreChangee : une substitution, une lettre en plus ou en moins ; ni transposition, ni doublement, ni pluriel, ni chiffre", () => {
  assert.ok(lettreChangee("forcados", "forcardos"), "une lettre en plus");
  assert.ok(lettreChangee("esperanca", "esperance"), "une lettre substituée");
  assert.ok(lettreChangee("real", "reale"), "une lettre finale en plus");
  assert.ok(!lettreChangee("lindholm", "lindhlom"), "deux lettres inversées : la signature d'une faute de frappe");
  assert.ok(!lettreChangee("ashwara", "ashwarra"), "une lettre doublée : la signature d'une faute de frappe");
  assert.ok(!lettreChangee("star", "stars"), "le pluriel a sa règle");
  assert.ok(!lettreChangee("2024", "2025"), "un numéro a sa règle");
  assert.ok(!lettreChangee("kemuning", "kemuning"), "le même mot");
});

test("sous la marque navire, une lettre en plus dans un mot est une autre coque : MT Forcados Wind / MT Forcardos Wind (0,889 avant)", () => {
  assert.ok(score("MT Forcados Wind", "MT Forcardos Wind") <= POSSIBLE);
  /* la même lettre sans aucune marque de navire reste la faute de frappe qu'elle était : la règle ne parle que des coques */
  assert.ok(score("Forcados Wind Ltd", "Forcardos Wind Ltd") > POSSIBLE, "hors de la marque navire, la signature d'une lettre tombée lève encore le plafond");
});

test("la lettre qu'une marque explique reste une faute : le jalon optique, le pli arabe, le crédit d'un clavardage", () => {
  assert.ok(score("MT C0RAL KEMUN1NG", "MT Coral Kemuning") >= FORT, "le 1 lu optiquement vaut un i");
  assert.ok(score("MV Nakhoda Salim", "M.V. Nakhuda Saleem") >= FORT, "o et u sous la marque arabe");
  assert.ok(score("MV Halyard Dawn", "MV HALYARO DAWN") >= FORT, "un mot du dictionnaire face à un mot inconnu à une lettre près : la faute d'un clavardage (jeu 5)");
  assert.ok(score("M/T Rimal Al Qirmaz", "MT RIMAL EL KIRMAZ") >= FORT, "q et k au squelette");
});

test("le e final que le squelette tait : N/M Cajueiro Real / N/M Cajueiro Reale (0,955 avant), sans perdre deux mots inconnus au même squelette", () => {
  assert.ok(score("N/M Cajueiro Real", "N/M Cajueiro Reale") <= POSSIBLE, "un mot du dictionnaire et une lettre finale qu'il ne connaît plus : une autre coque");
  assert.ok(score("MV Zolotaya Ryba", "MV Zolotaja Ryba") >= FORT, "y et j au squelette, deux mots inconnus : le même navire (jeu 8)");
  assert.ok(score("MV Cheonji Star", "MV Ch'ŏnji Star") >= FORT, "eo et o au squelette, deux mots inconnus : le même navire (jeu 8)");
});

test("le « ? » en fin de mot derrière deux capitales est une lettre perdue : MT GOLFO DE CHIRIQU? / M/T Golfo de Chiriquí (0,874 avant)", () => {
  assert.ok(analyserEntite("MT GOLFO DE CHIRIQU?").texte.includes(PERDU), "le jalon est posé");
  assert.ok(score("MT GOLFO DE CHIRIQU?", "M/T Golfo de Chiriquí") >= FORT);
  /* derrière une minuscule, c'est la question d'un clavardage : une ponctuation, comme avant */
  assert.ok(!analyserEntite("Golfo de Chiriqui?").texte.includes(PERDU), "pas de jalon derrière une minuscule");
  assert.ok(!analyserEntite("BG BAHARI MUTIARA 12?").texte.includes(PERDU), "pas de jalon derrière un chiffre");
  /* la forme abîmée reste complétée avant, et le jalon au milieu d'un mot reste ce qu'il était */
  assert.ok(score("QAMAR UL ISLAM SURGICAL INSTRUMENTS (PVT) LT?", "Qamar ul Islam Surgical Instruments (Pvt) Ltd") >= FORT);
  assert.ok(score("MV SE?ORA DEL CARMEN", "MV Señora del Carmen") >= FORT);
});
