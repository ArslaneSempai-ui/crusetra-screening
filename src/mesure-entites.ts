/**
 * LA MESURE DU SCORE D'ENTITÉ sur les jeux d'apprentissage, pour qui met la méthode au point.
 *
 *   node src/mesure-entites.ts [--detail] [--sans-listes]
 *
 * Les poids des mots viennent des listes sur disque (comme au criblage) ; `--sans-listes`
 * mesure à poids uniformes, sur une machine sans data/. `--detail` nomme chaque paire ratée
 * ou faussement alertée aux deux niveaux. Le jeu de VERDICT n'est jamais détaillé ici : on
 * ne regarde pas ses paires, sinon il cesse d'être un verdict.
 */
import { readFileSync } from "node:fs";
import { isMain, refuserDrapeauxInconnus } from "./cli.ts";
import { lireManifeste, lireListe, SOURCES } from "./listes.ts";
import { validerPaires, type PaireEtiquetee } from "./measure.ts";
import {
  frequencesDe, palierEntite, mesurerJeux, choisirSeuils, CHEMINS_APPRENTISSAGE, FREQUENCES_UNIFORMES, type Frequences,
} from "./entites.ts";

export function frequencesDesListes(): Frequences {
  const m = lireManifeste();
  if (!m) return FREQUENCES_UNIFORMES;
  const dispo = SOURCES.filter((s) => m.listes.some((l) => l.source === s.source && l.disponible));
  return frequencesDe(dispo.flatMap((s) => lireListe(s.source)).map((e) => [e.nom, ...e.alias]));
}

function principal(): void {
  refuserDrapeauxInconnus(["--detail", "--sans-listes"]);
  const t0 = Date.now();
  const f = process.argv.includes("--sans-listes") ? FREQUENCES_UNIFORMES : frequencesDesListes();
  const bruts = CHEMINS_APPRENTISSAGE.map((u) => readFileSync(u, "utf8"));
  const m = mesurerJeux(f, bruts);
  const r = choisirSeuils(m.table);
  const M = m.jeux.reduce((s, j) => s + j.match, 0), D = m.jeux.reduce((s, j) => s + j.different, 0);
  const cell = (seuil: number) => m.table[seuil.toFixed(2)]!;
  const ligne = (nom: string, seuil: number) => {
    const c = cell(seuil);
    console.log(`${nom.padEnd(9)} seuil ${seuil.toFixed(2)} : vrais noms ${c.rappel.succes}/${M} (${Math.round(c.rappel.taux * 1000) / 10} %) · fausses alertes ${c.fauxPositifs.succes}/${D} (${Math.round(c.fauxPositifs.taux * 1000) / 10} %)`);
  };
  console.log(`${m.jeux.length} jeux d'apprentissage, ${M} paires vraies, ${D} pièges · poids ${f.entrees ? `des ${f.entrees} entrées listées` : "uniformes"}`);
  ligne("FORT", r.fort.seuil);
  ligne("POSSIBLE", r.possible.seuil);
  console.log("courbe : " + [0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9].map((s) => `${s.toFixed(2)} R${Math.round(cell(s).rappel.taux * 100)} FP${Math.round(cell(s).fauxPositifs.taux * 100)}`).join("  "));
  const p = palierEntite(f);
  const parJeu: string[] = [];
  const details: string[] = [];
  bruts.forEach((brut, i) => {
    const paires: PaireEtiquetee[] = validerPaires(JSON.parse(brut));
    const sc = paires.map((x) => ({ x, s: p.score(x.a, x.b) }));
    const Mj = sc.filter((y) => y.x.verdict === "match"), Dj = sc.filter((y) => y.x.verdict !== "match");
    const n = (l: typeof sc, t: number) => l.filter((y) => y.s >= t - 1e-9).length;
    parJeu.push(`  jeu ${i + 1} (${CHEMINS_APPRENTISSAGE[i]!.pathname.split("/").pop()}) : fort R${n(Mj, r.fort.seuil)}/${Mj.length} FP${n(Dj, r.fort.seuil)}/${Dj.length} · possible R${n(Mj, r.possible.seuil)}/${Mj.length} FP${n(Dj, r.possible.seuil)}/${Dj.length}`);
    for (const { x, s } of sc) {
      const v = x.verdict === "match";
      if (v && s < r.possible.seuil) details.push(`  RATÉ     ${s.toFixed(3)} ${x.nature.padEnd(28)} ${x.a}  /  ${x.b}`);
      else if (v && s < r.fort.seuil) details.push(`  possible ${s.toFixed(3)} ${x.nature.padEnd(28)} ${x.a}  /  ${x.b}`);
      else if (!v && s >= r.fort.seuil) details.push(`  FAUSSE-F ${s.toFixed(3)} ${x.nature.padEnd(28)} ${x.a}  /  ${x.b}`);
      else if (!v && s >= r.possible.seuil) details.push(`  fausse-p ${s.toFixed(3)} ${x.nature.padEnd(28)} ${x.a}  /  ${x.b}`);
    }
  });
  console.log(parJeu.join("\n"));
  console.log(`temps ${Date.now() - t0} ms`);
  if (process.argv.includes("--detail")) console.log(details.sort().join("\n"));
}

if (isMain(import.meta)) principal();
