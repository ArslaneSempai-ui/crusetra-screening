/**
 * LES POIDS DU PALIER `embed` : épinglés, vérifiés, jamais tirés en silence.
 *
 * Le modèle est celui que cascade-routing épingle déjà comme `embLarge` : la maison a
 * mesuré ses encodeurs avec, et une seule paire (dépôt, révision) circule entre les deux
 * outils. Chaque fichier est épinglé par ses OCTETS et son sha256 : la leçon vient de
 * cascade, un model.onnx tronqué par un téléchargement interrompu s'exporte « avec succès »
 * et abat le processus bien plus loin, sans nommer le fichier.
 *
 * Les poids ne descendent JAMAIS pendant `npm ci` ni pendant les tests. Deux gestes
 * explicites, et rien d'autre :
 *
 *     npm run poids               l'état sur le disque, fichier par fichier
 *     npm run poids -- --fetch    le téléchargement, UNE commande, nommée dans la
 *                                 frontière réseau à côté du téléchargeur de listes
 *
 * Le cache vit sous data/models/ : data/ est ignoré par git, et node_modules est effacé
 * par chaque `npm ci` — un cache qui meurt à l'installation ferait redescendre 470 Mo en
 * silence. Poids absents : le palier est ABSENT et nommé absent, exactement comme ce soir.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isMain, refuserDrapeauxInconnus } from "./cli.ts";

export const MODELE = {
  depot: "Xenova/multilingual-e5-small",
  /** La révision de cascade-routing (`embLarge`) : une seule paire dépôt/révision par maison. */
  revision: "761b726dd34f",
  licence: "MIT (model card), weights derived from intfloat/multilingual-e5-small",
} as const;

/* piege:ok couverture-recitee — cette liste EST l'épinglage : être écrite à la main est
   sa fonction, et chaque entrée est confrontée au disque par etatDesPoids (statSync puis
   sha256) à chaque commande, et par tirerLesPoids avant toute écriture. */
/** Chaque fichier que la bibliothèque lira, avec ses octets et son empreinte exacts. */
export const FICHIERS: readonly { chemin: string; octets: number; sha256: string }[] = [
  { chemin: "config.json", octets: 658,
    sha256: "cb99455288675345e1a4f411438d5d0adbba5fbd3a67ea4fb03c015433b996c1" },
  { chemin: "tokenizer.json", octets: 17_082_730,
    sha256: "0b44a9d7b51c3c62626640cda0e2c2f70fdacdc25bbbd68038369d14ebdf4c39" },
  { chemin: "tokenizer_config.json", octets: 443,
    sha256: "a1d6bc8734a6f635dc158508bef000f8e2e5a759c7d92f984b2c86e5ff53425b" },
  { chemin: "onnx/model.onnx", octets: 470_268_533,
    sha256: "4aa845c27760e06e9a686b9d8b5d440eae4b6612cd09e5b522b716d3941f77ff" },
];

/** La racine du cache des modèles — data/ est gitignoré, et survit à `npm ci`. */
export function racineDesPoids(racine?: string): string {
  return racine ?? fileURLToPath(new URL("../data/models", import.meta.url));
}

/** Le dossier du modèle épinglé sous cette racine. */
export function dossierDuModele(racine?: string): string {
  return join(racineDesPoids(racine), MODELE.depot, MODELE.revision);
}

export type EtatFichier = { chemin: string; etat: "present" | "absent" | "tronque" | "altere"; octets?: number };

/**
 * L'état de chaque fichier épinglé : présent n'est dit qu'après les OCTETS ; l'empreinte
 * complète ne se paie que sur demande (`--sha`) ou au moment d'écrire (`--fetch`), parce
 * que hacher 470 Mo à chaque `npm run poids` ferait sauter le réflexe de le lancer.
 */
export function etatDesPoids(racine?: string, avecSha = false): EtatFichier[] {
  const base = dossierDuModele(racine);
  return FICHIERS.map((f) => {
    const abs = join(base, f.chemin);
    if (!existsSync(abs)) return { chemin: f.chemin, etat: "absent" as const };
    const octets = statSync(abs).size;
    if (octets !== f.octets) return { chemin: f.chemin, etat: "tronque" as const, octets };
    if (avecSha) {
      const sha = createHash("sha256").update(readFileSync(abs)).digest("hex");
      if (sha !== f.sha256) return { chemin: f.chemin, etat: "altere" as const, octets };
    }
    return { chemin: f.chemin, etat: "present" as const, octets };
  });
}

/** Vrai quand le palier peut se charger : tous les fichiers présents aux octets épinglés. */
export function poidsSurPlace(racine?: string): boolean {
  return etatDesPoids(racine).every((f) => f.etat === "present");
}

const enMo = (n: number): string => (n / 1_000_000).toFixed(1) + " MB";

export function rapport(racine?: string, avecSha = false): string {
  const etats = etatDesPoids(racine, avecSha);
  const lignes = etats.map((f) => {
    const attendu = FICHIERS.find((x) => x.chemin === f.chemin)!;
    const detail = f.etat === "present" ? enMo(attendu.octets)
      : f.etat === "tronque" ? `${enMo(f.octets!)} of ${enMo(attendu.octets)}: an interrupted download never heals on its own`
      : f.etat === "altere" ? "size matches, sha256 does not: the file is not the one this repository pins"
      : enMo(attendu.octets) + " to fetch";
    return `  ${f.chemin.padEnd(24)} ${f.etat.padEnd(8)} ${detail}`;
  });
  const pret = etats.every((f) => f.etat === "present");
  return [`${MODELE.depot} @ ${MODELE.revision} under ${dossierDuModele(racine)}`, ...lignes,
    pret ? `\n  the embed tier will load.` : `\n  the embed tier is ABSENT until every file is present:\n    npm run poids -- --fetch`,
  ].join("\n");
}

/**
 * Le téléchargement, la SEULE fonction de ce dépôt qui tire les poids — nommée dans la
 * frontière réseau (frontiere.test.ts, AUTORISES) à côté du téléchargeur de listes. Chaque
 * fichier est écrit puis vérifié octets ET sha256 : un fichier qui ne correspond pas est
 * effacé du chemin final (jamais laissé en place à demi) et nommé.
 */
export async function tirerLesPoids(racine?: string): Promise<void> {
  const base = dossierDuModele(racine);
  for (const f of FICHIERS) {
    const abs = join(base, f.chemin);
    if (existsSync(abs) && statSync(abs).size === f.octets) { console.log(`  ${f.chemin} already here`); continue; }
    const url = `https://huggingface.co/${MODELE.depot}/resolve/${MODELE.revision}/${f.chemin}`;
    console.log(`  ${f.chemin} <- ${url}`);
    const rep = await fetch(url);
    if (!rep.ok) throw new Error(`${url} answered ${rep.status}: nothing was written for ${f.chemin}.`);
    const octets = Buffer.from(await rep.arrayBuffer());
    if (octets.length !== f.octets) {
      throw new Error(`${f.chemin}: ${octets.length} byte(s) received, ${f.octets} pinned.\n`
        + `  Nothing was written: a truncated file would "export successfully" and kill the\n`
        + `  process much later, without naming itself.`);
    }
    const sha = createHash("sha256").update(octets).digest("hex");
    if (sha !== f.sha256) {
      throw new Error(`${f.chemin}: sha256 ${sha} received, ${f.sha256} pinned.\n`
        + `  The repository moved under its revision, or the transfer lied. Nothing was written.`);
    }
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, octets);
  }
}

if (isMain(import.meta)) {
  try {
    refuserDrapeauxInconnus(["--fetch", "--sha"]);
    if (process.argv.includes("--fetch")) {
      if (process.env.ROUGE_OFFLINE === "1" || process.env.CASCADE_OFFLINE === "1") {
        throw new Error("the offline flag is set, and fetching weights is a download.\n"
          + "  Carry the four pinned files into data/models by hand, then run: npm run poids");
      }
      await tirerLesPoids();
      console.log("\n" + rapport(undefined, true));
    } else {
      console.log(rapport(undefined, process.argv.includes("--sha")));
    }
  } catch (e) {
    console.error(`\n${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  }
}
