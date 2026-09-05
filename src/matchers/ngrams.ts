/**
 * PALIER 6 — COSINUS SUR TRIGRAMMES DE CARACTÈRES, COMPTES BRUTS.
 *
 * Le nom préparé est bordé d'espaces puis découpé en fenêtres de trois caractères ; deux
 * noms sont deux vecteurs de comptes, le score est leur cosinus. Robuste à l'ordre partiel
 * et aux petites éditions, aveugle à ce que les trigrammes ne voient pas.
 *
 * COMPTES BRUTS, PAS D'IDF : pondérer par la rareté demande un corpus — lequel ? Les listes
 * publiques du lot R2 n'existent pas encore ce soir, et un IDF appris sur un corpus non
 * déclaré serait un chiffre dont personne ne peut dire d'où il vient. Le contrat nomme ce
 * palier « TF-IDF » ; ce fichier livre le TF et DIT qu'il manque l'IDF — la pondération
 * pourra venir avec le manifeste des listes, déclarée, ou ne pas venir si la mesure montre
 * qu'elle ne paie pas.
 *
 * Un nom plus court que trois caractères une fois bordé (une initiale seule) rend son
 * unique fenêtre disponible : « j » borde en « j » de trois caractères exactement. Rien
 * n'est un cas spécial silencieux.
 */
import type { Matcher } from "../matcher.ts";
import { preparer } from "./preparer.ts";

/** Les trigrammes du nom bordé, avec leurs comptes. Exporté pour le témoin. */
export function trigrammes(prepare: string): Map<string, number> {
  const borde = ` ${prepare} `;
  const comptes = new Map<string, number>();
  for (let i = 0; i + 3 <= borde.length; i++) {
    const g = borde.slice(i, i + 3);
    comptes.set(g, (comptes.get(g) ?? 0) + 1);
  }
  return comptes;
}

export const ngrams: Matcher = {
  id: "ngrams",
  description: "cosine over character trigram counts — term frequency only, no IDF without a declared corpus",
  rang: 6,
  score: (a, b) => {
    const x = preparer(a), y = preparer(b);
    /* L'ÉGALITÉ EN COURT-CIRCUIT, ET CE N'EST PAS UNE OPTIMISATION : le cosinus de deux
       vecteurs identiques rend 0,9999999999999998 en flottant, et au seuil 1,00 de la
       grille SEUILS ce palier aurait RATÉ un nom identique à lui-même. Trouvé par le
       témoin « identiques → 1 », pas par une relecture. */
    if (x === y) return 1;
    const ga = trigrammes(x), gb = trigrammes(y);
    if (ga.size === 0 || gb.size === 0) return 0;
    let produit = 0;
    for (const [g, n] of ga) produit += n * (gb.get(g) ?? 0);
    const norme = (m: Map<string, number>) => Math.sqrt([...m.values()].reduce((s, n) => s + n * n, 0));
    /* Borné : le flottant peut dépasser 1 d'un epsilon, et `exigerScore` a raison de refuser
       1,0000000000000002 — le défaut serait ici, pas chez lui. */
    return Math.min(1, produit / (norme(ga) * norme(gb)));
  },
};
