/**
 * LE TÉMOIN DE L'INDEX SUR LES VRAIES LISTES : mêmes candidats, mêmes scores que la
 * comparaison exhaustive, et le temps par nom. Demande data/ (les listes descendues).
 *
 *   node src/temoin-index.ts [--exhaustif] [--noms=N]
 *
 * Sans --exhaustif, seul le temps de l'index est mesuré (la comparaison exhaustive prend
 * deux secondes par nom). Les noms : ceux de exemple/contreparties-exemple.csv, plus des
 * noms listés perturbés (faute, coupe à 35, mots collés, ordre, abréviation, annotation).
 */
import { readFileSync } from "node:fs";
import { isMain, refuserDrapeauxInconnus } from "./cli.ts";
import { lireManifeste, lireListe, SOURCES, type EntreeListe } from "./listes.ts";
import { frequencesDe, mesurerJeux, choisirSeuils, CHEMINS_APPRENTISSAGE } from "./entites.ts";
import { Index, cribler, lireContreparties, type Contrepartie } from "./cribler.ts";
import { frequencesDesListes } from "./frequences.ts";

function principal(): void {
  refuserDrapeauxInconnus(["--exhaustif", "--noms"]);
  const n = Number(process.argv.find((a) => a.startsWith("--noms="))?.slice(7) ?? 60);
  const m = lireManifeste();
  if (!m) { console.error("no listes-manifest.json: run `npm run listes -- --fetch` first."); process.exit(2); }
  const entrees: EntreeListe[] = SOURCES.filter((s) => m.listes.some((l) => l.source === s.source && l.disponible))
    .flatMap((s) => lireListe(s.source));
  const f = frequencesDesListes();   /* le cache des fréquences (src/frequences.ts) : les mêmes poids, sans relire les listes */
  const r = choisirSeuils(mesurerJeux(f, CHEMINS_APPRENTISSAGE.map((u) => readFileSync(u, "utf8"))).table);
  const seuils = { fort: r.fort.seuil, possible: r.possible.seuil };
  let t = Date.now();
  const index = new Index(f, entrees, seuils.possible);
  console.log(`index : ${index.noms.length} chaînes en ${Date.now() - t} ms · seuils fort ${seuils.fort} possible ${seuils.possible}`);
  const { lignes } = lireContreparties(readFileSync(new URL("../exemple/contreparties-exemple.csv", import.meta.url), "utf8"));
  let graine = 7;
  const alea = () => (graine = (graine * 1103515245 + 12345) % 2147483648) / 2147483648;
  const perturbes: Contrepartie[] = Array.from({ length: n }, (_, i) => {
    const e = entrees[Math.floor(alea() * entrees.length)]!;
    let nom = e.nom;
    switch (i % 6) {
      case 0: if (nom.length > 4) { const p = 1 + Math.floor(alea() * (nom.length - 2)); nom = nom.slice(0, p) + nom.slice(p + 1); } break;
      case 1: nom = (nom + " International Trading Company").slice(0, 35); break;
      case 2: nom = nom.replace(" ", ""); break;
      case 3: nom = nom.split(" ").reverse().join(" "); break;
      case 4: nom = nom.split(" ").map((w, j) => (j === 1 && w.length > 6 ? w.slice(0, 4) + "." : w)).join(" "); break;
      case 5: nom = nom + (i % 2 ? " (PANAMA FLAG)" : " f/k/a Harbor Line Ltd"); break;
    }
    return { ligne: 1000 + i, nom };
  });
  const tous = [...lignes, ...perturbes];
  t = Date.now();
  const rapides = tous.map((c) => cribler(c, index, seuils));
  const tr = Date.now() - t;
  const trouves = rapides.filter((x) => x.statut !== "no-match").length;
  console.log(`${tous.length} noms · index ${tr} ms (${(tr / tous.length).toFixed(1)} ms/nom) · ${trouves} avec candidat`);
  if (process.argv.includes("--exhaustif")) {
    t = Date.now();
    let ecarts = 0;
    tous.forEach((c, i) => {
      const lent = cribler(c, index, seuils, true);
      if (JSON.stringify(lent) !== JSON.stringify(rapides[i])) { ecarts++; console.log(`  ÉCART ${c.nom}`); }
    });
    console.log(`exhaustif ${Date.now() - t} ms · écarts ${ecarts}${ecarts ? "  ← L'INDEX PERD DES CANDIDATS" : " (l'index ne perd rien)"}`);
    if (ecarts) process.exit(1);
  }
}

if (isMain(import.meta)) principal();
