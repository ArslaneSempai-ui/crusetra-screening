/**
 * UN LECTEUR .XLSX MINIMAL, SANS DÉPENDANCE. Deux listes officielles n'existent qu'en classeur Excel (la liste
 * consolidée du DFAT australien, le registre des sanctions Russie du MFAT néo-zélandais) : ni CSV ni XML. Un .xlsx
 * est un zip d'XML (ECMA-376) ; `node:zlib` décompresse le zip, et des expressions bornées lisent les quatre
 * fichiers qui comptent : le classeur (les feuilles et leur fichier), les chaînes partagées, les styles (pour
 * savoir qu'un nombre est une date) et les feuilles demandées. Rien d'autre n'est lu : la feuille des mesures
 * commerciales du MFAT dépasse le million de lignes, et elle ne sert pas au criblage.
 *
 * Ce que ce lecteur refuse, et dit : un zip qui n'a pas de répertoire central, une entrée en ZIP64 (au-delà de
 * 4 Gio, aucune liste n'en est là), une méthode de compression autre que « stockée » ou « deflate ». Un
 * analyseur générique accepterait plus ; celui-ci est éprouvé sur une fixture qui a la forme réelle des deux
 * classeurs (copiée d'un téléchargement), et un classeur d'une autre forme se refuse au lieu de rendre une
 * liste vide.
 */
import { inflateRawSync } from "node:zlib";

/** Une cellule lue : la colonne (0 pour A), et sa valeur en texte, une date Excel rendue « AAAA-MM-JJ ». */
export type Ligne = { numero: number; cellules: string[] };
export type Feuille = { nom: string; lignes: Ligne[] };

const SIGNATURE_FIN = 0x06054b50, SIGNATURE_CENTRALE = 0x02014b50, SIGNATURE_LOCALE = 0x04034b50;

/** Le répertoire d'un zip : nom → où lire l'entrée. Lu depuis la fin du fichier (le répertoire central), comme
 *  tout lecteur de zip ; les en-têtes locaux peuvent porter des tailles nulles (descripteur de données). */
function repertoire(z: Buffer): Map<string, { methode: number; debut: number; taille: number; tailleBrute: number }> {
  let fin = -1;
  for (let i = z.length - 22; i >= Math.max(0, z.length - 22 - 65535); i--) {
    if (z.readUInt32LE(i) === SIGNATURE_FIN) { fin = i; break; }
  }
  if (fin === -1) throw new Error("not a zip file: no end-of-central-directory record (an .xlsx is a zip of XML)");
  const nombre = z.readUInt16LE(fin + 10);
  let p = z.readUInt32LE(fin + 16);
  const entrees = new Map<string, { methode: number; debut: number; taille: number; tailleBrute: number }>();
  for (let k = 0; k < nombre; k++) {
    if (z.readUInt32LE(p) !== SIGNATURE_CENTRALE) throw new Error(`zip: central directory entry ${k} has no signature`);
    const methode = z.readUInt16LE(p + 10);
    const tailleBrute = z.readUInt32LE(p + 20), taille = z.readUInt32LE(p + 24);
    const nomL = z.readUInt16LE(p + 28), extraL = z.readUInt16LE(p + 30), commentaireL = z.readUInt16LE(p + 32);
    const local = z.readUInt32LE(p + 42);
    const nom = z.toString("utf8", p + 46, p + 46 + nomL);
    if (tailleBrute === 0xffffffff || taille === 0xffffffff || local === 0xffffffff) throw new Error(`zip: ${nom} is a ZIP64 entry, which this reader does not read`);
    if (z.readUInt32LE(local) !== SIGNATURE_LOCALE) throw new Error(`zip: ${nom} has no local header`);
    const debut = local + 30 + z.readUInt16LE(local + 26) + z.readUInt16LE(local + 28);
    entrees.set(nom, { methode, debut, taille, tailleBrute });
    p += 46 + nomL + extraL + commentaireL;
  }
  return entrees;
}

/** Les entrées d'un zip, décompressées à la demande : la feuille d'un million de lignes n'est pas gonflée si personne ne la lit. */
export function ouvrirZip(z: Buffer): { noms: string[]; lire: (nom: string) => string } {
  const r = repertoire(z);
  return {
    noms: [...r.keys()],
    lire: (nom: string) => {
      const e = r.get(nom);
      if (!e) throw new Error(`zip: no entry named ${nom}`);
      const brut = z.subarray(e.debut, e.debut + e.tailleBrute);
      if (e.methode === 0) return brut.toString("utf8");
      if (e.methode === 8) return inflateRawSync(brut).toString("utf8");
      throw new Error(`zip: ${nom} uses compression method ${e.methode}, which this reader does not read`);
    },
  };
}

function decoder(t: string): string {
  return t
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

/** Le texte d'un `<si>` ou d'un `<is>` : ses `<t>` concaténés (un texte riche en a plusieurs). */
function texteDe(xml: string): string {
  return decoder([...xml.matchAll(/<t(?:\s[^>]*)?>([^<]*)<\/t>/g)].map((m) => m[1]!).join(""));
}

/** La colonne d'une référence de cellule (« A » → 0, « AA » → 26). */
export function colonneDe(ref: string): number {
  let n = 0;
  for (const c of ref.replace(/\d+$/, "")) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

/** Un numéro de série Excel (jours depuis le 30/12/1899, système 1900) rendu « AAAA-MM-JJ » ; l'heure est ignorée. */
export function dateExcel(serie: number): string {
  const jours = Math.floor(serie);
  const d = new Date(Date.UTC(1899, 11, 30) + jours * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/** Les formats intégrés d'Excel qui sont des dates (ECMA-376, 18.8.30), et un format personnalisé qui écrit des jours, mois ou années. */
const FORMATS_DATE = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58]);
function estFormatDate(id: number, personnalises: Map<number, string>): boolean {
  if (FORMATS_DATE.has(id)) return true;
  const code = personnalises.get(id);
  if (code === undefined) return false;
  const nu = code.replace(/\[[^\]]*\]/g, "").replace(/"[^"]*"/g, "").replace(/\\./g, "");
  return /[dmy]/i.test(nu) && !/[#0?]/.test(nu);
}

/** Pour chaque index de style (`s="57"`), vrai si le style est une date. */
function stylesDate(styles: string | undefined): boolean[] {
  if (!styles) return [];
  const personnalises = new Map<number, string>();
  for (const m of styles.matchAll(/<numFmt\s[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"/g)) personnalises.set(Number(m[1]), decoder(m[2]!));
  const xfs = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(styles)?.[1] ?? "";
  return [...xfs.matchAll(/<xf\b([^>]*)\/?>/g)].map((m) => estFormatDate(Number(/numFmtId="(\d+)"/.exec(m[1]!)?.[1] ?? "0"), personnalises));
}

/**
 * Les feuilles demandées d'un classeur, par nom ou par position (le DFAT met la date dans le nom de son unique
 * feuille), chaque ligne avec son numéro (une ligne vide n'est pas rendue) et ses cellules en texte, les colonnes
 * absentes vides. Une feuille demandée qui n'existe pas se refuse en nommant celles qui existent : un classeur
 * réorganisé par l'éditeur ne doit pas rendre une liste vide.
 */
export function lireClasseur(z: Buffer, feuilles: readonly (string | number)[]): Feuille[] {
  const zip = ouvrirZip(z);
  if (!zip.noms.includes("xl/workbook.xml")) throw new Error("not a workbook: the zip has no xl/workbook.xml");
  const classeur = zip.lire("xl/workbook.xml");
  const relations = new Map([...zip.lire("xl/_rels/workbook.xml.rels").matchAll(/<Relationship\b[^>]*>/g)]
    .map((m) => [/\bId="([^"]*)"/.exec(m[0])?.[1] ?? "", /\bTarget="([^"]*)"/.exec(m[0])?.[1] ?? ""] as const));
  const declarees = [...classeur.matchAll(/<sheet\b[^>]*>/g)].map((m) => ({
    nom: decoder(/\bname="([^"]*)"/.exec(m[0])?.[1] ?? ""),
    cible: relations.get(/\br:id="([^"]*)"/.exec(m[0])?.[1] ?? "") ?? "",
  }));
  const chaines = zip.noms.includes("xl/sharedStrings.xml")
    ? [...zip.lire("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => texteDe(m[1]!)) : [];
  const dates = stylesDate(zip.noms.includes("xl/styles.xml") ? zip.lire("xl/styles.xml") : undefined);

  return feuilles.map((voulue) => {
    const d = typeof voulue === "number" ? declarees[voulue] : declarees.find((x) => x.nom === voulue);
    if (!d) throw new Error(`the workbook has no sheet ${typeof voulue === "number" ? `at position ${voulue}` : `named "${voulue}"`} (it has: ${declarees.map((x) => `"${x.nom}"`).join(", ")}): its layout changed.`);
    const chemin = d.cible.startsWith("/") ? d.cible.slice(1) : `xl/${d.cible}`;
    const xml = zip.lire(chemin);
    const lignes: Ligne[] = [];
    for (const l of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
      const numero = Number(/\br="(\d+)"/.exec(l[1]!)?.[1] ?? lignes.length + 1);
      const cellules: string[] = [];
      for (const c of l[2]!.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attributs = c[1]!, corps = c[2] ?? "";
        const ref = /\br="([A-Z]+)\d*"/.exec(attributs)?.[1];
        if (!ref) continue;
        const type = /\bt="([^"]*)"/.exec(attributs)?.[1] ?? "n";
        const v = /<v>([^<]*)<\/v>/.exec(corps)?.[1];
        let valeur = "";
        if (type === "s") valeur = v === undefined ? "" : (chaines[Number(v)] ?? "");
        else if (type === "inlineStr") valeur = texteDe(corps);
        else if (type === "str" || type === "d" || type === "e") valeur = v === undefined ? "" : decoder(v);
        else if (type === "b") valeur = v === "1" ? "TRUE" : v === "0" ? "FALSE" : "";
        else if (v !== undefined) {
          const style = Number(/\bs="(\d+)"/.exec(attributs)?.[1] ?? "-1");
          const n = Number(v);
          valeur = Number.isFinite(n) && dates[style] ? dateExcel(n) : decoder(v);
        }
        const col = colonneDe(ref);
        while (cellules.length < col) cellules.push("");
        cellules[col] = valeur;
      }
      if (cellules.some((x) => x.trim() !== "")) lignes.push({ numero, cellules });
    }
    return { nom: d.nom, lignes };
  });
}

/** Une feuille lue par son en-tête : la première ligne dont les cellules portent tous les noms attendus devient
 *  l'en-tête, et chaque ligne suivante est rendue par nom de colonne (MFAT écrit une légende au-dessus du tableau). */
export function tableParEntete(feuille: Feuille, attendues: readonly string[]): { numero: number; par: (colonne: string) => string }[] {
  const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
  const i = feuille.lignes.findIndex((l) => attendues.every((a) => l.cellules.some((c) => norm(c) === norm(a))));
  if (i === -1) {
    throw new Error(`the sheet "${feuille.nom}" has no header row with the columns ${attendues.map((a) => `"${a}"`).join(", ")}: its layout changed.`);
  }
  const index = new Map(feuille.lignes[i]!.cellules.map((c, k) => [norm(c), k] as const));
  return feuille.lignes.slice(i + 1).map((l) => ({
    numero: l.numero,
    par: (colonne: string) => (l.cellules[index.get(norm(colonne)) ?? -1] ?? "").trim(),
  }));
}
