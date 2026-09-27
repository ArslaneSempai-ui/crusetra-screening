/**
 * Tour 8, voie navires-nordique : les fausses alertes fortes du jeu 12 (navires à une lettre près, pluriels turcs,
 * patronymes nordiques, composés à queues différentes, ligne SWIFT coupée dans un mot) et les noms nordiques ratés
 * (bilingue finnois-suédois, génitif finnois). Chaque règle gardée a ici la paire qui l'a motivée.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreNoms, tronque, consonneSubstituee, squelette, lettreAjoutee, simMot, FREQUENCES_UNIFORMES, preparerEntite, analyserEntite } from "./entites.ts";
import { plurielTurc } from "./mots.ts";
import { patronymesDistincts, traductionNordique } from "./nordique.ts";
import { queueGenerique, lettreTombee, composesAQueuesDistinctes } from "./score.ts";

const f = FREQUENCES_UNIFORMES;
const score = (a: string, b: string) => scoreNoms(f, a, b);
const FORT = 0.81;

test("tour 8, navires : une lettre épargnée n'est pas une coupe, « Amber » n'est pas « Amberg » commencé", () => {
  assert.equal(tronque("amber", "amberg"), false);
  assert.equal(tronque("store", "stored"), false);
  assert.equal(tronque("engineer", "engineering"), true, "trois lettres de plus : le champ a coupé");
  assert.equal(tronque("distri", "distributors"), true);
  assert.equal(lettreAjoutee("amber", "amberg"), true);
  assert.equal(lettreAjoutee("store", "stored"), false, "deux mots anglais");
  assert.equal(lettreAjoutee("egret", "egrets"), false, "le pluriel a sa règle");
  assert.ok(score("NORD AMBER", "NORD AMBERG") < FORT, `NORD AMBER / NORD AMBERG : ${score("NORD AMBER", "NORD AMBERG")}`);
});

test("tour 8, navires : une consonne d'une autre classe au squelette n'est pas une romanisation (Yushkevich, Yurkevich)", () => {
  assert.equal(consonneSubstituee(squelette("yushkevich"), squelette("yurkevich")), true);
  assert.equal(consonneSubstituee(squelette("kharitonov"), squelette("haritonov")), false, "kh et h : le même squelette");
  assert.equal(consonneSubstituee(squelette("rasmussen"), squelette("rasmusson")), false, "une voyelle : reste au squelette");
  assert.equal(consonneSubstituee(squelette("tarnhelm"), squelette("tarnhem")), false, "une lettre de moins : reste au squelette");
  assert.ok(score("KAPITAN YUSHKEVICH", "KAPITAN YURKEVICH") < FORT, `${score("KAPITAN YUSHKEVICH", "KAPITAN YURKEVICH")}`);
  assert.ok(score("KAPITAN YUSHKEVICH", "KAPITAN IUSHKEVICH") >= FORT, "la même coque sous deux romanisations");
  assert.ok(score("MEKHANIK KHARITONOV", "MEHANIK HARITONOV") >= FORT);
  /* à longueur écrite égale, la substitution reste au squelette : les plis qu'il ne connaît pas encore (mesuré le 27/09) */
  const sim = (a: string, b: string) => simMot(a, b, squelette(a), squelette(b));
  assert.ok(sim("verkhnyaya", "werchnjaja") > 0.8, "le ch allemand pour kh");
  assert.ok(sim("phuetphon", "phuedphol") > 0.8, "la finale thaïe l ou n");
  assert.ok(sim("pacific", "pasifik") > 0.8, "l'orthographe indonésienne");
  assert.ok(sim("yushkevich", "yurkevich") <= 0.8, "sh contre r : l'écrit seul en juge");
});

test("tour 8, navires : le pluriel turc -lar, -ler est un autre navire, sans crédit de début de mot", () => {
  assert.equal(plurielTurc("kaptanlar", "kaptan"), true);
  assert.equal(plurielTurc("martilar", "marti"), true);
  assert.equal(plurielTurc("handler", "hand"), false, "deux mots anglais");
  assert.equal(plurielTurc("kaptanlar", "kap"), false, "un radical de trois lettres ne dit rien");
  assert.ok(score("YILDIZ KAPTAN", "YILDIZ KAPTANLAR") < FORT, `${score("YILDIZ KAPTAN", "YILDIZ KAPTANLAR")}`);
  assert.ok(score("VESSEL: MV KARA MARTI / IMO N/A", "KARA MARTILAR") < FORT, `${score("VESSEL: MV KARA MARTI / IMO N/A", "KARA MARTILAR")}`);
});

test("tour 8, navires : la marque navire ferme le crédit de la syllabe qui en commence une autre, pas la coupe AIS", () => {
  assert.ok(score("Tug Miss Delphine Arceneaux", "MISS DELPHINE ARCENE") >= FORT, "le dernier mot coupé à vingt reste lu");
  assert.ok(score("Meridian Kestrel Express", "MERIDIAN KESTREL EXP") >= FORT);
});

test("tour 8, nordique : deux patronymes en -sen, -son, -sson différents sont deux familles sous la marque nordique", () => {
  assert.equal(patronymesDistincts("rasmussen", "rasmusson"), true);
  assert.equal(patronymesDistincts("pedersen", "petersen"), true);
  assert.equal(patronymesDistincts("pedersen", "pedersen"), false);
  assert.equal(patronymesDistincts("nielsen", "nilsson"), true);
  assert.equal(patronymesDistincts("hansen", "hanse"), false, "un seul patronyme ne dit rien");
  for (const [a, b] of [
    ["Rasmussen Kornsilo ApS", "Rasmusson Kornsilo ApS"],
    ["Kristiansen Bunkring ApS", "Kristiansson Bunkring ApS"],
    ["Pedersen Havnetjenester A/S", "Petersen Havnetjenester A/S"],
    ["Karlsen Bunkring AS", "Karlsson Bunkring AS"],
  ]) assert.ok(score(a, b) < FORT, `${a} / ${b} : ${score(a, b)}`);
  assert.ok(score("THOMPSON CHEMICAL LLC", "Thomason Chemical LLC") >= 0.5, "sans marque nordique, la règle ne s'ouvre pas");
});

test("tour 8, nordique : un mot qui en commence un autre est un membre de composé, crédité seulement devant un générique", () => {
  assert.equal(queueGenerique("spannmalsexport", "spannmal"), true);
  assert.equal(queueGenerique("kornhandel", "korn"), true);
  assert.equal(queueGenerique("brondbyvester", "brondby"), false);
  assert.ok(score("Brøndby Kornhandel ApS", "Brøndbyvester Kornhandel ApS") < FORT, `${score("Brøndby Kornhandel ApS", "Brøndbyvester Kornhandel ApS")}`);
  assert.ok(score("Göteborgs Spannmålsexport AB", "Goteborgs Spannmals Export AB") >= FORT, "le composé écrit coupé reste le même nom");
  assert.ok(score("Kornlagerhuset i Norden AB", "Kornlager Huset i Norden AB") >= FORT);
});

test("tour 8, nordique : une lettre de moins est un autre lieu, le plafond du mot court tient (Nordvik, Norvik)", () => {
  const s = score("Nordvik Lastebil AS", "Norvik Lastebil AS");
  assert.ok(s < FORT && s >= 0.5, `${s}`);
  assert.ok(score("M/V Tarnhelm Star", "M/V Tarnhem Star") >= FORT, "hors de la marque nordique, la lettre tombée reste une faute");
  assert.equal(lettreTombee("nordvik", "norvik"), true);
  assert.equal(lettreTombee("nordhavn", "nordhvan"), false, "deux lettres inversées");
  assert.equal(lettreTombee("ashwara", "ashwarra"), false, "une lettre doublée");
  assert.ok(score("Nordhavn Kystfart AS", "Nordhvan Kystfart AS") >= FORT, "sous la marque nordique, l'inversion reste une faute");
});

test("tour 8, composés : la même tête et deux queues génériques ou anglaises différentes sont deux composés", () => {
  assert.equal(composesAQueuesDistinctes("spannmalsexport", "spannmalsimport"), true);
  assert.equal(composesAQueuesDistinctes("timberline", "timberland"), true);
  assert.equal(composesAQueuesDistinctes("harborview", "harborside"), true);
  assert.equal(composesAQueuesDistinctes("silverline", "silverlien"), false, "le geste d'une faute entre les deux queues");
  assert.equal(composesAQueuesDistinctes("refrigeration", "refrigiration"), false, "des queues qui ne sont pas des mots");
  assert.equal(composesAQueuesDistinctes("spannmalsexport", "spannmalsexport"), false);
  assert.ok(score("Göteborgs Spannmålsexport AB", "Göteborgs Spannmålsimport AB") < FORT, `${score("Göteborgs Spannmålsexport AB", "Göteborgs Spannmålsimport AB")}`);
  assert.ok(score("MESSRS. BALTIC TIMBERLINE OU", "Baltic Timberland OÜ") < FORT, `${score("MESSRS. BALTIC TIMBERLINE OU", "Baltic Timberland OÜ")}`);
});

test("tour 8, bloc : une recoupure déplace des espaces, pas des lettres (Gemi Kiral Ama, Gemi Kurtarma)", () => {
  assert.ok(score("LIMANTEPE GEMI KIRAL AMA VE TICARET A.S.", "Limantepe Gemi Kurtarma ve Ticaret A.Ş.") < FORT,
    `${score("LIMANTEPE GEMI KIRAL AMA VE TICARET A.S.", "Limantepe Gemi Kurtarma ve Ticaret A.Ş.")}`);
  assert.ok(score("Petro Link Trading Ltd", "Petrolink Trading Ltd") >= FORT, "la soudure reste lue");
  assert.ok(score("Göteborgs Spannmålsexport AB", "Goteborgs Spannmals Export AB") >= FORT, "la coupure aussi");
});

test("tour 8, finnois-suédois : les deux raisons sociales d'une société finlandaise se traduisent, composés compris", () => {
  assert.equal(traductionNordique("satamapalvelu"), "port services");
  assert.equal(traductionNordique("hamntjanst"), "port services");
  assert.equal(traductionNordique("viljasatama"), "grain port");
  assert.equal(traductionNordique("spannmalsexport"), "grain export", "le s de liaison suédois");
  assert.equal(traductionNordique("spannmals"), "grain", "le composé écrit coupé garde son s");
  assert.equal(traductionNordique("export"), undefined, "une queue anglaise seule n'est pas un mot nordique");
  assert.equal(traductionNordique("kornhandel"), undefined, "korn n'est pas dans la table : le composé reste entier");
  assert.equal(preparerEntite("Satamapalvelu Kotka Oy"), preparerEntite("Hamntjänst Kotka Ab"));
  assert.ok(score("Satamapalvelu Kotka Oy", "Hamntjänst Kotka Ab") >= FORT, "les deux raisons sociales : Oy et Ab nomment la même société");
  assert.ok(score("Hallström Precision AB", "Hallström Precision Oy") <= 0.8, "sans générique traduit, AB et Oy restent deux pays");
  assert.ok(score("Sundqvist Pulp & Paper AB", "Sundqvist Pulp & Paper Oy") <= 0.8);
});

test("tour 8, finnois : le génitif d'un port ou d'une ville revient au nominatif sous un nom finnois", () => {
  assert.equal(preparerEntite("Porin Viljasatama Oy"), preparerEntite("Pori Viljasatama Oy"));
  assert.equal(preparerEntite("Turun Satama Oy"), preparerEntite("Turku Satama Oy"));
  assert.equal(preparerEntite("Helsingin Kuljetus"), preparerEntite("Helsinki Kuljetus"), "le générique finnois marque le nom sans forme");
  assert.notEqual(preparerEntite("Porin Trading Ltd"), preparerEntite("Pori Trading Ltd"), "sans marque finnoise, Porin reste Porin");
  assert.ok(score("Porin Viljasatama Oy", "Pori Viljasatama Oy") >= FORT);
});

test("tour 8, formes : OÜ (écrit OU en queue), UAB et SIA portent leur pays", () => {
  assert.deepEqual(analyserEntite("Baltic Timberland OÜ").pays, ["EE"]);
  assert.deepEqual(analyserEntite("MESSRS. BALTIC TIMBERLINE OU").pays, ["EE"]);
  assert.equal(preparerEntite("Baltic Timberland OÜ"), "baltic timberland");
  assert.equal(preparerEntite("Ou Yang Trading"), "ou yang trading", "en tête, Ou est un nom");
  assert.deepEqual(analyserEntite("Vilniaus Grūdai UAB").pays, ["LT"]);
  assert.deepEqual(analyserEntite("UAB Vilniaus Grudai").pays, ["LT"]);
  assert.ok(analyserEntite("Rīgas Graudi SIA").pays.includes("LV"));
});
