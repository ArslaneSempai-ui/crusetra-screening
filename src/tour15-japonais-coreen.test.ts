/**
 * TOUR 15, VOIE JAPONAIS-CORÉEN (jeu 19) : les kana romanisés, les kanji des noms de navires et de sociétés, les métiers du hangul
 * et du coréen romanisé, la lecture des hanja, le McCune-Reischauer face à la romanisation révisée, les résidus japonais et
 * coréens d'un document. Un test par règle : la paire qui l'a motivée, et un témoin qu'elle ne doit pas casser.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreNoms, mentionDeSuccursale, variantes } from "./entites.ts";
import { romaniser, estJaponais, hangulEnLatin } from "./ecritures.ts";
import { frequencesDesListes } from "./frequences.ts";
import { kanaEnLatin, kana } from "./kana.ts";
import { hanjaSuite, teteCoreenne, nasaliserCoreen, assimilerCoreen } from "./hanja.ts";
import { numeralKanji, romajiNumeral, numeroDai } from "./kanji.ts";
import { pliJaponais, pliCoreen, deriveGenerique } from "./mots.ts";

const f = frequencesDesListes();
const score = (a: string, b: string) => scoreNoms(f, a, b);
const FORT = 0.81, POSSIBLE = 0.80;

/* ─────────────── (1) les kana ─────────────── */

test("les kana se lisent en Hepburn : yōon, sokuon, trait long, petites voyelles, point médian", () => {
  assert.equal(kanaEnLatin("ツクヨミ"), "tsukuyomi");
  assert.equal(kanaEnLatin("みずかがみ"), "mizukagami");
  assert.equal(kanaEnLatin("キャッチ"), "kyatchi");
  assert.equal(kanaEnLatin("ティファニー"), "tifanii");
  assert.equal(kanaEnLatin("ウェイ"), "wei");
  assert.equal(kanaEnLatin("ジェット"), "jetto");
  assert.equal(kanaEnLatin("ヴァルカン"), "varukan");
  assert.equal(kana("ラピス・ハイウェイ").trim().replace(/\s+/g, " "), "rapisu highway", "le point médian coupe, l'emprunt anglais se lit dans sa langue");
});

test("un nom de navire en katakana rencontre son nom latin (LNGツクヨミ / LNG Tsukuyomi ; フェリーみずかがみ / Ferry Mizukagami)", () => {
  assert.ok(score("LNGツクヨミ", "LNG Tsukuyomi") >= FORT);
  assert.ok(score("フェリーみずかがみ", "Ferry Mizukagami") >= FORT);
  assert.ok(score("タカナミ・スター", "Takanami Star") >= FORT);
  assert.ok(score("コバルト・ヒバリ", "Cobalt Hibari") >= FORT);
  /* témoin : deux navires en kana différents restent deux navires */
  assert.ok(score("LNGツクヨミ", "LNG Amaterasu") <= POSSIBLE);
});

test("l'emprunt écrit en katakana se replie sur son mot latin : r et l, le u final (ラピス / Lapis)", () => {
  assert.equal(pliJaponais("rapisu"), pliJaponais("lapis"));
  assert.ok(score("Lapis Highway", "ラピス・ハイウェイ") >= FORT);
  /* témoin : le pli ne fond pas deux mots japonais distincts (Shirakaba, Shirakawa) */
  assert.notEqual(pliJaponais("shirakaba"), pliJaponais("shirakawa"));
});

test("les mots de métier japonais en katakana se coupent comme leurs kanji (マルシンジュウキ / 丸信重機)", () => {
  assert.ok(score("丸信重機株式会社", "マルシンジュウキ株式会社") >= FORT);
  assert.ok(score("株式会社千鳥ヶ瀬商事", "カブシキガイシャ チドリガセショウジ") >= FORT);
  assert.ok(score("藤見化成株式会社", "フジミカセイ株式会社") >= FORT);
  /* témoin : la première et la seconde société du même nom restent deux sociétés */
  assert.ok(score("第一丸信重機株式会社", "第二丸信重機株式会社") <= POSSIBLE);
});

/* ─────────────── (2) les kanji ─────────────── */

test("le 丸 en queue dit le navire japonais, et ses kanji se lisent (霧雨丸 / Kirisame Maru)", () => {
  assert.ok(estJaponais("霧雨丸"));
  assert.ok(!estJaponais("永成貿易有限公司"), "témoin : un nom chinois n'est pas japonais");
  assert.equal(romaniser("霧雨丸").texte.trim().replace(/\s+/g, " "), "kirisame maru");
  assert.ok(score("霧雨丸", "Kirisame Maru") >= FORT);
  assert.ok(score("Haeoreum Ho (ex Kirisame Maru)", "霧雨丸") >= FORT);
});

test("le Maru numéroté : 第 et son numéral, en kanji ou en lettres, sont le numéro (第八星風丸 / Hoshikaze Maru No. 8)", () => {
  assert.equal(numeralKanji("八"), 8);
  assert.equal(numeralKanji("十一"), 11);
  assert.equal(numeralKanji("二十八"), 28);
  assert.equal(romajiNumeral(11), "juichi");
  assert.equal(numeroDai("daihachi"), 8);
  assert.equal(numeroDai("daijuichi"), 11);
  assert.equal(numeroDai("daisiti"), 7, "le Kunrei aussi");
  assert.equal(numeroDai("daimaru"), undefined, "témoin : Daimaru n'est pas un numéro");
  assert.ok(score("第八星風丸", "Hoshikaze Maru No. 8") >= FORT);
  assert.ok(score("第十一浪助丸", "Namisuke Maru No. 11") >= FORT);
  assert.ok(score("Dai-hachi Hoshikaze Maru", "第八星風丸") >= FORT);
  assert.ok(score("第五若竹丸", "wakatake maru no5") >= FORT);
  /* témoin : deux numéros différents sont deux coques */
  assert.ok(score("第八星風丸", "Hoshikaze Maru No. 3") <= POSSIBLE);
});

test("les kanji des raisons sociales : les kun des noms, les formes G.K. et Y.K., le rendaku h/b (合同会社小鳩屋 / Kobatoya G.K.)", () => {
  assert.ok(score("合同会社小鳩屋", "Kobatoya G.K.") >= FORT);
  assert.ok(score("有限会社岬屋酒造", "Misakiya Shuzo Y.K.") >= FORT);
  assert.ok(score("株式会社大鷲精工", "Owashi Seiko Co., Ltd.") >= FORT);
  assert.ok(score("白駒電機株式会社", "Shirakoma Electric Co., Ltd.") >= FORT);
  assert.ok(score("蒼龍化学工業株式会社", "Soryu Chemical Industries Co., Ltd.") >= FORT);
  assert.ok(score("株式会社鳴海浜商会", "Narumihama Shokai Co., Ltd.") >= FORT);
  assert.ok(score("有限会社朝凪商店", "asanagi shoten") >= FORT);
  /* témoin : deux sociétés de kanji différents restent deux sociétés */
  assert.ok(score("株式会社大鷲精工", "Owashi Denki Co., Ltd.") <= POSSIBLE);
});

test("un mot collé qui finit par un métier japonais se coupe (kazehayadenki kk / Kazehaya Denki Kabushiki Kaisha)", () => {
  assert.ok(score("kazehayadenki kk", "Kazehaya Denki Kabushiki Kaisha") >= FORT);
  assert.ok(score("daebitsangsa", "Daebit Sangsa Co., Ltd.") >= FORT, "et le coréen collé de même");
});

/* ─────────────── (3) le hangul et le coréen romanisé ─────────────── */

test("les métiers du hangul se traduisent, la forme abrégée (주) et ㈜ se lit (대륜중공업 / Daeryun Heavy Industries)", () => {
  assert.ok(score("대륜중공업 주식회사", "Daeryun Heavy Industries Co., Ltd.") >= FORT);
  assert.ok(score("도담산업(주)", "Dodam Industrial Co., Ltd.") >= FORT);
  assert.ok(score("㈜운봉기계", "Unbong Gigye Co., Ltd.") >= FORT);
  assert.ok(score("동백상사(주)", "주식회사 동백상사") >= FORT);
  assert.ok(score("유한회사 미르섬유", "Mireu Seomyu Ltd.") >= FORT);
  /* témoin : deux métiers différents sont deux sociétés (해운 et 상선) */
  assert.ok(score("주식회사 서림해운", "주식회사 서림상선") <= POSSIBLE);
});

test("l'assimilation nasale de la romanisation révisée (백록 baengnok), et son pli côté latin", () => {
  assert.equal(hangulEnLatin("백록"), "baengnok");
  assert.equal(hangulEnLatin("국민"), "gungmin");
  assert.equal(hangulEnLatin("신라"), "silla");
  assert.equal(nasaliserCoreen("sipri"), "simni");
  assert.equal(assimilerCoreen("kalnal"), "kallal");
  assert.equal(pliCoreen("baekrok"), pliCoreen("baengnok"));
  assert.ok(score("백록화학 주식회사", "Baengnok Chemical Co., Ltd.") >= FORT);
  /* témoin : ㄴ et ㄹ voisins ne se replient pas côté latin (Hyeonrim, Hyorim : deux sociétés) */
  assert.ok(score("Hyorim Logistics Co., Ltd.", "Hyeonrim Logistics Co., Ltd.") <= POSSIBLE);
});

test("les métiers coréens romanisés se traduisent, sous les deux systèmes (Dodam Saneop / Todam Sanop ; shinnae jeongi / Sinnae Electric)", () => {
  assert.ok(score("Dodam Saneop Co., Ltd.", "Todam Sanop Co., Ltd.") >= FORT);
  assert.ok(score("Saebom Jeyak Co., Ltd.", "Saebom Cheyak Co., Ltd.") >= FORT);
  assert.ok(score("shinnae jeongi", "Sinnae Electric Co., Ltd.") >= FORT);
  assert.ok(score("Moraenae Foods Co., Ltd.", "moraenae sikpum") >= FORT);
  assert.ok(score("Cheonghak Joseon Co., Ltd.", "Cheonghak Shipbuilding Co., Ltd.") >= FORT);
  /* témoin : « Susan » n'est la pêche que sous un nom coréen */
  assert.ok(score("Susan Fisheries Ltd", "Susan Ltd") <= POSSIBLE);
});

test("l'adjectif d'un mot du commerce est le même mot (Industrial, Industry)", () => {
  assert.ok(deriveGenerique("industrial", "industry"));
  assert.ok(!deriveGenerique("industrial", "chemical"));
  assert.ok(score("Dodam Industry Co Ltd", "Dodam Industrial Co Ltd") >= FORT);
  /* témoin : un autre métier reste un autre métier */
  assert.ok(score("Dodam Industry Co Ltd", "Dodam Chemical Co Ltd") <= POSSIBLE);
});

/* ─────────────── (4) les hanja ─────────────── */

test("la lecture sino-coréenne des hanja, la règle du son initial (大輪重工業株式會社 / 주식회사 대륜중공업)", () => {
  assert.equal(hanjaSuite([..."大輪"]), "daeryun");
  assert.equal(hanjaSuite([..."輪"]), "yun", "ㄹ devant y tombe en tête");
  assert.equal(hanjaSuite([..."林"]), "im");
  assert.equal(hanjaSuite([..."瑞林"]), "seorim");
  assert.equal(teteCoreenne("ra"), "na");
  assert.equal(romaniser("白鹿化學株式會社", "hanja").texte.trim().replace(/\s+/g, " "), "baengnok chemical jusikhoesa");
  assert.ok(score("大輪重工業株式會社", "주식회사 대륜중공업") >= FORT);
  assert.ok(score("瑞林海運株式會社", "주식회사 서림해운") >= FORT);
  assert.ok(score("白鹿化學株式會社", "백록화학 주식회사") >= FORT);
  assert.ok(score("雲峰機械株式會社", "Unbong Machinery Co., Ltd.") >= FORT);
  assert.ok(score("冬柏商事株式會社", "Dongbaek Sangsa Co., Ltd.") >= FORT);
  /* témoin : un nom chinois garde ses lectures et son sens (永成 reste Yongcheng, Wing Shing) */
  assert.ok(score("永成貿易有限公司", "Yongcheng Trading Co., Ltd.") >= FORT);
  assert.ok(score("大輪重工業株式會社", "주식회사 서림해운") <= POSSIBLE);
});

/* ─────────────── (5) McCune-Reischauer et romanisation révisée ─────────────── */

test("le brève du McCune-Reischauer est le digramme de la romanisation révisée, et il marque le coréen (Ŭnp'a / Eunpa)", () => {
  assert.ok(score("Eunpa Ho", "Ŭnp'a Ho") >= FORT);
  assert.ok(score("Haneul Aurora", "Hanŭl Aurora") >= FORT);
  assert.ok(score("P'ungam Chŏngmil Co., Ltd.", "Pungam Precision Co., Ltd.") >= FORT);
  assert.ok(score("청학조선 주식회사", "Ch'ŏnghak Chosŏn Co., Ltd.") >= FORT);
  assert.ok(score("솔뫼식품(주)", "Solmoe Sikp'um Co., Ltd.") >= FORT);
  /* témoin : ㅕ et ㅜ restent deux voyelles (P'yŏngam, P'ungam) */
  assert.ok(score("P'ungam Chŏngmil Co., Ltd.", "P'yŏngam Chŏngmil Co., Ltd.") <= POSSIBLE);
});

test("le digramme eu marque le coréen comme eo, et le pli replie sh/s et m/n devant b (Umbong / Unbong)", () => {
  assert.ok(score("Unbong Gigye Co., Ltd.", "Umbong Gigye Co., Ltd.") >= FORT);
  assert.ok(score("GEUMNAE CHEMICAL CO LTD", "KUMNAE CHEMICAL CO LTD") >= FORT);
  assert.ok(score("Mireu Seomyu Yuhan Hoesa", "Miru Somyu Ltd.") >= FORT);
  /* témoin : le nom thaï à « eu » ne devient pas coréen */
  assert.ok(score("Bangkok Rungreung Food Co., Ltd.", "Bangkok Rungrueang Food Co., Ltd.") <= 1);
});

/* ─────────────── (6) les résidus des documents ─────────────── */

test("la mention d'établissement collée au lieu, en japonais et en coréen, est une succursale (神戸支店, 부산지점)", () => {
  assert.equal(mentionDeSuccursale("株式会社北楠海運 神戸支店"), "kobe");
  assert.equal(mentionDeSuccursale("주식회사 효림물류 부산지점"), "busan");
  assert.equal(mentionDeSuccursale("Kojo Ventures Ltd"), "", "témoin : Kojo en tête est un prénom");
  assert.ok(variantes("株式会社北楠海運 神戸支店").includes("株式会社北楠海運"));
  assert.ok(score("株式会社北楠海運 神戸支店", "株式会社北楠海運") >= FORT);
  assert.ok(score("藤見化成株式会社 名古屋営業所", "藤見化成株式会社") >= FORT);
  assert.ok(score("주식회사 효림물류 부산지점", "주식회사 효림물류") >= FORT);
  assert.ok(score("동백상사 주식회사 인천지점", "Dongbaek Sangsa Co., Ltd.") >= FORT);
  /* témoin : deux succursales différentes restent au possible */
  assert.ok(score("株式会社北楠海運 神戸支店", "株式会社北楠海運 大阪支店") <= POSSIBLE);
});

test("les civilités japonaises en queue (さん, 御中), et les textes de sceau (代表取締役之印, 대표이사 직인)", () => {
  assert.ok(score("kazehaya denki san", "Kazehaya Denki K.K.") >= FORT);
  assert.ok(score("風早電機さん", "株式会社風早電機") >= FORT);
  assert.ok(score("株式会社八雲堂 御中", "株式会社八雲堂") >= FORT);
  assert.ok(score("月岡繊維株式会社 御中", "Tsukioka Sen'i K.K.") >= FORT);
  assert.ok(score("(주)모래내식품 대표이사 직인", "Moraenae Foods Co., Ltd.") >= FORT);
  assert.ok(variantes("株式会社西錦橋商事 代表取締役之印").includes("株式会社西錦橋商事"));
  /* témoin : « San » dans un nom qui n'est pas japonais reste un mot (San Miguel) */
  assert.ok(score("San Miguel Corporation", "Miguel Corporation") <= POSSIBLE);
});

test("le numéro d'enregistrement coréen et l'étiquette du titulaire de compte sont des résidus (사업자등록번호, 예금주)", () => {
  assert.ok(score("사업자등록번호: 130-81-77420 ㈜은솔전자", "은솔전자 주식회사") >= FORT);
  assert.ok(score("주식회사 가람철강 (사업자등록번호 214-86-53907)", "주식회사 가람철강") >= FORT);
  assert.ok(score("예금주 주식회사 풍암정밀", "Pungam Jeongmil Co., Ltd.") >= FORT);
  /* témoin : deux numéros d'enregistrement différents sont deux dépôts, au possible */
  assert.ok(score("주식회사 가람철강 (사업자등록번호 214-86-53907)", "주식회사 가람철강 (사업자등록번호 130-81-77420)") <= POSSIBLE);
});

test("le latin pleine chasse se replie (ＫＡＺＡＭＡＴＳＵ　ＫＯＧＹＯ　ＫＫ / Kazamatsu Kōgyō Co., Ltd.)", () => {
  assert.ok(score("ＫＡＺＡＭＡＴＳＵ　ＫＯＧＹＯ　ＫＫ", "Kazamatsu Kōgyō Co., Ltd.") >= FORT);
  assert.ok(score("㈱Ōnishi Denki", "Onishi Denki Co., Ltd.") >= FORT, "㈱ est (株), la forme");
});

test("le 제N et le 호 des navires coréens : le numéro et le suffixe (제7 용두호 / Yongdu Ho No. 7 ; Yongdu No. 7)", () => {
  assert.ok(score("제7 용두호", "Yongdu Ho No. 7") >= FORT);
  assert.ok(score("Yongdu No. 7", "Yongdu Ho No. 7") >= FORT);
  assert.ok(score("Cheongryong Ho", "CHUNGRYONG HO") >= FORT, "le suffixe reste un mot du nom");
  /* témoins : deux coques à une lettre près sous le signe du navire, et « Tally Ho » qui garde son Ho */
  assert.ok(score("naraenuri-ho", "Naraenari Ho") <= POSSIBLE);
  assert.ok(score("Tally Ho", "Tally") <= POSSIBLE);
});

test("les marqueurs japonais se lisent sous le pli des deux romanisations (Sumiyosibara Seisakusyo)", () => {
  assert.ok(score("Sumiyoshibara Seisakusho Co., Ltd.", "Sumiyosibara Seisakusyo Co., Ltd.") >= FORT);
  assert.ok(score("Chidorigase Shōji Co., Ltd.", "Tidorigase Syôzi Co., Ltd.") >= FORT);
  assert.ok(score("SHIOMIDAI DENKI SEISAKUSHO KK", "Shiomidai Electric Manufacturing Co., Ltd.") >= FORT);
});
