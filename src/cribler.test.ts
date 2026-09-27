import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Index, cribler, lireContreparties, imoValide, lireImo, comparer, versCsv, type Contrepartie, type Criblage } from "./cribler.ts";
import { empreinteDuReleve } from "./empreinte.ts";
import { frequencesDe, preparerNom, CHEMINS_APPRENTISSAGE } from "./entites.ts";
import type { EntreeListe } from "./listes.ts";

/* Une « liste » fabriquée avec les noms des jeux d'apprentissage : le témoin tourne sur
   toute machine, sans data/ (les vraies listes ne sont pas committées). */
const paires = CHEMINS_APPRENTISSAGE.flatMap((u) => JSON.parse(readFileSync(u, "utf8")).paires as { a: string; b: string }[]);
const entrees: EntreeListe[] = paires.map((x, i) => ({ source: "OFAC", id: String(1000 + i), nom: x.b, alias: [], type: "entity" }));
const f = frequencesDe(entrees.map((e) => [e.nom, ...e.alias]));
const seuils = { fort: 0.81, possible: 0.74 };

/* Des perturbations déterministes : faute, coupe à 35, mots collés, ordre inversé, mot abrégé
   d'un point. Un générateur à graine : le même témoin rougit ou verdit à chaque fois. */
function perturbations(n: number): Contrepartie[] {
  let g = 11;
  const alea = () => (g = (g * 1103515245 + 12345) % 2147483648) / 2147483648;
  return Array.from({ length: n }, (_, i) => {
    let nom = paires[Math.floor(alea() * paires.length)]!.b;
    switch (i % 6) {
      case 0: if (nom.length > 4) { const p = 1 + Math.floor(alea() * (nom.length - 2)); nom = nom.slice(0, p) + nom.slice(p + 1); } break;
      case 1: nom = (nom + " International Trading and Shipping Company").slice(0, 35); break;
      case 2: nom = nom.replace(" ", ""); break;
      case 3: nom = nom.split(" ").reverse().join(" "); break;
      case 4: nom = nom.split(" ").map((w, j) => (j === 1 && w.length > 6 ? w.slice(0, 4) + "." : w)).join(" "); break;
      case 5: nom = nom + [" (PANAMA FLAG)", ", Singapore Branch", " f/k/a Harbor Line Ltd", " (in liquidation)", " P.O. Box 4471 Mombasa"][i % 5]!; break;
    }
    return { ligne: i + 2, nom };
  });
}

test("l'index ne perd rien : mêmes candidats, mêmes scores que la comparaison exhaustive", () => {
  const index = new Index(f, entrees, seuils.possible);
  /* toutes les paires font dix minutes (3 720 requêtes contre 3 540 noms, mesuré le 28/09) : la suite prend une
     paire sur douze, déterministe ; TEMOIN_COMPLET=1 les prend toutes (le chef, une fois par tour, à la fusion) */
  const pas = process.env.TEMOIN_COMPLET ? 1 : 12;
  const requetes: Contrepartie[] = [...paires.filter((_, i) => i % pas === 0).map((x, i) => ({ ligne: i + 2, nom: x.a })), ...perturbations(180)];
  let trouves = 0;
  for (const c of requetes) {
    const rapide = cribler(c, index, seuils), exhaustif = cribler(c, index, seuils, true);
    assert.deepEqual(rapide, exhaustif, c.nom);
    if (rapide.statut !== "no-match") trouves++;
  }
  assert.ok(trouves > requetes.length / 2, "un témoin où rien ne passe le seuil ne prouverait rien");
});

test("le numéro OMI : chiffre de contrôle, lecture tolérante, et il tranche", () => {
  assert.equal(imoValide("9187629"), true);
  assert.equal(imoValide("9187628"), false);
  assert.equal(lireImo("IMO 9187629"), "9187629");
  assert.equal(lireImo("imo9187629"), "9187629");
  assert.equal(lireImo("91876"), undefined);
  const e: EntreeListe[] = [
    { source: "OFAC", id: "1", nom: "OCEAN PEARL", alias: [], type: "vessel", imo: "9187629" },
    { source: "OFAC", id: "2", nom: "SEA FALCON", alias: [], type: "vessel", imo: "9187631" },
  ];
  const ix = new Index(frequencesDe(e.map((x) => [x.nom])), e, 0.74);
  const parImo = cribler({ ligne: 2, nom: "Blue Star", imo: "9187631" }, ix, seuils);
  assert.equal(parImo.statut, "strong");
  assert.equal(parImo.candidats[0]!.par, "imo", "un nom sans rapport, mais le numéro OMI d'un navire listé");
  const ecarte = cribler({ ligne: 3, nom: "MV Ocean Pearl", imo: "9234567" }, ix, seuils);
  assert.equal(ecarte.statut, "no-match");
  assert.deepEqual(ecarte.ecartesParImo, [{ nomListe: "OCEAN PEARL", imo: "9187629" }], "écarté, mais nommé : écarté n'est pas caché");
});

test("l'index retrouve à lui seul le pluriel anglais et la lecture cantonaise d'un nom en sinogrammes", () => {
  const e: EntreeListe[] = [
    { source: "OFAC", id: "1", nom: "Luen Shing Recycling Metals Limited", alias: [], type: "entity" },
    { source: "OFAC", id: "2", nom: "永成集團控股有限公司", alias: [], type: "entity" },
  ];
  const fx = frequencesDe(e.map((x) => [x.nom]));
  const ix = new Index(fx, e, 0.74);
  for (const [nom, k] of [["Metal Recycling", 0], ["Wing Shing Group Holdings Limited", 1]] as const) {
    assert.ok(ix.candidats(preparerNom(fx, nom), nom).includes(k), `${nom} doit retrouver « ${e[k]!.nom} »`);
  }
  for (const nom of ["Luen Shing Metal Recycling Ltd", "Wing Shing Group Holdings Limited", "聯成廢金屬回收有限公司"]) {
    const rapide = cribler({ ligne: 2, nom }, ix, seuils), exhaustif = cribler({ ligne: 2, nom }, ix, seuils, true);
    assert.deepEqual(rapide, exhaustif, nom);
    assert.notEqual(rapide.statut, "no-match", nom);
  }
});

test("regroupement, alias faible, et niveau fort ou possible", () => {
  const e: EntreeListe[] = [
    { source: "CSL", id: "a1", nom: "IKCO Trading GmbH", alias: [], type: "other", programme: "Entity List (EL)" },
    { source: "CSL", id: "a2", nom: "IKCO Trading GmbH", alias: [], type: "other", programme: "Entity List (EL)" },
    { source: "OFAC", id: "b1", nom: "NORTHERN STAR SHIPPING", alias: ["STAR TRADING"], aliasFaibles: ["STAR TRADING"], type: "entity" },
  ];
  const ix = new Index(frequencesDe(e.map((x) => [x.nom, ...x.alias])), e, 0.74);
  const r = cribler({ ligne: 2, nom: "IKCO Trading GmbH" }, ix, seuils);
  assert.equal(r.candidats.length, 1, "une société listée deux fois (deux adresses) ne fait pas deux alertes");
  assert.deepEqual(r.candidats[0]!.ids, ["a1", "a2"]);
  const faible = cribler({ ligne: 3, nom: "Star Trading" }, ix, seuils);
  assert.equal(faible.candidats[0]!.aliasFaible, true, "le relecteur doit savoir que l'OFAC juge cet alias trop générique");
  assert.equal(cribler({ ligne: 4, nom: "Harbor Point Logistics" }, ix, seuils).statut, "no-match");
});

test("le fichier du client : la colonne name est exigée, et un refus dit quoi faire", () => {
  assert.throws(() => lireContreparties("ref,nom\n1,x\n"), /no "name" column[\s\S]*Nothing was screened/);
  assert.throws(() => lireContreparties("name,ref\n,1\n"), /no name in it/);
  const { lignes, avertissements } = lireContreparties("Name,IMO\nOcean Pearl,IMO 9187629\nSea Falcon,12\n,9187631\n");
  assert.equal(lignes[0]!.imo, "9187629");
  assert.equal(lignes[1]!.imo, undefined);
  assert.ok(avertissements.some((a) => /IMO value/.test(a)));
  assert.ok(avertissements.some((a) => /empty name/.test(a)));
});

test("un navire que la liste dit navire entre en conflit avec une forme de société", () => {
  const e: EntreeListe[] = [{ source: "OFAC", id: "v1", nom: "DORE", alias: ["DAVAR"], type: "vessel" }];
  const ix = new Index(frequencesDe(e.map((x) => [x.nom, ...x.alias])), e, 0.74);
  assert.equal(cribler({ ligne: 2, nom: "Davar Shipping Co. Limited" }, ix, seuils).statut, "no-match",
    "mesuré le 27/09 sur l'exemple : 0,795 avant la règle");
  assert.equal(cribler({ ligne: 3, nom: "MV Davar" }, ix, seuils).statut, "strong");
});

function releveMinimal(resultats: Criblage["resultats"], sha = "aaa"): Criblage {
  const c = {
    version: 1, genre: "cascade-screening/counterparty-screening", emisLe: "2026-09-20T00:00:00.000Z",
    fichier: { nom: "c.csv", sha256: "x", lignes: resultats.length },
    listes: [{ source: "OFAC", titre: "OFAC", url: "u", telechargeLe: "2026-09-20T00:00:00Z", sha256: sha, entrees: 1 }],
    nonCriblees: [], methode: {} as Criblage["methode"],
    totaux: { lignes: resultats.length, forts: 0, possibles: 0, sansCorrespondance: 0 }, resultats, reserves: [],
  } as Criblage;
  c.empreinte = empreinteDuReleve(c);
  return c;
}
const cand = (id: string, nom: string) => ({ source: "OFAC" as const, ids: [id], nomListe: nom, type: "entity" as const, score: 1, par: "name" as const });
const res = (ref: string, nom: string, candidats: ReturnType<typeof cand>[]) =>
  ({ ligne: 2, ref, nom, statut: candidats.length ? "strong" as const : "no-match" as const, candidats, autres: 0, ecartesParImo: [] });

test("le re-criblage : nouveaux candidats, disparus, contreparties ajoutées et retirées, listes mises à jour", () => {
  const avant = releveMinimal([res("C1", "Alpha", []), res("C2", "Beta", [cand("9", "BETA LTD")]), res("C3", "Gamma", [])], "aaa");
  const apres = releveMinimal([res("C1", "Alpha", [cand("7", "ALPHA CO")]), res("C2", "Beta", []), res("C4", "Delta", [])], "bbb");
  const ch = comparer(avant, apres);
  assert.deepEqual(ch.nouveauxCandidats.map((x) => [x.ref, x.candidat.ids[0]]), [["C1", "7"]]);
  assert.deepEqual(ch.candidatsDisparus.map((x) => [x.ref, x.candidat.ids[0]]), [["C2", "9"]]);
  assert.deepEqual(ch.contrepartiesAjoutees, [{ ref: "C4", nom: "Delta" }]);
  assert.deepEqual(ch.contrepartiesRetirees, [{ ref: "C3", nom: "Gamma" }]);
  assert.deepEqual(ch.listesMisesAJour.map((l) => l.source), ["OFAC"]);
});

test("le re-criblage refuse un relevé précédent retouché", () => {
  const avant = releveMinimal([res("C1", "Alpha", [])]);
  const retouche = { ...avant, totaux: { ...avant.totaux, lignes: 9 } };
  assert.throws(() => comparer(retouche, avant), /edited after screening[\s\S]*Nothing was screened/);
});

test("l'export tableur : une ligne par candidat, et aucune formule exécutable", () => {
  const c = releveMinimal([res("=1+2", "Acme, Inc", [cand("7", "ACME")]), res("C2", "@SUM(A1)", [])]);
  const csv = versCsv(c);
  const lignes = csv.trim().split("\n");
  assert.equal(lignes.length, 3);
  assert.ok(lignes[1]!.startsWith("'=1+2,"), "une cellule qui commence par = est neutralisée");
  assert.ok(lignes[1]!.includes('"Acme, Inc"'), "une virgule se cite");
  assert.ok(lignes[2]!.includes("'@SUM(A1)"));
});

test("tour 5 : l'index retrouve à lui seul le 1 lu optiquement, la civilité soudée dans les deux sens, et la faute d'un clavardage", () => {
  const e: EntreeListe[] = [
    { source: "OFAC", id: "1", nom: "Kemuning", alias: [], type: "vessel" },
    { source: "OFAC", id: "2", nom: "Sri Pelangi", alias: [], type: "entity" },
    { source: "OFAC", id: "3", nom: "Shreeganesh", alias: [], type: "entity" },
    { source: "OFAC", id: "4", nom: "Seng Alpha", alias: [], type: "entity" },
  ];
  const fx = frequencesDe(e.map((x) => [x.nom]));
  const ix = new Index(fx, e, 0.74);
  /* chaque requête ne partage avec sa chaîne listée que le mot que la règle nouvelle relie */
  for (const [nom, k] of [["KEMUN1NG", 0], ["sripelangi", 1], ["Shree Ganesh", 2], ["Send Beta", 3]] as const) {
    assert.ok(ix.candidats(preparerNom(fx, nom), nom).includes(k), `${nom} doit retrouver « ${e[k]!.nom} »`);
  }
  for (const nom of ["KEMUN1NG", "sripelangi", "Shree Ganesh"]) {
    const rapide = cribler({ ligne: 2, nom }, ix, seuils), exhaustif = cribler({ ligne: 2, nom }, ix, seuils, true);
    assert.deepEqual(rapide, exhaustif, nom);
    assert.notEqual(rapide.statut, "no-match", nom);
  }
});

test("tour 5 : un nom thaï cherche ses mots par la clé consonantique, dans les deux sens", () => {
  /* « รุ่งโรจน์ » se lit rungrot, « Rungroj » s'écrit avec un j : à une lettre près sur sept, sous
     la similarité que le seuil exige d'un mot (simMinimale), et seule la clé consonantique (mode
     thaï) les rapproche ; l'index doit la connaître dans les deux sens, nom thaï listé ou demandé */
  const liste: EntreeListe[] = [
    { source: "OFAC", id: "1", nom: "MV Rungroj", alias: [], type: "vessel" },
    { source: "OFAC", id: "2", nom: "เรือ รุ่งโรจน์", alias: [], type: "vessel" },
  ];
  const ix = new Index(frequencesDe(liste.map((x) => [x.nom])), liste, seuils.possible);
  for (const nom of ["เรือ รุ่งโรจน์", "MV Rungroj"]) {
    const rapide = cribler({ ligne: 2, nom }, ix, seuils), exhaustif = cribler({ ligne: 2, nom }, ix, seuils, true);
    assert.deepEqual(rapide, exhaustif, nom);
    assert.equal(rapide.statut, "strong", nom);
    assert.equal(rapide.candidats.length, 2, `${nom} : la chaîne thaïe et la latine`);
  }
});

test("tour 6 : l'index range au possible l'ancien nom des deux côtés, la succursale face au siège, deux numéros de registre", () => {
  const e: EntreeListe[] = [
    { source: "OFAC", id: "n1", nom: "MV Onne Pelican (ex Warri Osprey, 2006)", alias: [], type: "vessel" },
    { source: "OFAC", id: "s1", nom: "Hamburg Handelsbank AG, Hauptsitz", alias: [], type: "entity" },
    { source: "OFAC", id: "r1", nom: "Adeyemi Agro Commodities Nigeria Limited (RC 918532)", alias: [], type: "entity" },
  ];
  const ix = new Index(frequencesDe(e.map((x) => [x.nom, ...x.alias])), e, 0.74);
  const statut = (nom: string) => cribler({ ligne: 2, nom }, ix, seuils).statut;
  assert.equal(statut("MV Apapa Falcon (ex Warri Osprey, 2020)"), "possible", "l'ancien nom des deux côtés");
  assert.equal(statut("MV Warri Osprey"), "strong", "l'ancien nom d'un seul côté est la même coque");
  assert.equal(statut("Hamburg Handelsbank AG, Speicherstadt Branch"), "possible");
  assert.equal(statut("Hamburg Handelsbank AG"), "strong", "le siège est la personne morale");
  assert.equal(statut("Adeyemi Agro Commodities Nigeria Limited (RC 884213)"), "possible", "deux dépôts");
  assert.equal(statut("Adeyemi Agro Commodities"), "strong", "le nom commercial sans forme");
});

test("tour 6, registres : l'index retrouve à lui seul le composé allemand dans les deux sens et le gérondif anglais", () => {
  const e: EntreeListe[] = [
    { source: "OFAC", id: "1", nom: "Rheinstahl Stahlrohr GmbH", alias: [], type: "entity" },
    { source: "OFAC", id: "2", nom: "Jansen Metaal B.V.", alias: [], type: "entity" },
    { source: "OFAC", id: "3", nom: "Botha Trade Beta", alias: [], type: "entity" },
    { source: "OFAC", id: "4", nom: "De Groot Machines B.V.", alias: [], type: "entity" },
  ];
  const fx = frequencesDe(e.map((x) => [x.nom]));
  const ix = new Index(fx, e, 0.74);
  /* chaque requête ne partage avec sa chaîne listée que le mot que la règle nouvelle relie : le composé qui
     finit par le mot demandé (« rohr »), celui qui commence par lui (« metaal »), le mot demandé lui-même
     composé d'un mot listé au pluriel (« machines »), et le gérondif (« trading », « trade ») */
  for (const [nom, k] of [["Rohr GmbH", 0], ["Metaalhandel B.V.", 1], ["Trading Alpha", 2], ["Machinehandel B.V.", 3]] as const) {
    assert.ok(ix.candidats(preparerNom(fx, nom), nom).includes(k), `${nom} doit retrouver « ${e[k]!.nom} »`);
  }
  for (const nom of ["Rheinstahl Rohr GmbH", "Gelderse Jansen Metaalhandel B.V.", "Botha Trading Beta", "De Groot Machinehandel B.V."]) {
    const rapide = cribler({ ligne: 2, nom }, ix, seuils), exhaustif = cribler({ ligne: 2, nom }, ix, seuils, true);
    assert.deepEqual(rapide, exhaustif, nom);
    assert.notEqual(rapide.statut, "no-match", nom);
  }
});

test("tour 7 : l'index retrouve à lui seul les deux romanisations du japonais et du coréen, dans les deux sens de la marque", () => {
  const e: EntreeListe[] = [
    { source: "OFAC", id: "1", nom: "Fujimoto Sangyo Co., Ltd.", alias: [], type: "entity" },
    { source: "OFAC", id: "2", nom: "Nambu Tekko Co., Ltd.", alias: [], type: "entity" },
    { source: "OFAC", id: "3", nom: "Hanguk Cheonghae Co., Ltd.", alias: [], type: "entity" },
    { source: "OFAC", id: "4", nom: "Shinwa Alpha Co., Ltd.", alias: [], type: "entity" },
  ];
  const fx = frequencesDe(e.map((x) => [x.nom]));
  const ix = new Index(fx, e, 0.74);
  /* chaque requête ne partage avec sa chaîne listée que le mot que le pli relie : la requête marquée face à une chaîne
     marquée (1), la requête sans marque face à une chaîne marquée (2 : « Nanbu Alpha », le pli natif), le coréen (3),
     et la requête marquée face à une chaîne sans marque (4 : « Sinwa » sous la marque de K.K.) */
  for (const [nom, k] of [["Huzimoto Sangyou K.K.", 0], ["Nanbu Alpha Co., Ltd.", 1], ["Hanguk Chunghae Co., Ltd.", 2], ["Sinwa Alpha K.K.", 3]] as const) {
    assert.ok(ix.candidats(preparerNom(fx, nom), nom).includes(k), `${nom} doit retrouver « ${e[k]!.nom} »`);
  }
  for (const nom of ["Huzimoto Sangyou K.K.", "Kabushiki Kaisha Nanbu Tekkō", "Hanguk Chunghae Co., Ltd.", "Sinwa Alpha K.K."]) {
    const rapide = cribler({ ligne: 2, nom }, ix, seuils), exhaustif = cribler({ ligne: 2, nom }, ix, seuils, true);
    assert.deepEqual(rapide, exhaustif, nom);
    assert.notEqual(rapide.statut, "no-match", nom);
  }
});
