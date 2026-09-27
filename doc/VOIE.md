# Le contrat d'une voie d'étude

Une voie reçoit une liste de paires (vraies paires ratées, pièges qui passent) et rend un diff mesuré. Elle lit
`doc/CARTE.md` d'abord. Tout ce qui suit s'applique sans exception.

## Le cadre

1. `zsh scripts/voie.sh <tour> <nom>` : le worktree, les liens, la mesure de référence. La voie ne touche à rien
   hors de son worktree ; jamais de commit, jamais de push, jamais de suppression, jamais un fichier
   `src/paires-entites*.json` ni rien sous `verification/`.
2. Ses tests vont dans `src/tour<tour>-<nom>.test.ts`, jamais dans `entites.test.ts` : deux voies ne se
   rencontrent pas à la fusion. Une règle gardée a son test, avec la paire qui l'a motivée.
3. Ses mots vont dans les tables existantes de `src/preparation.ts`, après un `grep` du mot : une clé en double
   fait échouer `tsc`. Une table nouvelle vit dans un fichier à elle, importé par la préparation.

## La mesure

4. `npm run mesure-entites` après CHAQUE règle ; `npm run comparer -- <référence>` dit ce qui est apparu et ce
   qui est perdu au fort. Douze mesures au plus.
5. La barre : les fausses alertes au fort ne montent pas, les vrais noms ne descendent pas, sur tous les jeux
   ensemble ; une règle qui retire des fausses alertes fortes peut coûter au plus autant de vraies paires, et la
   voie dit lesquelles. Ce qui coûte plus se retire, et se note sous « abandonné » avec son chiffre.
6. La voie ne lance NI la suite complète (`npm test`) NI le témoin exhaustif : le chef les lance une fois, à la
   fusion. Elle lance `npx tsc --noEmit` et son propre fichier de tests, et `node --test src/cribler.test.ts`
   si elle a touché à l'index. La machine est partagée : deux voies et un témoin en même temps multiplient les
   temps par dix.

## Le rendu

7. Avant d'écrire le diff, la voie ramène `main` dans son worktree : `git merge --no-edit main` (main bouge
   pendant qu'elle travaille : la voie locale du chef y commet). Un conflit se résout par l'union des deux côtés ;
   puis `node scripts/doublons.mjs --corriger` sur les fichiers qu'elle a touchés (l'union laisse des clés en
   double), `npx tsc --noEmit` et son fichier de tests à nouveau, et un dernier `npm run comparer -- <référence>`.
   Le compte rendu dit que main a bougé, si c'est le cas.
8. `git add -N` des fichiers nouveaux, puis `git diff > <bac>/<nom>.diff`.
9. Le compte rendu, structuré : référence et résultat (les deux lignes de la mesure, telles quelles), gagnés et
   perdus (« a | b (jeu) »), règles gardées (une phrase chacune : le mécanisme et où il vit), abandonnées (avec
   la raison mesurée), limites (ce qui reste hors de portée et pourquoi). Aucun chiffre qui n'ait été mesuré.

## Le style

10. Commentaires en français, dans la voix du fichier : dire pourquoi, nommer la famille de paires, jamais de
   cadratin (U+2014). TypeScript en mode strip : `import type` pour un type, pas de propriété de paramètre,
   pas d'enum. Des `Map`, jamais des objets littéraux indexés par les mots d'un utilisateur.

## Les limites connues

11. Une paire que `npm run rates-du-jeu` marque « limite connue » (le registre est `doc/LIMITES.md`) ne se rouvre
   pas : la voie la laisse dans ses ratés sans y toucher, sauf si le sujet de la voie est exactement le mécanisme
   que la raison nomme. Une voie qui la ferme quand même le dit sous « règles gardées », avec la ligne du registre
   à retirer ; une voie qui découvre une limite nouvelle l'ajoute au registre (le score par `npm run paire`, la
   raison en une phrase) au lieu de la noter dans son compte rendu.
