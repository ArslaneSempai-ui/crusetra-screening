# La carte du matcher d'entités

Trois pages pour une voie d'étude : où vit quoi, comment on mesure, ce qui a déjà été payé.
Lire ceci avant d'ouvrir un fichier ; ouvrir ensuite le fichier en ciblant (grep), jamais en entier.

## Où vit quoi (découpage du 28/09/2026)

| Fichier | Contenu | Quand on y écrit |
|---|---|---|
| `src/preparation.ts` | les tables (FORMES, PHRASES, LOCUTIONS, TRADUCTIONS, PARTICULES, ABREVIATIONS, CIVILITES, marqueurs de langue, préfixes et types de navires, désignations, pays et familles des formes) et `analyserEntite`, `preparerEntite`, `jetonsEntite` | un mot, une forme, une abréviation, une civilité, un marqueur |
| `src/mots.ts` | fréquences et poids, le dictionnaire anglais (`lemme`, `motsDistincts`, `pluriel`, `gerondif`, `composesDistincts`), numéros, `squelette` et ses classes, les plis de romanisation (`pliJaponais`, `pliCoreen`, `pliIndien`, `pliTamoul`, `pliCantonais`), les crédits | une équivalence entre deux graphies d'un même mot |
| `src/score.ts` | `NomPrepare`, `depuisJetons`, `simMot`, `scorePrepares` et ses plafonds, `marquesEnConflit`, les champs coupés, `scoreBrut` | un plafond, un conflit de marques, un crédit au score |
| `src/variantes.ts` | annonces (a.k.a., ex, formerly), `PREFIXES` (étiquettes de champ devant le nom), `ANNOTATIONS` (résidus derrière), adresses, pavillons, `variantesTypees` (ancien nom, mention de succursale, numéro de registre), `lecturesDe` | un résidu de document |
| `src/ecritures.ts` | hanzi (pinyin, jyutping), hangul, arabe et persan, hébreu, thaï, tamoul : les lectures d'un nom en écriture native, la clé consonantique | une écriture |
| `src/entites.ts` | la façade (`export *` des modules), `scoreNoms`, `palierEntite`, la mesure sur les jeux, les seuils | presque jamais |
| `src/cribler.ts` | l'index sans perte : toute nouvelle façon de retrouver un mot (pli, clé, sentinelle) doit y être rangée, sinon le témoin exhaustif rougit | dès qu'un pli ou une clé naît |

`doc/LIMITES.md` : le registre des limites connues (paire, jeu, score, raison), que `rates-du-jeu` lit pour marquer
les paires « limite connue » ; une voie ne les rouvre pas (VOIE.md, règle 11).

Les tests : `src/entites.test.ts` (le matcher), `src/cribler.test.ts` (l'index). Une règle gardée a son test, souvent
avec la paire qui l'a motivée. Une voie écrit ses tests dans un fichier à elle (`src/tour<N>-<voie>.test.ts`) pour
que deux voies ne se rencontrent pas dans le même fichier à la fusion.

## Comment on mesure

- `npm run mesure-entites` : les jeux d'apprentissage (`src/paires-entites*.json`), une ligne FORT, une ligne
  POSSIBLE, la courbe, une ligne par jeu ; `-- --detail` donne les paires ratées et les fausses alertes.
- Les seuils suivent une règle écrite (`choisirSeuils`, src/entites.ts), sur la borne haute de Wilson : FORT est le
  plus bas seuil au-dessus du possible qui tient sous 5 % de fausses alertes sur les pièges écrits ET sous 1 % sur
  les vraies sociétés distinctes de l'échantillon réel (`src/paires-gleif-apprentissage.json`, strate contenue à
  part) ; POSSIBLE est le niveau des plafonds, 0,80 (là où les plafonds rangent une paire douteuse) : plus bas, les
  relectures dépassent une contrepartie sur cinquante sur les livres de mille (0,81 et 0,80 le 30/09/2026).
  Une vraie paire à 0,800 est plafonnée : trouver LE plafond avant d'écrire une règle. `node src/etude-gleif.ts`
  donne la table sur l'échantillon réel ; `--paires` ses paires sous le fort.
- La barre : après une règle, les fausses alertes au fort ne montent pas et les vrais noms ne descendent pas,
  sur tous les jeux ensemble. Mesurer après chaque règle ; ce qui coûte se retire et se note.
- `npm run temoin-index -- --exhaustif` : l'index contre la comparaison exhaustive, zéro écart exigé quand on
  touche à la préparation, aux jetons, au squelette, à `simMot`, au memo, aux variantes ou à l'index. Une fois par
  voie, à la fin ; sans `--exhaustif` il ne mesure que le temps.
- La mesure et le témoin exhaustif tournent sur des fils (`src/mesure-parallele.ts`, node:worker_threads) : le fil
  principal répartit les paires (ou les requêtes du témoin) sur `os.availableParallelism() - 1` fils, au moins un,
  une paire sur N à chaque fil ; chaque fil charge les mêmes modules, LIT les fréquences du cache (jamais ne le
  reconstruit : le fil principal l'a construit avant, en appelant `frequencesDesListes()`), note sa part et renvoie
  ses scores ; le fil principal assemble la même table et imprime la même sortie, au chiffre de temps près (la ligne
  `temps` dit aussi le nombre de fils et leur démarrage : modules chargés et cache lu, 85 ms et 13 ms mesurés le 28/09).
  Le témoin : chaque fil du témoin porte un index complet des cinq listes (12 s, 0,9 Go de RSS mesurés le 28/09), le
  nombre de fils est borné par le quart de la mémoire de la machine, et le fil principal prend une part avec l'index
  qu'il a déjà ; l'index lui-même et le criblage rapide restent sur un fil, pour que `ms/nom` veuille dire quelque chose.
  `MESURE_SEQUENTIELLE=1` garde le chemin d'un seul fil : la référence ; `MESURE_FILS=N` force le nombre de fils.
  La preuve : `node src/mesure-entites.ts --detail` avec et sans la variable, `diff` des deux sorties sans les lignes
  `temps` vide, et vide aussi contre la sortie d'avant les fils ; `npm run comparer` de l'une contre l'autre : rien
  d'apparu, rien de perdu ; le témoin avec et sans la variable : mêmes lignes, `écarts 0`. Le test :
  `src/mesure-parallele.test.ts`, soixante paires (`src/fixtures/paires-parallele.json`) où fils et fil unique doivent
  donner le même score à chaque paire. Avant les fils, sur cette machine : la mesure détaillée 3,1 s (le cache des
  fréquences avait déjà retiré la minute des listes), le témoin exhaustif 576 s (6,1 s par nom, 90 noms).
- Le jeu aveugle n'est jamais lu ni mesuré en détail : `npm run verdict`, une fois, par la session Juge
  (`verification/JUGE.md`) ; le registre est `verification/VERDICTS.md`.
- La machine : une mesure prend une minute, une suite complète cinq, un témoin quatre. Deux voies et un témoin
  en même temps multiplient tout par dix. Une voie ne lance ni la suite complète ni le témoin avant d'avoir fini.

## Les outils d'un tour (le chef les lance, dans cet ordre)

- `npm run valider-jeu -- <jeu.json> [--copier]` : le jeu aveugle reçu de son auteur, AVANT le juge : une ligne
  JSON (comptes, recouvrement avec TOUS les jeux d'apprentissage, identiques à la casse près, quasi-doublons,
  cadratins, empreinte), et un refus en une ligne si 400/200/200 ne tient pas, si une clé ou un champ manque, si
  un nom est déjà vu, si un cadratin traîne ; `--copier` le range dans `~/Documents/jeux-aveugles/jeuN-aveugle.json`
  (cadratins des noms remplacés, provenance qui le dit, jamais par-dessus un fichier). Jamais une paire à l'écran.
- `npm run promouvoir -- <N>` : après le verdict et son étude, le jeu aveugle N devient `src/paires-entites-<N+1>.json` :
  la ligne du juge lue dans `verification/VERDICTS.md` et écrite dans la provenance, la ligne ajoutée à
  `CHEMINS_APPRENTISSAGE`, les figures refaites ; refuse si la cible existe, si la ligne du juge manque ou parle
  d'une autre empreinte, si le recouvrement n'est pas nul.
- `npm run rates-du-jeu -- <N> [--mesure <fichier>]` : au début du tour suivant, ce que le jeu N ne passe pas
  encore (RATÉ, FAUSSE-F, possible), groupé par la nature de l'auteur, une ligne par paire et les trois totaux : le
  brief des voies s'écrit dessus. Sans `--mesure` il relance la mesure détaillée dans un fichier temporaire (une minute).
  Une paire de `doc/LIMITES.md` sort avec « (limite connue: raison) » en queue, et le total les compte.
- `npm run paire -- "a" "b"` : le diagnostic d'une paire, ce que le chef réécrivait en script jetable : le score, la
  paire de lectures qui l'a donné et son plafond, puis pour chaque côté les variantes typées, les lectures, les mots
  préparés (poids, squelette), les marques posées, et si `marquesEnConflit` tire ; texte plat, un fait par ligne.
  `npm run paire -- --limites` rejoue les paires de `doc/LIMITES.md` et nomme les scores qui ont bougé
  (`--corriger` réécrit la colonne) : à lancer à la fin du tour, avant de commettre.
- `node scripts/doublons.mjs [--corriger] <fichier.ts>...` : à la fusion des voies, les clés en double d'un
  `Object.entries({ ... })` (TS1117, ce qu'une fusion en union laisse) : fichier, clé, les deux lignes ; `--corriger`
  retire la seconde. Sort en 1 tant qu'il en reste.
- `zsh scripts/exemple.sh <round> <commit>` : à la fin du tour, le matcher commis : le criblage d'exemple rejoué, la
  fixture de `cascade-licencie` rafraîchie, testée et commise là-bas, puis ici les figures, le relevé et le README
  commis par `commettre.sh`. Une ligne par étape, arrêt à la première qui échoue.

## Ce qui a déjà été payé (ne pas refaire)

- Le squelette fond des classes de consonnes, pas tout : sh et h séparés (Shing, Hing), zh reste j, le q arabe
  reste k. Une voyelle change un mot sauf sous une marque de romanisation (arabe, japonais, coréen, indien).
- Le dictionnaire anglais dit que deux mots anglais à une lettre près sont deux mots (Marlin, Merlin) ; il ne
  sait rien de l'espagnol ni du japonais.
- Le pluriel n'est le même mot que pour les génériques du commerce, jamais dans un nom de navire.
- Une année seule entre parenthèses est une société successeur ; une année datée (Est. 1887) est une annotation.
- Une particule sautée ne coûte rien ; « dos », « bint », « ibn » ne sont pas des particules.
- Les sigles POL et POD exigent leurs deux-points (sinon « pol » mangeait Polska).
- Un séparateur (barre, tiret simple) est entouré d'espaces ; « 2014/117230/07 » et « PMA-45678-B » restent entiers.
- Une succursale face au nom nu est la même personne (fort) ; face au siège écrit ou à une autre succursale,
  possible. Deux numéros de registre différents, possible ; un seul côté numéroté, fort.
- Un ex-nom d'un seul côté est la même coque ; des deux côtés avec des noms actuels différents, possible.
- Corp. et Inc. sont deux dépôts (possible) ; FZCO et DMCC deux zones ; GmbH et GmbH & Co. KG deux personnes.
- Une chaîne identique jugée « entité différente » n'est pas une question de noms : limite, pas règle.
- Hokkien et teochew n'ont aucune source publique de lectures ; le thaï s'écrit sans espaces dans un mot.
- `import type` pour un type venu d'un autre module (Node en mode strip) ; une constante construite d'une autre
  au chargement crée un cycle : la définir près de sa source.
- Pas de clé en double dans un objet littéral (tsc refuse) : grep avant d'ajouter à ABREVIATIONS ou TRADUCTIONS.
