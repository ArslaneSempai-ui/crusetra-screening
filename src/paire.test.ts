/**
 * LE DIAGNOSTIC D'UNE PAIRE : la commande sur deux paires (la ligne du score, une ligne de marque, le
 * conflit), ses refus, et la boucle des lectures refaite dans paire.ts qui doit rendre le score de
 * `scoreNoms` : sinon le diagnostic expliquerait un autre score que celui de la mesure.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { frequencesDesListes } from "./frequences.ts";
import { scoreNoms, preparerNom, FREQUENCES_UNIFORMES } from "./entites.ts";
import { diagnostic, meilleureLecture, lignesDesMarques, rejouerLimites } from "./paire.ts";

const SCRIPT = fileURLToPath(new URL("./paire.ts", import.meta.url));
const lancer = (...args: string[]) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });
const f = frequencesDesListes();

test("paire : la commande imprime le score de scoreNoms, puis une ligne par marque de chaque côté", () => {
  const a = "Zia Corporation (Pvt) Ltd", b = "Zia Trading Corporation (Pvt) Ltd";
  const r = lancer(a, b);
  assert.equal(r.status, 0, r.stderr);
  const lignes = r.stdout.trimEnd().split("\n");
  assert.equal(lignes[0], `pair: ${a}  /  ${b}`);
  assert.equal(lignes[1], `score: ${scoreNoms(f, a, b).toFixed(3)}`);
  assert.equal(lignes.filter((l) => l === "  mark: prive").length, 2, "the Pvt mark, once per side");
  assert.ok(lignes.some((l) => /^  word: zia  weight \d+\.\d{3}  skeleton \S+$/.test(l)), "the prepared word with its weight and skeleton");
  assert.ok(lignes.includes("marks conflict (marquesEnConflit): no"));
  assert.ok(lignes.length < 80, `${lignes.length} lines for an ordinary pair`);
  assert.ok(!/\u001b\[/.test(r.stdout), "no colour code");
});

test("paire : un navire face à une société, le signe de navire d'un côté et le conflit de marques", () => {
  const a = "MV Boa Esperança", b = "Boa Esperança Shipping Ltd";
  const r = lancer(a, b);
  assert.equal(r.status, 0, r.stderr);
  const lignes = r.stdout.trimEnd().split("\n");
  assert.equal(lignes[1], `score: ${scoreNoms(f, a, b).toFixed(3)}`);
  assert.ok(lignes.includes("  mark: navire"), "the vessel mark of side a");
  assert.ok(lignes.includes("  mark: societe"), "the company mark of side b");
  assert.ok(lignes.includes("marks conflict (marquesEnConflit): yes"));
});

test("paire : la paire de lectures gagnante rend le score de scoreNoms, lectures multiples et plafond compris", () => {
  const paires: [string, string][] = [
    ["Zia Corporation (Pvt) Ltd", "Zia Trading Corporation (Pvt) Ltd"],
    ["Akçakoca Güneşi (ex-Azov Lantern)", "Azov Lanterns"],
    ["Silver Dune Logistics FZCO", "سيلفر ديون للخدمات اللوجستية ش.م.ح"],
    ["Wing Shing Trading (Shenzhen) Co., Ltd.", "Yongcheng Trading (Shenzhen) Co Ltd 永成"],
    ["Alpha Star (ex-Delta Wave)", "Beta Sun (ex-Delta Wave)"],
    ["Hong Da 1", "Hong Da 8"],
  ];
  for (const [a, b] of paires) {
    const m = meilleureLecture(f, a, b);
    assert.equal(m.score, scoreNoms(f, a, b), `${a} / ${b}`);
    assert.equal(m.score, Math.min(m.plafond, m.brut), `${a} / ${b}: the cap is applied to the raw score`);
  }
  /* un ancien nom des deux côtés : le plafond, et sa raison nommée */
  const d = diagnostic(f, "Alpha Star (ex-Delta Wave)", "Beta Sun (ex-Delta Wave)");
  assert.ok(d.includes("cap (plafondDesLectures): 0.800"), d.join("\n"));
  assert.ok(d.includes("cap reason: a former name on both sides"), d.join("\n"));
});

test("paire : les marques, une ligne par marque vraie ou non vide, rien pour les autres", () => {
  const lignes = lignesDesMarques(preparerNom(f, "MV Boa Esperança").marques);
  assert.ok(lignes.includes("mark: navire"));
  assert.ok(lignes.includes("mark: lecture = mandarin"));
  assert.ok(!lignes.some((l) => l.startsWith("mark: societe")), "a false mark prints nothing");
  assert.ok(!lignes.some((l) => l.startsWith("mark: pays")), "an empty list prints nothing");
  assert.ok(!lignes.some((l) => l.startsWith("mark: succursale")), "an empty string prints nothing");
});

test("paire : sans nom, avec un seul nom, un nom vide ou un drapeau inconnu, refus en 2 et rien d'imprimé", () => {
  for (const args of [[], ["a"], ["a", ""], ["--nimportequoi", "a", "b"], ["a", "b", "--corriger"], ["--limites", "a"]]) {
    const r = lancer(...args);
    assert.equal(r.status, 2, `${JSON.stringify(args)}: ${r.stderr}`);
    assert.equal(r.stdout, "", JSON.stringify(args));
  }
});

test("paire : --limites rejoue la table, nomme les scores qui ont bougé et ne réécrit que la colonne du score", () => {
  const a = "Zia Corporation (Pvt) Ltd", b = "Zia Trading Corporation (Pvt) Ltd";
  const actuel = scoreNoms(FREQUENCES_UNIFORMES, a, b).toFixed(3);
  const courant = scoreNoms(FREQUENCES_UNIFORMES, "Coral Horizon", "Coral Horizan").toFixed(3);
  const registre = [
    "# Limites", "", "Une phrase : la prose n'est pas touchée.", "",
    "| a | b | set | score | reason |", "|---|---|---|---|---|",
    `| ${a} | ${b} | 15 | 0.123 | le poids des génériques |`,
    `| Coral Horizon | Coral Horizan | 13 | ${courant} | sans signe de navire |`, "",
  ].join("\n");
  const { bougees, texte } = rejouerLimites(FREQUENCES_UNIFORMES, registre);
  assert.deepEqual(bougees, [`set 15  0.123 -> ${actuel}  ${a}  /  ${b}`]);
  const lignes = texte.split("\n");
  assert.equal(lignes.length, registre.split("\n").length);
  assert.equal(lignes[6], `| ${a} | ${b} | 15 | ${actuel} | le poids des génériques |`);
  assert.equal(lignes[7], `| Coral Horizon | Coral Horizan | 13 | ${courant} | sans signe de navire |`, "a current line is left as it is");
  assert.equal(lignes[2], "Une phrase : la prose n'est pas touchée.");
  assert.deepEqual(rejouerLimites(FREQUENCES_UNIFORMES, texte).bougees, [], "once rewritten, nothing moves");
});
