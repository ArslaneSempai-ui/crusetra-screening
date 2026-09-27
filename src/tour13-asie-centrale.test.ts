import { test } from "node:test";
import assert from "node:assert/strict";
import {
  preparerEntite, analyserEntite, scoreNoms, frequencesDe, pliSlave, clesSlaves, memeSuiteCyrillique, patronymeSlave, variantesTypees,
} from "./entites.ts";
import { plierCyrilliqueTurcique, lireMelangeCyrillique, lireLatinKazakh } from "./asie-centrale.ts";
import { lireVolapuk } from "./arabizi.ts";

/* tour 13, voie asie-centrale (jeu 17) : les poids d'une petite liste où les mots de métier sont communs, comme dans les vraies
   listes (« grain », « trade », « terminal » y pèsent moins qu'un nom propre) */
const fr13 = frequencesDe([["alpha grain terminal"], ["beta trade"], ["gamma trading house"], ["delta agro holding"], ["epsilon elevator"],
  ["zeta mill"], ["eta port service"], ["theta transit"], ["iota agro"], ["kappa grain export"], ["lambda products"], ["mu food"]]);
const s13 = (a: string, b: string) => scoreNoms(fr13, a, b);
const fort = (a: string, b: string) => assert.ok(s13(a, b) >= 0.81, `${a} / ${b} : ${s13(a, b).toFixed(3)} (fort attendu)`);
const possibleAuPlus = (a: string, b: string) => assert.ok(s13(a, b) < 0.81, `${a} / ${b} : ${s13(a, b).toFixed(3)} (sous le fort attendu)`);

test("tour 13, asie centrale : les lettres kazakhes, ouzbèkes et kirghizes se ramènent au clavier russe, et l'АҚ à l'AQ", () => {
  /* le і (U+0456) est déjà celui de l'ukrainien : la table de translittération le lit */
  assert.equal(plierCyrilliqueTurcique("Ақжайық Ұн Диірмені"), "Акжайык Ун Диірмені");
  assert.equal(plierCyrilliqueTurcique("Фарғона Дон Маҳсулотлари"), "Фаргона Дон Махсулотлари");
  assert.equal(plierCyrilliqueTurcique("АҚ «Ұлы Дала»"), "AQ «Улы Дала»");
  /* « Ақ » (blanc) en tête d'un nom n'est pas la forme */
  assert.equal(plierCyrilliqueTurcique("Ақ Бидай"), "Ак Бидай");
  assert.equal(preparerEntite("ТОО «Ақжайық Ұн Диірмені»"), preparerEntite("Akzhaiyk Un Diirmeni TOO"));
  assert.equal(preparerEntite("ТОО «Түркістан Мақта Өңдеу»"), preparerEntite("Turkistan Makta Ondeu TOO"));
});

test("tour 13, asie centrale : les lettres latines glissées dans un mot cyrillique par la lecture optique", () => {
  assert.equal(lireMelangeCyrillique("TOO ATБACAP ACTЫK TPEЙД"), "TOO АТБАСАР АСТЫК ТРЕЙД");
  /* un mot tout latin ne bouge pas, ni un mot mêlé dont une lettre latine n'a pas de jumelle cyrillique */
  assert.equal(lireMelangeCyrillique("Sberbank Онлайн"), "Sberbank Онлайн");
  assert.equal(lireMelangeCyrillique("DigitalСервис"), "DigitalСервис");
  assert.equal(preparerEntite("TOO ATБACAP ACTЫK TPEЙД"), preparerEntite("Atbasar Astyk Trade LLP"));
});

test("tour 13, asie centrale : les trois alphabets latins du kazakh, sous une présomption seulement", () => {
  assert.equal(lireLatinKazakh("Ko'ks'etau Bi'dai' Eksport JS'S"), "Kokshetau Bidai Eksport JShS");
  assert.equal(lireLatinKazakh("Şyğys Nan Önımderı JŞS"), "Shyğys Nan Önımderı JShS");
  assert.equal(lireLatinKazakh("Ońtústik Astyq JShS"), "Ońtústik Astyq JShS");
  /* le ş turc, l'apostrophe arabe et chinoise restent ce qu'ils sont */
  assert.equal(lireLatinKazakh("Bafra Un San. A.Ş."), "Bafra Un San. A.Ş.");
  assert.equal(lireLatinKazakh("As'ad Sa'id Trading"), "As'ad Sa'id Trading");
  assert.equal(lireLatinKazakh("Xi'an Chang'an Trading"), "Xi'an Chang'an Trading");
  assert.equal(preparerEntite("Ko'ks'etau Bi'dai' Eksport JS'S"), preparerEntite("ТОО «Көкшетау Бидай Экспорт»"));
});

test("tour 13, asie centrale : le pli slave lit le q, le gh, le dzh, les toponymes ; les lectures j, x, w, ng", () => {
  for (const [a, b] of [["astyq", "astyk"], ["maqta", "makta"], ["shyghys", "shygys"], ["dzhambul", "zhambul"], ["buxoro", "bukhara"],
    ["xorazm", "khorezm"], ["fargona", "fergana"], ["qashqadaryo", "kashkadarya"], ["surxon", "surkhan"], ["turkistan", "turkestan"],
    ["ysyk", "issyk"], ["kol", "kul"], ["toshkent", "tashkent"]]) assert.equal(pliSlave(a!), pliSlave(b!), `${a} / ${b}`);
  for (const [a, b] of [["jetysu", "zhetisu"], ["qyzyljar", "kyzylzhar"], ["aqjaiyq", "akzhaiyk"], ["jizzax", "jizzakh"], ["wygys", "shygys"],
    ["tengiz", "teniz"]]) assert.ok(memeSuiteCyrillique(a!, b!), `${a} / ${b}`);
  /* la clé standard ne bouge pas : « Nikolaj » et « Agroexport » gardent la leur */
  assert.equal(pliSlave("nikolaj"), pliSlave("nikolai"));
  assert.equal(pliSlave("agroexport"), pliSlave("agroeksport"));
  assert.ok(clesSlaves("kolkhoz").every((k) => !k.startsWith("kul")));
});

test("tour 13, asie centrale : le volapuk des clavardages, sous la présomption slave seulement", () => {
  assert.deepEqual(lireVolapuk("too 6ygys elevator servis", true), { texte: "too shygys elevator servis", lu: true });
  assert.deepEqual(lireVolapuk("xorazm guru4 eksport", true), { texte: "xorazm guruch eksport", lu: true });
  assert.equal(lireVolapuk("too 6ygys elevator servis", false).lu, false);
  /* un numéro de coque collé en capitales reste un numéro ; deux chiffres sont un numéro */
  assert.equal(lireVolapuk("VOLGONEFT4", true).texte, "VOLGONEFT4");
  assert.equal(lireVolapuk("too sever 46", true).texte, "too sever 46");
  fort("too 6ygys elevator servis", "Shygys Elevator Servis LLP");
  fort("TOO Wygys Elevator Servis", "ТОО «Шығыс Элеватор Сервис»");
  fort("xorazm guru4 eksport", "Xorazm Guruch Eksport MChJ");
});

test("tour 13, asie centrale : les formes disent leur pays, et l'OOO ouzbek n'est pas le TOO kazakh", () => {
  assert.deepEqual(analyserEntite("Qyzyljar Dän Terminal JŞS").pays, ["KZ"]);
  assert.deepEqual(analyserEntite("ЖШС «Қызылжар Дән Терминал»").pays, ["KZ"]);
  assert.deepEqual(analyserEntite("Ońtústik Astyq JShS").pays, ["KZ"]);
  assert.deepEqual(analyserEntite("Ūly Dala Agro Holding AQ").pays, ["KZ"]);
  assert.deepEqual(analyserEntite("Buxoro Don Savdo MChJ").pays, ["UZ"]);
  assert.deepEqual(analyserEntite("OsOO Talas Dan Azyk").pays, ["KG"]);
  assert.ok(!analyserEntite("BUKHARA DON SAVDO OOO").pays.includes("KZ"));
  for (const nom of ["Qyzyljar Dän Terminal JŞS", "Buxoro Don Savdo MChJ", "OsOO Talas Dan Azyk", "Ūly Dala Agro Holding AQ", "IE Zhumabayev Serik"]) {
    assert.ok(analyserEntite(nom).societe && analyserEntite(nom).slave, `${nom} : une forme, et la marque slave`);
  }
  /* deux immatriculations, l'ouzbèke et la kazakhe : le possible, jamais le fort */
  possibleAuPlus("BUKHARA DON SAVDO OOO", "BUKHARA DON SAVDO TOO");
  fort("BUKHARA DON SAVDO OOO", "Buxoro Don Savdo MChJ");
  fort("Qashqadaryo Un Savdo MChJ", "OOO Kashkadarya Un Savdo");
  /* la forme en toutes lettres, en -iu, en kazakh et en ouzbek */
  assert.equal(preparerEntite("OBSHCHESTVO S OGRANICHENNOI OTVETSTVENNOSTIU TALAS DAN AZYK"), preparerEntite("OsOO Talas Dan Azyk"));
  assert.equal(preparerEntite("Jauapkershılıgı Shekteulı Serıktestık Ertis Astyq"), preparerEntite("TOO Ertis Astyq"));
  assert.equal(preparerEntite("Mas'uliyati Cheklangan Jamiyat Buxoro Don Savdo"), preparerEntite("Buxoro Don Savdo MChJ"));
  /* l'entrepreneur individuel, en tête seulement : ailleurs « IP » et « IE » sont un sigle */
  assert.equal(preparerEntite("ЖК Жұмабаев Серік"), preparerEntite("IE Zhumabaev Serik"));
  fort("ЖК Жұмабаев Серік", "IE Zhumabayev Serik");
  assert.ok(analyserEntite("Global IP Networks Ltd").texte.includes("ip"));
});

test("tour 13, asie centrale : les mots du commerce des céréales, traduits sous la marque, et collés dans un champ SWIFT", () => {
  assert.equal(preparerEntite("TOO JETYSU AGRO TREID"), preparerEntite("Jetysu Agro Trade LLP"));
  assert.equal(preparerEntite("ТОО «Маңғыстау Порт Сервис»"), preparerEntite("Mangystau Port Service LLP"));
  /* le toponyme se rejoint sur la clé du pli (Surxon, Surkhan), pas dans le texte préparé */
  fort("Surkhan Bugdoy Terminal LLC", "Surxon Bug'doy Terminali MChJ");
  fort("TOO ATBASARASTYKTREID", "ТОО «Атбасар Астық Трейд»");
  fort("JETYSUAGROTREIDTOO ALMATY", "Jetysu Agro Trade LLP");
  fort("Qostanai Jem Azyq JŞS, BSN 190840027716", "Kostanai Zhem Azyk LLP");
});

test("tour 13, asie centrale : les résidus (BIN, IIN, INN, STIR), la succursale à la russe, la ville derrière un champ en capitales", () => {
  const registres = (n: string) => variantesTypees(n).map((v) => v.registre).filter(Boolean);
  assert.deepEqual(registres("ТОО «Сарыөзек Астық Логистика» БИН 160240019875"), ["160240019875", "160240019875"]);
  assert.ok(variantesTypees("ИНН 02511201910172 ОсОО «Талас Дан Азык»").some((v) => v.texte === "ОсОО «Талас Дан Азык»"));
  assert.ok(variantesTypees("Xorazm Guruch Eksport MChJ, STIR 305118742").some((v) => v.texte === "Xorazm Guruch Eksport MChJ"));
  fort("ТОО «Сарыөзек Астық Логистика» БИН 160240019875", "Saryozek Astyk Logistika TOO");
  fort("ИНН 02511201910172 ОсОО «Талас Дан Азык»", "Talas Dan Azyk OsOO");
  /* « Филиал X в г. Павлодар » : la variante est X, la mention la ville ; deux villes restent deux succursales */
  const filiale = variantesTypees("Филиал ТОО «Ертіс Астық Флот» в г. Павлодар");
  assert.ok(filiale.some((v) => v.texte === "ТОО «Ертіс Астық Флот»" && v.mention === "pavlodar"));
  fort("Филиал ТОО «Ертіс Астық Флот» в г. Павлодар", "TOO Ertis Astyq Flot");
  possibleAuPlus("Филиал ТОО «Ертіс Астық Флот» в г. Павлодар", "Филиал ТОО «Ертіс Астық Флот» в г. Астана");
  /* le lieu devant « branch », derrière la forme ou en queue d'un nom dont la forme est en tête */
  assert.ok(variantesTypees("AO ULY DALA AGRO HOLDING ALMATY BRANCH").some((v) => v.texte === "AO ULY DALA AGRO HOLDING" && v.mention === "almaty"));
  assert.ok(variantesTypees("Kano Merchant Bank Limited Sabon Gari Branch").some((v) => v.texte === "Kano Merchant Bank Limited" && v.mention === "sabon gari"));
  fort("AO ULY DALA AGRO HOLDING ALMATY BRANCH", "АҚ «Ұлы Дала Агро Холдинг»");
  /* la ville d'Asie centrale collée en capitales derrière un nom qui porte sa forme ; en casse mêlée elle reste */
  assert.ok(variantesTypees("OSOO ISSYK-KUL AGRO TRANZIT BISHKEK").some((v) => v.texte === "OSOO ISSYK-KUL AGRO TRANZIT"));
  assert.ok(!variantesTypees("Talas Dan Azyk Bishkek").some((v) => v.texte === "Talas Dan Azyk"));
  fort("OSOO ISSYK-KUL AGRO TRANZIT BISHKEK", "Ysyk-Köl Agro Tranzit OsOO");
  fort("MCHJ ZARAFSHON UN SAVDO SAMARKAND", "Zarafshon Un Savdo MChJ");
});

test("tour 13, asie centrale : le patronyme d'un seul côté est au plancher, des deux côtés il distingue", () => {
  for (const m of ["bolatuly", "serikovna", "ivanovich", "bakhtiyorovich", "alievna", "muratkyzy", "rashidogly"]) assert.ok(patronymeSlave(m), m);
  for (const m of ["unduly", "family", "zurich", "duly", "holding"]) assert.ok(!patronymeSlave(m), m);
  fort("ИП Жұмабаев Серік Болатұлы ИИН 850612301457", "IP Zhumabaev Serik");
  possibleAuPlus("IP Ivanov Ivan Ivanovich", "IP Ivanov Ivan Petrovich");
});

test("tour 13, asie centrale : les paires du jeu, sous toutes les écritures", () => {
  for (const [a, b] of [["TOO AKZHAYK UN DIYRMENI", "Ақжайық Ұн Диірмені ЖШС"], ["ЖШС «Қызылжар Дән Терминал»", "Qyzyljar Dän Terminal LLP"],
    ["Акжайык Ун Диирмени ТОО", "ЖШС «Ақжайық Ұн Диірмені»"], ["Ońtústik Astyq JShS", "ТОО «Оңтүстік Астық»"],
    ["AO PAVLODAR DAN ONIMDERIUL.TORAIGYROVA 64 PAVLODAR KAZAKHSTAN", "АО «Павлодар Дән Өнімдері»"],
    ["Saryözek Astyq Logistika JŞS", "TOO Sary-Ozek Astyk Logistics"], ["Xorazm Guruch Eksport MChJ, STIR 305118742", "Khorezm Guruch Export LLC"],
    ["Фарғона Дон Маҳсулотлари МЧЖ", "Fergana Don Mahsulotlari LLC"], ["Ūly Dala Agro Holding AQ", "АҚ «Ұлы Дала Агро Холдинг»"],
    ["ZHK ORAZBEKOVA G.S.", "IP Orazbekova Gulnar Serikovna"], ["ОсОО «Ысык-Көл Агро Транзит»", "Issyk-Kul Agro Tranzit LLC"],
    ["Surxon Bug'doy Terminali MCHJ", "Сурхон Буғдой Терминали МЧЖ"], ["Ysyk-Köl Agro Tranzit OsOO", "OsOO Issyk Kul Agro Transit"],
    ["Türkıstan Maqta Öñdeu JŞS", "Turkestan Makta Ondeu LLP"], ["Aqjaiyq Ūn Diırmenı JŞS", "Akzhaik Un Diirmeni LLP"],
    ["Şyğys Nan Önımderı JŞS", "TOO Shigis Nan Onimderi"], ["ТОО «Арал Теңіз Тасымал»", "Aral Teniz Tasymal TOO"],
    ["Aral Teñız Tasymal JŞS", "Aral Tengiz Tasymal LLP"], ["Farg'ona Don Mahsulotlari MChJ", "ООО «Фаргона Дон Махсулотлари»"]]) fort(a!, b!);
  /* ce que la voie ne confond pas : deux lieux, deux mots du commerce */
  possibleAuPlus("TOO Kostanay Astyk", "TOO Karaganda Astyk");
  possibleAuPlus("ТОО «Қостанай Астық»", "ТОО «Қостанай Ұн»");
});
