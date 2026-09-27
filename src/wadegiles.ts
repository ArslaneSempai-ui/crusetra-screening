/**
 * LE WADE-GILES RAMENÉ AU PINYIN (tour 9, voie écritures) : « Chen-ch'iao Hardware Co., Ltd. » est « Zhenqiao Hardware
 * Co., Ltd. » (jeu 13, 0,387 : l'apostrophe soudée et le tiret coupé faisaient « chen chiao », deux mots contre un). Pure
 * fonction sans état : la préparation l'appelle avant `romaniser`, parce que l'apostrophe et le tiret, que la soudure et
 * la normalisation effacent ensuite, sont ce qui dit le système.
 *
 * Le Wade-Giles écrit l'aspiration par une APOSTROPHE (ch', ts', tz', p', t', k') et sépare les syllabes d'un nom par un
 * TIRET : l'apostrophe est sa signature, aucun autre système d'un nom de société ne la met après ces consonnes. Un mot
 * qui la porte se convertit syllabe par syllabe, chaque partie du tiret étant une syllabe ; si une partie n'est pas une
 * syllabe du Wade-Giles (« Ch'ng », le patronyme hokkien 庄), le mot reste tel quel. Les syllabes converties restent des
 * mots séparés (« Zhen Qiao ») : le pinyin des registres les soude (Zhenqiao) ou non (Zhen Qiao), et c'est le bloc du
 * score qui lit les deux (voir `scorePrepares` : « Kuang Yu » est « Guangyu »). Soudées ici, elles ôtaient au bloc les
 * paires de Taïwan dont la ville reste écrite à l'ancienne (« Kaohsiung Ch'ung-Mao » face à « Gaoxiong Chongmao », 0,875
 * avant, 0,700 soudé : trois mots contre trois, plus d'orphelins à coller, et Kaohsiung seul face à Gaoxiong).
 *
 * Les correspondances sont celles des deux systèmes, pas celles d'un jeu : p, t, k non aspirés sont b, d, g ; ch est zh,
 * ou j devant i et ü ; ch' est ch, ou q devant i et ü ; hs est x ; ts et tz sont z, ts' et tz' c ; j est r ; ss et sz
 * sont s ; -ung est -ong, -ien -ian, -ieh -ie, -ih -i (chih zhi), -üeh -ue, -uei -ui, erh er ; o est e après k, k' et h
 * (ko ge), uo après les autres consonnes (to duo), o après les labiales (po bo) ; tzu, ssu, szu sont zi, si.
 */

/** La signature : une apostrophe d'aspiration après ch, ts, tz, p, t ou k, devant une voyelle. */
const SIGNATURE = /(?:ch|ts|tz|[ptk])['’ʻʼ`](?=[aeiouü])/iu;
const MOT = /\p{L}[\p{L}'’ʻʼ`:-]*\p{L}/gu;
const APOSTROPHE = /['’ʻʼ`]/g;

/** Les initiales du Wade-Giles, de la plus longue à la plus courte, et leur pinyin ; « ch » et « ch' » se décident
 *  sur la finale ; le vide est l'initiale nulle. */
const INITIALES: readonly (readonly [string, string])[] = [
  ["ch'", "ch"], ["ts'", "c"], ["tz'", "c"], ["ch", "zh"], ["hs", "x"], ["ts", "z"], ["tz", "z"], ["ss", "s"], ["sz", "s"], ["sh", "sh"],
  ["p'", "p"], ["t'", "t"], ["k'", "k"], ["p", "b"], ["t", "d"], ["k", "g"], ["j", "r"], ["m", "m"], ["n", "n"], ["l", "l"], ["f", "f"],
  ["h", "h"], ["s", "s"], ["w", "w"], ["y", "y"], ["", ""],
];
/** Les finales du Wade-Giles (ü écrit ü) et leur pinyin après une consonne. */
const FINALES: ReadonlyMap<string, string> = new Map(Object.entries({
  a: "a", ai: "ai", an: "an", ang: "ang", ao: "ao", e: "e", ei: "ei", en: "en", eng: "eng", erh: "er", er: "er", i: "i", ih: "i",
  ia: "ia", iao: "iao", iang: "iang", ieh: "ie", ie: "ie", ien: "ian", in: "in", ing: "ing", iu: "iu", iung: "iong", o: "uo", ou: "ou",
  u: "u", ua: "ua", uai: "uai", uan: "uan", uang: "uang", uei: "ui", ui: "ui", un: "un", ung: "ong", uo: "uo",
  "ü": "u", "üan": "uan", "üeh": "ue", "üe": "ue", "ün": "un",
}));
/** Les finales après l'initiale nulle, le y ou le w du Wade-Giles (yen yan, yeh ye, yu you, yü yu, yung yong). */
const FINALES_NULLES: ReadonlyMap<string, string> = new Map(Object.entries({
  a: "a", ai: "ai", an: "an", ang: "ang", ao: "ao", e: "e", ei: "ei", en: "en", eng: "eng", erh: "er", er: "er", o: "o", ou: "ou",
  i: "yi", ien: "yan", en_y: "yan", eh: "ye", in: "yin", ing: "ying", iu: "you", u: "you", ung: "yong", ang_y: "yang", ao_y: "yao", a_y: "ya",
  "ü": "yu", "üan": "yuan", "üeh": "yue", "üe": "yue", "ün": "yun",
}));
const FINALES_W: ReadonlyMap<string, string> = new Map(Object.entries({
  u: "wu", a: "wa", ai: "wai", an: "wan", ang: "wang", ei: "wei", en: "wen", eng: "weng", o: "wo",
}));
const FINALES_Y: ReadonlyMap<string, string> = new Map(Object.entries({
  a: "ya", ai: "yai", ao: "yao", ang: "yang", e: "ye", eh: "ye", en: "yan", i: "yi", in: "yin", ing: "ying", o: "yo", u: "you", ung: "yong",
  "ü": "yu", "üan": "yuan", "üeh": "yue", "üe": "yue", "ün": "yun",
  /* le y du Wade-Giles ne précède ü que dans yüan, yüeh, yün : sans l'umlaut, ce sont eux */
  uan: "yuan", ueh: "yue", ue: "yue", un: "yun",
}));

/** Une syllabe du Wade-Giles en pinyin, ou undefined si ce n'en est pas une. */
export function syllabeWadeGiles(syllabe: string): string | undefined {
  const s = syllabe.toLowerCase().replace(APOSTROPHE, "'").replace(/u:/g, "ü").replace(/ê/g, "e");
  for (const [wg, py] of INITIALES) {
    if (!s.startsWith(wg)) continue;
    let finale = s.slice(wg.length);
    if (finale === "") return undefined;
    if (wg === "") return FINALES_NULLES.get(finale);
    if (wg === "w") return FINALES_W.get(finale);
    if (wg === "y") return FINALES_Y.get(finale);
    /* hs ne s'écrit que devant i et ü : hsu est hsü (xu), hsuan hsüan (xuan), hsueh hsüeh (xue) */
    if (wg === "hs" && finale.startsWith("u")) finale = "ü" + finale.slice(1);
    /* et l'umlaut que la frappe perd : chueh est chüeh (jue), il n'existe pas sans lui ; chuan reste chuan (zhuan) */
    if ((wg === "ch" || wg === "ch'" || wg === "l" || wg === "n") && finale === "ueh") finale = "üeh";
    let f = FINALES.get(finale);
    if (f === undefined) return undefined;
    let ini = py;
    /* ch et ch' : j et q devant i et ü (chi ji, ch'iao qiao), zh et ch devant le reste et devant ih (chih zhi) */
    if (wg === "ch" || wg === "ch'") {
      const palatale = finale !== "ih" && /^[iü]/.test(finale);
      ini = wg === "ch" ? (palatale ? "j" : "zh") : (palatale ? "q" : "ch");
    }
    /* tzu, tz'u, ssu, szu : la voyelle apicale, i en pinyin (zi, ci, si) */
    if ((wg === "tz" || wg === "tz'" || wg === "ss" || wg === "sz") && finale === "u") f = "i";
    /* o : e après les vélaires (ko ge, ho he), o après les labiales (po bo, mo mo, fo fo), uo ailleurs (to duo, so suo) */
    if (finale === "o") f = /^[kh]/.test(wg) ? "e" : /^[pmf]/.test(wg) ? "o" : "uo";
    return ini + f;
  }
  return undefined;
}

/** Un nom dont les mots au Wade-Giles (ceux qui portent l'apostrophe d'aspiration) sont récrits en pinyin, une syllabe
 *  par mot ; tout autre mot reste tel quel. */
export function wadeGiles(nom: string): string {
  if (!SIGNATURE.test(nom)) return nom;
  return nom.replace(MOT, (mot) => {
    if (!SIGNATURE.test(mot)) return mot;
    const parties = mot.split("-").map(syllabeWadeGiles);
    if (parties.some((p) => p === undefined)) return mot;
    const majuscule = /^\p{Lu}/u.test(mot);
    return parties.map((p) => (majuscule ? p![0]!.toUpperCase() + p!.slice(1) : p!)).join(" ");
  });
}
