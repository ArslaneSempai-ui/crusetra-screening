/**
 * LE PALIER FACULTATIF « logic-v2 » : le matcher de criblage de nomenklatura (OpenSanctions, licence MIT), appelé tel que le
 * client l'a installé, pour qu'une équipe qui fait tourner yente choisisse son seuil sur SON historique d'alertes à côté des
 * paliers de cet outil.
 *
 * Il n'est jamais installé, téléchargé ni cherché par cet outil : le client nomme son interpréteur Python par
 * CASCADE_LOGIC_V2_PYTHON (celui d'un environnement où `pip install nomenklatura` a été fait). Sans cette variable, ou si
 * nomenklatura ne s'importe pas, le palier est ABSENT et nommé comme tel avec sa raison, comme `embed` sans ses poids.
 *
 * Le pont (scripts/logic_v2.py) reçoit les paires sur son entrée standard et rend un score par paire : un seul processus pour
 * tout le fichier, lancé de façon synchrone AVANT la mesure (`preparerPaires`), parce qu'un matcher note de façon synchrone
 * (matcher.ts). Rien ne sort de la machine : le pont n'ouvre aucune connexion.
 *
 * LA LIMITE, qu'un rapport qui porte ce palier répète : seuls les deux NOMS entrent. C'est la comparaison de noms de logic-v2,
 * pas un criblage yente avec dates de naissance, pays et identifiants. Et un score dépend de la version de nomenklatura :
 * elle est écrite dans le relevé, et deux relevés ne se comparent qu'à version égale.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { Matcher, PalierId } from "../matcher.ts";

export const PONT = fileURLToPath(new URL("../../scripts/logic_v2.py", import.meta.url));
/** Le seuil pour lequel la documentation d'OpenSanctions dit logic-v2 calibré. */
export const SEUIL_DOCUMENTE = 0.7;
export const SCHEMAS = ["LegalEntity", "Person", "Company", "Organization", "Vessel"] as const;
export type Schema = (typeof SCHEMAS)[number];

export type LogicV2 =
  | { present: true; matcher: Matcher; /** lue du pont à la première préparation */ version: () => string | null; schema: Schema }
  | { present: false; raison: string };

const cle = (a: string, b: string) => `${a}\u0000${b}`;

/** Lancer le pont sur des paires : la version annoncée et un score par paire, ou la raison de l'échec. */
export function lancerLePont(python: string, schema: Schema, paires: readonly { a: string; b: string }[], pont: string = PONT):
  { version: string; scores: number[] } | { raison: string } {
  const r = spawnSync(python, [pont, schema], { input: paires.map((p) => JSON.stringify(p)).join("\n") + "\n", encoding: "utf8", maxBuffer: 1 << 30 });
  if (r.error) return { raison: `the Python named by CASCADE_LOGIC_V2_PYTHON could not be started (${(r.error as NodeJS.ErrnoException).code ?? r.error.message})` };
  if (r.status !== 0) return { raison: (r.stderr.trim().split("\n").at(-1) ?? "").slice(0, 300) || `the bridge exited with code ${r.status}` };
  const lignes = r.stdout.split("\n").filter((l) => l.length > 0);
  let version: string;
  try { version = String((JSON.parse(lignes[0] ?? "") as { nomenklatura?: unknown }).nomenklatura ?? ""); } catch { return { raison: "the bridge did not announce its nomenklatura version" }; }
  const scores = lignes.slice(1).map(Number);
  if (!version || scores.length !== paires.length || scores.some((s) => !Number.isFinite(s))) {
    return { raison: `the bridge returned ${scores.length} score(s) for ${paires.length} pair(s)` };
  }
  return { version, scores };
}

/**
 * Le palier, s'il est là. `python` : l'interpréteur nommé par le client (undefined : absent, dit). Une paire vide suffit à
 * savoir si nomenklatura s'importe ; la version lue alors est celle du relevé.
 */
export function logicV2(python: string | undefined, schema: Schema = "LegalEntity", pont: string = PONT): LogicV2 {
  if (!python) return { present: false, raison: "CASCADE_LOGIC_V2_PYTHON is not set: name the Python of an environment where nomenklatura is installed" };
  const essai = lancerLePont(python, schema, [], pont);
  if ("raison" in essai) return { present: false, raison: essai.raison };
  let version: string | null = essai.version;
  const cache = new Map<string, number>();
  const matcher: Matcher = {
    id: "logic-v2" as PalierId,
    description: `nomenklatura's logic-v2 name matching (version ${essai.version}, schema ${schema}), as installed on this machine: the two names only, no date of birth, country or identifier; its documented threshold is ${SEUIL_DOCUMENTE.toFixed(2)}`,
    rang: 8,
    preparerPaires(paires) {
      const neuves = paires.filter((p) => !cache.has(cle(p.a, p.b)));
      if (neuves.length === 0) return;
      const r = lancerLePont(python, schema, neuves, pont);
      if ("raison" in r) throw new Error(`logic-v2: ${r.raison}`);
      version = r.version;
      neuves.forEach((p, i) => cache.set(cle(p.a, p.b), r.scores[i]!));
    },
    score(a, b) {
      const s = cache.get(cle(a, b));
      if (s === undefined) throw new Error("logic-v2 scores pairs in one batch: call preparerPaires with every pair before score.");
      return s;
    },
  };
  return { present: true, matcher, version: () => version, schema };
}
