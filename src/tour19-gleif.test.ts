/**
 * TOUR 19, LE REGISTRE RÉEL : les règles générales que l'échantillon d'apprentissage GLEIF (src/paires-gleif-apprentissage.json)
 * a montré manquantes, chacune avec sa garde. Le pinyin écrit syllabe par syllabe lu comme ses caractères, et seulement face à
 * eux ; les sigles latins épelés dans une autre écriture ; les formes du Golfe écrites en arabe ; la clé d'emprunt des mots
 * anglais prononcés en cyrillique, en grec, en kana, en hangul et en thaï ; les formes juridiques par juridiction et l'état de
 * la société ; et l'index, qui ne perd rien au seuil possible que la nouvelle règle choisit. Les noms sont inventés.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { scoreNoms, variantes, clesEmprunt, preparerNom, CHEMIN_APPRENTISSAGE_REEL, STRATE_CONTENUE } from "./entites.ts";
import { pinyinSyllabique, siglesEpeles, LETTRES_EPELEES_CYRILLIQUES, romaniser } from "./ecritures.ts";
import { Index, cribler, type Contrepartie } from "./cribler.ts";
import { frequencesDe } from "./entites.ts";
import { frequencesDesListes } from "./frequences.ts";
import type { EntreeListe } from "./listes.ts";

const f = frequencesDesListes();
const score = (a: string, b: string) => scoreNoms(f, a, b);
const FORT = 0.81;

test("tour 19 : le pinyin syllabe par syllabe se lit comme les caractères, et ne se compare qu'à eux", () => {
  assert.equal(pinyinSyllabique("hang zhou bai lin tou zi fa zhan you xian gong si"), "hangzhoubailin investment development youxian gongsi");
  assert.equal(pinyinSyllabique("xiang gang ming feng (zhong guo) ke ji you xian gong si"), "hongkong mingfeng (china) technology youxian gongsi");
  /* trois syllabes, ou un mot qui n'est pas une syllabe : pas de lecture */
  assert.equal(pinyinSyllabique("Shun Yi Fa"), undefined);
  assert.equal(pinyinSyllabique("Hong Da Shipping Co Ltd"), undefined);
  assert.ok(score("杭州百林投资发展有限公司", "hang zhou bai lin tou zi fa zhan you xian gong si") >= FORT);
  /* la garde : deux coques écrites syllabe par syllabe ne se comparent pas soudées (0,846 quand la lecture valait partout) */
  assert.ok(score("Chun Feng Hao", "Chun Feng Er Hao") < FORT);
});

test("tour 19 : les sigles latins épelés en arabe, en cyrillique, en kana, en hangul et en thaï", () => {
  assert.match(romaniser("في ار ستيل م.د.م.س").texte, /(?<![a-z])vr(?![a-z])/);
  assert.match(romaniser("ويف دي بي ال تي دي").texte, /(?<![a-z])db\s+ltd(?![a-z])/, "la forme épelée se détache du sigle");
  assert.equal(siglesEpeles("АЙ ДЖИ КОНСУЛТИНГ", LETTRES_EPELEES_CYRILLIQUES, /^[Ѐ-ӿ]+$/u, (m) => m.toLowerCase()).replace(/\s+/g, " ").trim(), "ig КОНСУЛТИНГ");
  assert.match(romaniser("エヌビービーポルトリース株式会社").texte, /(?<![a-z])nbb(?![a-z])/);
  assert.match(romaniser("주식회사 에스엔글로벌").texte, /(?<![a-z])sn\s+global(?![a-z])/);
  assert.match(romaniser("บริษัท เอดีเอ็ม จำกัด").texte, /(?<![a-z])adm(?![a-z])/);
  /* un nom de lettre seul reste un mot : « في » est aussi « dans », « 디지털 » est digital, pas D */
  assert.doesNotMatch(romaniser("شركة في الخليج").texte, /(?<![a-z])v(?![a-z])/);
  assert.doesNotMatch(romaniser("디지털").texte, /(?<![a-z])d(?![a-z])/);
  assert.ok(score("Публичное акционерное общество \"ЭсЭфКей\"", "Public Joint Stock Company \"SFK\"") >= FORT);
});

test("tour 19 : les formes du Golfe écrites en arabe, épelées sans point ou en toutes lettres", () => {
  const p = preparerNom(f, "اريدا - ش م ح");
  assert.deepEqual(p.marques.designations, ["fzco"]);
  assert.deepEqual(preparerNom(f, "بلوم ستار منطقة حرة-ذ.م.م").marques.designations, ["fzllc"]);
  assert.deepEqual(preparerNom(f, "بلوم ستار م.د.م.س").marques.designations, ["dmcc"]);
  assert.ok(score("اريدا - ش م ح", "ARIDA - FZCO") >= FORT);
});

test("tour 19 : la clé d'emprunt rapproche le mot anglais prononcé, sous son mode, et jamais deux noms latins", () => {
  assert.ok(clesEmprunt("synergy", "r").some((k) => clesEmprunt("sinerdzhi", "r").includes(k)));
  assert.ok(clesEmprunt("swallowtail", "n").some((k) => clesEmprunt("suwarooteiru", "n").includes(k)));
  assert.ok(clesEmprunt("market", "n").some((k) => clesEmprunt("maaketto", "n").includes(k)));
  /* sous le mode « r », le r anglais s'écrit, et l et r restent deux lettres */
  assert.ok(!clesEmprunt("market", "r").some((k) => clesEmprunt("maaketto", "r").includes(k)));
  assert.ok(score("Синерджи Кепитъл", "Synergy Capital Ltd") >= FORT);
  assert.ok(score("スワローテイル株式会社", "Swallowtail Co., Ltd.") >= FORT);
  /* deux noms latins ne passent jamais par la clé : « Steel » et « Style » restent deux mots */
  assert.ok(score("Nordvik Steel AS", "Nordvik Style AS") < FORT);
});

test("tour 19 : les formes par juridiction, le qualificatif d'associé unique, et l'état de la société", () => {
  assert.ok(score("Brennholz Kontor Sagl", "Brennholz Kontor GmbH") >= FORT, "la Sagl tessinoise est la GmbH");
  assert.ok(score("Lindevang Invest ApS", "Lindevang Invest IVS") >= FORT);
  assert.ok(score("ΚΑΛΛΙΣΤΗ ΜΟΝΟΠΡΟΣΩΠΗ Ι.Κ.Ε.", "KALLISTI P.C.") >= FORT);
  assert.ok(score("Brodomerkur društvo s ograničenom odgovornošću", "Brodomerkur d.o.o.") >= FORT);
  assert.ok(variantes("Novak Stavby s.r.o. \"v likvidaci\"").includes("Novak Stavby s.r.o."));
  assert.ok(variantes("Fjordlys Holding ApS UNDER STIFTELSE").includes("Fjordlys Holding ApS"));
  /* les gardes : l'associé commandité n'est pas la société en commandite ; la coopérative n'est pas la Srl */
  assert.ok(score("Harrowgate Capital Partners LP", "Harrowgate Capital Partners GP LLC") < FORT);
  assert.ok(score("Zardini Agricola Soc. Coop.", "Zardini Agricola Srl") < FORT);
});

test("tour 19 : l'index ne perd rien au seuil possible de la règle, sur les noms réels de l'échantillon d'apprentissage", () => {
  const paires = (JSON.parse(readFileSync(CHEMIN_APPRENTISSAGE_REEL, "utf8")).paires as { a: string; b: string; nature: string }[])
    .filter((x) => x.nature !== STRATE_CONTENUE);
  const entrees: EntreeListe[] = paires.map((x, i) => ({ source: "OFAC", id: String(1000 + i), nom: x.b, alias: [], type: "entity" }));
  const fl = frequencesDe(entrees.map((e) => [e.nom, ...e.alias]));
  /* 0,61 : le plus bas possible jamais envisagé sur l'apprentissage (30/09/2026, écarté pour le budget des relectures) ; l'index
     doit tenir à ce seuil-là, et donc au 0,80 retenu */
  const seuils = { fort: 0.81, possible: 0.61 };
  const index = new Index(fl, entrees, seuils.possible);
  const pas = process.env.TEMOIN_COMPLET ? 1 : 16;
  const requetes: Contrepartie[] = paires.filter((_, i) => i % pas === 0).map((x, i) => ({ ligne: i + 2, nom: x.a }));
  let trouves = 0;
  for (const c of requetes) {
    const rapide = cribler(c, index, seuils), exhaustif = cribler(c, index, seuils, true);
    assert.deepEqual(rapide, exhaustif, c.nom);
    if (rapide.statut !== "no-match") trouves++;
  }
  assert.ok(trouves > requetes.length / 4, "un témoin où rien ne passe le seuil ne prouverait rien");
});
