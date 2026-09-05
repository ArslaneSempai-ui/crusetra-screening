/**
 * PALIER 5 — UNE CLÉ PHONÉTIQUE DE TYPE METAPHONE, SUR LE LATIN TRANSLITTÉRÉ.
 *
 * « Smith » et « Smyth », « Jon » et « John » : la clé jette ce que l'oreille ne retient
 * pas — les voyelles après la première position, les doublons, quelques digraphes anglais —
 * et garde un squelette de consonnes. Clés égales → 1 ; sinon, similarité d'édition des
 * clés, pour qu'un squelette à une consonne près ne tombe pas à zéro d'un coup.
 *
 * CE QUE LA CLÉ NE SAIT PAS, écrit plutôt que découvert en production :
 *
 *   — c'est une phonétique de l'ANGLAIS ÉCRIT, appliquée à du latin translittéré : « J »
 *     rend le même squelette pour « Juan » et « John », que l'espagnol prononce autrement ;
 *   — deux noms COURTS et sans rapport peuvent partager un squelette (« Lee » / « Loo ») :
 *     la clé rapproche, elle ne distingue pas — c'est le rôle du seuil mesuré ;
 *   — elle vaut ce que vaut la translittération en amont : sur un nom que les tables ne
 *     couvrent pas (sinogrammes), la clé travaille sur des caractères qu'elle ignore et
 *     rend une clé vide — deux clés vides sont traitées comme SANS AVIS (score 0), jamais
 *     comme identiques.
 */
import type { Matcher } from "../matcher.ts";
import { preparer } from "./preparer.ts";
import { jetons } from "./normaliser.ts";
import { distanceOsa } from "./damerau.ts";

/** La clé d'UN jeton latin. Exportée pour le témoin. */
export function clePhonetique(jeton: string): string {
  let s = jeton.replace(/[^a-z]/g, "");
  if (s === "") return "";
  /* Débuts muets de l'anglais écrit. */
  s = s.replace(/^(kn|gn|pn|wr)/, (x) => x[1]!).replace(/^x/, "s").replace(/^wh/, "w");
  /* Digraphes, avant la boucle : chacun rend UNE consonne. */
  s = s.replace(/sch/g, "sk").replace(/ph/g, "f").replace(/th/g, "0")
    .replace(/sh/g, "x").replace(/ch/g, "x").replace(/gh/g, "");
  let cle = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (c === s[i + 1]) continue;                    /* doublons : « nn » → « n » */
    if ("aeiou".includes(c)) { if (i === 0) cle += "a"; continue; }  /* voyelles : la première seulement, neutralisée */
    if (c === "c") { cle += "ei".includes(s[i + 1] ?? "") ? "s" : "k"; continue; }
    if (c === "g") { cle += "ei".includes(s[i + 1] ?? "") ? "j" : "k"; continue; }
    if (c === "q") { cle += "k"; continue; }
    if (c === "z") { cle += "s"; continue; }
    if (c === "v") { cle += "f"; continue; }
    if (c === "d") { cle += s[i + 1] === "g" ? "j" : "t"; continue; }
    if (c === "w" || c === "h" || c === "y") {
      if ("aeiou".includes(s[i + 1] ?? "")) cle += c;   /* gardés seulement devant voyelle */
      continue;
    }
    cle += c;
  }
  return cle;
}

/** La clé d'un nom : une clé par jeton, jointes par espace — l'ordre reste une information. */
export function cleDuNom(prepare: string): string {
  return jetons(prepare).map(clePhonetique).filter((k) => k !== "").join(" ");
}

export const phonetic: Matcher = {
  id: "phonetic",
  description: "a Metaphone-style consonant skeleton on transliterated Latin",
  rang: 5,
  score: (a, b) => {
    const ka = cleDuNom(preparer(a)), kb = cleDuNom(preparer(b));
    /* Deux clés vides : la phonétique n'a RIEN LU (script hors tables). Sans avis, pas
       « identiques » — un 1 ici ferait converger deux noms chinois quelconques. */
    if (ka === "" && kb === "") return 0;
    if (ka === kb) return 1;
    const plusLong = Math.max(ka.length, kb.length);
    return plusLong === 0 ? 0 : 1 - distanceOsa(ka, kb) / plusLong;
  },
};
