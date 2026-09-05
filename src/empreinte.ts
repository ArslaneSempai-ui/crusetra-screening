/**
 * L'empreinte d'un relevé — la même que dans cascade-routing, sortie de son measure.ts.
 *
 * Le scellé doit s'exclure lui-même : il vit à la racine du relevé, et l'inclure dans son
 * propre calcul serait circulaire. Il ne s'exclut QU'À la racine : une `empreinte` imbriquée
 * (par palier, par liste) naît DANS le scellé, sinon on pourrait la changer, le scellé
 * continuerait de correspondre, et le contrôle dirait « intact » sur un relevé modifié.
 *
 * Les clés sont triées : deux relevés au contenu égal ont la même empreinte quel que soit
 * l'ordre dans lequel le code les a écrits.
 */
import { createHash } from "node:crypto";

function canonique(x: unknown, racine = true): unknown {
  if (Array.isArray(x)) return x.map((v) => canonique(v, false));
  if (x && typeof x === "object") {
    const o = x as Record<string, unknown>;
    return Object.keys(o).sort().reduce<Record<string, unknown>>((a, k) => {
      if (!(racine && k === "empreinte")) a[k] = canonique(o[k], false);
      return a;
    }, {});
  }
  return x;
}

export function empreinteDuReleve(releve: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonique(releve))).digest("hex").slice(0, 16);
}

/** Vrai si le relevé porte un scellé et que son contenu ne l'a pas fait mentir. */
export function scelleIntact(releve: Record<string, unknown>): boolean {
  return typeof releve.empreinte === "string" && releve.empreinte === empreinteDuReleve(releve);
}
