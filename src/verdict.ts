/**
 * LE VERDICT UNIQUE : le jeu aveugle de verification/paires-entites-verdict.json, jugé une fois,
 * agrégats seulement. Rien de ce script ne lit une paire : il compte le recouvrement avec les jeux
 * d'apprentissage (paires et noms, avant de juger), fige les empreintes du code, puis imprime les
 * taux aux deux niveaux avec leurs intervalles de Wilson, et la courbe. Le registre est
 * verification/VERDICTS.md ; la ligne s'y écrit à la main, à partir de ce que ce script imprime.
 *
 *   npm run verdict [-- --version=v12]
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { mesurerJeux, frequencesDe, CHEMIN_VERDICT, FREQUENCES_UNIFORMES } from "./entites.ts";
import { frequencesDesListes } from "./frequences.ts";
import { lireManifeste } from "./listes.ts";

const version = (process.argv.find((a) => a.startsWith("--version=")) ?? "--version=?").slice("--version=".length);
const ici = new URL(".", import.meta.url);
const empreinte = (f: string) => createHash("sha256").update(readFileSync(new URL(f, ici))).digest("hex").slice(0, 8);
const brut = readFileSync(CHEMIN_VERDICT, "utf8");
const verdict = JSON.parse(brut) as { paires: { a: string; b: string; verdict: string }[] };

/* le recouvrement AVANT le jugement : un jeu qui recopie l'apprentissage ne mesure rien */
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const cle = (p: { a: string; b: string }) => [norm(p.a), norm(p.b)].sort().join(" | ");
const cles = new Set<string>(), noms = new Set<string>();
for (const f of readdirSync(ici).filter((f) => /^paires-entites.*\.json$/.test(f))) {
  for (const p of JSON.parse(readFileSync(new URL(f, ici), "utf8")).paires) { cles.add(cle(p)); noms.add(norm(p.a)); noms.add(norm(p.b)); }
}
let rp = 0, rn = 0, egaux = 0;
for (const p of verdict.paires) { if (cles.has(cle(p))) rp++; if (noms.has(norm(p.a)) || noms.has(norm(p.b))) rn++; if (norm(p.a) === norm(p.b)) egaux++; }
console.log(`jeu ${createHash("sha256").update(brut).digest("hex").slice(0, 8)} · ${verdict.paires.length} paires · recouvrement avec l'apprentissage : ${rp} paires, ${rn} noms déjà vus · ${egaux} paires identiques à la casse près`);
console.log(`méthode ${version} · entites ${empreinte("entites.ts")} · cribler ${empreinte("cribler.ts")} · ecritures ${empreinte("ecritures.ts")}`);

const m0 = lireManifeste();
const f = frequencesDesListes();
const m = mesurerJeux(f, [brut]);
const M = m.jeux[0]!.match, D = m.jeux[0]!.different;
const wilson = (k: number, n: number) => { const z = 1.96, p = k / n, d = 1 + z * z / n; const c = (p + z * z / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d; return `[${Math.round((c - h) * 100)}-${Math.round((c + h) * 100)} %]`; };
const cell = (s: number) => m.table[s.toFixed(2)]!;
for (const [nom, s] of [["FORT", 0.81], ["POSSIBLE", 0.80]] as const) {
  const c = cell(s);
  console.log(`${nom.padEnd(9)} ${s.toFixed(2)} : vrais ${c.rappel.succes}/${M} ${wilson(c.rappel.succes, M)} · fausses alertes ${c.fauxPositifs.succes}/${D} ${wilson(c.fauxPositifs.succes, D)}`);
}
console.log("courbe : " + [0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9].map((s) => `${s.toFixed(2)} R${Math.round(cell(s).rappel.taux * 100)} FP${Math.round(cell(s).fauxPositifs.taux * 100)}`).join("  "));
