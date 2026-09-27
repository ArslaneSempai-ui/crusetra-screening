import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  preparerEntite, analyserEntite, preparerNom, scorePrepares, scoreBrut, scoreNoms, variantes, squelette, voyelles, abrege,
  motsDistincts, lemme, variationVocalique,
  tronque, estCoupe, apport, simMinimale, choisirSeuils, marquesEnConflit, frequencesDe, mesurerJeux,
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
