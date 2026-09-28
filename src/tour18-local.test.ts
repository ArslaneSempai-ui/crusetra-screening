/**
 * TOUR 18, VOIE LOCALE : les résidus latins des documents de Bangkok et de Yangon (jeu 22). La société de personnes thaïe
 * « Ltd., Part. » gardée comme forme, la coupe de ligne tombée dans un mot recollée (« FOO D », « LIMITE D », « TICAR ET »),
 * le siège en queue, le registre thaï, l'adresse thaïe et birmane derrière la forme, les ports du golfe de Thaïlande et du
 * Mékong, le 5 d'un tampon lu S.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreNoms, variantes, recollerLaCoupe } from "./entites.ts";
import { frequencesDesListes } from "./frequences.ts";

const f = frequencesDesListes();
const score = (a: string, b: string) => scoreNoms(f, a, b);
const FORT = 0.81;
const POSSIBLE = 0.80;

test("tour 18 : les sept paires du jeu 22 que les résidus recollés font passer au fort", () => {
  for (const [a, b] of [
    ["KASEMSAWAT FROZEN FOO D CO LTD", "Kasem Sawat Frozen Food Company Limited"],
    ["Rungrueang Saeng Dao Company Limited", "RUNGRUEANG SAENGDAO CO LTD เลขทะเบียน 0105559012347"],
    ["ศรีระยอง 12", "SRI RAYONG 12 (Laem Chabang)"],
    ["SAMSUN TAHIL DEPOLAMA VE DIS TICAR ET ANONIM SIRKETI", "Samsun Tahıl Depolama ve Dış Ticaret A.Ş."],
    ["PHONGSAK INTERTRADE CO LTD99/12 MOO 4 BANG NA BANGKOK", "Phongsak Intertrade Co., Ltd."],
    ["KAUNG MYAT HTWE COMPANY LIMITE D NO 7 32ND ST YGN", "Kaung Myat Htwe Co., Ltd."],
    ["MEKONG LOTUS", "BARGE MEKONG LOTUS (Phnom Penh)"],
  ] as const) assert.ok(score(a, b) >= FORT, `${a} / ${b} : ${score(a, b).toFixed(3)}`);
});

test("tour 18 : la coupe recollée, ses gardes, la société de personnes thaïe et le siège", () => {
  assert.equal(recollerLaCoupe("KASEMSAWAT FROZEN FOO D CO LTD"), "KASEMSAWAT FROZEN FOOD CO LTD");
  assert.equal(recollerLaCoupe("PONGSAKDI INTERTRADE COMPANY LIMI TED"), "PONGSAKDI INTERTRADE COMPANY LIMITED");
  /* « PANAMA S A » : la lettre seule commence une forme épelée, rien ne se recolle */
  assert.equal(recollerLaCoupe("CIA MARITIMA DEL GOLFO DE PANAMA S A"), undefined);
  /* « CO LTD » et « M V » : deux mots, pas une coupe */
  assert.equal(recollerLaCoupe("BLUE OCEAN CO LTD"), undefined);
  /* la société de personnes thaïe n'est pas la Co., Ltd. : deux immatriculations (1,000 avant) */
  assert.ok(score("Chaiyapruek Agro Co., Ltd.", "Chaiyapruek Agro Ltd., Part.") <= POSSIBLE);
  /* le siège tombe ; le Ho coréen d'un navire reste (H.O. ne se lit qu'avec ses points) */
  assert.ok(variantes("Thanaphan Udom Co., Ltd. (Head Office)").includes("Thanaphan Udom Co., Ltd."));
  assert.ok(variantes("Wiset Phokhaphan Co., Ltd. สำนักงานใหญ่").some((v) => !/สำนักงานใหญ่/.test(v)));
  assert.equal(variantes("Dalmuri Ho")[0], "Dalmuri Ho", "le Ho coréen n'est pas un H.O.");
  assert.ok(variantes("Dalmuri Trading Co., Ltd. H.O.").includes("Dalmuri Trading Co., Ltd."));
  /* le 5 en tête d'un mot de tampon est un S */
  assert.ok(score("5RI THANA COLD STORAGE", "Sri Thana Cold Storage Co., Ltd.") >= FORT, "5RI lu SRI");
  /* Sri contre Si est le pli thaï de la voie agent : la paire du jeu reste au possible ici */
  /* limites connues du jeu 22 : le navire nu au pluriel, le pays entre parenthèses d'un seul côté */
  assert.ok(score("KOH KONG TRADER", "KOH KONG TRADERS") >= FORT);
});
