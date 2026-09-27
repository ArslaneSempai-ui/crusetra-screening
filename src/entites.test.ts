import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  preparerEntite, analyserEntite, preparerNom, scorePrepares, scoreBrut, scoreNoms, variantes, squelette, voyelles, abrege, motsDistincts, lemme,
  variationVocalique, voyelleEpenthetique, squeletteLongue, lettrePerdue, PERDU, fauteDeFrappe, composesDistincts, simMot, pluriel, LU_UN,
  estSyllabeIsolee, compose, gerondif, regionDeRegistre, descripteur,
  tronque, estCoupe, apport, simMinimale, choisirSeuils, marquesEnConflit, frequencesDe, mesurerJeux, qualificatifSoude,
  poidsDuMot, CHEMINS_APPRENTISSAGE, FREQUENCES_UNIFORMES, FAUSSES_ALERTES_MAX_FORT, SEUIL_POSSIBLE, lecturesDe, pliCantonais, pliTamoul,
  variantesTypees, plafondDesLectures, mentionDeSuccursale, succursalesCompatibles, numeroDeRegistre, formePlurielle, sembleCoupe,
  pliJaponais, suffixeEtablissement, pliVoyellesCoreennes,
} from "./entites.ts";
import { validerPaires, type TableDUnPalier } from "./measure.ts";
import { hangulEnLatin, pinyinDe, cleAbjad, cleAbjadSansTa, romaniser, CHEMIN_PINYIN, CHEMIN_JYUTPING, jyutpingDe, hongkong, thaiEnLatin, tamoulEnLatin } from "./ecritures.ts";

const f = FREQUENCES_UNIFORMES;
const score = (a: string, b: string) => scoreNoms(f, a, b);

test("préparation : les formes juridiques partent, devant, derrière ou en toutes lettres", () => {
  for (const [a, b] of [
    ["Orion Maritime Ltd", "Orion Maritime Limited"],
    ["OOO Kamaflot", "Kamaflot OOO"],
    ["Lindqvar Hydraulik GmbH", "Lindqvar Hydraulik Gesellschaft mit beschränkter Haftung"],
    ["Qirvani Industrial Supplies FZE", "Qirvani Industrial Supplies Free Zone Establishment"],
    ["Kelubi Serantau Timber Sdn. Bhd.", "Kelubi Serantau Timber Sendirian Berhad"],
    ["Établissements Garnavel et Compagnie", "Ets Garnavel & Cie"],
    ["Compañía Minera Huallacocha S.A.C.", "Cía. Minera Huallacocha SAC"],
  ]) assert.equal(preparerEntite(a), preparerEntite(b), `${a} / ${b}`);
});

test("préparation : locutions, articles, préfixes de navire, numéros, ponctuation qui porte le sens", () => {
  assert.equal(preparerEntite("Camlibelen Dokum San. ve Tic. Ltd. Sti."), preparerEntite("Çamlıbelen Döküm Sanayi ve Ticaret Limited Şirketi"));
  assert.equal(preparerEntite("Ash-Shuraymi Industrial Gases Co."), "al shuraymi industrial gases");
  assert.equal(preparerEntite("M/V Golden Crane"), "golden crane");
  assert.equal(preparerEntite("Motor Yacht Veltrisse"), "veltrisse");
  assert.equal(preparerEntite("LPG/C Hollin Breeze"), "hollin breeze");
  assert.equal(preparerEntite("SHIRATSUNE MARU NO18"), preparerEntite("Shiratsune Maru No. 18"));
  assert.equal(preparerEntite("F.lli Brunaccini snc"), "brothers brunaccini", "F.lli est Fratelli, et Fratelli se traduit");
  assert.equal(preparerEntite("Łódź Transport"), "lodz transport");
  assert.equal(preparerEntite("Company Limited"), "company limited", "jamais vide : un nom tout en formes se rend normalisé");
  assert.ok(analyserEntite("Northwick Petrochem. Dist. Intl. Inc.").abreges.has("petrochem"));
});

test("une forme qui ne se place qu'à la fin reste un mot en tête : « Ag. Prokopis » n'est pas une AG", () => {
  assert.equal(preparerEntite("Ag. Prokopis II"), "ag prokopis ii");
  assert.equal(preparerEntite("Prokopis Trading AG"), "prokopis trading");
});

test("des Map, pas des objets : « constructor » ou « toString » dans un nom ne casse rien", () => {
  for (const n of ["Constructor Holdings", "toString Trading", "__proto__ Marine", "hasOwnProperty Ltd"]) {
    assert.equal(score(n, n), 1, n);
  }
});

test("les numéros : deux navires numérotés différemment sont deux navires ; II et 2 sont un", () => {
  assert.equal(score("Hong Da 1", "Hong Da 8"), 0);
  assert.equal(score("Karina II", "Karina 2"), 1);
  assert.ok(Math.abs(score("Ocean Pearl", "Ocean Pearl II") - 0.8) < 1e-9, "un numéro d'un seul côté abaisse à 0,8");
});

test("les marques : pays disjoints ou navire contre société abaissent, les traductions non", () => {
  const m = (n: string) => analyserEntite(n);
  assert.equal(marquesEnConflit(m("Wexmoor Engineering GmbH"), m("Wexmoor Engineering Inc.")), true);
  assert.equal(marquesEnConflit(m("Ekinova Makina A.Ş."), m("Ekinova Makina GmbH")), true);
  assert.equal(marquesEnConflit(m("MV Orlessa Dawn"), m("Orlessa Dawn Shipping Ltd")), true);
  assert.equal(marquesEnConflit(m("Kamaflot OOO"), m("Kamaflot LLC")), false, "OOO se traduit LLC");
  assert.equal(marquesEnConflit(m("Lornavale Maritime Pte. Ltd."), m("Lornavale Maritime Private Limited")), false);
  assert.equal(marquesEnConflit(m("Dahwon Tongsang Jusikhoesa"), m("Dahwon Tongsang Co., Ltd.")), false);
});

test("le squelette ramène les romanisations, le repli des voyelles ne vaut que pour l'égalité", () => {
  assert.notEqual(squelette("khimtekhnika"), squelette("chimtechnika"),
    "kh (х) et ch (ش, ou le ch allemand pour х) sont deux classes : les fondre faisait de Shing et Hing le même mot ; ce cas allemand reste au possible");
  assert.equal(squelette("shurouq"), squelette("chourouk"), "ش s'écrit sh ou ch");
  assert.notEqual(squelette("shing"), squelette("hing"));
  assert.equal(squelette("sowtransflot"), squelette("sovtransflot"));
  assert.equal(squelette("gyeongbo"), squelette("kyongbo"));
  assert.equal(squelette("gruschewskaja"), squelette("grushevskaya"));
  assert.equal(squelette("ghoncheh"), squelette("qonche"));
  assert.equal(voyelles(squelette("nujoom")), voyelles(squelette("nojoum")));
  assert.notEqual(voyelles(squelette("grain")), voyelles(squelette("green")), "mesuré : le repli approché rendait grain et green voisins");
});

test("abréviation : l'initiale et les lettres dans l'ordre, jamais un début de mot ni un mot ordinaire", () => {
  assert.equal(abrege("engg", "engineering"), true);
  assert.equal(abrege("mktg", "marketing"), true);
  assert.equal(abrege("sun", "sunshine"), false);
  assert.equal(abrege("brk", "brokerage"), true);
  assert.equal(abrege("pm", "petrochemical"), false, "deux lettres se trouvent dans la moitié des mots");
  assert.equal(abrege("star", "steamer"), false);
  assert.equal(tronque("engineer", "engineering"), true);
  assert.equal(tronque("eng", "engineering"), true, "trois lettres suffisent quand le mot entier est long");
  assert.equal(tronque("eng", "engine"), false, "trois lettres devant un mot court : un autre mot");
  assert.equal(tronque("en", "engineering"), false);
});

test("le champ de 35 caractères : un nom coupé se compare au début de l'autre", () => {
  const long = "Varkessian-Holm Heavy Lift Engineering and Marine Services Limited";
  const coupe = long.slice(0, 35);
  assert.equal(estCoupe(coupe), true);
  const P = (n: string) => preparerNom(f, n);
  assert.ok(scoreBrut(f, coupe, P(coupe), long, P(long)) > scorePrepares(P(coupe), P(long)));
  assert.equal(scoreBrut(f, coupe, P(coupe), long, P(long)), scoreBrut(f, long, P(long), coupe, P(coupe)), "symétrique");
});

test("simMinimale est l'inverse d'apport : l'index qui s'appuie dessus ne perd rien", () => {
  for (let s = 0.5; s <= 1; s += 0.01) assert.ok(Math.abs(apport(simMinimale(s)) - s) < 1e-9);
});

test("les poids : un mot que les listes portent souvent pèse moins qu'un mot qu'elles ignorent", () => {
  const fr = frequencesDe([["Alpha Trading"], ["Beta Trading"], ["Gamma Trading"], ["Kestrel Marine"]]);
  assert.ok(poidsDuMot(fr, "trading") < poidsDuMot(fr, "kestrel"));
  assert.ok(poidsDuMot(fr, "inconnu") > poidsDuMot(fr, "kestrel"));
});

test("les seuils : possible = le niveau des plafonds ; fort = au-dessus, le plus bas sous 5 % de fausses alertes", () => {
  const cellule = (succes: number, n: number) => ({ succes, n, taux: succes / n, bas: 0, haut: 1 });
  const t: TableDUnPalier = {};
  for (let i = 0; i <= 50; i++) {
    const s = (50 + i) / 100;
    t[s.toFixed(2)] = { rappel: cellule(Math.max(0, 100 - Math.max(0, i - 20) * 3), 100), fauxPositifs: cellule(Math.max(0, 40 - i), 100) };
  }
  const r = choisirSeuils(t);
  assert.equal(r.fort.seuil, 0.85, "le premier seuil où les fausses alertes tombent à 5 %");
  assert.ok(r.fort.fauxPositifs.taux <= FAUSSES_ALERTES_MAX_FORT);
  assert.ok(Math.abs(r.possible.seuil - SEUIL_POSSIBLE) < 1e-9 && r.possible.seuil < r.fort.seuil, "le possible est le niveau des plafonds");
});

test("les jeux d'apprentissage : valides, et leur provenance dit leur rôle", () => {
  for (const u of CHEMINS_APPRENTISSAGE) {
    const jeu = JSON.parse(readFileSync(u, "utf8"));
    assert.ok(validerPaires(jeu).length >= 80, u.pathname);
    assert.match(jeu.provenance, /invented/);
  }
  assert.match(JSON.parse(readFileSync(CHEMINS_APPRENTISSAGE[2]!, "utf8")).provenance, /TRAINING set/,
    "un jeu témoin étudié devient un jeu d'apprentissage, et le dit");
});

test("le score : dans [0, 1] et symétrique sur tous les jeux d'apprentissage", () => {
  const m = mesurerJeux(f, CHEMINS_APPRENTISSAGE.map((u) => readFileSync(u, "utf8")));
  assert.equal(m.jeux.length, CHEMINS_APPRENTISSAGE.length);
  for (const u of CHEMINS_APPRENTISSAGE) {
    for (const x of JSON.parse(readFileSync(u, "utf8")).paires as { a: string; b: string }[]) {
      const ab = score(x.a, x.b), ba = score(x.b, x.a);
      assert.ok(ab >= 0 && ab <= 1, `${x.a} / ${x.b}`);
      assert.ok(Math.abs(ab - ba) < 1e-12, `asymétrique : ${x.a} / ${x.b}`);
    }
  }
});

test("les mots collés paient aussi une première lettre différente", () => {
  assert.ok(score("Eliron Logistics Oy", "Oboronlogistics LLC") < 0.74, "mesuré le 27/09 : 0,80 sans la règle");
  assert.ok(score("PetroLink Energy", "Petro Link Energy") > 0.95);
});

test("les variantes : un autre nom annoncé, et les annotations d'un document", () => {
  assert.deepEqual(variantes("LUNARIS DAWN (EX-SELVANA)"), ["LUNARIS DAWN (EX-SELVANA)", "LUNARIS DAWN", "SELVANA"]);
  assert.ok(variantes("Olmsbury Grain Corporation f/k/a Olmsbury Milling Corporation").includes("Olmsbury Milling Corporation"));
  assert.ok(variantes("Quarrington Metals FZE, Jebel Ali Free Zone, Dubai").includes("Quarrington Metals FZE"));
  assert.ok(variantes("MV SALTMARSH HERON (PANAMA FLAG)").includes("MV SALTMARSH HERON"));
  assert.ok(variantes("TRAMONTE VALIANT V.031W").includes("TRAMONTE VALIANT"));
  assert.ok(variantes("Talvora Handelsbank AG, Singapore Branch").includes("Talvora Handelsbank AG"));
  assert.deepEqual(variantes("Ex Libris Trading"), ["Ex Libris Trading"], "« ex » en tête n'annonce aucun ancien nom");
  assert.ok(!variantes("Quarnby Logistics (Shanghai) Co., Ltd.").some((v) => !v.includes("Shanghai")),
    "une ville entre parenthèses est souvent une filiale : elle n'est pas retirée");
});

test("la contenance : un nom retrouvé dans un autre est une alerte POSSIBLE, jamais forte à elle seule", () => {
  /* une liste où « global » et « trading » sont courants, comme dans les vraies listes */
  const fr = frequencesDe(Array.from({ length: 30 }, (_, i) => [i % 2 ? `Global Name${i}` : `Name${i} Trading`]));
  const s = (a: string, b: string) => scoreNoms(fr, a, b);
  const c = s("Kelmarsh Aggregates", "Kelmarsh Aggregates Quarry Operations Southern Division");
  assert.ok(c >= 0.79 && c <= 0.8 + 1e-9, `contenance plafonnée à 0,8 : ${c}`);
  assert.ok(s("Global Trading", "Global Trading Kestrel Marine Holdings") < 0.8, "des mots communs seuls ne font pas une contenance");
});

test("OCR : 0/O, 1/l, 5/S dans un mot, et O dans un numéro", () => {
  assert.equal(preparerEntite("C0LBROOK FILTERS"), "colbrook filters");
  assert.equal(preparerEntite("E5BRAND TOOL"), "esbrand tool");
  assert.equal(score("BELLAMARE 10", "BELLAMARE 1O"), 1);
  assert.equal(preparerEntite("HULL S1187"), "hull s 1187", "un numéro de coque n'est pas un mot mal lu");
});

test("un chiffre romain n'est un numéro qu'en fin de nom, et les sigles ne mangent pas un numéro", () => {
  assert.ok(score("SHUN I FA NO.232", "SHUN YI FA NO. 232") > 0.8);
  assert.equal(score("Selvaggio Maritime Holdings I S.A.", "Selvaggio Maritime Holdings III S.A."), 0);
  assert.equal(preparerEntite("Rathmore Surgical Sp. z o.o."), "rathmore surgical");
  assert.equal(preparerEntite("Czerwinka Kovovýroba spol. s r.o."), preparerEntite("CZERWINKA KOVOVYROBA S.R.O."));
});

test("le dictionnaire : deux mots anglais distincts ne sont pas une faute de frappe l'un de l'autre", () => {
  for (const [a, b] of [["exports", "experts"], ["mining", "milling"], ["paints", "prints"], ["wine", "wire"], ["cold", "gold"],
    ["commodities", "communities"], ["offshore", "onshore"], ["wool", "wood"], ["sole", "soul"]]) {
    assert.equal(motsDistincts(a, b), true, `${a} / ${b}`);
  }
  for (const [a, b] of [["trader", "traders"], ["trading", "trade"], ["carrier", "carriers"], ["engineer", "engineering"],
    ["amir", "emir"], ["pier", "peer"], ["aluminium", "aluminum"], ["harbour", "harbor"], ["castell", "cantell"], ["lung", "long"]]) {
    assert.equal(motsDistincts(a, b), false, `${a} / ${b}`);
  }
  assert.equal(lemme("commodities"), "commodity");
  assert.equal(lemme("kestrel"), "kestrel");
  assert.equal(lemme("xqzv"), undefined);
  assert.ok(score("Pellmoor Timber Exports Ltd", "Pellmoor Timber Experts Ltd") < 0.81, "mesuré à 0,907 avant le dictionnaire");
  assert.ok(score("Kestrel Trading", "Kestral Trading") > 0.81, "une faute de frappe reste une faute de frappe");
});

test("les familles de formes : Limited contre S.A. de C.V. est possible, jamais fort ; les traductions ne conflictent pas", () => {
  assert.ok(Math.abs(score("Norvanta Petroleum Limited", "Norvanta Petroleum S.A. de C.V.") - 0.8) < 1e-9);
  assert.ok(Math.abs(score("Telmoor Resources LLC", "Telmoor Resources Pty Ltd") - 0.8) < 1e-9);
  assert.equal(score("Kamaflot OOO", "Kamaflot Ltd"), 1, "OOO s'écrit Ltd ou LLC dans les documents russes");
  assert.equal(score("Dahwon Tongsang Jusikhoesa", "Dahwon Tongsang Trading Co., Ltd."), 1, "jusikhoesa est Co., Ltd. ; tongsang est trading");
  assert.equal(score("Lornavale Maritime Pte. Ltd.", "Lornavale Maritime Private Limited"), 1);
  assert.equal(score("TOO Kyzylzhar Trans", "Kyzylzhar Trans LLP"), 1, "le TOO kazakh se traduit LLP");
});

test("la parenthèse : une filiale nommée que l'autre nom ne reconnaît pas abaisse au possible", () => {
  assert.ok(score("Quarnby Logistics Ltd", "Quarnby Logistics (Shanghai) Co., Ltd.") < 0.81);
  assert.equal(score("Yuen Kei Fung Garment (H.K.) Co., Limited", "Yuen Kei Fung Garment (Hong Kong) Company Limited"), 1);
  assert.equal(score("Shivanandi Agro Exports (P) Ltd.", "Shivanandi Agro Exports Private Limited"), 1, "(P) Ltd est Private Limited, pas une filiale");
});

test("les mots du commerce traduits, et les désignations russes", () => {
  assert.equal(score("Jiangsu Mingluochen Maoyi Youxian Gongsi", "Jiangsu Mingluochen Trading Co., Ltd."), 1);
  assert.equal(score("JSC NPP Ilmenostat", "Joint Stock Company Scientific Production Enterprise Ilmenostat"), 1);
  assert.equal(score("Vukašinović i Sinovi d.o.o.", "Vukasinovic & Sons d.o.o."), 1);
  assert.equal(score("Công ty TNHH Thương mại Hưng Vĩnh Khang", "Hung Vinh Khang Trading Co., Ltd."), 1);
  assert.equal(preparerEntite("Gebr. Wunderloh GmbH & Co. KG"), preparerEntite("Gebrüder Wunderloh GmbH & Co. KG"));
});

test("les romanisations : ц, coréen, Wade-Giles, orthographe britannique, variation d'une voyelle", () => {
  assert.equal(squelette("tsement"), squelette("cement"));
  assert.equal(squelette("saetbyeol"), squelette("saetpyol"));
  assert.equal(squelette("hsin"), squelette("xin"));
  assert.equal(squelette("kaohsiung"), squelette("kaohsiung"));
  assert.equal(squelette("colour"), squelette("color"));
  assert.equal(variationVocalique(squelette("najm"), squelette("nejm")), true);
  assert.equal(variationVocalique(squelette("greenholt"), squelette("grainholt")), false);
  assert.ok(score("NAJM AL WAHAT", "NEJM EL WAHAT") >= 0.81);
  assert.ok(score("Greenholt Agro Traders", "Grainholt Agro Traders") < 0.81, "mesuré à 0,924 quand a et i se repliaient");
});

test("les résidus d'un document : alias avec points, forme native entre parenthèses, champs de connaissement, adresse, coque", () => {
  assert.ok(variantes("BEIRUT CEDAR TRADING SAL, f.k.a. LEBANON CEDAR IMPORT EXPORT SAL").includes("LEBANON CEDAR IMPORT EXPORT SAL"));
  assert.ok(variantes("BAKU OIL EXPORT CONSORTIUM (Бакинский нефтеэкспортный консорциум)").includes("BAKU OIL EXPORT CONSORTIUM"),
    "la forme native entre parenthèses est une autre écriture, pas une filiale");
  assert.ok(variantes("青岛海鑫国际物流有限公司 (Qingdao Haixin International Logistics Co., Ltd.)").includes("Qingdao Haixin International Logistics Co., Ltd."));
  assert.ok(!variantes("Quarnby Logistics (Shanghai) Co., Ltd.").includes("Quarnby Logistics Co., Ltd."), "une ville en latin entre parenthèses reste une filiale");
  assert.ok(variantes("ULSAN DAEWOO PETROCHEM SAME AS CONSIGNEE ABOVE").includes("ULSAN DAEWOO PETROCHEM"));
  assert.ok(variantes("NINGBO XINYUE PLASTIC CO LTD ATTN MR LI").includes("NINGBO XINYUE PLASTIC CO LTD"));
  assert.ok(variantes("DAEHAN SHIPPING CO LTD BUSAN KOREA").includes("DAEHAN SHIPPING CO LTD"));
  assert.ok(!variantes("Cobalt Mesa Packaging, S.A. de C.V.").includes("Cobalt Mesa Packaging, S.A."), "« de C.V. » n'est pas une adresse");
  assert.ok(!variantes("Thornbury Chemical Corporation of Canada Ltd.").includes("Thornbury Chemical Corporation"), "une filiale par pays n'est pas une adresse");
  assert.deepEqual(variantes("OOO Kamskiy Agrokhim"), ["OOO Kamskiy Agrokhim"], "une forme en tête ne coupe rien");
  assert.ok(variantes("Atlantic Pioneer, Hull No. 482").includes("Atlantic Pioneer"));
  assert.deepEqual(variantes("NEWBUILDING HULL NO. H2217"), ["NEWBUILDING HULL NO. H2217"], "le numéro de coque est tout le nom");
  assert.ok(variantes("MERIDIAN GLORY LIBERIA").includes("MERIDIAN GLORY"));
  assert.ok(variantes("HANSA CARRIER VOY 9").includes("HANSA CARRIER"));
  assert.equal(score("Yuen Kei Fung Garment (H.K.) Co., Limited", "Yuen Kei Fung Garment (Hong Kong) Company Limited"), 1);
  assert.equal(score("Sinar Kaloka Abadi, PT", "PT Sinar Kaloka Abadi"), 1, "PT en tête ou en queue");
  assert.equal(score("IVANOV STEEL TRADING OOO", "ООО Иванов Сталь Трейдинг"), 1, "le russe générique se traduit");
  assert.equal(score("CTY TNHH XNK PHUOC THANH", "Công Ty TNHH Xuất Nhập Khẩu Phước Thành"), 1);
});

test("les contextes de langue : arabe et persan, japonais, coréen, hindi, hébreu et grec, chinois", () => {
  assert.ok(score("Khorshid Farayand Tabriz Co.", "Khurshid Farayand Tabriz Co.") >= 0.81, "persan sans article : marqueur Tabriz");
  assert.ok(score("Ōkubara Shōji Co., Ltd.", "Ohkubara Shoji Co., Ltd.") >= 0.81, "japonais : ō, oh ; le marqueur shoji se lit avant sa traduction");
  assert.ok(score("Kyungsan Tongsang Co., Ltd.", "Gyeongsan Tongsang Co., Ltd.") >= 0.81, "coréen : McCune-Reischauer et romanisation révisée");
  assert.ok(score("Vrindavan Kesari Spices Exports", "Brindavan Kesari Spices Exports") >= 0.81, "hindi : v, b, au crédit");
  assert.ok(score("Kfar Sava Irrigation Systems Ltd", "Kfar Saba Irrigation Systems Ltd") >= 0.81, "hébreu : ב");
  assert.ok(score("Ets Fabre et Fils", "Ets Favre et Fils") < 0.81, "français : Fabre n'est pas Favre");
  assert.ok(score("Anping Jinqiao Wire Mesh Products Co., Ltd.", "Anping Yinqiao Wire Mesh Products Co., Ltd.") < 0.81, "pinyin : j n'est pas y");
  assert.ok(score("Meier Metallbau GmbH", "Mayer Metallbau GmbH") < 0.81);
  assert.ok(score("Jinyang Chemical Co., Ltd.", "Jinyoung Chemical Co., Ltd.") < 0.81);
});

test("tour 4 : ce qu'un document met devant ou autour du nom s'ôte, mais jamais un nom entier", () => {
  const porte = (brut: string, attendu: string) => assert.ok(variantes(brut).includes(attendu), `${brut} → ${variantes(brut).join(" | ")}`);
  porte("SHIPPER: Vilaplana Textil S.L.", "Vilaplana Textil S.L.");
  porte("NOTIFY PARTY: Grandval Freight Forwarding SARL", "Grandval Freight Forwarding SARL");
  porte("BENEFICIARY - Pham Thi Ngoc Lan Garment JSC", "Pham Thi Ngoc Lan Garment JSC");
  porte("VESSEL: MV Quennell Meridian", "MV Quennell Meridian");
  porte("Attn: Accounts Dept, Nkemelu Fabrics Ltd", "Nkemelu Fabrics Ltd");
  porte("Attn. Mr. Sørensen, Kjeldahl Fiskeindustri A/S", "Kjeldahl Fiskeindustri A/S");
  porte("OUR REF DC-88-2101 MV Wexford Halo", "MV Wexford Halo");
  porte("OUR REF 71-33920-LC Bakhtiari Dried Fruits Co.", "Bakhtiari Dried Fruits Co.");
  porte("Hull No. 2287 Halbrook Reliance", "Halbrook Reliance");
  porte("MV Tenebrae Aurora (H/N S-441)", "MV Tenebrae Aurora");
  porte("Haverstock Grain Merchants (Est. 1887) Ltd", "Haverstock Grain Merchants Ltd");
  porte("MT Belisama Grace (built 2015, Panama)", "MT Belisama Grace");
  porte("Pescadores del Cantábrico Norte S.A. (en liquidación)", "Pescadores del Cantábrico Norte S.A.");
  porte("MT Salomé Ardent (under arrest, Piraeus)", "MT Salomé Ardent");
  porte("MT Belisama Grace, Port of Loading: Antwerp", "MT Belisama Grace");
  porte("MV Corriedale Breeze/Voyage 0932W", "MV Corriedale Breeze");
  porte("Tarrant & Wolde Shipping Agencies Ltd (Rotterdam office)", "Tarrant & Wolde Shipping Agencies Ltd");
  porte("Kwame Asare Enterprises also known as Asare Trading", "Asare Trading");
  porte("Ibarra Cordero Aceites S.L. (antes Aceites Ibarra S.L.)", "Aceites Ibarra S.L.");
  /* les gardes : une année seule est une société successeur ; « pol » n'est pas « POL: » ;
     un numéro de coque seul reste un nom ; « Owner » sans deux-points est un mot du nom */
  assert.ok(!variantes("Negev Drip Systems (2014) Ltd").includes("Negev Drip Systems Ltd"));
  assert.deepEqual(variantes("Vantera Polymers AG"), ["Vantera Polymers AG"]);
  assert.deepEqual(variantes("Olvetra Polska Sp. z o.o."), ["Olvetra Polska Sp. z o.o."]);
  assert.deepEqual(variantes("NEWBUILDING HULL NO. H2217"), ["NEWBUILDING HULL NO. H2217"]);
  assert.deepEqual(variantes("Owner Farms Ltd"), ["Owner Farms Ltd"]);
});

test("tour 4 : particules au plancher, forme en tête, « joint stock company » sans pays, mots génériques européens", () => {
  /* des fréquences réelles mais petites : un mot absent des listes pèse le maximum, une particule le plancher */
  const fr = frequencesDe([["alpha holdings"], ["beta trading"], ["gamma shipping"], ["delta industries"], ["epsilon logistics"],
    ["zeta group"], ["eta marine"], ["theta foods"], ["iota metals"], ["kappa trading company"]]);
  assert.ok(scoreNoms(fr, "Compañía Naviera del Golfo de Anselmo S.A.", "Compañía Naviera Golfo de Anselmo S.A.") >= 0.81);
  assert.ok(scoreNoms(fr, "Société des Entrepôts Frigorifiques de Marbeuf", "Société Entrepôts Frigorifiques de Marbeuf") >= 0.81);
  /* « Dos » n'est pas une particule : le deuxième d'une série reste distinct */
  assert.ok(scoreNoms(fr, "C.I. Flores de Rionegro S.A.S.", "C.I. Flores de Rionegro Dos S.A.S.") < 0.81);
  assert.ok(scoreNoms(fr, "Bint Al Nakhuda", "Ibn Al Nakhuda") < 0.81);
  /* avec des poids réels : en poids uniformes, « des » orphelin pèse le maximum et plafonne (c'est le cas de tout orphelin) */
  assert.ok(scoreNoms(fr, "S.A. des Filatures de Montrouge-Étoile", "Filatures de Montrouge-Étoile S.A.") >= 0.81);
  assert.ok(score("As-Salam Trading", "Salam Trading") < 1, "As-Salam garde son article : ce n'est pas une forme");
  assert.ok(score("Sokołowiec Chemical Works Spółka Akcyjna", "Sokołowiec Chemical Works Joint-Stock Company") >= 0.81);
  assert.ok(score("Yıldırım Kardeşler Nakliyat Ltd. Şti.", "Yildirim Brothers Transport Ltd.") >= 0.81);
  assert.ok(score("Fratelli Tremonti Spedizioni S.r.l.", "Tremonti Brothers Forwarding S.r.l.") >= 0.81);
  assert.ok(score("Zakłady Chemiczne Sokołowiec S.A.", "Sokolowiec Chemical Works S.A.") >= 0.81);
  assert.ok(score("Hermanos Villalobos Comercio S.A.", "Villalobos Brothers Trading S.A.") >= 0.81);
  assert.ok(score("Ναυτιλιακή Εταιρεία Αργυρόπετρα Α.Ε.", "Argyropetra Shipping Company S.A.") >= 0.81);
  /* « maritime » n'est pas traduit : deux sociétés d'un groupe */
  assert.ok(score("Beaurivage Maritime Ltd", "Beaurivage Shipping Ltd") < 1);
});

test("le qualificatif de groupe soudé : « Agroholding » face à « Agro » est possible, jamais fort ; en deux mots, c'est une soudure", () => {
  const s = score("Rakhmatullin Agroholding LLC", "Rakhmatullin Agro LLC");
  assert.ok(s < 0.81 && s >= 0.8 - 1e-9, `la holding face à l'exploitante, mesurée à 0,907 avant la règle ; ici ${s}`);
  assert.ok(score("Rakhmatullin Agro Holding LLC", "Rakhmatullin Agroholding LLC") >= 0.81, "les deux mots portent le qualificatif : une soudure, pas une holding");
  assert.equal(qualificatifSoude("agroholding", "agro", ["rakhmatullin", "agro"]), true);
  assert.equal(qualificatifSoude("agroholding", "agro", ["agro", "holding"]), false, "le qualificatif écrit à part");
  assert.equal(qualificatifSoude("agroholdings", "agro", ["agro", "holding"]), false, "au singulier ou au pluriel");
  assert.equal(qualificatifSoude("uktrade", "uk", ["uk"]), false, "trois lettres de radical au moins");
  assert.equal(qualificatifSoude("agrotech", "agro", ["agro"]), false, "« tech » n'est pas un qualificatif de groupe");
});

test("les désignations : Corp. contre Inc. est possible, jamais fort ; Corp. et Corporation, Inc. et Incorporated restent une", () => {
  for (const [a, b] of [["Harlowe Grain Corporation", "Harlowe Grain Inc."], ["Southport Fabricators Corp.", "Southport Fabricators Inc."]]) {
    const s = score(a!, b!);
    assert.ok(s < 0.81 && s >= 0.8 - 1e-9, `${a} / ${b} : deux dépôts, mesurés à 1,000 avant la règle ; ici ${s}`);
  }
  assert.equal(score("Veltra Industrial Corp", "Veltra Industrial Corporation"), 1);
  assert.equal(score("Quillmont Hydraulics, Inc.", "Quillmont Hydraulics Incorporated"), 1);
  const m = (n: string) => analyserEntite(n);
  assert.equal(marquesEnConflit(m("Harlowe Grain Corporation"), m("Harlowe Grain Inc.")), true);
  assert.equal(marquesEnConflit(m("Sarnova Petrochem JSC"), m("Joint Stock Company Sarnova Petrochem")), false, "une traduction n'est pas une désignation");
  assert.deepEqual(m("Harlowe Grain Inc.").designations, ["inc"]);
  assert.deepEqual(m("Harlowe Grain Ltd").designations, [], "Ltd n'est pas une désignation : les familles la séparent déjà de Corp. et d'Inc.");
});

test("la lettre perdue d'un encodage : « ? » dans un mot ou en tête vaut une lettre ; en fin de mot c'est une ponctuation", () => {
  assert.ok(score("MV Señora del Carmen", "MV SE?ORA DEL CARMEN") > 0.81, "ñ perdu : mesuré à 0,524 avant");
  assert.ok(score("Ługowski Meble Sp. z o.o.", "?ugowski Meble Sp. z o.o.") > 0.81, "Ł perdu en tête : mesuré à 0,675 avant");
  assert.ok(score("Skjærgård Kystrederi AS", "Skj?rg?rd Kystrederi AS") > 0.81, "æ se plie en deux lettres");
  assert.equal(score("What? Ever Ltd", "What Ever Ltd"), 1, "un « ? » après un mot est une ponctuation");
  assert.equal(lettrePerdue(`se${PERDU}ora`, "senora"), true);
  assert.equal(lettrePerdue(`stra${PERDU}e`, "strass"), false, "une lettre, pas deux");
  assert.ok(score("Nordhavn Kystfart AS", "Nordh?vn Kystfart AS") > 0.81);
});

test("OCR : la capitale I lue l en tête d'un mot, à partir de cinq lettres", () => {
  assert.ok(score("MT Isolde Marlin", "MT lsolde Marlin") > 0.81, "mesuré à 0,585 avant");
  assert.ok(score("Illmarinen Sähkö Oy", "lllmarinen Sähkö Oy") > 0.81, "mesuré à 0,800 avant");
  assert.ok(score("Iago Trading", "Lago Trading") < 0.81, "quatre lettres : deux noms");
});

test("la faute de frappe lève le plafond d'ambiguïté : lettres inversées, lettre tombée ; jamais une substitution", () => {
  assert.ok(score("MV Kaspar Lindholm", "MV Kaspar Lindhlom") > 0.81, "mesuré à 0,800 avant");
  assert.ok(score("Nordhavn Kystfart AS", "Nordhvan Kystfart AS") > 0.81, "mesuré à 0,800 avant");
  /* tour 12 : dans un nom de NAVIRE, une lettre tombée que rien n'explique est une autre coque (la convention de tous les
     auteurs depuis le jeu 12 ; mesuré : deux fausses alertes fortes de moins pour cette seule paire du jeu 8) */
  assert.ok(score("M/V Tarnhelm Star", "M/V Tarnhem Star") <= 0.80, "mesuré à 0,800 au tour 12 ; au fort avant");
  assert.ok(score("Aegean Star Navigation", "Aegaen Star Navigation") > 0.81);
  /* la substitution d'une lettre, même entre touches voisines, est aussi la signature de deux mots réels :
     la lever gagnait « Torvakd » et perdait ces deux pièges (mesuré le 27/09) */
  assert.ok(score("CASTELLO RESIN SRL", "Castelli Resin S.r.l.") < 0.81);
  assert.ok(score("FEDOROV NIKOLAI SERGEEVICH", "Fedotov Nikolai Sergeevich") < 0.81);
  assert.equal(fauteDeFrappe("phuong", "phong"), false, "cinq lettres : un autre mot autant qu'une faute");
  assert.equal(fauteDeFrappe("nordhavn", "nordhvan"), true);
  assert.equal(fauteDeFrappe("tarnhelm", "tarnhem"), true);
  assert.equal(fauteDeFrappe("torvald", "torvakd"), false);
  assert.ok(score("Huaxin Trading Co., Ltd.", "Huaxing Trading Co., Ltd.") < 0.81, "chinois : une lettre de plus est une autre syllabe");
});

test("le dictionnaire : les orthographes britanniques en -re, -our, -ogue ont un lemme ; Sable et Sabre sont deux mots", () => {
  assert.equal(lemme("sabre"), "saber");
  assert.equal(motsDistincts("sable", "sabre"), true);
  assert.equal(motsDistincts("centre", "center"), false, "la même racine");
  assert.ok(score("Sable Coast Logistics Ltd", "Sabre Coast Logistics Ltd") < 0.81, "mesuré à 0,839 avant la racine britannique");
});

test("le dictionnaire : les voyelles ne sont libres que sous une romanisation ; Marlin et Merlin sont deux mots, Lung et Long une syllabe", () => {
  assert.equal(motsDistincts("marlin", "merlin"), false, "sous une romanisation, comme Amir et Emir");
  assert.equal(motsDistincts("marlin", "merlin", false), true, "sans aucune marque de langue");
  assert.ok(score("Marlin Fisheries Ltd", "Merlin Fisheries Ltd") < 0.81, "mesuré à 0,835 avant");
  assert.ok(score("Chiu Hsiang Lung Precision Industrial Co., Ltd.", "Qiu Xiang Long Precision Industrial Co Ltd") > 0.81, "Wade-Giles et pinyin : mesuré à 0,672 quand le chinois n'ouvrait pas les voyelles");
});

test("les composés anglais : Ironbridge et Ironridge sont deux mots ; Silverlien pour Silverline est une faute", () => {
  assert.equal(composesDistincts("ironbridge", "ironridge"), true);
  assert.equal(composesDistincts("silverline", "silverlien"), false, "deux lettres inversées dans une moitié");
  assert.equal(composesDistincts("brightwater", "brightwatter"), false, "une lettre doublée dans une moitié");
  assert.ok(score("Ironbridge Castings Ltd", "Ironridge Castings Ltd") < 0.81, "mesuré à 0,900 avant");
  assert.ok(score("Silverline Tankers", "Silverlien Tankers") > 0.81);
  assert.ok(score("Brightwater Commodities", "Brightwatter Commodities") > 0.81);
});

test("l'abréviation d'usage : un mot inconnu du dictionnaire qui commence un mot plus long de l'autre nom", () => {
  assert.ok(score("Ravenscourt Agricultural Supplies Limited", "Ravenscourt Agri Supplies") > 0.81, "mesuré à 0,603 avant");
  assert.ok(score("Atlas Logistics", "Atlas Logic Systems") < 0.81, "« logic » est un mot : un début de mot est un autre mot");
});

test("les mots de métier japonais marquent la langue : Suisan ouvre le pli des deux romanisations", () => {
  assert.ok(score("Shimotsuki Suisan", "Simotuki Suisan") > 0.81, "shi, si ; tsu, tu : mesuré à 0,800 sans la marque");
  assert.ok(score("Shimotsuki Suisan Co., Ltd.", "Shimotsuki Shoji Co., Ltd.") < 0.81, "deux sociétés du même groupe");
});

test("les écritures natives : hangul, sinogrammes, arabe et persan, hébreu, vers les mêmes tables que le latin", () => {
  /* le hangul se décompose par arithmétique, sans table ; ses mots du commerce et sa forme se traduisent */
  assert.equal(hangulEnLatin("새벽별"), "saebyeokbyeol");
  assert.equal(hangulEnLatin("물류"), "mullyu", "ㄹ après une finale ㄹ s'écrit ll");
  assert.equal(preparerEntite("새벽별물류 주식회사"), "saebyeokbyeol logistics");
  assert.ok(score("새벽별물류 주식회사", "Saebyeokbyeol Logistics Co., Ltd.") >= 0.81);
  assert.ok(score("새벽별물류 주식회사", "Saebyeokbyeol Trading Co., Ltd.") < 0.81, "un autre mot du commerce est une autre société");
  /* les sinogrammes : une lecture par caractère, les mots du commerce traduits, le nom propre d'une traite */
  assert.equal(pinyinDe("金"), "jin");
  assert.equal(pinyinDe("鷺"), "lu", "le traditionnel se lit aussi");
  assert.equal(preparerEntite("沧澜远洋航运有限公司"), "canglan ocean shipping");
  assert.deepEqual([...romaniser("沧澜远洋航运有限公司").natifs], [["canglan", "沧澜"]], "le jeton garde ses caractères");
  assert.ok(score("MV 金鷺", "MV Jin Lu") >= 0.81);
  assert.ok(score("沧澜远洋航运有限公司", "Canglan Ocean Shipping Co., Ltd.") >= 0.81);
  assert.ok(score("雾山精密机械股份有限公司", "Wushan Precision Machinery Co., Ltd.") >= 0.81);
  assert.ok(score("新海贸易有限公司", "鑫海贸易有限公司") < 0.81, "homophones : xinhai tous deux, deux sociétés");
  assert.ok(score("沧澜远洋航运有限公司", "沧澜国际物流有限公司") < 0.81, "une société sœur");
  /* le japonais se lit par la table des kanji qui nomment une société (tour 9, src/kanji.ts) : 霜月 est Shimotsuki, jamais
     Shuangyue, et 水産 se traduit des deux côtés ; un kanji hors table reste en place */
  assert.equal(preparerEntite("株式会社霜月水産"), "shimotsuki fisheries");
  assert.ok(score("光星産業株式会社", "幸生産業株式会社") < 0.81);
  /* les abjads : consonnes contre consonnes, l'article séparé, la forme et le commerce traduits */
  assert.equal(preparerEntite("MT بحر الذهب"), "bhr al dhhb");
  assert.equal(cleAbjad("bahr", "arabe"), cleAbjad("bhr", "arabe"));
  assert.equal(cleAbjad("hanegev", "hebreu"), cleAbjad("hngb", "hebreu"));
  assert.equal(cleAbjad("shachar", "hebreu"), cleAbjad("shchr", "hebreu"), "ח s'écrit ch, ש reste sh");
  assert.ok(score("MT بحر الذهب", "MT Bahr Al Dhahab") >= 0.81);
  assert.ok(score("شرکت بازرگانی سپیددشت", "Sepiddasht Trading Company") >= 0.81, "persan : شرکت et بازرگانی sont la forme et le commerce");
  assert.ok(score("مؤسسة الرحيلي للتجارة", "Al Ruhaili Trading Est.") >= 0.81, "arabe : للتجارة est le commerce, مؤسسة la forme");
  assert.ok(score("אורות הנגב תעשיות בע״מ", "Orot HaNegev Industries Ltd.") >= 0.81, "hébreu : ו voyelle dans אורות, בע״מ la forme");
  assert.ok(score("שחר הגליל בע״מ", "Shachar HaGalil Ltd.") >= 0.81);
  assert.ok(score("אורות הנגב תעשיות בע״מ", "Orot HaGalil Industries Ltd.") < 0.81, "d'autres consonnes sont un autre mot");
  assert.equal(score("MT بحر الذهب ٢", "MT Bahr Al Dhahab 3"), 0, "un chiffre arabe oriental est un numéro, et deux numéros différents tranchent");
  /* le thaï se lit depuis le tour 5 (voir le test des écritures thaïe et tamoule) */
  assert.ok(score("บริษัท พระจันทร์เงิน อุตสาหกรรม จำกัด", "Phrachan Ngoen Industry Co., Ltd.") >= 0.81);
});

test("l'arabe et le persan natifs : les formes et leurs sigles, les mots du commerce sous ل, لل et ال, la filiation", () => {
  /* les sigles pointés du Golfe sont des formes, avec leur famille ; le commerce se traduit sous sa préposition */
  assert.equal(preparerEntite("روابي الساحل لتجارة خردة المعادن ذ.م.م"), "rwabi al sahl trading scrap metals");
  assert.equal(preparerEntite("زهرة الواحة للبتروكيماويات م.م.ح"), "zahra al waha petrochemicals");
  assert.deepEqual(analyserEntite("سيلفر ديون للخدمات اللوجستية ش.م.ح").familles, ["fz"], "ش.م.ح est une FZCO");
  assert.equal(preparerEntite("الإطارات"), preparerEntite("الاطارات"), "l'alif avec ou sans hamza");
  assert.equal(preparerEntite("ليوا للتجارة"), "lywa trading", "le ل d'un nom propre n'est pas la préposition");
  assert.equal(preparerEntite("مؤسسة سعيد بن حمد للتجارة"), "said bin hmd trading", "بن est bin, مؤسسة la forme, ع une voyelle");
  /* les lettres faibles : consonne à côté d'un alif ou devant l'autre lettre faible */
  assert.equal(romaniser("روابي").texte, "rwabi");
  assert.equal(romaniser("کاوه").texte, "kawh");
  assert.equal(romaniser("نجوم").texte, "njum", "و entre deux consonnes reste une voyelle");
  /* la clé arabe : ج est une consonne, و sa propre lettre */
  for (const [a, b] of [["nujoom", "njum"], ["rawabi", "rwabi"], ["kaveh", "kawh"], ["fajr", "fjr"], ["suwaidi", "swidi"]]) {
    assert.equal(cleAbjad(a, "arabe"), cleAbjad(b, "arabe"), `${a} / ${b}`);
    assert.ok(cleAbjad(a, "arabe").length >= 3, `${a} : trois consonnes au moins`);
  }
  assert.equal(cleAbjadSansTa("zahrat"), cleAbjad("zahra", "arabe"), "la ta marbuta en annexion");
  assert.equal(cleAbjadSansTa("bayt"), undefined);
  for (const [a, b] of [
    ["Rawabi Al Sahel Scrap Metal Trading L.L.C.", "روابي الساحل لتجارة خردة المعادن ذ.م.م"],
    ["Nujoom Al Fajr Tyres Trading L.L.C.", "نجوم الفجر لتجارة الإطارات ش.ذ.م.م"],
    ["Qasr Al Yasmin Perfumes Trading L.L.C.", "قصر الياسمين لتجارة العطور ذ.م.م"],
    ["Dar Al Noor General Trading L.L.C.", "دار النور للتجارة العامة ذ.م.م"],
    ["Rimal Al Dhahab Sugar Trading L.L.C.", "رمال الذهب لتجارة السكر ذ.م.م"],
    ["Zahrat Al Waha Petrochem FZE", "زهرة الواحة للبتروكيماويات م.م.ح"],
    ["Saeed Bin Hamad Trading Est.", "مؤسسة سعيد بن حمد للتجارة"],
    ["Sepid Kaveh Kish Trading", "بازرگانی سپید کاوه کیش"],
  ]) assert.ok(score(a, b) >= 0.81, `${a} / ${b} : ${score(a, b)}`);
  assert.ok(score("Rawabi Al Sahel Tyres Trading L.L.C.", "روابي الساحل لتجارة خردة المعادن ذ.م.م") < 0.81, "un autre commerce est une autre société");
  assert.ok(score("Nujoom Al Bahr Tyres Trading L.L.C.", "نجوم الفجر لتجارة الإطارات ش.ذ.م.م") < 0.81, "d'autres consonnes sont un autre mot");
});

test("l'arabe et le persan romanisés : tejarat et tijarat, li devant le commerce, al qabidha, les graphies, la forme entre parenthèses", () => {
  assert.equal(preparerEntite("Sherkat-e Tejarat-e Golestan Nakhl (Sahami Khass)"), "trading golestan nakhl");
  assert.equal(preparerEntite("Golestan Nakhl Trading Co. (Private Joint Stock)"), "golestan nakhl trading", "la forme entre parenthèses n'est pas une filiale");
  /* la locution « al aruz » rend « rice » sans son article (voie locale du tour 5) */
  assert.equal(preparerEntite("Sunbulat Al Khair Li Tijarat Al Aruz L.L.C."), "sunbulat al khair trading rice");
  assert.equal(preparerEntite("Li Ning Trading Co."), "li ning trading", "li devant un autre mot est un nom");
  assert.equal(preparerEntite("Mahtaab Sepehr Bazarghani Company"), "mahtaab sepehr trading", "gh pour g dans un mot du commerce");
  assert.equal(preparerEntite("Sharikat Rawasi Al Najd Al Qabidha"), "rawasi al najd holding");
  for (const [a, b] of [
    ["Mahtab Sepehr Bazargani Co.", "Mahtaab Sepehr Bazarghani Company"],
    ["Rawasi Al Najd Holding Company", "Sharikat Rawasi Al Najd Al Qabidha"],
    ["Sunbulat Al Khair Rice Trading L.L.C.", "Sunbulat Al Khair Li Tijarat Al Aruz L.L.C."],
    ["Sepid Kaveh Tejarat Kish", "Sepid Kaveh Tijarat-e Kish"],
    ["Pesteh Kavir Kerman Trading Co.", "Peste Kavir Kerman Tejarat Co."],
    ["Sherkat-e Tejarat-e Golestan Nakhl (Sahami Khass)", "Golestan Nakhl Trading Co. (Private Joint Stock)"],
  ]) assert.ok(score(a, b) >= 0.81, `${a} / ${b} : ${score(a, b)}`);
  assert.ok(score("Sherkat-e Tejarat-e Golestan Nakhl (Sahami Khass)", "Sherkat-e Tejarat-e Golestan Nakhl-e Jonoub (Sahami Khass)") < 0.81, "un mot rare de plus");
});

test("les voyelles de l'arabe romanisé : a et i sont deux lettres, e va avec l'une et l'autre ; la voyelle d'appui ; ee est i", () => {
  assert.equal(variationVocalique(squelette("rashid"), squelette("rashad")), false, "رشيد, رشاد : une voyelle longue écrite");
  assert.equal(variationVocalique(squelette("khaled"), squelette("khalid")), true);
  assert.equal(variationVocalique(squelette("mohammed"), squelette("mohammad")), true);
  assert.ok(score("Ahmed Rashid Al Suwaidi General Trading L.L.C.", "ahmed rashad al suwaidi general trading llc") < 0.81, "mesuré à 0,923 quand a et i se confondaient");
  assert.equal(voyelleEpenthetique(squelette("bahr"), squelette("bahar")), true);
  assert.equal(voyelleEpenthetique(squelette("nasr"), squelette("naser")), true);
  assert.equal(voyelleEpenthetique(squelette("amr"), squelette("amir")), false, "trois lettres, et i");
  assert.equal(voyelleEpenthetique(squelette("saad"), squelette("said")), false, "la voyelle n'est pas entre deux consonnes");
  assert.equal(voyelleEpenthetique(squelette("nasr"), squelette("nasir")), false, "نصر, ناصر");
  assert.equal(squeletteLongue("naseem"), squelette("nasim"));
  assert.ok(score("M.V. NASEEM AL BAHAR 3", "NASIM AL BAHR 3") >= 0.81, "mesuré à 0,666 avant");
  assert.ok(score("Greenholt Agro Traders", "Grainholt Agro Traders") < 0.81, "ee n'est i que sous une marque de langue : mesuré à 0,915 quand le squelette pliait ee partout");
});

test("la table du pinyin : une lecture par code de U+4E00 à U+9FFF, son empreinte, l'inconnu traverse", () => {
  const octets = readFileSync(CHEMIN_PINYIN);
  assert.equal(createHash("sha256").update(octets).digest("hex"), "47a38de123616a3a34d6c6ddc06d37e452e83e0a04e0e74ef91e2e7402bdd364",
    "la table est celle produite par ICU 78.3 (Han-Latin, données Unicode 17.0), voir ecritures.ts");
  assert.equal(octets.toString("utf8").split("\n").length, 20993, "20 992 lignes et la fin de fichier");
  assert.equal(pinyinDe("一"), "yi");
  assert.equal(pinyinDe("A"), "A", "hors table, un caractère traverse inchangé");
});

test("tour 5, voie locale : connaissements d'Asie du Sud-Est, zones franches, filiation, succursale, vieille orthographe", () => {
  const porte = (brut: string, attendu: string) => assert.ok(variantes(brut).includes(attendu), `${brut} → ${variantes(brut).join(" | ")}`);
  porte("SHIPPER: PT PKS RIMBA KENARI, DUMAI - CPO IN BULK", "PT PKS RIMBA KENARI");
  assert.ok(variantes("NOTIFY: MAHTAB SEPEHR BAZARGANI CO. BANDAR ABBAS").some((v) => /BAZARGANI CO\.?$/.test(v)), "la ville derrière « CO. » est une adresse");
  porte("NOTIFY PARTY: ORCHID RIDGE COMMODITIES DMCC, JLT, DUBAI", "ORCHID RIDGE COMMODITIES DMCC");
  porte("TOWING VESSEL: TB. KENARI SAMUDERA-5", "TB. KENARI SAMUDERA-5");
  porte("VESSEL/VOY: MERANTI SUNRISE V.2409S", "MERANTI SUNRISE");
  porte("OCEAN VESSEL: CORAL KEMUNING PORT OF LOADING: DUMAI", "CORAL KEMUNING");
  porte("SHIPPED ON BOARD MV RONG YUAN TAI 16 AT FANGCHENG", "MV RONG YUAN TAI 16");
  porte("BARGE BAHARI MUTIARA 12 (HULL NO. BM-12)", "BARGE BAHARI MUTIARA 12");
  porte("Kenanga Pacific Sdn. Bhd. - Penang Branch", "Kenanga Pacific Sdn. Bhd.");
  porte("CONSIGNEE: KHALID YOUSUF BLDG MATERIALS TRDG CO LLC DEIRA", "KHALID YOUSUF BLDG MATERIALS TRDG CO LLC");
  /* les préfixes et les TYPES de navires : TB et TUG écrivent le même remorqueur, un remorqueur n'est pas sa barge */
  assert.ok(score("TB KENARI SAMUDERA 5", "TUG KENARI SAMUDERA 5") >= 0.81);
  assert.ok(score("KM SINAR BAHARI 27", "F/V SINAR BAHARI 27") >= 0.81);
  assert.ok(score("BG BAHARI MUTIARA 12", "BARGE BAHARI MUTIARA 12") >= 0.81);
  assert.ok(score("BARGE THONG CHAROEN 9", "TUG THONG CHAROEN 9") < 0.81);
  /* les formes : zones franches (deux zones, deux dépôts), UD et CV indonésiens, SPC en toutes lettres */
  assert.ok(score("Silver Dune Logistics FZCO", "Silver Dune Logistics DMCC") < 0.81);
  assert.ok(score("Silver Dune Logistics FZE", "Silver Dune Logistics FZCO") < 0.81, "deux immatriculations d'une même zone (jeu 14, tour 10 ; le tour 9 les tenait pour une)");
  assert.ok(score("UD Besi Tua Sumber Rejeki", "Usaha Dagang Besi Tua Sumber Rejeki") >= 0.81);
  assert.ok(score("CV Cahaya Bintang Timur Jaya", "Commanditaire Vennootschap Cahaya Bintang Timur Jaya") >= 0.81);
  assert.ok(score("Wadi Sahtan Trading & Contracting SPC", "WADI SAHTAN TRADING & CONTRACTING SOLE PROPRIETOR COMPANY") >= 0.81);
  /* les abréviations et les civilités malaises */
  assert.ok(score("Kenanga-Haesol Marine JV Sdn. Bhd.", "KENANGA HAESOL MARINE JOINT VENTURE SDN BHD") >= 0.81);
  assert.ok(score("Meenakshi Sundaram Group Holdings Pte. Ltd.", "Meenakshi Sundaram Grp Hldgs Pte Ltd") >= 0.81);
  assert.ok(score("Dar Al Noor General Trading L.L.C.", "Dar Alnoor Gen Trdg LLC") >= 0.81);
  assert.ok(score("Mohd Faizal Frozen Food Supply", "Mohamad Faizal Frozen Food Supply") >= 0.81);
  /* les mots génériques malais et l'arabe romanisé des marchandises */
  assert.ok(score("Kilang Beras Seri Padi Sdn. Bhd.", "Seri Padi Rice Mill Sdn Bhd") >= 0.81);
  assert.ok(score("PT Pabrik Kelapa Sawit Rimba Kenari", "PT Rimba Kenari Palm Oil Mill") >= 0.81);
  assert.ok(score("Kilang Isirong Sawit Pelangi Emas Sdn. Bhd.", "Pelangi Emas Palm Kernel Mill Sdn Bhd") >= 0.81);
  assert.ok(score("Syarikat Getah Bukit Tembusu Sdn. Bhd.", "Bukit Tembusu Rubber Company Sdn Bhd") >= 0.81);
  assert.ok(score("Sunbulat Al Khair Rice Trading L.L.C.", "Sunbulat Al Khair Li Tijarat Al Aruz L.L.C.") >= 0.81);
  assert.ok(score("Công ty Cổ phần Cao su Bình Lộc Hưng", "Binh Loc Hung Rubber Joint Stock Company") >= 0.81);
  /* la filiation : omise d'un côté, rien ne se perd ; « Bint » face à « Ibn », deux personnes */
  const fr = frequencesDe([["alpha holdings"], ["beta trading"], ["gamma shipping"], ["delta industries"], ["epsilon logistics"],
    ["zeta group"], ["eta marine"], ["theta foods"], ["iota metals"], ["kappa trading company"]]);
  assert.ok(scoreNoms(fr, "Yusof bin Abdullah Hardware Enterprise", "Yusof Abdullah Hardware Enterprise") >= 0.81);
  assert.ok(scoreNoms(fr, "Bint Al Nakhuda", "Ibn Al Nakhuda") < 0.81);
  assert.ok(score("Fatima Bint Obaid Ladies Tailoring & Textiles Trading", "Fatma Bnt Obaid Ladies Tailoring and Textiles Trading") >= 0.81);
  /* la succursale : X - Penang Branch est X, mais pas X (Penang) Sdn. Bhd. */
  assert.ok(score("Kenanga Pacific Sdn. Bhd. - Penang Branch", "Kenanga Pacific Sdn. Bhd.") >= 0.81);
  assert.ok(score("Kenanga Pacific Sdn. Bhd. - Penang Branch", "Kenanga Pacific (Penang) Sdn. Bhd.") < 0.81);
  /* la vieille orthographe indonésienne */
  assert.ok(score("PT Tjahaja Soerya Kentjana (Surabaya)", "PT Cahaya Surya Kencana Surabaya") >= 0.81);
});

test("la table du jyutping : une lecture cantonaise par code, son empreinte, la graphie de Hong Kong", () => {
  const octets = readFileSync(CHEMIN_JYUTPING);
  assert.equal(createHash("sha256").update(octets).digest("hex"), "a7fb1c74b9144e04e146557de91bd3a353d386c5f6af60496b5393ae6a16d3d1",
    "la table est celle tirée du champ kCantonese d'Unihan (Unicode 18.0.0), voir ecritures.ts");
  assert.equal(octets.toString("utf8").split("\n").length, 20993, "20 992 lignes et la fin de fichier");
  assert.equal(jyutpingDe("永"), "wing");
  assert.equal(jyutpingDe("A"), "", "hors table, pas de lecture cantonaise");
  assert.equal(hongkong("zoeng"), "cheung"); assert.equal(hongkong("gam"), "kam"); assert.equal(hongkong("jyun"), "yuen"); assert.equal(hongkong("lyun"), "luen"); assert.equal(hongkong("bou"), "po");
});

test("un nom en sinogrammes se lit aussi en cantonais : Hong Kong écrit Wing Shing, pas Yongcheng", () => {
  assert.equal(preparerEntite("永成集團控股有限公司"), "yongcheng group holdings");
  assert.equal(preparerEntite("永成集團控股有限公司", "cantonais"), "wing sing group holdings");
  assert.deepEqual([...romaniser("永成集團控股有限公司", "cantonais").natifs], [["wing", "永"], ["sing", "成"]], "chaque syllabe garde son caractère");
  assert.equal(preparerEntite("永成贸易(深圳)有限公司", "cantonais"), "wing sing trading shenzhen", "le lieu entre parenthèses reste en mandarin");
  assert.ok(lecturesDe("永成集團控股有限公司").some((l) => l.lecture === "cantonais"));
  for (const [a, b] of [["shing", "sing"], ["kam", "gam"], ["luen", "lyun"], ["cheung", "tseung"], ["soon", "shun"], ["heng", "hing"],
    ["lee", "lei"], ["leong", "lung"], ["man", "maan"], ["yuen", "jyun"]]) assert.equal(pliCantonais(a!), pliCantonais(b!), `${a} / ${b}`);
  assert.notEqual(pliCantonais("shing"), pliCantonais("hing"), "sh n'est pas h");
  assert.ok(score("Wing Shing Group Holdings Limited", "永成集團控股有限公司") >= 0.81, "mesuré à 0,800 par le seul bloc des squelettes en mandarin");
  assert.ok(score("Kam Sing Electrical (M) Sdn. Bhd.", "金成电器(马)有限公司") >= 0.81, "有限公司 écrit en caractères vaut aussi Sdn. Bhd., et (马) est (M)");
  assert.ok(score("永成貿易有限公司", "詠成貿易有限公司") < 0.81, "homophones en cantonais comme en mandarin : deux sociétés");
  assert.ok(score("源成糖业贸易私人有限公司", "源盛糖业贸易私人有限公司") < 0.81, "le mandarin de l'un ne se compare pas au cantonais de l'autre : mesuré à 0,857 par le bloc");
});

test("un nom latin qui porte ses sinogrammes : leurs lectures sont d'autres graphies de ses mots", () => {
  const l = lecturesDe("Yongcheng Trading (Shenzhen) Co Ltd 永成");
  assert.ok(l.some((x) => x.texte === "Wing Sing Trading (Shenzhen) Co Ltd" && x.lecture === "cantonais"), l.map((x) => x.texte).join(" | "));
  assert.ok(l.some((x) => x.texte === "Yongcheng Trading (Shenzhen) Co Ltd" && x.lecture === "mandarin"));
  assert.ok(lecturesDe("Wing Fung Provision Trading Pte Ltd (荣丰)").some((x) => x.texte === "Rongfeng Provision Trading Pte Ltd"));
  assert.ok(score("Wing Shing Trading (Shenzhen) Co., Ltd.", "Yongcheng Trading (Shenzhen) Co Ltd 永成") >= 0.81, "mesuré à 0,305 avant");
  assert.ok(score("Soon Heng Hardware (Kuching) Sdn. Bhd.", "Shun Hing Hardware (Kuching) Sdn Bhd 顺兴五金") >= 0.81, "mesuré à 0,510 avant");
});

test("le commerce de Singapour et de Malaisie en chinois, le teochew en tête, le coréen : 자원 et le 호 des navires", () => {
  assert.equal(preparerEntite("协和电器供应私人有限公司"), "xiehe electrical supplies");
  const m = analyserEntite("协和电器供应私人有限公司");
  assert.ok(m.prive && m.pays.includes("SG") && m.pays.includes("MY"), "私人有限公司 est Pte. Ltd. ou Sdn. Bhd.");
  const h = analyserEntite("金成电器(马)有限公司");
  assert.ok(h.priveInconnu && h.pays.includes("MY") && h.pays.includes("CN"), "有限公司 écrit en caractères ne dit ni le pays ni le statut");
  assert.ok(!analyserEntite("Jinsheng Dianqi Youxian Gongsi").priveInconnu, "romanisée, la forme reste continentale");
  assert.equal(preparerEntite("Teo Heng Seafood Trading Pte. Ltd."), "teo heng seafood trading", "« Teo » en tête n'est pas la forme irlandaise");
  assert.equal(preparerEntite("주식회사 청솔자원"), "cheongsol resources");
  assert.ok(score("Cheongsol Resources Co., Ltd.", "주식회사 청솔자원") >= 0.81, "mesuré à 0,191 avant");
  assert.ok(variantes("해솔 파이오니어호").includes("해솔 파이오니어"));
  assert.deepEqual(variantes("금호타이어"), ["금호타이어"], "un 호 qui n'est pas final n'est pas le suffixe d'un navire");
});

test("le pluriel anglais d'un mot du dictionnaire est le même mot ; 廢金屬回收 est le recyclage des métaux", () => {
  assert.ok(pluriel("metals", "metal") && pluriel("industries", "industry") && pluriel("supplies", "supply"));
  assert.ok(!pluriel("traders", "trading") && !pluriel("trading", "trade") && !pluriel("metal", "metals"), "le seul pluriel, dans un seul sens");
  assert.equal(simMot("metals", "metal", squelette("metals"), squelette("metal")), 0.95);
  assert.equal(preparerEntite("聯成廢金屬回收有限公司", "cantonais"), "luen sing metal recycling");
  assert.ok(score("Luen Shing Recycling Metals Limited", "聯成廢金屬回收有限公司") >= 0.81, "mesuré à 0,138 avant, 0,729 avec « scrap metal » et le pluriel à 0,833");
});

test("tour 5, OCR : un chiffre confondu en tête (« 8G »), un numéro mêlé (« l2 »), et le 1 qui vaut i ou l", () => {
  assert.ok(score("BG BAHARI MUTIARA 12", "8G 8AHARI MUTIARA l2") > 0.81, "mesuré à 0,000 avant : « l2 » lu mot, « 12 » lu numéro");
  assert.ok(score("MT CORAL KEMUNING", "MT C0RAL KEMUN1NG") > 0.81, "mesuré à 0,800 avant : « kemunlng » était un mot ambigu");
  assert.equal(preparerEntite("SHIRATSUNE MARU NO18"), preparerEntite("Shiratsune Maru No. 18"), "un chiffre en fin de mot reste un numéro");
  assert.equal(preparerEntite("HULL S1187"), "hull s 1187", "un numéro de coque n'est pas un mot mal lu");
  assert.equal(lettrePerdue(`kemun${LU_UN}ng`, "kemuning"), true);
  assert.equal(lettrePerdue(`kemun${LU_UN}ng`, "kemunlng"), true);
  assert.equal(lettrePerdue(`kemun${LU_UN}ng`, "kemunang"), false, "le 1 n'est qu'un i ou un l");
});

test("tour 5, OCR : rn lu pour m dans une forme ou un mot connu, jamais dans un nom propre", () => {
  assert.ok(score("Wing Shing Group Holdings Limited", "WING SHING GROUP HOLDINGS LIRNITED") > 0.81, "mesuré à 0,800 avant");
  assert.equal(preparerEntite("Lirnited Liability Company Alpha"), "alpha");
  assert.equal(preparerEntite("Grnbh Beta"), preparerEntite("GmbH Beta"));
  assert.equal(preparerEntite("Carnowell Flange Works"), "carnowell flange works", "un nom propre inconnu reste tel quel");
  assert.equal(preparerEntite("Warner Trading"), "warner trading", "un mot connu ne bouge pas");
});

test("tour 5, la lettre perdue : une suite de « ? », une forme complétée, un mot du métier retrouvé", () => {
  assert.ok(score("Công ty Cổ phần Nông sản Tân Đức Minh", "Cong ty Co phan N?ng san T?n ??c Minh") > 0.81, "mesuré à 0,400 avant");
  assert.ok(score("Công ty TNHH Kenanga Pacific Việt Nam", "C?NG TY TNHH KENANGA PACIFIC VI?T NAM") > 0.81, "mesuré à 0,800 avant");
  assert.ok(score("Qamar-ul-Islam Surgical Instruments (Pvt.) Ltd.", "QAMAR UL ISLAM SURGICAL INSTRUMENTS (PVT) LT?") > 0.81, "mesuré à 0,800 avant");
  assert.equal(preparerEntite("Alpha Trading L?d"), "alpha trading");
  assert.equal(preparerEntite("Alpha Trading Ltd?"), "alpha trading");
  assert.equal(preparerEntite("What? Ever Ltd"), "what ever", "un « ? » après un mot ordinaire reste une ponctuation");
  assert.equal(preparerEntite("T?n ??c Minh"), `t${PERDU}n ${PERDU}${PERDU}c minh`, "« ??c » : deux lettres perdues ; ni « inc » ni « llc », on ne choisit pas");
  assert.equal(preparerEntite("N?ng san Minh"), preparerEntite("Nong san Minh"), "« nong » de « nong san », le seul mot du métier qui convienne");
  assert.equal(preparerEntite("Alpha L1mited"), "alpha");
});

test("tour 5, clavardage : abréviations sans point, sigles vietnamiens, « n » entre deux mots", () => {
  assert.ok(score("Najmat Al Sahel Electronics Trading L.L.C.", "najmat alsahel electronics trdg llc") > 0.81, "mesuré à 0,628 avant");
  assert.ok(score("Mulji Devshi & Sons General Trading L.L.C.", "mulji devshi n sons gen trading") > 0.81, "mesuré à 0,689 avant");
  assert.ok(score("Công ty Cổ phần Phân phối Minh Khang", "cty cp phan phoi minh khang") > 0.81, "mesuré à 0,800 avant");
  assert.equal(preparerEntite("Meenakshi Grp Hldgs Bldg"), "meenakshi group holdings building");
  assert.equal(preparerEntite("N. Kumar Traders"), "n kumar traders", "une initiale avec son point reste");
  assert.equal(preparerEntite("Rock n Roll Ltd"), "rock roll");
  assert.equal(preparerEntite("Kumar Traders N"), "kumar traders n", "en queue, « n » n'est pas un « and »");
});

test("tour 5, clavardage : une civilité soudée au mot suivant ne se lit que si l'autre nom l'a écrite", () => {
  assert.ok(score("Sri Pelangi Distributors Sdn. Bhd.", "sripelangi distributors sdn bhd") > 0.81, "mesuré à 0,529 avant");
  assert.ok(score("Shree Ganesh Traders", "shreeganesh traders") > 0.81);
  assert.ok(score("Srinivas Traders", "Nivas Traders") < 0.81, "« Sri » n'a pas été écrit à part : Srinivas n'est pas Nivas");
  assert.deepEqual(preparerNom(f, "Sri Pelangi Distributors").civilites, ["sri"]);
  assert.equal(preparerEntite("Shree Ganesh Traders"), "ganesh traders", "la civilité s'ôte toujours du texte");
});

test("tour 5, clavardage : le qualificatif privé à une lettre près devant Ltd, et la faute d'un mot que le dictionnaire connaît", () => {
  assert.ok(score("Kim Seng Hardware & Building Materials Pte. Ltd.", "Kim Send Hardware & Building Materials Pre Ltd") > 0.81, "mesuré à 0,720 avant");
  assert.equal(preparerEntite("Alpha Pre Ltd"), preparerEntite("Alpha Pte Ltd"));
  assert.ok(analyserEntite("Alpha Pre Ltd").prive);
  assert.ok(score("M/T Bellanova Pride", "M/T Bellanova Prode") > 0.81, "mesuré à 0,810 avant : la faute d'une touche voisine");
  assert.ok(score("Marlin Fisheries", "Merlin Fisheries") < 0.81, "deux mots que le dictionnaire connaît restent deux mots");
  assert.ok(score("Halvern Rail Services Ltd", "Halvern Mail Services Ltd") < 0.81);
  assert.ok(score("Qadir Brothers Trading", "Nadir Brothers Trading") < 0.81, "l'initiale reste l'initiale");
  assert.ok(score("Chin Heng Trading Pte Ltd", "Chin Hong Trading Pte Ltd") < 0.81, "deux syllabes isolées sont deux syllabes");
  assert.ok(score("Cong ty TNHH Det May Nam Phuong", "Cong ty TNHH Det May Nam Phong") < 0.81, "deux mots que le dictionnaire ignore restent ambigus");
  assert.equal(estSyllabeIsolee("heng") && estSyllabeIsolee("phuong"), true);
  assert.equal(estSyllabeIsolee("send") || estSyllabeIsolee("pride"), false);
  assert.equal(analyserEntite("Kim Send Hardware Pre Ltd").chat, true);
  assert.equal(analyserEntite("kim seng hardware pte. ltd.").chat, true, "tout en minuscules");
  assert.equal(analyserEntite("KIM SEND HARDWARE PRE LTD").chat, false, "un export en majuscules n'est pas un clavardage");
  assert.equal(analyserEntite("Kim Seng Hardware Pte. Ltd.").chat, false, "un registre ponctue");
  assert.equal(analyserEntite("Chin Hong Trading Pte Ltd (振丰贸易)").chat, false, "une annotation entre parenthèses n'est pas un clavardage");
});

test("tour 5 : le thaï se lit (RTGS), se compare sur ses consonnes, et ses mots du commerce se traduisent", () => {
  /* la lecture : voyelles devant, après, implicites ; ห muet ; groupes ; ์ éteint ; รร */
  assert.equal(thaiEnLatin("โชคดี"), "chokdi");
  assert.equal(thaiEnLatin("เจริญ"), "charoen", "เ-ิ autour d'un faux groupe");
  assert.equal(thaiEnLatin("รุ่งโรจน์"), "rungrot", "์ éteint le น, จ final se lit t");
  assert.equal(thaiEnLatin("ขนส่ง"), "khonsong", "la voyelle implicite o de la syllabe fermée");
  assert.equal(thaiEnLatin("ถนน"), "thanon", "a puis o sur trois consonnes nues");
  assert.equal(thaiEnLatin("หมอ"), "mo", "ห muet devant ม, อ voyelle");
  assert.equal(thaiEnLatin("กรรม"), "kam");
  assert.equal(thaiEnLatin("สวน"), "suan");
  assert.equal(thaiEnLatin("เพชร"), "phet", "le ร qui reste après une finale est muet");
  assert.equal(thaiEnLatin("จันทร์"), "chan");
  assert.equal(thaiEnLatin("เสรี"), "seri", "สร n'est un groupe que devant un signe lié à la voyelle écrite devant");
  assert.equal(thaiEnLatin("เคสเตรล"), "khestrel", "ส et ล finales gardent leur lettre : les mots anglais écrits en thaï");
  /* la préparation : formes, préfixe de navire, parenthèse de pays, mots collés */
  assert.equal(preparerEntite("บริษัท โชคดี โฟรเซ่น ฟู้ด จำกัด"), "chokdi frozen food");
  assert.equal(preparerEntite("บริษัท น้ำตาลรุ่งโรจน์ จำกัด"), "sugar rungrot", "le mot du commerce collé au nom propre");
  assert.equal(preparerEntite("เรือลำเลียง ทองเจริญ 9"), "thongcharoen 9");
  assert.ok(analyserEntite("เรือลำเลียง ทองเจริญ 9").navire);
  assert.deepEqual(analyserEntite("บริษัท เคนันกา แปซิฟิก (ประเทศไทย) จำกัด").pays, ["TH"]);
  assert.deepEqual([...analyserEntite("บริษัท เคนันกา แปซิฟิก (ประเทศไทย) จำกัด").parentheses], ["thailand"]);
  /* la clé consonantique, mode thaï : kh k, ph p, th t, j ch, ch final t */
  assert.equal(cleAbjad("khenanka", "thai"), cleAbjad("kenanga", "thai"));
  assert.equal(cleAbjad("rungroj", "thai"), cleAbjad("rungrot", "thai"));
  assert.notEqual(cleAbjad("chokdi", "thai"), cleAbjad("chokchai", "thai"));
  /* les scores, et les pièges du jeu 9 */
  assert.ok(score("Chokdee Frozen Food Co., Ltd.", "บริษัท โชคดี โฟรเซ่น ฟู้ด จำกัด") >= 0.81);
  assert.ok(score("Kenanga Pacific (Thailand) Co., Ltd.", "บริษัท เคนันกา แปซิฟิก (ประเทศไทย) จำกัด") >= 0.81);
  assert.ok(score("MV ANDAMAN KESTREL", "อันดามัน เคสเตรล") >= 0.81);
  assert.ok(score("Rungroj Sugar Co., Ltd.", "บริษัท น้ำตาลรุ่งโรจน์ จำกัด") >= 0.81);
  assert.ok(score("เรือลำเลียง ทองเจริญ 9", "BARGE THONG CHAROEN 9") >= 0.81, "deux mots collés en thaï : le bloc");
  assert.ok(score("Siam Chokchai Packaging Co., Ltd.", "บริษัท สยามโชคดี แพ็คเกจจิ้ง จำกัด") < 0.81, "โชคดี n'est pas โชคชัย");
  assert.ok(score("บริษัท น้ำตาลรุ่งโรจน์ จำกัด", "Rungroj Rice Co., Ltd.") < 0.81, "le sucre n'est pas le riz");
  assert.ok(score("บริษัท สยามโชคชัย กรุ๊ป จำกัด", "Siam Chokchai Group (Myanmar) Co., Ltd.") < 0.81, "la filiale");
});

test("tour 5 : le tamoul se lit (abugida), son sanskrit se replie au crédit, et ses mots du commerce se traduisent", () => {
  assert.equal(tamoulEnLatin("கல்யாணி"), "kalyani");
  assert.equal(tamoulEnLatin("லட்சுமி"), "latchumi", "ச après une consonne éteinte se lit ch");
  assert.equal(tamoulEnLatin("மீனாட்சி"), "meenatchi", "ீ s'écrit ee, comme l'usage");
  assert.equal(tamoulEnLatin("அன்னபூரணி"), "annapoorani");
  assert.equal(tamoulEnLatin("முருகன்"), "murukan", "la sourde : le squelette replie g sur k");
  assert.equal(tamoulEnLatin("காஞ்சிபுரம்"), "kanchipuram", "ஞ éteint est n, ச après lui ch");
  assert.equal(pliTamoul("lakshmi"), pliTamoul("latchumi"), "kṣ écrit ட்ச, avec le u glissé");
  assert.equal(pliTamoul("meenakshi"), pliTamoul("meenatchi"));
  assert.equal(preparerEntite("ஸ்ரீ வேல் முருகன் டிரேடர்ஸ் பிரைவேட் லிமிடெட்"), "vel murukan traders", "ஸ்ரீ est la civilité, பிரைவேட் லிமிடெட் la forme");
  assert.ok(analyserEntite("மீனாட்சி சுந்தரம்").indien, "un nom tamoul est indien : le crédit v, w, b");
  assert.ok(score("Lakshmi Kalyani Textiles Sdn. Bhd.", "லட்சுமி கல்யாணி டெக்ஸ்டைல்ஸ் Sdn Bhd") >= 0.81);
  assert.ok(score("Meenakshi Sundaram Group Holdings Pte. Ltd.", "மீனாட்சி சுந்தரம் க்ரூப் ஹோல்டிங்ஸ் பிரைவேட் லிமிடெட்") >= 0.81);
  assert.ok(score("Sri Annapoorani Rice Merchants Pte. Ltd.", "ஸ்ரீ அன்னபூரணி அரிசி வியாபாரிகள் பிரைவேட் லிமிடெட்") >= 0.81);
  assert.ok(score("MV ORIENT KALYANI", "ஓரியண்ட் கல்யாணி") >= 0.81);
  assert.ok(score("ஸ்ரீ லட்சுமி டிரேடர்ஸ்", "Sri Lakshmi Textiles") < 0.81, "un autre mot du commerce");
  assert.ok(score("ஸ்ரீ அன்னபூரணி அரிசி வியாபாரிகள்", "Sri Annapoorani Spice Merchants") < 0.81);
  assert.ok(score("மீனாட்சி சுந்தரம் க்ரூப் ஹோல்டிங்ஸ் பிரைவேட் லிமிடெட்", "Meenakshi Sundaram Group Holdings Sdn. Bhd.") < 0.81, "Private Limited contre Sdn. Bhd. : deux pays");
});

test("tour 6, voie locale : résidus de banque et de douane, immatriculations, indicatifs, numéros de registre, swahili, OCR courte", () => {
  const porte = (brut: string, attendu: string) => assert.ok(variantes(brut).includes(attendu), `${brut} → ${variantes(brut).join(" | ")}`);
  porte("Benue Sesame Seed Export Enterprises Limited REF LC0193045", "Benue Sesame Seed Export Enterprises Limited");
  porte("Plateau Tin and Columbite Mining Enterprises Limited A/C 331276", "Plateau Tin and Columbite Mining Enterprises Limited");
  porte("KADUNA TEXTILE MANUFACTURING INDUSTRIES PLC-ACCT BENEF", "KADUNA TEXTILE MANUFACTURING INDUSTRIES PLC");
  porte(":50:BALOGUN VENTURES LAGOS LIMITED", "BALOGUN VENTURES LAGOS LIMITED");
  porte("TUG APAPA MUSCLE CS:5NCT7", "TUG APAPA MUSCLE");
  porte("FV ATLANTIC EGRET (GHA-1893)", "FV ATLANTIC EGRET");
  porte("Warri Frozen Fish and Seafood Export Enterprises Limited45 Marina Road Warri", "Warri Frozen Fish and Seafood Export Enterprises Limited");
  porte("Okeke, Chidi Building Materials Enterprises", "Chidi Okeke Building Materials Enterprises");
  assert.ok(variantes("Tesfaye Bekele Trading PLC (Amharic: ተስፋዬ በቀለ ንግድ)").includes("Tesfaye Bekele Trading PLC"));
  /* le numéro de registre (variante typée de la voie formes) : deux numéros différents sont deux dépôts, un seul côté numéroté est le même nom */
  assert.ok(score("Nwosu Farm Produce & Sons Limited (RC 458821)", "Nwosu Farm Produce & Sons Limited (RC 488521)") < 0.81);
  assert.ok(score("Nwosu Farm Produce & Sons Limited (RC 458821)", "Nwosu Farm Produce & Sons Limited") >= 0.81);
  assert.ok(score("Naidoo Freight Logistics (Pty) Ltd (Reg. No. 2013/098765/07)", "Naidoo Freight Logistics (Pty) Ltd") >= 0.81);
  /* le swahili et le registre nigérian */
  const fr = frequencesDe([["alpha holdings"], ["beta trading"], ["gamma shipping"], ["delta industries"], ["epsilon logistics"],
    ["zeta group"], ["eta marine"], ["theta foods"], ["iota metals"], ["kappa trading company"]]);
  assert.ok(scoreNoms(fr, "Usafirishaji wa Bahari Kenya Limited", "Usafirishaji Bahari Kenya Limited") >= 0.81);
  assert.equal(preparerEntite("Okafor Integrated Resources Nig. Ltd"), "okafor integrated resources nigeria");
  /* l'OCR d'un cachet : trois lettres et un 0 final, des chiffres au milieu et à la fin */
  assert.equal(preparerEntite("CH1NEDU AUT0 PARTS LTD").replace(/[^a-z ]/g, "?"), "ch?nedu auto parts");
  assert.equal(preparerEntite("05EI ELECTR0NIC5 MART"), "osei electronics mart");
  assert.equal(preparerEntite("TCB1207 Holdings"), "tcb 1207 holdings", "un numéro reste un numéro");
});

test("tour 6, formes : le pluriel n'est le même mot que pour un mot du commerce ; ailleurs c'est un autre nom", () => {
  assert.ok(pluriel("metals", "metal") && pluriel("industries", "industry") && pluriel("valves", "valve") && pluriel("provisions", "provision"));
  assert.ok(!pluriel("egrets", "egret") && !pluriel("stores", "store") && !pluriel("shops", "shop") && !pluriel("pearls", "pearl"), "un mot distinctif au pluriel");
  assert.ok(formePlurielle("njoroges", "njoroge") && !formePlurielle("njoroge", "njoroges"));
  assert.equal(simMot("egret", "egrets", squelette("egret"), squelette("egrets")), 0.5, "deux mots anglais distincts, pas une lettre de différence");
  assert.equal(simMot("metals", "metal", squelette("metals"), squelette("metal"), true, false), 0.5, "dans un nom de navire, tout pluriel est une autre coque");
  /* les quatre navires et les deux boutiques du jeu 10 */
  for (const [a, b] of [["MV Bonny Egret", "MV Bonny Egrets"], ["MV Nembe Fortune", "MV Nembe Fortunes"], ["MV Kalabari Star", "MV Kalabari Stars"],
    ["MV Ocean Trader", "MV Ocean Traders"], ["Patience Provisions Store", "Patience Provisions Stores Limited"], ["YU5UF PR0VISI0NS SH0P", "YU5UF PR0VISI0NS SH0PS"],
    ["Kamau Njoroge Provisions", "Kamau Njoroges Provisions"]]) assert.ok(score(a, b) < 0.81, `${a} / ${b} : ${score(a, b)}`);
  /* ce que le tour cinq avait gagné tient, et les pluriels des marchandises aussi */
  assert.ok(score("Luen Shing Recycling Metals Limited", "聯成廢金屬回收有限公司") >= 0.81);
  assert.ok(score("Wenzhou Longhua Valve Co., Ltd.", "Wenzhou Longhua Valves Co., Ltd.") >= 0.81);
  assert.ok(score("The Wexcombe Malting Company Limited", "Wexcombe Maltings") >= 0.81);
  /* le pluriel d'un clavardage sans forme d'aucun côté : le téléphone ôte ou ajoute le s */
  assert.ok(score("Ngozi Chukwuemeka Stores", "Ngozi Chukwuemeka Store") >= 0.81);
  /* les deux autres portes fermées : le dernier mot « tronqué » d'un s, et le champ coupé dans un pluriel ou dans une forme */
  assert.equal(tronque("egret", "egrets"), false);
  assert.equal(tronque("engineer", "engineering"), true);
  assert.equal(fauteDeFrappe("njoroge", "njoroges"), false, "un s final n'est pas le geste d'une faute");
  assert.equal(sembleCoupe("Société Malienne d'Import-Export SA", "Société Malienne d'Import-Export SARL"), false, "SA n'est pas SARL coupé : deux sociétés");
  assert.equal(sembleCoupe("Patience Provisions Store", "Patience Provisions Stores Limited"), false);
  assert.equal(sembleCoupe("FOSHAN JINYUAN CERAMIC SA", "Foshan Jinyuan Ceramic Sanitary Ware Co., Ltd."), true, "SA coupé dans Sanitary reste une coupe");
  assert.ok(score("Foshan Jinyuan Ceramic Sanitary Ware Co., Ltd.", "FOSHAN JINYUAN CERAMIC SA") >= 0.81);
  assert.ok(score("Société Malienne d'Import-Export SARL", "Société Malienne d'Import-Export SA") < 0.81);
});

test("tour 6, formes : un ancien nom des deux côtés est possible, jamais fort ; d'un seul côté, la même coque", () => {
  const v = variantesTypees("MV Apapa Falcon (ex Warri Osprey, 2020)");
  assert.ok(v.some((x) => x.texte === "Warri Osprey" && x.ancien) && v.some((x) => x.texte === "MV Apapa Falcon" && !x.ancien), JSON.stringify(v));
  const n = variantesTypees("Olmsbury Milling Corporation, now known as Olmsbury Grain Corporation");
  assert.ok(n.some((x) => x.texte === "Olmsbury Grain Corporation" && !x.ancien) && n.some((x) => x.texte === "Olmsbury Milling Corporation" && x.ancien),
    "derrière « now known as », c'est la seconde partie qui est le nom actuel");
  assert.deepEqual(variantes("LUNARIS DAWN (EX-SELVANA)"), ["LUNARIS DAWN (EX-SELVANA)", "LUNARIS DAWN", "SELVANA"], "les textes seuls, dans le même ordre");
  const l = (texte: string, ancien: boolean, mention = "", registre = "", partie = "", paysRegistre = "", associe = "") => ({ texte, lecture: "mandarin" as const, ancien, mention, registre, partie, paysRegistre, associe });
  assert.equal(plafondDesLectures(l("Warri Osprey", true), l("Warri Osprey", true)), 0.8);
  assert.equal(plafondDesLectures(l("MV Warri Osprey", false), l("Warri Osprey", true)), 1);
  assert.ok(Math.abs(score("MV Apapa Falcon (ex Warri Osprey, 2020)", "MV Onne Pelican (ex Warri Osprey, 2006)") - 0.8) < 1e-9, "mesuré à 1,000 avant");
  assert.ok(score("MV Warri Osprey", "MV Apapa Falcon (ex Warri Osprey)") >= 0.81);
  assert.ok(score("Olmsbury Grain Corporation f/k/a Olmsbury Milling Corporation", "Olmsbury Milling Corporation") >= 0.81);
});

test("tour 6, formes : la succursale dit ce qu'elle nomme ; le siège n'est pas la succursale, Cotonou n'est pas Lomé", () => {
  assert.equal(mentionDeSuccursale("Hamburg Handelsbank AG, Speicherstadt Branch"), "speicherstadt");
  assert.equal(mentionDeSuccursale("Hamburg Handelsbank AG, Hauptsitz"), "siege");
  assert.equal(mentionDeSuccursale("Mombasa Coastal Bank Plc, Nairobi Head Office"), "siege");
  assert.equal(mentionDeSuccursale("Rotterdam Trade Bank N.V., Hoofdkantoor"), "siege");
  assert.equal(mentionDeSuccursale("Rotterdam Trade Bank N.V., Havengebied Kantoor"), "havengebied");
  assert.equal(mentionDeSuccursale("Kenanga Pacific Sdn. Bhd. - Penang Branch"), "penang");
  assert.equal(mentionDeSuccursale("Kano Merchant Bank Limited Sabon Gari Branch"), "sabon gari", "sans virgule, le lieu suit la forme");
  assert.equal(mentionDeSuccursale("Krause GmbH, Zweigniederlassung Leipzig (HRB 22045, AG Leipzig)"), "leipzig", "le numéro de registre s'ôte d'abord");
  assert.equal(mentionDeSuccursale("Kamau Provisions Branch"), "branch", "la succursale sans dire laquelle");
  assert.equal(mentionDeSuccursale("Office National des Ports"), "", "« Office » seul est un mot du nom");
  assert.equal(mentionDeSuccursale("Acme Ltd, Office 12, Building 3"), "", "une adresse ne nomme rien");
  assert.ok(succursalesCompatibles("", "") && succursalesCompatibles("penang", "penang") && succursalesCompatibles("branch", "penang"));
  assert.ok(!succursalesCompatibles("", "penang") && !succursalesCompatibles("siege", "penang") && !succursalesCompatibles("siege", "branch") && !succursalesCompatibles("cotonou", "lome"));
  /* la variante sans la mention la garde en propriété */
  assert.ok(variantesTypees("Hamburg Handelsbank AG, Speicherstadt Branch").some((v) => v.texte === "Hamburg Handelsbank AG" && v.mention === "speicherstadt"));
  assert.ok(variantesTypees("Hamburg Handelsbank AG, Hauptsitz").some((v) => v.texte === "Hamburg Handelsbank AG" && v.mention === "siege"));
  for (const [a, b] of [["Hamburg Handelsbank AG, Speicherstadt Branch", "Hamburg Handelsbank AG, Hauptsitz"],
    ["Kano Merchant Bank Limited, Sabon Gari Branch", "Kano Merchant Bank Limited, Head Office"],
    ["Rotterdam Trade Bank N.V., Havengebied Kantoor", "Rotterdam Trade Bank N.V., Hoofdkantoor"],
    ["Bight of Benin Logistics Limited, Cotonou Branch", "Bight of Benin Logistics Limited, Lome Branch"],
    /* 34 lettres : le nom coupé garde la mention que la coupe emportait */
    ["Southern Africa Forwarding Limited, Durban Branch", "Southern Africa Forwarding Limited, Maputo Branch"]]) {
    assert.ok(Math.abs(score(a, b) - 0.8) < 1e-9, `${a} / ${b} : ${score(a, b)} (mesuré à 1,000 avant)`);
  }
  /* la même personne morale : une mention d'un seul côté, la variante sans elle rejoint l'autre */
  assert.ok(score("Kenanga Pacific Sdn. Bhd. - Penang Branch", "Kenanga Pacific Sdn. Bhd.") >= 0.81);
  assert.ok(score("Kano Merchant Bank Limited, Head Office", "Kano Merchant Bank Limited") >= 0.81);
  assert.ok(score("Kano Merchant Bank Limited Sabon Gari Branch", "Kano Merchant Bank Limited, Sabon Gari Branch") >= 0.81);
  assert.ok(score("Office National des Ports", "Office National des Ports SA") >= 0.81);
});

test("tour 6, formes : la GmbH & Co. KG n'est pas la GmbH ; SARL et SA, Lda et SA, Ltd et PLC, BV et NV sont possibles, jamais forts", () => {
  const m = (n: string) => analyserEntite(n);
  assert.deepEqual(m("Vogel Kunststofftechnik GmbH & Co. KG").familles, ["part"]);
  assert.deepEqual(m("Hoffmann Textilmaschinen Handelsgesellschaft mbH").familles, ["llc"], "mbH est une GmbH");
  assert.equal(marquesEnConflit(m("Vogel Kunststofftechnik GmbH"), m("Vogel Kunststofftechnik GmbH & Co. KG")), true);
  assert.equal(marquesEnConflit(m("Transportes Lisboa Lda"), m("Transportes Lisboa SA")), true);
  for (const [a, b] of [["Vogel Kunststofftechnik GmbH", "Vogel Kunststofftechnik GmbH & Co. KG"],
    ["Hoffmann Textilmaschinen Handelsgesellschaft mbH", "Hoffmann Textilmaschinen Handelsgesellschaft mbH & Co. KG"],
    ["Transportes Lisboa Lda", "Transportes Lisboa SA"], ["Harrow Grain Ltd", "Harrow Grain PLC"], ["Vermeer Beheer BV", "Vermeer Beheer NV"]]) {
    assert.ok(Math.abs(score(a, b) - 0.8) < 1e-9, `${a} / ${b} : ${score(a, b)}`);
  }
  assert.equal(score("Vogel Kunststofftechnik GmbH & Co. KG", "Vogel Kunststofftechnik GmbH & Co KG"), 1);
  assert.equal(score("Vogel Kunststofftechnik GmbH & Co. Kommanditgesellschaft", "Vogel Kunststofftechnik GmbH & Co. KG"), 1);
  assert.equal(score("Keller Handelsgesellschaft mbH", "Keller Handelsgesellschaft GmbH"), 1);
});

test("tour 6, formes : le nom commercial sans forme face au nom déposé avec son pays, ses qualificatifs et son numéro de registre", () => {
  assert.equal(numeroDeRegistre("Adeyemi Agro Commodities Nigeria Limited (RC 884213)"), "884213");
  assert.equal(numeroDeRegistre("Botha Handel en Vervoer (Pty) Ltd (Reg. No. 2014/117230/07)"), "201411723007");
  assert.equal(numeroDeRegistre("Krause Werkzeugmaschinen GmbH (HRB 55620, AG Dresden)"), "55620");
  assert.equal(numeroDeRegistre("Okafor Integrated Resources Nig. Ltd RC 762904"), "762904");
  assert.equal(numeroDeRegistre("MV RC 1234"), "", "un numéro de registre suit une forme ou vit entre parenthèses");
  assert.equal(preparerEntite("Okafor Integrated Resources Nig. Ltd"), "okafor integrated resources nigeria");
  assert.ok(variantes("Botha Handel en Vervoer (Pty) Ltd (Reg. No. 2014/117230/07)").includes("Botha Handel en Vervoer (Pty) Ltd"), "la barre du numéro n'est pas un suffixe SWIFT");
  for (const [a, b] of [["Adeyemi Agro Commodities", "Adeyemi Agro Commodities Nigeria Limited"], ["Okafor Integrated Resources", "Okafor Integrated Resources Nig. Ltd"],
    ["Balogun Global Ventures", "Balogun Global Ventures Enterprises Limited"], ["Chukwu Petroleum Services", "Chukwu Petroleum Services Integrated Limited"],
    ["Nwosu Farm Produce", "Nwosu Farm Produce & Sons Limited"], ["Adeyemi Agro Commodities Nigeria Limited (RC 884213)", "Adeyemi Agro Commodities"],
    ["Botha Handel en Vervoer (Pty) Ltd (Reg. No. 2014/117230/07)", "Botha Handel en Vervoer"], ["Krause Werkzeugmaschinen GmbH (HRB 55620, AG Dresden)", "Krause Werkzeugmaschinen GmbH"]]) {
    assert.ok(score(a, b) >= 0.81, `${a} / ${b} : ${score(a, b)} (mesuré à 0,800 avant)`);
  }
  /* les deux côtés avec une forme : la filiale ; la holding ; un seul mot ; deux numéros de registre ; la succursale allemande et son siège */
  for (const [a, b] of [["Adeyemi Agro Commodities Nigeria Ltd", "Adeyemi Agro Commodities Ltd"], ["CHELYABINSK METAL WORKS", "Chelyabinsk Metal Works Holdings JSC"],
    ["Shell", "Shell Nigeria Limited"], ["Adeyemi Agro Commodities Nigeria Limited (RC 884213)", "Adeyemi Agro Commodities Nigeria Limited (RC 918532)"],
    ["Krause Werkzeugmaschinen GmbH, Zweigniederlassung Leipzig (HRB 22045, AG Leipzig)", "Krause Werkzeugmaschinen GmbH (HRB 55620, AG Dresden)"]]) {
    assert.ok(score(a, b) < 0.81, `${a} / ${b} : ${score(a, b)}`);
  }
});

/* ─── tour 6, voie des registres : les noms déposés au Handelsregister, à la KvK, au registre lusophone,
   ouest-africain et sud-africain, face à leurs noms d'usage ─── */

/* des fréquences à l'image des listes : mille entrées, les mots du métier courants (sur les vraies listes,
   « trading » est dans 826 entrées sur 33 393, « commercial » et « import » dans une centaine), les noms propres
   absents. À poids uniformes, tout orphelin pèse le maximum et plafonne ; et sur une petite liste, le plancher
   d'une particule ou d'un adjectif régional pèse encore trop face au maximum */
const rep6 = (n: number, mot: string) => Array.from({ length: n }, (_, i) => [`Nom${i} ${mot}`]);
const fr6 = frequencesDe([...rep6(300, "Trading"), ...rep6(200, "Group"), ...rep6(80, "Commercial"), ...rep6(80, "Import Export"),
  ...rep6(60, "Logistics"), ...rep6(60, "Transport"), ...rep6(50, "Chemical"), ...rep6(15, "Machines"), ...rep6(15, "Sons"), ...rep6(140, "Alpha")]);
const s6 = (a: string, b: string) => scoreNoms(fr6, a, b);

test("tour 6, registres : les formes Lda, mbH, Sociedade ; « GmbH & Co. KG » n'est pas la GmbH du même nom", () => {
  const p = analyserEntite("Comercial Pereira e Filhos, Lda");
  assert.equal(p.texte, "commercial pereira sons");
  assert.deepEqual(p.pays, ["AO", "CV", "MZ", "PT"]);
  assert.equal(analyserEntite("Sociedade Agrícola de Malanje, Lda").texte, "agricultural de malanje");
  const h = analyserEntite("Sächsische Krause Werkzeugmaschinen Handelsgesellschaft mbH");
  /* « mbH » seul est la forme ; « Handelsgesellschaft » reste le mot « trading », des deux côtés, pour que
     « Keller Handelsgesellschaft mbH » et « Keller Handelsgesellschaft GmbH » soient un (voie formes) */
  assert.equal(h.texte, "sachsische krause werkzeugmaschinen trading", "« mbH » est la forme, « Handelsgesellschaft » un mot traduit");
  assert.deepEqual(h.familles, ["llc"]);
  assert.deepEqual(analyserEntite("Vogel Kunststofftechnik GmbH & Co. KG").familles, ["part"], "la commandite, pas sa commanditée");
  for (const [a, b] of [["Vogel Kunststofftechnik GmbH", "Vogel Kunststofftechnik GmbH & Co. KG"],
    ["Hoffmann Textilmaschinen Handelsgesellschaft mbH", "Hoffmann Textilmaschinen Handelsgesellschaft mbH & Co. KG"]]) {
    const s = score(a!, b!);
    assert.ok(s < 0.81 && s >= 0.8 - 1e-9, `la GmbH et la KG dont elle est l'associée (jeu 10), mesurées à 1,000 avant : ${s}`);
  }
  assert.ok(score("Reinholt Maschinenbau GmbH & Co. KG", "REINHOLT MASCHINENBAU GMBH CO KG") >= 0.81);
  assert.ok(s6("Hoffmann Textil", "Westfälische Hoffmann Textilmaschinen Handelsgesellschaft mbH & Co. KG") >= 0.81, "sans forme d'un côté, aucun conflit ; mesuré à 0,717 avant");
});

test("tour 6, registres : l'adjectif régional pèse le plancher d'un seul côté, et distingue deux sociétés des deux côtés", () => {
  assert.equal(regionDeRegistre("rheinische"), true);
  assert.equal(regionDeRegistre("niedersachsische"), true, "par le suffixe sur le radical du Land");
  assert.equal(regionDeRegistre("overijsselse"), true);
  assert.equal(regionDeRegistre("bremer"), true);
  assert.equal(regionDeRegistre("bayer"), false, "le radical seul est un nom");
  assert.equal(regionDeRegistre("hessen"), false);
  assert.ok(s6("Meyer Landmaschinen", "Niedersächsische Meyer Landmaschinen Handelsgesellschaft mbH") >= 0.81, "mesuré à 0,800 avant");
  assert.ok(s6("De Groot Machines", "Noord-Brabantse De Groot Machinehandel B.V.") >= 0.81, "le point cardinal suit l'adjectif au plancher ; mesuré à 0,493 avant");
  assert.ok(s6("Rheinische Industrietechnik GmbH", "Westfälische Industrietechnik GmbH") < 0.8, "deux adjectifs régionaux : deux sociétés (jeu 10)");
});

test("tour 6, registres : le composé allemand ou néerlandais, dans les deux sens, sous la marque seulement", () => {
  assert.equal(compose("stahlrohr", "rohr"), true, "le nom déterminé ferme le mot");
  assert.equal(compose("textilmaschinen", "textil"), true);
  assert.equal(compose("machinehandel", "machines"), true, "le pluriel du membre s'ôte");
  assert.equal(compose("logistics", "logic"), false, "un mot anglais ne commence pas un autre mot");
  assert.equal(compose("stahlbau", "stahlhandel"), false);
  assert.ok(s6("Jansen Metaal", "Gelderse Jansen Metaalhandel B.V.") >= 0.81, "mesuré à 0,720 avant");
  assert.ok(s6("Rheinstahl Rohr GmbH", "Rheinstahl Stahlrohr GmbH") >= 0.81);
  assert.ok(s6("Rheinstahl Rohr Ltd", "Rheinstahl Stahlrohr Ltd") < 0.81, "sans marque allemande ni néerlandaise, pas de composé");
  assert.ok(s6("Kaltenbrunner Stahlhandel GmbH", "Kaltenbrunner Stahlbau GmbH") < 0.81, "deux composés du même membre : deux sociétés (jeu 10)");
  assert.ok(s6("Smit Chemie", "Zeeuwse Smit Chemische Handelsgroep B.V.") >= 0.81, "l'adjectif et son radical traduits au même mot ; mesuré à 0,638 avant");
});

test("tour 6, registres : l'afrikaans se traduit sous la forme sud-africaine, « en » lie, le gérondif anglais est le même mot", () => {
  assert.equal(gerondif("trading", "trade"), true);
  assert.equal(gerondif("shipping", "ship"), true, "la consonne doublée");
  assert.equal(gerondif("farming", "farm"), true);
  assert.equal(gerondif("traders", "trade"), false, "jamais -er ni -ers");
  assert.equal(gerondif("krausing", "kraus"), false, "les deux mots au dictionnaire");
  assert.ok(score("Pretorius Voedsel Verwerking (Pty) Ltd", "Pretorius Food Processing (Pty) Ltd") >= 0.81, "mesuré à 0,332 avant");
  assert.ok(score("Botha Handel en Vervoer (Pty) Ltd", "Botha Trade and Transport (Pty) Ltd") >= 0.81, "mesuré à 0,403 avant");
  assert.ok(score("Venter Boumateriaal (Pty) Ltd", "Venter Building Materials (Pty) Ltd") >= 0.81);
  assert.ok(score("Dlamini Bou en Konstruksie (Pty) Ltd", "Dlamini Building and Construction (Pty) Ltd") >= 0.81);
  assert.equal(preparerEntite("Bou Regreg Trading"), "bou regreg trading", "sans forme sud-africaine, « Bou » est l'arabe Abu");
  assert.equal(preparerEntite("Venter (Edms) Bpk").length > 0 && analyserEntite("Venter (Edms) Bpk").prive, true, "« (Edms) Bpk » est « (Pty) Ltd »");
  assert.ok(score("Zuiderzee Pompen en Appendages B.V.", "Zuiderzee Pompen & Appendages B.V.") >= 0.81, "« en » est « & » (jeu 5, mesuré à 0,800 avant)");
});

test("tour 6, registres : l'élision française, l'adjectif de nationalité et le sigle du pays", () => {
  assert.equal(preparerEntite("Société Malienne d'Import-Export SARL"), "mali import export");
  assert.equal(preparerEntite("Societe Malienne d Import-Export SARL"), "mali import export", "l'apostrophe déjà ôtée par un système");
  assert.equal(preparerEntite("O'Brien Shipping"), "obrien shipping", "l'apostrophe dans un nom soude");
  assert.equal(preparerEntite("D'Angelo Trading"), "dangelo trading", "la majuscule D reste un nom");
  assert.equal(preparerEntite("L. Dupont et Fils"), "l dupont sons", "l'initiale avec son point reste");
  assert.ok(score("Société Malienne d'Import-Export SARL", "Import-Export Malienne") >= 0.81, "mesuré à 0,728 avant");
  assert.ok(s6("Société Ivoirienne des Bois Tropicaux SA", "Bois Tropicaux CI") >= 0.81, "mesuré à 0,599 avant");
  assert.equal(preparerEntite("C.I. Flores de Rionegro S.A.S."), "ci flores de rionegro", "en tête, C.I. est la Comercializadora Internacional");
  assert.ok(s6("Société Ivoirienne de Négoce SARL", "Société Sénégalaise de Négoce SARL") < 0.81, "deux pays : deux sociétés");
});

test("tour 6, registres : le descripteur qui ouvre un nom roman s'omet ; en queue, le même mot est une société sœur", () => {
  assert.equal(descripteur(preparerNom(fr6, "Comércio e Importação Ferreira, Lda")), 2);
  assert.equal(descripteur(preparerNom(fr6, "Ferreira Comércio")), 0);
  assert.ok(s6("Comercial Pereira e Filhos, Lda", "Pereira e Filhos") >= 0.81, "mesuré à 0,800 avant");
  assert.ok(s6("Exportação de Café de Huambo, Lda", "Café Huambo") >= 0.81);
  assert.ok(s6("Comércio e Importação Ferreira, Lda", "Ferreira Comércio") >= 0.81);
  const s = s6("ООО «Северный Янтарь»", "ООО «Северный Янтарь Логистик»");
  assert.ok(s < 0.81 && s >= 0.8 - 1e-9, `« Logistik » en queue, traduit, reste un orphelin rare (jeu 8) : ${s}`);
});

test("tour 6, registres : la succursale derrière une virgule n'est pas une adresse", () => {
  const v = variantes("Meyer Landmaschinen Handelsgesellschaft mbH, Zweigniederlassung Bremen");
  /* la variante sans la mention existe (c'est elle qui rejoint le nom nu), et la mention survit sur le nom tel qu'écrit */
  assert.ok(v.includes("Meyer Landmaschinen Handelsgesellschaft mbH"), v.join(" | "));
  assert.ok(analyserEntite("Meyer Landmaschinen Handelsgesellschaft mbH, Zweigniederlassung Bremen").succursale);
  /* la convention des jeux 9 et 10 : la succursale est la même personne morale que le nom nu (fort) ; c'est face au
     SIÈGE écrit, ou à une autre succursale, qu'elle se range au possible (voie formes) */
  assert.ok(s6("Meyer Landmaschinen Handelsgesellschaft mbH, Zweigniederlassung Bremen", "Meyer Landmaschinen Handelsgesellschaft mbH") >= 0.81);
  assert.ok(s6("Meyer Landmaschinen Handelsgesellschaft mbH, Zweigniederlassung Bremen", "Meyer Landmaschinen Handelsgesellschaft mbH, Hauptsitz Hannover") < 0.81);
  assert.ok(variantes("Meyer Landmaschinen Handelsgesellschaft mbH, Hannover").includes("Meyer Landmaschinen Handelsgesellschaft mbH"), "l'adresse derrière la forme s'ôte toujours");
});

test("tour 7, voie locale : registres du Panama, du Mexique et du Japon, étiquettes SWIFT, formes épelées", () => {
  const porte = (brut: string, attendu: string) => assert.ok(variantes(brut).includes(attendu), `${brut} → ${variantes(brut).join(" | ")}`);
  porte("Naviera Golfo de San Miguel, S.A. — Folio 155874 (S) Registro Público de Panamá", "Naviera Golfo de San Miguel, S.A.");
  porte("Grupo Logístico Ancla del Caribe, S.A. — Ficha 887123, Documento 2456789", "Grupo Logístico Ancla del Caribe, S.A.");
  porte("Registro Público de Panamá, Tomo 1245, Folio 332, Asiento 1 — Inversiones Marítimas Bahía Honda, S.A.", "Inversiones Marítimas Bahía Honda, S.A.");
  porte("B/M ESMERALDA DEL DARIEN — MATRICULA PMA-45678-B", "B/M ESMERALDA DEL DARIEN");
  porte("Pescados y Mariscos del Golfo Ltda. — NIT 900.123.456-7", "Pescados y Mariscos del Golfo Ltda.");
  porte("SOC. ANON. TALLERES NAVALES DE VACAMONTE (RUC 1234567-1-654321 DV 45)", "SOC. ANON. TALLERES NAVALES DE VACAMONTE");
  porte("AGROINDUSTRIAS VALLE DE MEXICALI SAPI DE CV / RFC: AVM040917QX2", "AGROINDUSTRIAS VALLE DE MEXICALI SAPI DE CV");
  porte("COMERCIALIZADORA TEXTIL DEL NORTE SA DE CV RFC CTN950812K73", "COMERCIALIZADORA TEXTIL DEL NORTE SA DE CV");
  porte("SERVICOS DE REBOCADORES COSTA VERDE LTDA CNPJ 98.765.432/0001-10 SANTOS SP", "SERVICOS DE REBOCADORES COSTA VERDE LTDA");
  porte("MARIA DEL ROSARIO ANZALDUA GARCIA / CURP AAGR790315MNLNRS08", "MARIA DEL ROSARIO ANZALDUA GARCIA");
  porte("CIA MARITIMA DEL GOLFO DE PANAMA S A / CTA 0012 3456 7890", "CIA MARITIMA DEL GOLFO DE PANAMA S A");
  porte("OGATA UNYU K.K. (TEL 03-5555-0100)", "OGATA UNYU K.K.");
  porte("Corporate Number 8011001077453 — Kurihara Kaiun Kabushiki Kaisha", "Kurihara Kaiun Kabushiki Kaisha");
  porte("Kimura Sōko Kabushiki Kaisha 〒105-0022 東京都港区海岸1-2-3", "Kimura Sōko Kabushiki Kaisha");
  porte("MV SIRENA DE TABOGA IMO N/A CALL SIGN HP1234 FLAG PANAMA", "MV SIRENA DE TABOGA");
  porte("Yoshinaga Kaiun K.K. as agents only", "Yoshinaga Kaiun K.K.");
  porte("TAKASE BOEKI CO LTD JP", "TAKASE BOEKI CO LTD");
  porte("MV NORTHERN LAGOON EXPRESS – POL BELIZE CITY – POD PROGRESO", "MV NORTHERN LAGOON EXPRESS");
  porte("MT BAHIA DE CHARCO AZUL / VOY 2611 / LOADPORT BALBOA", "MT BAHIA DE CHARCO AZUL");
  porte("APPLICANT: KANEDA SANGYO KK / 3-1-1 MARUNOUCHI CHIYODA-KU", "KANEDA SANGYO KK");
  porte("CHARTERERS: ARIMURA SHOJI CO LTD", "ARIMURA SHOJI CO LTD");
  porte("50: IMPORTADORA Y EXPORTADORA DOS OCEANOS SA DE CV", "IMPORTADORA Y EXPORTADORA DOS OCEANOS SA DE CV");
  porte(":59:/PA12BNPA00001234567890 IMPORTADORA MEDINA Y CASTELLANOS SA DE CV", "IMPORTADORA MEDINA Y CASTELLANOS SA DE CV");
  porte("70: /RFB/INV 4471 PAGO A ELECTRONICA INDUSTRIAL MONTERREY SA DE CV", "ELECTRONICA INDUSTRIAL MONTERREY SA DE CV");
  porte("/BENEFICIARY/ PESQUERA DEL ARCHIPIELAGO SA/PANAMA", "PESQUERA DEL ARCHIPIELAGO SA");
  assert.ok(variantes("*** COMPANIA DE SEGUROS MARITIMOS ISTMENOS S.A. *** PANAMA, REP. DE PANAMA").some((x) => /^COMPANIA DE SEGUROS MARITIMOS ISTMENOS( S\.A\.?)?$/.test(x)),
    "les astérisques et l'adresse s'en vont, le nom reste (avec ou sans sa forme)");
  porte("JOSE ANTONIO ESQUIVEL BENAVIDES RFC EEBJ800220A1 PERSONA FISICA CON ACTIVIDAD EMPRESARIAL", "JOSE ANTONIO ESQUIVEL BENAVIDES");
  /* les gardes : un numéro de registre entier, un matricule à tirets, une barre sans espace */
  porte("Botha Handel en Vervoer (Pty) Ltd (Reg. No. 2014/117230/07)", "Botha Handel en Vervoer (Pty) Ltd");
  assert.deepEqual(variantes("Barge BRV-12"), ["Barge BRV-12"]);
  /* les formes épelées avec des espaces, et « Soc. Anon. » */
  assert.equal(preparerEntite("Soluciones Logísticas Peñafiel S A S"), preparerEntite("Soluciones Logísticas Peñafiel, S.A.S."));
  assert.equal(preparerEntite("Transportadora Pena Blanca S de R L"), preparerEntite("Transportadora Pena Blanca, S. de R.L."));
  assert.equal(analyserEntite("SOC. ANON. TALLERES NAVALES DE VACAMONTE").familles.join(), analyserEntite("Talleres Navales de Vacamonte, S.A.").familles.join());
});

/* tour 7, voie japonaise : les poids d'une petite liste où les mots de métier sont communs, comme dans les vraies listes
   (« industry » y pèse moitié moins qu'un nom propre) ; à poids uniformes, un mot générique ne tirerait rien */
const fr7 = frequencesDe([["alpha industry"], ["beta industry"], ["gamma trading"], ["delta trading"], ["epsilon shipping"],
  ["zeta industry"], ["eta trading"], ["theta marine"], ["iota industry"], ["kappa trading company"]]);
const s7 = (a: string, b: string) => scoreNoms(fr7, a, b);

test("tour 7, japonais : Kunrei et Hepburn, voyelles longues, n devant b, m, p ; les mêmes kana valent un squelette égal", () => {
  for (const [a, b] of [["huzimoto", "fujimoto"], ["tyuo", "chuo"], ["sinwa", "shinwa"], ["zyonan", "jonan"], ["tuduki", "tsuzuki"], ["omura", "oomura"],
    ["kogyo", "kogyou"], ["ohtsuki", "otsuki"], ["nanbu", "nambu"], ["shinpo", "shimpo"], ["honma", "homma"], ["yuuki", "yuki"], ["daiiti", "daiichi"],
    ["hanazuki", "hanaduki"], ["matcha", "mattya"]]) assert.equal(pliJaponais(a!), pliJaponais(b!), `${a} / ${b}`);
  assert.notEqual(pliJaponais("shirakaba"), pliJaponais("shirakawa"));
  assert.notEqual(pliJaponais("sakuragawa"), pliJaponais("sakuragaoka"));
  assert.notEqual(pliJaponais("ohashi"), pliJaponais("oashi"), "le h devant une voyelle est une consonne, pas une longue");
  /* le crédit : au niveau fort avec un seul mot propre et un mot de métier (0,798 à 0,85), et lu AVANT la règle chinoise
     des initiales que « Co., Ltd. » ouvre (h et f, t et c : 0,295 et 0,354 avant) */
  for (const [a, b] of [["Huzimoto Sangyō K.K.", "Fujimoto Sangyo Co., Ltd."], ["Tyūō Seisakusho K.K.", "Chuo Seisakusho Co., Ltd."],
    ["Sinwa Kōgyō K.K.", "Shinwa Kogyo Co., Ltd."], ["Zyōnan Kōgyō K.K.", "Jonan Kogyo Co., Ltd."], ["Ōmura Kōgyō K.K.", "Oomura Kogyou K.K."],
    ["Ohtsuki Shoji K.K.", "Otsuki Trading Co., Ltd."], ["Kabushiki Kaisha Nanbu Tekkō", "Nambu Tekko Co., Ltd."],
    ["Kabushiki Kaisha Shinpo Denki", "Shimpo Denki Co., Ltd."]]) assert.ok(s7(a!, b!) >= 0.81, `${a} / ${b} : ${s7(a!, b!)}`);
  /* sans la marque, le pli ne s'applique pas : deux mots latins à deux lettres près */
  assert.ok(s7("Huzimoto Holdings Ltd", "Fujimoto Holdings Ltd") < 0.81);
  /* les mots de métier sous le pli : « Kogyou » se traduit comme « Kōgyō » sous un nom japonais ; « Teko » n'est pas « tekko » sans elle */
  assert.equal(preparerEntite("Oomura Kogyou K.K."), "oomura industry");
  assert.equal(preparerEntite("Teko Ltd"), "teko");
  /* ce que le tour gagne ne rouvre pas les voisins du jeu 11 */
  for (const [a, b] of [["Ryusei Unyu Co., Ltd.", "Ryusen Unyu Co., Ltd."], ["Seiryū Kaiun K.K.", "Seiun Kaiun K.K."], ["Jonan Kogyo Co., Ltd.", "Johoku Kogyo Co., Ltd."],
    ["Nagasato Yuso Co., Ltd.", "Nagasako Yūsō Co., Ltd."]]) assert.ok(s7(a!, b!) < 0.81, `${a} / ${b} : ${s7(a!, b!)}`);
});

test("tour 7, japonais : un lemme par mot de métier ; deux mots différents sous un même lemme sont deux raisons sociales ; le suffixe d'établissement ; dix lettres", () => {
  assert.equal(preparerEntite("Fukagawa Suisan Kabushiki Kaisha"), "fukagawa fisheries");
  assert.equal(preparerEntite("Kabushiki Kaisha Sakaide Kōun"), "sakaide stevedoring");
  assert.equal(preparerEntite("Kitazono Seisakusho Kabushiki Kaisha"), "kitazono manufacturing");
  assert.equal(preparerEntite("Pomyung Junggongeop Co., Ltd."), "pomyung heavy industries");
  for (const [a, b] of [["Fukagawa Suisan Kabushiki Kaisha", "Fukagawa Fisheries Co., Ltd."], ["Kabushiki Kaisha Sakaide Kōun", "Sakaide Stevedoring Co., Ltd."],
    ["Tsurumaki Sōko Kabushiki Kaisha", "Tsurumaki Warehouse Co., Ltd."], ["Kabushiki Kaisha Nishihama Kikai", "Nishihama Machinery Co., Ltd. (西浜機械)"],
    ["Hirata Zōsen Kabushiki Kaisha", "Hirata Shipbuilding Co., Ltd."], ["Kabushiki Kaisha Ōhashi Denshi", "Ohashi Electronics Co., Ltd."],
    ["Kitazono Seisakusho Kabushiki Kaisha", "Kitazono Manufacturing Co., Ltd."], ["Bomyeong Heavy Industries Co., Ltd.", "Pomyung Junggongeop Co., Ltd."]]) {
    assert.ok(s7(a!, b!) >= 0.81, `${a} / ${b} : ${s7(a!, b!)}`);
  }
  /* les sources : « Bōeki » et « Shōji » sont trading tous deux, « Tekkō » et « Tekkōsho » steel et steelworks ; le mot
     anglais n'a pas de source, et la même source sous deux graphies reste une */
  assert.ok(s7("Yūki Bōeki K.K.", "Yūki Shōji K.K.") < 0.81, "mesuré à 1,000 avant");
  assert.ok(s7("Nambu Tekko Co., Ltd.", "Nambu Tekkosho Co., Ltd.") < 0.81, "mesuré à 0,900 avant");
  assert.ok(s7("Ōtsuki Shōji K.K.", "Ōtsuki Kōgyō K.K.") < 0.81);
  assert.ok(s7("Kawanami Boeki K.K.", "Kawanami Trading Company Limited") >= 0.81);
  assert.ok(s7("Yūki Bōeki K.K.", "Yuuki Boueki Co Ltd") >= 0.81);
  assert.ok(s7("Kawanami Bōeki Kabushiki Kaisha", "Kawanami Boeki Co., Ltd.") >= 0.81);
  /* le suffixe d'établissement : ni mot coupé, ni abréviation d'un export en majuscules */
  assert.ok(suffixeEtablissement("tekko", "tekkosho") && suffixeEtablissement("koki", "kokisho") && suffixeEtablissement("seizo", "seizosho"));
  assert.ok(!suffixeEtablissement("engineer", "engineering") && !suffixeEtablissement("ko", "kosho"));
  assert.ok(s7("Nambu Kōki K.K.", "Nambu Kōkisho K.K.") < 0.81, "mesuré à 0,900 avant, par le dernier mot coupé");
  assert.ok(s7("NAMBU TEKKO CO LTD", "NAMBU TEKKOSHO CO LTD") < 0.81);
  assert.ok(score("Thornbury Engineer", "Thornbury Engineering Ltd") >= 0.81, "hors de la marque, le dernier mot coupé se lit toujours");
  /* le plafond d'ambiguïté jusqu'à dix lettres sous la marque : Shirakaba et Shirakawa, neuf lettres, une syllabe d'écart */
  const shira = s7("Shirakaba Shokai Co., Ltd.", "Shirakawa Shōkai Co., Ltd.");
  assert.ok(shira < 0.81 && shira >= 0.8 - 1e-9, `mesuré à 0,889 avant : ${shira}`);
  assert.ok(s7("Brightwater Commodities", "Brightwatter Commodities") > 0.81, "hors de la marque, huit lettres restent la borne");
});

test("tour 7, japonais : G.K., Y.K., Kabushiki Gaisha ; la numérotation dai ; Maru est un navire ; la parenthèse native au milieu ; 〒 et le numéro de société", () => {
  assert.equal(preparerEntite("Gōdō Kaisha Nishida Kōmuten"), preparerEntite("Nishida Komuten G.K."));
  assert.equal(preparerEntite("Yūgen Kaisha Tanigawa Suisan"), preparerEntite("Tanigawa Suisan Y.K."));
  assert.equal(preparerEntite("Kabushiki Gaisha Morioka Tekkō"), preparerEntite("Morioka Tekko Kabushiki Kaisha"));
  assert.equal(preparerEntite("GK Alpha Beta"), "gk alpha beta", "en tête, un sigle de deux lettres reste un mot");
  for (const [a, b] of [["Gōdō Kaisha Nishida Kōmuten", "Nishida Komuten G.K."], ["Yūgen Kaisha Tanigawa Suisan", "Tanigawa Suisan Y.K."],
    ["Kabushiki Gaisha Morioka Tekkō", "Morioka Tekko Kabushiki Kaisha"], ["Tanigawa Suisan Y.K.", "Tanigawa Suisan Co., Ltd."]]) {
    assert.ok(s7(a!, b!) >= 0.81, `${a} / ${b} : ${s7(a!, b!)}`);
  }
  assert.ok(s7("Tanigawa Suisan Y.K.", "Tanigawa Suisan Holdings K.K.") < 0.81, "la holding n'est pas la société qui exploite");
  assert.ok(marquesEnConflit(analyserEntite("Nishida Komuten G.K."), analyserEntite("Nishida Komuten FZE")), "la G.K. porte la famille llc");
  /* la numérotation : dai devant un chiffre, le numéral en lettres, en tête d'un nom japonais seulement */
  assert.equal(preparerNom(f, "Daini Tsurumi Maru").numeros, "2");
  assert.equal(preparerEntite("Daini Tsurumi Maru"), "2 tsurumi maru", "le numéral devient le jeton que la règle des numéros lit");
  assert.equal(preparerNom(f, "Dai 8 Kōfuku Maru").numeros, "8");
  assert.equal(preparerNom(f, "DAIJUU HOSEI MARU").numeros, "10", "sous les deux romanisations");
  assert.equal(preparerEntite("Dai Duong Co., Ltd."), "dai duong", "hors d'un nom japonais, Dai est un mot");
  assert.equal(preparerEntite("Daigo Sangyo K.K."), "daigo industry", "sans Maru, Daigo est un nom de société");
  assert.equal(preparerEntite("Daiichi Sankyo Co., Ltd."), "daiichi sankyo");
  for (const [a, b] of [["Dai 8 Kōfuku Maru", "Kofuku Maru No. 8"], ["Daini Tsurumi Maru", "Tsurumi Maru No. 2"], ["Daisan Hōsei Maru", "Hosei Maru No. 3"]]) {
    assert.ok(score(a!, b!) >= 0.81, `${a} / ${b} : ${score(a!, b!)}`);
  }
  assert.equal(score("Daini Tsurumi Maru", "Daisan Tsurumi Maru"), 0, "deux numéros");
  assert.equal(score("Daini Tsurumi Maru", "Tsurumi Maru No. 3"), 0);
  /* Maru : la marque navire, comme un préfixe M/V, et le conflit face à l'armateur */
  assert.ok(analyserEntite("Kōfuku Maru No. 18").navire && analyserEntite("Daini Tsurumi Maru").navire && !analyserEntite("Kofuku Kaiun K.K.").navire);
  assert.ok(score("HOZUMI MARU NO. 18", "Hozumi Kaiun K.K.") < 0.81);
  assert.ok(score("M/V Hakuyō Maru", "HAKUYO MARU") >= 0.81);
  /* la parenthèse d'écriture native au milieu du nom : une lecture de plus, rien de retiré */
  const v = variantes("Aoyagi Seisakusho (アオヤギ製作所) Co., Ltd.");
  assert.ok(v.includes("Aoyagi Seisakusho Co., Ltd.") && v.includes("アオヤギ製作所") && v[0] === "Aoyagi Seisakusho (アオヤギ製作所) Co., Ltd.", v.join(" | "));
  assert.ok(score("Aoyagi Seisakusho (アオヤギ製作所) Co., Ltd.", "Aoyagi Seisakusho Co., Ltd.") >= 0.81, "mesuré à 0,800 avant");
  assert.ok(score("Aoyagi Seisakusho (アオヤギ製作所) Co., Ltd.", "Aoyama Seisakusho Co., Ltd.") < 0.81);
  assert.ok(variantes("(株)Kuramochi Kōgyō").includes("Kuramochi Kōgyō"));
  /* une parenthèse latine n'est pas une écriture native, mais celle-ci porte une forme : c'est le second nom de la même
     société (voie hispanique du même tour, « Marisquería El Puerto (Pescados Anzures, S. de R.L.) ») */
  assert.ok(variantes("Kabushiki Kaisha Sawamura (Sawamura Corporation)").includes("Sawamura Corporation"));
  assert.ok(score("Kabushiki Kaisha Sawamura (Sawamura Corporation)", "Sawamura Corporation") >= 0.81);
  /* les résidus : l'adresse derrière 〒, le numéro de société en tête ou entre parenthèses */
  assert.ok(variantes("Kimura Sōko Kabushiki Kaisha 〒105-0022 東京都港区海岸1-2-3").includes("Kimura Sōko Kabushiki Kaisha"));
  assert.ok(score("Kimura Sōko Kabushiki Kaisha 〒105-0022 東京都港区海岸1-2-3", "Kimura Soko Co., Ltd.") >= 0.81);
  assert.ok(score("Kimura Sōko Kabushiki Kaisha 〒105-0022 東京都港区海岸1-2-3", "Kimura Unyu Sōko Co., Ltd.") < 0.81);
  assert.equal(numeroDeRegistre("Corporate Number 8011001077453 — Kurihara Kaiun Kabushiki Kaisha"), "8011001077453");
  assert.ok(variantes("Corporate Number 8011001077453 — Kurihara Kaiun Kabushiki Kaisha").includes("Kurihara Kaiun Kabushiki Kaisha"));
  assert.ok(score("Corporate Number 8011001077453 — Kurihara Kaiun Kabushiki Kaisha", "Kurihara Kaiun K.K.") >= 0.81);
  assert.ok(score("Kabushiki Kaisha Minamisawa Kinzoku (法人番号 5010401099876)", "Minamisawa Kinzoku Co., Ltd.") >= 0.81);
  assert.ok(score("Kabushiki Kaisha Minamisawa Kinzoku (法人番号 5010401099876)", "Kabushiki Kaisha Minamisawa Kinzoku (法人番号 5010401099877)") < 0.81, "deux numéros de société, deux dépôts");
});

/* ─────────────────────────── tour 7, voie hispanique (jeu 11) ─────────────────────────── */
import { motsHispaniquesDistincts, MOTS_HISPANIQUES, pliEnye, nommeUneSociete } from "./entites.ts";
const fr7h = frequencesDe([...rep6(300, "Trading"), ...rep6(80, "Commercial"), ...rep6(60, "Transport"), ...rep6(40, "Shipping"),
  ...rep6(15, "Sons"), ...rep6(140, "Alpha")]);
const s7h = (a: string, b: string) => scoreNoms(fr7h, a, b);

test("tour 7, hispanique : deux mots espagnols ou portugais du vocabulaire sont deux mots, le pluriel reste au pluriel", () => {
  assert.ok(motsHispaniquesDistincts("faro", "foro") && motsHispaniquesDistincts("manzana", "manzano") && motsHispaniquesDistincts("sureste", "suroeste"));
  assert.ok(!motsHispaniquesDistincts("perla", "perlas") && !motsHispaniquesDistincts("flor", "flores") && !motsHispaniquesDistincts("cruz", "cruces"), "le pluriel roman n'est pas un autre mot");
  assert.ok(!motsHispaniquesDistincts("munoz", "muniz") && !motsHispaniquesDistincts("gomez", "gamez"), "les patronymes n'y sont pas : le plafond du mot ambigu les tient");
  assert.ok(!motsHispaniquesDistincts("faro", "faro") && !motsHispaniquesDistincts("sol", "sal"), "ni le même mot, ni les mots de moins de quatre lettres");
  for (const m of MOTS_HISPANIQUES) assert.ok(/^[a-z]+$/.test(m), `« ${m} » doit être écrit comme la normalisation le laisse`);
  assert.equal(simMot("faro", "foro", squelette("faro"), squelette("foro")), 0.5);
  /* les trois fausses alertes fortes du jeu 11 (0,903, 0,920, 0,904 mesurées le 27/09) : sous le possible, même avec la marque chat
     (un seul des deux mots au dictionnaire anglais) ou la signature d'une lettre tombée (sureste, suroeste) */
  assert.ok(s7h("Ferretería El Faro", "Ferretería El Foro") < 0.8);
  assert.ok(s7h("Comercial Manzana Verde", "Comercial Manzano Verde") < 0.8);
  assert.ok(s7h("SHIPPER: TRANSPORTES REFRIGERADOS DEL SURESTE SA DE CV", "Transportes Refrigerados del Suroeste, S.A. de C.V.") < 0.8);
  /* et l'accent tombé, la faute qui ne fait pas un autre mot du vocabulaire, restent des vrais noms */
  assert.ok(s7h("Comercial Manzana Verde", "Comercial Manzana Verde S.A.") >= 0.81);
  assert.ok(s7h("Ferretería El Faro", "Ferreteria El Faro") >= 0.81);
  assert.ok(s7h("Transportes Refrigerados del Sureste, S.A. de C.V.", "TRANSPORTES REFRIGERADOS DEL SURESTE SA DE CV") >= 0.81);
});

test("tour 7, hispanique : la lecture optique d'un document en capitales, l pour I, ll pour II, 5.A. pour S.A.", () => {
  assert.equal(preparerEntite("lSLA GRANDE CHARTERS LlMlTED"), preparerEntite("Isla Grande Charters Limited"));
  assert.equal(preparerEntite("MV STELLA MARlS DE COLON"), "stella maris de colon");
  assert.equal(preparerEntite("NAVlERA PUNTA CHAME 5.A."), preparerEntite("NAVIERA PUNTA CHAME S.A."));
  assert.equal(analyserEntite("NAVlERA PUNTA CHAME 5.A.").familles.join(), "corp", "le 5.A. est une forme, pas un numéro");
  assert.equal(preparerNom(f, "B/M DON RAM0N ll").numeros, "2", "ll après le nom d'un navire est le chiffre romain II");
  assert.ok(analyserEntite("lSLA GRANDE CHARTERS LlMlTED").majuscules, "rendu à ses capitales, le nom est un export en majuscules");
  /* jamais dans un nom qui porte une autre minuscule : le l y est une lettre */
  assert.equal(preparerEntite("Al Fassi Textiles"), "al fassi textiles");
  assert.equal(preparerEntite("VOGEL KUNSTSTOFFTECHNIK GmbH"), "vogel kunststofftechnik");
  assert.equal(preparerEntite("McDONALD Holdings"), "mcdonald holdings");
  assert.equal(preparerEntite("El"), "el", "une seule capitale ne dit pas que le document est en capitales : « El », « Al » gardent leur l");
  for (const [a, b] of [["Isla Grande Charters Limited", "lSLA GRANDE CHARTERS LlMlTED"], ["MV STELLA MARlS DE COLON", "M/V Stella Maris de Colón"],
    ["NAVIERA PUNTA CHAME S.A.", "NAVlERA PUNTA CHAME 5.A."], ["B/M DON RAMÓN II", "B/M DON RAM0N ll"], ["BELIZE MARINE HOLDINGS LIMlTED", "Belize Marine Holdings Limited"]]) {
    assert.ok(s7h(a!, b!) >= 0.81, `${a} / ${b} : ${s7h(a!, b!)}`);
  }
});

test("tour 7, hispanique : M/N, B/M, N/M sont M/V, R/M et Remolcador le remorqueur, Barcaza la barge ; MN sans sa barre aussi", () => {
  for (const n of ["M/N Perla Negra", "MN Perla Negra", "B/M Perla Negra", "N/M Perla Negra", "Motonave Perla Negra", "Buque Perla Negra", "Lancha Perla Negra"]) {
    const a = analyserEntite(n);
    assert.ok(a.navire && a.texte === "perla negra" && a.typeNavire === "", n);
  }
  for (const n of ["R/M Poderoso", "Remolcador Poderoso", "Rebocador Poderoso"]) assert.equal(analyserEntite(n).typeNavire, "tug", n);
  assert.equal(analyserEntite("Barcaza Manglar 3").typeNavire, "barge");
  assert.equal(preparerEntite("BM Consulting"), "bm consulting", "sans la barre, BM et RM sont des initiales");
  assert.equal(preparerEntite("RM Steel"), "rm steel");
  for (const [a, b] of [["Barcaza BRV-12", "Barge BRV 12"], ["Barcaza Manglar 3", "Barge MANGLAR 3"], ["Tug Poderoso", "R/M Poderoso"],
    ["Tug Titán del Canal", "Remolcador Titán del Canal"], ["M/N Perla Negra II", "Perla Negra No. 2"], ["B/M LUCERO AUSTRAL", "Lucero Austral"],
    ["M/N ESTRELLA DEL CARIBE", "MV Estrella del Caribe"], ["M/N SAN 8LAS TRADER", "MV San Blas Trader"], ["M/N RIO CHAGRES", "MN RÍO CHAGRES"]]) {
    assert.ok(s7h(a!, b!) >= 0.81, `${a} / ${b} : ${s7h(a!, b!)}`);
  }
  const s = s7h("Tug Poderoso", "Barge Poderoso");
  assert.ok(s < 0.81 && s >= 0.8 - 1e-9, `le remorqueur et sa barge restent deux coques, au possible : ${s}`);
  assert.ok(s7h("Remolcador Titán del Canal", "Barcaza Titán del Canal") < 0.81);
});

test("tour 7, hispanique : Corporación est Corp., l'EIRELI en toutes lettres devant le nom est l'EIRELI", () => {
  assert.equal(preparerEntite("Corporación Marítima del Pacífico Central"), preparerEntite("Corp. Marítima del Pacífico Central"));
  assert.deepEqual(analyserEntite("Corporación Favorita S.A.").designations, ["corp"]);
  assert.ok(s7h("Corporación Marítima del Pacífico Central", "Corp. Marítima del Pacífico Central") >= 0.81, "mesuré à 0,800 avant");
  assert.ok(s7h("Corporación Favorita C.A.", "Favorita Inc.") < 0.81, "Corp. face à Inc. : deux désignations");
  const e = analyserEntite("Empresa Individual de Responsabilidade Limitada Duarte Pescados");
  assert.equal(e.texte, "duarte pescados");
  assert.deepEqual([e.pays, e.familles], [["BR"], ["llc", "ltd"]]);
  assert.ok(s7h("Empresa Individual de Responsabilidade Limitada Duarte Pescados", "Duarte Pescados EIRELI") >= 0.81, "mesuré à 0,800 avant");
});

test("tour 7, hispanique : l'enseigne et son propriétaire entre parenthèses sont deux noms, pas une filiale", () => {
  assert.deepEqual(variantes("Marisquería El Puerto (Pescados Anzures, S. de R.L.)"),
    ["Marisquería El Puerto (Pescados Anzures, S. de R.L.)", "Marisquería El Puerto", "Pescados Anzures, S. de R.L."]);
  assert.ok(nommeUneSociete("Pescados Anzures, S. de R.L.") && nommeUneSociete("Okafor Integrated Resources Nig. Ltd"));
  assert.ok(!nommeUneSociete("Private Joint Stock") && !nommeUneSociete("S.A.") && !nommeUneSociete("Shanghai") && !nommeUneSociete("Singapore Branch"),
    "une forme seule, un lieu, une succursale ne nomment pas une société");
  assert.equal(variantes("Golestan Nakhl Trading Co. (Private Joint Stock)").length, 1);
  assert.equal(variantes("Quarnby Logistics (Shanghai)").length, 1, "la filiale reste une filiale");
  assert.ok(s7h("Marisquería El Puerto (Pescados Anzures, S. de R.L.)", "Pescados Anzures S. de R.L.") >= 0.81, "mesuré à 0,800 avant");
  assert.ok(s7h("Marisquería El Puerto (Pescados Anzures)", "Pescados Anzures S. de R.L.") < 0.81, "sans forme dans la parenthèse, c'est une filiale");
});

test("tour 7, hispanique : la ñ écrite ny, sous la marque hispanique, dans les deux sens", () => {
  assert.equal(pliEnye("nunyez"), "nunez");
  assert.equal(pliEnye("castanyeda"), "castaneda");
  assert.equal(pliEnye("danny"), "danny", "un ny final n'est pas une ñ");
  assert.ok(s7h("Transportes Nuñez e Hijos, S. de R.L.", "Transportes Nunyez e Hijos S de RL") >= 0.81, "mesuré à 0,800 avant");
  assert.ok(s7h("Transportes Nunyez e Hijos S de RL", "Transportes Nuñez e Hijos, S. de R.L.") >= 0.81);
  assert.ok(s7h("Alimentos Procesados Castañeda", "Alimentos Procesados Castanyeda SA de CV") >= 0.81);
  assert.ok(s7h("Danny Transportes", "Dan Transportes") < 0.81);
  assert.ok(s7h("Nunyez Holdings Ltd", "Nunez Holdings Ltd") < 0.81, "sans marque hispanique, ny reste ny");
});
