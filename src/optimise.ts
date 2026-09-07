/**
 * LA FRONTIÈRE — deux questions symétriques sur le même relevé scellé :
 *
 *     npm run optimise -- --from=<measured.json> --recall=0.97
 *       → la cellule palier × seuil qui produit le MOINS d'alertes sous le rappel exigé,
 *         intervalle compris : c'est la borne BASSE de Wilson qui doit tenir l'exigence,
 *         pas le point — un point au-dessus du seuil avec un intervalle qui plonge dessous
 *         est exactement la promesse qu'un comité ne doit pas recevoir ;
 *
 *     npm run optimise -- --from=<measured.json> --alert-budget=800
 *       → le rappel maximal (à la borne basse) sous un budget d'alertes PAR MOIS — la
 *         conversion au mois vient des dates `decided_at` du fichier mesuré, jamais d'une
 *         hypothèse muette.
 *
 * Chaque dollar et chaque heure affichés portent leur hypothèse à côté, avec unité et
 * provenance : un chiffre dérivé d'une hypothèse invisible se lit comme une mesure.
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { isMain, refuserDrapeauxInconnus } from "./cli.ts";
import { scelleIntact, empreinteDuReleve } from "./empreinte.ts";
import { lignesEvaluation } from "./evaluation.ts";
import { ASSUMPTIONS, UNITS, symboleDe, analystHourlyCost, ligneDHypothese } from "./assumptions.ts";
import type { MesureAlertes, Cellule } from "./your-alerts.ts";
import type { PalierId } from "./matcher.ts";

export type CellulePlacee = Cellule & { palier: PalierId; rang: number };

/**
 * Le plancher CONTRACTUEL du rappel (contrat §4, précision d'intégration du 5/09) : le
 * rappel se cite et s'optimise dès CINQ match confirmés, à la borne basse de Wilson —
 * l'intervalle large est précisément ce que le lecteur doit voir. Le seuil général
 * `ENOUGH` (20) aurait privé de rappel la plupart des historiques réels, où les vraies
 * correspondances sont rares ; sous cinq, rien ne se cite ni ne s'optimise.
 *
 * ET UN SEUL SENS PAR DRAPEAU, tranché après le « -Infinity % » du 5/09 au soir : le
 * `reportable` posé par `rate()` garde son sens GÉNÉRAL (n >= ENOUGH — il pilote le format
 * commun et la note « read the interval ») ; partout où c'est la CITATION ou la SÉLECTION
 * du rappel qui se joue, c'est `rappel.n >= MINIMUM_MATCHES` qui décide, explicitement.
 * Un filtre sur `reportable` dans un chemin du rappel est donc un défaut, pas un style.
 */
export const MINIMUM_MATCHES = 5;

/**
 * La plus forte borne basse ATTEIGNABLE sur ce relevé, ou null quand aucune cellule ne
 * porte assez de match pour en avoir une. Séparée pour qu'un témoin la lise sans lancer
 * la commande : `Math.max()` sur un ensemble vide rend -Infinity, et « -Infinity % » est
 * exactement ce qu'un message d'échec a déjà imprimé une fois.
 */
export function plusForteBorne(cellules: readonly CellulePlacee[]): number | null {
  const bornees = cellules.filter((c) => c.rappel.n >= MINIMUM_MATCHES);
  if (bornees.length === 0) return null;
  return Math.max(...bornees.map((c) => c.rappel.low));
}

/** Toutes les cellules du relevé, à plat, avec leur palier. */
export function cellulesDe(m: MesureAlertes): CellulePlacee[] {
  return Object.entries(m.paliers).flatMap(([palier, p]) =>
    p!.cellules.map((c) => ({ ...c, palier: palier as PalierId, rang: p!.rang })));
}

/**
 * La cellule qui produit le moins d'alertes sous le rappel exigé, borne basse comprise.
 *
 * Égalités tranchées dans l'ordre du contrat : moins d'alertes d'abord, puis le palier le
 * moins cher (rang), puis le seuil le plus haut — le plus strict des équivalents.
 * `null` quand AUCUNE cellule ne tient l'exigence sur cet échantillon : une absence nommée,
 * jamais un pis-aller silencieux.
 */
export function meilleureSousRappel(cellules: readonly CellulePlacee[], rappelMin: number): CellulePlacee | null {
  const tenables = cellules.filter((c) => c.rappel.n >= MINIMUM_MATCHES && c.rappel.low >= rappelMin);
  if (tenables.length === 0) return null;
  return [...tenables].sort((a, b) =>
    a.tirees - b.tirees || a.rang - b.rang || b.seuil - a.seuil)[0]!;
}

/**
 * Le rappel maximal (à la borne basse) sous un budget d'alertes par mois. Le facteur mois
 * vient de la période mesurée du fichier ; sans dates, l'appelant a déjà refusé.
 */
export function meilleureSousBudget(
  cellules: readonly CellulePlacee[], budgetParMois: number, joursDePeriode: number,
): CellulePlacee | null {
  const parMois = (c: CellulePlacee) => c.tirees * (30 / joursDePeriode);
  const tenables = cellules.filter((c) => c.rappel.n >= MINIMUM_MATCHES && parMois(c) <= budgetParMois);
  if (tenables.length === 0) return null;
  return [...tenables].sort((a, b) =>
    b.rappel.low - a.rappel.low || a.tirees - b.tirees || a.rang - b.rang)[0]!;
}

/** Les heures d'analyste que `n` alertes coûtent, et le libellé qui montre l'hypothèse. */
export function heuresDAnalyste(nAlertes: number): { heures: number; usd: number } {
  const heures = (nAlertes * ASSUMPTIONS.minutesPerAlert) / 60;
  return { heures, usd: heures * analystHourlyCost() };
}

export function lireRelevé(chemin: string): MesureAlertes {
  const brut = JSON.parse(readFileSync(chemin, "utf8")) as MesureAlertes;
  if (brut?.kind !== "screening-client-record") {
    throw new Error(`${basename(chemin)} is not a screening record: its kind is `
      + `${JSON.stringify((brut as { kind?: unknown })?.kind ?? null)}.\n`
      + `  Point --from at the <file>-measured.json that measure:yours wrote.`);
  }
  if (typeof brut.empreinte !== "string" || !brut.empreinte) {
    throw new Error(`${basename(chemin)} carries no seal; a hand-made record would enter\n`
      + `  the frontier with the authority of a measurement. Re-run measure:yours.`);
  }
  if (!scelleIntact(brut as unknown as Record<string, unknown>)) {
    throw new Error(`${basename(chemin)} does not match its own fingerprint: it carries `
      + `${brut.empreinte}, its content computes to ${empreinteDuReleve(brut)}.\n`
      + `  The file changed after it was sealed. Nothing was optimised.`);
  }
  return brut;
}

/** `--recall=0.97` — strict : un nombre dans [0, 1], et tout le reste refusé en le nommant. */
export function lireRappelMin(brut: string): number {
  /* Le refus AVANT la conversion : `Number("")` vaut 0, et un vide converti d'abord entre
     dans le calcul comme une exigence lue. Le motif décide, la conversion ne voit que ce
     qu'il a accepté. */
  if (!/^(0(\.\d+)?|1(\.0+)?)$/.test(brut)) {
    throw new Error(`--recall=${brut} is not a recall this tool reads. It wants a number\n`
      + `  between 0 and 1, like --recall=0.97, the floor your compliance committee owns.`);
  }
  return Number(brut);
}

export function lireBudget(brut: string): number {
  if (!/^\d{1,9}$/.test(brut) || Number(brut) < 1) {
    throw new Error(`--alert-budget=${brut} is not a budget this tool reads. It wants a whole\n`
      + `  number of alerts per month your analysts can clear, like --alert-budget=800.`);
  }
  return Number(brut);
}

function decrire(c: CellulePlacee, m: MesureAlertes): string[] {
  const l: string[] = [];
  l.push(`  matcher ${c.palier} at threshold ${c.seuil.toFixed(2)}`);
  l.push(`  recall on confirmed matches   ${(c.rappel.rate * 100).toFixed(1)} % `
    + `[${(c.rappel.low * 100).toFixed(0)}–${(c.rappel.high * 100).toFixed(0)}], n=${c.rappel.n}`);
  l.push(`  false-alert rate              ${(c.faussesAlertes.rate * 100).toFixed(1)} % `
    + `[${(c.faussesAlertes.low * 100).toFixed(0)}–${(c.faussesAlertes.high * 100).toFixed(0)}], n=${c.faussesAlertes.n}`);
  l.push(`  alerts raised on this history ${c.tirees} of ${m.source.alerts}`);
  if (c.pourMille !== undefined) l.push(`  alerts per thousand screenings ${c.pourMille}`);
  return l;
}

async function principal(): Promise<void> {
  for (const l of lignesEvaluation()) console.log(l);
  refuserDrapeauxInconnus(["--from", "--recall", "--alert-budget"]);
  const arg = (nom: string) => process.argv.find((a) => a.startsWith(`--${nom}=`))?.split("=").slice(1).join("=");

  const chemin = arg("from");
  const brutRappel = arg("recall");
  const brutBudget = arg("alert-budget");
  if (!chemin || (brutRappel === undefined && brutBudget === undefined)) {
    console.log(`
The frontier, from a sealed measurement:

  npm run optimise -- --from=<file>-measured.json --recall=<min>
      the cell producing the fewest alerts while the recall LOWER BOUND holds <min>

  npm run optimise -- --from=<file>-measured.json --alert-budget=<N>
      the highest bounded recall under N alerts per month (needs decided_at dates)

The record comes from: npm run measure:yours -- --alerts=<csv>
`);
    process.exit(2);
  }
  if (brutRappel !== undefined && brutBudget !== undefined) {
    console.error(`\nGive --recall OR --alert-budget, not both: they are the two directions of the\n`
      + `  same frontier, and answering both at once would answer neither.\n`);
    process.exit(2);
  }

  const m = lireRelevé(chemin);
  const cellules = cellulesDe(m);
  console.log(`\n${m.source.alerts} alert(s) measured on ${m.measuredAt.slice(0, 10)}, seal ${m.empreinte}; `
    + `${Object.keys(m.paliers).length} matcher(s) × ${new Set(cellules.map((c) => c.seuil)).size} thresholds.`);
  if (m.absents.length) console.log(`contract matcher(s) absent from that record: ${m.absents.join(", ")}`);

  if (m.source.matches < MINIMUM_MATCHES) {
    console.error(`\n${m.source.matches} confirmed match(es) in the record: too few confirmed matches to\n`
      + `  bound recall (the contract cites and optimises recall from ${MINIMUM_MATCHES}). Export a window\n`
      + `  with more confirmed matches and re-measure.\n`);
    process.exit(2);
  }

  if (brutRappel !== undefined) {
    const min = lireRappelMin(brutRappel);
    const c = meilleureSousRappel(cellules, min);
    if (!c) {
      const borne = plusForteBorne(cellules);
      console.error(`\nNo cell holds a recall lower bound of ${min} on this sample `
        + `(${m.source.matches} confirmed matches).`);
      console.error(borne === null
        ? `  No cell has enough confirmed matches to bound recall at all.`
        : `  The strongest bound available is ${(borne * 100).toFixed(0)} %: lower the floor,`
          + ` or measure a wider window.`);
      console.error("");
      process.exit(1);
    }
    console.log(`\nFewest alerts with the recall lower bound at or above ${min}:\n`);
    for (const l of decrire(c, m)) console.log(l);
    const economisees = m.source.alerts - c.tirees;
    const h = heuresDAnalyste(economisees);
    console.log(`\nAgainst your current engine's history: ${economisees} alert(s) fewer over the`);
    console.log(`file's period, ${h.heures.toFixed(1)} analyst hour(s), ${symboleDe(UNITS.analystAnnualCost)}${h.usd.toFixed(0)}, computed from:`);
    console.log(`  ${ligneDHypothese("minutesPerAlert")}`);
    console.log(`  ${ligneDHypothese("analystAnnualCost")} over ${ASSUMPTIONS.workingDaysPerYear} days × ${ASSUMPTIONS.productiveHoursPerDay} h`);
    console.log(`Change the assumptions and the dollars move; the recall bound does not.\n`);
    return;
  }

  const budget = lireBudget(brutBudget!);
  if (!m.source.periode || m.source.periode.jours <= 0) {
    console.error(`\n--alert-budget is a MONTHLY figure, and your file carries no readable\n`
      + `  decided_at dates: alerts per month cannot be derived from it without inventing a\n`
      + `  period. Add decided_at to the export and re-measure, or use --recall instead.\n`);
    process.exit(2);
  }
  const c = meilleureSousBudget(cellules, budget, m.source.periode.jours);
  if (!c) {
    console.error(`\nNo cell fits ${budget} alert(s) per month on this history\n`
      + `  (period measured: ${m.source.periode.jours} day(s)). The quietest cell still raises\n`
      + `  ${Math.ceil(Math.min(...cellules.map((x) => x.tirees)) * (30 / m.source.periode.jours))} per month. Raise the budget, or accept an unbounded recall.\n`);
    process.exit(1);
  }
  console.log(`\nHighest bounded recall under ${budget} alert(s) per month `
    + `(period: ${m.source.periode.from} to ${m.source.periode.to}, ${m.source.periode.jours} day(s)):\n`);
  for (const l of decrire(c, m)) console.log(l);
  /* Un « meilleur rappel » borné à zéro est une réponse exacte et inutilisable : le budget
     n'achète AUCUN rappel garanti, et l'imprimer sans le dire laisserait un comité lire un
     optimum là où il y a une famine. */
  if (c.rappel.low === 0) {
    console.log(`\n  ⚠ the best recall this budget buys is bounded at ZERO: under ${budget} alert(s)`);
    console.log(`    per month, no cell retains any guaranteed recall. Raise the budget before`);
    console.log(`    reading anything else here.`);
  }
  console.log(`  alerts per month at this cell ${(c.tirees * (30 / m.source.periode.jours)).toFixed(0)}`);
  const h = heuresDAnalyste(c.tirees * (30 / m.source.periode.jours));
  console.log(`\nClearing them costs ${h.heures.toFixed(1)} analyst hour(s) per month, ${symboleDe(UNITS.analystAnnualCost)}${h.usd.toFixed(0)}, computed from:`);
  console.log(`  ${ligneDHypothese("minutesPerAlert")}`);
  console.log(`  ${ligneDHypothese("analystAnnualCost")} over ${ASSUMPTIONS.workingDaysPerYear} days × ${ASSUMPTIONS.productiveHoursPerDay} h\n`);
}

if (isMain(import.meta)) {
  try {
    await principal();
  } catch (e) {
    console.error(`\n${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(2);
  }
}
