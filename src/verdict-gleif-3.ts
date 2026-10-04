/**
 * THE THIRD GLEIF VERDICT: verification/paires-gleif-3.json (real names from the GLEIF register, drawn by src/gleif-paires.ts
 * with seed 20261004, sharing no name with the two spent verdict sets or with the training sample) and its blind labels
 * (verification/paires-gleif-3-juges.json), measured ONCE, with the method frozen before, counts only. It judges the method
 * after the round of 4 October 2026 (seven lists, the loan key with its vowels, the short block, the vessel named behind its
 * owner): the same script as src/verdict-gleif-2.ts, on a fresh sample.
 *
 *   node src/verdict-gleif-3.ts --geler     record the hashes of every file the method depends on (the frozen method), in
 *                                           verification/methode-gelee-gleif-3.json; never opens the verdict sample
 *   node src/verdict-gleif-3.ts             the single measurement
 *
 * The single measurement refuses to run
 *  - when any file of the frozen method (the matcher's modules, their data, the training sets, the lists' manifest) no
 *    longer has its frozen hash: the verdict would not be the verdict of the method that was frozen;
 *  - when verification/verdict-gleif-3.txt exists: the sample has been judged, and by the rule of VERDICTS.md it can
 *    no longer serve as a verdict. The result is written there, and printed.
 *
 * The two thresholds are NOT written here: they are chosen by `choisirSeuils` (src/entites.ts) on the 23 written training
 * sets and the real training sample, measured first in this same run, exactly as the screener chooses them. The output
 * is counts per kind of second name (the judges' labels), per register stratum, and the false alerts on real different
 * companies (the contained stratum apart), each with its 95 % Wilson interval (src/interval.ts). It never prints a pair,
 * a name or a score. At most two scoring threads (the machine is shared).
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { isMain, refuserDrapeauxInconnus } from "./cli.ts";
import { CHEMINS_APPRENTISSAGE, CHEMIN_APPRENTISSAGE_REEL, CHEMIN_VERDICT, STRATE_CONTENUE, choisirSeuils } from "./entites.ts";
import { frequencesDesListes } from "./frequences.ts";
import { rate } from "./interval.ts";
import { validerPaires, type JeuDePaires } from "./measure.ts";
import { mesurerJeuxParallele, mesurerReelParallele } from "./mesure-parallele.ts";

const RACINE = new URL("../", import.meta.url);
const SET = new URL("verification/paires-gleif-3.json", RACINE);
const LABELS = new URL("verification/paires-gleif-3-juges.json", RACINE);
export const CHEMIN_GEL = new URL("verification/methode-gelee-gleif-3.json", RACINE);
const RESULTAT = new URL("verification/verdict-gleif-3.txt", RACINE);
const KINDS = ["same-name", "partial", "other-name"] as const;
const THREADS = 2;

/**
 * THE FROZEN METHOD: every file the score and the choice of the thresholds depend on. The modules are found by following
 * the relative imports from the screener (src/cribler.ts) and from this script, so that a module added later is frozen
 * with the others; the data they read at run time (the pinyin and jyutping tables, the English word list), the training
 * sets, the real training sample, and the manifest of the lists (the word weights come from the lists it names) are
 * added by name.
 */
export function fichiersDeLaMethode(): string[] {
  const vus = new Set<string>();
  const suivre = (rel: string) => {
    if (vus.has(rel)) return;
    vus.add(rel);
    const texte = readFileSync(new URL(rel, RACINE), "utf8");
    for (const m of texte.matchAll(/(?:from|import)\s*\(?\s*["'](\.\.?\/[^"']+\.ts)["']/g)) {
      const cible = new URL(m[1]!, new URL(rel, RACINE)).pathname.slice(new URL(RACINE).pathname.length);
      suivre(cible);
    }
  };
  suivre("src/cribler.ts");
  suivre("src/verdict-gleif-3.ts");
  const donnees = ["src/pinyin.txt", "src/jyutping.txt", "src/mots-anglais.txt.gz", "listes-manifest.json",
    CHEMIN_APPRENTISSAGE_REEL.pathname.slice(new URL(RACINE).pathname.length),
    ...CHEMINS_APPRENTISSAGE.map((u) => u.pathname.slice(new URL(RACINE).pathname.length))];
  return [...[...vus].sort(), ...donnees];
}

const empreinte = (rel: string) => createHash("sha256").update(readFileSync(new URL(rel, RACINE))).digest("hex");

function geler(): void {
  if (existsSync(RESULTAT)) throw new Error("verification/verdict-gleif-3.txt exists: the sample has been judged, the method it judged cannot be frozen again.");
  const fichiers = Object.fromEntries(fichiersDeLaMethode().map((rel) => [rel, empreinte(rel)]));
  writeFileSync(CHEMIN_GEL, JSON.stringify({
    quoi: "the method frozen before its single measurement on verification/paires-gleif-3.json: the SHA-256 of every file the score and the choice of the two thresholds depend on; src/verdict-gleif-3.ts refuses to measure when one of them differs",
    date: new Date().toISOString().slice(0, 10),
    fichiers,
  }, null, 2) + "\n");
  console.log(`frozen: ${Object.keys(fichiers).length} files -> ${CHEMIN_GEL.pathname}`);
}

const cell = (k: number, n: number): string => {
  if (n === 0) return "   0/0    (none)";
  const r = rate(k, n);
  return `${String(k).padStart(4)}/${String(n).padEnd(4)} ${(r.rate * 100).toFixed(1).padStart(5)} % [${(r.low * 100).toFixed(1)}-${(r.high * 100).toFixed(1)} %]`;
};

async function mesurer(): Promise<void> {
  if (existsSync(RESULTAT)) throw new Error("verification/verdict-gleif-3.txt exists: this sample has been judged once, and is spent. Nothing is measured.");
  if (!existsSync(CHEMIN_GEL)) throw new Error("verification/methode-gelee-gleif-3.json is missing: the method was never frozen. Nothing is measured.");
  const gel = JSON.parse(readFileSync(CHEMIN_GEL, "utf8")) as { fichiers: Record<string, string> };
  const bouges = Object.entries(gel.fichiers).filter(([rel, h]) => !existsSync(new URL(rel, RACINE)) || empreinte(rel) !== h).map(([rel]) => rel);
  const ajoutes = fichiersDeLaMethode().filter((rel) => !(rel in gel.fichiers));
  if (bouges.length || ajoutes.length) {
    throw new Error(`the method is not the frozen one (changed: ${bouges.join(", ") || "none"}; not frozen: ${ajoutes.join(", ") || "none"}). Nothing is measured.`);
  }

  const out: string[] = [];
  const say = (l: string) => { out.push(l); console.log(l); };
  const brut = readFileSync(SET, "utf8");
  const set = JSON.parse(brut) as JeuDePaires;
  validerPaires(set);
  const labelsFile = JSON.parse(readFileSync(LABELS, "utf8")) as { labels?: Record<string, string> };
  if (!labelsFile.labels || typeof labelsFile.labels !== "object") throw new Error("verification/paires-gleif-3-juges.json has no \"labels\" object: nothing is measured.");
  const labels = labelsFile.labels;
  const positives = set.paires.filter((p) => p.verdict === "match");
  const missing = positives.map((_, i) => i).filter((i) => !KINDS.includes(labels[String(i)] as (typeof KINDS)[number]));
  if (missing.length) throw new Error(`${missing.length} same-entity pairs have no label: nothing is measured.`);

  /* overlap with every set the method was built on, counted BEFORE the verdict */
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const key = (p: { a: string; b: string }) => [norm(p.a), norm(p.b)].sort().join(" | ");
  const keys = new Set<string>(), names = new Set<string>();
  const src = new URL("src/", RACINE);
  const autres = [...readdirSync(src).filter((f) => /^paires-(?:entites|gleif-apprentissage)[\w-]*\.json$/.test(f) && !f.endsWith("-juges.json")).map((f) => new URL(f, src)),
    CHEMIN_VERDICT, new URL("verification/paires-gleif.json", RACINE), new URL("verification/paires-gleif-2.json", RACINE)];
  for (const f of autres) {
    for (const p of (JSON.parse(readFileSync(f, "utf8")) as JeuDePaires).paires) { keys.add(key(p)); names.add(norm(p.a)); names.add(norm(p.b)); }
  }
  let overlapPairs = 0, overlapNames = 0;
  for (const p of set.paires) { if (keys.has(key(p))) overlapPairs++; if (names.has(norm(p.a)) || names.has(norm(p.b))) overlapNames++; }
  say(`set ${createHash("sha256").update(brut).digest("hex").slice(0, 8)} · ${set.paires.length} pairs · overlap with the training sets and the other verdict sets: ${overlapPairs} pairs, ${overlapNames} pairs with a name already seen`);
  say(`method frozen in verification/methode-gelee-gleif-3.json (${Object.keys(gel.fichiers).length} files, all unchanged)`);

  /* the thresholds, chosen on the training material by the repository's own written rule */
  const f = frequencesDesListes();
  const training = await mesurerJeuxParallele(f, CHEMINS_APPRENTISSAGE.map((u) => readFileSync(u, "utf8")), { cache: true, fils: THREADS });
  const real = await mesurerReelParallele(f, readFileSync(CHEMIN_APPRENTISSAGE_REEL, "utf8"), { cache: true, fils: THREADS });
  const r = choisirSeuils(training.table, real.table);
  const strong = r.fort.seuil, possible = r.possible.seuil;
  say(`weights: ${f.entrees ? `${f.entrees} listed entries` : "uniform (no lists on disk)"} · thresholds chosen on ${training.jeux.length} written training sets and the real training sample: strong ${strong.toFixed(2)}, possible ${possible.toFixed(2)}`);

  /* the single measurement */
  const g = await mesurerJeuxParallele(f, [brut], { cache: true, fils: THREADS });
  if (g.paires.length !== set.paires.length || g.paires.some((p, k) => p.a !== set.paires[k]!.a || p.b !== set.paires[k]!.b)) {
    throw new Error("the measured pairs are not in the file's order: the labels cannot be joined, nothing is reported.");
  }
  type Tally = { n: number; strong: number; possible: number };
  const empty = (): Tally => ({ n: 0, strong: 0, possible: 0 });
  const add = (t: Tally, s: number) => { t.n++; if (s >= strong) t.strong++; if (s >= possible) t.possible++; };
  const byKind = new Map<string, Tally>(KINDS.map((k) => [k, empty()]));
  const byKindNature = new Map<string, Tally>();
  const byNature = new Map<string, Tally>();
  let m = 0;
  g.paires.forEach((p, k) => {
    const s = g.scores[k]!;
    if (!byNature.has(p.nature)) byNature.set(p.nature, empty());
    add(byNature.get(p.nature)!, s);
    if (p.verdict !== "match") return;
    const kind = labels[String(m++)]!;
    const cle = `${kind} · ${p.nature}`;
    if (!byKindNature.has(cle)) byKindNature.set(cle, empty());
    add(byKind.get(kind)!, s);
    add(byKindNature.get(cle)!, s);
  });
  const sum = (ts: Tally[]): Tally => ts.reduce((a, t) => ({ n: a.n + t.n, strong: a.strong + t.strong, possible: a.possible + t.possible }), empty());
  const verdictOf = new Map(g.paires.map((p) => [p.nature, p.verdict]));
  const natures = [...byNature.keys()];
  const all = sum([...byKind.values()]);
  const neg = sum(natures.filter((n) => verdictOf.get(n) === "different" && n !== STRATE_CONTENUE).map((n) => byNature.get(n)!));
  const con = sum(natures.filter((n) => n === STRATE_CONTENUE).map((n) => byNature.get(n)!));
  /* the counts must add up to the repository's own table */
  const tS = g.table[strong.toFixed(2)]!, tP = g.table[possible.toFixed(2)]!;
  if (all.n !== positives.length || tS.rappel.succes !== all.strong || tP.rappel.succes !== all.possible
    || tS.fauxPositifs.succes !== neg.strong + con.strong || tP.fauxPositifs.succes !== neg.possible + con.possible) {
    throw new Error("the per-kind counts do not add up to the table of mesurerPaires: nothing is reported.");
  }
  const line = (label: string, t: Tally) => say(`  ${label.padEnd(44)} strong ${cell(t.strong, t.n)}   possible ${cell(t.possible, t.n)}`);
  say("SAME ENTITY, found (score >= threshold), by kind of second name:");
  for (const k of KINDS) line(k, byKind.get(k)!);
  line("all", all);
  say("by kind and register stratum:");
  for (const [k, t] of [...byKindNature.entries()].sort()) line(k, t);
  say("DIFFERENT: false alerts (score >= threshold) on real different companies, contained stratum apart:");
  for (const n of natures.filter((x) => verdictOf.get(x) === "different" && x !== STRATE_CONTENUE)) line(n, byNature.get(n)!);
  line("TOTAL different", neg);
  if (con.n > 0) {
    say("CONTAINED (different entities, one name's words inside the other's): alerts, reported on their own");
    line(STRATE_CONTENUE, con);
  }
  writeFileSync(RESULTAT, out.join("\n") + "\n");
}

async function main(): Promise<void> {
  refuserDrapeauxInconnus(["--geler"]);
  if (process.argv.includes("--geler")) geler();
  else await mesurer();
}

if (isMain(import.meta)) await main();
