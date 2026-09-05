/**
 * PALIER 4 — DAMERAU-LEVENSHTEIN NORMALISÉ : 1 − distance / longueur max.
 *
 * La variante OSA (alignement optimal de chaînes), DITE plutôt que découverte : une
 * transposition adjacente compte UN, mais une sous-chaîne ne peut pas être éditée deux
 * fois — « ca » → « abc » coûte 3 ici où le Damerau complet dit 2. Sur des noms de
 * personnes, l'écart ne se présente pas ; sur le coût, OSA est en O(n·m) sans table
 * d'alphabet, et c'est le compromis que ce fichier assume par écrit.
 */
import type { Matcher } from "../matcher.ts";
import { preparer } from "./preparer.ts";

/** La distance OSA, exportée pour le témoin et pour la clé phonétique. */
export function distanceOsa(a: string, b: string): number {
  const n = a.length, m = b.length;
  if (n === 0) return m;
  if (m === 0) return n;
  let avantAvant = new Array<number>(m + 1).fill(0);
  let avant = Array.from({ length: m + 1 }, (_, j) => j);
  for (let i = 1; i <= n; i++) {
    const courant = new Array<number>(m + 1).fill(0);
    courant[0] = i;
    for (let j = 1; j <= m; j++) {
      const cout = a[i - 1] === b[j - 1] ? 0 : 1;
      courant[j] = Math.min(avant[j]! + 1, courant[j - 1]! + 1, avant[j - 1]! + cout);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        courant[j] = Math.min(courant[j]!, avantAvant[j - 2]! + 1);
      }
    }
    avantAvant = avant; avant = courant;
  }
  return avant[m]!;
}

export const damerau: Matcher = {
  id: "damerau",
  description: "edit distance with adjacent transpositions, normalised by the longer name",
  rang: 4,
  score: (a, b) => {
    const x = preparer(a), y = preparer(b);
    if (x.length === 0 && y.length === 0) return 1;
    const plusLong = Math.max(x.length, y.length);
    return 1 - distanceOsa(x, y) / plusLong;
  },
};
