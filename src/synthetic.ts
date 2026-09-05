/**
 * Les variantes SYNTHÉTIQUES d'un nom : la matière du rappel synthétique du lot R3.
 *
 * Le contrat (§4) l'exige mesuré À PART et jamais fusionné : ces variantes sont FABRIQUÉES,
 * chacune étiquetée par sa nature, et le vocabulaire de provenance les nomme `synthetic` —
 * jamais `measured`. Un rappel calculé dessus dit « ce matcher attrape telle famille de
 * déformations », pas « ce matcher attrape les vrais cas du client ».
 *
 * DÉTERMINISTE PAR CONSTRUCTION : un générateur congruentiel à graine EXPLICITE — le même
 * que `draw()` de cascade-routing, recopié parce que ce dépôt tourne seul après un clone.
 * Deux exécutions à la même graine rendent les mêmes variantes ; un banc dont le témoin
 * bouge entre deux passes n'est pas reproductible.
 *
 * Les translittérations alternatives (cyrillique, arabe) ne sont PAS ici : elles viendront
 * de translitteration.ts du lot R1 quand ses exports seront dits. Ce fichier n'invente pas
 * une table en attendant — une translittération improvisée fabriquerait des variantes que
 * personne ne rencontre, et le rappel mesuré dessus serait un chiffre sur rien.
 */

/** Le générateur : même forme que cascade-routing (`draw`), graine explicite. */
export function tirage(graine: number): () => number {
  let etat = graine >>> 0;
  return () => {
    etat = (etat * 1_664_525 + 1_013_904_223) >>> 0;
    return etat / 4_294_967_296;
  };
}

/** Les natures de déformation, chacune un défaut qu'un vrai système de saisie produit. */
export const NATURES = [
  "substitution",       /* un caractère remplacé par un voisin de frappe */
  "omission",           /* un caractère perdu */
  "insertion",          /* un caractère de trop */
  "transposition",      /* deux caractères adjacents échangés */
  "reversed-order",     /* nom et prénom inversés — l'ordre des jetons retourné */
  "initial",            /* un prénom réduit à son initiale */
  "no-diacritics",      /* les diacritiques ôtées : José → Jose */
  "doubled-letter",     /* une lettre doublée : Haddad → Hadddad */
  "undoubled-letter",   /* une double dédoublée : Haddad → Hadad */
] as const;

export type Nature = (typeof NATURES)[number];

export type Variante = { variante: string; nature: Nature };

/* Les positions candidates d'une nature dans un nom donné. Une nature qui ne s'applique
   pas (pas de diacritique, un seul jeton, pas de double lettre) ne rend RIEN : mieux
   vaut une variante absente qu'une variante égale au nom, qui compterait un succès
   de matcher pour un succès de rappel. */

const LETTRES = "abcdefghijklmnopqrstuvwxyz";

function positionsDeLettres(nom: string): number[] {
  const p: number[] = [];
  for (let i = 0; i < nom.length; i++) if (/\p{L}/u.test(nom[i]!)) p.push(i);
  return p;
}

function candidates(nom: string, nature: Nature, r: () => number): string | undefined {
  const lettres = positionsDeLettres(nom);
  const prendre = <T,>(l: T[]): T | undefined => l.length ? l[Math.floor(r() * l.length)] : undefined;
  switch (nature) {
    case "substitution": {
      const i = prendre(lettres);
      if (i === undefined) return undefined;
      const autres = LETTRES.replace(nom[i]!.toLowerCase(), "");
      const c = autres[Math.floor(r() * autres.length)]!;
      const casse = nom[i]! === nom[i]!.toUpperCase() ? c.toUpperCase() : c;
      return nom.slice(0, i) + casse + nom.slice(i + 1);
    }
    case "omission": {
      /* Un nom de deux lettres qui en perd une ne ressemble plus à un nom. */
      if (lettres.length < 3) return undefined;
      const i = prendre(lettres)!;
      return nom.slice(0, i) + nom.slice(i + 1);
    }
    case "insertion": {
      const i = prendre(lettres);
      if (i === undefined) return undefined;
      const c = LETTRES[Math.floor(r() * LETTRES.length)]!;
      return nom.slice(0, i) + c + nom.slice(i);
    }
    case "transposition": {
      const paires = lettres.filter((i) => i + 1 < nom.length
        && /\p{L}/u.test(nom[i + 1]!) && nom[i] !== nom[i + 1]);
      const i = prendre(paires);
      if (i === undefined) return undefined;
      return nom.slice(0, i) + nom[i + 1]! + nom[i]! + nom.slice(i + 2);
    }
    case "reversed-order": {
      const jetons = nom.split(/\s+/).filter(Boolean);
      if (jetons.length < 2) return undefined;
      return [...jetons].reverse().join(" ");
    }
    case "initial": {
      const jetons = nom.split(/\s+/).filter(Boolean);
      /* Le DERNIER jeton est le nom de famille dans les deux ordres usuels : on abrège un
         des autres. Un seul jeton n'a pas de prénom à abréger. */
      const abregeables = jetons.slice(0, -1).map((_, k) => k).filter((k) => jetons[k]!.length > 1);
      const k = prendre(abregeables);
      if (k === undefined) return undefined;
      const copie = [...jetons];
      copie[k] = copie[k]![0]! + ".";
      return copie.join(" ");
    }
    case "no-diacritics": {
      const nu = nom.normalize("NFD").replace(/\p{M}/gu, "").normalize("NFC");
      return nu === nom ? undefined : nu;
    }
    case "doubled-letter": {
      const i = prendre(lettres);
      if (i === undefined) return undefined;
      return nom.slice(0, i) + nom[i]! + nom.slice(i);
    }
    case "undoubled-letter": {
      const doubles = lettres.filter((i) => i + 1 < nom.length
        && nom[i + 1]!.toLowerCase() === nom[i]!.toLowerCase() && /\p{L}/u.test(nom[i]!));
      const i = prendre(doubles);
      if (i === undefined) return undefined;
      return nom.slice(0, i) + nom.slice(i + 1);
    }
  }
}

/**
 * `n` variantes d'un nom, déterministes à graine donnée, chacune étiquetée.
 *
 * Les natures tournent en cycle pour que chaque famille soit représentée avant qu'une
 * revienne ; une nature inapplicable passe son tour EN LE DISANT par son absence — le
 * compte rendu est `variantes.length`, jamais complété en silence par des doublons.
 * Aucune variante n'est vide, aucune n'est égale au nom d'origine, aucune n'apparaît
 * deux fois.
 */
export function variantes(nom: string, graine: number, n: number): Variante[] {
  if (nom.trim().length === 0) {
    throw new Error("variantes(): an empty name has no variants — the caller holds a bad list entry.");
  }
  const r = tirage(graine);
  const vues = new Set<string>([nom]);
  const resultat: Variante[] = [];
  /* Deux tours complets des natures suffisent largement à n raisonnable ; on borne pour
     qu'un nom à une lettre ne fasse pas tourner une boucle sans issue. */
  for (let tour = 0; tour < 8 && resultat.length < n; tour++) {
    for (const nature of NATURES) {
      if (resultat.length >= n) break;
      const v = candidates(nom, nature, r);
      if (v === undefined || v.length === 0 || vues.has(v)) continue;
      vues.add(v);
      resultat.push({ variante: v, nature });
    }
  }
  return resultat;
}

/**
 * D'un extrait de liste, le jeu synthétique du rappel : { nom_liste, variante, nature }.
 *
 * La graine de chaque nom DÉRIVE de la graine globale et du nom lui-même : retirer une
 * entrée de l'extrait ne change pas les variantes des autres — un jeu qui se recompose
 * entièrement à chaque édition ne se compare plus d'une passe à l'autre.
 */
export type CasSynthetique = { nom_liste: string; variante: string; nature: Nature };

export function jeuSynthetique(
  noms: readonly string[], graine: number, parNom = 6,
): CasSynthetique[] {
  const cas: CasSynthetique[] = [];
  for (const nom of noms) {
    let h = graine >>> 0;
    for (const c of nom) h = ((h * 31) + c.codePointAt(0)!) >>> 0;
    for (const v of variantes(nom, h, parNom)) {
      cas.push({ nom_liste: nom, variante: v.variante, nature: v.nature });
    }
  }
  return cas;
}
