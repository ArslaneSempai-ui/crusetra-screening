/**
 * LE DÉPÔT SE PRÉSENTE SOUS SON NOM. Depuis le 5 octobre 2026, la marque est Crusetra et les dépôts publics
 * s'appellent crusetra-routing, crusetra-screening, crusetra-monitoring, crusetra-scoring, crusetra-dossier et
 * crusetra-site. Le 6 octobre, un vérificateur a encore trouvé « cascade-screening's audit » à la première ligne de
 * scripts/logic_v2.py : un texte anglais que le lecteur du dépôt public ouvre, et qui nommait l'ancien dépôt.
 *
 * CE QUE CE CAS LIT : ce que git livre et qu'un lecteur ouvre comme du texte, hors du code source. Les `.md` de la
 * racine et de doc/, scripts/, .github/, package.json et sbom.json. Il NE lit PAS src/ (les commentaires français
 * qui nomment un dépôt voisin sont des notes de développeur, classées et gardées le 6/10), ni exemple/, verification/
 * et les relevés scellés (ce qui est scellé garde ses octets : c'est l'histoire), ni contrib/ (les noms de fichiers
 * déposés chez un tiers).
 *
 * CE QUI RESTE PERMIS, parce que c'est vrai : les variables CASCADE_* (alias dépréciés, toujours lus), le genre
 * `cascade-screening/counterparty-screening` (les relevés d'avant le changement de nom, lus pour toujours), et
 * cascade-licencie (le dépôt privé, qui n'a pas changé de nom). Le témoin plante chaque forme et exige qu'elle soit
 * vue ou laissée, sinon le vert ne prouve rien.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = fileURLToPath(new URL("../", import.meta.url));

/** La marque écrite comme un nom propre (la casse compte : `CASCADE_X` est un alias, pas la marque). */
const MARQUE_SEULE = /\bCascade\b/;
/** Un ancien nom de dépôt public. Le genre des anciens relevés n'en est pas un. */
const DEPOT = /\bcascade-(?:routing|screening|monitoring|scoring|dossier|site)\b(?!\/counterparty-screening)/i;

/** Vrai quand la ligne nomme l'ancien dépôt ou l'ancienne marque. `CASCADE_X` (l'alias) n'est pas la marque. */
export function nommeLAncien(ligne: string): boolean {
  return DEPOT.test(ligne) || MARQUE_SEULE.test(ligne);
}

/** Les fichiers suivis qu'un lecteur ouvre comme du texte, hors du code source et de ce qui est scellé. */
export function perimetre(suivis: readonly string[]): string[] {
  return suivis.filter((f) =>
    /^[^/]+\.md$/.test(f) || /^doc\/.+\.md$/.test(f) || f.startsWith("scripts/") || f.startsWith(".github/")
    || f === "package.json" || f === "sbom.json");
}

/** Les lignes fautives, `fichier:ligne: texte`. */
export function anciensNoms(racine: string, fichiers: readonly string[]): string[] {
  return fichiers.flatMap((f) => readFileSync(join(racine, f), "utf8").split("\n")
    .flatMap((l, i) => (nommeLAncien(l) ? [`${f}:${i + 1}: ${l.trim().slice(0, 100)}`] : [])));
}

test("le détecteur voit l'ancien dépôt et l'ancienne marque, et laisse les alias, l'ancien genre et le dépôt privé : témoin", () => {
  /* assemblés par morceaux : écrits en clair, ces témoins feraient rougir un balayage du dépôt entier */
  const casc = "cas" + "cade";
  for (const l of [
    `"""The bridge between ${casc}-screening's audit and nomenklatura's logic-v2 matcher.`,
    `see https://github.com/ArslaneSempai-ui/${casc}-routing`,
    `https://${casc}-routing.com/engagement.html`,
    `the same seal as ${casc[0]!.toUpperCase()}${casc.slice(1)} Routing`,
    `Copied from ${casc}-screening exemple/contreparties-exemple.screening.json,`,
  ]) assert.equal(nommeLAncien(l), true, l);
  for (const l of [
    "`CRUSETRA_OFFLINE=1` (or `CASCADE_OFFLINE=1`, its deprecated alias)",
    `genre: "${casc}-screening/counterparty-screening"`,
    `licencie=\${LICENCIE:-\${depot:h}/${casc}-licencie}`,
    "The bridge between crusetra-screening's audit and nomenklatura's logic-v2 matcher.",
    `\`${casc}-name-pairs.csv\` holds 300 labelled pairs`,
  ]) assert.equal(nommeLAncien(l), false, l);
  assert.equal(nommeLAncien(`the ${casc}-dossier README`), true);
  /* le périmètre lit le texte servi et laisse le code et ce qui est scellé */
  assert.deepEqual(perimetre(["README.md", "doc/OFFLINE.md", "scripts/logic_v2.py", ".github/workflows/tests.yml", "package.json",
    "src/listes.ts", "exemple/contreparties-exemple.screening.json", "verification/JUGE.md", "releve-entites.json", "contrib/opensanctions/README.md"]),
    ["README.md", "doc/OFFLINE.md", "scripts/logic_v2.py", ".github/workflows/tests.yml", "package.json"]);
});

test("aucun texte que ce dépôt livre au lecteur ne nomme l'ancien dépôt ni l'ancienne marque", (t) => {
  let suivis: string[];
  try {
    suivis = execFileSync("git", ["-C", RACINE, "ls-files"], { encoding: "utf8" }).split("\n").filter(Boolean);
  } catch {
    return t.skip("pas un dépôt git ici : la règle vise ce que le dépôt LIVRE, et sans git elle ne sait pas ce qui l'est");
  }
  const lus = perimetre(suivis);
  assert.ok(lus.includes("scripts/logic_v2.py") && lus.includes("README.md"), "le périmètre doit contenir ce qu'il garde, sinon son vert est vide");
  assert.deepEqual(anciensNoms(RACINE, lus), []);
});
