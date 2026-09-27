/**
 * LA MARQUE VIETNAMIENNE ET SA TABLE (tour 9, voie abréviations) : ce qu'un registre vietnamien écrit et qu'un
 * connaissement anglais traduit. « Công Ty » est la société, « TNHH » la SARL, « TP. » la ville : la préparation les
 * lit déjà (PHRASES, FORMES, LOCUTIONS). Mais « May » (garment) est aussi un mot anglais et un prénom, « Dệt » (textile)
 * s'écrit « det » sans ses signes : ces mots-là ne se traduisent que sous la marque, jamais comme des mots anglais
 * (jeu 7 : « HO CHI MINH CITY GIA HUY GARMENT » face à « Công Ty May Gia Huy TP. Hồ Chí Minh », 0,672, « may » et
 * « garment » deux mots rares sans répondant). Pure table et fonction sans état : la préparation l'importe.
 */

/** Les lettres que seul le vietnamien écrit : đ, le cornu (ơ, ư), le crochet (ả, ẻ…), le point souscrit (ạ, ệ…),
 *  et un ton posé SUR un circonflexe ou une brève (ồ, ế, ắ), que nulle autre orthographe latine n'empile. Le seul
 *  circonflexe (« Côte », « Hôtel ») et le seul aigu ne suffisent pas : c'est du français. */
const ECRITURE_VIETNAMIENNE = /[đĐ]|[̛̣̉]|[̂̆][̣̀́̃̉]/u;
/** Les formes et sigles vietnamiens, tels que la normalisation les laisse (avant que PHRASES ne les ôte). */
const FORMES_VIETNAMIENNES = / (?:cong ty|tnhh|co phan|cty|cty cp|hochiminh|tp ho chi minh) /;

/** Le nom est vietnamien : par son écriture (les signes empilés du quốc ngữ), ou par sa forme (« Công Ty »,
 *  « TNHH », « Cổ Phần », « Cty ») dans le texte préparé. Sans l'un ni l'autre, « May Trading » reste anglais. */
export function estVietnamien(brut: string, texte: string): boolean {
  return ECRITURE_VIETNAMIENNE.test(brut.normalize("NFD")) || FORMES_VIETNAMIENNES.test(texte);
}

/** Les génériques vietnamiens qu'on ne traduit QUE sous la marque, parce qu'ils sont aussi des mots d'ailleurs :
 *  « may » (may mặc, la confection : garment), « det » (dệt, le tissage : textile), « bao bi » (bao bì, l'emballage).
 *  Les autres génériques (thương mại, xuất nhập khẩu, dịch vụ, vận tải, dệt may…) sont dans LOCUTIONS, sans marque :
 *  leurs deux mots ne se confondent avec rien. */
export const LOCUTIONS_VIETNAMIENNES: readonly [string, string][] = [
  [" may ", " garment "], [" det ", " textile "], [" bao bi ", " packaging "],
];
