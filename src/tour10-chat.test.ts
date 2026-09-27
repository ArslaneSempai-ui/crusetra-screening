/**
 * TOUR 10, VOIE CHAT : ce qu'un téléphone fait à un nom (jeu 14). L'arabizi, les chiffres du Golfe lus en lettres ; le
 * patronyme néerlandais dont la finale hésite entre g et k ; le mot que le correcteur a inversé. Chaque règle gardée a ici la
 * paire qui l'a motivée ; les scores sont ceux de la méthode entière, au seuil FORT de 0,81 et au plafond POSSIBLE de 0,80.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreNoms, preparerEntite, analyserEntite, lecturesDe, preparerNom, simMot, squelette, motAutocorrige } from "./entites.ts";
import { lireArabizi } from "./arabizi.ts";
import { frequencesDesListes } from "./frequences.ts";

const f = frequencesDesListes();
const score = (a: string, b: string) => scoreNoms(f, a, b);
const prepare = (n: string) => { const l = lecturesDe(n)[0]!; return preparerNom(f, l.texte, l.lecture); };
const mots = (n: string) => prepare(n).mots;
const FORT = 0.81;
const fort = (a: string, b: string) => assert.ok(score(a, b) >= FORT, `${a} / ${b} : ${score(a, b).toFixed(3)} (fort attendu)`);
const sousLeFort = (a: string, b: string) => assert.ok(score(a, b) < FORT, `${a} / ${b} : ${score(a, b).toFixed(3)} (sous le fort attendu)`);

test("tour 10, chat : les chiffres de l'arabizi se lisent en lettres (lireArabizi)", () => {
  /* la table : 7 h, 3 l'ayn (tombé devant une voyelle, a devant une consonne), 3' gh, 5 kh, 6 t, 9 s, 2 la hamza, 8 q */
  assert.equal(lireArabizi("Mo7ammed Sa3eed Al Hattali Trading", true).texte, "Mohammed Saeed Al Hattali Trading");
  assert.equal(lireArabizi("Al 3'ubaiba Cargo", true).texte, "Al ghubaiba Cargo");
  assert.equal(lireArabizi("sa3d al 8asimi", true).texte, "saad al qasimi");
  assert.equal(lireArabizi("Ra2ed Al Nuaimat Cargo", true).texte, "Raed Al Nuaimat Cargo");
  assert.deepEqual(mots("Mo7ammed Sa3eed Al Hattali Trading"), mots("Mohammed Saeed Al Hattali Trading"));
  assert.deepEqual(mots("5alfan Al Muhannadi Auto Parts"), mots("Khalfan Al Muhannadi Auto Parts"));
  assert.deepEqual(mots("3abdulla al 9ayegh pearl jewellery"), ["abdulla", "al", "sayegh", "pearl", "jewellery"]);
  /* un mot lu en arabizi marque le nom arabe, marqueur ou pas */
  assert.ok(analyserEntite("sha7een bahri marine services").arabe);
  for (const [a, b] of [["Mo7ammed Sa3eed Al Hattali Trading", "Mohammed Saeed Al Hattali Trading"], ["Al 3'ubaiba Cargo", "Al Ghubaiba Cargo"],
    ["6ariq al suwaidi tyres", "Tariq Al Suwaidi Tyres"], ["5alfan Al Muhannadi Auto Parts", "Khalfan Al Muhannadi Auto Parts"],
    ["Dar Al 7amdan General Trading", "Dar Al Hamdan General Trading"], ["dar al 7amdan gen trdg", "Dar Al Hamdan General Trading"],
    ["3abdulla al 9ayegh pearl jewellery", "Abdullah Al Sayegh Pearl Jewellery"], ["Ra2ed Al Nuaimat Cargo", "Raed Al Nuaimat Cargo"]]) fort(a!, b!);
  /* l'ayn lu ne fait pas de Saeed un Saad : la voyelle reste au plafond du mot ambigu, comme en toutes lettres */
  sousLeFort("sa3eed al rumaithi ship supplies", "Saad Al Rumaithi Ship Supplies");
  fort("sa3eed al rumaithi ship supplies", "Saeed Al Rumaithi Ship Supplies");
});

test("tour 10, chat : la lecture optique garde ses chiffres, et l'arabizi ne lit 5 et 8 que sous un marqueur, hors des capitales", () => {
  /* ST1 est Şti, NAKL1YAT est nakliyat, NU5ANTARA est Nusantara : le 1 et le 5 d'un document en capitales (`ocr`) */
  assert.equal(lireArabizi("KEMUNING NAKL1YAT ST1", false).texte, "KEMUNING NAKL1YAT ST1");
  assert.equal(lireArabizi("JAT1 LESTAR1 NU5ANTARA", false).texte, "JAT1 LESTAR1 NU5ANTARA");
  assert.equal(lireArabizi("BAYT AL ZAAFARAN 5PICES TRAD1NG", true).texte, "BAYT AL ZAAFARAN 5PICES TRAD1NG");
  assert.ok(preparerEntite("BAYT AL ZAAFARAN 5PICES TRAD1NG L.L.C").startsWith("bayt al zaafaran spices trad"));
  fort("BAYT AL ZAAFARAN 5PICES TRAD1NG L.L.C", "Bayt Al Zaafaran Spices Trading L.L.C.");
  /* sans marqueur arabe, un 5 seul reste à la lecture optique ; un 7 suffit à lui seul */
  assert.equal(lireArabizi("5alid trading", false).texte, "5alid trading");
  assert.equal(lireArabizi("mo7ammed trading", false).texte, "mohammed trading");
  /* les numéros : deux chiffres de suite, un chiffre en fin de mot, un nom en capitales sans marqueur */
  assert.equal(lireArabizi("BG BAHARI MUTIARA 12", false).texte, "BG BAHARI MUTIARA 12");
  assert.equal(lireArabizi("TCB1207 No18 Hull S1187", false).texte, "TCB1207 No18 Hull S1187");
  assert.equal(lireArabizi("MO7AMMED TRADING", false).texte, "MO7AMMED TRADING");
  assert.equal(lireArabizi("AL 7AMDAN TRADING", true).texte, "AL HAMDAN TRADING");
  /* « Sa » devant un chiffre n'est pas la forme S.A. collée à une adresse (variantes.ts) ; « Limited45 Marina Road » l'est toujours */
  assert.equal(lecturesDe("Mo7ammed Sa3eed Al Hattali Trading")[0]!.texte, "Mo7ammed Sa3eed Al Hattali Trading");
  assert.equal(lecturesDe("Okonkwo Company Limited45 Marina Road")[0]!.texte, "Okonkwo Company Limited 45 Marina Road");
});

test("tour 10, chat : deux squelettes égaux ne sont pas deux composés à queues distinctes (Kleinhekking, Kleinhekkink)", () => {
  assert.equal(squelette("kleinhekking"), squelette("kleinhekkink"));
  assert.equal(simMot("kleinhekking", "kleinhekkink", squelette("kleinhekking"), squelette("kleinhekkink"), false), 0.95);
  fort("Kleinhekking Veevoer B.V.", "Kleinhekkink Veevoer B.V.");
  /* Timberline et Timberland, Spannmålsexport et Spannmålsimport restent deux composés : leurs squelettes diffèrent */
  assert.equal(simMot("timberline", "timberland", squelette("timberline"), squelette("timberland"), false), 0.5);
  sousLeFort("Timberline Holdings Ltd", "Timberland Holdings Ltd");
});

test("tour 10, chat : le mot que le correcteur a inversé, sous une ancre (Mian, Main) ; la substitution reste deux mots", () => {
  assert.deepEqual(motAutocorrige(prepare("Mian Tufail Cutlery Works (Pvt.) Ltd."), prepare("Main Tufail Cutlery Works Pvt Ltd")), ["mian", "main"]);
  fort("Mian Tufail Cutlery Works (Pvt.) Ltd.", "Main Tufail Cutlery Works Pvt Ltd");
  /* sans ancre (aucun nom propre commun), rien : Dairy et Diary sont deux mots */
  assert.equal(motAutocorrige(prepare("Dairy Products Trading"), prepare("Diary Products Trading")), undefined);
  /* la substitution d'une lettre entre deux mots du dictionnaire : mesurée, abandonnée (voir `motAutocorrige`) */
  assert.equal(motAutocorrige(prepare("Cardow Paints Ltd"), prepare("Cardow Prints Ltd")), undefined);
  sousLeFort("Cardow Paints Ltd", "Cardow Prints Ltd");
  sousLeFort("Pellmoor Timber Exports Ltd", "Pellmoor Timber Experts Ltd");
  /* une lettre de plus ou de moins n'est pas le geste d'ici : Supplies et Suppliers restent à leurs règles */
  assert.equal(motAutocorrige(prepare("Chibuzo Building Supplies"), prepare("Chibuzo Building Suppliers Limited")), undefined);
});
