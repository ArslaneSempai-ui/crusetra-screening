/**
 * COMPARER DEUX MESURES : la mesure de référence d'une voie (le fichier écrit par `mesure-entites -- --detail`
 * avant toute règle) contre la mesure d'aujourd'hui, relancée ici. Ce qui compte pour la barre d'une voie :
 * les fausses alertes FORTES apparues ou disparues, les vraies paires perdues ou gagnées au fort, jeu par jeu.
 *
 *   npm run comparer -- <référence.txt>
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const ref = process.argv[2];
if (!ref) { console.error("usage : npm run comparer -- <référence.txt>"); process.exit(2); }
const avant = readFileSync(ref, "utf8").split("\n");
const r = spawnSync("node", [new URL("./mesure-entites.ts", import.meta.url).pathname, "--detail"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
if (r.status !== 0) { console.error(r.stderr); process.exit(r.status ?? 1); }
const apres = r.stdout.split("\n");

const tete = (l: string[]) => l.filter((x) => /^(FORT|POSSIBLE)\b/.test(x));
console.log("référence :\n  " + tete(avant).join("\n  ") + "\naujourd'hui :\n  " + tete(apres).join("\n  "));

/* une paire est identifiée par son texte ; son état est le préfixe de la ligne de détail */
type Etat = "FAUSSE-F" | "fausse-p" | "RATÉ" | "possible";
const etats = (l: string[]) => {
  const m = new Map<string, Etat>();
  for (const x of l) { const t = /^  (FAUSSE-F|fausse-p|RATÉ|possible) +[\d.]+ +\S+ +(.*)$/.exec(x); if (t) m.set(t[2]!, t[1] as Etat); }
  return m;
};
const A = etats(avant), B = etats(apres);
const fortFaux = (e?: Etat) => e === "FAUSSE-F";
const fortRate = (e?: Etat) => e === "RATÉ" || e === "possible";
const liste = (titre: string, paires: string[]) => { console.log(`\n${titre} : ${paires.length}`); for (const p of paires.slice(0, 25)) console.log("  " + p.slice(0, 150)); if (paires.length > 25) console.log(`  … et ${paires.length - 25} de plus`); };
const cles = new Set([...A.keys(), ...B.keys()]);
liste("fausses alertes FORTES apparues", [...cles].filter((k) => fortFaux(B.get(k)) && !fortFaux(A.get(k))));
liste("fausses alertes fortes disparues", [...cles].filter((k) => fortFaux(A.get(k)) && !fortFaux(B.get(k))));
liste("vraies paires PERDUES au fort", [...cles].filter((k) => fortRate(B.get(k)) && !fortRate(A.get(k))));
liste("vraies paires gagnées au fort", [...cles].filter((k) => fortRate(A.get(k)) && !fortRate(B.get(k))));
