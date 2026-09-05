/**
 * PALIER 2 — LES JETONS, SANS ORDRE, AVEC LES INITIALES.
 *
 * « Smith John » et « John Smith » sont le même nom écrit dans deux traditions d'état
 * civil ; « J. Smith » est ce que les listes internes portent le plus souvent. Jaccard sur
 * l'ensemble des jetons règle le premier ; la règle des initiales règle le second : un jeton
 * d'UNE lettre s'apparie à un jeton entier qui commence par elle.
 *
 * L'appariement est calculé sur les jetons TRIÉS des deux côtés, et la règle est la même
 * dans les deux sens — sans quoi score(a,b) et score(b,a) divergeraient sur une paire à
 * plusieurs candidats, et la symétrie promise par le registre serait un mensonge à une
 * paire près.
 *
 * Jaccard avec appariements : m / (|A| + |B| − m). Deux ensembles entièrement appariés
 * rendent 1 ; sans jeton commun, 0.
 */
import type { Matcher } from "../matcher.ts";
import { preparer } from "./preparer.ts";
import { jetons } from "./normaliser.ts";

/** Le nombre d'appariements entre deux listes de jetons : égalité d'abord, initiales ensuite. */
export function appariements(a: readonly string[], b: readonly string[]): number {
  const resteA = [...a].sort();
  const resteB = [...b].sort();
  let m = 0;
  /* Égalité exacte d'abord — un jeton consommé ne sert qu'une fois. */
  for (let i = 0; i < resteA.length; i++) {
    const j = resteB.indexOf(resteA[i]!);
    if (j >= 0) { m++; resteA.splice(i, 1); resteB.splice(j, 1); i--; }
  }
  /* Puis les initiales, dans les deux sens : « j » ↔ « john ». */
  for (let i = 0; i < resteA.length; i++) {
    const x = resteA[i]!;
    const j = resteB.findIndex((y) =>
      (x.length === 1 && y.length > 1 && y.startsWith(x))
      || (y.length === 1 && x.length > 1 && x.startsWith(y)));
    if (j >= 0) { m++; resteB.splice(j, 1); resteA.splice(i, 1); i--; }
  }
  return m;
}

export const tokens: Matcher = {
  id: "tokens",
  description: "token sets: order-free Jaccard, with initials matching whole names",
  rang: 2,
  score: (a, b) => {
    const ja = jetons(preparer(a)), jb = jetons(preparer(b));
    if (ja.length === 0 && jb.length === 0) return 1;
    if (ja.length === 0 || jb.length === 0) return 0;
    const m = appariements(ja, jb);
    return m / (ja.length + jb.length - m);
  },
};
