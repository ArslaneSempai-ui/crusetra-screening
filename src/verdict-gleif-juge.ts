/**
 * THE GLEIF VERDICT, READ BY KIND OF NAME: the same single measurement as src/verdict-gleif.ts, with
 * the 1,000 same-entity pairs split by the label two blind judges gave them (and an arbiter where
 * they disagreed), in verification/paires-gleif-juges.json:
 *
 *   same-name   the same name written differently (spelling, legal form, qualifier, transliteration)
 *   partial     the distinctive core shared, a distinctive word translated, added or dropped
 *   other-name  another name of the same entity (a rename, initials, a brand, a translation)
 *
 *   node src/verdict-gleif-juge.ts
 *
 * The judges never saw a score. This script prints counts only, each with its 95 % Wilson interval:
 * never a pair, a name or a score, so the set stays a verdict set.
 */
import { readFileSync } from "node:fs";
import { isMain, refuserDrapeauxInconnus } from "./cli.ts";
import { CHEMINS_APPRENTISSAGE, choisirSeuils } from "./entites.ts";
import { frequencesDesListes } from "./frequences.ts";
import { rate } from "./interval.ts";
import { validerPaires, type JeuDePaires } from "./measure.ts";
import { mesurerJeuxParallele } from "./mesure-parallele.ts";

const SET = new URL("../verification/paires-gleif.json", import.meta.url);
const LABELS = new URL("../verification/paires-gleif-juges.json", import.meta.url);
const KINDS = ["same-name", "partial", "other-name"] as const;
const THREADS = 4;

const cell = (k: number, n: number): string => {
  if (n === 0) return "   0/0    (none)";
  const r = rate(k, n);
  return `${String(k).padStart(4)}/${String(n).padEnd(4)} ${(r.rate * 100).toFixed(1).padStart(5)} % [${(r.low * 100).toFixed(1)}-${(r.high * 100).toFixed(1)} %]`;
};

async function main(): Promise<void> {
  refuserDrapeauxInconnus([]);
  const brut = readFileSync(SET, "utf8");
  const set = JSON.parse(brut) as JeuDePaires;
  validerPaires(set);
  const labels = (JSON.parse(readFileSync(LABELS, "utf8")) as { labels: Record<string, string> }).labels;
  const positives = set.paires.filter((p) => p.verdict === "match");
  const missing = positives.map((_, i) => i).filter((i) => !KINDS.includes(labels[String(i)] as (typeof KINDS)[number]));
  if (missing.length) throw new Error(`${missing.length} same-entity pairs have no label: nothing is reported.`);

  const f = frequencesDesListes();
  const training = await mesurerJeuxParallele(f, CHEMINS_APPRENTISSAGE.map((u) => readFileSync(u, "utf8")), { cache: true, fils: THREADS });
  const r = choisirSeuils(training.table);
  const strong = r.fort.seuil, possible = r.possible.seuil;
  console.log(`thresholds chosen on ${training.jeux.length} training sets: strong ${strong.toFixed(2)}, possible ${possible.toFixed(2)}`);

  const g = await mesurerJeuxParallele(f, [brut], { cache: true, fils: THREADS });
  if (g.paires.length !== set.paires.length || g.paires.some((p, k) => p.a !== set.paires[k]!.a || p.b !== set.paires[k]!.b)) {
    throw new Error("the measured pairs are not in the file's order: the labels cannot be joined, nothing is reported.");
  }
  type Tally = { n: number; strong: number; possible: number };
  const empty = (): Tally => ({ n: 0, strong: 0, possible: 0 });
  const byKind = new Map<string, Tally>(KINDS.map((k) => [k, empty()]));
  const byKindNature = new Map<string, Tally>();
  let m = 0;
  g.paires.forEach((p, k) => {
    if (p.verdict !== "match") return;
    const kind = labels[String(m++)]!, s = g.scores[k]!;
    const key = `${kind} · ${p.nature}`;
    if (!byKindNature.has(key)) byKindNature.set(key, empty());
    for (const t of [byKind.get(kind)!, byKindNature.get(key)!]) { t.n++; if (s >= strong) t.strong++; if (s >= possible) t.possible++; }
  });
  const total = [...byKind.values()].reduce((a, t) => ({ n: a.n + t.n, strong: a.strong + t.strong, possible: a.possible + t.possible }), empty());
  const tS = g.table[strong.toFixed(2)]!, tP = g.table[possible.toFixed(2)]!;
  if (total.n !== positives.length || tS.rappel.succes !== total.strong || tP.rappel.succes !== total.possible) {
    throw new Error("the per-kind counts do not add up to the table of mesurerPaires: nothing is reported.");
  }
  const line = (label: string, t: Tally) => console.log(`  ${label.padEnd(44)} strong ${cell(t.strong, t.n)}   possible ${cell(t.possible, t.n)}`);
  console.log("SAME ENTITY, found (score >= threshold), by kind of second name:");
  for (const k of KINDS) line(k, byKind.get(k)!);
  line("all", total);
  console.log("by kind and register stratum:");
  for (const [key, t] of [...byKindNature.entries()].sort()) line(key, t);
}

if (isMain(import.meta)) await main();
