/**
 * PALIER 3 — JARO-WINKLER : la similarité qui favorise le préfixe.
 *
 * La forme classique : Jaro (caractères communs dans une fenêtre de la moitié de la plus
 * longue chaîne, transpositions comptées demi), puis la prime de Winkler — jusqu'à quatre
 * caractères de préfixe commun, facteur 0,1. C'est le matcher historique des moteurs de
 * screening, et il est ici pour être MESURÉ contre les autres, pas présumé meilleur.
 *
 * Il est appliqué au nom ENTIER préparé, espaces comprises : « Smith John » contre
 * « John Smith » le met en difficulté, et c'est une information que la frontière doit
 * montrer — pas un défaut à maquiller en le passant par jetons.
 */
import type { Matcher } from "../matcher.ts";
import { preparer } from "./preparer.ts";

/** Jaro seul, exporté pour que le témoin puisse le confronter aux valeurs canoniques. */
export function jaro(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  const fenetre = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const prisB = new Array<boolean>(b.length).fill(false);
  const communsA: string[] = [];
  for (let i = 0; i < a.length; i++) {
    const de = Math.max(0, i - fenetre), a_ = Math.min(b.length, i + fenetre + 1);
    for (let j = de; j < a_; j++) {
      if (!prisB[j] && a[i] === b[j]) { prisB[j] = true; communsA.push(a[i]!); break; }
    }
  }
  const m = communsA.length;
  if (m === 0) return 0;
  let t = 0, k = 0;
  for (let j = 0; j < b.length; j++) {
    if (prisB[j]) { if (b[j] !== communsA[k]) t++; k++; }
  }
  t /= 2;
  return (m / a.length + m / b.length + (m - t) / m) / 3;
}

export const jaroWinkler: Matcher = {
  id: "jaro-winkler",
  description: "string similarity favouring the common prefix, the screening classic",
  rang: 3,
  score: (a, b) => {
    const x = preparer(a), y = preparer(b);
    const j = jaro(x, y);
    let prefixe = 0;
    while (prefixe < 4 && prefixe < x.length && prefixe < y.length && x[prefixe] === y[prefixe]) prefixe++;
    return j + prefixe * 0.1 * (1 - j);
  },
};
