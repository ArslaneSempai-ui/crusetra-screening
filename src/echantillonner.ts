/**
 * THE PUBLIC SAMPLE, DRAWN BY A FIXED RULE. The full labelled sets are private (src/jeux.ts); what stays public is
 * 20 rows per family: 10 "match" and 10 "different". Nobody picks them. The rule, written in every sample file:
 *
 *   for each pair, key = SHA-256 of  seed + "|" + a + "|" + b  (UTF-8);
 *   within each verdict, sort by key (ascending, hex), keep the first 10;
 *   the 20 rows are listed match first, then different, each in key order.
 *
 * The seed is the family name plus "-2026-10-19". The sample file records the SHA-256 of the full set it was drawn from
 * (for the entity family, of the concatenation of the 23 training sets in numeric order), so the draw can be redone
 * by anyone who holds the private set, and compared byte for byte.
 *
 *   node src/echantillonner.ts           redraw the two samples from the private sets (needs CRUSETRA_JEUX)
 *   node src/echantillonner.ts --check   redraw in memory and compare with the committed files
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { lirePrive, ECHANTILLONS, APPRENTISSAGE } from "./jeux.ts";
import { isMain, refuserDrapeauxInconnus } from "./cli.ts";
import type { JeuDePaires, PaireEtiquetee } from "./measure.ts";

const PAR_VERDICT = 10;
const sha = (t: string): string => createHash("sha256").update(t).digest("hex");

export const SOURCES: Record<keyof typeof ECHANTILLONS, string[]> = {
  "paires-entites": [...APPRENTISSAGE],
  "paires-gleif": ["verification/paires-gleif.json"],
};

export function tirer(paires: readonly PaireEtiquetee[], graine: string): PaireEtiquetee[] {
  const cle = (p: PaireEtiquetee) => sha(`${graine}|${p.a}|${p.b}`);
  const garde = (v: "match" | "different") =>
    paires.filter((p) => p.verdict === v).map((p) => ({ p, k: cle(p) }))
      .sort((x, y) => (x.k < y.k ? -1 : x.k > y.k ? 1 : 0)).slice(0, PAR_VERDICT).map((x) => x.p);
  return [...garde("match"), ...garde("different")];
}

export function echantillonDe(nom: keyof typeof ECHANTILLONS): string {
  const graine = `${nom}-2026-10-19`;
  const textes = SOURCES[nom].map((rel) => lirePrive(rel));
  const paires = textes.flatMap((t) => (JSON.parse(t) as JeuDePaires).paires);
  const premier = JSON.parse(textes[0]!) as JeuDePaires;
  const sortie = {
    quoi: `A 20-row sample of the private labelled set "${nom}": 10 match and 10 different, drawn by a fixed rule, never picked by hand. It is the only labelled data of this family that is public.`,
    provenance: `sample of ${SOURCES[nom].join(", ")}`,
    avertissement: "Verdicts are our labels and debatable by construction. 20 rows prove the format and the kind of difficulty; they do not reproduce the figures.",
    echantillon: {
      graine,
      regle: "key = SHA-256 of seed|a|b (UTF-8); per verdict, sort by key ascending and keep the first 10; match rows first, then different rows. src/echantillonner.ts redoes the draw.",
      sourceSha256: sha(textes.join("")),
      sourceFichiers: SOURCES[nom].length,
      sourcePaires: paires.length,
      sourceMatch: paires.filter((p) => p.verdict === "match").length,
      sourceDifferent: paires.filter((p) => p.verdict === "different").length,
      provenanceDuJeu: premier.provenance,
    },
    paires: tirer(paires, graine),
  };
  return JSON.stringify(sortie, null, 1) + "\n";
}

if (isMain(import.meta)) {
  refuserDrapeauxInconnus(["--check"]);
  const args = process.argv.slice(2);
  const racine = new URL("../", import.meta.url);
  let ecart = 0;
  for (const nom of Object.keys(ECHANTILLONS) as (keyof typeof ECHANTILLONS)[]) {
    const neuf = echantillonDe(nom);
    const chemin = new URL(ECHANTILLONS[nom], racine);
    if (args.includes("--check")) {
      const actuel = readFileSync(chemin, "utf8");
      if (actuel !== neuf) { ecart++; console.error(`${ECHANTILLONS[nom]} differs from the draw`); } else console.log(`${ECHANTILLONS[nom]} ok`);
    } else {
      mkdirSync(dirname(fileURLToPath(chemin)), { recursive: true });
      writeFileSync(chemin, neuf);
      console.log(`${ECHANTILLONS[nom]} written`);
    }
  }
  if (ecart) process.exit(1);
}
