// Local freshness check for the EU FSF file: compares the newest publicationDate of any entry with the
// generationDate. Exit 1 when the feed lags by more than SEUIL_RETARD_UE_JOURS days, or when a date is missing or
// unreadable. The rule itself is src/fraicheur-ue.ts, the one `listes --fetch` also uses; this file is its command line.
// Usage: node scripts/fraicheur-ue.mjs [path-to-eu.xml]   (--selftest runs the witness)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { fraicheurUE, SEUIL_RETARD_UE_JOURS } from "../src/fraicheur-ue.ts";

export { fraicheurUE, SEUIL_RETARD_UE_JOURS };

if (process.argv[1]?.endsWith("fraicheur-ue.mjs")) {
  if (process.argv.includes("--selftest")) {
    const vieux = '<x generationDate="2026-10-12T10:00:00"><a publicationDate="2026-07-23"/></x>';
    const frais = '<x generationDate="2026-10-12T10:00:00"><a publicationDate="2026-10-10"/></x>';
    const ok = fraicheurUE(vieux).perime === true && fraicheurUE(frais).perime === false && fraicheurUE("<x/>").perime === true;
    console.log(ok ? "witness ok" : "witness FAILED");
    process.exit(ok ? 0 : 1);
  }
  const p = process.argv[2] ?? fileURLToPath(new URL("../data/listes/eu.xml", import.meta.url));
  const r = fraicheurUE(readFileSync(p, "utf8"));
  console.log(JSON.stringify(r));
  process.exit(r.perime ? 1 : 0);
}
