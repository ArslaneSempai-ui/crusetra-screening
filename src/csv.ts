/**
 * LE LECTEUR CSV — extrait de `your-cases.ts` de cascade-routing, avec ses cicatrices.
 *
 * Ce lecteur a payé ses défauts un par un, mesurés et datés dans le dépôt d'origine : le
 * guillemet jamais refermé qui avale la moitié du fichier (refusé en nommant la ligne
 * d'ouverture), la cellule d'un mégaoctet qui faisait exploser la mémoire (construite par
 * tranches, comptée en octets réels), l'en-tête dupliqué qui décale les colonnes en silence
 * (refusé), le numéro de ligne décalé par un texte cité sur trois lignes (le vrai numéro
 * voyage avec chaque ligne). Un second automate CSV divergerait de celui-ci exactement là
 * où ces défauts ont coûté ; on ne les repaie pas.
 *
 * ─── LA FRONTIÈRE DE L'EXTRACTION, ET POURQUOI ELLE EST ICI ───
 *
 * Ce fichier s'arrête à la TABLE : en-tête nommé, lignes, vrais numéros, écarts comptés.
 * Le SCHÉMA — quelles colonnes existent, laquelle est un identifiant, ce qu'un doublon veut
 * dire — reste chez l'appelant (`your-alerts.ts`). Le dépôt d'origine a payé pour cette
 * frontière le 5 septembre 2026 : sa garde « identifiant dupliqué » supposait qu'une ligne
 * est un document, et le premier emprunteur pour qui une ligne était un CHAMP d'un document
 * s'est vu refuser son fichier légitime. Une garde de schéma héritée parle pour un schéma
 * qui n'est pas le sien ; celle-ci ne voyage donc pas.
 */

export type Table = {
  /** L'en-tête, BOM ôté, cellules épurées. */
  noms: string[];
  lignes: string[][];
  /** Le VRAI numéro de ligne du fichier pour lignes[i] — un texte cité sur trois lignes
   *  décale tous les index sinon, et le client cherche au mauvais endroit dans son export. */
  numeros: number[];
  /** Lignes portant PLUS de cellules que l'en-tête : aucune lecture raisonnable, écartées. */
  ecartees: { ligne: number; cellules: number }[];
  /** Lignes plus COURTES : gardées, cellules manquantes vides — mais comptées. */
  courtes: { ligne: number; cellules: number }[];
  /** Cellules démesurées : gardées, nommées avec la cause la plus probable (un guillemet
   *  refermé trop loin qui a avalé des lignes). */
  demesurees: { ligne: number; octets: number; ouvertureLigne: number }[];
};

/** Au-delà de ce poids réel, une cellule est signalée : une valeur de champ ne fait pas
 *  un mégaoctet, un guillemet mal refermé si. */
const DEMESUREE = 1_000_000;

export function lireTable(texte: string): Table {
  const lignes: string[][] = [];
  const numeros: number[] = [];
  let debutDeLigne = 1;
  let ligne: string[] = [], guillemets = false;
  /* Où le guillemet encore ouvert a été ouvert : sans cela, le refus dirait « quelque part
     dans votre fichier », inutilisable sur cinq mille lignes. */
  let ouvertureLigne = 0, numeroDeLigne = 1;

  /*
   * LA CELLULE SE CONSTRUIT PAR TRANCHES, PAS CARACTÈRE PAR CARACTÈRE. Mesuré dans le dépôt
   * d'origine le 25 août 2026, à octets égaux : 1 Mo réparti sur 22 310 lignes → pic 147 Mo ;
   * 1 Mo dans UNE cellule, concaténé caractère par caractère → pic 2 457 Mo, puis SIGABRT à
   * 20 Mo. C'est la FORME du fichier qui coûte, pas sa taille.
   */
  let debut = 0;
  let morceaux: string[] | null = null;
  const demesurees: Table["demesurees"] = [];
  const fermer = (fin: number): string => {
    const queue = texte.slice(debut, fin);
    const v = morceaux === null ? queue : (morceaux.push(queue), morceaux.join(""));
    morceaux = null;
    /* Des OCTETS réels, pas des unités UTF-16 : une cellule cyrillique de 900 000 caractères
       pèse ~1,8 Mo réels — Buffer.byteLength mesure ce que le nom promet. */
    const octetsReels = Buffer.byteLength(v);
    if (octetsReels >= DEMESUREE) demesurees.push({ ligne: numeroDeLigne, octets: octetsReels,
      ouvertureLigne: guillemets ? ouvertureLigne : debutDeLigne });
    return v;
  };

  for (let i = 0; i < texte.length; i++) {
    const c = texte[i]!;
    if (guillemets) {
      if (c === '"' && texte[i + 1] === '"') {
        (morceaux ??= []).push(texte.slice(debut, i + 1));   /* garde UN des deux guillemets */
        i++; debut = i + 1;
      } else if (c === '"') {
        (morceaux ??= []).push(texte.slice(debut, i));
        guillemets = false; debut = i + 1;
      } else if (c === "\n") numeroDeLigne++;
    } else if (c === '"') {
      (morceaux ??= []).push(texte.slice(debut, i));
      guillemets = true; ouvertureLigne = numeroDeLigne; debut = i + 1;
    } else if (c === ",") { ligne.push(fermer(i)); debut = i + 1; }
    else if (c === "\n" || c === "\r") {
      ligne.push(fermer(i));
      if (c === "\r" && texte[i + 1] === "\n") i++;
      debut = i + 1;
      numeroDeLigne++;
      if (ligne.some((x) => x.trim() !== "")) { lignes.push(ligne); numeros.push(debutDeLigne); }
      debutDeLigne = numeroDeLigne;
      ligne = [];
    }
  }
  const derniere = fermer(texte.length);
  if (guillemets) {
    throw new Error(
      `Line ${ouvertureLigne} of your CSV opens a quote that is never closed.\n`
      + `  Everything after it was swallowed as the contents of a single cell: the file was read\n`
      + `  to the end, but only ${lignes.length} row(s) remain instead of your data.\n`
      + `  This tool refuses rather than report a rate over what it lost.\n\n`
      + `  To write a quote INSIDE a cell, double it: "he said ""hello""".\n`
      + `  To find the offending line: sed -n '${ouvertureLigne}p' <your file>`);
  }
  if (derniere !== "" || ligne.length) {
    ligne.push(derniere);
    if (ligne.some((x) => x.trim() !== "")) { lignes.push(ligne); numeros.push(debutDeLigne); }
  }

  const entete = lignes.shift();
  numeros.shift();   /* la ligne de l'en-tête part avec lui : numeros[i] suit lignes[i] */
  if (!entete || entete.every((x) => x.trim() === "")) {
    throw new Error(
      `Your file is empty: no header row was found.\n`
      + `  The first row is read as the header, naming the columns.`);
  }
  const noms = entete.map((x) => x.trim().replace(/^\uFEFF/, ""));

  /*
   * DEUX COLONNES DU MÊME NOM DÉCALENT TOUT, EN SILENCE. Mesuré dans le dépôt d'origine sur
   * `text,name,name` : l'outil ne plantait pas, il mesurait autre chose et rendait un taux.
   * Un doublon d'en-tête n'a aucune lecture raisonnable ; deviner serait pire que refuser.
   */
  const vus = new Map<string, number>();
  for (const nom of noms) vus.set(nom, (vus.get(nom) ?? 0) + 1);
  const doublons = [...vus.entries()].filter(([, n]) => n > 1).map(([nom]) => nom);
  if (doublons.length > 0) {
    throw new Error(
      `Your header names the same column twice: ${doublons.map((d) => `"${d}"`).join(", ")}.\n\n`
      + `  There is no reasonable reading of that: the columns would shift, and this tool\n`
      + `  would measure a different thing from the one you meant, silently, and still\n`
      + `  report a rate. Rename one of them, or remove it.`);
  }

  const ecartees: Table["ecartees"] = [];
  const courtes: Table["courtes"] = [];
  const gardees: string[][] = [];
  const numerosGardes: number[] = [];
  lignes.forEach((l, i) => {
    /* Trop de cellules : écarté (elles ne correspondent à aucune colonne). Pas assez :
       gardé, cellules manquantes vides — cas ordinaire d'un export — mais compté, parce
       qu'un chiffre issu d'une sélection porte le compte de ce qu'il écarte. */
    if (l.length > noms.length) { ecartees.push({ ligne: numeros[i]!, cellules: l.length }); return; }
    if (l.length < noms.length) courtes.push({ ligne: numeros[i]!, cellules: l.length });
    gardees.push(l);
    numerosGardes.push(numeros[i]!);
  });

  return { noms, lignes: gardees, numeros: numerosGardes, ecartees, courtes, demesurees };
}

/**
 * Une cellule de tableau Markdown qui ne peut pas casser la structure : la barre verticale
 * est échappée (avec les backslashes qui la précèdent), l'accent grave remplacé — sinon le
 * bloc de code se referme au milieu du rapport du client.
 */
export function cellule(v: string | number): string {
  const t = String(v);
  return "`" + t.replace(/(\\*)\|/g, (_, dos: string) => dos + dos + "\\|")
    .replace(/`/g, "'") + "`";
}

/** Une énumération bornée qui porte le compte de ce qu'elle écarte : dix mille noms ne se
 *  lisent pas, et une liste coupée en silence ment sur ce qu'elle montre. */
export function apercu(noms: readonly string[], max: number): string {
  return noms.length <= max
    ? noms.join(", ")
    : noms.slice(0, max).join(", ") + `, and ${noms.length - max} more`;
}

/** Combien de noms on montre avant de compter le reste. */
export const MONTRES = 12;
