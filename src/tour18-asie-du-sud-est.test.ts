/**
 * TOUR 18, VOIE ASIE DU SUD-EST (jeu 22) : le birman lu syllabe par syllabe dans la graphie d'usage (birman.ts), ses formes et ses
 * mots du commerce, ses civilités en tête et la même syllabe sous deux graphies (Htun, Tun ; Myint, Myin ; Yadana, Yadanar) ; le
 * khmer lu par ses deux séries (khmer.ts) et ses graphies (Pich, Pech ; Chhouk, Chouk) ; le lao lu par le lecteur thaï (lao.ts) et
 * le latin de Vientiane (Chaleunxay, Souksavanh) ; le thaï : les mots que le latin écrit à part (รัตนสมุทร Rattana Samut), les mots
 * du commerce traduits sous la présomption (Phatthana, Khonsong, Namtan), les vieilles graphies (Petch, Rungroj, Numthip, Sakdichai),
 * le « Sri » qui n'est pas une civilité ; le vietnamien : DNTN, CTCP, TM, Vận tải Biển.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreNoms } from "./entites.ts";
import { frequencesDesListes } from "./frequences.ts";
import { romaniser } from "./ecritures.ts";
import { birmanEnLatin, pliBirman, presomptionBirmane, couperSyllabesBirmanes } from "./birman.ts";
import { khmerEnLatin, pliKhmer } from "./khmer.ts";
import { pliThai } from "./mots.ts";

const f = frequencesDesListes();
const score = (a: string, b: string) => scoreNoms(f, a, b);
const FORT = 0.81;

test("tour 18 : le birman écrit face à son registre anglais, au fort", () => {
  for (const [a, b] of [
    ["ငွေမြို့ ရေနံ ကုမ္ပဏီလီမိတက်", "Ngwe Myo Petroleum Co., Ltd."],
    ["ဇော်မင်းထွန်း ဆောက်လုပ်ရေး ကုမ္ပဏီလီမိတက်", "Zaw Min Htun Construction Co., Ltd."],
    ["ဒေါ်ခင်နွယ်အေး ငါးလုပ်ငန်း", "Daw Khin Nwe Aye Fishery"],
    ["နဂါးနီ ရေကြောင်း ဝန်ဆောင်မှု ကုမ္ပဏီလီမိတက်", "Naga Ni Marine Services Co., Ltd."],
    ["ပုလဲကျွန်း ငါးလုပ်ငန်း ကုမ္ပဏီလီမိတက်", "Pa Le Kyun Fishery Co., Ltd."],
    ["ဖြိုးပြည့်စုံ ကုမ္ပဏီလီမိတက်", "Phyo Pyae Sone Co., Ltd."],
    ["မြင့်လှိုင် သစ်လုပ်ငန်း ကုမ္ပဏီလီမိတက်", "Myint Hlaing Timber Co., Ltd."],
    ["ရတနာမင်္ဂလာ ပို့ဆောင်ရေး ကုမ္ပဏီလီမိတက်", "Yadanar Mingalar Logistics Co., Ltd."],
    ["သီရိဇေယျာ ဘိလပ်မြေ ကုမ္ပဏီလီမိတက်", "Thiri Zeyar Cement Co., Ltd."],
    ["ဦးကျော်ဇော်ထွန်း ကုန်သွယ်ရေး", "U Kyaw Zaw Htun Trading"],
    ["ဦးစိုးသန်းနိုင်နှင့်သားများ ကုန်သွယ်ရေး", "Soe Than Nai and Sons Trading"],
    ["ဧရာမြေ စိုက်ပျိုးရေး ကုမ္ပဏီလီမိတက်", "Ayeyar Myay Agriculture Co., Ltd."],
    ["SHWE NADI 5", "ရွှေနဒီ ၅"],
    ["ရတနာနီလာ", "YADANAR NILAR"],
    ["မေတ္တာရွှေလင်း ကုမ္ပဏီ", "MYITTAR SHWE LINN CO LTD"],
  ] as const) assert.ok(score(a, b) >= FORT, `${a} / ${b} : ${score(a, b).toFixed(3)}`);
});

test("tour 18 : la lecture du birman, syllabe par syllabe, dans la graphie d'usage", () => {
  assert.equal(birmanEnLatin("ကျော်ဇော်ထွန်း"), "kyaw zaw htun");
  assert.equal(birmanEnLatin("အောင်"), "aung");
  assert.equal(birmanEnLatin("မြင့်လှိုင်"), "myint hlaing", "le ton grinçant sur une finale nasale s'écrit t");
  assert.equal(birmanEnLatin("ခင်နွယ်အေး"), "khin nwe aye");
  assert.equal(birmanEnLatin("သိန်းနိုင်"), "thein naing");
  assert.equal(birmanEnLatin("ဖြိုး"), "phyo");
  assert.equal(birmanEnLatin("ရွှေ"), "shwe");
  assert.equal(birmanEnLatin("ကျွန်း"), "kyun", "la médiane w devant une finale nasale s'écrit u");
  assert.equal(romaniser("ကုမ္ပဏီလီမိတက်").texte.trim(), "co ltd");
  assert.equal(romaniser("ဦးစိုး").texte.trim().replace(/ +/g, " "), "u so", "la civilité ဦး et la syllabe");
  assert.equal(romaniser("ရတနာမင်္ဂလာ").texte.trim().replace(/ +/g, " "), "yadana mingala", "les mots pâlis se lisent par la table");
});

test("tour 18 : la même syllabe birmane sous deux graphies, sous la présomption", () => {
  for (const [a, b] of [["htun", "tun"], ["myint", "myin"], ["hlaing", "hlain"], ["naing", "nai"], ["nwe", "nway"], ["yadanar", "yadana"],
    ["mingalar", "mingala"], ["oo", "u"], ["soe", "so"], ["sone", "soan"], ["pyae", "pyay"], ["kyal", "kyae"], ["zeyar", "zayar"], ["htet", "htat"],
    ["myatt", "myat"], ["linn", "lin"], ["phyo", "pyo"], ["mye", "myay"]] as const) assert.equal(pliBirman(a), pliBirman(b), `${a} / ${b}`);
  assert.notEqual(pliBirman("htwe"), pliBirman("nwe"), "Htwe et Nwe sont deux syllabes (jeu 22 : kaungmyathtwe, kaungmyatnwe)");
  const anglais = (m: string) => ["than", "win", "tin", "thu"].includes(m);
  assert.ok(presomptionBirmane(["kyaw", "trading"], anglais), "une syllabe forte suffit");
  assert.ok(presomptionBirmane(["soe", "than", "nai", "trading"], anglais), "deux syllabes de la table");
  assert.ok(!presomptionBirmane(["win", "trading"], anglais), "une syllabe faible seule ne dit rien");
  assert.ok(!presomptionBirmane(["lin", "min", "trading"], anglais), "lin et min sont aussi chinoises");
  for (const [a, b] of [
    ["U Kyaw Zaw Htun Trading", "Kyaw Zaw Tun Trading"],
    ["Daw Khin Nwe Aye Fishery", "Khin Nway Aye Fishery"],
    ["Myint Hlaing Timber Co., Ltd.", "Myin Hlain Timber Company Limited"],
    ["Pyay Pyo Kyaw Trading", "U PYAE PHYO KYAW TRADING"],
    ["KAUNG MYAT HTWE CO LTD", "Kaung Myatt Htway Co., Ltd."],
    ["Yadana Mingala Logistics Company Limited", "Yadanar Mingalar Logistics Co., Ltd."],
    ["MYITTAR SHWE LINN CO LTD", "Myitta Shwe Lin Co., Ltd."],
    ["Thiri Zeyar Cement Co., Ltd.", "Thiri Zayar Cement Co., Ltd."],
  ] as const) assert.ok(score(a, b) >= FORT, `${a} / ${b} : ${score(a, b).toFixed(3)}`);
  /* le nom soudé d'un clavardage coupé en ses syllabes : Htwe et Nwe sont deux syllabes, la fausse alerte forte du jeu 22 tombe */
  assert.deepEqual(couperSyllabesBirmanes("kaungmyathtwe", anglais), ["kaung", "myat", "htwe"]);
  assert.equal(couperSyllabesBirmanes("winston", anglais), undefined, "un mot que les syllabes ne couvrent pas reste entier");
  assert.ok(score("kaungmyathtwe co", "kaungmyatnwe co") < FORT, "deux noms soudés à une syllabe près ne montent pas");
  assert.ok(score("kaungmyathtwe co", "Kaung Myat Htwe Co., Ltd.") >= FORT);
});

test("tour 18 : le khmer écrit et ses graphies, au fort", () => {
  assert.equal(khmerEnLatin("កំពត"), "kampot");
  assert.equal(khmerEnLatin("មាស"), "meas", "la voyelle ា de seconde série est ea");
  assert.equal(khmerEnLatin("សុខ"), "sok", "la voyelle ុ de première série est o");
  assert.equal(khmerEnLatin("វិបុល"), "vibol");
  assert.equal(khmerEnLatin("ពន្លឺ"), "ponleu", "la souscrite ouvre la syllabe suivante");
  assert.equal(khmerEnLatin("អង្គរ"), "angkor");
  assert.equal(khmerEnLatin("ចាន់ធូ"), "chanthu");
  for (const [a, b] of [["chhouk", "chouk"], ["sambath", "sambat"], ["pich", "pech"], ["reaksmey", "raksmei"], ["ponleu", "ponlue"], ["chanthou", "chanthu"], ["rotanak", "ratanak"]] as const) {
    assert.equal(pliKhmer(a), pliKhmer(b), `${a} / ${b}`);
  }
  for (const [a, b] of [
    ["ក្រុមហ៊ុន កំពត ពន្លឺ ទឹកត្រី ឯ.ក", "Kampot Ponleu Fish Sauce Co., Ltd."],
    ["ក្រុមហ៊ុន ឈូកសម្បត្តិ កសិកម្ម ឯ.ក", "Chhouk Sambath Agriculture Co., Ltd."],
    ["ក្រុមហ៊ុន ពេជ្ររស្មី ដឹកជញ្ជូន ឯ.ក", "Pich Reaksmey Transport Co., Ltd."],
    ["ក្រុមហ៊ុន មាសសុវណ្ណ ពាណិជ្ជកម្ម ឯ.ក", "Meas Sovann Trading Co., Ltd."],
    ["ក្រុមហ៊ុន សុខ ចាន់ធូ អង្ករ ឯ.ក", "Sok Chanthou Rice Co., Ltd."],
    ["ក្រុមហ៊ុន អង្គរ វិបុល ឯ.ក", "Angkor Vibol Co., Ltd."],
    ["Pich Reaksmey Transport Co., Ltd.", "Pech Raksmei Transport Co., Ltd."],
    ["Chhouk Sambath Agriculture Co., Ltd.", "Chouk Sambat Agriculture Co., Ltd."],
    ["Kampot Ponleu Fish Sauce Co., Ltd.", "Kampot Ponlue Fish Sauce Co., Ltd."],
    ["Mekong Rotanak Logistics Co., Ltd.", "Mekong Ratanak Logistics Co., Ltd."],
  ] as const) assert.ok(score(a, b) >= FORT, `${a} / ${b} : ${score(a, b).toFixed(3)}`);
});

test("tour 18 : le lao écrit et le latin de Vientiane, au fort", () => {
  assert.equal(romaniser("ຄຳແສງ").texte.trim(), "khamseng", "le แ lao s'écrit e");
  assert.equal(romaniser("ຈະເລີນໄຊ").texte.trim(), "chaleunsai", "le เ-ิ lao s'écrit eu");
  assert.equal(romaniser("ສີສົມບູນ").texte.trim(), "sisombun", "le mai kon ferme la syllabe");
  for (const [a, b] of [
    ["ບໍລິສັດ ຄຳແສງ ການຄ້າ ຈຳກັດ", "Khamseng Trading Co., Ltd."],
    ["ບໍລິສັດ ຈະເລີນໄຊ ພັດທະນາ ຈຳກັດ", "Chaleunxay Development Co., Ltd."],
    ["ບໍລິສັດ ບຸນມີ ກະສິກຳ ຈຳກັດ", "Bounmy Agriculture Co., Ltd."],
    ["ບໍລິສັດ ພູຄຳ ບໍ່ແຮ່ ຈຳກັດ", "Phoukham Mining Co., Ltd."],
    ["ບໍລິສັດ ສີສົມບູນ ກາເຟ ຈຳກັດ", "Sisomboun Coffee Co., Ltd."],
    ["ບໍລິສັດ ສຸກສະຫວັນ ຂົນສົ່ງ ຈຳກັດ", "Souksavanh Transport Co., Ltd."],
    ["Vongsavath Timber Co., Ltd.", "Wongsawat Timber Co., Ltd."],
    ["Chaleunxay Phatthana Co., Ltd.", "Chalernsai Development Company Limited"],
  ] as const) assert.ok(score(a, b) >= FORT, `${a} / ${b} : ${score(a, b).toFixed(3)}`);
});

test("tour 18 : le thaï, les mots que le latin écrit à part, les vieilles graphies et les mots du commerce", () => {
  assert.equal(romaniser("รัตนสมุทร").texte.trim().replace(/ +/g, " "), "rattana samut");
  assert.equal(romaniser("ส.เพชรสมุทร").texte.trim().replace(/ +/g, " "), "s. phet samut", "une consonne seule et son point sont une initiale");
  for (const [a, b] of [["petch", "phet"], ["rungroj", "rungrot"], ["numthip", "namthip"], ["sakdichai", "sakchai"], ["srisuk", "sisuk"],
    ["chaleun", "chaloen"], ["chalern", "chaloen"], ["choke", "chok"], ["suwanna", "suwan"], ["bounmy", "bunmee"], ["xay", "sai"], ["savanh", "sawan"]] as const) {
    assert.equal(pliThai(a), pliThai(b), `${a} / ${b}`);
  }
  for (const [a, b] of [
    ["รัตนสมุทร 11", "RATTANA SAMUT 11"],
    ["ส.เพชรสมุทร 21", "S. PHET SAMUT 21"],
    ["สยามออร์คิด 7", "SIAM ORCHID 7"],
    ["KRUNG SIAM FEEDER 4", "กรุงสยาม ฟีดเดอร์ 4"],
    ["บริษัท ศรีสุขพัฒนา ขนส่ง จำกัด", "Si Suk Phatthana Transport Co., Ltd."],
    ["บริษัท โรงสีข้าวสุวรรณมงคล จำกัด", "Suwan Mongkhon Rice Mill Co., Ltd."],
    ["บริษัท ตะวันใต้ ยางพารา จำกัด", "Tawan Tai Rubber Co., Ltd."],
    ["บริษัท วิเศษโภคภัณฑ์ จำกัด", "Wiset Phokhaphan Co., Ltd."],
    ["Munkong Petch Siam PCL", "บมจ. มั่นคงเพชรสยาม"],
    ["หจก. ประเสริฐวัฒนาการค้า", "Prasoet Watthana Kankha Limited Partnership"],
    ["ห้างหุ้นส่วนจำกัด พาณิชย์ทองสงขลา", "Panich Tong Songkla Ltd., Part."],
    ["Puket Petch Nava Co., Ltd.", "Phuket Phet Nawa Co., Ltd."],
    ["SUPHAN RUNGROT RICE CO LTD", "Supan Rungroj Rice Co., Ltd."],
    ["SIAM NAMTHIP BEVERAGE CO LTD", "Siam Numtip Beverage Co., Ltd."],
    ["Sakchai Palm Oil Co., Ltd.", "Sakdichai Palm Oil Company Limited"],
    ["Si Suk Phatthana Khonsong Co., Ltd.", "Srisuk Pattana Transport Company Limited"],
    ["Suwanna Mongkol Rice Mill Co., Ltd.", "Rong Si Khao Suwan Mongkhon Co., Ltd."],
    ["Sang Aroon Sugar Co., Ltd.", "Saeng Arun Namtan Co., Ltd."],
    ["Phanit Thong Songkhla Limited Partnership", "Panichtong Songkla Ltd.,Part."],
    ["chaiyapruek agro bjk", "CHAIYAPHRUEK AGRO CO LTD"],
    ["phongsak intertrade krub", "PHONGSAK INTERTRADE CO., LTD."],
    /* le bloc sous le pli thaï : cinq lettres sur quatorze, une seule sous le pli */
    ["Charoen Sap Nawi Co., Ltd.", "Jaroensub Navee Co., Ltd."],
    ["SIAM NAMTHIP BEVERAGE CO LTD", "Sayam Namthip Beverage Co., Ltd."],
  ] as const) assert.ok(score(a, b) >= FORT, `${a} / ${b} : ${score(a, b).toFixed(3)}`);
  /* le navire thaï à une lettre près (นาวา, Nawi) : « ทอง » lu comme le mot qu'il est, le bloc ne recolle plus les deux noms */
  assert.ok(score("เรือ ทองนาวา 3", "THONG NAWI 3") < FORT);
});

test("tour 18 : les formes et sigles vietnamiens", () => {
  for (const [a, b] of [
    ["Doanh nghiệp tư nhân Kim Ngọc Hà", "Kim Ngoc Ha Private Enterprise"],
    ["DNTN Kim Ngoc Ha", "Kim Ngọc Hà Private Enterprise"],
    ["Minh Khoi Shipping JSC", "CTCP Van tai Bien Minh Khoi"],
    ["Công ty Cổ phần Vận tải Biển Minh Khôi", "Minh Khoi Shipping Joint Stock Company"],
    ["HOANG PHAT LONG TRADING COMPANY LIMITED", "Công ty TNHH TM Hoàng Phát Long"],
    /* « Agri » abrégé d'agricultural, et la succursale face au nom nu */
    ["Duc Thinh Phu Agri Products Co., Ltd., Can Tho Branch", "Đức Thịnh Phú Agricultural Products Co., Ltd."],
  ] as const) assert.ok(score(a, b) >= FORT, `${a} / ${b} : ${score(a, b).toFixed(3)}`);
});
