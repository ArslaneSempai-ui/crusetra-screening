/**
 * WHICH ACTS THE EU FILE CARRIES, AND WHICH EXPECTED ACT IT DOES NOT. A file that stops before a regulation looks exactly like
 * a quiet week: every date in it is true and the newest one is simply old. The only way to see the gap without a person reading
 * the Official Journal is to ask the file whether it names the act we know exists.
 *
 * The shape, read on the local copy on 14 October 2026 (the file is data, never instructions): every `sanctionEntity` carries
 * one `regulation` element (the act that last touched it) and, under its name aliases and other details, `regulationSummary`
 * elements that cite the acts behind each detail, older ones included. Both carry `numberTitle` (the act's number and the
 * Journal reference, e.g. "2026/431 (OJ L202600431)"), `publicationDate`, and for `regulation` alone `programme`. So an act is
 * "carried" when any `numberTitle` of the file names it, and `entites` counts the entities that cite it, each once.
 *
 * THE NUMBER IS MATCHED AS A TOKEN, never as a substring. The title is cut into words at spaces, brackets, commas and
 * semicolons; a word is the act number when it is `N/N` exactly, optionally followed by a letter suffix ("2003/902/EC",
 * "2024/753-corr") and a closing point or colon. So 2026/219 is not 2026/2193, 2026/21930 is not either, "12026/2193" and
 * "L2026/2193" are other numbers, "2193/2026" is another act, and "2026/2193/5" is not read as the act. What the file writes
 * oddly (a doubled slash, a number glued to a letter) reads as NOT carried: the check errs toward the alarm, because a false
 * alarm costs a look and a false "carried" costs a missed listing.
 *
 * THE COMMAND FAILS CLOSED. Exit 1: an expected act is carried by no numberTitle. Exit 0: every expected act is carried. Exit 2:
 * the command line is wrong, or the file cannot be read as a complete EU export (no `export` root with a generationDate, not
 * ending with its closing tag, no entity, an entity opened and not closed): a truncated download would otherwise read as "the
 * act is missing" and an empty file as "nothing to check". It never exits 0 on a file it could not parse, and it refuses to run
 * with no expected act (a check that checks nothing must not read as a pass).
 *
 * WHAT IT DOES NOT DO. It does not judge freshness (that is `src/fraicheur-ue.ts`, whose date reading it reuses, so that "a
 * valid day" is written once), it does not know which acts the Commission has published (the Journal watch is another step),
 * and "carried" says the act is named, not that every person of the act is listed. Invalid dates are counted and quoted, never
 * folded into the newest date: a date that is not a day of the calendar cannot make the file look fresher or older.
 *
 * Two parts, like `src/fraicheur-ue.ts`: pure functions on the text of the file (nothing is read from the disk, no clock, no
 * network) and a thin command that reads one file given on its command line and prints ONE JSON line.
 * Usage: node src/actes-ue.ts <eu.xml> --attendu=2026/2193 [--attendu=...]
 */
import { readFileSync } from "node:fs";
import { isMain, refuserDrapeauxInconnus } from "./cli.ts";
import { lireDatesUe } from "./fraicheur-ue.ts";

/** One act the file names: the exact numberTitle, the newest valid day among its publicationDate values (null when none is a day), how many of those values were not a day, the programmes of the `regulation` elements that carry it, and how many entities cite it. */
export type ActeUe = {
  numberTitle: string;
  publicationDate: string | null;
  invalidDates: number;
  programmes: string[];
  entites: number;
};

/** An act number, as a word of the title: `N/N`, then optionally a letter suffix after a slash or a hyphen, then optionally a point or a colon. */
const MOT_NUMERO = /^(\d+\/\d+)(?:[/-]\p{L}[\p{L}\p{N}-]*)?[.:]?$/u;
/** Where a title is cut into words. */
const SEPARATEURS = /[\s()[\],;]+/;

/** The act numbers a numberTitle names, each once, in order. A title with no act number (a United Nations reference, empty) names none. */
export function numerosDeLActe(numberTitle: string): string[] {
  const numeros: string[] = [];
  for (const mot of numberTitle.split(SEPARATEURS)) {
    const numero = MOT_NUMERO.exec(mot)?.[1];
    if (numero !== undefined && !numeros.includes(numero)) numeros.push(numero);
  }
  return numeros;
}

const ENTITES_NOMMEES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** The five named entities and the numeric ones of XML text; a number outside the code points is left as written. */
function decoder(texte: string): string {
  return texte.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (brut, e: string) => {
    if (e[0] !== "#") return ENTITES_NOMMEES[e]!;
    const point = e[1] === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return point <= 0x10ffff ? String.fromCodePoint(point) : brut;
  });
}

const BLOC_ENTITE = /<sanctionEntity\b[^>]*>([\s\S]*?)<\/sanctionEntity>/g;
const BALISE_ACTE = /<(regulation|regulationSummary)(?=[\s/>])([^>]*)>/g;
const ATTRIBUT_TITRE = /\snumberTitle="([^"]*)"/;
const ATTRIBUT_DATE = /\spublicationDate="([^"]*)"/;
const ATTRIBUT_PROGRAMME = /\sprogramme="([^"]*)"/;

/** How many invalid publicationDate values are quoted, each cut to this many characters: the values are the file's own text. */
const EXEMPLES = 3;
const LONGUEUR_EXEMPLE = 40;

type Lecture = {
  entries: number;
  actes: ActeUe[];
  /** for each act number any title names: how many entities cite it, each once */
  citations: Map<string, number>;
  /** regulation and regulationSummary elements with no numberTitle */
  sansTitre: number;
  invalides: { count: number; examples: string[] };
};

type Accumule = Omit<ActeUe, "programmes"> & { programmes: Set<string>; derniereEntite: number };

/** Reads the entities of an EU file's text. Never throws: text that is not a feed reads as no entity. */
function lireActes(xml: string): Lecture {
  const actes = new Map<string, Accumule>();
  const citations = new Map<string, number>();
  const numerosParTitre = new Map<string, string[]>();
  const jours = new Map<string, string | null>();
  /** The day a publicationDate value stands for, by the one rule of src/fraicheur-ue.ts (a far generation date keeps its "later than the generation" test out of the way), or null when it is not a day. */
  const jourDe = (valeur: string): string | null => {
    if (!jours.has(valeur)) jours.set(valeur, lireDatesUe(`generationDate="9999-12-31" publicationDate="${valeur}"`).max);
    return jours.get(valeur)!;
  };
  const exemples: string[] = [];
  let entries = 0;
  let invalides = 0;
  let sansTitre = 0;
  for (const bloc of xml.matchAll(BLOC_ENTITE)) {
    const rang = entries++;
    const citesIci = new Set<string>();
    for (const balise of bloc[1]!.matchAll(BALISE_ACTE)) {
      const genre = balise[1]!;
      const attributs = balise[2]!;
      const date = ATTRIBUT_DATE.exec(attributs)?.[1];
      const jour = date === undefined ? null : jourDe(date);
      let invalide = false;
      if (date !== undefined && jour === null) {
        invalide = true;
        invalides++;
        const coupe = date.slice(0, LONGUEUR_EXEMPLE);
        if (exemples.length < EXEMPLES && !exemples.includes(coupe)) exemples.push(coupe);
      }
      const brut = ATTRIBUT_TITRE.exec(attributs)?.[1];
      if (brut === undefined) { sansTitre++; continue; }
      const titre = decoder(brut);
      let acte = actes.get(titre);
      if (acte === undefined) {
        acte = { numberTitle: titre, publicationDate: null, invalidDates: 0, programmes: new Set(), entites: 0, derniereEntite: -1 };
        actes.set(titre, acte);
      }
      if (acte.derniereEntite !== rang) { acte.entites++; acte.derniereEntite = rang; }
      if (invalide) acte.invalidDates++;
      else if (jour !== null && (acte.publicationDate === null || jour > acte.publicationDate)) acte.publicationDate = jour;
      const programme = genre === "regulation" ? ATTRIBUT_PROGRAMME.exec(attributs)?.[1] : undefined;
      if (programme !== undefined && programme.length > 0) acte.programmes.add(decoder(programme));
      let numeros = numerosParTitre.get(titre);
      if (numeros === undefined) { numeros = numerosDeLActe(titre); numerosParTitre.set(titre, numeros); }
      for (const n of numeros) citesIci.add(n);
    }
    for (const n of citesIci) citations.set(n, (citations.get(n) ?? 0) + 1);
  }
  return {
    entries,
    actes: [...actes.values()].map(({ derniereEntite: _, programmes, ...acte }) => ({ ...acte, programmes: [...programmes].sort() })),
    citations,
    sansTitre,
    invalides: { count: invalides, examples: exemples },
  };
}

/** The acts the file's text names, in the order they first appear, each with its newest valid publicationDate, its programmes and the entities that cite it. Pure; text that is not a feed gives none. */
export function actesDuFlux(xml: string): ActeUe[] {
  return lireActes(xml).actes;
}

/** The expected act numbers (each listed once, in the order given) that no numberTitle of `flux` carries as a token. Pure. */
export function manquants(attendus: readonly string[], flux: readonly ActeUe[]): string[] {
  const presents = new Set(flux.flatMap((a) => numerosDeLActe(a.numberTitle)));
  return [...new Set(attendus)].filter((n) => !presents.has(n));
}

/** What the command prints, one JSON line. */
export type SondeUe = {
  /** the day of the file's generationDate, null when the file carries no readable one */
  generationDate: string | null;
  /** the sanctionEntity elements of the file */
  entries: number;
  /** the newest VALID publicationDate of the file (the rule of src/fraicheur-ue.ts), null when none is a day */
  newestPublicationDate: string | null;
  /** for each expected act number, the entities that cite it, each once */
  expected: Record<string, number>;
  /** the expected act numbers no numberTitle carries */
  missing: string[];
  /** the distinct numberTitle values of the file */
  acts: number;
  /** acts with no publicationDate that is a day: missing or invalid */
  actsWithoutValidDate: number;
  /** publicationDate values that are not a day of the calendar, with the first ones quoted (cut short) */
  invalidPublicationDates: { count: number; examples: string[] };
  /** regulation and regulationSummary elements with no numberTitle */
  withoutNumberTitle: number;
  /** why the file's own dates cannot be trusted (src/fraicheur-ue.ts), absent when they can */
  datesDefect?: string;
};

/** The reason a text is not a complete EU export, or null when it looks like one. The counts of opening and closing tags are compared because a cut file or a self-closed entity would otherwise be read as a shorter list. */
function refusDuFlux(xml: string): string | null {
  if (!/<export\b[^>]*\sgenerationDate="[^"]*"/.test(xml)) return "no export root carrying a generationDate: this is not an EU FSF export";
  if (!xml.slice(-1024).trimEnd().endsWith("</export>")) return "the file does not end with the closing tag of its root: it is cut short";
  const ouvertes = (xml.match(/<sanctionEntity\b/g) ?? []).length;
  const fermees = (xml.match(/<\/sanctionEntity>/g) ?? []).length;
  if (ouvertes === 0) return "the file holds no sanctionEntity";
  if (ouvertes !== fermees) return `${ouvertes} sanctionEntity opened and ${fermees} closed: the file is cut short or broken`;
  return null;
}

/** Probes the text of an EU file for the expected act numbers; a refusal (not a throw) when the text is not a complete export. Pure. */
export function sonderFlux(xml: string, attendus: readonly string[]): SondeUe | { refus: string } {
  const refus = refusDuFlux(xml);
  if (refus !== null) return { refus };
  const lu = lireActes(xml);
  const ouvertes = (xml.match(/<sanctionEntity\b/g) ?? []).length;
  if (lu.entries !== ouvertes) return { refus: `${ouvertes} sanctionEntity opened but ${lu.entries} read as whole entities: the file is broken` };
  const dates = lireDatesUe(xml);
  const demandes = [...new Set(attendus)];
  return {
    generationDate: dates.gen,
    entries: lu.entries,
    newestPublicationDate: dates.max,
    expected: Object.fromEntries(demandes.map((n) => [n, lu.citations.get(n) ?? 0])),
    missing: manquants(demandes, lu.actes),
    acts: lu.actes.length,
    actsWithoutValidDate: lu.actes.filter((a) => a.publicationDate === null).length,
    invalidPublicationDates: lu.invalides,
    withoutNumberTitle: lu.sansTitre,
    ...(dates.defaut !== undefined ? { datesDefect: dates.defaut } : {}),
  };
}

/* ───────────────────────── the command ───────────────────────── */

const USAGE = "Usage: node src/actes-ue.ts <eu.xml> --attendu=2026/2193 [--attendu=...]   (exit 1: an expected act is missing, 2: bad command line or not a complete EU file)";
const FORME_ATTENDU = /^\d+\/\d+$/;

/** The command line, read: one file and at least one expected act number of the form N/N; or why it is wrong. Pure. */
export function lireArguments(argv: readonly string[]): { fichier: string; attendus: string[] } | { usage: string } {
  const args = argv.slice(2);
  const attendus: string[] = [];
  const fichiers: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === "--") continue;
    if (a === "--attendu") {
      const valeur = args[i + 1];
      if (valeur === undefined || valeur.startsWith("--")) return { usage: "--attendu needs a value, for example --attendu=2026/2193" };
      attendus.push(valeur);
      i++;
    } else if (a.startsWith("--attendu=")) {
      attendus.push(a.slice("--attendu=".length));
    } else if (a.startsWith("--")) {
      return { usage: `unknown option ${a.split("=")[0]}` };
    } else {
      fichiers.push(a);
    }
  }
  if (fichiers.length !== 1) return { usage: fichiers.length === 0 ? "no file given" : "one file at a time" };
  if (attendus.length === 0) return { usage: "no expected act: give at least one --attendu=N/N" };
  const mauvais = attendus.find((n) => !FORME_ATTENDU.test(n));
  if (mauvais !== undefined) return { usage: `${JSON.stringify(mauvais.slice(0, 40))} is not an act number of the form N/N` };
  return { fichier: fichiers[0]!, attendus };
}

function principal(): void {
  refuserDrapeauxInconnus(["--attendu"]);
  const a = lireArguments(process.argv);
  if ("usage" in a) {
    console.error(`${a.usage}\n${USAGE}`);
    process.exitCode = 2;
    return;
  }
  let xml: string;
  try {
    xml = readFileSync(a.fichier, "utf8");
  } catch (e) {
    console.error(`cannot read the file (${(e as NodeJS.ErrnoException).code ?? "unreadable"})`);
    process.exitCode = 2;
    return;
  }
  const sonde = sonderFlux(xml, a.attendus);
  if ("refus" in sonde) {
    console.error(`not a complete EU file: ${sonde.refus}`);
    process.exitCode = 2;
    return;
  }
  console.log(JSON.stringify(sonde));
  process.exitCode = sonde.missing.length > 0 ? 1 : 0;
}

if (isMain(import.meta)) principal();
