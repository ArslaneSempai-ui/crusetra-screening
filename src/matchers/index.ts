/**
 * LE REGISTRE — ce que le lot des matchers livre à la mesure, et la seule porte d'entrée.
 *
 * SIX PALIERS CE SOIR, PAS SEPT : `embed` (le petit modèle local, poids épinglés comme les
 * encodeurs de cascade-routing) n'y est pas encore, et le registre le DIT par son contenu
 * plutôt que de le laisser découvrir — un témoin affirme exactement quels identifiants sont
 * présents, et la mesure du lot R3 compose avec un palier absent.
 *
 * Chaque score passe par `exigerScore` À LA SORTIE DU REGISTRE : un matcher qui rendrait
 * NaN ou 1,2 est un défaut nommé chez lui, jamais une valeur qui voyage jusqu'au rapport.
 * La garde est ici, une fois, plutôt que recopiée dans sept fichiers.
 */
import { exigerScore, type Matcher, type PalierId, type Registre } from "../matcher.ts";
import { exact } from "./exact.ts";
import { tokens } from "./tokens.ts";
import { jaroWinkler } from "./jaro-winkler.ts";
import { damerau } from "./damerau.ts";
import { phonetic } from "./phonetic.ts";
import { ngrams } from "./ngrams.ts";

/** Les paliers livrés ce soir, dans l'ordre du coût. */
const LIVRES: readonly Matcher[] = [exact, tokens, jaroWinkler, damerau, phonetic, ngrams];

const garde = (m: Matcher): Matcher => ({
  id: m.id,
  description: m.description,
  rang: m.rang,
  score: (a, b) => exigerScore(m.score(a, b), m.id, a, b),
});

/** Le registre : Map palier → matcher, chaque score borné à la sortie. */
export function registre(): Registre {
  return new Map<PalierId, Matcher>(LIVRES.map((m) => [m.id, garde(m)]));
}
