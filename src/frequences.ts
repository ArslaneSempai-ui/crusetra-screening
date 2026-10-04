/**
 * LES FRÉQUENCES DES MOTS DES LISTES, EN CACHE. Les poids des mots (IDF) viennent des listes publiques du manifeste :
 * les relire et les analyser à chaque mesure coûtait une minute (mesuré le 28/09/2026 : douze mesures par voie,
 * quatre voies par tour). Le cache est un fichier de data/ (jamais commis) nommé par l'empreinte du manifeste :
 * une liste rafraîchie change le manifeste, donc le nom, donc le cache se recalcule. Rien n'entre ici qui ne
 * vienne des listes : aucun nom d'un client.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { frequencesDe, FREQUENCES_UNIFORMES, type Frequences } from "./entites.ts";
import { lireListe, lireManifeste, SOURCES, MANIFESTE } from "./listes.ts";

const DOSSIER = new URL("../data/", import.meta.url);

/** Les fréquences des listes disponibles, lues du cache si le manifeste n'a pas bougé, calculées et écrites sinon ;
 *  uniformes quand aucune liste n'est là (la mesure le dit alors dans sa première ligne). */
export function frequencesDesListes(): Frequences {
  const m = lireManifeste();
  if (!m) return FREQUENCES_UNIFORMES;
  const empreinte = createHash("sha256").update(readFileSync(MANIFESTE)).digest("hex").slice(0, 16);
  const cache = new URL(`frequences.${empreinte}.json`, DOSSIER);
  if (existsSync(cache)) {
    const j = JSON.parse(readFileSync(cache, "utf8")) as { entrees: number; df: [string, number][] };
    return { entrees: j.entrees, df: new Map(j.df) };
  }
  const dispo = SOURCES.filter((s) => m.listes.some((l) => l.source === s.source && l.disponible));
  const f = frequencesDe(dispo.flatMap((s) => lireListe(s.source)).map((e) => [e.nom, ...e.alias]));
  mkdirSync(DOSSIER, { recursive: true });
  writeFileSync(cache, JSON.stringify({ entrees: f.entrees, df: [...f.df.entries()] }));
  return f;
}
