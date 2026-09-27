import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  preparerEntite, analyserEntite, preparerNom, scorePrepares, scoreBrut, scoreNoms, variantes, squelette, voyelles, abrege,
  motsDistincts, lemme, variationVocalique,
  tronque, estCoupe, apport, simMinimale, choisirSeuils, marquesEnConflit, frequencesDe, mesurerJeux, qualificatifSoude,
  poidsDuMot, CHEMINS_APPRENTISSAGE, FREQUENCES_UNIFORMES, FAUSSES_ALERTES_MAX_FORT, SEUIL_POSSIBLE,
} from "./entites.ts";
import { validerPaires, type TableDUnPalier } from "./measure.ts";

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
