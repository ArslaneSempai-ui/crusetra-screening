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
import { embed, rechaufferEmbed } from "./embed.ts";
import { poidsSurPlace } from "../poids.ts";
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

/**
 * LE REGISTRE COMPLET : les six paliers synchrones, plus `embed` QUAND ses poids sont sur
 * le disque. Deux entrées plutôt qu'une, et la raison est un consommateur réel : la mesure
 * de l'historique client (your-alerts.ts) note sans réchauffer — `embed` dans SON registre
 * planterait chez un client dont les poids sont là. `registre()` reste donc exactement ce
 * qu'il était ; celui-ci est pour les appelants qui font leur part :
 *
 *     const r = registreComplet();
 *     for (const m of r.values()) await m.rechauffer?.(tousLesNoms);
 *
 * Adopter embed côté client tient à cette ligne-là, chez le propriétaire de your-alerts.
 * Poids absents : sept moins un, et l'absent reste nommé par PALIERS moins les présents.
 */
export function registreComplet(): Registre {
  const base = LIVRES.map((m) => [m.id, garde(m)] as const);
  if (poidsSurPlace()) {
    const avecChauffe: Matcher = { ...garde(embed), rechauffer: (noms) => rechaufferEmbed(noms) };
    return new Map<PalierId, Matcher>([...base, [embed.id, avecChauffe]]);
  }
  return new Map<PalierId, Matcher>(base);
}
