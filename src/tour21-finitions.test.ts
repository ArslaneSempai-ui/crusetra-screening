/**
 * TOUR 21, CE QUI RESTAIT (04/10/2026) : l'abréviation en capitales de deux lettres, que l'index ne cherchait pas et que le témoin
 * exhaustif montrait ; la clé de son sur un nom très court ou un sigle, qui reste à relire ; tous les numéros OMI d'un navire.
 * Chaque cas compare l'index à la comparaison exhaustive : c'est la tranche rapide du témoin (`npm run temoin-index --
 * --exhaustif`, vingt minutes sur les sept listes) que la suite lance. Les noms sont inventés.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreNoms, SEUIL_POSSIBLE } from "./entites.ts";
import { Index, cribler, type Contrepartie } from "./cribler.ts";
import { frequencesDesListes } from "./frequences.ts";
import type { EntreeListe } from "./listes.ts";

const f = frequencesDesListes();
const score = (a: string, b: string) => scoreNoms(f, a, b);
const FORT = 0.81;
const seuils = { fort: FORT, possible: SEUIL_POSSIBLE };
const entree = (id: string, nom: string, alias: string[] = [], plus: Partial<EntreeListe> = {}): EntreeListe => ({ source: "OFAC", id, nom, alias, type: "entity", ...plus });
/** L'index et la comparaison exhaustive rendent les mêmes candidats, aux mêmes scores. */
function memesCandidats(c: Contrepartie, entrees: EntreeListe[]): ReturnType<typeof cribler> {
  const ix = new Index(f, entrees, SEUIL_POSSIBLE);
  const parIndex = cribler(c, ix, seuils), exhaustif = cribler(c, ix, seuils, true);
  assert.deepEqual(parIndex.candidats, exhaustif.candidats, `l'index perd ou invente un candidat pour « ${c.nom} »`);
  return parIndex;
}

test("tour 21 : deux lettres en capitales n'abrègent pas un mot, et l'index ne perd rien (le témoin)", () => {
  const listes = [entree("1", "JOINT STOCK COMPANY THE 77TH FLIGHT UNIT", ["77 QU JSC"]), entree("2", "ZELTRIX QUARVEX HOLDING")];
  /* avant la règle : 0,800 à la comparaison exhaustive, rien par l'index */
  assert.ok(score("QUARNELLISSARA", "77 QU JSC") < SEUIL_POSSIBLE);
  assert.equal(memesCandidats({ ligne: 1, nom: "QUARNELLISSARA" }, listes).statut, "no-match");
  /* trois lettres abrègent toujours, et l'index les trouve */
  const trois = [entree("1", "JOINT STOCK COMPANY THE 77TH FLIGHT UNIT", ["77 QUA JSC"]), entree("2", "ZELTRIX QUARVEX HOLDING")];
  assert.equal(memesCandidats({ ligne: 1, nom: "QUARNELLISSARA" }, trois).candidats.length, 1);
  assert.ok(score("HVY IND ZELTRIX", "Zeltrix Heavy Industries") >= FORT);
});

test("tour 21 : une clé de son sur un nom très court, ou un sigle, reste à relire", () => {
  for (const [a, b] of [["Stör", "ساترا"], ["Seeve", "CEV"], ["Nogat", "AO НИКИЭТ"]] as const) {
    const s = score(a, b);
    assert.ok(s < FORT, `${a} / ${b} : ${s}`);
  }
  /* les lettres ou le squelette rapprochent : le mot reste le mot */
  assert.ok(score("Sony", "ソニー") >= FORT);
  assert.ok(score("Salem", "سالم") >= FORT);
  assert.equal(score("IBM", "I.B.M."), 1);
  /* et un nom de plusieurs mots garde ses clés */
  assert.ok(score("Синерджи Кепитъл", "Synergy Capital Ltd") >= FORT);
  const listes = [entree("1", "ZELTRIX RESEARCH INSTITUTE", ["CEV"]), entree("2", "QUARVEX HOLDING")];
  assert.equal(memesCandidats({ ligne: 1, nom: "Seeve", type: "vessel" }, listes).statut, "possible");
});

test("tour 21 : chaque numéro OMI d'un navire le désigne", () => {
  const listes = [entree("1", "EXAMPLE STAR", [], { type: "vessel", imo: "9074729", autresImo: ["9187629"] }), entree("2", "QUARVEX HOLDING")];
  const parSecond = memesCandidats({ ligne: 1, nom: "Northgate Trader", imo: "9187629" }, listes);
  assert.equal(parSecond.statut, "strong");
  assert.equal(parSecond.candidats[0]!.par, "imo");
  /* le nom criblé avec le second numéro n'est pas écarté comme un autre navire */
  const parNom = memesCandidats({ ligne: 2, nom: "Example Star", imo: "9187629" }, listes);
  assert.equal(parNom.statut, "strong");
  assert.deepEqual(parNom.ecartesParImo, []);
  /* un troisième numéro, lui, écarte */
  assert.equal(memesCandidats({ ligne: 3, nom: "Example Star", imo: "9274800" }, listes).statut, "no-match");
});
