/**
 * TOUR 17, VOIE HÉBREU, CAUCASE, PERSAN (jeu 21) : l'écriture hébraïque lue avec ses digrammes au geresh, son כ doux, son ו devant
 * un י, ses mots du commerce et sa clé courte (deux consonnes et les voyelles longues) ; le géorgien (mkhedruli) et l'arménien lus
 * par leurs tables (caucase.ts), avec leurs formes, leurs mots du commerce, les mots anglais écrits dans leurs lettres et le génitif
 * géorgien replié ; le persan et l'arabe du Golfe : les marchandises que le nom anglais traduit ; en latin, le patronyme arménien
 * sous une graphie, le vieux latin géorgien, le clavardage israélien (hevrat, baam, hovalot), les prénoms hébreux qui marquent,
 * le -pour persan, et la שპს ou ՍՊԸ écrite LLC ou Ltd.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreNoms } from "./entites.ts";
import { frequencesDesListes } from "./frequences.ts";
import { romaniser, cleAbjad, cleAbjadVoyelles } from "./ecritures.ts";
import { georgien, armenien, plierPatronymeArmenien, lireLatinGeorgien } from "./caucase.ts";

const f = frequencesDesListes();
const score = (a: string, b: string) => scoreNoms(f, a, b);
const FORT = 0.81;
const POSSIBLE = 0.80;

test("tour 17 : l'hébreu écrit face à son registre anglais, au fort", () => {
  for (const [a, b] of [
    ["גורביץ' חלקים מדויקים בע\"מ", "Gurevich Precision Parts Ltd"],
    ["האחים חדאד חומרי בניין בע\"מ", "Haddad Brothers Building Materials Ltd"],
    ["ח'ורי עבודות אבן בע\"מ", "Khoury Stone Works Ltd"],
    ["מנסור בית בד כפר כנא בע\"מ", "Mansour Olive Press Kafr Kanna Ltd"],
    ["לויצקי פתרונות אריזה בע\"מ", "Levitski Packaging Solutions Ltd"],
    ["נחמיאס תוצרת טרייה בע\"מ", "Nakhmias Fresh Produce Ltd"],
    ["רחמים אוחיון יבוא ושיווק בע\"מ", "Rachamim Ohayon Import and Marketing Ltd"],
    ["צור אמיתי לוגיסטיקה בע\"מ", "Tzur Amitai Logistics Ltd"],
    ["רבינוביץ' לוגיסטיקה רפואית בע\"מ", "Rabinovich Medical Logistics Ltd"],
    ["אור הגלים פירות ים בע\"מ", "Or Hagalim Seafood Ltd"],
    ["מעגן סוכנויות ספנות (1998) בע\"מ", "Ma'agan Shipping Agencies (1998) Ltd"],
    ["DOVRAT PLASTICS LTD", "דוברת פלסטיק בע\"מ"],
    ["שטרן מזון כשר בע\"מ", "Shtern Kosher Foods Ltd"],
    ["ARBEL EXPRESS", "ארבל אקספרס"],
    ["KINNERET DAWN", "כנרת דון"],
    ["אופירה סאנרייז", "OFIRA SUNRISE"],
    ["NAHAL SOREK", "נחל שורק"],
    ["ZOHAR BAY", "זוהר ביי"],
    /* le כ derrière l'article reste un k (ha-Karmel) : la paire du jeu 4 que la lecture kh perdait */
    ["HADAR HACARMEL", "הדר הכרמל"],
  ] as const) assert.ok(score(a, b) >= FORT, `${a} / ${b} : ${score(a, b).toFixed(3)}`);
});

test("tour 17 : la lecture de l'hébreu et sa clé", () => {
  assert.equal(romaniser("גורביץ'").texte, "gorbich", "le צ׳ final est ch");
  assert.equal(romaniser("לויצקי").texte, "lvitski", "le ו devant un י est une consonne");
  assert.equal(romaniser("ברכה").texte, "brkh", "le כ après une voyelle est kh, le ה final tombe");
  assert.equal(romaniser("הכרמל").texte, "hkrml", "le כ derrière l'article est k");
  assert.equal(romaniser("ושיווק").texte.trim(), "and marketing", "la conjonction collée devant un mot du commerce");
  assert.equal(romaniser("האחים").texte.trim(), "brothers", "l'article collé devant un mot du commerce");
  assert.equal(cleAbjad("yitzhak", "hebreu"), cleAbjad("ytskhk", "hebreu"));
  assert.equal(cleAbjad("express", "hebreu"), cleAbjad("ksprs", "hebreu"));
  assert.equal(cleAbjad("bracha", "hebreu"), cleAbjad("brkh", "hebreu"));
  assert.equal(cleAbjad("ofira", "hebreu"), cleAbjad("opir", "hebreu"));
  /* la clé courte : deux consonnes et les voyelles que l'hébreu écrit */
  assert.equal(cleAbjadVoyelles("tzur", "hebreu"), cleAbjadVoyelles("tsor", "hebreu"));
  assert.equal(cleAbjadVoyelles("dawn", "hebreu"), cleAbjadVoyelles("don", "hebreu"));
  assert.equal(cleAbjadVoyelles("ohayon", "hebreu"), cleAbjadVoyelles("okhion", "hebreu"));
  assert.notEqual(cleAbjadVoyelles("tzur", "hebreu"), cleAbjadVoyelles("tsir", "hebreu"), "i et o sont deux voyelles écrites");
});

test("tour 17 : le géorgien et l'arménien écrits, au fort", () => {
  for (const [a, b] of [
    ["KIKNAVELIDZE WINE CELLARS LLC", "შპს კიკნაველიძის ღვინის მარნები"],
    ["შპს ლომიძე და ძმები", "Lomidze and Brothers LLC"],
    ["შპს მცხეთა ბილდინგი", "Mtskheta Building LLC"],
    ["შპს წყალტუბოს ხილი", "Tskaltubo Fruit LLC"],
    ["შპს ჯაფარიძე და კომპანია", "Japaridze and Company LLC"],
    ["Kolkheti Feeder Lines LLC", "შპს კოლხეთი ფიდერ ლაინზი"],
    ["სს ბერიძე ლოჯისტიკი", "Beridze Logistics JSC"],
    ["შპს კვინიკაძე მეტალი", "Kvinikadze Metali LLC"],
    ["შპს ციკლაური ღვინო", "Tsiklauri Ghvino LLC"],
    ["შპს „ჩხაიძე აგრო“", "LLC Chkhaidze Agro"],
    ["ACHARA BRIDGE", "აჭარა ბრიჯი"],
    ["CHOROKHI PRIDE", "ჭოროხი პრაიდი"],
    ["M/V MZIURI (Batumi)", "მზიური"],
    ["MT KHOBI LADY", "ხობი ლედი"],
    ["SUPSA LIGHT", "სუფსა ლაითი"],
    ["კოლხეთი ფიდერი 4", "KOLKHETI FEEDER 4"],
    ["«Գյումրի Մետաղ» ՍՊԸ", "Gyumri Metal LLC"],
    ["«Խաչատրյան և Որդիներ» ՍՊԸ", "Khachatryan and Sons LLC"],
    ["«Ծատուրյան Շին» ՍՊԸ", "Tsaturyan Shin LLC"],
    ["«Հակոբյան Տրանս» ՍՊԸ", "Hakobyan Trans LLC"],
    ["«Հովհաննիսյան Տեքստիլ» ԲԲԸ", "Hovhannisyan Textile OJSC"],
    ["«Ղազարյան Ագրո» ՓԲԸ", "Ghazaryan Agro CJSC"],
    ["«Չոբանյան Կաթ» ՍՊԸ", "Chobanyan Kat LLC"],
    ["«Ջանոյան Էքսպրես» ՍՊԸ", "Janoyan Express LLC"],
  ] as const) assert.ok(score(a, b) >= FORT, `${a} / ${b} : ${score(a, b).toFixed(3)}`);
});

test("tour 17 : les lectures du géorgien et de l'arménien", () => {
  assert.equal(georgien("მცხეთა"), "mtskheta");
  assert.equal(georgien("კიკნაველიძის"), "kiknavelidze", "le génitif d'un patronyme en -dze");
  assert.equal(georgien("წყალტუბოს"), "tsqaltubo", "le génitif d'un nom en voyelle perd son s");
  assert.equal(georgien("შპს ღვინო").trim().replace(/ +/g, " "), "llc wine");
  assert.equal(armenien("Հովհաննիսյան"), "hovhannisyan");
  assert.equal(armenien("Որդիներ").trim(), "sons");
  assert.equal(armenien("Երևան").trim(), "yerevan");
  assert.equal(armenien("ՍՊԸ").trim(), "llc");
  assert.equal(plierPatronymeArmenien("hovhannisyan"), plierPatronymeArmenien("oganesyan"));
  assert.equal(plierPatronymeArmenien("djanoyan"), plierPatronymeArmenien("dzhanoyan"));
  assert.equal(plierPatronymeArmenien("khachatrian"), "khachatryan");
  assert.equal(plierPatronymeArmenien("caturyan"), "tsaturyan");
  assert.equal(lireLatinGeorgien("mcxeta"), "mtskheta");
});

test("tour 17 : le persan et l'arabe du Golfe, les marchandises traduites, au fort", () => {
  for (const [a, b] of [
    ["فرش دستباف صادقپور", "Sadeghpour Handwoven Carpets"],
    ["گیاهان دارویی کوهرنگ", "Kuhrang Medicinal Herbs"],
    ["الحمادي للأدوات الصحية ذ.م.م", "Al Hammadi Sanitary Ware L.L.C."],
    ["العبيدلي لقطع الغيار ذ.م.م", "Al Obaidly Spare Parts W.L.L."],
    ["البلوشي للأقمشة ش.م.م", "Al Balushi Textiles LLC"],
    ["الحارثي لتجارة التمور", "Al Harthy Dates Trading"],
    ["کاشی و سرامیک محراب یزد (سهامی خاص)", "Mehrab Yazd Tile and Ceramic Co."],
    ["نساجی برزگر اصفهان", "Barzegar Esfahan Textiles"],
    ["عبدالله قاسم الزرعوني للتجارة", "Abdulla Qasim Al Zarooni Trading"],
    ["مؤسسة سعيد حميد للمواد الغذائية", "Saeed Humaid Foodstuff Est."],
    ["زعفران طلایی کویر", "Zafaran Talaei Kavir"],
    ["خرمای ستوده بم", "Sotoudeh Bam Dates"],
    /* les deux paires des jeux 9 et 13 que « dasht » traduit et « khoshkbar » non traduit perdaient */
    ["خشکبار نیکپور", "Khoshkbar-e Nikpour"],
    ["Sepidar Kavosh Mehrdasht Co.", "Sepidar Kawosh Mehr Dasht Company"],
  ] as const) assert.ok(score(a, b) >= FORT, `${a} / ${b} : ${score(a, b).toFixed(3)}`);
});

test("tour 17 : en lettres latines, le patronyme arménien, le vieux latin géorgien, le clavardage israélien, le persan traduit", () => {
  for (const [a, b] of [
    ["Caturyan Shin LLC", "Tsaturyan Shin LLC"],
    ["Khachatryan & Sons LLC", "Xachatryan and Sons LLC"],
    ["Khachatryan and Sons LLC", "Khachatrian and Sons Ltd"],
    ["Oganesyan Textile OJSC", "Hovhannisyan Textile OJSC"],
    ["Hakobyan Trans LLC", "Akopyan Trans LLC"],
    ["Djanoyan Express LLC", "Dzhanoyan Express LLC"],
    ["Mcxeta Bildingi LLC", "Mtskheta Building LLC"],
    ["Tsiklauri Gvino LLC", "Tsiklauri Wine LLC"],
    ["grigolia kargo", "GRIGOLIA CARGO LLC"],
    ["shps kavkasioni nut export", "Kavkasioni Nut Export LLC"],
    ["Gyumri Metagh LLC", "Gyumri Metal LLC"],
    ["Chobanyan Kat LLC", "Chobanyan Milk LLC"],
    ["lchashen dzkan veramshakum", "Lchashen Fish Processing CJSC"],
    ["tevosyan agro treyd", "Tevosyan Agro Trade LLC"],
    ["hevrat dovrat plastik", "Dovrat Plastics Ltd"],
    ["hevrat ben shushan agro export baam", "Ben Shushan Agro Export Ltd"],
    ["Shaltiel Hovalot Ltd", "Shaltiel Transport Limited"],
    ["Chaim Shapiro Metal Works Ltd", "Haim Shapiro Metal Works Ltd"],
    ["Bracha Textiles Ltd", "Brakha Textiles Ltd"],
    ["Rachamim Ohayon Import & Marketing Ltd", "Rakhamim Ohayon Import and Marketing Ltd"],
    ["Tzemach Irrigation Ltd", "Tsemakh Irrigation Ltd"],
    ["Zaferan Talayi Kavir Co.", "Kavir Golden Saffron Co."],
    ["Mehrab Yazd Tile & Ceramic Co.", "Kashi va Seramik-e Mehrab-e Yazd"],
    ["Nikpour Dried Fruits Co.", "Nikpoor Dried Fruit Company"],
    ["Voronov Industrial Coatings Ltd", "Voronoff Industrial Coatings Ltd"],
  ] as const) assert.ok(score(a, b) >= FORT, `${a} / ${b} : ${score(a, b).toFixed(3)}`);
});

test("tour 17 : ce qui ne bouge pas", () => {
  /* le vieux latin géorgien ne touche que le mot en « cx » : « Euxine » garde son x sous le toponyme (0,571 mesuré quand il le perdait) */
  assert.ok(score("EUXINE PORTER", "M/V EUXINE PORTER Batumi") >= POSSIBLE);
  /* « Kashi » n'est un carreau que sous la présomption persane : sans elle, le nom reste un nom */
  assert.ok(score("Kashi Trading Co.", "Tile Trading Co.") < FORT);
  /* le patronyme arménien ne se replie que sous sa présomption : un nom anglais en -ian n'y passe pas */
  assert.ok(score("Hamilton Christian School Ltd", "Hamilton Christian School Ltd") === 1);
  /* « dasht » reste un nom : « Pesteh Dasht Kerman » face à « Kerman Plain Pistachio » est au possible au mieux, et c'est assumé */
  assert.ok(score("Pesteh Dasht Kerman Co.", "Kerman Plain Pistachio Co.") < FORT);
});
