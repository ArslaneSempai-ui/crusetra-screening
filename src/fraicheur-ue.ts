/**
 * THE EU FRESHNESS RULE, WRITTEN ONCE. The day we downloaded the EU file says nothing about how current it is, and neither
 * does the gap between the dates inside it: on 12 October 2026 the file on disk was generated that day while the newest
 * publicationDate in it was 23 July, and that is a quiet quarter, not a frozen feed (the gap rule this file used to hold
 * would have refused a client on it). The feed that announces the file settles it, and the clock settles the rest.
 *
 * Two inputs are recorded in the manifest row of the EU list when the file is downloaded (`FraicheurEnregistree`):
 *   - the file's own two dates: its generationDate and the newest valid publicationDate of any entry;
 *   - the newest file the EU feed (RSS, webgate.ec.europa.eu/fsd/fsf/public/rss) announced for it. The feed's items are
 *     the published FILES, one per format, each with a pubDate that is the moment the file was published (read on 14
 *     October 2026: the item of the XML v1.1 file was published 33 minutes after the generationDate of the file we held,
 *     and carried the SHA-1 of its bytes). It announces no regulation publication, so it is compared with the file's
 *     generationDate, not with its newest publicationDate (which would trip on every download, 81 days apart that day).
 * A client screening decides from those recorded inputs and the clock at the moment it runs, never from the network.
 *
 * The EU list is STALE, and a client screening refuses, only when:
 *   (a) the feed announces a file published more than TOLERANCE_APRES_GENERATION_UE_JOURS days after the generationDate of
 *       the file we hold (a newer file exists and we do not have it); or
 *   (b) the generationDate is more than SEUIL_RETARD_UE_JOURS days before the day of the run (the daily update failed); or
 *   (c) a date cannot be trusted: missing, not a day of the calendar, a publicationDate later than the generationDate by
 *       more than the tolerance, a generationDate or an announced date later than the clock allows.
 * A quiet week is none of these: the feed and the file agree, and the file is not old. A feed that could not be read when
 * the file was downloaded is recorded as such and is NOT a reason to refuse by itself.
 *
 * THE KNOWN LIMIT OF (b). It reads the file's own generationDate, and the EU appears to rebuild the file when its lists
 * change, not every day: read at 07:29 UTC on Wednesday 14 October 2026, the feed listed the build of Monday 12 October
 * and none of Tuesday 13 (one observation, not a measure of the EU's rhythm). If so, after more than the limit without a
 * change at the EU, (b) refuses although the daily update ran and nothing failed, and downloading again does not help
 * (the same file comes back). What would tell the two apart is already recorded (`rssAnnonceLe` agreeing with the file,
 * and `telechargeLe` in the row); using it is a decision of the rule's owner, not made here.
 *
 * Three callers share this one rule: `scripts/fraicheur-ue.mjs` (the command line, exit 1 when stale), `src/listes.ts`
 * (`--fetch` records the inputs and a warning, a client screening refuses) and the tests. The limit and the tolerance are
 * typed once, here, and no text and no test retypes them.
 */

/** The file is stale when it was generated more than this many days before the day of the run. Exactly the limit is not stale. */
export const SEUIL_RETARD_UE_JOURS = 7;

/**
 * A date later than the generationDate by more than this many days is not of the file's own past: a publicationDate that
 * late means the file or one of its dates is wrong, and a feed announcement that late means a newer file exists. It is
 * also how far a generationDate may sit after the day of the run (clocks and time zones). Measured on 13 October 2026 on
 * the file on disk: 0 of its 50,075 publicationDate values are later than its generationDate, so the day allowed is a
 * margin for the time zone a date-only value was written in, and for the delay between a file's generation and its
 * publication on the feed, not a need that was observed.
 */
export const TOLERANCE_APRES_GENERATION_UE_JOURS = 1;

const JOUR_MS = 24 * 60 * 60 * 1000;

/** How many invalid publicationDate values the reason quotes, each cut short: the values are the file's own text. */
const CITES = 3;

/** What the manifest row of the EU list records about its freshness, at download. Plain days (`YYYY-MM-DD`), no clock. */
export type FraicheurEnregistree = {
  /** the generationDate of the file (its day), null when the file carries none */
  fichierGenereLe: string | null;
  /** the newest valid publicationDate of any entry of the file (its day), null when none is valid */
  fichierPublieLe: string | null;
  /** why the file's own dates cannot be trusted (fail closed), absent when they can */
  fichierDefaut?: string;
  /** the day of the newest announcement of the file by the EU feed, null when the feed could not be read */
  rssAnnonceLe: string | null;
  /** why the feed could not be read, absent when it was */
  rssIllisible?: string;
};

/** The feed, read: the day the newest announcement of our file was published, or why that could not be read. */
export type ResultatRssUe = { jour: string } | { illisible: string };

/** The instant of a `YYYY-MM-DD` day, or NaN when it is not a day of the calendar (the round trip refuses 30 February). */
function jourEnMs(jour: string): number {
  const t = Date.parse(jour);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === jour ? t : NaN;
}

/** The day (UTC) a clock reading falls on. */
export const jourDe = (d: Date): string => d.toISOString().slice(0, 10);

/** Whole days from `de` to `a`, both `YYYY-MM-DD`; NaN when either is not a day. */
const joursEntre = (de: string, a: string): number => Math.round((jourEnMs(a) - jourEnMs(de)) / JOUR_MS);

/** A day, or a datetime (seconds, fraction and offset optional): the day it starts with. */
const JOUR_OU_HEURE = /^(\d{4}-\d{2}-\d{2})(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?)?$/;

/** What the file says about itself. Pure: no clock, no disk. */
export type DatesFichierUe = {
  /** the generationDate as written (the day), null when the file carries none */
  gen: string | null;
  /** the newest VALID publicationDate of any entry (the day), null when the file carries none */
  max: string | null;
  /** why the dates cannot be trusted: missing, impossible, or a publication later than the generation by more than the tolerance; absent when they can */
  defaut?: string;
};

/**
 * Read the two dates of an EU FSF file (its text). It fails closed. Each publicationDate is read first, as a day or as a
 * datetime (its date part counts, as the generationDate's does); the newest VALID one is the one kept, and the values that
 * are not a day of the calendar (30 February reads as 2 March to the platform's own parser, which would turn an impossible
 * date into a plausible one) are named in the defect only when no valid one remains to stand for them, so that one
 * impossible value that happens to sort highest neither hides a fresh date nor makes the verdict "unreadable". The dates
 * cannot be trusted when the generationDate is missing or not a day, when no valid publicationDate remains, and when the
 * newest one lies after the generationDate by more than the tolerance.
 */
export function lireDatesUe(xml: string, tolerance: number = TOLERANCE_APRES_GENERATION_UE_JOURS): DatesFichierUe {
  const gen = /generationDate="(\d{4}-\d{2}-\d{2})/.exec(xml)?.[1] ?? null;
  let max: string | null = null;
  let invalides = 0;
  const cites: string[] = [];
  for (const m of xml.matchAll(/publicationDate="([^"]*)"/g)) {
    const jour = JOUR_OU_HEURE.exec(m[1]!)?.[1];
    if (jour !== undefined && !Number.isNaN(jourEnMs(jour))) {
      if (max === null || jour > max) max = jour;
    } else {
      invalides++;
      if (cites.length < CITES && !cites.includes(m[1]!)) cites.push(m[1]!);
    }
  }
  const invalidesDits = invalides === 0 ? undefined
    : `${invalides} publicationDate value${invalides > 1 ? "s" : ""} not read as a day (first: ${cites.map((c) => JSON.stringify(c.slice(0, 40))).join(", ")})`;

  const defauts: string[] = [];
  if (gen === null) defauts.push("generationDate missing");
  else if (Number.isNaN(jourEnMs(gen))) defauts.push(`generationDate ${gen} is not a day of the calendar`);
  if (max === null) defauts.push(invalides === 0 ? "no publicationDate found" : "no publicationDate read as a day");
  if (defauts.length > 0 || gen === null || max === null) {
    return { gen, max, defaut: [...defauts, ...(invalidesDits ? [invalidesDits] : [])].join("; ") };
  }
  if (joursEntre(max, gen) < -tolerance) {
    return { gen, max, defaut: `publication date later than generation date: newest publicationDate ${max}, generationDate ${gen}` };
  }
  return { gen, max };
}

/** The record of a download: the file's two dates, and what the feed said (read before the file, so that a file published in between is not mistaken for a newer one). */
export function enregistrerFraicheurUe(xml: string, rss: ResultatRssUe): FraicheurEnregistree {
  const d = lireDatesUe(xml);
  return {
    fichierGenereLe: d.gen, fichierPublieLe: d.max, ...(d.defaut !== undefined ? { fichierDefaut: d.defaut } : {}),
    rssAnnonceLe: "jour" in rss ? rss.jour : null, ...("illisible" in rss ? { rssIllisible: rss.illisible } : {}),
  };
}

export type VerdictFraicheurUe = {
  /** true when the EU list is stale: a client screening refuses */
  perime: boolean;
  /** why, each reason naming its dates; empty when fresh */
  motifs: string[];
  /** days from the generationDate to the day of the run; null when it cannot be claimed */
  ageJours: number | null;
};

const jours = (n: number): string => `${n} day${n === 1 ? "" : "s"}`;

/**
 * Judge the recorded inputs on the clock given. Pure: the clock is a parameter, nothing is read. Every reason found is
 * listed, so a refusal says everything that is wrong at once.
 */
export function jugerFraicheurUe(
  e: FraicheurEnregistree, maintenant: Date,
  seuilJours: number = SEUIL_RETARD_UE_JOURS, tolerance: number = TOLERANCE_APRES_GENERATION_UE_JOURS,
): VerdictFraicheurUe {
  const motifs: string[] = [];
  const aujourdhui = jourDe(maintenant);
  let ageJours: number | null = null;

  if (e.fichierDefaut !== undefined) motifs.push(`the dates in the file cannot be trusted: ${e.fichierDefaut}`);
  if (e.fichierGenereLe === null || Number.isNaN(jourEnMs(e.fichierGenereLe))) {
    if (e.fichierDefaut === undefined) motifs.push(e.fichierGenereLe === null ? "the file records no generationDate" : `the recorded generationDate ${e.fichierGenereLe} is not a day of the calendar`);
  } else {
    ageJours = joursEntre(e.fichierGenereLe, aujourdhui);
    if (ageJours > seuilJours) {
      motifs.push(`the file was generated on ${e.fichierGenereLe}, ${jours(ageJours)} before today (${aujourdhui}); the limit is ${jours(seuilJours)}, so the daily update has not brought a newer one`);
    } else if (ageJours < -tolerance) {
      motifs.push(`the file says it was generated on ${e.fichierGenereLe}, after today (${aujourdhui}) by more than ${jours(tolerance)}: the clock or the file is wrong`);
    }
    if (e.rssAnnonceLe !== null) {
      const ecart = joursEntre(e.fichierGenereLe, e.rssAnnonceLe);
      if (Number.isNaN(ecart)) {
        motifs.push(`the recorded announcement date ${e.rssAnnonceLe} is not a day of the calendar`);
      } else if (ecart > tolerance) {
        motifs.push(`the EU feed announces a file published on ${e.rssAnnonceLe}, ${jours(ecart)} after the one on disk was generated (${e.fichierGenereLe}); a publication up to ${jours(tolerance)} after the generation is the delay of publishing, more means a newer file exists`);
      }
    }
  }
  if (e.fichierPublieLe === null && e.fichierDefaut === undefined) motifs.push("the file records no publicationDate");
  return { perime: motifs.length > 0, motifs, ageJours };
}
