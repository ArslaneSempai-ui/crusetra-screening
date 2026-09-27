/**
 * L'ARABIZI : l'arabe des claviers et des messageries du Golfe, qui écrit avec des chiffres les lettres que le clavier
 * latin n'a pas. 7 est le ح (h), 3 le ع (l'ayn : tombé devant une voyelle ou en fin de mot, lu a devant une consonne),
 * 3' le غ (gh), 5 le خ (kh), 6 le ط (t), 9 le ص (s), 2 la hamza (tombée), 8 le ق (q). « Mo7ammed Sa3eed » est Mohammed
 * Saeed, « Al 3'ubaiba » Al Ghubaiba, « 5alfan » Khalfan, « 6ariq » Tariq, « 9ayegh » Sayegh (jeu 14 : sept paires entre
 * 0,449 et 0,706, le chiffre coupant le mot en deux, ou lu par la lecture optique comme un s).
 *
 * Distinct de la lecture optique (`ocr`, preparation.ts), qui lit 0, 1, 5 et 8 comme O, I, S et B dans un document en
 * capitales (« ST1 », « NAKL1YAT », « NU5ANTARA ») : aucune lecture optique ne produit 2, 3, 6, 7 ni 9 dans un mot de
 * lettres, ces chiffres-là suffisent donc à dire l'arabizi dans un nom qui n'est pas tout en capitales ; 5 et 8, que
 * les deux lectures se disputent (« NU5ANTARA » est Nusantara, « 5alfan » est Khalfan), ne se lisent en arabizi que sous
 * un marqueur arabe (Al, Bin, Dar, Abu : MARQUEURS_ARABES) et hors des capitales, où le document scanné l'emporte (mesuré
 * le 28/09 : « BAYT AL ZAAFARAN 5PICES TRAD1NG » perdu quand le marqueur suffisait) ; un nom en capitales ne lit ses chiffres
 * sûrs que sous un marqueur. Un mot d'arabizi est un mot de lettres : trois lettres au moins, jamais deux chiffres de suite,
 * jamais un chiffre en fin de mot (« Mutiara 12 », « TCB1207 », « No18 » sont des numéros). Lu sur le nom brut, avant la
 * normalisation qui ferait de l'apostrophe de 3' une frontière de mot, et avant la règle de l'adresse collée à une forme
 * (variantes.ts), qui coupait « Sa3eed » en « Sa 3eed » ; le mot lu garde la casse de son voisinage pour que la marque des
 * capitales ne bouge pas.
 */

/** Un chiffre pour une lettre. */
const SIMPLES: ReadonlyMap<string, string> = new Map([["7", "h"], ["5", "kh"], ["6", "t"], ["9", "s"], ["8", "q"]]);
/** Un chiffre suivi d'une apostrophe : la lettre pointée (غ, خ, ظ, ض). */
const AVEC_APOSTROPHE: ReadonlyMap<string, string> = new Map([["3", "gh"], ["7", "kh"], ["5", "kh"], ["6", "z"], ["9", "d"]]);
/** Les chiffres qu'aucune lecture optique ne produit : leur présence dans un mot de lettres dit l'arabizi à elle seule. */
const CHIFFRES_SURS = /[23679]/;
const APOSTROPHE = /['’ʼ`]/;
const MOT = /[\p{L}\p{N}'’ʼ`]+/gu;

/** Le nom, ses mots d'arabizi lus en lettres, et si l'un au moins l'a été (le nom est arabe : voir `Marques.arabe`). */
export function lireArabizi(nom: string, marqueurArabe: boolean): { texte: string; lu: boolean } {
  if (!/\d/.test(nom)) return { texte: nom, lu: false };
  const capitales = !/\p{Ll}/u.test(nom);
  let lu = false;
  const texte = nom.replace(MOT, (m) => {
    if (!/\d/.test(m) || (m.match(/\p{L}/gu)?.length ?? 0) < 3) return m;
    if (/\d\d/.test(m) || /\d[^\p{L}'’ʼ`]*$/u.test(m)) return m;
    const surs = CHIFFRES_SURS.test(m);
    if (!(surs ? !capitales || marqueurArabe : marqueurArabe && !capitales && /[58]/.test(m))) return m;
    /* un chiffre pour une lettre, dans la casse du mot */
    const maj = /\p{Lu}/u.test(m) && !/\p{Ll}/u.test(m);
    const lettre = (l: string) => (maj ? l.toUpperCase() : l);
    let r = "";
    for (let i = 0; i < m.length; i++) {
      const c = m[i]!, suivant = m[i + 1] ?? "";
      if (!/\d/.test(c)) { r += c; continue; }
      if (APOSTROPHE.test(suivant) && AVEC_APOSTROPHE.has(c)) { r += lettre(AVEC_APOSTROPHE.get(c)!); i++; continue; }
      if (c === "2") continue;
      if (c === "3") { if (!(suivant === "" || /[aeiouy]/i.test(suivant))) r += lettre("a"); continue; }
      const l = SIMPLES.get(c);
      if (l === undefined) { r += c; continue; }
      r += lettre(l);
    }
    lu = true;
    return r;
  });
  return { texte, lu };
}

/**
 * LE VOLAPUK des clavardages et des champs SWIFT russes et kazakhs : le clavier latin écrit le cyrillique avec ce qui lui
 * ressemble, le 6 et le w pour ш, le 4 pour ч, le u pour у (« 6ygys », « Wygys » : Шығыс ; « guru4 » : гуруч, jeu 17,
 * tour 13 : 0,540 et 0,714, le chiffre lu par la lecture optique ou coupant le mot). Le 6 est un chiffre de l'arabizi
 * aussi (le ط) : le 6 et le 4 ne se lisent en volapuk que sous une PRÉSOMPTION SLAVE (le cyrillique, une forme de la CEI,
 * un mot du commerce russe ou d'Asie centrale : voir `Marques.slave`), après l'arabizi et avant `ocr`, qui lirait le 4
 * comme un a (« Font4nelli »). Le w se lit au score (`clesSlaves`, mots.ts). Un mot de volapuk est un mot de lettres :
 * trois lettres au moins, jamais deux chiffres de suite, jamais un autre chiffre que 6 ou 4 ; un 6 ou un 4 EN FIN de mot
 * n'est une lettre que dans un nom écrit en minuscules (« guru4 »), parce qu'en capitales c'est le numéro d'une coque
 * collé à son nom (« VOLGONEFT4 »), que la règle des numéros doit voir.
 */
const VOLAPUK: ReadonlyMap<string, string> = new Map([["6", "sh"], ["4", "ch"]]);
export function lireVolapuk(nom: string, presomptionSlave: boolean): { texte: string; lu: boolean } {
  if (!presomptionSlave || !/[46]/.test(nom)) return { texte: nom, lu: false };
  const minuscules = /\p{Ll}/u.test(nom) && !/\p{Lu}/u.test(nom);
  let lu = false;
  const texte = nom.replace(/[\p{L}\p{N}]+/gu, (m) => {
    const lettres = m.match(/\p{L}/gu)?.length ?? 0;
    if (!/[46]/.test(m) || /[0-35789]/.test(m) || /\d\d/.test(m) || lettres < 3) return m;
    if (/\d$/.test(m) && !(minuscules && lettres >= 4)) return m;
    const maj = /\p{Lu}/u.test(m) && !/\p{Ll}/u.test(m);
    lu = true;
    return m.replace(/[46]/g, (c) => (maj ? VOLAPUK.get(c)!.toUpperCase() : VOLAPUK.get(c)!));
  });
  return { texte, lu };
}
