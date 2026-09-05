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
 * LES TRANSLITTÉRATIONS, EN DEUX NATURES, ET POURQUOI DEUX. La table de R1
 * (`matchers/translitteration.ts`) rend UNE romanisation par caractère — c'est son rôle :
 * un pipeline déterministe pour les paliers. Donc :
 *
 *   « transliterated »       : la romanisation de R1 elle-même, quand le nom porte du
 *                              cyrillique ou de l'arabe — la forme qu'un système de
 *                              filtrage verra. La comparaison se fait à casse égale :
 *                              une variante qui ne diffère que par la casse serait un
 *                              faux cas, les matchers normalisent la casse de toute façon.
 *   « alt-transliteration »  : les romanisations CONCURRENTES d'un même son, celles que
 *                              R1 ne rend pas et que ses paliers approximatifs doivent
 *                              rattraper — dit par R1 lui-même. La table des paires est
 *                              ICI, versionnée, chaque paire étant une alternance
 *                              documentée entre systèmes réels (BGN/PCGN contre
 *                              romanisations anglaises/françaises usuelles), jamais une
 *                              invention.
 *
 * Les harakat arabes : ces variantes restent au niveau latin, aucune marque combinante
 * n'est injectée — le cas où il faudrait passer par `preparer` avant comparaison (dit par
 * R1) ne se présente pas ici.
 */
import { translitterer } from "./matchers/translitteration.ts";

/**
 * Les alternances de romanisation, une par variante. Chaque paire est une divergence
 * réelle entre systèmes : х romanisé kh (BGN/PCGN) ou h (usage anglais) ; ж → zh ou j ;
 * ц → ts ou c ; ч → ch ou tch (usage français) ; ج → j ou dj (usage français) ; ق → q ou
 * k ; غ → gh ou g ; ‑ов final → ov ou off (usage historique : Petrov/Petroff) ; ‑ий/‑iy →
 * y ou i (Aliyev/Aliev) ; voyelles longues anglicisées oo/u et ee/i.
 */
export const PAIRES_ALTERNATIVES: readonly [string, string][] = [
  ["kh", "h"], ["zh", "j"], ["ts", "c"], ["tch", "ch"], ["dj", "j"],
  ["q", "k"], ["gh", "g"], ["off", "ov"], ["iy", "y"], ["oo", "u"], ["ee", "i"],
  /* ‑ий romanisé ii (table de R1) contre le ‑y usuel : Dmitrii / Dmitry. */
  ["ii", "y"],
];

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
  "transliterated",     /* la romanisation de R1 : мухаммед → mukhammed */
  "alt-transliteration",/* une romanisation concurrente : Mukhammed → Muhammed */
] as const;

export type Nature = (typeof NATURES)[number];

export type Variante = { variante: string; nature: Nature };

/** Les natures qui ne s'appliquent que parce que le nom PORTE le trait — garanties quand
 *  elles s'appliquent, avant que les génériques ne remplissent (arbitrage du 5 septembre). */
export const PRIORITAIRES: readonly Nature[] = [
  "no-diacritics", "transliterated", "alt-transliteration", "undoubled-letter",
];

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
      /* L'insertion peut tomber APRÈS la dernière lettre — relecture croisée : les seules
         positions de lettres interdisaient structurellement la fin du nom. */
      const i = prendre([...lettres, nom.length]);
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
      /* L'ÉTIQUETTE NE VAUT QUE POUR L'ÉCRITURE LATINE. Sur du cyrillique, ôter les marques
         NFD transforme й en и — une AUTRE lettre, pas un diacritique perdu : la variante
         serait réelle mais son étiquette mentirait, et la romanisation la couvre déjà. */
      if (!/\p{Script=Latin}/u.test(nom)) return undefined;
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
    case "transliterated": {
      /* La table de R1 est écrite en minuscules : on translittère la minuscule, et on ne
         garde la variante que si elle diffère À CASSE ÉGALE — sinon « José » → « josé »
         passerait pour une translittération, un faux cas que les matchers absorberaient. */
      const bas = nom.toLowerCase();
      const v = translitterer(bas);
      return v === bas ? undefined : v;
    }
    case "alt-transliteration": {
      /* SUR UN NOM NON LATIN, L'ALTERNANCE VIT DANS LA ROMANISATION, PAS DANS L'ORIGINAL —
         arbitrage du Chef sur « Дмитрий Иванов » : les paires latines (kh, iy…) n'existent
         pas dans du cyrillique. On translittère d'abord (dmitriy ivanov), on alterne ensuite
         (dmitry ivanov) : c'est la variante qu'un système de filtrage rencontre vraiment. */
      const basOrig = nom.toLowerCase();
      const bas = translitterer(basOrig);
      const applicables = PAIRES_ALTERNATIVES.flatMap(([de, vers]) =>
        bas.includes(de) ? [[de, vers] as const] : []);
      const paire = prendre(applicables);
      if (paire === undefined) return undefined;
      const i = bas.indexOf(paire[0]);
      if (bas !== basOrig) {
        /* Le point de départ est la romanisation (minuscule) : on alterne dedans. */
        return bas.slice(0, i) + paire[1] + bas.slice(i + paire[0].length);
      }
      /* UNE occurrence remplacée — l'unité de déformation, comme pour les typos — et la
         casse du point de remplacement suit celle du nom : MUKHAMMED → MUHAMMED, pas MUhAMMED. */
      const majuscule = nom[i]! !== nom[i]!.toLowerCase();
      return nom.slice(0, i) + (majuscule ? paire[1].toUpperCase() : paire[1]) + nom.slice(i + paire[0].length);
    }
  }
}

/**
 * `n` variantes d'un nom, déterministes à graine donnée, chacune étiquetée.
 *
 * ─── LA SÉLECTION S'ÉTALE SUR LES NATURES APPLICABLES, PAS SUR LE PRÉFIXE ───
 *
 * La première version prenait les natures dans l'ordre écrit : pour tout nom ordinaire les
 * six premières s'appliquent toujours, donc no-diacritics, doubled/undoubled-letter,
 * transliterated et alt-transliteration ne sortaient JAMAIS au parNom par défaut — mesuré
 * par la relecture croisée sur 200 vrais noms OFAC : zéro des cinq familles de queue, et
 * la doc au-dessus promettait le contraire. Cinq familles structurellement mortes au
 * défaut, pendant qu'un rapport attribue « diacritiques ôtées, translittérations » au jeu
 * synthétique.
 *
 * Désormais : un premier passage relève UNE candidate par nature APPLICABLE ; s'il y en a
 * plus que n, les natures LIÉES AU TRAIT (`PRIORITAIRES` — elles ne s'appliquent que parce
 * que ce nom porte diacritiques, écriture non latine, alternance ou lettre double) entrent
 * d'office, puis un Fisher-Yates au générateur étale les génériques sur les places
 * restantes — déterministe, ordre de sortie par nature. Les tours suivants ne servent qu'à
 * compléter si moins de natures s'appliquent que n. Une nature inapplicable passe son tour
 * EN LE DISANT par son absence — le compte rendu est `variantes.length`, jamais complété
 * en silence. Aucune variante vide, égale au nom, ou en double.
 */
export function variantes(nom: string, graine: number, n: number): Variante[] {
  if (nom.trim().length === 0) {
    throw new Error("variantes(): an empty name has no variants — the caller holds a bad list entry.");
  }
  const r = tirage(graine);
  const vues = new Set<string>([nom]);

  const premierPassage: Variante[] = [];
  for (const nature of NATURES) {
    const v = candidates(nom, nature, r);
    if (v === undefined || v.length === 0 || vues.has(v)) continue;
    vues.add(v);
    premierPassage.push({ variante: v, nature });
  }
  /*
   * ─── ARBITRAGE : LES NATURES LIÉES AU TRAIT DU NOM PASSENT D'ABORD ───
   *
   * Un nom avec diacritiques REÇOIT sa variante sans diacritiques ; un nom cyrillique SA
   * translittération et une alternative — ce sont les natures qui ne s'appliquent que
   * parce que CE nom porte le trait, donc les plus informatives pour lui. Les natures
   * génériques (applicables à n'importe quel nom) remplissent le reste par tirage étalé.
   */
  let resultat: Variante[];
  if (premierPassage.length > n) {
    const prioritaires = premierPassage.filter((v) => PRIORITAIRES.includes(v.nature)).slice(0, n);
    const restantes = premierPassage.filter((v) => !PRIORITAIRES.includes(v.nature));
    const places = n - prioritaires.length;
    const indices = [...restantes.keys()];
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [indices[i], indices[j]] = [indices[j]!, indices[i]!];
    }
    const remplissage = indices.slice(0, places).sort((a, b) => a - b).map((i) => restantes[i]!);
    resultat = [...prioritaires, ...remplissage]
      .sort((a, b) => NATURES.indexOf(a.nature) - NATURES.indexOf(b.nature));
  } else {
    resultat = premierPassage;
  }

  /* Compléter jusqu'à n quand moins de natures s'appliquent que demandé — borné, pour
     qu'un nom à une lettre ne fasse pas tourner une boucle sans issue. */
  for (let tour = 0; tour < 7 && resultat.length < n; tour++) {
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
