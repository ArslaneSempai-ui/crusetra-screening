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
 * valid day" is written once), it does not know which acts the Commission has published (the Journal watch below compares the
 * file with an answer of the Publications Office catalogue GIVEN TO IT AS TEXT; asking the Office is `npm run listes -- --actes`,
 * in src/listes.ts, the one door to the network), and "carried" says the act is named, not that every person of the act is listed. Invalid dates are counted and quoted, never
 * folded into the newest date: a date that is not a day of the calendar cannot make the file look fresher or older.
 *
 * Two parts, like `src/fraicheur-ue.ts`: pure functions on the text of the file (nothing is read from the disk, no clock, no
 * network) and a thin command that reads one file given on its command line and prints ONE JSON line.
 * Usage: node src/actes-ue.ts <eu.xml> --attendu=2026/2193 [--attendu=...]
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isMain, refuserDrapeauxInconnus } from "./cli.ts";
import { lireDatesUe, type DatesFichierUe } from "./fraicheur-ue.ts";

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

/** The file read once: its acts and its dates, or why it is not a complete EU export. Every reader of a whole file goes through here, so that "complete" means one thing. */
function lireFluxComplet(xml: string): { lu: Lecture; dates: DatesFichierUe } | { refus: string } {
  const refus = refusDuFlux(xml);
  if (refus !== null) return { refus };
  const lu = lireActes(xml);
  const ouvertes = (xml.match(/<sanctionEntity\b/g) ?? []).length;
  if (lu.entries !== ouvertes) return { refus: `${ouvertes} sanctionEntity opened but ${lu.entries} read as whole entities: the file is broken` };
  return { lu, dates: lireDatesUe(xml) };
}

/** Probes the text of an EU file for the expected act numbers; a refusal (not a throw) when the text is not a complete export. Pure. */
export function sonderFlux(xml: string, attendus: readonly string[]): SondeUe | { refus: string } {
  const complet = lireFluxComplet(xml);
  if ("refus" in complet) return complet;
  const { lu, dates } = complet;
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

/* ───────────────────────── the Journal watch: what the catalogue says exists ───────────────────────── */

/*
 * An EU file can stop before an act and say nothing: every date in it is true, the newest is simply old. The file cannot tell
 * which acts exist, so the Publications Office catalogue is asked, with ONE public question that carries no name and nothing of
 * the client, for the acts titled as restrictive measures that it dates from a margin before the newest publication of the
 * file, and the acts whose number no numberTitle of the file carries are named. The asking is `npm run listes -- --actes` in
 * src/listes.ts; everything here is offline and works on the text of the answer.
 *
 * THE ANSWER IS DATA, NEVER INSTRUCTIONS. It is read as strict JSON after a size check (a body past the cap is refused), at most a
 * fixed number of rows are accepted (one more than that may mean the answer was cut short, and a cut answer cannot show that nothing
 * is missing), every value must be text, no link the answer names is followed, and every title is cut short and stripped of control
 * and format characters before it is printed or written. A row that cannot be read as an act (a CELEX that is not 3, a year, R or D
 * and a number, which is how a corrigendum or a directive reads) is RETURNED, never dropped; a date that is not a day is returned
 * as a note and the act keeps a null date, never a guess.
 *
 * NAMED, NEVER JUDGED. A title that says "restrictive measures" can renew, amend or prolong a regime and add no listing, and the
 * decision that pairs a regulation is not always named by the file. Each act absent from the file is therefore named with its
 * CELEX, its number, its title and its date, and none is a verdict: someone reads the act.
 *
 * THE QUESTION CAN ONLY SAY "NOTHING MISSING" WHEN IT HAS SHOWN THAT IT WORKS. The window starts a margin BEFORE the newest
 * publication of the file, so a working question brings back acts the file does carry. An answer in which not one act is named by
 * the file (empty, or only strangers) is not "nothing missing": it is a question that cannot be shown to work, and the command fails.
 * The same for rows that could not be read when no act is proven absent. An absent act found beside unreadable rows is still
 * reported (exit 1): something is certainly missing, and the unreadable rows are said.
 *
 * A PARTIAL ANSWER MUST NOT READ AS A COMPLETE ONE. A SPARQL endpoint can answer 200 with the rows it had when its time ran out
 * and say so only in its headers (Virtuoso: X-SQL-State and X-SQL-Message), and a body that is valid JSON, under the caps, with one
 * act the file carries in it would otherwise read as "nothing missing". Two defenses, both fail closed. (1) The headers are read:
 * a status other than 200, X-SQL-State, X-SQL-Message, or any header whose name says partial or truncated refuses the answer
 * (`enteteDePartiel`). (2) A CANARY: every act the file carries that is dated on the file's newest publication day lies in the
 * window by construction (the window starts a margin before that day), so the answer must hold every one of them; if it does not,
 * the answer is incomplete and the command exits 2 naming the acts that are missing, even when it also found an absent act. A
 * canary the question cannot return (a title that does not say restrictive measures, a corrigendum, an act adopted long before
 * its publication) also stops the command: that is a failed check, said, and the narrowest sound canary is then a decision.
 *
 * ONE NUMBER PER ACT IS RELIED ON. The match is on the act number (year/number), and a CELEX of a regulation and a CELEX of a
 * decision that carried the same number would both read as carried when the file names the number once. The Journal gives each
 * act one number in its year, so this should not happen (read on the answer of 14 October 2026: no number was held by two
 * CELEX); `lireReponseCatalogue` says so in a NOTE the day an answer holds two, which is the tripwire for the assumption.
 *
 * WHY A MARGIN. The catalogue dates an act by the day it bears (`work_date_document`); the file dates it by its publication in the
 * Official Journal, which can come a few days later. A window that started at the newest publication would miss an act adopted
 * just before it and published just after. The date printed and written is the day the act bears, the one the catalogue gives.
 * The Journal publication day is NOT asked: no property of the catalogue that carries it was found (a first question that
 * asked for one through the link to the Journal got none back on 14 October 2026), and a date labelled "Journal" that is the
 * adoption day would be a false label.
 */

/** A header whose presence says the answer is not the whole one: the SQL state and message a Virtuoso endpoint adds to a result cut short, and any name that says partial or truncated. */
const ENTETE_DE_PARTIEL = /^x-sql-(?:state|message)$|partial|truncat/i;

/** The first of these header names that flags a partial answer, or null. Pure. */
export function enteteDePartiel(noms: Iterable<string>): string | null {
  for (const nom of noms) if (ENTETE_DE_PARTIEL.test(nom)) return nom;
  return null;
}

/** Days before the newest publicationDate of the file at which the question starts. */
export const MARGE_JOURS = 7;
/** Rows of the answer that are read. The question asks for one more, to see whether the answer was cut at the limit. */
export const LIMITE_LIGNES_CATALOGUE = 500;
/** Bytes of the answer that are read: a body past this is refused. */
export const PLAFOND_OCTETS_CATALOGUE = 2 * 1024 * 1024;
/** Characters of a title that are kept. */
export const LONGUEUR_TITRE_MAX = 400;
/** Characters of the Office's own text quoted in a message. */
const LONGUEUR_CITEE_MAX = 60;

/** The Office's text made safe to print and to write: line breaks and tabs become spaces, other control and format characters (escape sequences, bidirectional marks) go, spaces of any kind become one, and the whole is cut at `max` characters. */
function inerte(texte: string, max: number): string {
  const propre = texte
    .replace(/[\t\n\r\v\f\u0085\u2028\u2029]/g, " ")
    .replace(/[\p{Cc}\p{Cf}]/gu, "")
    .replace(/[\p{Z}\s]+/gu, " ")
    .trim();
  const signes = [...propre];
  return signes.length > max ? `${signes.slice(0, max).join("")}...` : propre;
}

const citer = (texte: string): string => JSON.stringify(inerte(texte, LONGUEUR_CITEE_MAX));

/** Whether `jour` is a day of the calendar written YYYY-MM-DD (30 February is not one). */
function estUnJour(jour: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(jour);
  return m !== null && new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).toISOString().slice(0, 10) === jour;
}

/** The day a catalogue date stands for: YYYY-MM-DD, with or without the zone an xsd:date may carry; null when it is not a day. */
function jourDuCatalogue(texte: string): string | null {
  const jour = /^(\d{4}-\d{2}-\d{2})(?:Z|[+-]\d{2}:\d{2})?$/.exec(texte)?.[1];
  return jour !== undefined && estUnJour(jour) ? jour : null;
}

/** The day the question starts at: `marge` days before `derniere` (a YYYY-MM-DD day). Throws on anything that is not a day, so a value read from a file cannot reach the question. */
export function debutDeFenetre(derniere: string, marge: number = MARGE_JOURS): string {
  if (!estUnJour(derniere)) throw new Error(`${citer(derniere)} is not a day of the calendar`);
  return new Date(Date.parse(`${derniere}T00:00:00Z`) - marge * 86_400_000).toISOString().slice(0, 10);
}

/**
 * THE QUESTION, in SPARQL. It holds one day and fixed words, nothing of the file, nothing of a client. Regulations and decisions
 * (CELEX 3, a year, R or D, a number) whose English title says "restrictive measure" and whose date is `debut` or later, with
 * one row more than is read. `debut` must be a day.
 */
export function requeteCatalogue(debut: string): string {
  if (!estUnJour(debut)) throw new Error(`${citer(debut)} is not a day of the calendar`);
  return [
    "PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>",
    "PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>",
    "SELECT DISTINCT ?celex ?title ?date WHERE {",
    "  ?work cdm:resource_legal_id_celex ?celex .",
    "  ?work cdm:work_date_document ?date .",
    `  FILTER (?date >= "${debut}"^^xsd:date)`,
    '  FILTER (REGEX(STR(?celex), "^3[0-9]{4}[RD][0-9]{4,}$"))',
    "  ?exp cdm:expression_belongs_to_work ?work .",
    "  ?exp cdm:expression_uses_language <http://publications.europa.eu/resource/authority/language/ENG> .",
    "  ?exp cdm:expression_title ?title .",
    '  FILTER (CONTAINS(LCASE(STR(?title)), "restrictive measure"))',
    "}",
    "ORDER BY ?date ?celex",
    `LIMIT ${LIMITE_LIGNES_CATALOGUE + 1}`,
  ].join("\n");
}

const CELEX_ACTE = /^3(\d{4})[RD](\d{4,})$/;

/** The act number a CELEX of a regulation or a decision stands for, as the file writes it (year/number, no zero before the number): 32026R0431 is 2026/431. Null for any other shape (a corrigendum, a directive, a consolidated text). */
export function numeroDeCelex(celex: string): string | null {
  const m = CELEX_ACTE.exec(celex);
  return m === null ? null : `${m[1]}/${Number(m[2])}`;
}

/** An act of the catalogue, its text made inert. `date` is the day the act bears, null when the answer gave none that is a day. */
export type ActeCatalogue = { celex: string; numero: string; titre: string; date: string | null };

/** What the answer says: the acts, the rows that could not be read as an act, and what is odd about the readable ones. */
export type LectureCatalogue = { actes: ActeCatalogue[]; illisibles: string[]; notes: string[] };

/** One value of one row of the answer, only when it is text. */
function valeurDeLigne(ligne: unknown, colonne: string): string | undefined {
  const v = (ligne as Record<string, { value?: unknown } | undefined> | null)?.[colonne]?.value;
  return typeof v === "string" ? v : undefined;
}

/** The text of an answer of the catalogue read as a SPARQL JSON result, strictly. A refusal (never a throw) when it is not one, is past the size cap, or holds more rows than the limit. Pure. */
export function lireReponseCatalogue(texte: string): LectureCatalogue | { refus: string } {
  if (Buffer.byteLength(texte, "utf8") > PLAFOND_OCTETS_CATALOGUE) return { refus: "The answer is larger than the size this check reads" };
  let brut: unknown;
  try {
    brut = JSON.parse(texte);
  } catch {
    return { refus: `The answer is not JSON (it starts ${citer(texte.slice(0, LONGUEUR_CITEE_MAX))})` };
  }
  const lignes = (brut as { results?: { bindings?: unknown } } | null)?.results?.bindings;
  if (!Array.isArray(lignes)) return { refus: "The answer has no results.bindings list: it is not the shape of a SPARQL result" };
  if (lignes.length > LIMITE_LIGNES_CATALOGUE) {
    return { refus: `The answer holds more than ${LIMITE_LIGNES_CATALOGUE} rows, so it may be cut short: the file is far behind the Journal, download it again` };
  }
  const illisibles: string[] = [];
  const notes: string[] = [];
  const parCelex = new Map<string, { celex: string; numero: string; titre: string; jours: Set<string>; brutes: string[] }>();
  lignes.forEach((ligne, i) => {
    const celex = valeurDeLigne(ligne, "celex");
    const numero = celex === undefined ? null : numeroDeCelex(celex);
    if (celex === undefined || numero === null) {
      illisibles.push(`row ${i + 1}: ${celex === undefined ? "no CELEX" : `CELEX ${citer(celex)} is not that of a regulation or a decision`}`);
      return;
    }
    let acte = parCelex.get(celex);
    if (acte === undefined) {
      const titre = valeurDeLigne(ligne, "title");
      if (titre === undefined) notes.push(`${numero} (${celex}) has no title in the answer`);
      acte = { celex, numero, titre: inerte(titre ?? "", LONGUEUR_TITRE_MAX), jours: new Set(), brutes: [] };
      parCelex.set(celex, acte);
    }
    const date = valeurDeLigne(ligne, "date");
    const jour = date === undefined ? null : jourDuCatalogue(date);
    if (jour !== null) acte.jours.add(jour);
    else acte.brutes.push(date === undefined ? "none" : citer(date));
  });
  const actes: ActeCatalogue[] = [];
  for (const a of parCelex.values()) {
    const jours = [...a.jours].sort();
    if (jours.length > 1) notes.push(`${a.numero} (${a.celex}) has several dates in the answer (${jours.join(", ")}): the earliest is kept`);
    if (jours.length === 0) notes.push(`the date of ${a.numero} (${a.celex}) is not read as a day: ${[...new Set(a.brutes)].join(", ")}`);
    actes.push({ celex: a.celex, numero: a.numero, titre: a.titre, date: jours[0] ?? null });
  }
  actes.sort((x, y) => (x.date ?? "9999-99-99").localeCompare(y.date ?? "9999-99-99") || x.celex.localeCompare(y.celex));
  const parNumero = new Map<string, string[]>();
  for (const a of actes) parNumero.set(a.numero, [...(parNumero.get(a.numero) ?? []), a.celex]);
  for (const [numero, celex] of parNumero) {
    if (celex.length > 1) notes.push(`${numero} is held by ${celex.length} CELEX in the answer (${celex.join(", ")}): the match is on the number, so one carried number would hide both`);
  }
  return { actes, illisibles, notes };
}

/** The question for one file, and what the file said when it was read. */
export type Question = {
  requete: string;
  /** the day the question starts at */
  debut: string;
  generationDate: string;
  newestPublicationDate: string;
  /** the acts the file names */
  fichier: ActeUe[];
};

/** Reads the file and builds the question, or says why the file cannot be used: not a complete EU export, or dates that cannot be trusted (the window would then be wrong, and a window that is wrong can hide an act). Pure. */
export function preparerQuestion(xml: string): Question | { refus: string } {
  const complet = lireFluxComplet(xml);
  if ("refus" in complet) return complet;
  const { lu, dates } = complet;
  if (dates.defaut !== undefined || dates.gen === null || dates.max === null) {
    return { refus: `its dates cannot be trusted (${dates.defaut ?? "no date"}), so the window of the question cannot be set` };
  }
  const debut = debutDeFenetre(dates.max);
  return { requete: requeteCatalogue(debut), debut, generationDate: dates.gen, newestPublicationDate: dates.max, fichier: lu.actes };
}

/** The answer set against the file. */
export type Controle = {
  /** acts read from the answer */
  catalogue: number;
  /** of them, the acts a numberTitle of the file carries */
  portes: number;
  /** the acts no numberTitle of the file carries, dated acts first */
  absents: ActeCatalogue[];
  illisibles: string[];
  notes: string[];
  /** the acts the file carries that are dated on its newest publication day (those with an act number): the answer must hold them all. `manquants` are the numbers it does not hold. */
  canari: { jour: string; total: number; manquants: string[] };
};

/** Sets the text of the catalogue's answer against the file of `q`. Pure. */
export function controler(q: Question, reponse: string): Controle | { refus: string } {
  const lecture = lireReponseCatalogue(reponse);
  if ("refus" in lecture) return lecture;
  const manquent = new Set(manquants(lecture.actes.map((a) => a.numero), q.fichier));
  const absents = lecture.actes.filter((a) => manquent.has(a.numero));
  const dansLaReponse = new Set(lecture.actes.map((a) => a.numero));
  const canaris = q.fichier.filter((a) => a.publicationDate === q.newestPublicationDate).map((a) => numerosDeLActe(a.numberTitle)).filter((n) => n.length > 0);
  const manquantsDuCanari = [...new Set(canaris.filter((n) => !n.some((x) => dansLaReponse.has(x))).map((n) => n[0]!))];
  return {
    catalogue: lecture.actes.length, portes: lecture.actes.length - absents.length, absents, illisibles: lecture.illisibles, notes: lecture.notes,
    canari: { jour: q.newestPublicationDate, total: canaris.length, manquants: manquantsDuCanari },
  };
}

/** Why the check cannot stand, or null when it can: an answer that does not hold the acts the file carries on its newest day is incomplete (whatever else it found); then rows that could not be read, or no act at all in common with the file, forbid "nothing is missing". */
export function refusDuControle(c: Controle): string | null {
  if (c.canari.manquants.length > 0) {
    const vus = c.canari.manquants.slice(0, 10).join(", ");
    const reste = c.canari.manquants.length > 10 ? ` and ${c.canari.manquants.length - 10} more` : "";
    return `Answer incomplete: the file carries ${c.canari.total} act(s) dated ${c.canari.jour}, its newest publication day, which lie in the window of the question, and the answer does not hold ${c.canari.manquants.length} of them (${vus}${reste}). It may be a partial answer, so nothing it says can show that no act is missing`;
  }
  if (c.absents.length > 0) return null;
  if (c.illisibles.length > 0) {
    return `${c.illisibles.length} row(s) of the answer could not be read as an act (${c.illisibles.slice(0, 3).join("; ")}), so the check cannot say that no act is missing`;
  }
  if (c.portes === 0) {
    return `No act of the answer is named by the file (the answer holds ${c.catalogue} act(s)), so it cannot show that the question works and cannot say that no act is missing`;
  }
  return null;
}

/** The exit code: 2 when the check cannot stand (an incomplete answer, rows not read, nothing in common with the file), 1 when an act is absent, 0 otherwise. */
export const codeDeSortie = (c: Controle): 0 | 1 | 2 => (refusDuControle(c) !== null ? 2 : c.absents.length > 0 ? 1 : 0);

/** What the command prints on standard output, line by line. `ecrit` is the file written (relative to where the command ran), null when none was. */
export function lignesDuRapport(q: Question, c: Controle, ecrit: string | null): string[] {
  const lignes = [
    "EU Journal watch: one question to the Publications Office catalogue; nothing of yours was sent.",
    `  File data/listes/eu.xml: generated ${q.generationDate}, newest publication ${q.newestPublicationDate}, ${q.fichier.length} act(s) named.`,
    `  Asked: acts titled as restrictive measures, dated ${q.debut} or later.`,
    `  Answer: ${c.catalogue} act(s), ${c.portes} of them named by the file.`,
    ...c.absents.map((a) => `ABSENT ${a.numero} (CELEX ${a.celex}, ${a.date ?? "date unknown"}): ${a.titre}`),
    ...c.illisibles.map((x) => `UNREADABLE ${x}`),
    ...c.notes.map((x) => `NOTE ${x}`),
  ];
  lignes.push(c.absents.length > 0
    ? `${c.absents.length} act(s) of the answer are named by no numberTitle of the file. Each is named, none is a verdict: an act titled this way can renew or amend a regime and add no listing; read the act before concluding anything.`
    : "Every act of the answer is named in the file.");
  if (ecrit !== null) lignes.push(`Written: ${ecrit}`);
  return lignes;
}

/** Where the members of the top level object of a JSON text sit. The text has been parsed already, so its syntax is valid: this only finds positions, it validates nothing. `fin` is the position of the closing brace of the object. */
function membresDuNiveauHaut(t: string): { membres: { cle: string; debutCle: number; debutValeur: number; finValeur: number }[]; ouverture: number; fin: number } {
  const membres: { cle: string; debutCle: number; debutValeur: number; finValeur: number }[] = [];
  const ouverture = t.indexOf("{");
  let i = ouverture + 1;
  const blancs = (): void => { while (i < t.length && /\s/.test(t[i]!)) i++; };
  const chaine = (): void => { i++; while (t[i] !== '"') i += t[i] === "\\" ? 2 : 1; i++; };
  const valeur = (): void => {
    if (t[i] === '"') { chaine(); return; }
    if (t[i] === "{" || t[i] === "[") {
      let profondeur = 0;
      for (;;) {
        const c = t[i]!;
        if (c === '"') { chaine(); continue; }
        if (c === "{" || c === "[") profondeur++;
        else if (c === "}" || c === "]") profondeur--;
        i++;
        if (profondeur === 0) return;
      }
    }
    while (i < t.length && !/[\s,}\]]/.test(t[i]!)) i++;
  };
  for (;;) {
    blancs();
    if (t[i] === "}") break;
    if (t[i] === ",") { i++; continue; }
    const debutCle = i;
    chaine();
    const cle = JSON.parse(t.slice(debutCle, i)) as string;
    blancs(); i++; blancs();
    const debutValeur = i;
    valeur();
    membres.push({ cle, debutCle, debutValeur, finValeur: i });
  }
  return { membres, ouverture, fin: i };
}

/** The text of a day file with `actes_absents` set to `liste` and every other byte as it was: the value is replaced in place (the last one, if the key is given twice, as JSON.parse reads it) or added after the last member, in the file's own indentation. */
function avecActesAbsents(texte: string, liste: unknown[]): string {
  const { membres, ouverture, fin } = membresDuNiveauHaut(texte);
  const retraitAvant = (debut: number): string | undefined => /\n([ \t]*)$/.exec(texte.slice(0, debut))?.[1];
  const valeur = (retrait: string | undefined): string => (retrait === undefined ? JSON.stringify(liste) : JSON.stringify(liste, null, 2).replace(/\n/g, `\n${retrait}`));
  const present = membres.filter((m) => m.cle === "actes_absents").at(-1);
  if (present !== undefined) return texte.slice(0, present.debutValeur) + valeur(retraitAvant(present.debutCle)) + texte.slice(present.finValeur);
  if (membres.length === 0) return `${texte.slice(0, ouverture + 1)}\n  "actes_absents": ${valeur("  ")}\n${texte.slice(fin)}`;
  const dernier = membres.at(-1)!;
  const retrait = retraitAvant(membres[0]!.debutCle);
  const ajout = retrait === undefined ? `, "actes_absents": ${valeur(undefined)}` : `,\n${retrait}"actes_absents": ${valeur(retrait)}`;
  return texte.slice(0, dernier.finValeur) + ajout + texte.slice(dernier.finValeur);
}

/**
 * Writes the absent acts to donnees/listes/<jour>.json under `racine` (where the command was run): the key `actes_absents`, a list
 * of { celex, numero, titre, date }, and nothing else of its own. `jour` must be a day of the calendar, checked before any path is
 * built (a "../" in it would write outside the folder). A file of that day that already exists is NOT re-serialized: its text is
 * kept byte for byte, indentation, large numbers and escapes included, and only the value of `actes_absents` is replaced or
 * added, so a block written by hand (the listes role's `ue_2193`) is never touched. A file that is not a JSON object is left as it
 * was and refused. Returns the path relative to `racine`.
 */
export function ecrireActesAbsents(racine: string, jour: string, absents: readonly ActeCatalogue[]): { chemin: string } | { refus: string } {
  if (!estUnJour(jour)) return { refus: `${citer(jour)} is not a day of the calendar, so no file is written` };
  const relatif = `donnees/listes/${jour}.json`;
  const dossier = join(racine, "donnees", "listes");
  const chemin = join(dossier, `${jour}.json`);
  const liste = absents.map((a) => ({ celex: a.celex, numero: a.numero, titre: a.titre, date: a.date }));
  try {
    let texte: string;
    if (existsSync(chemin)) {
      const original = readFileSync(chemin, "utf8");
      let lu: unknown;
      try { lu = JSON.parse(original); } catch { lu = undefined; }
      if (typeof lu !== "object" || lu === null || Array.isArray(lu)) return { refus: `${relatif} is not a JSON object, so actes_absents cannot be added to it` };
      texte = avecActesAbsents(original, liste);
      /* the new text must say what was meant and must leave every other key as it was read */
      const apres = JSON.parse(texte) as Record<string, unknown>;
      const avant = lu as Record<string, unknown>;
      if (JSON.stringify(apres["actes_absents"]) !== JSON.stringify(liste) || Object.keys(avant).some((k) => k !== "actes_absents" && JSON.stringify(apres[k]) !== JSON.stringify(avant[k]))) {
        return { refus: `${relatif} cannot be added to without changing another key, so it is left as it was` };
      }
    } else {
      texte = JSON.stringify({ actes_absents: liste }, null, 2) + "\n";
    }
    mkdirSync(dossier, { recursive: true });
    const provisoire = `${chemin}.tmp`;
    writeFileSync(provisoire, texte);
    renameSync(provisoire, chemin);
    return { chemin: relatif };
  } catch (e) {
    return { refus: `${relatif} cannot be written (${(e as NodeJS.ErrnoException).code ?? "unknown error"})` };
  }
}

/**
 * The act numbers of the file's own year, each once, in numeric order: what the EU row of the manifest records (public, short).
 * The year is the one of the file's generationDate, read and not typed; null when the file carries none. Pure.
 */
export function actesDeLAnnee(xml: string): string[] | null {
  const gen = lireDatesUe(xml).gen;
  if (gen === null) return null;
  const debut = `${gen.slice(0, 4)}/`;
  const numeros = new Set<string>();
  for (const a of actesDuFlux(xml)) for (const n of numerosDeLActe(a.numberTitle)) if (n.startsWith(debut)) numeros.add(n);
  return [...numeros].sort((a, b) => Number(a.split("/")[1]) - Number(b.split("/")[1]));
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
