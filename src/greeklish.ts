/**
 * LE GREEKLISH : le grec des claviers latins et des messageries, qui écrit avec des chiffres les lettres que le clavier n'a
 * pas : 8 est le θ (« kymo8oh » est Κυμοθόη, « 8alassopori » Θαλασσοπόροι), 3 le ξ (« 3enofontos », Ξενοφώντος), 4 le ψ
 * (« 4wmi », ψωμί). Jeu 17, tour 13 : trois paires entre 0,643 et 0,727, le 8 lu B par la lecture optique, le 3 mangé par
 * l'arabizi qui y voyait un ayn devant une voyelle.
 *
 * Lu sur le nom brut, AVANT l'arabizi (arabizi.ts : 3 pour le ayn, 8 pour le qaf) et avant `ocr` (preparation.ts : 8 pour B, 4
 * pour a). Les lettres du greeklish (h pour η, w pour ω, x pour χ, u pour υ) ne se lisent pas ici : elles font la seconde clé
 * du pli grec (`clesGrecques`, mots.ts), comparée sous la marque sans décider que le nom est en greeklish.
 *
 * Quand : jamais sous un marqueur arabe (le 3 et le 8 y sont l'arabizi : « sa3d al 8asimi »). Le 8 suffit dans un nom SANS
 * AUCUNE CAPITALE (« kymo8oh avra », « 8alassopori shipmanagement » : un nom tapé au clavier, où aucune capitale n'a pu être
 * lue 8 par l'optique) ; dès qu'une capitale est là, le 8 est d'abord le B d'un mot à l'initiale capitale qu'un document scanné
 * a mal lu (« 8abatunde 8ros. Ltd », « MV 8ramblewick », « Wuxi Tongli 8earing Co., Ltd. » : quatre vrais noms perdus quand
 * le 8 d'un mot de minuscules suffisait, mesuré le 30/09), et il attend la présomption comme le 3 et le 4. Le 3, que
 * l'arabizi tient pour sûr, et le 4, que l'optique lit a dans un mot de minuscules (« Font4nelli », jeu 16), ne se lisent en
 * greeklish que sous une présomption grecque (un marqueur, une forme, un suffixe : voir `estMarqueurGrec`, preparation.ts). Un
 * mot de greeklish est un mot de lettres : trois lettres au moins, une minuscule au moins, jamais deux chiffres de suite, jamais
 * un chiffre en fin de mot (« Mutiara 12 », « No18 » sont des numéros), aucun autre chiffre que ces trois.
 */

/** Un chiffre pour une lettre grecque, en lettres latines de l'ELOT. */
const CHIFFRES: ReadonlyMap<string, string> = new Map([["8", "th"], ["3", "x"], ["4", "ps"]]);
const MOT = /[\p{L}\p{N}]+/gu;

/** Le nom, ses mots de greeklish lus en lettres, et si l'un au moins l'a été (le nom est grec : voir `Marques.hebreuOuGrec`). */
export function lireGreeklish(nom: string, presumeGrec: boolean, marqueurArabe: boolean): { texte: string; lu: boolean } {
  if (!/[834]/.test(nom) || marqueurArabe || !/\p{Ll}/u.test(nom)) return { texte: nom, lu: false };
  const sansCapitale = !/\p{Lu}/u.test(nom);
  let lu = false;
  const texte = nom.replace(MOT, (m) => {
    if (!/[834]/.test(m) || /[^\p{L}834]/u.test(m) || !/\p{Ll}/u.test(m) || (m.match(/\p{L}/gu)?.length ?? 0) < 3) return m;
    if (/\d\d/.test(m) || /\d$/.test(m)) return m;
    /* le 8 d'un nom sans capitale suffit ; le 3, le 4, et le 8 d'un nom qui en porte attendent la présomption */
    if (!(m.includes("8") && sansCapitale) && !presumeGrec) return m;
    lu = true;
    return m.replace(/[834]/g, (c) => CHIFFRES.get(c) ?? c);
  });
  return { texte, lu };
}
