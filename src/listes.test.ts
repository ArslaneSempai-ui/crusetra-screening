import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import {
  blocs, champ, decoderEntites, analyserOfac, analyserOnu, analyserUe, analyser,
  recouperOfac, lireManifeste, lireListe, SOURCES, type Manifeste, analyserCsl, fichierDe, analyserRoyaumeUni, analyserNaviresUe,
  analyserDfat, analyserCanada, analyserMfat, lireImo, manquesDeLicence, estClasseur,
} from "./listes.ts";

const fixture = (n: string) => readFileSync(fileURLToPath(new URL(`./fixtures/${n}`, import.meta.url)), "utf8");
const octets = (n: string) => readFileSync(fileURLToPath(new URL(`./fixtures/${n}`, import.meta.url)));

test("les aides XML : blocs successifs, champ décodé, entités numériques comprises", () => {
  assert.deepEqual(blocs("<a>1</a><b>x</b><a>2</a>", "a"), ["1", "2"]);
  assert.equal(champ("<uid>36</uid>", "uid"), "36");
  assert.equal(champ("<x>A &amp; B &#233;t&#xE9;</x>", "x"), "A & B été");
  assert.equal(decoderEntites("&lt;tag&gt; &quot;q&quot; &apos;a&apos;"), `<tag> "q" 'a'`);
  assert.equal(champ("<vide/>", "vide"), undefined, "une balise auto-fermée n'a pas de texte");
});

test("OFAC : trois entrées, trois types, les alias joints prénom+nom, le programme composé", () => {
  const e = analyserOfac(fixture("ofac.xml"));
  assert.equal(e.length, 3);
  const [ivan, societe, navire] = e;
  assert.deepEqual(ivan, { source: "OFAC", id: "36", nom: "Ivan PETROV",
    alias: ["Ivan PETROFF"], type: "person", programme: "UKRAINE-EO13662+RUSSIA-EO14024" });
  assert.equal(societe!.nom, "ANGLO-CARIBBEAN CO. & SONS, LTD.", "l'entité &amp; doit être décodée");
  assert.equal(societe!.type, "entity");
  assert.deepEqual(societe!.alias, ["AVIA IMPORT", "ACC LTD"]);
  assert.equal(navire!.type, "vessel");
  assert.deepEqual(navire!.alias, [], "pas d'akaList : des alias vides, pas une invention");
  /* les parties que la liste nomme : le propriétaire du navire, et les « Linked To » des remarques, mot pour mot */
  assert.deepEqual(navire!.parties, [{ role: "vesselOwner", nom: "Samir de Navegacion S.A." },
    { role: "Linked To", nom: "ISLAMIC REVOLUTIONARY GUARD CORPS (IRGC)-QODS FORCE" }, { role: "Linked To", nom: "HIZBALLAH" }]);
  assert.equal(ivan!.parties, undefined, "une entrée sans propriétaire ni « Linked To » n'a pas de parties, pas un tableau vide");
  assert.equal(ivan!.designation, undefined, "l'OFAC ne publie pas de date de désignation dans ce fichier : rien n'est déduit");
});

test("ONU : le nom se joint sur tous ses morceaux, l'alias VIDE s'écarte, l'entité a les siens", () => {
  const e = analyserOnu(fixture("onu.xml"));
  assert.equal(e.length, 3);
  const [eric, mohamed, adf] = e;
  assert.equal(eric!.nom, "ERIC BADEGE");
  assert.deepEqual(eric!.alias, ["FRANK KAKORERE"],
    "le vrai fichier porte des <ALIAS_NAME/> vides : ils s'écartent, ils ne deviennent pas \"\"");
  assert.equal(eric!.programme, "DRC");
  assert.deepEqual(eric!.designation, { date: "2012-12-31", champ: "LISTED_ON" }, "la date telle que la liste l'écrit, et le champ qui la porte");
  assert.equal(mohamed!.designation, undefined, "pas de LISTED_ON : pas de date");
  assert.equal(mohamed!.nom, "MOHAMED SALEM OULD BREIHMATT",
    "FIRST_NAME à FOURTH_NAME, joints dans l'ordre — la chaîne épinglée impose le compte");
  assert.equal(adf!.type, "entity");
  assert.deepEqual(adf!.alias, ["Allied Democratic Forces"]);
});

test("UE (v1.1, attributs) : premier wholeName = nom, les suivants = alias, programme lu", () => {
  const e = analyserUe(fixture("ue.xml"));
  assert.equal(e.length, 2);
  const [personne, societe] = e;
  assert.deepEqual(personne, { source: "EU", id: "13", nom: "Mohamed Hosni Elsayed Mubarak",
    alias: ["Mohammed Hosny Mubarak"], type: "person", programme: "EGY",
    designation: { date: "2011-03-03", champ: "regulation entryIntoForceDate (270/2011 (OJ L58))" } });
  assert.equal(societe!.type, "entity");
  assert.equal(societe!.nom, "JSC Concern & Partners", "l'entité &amp; en attribut se décode aussi");
});

test("Royaume-Uni : le nom principal, ses variations et alias, l'alias de basse qualité marqué faible, le premier numéro OMI", () => {
  const e = analyserRoyaumeUni(fixture("royaume-uni.xml"));
  assert.equal(e.length, 3);
  const [societe, personne, navire] = e;
  assert.deepEqual(societe, { source: "UK", id: "XYZ0001", nom: "EXAMPLE MONEY EXCHANGE & SONS",
    alias: ["Example Hawala", "EMX", "مثال صرافی"], type: "entity", programme: "The Example (Sanctions) Regulations 2020", aliasFaibles: ["EMX"],
    designation: { date: "29/06/2012", champ: "DateDesignated" } });
  assert.equal(personne!.nom, "Ivan EXAMPLOV", "le « Primary name » fait le nom, quelle que soit sa casse et sa place");
  assert.deepEqual(personne!.alias, ["Ivan Ivanovich EXAMPLOV"], "Name1 à Name6 joints dans l'ordre");
  assert.equal(personne!.type, "person");
  assert.equal(personne!.designation, undefined, "pas de DateDesignated : pas de date");
  assert.equal(navire!.type, "vessel");
  assert.equal(navire!.imo, "9074729", "« IMO9074729 » : sept chiffres");
  assert.deepEqual(navire!.autresImo, ["9187629"], "le second numéro du même navire est gardé");
  assert.deepEqual(navire!.parties, [{ role: "CurrentOwnerOperator", nom: "Global United Shipping India" }], "le propriétaire ou exploitant que la liste écrit, espaces de bord ôtées");
});

test("UE, navires : l'annexe XLII seule, ses lignes de navire seules, un numéro OMI une seule fois, la date d'application", () => {
  const e = analyserNaviresUe(fixture("navires-ue.xhtml"));
  assert.deepEqual(e, [
    { source: "EU-VESSELS", id: "IMO9074729", nom: "Example Star", alias: ["EXAMPLE STAR I"], type: "vessel", programme: "833/2014 Annex XLII", imo: "9074729", designation: { date: "25.6.2024", champ: "Date of application" } },
    { source: "EU-VESSELS", id: "IMO9187629", nom: "SAMPLE & SONS II", alias: [], type: "vessel", programme: "833/2014 Annex XLII", imo: "9187629", designation: { date: "24.4.2026", champ: "Date of application" } },
  ], "l'en-tête, la marque de modification et les annexes voisines ne sont pas des navires ; un rang sans point en est un");
  assert.throws(() => analyser("eu-833-annex-xlii-xhtml", "<html>no annex here</html>"), /does not look like eu-833-annex-xlii-xhtml/);
  assert.equal(fichierDe({ source: "EU-VESSELS", format: "eu-833-annex-xlii-xhtml" }), "eu-vessels.xhtml");
});

test("un format inattendu se refuse — zéro entrée d'une liste de sanctions n'est pas une petite liste", () => {
  assert.throws(() => analyser("ofac-sdn-xml", "<html>not a list</html>"), /does not look like ofac-sdn-xml/);
  assert.throws(() => analyser("un-consolidated-xml", ""), /not one entry/);
});

test("le recoupement OFAC : silencieux quand les comptes s'accordent, disert avec les DEUX comptes sinon", () => {
  const xml = fixture("ofac.xml");
  assert.equal(recouperOfac(xml, 3), undefined);
  const desaccord = recouperOfac(xml, 2)!;
  assert.match(desaccord, /announces 3/);
  assert.match(desaccord, /read 2/);
  assert.match(recouperOfac("<sdnList></sdnList>", 5)!, /no Record_Count/);
});

test("lireListe : manifeste absent, source indisponible, fichier changé — trois refus qui disent l'issue", () => {
  const racine = mkdtempSync(join(tmpdir(), "listes-"));
  assert.equal(lireManifeste(racine), null);
  assert.throws(() => lireListe("OFAC", racine), /no listes-manifest\.json/);

  const octets = fixture("ofac.xml");
  const manifeste: Manifeste = {
    version: 1, genereLe: new Date().toISOString(),
    listes: [
      { source: "OFAC", titre: "t", url: "u", format: "ofac-sdn-xml", disponible: true,
        telechargeLe: new Date().toISOString(),
        sha256: createHash("sha256").update(octets).digest("hex"), octets: octets.length, entrees: 3 },
      { source: "EU", titre: "t", url: "u", format: "eu-fsf-xml-1.1", disponible: false,
        verifieLe: new Date().toISOString(), erreur: "HTTP 500", issue: "set CASCADE_EU_TOKEN" },
    ],
  };
  writeFileSync(join(racine, "listes-manifest.json"), JSON.stringify(manifeste));
  mkdirSync(join(racine, "data", "listes"), { recursive: true });
  writeFileSync(join(racine, "data", "listes", "ofac.xml"), octets);

  assert.equal(lireListe("OFAC", racine).length, 3, "le chemin sain doit lire — sinon les refus ci-dessous ne prouvent rien");
  assert.throws(() => lireListe("EU", racine), (e: Error) => {
    assert.match(e.message, /unavailable: HTTP 500/);
    assert.match(e.message, /CASCADE_EU_TOKEN/, "le refus doit porter l'issue enregistrée");
    return true;
  });
  /* Le fichier changé après le manifeste : filtrer contre lui certifierait n'importe quoi. */
  writeFileSync(join(racine, "data", "listes", "ofac.xml"), octets + " ");
  assert.throws(() => lireListe("OFAC", racine), /does not match the manifest content hash/);
});

test("CASCADE_OFFLINE=1 avec --fetch : refus code 2 qui nomme le drapeau ET l'issue, rien d'écrit", () => {
  const r = spawnSync(process.execPath, [fileURLToPath(new URL("./listes.ts", import.meta.url)), "--fetch"],
    { encoding: "utf8", env: { ...process.env, CASCADE_OFFLINE: "1" }, timeout: 30_000 });
  assert.equal(r.status, 2, `code ${r.status} — sortie :\n${r.stdout}\n${r.stderr}`);
  assert.match(r.stderr, /CASCADE_OFFLINE=1/);
  assert.match(r.stderr, /--fetch/);
  assert.match(r.stderr, /Nothing was downloaded and nothing was written/);
  assert.match(r.stderr, /unset CASCADE_OFFLINE/, "un refus sans issue se fait commenter");
});

test("les dix sources déclarées sont celles du contrat, chacune en https, chacune avec sa licence lue chez l'éditeur", () => {
  assert.deepEqual(SOURCES.map((s) => s.source).sort(), ["AU", "CA", "CSL", "EU", "EU-VESSELS", "NZ", "OFAC", "OFAC-CONS", "UK", "UN"]);
  for (const s of SOURCES) assert.match(s.url, /^https:\/\//);
  assert.deepEqual(manquesDeLicence(SOURCES), []);
  /* la mention du Royaume-Uni est celle que l'Open Government Licence v3.0 impose, mot pour mot */
  assert.equal(SOURCES.find((s) => s.source === "UK")!.licence.mention, "Contains public sector information licensed under the Open Government Licence v3.0.");
  assert.equal(SOURCES.find((s) => s.source === "CA")!.licence.mention, "Contains information licensed under the Open Government Licence – Canada.");
  for (const s of SOURCES) assert.ok(![s.licence.nom, s.licence.mention ?? "", s.licence.note].some((t) => t.includes("—")), `${s.source} : pas de cadratin dans ce que le relevé imprime`);
  /* la page de l'éditeur, jamais celle d'un tiers */
  for (const s of SOURCES) assert.ok(!/hullcipher/i.test(s.licence.url) && !/hullcipher/i.test(s.licence.note), `${s.source} : la licence se lit chez l'éditeur`);
});

test("témoin : une source sans sa licence, sans sa page, sans sa mention ou sans sa date fait rougir le contrôle, en la nommant", () => {
  const uk = SOURCES.find((s) => s.source === "UK")!;
  const sans = (quoi: Partial<typeof uk.licence> | null) => manquesDeLicence([quoi === null ? { source: "UK", titre: uk.titre, url: uk.url, format: uk.format } : { ...uk, licence: { ...uk.licence, ...quoi } }]);
  assert.deepEqual(sans(null), ["UK: no licence recorded"]);
  assert.deepEqual(sans({ nom: " " }), ["UK: the licence has no name"]);
  assert.deepEqual(sans({ url: "http://example.org/x" }), ["UK: the licence has no https publisher page"]);
  assert.deepEqual(sans({ mention: "" }), ["UK: the attribution is neither a text nor null"]);
  assert.deepEqual(sans({ mention: null, note: "" }), ["UK: no attribution is required, and the note does not say where the publisher says so"]);
  assert.deepEqual(sans({ lue: "yesterday" }), ["UK: the day the publisher's page was read is missing"]);
  assert.deepEqual(sans({}), [], "la source complète passe, sinon les rouges ci-dessus ne prouvent rien");
});

test("lireImo : la lecture du criblage, partagée avec les listes qui écrivent un numéro OMI", () => {
  assert.equal(lireImo("IMO 9187629"), "9187629");
  assert.equal(lireImo(" imo9187629 "), "9187629");
  assert.equal(lireImo("9187629"), "9187629");
  assert.equal(lireImo("مجتبی خامنه‌ای"), undefined, "le champ OMI décalé du fichier canadien n'est pas un numéro");
  assert.equal(lireImo(undefined), undefined);
  assert.equal(estClasseur("dfat-consolidated-xlsx"), true);
  assert.equal(estClasseur("gac-sema-xml"), false);
  assert.equal(fichierDe({ source: "AU", format: "dfat-consolidated-xlsx" }), "au.xlsx");
  assert.equal(fichierDe({ source: "NZ", format: "mfat-russia-register-xlsx" }), "nz.xlsx");
  assert.equal(fichierDe({ source: "CA", format: "gac-sema-xml" }), "ca.xml");
});

test("Australie (DFAT) : les lignes d'une référence font une entrée, le nom principal, les alias forts et faibles, l'écriture d'origine, le numéro OMI et la date écrite", () => {
  const e = analyserDfat(octets("dfat.xlsx"));
  assert.equal(e.length, 3, "trois références (2, 8227, 155) pour seize lignes");
  const [akhund, navire, alqaida] = e;
  assert.deepEqual(akhund, { source: "AU", id: "2", nom: "MOHAMMAD HASSAN AKHUND", alias: ["محمد حسن أخوند"], type: "person", programme: "1988 (Taliban)",
    designation: { date: "25 January 2001", champ: "Listing Information" } }, "la date de « Listed on 25 January 2001 », pas le Control Date (dernière mise à jour)");
  assert.deepEqual(navire, { source: "AU", id: "8227", nom: "ANDAMAN SKIES", alias: [], type: "vessel", programme: "Autonomous (Vessels)", imo: "9288693" },
    "un navire autonome : son numéro OMI lu par lireImo, et pas de date puisque la liste n'en écrit pas en toutes lettres");
  assert.equal(alqaida!.type, "entity");
  assert.equal(alqaida!.alias.length, 11, "l'écriture d'origine et dix alias");
  assert.deepEqual(alqaida!.aliasFaibles, ['"The Base"'], "l'alias « Weak » est faible, les « Strong » ne le sont pas");
  assert.ok(alqaida!.alias.includes("Al Qaeda") && alqaida!.alias.includes("القاعدة"));
  assert.equal(alqaida!.designation!.date, "6 Oct. 2001", "« Listed by UN 1267 Committee on 6 Oct. 2001 »");
  assert.equal(analyser("dfat-consolidated-xlsx", octets("dfat.xlsx")).length, 3, "le format se lit en octets par `analyser`");
});

test("Canada : une personne et ses alias nettoyés, une entité, un navire à son numéro OMI, un champ OMI décalé qui reste une personne, un prénom seul", () => {
  const e = analyserCanada(fixture("canada.xml"));
  assert.equal(e.length, 5);
  const [personne, entite, navire, decale, prenomSeul] = e;
  assert.equal(personne!.nom, "Ruslan Khikmetavich MASHADZIYEU", "GivenName puis LastName");
  assert.equal(personne!.type, "person");
  assert.ok(personne!.alias.includes("Руслан Хiкметовiч МАШАДЗЕЎ"), "l'étiquette « Belarusian: » est retirée");
  assert.ok(personne!.alias.includes("Ruslan Khikmetavich MASHADZEOU"));
  assert.deepEqual(personne!.designation, { date: "2024-04-12", champ: "DateOfListing" });
  assert.equal(personne!.programme, "Belarus", "la partie anglaise du champ bilingue");
  assert.equal(personne!.id, "Belarus|1, Part 1|99");
  assert.equal(entite!.type, "entity");
  assert.equal(entite!.nom, "ALEVKURP OJSC");
  assert.deepEqual(navire, { source: "CA", id: "Russia|1.1|1", nom: "Balitiyskiy III", alias: [], type: "vessel", programme: "Russia", imo: "7612448", designation: { date: "2025-02-21", champ: "DateOfListing" } });
  assert.equal(decale!.type, "person");
  assert.equal(decale!.imo, undefined, "un nom en écriture arabe dans le champ OMI n'est pas un numéro : la personne reste une personne sans numéro");
  assert.equal(prenomSeul!.nom, "Than Shwe");
  assert.equal(prenomSeul!.type, "person");
});

test("Nouvelle-Zélande (MFAT) : le registre sous sa légende, les personnes, entités et banques, un actif, la ligne Total écartée ; les navires avec leur numéro OMI, le supprimé écarté", () => {
  const e = analyserMfat(octets("mfat.xlsx"));
  const registre = e.filter((x) => x.type !== "vessel"), navires = e.filter((x) => x.type === "vessel");
  assert.deepEqual(registre.map((x) => x.id), ["IND-1", "ENT-1", "IND-1200", "AST-1", "BAN-1"], "la ligne « Total » n'est pas une entrée");
  const [putin, entite, chaika, actif, banque] = registre;
  assert.equal(putin!.nom, "Vladimir Vladimirovich Putin");
  assert.deepEqual(putin!.designation, { date: "2022-03-18", champ: "Date of Sanction" }, "un numéro de série Excel rendu en date");
  assert.equal(entite!.nom, "JSC 558 Aircraft Repair Plant");
  assert.deepEqual(entite!.alias, ["JSC 558 ARP"]);
  assert.equal(entite!.type, "entity");
  assert.deepEqual(chaika!.parties, [{ role: "Associates/Relatives", nom: "Son of Yury CHAIKA" }], "la partie que le registre nomme, mot pour mot");
  assert.equal(actif!.type, "other");
  assert.equal(banque!.type, "entity");
  assert.deepEqual(navires.map((x) => [x.id, x.nom, x.imo, x.alias, x.designation?.date]), [["SHP-1", "Andaman Skies", "9288693", ["Mirador"], "2025-06-19"], ["SHP-2", "Udaya", "9288746", ["Pluton"], "2025-06-19"]],
    "le troisième navire porte le drapeau de suppression : il n'entre pas");
  assert.ok(e.every((x) => x.programme === "Russia Sanctions Regulations 2022"));
});

test("CSL : les lignes du Trésor écartées, les alias coupés au point-virgule, la liste d'origine gardée", () => {
  const e = analyserCsl(readFileSync(new URL("./fixtures/csl.csv", import.meta.url), "utf8"));
  /* Quatre vraies lignes du fichier du 27/09 : une SDN (doit partir, le fichier OFAC la porte
     déjà), une Entity List à deux alias, une Denied Persons, une ITAR Debarred. */
  assert.equal(e.length, 3, "la ligne SDN doit être écartée : comptée deux fois, elle ferait deux alertes");
  assert.ok(e.every((x) => x.source === "CSL" && x.id.length > 0));
  const el = e.find((x) => x.nom === "Ibrahim Haqqani")!;
  assert.deepEqual(el.alias, ["Hajji Sahib", "Maulawi Haji Ibrahim Haqqani"]);
  assert.equal(el.programme, "Entity List (EL)");
  assert.equal(el.type, "other", "le Commerce ne dit pas le type : « other », pas une supposition");
  assert.deepEqual(el.designation, { date: "2012-04-27", champ: "start_date" }, "la colonne start_date, telle quelle");
  assert.equal(e.find((x) => x.nom.startsWith("A & C"))!.designation, undefined, "start_date vide : pas de date, et le criblage le dira");
  assert.ok(e.some((x) => x.programme === "Denied Persons List (DPL)"));
  assert.ok(e.some((x) => x.programme === "ITAR Debarred (DTC)"));
});

test("CSL : une colonne disparue se nomme, elle ne rend pas une liste vide", () => {
  assert.throws(() => analyserCsl("_id,source,type,programs,nom,alt_names\n1,x,,,a,\n"), /no "name" column/);
});

test("OFAC consolidée : même schéma que la SDN, mais étiquetée à sa source", () => {
  const xml = readFileSync(new URL("./fixtures/ofac.xml", import.meta.url), "utf8");
  assert.ok(analyser("ofac-sdn-xml", xml, "OFAC-CONS").every((x) => x.source === "OFAC-CONS"));
  assert.ok(analyser("ofac-sdn-xml", xml).every((x) => x.source === "OFAC"));
});

test("fichierDe : l'extension suit le format", () => {
  assert.equal(fichierDe({ source: "CSL", format: "trade-csl-csv" }), "csl.csv");
  assert.equal(fichierDe({ source: "OFAC-CONS", format: "ofac-sdn-xml" }), "ofac-cons.xml");
});
