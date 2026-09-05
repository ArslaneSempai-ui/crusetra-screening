/**
 * La frontière, éprouvée sur des cellules construites à la main — le témoin lit la logique
 * de sélection sans lancer un matcher, exactement comme `codeDeSortie` chez cascade.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  meilleureSousRappel, meilleureSousBudget, lireRappelMin, lireBudget, lireRelevé,
  heuresDAnalyste, cellulesDe, type CellulePlacee,
} from "./optimise.ts";
import { rate } from "./interval.ts";
import { empreinteDuReleve } from "./empreinte.ts";
import { ASSUMPTIONS, analystHourlyCost } from "./assumptions.ts";
import { mesurer, lireAlertes } from "./your-alerts.ts";
import type { Matcher, Registre } from "./matcher.ts";

function cellule(palier: string, rang: number, seuil: number, tirees: number,
  rappel: [number, number], fa: [number, number]): CellulePlacee {
  return {
    palier: palier as CellulePlacee["palier"], rang, seuil, tirees,
    rappel: rate(rappel[0], rappel[1]),
    faussesAlertes: rate(fa[0], fa[1]),
  };
}

test("sous le rappel exigé, c'est la BORNE BASSE qui doit tenir, pas le point", () => {
  /* 24/24 : borne basse ≈ 0,86 ; 23/24 : point 0,958 mais borne basse ≈ 0,79. Une exigence
     à 0,85 doit garder la première et écarter la seconde, même si son point la dépasse. */
  const large = cellule("exact", 1, 0.9, 50, [23, 24], [10, 100]);
  const sure = cellule("ngrams", 2, 0.8, 80, [24, 24], [20, 100]);
  const choix = meilleureSousRappel([large, sure], 0.85);
  assert.equal(choix, sure, "le point de 23/24 dépasse 0,85 mais sa borne basse plonge dessous");
});

test("égalités : moins d'alertes d'abord, puis le rang, puis le seuil le plus strict", () => {
  const a = cellule("exact", 1, 0.90, 40, [24, 24], [5, 100]);
  const b = cellule("exact", 1, 0.91, 40, [24, 24], [5, 100]);
  const c = cellule("ngrams", 2, 0.91, 40, [24, 24], [5, 100]);
  assert.equal(meilleureSousRappel([a, c, b], 0.8), b, "à tirées et rang égaux, le seuil le plus haut");
  const moins = cellule("ngrams", 2, 0.7, 30, [24, 24], [5, 100]);
  assert.equal(meilleureSousRappel([a, b, moins], 0.8), moins, "moins d'alertes gagne sur le rang");
});

test("aucune cellule tenable : null, jamais un pis-aller silencieux", () => {
  assert.equal(meilleureSousRappel([cellule("exact", 1, 0.9, 10, [15, 24], [5, 100])], 0.9), null);
  /* Et un rappel non citable (n < 20) ne peut pas « tenir » une exigence, si haut soit-il. */
  assert.equal(meilleureSousRappel([cellule("exact", 1, 0.9, 10, [6, 6], [5, 100])], 0.5), null);
});

test("sous budget mensuel : la conversion vient de la période, la borne basse se maximise", () => {
  const calme = cellule("exact", 1, 0.95, 60, [22, 24], [5, 100]);    /* 60 × 30/60 = 30/mois */
  const fort = cellule("ngrams", 2, 0.80, 90, [24, 24], [30, 100]);   /* 90 × 30/60 = 45/mois */
  assert.equal(meilleureSousBudget([calme, fort], 50, 60), fort, "sous 50/mois, la meilleure borne basse gagne");
  assert.equal(meilleureSousBudget([calme, fort], 35, 60), calme, "à 35/mois, seule la calme tient");
  assert.equal(meilleureSousBudget([calme, fort], 10, 60), null);
});

test("--recall et --alert-budget se lisent strictement, et le refus nomme ce qui a été reçu", () => {
  assert.equal(lireRappelMin("0.97"), 0.97);
  assert.equal(lireRappelMin("1"), 1);
  for (const brut of ["97", "97%", "", "abc", "1.5"]) {
    assert.throws(() => lireRappelMin(brut), new RegExp(`--recall=${brut.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} is not a recall`));
  }
  assert.equal(lireBudget("800"), 800);
  for (const brut of ["0", "", "8.5", "1e3"]) assert.throws(() => lireBudget(brut), /not a budget/);
});

test("un relevé retouché est refusé AVANT la frontière, les deux empreintes citées", () => {
  const factice: Registre = new Map([["exact", {
    id: "exact", description: "fake", rang: 1,
    score: (_a: string, b: string) => (/\|(\d+(?:\.\d+)?)$/.exec(b) ? Number(/\|(\d+(?:\.\d+)?)$/.exec(b)![1]) : 0),
  } as Matcher]]);
  const lignes = ["alert_id,screened_name,list_name,list_source,disposition"];
  for (let i = 0; i < 30; i++) lignes.push(`x-${i},a,b|0.9,OFAC,${i < 6 ? "match" : "false_positive"}`);
  const { alertes } = lireAlertes(lignes.join("\n") + "\n");
  const m = mesurer(alertes, factice, "x.csv", "0".repeat(64), null);
  m.empreinte = empreinteDuReleve(m);

  const d = mkdtempSync(join(tmpdir(), "optimise-"));
  const sain = join(d, "x-measured.json");
  writeFileSync(sain, JSON.stringify(m));
  assert.equal(lireRelevé(sain).source.alerts, 30, "le relevé intact se lit");
  assert.equal(cellulesDe(lireRelevé(sain)).length, 51, "toutes les cellules du palier, à plat");

  const retouche = JSON.parse(JSON.stringify(m)) as typeof m;
  retouche.source.matches = 26;
  const chemin = join(d, "retouche-measured.json");
  writeFileSync(chemin, JSON.stringify(retouche));
  assert.throws(() => lireRelevé(chemin), (e: Error) => {
    assert.match(e.message, /it carries [0-9a-f]{16}, its content computes to [0-9a-f]{16}/);
    return true;
  });
  writeFileSync(chemin, JSON.stringify({ kind: "autre-chose" }));
  assert.throws(() => lireRelevé(chemin), /is not a screening record/);
});

test("sous budget, un « meilleur rappel » borné à zéro existe et doit se dire", () => {
  /* La sélection peut légitimement rendre une cellule à rappel nul (rien de mieux ne tient
     le budget) : ce cas-limite est un résultat, et la commande l'accompagne d'une alerte.
     Le témoin fige la moitié mécanique : la cellule choisie est bien celle-là. */
  const affame = cellule("exact", 1, 0.96, 0, [0, 24], [0, 100]);
  const cher = cellule("exact", 1, 0.55, 200, [24, 24], [90, 100]);
  const choix = meilleureSousBudget([affame, cher], 10, 30);
  assert.equal(choix, affame, "seule la cellule affamée tient 10/mois, et son rappel est borné à zéro");
  assert.equal(choix!.rappel.low, 0);
});

test("les heures d'analyste suivent les hypothèses déclarées, jamais un chiffre à part", () => {
  const h = heuresDAnalyste(120);
  assert.equal(h.heures, (120 * ASSUMPTIONS.minutesPerAlert) / 60);
  assert.equal(h.usd, h.heures * analystHourlyCost());
});
