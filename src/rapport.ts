/**
 * LE RAPPORT — les cinq sections du contrat, dans son ordre, et rien d'autre :
 *
 *   1. ce qui a été mesuré : n alertes, n match, n false_positive, période ;
 *   2. la frontière : palier × seuil → rappel [intervalle], fausses alertes [intervalle],
 *      alertes pour mille quand le volume existe ;
 *   3. la cellule recommandée sous l'exigence de rappel déclarée, et ce que le pas suivant
 *      coûte — hypothèses affichées à côté de chaque dollar et de chaque heure ;
 *   4. la robustesse synthétique, À PART, jamais fusionnée ;
 *   5. la provenance : measured / assumed / synthetic, sceau, date, commit.
 *
 * Aucun taux ne se formate ici à la main : `cellulesDeTaux` porte la condition (« too few
 * to quote ») pour le fichier comme pour la console — c'est le fichier qui est classé,
 * transféré et cité, et c'est lui que la garde doit couvrir d'abord.
 */
import { table } from "./figures.ts";
import { rate, cellulesDeTaux, ENOUGH } from "./interval.ts";
import { cellule } from "./csv.ts";
import { SEUILS, PALIERS } from "./matcher.ts";
import { ASSUMPTIONS, STATUSES, UNITS, symboleDe, ligneDHypothese } from "./assumptions.ts";
import { cellulesDe, meilleureSousRappel, heuresDAnalyste } from "./optimise.ts";
import type { MesureAlertes, Cellule } from "./your-alerts.ts";

import { MINIMUM_MATCHES } from "./optimise.ts";
export { MINIMUM_MATCHES };
export const TROP_PEU_DE_MATCHES = "too few confirmed matches to bound recall";
/** La note du contrat pour 5 ≤ n < 20 : l'intervalle est la lecture, jamais le point. */
export const NOTE_PETIT_N = "n below 20: read the interval, not the point";

/** Les seuils montrés dans le fichier lisible ; la grille entière vit dans le relevé scellé. */
export const SEUILS_MONTRES: readonly number[] = [0.50, 0.60, 0.70, 0.75, 0.80, 0.85, 0.90, 0.95, 0.99, 1.00];

/**
 * La cellule du rappel suit le CONTRAT (§4, précision du 5/09), pas le seuil général :
 * sous cinq match, la phrase du contrat ; dès cinq, le taux AVEC son intervalle, même
 * sous ENOUGH — l'intervalle large est ce que le lecteur doit voir, et la note
 * `NOTE_PETIT_N` voyage sous chaque table concernée. `cellulesDeTaux` garde les taux
 * du régime général (fausses alertes) ; celle-ci porte la règle spéciale du rappel.
 */
function celluleRappel(c: Cellule, matches: number): { taux: string; intervalle: string } {
  if (matches < MINIMUM_MATCHES) return { taux: `n/a: ${TROP_PEU_DE_MATCHES}`, intervalle: `n=${matches}` };
  const r = rate(c.rappel.successes, c.rappel.n);
  if (r.reportable) return cellulesDeTaux(r);
  return {
    taux: `${(r.rate * 100).toFixed(1)} %`,
    intervalle: `[${(r.low * 100).toFixed(0)}–${(r.high * 100).toFixed(0)}]`,
  };
}

export function rendreRapport(m: MesureAlertes): string {
  const l: string[] = [
    `# Screening measurement on your own alert history`,
    ``,
  ];

  /* ── 1 · ce qui a été mesuré ── */
  l.push(`## What was measured`, ``);
  l.push(`${m.source.alerts} alert(s) from ${cellule(m.source.file)} (sha256 ${m.source.sha256.slice(0, 16)}…), `
    + `measured on this machine on ${m.measuredAt.slice(0, 10)}. Nothing left it.`);
  l.push(``);
  l.push(`- confirmed matches: ${m.source.matches}`);
  l.push(`- false positives: ${m.source.falsePositives}`);
  if (m.source.periode && m.source.periode.from) {
    l.push(`- period, from your decided_at column: ${m.source.periode.from} to ${m.source.periode.to} `
      + `(${m.source.periode.jours} day(s)`
      + (m.source.periode.illisibles ? `; ${m.source.periode.illisibles} unreadable date(s), counted, not hidden` : "")
      + `)`);
  } else {
    l.push(`- period: not measured; no readable decided_at column. Monthly figures downstream need it.`);
  }
  l.push(m.volume
    ? `- screenings over the period: ${m.volume.n} (${m.volume.origine === "screened" ? "counted from your --screened file" : "declared with --volume"})`
    : `- screenings over the period: not supplied; the alerts-per-thousand column does not appear; it is never estimated in silence.`);
  l.push(``);
  l.push(`One limit, stated up front: this history contains only the pairs your CURRENT engine`);
  l.push(`raised. Recall here means "among the true hits your engine surfaced": a pair it never`);
  l.push(`alerted on is invisible to this file. Robustness on manufactured pairs is measured`);
  l.push(`separately, on synthetic variants of the public lists, and never merged (section 4).`);
  l.push(``);

  /* ── 2 · la frontière ── */
  l.push(`## The frontier, matcher by matcher`, ``);
  l.push(`Thresholds shown: ${SEUILS_MONTRES.map((s) => s.toFixed(2)).join(", ")}; the full grid of`);
  l.push(`${SEUILS.length} lives in the sealed record beside this file.`);
  l.push(``);
  const paliers = Object.entries(m.paliers).sort(([, a], [, b]) => a!.rang - b!.rang);
  for (const [id, p] of paliers) {
    l.push(`### ${cellule(id)} (${p!.description})`, ``);
    /* Le n de chaque taux vit dans l'en-tête de sa colonne : le contrat refuse « un taux
       sans son n ni son intervalle », et un n relégué à la section 1 oblige l'auditeur à
       le reconstituer. Il est constant par colonne, donc il se dit une fois, au bon endroit. */
    const entetes = ["threshold", "alerts raised", `recall (n=${m.source.matches})`, "interval",
      `false alerts (n=${m.source.falsePositives})`, "interval"];
    if (m.volume) entetes.push("per 1000 screenings");
    const lignes = p!.cellules
      .filter((c) => SEUILS_MONTRES.includes(c.seuil))
      .map((c) => {
        const r = celluleRappel(c, m.source.matches);
        const f = cellulesDeTaux(rate(c.faussesAlertes.successes, c.faussesAlertes.n));
        const ligne: (string | number)[] = [c.seuil.toFixed(2), c.tirees, r.taux, r.intervalle, f.taux, f.intervalle];
        if (m.volume) ligne.push(c.pourMille ?? "");
        return ligne;
      });
    l.push(table(entetes, lignes));
    if (m.source.matches >= MINIMUM_MATCHES && m.source.matches < ENOUGH) {
      l.push(``, `*${NOTE_PETIT_N}.*`);
    }
    l.push(``);
  }
  if (m.absents.length) {
    l.push(`Contract matchers absent from tonight's registry, said rather than guessed: `
      + `${m.absents.map((a) => cellule(a)).join(", ")}. The frontier above covers what was measured.`);
    l.push(``);
  }

  /* ── 3 · la cellule recommandée ── */
  l.push(`## The recommended cell, under the declared recall floor`, ``);
  if (m.source.matches < MINIMUM_MATCHES) {
    l.push(`No recommendation: ${TROP_PEU_DE_MATCHES} (${m.source.matches} confirmed match(es) in`);
    l.push(`this file). A cell recommended on that would be a guess wearing a threshold. The`);
    l.push(`synthetic robustness in section 4 stands apart and does not substitute for it.`);
  } else {
    const c = meilleureSousRappel(cellulesDe(m), ASSUMPTIONS.recallFloor);
    l.push(`The floor: ${ligneDHypothese("recallFloor")}; yours to set with \`optimise -- --recall=<min>\`.`);
    l.push(``);
    if (!c) {
      l.push(`No cell holds a recall lower bound of ${ASSUMPTIONS.recallFloor} on this sample`);
      l.push(`(${m.source.matches} confirmed matches). Lower the floor knowingly, or measure a window`);
      l.push(`with more confirmed matches: the bound tightens with n.`);
    } else {
      l.push(`Fewest alerts with the bound held: ${cellule(c.palier)} at threshold ${c.seuil.toFixed(2)}; `
        + `${c.tirees} of ${m.source.alerts} historical alerts raised, recall `
        + `${(c.rappel.rate * 100).toFixed(1)} % [${(c.rappel.low * 100).toFixed(0)}–${(c.rappel.high * 100).toFixed(0)}], n=${c.rappel.n}.`);
      const economisees = m.source.alerts - c.tirees;
      const h = heuresDAnalyste(economisees);
      l.push(``);
      l.push(`Against your current engine's history: ${economisees} alert(s) fewer over the file's`);
      l.push(`period; ${h.heures.toFixed(1)} analyst hour(s), ${symboleDe(UNITS.analystAnnualCost)}${h.usd.toFixed(0)}, computed from assumptions shown here:`);
      l.push(`- ${ligneDHypothese("minutesPerAlert")}`);
      l.push(`- ${ligneDHypothese("analystAnnualCost")}, over ${ASSUMPTIONS.workingDaysPerYear} days/year × ${ASSUMPTIONS.productiveHoursPerDay} h/day`);
      const suivant = m.paliers[c.palier]!.cellules.find((x) => x.seuil === Math.round((c.seuil + 0.01) * 100) / 100);
      if (suivant) {
        const dr = celluleRappel(suivant, m.source.matches);
        l.push(``);
        l.push(`The next step (threshold ${suivant.seuil.toFixed(2)}) would drop ${c.tirees - suivant.tirees} more alert(s)`);
        l.push(`and put the recall at ${dr.taux} ${dr.intervalle}: what tightening costs, before you pay it.`);
      }
    }
  }
  l.push(``);

  /* ── 4 · la robustesse synthétique, à part ── */
  l.push(`## Synthetic robustness, kept apart`, ``);
  l.push(`Not measured in this run: synthetic robustness is measured on FABRICATED variants of`);
  l.push(`public list entries (typos, transpositions, name order, initials, alternate`);
  l.push(`transliterations, stripped diacritics) by the public measurement (\`npm run measure\`),`);
  l.push(`and published as its own sealed record. It never merges with the rates above: your`);
  l.push(`history measures your engine's reality, the variants measure what a matcher survives.`);
  l.push(`Provenance keeps the words apart: those figures are \`synthetic\`, never \`measured\`.`);
  l.push(``);

  /* ── 5 · la provenance ── */
  l.push(`## Provenance`, ``);
  l.push(`- measured: every rate in section 2, on your file, n and interval attached.`);
  l.push(`- assumed: ${(Object.keys(STATUSES) as (keyof typeof STATUSES)[])
    .map((k) => ligneDHypothese(k)).join("; ")}.`);
  l.push(`- synthetic: nothing in this report; section 4 says where those figures live.`);
  l.push(`- seal: ${m.empreinte ?? "(sealed after rendering; see the .json beside this file)"} · `
    + `measured ${m.measuredAt.slice(0, 10)}`
    + (m.code ? ` · code at commit ${m.code.commit}` : ""));
  l.push(``);
  l.push(`No name from your file (screened or listed) appears in this report or in the sealed`);
  l.push(`record; verdicts are keyed by your alert_id and carry scores only. The ids and the file`);
  l.push(`name are yours and DO survive: choose them opaque.`);
  l.push(``);
  return l.join("\n");
}
