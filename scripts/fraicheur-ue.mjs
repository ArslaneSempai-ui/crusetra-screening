// Local freshness check for the EU FSF file, by the rule of src/fraicheur-ue.ts: the one `listes --fetch` records in the
// manifest and a client screening applies. The file is stale when (a) the feed announces a file published more than the
// tolerance after its generation day, (b) the newest evidence that it is the latest is more than SEUIL_RETARD_UE_JOURS days
// before today, or (c) a date in it is missing, impossible or out of order. That evidence is the later of its generation day
// and the day of the last download that confirmed it against the feed. A quiet week is not stale.
//   --rss-newest=YYYY-MM-DD   the day the EU feed's newest announcement of the file was published: applies (a)
//   --confirmed-on=YYYY-MM-DD the day of the last successful download that found the feed in agreement with the file (the
//                             `confirmeLe` of the manifest row): without it, the file is judged by its generation day alone
//   --today=YYYY-MM-DD        fixes the clock (tests, replays)
// Exit 1 when stale, 0 when fresh, 2 on a bad command line. The rule itself is src/fraicheur-ue.ts; this file is its command line.
// Usage: node scripts/fraicheur-ue.mjs [path-to-eu.xml] [--rss-newest=DAY] [--confirmed-on=DAY] [--today=DAY]   (--selftest runs the witness)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { refuserDrapeauxInconnus } from "../src/cli.ts";
import { enregistrerFraicheurUe, jourDe, jugerFraicheurUe, SEUIL_RETARD_UE_JOURS } from "../src/fraicheur-ue.ts";

export { enregistrerFraicheurUe, jugerFraicheurUe, SEUIL_RETARD_UE_JOURS };

/** The verdict on a file's text, a clock, the feed's day and the last confirming download (each null when unknown), as the line this command prints. */
export function verdictDuFichier(xml, maintenant, rss, confirmeLe = null) {
  const f = { ...enregistrerFraicheurUe(xml, rss === null ? { illisible: "not given" } : { jour: rss }, jourDe(maintenant), null), confirmeLe };
  const v = jugerFraicheurUe(f, maintenant);
  return { perime: v.perime, gen: f.fichierGenereLe, max: f.fichierPublieLe, evidence: v.preuveLe, ageJours: v.ageJours, rss, confirmedOn: confirmeLe, today: jourDe(maintenant), raison: v.motifs.join("; ") };
}

const JOUR = /^\d{4}-\d{2}-\d{2}$/;
const estUnJour = (j) => JOUR.test(j) && !Number.isNaN(Date.parse(j)) && new Date(Date.parse(j)).toISOString().slice(0, 10) === j;

if (process.argv[1]?.endsWith("fraicheur-ue.mjs")) {
  if (process.argv.includes("--selftest")) {
    const midi = new Date("2026-10-14T09:00:00Z");
    const fichier = (gen, pub) => `<x generationDate="${gen}T10:00:00"><a publicationDate="${pub}"/></x>`;
    const ok =
      verdictDuFichier(fichier("2026-10-12", "2026-07-23"), midi, null).perime === false           // a quiet quarter is not stale
      && verdictDuFichier(fichier("2026-10-02", "2026-07-23"), midi, null).perime === true         // generated twelve days ago
      && verdictDuFichier(fichier("2026-10-08", "2026-07-23"), midi, "2026-10-12").perime === true // the feed announces a newer file
      && verdictDuFichier(fichier("2026-10-02", "2026-07-23"), midi, "2026-10-02", "2026-10-13").perime === false // old file, confirmed yesterday
      && verdictDuFichier(fichier("2026-10-02", "2026-07-23"), midi, "2026-10-02", "2026-10-05").perime === true  // old file, confirmed nine days ago
      && verdictDuFichier("<x/>", midi, null).perime === true;                                     // no dates: never fresh
    console.log(ok ? "witness ok" : "witness FAILED");
    process.exit(ok ? 0 : 1);
  }
  refuserDrapeauxInconnus(["--selftest", "--rss-newest", "--confirmed-on", "--today"]);
  /* `--rss-newest=2026-10-12` and `--rss-newest 2026-10-12` both work: a value-taking flag that took no value would be an
     option typed and silently ignored. The first argument that is not a flag (or a flag's value) is the file. */
  const args = process.argv.slice(2);
  const valeurs = {};
  const fichiers = [];
  for (let i = 0; i < args.length; i++) {
    const m = /^--(rss-newest|confirmed-on|today)(?:=(.*))?$/.exec(args[i]);
    if (m) valeurs[m[1]] = m[2] ?? args[++i] ?? "";
    else if (!args[i].startsWith("--")) fichiers.push(args[i]);
  }
  const rss = valeurs["rss-newest"] ?? null;
  const confirme = valeurs["confirmed-on"] ?? null;
  const aujourdhui = valeurs["today"];
  for (const [nom, valeur] of [["rss-newest", rss], ["confirmed-on", confirme], ["today", aujourdhui]]) {
    if (valeur != null && !estUnJour(valeur)) {
      console.error(`--${nom} wants a day written YYYY-MM-DD that exists, not "${valeur.slice(0, 40)}". Nothing was checked.`);
      process.exit(2);
    }
  }
  const chemin = fichiers[0] ?? fileURLToPath(new URL("../data/listes/eu.xml", import.meta.url));
  const r = verdictDuFichier(readFileSync(chemin, "utf8"), aujourdhui ? new Date(`${aujourdhui}T12:00:00Z`) : new Date(), rss, confirme);
  console.log(JSON.stringify(r));
  process.exit(r.perime ? 1 : 0);
}
