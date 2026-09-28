/**
 * LES FAMILLES DE BINAIRES SONT LUES DANS LE VERROU : le document doit être le même octet pour octet
 * qu'il soit écrit sur le Mac (variante darwin installée) ou sur Windows (variante win32 installée, pas
 * de libvips du tout). C'est le cas qui a rougi le job Windows du 28/09/2026 (run 36400292432) alors
 * qu'Ubuntu et macOS étaient verts.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { nomDeFamille, famillesDuVerrou, laPlusStricte, inventaire, document, sbom, FICHIER_NON_LU, type Verrou } from "./licences.ts";

const VERROU: Verrou = { packages: {
  "": { version: "0.1.0", license: "PolyForm-Noncommercial-1.0.0" },
  "node_modules/guid-typescript": { version: "1.0.9", license: "ISC" },
  "node_modules/onnxruntime-node": { version: "1.24.3", license: "MIT", os: ["win32", "darwin", "linux"] },
  "node_modules/@huggingface/transformers/node_modules/@img/sharp-darwin-arm64": { version: "0.34.5", license: "Apache-2.0", os: ["darwin"], cpu: ["arm64"] },
  "node_modules/@huggingface/transformers/node_modules/@img/sharp-wasm32": { version: "0.34.5", license: "Apache-2.0 AND LGPL-3.0-or-later AND MIT", cpu: ["wasm32"] },
  "node_modules/@huggingface/transformers/node_modules/@img/sharp-win32-x64": { version: "0.34.5", license: "Apache-2.0 AND LGPL-3.0-or-later", os: ["win32"], cpu: ["x64"] },
  "node_modules/@huggingface/transformers/node_modules/@img/sharp-libvips-darwin-arm64": { version: "1.2.4", license: "LGPL-3.0-or-later", os: ["darwin"], cpu: ["arm64"] },
  "node_modules/@huggingface/transformers/node_modules/@img/sharp-libvips-linux-x64": { version: "1.2.4", license: "LGPL-3.0-or-later", os: ["linux"], cpu: ["x64"] },
} };

test("nomDeFamille : coupe au premier jeton os/cpu que le paquet déclare, et laisse entier un nom qui n'en porte pas", () => {
  assert.equal(nomDeFamille("@img/sharp-linuxmusl-x64", { os: ["linux"], cpu: ["x64"] }), "@img/sharp");
  assert.equal(nomDeFamille("@img/sharp-freebsd-wasm32", { os: ["freebsd"] }), "@img/sharp");
  assert.equal(nomDeFamille("@img/sharp-wasm32", { cpu: ["wasm32"] }), "@img/sharp", "un jeton cpu seul coupe aussi");
  assert.equal(nomDeFamille("@img/sharp-libvips-darwin-arm64", { os: ["darwin"], cpu: ["arm64"] }), "@img/sharp-libvips");
  assert.equal(nomDeFamille("onnxruntime-node", { os: ["win32", "darwin", "linux"] }), "onnxruntime-node");
  assert.equal(nomDeFamille("guid-typescript", {}), "guid-typescript");
});

test("famillesDuVerrou : une famille par nom@version, l'union triée des licences déclarées, la classe la plus stricte", () => {
  const f = famillesDuVerrou(VERROU).map((p) => [p.nom, p.version, p.declaree, p.classe, p.fichier]);
  assert.deepEqual(f, [
    ["@img/sharp", "0.34.5", "Apache-2.0 AND LGPL-3.0-or-later AND MIT", "à tenir", FICHIER_NON_LU],
    ["@img/sharp-libvips", "1.2.4", "LGPL-3.0-or-later", "à tenir", FICHIER_NON_LU],
  ], "onnxruntime-node et guid-typescript ne sont pas des familles : ils viennent de l'arbre, avec leur texte");
  assert.equal(laPlusStricte(["permissive", "bloquante", "à tenir"]), "bloquante");
  assert.equal(laPlusStricte(["permissive", "indéterminée"]), "indéterminée", "une variante non résolue se voit");
  assert.equal(laPlusStricte([]), "permissive");
});

/** Un arbre installé : les paquets ordinaires, plus les variantes de la machine. */
function arbre(variantes: Record<string, Record<string, unknown>>): string {
  const bac = mkdtempSync(join(tmpdir(), "licences-verrou-"));
  const poser = (nom: string, m: Record<string, unknown>, texte = "MIT License") => {
    const d = join(bac, "node_modules", ...nom.split("/"));
    mkdirSync(d, { recursive: true });
    const name = nom.includes("node_modules/") ? nom.slice(nom.lastIndexOf("node_modules/") + "node_modules/".length) : nom;
    writeFileSync(join(d, "package.json"), JSON.stringify({ name, ...m }));
    writeFileSync(join(d, "LICENSE"), texte);
  };
  poser("guid-typescript", { version: "1.0.9", license: "ISC" }, "ISC License");
  poser("onnxruntime-node", { version: "1.24.3", license: "MIT", os: ["win32", "darwin", "linux"] });
  for (const [nom, m] of Object.entries(variantes)) poser(`@huggingface/transformers/node_modules/${nom}`, m, "Apache License, Version 2.0");
  return bac;
}

test("le document et la nomenclature sont les mêmes octets sur le Mac et sur Windows", () => {
  const mac = arbre({
    "@img/sharp-darwin-arm64": { version: "0.34.5", license: "Apache-2.0", os: ["darwin"], cpu: ["arm64"] },
    "@img/sharp-libvips-darwin-arm64": { version: "1.2.4", license: "LGPL-3.0-or-later", os: ["darwin"], cpu: ["arm64"] },
  });
  const windows = arbre({
    "@img/sharp-win32-x64": { version: "0.34.5", license: "Apache-2.0 AND LGPL-3.0-or-later", os: ["win32"], cpu: ["x64"] },
  });
  try {
    const surMac = inventaire(join(mac, "node_modules"), VERROU);
    const surWindows = inventaire(join(windows, "node_modules"), VERROU);
    assert.deepEqual(surMac.map((p) => `${p.nom}@${p.version}`),
      ["@img/sharp@0.34.5", "@img/sharp-libvips@1.2.4", "guid-typescript@1.0.9", "onnxruntime-node@1.24.3"]);
    assert.deepEqual(surMac, surWindows, "la variante installée ne doit laisser aucune trace dans l'inventaire");
    assert.equal(document(surMac, "MIT"), document(surWindows, "MIT"));
    assert.equal(JSON.stringify(sbom(surMac, "x", "1")), JSON.stringify(sbom(surWindows, "x", "1")));
    assert.equal(surMac.find((p) => p.nom === "@img/sharp")!.declaree, "Apache-2.0 AND LGPL-3.0-or-later AND MIT",
      "la licence de la famille est celle du verrou, pas celle de la variante installée ici");
    assert.equal(surMac.find((p) => p.nom === "onnxruntime-node")!.fichier, "LICENSE", "un paquet ordinaire garde son texte lu dans l'arbre");
    /* Sans verrou : la variante installée reste inscrite sous son nom de famille, comme avant. */
    const sansVerrou = inventaire(join(windows, "node_modules"), null);
    const sharp = sansVerrou.find((p) => p.nom === "@img/sharp")!;
    assert.equal(sharp.declaree, "Apache-2.0 AND LGPL-3.0-or-later");
    assert.equal(sharp.plateforme, "le nom portait la plateforme");
    assert.ok(!sansVerrou.some((p) => p.nom === "@img/sharp-libvips"), "sans verrou, ce que la machine n'installe pas n'est pas connu");
  } finally {
    rmSync(mac, { recursive: true, force: true });
    rmSync(windows, { recursive: true, force: true });
  }
});
