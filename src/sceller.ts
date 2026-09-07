/* PARTAGÉ DANS LA FAMILLE CASCADE — source : cascade-screening
   Les dépôts de la famille (cascade, -screening, -monitoring, -scoring, -dossier) en portent
   une copie identique AU BYTE. Corrigez-le dans la source, puis recopiez : la famille est
   EXCLUE de la diffusion d'identite (depots.json), aucune diffusion ne viendra le faire à
   votre place. `couche-famille.test.ts` compare les octets, nomme la direction du retard, et
   refuse aussi un fichier identique dans deux dépôts qui ne porte PAS cet en-tête — c'est
   ainsi qu'une copie neuve se déclare au lieu de dériver en silence. Si une divergence
   devient VOULUE dans un dépôt, retirez-y cet en-tête : la copie quitte le groupe. */
/**
 * Poser le scellé sur un relevé de mesures.
 *
 *   npm run sceller -- <fichier.json>
 *
 * CE QUE POSER UN SCELLÉ VEUT DIRE, ET IL FAUT QUE CE SOIT DÉSAGRÉABLE À LIRE : vous
 * déclarez que le contenu actuel du fichier est celui qui doit faire foi. L'empreinte
 * prouvera qu'il n'a pas bougé APRÈS. Elle ne dit rien de ce qui s'est passé avant, et elle
 * ne transforme pas un chiffre tapé à la main en mesure. Le seul geste qui produit une
 * mesure est `npm run measure` (ou `measure:yours` sur vos propres alertes).
 *
 * Même mécanique que cascade-routing : les relevés des deux outils se vérifient de la même
 * façon, et un lecteur qui a appris l'un a appris l'autre.
 */
import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { isMain, refuserDrapeauxInconnus } from "./cli.ts";
import { empreinteDuReleve } from "./empreinte.ts";

if (isMain(import.meta)) {
  refuserDrapeauxInconnus([]);
  const cible = process.argv[2];
  if (cible === undefined) {
    console.error("  usage: npm run sceller -- <record.json>\n  There is no default record here: name the file you are sealing.");
    process.exit(2);
  }
  if (!existsSync(cible)) {
    console.error(`  ${cible} does not exist. There is nothing to seal.`);
    process.exit(2);
  }
  /* Exister n'est pas être lisible : un dossier passe la garde d'existence, puis
     readFileSync lève EISDIR et le lecteur reçoit une pile. */
  if (!statSync(cible).isFile()) {
    console.error(`  ${cible} is a directory, not a file. Point this at the record itself.`);
    process.exit(2);
  }

  const brut = JSON.parse(readFileSync(cible, "utf8")) as Record<string, unknown>;
  const avant = typeof brut.empreinte === "string" ? brut.empreinte : null;
  const apres = empreinteDuReleve(brut);

  if (avant === apres) {
    console.log(`  ${cible}\n  already sealed, and the seal matches: ${apres}. Nothing to do.`);
    process.exit(0);
  }

  brut.empreinte = apres;
  writeFileSync(cible, JSON.stringify(brut, null, 2));
  console.log(`  ${cible}`);
  console.log(avant
    ? `  seal REPLACED: ${avant} → ${apres}\n  The content had changed since the last seal. You have just declared that the\n  current content is the one that stands.`
    : `  seal placed: ${apres}\n  This file carried none. The content hash now proves it does not move any more;\n  it says nothing about what it held before today.`);
}
