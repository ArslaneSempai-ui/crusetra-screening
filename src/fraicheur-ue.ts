/**
 * THE EU FRESHNESS RULE, WRITTEN ONCE. The day we downloaded the EU file says nothing about how current it is: the feed
 * can freeze, and the file then carries a recent generationDate over listings that stopped months ago (on 12 October
 * 2026 the file on disk was generated that day while the newest publicationDate in it was 23 July). So the file is
 * judged by its own two dates: the feed lags when the newest valid publicationDate of any entry is more than
 * SEUIL_RETARD_UE_JOURS days behind the generationDate. Exactly the limit is not a lag.
 *
 * Two callers share this one function: `scripts/fraicheur-ue.mjs` (the command line, exit 1 when stale) and
 * `src/listes.ts` (`--fetch`, which marks the manifest row). The rule lives here and nowhere else, so the limit and the
 * tolerance are typed once, and no text and no test retypes them.
 *
 * It fails closed. Each publicationDate is read first, as a day or as a datetime (its date part counts, as the
 * generationDate's does); the newest VALID one is the one judged, and the values that are not a day of the calendar (30
 * February reads as 2 March to the platform's own parser, which would turn an impossible date into a plausible lag) are
 * named in the reason, so that one impossible value that happens to sort highest neither hides a fresh date nor makes the
 * verdict "unreadable". The file is stale, never fresh, when the generationDate is missing or not a day, when no valid
 * publicationDate remains, and when the newest one lies after the generationDate by more than the tolerance.
 */

/** The feed lags when its newest publicationDate is more than this many days behind its generationDate. */
export const SEUIL_RETARD_UE_JOURS = 7;

/**
 * A publicationDate later than the generationDate by more than this many days is not a publication of the file's own
 * past: the file or one of its dates is wrong, and it is stale, never fresh (a lag below zero is below any limit, so one
 * stray year 2062 in the file would hide a frozen feed). Measured on 13 October 2026 on the file on disk: 0 of its
 * 50,075 publicationDate values are later than its generationDate, so the day allowed is a margin for the time zone the
 * date-only value was written in, not a need that was observed.
 */
export const TOLERANCE_APRES_GENERATION_UE_JOURS = 1;

const JOUR_MS = 24 * 60 * 60 * 1000;

/** How many invalid publicationDate values the reason quotes, each cut short: the values are the file's own text. */
const CITES = 3;

export type FraicheurUe = {
  /** true when the feed lags by more than the limit, or when a date is missing, invalid or out of order (fail closed) */
  perime: boolean;
  /** the generationDate as written (the day), null when the file carries none */
  gen: string | null;
  /** the newest VALID publicationDate of any entry (the day), null when the file carries none */
  max: string | null;
  /** gen minus max, in whole days; null when it cannot be claimed (a date is missing, invalid or out of order) */
  retard: number | null;
  /** why the file is stale when no lag can be claimed, and which publicationDate values were not read as a day; absent when neither */
  raison?: string;
};

/** The instant of a `YYYY-MM-DD` day, or NaN when it is not a day of the calendar (the round trip refuses 30 February). */
function jourEnMs(jour: string): number {
  const t = Date.parse(jour);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === jour ? t : NaN;
}

/** A day, or a datetime (seconds, fraction and offset optional): the day it starts with. */
const JOUR_OU_HEURE = /^(\d{4}-\d{2}-\d{2})(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?)?$/;

/** Judge an EU FSF file (its text) by its own dates. Pure: no clock, no disk. */
export function fraicheurUE(
  xml: string, seuilJours: number = SEUIL_RETARD_UE_JOURS, tolerance: number = TOLERANCE_APRES_GENERATION_UE_JOURS,
): FraicheurUe {
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
    return { perime: true, gen, max, retard: null, raison: [...defauts, ...(invalidesDits ? [invalidesDits] : [])].join("; ") };
  }

  const retard = Math.round((jourEnMs(gen) - jourEnMs(max)) / JOUR_MS);
  if (retard < -tolerance) {
    return {
      perime: true, gen, max, retard: null,
      raison: [`publication date later than generation date: newest publicationDate ${max}, generationDate ${gen}`, ...(invalidesDits ? [invalidesDits] : [])].join("; "),
    };
  }
  return { perime: retard > seuilJours, gen, max, retard, ...(invalidesDits ? { raison: invalidesDits } : {}) };
}
