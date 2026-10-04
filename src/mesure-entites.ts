/**
 * LA MESURE DU SCORE D'ENTITÉ sur les jeux d'apprentissage, pour qui met la méthode au point.
 *
 *   node src/mesure-entites.ts [--detail] [--sans-listes]
 *
 * Les poids des mots viennent des listes sur disque (comme au criblage) ; `--sans-listes`
 * mesure à poids uniformes, sur une machine sans data/. `--detail` nomme chaque paire ratée
 * ou faussement alertée aux deux niveaux. Le jeu de VERDICT n'est jamais détaillé ici : on
 * ne regarde pas ses paires, sinon il cesse d'être un verdict.
 *
 * Les paires sont notées sur des fils (src/mesure-parallele.ts), chaque paire une fois ; avec
 * MESURE_SEQUENTIELLE=1, sur ce seul fil, la table puis le détail : la référence. La sortie
 * est la même, au chiffre de temps près.
 */
import { readFileSync } from "node:fs";
import { isMain, refuserDrapeauxInconnus } from "./cli.ts";
import { frequencesDesListes } from "./frequences.ts";
import { validerPaires, type PaireEtiquetee, type TableDUnPalier } from "./measure.ts";
import { mesurerJeuxParallele, mesurerReelParallele, sequentielDemande } from "./mesure-parallele.ts";
import {
  frequencesDe, palierEntite, mesurerJeux, choisirSeuils, CHEMINS_APPRENTISSAGE, FREQUENCES_UNIFORMES, CHEMIN_APPRENTISSAGE_REEL, mesurerReel, type Frequences,
} from "./entites.ts";


async function principal(): Promise<void> {
  refuserDrapeauxInconnus(["--detail", "--sans-listes"]);
  const t0 = Date.now();
  const sansListes = process.argv.includes("--sans-listes");
  /* le cache des fréquences se construit ici s'il manque, AVANT tout fil : un fil le lit, jamais ne le refait */
  const f = sansListes ? FREQUENCES_UNIFORMES : frequencesDesListes();
  const bruts = CHEMINS_APPRENTISSAGE.map((u) => readFileSync(u, "utf8"));
  const jeux = bruts.map((brut): PaireEtiquetee[] => validerPaires(JSON.parse(brut)));
  const toutes = jeux.flat();
  let table: TableDUnPalier, scores: number[], fils = "";
  if (sequentielDemande()) {
    /* la référence : un seul fil, chaque paire notée deux fois (la table, puis le détail), comme avant les fils */
    table = mesurerJeux(f, bruts).table;
    const p = palierEntite(f);
    scores = toutes.map((x) => p.score(x.a, x.b));
  } else {
    const m = await mesurerJeuxParallele(f, bruts, { cache: !sansListes });
    table = m.table; scores = m.scores;
    fils = ` · ${m.fils} fils prêts en ${m.demarrage} ms`;
  }
  /* l'échantillon réel, que la règle des seuils lit à côté des jeux écrits (voir `choisirSeuils`) */
  const brutReel = readFileSync(CHEMIN_APPRENTISSAGE_REEL, "utf8");
  const reel = sequentielDemande() ? mesurerReel(f, brutReel) : await mesurerReelParallele(f, brutReel, { cache: !sansListes });
  const r = choisirSeuils(table, reel.table);
  const M = toutes.filter((x) => x.verdict === "match").length, D = toutes.length - M;
  const cell = (seuil: number) => table[seuil.toFixed(2)]!;
  const ligne = (nom: string, seuil: number) => {
    const c = cell(seuil);
    console.log(`${nom.padEnd(9)} seuil ${seuil.toFixed(2)} : vrais noms ${c.rappel.succes}/${M} (${Math.round(c.rappel.taux * 1000) / 10} %) · fausses alertes ${c.fauxPositifs.succes}/${D} (${Math.round(c.fauxPositifs.taux * 1000) / 10} %)`);
  };
  console.log(`${jeux.length} jeux d'apprentissage, ${M} paires vraies, ${D} pièges · poids ${f.entrees ? `des ${f.entrees} entrées listées` : "uniformes"}`);
  ligne("FORT", r.fort.seuil);
  ligne("POSSIBLE", r.possible.seuil);
  console.log("courbe : " + [0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9].map((s) => `${s.toFixed(2)} R${Math.round(cell(s).rappel.taux * 100)} FP${Math.round(cell(s).fauxPositifs.taux * 100)}`).join("  "));
  const parJeu: string[] = [];
  const details: string[] = [];
  let depuis = 0;
  jeux.forEach((paires, i) => {
    const sc = paires.map((x, j) => ({ x, s: scores[depuis + j]! }));
    depuis += paires.length;
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
  console.log(`temps ${Date.now() - t0} ms${fils}`);
  if (process.argv.includes("--detail")) console.log(details.sort().join("\n"));
}

if (isMain(import.meta)) await principal();
