/**
 * LA MESURE PUBLIQUE — celle que NOUS publions, sans aucune donnée client.
 *
 * Le contrat le dit : aucun outil n'entre au catalogue sans une mesure publique scellée.
 * Celle-ci mesure chaque palier du registre, à chaque seuil de la grille, sur DEUX matières
 * tenues À PART et jamais fusionnées :
 *
 *   — les paires étiquetées ÉCRITES PAR NOUS (`src/paires-etiquetees.json`), déclarées
 *     `authored` : la valeur du jeu tient à ses négatifs durs — frères, homonymes partiels,
 *     noms à un caractère près qui ne sont PAS la même personne ;
 *   — les variantes SYNTHÉTIQUES du lot des listes (`synthetic.ts`), déclarées `synthetic`,
 *     quand le module existe. Absent, la moitié n'est PAS mesurée et le rapport LE DIT —
 *     une section vide qui se tait se lirait comme un zéro propre.
 *
 * Deux verdicts par cellule (palier × seuil) : le RAPPEL sur les paires `match` (ne jamais
 * rater un vrai hit) et le taux de FAUX POSITIFS sur les paires `different` (chaque faux
 * positif est une alerte qu'un analyste paie). Toujours avec n et l'intervalle de Wilson :
 * un taux nu n'entre pas dans un relevé de cette maison.
 *
 * Le relevé va À LA RACINE, COMMITTÉ (`releve-public.json`, scellé + `RELEVE-PUBLIC.md`) :
 * c'est le pendant des `profiles-*.json` de cascade-routing, la source des chiffres du
 * plateau. Réécrire un relevé scellé demande `--yes-overwrite` : un chiffre publié ne bouge
 * pas parce qu'une commande a été relancée par distraction.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { isMain, refuserDrapeauxInconnus } from "./cli.ts";
import { registre } from "./matchers/index.ts";
import { SEUILS, PALIERS, type Registre } from "./matcher.ts";
import { rate, type Rate } from "./interval.ts";
import { empreinteDuReleve, scelleIntact } from "./empreinte.ts";

export type PaireEtiquetee = { a: string; b: string; verdict: "match" | "different"; nature: string };
export type JeuDePaires = { quoi: string; provenance: string; avertissement: string; paires: PaireEtiquetee[] };

/** Le minimum de paires PAR verdict : en dessous, le jeu ne borne rien et le refus le dit. */
export const ASSEZ_PAR_VERDICT = 40;

/**
 * Le jeu de paires, validé avant toute mesure. Chaque refus dit quoi corriger : un jeu
 * accepté en silence avec un verdict fautif mesurerait autre chose et rendrait un taux.
 */
export function validerPaires(jeu: JeuDePaires): PaireEtiquetee[] {
  const paires = jeu.paires ?? [];
  const fautifs = paires.filter((x) => x.verdict !== "match" && x.verdict !== "different");
  if (fautifs.length > 0) {
    throw new Error(`${fautifs.length} pair(s) carry a verdict outside the vocabulary: `
      + fautifs.slice(0, 3).map((x) => `"${x.verdict}"`).join(", ")
      + `.\n  Accepted: "match", "different". Fix the label; nothing was measured.`);
  }
  const vides = paires.filter((x) => !x.a?.trim() || !x.b?.trim() || !x.nature?.trim());
  if (vides.length > 0) {
    throw new Error(`${vides.length} pair(s) have an empty name or an empty nature.\n`
      + `  A pair without its nature cannot be read back when a rate surprises someone.`);
  }
  /* Le doublon compte dans les DEUX sens : (a, b) et (b, a) sont la même question posée
     deux fois, et elle pèserait deux fois dans le taux. */
  const vues = new Map<string, number>();
  for (const x of paires) {
    const cle = [x.a, x.b].sort().join(" / ");
    vues.set(cle, (vues.get(cle) ?? 0) + 1);
  }
  const doubles = [...vues.entries()].filter(([, n]) => n > 1);
  if (doubles.length > 0) {
    throw new Error(`${doubles.length} duplicated pair(s), order included: `
      + doubles.slice(0, 3).map(([k]) => `(${k})`).join(", ")
      + `.\n  The same question would weigh twice in the rate. Deduplicate.`);
  }
  const nMatch = paires.filter((x) => x.verdict === "match").length;
  const nDiff = paires.length - nMatch;
  if (nMatch < ASSEZ_PAR_VERDICT || nDiff < ASSEZ_PAR_VERDICT) {
    throw new Error(`${nMatch} match / ${nDiff} different pair(s): at least ${ASSEZ_PAR_VERDICT} of EACH.\n`
      + `  Below that, a rate here bounds nothing — and the missing side is usually the hard\n`
      + `  negatives, which are what the set is for.`);
  }
  return paires;
}

/** Une cellule du relevé : le taux avec tout ce qu'il faut pour le relire. */
export type Cellule = { succes: number; n: number; taux: number; bas: number; haut: number };
/*
 * LES BORNES SONT ÉLARGIES POUR CONTENIR LEUR PROPRE ESTIMATION. `wilson(60, 60)` rend une
 * borne haute de 0,9999999999999999 en flottant — un intervalle qui ne contient pas son
 * taux (1) — et un lecteur qui vérifie « taux ≤ haut » aurait RAISON de refuser le relevé.
 * Mathématiquement la borne à p̂ = 1 est exactement 1 ; c'est la division qui la perd.
 * `interval.ts` appartient au squelette (et le même flottant dort dans cascade-routing) :
 * la correction locale vit ici, la correction de fond est signalée au propriétaire.
 */
const cellule = (r: Rate): Cellule =>
  ({ succes: r.successes, n: r.n, taux: r.rate,
     bas: Math.min(r.low, r.rate), haut: Math.max(r.high, r.rate) });

export type TableDUnPalier = Record<string, { rappel: Cellule; fauxPositifs: Cellule }>;

/**
 * La mesure elle-même : chaque palier note chaque paire UNE fois, la grille de seuils relit
 * les scores. Pure — le registre et les paires entrent, la table sort — pour qu'un témoin
 * puisse la nourrir d'un matcher scripté et vérifier l'arithmétique à la main.
 */
export function mesurerPaires(r: Registre, paires: readonly PaireEtiquetee[]): Record<string, TableDUnPalier> {
  const sortie: Record<string, TableDUnPalier> = {};
  for (const [id, m] of r) {
    const scores = paires.map((x) => ({ verdict: x.verdict, score: m.score(x.a, x.b) }));
    const matchs = scores.filter((s) => s.verdict === "match");
    const diffs = scores.filter((s) => s.verdict === "different");
    const table: TableDUnPalier = {};
    for (const seuil of SEUILS) {
      table[seuil.toFixed(2)] = {
        rappel: cellule(rate(matchs.filter((s) => s.score >= seuil).length, matchs.length)),
        fauxPositifs: cellule(rate(diffs.filter((s) => s.score >= seuil).length, diffs.length)),
      };
    }
    sortie[id] = table;
  }
  return sortie;
}

export type MesurePublique = {
  version: 1;
  date: string;
  commit: string;
  paliers: { presents: string[]; absents: string[] };
  authored: {
    provenance: "authored";
    nMatch: number; nDifferent: number;
    natures: Record<string, number>;
    tables: Record<string, TableDUnPalier>;
  };
  synthetic:
    | { provenance: "synthetic"; nMatch: number; nDifferent: number; tables: Record<string, TableDUnPalier> }
    | { provenance: "synthetic"; absent: string };
  empreinte?: string;
};

/**
 * La moitié synthétique, DERRIÈRE SA GARDE : `synthetic.ts` appartient au lot des listes et
 * peut ne pas exister encore. Absent, la moitié n'est pas mesurée et le relevé porte la
 * phrase — jamais un zéro, jamais une section muette.
 *
 * Les noms de départ sont ceux de NOS paires `match` (côté a) : autonome ce soir, et le jour
 * où les listes publiques sont là, le lot des listes branche ses entrées ici. Les positifs
 * sont (nom, variante(nom)) ; les négatifs, (nom, variante d'un AUTRE nom) — durs par
 * construction, puisque chaque variante ressemble à son origine.
 */
/** La signature ANNONCÉE par le lot des listes — celle de son message de livraison, pas une
 *  supposition. Trois propriétés à respecter, dites par lui : le jeu peut rendre MOINS que
 *  demandé (une nature inapplicable passe son tour — on lit ce qui vient, jamais un compte
 *  attendu) ; un nom vide jette ; la graine dérive du nom, donc retirer une entrée ne
 *  recompose pas les autres. */
export type ModuleSynthetique = {
  jeuSynthetique(noms: readonly string[], graine: number, parNom?: number):
    { nom_liste: string; variante: string; nature: string }[];
};

export async function mesurerSynthetique(
  r: Registre, paires: readonly PaireEtiquetee[],
  /* Le chargeur est INJECTABLE pour qu'un témoin puisse éprouver la branche « présent »
     avec un module conforme à la signature annoncée, SANS créer src/synthetic.ts dans cet
     arbre — ce fichier appartient au lot des listes, et un fichier posé chez lui serait un
     conflit de fusion fabriqué. La commande réelle passe par le défaut. */
  charger: () => Promise<ModuleSynthetique> = () => import("./synthetic.ts" as string) as Promise<ModuleSynthetique>,
): Promise<MesurePublique["synthetic"]> {
  let jeuSynthetique: ModuleSynthetique["jeuSynthetique"];
  try {
    ({ jeuSynthetique } = await charger());
  } catch {
    return { provenance: "synthetic", absent: "synthetic.ts is not in the tree yet: this half is NOT measured, and this line is the record of that — not a clean zero." };
  }
  const noms = [...new Set(paires.filter((x) => x.verdict === "match").map((x) => x.a))];
  const entrees = jeuSynthetique(noms, 1);
  const synth: PaireEtiquetee[] = [];
  const indexDe = new Map(noms.map((n, i) => [n, i]));
  for (const e of entrees) {
    /* Positif : le nom de liste contre sa propre variante — la nature du lot voyage. */
    synth.push({ a: e.nom_liste, b: e.variante, verdict: "match", nature: e.nature });
    /* Négatif dur : un AUTRE nom contre la même variante — chaque variante ressemble à son
       origine, donc le négatif est difficile par construction. */
    const autre = noms[((indexDe.get(e.nom_liste) ?? 0) + 1) % noms.length]!;
    synth.push({ a: autre, b: e.variante, verdict: "different", nature: e.nature });
  }
  return {
    provenance: "synthetic",
    nMatch: synth.filter((x) => x.verdict === "match").length,
    nDifferent: synth.filter((x) => x.verdict === "different").length,
    tables: mesurerPaires(r, synth),
  };
}

export async function mesurePublique(date: string, commit: string): Promise<MesurePublique> {
  const jeu = JSON.parse(readFileSync(fileURLToPath(new URL("./paires-etiquetees.json", import.meta.url)), "utf8")) as JeuDePaires;
  const paires = validerPaires(jeu);
  const r = registre();
  const natures: Record<string, number> = {};
  for (const x of paires) natures[x.nature] = (natures[x.nature] ?? 0) + 1;
  return {
    version: 1, date, commit,
    paliers: {
      presents: [...r.keys()],
      /* Les absents sont DITS, pas découverts : `embed` manque ce soir et la table du
         rapport le porte en toutes lettres au lieu de planter ou de se taire. */
      absents: PALIERS.filter((p) => !r.has(p)),
    },
    authored: {
      provenance: "authored",
      nMatch: paires.filter((x) => x.verdict === "match").length,
      nDifferent: paires.filter((x) => x.verdict === "different").length,
      natures,
      tables: mesurerPaires(r, paires),
    },
    synthetic: await mesurerSynthetique(r, paires),
  };
}

/* ─── le rapport lisible ─── */

/** Les seuils MONTRÉS dans le md ; la grille entière vit dans le json, et la ligne le dit. */
export const SEUILS_MONTRES = [0.50, 0.60, 0.70, 0.80, 0.85, 0.90, 0.95, 1.00] as const;

const pc = (c: Cellule) => `${(c.taux * 100).toFixed(0)}% [${(c.bas * 100).toFixed(0)}-${(c.haut * 100).toFixed(0)}]`;

function tableMd(tables: Record<string, TableDUnPalier>, quoi: "rappel" | "fauxPositifs"): string {
  const entete = `| tier | ${SEUILS_MONTRES.map((s) => s.toFixed(2)).join(" | ")} |`;
  const barre = `|---|${SEUILS_MONTRES.map(() => "---").join("|")}|`;
  const lignes = Object.entries(tables).map(([id, t]) =>
    `| \`${id}\` | ${SEUILS_MONTRES.map((s) => pc(t[s.toFixed(2)]![quoi])).join(" | ")} |`);
  return [entete, barre, ...lignes].join("\n");
}

export function rapportMd(m: MesurePublique): string {
  const l: string[] = [
    `# Cascade Screening — the public measure`,
    ``,
    `**Provenance**: pairs authored by this repository (no client data, no list data) plus`,
    `synthetic variants, measured APART and never merged. Commit \`${m.commit}\`, ${m.date}.`,
    `Sealed as \`releve-public.json\`; every rate below carries its n and its 95 % Wilson`,
    `interval, and the FULL threshold grid (${SEUILS.length} steps) lives in the JSON — this`,
    `page shows ${SEUILS_MONTRES.length} declared columns of it.`,
    ``,
    `Tiers measured: ${m.paliers.presents.map((p) => `\`${p}\``).join(", ")}.`
    + (m.paliers.absents.length
      ? ` **Not in tonight's registry: ${m.paliers.absents.map((p) => `\`${p}\``).join(", ")}** — measured when it ships, absent rather than faked.`
      : ""),
    ``,
    `## Labelled pairs (authored) — ${m.authored.nMatch} match, ${m.authored.nDifferent} different`,
    ``,
    `The set's value is its hard negatives: siblings, partial homonyms, names one character`,
    `apart that are NOT the same person. Natures: ${Object.entries(m.authored.natures).map(([k, n]) => `${k} x${n}`).join(", ")}.`,
    ``,
    `### Recall on the confirmed matches (higher is safer)`,
    ``, tableMd(m.authored.tables, "rappel"), ``,
    `### False positives on the hard negatives (every point is an analyst's hour)`,
    ``, tableMd(m.authored.tables, "fauxPositifs"), ``,
    `## Synthetic variants (declared)`,
    ``,
  ];
  if ("absent" in m.synthetic) {
    l.push(m.synthetic.absent);
  } else {
    l.push(`${m.synthetic.nMatch} match, ${m.synthetic.nDifferent} different — generated, declared, never merged with the authored set.`,
      ``, `### Recall`, ``, tableMd(m.synthetic.tables, "rappel"), ``,
      `### False positives`, ``, tableMd(m.synthetic.tables, "fauxPositifs"), ``);
  }
  l.push(``, `Generated by \`npm run measure\`; a sealed record refuses silent overwrite.`, ``);
  return l.join("\n");
}

/* ─── la commande ─── */

/**
 * Le droit d'écraser, SORTI de la commande pour porter ses deux témoins : un relevé scellé
 * intact ne se réécrit que si `--yes-overwrite` est écrit dans la commande ; un relevé
 * absent, ou déjà abîmé, se réécrit sans cérémonie — il n'est pas publié, ou plus fiable.
 */
export function exigerDroitDEcraser(cheminJson: string, argv: readonly string[]): void {
  if (!existsSync(cheminJson)) return;
  const existant = JSON.parse(readFileSync(cheminJson, "utf8")) as Record<string, unknown>;
  if (scelleIntact(existant) && !argv.includes("--yes-overwrite")) {
    throw new Error(`releve-public.json exists, sealed and intact — it is the PUBLISHED record.\n`
      + `  A published figure does not move because a command was re-run by accident.\n`
      + `  To remeasure and replace it, say so: npm run measure -- --yes-overwrite`);
  }
}

async function principal(): Promise<void> {
  refuserDrapeauxInconnus(["--yes-overwrite"]);
  const racine = fileURLToPath(new URL("..", import.meta.url));
  const cheminJson = racine + "releve-public.json";
  exigerDroitDEcraser(cheminJson, process.argv);
  const commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: racine, encoding: "utf8" }).trim();
  const m = await mesurePublique(new Date().toISOString().slice(0, 10), commit);
  m.empreinte = empreinteDuReleve(m);
  writeFileSync(cheminJson, JSON.stringify(m, null, 1) + "\n");
  writeFileSync(racine + "RELEVE-PUBLIC.md", rapportMd(m));
  console.log(`releve-public.json written and sealed (${m.empreinte}); RELEVE-PUBLIC.md alongside.`);
  console.log(`authored: ${m.authored.nMatch} match / ${m.authored.nDifferent} different. tiers: ${m.paliers.presents.join(", ")}`
    + (m.paliers.absents.length ? `. absent: ${m.paliers.absents.join(", ")}` : ""));
  if ("absent" in m.synthetic) console.log(`synthetic: NOT measured — synthetic.ts absent.`);
}

if (isMain(import.meta)) {
  try {
    await principal();
  } catch (e) {
    console.error(`\n${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  }
}
