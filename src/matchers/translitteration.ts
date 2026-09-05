/**
 * CYRILLIQUE → LATIN ET ARABE → LATIN DE BASE, PAR TABLES ÉCRITES ICI.
 *
 * Les tables sont DANS ce fichier, pas dans une dépendance : un responsable conformité qui
 * doit approuver l'outil lit soixante lignes et sait exactement comment « Дмитрий » devient
 * « dmitrii ». Leurs sources, déclarées :
 *
 *   — cyrillique : le système BGN/PCGN 1947 pour le russe, simplifié (pas de digraphes
 *     contextuels : « е » rend toujours « e », jamais « ye » en tête de mot), plus les
 *     quatre lettres ukrainiennes courantes (і, ї, є, ґ) ;
 *   — arabe : romanisation ALA-LC simplifiée, SANS signes diacritiques latins (« ṣ » rend
 *     « s ») ; le ʿayn et la hamza tombent — une apostrophe survivrait à la normalisation
 *     comme frontière de jeton et couperait le nom en deux.
 *
 * CE QUE CES TABLES NE SAVENT PAS, dit plutôt que découvert : le PINYIN et tout le chinois
 * sont HORS PÉRIMÈTRE ce soir — un nom en sinogrammes traverse inchangé, et seuls `ngrams`
 * ou `exact` peuvent encore le voir ; les variantes de romanisation concurrentes
 * (« Мухаммед » → mukhammed ici, jamais muhammad) restent deux formes distinctes que les
 * paliers approximatifs doivent rapprocher — c'est leur travail, pas celui de la table ;
 * les harakat arabes ne sont pas traités ici, la normalisation les retire déjà comme
 * marques combinantes.
 *
 * Tout caractère hors des tables traverse INCHANGÉ : une table qui remplacerait l'inconnu
 * par du vide ferait converger deux noms différents vers la même chaîne, en silence.
 */

/** Russe BGN/PCGN 1947 simplifié + lettres ukrainiennes courantes. Minuscules : on
 *  translittère APRÈS le passage en minuscules de `normaliser` — voir `preparer`. */
export const CYRILLIQUE: ReadonlyMap<string, string> = new Map(Object.entries({
  "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e", "ж": "zh",
  "з": "z", "и": "i", "й": "i", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o",
  "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "kh", "ц": "ts",
  "ч": "ch", "ш": "sh", "щ": "shch", "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu",
  "я": "ya",
  "і": "i", "ї": "i", "є": "e", "ґ": "g",
}));

/** Arabe ALA-LC simplifié, sans diacritiques latins ; ʿayn et hamza tombent. */
export const ARABE: ReadonlyMap<string, string> = new Map(Object.entries({
  "ا": "a", "ب": "b", "ت": "t", "ث": "th", "ج": "j", "ح": "h", "خ": "kh", "د": "d",
  "ذ": "dh", "ر": "r", "ز": "z", "س": "s", "ش": "sh", "ص": "s", "ض": "d", "ط": "t",
  "ظ": "z", "ع": "", "غ": "gh", "ف": "f", "ق": "q", "ك": "k", "ل": "l", "م": "m",
  "ن": "n", "ه": "h", "و": "w", "ي": "y", "ء": "", "ة": "a", "آ": "a", "أ": "a",
  "إ": "i", "ى": "a", "ئ": "y", "ؤ": "w",
}));

/** Chaque caractère par sa table ; l'inconnu traverse inchangé. */
export function translitterer(nom: string): string {
  let sortie = "";
  for (const c of nom) sortie += CYRILLIQUE.get(c) ?? ARABE.get(c) ?? c;
  return sortie;
}
