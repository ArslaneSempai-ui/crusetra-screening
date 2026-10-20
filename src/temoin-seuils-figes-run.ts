/**
 * RUNNER OF THE WITNESS src/seuils-figes.test.ts. A separate process, because the private folder is read when the engine is
 * loaded (CRUSETRA_JEUX), so "with" and "without" the folder need two processes.
 *
 * It screens the 20 public sample rows: a throwaway OFAC list holds the "a" side of each pair as an entity, the "b" side
 * is the counterparty file. It prints one JSON line: the two thresholds and, per row, the level and the first candidate;
 * or the refusal message. Optional argument: a path to another frozen-thresholds file (tampering and drift cases).
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, realpathSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { executer } from "./cribler.ts";
import { analyser, fichierDe, SOURCES, type Manifeste } from "./listes.ts";
import { echantillon } from "./jeux.ts";

const escape = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const paires = (echantillon("paires-entites") as { paires: { a: string; b: string }[] }).paires;
const xml = [
  `<?xml version="1.0" standalone="yes"?>`,
  `<sdnList xmlns="https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/XML">`,
  `  <publshInformation><Publish_Date>09/04/2026</Publish_Date><Record_Count>${paires.length}</Record_Count></publshInformation>`,
  ...paires.map((p, i) => `  <sdnEntry><uid>${900 + i}</uid><lastName>${escape(p.a)}</lastName><sdnType>Entity</sdnType><programList><program>CUBA</program></programList></sdnEntry>`),
  `</sdnList>`, ``,
].join("\n");

const dossier = realpathSync(mkdtempSync(join(tmpdir(), "seuils-figes-")));
try {
  mkdirSync(join(dossier, "data", "listes"), { recursive: true });
  const def = SOURCES.find((s) => s.source === "OFAC")!;
  writeFileSync(join(dossier, "data", "listes", fichierDe(def)), xml);
  const m: Manifeste = { version: 1, genereLe: "2026-10-12T08:00:00.000Z", listes: [{
    source: "OFAC", titre: def.titre, url: "https://ofac.example/sdn.xml", format: def.format, disponible: true,
    telechargeLe: "2026-10-12T08:00:00.000Z", sha256: createHash("sha256").update(xml).digest("hex"),
    octets: Buffer.byteLength(xml), entrees: analyser(def.format, xml, "OFAC").length,
  } as Manifeste["listes"][number]] };
  writeFileSync(join(dossier, "listes-manifest.json"), JSON.stringify(m, null, 2) + "\n");
  const csv = join(dossier, "contreparties.csv");
  writeFileSync(csv, "name\n" + paires.map((p) => `"${p.b.replace(/"/g, '""')}"`).join("\n") + "\n");
  const autre = process.argv[2];
  try {
    const { criblage } = executer(csv, "witness", new Date("2026-10-14T09:00:00Z"), undefined,
      { racine: dossier, ...(autre ? { seuilsFiges: pathToFileURL(autre) } : {}) });
    console.log(JSON.stringify({ seuils: criblage.methode.seuils,
      lignes: criblage.resultats.map((r) => ({ nom: r.nom, statut: r.statut, premier: r.candidats[0]?.nomListe ?? null })) }));
  } catch (e) {
    console.log(JSON.stringify({ refus: (e as Error).message }));
  }
} finally {
  rmSync(dossier, { recursive: true, force: true });
}
void readFileSync;
