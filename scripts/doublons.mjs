#!/usr/bin/env node
/**
 * LES CLÉS EN DOUBLE d'un objet littéral passé à Object.entries({ ... }) : ce que tsc refuse (TS1117)
 * quand deux voies ajoutent le même mot à la même table et que la fusion en union garde les deux.
 * Trouve et nomme (fichier, clé, les deux lignes) ; avec --corriger retire la SECONDE occurrence, la
 * clé et sa valeur jusqu'à la virgule qui suit, et laisse la ligne si d'autres clés y vivent.
 * Sort en 1 quand il trouve sans corriger : le chef le lance avant tsc, et la voie avant son diff.
 *
 *   node scripts/doublons.mjs [--corriger] <fichier.ts>...
 */
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const finDeChaine = (src, i, guillemet) => {
  for (i++; i < src.length; i++) {
    if (src[i] === "\\") { i++; continue; }
    if (src[i] === guillemet) return i;
  }
  return src.length;
};

/** Un gabarit (`...${...}...`) : ses substitutions peuvent porter des accolades et des chaînes. */
const finDeGabarit = (src, i) => {
  for (i++; i < src.length; i++) {
    if (src[i] === "\\") { i++; continue; }
    if (src[i] === "`") return i;
    if (src[i] === "$" && src[i + 1] === "{") {
      let profondeur = 1;
      for (i += 2; i < src.length && profondeur > 0; i++) {
        const c = src[i];
        if (c === "\"" || c === "'") { i = finDeChaine(src, i, c); continue; }
        if (c === "`") { i = finDeGabarit(src, i); continue; }
        if (c === "{") profondeur++;
        else if (c === "}") profondeur--;
      }
      i--;
    }
  }
  return src.length;
};

/** Depuis l'accolade ouvrante en `i` : l'accolade fermante et les virgules de premier niveau,
 *  chaînes, gabarits et commentaires sautés. null si l'objet ne se ferme pas. */
export function parcourir(src, i) {
  let profondeur = 0;
  const virgules = [];
  for (; i < src.length; i++) {
    const c = src[i], d = src[i + 1];
    if (c === "\"" || c === "'") { i = finDeChaine(src, i, c); continue; }
    if (c === "`") { i = finDeGabarit(src, i); continue; }
    if (c === "/" && d === "/") { const f = src.indexOf("\n", i); i = f < 0 ? src.length : f; continue; }
    if (c === "/" && d === "*") { const f = src.indexOf("*/", i + 2); i = f < 0 ? src.length : f + 1; continue; }
    if (c === "{" || c === "[" || c === "(") { profondeur++; continue; }
    if (c === "}" || c === "]" || c === ")") { profondeur--; if (profondeur === 0) return { ferme: i, virgules }; continue; }
    if (c === "," && profondeur === 1) virgules.push(i);
  }
  return null;
}

/** Le début d'un segment, une fois sautés les blancs et les commentaires qui le précèdent :
 *  un commentaire devant une clé (« les métiers ») reste quand la clé part. */
const debutUtile = (src, i, fin) => {
  while (i < fin) {
    if (/\s/.test(src[i])) { i++; continue; }
    if (src[i] === "/" && src[i + 1] === "*") { const f = src.indexOf("*/", i + 2); i = f < 0 ? fin : f + 2; continue; }
    if (src[i] === "/" && src[i + 1] === "/") { const f = src.indexOf("\n", i); i = f < 0 ? fin : f + 1; continue; }
    break;
  }
  return i;
};

const CLE = /^(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([A-Za-z_$][\w$]*)|(\d+))\s*:/;
const numeroDeLigne = (src, i) => src.slice(0, i).split("\n").length;

/** Les entrées de premier niveau d'un objet littéral : la clé, où elle commence, où finit son
 *  segment (virgule comprise quand il y en a une), sa ligne. Les segments sans clé (spread,
 *  clé calculée, la fin vide après la dernière virgule) sont ignorés. */
export function entrees(src, ouvre) {
  const p = parcourir(src, ouvre);
  if (p === null) return null;
  const bornes = [ouvre + 1, ...p.virgules.map((v) => v + 1)];
  const sortie = [];
  bornes.forEach((debut, k) => {
    const virgule = p.virgules[k];
    const fin = virgule !== undefined ? virgule : p.ferme;
    const utile = debutUtile(src, debut, fin);
    const m = CLE.exec(src.slice(utile, fin));
    if (!m) return;
    const cle = m[1] ?? m[2] ?? m[3] ?? m[4];
    /* le segment à retirer : la clé et sa valeur jusqu'à la virgule qui suit, comprise ; la
       dernière entrée, sans virgule après elle, part avec la virgule qui la précède */
    const finTexte = utile + src.slice(utile, fin).trimEnd().length;
    const span = virgule !== undefined
      ? { debut: utile, fin: virgule + 1 }
      : { debut: k > 0 ? p.virgules[k - 1] : utile, fin: finTexte };
    sortie.push({ cle, ...span, ligne: numeroDeLigne(src, utile), valeur: src.slice(utile + m[0].length, finTexte).trim() });
  });
  return { entrees: sortie, ferme: p.ferme };
}

/** Les objets littéraux passés à Object.entries, par l'offset de leur accolade ouvrante. */
export function litteraux(src) {
  const sortie = [];
  const motif = /Object\.entries\(\s*\{/g;
  let m;
  while ((m = motif.exec(src)) !== null) sortie.push(m.index + m[0].length - 1);
  return sortie;
}

/** Les doublons d'un fichier : pour chaque clé revue, la première ligne et l'occurrence à retirer. */
export function doublons(src) {
  const sortie = [];
  for (const ouvre of litteraux(src)) {
    const e = entrees(src, ouvre);
    if (e === null) throw new Error(`an Object.entries({ at line ${numeroDeLigne(src, ouvre)} never closes`);
    const premieres = new Map();
    for (const x of e.entrees) {
      const premiere = premieres.get(x.cle);
      if (premiere === undefined) premieres.set(x.cle, x);
      else sortie.push({ cle: x.cle, premiere, seconde: x });
    }
  }
  return sortie;
}

/** Le fichier sans ses secondes occurrences : chaque segment retiré de la fin vers le début (les
 *  offsets qui précèdent restent bons), une espace voisine absorbée ; la ligne où la clé vivait
 *  part si elle est vide, garde ses autres clés sinon. */
export function corriger(src) {
  const trouves = doublons(src);
  let texte = src;
  for (const d of [...trouves].sort((x, y) => y.seconde.debut - x.seconde.debut)) {
    let { debut, fin } = d.seconde;
    if (texte[fin] === " " && texte[debut - 1] === " ") fin++;
    texte = texte.slice(0, debut) + texte.slice(fin);
    const debutLigne = texte.lastIndexOf("\n", debut - 1) + 1;
    const finLigne = texte.indexOf("\n", debut) < 0 ? texte.length : texte.indexOf("\n", debut);
    const ligne = texte.slice(debutLigne, finLigne);
    texte = ligne.trim() === ""
      ? texte.slice(0, debutLigne) + texte.slice(Math.min(finLigne + 1, texte.length))
      : texte.slice(0, debutLigne) + ligne.trimEnd() + texte.slice(finLigne);
  }
  return { texte, retires: trouves };
}

function principal() {
  const args = process.argv.slice(2);
  const corrige = args.includes("--corriger");
  const fichiers = args.filter((a) => a !== "--corriger");
  const inconnus = fichiers.filter((a) => a.startsWith("--"));
  if (inconnus.length > 0 || fichiers.length === 0) {
    console.error(`usage: node scripts/doublons.mjs [--corriger] <fichier.ts>...${inconnus.length ? `\nunknown option${inconnus.length > 1 ? "s" : ""}: ${inconnus.join(", ")}` : ""}`);
    process.exit(2);
  }
  let total = 0;
  for (const f of fichiers) {
    const src = readFileSync(f, "utf8");
    let trouves;
    try { trouves = corrige ? corriger(src) : { texte: src, retires: doublons(src) }; }
    catch (e) { console.error(`${f}: ${e instanceof Error ? e.message : String(e)}`); process.exit(2); }
    total += trouves.retires.length;
    for (const d of trouves.retires) {
      const valeur = d.seconde.valeur.length > 60 ? d.seconde.valeur.slice(0, 57) + "..." : d.seconde.valeur;
      console.log(corrige
        ? `${f}:${d.seconde.ligne}  removed "${d.cle}": ${valeur} (kept line ${d.premiere.ligne})`
        : `${f}:${d.seconde.ligne}  "${d.cle}" already at line ${d.premiere.ligne}`);
    }
    if (corrige && trouves.retires.length > 0) writeFileSync(f, trouves.texte);
  }
  if (total === 0) console.log(`no duplicate key in ${fichiers.length} file(s)`);
  else if (corrige) console.log(`${total} duplicate key(s) removed`);
  process.exit(total > 0 && !corrige ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) principal();
