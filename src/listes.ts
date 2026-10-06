/**
 * Les listes publiques : la SEULE porte réseau de cet outil, et elle ne fait que descendre.
 *
 *   npm run listes              what is on disk: date, content hash, counts; no network
 *   npm run listes -- --fetch   download the public lists into data/listes/
 *
 * `frontiere.test.ts` nomme ce fichier comme l'unique autorisé à toucher le réseau, et
 * exige qu'il lise CRUSETRA_OFFLINE et CASCADE_OFFLINE, son ancien nom. La liste descend, rien ne monte : aucune donnée du
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
 *   (token=[username]). Le manifeste le dit, et l'issue existe : CRUSETRA_EU_TOKEN.
 *   L'analyseur v1.1 est écrit contre le schéma PUBLIÉ, pas contre un fichier reçu —
 *   c'est dit ici plutôt que découvert le jour où le jeton marche.
 *   Mesuré le 27 septembre 2026 : le jeton générique répond de nouveau (XML v1.1, 24,6 Mio),
 *   et l'analyseur écrit contre le schéma lit 6 241 entrées pour 6 241 balises
 *   `<sanctionEntity` dans le fichier. L'issue CRUSETRA_EU_TOKEN reste pour le jour où il
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
import { lireClasseur, tableParEntete } from "./xlsx.ts";

/** LA forme commune : les noms restent TELS QUE LA LISTE LES ÉCRIT — la normalisation est
 *  le travail des matchers, pas du téléchargeur. */
export type EntreeListe = {
  source: "OFAC" | "OFAC-CONS" | "CSL" | "EU" | "UN" | "UK" | "EU-VESSELS" | "AU" | "CA" | "NZ";
  id: string;
  nom: string;
  alias: string[];
  type: "person" | "entity" | "vessel" | "other";
  programme?: string;
  /** Les alias que l'OFAC classe « weak » (catégorie de son fichier), et ceux que la liste du Royaume-Uni dit
   *  « Low quality a.k.a » : trop génériques pour désigner seuls ; un candidat trouvé par eux le dit au
   *  relecteur. Sous-ensemble d'`alias`. */
  aliasFaibles?: string[];
  /** Le numéro OMI d'un navire, sept chiffres, tel que la liste l'écrit (« IMO 9187629 »). */
  imo?: string;
  /** Les AUTRES numéros OMI que la liste donne au même navire (le Royaume-Uni en écrit deux ou trois pour quelques
   *  coques renumérotées) : chacun désigne le navire autant que le premier. */
  autresImo?: string[];
  /** LA DATE DE DÉSIGNATION TELLE QUE LA LISTE L'ÉCRIT, et le champ de la liste qui la porte (« LISTED_ON »,
   *  « DateDesignated », « Date of application »). Jamais déduite : absente quand la liste n'en publie pas (l'OFAC)
   *  ou n'en écrit pas pour cette entrée ; le criblage le dit alors en toutes lettres. */
  designation?: { date: string; champ: string };
  /** LES PARTIES QUE LA LISTE ELLE-MÊME NOMME POUR CETTE ENTRÉE (le propriétaire d'un navire, son exploitant, un
   *  « Linked To: »), mot pour mot, avec le rôle que la liste leur donne. Jamais déduites, jamais prises à une autre
   *  entrée : seuls les champs structurés des listes entrent ici, pas leur texte libre. */
  parties?: { role: string; nom: string }[];
};

/**
 * LA LICENCE D'UNE SOURCE, LUE SUR LA PAGE DE L'ÉDITEUR. Le Royaume-Uni publie sa liste sous l'Open Government
 * Licence v3.0, qui exige une mention écrite, et elle n'était imprimée nulle part jusqu'au 5 octobre 2026. Chaque
 * source porte donc le nom de sa licence, la page de l'éditeur qui la dit (jamais celle d'un tiers), la mention
 * exigée mot pour mot ou null quand aucune ne l'est (la page le dit, la note le répète), et le jour où la page a
 * été lue. Le criblage recopie ces champs dans son relevé et son tableur ; `src/licences.ts --check` refuse une
 * source à qui il en manque un.
 */
export type Licence = {
  /** la licence, nommée comme l'éditeur la nomme */
  nom: string;
  /** la page de l'éditeur qui l'énonce */
  url: string;
  /** la mention que la licence exige, mot pour mot ; null quand l'éditeur n'en exige aucune */
  mention: string | null;
  /** ce que la page de l'éditeur dit, en une ligne : pourquoi aucune mention n'est exigée, ou la limite lue */
  note: string;
  /** le jour où la page a été lue (AAAA-MM-JJ) */
  lue: string;
};

export type SourceListe = {
  source: EntreeListe["source"];
  titre: string;
  url: string;
  format: "ofac-sdn-xml" | "un-consolidated-xml" | "eu-fsf-xml-1.1" | "trade-csl-csv" | "uk-sanctions-xml" | "eu-833-annex-xlii-xhtml"
    | "dfat-consolidated-xlsx" | "gac-sema-xml" | "mfat-russia-register-xlsx";
  /** les en-têtes que la source exige en plus (la négociation de contenu de l'Office des publications) */
  entetes?: Record<string, string>;
  licence: Licence;
};

/** Le fichier d'une source dans data/listes/ : son extension suit son format. */
export function fichierDe(s: Pick<SourceListe, "source" | "format">): string {
  const ext = s.format === "trade-csl-csv" ? "csv" : s.format === "eu-833-annex-xlii-xhtml" ? "xhtml"
    : s.format === "dfat-consolidated-xlsx" || s.format === "mfat-russia-register-xlsx" ? "xlsx" : "xml";
  return `${s.source.toLowerCase()}.${ext}`;
}

/** Les formats qui sont un classeur, lus en octets ; les autres sont du texte. */
export function estClasseur(format: SourceListe["format"]): boolean {
  return format === "dfat-consolidated-xlsx" || format === "mfat-russia-register-xlsx";
}

/**
 * Ce qui manque à une source pour que sa licence soit dite : le contrôle que `src/licences.ts --check` lance, et
 * dont `listes.test.ts` prouve qu'il rougit quand un champ est retiré. Rendu comme liste de manques nommés, jamais
 * comme un booléen : une garde qui ne dit pas ce qui manque fait perdre le temps qu'elle prétend faire gagner.
 */
export function manquesDeLicence(sources: readonly Partial<SourceListe>[]): string[] {
  const manques: string[] = [];
  for (const s of sources) {
    const qui = s.source ?? "(unnamed source)";
    const l = s.licence;
    if (!l) { manques.push(`${qui}: no licence recorded`); continue; }
    if (!l.nom?.trim()) manques.push(`${qui}: the licence has no name`);
    if (!/^https:\/\/\S+$/.test(l.url ?? "")) manques.push(`${qui}: the licence has no https publisher page`);
    if (l.mention !== null && !(typeof l.mention === "string" && l.mention.trim().length > 0)) manques.push(`${qui}: the attribution is neither a text nor null`);
    if (l.mention === null && !l.note?.trim()) manques.push(`${qui}: no attribution is required, and the note does not say where the publisher says so`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(l.lue ?? "")) manques.push(`${qui}: the day the publisher's page was read is missing`);
  }
  return manques;
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
 * par CRUSETRA_EU_TOKEN, ou par CASCADE_EU_TOKEN, son ancien nom, lu en alias déprécié.
 */
const JETON_UE_GENERIQUE_PUBLIC = "dG9rZW4tMjAxNw";
export const jetonUe = (env: NodeJS.ProcessEnv = process.env): string => env.CRUSETRA_EU_TOKEN ?? env.CASCADE_EU_TOKEN ?? JETON_UE_GENERIQUE_PUBLIC;
const JETON_UE = jetonUe();
/** La version consolidée du règlement (UE) 833/2014 dont l'annexe XLII est lue : son numéro CELEX, daté. */
export const CELEX_833 = "02014R0833-20260724";

/*
 * LES LICENCES, LUES LE 5 OCTOBRE 2026 SUR LA PAGE DE CHAQUE ÉDITEUR (jamais sur celle d'un tiers) :
 *
 *   États-Unis (OFAC, trade.gov) : une œuvre du gouvernement fédéral n'est pas protégée par le droit d'auteur
 *   (17 U.S.C. § 105, « Copyright protection under this title is not available for any work of the United States
 *   Government ») ; USA.gov demande seulement que l'usage ne laisse pas entendre une approbation de l'agence. La page
 *   de la Consolidated Screening List n'énonce aucune condition.
 *   ONU : les conditions d'utilisation du site (un.org/en/about-us/terms-of-use) accordent « permission to Users to
 *   visit the Site and to download and copy the information, documents and materials [...] for the User's personal,
 *   non-commercial use, without any right to resell or redistribute them » ; la page de la liste consolidée dit que la
 *   liste existe « to facilitate the implementation of the measures ». Aucune mention n'est prescrite ; l'usage
 *   commercial n'est pas réglé par la page de l'éditeur, et c'est écrit dans la note.
 *   UE (FSF) : l'avis juridique de la Commission (commission.europa.eu/legal-notice_en) : « content owned by the EU on
 *   this website is licensed under the Creative Commons Attribution 4.0 International (CC BY 4.0) licence. This means
 *   that reuse is allowed, provided appropriate credit is given and changes are indicated », en application de la
 *   décision 2011/833/UE ; data.europa.eu range le jeu FSF sous cette décision (« European Commission reuse notice »).
 *   UE (Office des publications, EUR-Lex) : réutilisation autorisée à des fins commerciales ou non, la source
 *   reconnue (décision 2011/833/UE).
 *   Royaume-Uni : Open Government Licence v3.0 ; la page de la liste dit « All content is available under the Open
 *   Government Licence v3.0, except where otherwise stated », et la licence impose la mention recopiée ci-dessous.
 *   Australie : « all material presented on this website is provided under a Creative Commons Attribution 4.0
 *   International licence [...] Content from this website should be attributed as Department of Foreign Affairs and
 *   Trade website – www.dfat.gov.au ».
 *   Canada : la liste est le jeu ab076f2e-94b1-4039-bb3d-58002deb826d d'open.canada.ca, publié par Affaires mondiales
 *   Canada sous l'Open Government Licence - Canada, dont la mention par défaut est recopiée ci-dessous ; sans ce jeu,
 *   les conditions générales de canada.ca exigeraient une permission écrite pour toute redistribution commerciale.
 *   Nouvelle-Zélande : « Crown copyright ©. [...] licensed under the Creative Commons Attribution 4.0 International
 *   licence [...] as long as you attribute the work to the Crown » ; aucune formule imposée.
 */
const LUE = "2026-10-05";
const LICENCE_ETATS_UNIS: Licence = {
  nom: "United States Government work: not subject to copyright (17 U.S.C. § 105)",
  url: "https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title17-section105&num=0&edition=prelim",
  mention: null,
  note: "a work of the United States Government is not protected by copyright; no attribution is required. USA.gov (usa.gov/government-copyright) asks that reuse not imply endorsement by the agency.",
  lue: LUE,
};
const LICENCE_COMMISSION: Licence = {
  nom: "Commission Decision 2011/833/EU on the reuse of Commission documents; Creative Commons Attribution 4.0 International (CC BY 4.0)",
  url: "https://commission.europa.eu/legal-notice_en",
  mention: "Source: European Commission, Financial Sanctions Files (FSF), © European Union, reused under Commission Decision 2011/833/EU (CC BY 4.0)",
  note: "the legal notice requires appropriate credit and that changes be indicated, and prescribes no wording; this is the wording used. data.europa.eu lists the dataset under the European Commission reuse notice (Decision 2011/833/EU).",
  lue: LUE,
};

export const SOURCES: SourceListe[] = [
  {
    source: "OFAC", titre: "OFAC Specially Designated Nationals (SDN) list",
    url: "https://sanctionslistservice.ofac.treas.gov/api/publicationpreview/exports/sdn.xml",
    format: "ofac-sdn-xml", licence: LICENCE_ETATS_UNIS,
  },
  {
    source: "OFAC-CONS", titre: "OFAC Consolidated Sanctions List (the non-SDN lists)",
    url: "https://sanctionslistservice.ofac.treas.gov/api/publicationpreview/exports/consolidated.xml",
    format: "ofac-sdn-xml", licence: LICENCE_ETATS_UNIS,
  },
  {
    source: "CSL", titre: "US Consolidated Screening List: its Commerce and State lists (trade.gov)",
    url: "https://data.trade.gov/downloadable_consolidated_screening_list/v1/consolidated.csv",
    format: "trade-csl-csv",
    licence: { ...LICENCE_ETATS_UNIS, note: `${LICENCE_ETATS_UNIS.note} The Consolidated Screening List page (trade.gov/consolidated-screening-list) states no condition of use.` },
  },
  {
    source: "UN", titre: "UN Security Council Consolidated List",
    url: "https://scsanctions.un.org/resources/xml/en/consolidated.xml",
    format: "un-consolidated-xml",
    licence: {
      nom: "United Nations website Terms of Use (no open licence)",
      url: "https://www.un.org/en/about-us/terms-of-use",
      mention: null,
      note: "the Terms grant Users permission to download and copy the Materials for the User's personal, non-commercial use, without any right to resell or redistribute them; the Consolidated List page says the list exists to facilitate the implementation of the measures. No attribution wording is prescribed. Commercial reuse is not settled by the publisher's page: to be confirmed with the United Nations before a sale.",
      lue: LUE,
    },
  },
  {
    source: "EU", titre: "EU consolidated financial sanctions list (FSF, XML v1.1)",
    url: `https://webgate.ec.europa.eu/fsd/fsf/public/files/xmlFullSanctionsList_1_1/content?token=${JETON_UE}`,
    format: "eu-fsf-xml-1.1", licence: LICENCE_COMMISSION,
  },
  /*
   * LES NAVIRES DÉSIGNÉS, mesuré le 04/10/2026 sur un vrai pétrolier (OMI 9274800, ASTRAL pour l'UE, YANGTZE pour
   * le Royaume-Uni) : aucune des cinq listes ci-dessus ne le portait. Le fichier FSF de l'UE ne porte que le gel des
   * avoirs ; les navires interdits de port et de services sont à l'annexe XLII du règlement (UE) 833/2014, qui
   * n'existe dans aucun fichier lisible par machine : la source est le TEXTE CONSOLIDÉ du règlement, servi par
   * l'Office des publications (réutilisation permise avec mention de la source, décision 2011/833/UE). L'adresse
   * NOMME UNE VERSION CONSOLIDÉE (CELEX_833) : un paquet de sanctions plus récent n'y est pas tant que la constante
   * n'a pas été avancée, et le manifeste porte la date de la version lue. La page d'EUR-Lex elle-même répond par un
   * défi anti-robot ; le service de l'Office est l'accès prévu pour une machine.
   * Mesuré le 04/10/2026 : l'Office répond en https par une redirection (303) vers une adresse http de son
   * entrepôt ; le contenu arrive donc en clair, et c'est l'empreinte du manifeste qui dit quel fichier a été lu.
   * Vérifié le 04/10/2026 au catalogue de l'Office (SPARQL, les actes qui « amend » 32014R0833) : le dernier acte modificatif
   * est le règlement (UE) 2026/1848 du 23/07/2026, que cette version consolidée porte ; aucun acte postérieur n'y figure, le
   * catalogue allant jusqu'au 01/10/2026. L'annexe lue est donc l'annexe en vigueur ce jour-là.
   * La liste du Royaume-Uni (FCDO, Open Government Licence v3.0) porte personnes, entités et navires, les navires
   * avec leur numéro OMI.
   */
  {
    source: "UK", titre: "UK Sanctions List (FCDO): individuals, entities and ships",
    url: "https://sanctionslist.fcdo.gov.uk/docs/UK-Sanctions-List.xml",
    format: "uk-sanctions-xml",
    licence: {
      nom: "Open Government Licence v3.0",
      url: "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
      mention: "Contains public sector information licensed under the Open Government Licence v3.0.",
      note: "the UK Sanctions List page (gov.uk/government/publications/the-uk-sanctions-list) says: All content is available under the Open Government Licence v3.0, except where otherwise stated; the licence requires the attribution statement above when the provider gives none of its own.",
      lue: LUE,
    },
  },
  {
    source: "EU-VESSELS", titre: `EU designated vessels: Annex XLII of Regulation (EU) No 833/2014, consolidated text ${CELEX_833.slice(-8, -4)}-${CELEX_833.slice(-4, -2)}-${CELEX_833.slice(-2)}`,
    url: `https://publications.europa.eu/resource/celex/${CELEX_833}`,
    format: "eu-833-annex-xlii-xhtml",
    entetes: { accept: "application/xhtml+xml, text/html", "accept-language": "eng" },
    licence: {
      nom: "Commission Decision 2011/833/EU on the reuse of Commission documents; consolidated texts under Creative Commons Attribution 4.0 International (CC BY 4.0), Publications Office (EUR-Lex)",
      url: "https://eur-lex.europa.eu/content/legal-notice/legal-notice.html",
      mention: "© European Union, 1998-2026. Source: EUR-Lex, consolidated text of Regulation (EU) No 833/2014 (Annex XLII), reused under Commission Decision 2011/833/EU (CC BY 4.0)",
      note: "the EUR-Lex legal notice: you can re-use the legal documents published in EUR-Lex for commercial or non-commercial purposes; the consolidated texts, owned by the EU, are licensed under CC BY 4.0 provided you acknowledge the source and indicate any changes. No wording is prescribed beyond the copyright line; this is the wording used.",
      lue: LUE,
    },
  },
  /*
   * AJOUTÉES LE 5 OCTOBRE 2026 : trois listes officielles de plus, chacune lue dans le format que l'éditeur publie.
   *
   *   AU : la Consolidated List du DFAT (Australian Sanctions Office), un classeur Excel d'une feuille dont le nom
   *   porte la date (« Consolidated List - 2_10_2026 ») : lue par position, pas par nom. Une ligne par NOM : la
   *   référence « 8227 » est le nom principal, « 8227a », « 8227b » ses alias (Name Type « Alias », force « strong »
   *   ou « weak ») et ses écritures d'origine (« Original Script »). « Control Date » est la dernière mise à jour de
   *   l'entrée, pas sa désignation (le guide de la liste le dit) : la date de désignation est celle que « Listing
   *   Information » écrit (« Listed on 25 January 2001 ») quand elle l'écrit. Mesuré le 05/10/2026 sur le fichier du
   *   02/10 : 11 416 lignes de noms.
   *   CA : la Consolidated Canadian Autonomous Sanctions List d'Affaires mondiales Canada, un XML d'enregistrements
   *   bilingues (« Country-Pays », « DateOfListing-DateDinscription »), une personne par LastName/GivenName (certaines
   *   n'ont qu'un GivenName), une entité ou un navire par EntityOrShip, le navire reconnu à son numéro OMI lisible.
   *   Mesuré le 05/10/2026 : 4 659 enregistrements, 732 avec un champ OMI dont 727 lisibles ; les cinq autres
   *   portent un nom en écriture arabe dans le champ OMI (une colonne décalée chez l'éditeur) et restent des
   *   personnes sans numéro. Les alias sont un texte libre coupé aux points-virgules et aux virgules.
   *   NZ : le Russia Sanctions Register du MFAT, un classeur de cinq feuilles dont deux sont criblées : « Russia
   *   Sanctions Register » (personnes, entités, banques, actifs ; l'en-tête est à la onzième ligne, sous une légende)
   *   et « Ships » (navires avec leur numéro OMI). Les dates sont des numéros de série Excel, rendus AAAA-MM-JJ.
   *   Mesuré le 05/10/2026 sur le fichier du 09/09 : 1 925 lignes sanctionnées et 210 navires.
   */
  {
    source: "AU", titre: "Australia: DFAT Consolidated List (Australian Sanctions Office)",
    url: "https://www.dfat.gov.au/sites/default/files/Australian_Sanctions_Consolidated_List.xlsx",
    format: "dfat-consolidated-xlsx",
    licence: {
      nom: "Creative Commons Attribution 4.0 International (CC BY 4.0), Commonwealth of Australia (DFAT)",
      url: "https://www.dfat.gov.au/about-us/about-this-website/copyright",
      mention: "Department of Foreign Affairs and Trade website – www.dfat.gov.au",
      note: "the copyright page: all material presented on this website is provided under a Creative Commons Attribution 4.0 International licence, and content should be attributed with the statement above.",
      lue: LUE,
    },
  },
  {
    source: "CA", titre: "Canada: Consolidated Canadian Autonomous Sanctions List (Global Affairs Canada)",
    url: "https://www.international.gc.ca/world-monde/assets/office_docs/international_relations-relations_internationales/sanctions/sema-lmes.xml",
    format: "gac-sema-xml",
    licence: {
      nom: "Open Government Licence - Canada",
      url: "https://open.canada.ca/en/open-government-licence-canada",
      mention: "Contains information licensed under the Open Government Licence – Canada.",
      note: "the list is dataset ab076f2e-94b1-4039-bb3d-58002deb826d on open.canada.ca, published by Global Affairs Canada under this licence, whose default attribution statement is the one above; the general terms of canada.ca would otherwise require written permission for commercial redistribution.",
      lue: LUE,
    },
  },
  {
    source: "NZ", titre: "New Zealand: Russia Sanctions Register (MFAT): individuals, entities and ships",
    url: "https://www.mfat.govt.nz/assets/Countries-and-Regions/Europe/Ukraine/Russia-Sanctions-Register.xlsx",
    format: "mfat-russia-register-xlsx",
    licence: {
      nom: "Creative Commons Attribution 4.0 International (CC BY 4.0), Crown copyright (Ministry of Foreign Affairs and Trade)",
      url: "https://www.mfat.govt.nz/en/copyright",
      mention: "Source: New Zealand Ministry of Foreign Affairs and Trade, Russia Sanctions Register, Crown copyright, licensed under CC BY 4.0",
      note: "the copyright page asks that the work be attributed to the Crown under CC BY 4.0 and prescribes no wording; this is the wording used.",
      lue: LUE,
    },
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

/** « IMO 9187629 », « imo9187629 », « 9187629 » → « 9187629 » ; autre chose → undefined. La lecture du criblage,
 *  la même pour le fichier du client (cribler.ts) et pour les listes qui écrivent un numéro OMI. */
export function lireImo(brut: string | undefined): string | undefined {
  if (brut === undefined) return undefined;
  const m = /^(?:imo\s*)?(\d{7})$/i.exec(brut.trim());
  return m?.[1];
}

/** Les parties d'une entrée, à partir d'un champ et d'un rôle, les vides écartées. */
function parties(role: string, noms: readonly (string | undefined)[]): { role: string; nom: string }[] {
  return noms.map((n) => (n ?? "").replace(/\s+/g, " ").trim()).filter((n) => n.length > 0).map((nom) => ({ role, nom }));
}

/** OFAC : `<sdnEntry>`, avec uid, firstName?/lastName, sdnType, programList, akaList ; pas de date de désignation dans
 *  ce fichier (l'OFAC n'en publie pas là) ; le propriétaire d'un navire dans `<vesselInfo><vesselOwner>`, et les
 *  « Linked To: » des `<remarks>`, sont les parties que la liste nomme. */
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
    /* les remarques : « (Linked To: X; Linked To: Y) », et un nom peut porter ses propres parenthèses (« (IRGC)-QODS FORCE ») :
       la parenthèse qui enferme toute la remarque est ôtée d'abord, puis chaque segment « Linked To: » est pris jusqu'au
       point-virgule suivant */
    const remarques = (champ(b, "remarks") ?? "").trim().replace(/^\(([\s\S]*)\)$/, "$1");
    const nommees = [
      ...parties("vesselOwner", blocs(b, "vesselInfo").map((v) => champ(v, "vesselOwner"))),
      ...parties("Linked To", remarques.split(";").map((s) => s.trim()).filter((s) => /^Linked To:/i.test(s)).map((s) => s.replace(/^Linked To:\s*/i, ""))),
    ];
    return { source, id: champ(b, "uid") ?? "", nom, alias, type,
      ...(programmes.length ? { programme: programmes.join("+") } : {}),
      ...(aliasFaibles.length ? { aliasFaibles } : {}), ...(imo ? { imo } : {}), ...(nommees.length ? { parties: nommees } : {}) };
  }).filter((e) => e.nom.length > 0 && e.id.length > 0);
}

/** ONU : `<INDIVIDUAL>` et `<ENTITY>`, avec DATAID, FIRST_NAME…FOURTH_NAME, *_ALIAS, LISTED_ON. Un
 *  `<ALIAS_NAME/>` VIDE existe dans le vrai fichier : il s'écarte, il ne devient pas "". */
export function analyserOnu(xml: string): EntreeListe[] {
  const lire = (b: string, type: "person" | "entity", baliseAlias: string): EntreeListe => {
    const nom = ["FIRST_NAME", "SECOND_NAME", "THIRD_NAME", "FOURTH_NAME"]
      .map((t) => champ(b, t)).filter(Boolean).join(" ").trim();
    const alias = blocs(b, baliseAlias)
      .map((a) => (champ(a, "ALIAS_NAME") ?? "").trim())
      .filter((a) => a.length > 0);
    const programme = champ(b, "UN_LIST_TYPE")?.trim();
    const liste = champ(b, "LISTED_ON")?.trim();
    return { source: "UN", id: champ(b, "DATAID") ?? "", nom, alias, type,
      ...(programme ? { programme } : {}), ...(liste ? { designation: { date: liste, champ: "LISTED_ON" } } : {}) };
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
    const reglement = (/<regulation\b[^>]*>/.exec(corps!) ?? [""])[0]!;
    const programme = attribut(reglement, "programme");
    /* la date : celle d'entrée en vigueur du règlement que l'entrée porte, avec le numéro du règlement dans le nom du champ */
    const vigueur = attribut(reglement, "entryIntoForceDate");
    const numero = attribut(reglement, "numberTitle");
    entites.push({ source: "EU", id: attribut(entete!, "logicalId") ?? "", nom: noms[0]!,
      alias: noms.slice(1), type, ...(programme ? { programme } : {}),
      ...(vigueur ? { designation: { date: vigueur, champ: `regulation entryIntoForceDate${numero ? ` (${numero})` : ""}` } } : {}) });
  }
  return entites.filter((e) => e.id.length > 0);
}

/**
 * ROYAUME-UNI (UK Sanctions List, XML) : `<Designation>` avec `<UniqueID>`, `<Names>` (chaque `<Name>` porte
 * `<Name1>`…`<Name6>`, Name6 étant le nom de famille ou le nom entier, et un `<NameType>` : « Primary Name », sa
 * variation, ou « Alias » avec un `<AliasStrength>`), `<NonLatinNames>`, `<IndividualEntityShip>` et, pour un navire,
 * `<IMONumber>` (« IMO9274800 » ou sept chiffres). Mesuré le 04/10/2026 sur le fichier du 02/10 : 6 370 désignations
 * (4 054 personnes, 1 645 entités, 671 navires dont 670 avec un numéro OMI ; six en portent plusieurs, tous
 * gardés : `imo` et `autresImo`), 613 alias « Low quality a.k.a », gardés et marqués faibles comme les « weak » de l'OFAC.
 */
export function analyserRoyaumeUni(xml: string): EntreeListe[] {
  const TYPES: Record<string, EntreeListe["type"]> = { "Individual": "person", "Entity": "entity", "Ship": "vessel" };
  return blocs(xml, "Designation").map((b) => {
    const noms = blocs(b, "Name").map((n) => ({
      nom: ["Name1", "Name2", "Name3", "Name4", "Name5", "Name6"].map((t) => champ(n, t)?.trim()).filter(Boolean).join(" "),
      principal: /^primary name$/i.test((champ(n, "NameType") ?? "").trim()),
      faible: /^low quality/i.test((champ(n, "AliasStrength") ?? "").trim()),
    })).filter((n) => n.nom.length > 0);
    const natifs = blocs(b, "NonLatinName").map((n) => (champ(n, "NameNonLatinScript") ?? "").trim()).filter((n) => n.length > 0);
    const principal = noms.find((n) => n.principal) ?? noms[0];
    const alias = [...new Set([...noms.filter((n) => n !== principal).map((n) => n.nom), ...natifs])].filter((a) => a !== principal?.nom);
    const aliasFaibles = [...new Set(noms.filter((n) => n !== principal && n.faible).map((n) => n.nom))];
    const imos = [...new Set(blocs(b, "IMONumber").map((i) => /^(?:IMO\s*)?(\d{7})$/i.exec(decoderEntites(i).trim())?.[1]).filter((x): x is string => Boolean(x)))];
    const imo = imos[0];
    const programme = champ(b, "RegimeName")?.trim();
    const designee = champ(b, "DateDesignated")?.trim();
    /* les parties qu'un navire porte : son propriétaire ou exploitant actuel, les précédents (ShipDetails) */
    const nommees = [
      ...parties("CurrentOwnerOperator", blocs(b, "CurrentOwnerOperator").map(decoderEntites)),
      ...parties("PreviousOwnerOperator", blocs(b, "PreviousOwnerOperator").map(decoderEntites)),
    ];
    return { source: "UK" as const, id: champ(b, "UniqueID") ?? "", nom: principal?.nom ?? "", alias,
      type: TYPES[(champ(b, "IndividualEntityShip") ?? "").trim()] ?? "other",
      ...(programme ? { programme } : {}), ...(aliasFaibles.length ? { aliasFaibles } : {}), ...(imo ? { imo } : {}), ...(imos.length > 1 ? { autresImo: imos.slice(1) } : {}),
      ...(designee ? { designation: { date: designee, champ: "DateDesignated" } } : {}), ...(nommees.length ? { parties: nommees } : {}) };
  }).filter((e) => e.nom.length > 0 && e.id.length > 0);
}

/**
 * UE, LES NAVIRES (annexe XLII du règlement 833/2014, texte consolidé en XHTML) : entre le titre « ANNEX XLII » et
 * celui de l'annexe suivante, un tableau dont chaque ligne porte un rang (« 462. », une fois sans son point), le nom du navire, son numéro
 * OMI de sept chiffres, le motif et la date d'application. Une ligne qui n'a pas cette forme (l'en-tête, les marques
 * de modification « ▼M38 ») n'est pas un navire. L'identifiant est le numéro OMI, ce que l'annexe désigne ; un
 * numéro qui revient sous un second nom garde sa première ligne et prend l'autre nom pour alias. Mesuré le
 * 04/10/2026 sur la version du 24/07/2026 : 674 lignes, 672 numéros (deux reviennent deux fois sous le même nom).
 */
export function analyserNaviresUe(xhtml: string): EntreeListe[] {
  const debut = xhtml.search(/ANNEX\s+XLII\b/);
  if (debut === -1) return [];
  const suite = xhtml.slice(debut + 10).search(/ANNEX\s+XLIII\b/);
  const annexe = suite === -1 ? xhtml.slice(debut) : xhtml.slice(debut, debut + 10 + suite);
  const texte = (c: string) => decoderEntites(c.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  const parImo = new Map<string, EntreeListe>();
  for (const ligne of annexe.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cellules = [...ligne[1]!.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map((c) => texte(c[1]!));
    if (cellules.length < 3 || !/^\d+\.?$/.test(cellules[0]!) || !/^\d{7}$/.test(cellules[2]!) || cellules[1]!.length === 0) continue;
    const [, nom, imo] = cellules as [string, string, string];
    const deja = parImo.get(imo);
    if (deja) { if (deja.nom !== nom && !deja.alias.includes(nom)) deja.alias.push(nom); continue; }
    const application = (cellules[4] ?? "").trim();
    parImo.set(imo, { source: "EU-VESSELS", id: `IMO${imo}`, nom, alias: [], type: "vessel", programme: "833/2014 Annex XLII", imo,
      ...(application ? { designation: { date: application, champ: "Date of application" } } : {}) });
  }
  return [...parImo.values()];
}

/**
 * AUSTRALIE (DFAT Consolidated List, classeur d'une feuille dont le nom porte la date : lue par position). Une ligne
 * par nom : « 8227 » est le nom principal, « 8227a » et les suivants ses alias (Name Type « Alias », Alias Strength
 * « Strong » ou « Weak ») et ses écritures d'origine (« Original Script »). Les alias faibles sont marqués comme les
 * « weak » de l'OFAC. « Control Date » est la dernière mise à jour de l'entrée, pas sa désignation (le guide de la
 * liste le dit) : la date de désignation est celle que « Listing Information » écrit en toutes lettres (« Listed on
 * 25 January 2001 », « Listed by UN 1267 Committee on 6 Oct. 2001 ») quand elle l'écrit ; sinon l'entrée n'en a pas.
 */
export function analyserDfat(classeur: Buffer): EntreeListe[] {
  const [feuille] = lireClasseur(classeur, [0]);
  const lignes = tableParEntete(feuille!, ["Reference", "Name of Individual or Entity", "Type", "Name Type", "Alias Strength", "Listing Information", "IMO Number", "Committees"]);
  const TYPES: Record<string, EntreeListe["type"]> = { "Individual": "person", "Entity": "entity", "Vessel": "vessel" };
  const groupes = new Map<string, typeof lignes>();
  for (const l of lignes) {
    const ref = /^(\d+)/.exec(l.par("Reference"))?.[1];
    if (!ref || !l.par("Name of Individual or Entity")) continue;
    const g = groupes.get(ref);
    if (g) g.push(l); else groupes.set(ref, [l]);
  }
  const entrees: EntreeListe[] = [];
  for (const [id, g] of groupes) {
    const principal = g.find((l) => /^primary name$/i.test(l.par("Name Type"))) ?? g[0]!;
    const nom = principal.par("Name of Individual or Entity");
    const autres = g.filter((l) => l !== principal);
    const alias = [...new Set(autres.map((l) => l.par("Name of Individual or Entity")).filter((a) => a && a !== nom))];
    const aliasFaibles = [...new Set(autres.filter((l) => /^weak$/i.test(l.par("Alias Strength"))).map((l) => l.par("Name of Individual or Entity")))].filter((a) => alias.includes(a));
    const imo = g.map((l) => lireImo(l.par("IMO Number"))).find(Boolean);
    const programme = principal.par("Committees");
    const date = /\bListed\b.{0,80}?\bon (\d{1,2} [A-Za-z]{3,9}\.? \d{4})/.exec(principal.par("Listing Information"))?.[1];
    entrees.push({ source: "AU", id, nom, alias, type: TYPES[principal.par("Type")] ?? "other",
      ...(programme ? { programme } : {}), ...(aliasFaibles.length ? { aliasFaibles } : {}), ...(imo ? { imo } : {}),
      ...(date ? { designation: { date, champ: "Listing Information" } } : {}) });
  }
  return entrees;
}

/**
 * CANADA (Consolidated Canadian Autonomous Sanctions List, XML bilingue d'Affaires mondiales Canada) : un `<record>`
 * par entrée, une personne par LastName/GivenName (certaines n'ont qu'un GivenName : « Than Shwe »), une entité ou
 * un navire par EntityOrShip, le navire reconnu à un numéro OMI LISIBLE (`lireImo`) : mesuré le 05/10/2026, cinq
 * enregistrements de personnes portent un nom en écriture arabe dans le champ OMI, une colonne décalée chez
 * l'éditeur ; ils restent des personnes sans numéro. L'identifiant est règlement + annexe + numéro d'article (le
 * fichier n'en donne pas d'autre) ; les alias sont un texte libre coupé aux points-virgules et aux virgules, les
 * étiquettes de langue (« Belarusian: ») retirées.
 */
export function analyserCanada(xml: string): EntreeListe[] {
  const vus = new Map<string, number>();
  const entrees: EntreeListe[] = [];
  for (const b of blocs(xml, "record")) {
    const c = (t: string) => { const v = champ(b, t)?.replace(/\s+/g, " ").trim(); return v ? v : undefined; };
    const nomFamille = c("LastName-NomDeFamille"), prenom = c("GivenName-Prenom"), entiteOuNavire = c("EntityOrShip-EntiteOuNavire");
    const personne = Boolean(nomFamille || prenom);
    const nom = personne ? [prenom, nomFamille].filter(Boolean).join(" ") : entiteOuNavire ?? "";
    if (!nom) continue;
    const imo = personne ? undefined : lireImo(c("ShipIMONumber-NumeroOMIDuNavire"));
    const programme = (c("Country-Pays") ?? "").split(" / ")[0]!.trim();
    const alias = [...new Set((c("Aliases-Alias") ?? "").split(/[;,]/).map((a) => a.replace(/^\s*[A-Z][A-Za-z]+:\s*/, "").trim()).filter((a) => a.length > 1 && a !== nom))];
    const cle = `${programme}|${c("Schedule-Annexe") ?? ""}|${c("Item-NumeroDarticle") ?? ""}`;
    const n = (vus.get(cle) ?? 0) + 1;
    vus.set(cle, n);
    const date = c("DateOfListing-DateDinscription");
    entrees.push({ source: "CA", id: n === 1 ? cle : `${cle}#${n}`, nom, alias, type: personne ? "person" : imo ? "vessel" : "entity",
      ...(programme ? { programme } : {}), ...(imo ? { imo } : {}), ...(date ? { designation: { date, champ: "DateOfListing" } } : {}) });
  }
  return entrees;
}

/**
 * NOUVELLE-ZÉLANDE (Russia Sanctions Register du MFAT, classeur) : deux feuilles criblées. « Russia Sanctions
 * Register » : l'en-tête est sous une légende (onzième ligne), une ligne par personne (First, Middle, Last name),
 * entité ou banque (le nom dans la colonne « First name »), actif (« Name of Asset » : des classes de navires, pas
 * des coques) ; seules les lignes « Sanctioned » avec un identifiant entrent, la ligne « Total » non. « Ships » : un
 * navire par ligne avec son numéro OMI, sauf celles marquées supprimées. Les dates sont des numéros de série Excel,
 * rendus AAAA-MM-JJ par le lecteur ; « Associates/Relatives » est la partie que la liste nomme.
 */
export function analyserMfat(classeur: Buffer): EntreeListe[] {
  const [registre, navires] = lireClasseur(classeur, ["Russia Sanctions Register", "Ships"]);
  const TYPES: Record<string, EntreeListe["type"]> = { "Individual": "person", "Entity": "entity", "Bank": "entity", "Asset": "other" };
  const entrees: EntreeListe[] = [];
  const couper = (t: string) => [...new Set(t.split(/;/).map((a) => a.trim()).filter((a) => a.length > 0))];
  for (const l of tableParEntete(registre!, ["Type", "Unique Identifier", "First name", "Last name", "Sanction Status", "Date of Sanction"])) {
    const type = TYPES[l.par("Type")], id = l.par("Unique Identifier");
    if (!type || !id || !/^sanctioned$/i.test(l.par("Sanction Status"))) continue;
    const nom = type === "other" ? (l.par("Name of Asset") || l.par("First name"))
      : [l.par("First name"), l.par("Middle name(s)"), l.par("Last name")].filter(Boolean).join(" ");
    if (!nom) continue;
    const date = l.par("Date of Sanction");
    const nommees = parties("Associates/Relatives", [l.par("Associates/Relatives")]);
    entrees.push({ source: "NZ", id, nom, alias: couper(l.par("Alias/Alternate Spellings")).filter((a) => a !== nom), type, programme: "Russia Sanctions Regulations 2022",
      ...(date ? { designation: { date, champ: "Date of Sanction" } } : {}), ...(nommees.length ? { parties: nommees } : {}) });
  }
  for (const l of tableParEntete(navires!, ["Type", "Unique Identifier", "IMO Number", "Name of Ship as of Date of Sanction", "Date of Sanction"])) {
    const id = l.par("Unique Identifier"), nom = l.par("Name of Ship as of Date of Sanction");
    if (!id || !nom || /^yes$/i.test(l.par("Record Deleted Flag")) || (l.par("Sanction Status") && !/^sanctioned$/i.test(l.par("Sanction Status")))) continue;
    const imo = lireImo(l.par("IMO Number"));
    const date = l.par("Date of Sanction");
    entrees.push({ source: "NZ", id, nom, alias: [...new Set(l.par("Alias/Alternate Names").split(/[;,]/).map((a) => a.trim()).filter((a) => a.length > 0 && a !== nom))], type: "vessel",
      programme: "Russia Sanctions Regulations 2022", ...(imo ? { imo } : {}), ...(date ? { designation: { date, champ: "Date of Sanction" } } : {}) });
  }
  return entrees;
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
  /* la date de début (« start_date ») et le propriétaire d'un navire (« vessel_owner ») : colonnes du fichier, vides pour
     la plupart des lignes du Commerce ; absentes du fichier, elles ne refusent rien, elles restent vides */
  const iDebut = t.noms.indexOf("start_date"), iProprietaire = t.noms.indexOf("vessel_owner");
  const TYPES: Record<string, EntreeListe["type"]> = { "Individual": "person", "Entity": "entity", "Vessel": "vessel" };
  return t.lignes
    .filter((l) => !(l[iSource] ?? "").includes("Treasury Department"))
    .map((l) => {
      const liste = (l[iSource] ?? "").split(" - ")[0]!.trim();
      const programmes = (l[iProg] ?? "").trim();
      const debut = iDebut === -1 ? "" : (l[iDebut] ?? "").trim();
      const nommees = iProprietaire === -1 ? [] : parties("vessel_owner", [l[iProprietaire]]);
      return { source: "CSL" as const, id: (l[iId] ?? "").trim(), nom: (l[iNom] ?? "").trim(),
        alias: (l[iAlias] ?? "").split(";").map((a) => a.trim()).filter((a) => a.length > 0),
        type: TYPES[(l[iType] ?? "").trim()] ?? "other",
        ...(liste ? { programme: programmes ? `${liste}: ${programmes}` : liste } : {}),
        ...(debut ? { designation: { date: debut, champ: "start_date" } } : {}), ...(nommees.length ? { parties: nommees } : {}) };
    })
    .filter((e) => e.nom.length > 0 && e.id.length > 0);
}

/** Un fichier de liste, texte ou octets : un classeur se lit en octets, les autres formats en texte UTF-8. */
export function analyser(format: SourceListe["format"], brut: string | Buffer, source?: EntreeListe["source"]): EntreeListe[] {
  const texte = typeof brut === "string" ? brut : brut.toString("utf8");
  const octets = typeof brut === "string" ? Buffer.from(brut, "utf8") : brut;
  const entrees = format === "ofac-sdn-xml" ? analyserOfac(texte, source === "OFAC-CONS" ? "OFAC-CONS" : "OFAC")
    : format === "un-consolidated-xml" ? analyserOnu(texte)
    : format === "trade-csl-csv" ? analyserCsl(texte)
    : format === "uk-sanctions-xml" ? analyserRoyaumeUni(texte)
    : format === "eu-833-annex-xlii-xhtml" ? analyserNaviresUe(texte)
    : format === "dfat-consolidated-xlsx" ? analyserDfat(octets)
    : format === "gac-sema-xml" ? analyserCanada(texte)
    : format === "mfat-russia-register-xlsx" ? analyserMfat(octets) : analyserUe(texte);
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
  return analyser(def.format, brut, source);
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
    const r = await fetch(s.url, { headers: { ...ENTETES, ...s.entetes }, redirect: "follow" });
    if (!r.ok) {
      /* L'UE avec le jeton générique rend 500 : le manifeste porte le fait ET l'issue. */
      const issue = s.source === "EU"
        ? "the programmatic download needs a personal EU Login token (token=[username]); "
          + "set CRUSETRA_EU_TOKEN and run --fetch again. The generic public token returned "
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
  const entrees = analyser(s.format, brut, s.source);
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
  refuserDrapeauxInconnus(["--fetch", "--only"]);
  const veutFetch = process.argv.includes("--fetch");
  /* `--only=UK,EU-VESSELS` : ne retélécharger que ces sources ; les autres gardent leur ligne du manifeste et leur
     fichier, donc leur date. Sans cela, ajouter une liste rajeunirait toutes les autres et déplacerait d'un coup
     chaque chiffre mesuré sur elles. */
  const seules = process.argv.find((a) => a.startsWith("--only="))?.slice("--only=".length).split(",").map((x) => x.trim()).filter(Boolean);
  if (seules) {
    const inconnues = seules.filter((x) => !SOURCES.some((s) => s.source === x));
    if (!veutFetch || inconnues.length > 0) {
      console.error(!veutFetch ? "--only goes with --fetch: it names the sources to download." : `--only names unknown source(s): ${inconnues.join(", ")}. Known: ${SOURCES.map((s) => s.source).join(", ")}.`);
      process.exit(2);
    }
  }

  if (veutFetch && (process.env.CRUSETRA_OFFLINE === "1" || process.env.CASCADE_OFFLINE === "1")) {
    /* Le refus nomme le drapeau ET l'issue : un refus sans issue se fait commenter. Il nomme celui que le poste a posé.
       L'ancien nom refuse exactement comme avant, même quand CRUSETRA_OFFLINE vaut autre chose que 1 : un poste isolé
       configuré avant le changement de nom ne perd jamais son refus. */
    const poses = ["CRUSETRA_OFFLINE", "CASCADE_OFFLINE"].filter((n) => process.env[n] === "1");
    const ancien = poses.includes("CASCADE_OFFLINE") ? " (CASCADE_OFFLINE is the deprecated name of CRUSETRA_OFFLINE)" : "";
    console.error(`\n${poses.map((n) => `${n}=1`).join(" and ")} ${poses.length > 1 ? "forbid" : "forbids"} the network, `
      + `and --fetch exists to use it${ancien}.`);
    console.error(`Nothing was downloaded and nothing was written.`);
    console.error(`  → run \`npm run listes\` (no flag) to see what is already on disk, or`);
    console.error(`  → unset ${poses.join(" and ")} to fetch the public lists.\n`);
    process.exit(2);
  }

  if (veutFetch) {
    console.log(`\nFetching ${seules ? `${seules.length} of the ${SOURCES.length}` : `the ${SOURCES.length}`} public lists: they download to your machine, and nothing of yours is sent.\n`);
    const lignes: LigneManifeste[] = [];
    const avant = seules ? lireManifeste() : null;
    for (const s of SOURCES) {
      if (seules && !seules.includes(s.source)) {
        const gardee = avant?.listes.find((x) => x.source === s.source);
        if (gardee) { lignes.push(gardee); console.log(`  ${s.source.padEnd(10)} kept as recorded`); }
        continue;
      }
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
