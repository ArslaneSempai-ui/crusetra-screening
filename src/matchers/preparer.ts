/**
 * LE PIPELINE QUE CHAQUE PALIER APPLIQUE, UNE FOIS, AU MÊME ENDROIT.
 *
 * Minuscules et diacritiques d'abord, translittération ensuite, frontières de jetons à la
 * fin — l'ordre compte : les tables de translittération sont écrites en minuscules, et le
 * retrait des marques combinantes doit précéder la table arabe pour que les harakat ne
 * s'interposent pas entre deux lettres qu'elle lit.
 *
 * Chaque matcher passe par ici plutôt que d'assembler les trois gestes lui-même : sept
 * assemblages divergeraient au premier correctif — c'est la famille « une seconde copie de
 * ce qu'un autre mécanisme détermine », déjà payée ailleurs dans cette maison.
 */
import { normaliser } from "./normaliser.ts";
import { translitterer } from "./translitteration.ts";

export function preparer(nom: string): string {
  return normaliser(translitterer(normaliser(nom)));
}
