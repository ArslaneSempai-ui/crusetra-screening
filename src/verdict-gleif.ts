/**
 * THE GLEIF VERDICT: verification/paires-gleif.json (real names, labelled by the register, built
 * by src/gleif-paires.ts) judged once, aggregates only.
 *
 *   node src/verdict-gleif.ts
 *
 * The same code path as `npm run verdict`: the entity score of src/entites.ts, the word weights
 * of the lists (src/frequences.ts), the pairs scored on threads (src/mesure-parallele.ts). The
 * two thresholds are NOT written here: they are chosen by `choisirSeuils` on the training sets,
 * measured first in this same run, exactly as the screener chooses them.
 *
 * It prints counts per stratum and in total, each with its 95 % Wilson interval (src/interval.ts).
 * It never prints a pair, a name or a score: reading which pairs were missed would turn the set
 * into a training set.
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { isMain, refuserDrapeauxInconnus } from "./cli.ts";
import { CHEMINS_APPRENTISSAGE, CHEMIN_VERDICT, choisirSeuils } from "./entites.ts";
import { frequencesDesListes } from "./frequences.ts";
import { rate } from "./interval.ts";
import { validerPaires, type JeuDePaires } from "./measure.ts";
import { mesurerJeuxParallele } from "./mesure-parallele.ts";

const SET = new URL("../verification/paires-gleif.json", import.meta.url);
/** At most four scoring threads: the machine is shared. */
const THREADS = 4;
const CONTAINED = "different-contained";

const cell = (k: number, n: number): string => {
  const r = rate(k, n);
  return `${String(k).padStart(4)}/${String(n).padEnd(4)} ${(r.rate * 100).toFixed(1).padStart(5)} % [${(r.low * 100).toFixed(1)}-${(r.high * 100).toFixed(1)} %]`;
};

async function main(): Promise<void> {
  refuserDrapeauxInconnus([]);
  const here = new URL(".", import.meta.url);
  const brut = readFileSync(SET, "utf8");
  const set = JSON.parse(brut) as JeuDePaires;
  const pairs = validerPaires(set);

  /* overlap with the training sets and the verdict set, counted BEFORE the verdict */
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const key = (p: { a: string; b: string }) => [norm(p.a), norm(p.b)].sort().join(" | ");
  const keys = new Set<string>(), names = new Set<string>();
  const others = readdirSync(here).filter((f) => /^paires-entites.*\.json$/.test(f)).map((f) => new URL(f, here));
  for (const f of [...others, CHEMIN_VERDICT]) {
    for (const p of (JSON.parse(readFileSync(f, "utf8")) as JeuDePaires).paires) { keys.add(key(p)); names.add(norm(p.a)); names.add(norm(p.b)); }
  }
  let overlapPairs = 0, overlapNames = 0;
  for (const p of pairs) { if (keys.has(key(p))) overlapPairs++; if (names.has(norm(p.a)) || names.has(norm(p.b))) overlapNames++; }
  const fingerprint = (f: string) => createHash("sha256").update(readFileSync(new URL(f, here))).digest("hex").slice(0, 8);
  console.log(`set ${createHash("sha256").update(brut).digest("hex").slice(0, 8)} · ${pairs.length} pairs · overlap with the training and verdict sets: ${overlapPairs} pairs, ${overlapNames} pairs with a name already seen`);
  console.log(`code entites ${fingerprint("entites.ts")} · cribler ${fingerprint("cribler.ts")} · ecritures ${fingerprint("ecritures.ts")} · score ${fingerprint("score.ts")} · preparation ${fingerprint("preparation.ts")}`);

  /* the thresholds, chosen on the training sets by the repository's own rule */
  const f = frequencesDesListes();
  const training = await mesurerJeuxParallele(f, CHEMINS_APPRENTISSAGE.map((u) => readFileSync(u, "utf8")), { cache: true, fils: THREADS });
  const r = choisirSeuils(training.table);
  const strong = r.fort.seuil, possible = r.possible.seuil;
  const M = training.jeux.reduce((s, j) => s + j.match, 0), D = training.jeux.reduce((s, j) => s + j.different, 0);
  console.log(`weights: ${f.entrees ? `${f.entrees} listed entries` : "uniform (no lists on disk)"} · thresholds chosen on ${training.jeux.length} training sets (${M} match, ${D} different): strong ${strong.toFixed(2)}, possible ${possible.toFixed(2)}`);

  /* the single measurement */
  const g = await mesurerJeuxParallele(f, [brut], { cache: true, fils: THREADS });
  const natures = [...new Set(g.paires.map((p) => p.nature))];
  type Tally = { n: number; strong: number; possible: number };
  const tally = new Map<string, Tally>(natures.map((n) => [n, { n: 0, strong: 0, possible: 0 }]));
  g.paires.forEach((p, i) => {
    const t = tally.get(p.nature)!, s = g.scores[i]!;
    t.n++;
    if (s >= strong) t.strong++;
    if (s >= possible) t.possible++;
  });
  const verdictOf = new Map(g.paires.map((p) => [p.nature, p.verdict]));
  const sum = (ns: string[]): Tally => ns.reduce((acc, n) => { const t = tally.get(n)!; return { n: acc.n + t.n, strong: acc.strong + t.strong, possible: acc.possible + t.possible }; }, { n: 0, strong: 0, possible: 0 });
  const positives = natures.filter((n) => verdictOf.get(n) === "match");
  const negatives = natures.filter((n) => verdictOf.get(n) === "different" && n !== CONTAINED);

  /* the per-stratum counts must add up to the repository's own table */
  const all = sum(positives), neg = sum(negatives), con = sum(natures.filter((n) => n === CONTAINED));
  const tS = g.table[strong.toFixed(2)]!, tP = g.table[possible.toFixed(2)]!;
  if (tS.rappel.succes !== all.strong || tP.rappel.succes !== all.possible
    || tS.fauxPositifs.succes !== neg.strong + con.strong || tP.fauxPositifs.succes !== neg.possible + con.possible) {
    throw new Error("the per-stratum counts do not add up to the table of mesurerPaires: nothing is reported.");
  }

  const line = (label: string, t: Tally) => console.log(`  ${label.padEnd(36)} strong ${cell(t.strong, t.n)}   possible ${cell(t.possible, t.n)}`);
  console.log(`MATCH: pairs found (score >= threshold)`);
  for (const n of positives) line(n, tally.get(n)!);
  line("TOTAL match", all);
  console.log(`DIFFERENT: false alerts (score >= threshold), contained stratum apart`);
  for (const n of negatives) line(n, tally.get(n)!);
  line("TOTAL different", neg);
  if (con.n > 0) {
    console.log(`CONTAINED (different entities, one name's words inside the other's): alerts, reported on their own`);
    line(CONTAINED, con);
  }
}

if (isMain(import.meta)) await main();
