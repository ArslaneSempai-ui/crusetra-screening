/**
 * TOUR 9, VOIE ÉCRITURES : les noms écrits dans leur écriture, ou lus dans un autre dialecte des mêmes caractères (jeu 13).
 * Chaque règle gardée a ici la paire qui l'a motivée ; les scores sont ceux de la méthode entière (préparation, variantes,
 * score), au seuil FORT de 0,81 et au plafond POSSIBLE de 0,80. Le jeu 13 est en apprentissage : rien ici ne vaut verdict.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreNoms, preparerEntite, lecturesDe, squelette, pliGrec, pliCantonais } from "./entites.ts";
import { romaniser, cleAbjad, cleAbjadVLuF } from "./ecritures.ts";
import { devanagariEnLatin } from "./devanagari.ts";
import { hokkienDe } from "./hokkien.ts";
import { wadeGiles, syllabeWadeGiles } from "./wadegiles.ts";
import { frequencesDesListes } from "./frequences.ts";
import { Index, cribler } from "./cribler.ts";
import { frequencesDe } from "./entites.ts";
import type { EntreeListe } from "./listes.ts";

const f = frequencesDesListes();
const score = (a: string, b: string) => scoreNoms(f, a, b);
const FORT = 0.81, POSSIBLE = 0.80;

test("tour 9, écritures : la devanagari, le schwa tombé en fin de mot et au milieu, l'anusvara, la marque indienne", () => {
  assert.equal(devanagariEnLatin("कुमार"), "kumar", "le schwa final tombe après une consonne");
  assert.equal(devanagariEnLatin("चन्द्र"), "chandra", "il reste après un groupe");
  assert.equal(devanagariEnLatin("हरप्रीत"), "harpreet", "au milieu, VC_CV, à travers un groupe écrit");
  assert.equal(devanagariEnLatin("कमलनाथ"), "kamalnath", "deux schwas voisins alternent");
  assert.equal(devanagariEnLatin("सिंह"), "singh", "l'anusvara devant h est ng");
  assert.equal(romaniser("गुप्ता अनिल कुमार").texte, "gupta anil kumar");
  assert.equal(preparerEntite("शर्मा ट्रेडिंग प्राइवेट लिमिटेड"), "sharma trading", "les mots du commerce et la forme, écrits en devanagari");
  for (const [a, b] of [
    ["GUPTA ANIL KUMAR", "गुप्ता अनिल कुमार"], ["SHARMA RAJESH KUMAR", "शर्मा राजेश कुमार"], ["SINGH HARPREET KAUR", "सिंह हरप्रीत कौर"],
  ] as const) assert.ok(score(a, b) >= FORT, `${a} / ${b} : ${score(a, b).toFixed(3)} (mesuré à 0,000 avant)`);
  assert.ok(score("SINGH HARPREET KAUR", "Singh Harpreet Singh") <= POSSIBLE, "une autre personne de la même famille reste au possible");
});

test("tour 9, écritures : le hokkien de Singapour, troisième lecture des sinogrammes, et ses substitutions", () => {
  assert.equal(hokkienDe("福"), "hock");
  assert.equal(hokkienDe("A"), "", "hors table, pas de lecture hokkien");
  assert.equal(preparerEntite("金福隆33", "hokkien"), "kim hock leong 33");
  const l = lecturesDe("Zhang Xing Seafood Trading Pte Ltd 张兴海产");
  assert.ok(l.some((x) => x.texte === "Teo Heng Seafood Trading Pte Ltd" && x.lecture === "hokkien"), l.map((x) => x.texte).join(" | "));
  assert.ok(lecturesDe("Wing Fung Provision Trading Pte Ltd (荣丰)").some((x) => x.texte === "Eng Hong Provision Trading Pte Ltd" && x.lecture === "hokkien"));
  assert.equal(pliCantonais("hock"), pliCantonais("hok"), "ck et k");
  assert.equal(pliCantonais("leong"), pliCantonais("liong"), "eo et io");
  assert.equal(pliCantonais("teoh"), pliCantonais("teo"), "le h final");
  for (const [a, b, avant] of [
    ["金福隆33", "FV KIM HOCK LEONG 33", "0,365"], ["Lian Huat Plastic Industries Sdn. Bhd.", "联发塑胶工业有限公司", "0,528"],
    ["Eng Hong Provision Trading Pte. Ltd.", "Wing Fung Provision Trading Pte Ltd (荣丰)", "0,461"],
    ["Teo Heng Seafood Trading Pte. Ltd.", "Zhang Xing Seafood Trading Pte Ltd 张兴海产", "0,561"],
  ] as const) assert.ok(score(a, b) >= FORT, `${a} / ${b} : ${score(a, b).toFixed(3)} (mesuré à ${avant} avant)`);
  assert.ok(score("Soon Heng Hardware (Kuching) Sdn. Bhd.", "Shun Hing Hardware (Kuching) Sdn Bhd 顺兴五金") >= FORT, "le cantonais tient toujours");
  assert.ok(score("Lian Huat Plastic Industries Sdn. Bhd.", "Lian Huat Plastic Industries (Vietnam) Co., Ltd.") <= POSSIBLE, "la filiale par pays reste au possible");
});

test("tour 9, écritures : les kanji qui nomment une société japonaise, sous sa forme", () => {
  assert.equal(preparerEntite("株式会社霜月水産"), "shimotsuki fisheries", "la forme, le métier traduit, le nom propre en kun");
  assert.ok(score("株式会社霜月水産", "Shimotsuki Suisan Co., Ltd.") >= FORT, "mesuré à 0,000 avant");
  assert.ok(score("Nishihama Machinery Co., Ltd. (西浜機械)", "Nishihama Kikai K.K.") >= FORT, "les kanji entre parenthèses d'un nom latin lisent toujours");
});

test("tour 9, écritures : le grec sous deux romanisations, ses génériques de la mer, χρ en tête", () => {
  assert.equal(preparerEntite("Ελλάς Ναυτικά Λιπαντικά Α.Ε."), "ellas marine lubricants");
  assert.equal(pliGrec("hellas"), pliGrec("ellas"), "l'esprit rude que l'anglais écrit h");
  assert.equal(squelette("chrysafi"), squelette("hrisafi"), "χρ s'écrit chr ou hr");
  assert.ok(score("HELLAS MARINE LUBRICANTS SA", "Ελλάς Ναυτικά Λιπαντικά Α.Ε.") >= FORT, "mesuré à 0,111 avant");
  assert.ok(score("EVDOKIA CHRYSAFI", "EVDOKIA HRISAFI") >= FORT, "mesuré à 0,563 avant");
  assert.ok(score("Hanna Trading", "Anna Trading") < POSSIBLE, "sans marque grecque, le h de tête n'est pas un esprit");
});

test("tour 9, écritures : le v d'un mot anglais que l'arabe écrit ف ; le reste de la paire hors de portée", () => {
  assert.equal(cleAbjadVLuF("silver"), cleAbjad("silfr", "arabe"), "Silver, سيلفر");
  assert.equal(cleAbjadVLuF("dune"), undefined, "sans v, pas de seconde clé");
  assert.equal(cleAbjad("kaveh", "arabe"), cleAbjad("kawh", "arabe"), "le v persan reste و");
  const s = score("Silver Dune Logistics FZCO", "سيلفر ديون للخدمات اللوجستية ش.م.ح");
  assert.ok(s > 0.6, `mesuré à 0,450 avant la clé, 0,621 avec : ${s.toFixed(3)} ; « dune » écrit ديون (le /juː/ anglais) n'a que deux consonnes, et « للخدمات » ajoute un générique en queue`);
  assert.ok(score("Silver Dune Logistics FZCO", "Silver Dune Logistics DMCC") <= POSSIBLE, "deux zones franches restent au possible");
});

test("tour 9, écritures : les mots anglais écrits en hangul (파이오니어 pioneer), le 호 du navire déjà ôté", () => {
  assert.equal(preparerEntite("해솔 파이오니어호"), "haesol pioneer ho");
  assert.equal(preparerEntite("스타라인해운 주식회사"), "star line shipping");
  assert.ok(score("해솔 파이오니어호", "MT HAESOL PIONEER") >= FORT, "mesuré à 0,583 avant");
  assert.ok(score("Cheongsol Resources Co., Ltd.", "주식회사 청솔자원") >= FORT, "le coréen d'avant tient toujours");
});

test("tour 9, écritures : le Wade-Giles que son apostrophe signe se récrit en pinyin, une syllabe par mot", () => {
  assert.equal(wadeGiles("Chen-ch'iao Hardware Co., Ltd."), "Zhen Qiao Hardware Co., Ltd.", "une syllabe par mot : le bloc du score lit Zhenqiao");
  assert.equal(syllabeWadeGiles("chih"), "zhi");
  assert.equal(syllabeWadeGiles("ch'ih"), "chi");
  assert.equal(syllabeWadeGiles("hsueh"), "xue");
  assert.equal(syllabeWadeGiles("tz'u"), "ci");
  assert.equal(syllabeWadeGiles("ko"), "ge");
  assert.equal(wadeGiles("Ch'ng Trading Sdn Bhd"), "Ch'ng Trading Sdn Bhd", "le patronyme hokkien porte une apostrophe mais pas une syllabe du Wade-Giles");
  assert.equal(wadeGiles("Kao-hsiung Harbour"), "Kao-hsiung Harbour", "sans apostrophe, rien ne dit le système : le mot reste");
  assert.equal(preparerEntite("Chen-ch'iao Hardware Co., Ltd."), "zhen qiao hardware");
  assert.ok(score("Kaohsiung Ch'ung-Mao Fastener Co., Ltd.", "Gaoxiong Chongmao Fastener Co., Ltd.") >= FORT, "les paires de Taïwan tiennent par le bloc (0,875 avant la règle)");
  assert.ok(score("Zhenqiao Hardware Co., Ltd.", "Chen-ch'iao Hardware Co., Ltd.") >= FORT, "mesuré à 0,387 avant");
});

test("tour 9, écritures : l'index retrouve à lui seul chaque écriture nouvelle, dans les deux sens, comme la comparaison exhaustive", () => {
  const e: EntreeListe[] = [
    { source: "OFAC", id: "1", nom: "Ελλάς Ναυτικά Λιπαντικά Α.Ε.", alias: [], type: "entity" },
    { source: "OFAC", id: "2", nom: "EVDOKIA HRISAFI", alias: [], type: "vessel" },
    { source: "OFAC", id: "3", nom: "金福隆33", alias: [], type: "vessel" },
    { source: "OFAC", id: "4", nom: "Zhang Xing Seafood Trading Pte Ltd 张兴海产", alias: [], type: "entity" },
    { source: "OFAC", id: "5", nom: "गुप्ता अनिल कुमार", alias: [], type: "person" },
    { source: "OFAC", id: "6", nom: "株式会社霜月水産", alias: [], type: "entity" },
    { source: "OFAC", id: "7", nom: "Chen-ch'iao Hardware Co., Ltd.", alias: [], type: "entity" },
    { source: "OFAC", id: "8", nom: "해솔 파이오니어호", alias: [], type: "vessel" },
    { source: "OFAC", id: "9", nom: "سيلفر ديون للخدمات اللوجستية ش.م.ح", alias: [], type: "entity" },
    { source: "OFAC", id: "10", nom: "Hellas Marine Lubricants SA", alias: [], type: "entity" },
  ];
  const fx = frequencesDe(e.map((x) => [x.nom]));
  const ix = new Index(fx, e, 0.74);
  const seuils = { fort: 0.81, possible: 0.74 };
  /* la requête latine face à l'écriture listée, et l'écriture face au latin listé ; un nom en sinogrammes porte trois
     lectures, donc trois chaînes : c'est le statut du criblage qui dit qu'il est retrouvé, pas un rang de chaîne */
  for (const nom of [
    "HELLAS MARINE LUBRICANTS SA", "EVDOKIA CHRYSAFI", "FV KIM HOCK LEONG 33", "Teo Heng Seafood Trading Pte. Ltd.",
    "GUPTA ANIL KUMAR", "Shimotsuki Suisan Co., Ltd.", "Zhenqiao Hardware Co., Ltd.", "MT HAESOL PIONEER", "Ελλάς Ναυτικά Λιπαντικά Α.Ε.",
  ]) {
    const rapide = cribler({ ligne: 2, nom }, ix, seuils), exhaustif = cribler({ ligne: 2, nom }, ix, seuils, true);
    assert.deepEqual(rapide, exhaustif, nom);
    assert.notEqual(rapide.statut, "no-match", nom);
  }
  /* la paire arabe reste sous le fort (voir plus haut) : l'index et l'exhaustif doivent au moins dire la même chose */
  const nom = "Silver Dune Logistics FZCO";
  assert.deepEqual(cribler({ ligne: 2, nom }, ix, seuils), cribler({ ligne: 2, nom }, ix, seuils, true), nom);
});
