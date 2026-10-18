/**
 * THE EU SUPPLEMENT: entries the Official Journal has published and the EU consolidated feed does not carry yet.
 *
 * Today it holds one act: Council Implementing Regulation (EU) 2026/2193 of 28 September 2026 (OJ L, 28.9.2026, CELEX
 * 32026R2193), which adds ten natural persons to Annex IV (entries 99 to 108) of Regulation (EU) 2024/1485. The feed's
 * last entry publication was 23 July 2026 when this was written (18 October 2026).
 *
 * TRANSCRIBED, NOT GUESSED. Every name, alias and date of birth below is copied from the English text of the act as the
 * Publications Office served it on 18 October 2026; src/fixtures/ue-2026-2193-annex-iv.txt holds the verbatim text of
 * entries 99 to 108, src/fixtures/ue-2026-2193-source.json the address and the sha256 of the whole document, and
 * src/complement-ue.test.ts checks that each value below occurs in that text. A field the act does not print stays
 * absent: the act prints no alias in Latin script, so `alias` holds only the Cyrillic form it prints beside the name.
 * The place of birth, printed for two entries, is not carried: the engine compares names only.
 *
 * WHEN THE FEED CATCHES UP the supplement entry is dropped from the screening by itself (`sansCeuxDuFlux`), so a person
 * is never a hit twice. The rule is stated there.
 */
import type { EntreeListe } from "./listes.ts";
import { jetonsEntite } from "./preparation.ts";

export const CELEX_2193 = "32026R2193";
export const ANNEXE_2193 = "IV";
/** The number the feed writes in `numberTitle` for this act (« 2026/2193 (OJ L…) »). */
export const REGLEMENT_2193 = "2026/2193";
export const URL_2193 = `https://publications.europa.eu/resource/celex/${CELEX_2193}`;
/** The day the text was read. */
export const LU_LE_2193 = "2026-10-18";
/** The « Date of listing » column, as printed. */
export const DATE_INSCRIPTION_2193 = "28.9.2026";

export type Complement = { celex: string; annexe: string; entree: number; luLe: string; url: string };

/** One row of the annex, as printed: the name, the Cyrillic form beside it, the date of birth (day.month.year, no zero padding). */
export type LigneComplement = { entree: number; nom: string; alias: string[]; naissance: string };

export const LIGNES_2193: readonly LigneComplement[] = [
  { entree: 99, nom: "[name removed]", alias: ["[name removed]"], naissance: "22.6.1966" },
  { entree: 100, nom: "[name removed]", alias: ["[name removed]"], naissance: "25.3.1971" },
  { entree: 101, nom: "[name removed]", alias: ["[name removed]"], naissance: "25.4.1971" },
  { entree: 102, nom: "[name removed]", alias: ["[name removed]"], naissance: "15.11.1987" },
  { entree: 103, nom: "[name removed]", alias: ["[name removed]"], naissance: "15.8.1986" },
  { entree: 104, nom: "[name removed]", alias: ["[name removed]"], naissance: "1.3.1973" },
  { entree: 105, nom: "[name removed]", alias: ["[name removed]"], naissance: "9.4.1998" },
  { entree: 106, nom: "[name removed]", alias: ["[name removed]"], naissance: "30.5.1996" },
  { entree: 107, nom: "[name removed]", alias: ["[name removed]"], naissance: "25.7.1995" },
  { entree: 108, nom: "[name removed]", alias: ["[name removed]"], naissance: "18.10.1984" },
];

export const idComplement = (entree: number): string => `OJ-${CELEX_2193}-${ANNEXE_2193}-${entree}`;

/** The supplement as list entries, ready to be screened with the EU list. */
export function entreesComplementUe(): EntreeListe[] {
  return LIGNES_2193.map((l) => ({
    source: "EU" as const, id: idComplement(l.entree), nom: l.nom, alias: [...l.alias], type: "person" as const,
    programme: "2024/1485 Annex IV",
    designation: {
      date: DATE_INSCRIPTION_2193,
      champ: `Date of listing; entry from the Official Journal (CELEX ${CELEX_2193}, Annex ${ANNEXE_2193}, entry ${l.entree}, read ${LU_LE_2193}), not from the EU feed`,
    },
    complement: { celex: CELEX_2193, annexe: ANNEXE_2193, entree: l.entree, luLe: LU_LE_2193, url: URL_2193 },
  }));
}

/** A name as the engine reads it (its own preparation and tokens), word order ignored: « KIRILLOV Vyacheslav » = « [name removed] ». */
const cleDuNom = (nom: string): string => jetonsEntite(nom).sort().join(" ");

/** The act's number at the head of a `numberTitle` of the feed, e.g. « 2026/2193 (OJ L, 2026/2193, 28.9.2026) ». */
const portePourReglement = (titre: string): boolean => new RegExp(`^\\s*${REGLEMENT_2193.replace("/", "\\/")}(?![\\d/])`).test(titre);

/**
 * WHEN IS A SUPPLEMENT ENTRY THE SAME ENTRY AS ONE OF THE FEED? When an EU feed entity (a) records the act as one of its
 * regulations (`numberTitle` of a `<regulation>` starts with « 2026/2193 »; the feed has no CELEX, no annex number and no
 * publication address, only that number, the programme and the dates) AND (b) has a name or alias that is the entry's
 * name under the engine's own preparation (`jetonsEntite`: case, accents, punctuation, transliteration, word order). Both
 * together: the act alone would drop all ten the day the feed carried one of them; a name alone would drop an entry
 * because someone else of the same name was listed under another act.
 */
export function sansCeuxDuFlux(supplement: readonly EntreeListe[], flux: readonly EntreeListe[]): { gardees: EntreeListe[]; dansLeFlux: EntreeListe[] } {
  const clesDuFlux = new Set<string>();
  for (const e of flux) {
    if (e.source !== "EU" || e.complement || !(e.reglements ?? []).some(portePourReglement)) continue;
    for (const n of [e.nom, ...e.alias]) clesDuFlux.add(cleDuNom(n));
  }
  const gardees: EntreeListe[] = [];
  const dansLeFlux: EntreeListe[] = [];
  for (const s of supplement) (clesDuFlux.has(cleDuNom(s.nom)) ? dansLeFlux : gardees).push(s);
  return { gardees, dansLeFlux };
}

/** The entry numbers as a short text: « 99 to 108 » when they run on, else « 99, 101 ». */
export function numerosEnTexte(entrees: readonly number[]): string {
  const n = [...entrees].sort((a, b) => a - b);
  return n.every((v, i) => i === 0 || v === n[i - 1]! + 1) && n.length > 1 ? `${n[0]} to ${n[n.length - 1]}` : n.join(", ");
}

/** What a screening record says it added: the sentence of the list coverage line. */
export type CouvertureComplement = { celex: string; annexe: string; url: string; luLe: string; entrees: number[]; dejaDansLeFlux: number[] };

export function phraseCouverture(c: CouvertureComplement): string {
  const reste = `${c.entrees.length} EU ${c.entrees.length > 1 ? "entries" : "entry"} (Council Implementing Regulation (EU) ${REGLEMENT_2193}, CELEX ${c.celex}, Annex ${c.annexe}, `
    + `${c.entrees.length > 1 ? "entries" : "entry"} ${numerosEnTexte(c.entrees)}) come from the Official Journal, read on ${c.luLe}, and not from the EU feed, which does not carry ${c.entrees.length > 1 ? "them" : "it"} yet; `
    + `each hit on one says so.`;
  return c.dejaDansLeFlux.length > 0
    ? `${reste} Of the same act, ${c.dejaDansLeFlux.length > 1 ? "entries" : "entry"} ${numerosEnTexte(c.dejaDansLeFlux)} ${c.dejaDansLeFlux.length > 1 ? "are" : "is"} already in the feed and read from it.`
    : reste;
}
