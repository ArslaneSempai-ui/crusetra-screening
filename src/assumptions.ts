/**
 * What is not measured — and never dressed as if it were.
 *
 * The measurement on a client's alert history produces rates with intervals; everything
 * else a report needs — what an analyst costs, how long an alert takes, how many names a
 * month go through screening — nobody here can know. Those are ASSUMPTIONS, declared with
 * provenance, unit and bounds so a reader substitutes their own figure and sees what moves.
 *
 * Modelled on cascade-routing's `assumptions.ts` (ASSUMPTIONS / STATUSES / UNITS / BOUNDS,
 * a complete Record on each so an assumption added tomorrow does not compile until its
 * provenance, unit and bounds are written).
 */

/**
 * Where a number came from — the shared vocabulary of the house, plus one word.
 *
 * cascade-routing's four (`retrieved` / `measured` / `assumed` / `chosen`) gain
 * `synthetic` here: a figure measured on FABRICATED variants of public list entries —
 * typos, transpositions, alternate transliterations. It is a real measurement of the code,
 * but of manufactured inputs; merging it with rates measured on a client's history would
 * launder a synthetic figure into a measured one. The vocabulary keeps them apart, and the
 * report renders them apart.
 */
export type Provenance = "retrieved" | "measured" | "assumed" | "chosen" | "synthetic";

export type Assumptions = {
  /** Minutes an analyst spends clearing one alert. Assumed — yours will differ. */
  minutesPerAlert: number;
  /** Loaded annual cost of one screening analyst. Assumed. */
  analystAnnualCost: number;
  /** Hours genuinely productive per day. Assumed, and never eight. */
  productiveHoursPerDay: number;
  workingDaysPerYear: number;
  /**
   * Names screened per month, when the client supplies neither `--screened` nor
   * `--volume`. Used ONLY by the optimiser's alert-budget arithmetic, never to print an
   * alerts-per-thousand rate: a rate over an assumed denominator would read as a
   * measurement, so that column simply does not appear without a supplied volume.
   */
  screeningVolumePerMonth: number;
  /**
   * The recall a screening programme is held to before anything else is weighed.
   *
   * Assumed at the very top of the scale because that is what the domain demands: a missed
   * true match is a regulatory event, not a statistic. It stays an assumption — the figure
   * a compliance committee owns — and `optimise -- --recall=<min>` replaces it with yours.
   */
  recallFloor: number;
};

export const ASSUMPTIONS: Assumptions = {
  minutesPerAlert: 5,
  analystAnnualCost: 62_000,
  productiveHoursPerDay: 6,
  workingDaysPerYear: 220,
  screeningVolumePerMonth: 50_000,
  recallFloor: 0.95,
};

/** All assumed, and that is the honest answer: each is an input the reader substitutes. */
export const STATUSES: Record<keyof Assumptions, Provenance> = {
  minutesPerAlert: "assumed",
  analystAnnualCost: "assumed",
  productiveHoursPerDay: "assumed",
  workingDaysPerYear: "assumed",
  screeningVolumePerMonth: "assumed",
  recallFloor: "assumed",
};

/**
 * L'unité de chaque hypothèse, parce qu'un nombre nu se fait attribuer la mauvaise :
 * cascade-routing a publié « humanSeconds $45.00 » le jour où une page a deviné l'unité.
 * Composées, avec leur dénominateur — c'est la moitié qui fait les facteurs cinq.
 */
export const UNITS: Record<keyof Assumptions, string> = {
  minutesPerAlert: "minutes/alert",
  analystAnnualCost: "usd/year",
  productiveHoursPerDay: "hours/day",
  workingDaysPerYear: "days/year",
  screeningVolumePerMonth: "screenings/month",
  recallFloor: "matches recalled/confirmed match",
};

/** Les bornes de balayage : hors d'elles, la valeur est un défaut de saisie, pas un scénario. */
export const BOUNDS: Record<keyof Assumptions, [number, number]> = {
  minutesPerAlert: [0.5, 120],
  analystAnnualCost: [20_000, 200_000],
  productiveHoursPerDay: [1, 8],
  workingDaysPerYear: [180, 260],
  screeningVolumePerMonth: [100, 100_000_000],
  recallFloor: [0.5, 1],
};

/**
 * Le symbole d'une unité monétaire, POUR L'AFFICHAGE — le seul endroit du dépôt où le
 * couple « usd → $ » est écrit. Onze copies tapées de mémoire dans cascade : deux avaient
 * déjà divergé. Le site de rendu lit ce symbole dans la table des unités, jamais sa mémoire.
 */
export function symboleDe(unite: string): string {
  if (unite.startsWith("usd")) return "$";
  throw new Error(`no display symbol declared for unit "${unite}" — declare it here rather than typing one at the render site.`);
}

/** Ce qu'une heure d'analyste coûte, dérivé des hypothèses — jamais tapé ailleurs. */
export function analystHourlyCost(a: Assumptions = ASSUMPTIONS): number {
  return a.analystAnnualCost / (a.workingDaysPerYear * a.productiveHoursPerDay);
}

/**
 * Une ligne d'hypothèse pour un rapport : la valeur, l'unité, la provenance — ensemble,
 * parce qu'un dollar affiché sans son hypothèse à côté se lit comme une mesure.
 */
export function ligneDHypothese(cle: keyof Assumptions, a: Assumptions = ASSUMPTIONS): string {
  return `${cle} = ${a[cle]} ${UNITS[cle]} (${STATUSES[cle]})`;
}
