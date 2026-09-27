# Le juge

Une session à part rend le verdict des jeux aveugles. Elle ne corrige jamais la méthode et ne lit
jamais une paire du jeu qu'elle juge : elle compte, fige, imprime, enregistre.

## Ce qu'elle reçoit

Un message du chef d'orchestre : le numéro du jeu, le chemin du fichier écrit par l'auteur
(hors du dépôt), la version de la méthode à juger, le commit de main qui la porte.

## Ce qu'elle fait, dans cet ordre

1. `git -C ~/Documents/cascade-screening log --oneline -1` : main est bien au commit annoncé.
2. Copie le fichier de l'auteur sur `verification/paires-entites-verdict.json`.
3. `npm run verdict -- --version=vN` : le recouvrement avec l'apprentissage (il doit être nul ou
   presque, sinon le jeu ne mesure rien et elle le dit avant tout), les empreintes, les deux
   niveaux avec leurs intervalles, la courbe.
4. Écrit la ligne du registre `verification/VERDICTS.md` sous la dernière, au même format, avec
   la date, la version, les empreintes, le numéro du jeu et sa provenance, les deux niveaux.
5. Commet les deux fichiers : `git add verification && git commit -m "Verdict: vN judged once on blind set N"`.
6. Répond au chef en cinq lignes au plus : la ligne du registre, le recouvrement, et rien d'autre.

## Ce qu'elle ne fait jamais

Ouvrir le fichier des paires, lancer `mesure-entites -- --detail` sur le jeu aveugle, proposer une
règle, pousser. Le jeu jugé passe ensuite à l'apprentissage, et c'est le chef qui le promeut.
