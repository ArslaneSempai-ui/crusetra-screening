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
} from "./listes.ts";

const fixture = (n: string) => readFileSync(fileURLToPath(new URL(`./fixtures/${n}`, import.meta.url)), "utf8");

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
});

test("ONU : le nom se joint sur tous ses morceaux, l'alias VIDE s'écarte, l'entité a les siens", () => {
  const e = analyserOnu(fixture("onu.xml"));
  assert.equal(e.length, 3);
  const [eric, mohamed, adf] = e;
  assert.equal(eric!.nom, "ERIC BADEGE");
  assert.deepEqual(eric!.alias, ["FRANK KAKORERE"],
    "le vrai fichier porte des <ALIAS_NAME/> vides : ils s'écartent, ils ne deviennent pas \"\"");
  assert.equal(eric!.programme, "DRC");
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
    alias: ["Mohammed Hosny Mubarak"], type: "person", programme: "EGY" });
  assert.equal(societe!.type, "entity");
  assert.equal(societe!.nom, "JSC Concern & Partners", "l'entité &amp; en attribut se décode aussi");
});

test("Royaume-Uni : le nom principal, ses variations et alias, l'alias de basse qualité marqué faible, le premier numéro OMI", () => {
  const e = analyserRoyaumeUni(fixture("royaume-uni.xml"));
  assert.equal(e.length, 3);
  const [societe, personne, navire] = e;
  assert.deepEqual(societe, { source: "UK", id: "XYZ0001", nom: "EXAMPLE MONEY EXCHANGE & SONS",
    alias: ["Example Hawala", "EMX", "مثال صرافی"], type: "entity", programme: "The Example (Sanctions) Regulations 2020", aliasFaibles: ["EMX"] });
  assert.equal(personne!.nom, "Ivan EXAMPLOV", "le « Primary name » fait le nom, quelle que soit sa casse et sa place");
  assert.deepEqual(personne!.alias, ["Ivan Ivanovich EXAMPLOV"], "Name1 à Name6 joints dans l'ordre");
  assert.equal(personne!.type, "person");
  assert.equal(navire!.type, "vessel");
  assert.equal(navire!.imo, "9074729", "« IMO9074729 » : sept chiffres, le premier des deux numéros");
});

test("UE, navires : l'annexe XLII seule, ses lignes de navire seules, un numéro OMI une seule fois", () => {
  const e = analyserNaviresUe(fixture("navires-ue.xhtml"));
  assert.deepEqual(e, [
    { source: "EU-VESSELS", id: "IMO9074729", nom: "Example Star", alias: ["EXAMPLE STAR I"], type: "vessel", programme: "833/2014 Annex XLII", imo: "9074729" },
    { source: "EU-VESSELS", id: "IMO9187629", nom: "SAMPLE & SONS II", alias: [], type: "vessel", programme: "833/2014 Annex XLII", imo: "9187629" },
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

test("les sept sources déclarées sont celles du contrat, chacune en https", () => {
  assert.deepEqual(SOURCES.map((s) => s.source).sort(), ["CSL", "EU", "EU-VESSELS", "OFAC", "OFAC-CONS", "UK", "UN"]);
  for (const s of SOURCES) assert.match(s.url, /^https:\/\//);
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
