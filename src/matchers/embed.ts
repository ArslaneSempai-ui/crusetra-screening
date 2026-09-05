/**
 * PALIER 7 : `embed`. Un petit modèle d'embeddings multilingue, poids épinglés, local.
 *
 * Son avantage sur les six paliers de chaînes est précisément ce que les tables de
 * translittération ne savent pas : il lit LES ÉCRITURES. « Дмитрий » et « Dmitri » tombent
 * près l'un de l'autre dans son espace sans qu'aucune table n'ait été écrite : les noms lui
 * arrivent normalisés (casse, diacritiques, ponctuation) mais PAS translittérés, c'est son
 * travail à lui. Le score est le cosinus des deux vecteurs, ramené de [-1, 1] dans [0, 1]
 * par (cos + 1) / 2, borné, et court-circuité à 1 exact sur l'égalité après normalisation :
 * le cosinus flottant de deux vecteurs identiques rend 0,999… et raterait le seuil 1,00 de
 * la grille, la leçon a déjà été payée par ngrams.
 *
 * LE MODÈLE NE SE CHARGE PAS TOUT SEUL, ET UN SCORE NE SE CALCULE PAS À FROID. La couture
 * (matcher.ts) promet un score SYNCHRONE ; un passage dans un réseau de neurones ne l'est
 * pas. Le palier expose donc `rechauffer(noms)` : la mesure lui donne TOUS ses noms d'un
 * coup, les vecteurs se calculent là, et `score` sert ensuite depuis ce cache, synchrone et
 * déterministe. Un nom jamais réchauffé est un REFUS nommé, pas un calcul improvisé :
 * improviser exigerait de rendre la couture asynchrone pour les six autres paliers.
 *
 * RIEN NE DESCEND ICI. `env.allowRemoteModels` est faux en toutes circonstances dans ce
 * fichier : les poids arrivent par `npm run poids -- --fetch` (frontière réseau, à côté du
 * téléchargeur de listes) ou à la main, et un poids absent fait un palier ABSENT et nommé,
 * jamais un téléchargement surprise. Le prefixe e5 (« query: ») est appliqué des DEUX côtés :
 * le modèle attend un préfixe, et le même des deux côtés préserve la symétrie.
 *
 * SA BANDE UTILE EST ÉTROITE ET HAUTE, mesuré au relevé public du 6 septembre : deux noms
 * SANS RAPPORT cosinent déjà vers 0,88 (anisotropie des embeddings de chaînes courtes), donc
 * sous 0,90 ce palier rappelle tout ET alarme sur tout ; sa discrimination vit entre 0,90 et
 * 1,00 — la grille de seuils le montre au lieu qu'une recalibration le maquille : le
 * cosinus ramené par (cos + 1) / 2 est LA règle déclarée, et la frontière dit ce qu'elle
 * vaut. Où il paie : la moitié synthétique (variantes d'écriture), rappel élevé à faux
 * positifs bas près du haut de la bande — à lire dans releve-public.json, jamais ici.
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Matcher } from "../matcher.ts";
import { normaliser } from "./normaliser.ts";
import { FICHIERS, MODELE, dossierDuModele, poidsSurPlace, racineDesPoids } from "../poids.ts";

/** nom normalisé -> vecteur unitaire. Rempli par `rechauffer`, lu par `score`. */
const vecteurs = new Map<string, Float32Array>();
let chaine: ((textes: string[], options: object) => Promise<{ data: Float32Array; dims: number[] }>) | null = null;

/**
 * Charger la bibliothèque et la chaîne, une fois, HORS LIGNE PAR CONSTRUCTION.
 *
 * La bibliothèque demande deux fichiers de configuration à la révision `main` quel que soit
 * l'épinglage (mesuré chez cascade-routing, 31 août : c'est sa fuite tokenizer) ; hors
 * ligne, ils manquent et la chaîne se construit muette et cassée. On pose donc les fichiers
 * ÉPINGLÉS sous la clé `main` que la bibliothèque lit, avant le chargement : mêmes octets,
 * autre chemin, zéro requête.
 */
async function charger(racine?: string): Promise<void> {
  if (chaine !== null) return;
  const { pipeline, env } = await import("@huggingface/transformers");
  env.allowRemoteModels = false;
  (env as { cacheDir?: string }).cacheDir = racineDesPoids(racine);
  const pinne = dossierDuModele(racine);
  const auMain = join(racineDesPoids(racine), MODELE.depot);
  /* Les fichiers de configuration se DÉRIVENT du manifeste épinglé (tout ce qui n'est pas
     sous onnx/) : une seconde liste écrite ici divergerait du manifeste au premier ajout. */
  for (const f of FICHIERS.filter((x) => !x.chemin.includes("/")).map((x) => x.chemin)) {
    const cible = join(auMain, f);
    if (!existsSync(cible)) { mkdirSync(dirname(cible), { recursive: true }); copyFileSync(join(pinne, f), cible); }
  }
  chaine = await pipeline("feature-extraction", MODELE.depot, { revision: MODELE.revision }) as unknown as typeof chaine;
}

/** Réchauffer un lot de noms : les vecteurs manquants se calculent ici, et seulement ici. */
export async function rechaufferEmbed(noms: readonly string[], racine?: string): Promise<void> {
  if (!poidsSurPlace(racine)) {
    throw new Error(`the embed weights are not on this machine: npm run poids -- --fetch\n`
      + `  (the tier is ABSENT from the registry until they are; nothing downloads by itself)`);
  }
  await charger(racine);
  const manquants = [...new Set(noms.map(normaliser))].filter((n) => n !== "" && !vecteurs.has(n));
  if (manquants.length === 0) return;
  const sortie = await chaine!(manquants.map((n) => `query: ${n}`), { pooling: "mean", normalize: true });
  const dim = sortie.dims[sortie.dims.length - 1]!;
  manquants.forEach((n, i) => vecteurs.set(n, sortie.data.slice(i * dim, (i + 1) * dim) as Float32Array));
}

export const embed: Matcher = {
  id: "embed",
  description: "a small multilingual embedding model, pinned weights, run locally: cosine in [0, 1]",
  rang: 7,
  score: (a, b) => {
    const na = normaliser(a), nb = normaliser(b);
    /* L'égalité court-circuite AVANT le cosinus : cos(v, v) rend 0,999… en flottant et
       raterait le seuil 1,00, la leçon de ngrams. Deux noms vides sont identiques aussi. */
    if (na === nb) return 1;
    const va = vecteurs.get(na), vb = vecteurs.get(nb);
    if (va === undefined || vb === undefined) {
      throw new Error(`embed.score("${a.slice(0, 24)}", "${b.slice(0, 24)}") before warm-up: `
        + `call await rechaufferEmbed([...names]) once with every name, then score is synchronous.\n`
        + `  A neural pass cannot be improvised inside a synchronous matcher.`);
    }
    let dot = 0;
    for (let i = 0; i < va.length; i++) dot += va[i]! * vb[i]!;
    /* normalize:true rend des vecteurs unitaires : le cosinus EST le produit scalaire.
       Borné des deux côtés : le flottant déborde d'un epsilon, et exigerScore a raison. */
    return Math.min(1, Math.max(0, (dot + 1) / 2));
  },
};

/** Exposé pour les témoins : le cache se vide entre deux cas, jamais en production. */
export function oublierLesVecteurs(): void {
  vecteurs.clear();
}
