/**
 * LA COUTURE ENTRE LES LOTS : ce que tout matcher promet, et rien de plus.
 *
 * Trois lots construisent en parallèle : les matchers (src/matchers/), les listes et les
 * variantes synthétiques (listes.ts, synthetic.ts), la mesure et la frontière (your-alerts.ts,
 * optimise.ts). Ils ne se parlent que par ce fichier. Une interface décrite en prose est une
 * intention ; celle-ci est du code, et les tests des trois lots l'importent.
 *
 * Un matcher rend un SCORE dans [0, 1] pour deux noms, déterministe, sans réseau, sans état.
 * Le seuil n'est pas dans le matcher : il est balayé par la mesure (SEUILS), parce que la
 * question de l'outil est précisément « à quel seuil ».
 */

export type Score = number;   /* dans [0, 1] ; 1 = identiques après normalisation */

export interface Matcher {
  /** identifiant stable, celui du contrat : "exact", "tokens", "jaro-winkler", "damerau",
   *  "phonetic", "ngrams", "embed" */
  readonly id: PalierId;
  /** une phrase, pour le rapport : ce que le palier fait, sans jargon */
  readonly description: string;
  /** le coût relatif, du plus bête (1) au plus cher (7) ; sert à ordonner la frontière */
  readonly rang: number;
  score(a: string, b: string): Score;
  /**
   * FACULTATIF, et seul `embed` le porte : un passage dans un réseau de neurones n'est pas
   * synchrone, donc un palier neuronal reçoit TOUS les noms d'un coup ici, calcule ses
   * vecteurs, et `score` sert ensuite depuis ce cache : synchrone, déterministe, comme les
   * six autres. Un consommateur appelle `await m.rechauffer?.(noms)` avant de noter ; les
   * paliers de chaînes n'ont pas ce membre et rien ne change pour eux. Ajout ADDITIF à la
   * couture, annoncé au chef dans ETAT et le message de livraison du lot E.
   */
  rechauffer?(noms: readonly string[]): Promise<void>;
}

/** Les paliers du contrat, dans l'ordre du coût. `human` n'est pas un matcher : c'est
 *  l'analyste, supposé puis mesurable avec measure:humans de cascade-routing. */
export const PALIERS = ["exact", "tokens", "jaro-winkler", "damerau", "phonetic", "ngrams", "embed"] as const;
export type PalierId = (typeof PALIERS)[number];

/** La grille de seuils balayée par la mesure : 0,50 → 1,00 par pas de 0,01, arrondie au
 *  centième pour que deux lots qui la recalculent obtiennent les MÊMES nombres. */
export const SEUILS: readonly number[] = Array.from({ length: 51 }, (_, i) => Math.round((0.5 + i * 0.01) * 100) / 100);

/** Un score hors de [0, 1] est un défaut du matcher, pas une valeur : on le nomme. */
export function exigerScore(s: number, id: string, a: string, b: string): Score {
  if (!Number.isFinite(s) || s < 0 || s > 1) {
    throw new Error(`matcher "${id}" returned ${s} for a pair of names; a score lives in [0, 1].`);
  }
  return s;
}

/** Le registre : le lot des matchers l'alimente dans src/matchers/index.ts ; la mesure
 *  l'importe. Vide au départ, et un test du lot exige qu'il porte les sept paliers. */
export type Registre = ReadonlyMap<PalierId, Matcher>;
