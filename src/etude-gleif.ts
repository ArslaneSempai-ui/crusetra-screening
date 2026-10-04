/**
 * THE REAL TRAINING SAMPLE, STUDIED: src/paires-gleif-apprentissage.json (real names from the GLEIF register, drawn by
 * src/gleif-paires.ts with seed 20261001, sharing no name with either verdict set) and its labels
 * (src/paires-gleif-apprentissage-juges.json), measured with the method as it stands, next to the 23 written training sets.
 *
 *   node src/etude-gleif.ts                       the table at the thresholds `choisirSeuils` chooses
 *   node src/etude-gleif.ts --seuils=0.81,0.80    the same table at given thresholds (strong, possible)
 *   node src/etude-gleif.ts --paires              and one line per same-entity pair of the sample found below strong
 *
 * This is a TRAINING script: it may print pairs, names and scores, because this sample is there to be studied. It never
 * opens verification/: the fresh verdict sample is measured once, by src/verdict-gleif-2.ts, and by no one else.
 * At most two scoring threads (the machine is shared).
 */
import { readFileSync } from "node:fs";
import { isMain, refuserDrapeauxInconnus } from "./cli.ts";
import { CHEMINS_APPRENTISSAGE, CHEMIN_APPRENTISSAGE_REEL, STRATE_CONTENUE, choisirSeuils } from "./entites.ts";
import { frequencesDesListes } from "./frequences.ts";
import { rate } from "./interval.ts";
import { mesurerJeuxParallele, mesurerReelParallele } from "./mesure-parallele.ts";

export const CHEMIN_JUGES_APPRENTISSAGE = new URL("./paires-gleif-apprentissage-juges.json", import.meta.url);
export const KINDS = ["same-name", "partial", "other-name"] as const;
const THREADS = 2;

const cell = (k: number, n: number): string => {
  if (n === 0) return "   0/0    (none)";
  const r = rate(k, n);
  return `${String(k).padStart(4)}/${String(n).padEnd(4)} ${(r.rate * 100).toFixed(1).padStart(5)} % [${(r.low * 100).toFixed(1)}-${(r.high * 100).toFixed(1)} %]`;
};

async function main(): Promise<void> {
  refuserDrapeauxInconnus(["--seuils", "--paires"]);
  const donnes = process.argv.find((a) => a.startsWith("--seuils="))?.slice(9).split(",").map(Number);
  if (donnes && (donnes.length !== 2 || donnes.some((x) => !Number.isFinite(x)))) throw new Error("--seuils=<strong>,<possible>, two numbers");
  const f = frequencesDesListes();
  const ecrits = await mesurerJeuxParallele(f, CHEMINS_APPRENTISSAGE.map((u) => readFileSync(u, "utf8")), { cache: true, fils: THREADS });
  const brut = readFileSync(CHEMIN_APPRENTISSAGE_REEL, "utf8");
  const reel = await mesurerReelParallele(f, brut, { cache: true, fils: THREADS });
  const r = choisirSeuils(ecrits.table, reel.table);
  const [strong, possible] = donnes ?? [r.fort.seuil, r.possible.seuil];
  console.log(`thresholds ${donnes ? "given" : "chosen by the written rule"}: strong ${strong!.toFixed(2)}, possible ${possible!.toFixed(2)}`
    + (donnes ? ` (the rule would choose ${r.fort.seuil.toFixed(2)}, ${r.possible.seuil.toFixed(2)})` : ""));

  /* the whole sample, contained stratum included, with its labels: measured apart from the rule's table, on the same scores */
  const tout = await mesurerJeuxParallele(f, [brut], { cache: true, fils: THREADS });
  const labels = (JSON.parse(readFileSync(CHEMIN_JUGES_APPRENTISSAGE, "utf8")) as { labels: Record<string, string> }).labels;
  type Tally = { n: number; strong: number; possible: number };
  const empty = (): Tally => ({ n: 0, strong: 0, possible: 0 });
  const add = (t: Tally, s: number) => { t.n++; if (s >= strong!) t.strong++; if (s >= possible!) t.possible++; };
  const byKind = new Map<string, Tally>(KINDS.map((k) => [k, empty()]));
  const negatives = empty(), contained = empty();
  const missed: string[] = [];
  let m = 0;
  tout.paires.forEach((p, k) => {
    const s = tout.scores[k]!;
    if (p.verdict === "match") {
      const kind = labels[String(m++)];
      if (!kind || !byKind.has(kind)) throw new Error(`match pair ${m - 1} has no label: nothing is reported.`);
      add(byKind.get(kind)!, s);
      if (s < strong!) missed.push(`${s.toFixed(3)}\t${kind}\t${p.nature}\t${p.a}\t${p.b}`);
    } else add(p.nature === STRATE_CONTENUE ? contained : negatives, s);
  });
  const ecrit = (seuil: number) => ecrits.table[seuil.toFixed(2)]!;
  const line = (label: string, t: Tally) => console.log(`  ${label.padEnd(40)} strong ${cell(t.strong, t.n)}   possible ${cell(t.possible, t.n)}`);
  console.log(`REAL TRAINING SAMPLE (GLEIF, ${tout.paires.length} pairs), same entity found, by kind of second name:`);
  for (const k of KINDS) line(k, byKind.get(k)!);
  console.log("  false alerts:");
  line("real different companies", negatives);
  line("contained stratum (reported apart)", contained);
  const S = ecrit(strong!), P = ecrit(possible!);
  console.log(`WRITTEN TRAINING SETS (${ecrits.jeux.length} sets, pooled):`);
  console.log(`  ${"recall".padEnd(40)} strong ${cell(S.rappel.succes, S.rappel.n)}   possible ${cell(P.rappel.succes, P.rappel.n)}`);
  console.log(`  ${"false alerts".padEnd(40)} strong ${cell(S.fauxPositifs.succes, S.fauxPositifs.n)}   possible ${cell(P.fauxPositifs.succes, P.fauxPositifs.n)}`);
  if (process.argv.includes("--paires")) {
    console.log("SAME-ENTITY PAIRS OF THE TRAINING SAMPLE BELOW STRONG (score, kind, stratum, a, b):");
    for (const l of missed.sort()) console.log(l);
  }
}

if (isMain(import.meta)) await main();
