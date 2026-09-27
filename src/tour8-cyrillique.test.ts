import { test } from "node:test";
import assert from "node:assert/strict";
import {
  preparerEntite, analyserEntite, scoreNoms, frequencesDe, pliSlave, radicalSlave, queueDeComposeSlave, sembleCoupe, lecturesDe,
} from "./entites.ts";
import { Index, cribler, type Contrepartie } from "./cribler.ts";
import { preparerNom } from "./entites.ts";
import type { EntreeListe } from "./listes.ts";

/* tour 8, voie cyrillique : les poids d'une petite liste où les mots de métier sont communs, comme dans les vraies listes
   (« terminal », « plant » y pèsent moins qu'un nom propre) ; à poids uniformes, un mot générique ne tirerait rien */
const fr8 = frequencesDe([["alpha terminal"], ["beta plant"], ["gamma trading house"], ["delta marine terminal"], ["epsilon elevator"],
  ["zeta plant"], ["eta river fleet"], ["theta marine"], ["iota agro"], ["kappa trading company"], ["lambda captain"], ["mu seaman"]]);
const s8 = (a: string, b: string) => scoreNoms(fr8, a, b);
const fort = (a: string, b: string) => assert.ok(s8(a, b) >= 0.81, `${a} / ${b} : ${s8(a, b).toFixed(3)} (fort attendu)`);
const possibleAuPlus = (a: string, b: string) => assert.ok(s8(a, b) < 0.81, `${a} / ${b} : ${s8(a, b).toFixed(3)} (sous le fort attendu)`);

test("tour 8, cyrillique : le pli des romanisations rejoint BGN, ISO 9 sans diacritiques, l'ukrainien national et l'allemande", () => {
  for (const [a, b] of [["zhatva", "zatva"], ["shchekinskiy", "scekinskij"], ["tsimlyanskiy", "cimljanskij"], ["rechnoy", "recnoj"],
    ["zhuravushka", "zuravuska"], ["donskaya", "donskaja"], ["kubanskaya", "kubanskaja"], ["tkachyov", "tkachev"], ["zhuravlyovo", "zuravljovo"],
    ["yeyskiy", "eiskii"], ["yevdokimov", "evdokimov"], ["khlibna", "hlibna"], ["agroeksport", "agroexport"], ["temryukskiy", "temriukskii"],
    ["kompaniia", "kompaniya"], ["portovyy", "portovyi"], ["salskiy", "salsky"], ["nikolayev", "nikolaev"], ["vasilyev", "vasiliev"],
    ["puschkin", "pushkin"], ["tschaikowski", "chaikovskii"], ["mykolaivskyi", "nikolaevskiy"], ["chornomorska", "chernomorska"],
    ["kyiv", "kiev"], ["kharkivskyi", "kharkovskiy"], ["odeskyi", "odesskiy"], ["pivdennyi", "yuzhnyy"]]) {
    assert.equal(pliSlave(a!), pliSlave(b!), `${a} / ${b}`);
  }
  /* ce que le pli ne confond pas : deux lieux, deux consonnes que toutes les romanisations distinguent */
  assert.notEqual(pliSlave("rostov"), pliSlave("rostok"));
  assert.notEqual(pliSlave("kubanskaya"), pliSlave("kurganskaya"));
  assert.notEqual(pliSlave("zernoprodukt"), pliSlave("zernoproekt"));
});

test("tour 8, cyrillique : la marque slave se lit sur la forme, un mot du commerce, un grade, le teplokhod, un suffixe ou l'écriture", () => {
  for (const nom of ["OOO Kubanskaya Zhatva", "TOV Izmailskyi Richkovyi Prychal", "RUSLAN TKACHEV", "ZHURAVUSHKA DONSKAYA", "KAPITAN SEMENYUK",
    "T/H NIZHNEDONSK-1408", "Nikolaevskiy Kombikormovyy Zavod LLC", "Temriukskii Morskoi Terminal LLC", "ООО Северный Транзит",
    "Petrenko Shevchenko Trading"]) assert.ok(analyserEntite(nom).slave, `${nom} doit être marqué slave`);
  /* les mots anglais en -sky, -ova, -ev ne marquent rien : le dictionnaire les connaît */
  for (const nom of ["Whisky Galore Ltd", "Geneva Nova Trading", "Husky Marine Inc", "Blue Star Shipping", "Fujimoto Sangyo Co., Ltd."]) {
    assert.ok(!analyserEntite(nom).slave, `${nom} ne doit pas être marqué slave`);
  }
});

test("tour 8, cyrillique : deux romanisations d'une même suite cyrillique font un nom fort, sous la marque seulement", () => {
  for (const [a, b] of [["OOO Kubanskaya Zhatva", "OOO Kubanskaja Žatva"], ["ZAO Shchekinskiy Metallosklad", "ZAO Ščekinskij Metallosklad"],
    ["ZAO Zhuravlyovo Agro", "ZAO Žuravljovo Agro"], ["OOO Tsimlyanskiy Rechnoy Flot", "Cimljanskij Rečnoj Flot OOO"],
    ["OOO Yeyskiy Portovyy Elevator", "OOO Eiskii Portovyi Elevator"], ["OOO Torgovyy Dom Yevdokimov", "OOO Torgovyi Dom Evdokimov"],
    ["PAO Kuban-Agroeksport", "PJSC Kuban Agroexport"], ["OOO Temryukskiy Morskoy Terminal", "Temriukskii Morskoi Terminal LLC"],
    ["RUSLAN TKACHYOV", "RUSLAN TKACHEV"], ["ZHURAVUSHKA DONSKAYA", "ŽURAVUŠKA DONSKAJA"], ["MATROS TSYBULSKIY", "MATROS CYBULSKIJ"],
    /* la voyelle d'appui de la forme anglaise du prénom (« Aleksandr », « Alexander »), au crédit d'une romanisation */
    ["ALEKSANDR ZHEREBTSOV", "ALEXANDER ZHEREBTSOV"]]) fort(a!, b!);
  /* sans marque, deux mots latins à deux lettres près restent deux mots */
  possibleAuPlus("Zhatva Marine Ltd", "Zatva Marine Ltd");
});

test("tour 8, cyrillique : l'ukrainien face au russe, les lieux en radical, la rivière traduite, le TOV en toutes lettres, l'AT", () => {
  fort("TOV Mykolaivskyi Kombikormovyi Zavod", "Nikolaevskiy Kombikormovyy Zavod LLC");
  fort("TOV Izmailskyi Richkovyi Prychal", "Izmailskiy Rechnoy Prichal LLC");
  fort("TOV Chornomorska Khlibna Kompaniia", "Chornomorska Hlibna Kompaniya LLC");
  fort("AT Pivdennyi Portovyi Zavod", "JSC Pivdennyy Portovyy Zavod");
  assert.equal(preparerEntite("Tovarystvo z Obmezhenoiu Vidpovidalnistiu Prychornomorskyi Terminal"), preparerEntite("TOV Prychornomorskyi Terminal"));
  assert.equal(analyserEntite("Tovarystvo z Obmezhenoyu Vidpovidalnistyu Prychornomorskyi Terminal").pays.join(), "UA");
  assert.equal(analyserEntite("AT Pivdennyi Portovyi Zavod").familles.join(), "corp");
  assert.equal(analyserEntite("AT Pivdennyi Portovyi Zavod").texte, analyserEntite("JSC Pivdennyi Portovyi Zavod").texte);
  /* hors d'un nom slave, « at » reste un mot ; devant un t, il reste l'article arabe assimilé */
  assert.equal(preparerEntite("At Home Stores Ltd"), "at home stores");
  assert.ok(preparerEntite("At-Tijara Trading Co.").startsWith("al "));
  /* la filiale étrangère et le numéro d'un seul côté restent au possible ; la traduction ne défait pas les conflits */
  possibleAuPlus("TOV Chornomorska Khlibna Kompaniia", "Chornomorska Khlibna Kompaniia SRL");
  possibleAuPlus("TOV Mykolaivskyi Kombikormovyi Zavod", "TOV Mykolaivskyi Kombikormovyi Zavod No. 2");
});

test("tour 8, cyrillique : les grades des navires, le teplokhod, le type entre parenthèses, le pavillon et le port derrière le nom", () => {
  fort("CAPT. SEMENYUK", "KAPITAN SEMENYUK");
  fort("T/H SHKIPER KOVALCHUK", "SKIPPER KOVALCHUK");
  fort("T/H NIZHNEDONSK-1408", "NIZHNEDONSK 1408");
  fort("T/KH AZOVSKIY RUBEZH 7", "Azovskiy Rubezh-7");
  fort("barge PRIDONYE 41", "PRIDONYE-41 (barge)");
  fort("T/H VOLNA DONA-2208", "VOLNA DONA 2208, flag Russia, port Rostov-on-Don");
  const th = analyserEntite("T/H NIZHNEDONSK-1408");
  assert.ok(th.navire && th.slave, "le T/H marque un navire slave");
  assert.equal(th.texte, "nizhnedonsk 1408");
  const barge = analyserEntite("PRIDONYE-41 (barge)");
  assert.ok(barge.navire && barge.typeNavire === "barge");
  assert.equal(barge.texte, "pridonye 41");
  assert.ok(lecturesDe("VOLNA DONA 2208, flag Russia, port Rostov-on-Don").some((l) => l.texte === "VOLNA DONA 2208"));
  /* un numéro différent tranche toujours, et un remorqueur n'est pas sa barge */
  assert.equal(s8("T/H NIZHNEDONSK-1408", "NIZHNEDONSK 1409"), 0);
  possibleAuPlus("Tug PRIDONYE 41", "PRIDONYE-41 (barge)");
});

test("tour 8, cyrillique : la queue d'un composé slave fait une autre société, même à la largeur d'un champ AIS", () => {
  assert.ok(queueDeComposeSlave("elevator", "elevatorstroy") && queueDeComposeSlave("agro", "agroprom") && !queueDeComposeSlave("elevator", "elevators"));
  assert.ok(!sembleCoupe("OOO Salskiy Elevator", "OOO Salskiy Elevatorstroy"), "vingt caractères, mais la suite est une queue de composé");
  assert.ok(sembleCoupe("OOO Salskiy Elevator", "OOO Salskiy Elevatornaya Kompaniya"), "la coupe au milieu d'un mot ordinaire reste une coupe");
  possibleAuPlus("OOO Salskiy Elevator", "OOO Salskiy Elevatorstroy");
  possibleAuPlus("OOO Salskiy Elevatorstroy", "OOO Salskiy Elevator");
  /* l'adjectif de lieu : ses radicaux se comparent seuls ; le mot voisin et le composé voisin restent au possible */
  assert.deepEqual(radicalSlave("kubanskaya"), { radical: "kuban", suffixe: "skaia" });
  assert.deepEqual(radicalSlave("salskiy"), { radical: "sal", suffixe: "ski" });
  assert.equal(radicalSlave("zhatva"), undefined);
  possibleAuPlus("OOO Kubanskaya Zhatva", "OOO Kurganskaya Zhatva");
  possibleAuPlus("ТОВ «Дніпровська Зоря Агро»", "ТОВ «Дністровська Зоря Агро»");
  possibleAuPlus("OOO Rostov-Zerno", "OOO Rostok-Zerno");
  /* mais le radical ne joue pas quand le squelette égale déjà les deux mots : la transcription à la française (j pour ж,
     ou pour у) reste le même mot (jeu 8 : « AKADEMIK ZHURBINSKIY », « AKADEMIK JOURBINSKI ») */
  fort("AKADEMIK ZHURBINSKIY", "AKADEMIK JOURBINSKI");
  fort("Zhelvinsky Sudoremontny Zavod", "Jelvinskiy Sudoremontnyi Zavod");
});

test("tour 8, cyrillique : l'index retrouve à lui seul le pli slave dans les deux sens de la marque, et la voyelle d'appui", () => {
  const e: EntreeListe[] = [
    { source: "OFAC", id: "1", nom: "OOO Kubanskaja Žatva", alias: [], type: "entity" },
    { source: "OFAC", id: "2", nom: "Eiskii Portovyi Elevator", alias: [], type: "entity" },
    { source: "OFAC", id: "3", nom: "ALEXANDER ZHEREBTSOV", alias: [], type: "vessel" },
    { source: "OFAC", id: "4", nom: "Nikolaevskiy Kombikormovyy Zavod LLC", alias: [], type: "entity" },
  ];
  const fx = frequencesDe(e.map((x) => [x.nom]));
  const ix = new Index(fx, e, 0.74);
  /* la requête marquée face à une chaîne marquée (1), la requête sans marque face à une chaîne marquée (2 : « Yeyskiy » sous le
     pli natif d'« Eiskii », que le suffixe -skii marque), la voyelle d'appui (3), l'ukrainien face au russe (4) */
  for (const [nom, k] of [["OOO Kubanskaya Zhatva", 0], ["Yeyskiy Portovyy Elevator", 1], ["ALEKSANDR ZHEREBTSOV", 2],
    ["TOV Mykolaivskyi Kombikormovyi Zavod", 3]] as const) {
    assert.ok(ix.candidats(preparerNom(fx, nom), nom).includes(k), `${nom} doit retrouver « ${e[k]!.nom} »`);
  }
  const seuils = { fort: 0.81, possible: 0.74 };
  for (const nom of ["OOO Kubanskaya Zhatva", "Yeyskiy Portovyy Elevator", "ALEKSANDR ZHEREBTSOV", "TOV Mykolaivskyi Kombikormovyi Zavod"]) {
    const c: Contrepartie = { ligne: 2, nom };
    const rapide = cribler(c, ix, seuils), exhaustif = cribler(c, ix, seuils, true);
    assert.deepEqual(rapide, exhaustif, nom);
    assert.notEqual(rapide.statut, "no-match", nom);
  }
});
