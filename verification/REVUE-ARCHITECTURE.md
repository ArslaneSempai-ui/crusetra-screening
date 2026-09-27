# Revue d'architecture du matcher d'entités

Une session à part, à effort élevé, lit et juge. Elle ne modifie aucun fichier de `src/`, ne lance aucune
mesure sur un jeu aveugle, ne pousse rien. Elle écrit sa revue à la fin de ce fichier, sous « Revue »,
et la commet seule : `git add verification/REVUE-ARCHITECTURE.md && git commit -m "Architecture review"`.

## Ce qu'elle lit, dans cet ordre

1. `src/entites.ts` (la façade), puis `src/preparation.ts`, `src/mots.ts`, `src/score.ts`,
   `src/variantes.ts`, `src/ecritures.ts`, `src/cribler.ts` : le matcher découpé le 28/09/2026.
2. `verification/VERDICTS.md` : le registre des verdicts aveugles, un par méthode, avec ses notes.
3. `src/entites.test.ts` et `src/cribler.test.ts` : chaque règle y a son test, souvent avec la paire qui l'a motivée.
4. `npm run mesure-entites` (une minute) : dix jeux d'apprentissage, 1 570 paires vraies et 1 570 pièges ;
   `npm run temoin-index -- --exhaustif` (quatre minutes) : l'index contre la comparaison exhaustive.

## Ce qu'on sait déjà, pour ne pas le redécouvrir

- Deux niveaux : FORT (0,81, choisi comme le plus bas seuil au-dessus de 0,80 tenant sous 5 % de fausses
  alertes sur l'apprentissage) et POSSIBLE (0,80, exactement là où les plafonds rangent une paire douteuse).
- Sur l'apprentissage, v12 trouve 1 454 vrais noms sur 1 570 au fort avec 20 fausses alertes. Sur les jeux
  aveugles, le fort a donné 3 % de fausses alertes (jeu 10, conventions explicites) et 19,5 % (jeu 9, sans
  conventions : chaînes identiques jugées différentes, agences contre sièges, ex-noms de navires partagés).
- Les limites déclarées par les voies : les lectures hokkien et teochew n'ont aucune source publique ; les
  conventions de translittération (Cherkaoui, Cherkawi) que le crédit de romanisation assimile à dessein ;
  la correction automatique entre deux mots du dictionnaire (Wholesale, Wholesome) ; le nom d'usage qui est
  la moitié du nom déposé (possible par construction) ; les chaînes identiques d'entités distinctes.
- La mesure ne bouge jamais sans preuve : chaque règle a été gardée ou rejetée sur les dix jeux, et le
  registre garde les tentatives abandonnées avec leur coût.

## Les trois questions à trancher, et ce qu'on attend

1. **Ce que promet le niveau fort quand la population change.** Le seuil et sa promesse (5 %) viennent de
   l'apprentissage ; un jeu aveugle d'une autre population l'a contredit. Faut-il un seuil par population,
   une promesse exprimée comme un intervalle sur le dernier jeu aveugle (ce que le rapport imprime déjà),
   ou une définition du fort qui ne dépende pas d'un taux ? Réponse attendue : une recommandation, avec
   ce qu'elle change dans `choisirSeuils`, dans le rapport signé et dans ce qu'un acheteur lit.
2. **La raison lisible du niveau possible.** Un candidat rangé au possible l'est par un plafond précis
   (mot rare orphelin, forme en conflit, filiale entre parenthèses, succursale, ex-nom des deux côtés…).
   L'analyste ne le voit pas. Faut-il porter la raison jusqu'au rapport, et sous quelle forme (un mot,
   une phrase, un code) ? Réponse attendue : oui ou non, et le point du code où la raison naît.
3. **Le découpage.** Cinq modules, `entites.ts` réexportant tout, un cycle de chargement déjà rencontré
   (une constante construite à partir de TRADUCTIONS lue avant son initialisation). Les dépendances
   sont-elles saines, que faudrait-il déplacer, `scorePrepares` (sept cents lignes, une douzaine de
   plafonds qui interagissent) doit-il se découper à son tour, et la clé du memo qui s'allonge à chaque
   marque tient-elle ? Réponse attendue : une liste courte de déplacements, chacun avec sa raison.

Tout autre défaut structurel vu en lisant est bienvenu, à une condition : dire quelle famille de paires
il touche et comment on le mesurerait. Une opinion sans mesure possible n'entre pas dans la revue.

## La forme

Français, sans cadratin (U+2014), sans chiffre qui n'ait été mesuré ou lu dans le registre. Deux pages
au plus. Chaque section finit par une recommandation en une phrase. La revue se termine par cinq lignes
pour le chef d'orchestre : ce qu'il faut faire d'abord, et pourquoi.

## Revue

(à écrire par la session de revue)
