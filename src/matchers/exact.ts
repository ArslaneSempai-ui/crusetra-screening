/**
 * PALIER 1 — L'ÉGALITÉ APRÈS NORMALISATION, ET RIEN D'AUTRE.
 *
 * Le palier le plus bête est aussi le plus lisible : 1 ou 0, jamais entre. Il rate « Smith
 * John », « Jhon », « J. Smith » — c'est VOULU, chaque palier au-dessus existe pour l'une de
 * ces paires, et la frontière mesurée montre ce que chacune coûte en alertes.
 */
import type { Matcher } from "../matcher.ts";
import { preparer } from "./preparer.ts";

export const exact: Matcher = {
  id: "exact",
  description: "equality after normalisation: case, diacritics, punctuation, spacing",
  rang: 1,
  score: (a, b) => (preparer(a) === preparer(b) ? 1 : 0),
};
