/**
 * La mesure sur l'historique, éprouvée contre un REGISTRE FACTICE : le vrai appartient au
 * lot des matchers, et coder contre l'interface (`matcher.ts`) est précisément le contrat.
 * Le matcher factice lit son score DANS la paire : `list_name` finit par `|0.87`, le score
 * est 0,87 — chaque cas contrôle donc exactement quelle cellule tire.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  lireAlertes, mesurer, executer, periodeDe, lireVolume, compterScreened,
  MINIMUM_ALERTES, type Alerte,
} from "./your-alerts.ts";
import { rendreRapport, TROP_PEU_DE_MATCHES, NOTE_PETIT_N } from "./rapport.ts";
import { scelleIntact, empreinteDuReleve } from "./empreinte.ts";
import type { Matcher, Registre, PalierId } from "./matcher.ts";

/* ─── le registre factice ─── */
const scoreDeLaPaire: Matcher["score"] = (_a, b) => {
  const m = /\|(\d+(?:\.\d+)?)$/.exec(b);
  return m ? Number(m[1]) : 0;
};
export function registreFactice(ids: PalierId[] = ["exact", "ngrams"]): Registre {
  return new Map(ids.map((id, i) => [id, {
    id, description: `fake ${id} for the seam tests`, rang: i + 1, score: scoreDeLaPaire,
  }]));
}

const ENTETE = "alert_id,screened_name,list_name,list_source,disposition";
/** 30 lignes valides : 6 match (scores .9 .9 .8 .7 .6 .55), 24 false_positive (.5 + centièmes). */
function csvValide(): string {
  const l: string[] = [ENTETE + ",decided_at"];
  const scoresMatch = [0.9, 0.9, 0.8, 0.7, 0.6, 0.55];
  scoresMatch.forEach((s, i) => l.push(`m-${i},Nom ${i},Entry ${i}|${s},OFAC,match,2026-0${(i % 3) + 1}-15`));
  for (let i = 0; i < 24; i++) {
    l.push(`f-${i},Autre ${i},Entry f${i}|${(0.5 + (i % 40) / 100).toFixed(2)},EU,false_positive,2026-03-0${(i % 9) + 1}`);
  }
  return l.join("\n") + "\n";
}

/* ─── les refus du contrat, chacun avec son message ─── */

test("une colonne obligatoire manquante est refusée en la nommant", () => {
  assert.throws(() => lireAlertes("alert_id,screened_name,list_name,disposition\n1,a,b,match\n"),
    /missing "list_source"/);
});

test("une colonne inconnue est refusée en la nommant, avec la liste de ce qui est accepté", () => {
  assert.throws(() => lireAlertes(ENTETE + ",analyst_note\n1,a,b,OFAC,match,ok\n"), (e: Error) => {
    assert.match(e.message, /"analyst_note"/);
    assert.match(e.message, /Accepted: alert_id, screened_name/);
    return true;
  });
});

test("une disposition hors vocabulaire est refusée avec sa ligne et sa valeur", () => {
  assert.throws(() => lireAlertes(ENTETE + "\n1,a,b,OFAC,match\n2,c,d,EU,pending\n"), (e: Error) => {
    assert.match(e.message, /line 3: "pending"/);
    assert.match(e.message, /match.*false_positive/s, "le refus dit le vocabulaire, pas seulement le rejet");
    return true;
  });
});

test("la disposition se lit sans sensibilité à la casse, et le hors-vocabulaire reste refusé", () => {
  /* L'arbitrage du chef (457fca5) : « FALSE_POSITIVE », « False_Positive », « Match » sont
     le fichier NORMAL d'un export de moteur — les refuser refusait le client légitime,
     la même leçon que la clé (id, field). La normalisation n'élargit PAS le vocabulaire :
     « pending » reste dehors, avec le même message. */
  const lignes = [ENTETE];
  for (let i = 0; i < 30; i++) {
    const d = i === 0 ? "Match" : i === 1 ? "FALSE_POSITIVE" : i === 2 ? "False_Positive" : "false_positive";
    lignes.push(`c-${i},a,b,OFAC,${d}`);
  }
  const { alertes } = lireAlertes(lignes.join("\n") + "\n");
  assert.equal(alertes[0]!.disposition, "match");
  assert.equal(alertes[1]!.disposition, "false_positive");
  assert.equal(alertes[2]!.disposition, "false_positive");
  assert.equal(alertes.filter((a) => a.disposition === "match").length, 1);
  assert.throws(() => lireAlertes(ENTETE + "\n1,a,b,OFAC,Pending\n"), /line 2: "Pending"/);
});

test("un alert_id dupliqué est refusé en nommant l'id et les lignes ; un id vide aussi", () => {
  assert.throws(() => lireAlertes(ENTETE + "\n7,a,b,OFAC,match\n7,c,d,EU,false_positive\n"),
    /duplicate alert_id\(s\): "7" \(rows 2, 3\)/);
  assert.throws(() => lireAlertes(ENTETE + "\n,a,b,OFAC,match\n"), /empty alert_id: line\(s\) 2/);
});

test("moins de trente lignes : refusé, avec le compte et la raison", () => {
  const csv = ENTETE + "\n" + Array.from({ length: 5 }, (_, i) => `${i},a,b,OFAC,match`).join("\n") + "\n";
  assert.throws(() => lireAlertes(csv), (e: Error) => {
    assert.match(e.message, new RegExp(`5 alert\\(s\\).*at least ${MINIMUM_ALERTES}`, "s"));
    return true;
  });
});

test("le fichier valide passe, et un engine_score illisible est une absence, jamais un zéro", () => {
  const { alertes } = lireAlertes(ENTETE + ",engine_score\n"
    + Array.from({ length: 30 }, (_, i) => `${i},a,b,OFAC,false_positive,${i === 0 ? "abc" : "0.5"}`).join("\n") + "\n");
  assert.equal(alertes.length, 30);
  assert.equal(alertes[0]!.scoreMoteur, undefined, "« abc » ne devient pas 0 — Number('') et NaN sont des absences");
  assert.equal(alertes[1]!.scoreMoteur, 0.5);
});

/* ─── la frontière, sur des cellules construites à la main ─── */

test("rappel et fausses alertes se comptent sur les bonnes populations, au bon seuil", () => {
  const { alertes } = lireAlertes(csvValide());
  const m = mesurer(alertes, registreFactice(["exact"]), "x.csv", "0".repeat(64), null);
  const c85 = m.paliers.exact!.cellules.find((c) => c.seuil === 0.85)!;
  /* matches à score ≥ 0,85 : 0,9 et 0,9 → 2 sur 6 ; false_positive : aucun n'atteint 0,85. */
  assert.deepEqual([c85.rappel.successes, c85.rappel.n], [2, 6]);
  assert.deepEqual([c85.faussesAlertes.successes, c85.faussesAlertes.n], [0, 24]);
  assert.equal(c85.tirees, 2);
  const c55 = m.paliers.exact!.cellules.find((c) => c.seuil === 0.55)!;
  assert.deepEqual([c55.rappel.successes, c55.rappel.n], [6, 6], "0,55 compte le match à 0,55 : >= est la règle");
  assert.equal(c55.pourMille, undefined, "sans volume, la colonne n'existe pas — jamais estimée");
});

test("un score juste sous un seuil ne tire pas à ce seuil : rien n'arrondit avant la comparaison", () => {
  /* La couture R1 garantit qu'un nom identique à lui-même rend EXACTEMENT 1 ; le pendant,
     côté mesure, est qu'un 0,99996 ne devienne jamais 1,00 par arrondi — sinon la cellule
     du seuil 1,00 compterait des paires que le matcher n'a pas déclarées identiques. */
  const lignes = ["alert_id,screened_name,list_name,list_source,disposition"];
  lignes.push("m-0,a,b|0.99996,OFAC,match");
  for (let i = 0; i < 29; i++) lignes.push(`f-${i},c,d|0.4,EU,false_positive`);
  const { alertes } = lireAlertes(lignes.join("\n") + "\n");
  const m = mesurer(alertes, registreFactice(["exact"]), "x.csv", "0".repeat(64), null);
  const c100 = m.paliers.exact!.cellules.find((c) => c.seuil === 1.00)!;
  assert.equal(c100.tirees, 0, "0,99996 ne tire pas au seuil 1,00");
  assert.equal(m.verdicts["m-0"]!.scores.exact, 0.99996, "et le relevé porte le score brut, rejouable");
});

test("le volume fourni rend les alertes pour mille ; les paliers du contrat absents sont dits", () => {
  const { alertes } = lireAlertes(csvValide());
  const m = mesurer(alertes, registreFactice(["exact"]), "x.csv", "0".repeat(64), { origine: "volume", n: 10_000 });
  const c85 = m.paliers.exact!.cellules.find((c) => c.seuil === 0.85)!;
  assert.equal(c85.pourMille, (2 / 10_000) * 1000);
  assert.ok(m.absents.includes("embed") && m.absents.includes("phonetic"),
    "un palier hors du registre est nommé absent, la table ne plante pas");
  assert.match(rendreRapport(m), /absent from tonight's registry/);
});

test("la période vient des decided_at lisibles, et les illisibles sont comptés", () => {
  const p = periodeDe([
    { id: "1", nomFiltre: "", entreeListe: "", source: "", disposition: "match", decideeLe: "2026-01-10" },
    { id: "2", nomFiltre: "", entreeListe: "", source: "", disposition: "match", decideeLe: "2026-02-09" },
    { id: "3", nomFiltre: "", entreeListe: "", source: "", disposition: "match", decideeLe: "pas-une-date" },
  ] as Alerte[])!;
  assert.deepEqual([p.from, p.to, p.jours, p.illisibles], ["2026-01-10", "2026-02-09", 30, 1]);
  assert.equal(periodeDe([{ id: "1", nomFiltre: "", entreeListe: "", source: "", disposition: "match" } as Alerte]), null);
});

test("--volume et --screened se lisent strictement : le motif refuse ce que Number() avalerait", () => {
  assert.equal(lireVolume("250000"), 250_000);
  for (const brut of ["", "0", "1e3", "0x50", "12.5", "-3"]) {
    assert.throws(() => lireVolume(brut), /not a number of screenings/, `« ${brut} » doit être refusé`);
  }
  assert.equal(compterScreened("screened_name\na\nb\n"), 2);
  assert.throws(() => compterScreened("nom\na\n"), /needs one column named "screened_name"/);
});

/* ─── never a value, avec témoin ─── */

test("le relevé et le rapport ne portent AUCUN nom du fichier, et le détecteur sait voir", () => {
  const SENTINELLES = ["ZORYA-SENTINELLE-K", "ENTREE-LISTE-SENTINELLE", "SOURCE-SENTINELLE"];
  const d = mkdtempSync(join(tmpdir(), "relecture-"));
  const chemin = join(d, "alertes.csv");
  const lignes = [ENTETE];
  for (let i = 0; i < 30; i++) {
    lignes.push(`a-${i},${SENTINELLES[0]} ${i},${SENTINELLES[1]} ${i}|0.9,${SENTINELLES[2]},`
      + (i < 6 ? "match" : "false_positive"));
  }
  writeFileSync(chemin, lignes.join("\n") + "\n");
  const { cheminMd, cheminJson, mesure } = executer(chemin, registreFactice(), null);

  for (const fichier of [cheminMd, cheminJson]) {
    const emis = readFileSync(fichier, "utf8");
    for (const s of SENTINELLES) {
      assert.ok(!emis.includes(s),
        `« ${s} » sort du fichier du client vers ${fichier} : « never a name » vient de devenir faux.`);
    }
    assert.ok(!emis.includes(d), "le chemin absolu du dossier ne sort pas non plus : basename seul");
  }
  /* CONTRE-ÉPREUVE : la recherche sait trouver — un émis fabriqué qui FUIT est vu, sinon
     les zéros du dessus diraient seulement qu'includes rend false sur tout. */
  assert.ok(JSON.stringify({ fuite: SENTINELLES[0] }).includes(SENTINELLES[0]!));
  /* Et ce qui doit rester est là : le verdict par alert_id, avec le score du palier. */
  assert.equal(mesure.verdicts["a-0"]!.disposition, "match");
  assert.equal(mesure.verdicts["a-0"]!.scores.exact, 0.9);
});

/* ─── le scellé ─── */

test("le relevé émis est scellé, et une retouche le fait mentir", () => {
  const { alertes } = lireAlertes(csvValide());
  const m = mesurer(alertes, registreFactice(["exact"]), "x.csv", "0".repeat(64), null);
  m.empreinte = empreinteDuReleve(m);
  assert.ok(scelleIntact(m as unknown as Record<string, unknown>));
  const copie = JSON.parse(JSON.stringify(m)) as typeof m;
  copie.source.matches = 25;
  assert.ok(!scelleIntact(copie as unknown as Record<string, unknown>), "un chiffre retouché casse le scellé");
});

/* ─── la règle des cinq match, et celle des vingt ─── */

test("moins de cinq match : la phrase du contrat, aucun rappel cité, le synthétique montré à part", () => {
  const l = [ENTETE, "m-0,a,b|0.9,OFAC,match"];
  for (let i = 0; i < 29; i++) l.push(`f-${i},c,d|0.6,EU,false_positive`);
  const { alertes } = lireAlertes(l.join("\n") + "\n");
  const m = mesurer(alertes, registreFactice(["exact"]), "x.csv", "0".repeat(64), null);
  const rapport = rendreRapport(m);
  assert.match(rapport, new RegExp(TROP_PEU_DE_MATCHES));
  assert.match(rapport, /Synthetic robustness, kept apart/);
  assert.doesNotMatch(rapport, /\d+\.\d % \[\d+–\d+\][^\n]*recall/i,
    "aucun pourcentage de rappel intervalle compris ne doit apparaître sous cinq match");
});

test("six match : le rappel EST cité avec son intervalle, et la note du contrat suit la table", () => {
  /* Contrat §4, précision du 5/09 : dès cinq match le rappel se cite — l'intervalle large
     est la lecture — et la note « read the interval, not the point » voyage sous la table.
     Le régime général (« too few to quote ») ne s'applique plus au rappel entre 5 et 19. */
  const { alertes } = lireAlertes(csvValide());
  const m = mesurer(alertes, registreFactice(["exact"]), "x.csv", "0".repeat(64), null);
  const rapport = rendreRapport(m);
  assert.match(rapport, /\| 0\.85 \| 2 \| 33\.3 % \| \[10–70\]/, "2 sur 6 à 0,85 : le taux et l'intervalle sont cités");
  assert.match(rapport, new RegExp(NOTE_PETIT_N));
  assert.doesNotMatch(rapport, /too few to quote[^\n]*\| *$/m, "le rappel ne porte plus le refus général");
  /* La recommandation tente le plancher : 6/6 au mieux, borne basse ~0,61 < 0,95 → l'absence
     est nommée avec le plancher, jamais un pis-aller. */
  assert.match(rapport, /No cell holds a recall lower bound of 0\.95/);
});
