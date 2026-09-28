/**
 * LE LAO SUR LES DOCUMENTS (tour 18, jeu 22). L'écriture lao est sœur de la thaïe, lettre pour lettre (ກ ก, ຂ ข, ຄ ค, ງ ง…) :
 * un nom lao se lit par le lecteur thaï (ecritures.ts) une fois ses lettres ramenées aux thaïes, avec ses propres mots du
 * commerce et ses formes (ບໍລິສັດ … ຈຳກັດ, la société limitée ; ການຄ້າ le commerce ; ຂົນສົ່ງ le transport) lus avant. Le latin
 * de Vientiane suit l'usage français (Savannakhèt, Phonesavanh, Chaleunxay : x pour ຊ, ou pour u, -anh pour -an, eu pour ເ-ີ)
 * ou l'anglais (Savannakhet, Phonsavan) : ces plis vivent dans `pliThai`, sous la marque thaïe, que le lao partage. Ce fichier
 * ne tient que des tables du monde : les lettres, les mots du commerce, les toponymes et les éléments de noms qui disent le lao.
 */

/** Les lettres lao et leur sœur thaïe. Le ວ (v) est le ว, le ຊ (x) le ซ, le ຮ (h) le ฮ, le ຢ (y) le ย, le ຣ (r) le ร ;
 *  ໜ ໝ sont หน หม, ຼ le ล d'un groupe ; le ົ (mai kon) est la voyelle implicite o d'une syllabe fermée, le ໍ le อ posé après
 *  la consonne (ບໍ່ : บ่อ, le ton passant devant lui), le ົ (mai kon) le ็ d'une syllabe fermée (ສົມ : สม็ som), le ຽ le เ-ีย,
 *  et le ີ derrière ເ le ິ de เ-ิ (ເລີນ : เลิน loen). */
const LAO_EN_THAI: ReadonlyMap<string, string> = new Map(Object.entries({
  "ກ": "ก", "ຂ": "ข", "ຄ": "ค", "ງ": "ง", "ຈ": "จ", "ສ": "ส", "ຊ": "ซ", "ຍ": "ย", "ດ": "ด", "ຕ": "ต", "ຖ": "ถ", "ທ": "ท", "ນ": "น",
  "ບ": "บ", "ປ": "ป", "ຜ": "ผ", "ຝ": "ฝ", "ພ": "พ", "ຟ": "ฟ", "ມ": "ม", "ຢ": "ย", "ຣ": "ร", "ລ": "ล", "ວ": "ว", "ຫ": "ห", "ອ": "อ", "ຮ": "ฮ",
  "ໜ": "หน", "ໝ": "หม", "ຼ": "ล",
  "ະ": "ะ", "ັ": "ั", "າ": "า", "ຳ": "ำ", "ິ": "ิ", "ີ": "ี", "ຶ": "ึ", "ື": "ื", "ຸ": "ุ", "ູ": "ู", "ເ": "เ", "ແ": "แ", "ໂ": "โ", "ໃ": "ใ", "ໄ": "ไ",
  "ໍ": "อ", "ົ": "็", "ໆ": "ๆ", "່": "่", "້": "้", "໊": "๊", "໋": "๋", "໌": "์", "ຯ": "ฯ",
}));

/** Les mots lao que le registre anglais TRADUIT : les formes (ບໍລິສັດ … ຈຳກັດ, ມະຫາຊົນ), le commerce, les lieux. Les valeurs sont
 *  les mots que la préparation connaît déjà (borisat, jamkat : la même famille que le thaï). */
const GENERIQUES_LAO: ReadonlyMap<string, string> = new Map(Object.entries({
  "ບໍລິສັດ": "borisat", "ຈຳກັດ": "jamkat", "ມະຫາຊົນ": "pcl", "ຫ້າງຫຸ້ນສ່ວນ": "lp", "ວິສາຫະກິດ": "enterprise", "ກຸ່ມ": "group", "ແລະ": "",
  "ການຄ້າ": "trading", "ຄ້າຂາຍ": "trading", "ຂົນສົ່ງ": "transport", "ການຂົນສົ່ງ": "transport", "ໂລຈິສຕິກ": "logistics", "ກະສິກຳ": "agriculture",
  "ບໍ່ແຮ່": "mining", "ແຮ່": "mineral", "ກາເຟ": "coffee", "ພັດທະນາ": "development", "ກໍ່ສ້າງ": "construction", "ອຸດສາຫະກຳ": "industry",
  "ອາຫານ": "food", "ປະມົງ": "fishery", "ນຳເຂົ້າ": "import", "ສົ່ງອອກ": "export", "ໄມ້": "timber", "ໂຮງແຮມ": "hotel", "ທ່ອງທ່ຽວ": "tourism",
  "ພະລັງງານ": "energy", "ໄຟຟ້າ": "electric", "ບໍລິການ": "services", "ລົງທຶນ": "investment", "ສາກົນ": "international", "ທະນາຄານ": "bank",
  "ປະກັນໄພ": "insurance", "ເຄື່ອງດື່ມ": "beverage", "ນ້ຳຕານ": "sugar", "ເຂົ້າ": "rice", "ຢາງ": "rubber", "ຜະລິດ": "production", "ວິສະວະກຳ": "engineering",
  "ລາວ": "lao", "ວຽງຈັນ": "vientiane", "ນະຄອນຫຼວງ": "capital", "ສະຫວັນນະເຂດ": "savannakhet", "ປາກເຊ": "pakse", "ຫຼວງພະບາງ": "luang prabang",
  "ຈຳປາສັກ": "champasak", "ຄຳມ່ວນ": "khammouane", "ຊຽງຂວາງ": "xieng khouang", "ບໍລິຄຳໄຊ": "bolikhamxay",
}));
function alternative(table: ReadonlyMap<string, string>): RegExp {
  const cles = [...table.keys()].sort((a, b) => b.length - a.length).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(cles.join("|"), "gu");
}
const CLES_LAO = alternative(GENERIQUES_LAO);
/** Le lao ramené au thaï : les chiffres, les mots de la table (les plus longs devant), le ຽ en เ-ีย, puis lettre à lettre.
 *  Le lecteur thaï (ecritures.ts) fait le reste. */
export function laoEnThai(nom: string): string {
  return nom.replace(/[໐-໙]/gu, (c) => String(c.codePointAt(0)! - 0x0ed0))
    .replace(CLES_LAO, (m) => ` ${GENERIQUES_LAO.get(m) ?? m} `)
    .replace(/([ກ-ຮໜໝ])ຽ/gu, "เ$1ีย")
    .replace(/ເ([ກ-ຮໜໝ])ີ/gu, "ເ$1ິ")
    .replace(/ໍ([່້໊໋])/gu, "$1ໍ")
    .replace(/[຀-໿]/gu, (c) => LAO_EN_THAI.get(c) ?? c);
}

/** Les mots qui marquent un nom lao romanisé : le pays, ses villes et provinces, la monnaie, et les éléments de noms que seul le
 *  lao écrit ainsi (le -xay de ໄຊ, le -vanh de ວັນ à la française, le Boun- de ບຸນ, le Vongsa- de ວົງສາ). */
export const MARQUEURS_LAO: ReadonlySet<string> = new Set([
  "lao", "laos", "laotian", "vientiane", "vangvieng", "luangprabang", "luang", "prabang", "savannakhet", "savannakhét", "pakse", "champasak",
  "khammouane", "thakhek", "xieng", "khouang", "phonsavan", "phonesavanh", "attapeu", "bolikhamxay", "oudomxay", "phongsaly", "bokeo",
  "sayaboury", "xaignabouli", "houaphanh", "salavan", "saravane", "sekong", "kip", "lak",
]);
export function estMarqueurLao(j: string): boolean {
  return MARQUEURS_LAO.has(j) || (j.length >= 6 && /(xay|vanh|savan|savanh)$/.test(j)) || (j.length >= 6 && /^(boun|vongsa|wongsa|phou)/.test(j));
}
