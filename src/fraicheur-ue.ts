/**
 * THE EU FRESHNESS RULE, WRITTEN ONCE. The day we downloaded the EU file says nothing about how current it is, and neither
 * does the gap between the dates inside it: on 12 October 2026 the file on disk was generated that day while the newest
 * publicationDate in it was 23 July, and that is a quiet quarter, not a frozen feed (the gap rule this file used to hold
 * would have refused a client on it). The feed that announces the file settles it, and the clock settles the rest.
 *
 * Three inputs are recorded in the manifest row of the EU list when the file is downloaded (`FraicheurEnregistree`):
 *   - the file's own two dates: its generationDate and the newest valid publicationDate of any entry;
 *   - the newest file the EU feed (RSS, webgate.ec.europa.eu/fsd/fsf/public/rss) announced for it. The feed's items are
 *     the published FILES, one per format, each with a pubDate that is the moment the file was published (read on 14
 *     October 2026: the item of the XML v1.1 file was published 33 minutes after the generationDate of the file we held,
 *     and carried the SHA-1 of its bytes). It announces no regulation publication, so it is compared with the file's
 *     generationDate, not with its newest publicationDate (which would trip on every download, 81 days apart that day);
 *   - the day of the last download that CONFIRMED the file against the feed (`confirmeLe`): the feed was read and did
 *     not announce a newer file. A download that could not confirm (feed unreadable, or a newer file announced) does not
 *     refresh that day: it keeps the one the row before had.
 * A client screening decides from those recorded inputs and the clock at the moment it runs, never from the network.
 *
 * The EU list is STALE, and a client screening refuses, only when:
 *   (a) the feed announces a file published more than TOLERANCE_APRES_GENERATION_UE_JOURS days after the generationDate of
 *       the file we hold (a newer file exists and we do not have it); or
 *   (b) the newest evidence that the file is the latest is more than SEUIL_RETARD_UE_JOURS days before the day of the run
 *       (the daily update failed). That evidence is the later of the file's generationDate (a file cannot be older than the
 *       day it was made) and the last confirming download; or
 *   (c) a date cannot be trusted: missing, not a day of the calendar, a publicationDate later than the generationDate by
 *       more than the tolerance, a generationDate, a download day or an announced date later than the clock allows.
 * A quiet week is none of these: the feed and the file agree, and the last download that found them in agreement is
 * recent. A feed that could not be read when the file was downloaded is recorded as such and is NOT a reason to refuse by
 * itself: it only leaves the last confirming day where it was.
 *
 * WHY (b) READS THE DOWNLOAD AND NOT ONLY THE GENERATION DATE. As first written, (b) read the generationDate alone. But
 * the EU appears to rebuild the file when its lists change, not every day (read at 07:29 UTC on Wednesday 14 October
 * 2026, the feed listed the build of Monday 12 October and none of Tuesday 13: one observation, not a measure of the EU's
 * rhythm), and downloading again then returns the same file. With the generationDate alone, a quiet fortnight would have
 * refused every client although the daily update ran and nothing failed. "The update failed" is a fact about the
 * downloads, so the downloads are what (b) measures. A row written before the confirmation was recorded has none, and its
 * file is then judged by its generationDate alone, as before.
 *
 * WHAT THIS CAN AND CANNOT SEE. A client screening does not trust the recorded file dates: it reads the generationDate again
 * from the file on disk (hash-checked against the manifest) and refuses when it differs from the recorded one or the file
 * cannot be read, so a hand-edited `fichierGenereLe` buys nothing. It CANNOT see a forged `confirmeLe`, or a forged feed day:
 * they are a statement by the machine that made the manifest, the manifest is a local, unsigned file, and anyone who can edit
 * it can say that a download confirmed the file today. The rule keeps an honest manifest honest; it is not a defense
 * against its owner.
 *
 * Three callers share this one rule: `scripts/fraicheur-ue.mjs` (the command line, exit 1 when stale), `src/listes.ts`
 * (`--fetch` records the inputs and a warning, a client screening refuses) and the tests. The limit and the tolerance are
 * typed once, here, and no text and no test retypes them.
 */

/** The file is stale when the newest evidence that it is the latest (its generation, or the last download that confirmed it against the feed) is more than this many days before the day of the run. Exactly the limit is not stale. */
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
  /** the day of the last download that confirmed the file against the feed (feed read, no newer file announced); null or absent when none did */
  confirmeLe?: string | null;
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

/**
 * Whether the confirming day of the row before may be carried onto a download that could not confirm. It may when the file
 * is the same one (same content hash), or when its generation day is not older than the one recorded before: a confirmation
 * says "that file was the latest on that day", and it says nothing about an OLDER file the server may hand out later. A
 * previous generation day that was never recorded, or a new one that cannot be read, carries nothing.
 */
export function confirmationReportable(
  avant: { confirmeLe: string | null; fichierGenereLe: string | null; sha256: string } | null,
  genereLe: string | null, sha256: string,
): string | null {
  if (avant === null || avant.confirmeLe === null) return null;
  if (avant.sha256 === sha256) return avant.confirmeLe;
  if (genereLe === null || avant.fichierGenereLe === null) return null;
  const ecart = joursEntre(avant.fichierGenereLe, genereLe);
  return !Number.isNaN(ecart) && ecart >= 0 ? avant.confirmeLe : null;
}

/**
 * The record of a download: the file's two dates, what the feed said (read before the file, so that a file published in
 * between is not mistaken for a newer one), and the day of the last download that confirmed the file against the feed.
 * `jourDuTelechargement` is the day of THIS download (its clock, a parameter); `confirmeAvant` is the confirming day the
 * row before carried, if any. This download confirms when the feed was read, the file's dates can be trusted, and the feed
 * announces a file dated within the tolerance of the generation, on either side: then the confirming day is today.
 * Otherwise it does NOT refresh that day, and the row keeps the one it had.
 */
export function enregistrerFraicheurUe(
  xml: string, rss: ResultatRssUe, jourDuTelechargement: string, confirmeAvant: string | null = null,
  tolerance: number = TOLERANCE_APRES_GENERATION_UE_JOURS,
): FraicheurEnregistree {
  const d = lireDatesUe(xml);
  let confirmeLe = confirmeAvant;
  if ("jour" in rss && d.defaut === undefined && d.gen !== null) {
    const ecart = joursEntre(d.gen, rss.jour);
    /* BOTH sides: a feed item dated long BEFORE the file (2020, 1970) is not agreement, it is a feed that says nothing about
       this file, and counting it would let a file of any age read as confirmed today. */
    if (!Number.isNaN(ecart) && Math.abs(ecart) <= tolerance) confirmeLe = jourDuTelechargement;
  }
  return {
    fichierGenereLe: d.gen, fichierPublieLe: d.max, ...(d.defaut !== undefined ? { fichierDefaut: d.defaut } : {}),
    rssAnnonceLe: "jour" in rss ? rss.jour : null, ...("illisible" in rss ? { rssIllisible: rss.illisible } : {}),
    confirmeLe,
  };
}

export type VerdictFraicheurUe = {
  /** true when the EU list is stale: a client screening refuses */
  perime: boolean;
  /** why, each reason naming its dates; empty when fresh */
  motifs: string[];
  /** days from the newest evidence that the file is the latest (`preuveLe`) to the day of the run; null when it cannot be claimed */
  ageJours: number | null;
  /** that evidence: the later of the generationDate and the last confirming download; null when the generationDate cannot be read */
  preuveLe: string | null;
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
  let preuveLe: string | null = null;

  if (e.fichierDefaut !== undefined) motifs.push(`the dates in the file cannot be trusted: ${e.fichierDefaut}`);
  if (e.fichierGenereLe === null || Number.isNaN(jourEnMs(e.fichierGenereLe))) {
    if (e.fichierDefaut === undefined) motifs.push(e.fichierGenereLe === null ? "the file records no generationDate" : `the recorded generationDate ${e.fichierGenereLe} is not a day of the calendar`);
  } else {
    const gen = e.fichierGenereLe;
    if (joursEntre(gen, aujourdhui) < -tolerance) {
      motifs.push(`the file says it was generated on ${gen}, after today (${aujourdhui}) by more than ${jours(tolerance)}: the clock or the file is wrong`);
    }
    /* the newest evidence that this file is the latest: it was made on `gen`, and the last download that found the feed in
       agreement with it was on `confirme`; the later of the two. */
    preuveLe = gen;
    const confirme = e.confirmeLe ?? null;
    if (confirme !== null) {
      if (Number.isNaN(jourEnMs(confirme))) motifs.push(`the recorded download day ${confirme} is not a day of the calendar`);
      else if (joursEntre(aujourdhui, confirme) > tolerance) motifs.push(`the recorded download day ${confirme} is after today (${aujourdhui}) by more than ${jours(tolerance)}: the clock or the manifest is wrong`);
      else if (confirme > gen) preuveLe = confirme;
    }
    ageJours = joursEntre(preuveLe, aujourdhui);
    if (ageJours > seuilJours) {
      motifs.push(preuveLe === gen
        ? `the file was generated on ${gen}, ${jours(ageJours)} before today (${aujourdhui}), and no download since has confirmed it against the EU feed; the limit is ${jours(seuilJours)}, so the daily update has not run`
        : `the last download that confirmed the file against the EU feed was on ${preuveLe}, ${jours(ageJours)} before today (${aujourdhui}); the limit is ${jours(seuilJours)}, so the daily update has not run since`);
    }
    if (e.rssAnnonceLe !== null) {
      const ecart = joursEntre(gen, e.rssAnnonceLe);
      if (Number.isNaN(ecart)) {
        motifs.push(`the recorded announcement date ${e.rssAnnonceLe} is not a day of the calendar`);
      } else if (ecart > tolerance) {
        motifs.push(`the EU feed announces a file published on ${e.rssAnnonceLe}, ${jours(ecart)} after the one on disk was generated (${gen}); a publication up to ${jours(tolerance)} after the generation is the delay of publishing, more means a newer file exists`);
      }
    }
  }
  if (e.fichierPublieLe === null && e.fichierDefaut === undefined) motifs.push("the file records no publicationDate");
  return { perime: motifs.length > 0, motifs, ageJours, preuveLe };
}
