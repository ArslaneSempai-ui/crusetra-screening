/**
 * LA NORMALISATION QUE TOUS LES PALIERS PARTAGENT — et rien de plus qu'elle.
 *
 * Quatre gestes, chacun parce qu'une paire réelle l'exige : la casse (« SMITH » filtre
 * « Smith ») ; les diacritiques par décomposition NFD puis retrait des marques combinantes
 * (« José Núñez » et « jose nunez » sont le même nom pour une liste de sanctions — et le
 * retrait par décomposition couvre AUSSI les harakat arabes, qui sont des marques
 * combinantes) ; la ponctuation en espace (« O'Brien », « Al-Rashid », « J. » : le point de
 * l'initiale devient une frontière de jeton, pas un caractère du nom) ; les espaces
 * multiples repliés.
 *
 * L'ORDRE DES JETONS N'EST PAS TOUCHÉ, délibérément : « Smith John » contre « John Smith »
 * est exactement la question que le palier `tokens` existe pour poser. Une normalisation qui
 * trierait les jetons donnerait raison à `exact` sur une paire qu'il doit rater, et la
 * frontière mesurée mentirait sur ce que chaque palier sait faire.
 */

/** Un nom, prêt pour la comparaison : minuscules, sans diacritiques, ponctuation en espace. */
export function normaliser(nom: string): string {
  return nom
    .toLowerCase()
    .normalize("NFD")
    /* Toutes les marques combinantes : accents latins, tréma, harakat arabes. */
    .replace(/\p{M}+/gu, "")
    /* Tout ce qui n'est ni lettre ni chiffre devient une frontière de jeton. */
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/ {2,}/g, " ");
}

/** Les jetons d'un nom normalisé. Jamais triés : l'ordre est une information. */
export function jetons(nomNormalise: string): string[] {
  return nomNormalise === "" ? [] : nomNormalise.split(" ");
}
