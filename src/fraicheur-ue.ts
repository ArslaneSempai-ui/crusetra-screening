/**
 * THE EU FRESHNESS RULE, WRITTEN ONCE. The day we downloaded the EU file says nothing about how current it is: the feed
 * can freeze, and the file then carries a recent generationDate over listings that stopped months ago (on 12 October
 * 2026 the file on disk was generated that day while the newest publicationDate in it was 23 July). So the file is
 * judged by its own two dates: the feed lags when the newest publicationDate of any entry is more than
 * SEUIL_RETARD_UE_JOURS days behind the generationDate. Exactly the limit is not a lag.
 *
 * Two callers share this one function: `scripts/fraicheur-ue.mjs` (the command line, exit 1 when stale) and
 * `src/listes.ts` (`--fetch`, which marks the manifest row). The rule lives here and nowhere else, so the limit is
 * typed once, and no text and no test retypes it.
 *
 * It fails closed. A date that is missing, that is not a day of the calendar (30 February reads as 2 March to the
 * platform's own parser, which would turn an impossible date into a plausible lag) or that cannot be read makes the
 * file stale, with the reason; it is never read as fresh.
 */

/** The feed lags when its newest publicationDate is more than this many days behind its generationDate. */
export const SEUIL_RETARD_UE_JOURS = 7;

const JOUR_MS = 24 * 60 * 60 * 1000;

export type FraicheurUe = {
  /** true when the feed lags by more than the limit, or when a date is missing or unreadable (fail closed) */
  perime: boolean;
  /** the generationDate as written (the day), null when the file carries none */
  gen: string | null;
  /** the newest publicationDate of any entry (the day), null when the file carries none */
  max: string | null;
  /** gen minus max, in whole days; null when it cannot be computed */
  retard: number | null;
  /** why the file is stale when no lag could be computed; absent otherwise */
  raison?: string;
};

/** The instant of a `YYYY-MM-DD` day, or NaN when it is not a day of the calendar (the round trip refuses 30 February). */
function jourEnMs(jour: string): number {
  const t = Date.parse(jour);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === jour ? t : NaN;
}

/** Judge an EU FSF file (its text) by its own dates. Pure: no clock, no disk. */
export function fraicheurUE(xml: string, seuilJours: number = SEUIL_RETARD_UE_JOURS): FraicheurUe {
  const gen = /generationDate="(\d{4}-\d{2}-\d{2})/.exec(xml)?.[1] ?? null;
  let max: string | null = null;
  for (const m of xml.matchAll(/publicationDate="(\d{4}-\d{2}-\d{2})"/g)) if (max === null || m[1]! > max) max = m[1]!;
  if (gen === null || max === null) return { perime: true, gen, max, retard: null, raison: "date missing or unreadable" };
  const retard = Math.round((jourEnMs(gen) - jourEnMs(max)) / JOUR_MS);
  if (Number.isNaN(retard)) return { perime: true, gen, max, retard: null, raison: "date missing or unreadable" };
  return { perime: retard > seuilJours, gen, max, retard };
}
