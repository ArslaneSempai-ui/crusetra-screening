/**
 * Les listes publiques : la SEULE porte réseau de cet outil, et elle ne fait que descendre.
 *
 *   npm run listes              what is on disk: date, content hash, counts; no network
 *   npm run listes -- --fetch   download the public lists into data/listes/
 *
 * `frontiere.test.ts` nomme ce fichier comme l'unique autorisé à toucher le réseau, et
 * exige qu'il lise CASCADE_OFFLINE. La liste descend, rien ne monte : aucune donnée du
 * client n'existe encore à ce stade — on télécharge des documents publics, c'est tout.
 *
 * ─── LES URL SONT TROUVÉES ET VÉRIFIÉES, PAS RECOPIÉES ───
 *
 * Chaque adresse ci-dessous a été vérifiée le 5 septembre 2026 contre la source officielle :
 *
 *   OFAC — https://www.treasury.gov/ofac/downloads/sdn.xml redirige (302) vers l'API du
 *   Sanctions List Service ; on vise la cible finale. En-tête mesuré ce jour-là :
 *   Publish_Date 09/04/2026, Record_Count 19329. Le fichier porte son propre compte,
 *   et l'analyseur est confronté à lui (voir `recouperOfac`).
 *
 *   ONU — l'adresse est celle que la page officielle du Conseil de sécurité publie
 *   (main.un.org/securitycouncil/en/content/un-sc-consolidated-list). Deux pièges mesurés :
 *   elle répond 404 à HEAD et 302 à GET (il faut suivre la redirection), et refuse un
 *   client sans User-Agent de navigateur. Mesuré : 736 INDIVIDUAL + 275 ENTITY.
 *
 *   UE — l'adresse vient du flux RSS PUBLIC de la Commission
 *   (webgate.ec.europa.eu/fsd/fsf/public/rss), qui annonce les fichiers avec le jeton
 *   générique historique. Mesuré le 5 septembre 2026 : TOUS les points de fichier rendent
 *   HTTP 500 avec ce jeton — XML v1.0, v1.1 et CSV — pendant que le RSS, lui, répond.
 *   Le téléchargement programmatique demande un jeton personnel EU Login
 *   (token=[username]). Le manifeste le dit, et l'issue existe : CASCADE_EU_TOKEN.
 *   L'analyseur v1.1 est écrit contre le schéma PUBLIÉ, pas contre un fichier reçu —
 *   c'est dit ici plutôt que découvert le jour où le jeton marche.
 *   Mesuré le 27 septembre 2026 : le jeton générique répond de nouveau (XML v1.1, 24,6 Mio),
 *   et l'analyseur écrit contre le schéma lit 6 241 entrées pour 6 241 balises
 *   `<sanctionEntity` dans le fichier. L'issue CASCADE_EU_TOKEN reste pour le jour où il
 *   retombe.
 *
 * Ajoutées le 27 septembre 2026, pour le criblage de contreparties (cribler.ts) : un
 * transitaire ou un exportateur américain ne crible pas contre la seule SDN.
 *
 *   OFAC-CONS : la liste consolidée « non-SDN » du même Sanctions List Service, au MÊME
 *   schéma que sdn.xml (sdnList/sdnEntry, Record_Count) : l'analyseur OFAC la lit telle
 *   quelle et `recouperOfac` s'y applique. Mesuré : Publish_Date 09/14/2026, Record_Count 481.
 *
 *   CSL : la Consolidated Screening List de trade.gov, dont la page officielle
 *   (trade.gov/consolidated-screening-list) publie cette adresse. Piège mesuré : elle répond
 *   404 à HEAD et 200 à GET. Mesuré : 26 144 lignes, dont 19 391 SDN et 486 autres lignes
 *   du Trésor, et 6 269 lignes du Commerce (Entity List, Denied Persons, Unverified, Military
 *   End User) et du Département d'État (ITAR Debarred, Nonproliferation). On n'en garde QUE
 *   ces 6 269 : les listes du Trésor viennent de ses deux fichiers primaires ci-dessus, et une
 *   entrée comptée deux fois ferait deux alertes pour un seul nom.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { isMain, refuserDrapeauxInconnus } from "./cli.ts";
import { lireTable } from "./csv.ts";

/** LA forme commune : les noms restent TELS QUE LA LISTE LES ÉCRIT — la normalisation est
 *  le travail des matchers, pas du téléchargeur. */
export type EntreeListe = {
  source: "OFAC" | "OFAC-CONS" | "CSL" | "EU" | "UN";
  id: string;
  nom: string;
  alias: string[];
  type: "person" | "entity" | "vessel" | "other";
  programme?: string;
  /** Les alias que l'OFAC classe « weak » (catégorie de son fichier) : trop génériques pour
   *  désigner seuls ; un candidat trouvé par eux le dit au relecteur. Sous-ensemble d'`alias`. */
  aliasFaibles?: string[];
  /** Le numéro OMI d'un navire, sept chiffres, tel que la liste l'écrit (« IMO 9187629 »). */
  imo?: string;
};

export type SourceListe = {
  source: EntreeListe["source"];
  titre: string;
  url: string;
  format: "ofac-sdn-xml" | "un-consolidated-xml" | "eu-fsf-xml-1.1" | "trade-csl-csv";
};

/** Le fichier d'une source dans data/listes/ : son extension suit son format. */
export function fichierDe(s: Pick<SourceListe, "source" | "format">): string {
  return `${s.source.toLowerCase()}.${s.format === "trade-csl-csv" ? "csv" : "xml"}`;
}

const DOSSIER = fileURLToPath(new URL("..", import.meta.url));
const DONNEES = join(DOSSIER, "data", "listes");
export const MANIFESTE = join(DOSSIER, "listes-manifest.json");

/*
 * CE N'EST PAS UN SECRET, ET LA CONSTANTE LE DIT DANS SON NOM. « dG9rZW4tMjAxNw » est le
 * jeton GÉNÉRIQUE que la Commission publie elle-même : son flux RSS public
 * (https://webgate.ec.europa.eu/fsd/fsf/public/rss) l'écrit dans chaque lien de fichier.
 * Un scanner de secrets — ou un acheteur qui lit — verra une chaîne en dur ; cette ligne
 * existe pour qu'il lise aussi d'où elle vient. Un jeton personnel EU Login la remplace
 * par CASCADE_EU_TOKEN.
 */
const JETON_UE_GENERIQUE_PUBLIC = "dG9rZW4tMjAxNw";
const JETON_UE = process.env.CASCADE_EU_TOKEN ?? JETON_UE_GENERIQUE_PUBLIC;

export const SOURCES: SourceListe[] = [
  {
    source: "OFAC", titre: "OFAC Specially Designated Nationals (SDN) list",
    url: "https://sanctionslistservice.ofac.treas.gov/api/publicationpreview/exports/sdn.xml",
    format: "ofac-sdn-xml",
  },
  {
    source: "OFAC-CONS", titre: "OFAC Consolidated Sanctions List (the non-SDN lists)",
    url: "https://sanctionslistservice.ofac.treas.gov/api/publicationpreview/exports/consolidated.xml",
    format: "ofac-sdn-xml",
  },
  {
    source: "CSL", titre: "US Consolidated Screening List: its Commerce and State lists (trade.gov)",
    url: "https://data.trade.gov/downloadable_consolidated_screening_list/v1/consolidated.csv",
    format: "trade-csl-csv",
  },
  {
    source: "UN", titre: "UN Security Council Consolidated List",
    url: "https://scsanctions.un.org/resources/xml/en/consolidated.xml",
    format: "un-consolidated-xml",
  },
  {
    source: "EU", titre: "EU consolidated financial sanctions list (FSF, XML v1.1)",
    url: `https://webgate.ec.europa.eu/fsd/fsf/public/files/xmlFullSanctionsList_1_1/content?token=${JETON_UE}`,
    format: "eu-fsf-xml-1.1",
  },
];

/* ────────────────────────── l'analyse XML, à la main ──────────────────────────
 *
 * Aucune dépendance nouvelle : trois formats stables se lisent avec deux aides et des
 * expressions bornées, et chaque analyseur est éprouvé sur une fixture qui a la forme
 * RÉELLE des balises (copiée d'un téléchargement, pas imaginée). Un analyseur générique
 * traiterait aussi ce qu'on n'a jamais vu ; ces trois-là refusent ce qu'ils ne
 * reconnaissent pas, et c'est une qualité.
 */

/** Les blocs `<tag>…</tag>` successifs, sans regex gourmande sur tout le document. */
export function blocs(xml: string, tag: string): string[] {
  const resultat: string[] = [];
  const ouvre = `<${tag}>`, ferme = `</${tag}>`;
  let i = 0;
  for (;;) {
    const debut = xml.indexOf(ouvre, i);
    if (debut === -1) break;
    const fin = xml.indexOf(ferme, debut);
    if (fin === -1) break;
    resultat.push(xml.slice(debut + ouvre.length, fin));
    i = fin + ferme.length;
  }
  return resultat;
}

/** Le texte du premier `<tag>` d'un bloc, entités XML décodées ; undefined s'il manque. */
export function champ(bloc: string, tag: string): string | undefined {
  const m = new RegExp(`<${tag}>([^<]*)</${tag}>`).exec(bloc);
  return m ? decoderEntites(m[1]!) : undefined;
}

export function decoderEntites(t: string): string {
  return t
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

/** OFAC : `<sdnEntry>` — uid, firstName?/lastName, sdnType, programList, akaList. */
export function analyserOfac(xml: string, source: "OFAC" | "OFAC-CONS" = "OFAC"): EntreeListe[] {
  return blocs(xml, "sdnEntry").map((b) => {
    const nom = [champ(b, "firstName"), champ(b, "lastName")].filter(Boolean).join(" ").trim();
    const TYPES: Record<string, EntreeListe["type"]> = { "Individual": "person", "Entity": "entity", "Vessel": "vessel" };
    const type: EntreeListe["type"] = TYPES[champ(b, "sdnType") ?? ""] ?? "other";
    const programmes = blocs(b, "programList").flatMap((p) => blocs(p, "program").map(decoderEntites));
    const akas = blocs(b, "akaList").flatMap((l) => blocs(l, "aka"))
      .map((a) => ({ nom: [champ(a, "firstName"), champ(a, "lastName")].filter(Boolean).join(" ").trim(),
        faible: champ(a, "category") === "weak" }))
      .filter((a) => a.nom.length > 0);
    const alias = akas.map((a) => a.nom);
    const aliasFaibles = akas.filter((a) => a.faible).map((a) => a.nom);
    /* Le numéro OMI vit dans `idList`, type « Vessel Registration Identification ». Mesuré le
       27/09/2026 : 1 540 numéros, 1 533 au format « IMO nnnnnnn », dont 1 523 au chiffre de
       contrôle valide ; les dix autres sont gardés tels quels (anciens numéros), jamais
       réécrits : c'est la liste qui fait foi. */
    const imo = blocs(b, "idList").flatMap((l) => blocs(l, "id"))
      .filter((i) => champ(i, "idType") === "Vessel Registration Identification")
      .map((i) => /^IMO\s*(\d{7})$/.exec((champ(i, "idNumber") ?? "").trim())?.[1])
      .find(Boolean);
    return { source, id: champ(b, "uid") ?? "", nom, alias, type,
      ...(programmes.length ? { programme: programmes.join("+") } : {}),
      ...(aliasFaibles.length ? { aliasFaibles } : {}), ...(imo ? { imo } : {}) };
  }).filter((e) => e.nom.length > 0 && e.id.length > 0);
}

/** ONU : `<INDIVIDUAL>` et `<ENTITY>` — DATAID, FIRST_NAME…FOURTH_NAME, *_ALIAS. Un
 *  `<ALIAS_NAME/>` VIDE existe dans le vrai fichier : il s'écarte, il ne devient pas "". */
export function analyserOnu(xml: string): EntreeListe[] {
  const lire = (b: string, type: "person" | "entity", baliseAlias: string): EntreeListe => {
    const nom = ["FIRST_NAME", "SECOND_NAME", "THIRD_NAME", "FOURTH_NAME"]
      .map((t) => champ(b, t)).filter(Boolean).join(" ").trim();
    const alias = blocs(b, baliseAlias)
      .map((a) => (champ(a, "ALIAS_NAME") ?? "").trim())
      .filter((a) => a.length > 0);
    const programme = champ(b, "UN_LIST_TYPE")?.trim();
    return { source: "UN", id: champ(b, "DATAID") ?? "", nom, alias, type,
      ...(programme ? { programme } : {}) };
  };
  return [
    ...blocs(xml, "INDIVIDUAL").map((b) => lire(b, "person", "INDIVIDUAL_ALIAS")),
    ...blocs(xml, "ENTITY").map((b) => lire(b, "entity", "ENTITY_ALIAS")),
  ].filter((e) => e.nom.length > 0 && e.id.length > 0);
}

/**
 * UE (FSF XML v1.1) : `<sanctionEntity logicalId="…">` avec `<nameAlias wholeName="…"/>`
 * et `<subjectType code="person|enterprise"/>` en ATTRIBUTS, contrairement aux deux autres.
 *
 * ÉCRIT CONTRE LE SCHÉMA PUBLIÉ, PAS CONTRE UN FICHIER REÇU : le point de téléchargement
 * rendait HTTP 500 avec le jeton générique le jour où ce fichier a été écrit (voir
 * l'en-tête). Le premier vrai téléchargement confrontera cet analyseur à la réalité ; le
 * manifeste dira alors combien d'entrées il a lues, et un compte absurde se verra.
 */
export function analyserUe(xml: string): EntreeListe[] {
  const attribut = (b: string, nom: string): string | undefined => {
    const m = new RegExp(`${nom}="([^"]*)"`).exec(b);
    return m ? decoderEntites(m[1]!) : undefined;
  };
  const entites: EntreeListe[] = [];
  const motif = /<sanctionEntity\b([^>]*)>([\s\S]*?)<\/sanctionEntity>/g;
  for (const m of xml.matchAll(motif)) {
    const [, entete, corps] = m;
    const noms = [...corps!.matchAll(/<nameAlias\b[^>]*>/g)]
      .map((n) => attribut(n[0], "wholeName") ?? "")
      .map((n) => n.trim()).filter((n) => n.length > 0);
    if (noms.length === 0) continue;
    const code = (/<subjectType\b[^>]*>/.exec(corps!) ?? [""])[0];
    const type = /code="person"/.test(code) ? "person" as const
      : /code="enterprise"/.test(code) ? "entity" as const : "other" as const;
    const programme = attribut((/<regulation\b[^>]*>/.exec(corps!) ?? [""])[0]!, "programme");
    entites.push({ source: "EU", id: attribut(entete!, "logicalId") ?? "", nom: noms[0]!,
      alias: noms.slice(1), type, ...(programme ? { programme } : {}) });
  }
  return entites.filter((e) => e.id.length > 0);
}

/**
 * CSL (trade.gov, CSV) : une ligne par entrée, `alt_names` séparés par « ; », la liste
 * d'origine dans `source` (« Entity List (EL) - Bureau of Industry and Security »). Les
 * lignes du Trésor sont ÉCARTÉES ici, pas plus loin : ses deux fichiers primaires les
 * portent déjà (voir l'en-tête), et un filtre posé en aval serait oublié par le prochain
 * lecteur de cette fonction. `type` est vide pour les listes du Commerce : « other », dit.
 */
export function analyserCsl(texte: string): EntreeListe[] {
  const t = lireTable(texte);
  const col = (nom: string) => {
    const i = t.noms.indexOf(nom);
    if (i === -1) throw new Error(`the Consolidated Screening List has no "${nom}" column: its format changed.`);
    return i;
  };
  const [iId, iSource, iType, iProg, iNom, iAlias] =
    ["_id", "source", "type", "programs", "name", "alt_names"].map(col) as [number, number, number, number, number, number];
  const TYPES: Record<string, EntreeListe["type"]> = { "Individual": "person", "Entity": "entity", "Vessel": "vessel" };
  return t.lignes
    .filter((l) => !(l[iSource] ?? "").includes("Treasury Department"))
    .map((l) => {
      const liste = (l[iSource] ?? "").split(" - ")[0]!.trim();
      const programmes = (l[iProg] ?? "").trim();
      return { source: "CSL" as const, id: (l[iId] ?? "").trim(), nom: (l[iNom] ?? "").trim(),
        alias: (l[iAlias] ?? "").split(";").map((a) => a.trim()).filter((a) => a.length > 0),
        type: TYPES[(l[iType] ?? "").trim()] ?? "other",
        ...(liste ? { programme: programmes ? `${liste}: ${programmes}` : liste } : {}) };
    })
    .filter((e) => e.nom.length > 0 && e.id.length > 0);
}

export function analyser(format: SourceListe["format"], texte: string, source?: EntreeListe["source"]): EntreeListe[] {
  const entrees = format === "ofac-sdn-xml" ? analyserOfac(texte, source === "OFAC-CONS" ? "OFAC-CONS" : "OFAC")
    : format === "un-consolidated-xml" ? analyserOnu(texte)
    : format === "trade-csl-csv" ? analyserCsl(texte) : analyserUe(texte);
  if (entrees.length === 0) {
    throw new Error(
      `the file does not look like ${format}: not one entry could be read from it.\n`
      + `  Zero entries from a sanctions list is a sign of the wrong format, not a short one:\n`
      + `  reporting an empty list here would scream "screen against nothing" downstream.`);
  }
  return entrees;
}

/** OFAC porte son propre compte (`Record_Count`) : on le confronte au nôtre. Un écart ne
 *  refuse pas — le fichier fait foi — mais il s'écrit dans le manifeste, jamais en silence. */
export function recouperOfac(xml: string, lues: number): string | undefined {
  const annonce = Number(champ(blocs(xml, "publshInformation")[0] ?? "", "Record_Count"));
  if (!Number.isFinite(annonce) || annonce <= 0) return "the file announces no Record_Count to check against";
  if (annonce !== lues) return `the file announces ${annonce} records, the parser read ${lues}`;
  return undefined;
}

/* ───────────────────────────── le manifeste, committé ───────────────────────────── */

export type LigneManifeste = {
  source: string; titre: string; url: string; format: string;
} & ({
  disponible: true; telechargeLe: string; sha256: string; octets: number; entrees: number;
  avertissement?: string;
} | {
  disponible: false; verifieLe: string; erreur: string; issue: string;
});

export type Manifeste = { version: 1; genereLe: string; listes: LigneManifeste[] };

/* La racine est un PARAMÈTRE parce qu'une garde qu'aucun cas ne peut viser sans toucher au
   vrai dépôt n'est pas une garde — le motif exact de `readProfiles` chez cascade-routing. */
export function lireManifeste(racine: string = DOSSIER): Manifeste | null {
  const chemin = join(racine, "listes-manifest.json");
  if (!existsSync(chemin)) return null;
  return JSON.parse(readFileSync(chemin, "utf8")) as Manifeste;
}

function ecrireManifeste(m: Manifeste): void {
  const provisoire = `${MANIFESTE}.tmp`;
  writeFileSync(provisoire, JSON.stringify(m, null, 2) + "\n");
  renameSync(provisoire, MANIFESTE);
}

/** Lire une liste depuis le disque, CONTRE le manifeste : un fichier qui ne correspond
 *  plus à son empreinte ne se filtre pas contre — il se retélécharge ou se répare. */
export function lireListe(source: EntreeListe["source"], racine: string = DOSSIER): EntreeListe[] {
  const m = lireManifeste(racine);
  if (!m) throw new Error(`no listes-manifest.json: run \`npm run listes -- --fetch\` first.`);
  const ligne = m.listes.find((l) => l.source === source);
  if (!ligne) throw new Error(`the manifest does not know the source "${source}".`);
  if (!ligne.disponible) {
    throw new Error(`${source} is recorded as unavailable: ${ligne.erreur}\n  → ${ligne.issue}`);
  }
  const def = SOURCES.find((s) => s.source === source)!;
  const chemin = join(racine, "data", "listes", fichierDe(def));
  if (!existsSync(chemin)) {
    throw new Error(`${chemin} is missing while the manifest says ${source} was downloaded `
      + `on ${ligne.telechargeLe}. data/ is not committed: run \`npm run listes -- --fetch\`.`);
  }
  const brut = readFileSync(chemin);
  const sha = createHash("sha256").update(brut).digest("hex");
  if (sha !== ligne.sha256) {
    throw new Error(`${source}: the file on disk does not match the manifest content hash\n`
      + `  (manifest ${ligne.sha256.slice(0, 12)}…, disk ${sha.slice(0, 12)}…).\n`
      + `  Screening against a list that is not the one recorded certifies nothing.\n`
      + `  → npm run listes -- --fetch   (downloads again and reseals the manifest)`);
  }
  return analyser(def.format, brut.toString("utf8"), source);
}

/* ─────────────────────────────── le téléchargement ─────────────────────────────── */

/*
 * Mesuré sur les vraies sources, pas supposé : l'ONU refuse un client sans User-Agent de
 * navigateur, et redirige GET (302) — `fetch` suit les redirections par défaut.
 */
const ENTETES = { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" };

async function telecharger(s: SourceListe): Promise<LigneManifeste> {
  const maintenant = new Date().toISOString();
  let brut: Buffer;
  try {
    const r = await fetch(s.url, { headers: ENTETES, redirect: "follow" });
    if (!r.ok) {
      /* L'UE avec le jeton générique rend 500 : le manifeste porte le fait ET l'issue. */
      const issue = s.source === "EU"
        ? "the programmatic download needs a personal EU Login token (token=[username]); "
          + "set CASCADE_EU_TOKEN and run --fetch again. The generic public token returned "
          + "this error on every file endpoint while the RSS still answered."
        : "check the URL against the official page, then run --fetch again.";
      return { source: s.source, titre: s.titre, url: s.url, format: s.format,
        disponible: false, verifieLe: maintenant, erreur: `HTTP ${r.status}`, issue };
    }
    brut = Buffer.from(await r.arrayBuffer());
  } catch (e) {
    return { source: s.source, titre: s.titre, url: s.url, format: s.format,
      disponible: false, verifieLe: maintenant,
      erreur: `network: ${(e as Error).message}`,
      issue: "no bytes were written; check the connection and run --fetch again." };
  }
  const entrees = analyser(s.format, brut.toString("utf8"), s.source);
  mkdirSync(DONNEES, { recursive: true });
  const chemin = join(DONNEES, fichierDe(s));
  const provisoire = `${chemin}.tmp`;
  writeFileSync(provisoire, brut);
  renameSync(provisoire, chemin);
  const avertissement = s.format === "ofac-sdn-xml" ? recouperOfac(brut.toString("utf8"), entrees.length) : undefined;
  return { source: s.source, titre: s.titre, url: s.url, format: s.format,
    disponible: true, telechargeLe: maintenant,
    sha256: createHash("sha256").update(brut).digest("hex"),
    octets: brut.length, entrees: entrees.length, ...(avertissement ? { avertissement } : {}) };
}

/* ─────────────────────────────────── la commande ─────────────────────────────────── */

async function principal(): Promise<void> {
  refuserDrapeauxInconnus(["--fetch"]);
  const veutFetch = process.argv.includes("--fetch");

  if (veutFetch && process.env.CASCADE_OFFLINE === "1") {
    /* Le refus nomme le drapeau ET l'issue : un refus sans issue se fait commenter. */
    console.error(`\nCASCADE_OFFLINE=1 forbids the network, and --fetch exists to use it.`);
    console.error(`Nothing was downloaded and nothing was written.`);
    console.error(`  → run \`npm run listes\` (no flag) to see what is already on disk, or`);
    console.error(`  → unset CASCADE_OFFLINE to fetch the public lists.\n`);
    process.exit(2);
  }

  if (veutFetch) {
    console.log(`\nFetching the ${SOURCES.length} public lists: they download to your machine, and nothing of yours is sent.\n`);
    const lignes: LigneManifeste[] = [];
    for (const s of SOURCES) {
      const l = await telecharger(s);
      lignes.push(l);
      if (l.disponible) {
        console.log(`  ${s.source.padEnd(9)} ${l.entrees.toLocaleString("en-GB")} entr(ies) · `
          + `${(l.octets / 1_048_576).toFixed(1)} MiB · sha256 ${l.sha256.slice(0, 12)}…`
          + (l.avertissement ? `\n        ⚠ ${l.avertissement}` : ""));
      } else {
        console.log(`  ${s.source.padEnd(9)} UNAVAILABLE: ${l.erreur}\n        → ${l.issue}`);
      }
    }
    ecrireManifeste({ version: 1, genereLe: new Date().toISOString(), listes: lignes });
    console.log(`\nManifest written to listes-manifest.json: commit it; data/ stays out of git.\n`);
    process.exit(lignes.some((l) => l.disponible) ? 0 : 1);
  }

  /* Sans --fetch : l'état du disque, et RIEN d'autre — pas un octet ne sort. */
  const m = lireManifeste();
  if (!m) {
    console.log(`\nNo listes-manifest.json yet. Nothing was downloaded so far.`);
    console.log(`  → npm run listes -- --fetch\n`);
    process.exit(1);
  }
  console.log(`\nPublic lists on this machine (manifest of ${m.genereLe.slice(0, 10)}; no network touched):\n`);
  for (const l of m.listes) {
    if (!l.disponible) {
      console.log(`  ${l.source.padEnd(9)} UNAVAILABLE (checked ${l.verifieLe.slice(0, 10)}): ${l.erreur}\n        → ${l.issue}`);
      continue;
    }
    const chemin = join(DONNEES, fichierDe({ source: l.source as EntreeListe["source"], format: l.format as SourceListe["format"] }));
    const etat = !existsSync(chemin) ? "file MISSING from data/ (not committed by design): fetch again"
      : createHash("sha256").update(readFileSync(chemin)).digest("hex") === l.sha256
        ? "on disk, content hash matches" : "on disk but CHANGED since the manifest: fetch again";
    console.log(`  ${l.source.padEnd(9)} ${l.entrees.toLocaleString("en-GB")} entr(ies) · downloaded ${l.telechargeLe.slice(0, 10)} · ${etat}`);
  }
  console.log("");
}

if (isMain(import.meta)) {
  try {
    await principal();
  } catch (e) {
    console.error(`\n${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  }
}
