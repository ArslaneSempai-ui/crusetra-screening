/**
 * LA MESURE SUR L'HISTORIQUE DU CLIENT — la commande que le contrat promet en une phrase :
 *
 *     npm run measure:yours -- --alerts=your-alerts.csv [--screened=<csv> | --volume=N]
 *     → which matcher suffices, at which threshold, on your own alert history
 *
 * Chaque alerte de l'historique porte un nom filtré, l'entrée de liste qui a déclenché, et
 * la décision de l'analyste (`match` ou `false_positive`). Pour chaque palier du registre et
 * chaque seuil de la grille, on rejoue la paire : le palier aurait-il alerté ? De là, deux
 * taux avec n et intervalle de Wilson : le RAPPEL sur les `match` confirmés (ne jamais rater
 * un vrai hit) et le taux de FAUSSES ALERTES sur les `false_positive`. Les alertes pour
 * mille screenings n'apparaissent que si le volume est fourni — jamais estimées en silence.
 *
 * ─── CE QUE CETTE MESURE NE VOIT PAS, dit d'emblée ───
 *
 * L'historique ne contient que les paires que le moteur ACTUEL a fait remonter. Une paire
 * qu'il n'a jamais alertée n'y figure pas ; le rappel mesuré ici est donc « parmi les vrais
 * hits que votre moteur a trouvés ». La robustesse sur des paires fabriquées est mesurée À
 * PART, sur les variantes synthétiques des listes publiques, et jamais fusionnée.
 *
 * ─── JAMAIS UN NOM ───
 *
 * Les deux sorties (`<fichier>-measured.md`, `<fichier>-measured.json` scellé) portent des
 * comptes, des taux, des intervalles et des verdicts par `alert_id` : jamais un nom filtré,
 * jamais une entrée de liste, jamais un chemin absolu (basename seul). Un test plante une
 * sentinelle dans un nom et prouve d'abord que son détecteur sait la voir.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { isMain, refuserDrapeauxInconnus } from "./cli.ts";
import { lireTable, apercu, MONTRES } from "./csv.ts";
import { rate, type Rate } from "./interval.ts";
import { SEUILS, PALIERS, type PalierId, type Registre, type Matcher } from "./matcher.ts";
import { empreinteDuReleve } from "./empreinte.ts";
import { lignesEvaluation } from "./evaluation.ts";
import { rendreRapport } from "./rapport.ts";

export const COLONNES_REQUISES = ["alert_id", "screened_name", "list_name", "list_source", "disposition"] as const;
export const COLONNES_OPTIONNELLES = ["engine_score", "decided_at"] as const;

/** Sous ce nombre d'alertes, aucune cellule de la frontière ne peut être bornée : refus. */
export const MINIMUM_ALERTES = 30;

export type Disposition = "match" | "false_positive";

export type Alerte = {
  id: string;
  /** Le nom qui a été filtré — NE SORT JAMAIS de ce processus. */
  nomFiltre: string;
  /** L'entrée de liste qui a déclenché — ne sort jamais non plus. */
  entreeListe: string;
  source: string;
  disposition: Disposition;
  scoreMoteur?: number;
  decideeLe?: string;
};

/**
 * Le CSV d'alertes, lu par le lecteur extrait de cascade-routing puis interprété ICI :
 * le schéma appartient à cette commande, pas au lecteur (la garde d'unicité du dépôt
 * d'origine a déjà refusé le fichier légitime d'un emprunteur dont le schéma différait).
 */
export function lireAlertes(texte: string): { alertes: Alerte[]; avertissements: string[] } {
  const t = lireTable(texte);

  const connues = new Set<string>([...COLONNES_REQUISES, ...COLONNES_OPTIONNELLES]);
  const inconnues = t.noms.filter((n) => !connues.has(n));
  if (inconnues.length > 0) {
    throw new Error(
      `Your header carries ${inconnues.length} column(s) this command does not know: `
      + `${apercu(inconnues.map((n) => `"${n}"`), MONTRES)}.\n`
      + `  Accepted: ${[...COLONNES_REQUISES].join(", ")} — then, optionally: `
      + `${[...COLONNES_OPTIONNELLES].join(", ")}.\n`
      + `  Left as they were, unknown columns would be read as something else or dropped in\n`
      + `  silence, and the rates would answer a different question than the one you asked.`);
  }
  const manquantes = COLONNES_REQUISES.filter((n) => !t.noms.includes(n));
  if (manquantes.length > 0) {
    throw new Error(
      `Your header is missing ${manquantes.map((n) => `"${n}"`).join(", ")}.\n`
      + `  The five required columns are: ${[...COLONNES_REQUISES].join(", ")}.\n`
      + `  alert_id names the alert in your system, screened_name is the name that was\n`
      + `  screened, list_name the list entry that triggered, list_source its list (OFAC,\n`
      + `  EU, UN, INTERNAL, or your own label), disposition the analyst's decision:\n`
      + `  match or false_positive. Optional: engine_score (0..1 or 0..100), decided_at (ISO).`);
  }

  const avertissements: string[] = [];
  if (t.ecartees.length) avertissements.push(
    `${t.ecartees.length} row(s) carried more cells than the header and were discarded: `
    + `line(s) ${t.ecartees.slice(0, 8).map((e) => e.ligne).join(", ")}.`);
  if (t.courtes.length) avertissements.push(
    `${t.courtes.length} row(s) were shorter than the header; missing cells were read as empty: `
    + `line(s) ${t.courtes.slice(0, 8).map((e) => e.ligne).join(", ")}.`);
  if (t.demesurees.length) avertissements.push(
    `${t.demesurees.length} cell(s) exceed a megabyte — the most likely cause is a quote closed `
    + `far from where it opened, swallowing rows. Line(s) ${t.demesurees.slice(0, 4).map((d) => d.ligne).join(", ")}.`);

  const col = Object.fromEntries(t.noms.map((n, i) => [n, i])) as Record<string, number>;
  const lireCellule = (l: string[], nom: string): string => (l[col[nom]!] ?? "").trim();

  /* La disposition est un vocabulaire fermé : tout le reste se refuse EN NOMMANT la ligne
     et la valeur reçue — sur la console locale seulement, jamais dans une sortie émise. */
  const horsVocabulaire = t.lignes
    .map((l, i) => ({ ligne: t.numeros[i]!, valeur: lireCellule(l, "disposition") }))
    .filter((x) => x.valeur !== "match" && x.valeur !== "false_positive");
  if (horsVocabulaire.length > 0) {
    const montre = horsVocabulaire.slice(0, 8)
      .map((x) => `line ${x.ligne}: "${x.valeur}"`).join("; ");
    throw new Error(
      `${horsVocabulaire.length} row(s) carry a disposition outside the vocabulary: ${montre}.\n`
      + `  This tool reads exactly two: "match" (a confirmed true hit) and "false_positive"\n`
      + `  (the analyst cleared it). Anything else — pending, escalated, a typo — has no\n`
      + `  place in either rate, and guessing a side would move the figure you publish.\n`
      + `  Map your dispositions to these two, or drop the undecided rows.`);
  }

  /* Un alert_id vide ne peut pas indexer un verdict ; un doublon compterait une alerte
     deux fois dans le taux. Les deux se refusent en nommant les lignes. */
  const vides = t.lignes.map((l, i) => ({ ligne: t.numeros[i]!, id: lireCellule(l, "alert_id") }))
    .filter((x) => x.id === "");
  if (vides.length > 0) {
    throw new Error(
      `${vides.length} row(s) have an empty alert_id: line(s) `
      + `${vides.slice(0, 8).map((x) => x.ligne).join(", ")}.\n`
      + `  Every verdict in the sealed record is keyed by alert_id; an empty one cannot be\n`
      + `  told apart from another empty one. Give each row its identifier.`);
  }
  const parId = new Map<string, number[]>();
  t.lignes.forEach((l, i) => {
    const id = lireCellule(l, "alert_id");
    parId.set(id, [...(parId.get(id) ?? []), t.numeros[i]!]);
  });
  const doublons = [...parId.entries()].filter(([, lignes]) => lignes.length > 1);
  if (doublons.length > 0) {
    const montre = doublons.slice(0, 6)
      .map(([id, lignes]) => `"${id}" (rows ${lignes.join(", ")})`).join("; ");
    throw new Error(
      `duplicate alert_id(s): ${montre}.\n`
      + `  One row is one alert: a duplicate would count the same alert twice in a rate\n`
      + `  without a word. Deduplicate the export, or give each row its own id.\n`
      + `  Nothing was measured.`);
  }

  if (t.lignes.length < MINIMUM_ALERTES) {
    throw new Error(
      `Your file holds ${t.lignes.length} alert(s); this measurement wants at least ${MINIMUM_ALERTES}.\n`
      + `  Below that, no cell of the threshold frontier can be bounded: every interval\n`
      + `  spans most of the scale, and a report full of "too few to quote" would waste\n`
      + `  your reviewers' time. Export a longer window of history and run again.`);
  }

  const alertes: Alerte[] = t.lignes.map((l) => {
    const brut = lireCellule(l, "engine_score");
    const score = brut === "" ? undefined : Number(brut);
    return {
      id: lireCellule(l, "alert_id"),
      nomFiltre: lireCellule(l, "screened_name"),
      entreeListe: lireCellule(l, "list_name"),
      source: lireCellule(l, "list_source"),
      disposition: lireCellule(l, "disposition") as Disposition,
      /* Un score illisible est une absence comptée, jamais un zéro : Number("") vaut 0 et
         un 0 inventé se lirait comme un moteur qui doute. */
      ...(score !== undefined && Number.isFinite(score) ? { scoreMoteur: score } : {}),
      ...(lireCellule(l, "decided_at") !== "" ? { decideeLe: lireCellule(l, "decided_at") } : {}),
    };
  });
  return { alertes, avertissements };
}

/* ───────────────────────────── la mesure elle-même ───────────────────────────── */

export type Cellule = {
  seuil: number;
  /** Alertes de l'historique que ce palier, à ce seuil, aurait fait remonter. */
  tirees: number;
  rappel: Rate;
  faussesAlertes: Rate;
  /** Alertes pour mille screenings — présent SEULEMENT si le volume a été fourni. */
  pourMille?: number;
};

export type MesurePalier = {
  description: string;
  rang: number;
  cellules: Cellule[];
};

export type MesureAlertes = {
  kind: "screening-client-record";
  version: 1;
  measuredAt: string;
  source: {
    file: string; sha256: string;
    alerts: number; matches: number; falsePositives: number;
    /** Bornes de `decided_at` quand la colonne existe et se lit ; null sinon. */
    periode: { from: string; to: string; jours: number; illisibles: number } | null;
  };
  /** D'où vient le dénominateur des alertes pour mille — null : colonne absente du rapport. */
  volume: { origine: "screened" | "volume"; n: number } | null;
  paliers: Partial<Record<PalierId, MesurePalier>>;
  /** Les paliers du contrat absents du registre ce soir — la table le dit, elle ne plante pas. */
  absents: PalierId[];
  /**
   * Un verdict par alerte : la disposition de l'analyste et le score de chaque palier.
   * Des identifiants et des nombres — JAMAIS un nom. Le score permet de rejouer n'importe
   * quel seuil sans retoucher le fichier du client.
   */
  verdicts: Record<string, { disposition: Disposition; scores: Partial<Record<PalierId, number>> }>;
  code: { commit: string } | null;
  empreinte?: string;
};

/** La période, lue des `decided_at` lisibles ; les illisibles sont comptés, jamais tus. */
export function periodeDe(alertes: readonly Alerte[]): MesureAlertes["source"]["periode"] {
  const brutes = alertes.map((a) => a.decideeLe).filter((d): d is string => d !== undefined);
  if (brutes.length === 0) return null;
  const lues = brutes.map((d) => ({ brut: d, t: Date.parse(d) }));
  const illisibles = lues.filter((x) => Number.isNaN(x.t)).length;
  const valides = lues.filter((x) => !Number.isNaN(x.t));
  if (valides.length === 0) return { from: "", to: "", jours: 0, illisibles };
  const from = new Date(Math.min(...valides.map((x) => x.t))).toISOString().slice(0, 10);
  const to = new Date(Math.max(...valides.map((x) => x.t))).toISOString().slice(0, 10);
  const jours = Math.max(1, Math.round((Math.max(...valides.map((x) => x.t)) - Math.min(...valides.map((x) => x.t))) / 86_400_000));
  return { from, to, jours, illisibles };
}

export function mesurer(
  alertes: readonly Alerte[],
  registre: Registre,
  fichier: string,
  sha256: string,
  volume: MesureAlertes["volume"],
  measuredAt = new Date().toISOString(),
): MesureAlertes {
  const matches = alertes.filter((a) => a.disposition === "match");
  const fps = alertes.filter((a) => a.disposition === "false_positive");

  const paliers: Partial<Record<PalierId, MesurePalier>> = {};
  const verdicts: MesureAlertes["verdicts"] = Object.fromEntries(
    alertes.map((a) => [a.id, { disposition: a.disposition, scores: {} as Partial<Record<PalierId, number>> }]));

  const presents = [...registre.values()].sort((a, b) => a.rang - b.rang);
  for (const m of presents) {
    /* Le score d'une paire se calcule UNE fois, puis chaque seuil n'est qu'une comparaison :
       51 seuils ne coûtent pas 51 mesures. Le score voyage BRUT jusqu'au relevé : un arrondi
       avant la comparaison ferait tirer au seuil 1,00 un score de 0,99996 — et le registre
       garantit le déterminisme, donc le flottant exact est déjà stable d'une machine à
       l'autre. Les noms partent bruts aussi : chaque matcher normalise lui-même, et une
       double normalisation fausserait `exact` sans un mot (couture R1, 5/09 au soir). */
    const scores = new Map<string, number>(
      alertes.map((a) => [a.id, m.score(a.nomFiltre, a.entreeListe)]));
    for (const a of alertes) verdicts[a.id]!.scores[m.id] = scores.get(a.id)!;

    const cellules: Cellule[] = SEUILS.map((seuil) => {
      const tire = (a: Alerte) => scores.get(a.id)! >= seuil;
      const tirees = alertes.filter(tire).length;
      return {
        seuil,
        tirees,
        rappel: rate(matches.filter(tire).length, matches.length),
        faussesAlertes: rate(fps.filter(tire).length, fps.length),
        ...(volume ? { pourMille: Math.round((tirees / volume.n) * 1000 * 100) / 100 } : {}),
      };
    });
    paliers[m.id] = { description: m.description, rang: m.rang, cellules };
  }

  return {
    kind: "screening-client-record",
    version: 1,
    measuredAt,
    source: {
      file: basename(fichier), sha256,
      alerts: alertes.length, matches: matches.length, falsePositives: fps.length,
      periode: periodeDe(alertes),
    },
    volume,
    paliers,
    absents: PALIERS.filter((p) => !registre.has(p)),
    verdicts,
    code: commitCourant(),
  };
}

/** Le commit courant, si un dépôt est là — provenance du relevé, jamais bloquant. */
export function commitCourant(): { commit: string } | null {
  try {
    const commit = execFileSync("git", ["rev-parse", "--short", "HEAD"],
      { cwd: new URL(".", import.meta.url).pathname, encoding: "utf8" }).trim();
    return commit ? { commit } : null;
  } catch { return null; }
}

/* ─────────────────────────── le volume, s'il est fourni ─────────────────────────── */

export function lireVolume(brut: string): number {
  /* `Number()` accepterait «  », « 0x50 » et « 1e3 » sans un mot ; le motif, non. */
  if (!/^\d{1,12}$/.test(brut) || Number(brut) < 1) {
    throw new Error(
      `--volume=${brut} is not a number of screenings this tool reads. It wants a whole\n`
      + `  number of names screened over the period of your file, like --volume=250000.`);
  }
  return Number(brut);
}

export function compterScreened(texte: string): number {
  const t = lireTable(texte);
  if (!t.noms.includes("screened_name")) {
    throw new Error(
      `The --screened file needs one column named "screened_name" (yours: `
      + `${t.noms.map((n) => `"${n}"`).join(", ")}).\n`
      + `  Only its ROW COUNT is used — the names themselves are never read into the record.`);
  }
  return t.lignes.length;
}

/* ─────────────────────────────── l'exécution entière ─────────────────────────────── */

/**
 * Le pipeline complet, injectable : les tests et l'épreuve de bout en bout lui donnent un
 * registre factice, `principal()` lui donne le vrai. Une seule écriture pour les deux.
 */
export function executer(
  fichier: string,
  registre: Registre,
  volume: MesureAlertes["volume"],
): { mesure: MesureAlertes; cheminMd: string; cheminJson: string; avertissements: string[] } {
  const texte = readFileSync(fichier, "utf8");
  const sha = createHash("sha256").update(texte).digest("hex");
  const { alertes, avertissements } = lireAlertes(texte);

  if (registre.size === 0) {
    throw new Error(
      `The matcher registry is empty: there is nothing to measure with.\n`
      + `  The matchers live in src/matchers/ and register themselves in src/matchers/index.ts.`);
  }

  const m = mesurer(alertes, registre, fichier, sha, volume);
  m.empreinte = empreinteDuReleve(m);

  const base = fichier.replace(/\.csv$/i, "");
  const cheminJson = `${base}-measured.json`;
  const cheminMd = `${base}-measured.md`;
  writeFileSync(cheminJson, JSON.stringify(m, null, 2) + "\n");
  writeFileSync(cheminMd, rendreRapport(m));
  return { mesure: m, cheminMd, cheminJson, avertissements };
}

/* piege:ok facade-en-francais — le seul mot « français » de l'aide est « UN » en capitales :
   la liste des Nations Unies, vocabulaire du contrat (§2, list_source). Renommer un
   vocabulaire publié pour satisfaire un contrôle serait le mauvais correctif ; le vrai est
   côté règle (l'article français ne s'écrit jamais en capitales au milieu d'une phrase),
   signalé au chef le 5/09 au soir. */
async function principal(): Promise<void> {
  for (const l of lignesEvaluation()) console.log(l);
  refuserDrapeauxInconnus(["--alerts", "--screened", "--volume"]);
  const arg = (nom: string) => process.argv.find((a) => a.startsWith(`--${nom}=`))?.split("=").slice(1).join("=");
  const fichier = arg("alerts");
  if (!fichier) {
    console.log(`
Which matcher suffices, at which threshold, on your own alert history.

  npm run measure:yours -- --alerts=your-alerts.csv [--screened=<csv> | --volume=N]

The CSV wants these columns, names deciding, order free:

  alert_id,screened_name,list_name,list_source,disposition[,engine_score,decided_at]

  alert_id       the alert in your system
  screened_name  the name that was screened
  list_name      the list entry that triggered
  list_source    OFAC / EU / UN / INTERNAL / your own label
  disposition    the analyst's decision: match or false_positive
  engine_score   optional: your current engine's score, 0..1 or 0..100
  decided_at     optional ISO date: buys the period, and monthly figures downstream

--screened=<csv> (one screened_name column) or --volume=N supplies the number of names
screened over the period; without one of them, alerts-per-thousand is not shown — never
estimated in silence.

It writes, next to your file and nowhere else:
  <file>-measured.md     the report (five sections, no names)
  <file>-measured.json   the sealed record — counts, rates, verdicts by alert_id; never a name

Then: npm run optimise -- --from=<file>-measured.json --recall=<min>
Nothing about your file leaves this machine.
`);
    return;
  }

  const cheminScreened = arg("screened");
  const brutVolume = arg("volume");
  if (cheminScreened !== undefined && brutVolume !== undefined) {
    console.error(`\nGive --screened OR --volume, not both: they are two ways to supply the same\n`
      + `  denominator, and this tool will not choose between two figures you typed.\n`);
    process.exit(2);
  }
  const volume: MesureAlertes["volume"] =
    cheminScreened !== undefined
      ? { origine: "screened", n: compterScreened(readFileSync(cheminScreened, "utf8")) }
      : brutVolume !== undefined
        ? { origine: "volume", n: lireVolume(brutVolume) }
        : null;

  /* Le registre est le fichier de couture du lot des matchers ; absent ce soir, on refuse
     en le nommant plutôt que de mesurer zéro palier en silence. */
  let registre: Registre;
  try {
    /* Spécificateur calculé : le module appartient au lot des matchers et peut être absent
       de CET arbre ce soir — un import littéral ferait échouer `tsc` sur son absence, alors
       que l'absence est un cas prévu du contrat, traité juste en dessous. */
    const cheminRegistre = "./matchers/index.ts";
    const module = await import(cheminRegistre) as { registre: () => Registre };
    registre = module.registre();
  } catch {
    console.error(`\nThe matcher registry is not built yet (src/matchers/index.ts).\n`
      + `  The measurement needs at least one matcher to replay your alerts against.\n`);
    process.exit(2);
  }

  const { mesure, cheminMd, cheminJson, avertissements } = executer(fichier, registre, volume);
  for (const a of avertissements) console.warn(`⚠ ${a}`);

  console.log(`\n${mesure.source.alerts} alert(s) — ${mesure.source.matches} confirmed match(es), `
    + `${mesure.source.falsePositives} false positive(s); ${Object.keys(mesure.paliers).length} matcher(s), `
    + `${SEUILS.length} thresholds each.`);
  if (mesure.absents.length) {
    console.log(`  ${mesure.absents.length} contract matcher(s) not in tonight's registry: `
      + `${mesure.absents.join(", ")} — said in the report, not guessed.`);
  }
  console.log(`  ${cheminMd}`);
  console.log(`  ${cheminJson}`);
  console.log(`\nNext: npm run optimise -- --from=${basename(cheminJson)} --recall=0.95\n`);
}

/* Un refus destiné au client ne sort pas en trace de pile. */
if (isMain(import.meta)) {
  try {
    await principal();
  } catch (e) {
    console.error(`\n${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(2);
  }
}
