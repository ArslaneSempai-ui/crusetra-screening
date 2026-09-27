#!/bin/zsh
# UNE VOIE D'ÉTUDE : son worktree, ses liens vers les données et les modules, sa mesure de référence.
#   zsh scripts/voie.sh <tour> <nom>      → crée <bac>/tour<tour>/wt<tour>-<nom> sur la branche tour<tour>-<nom>
# Le bac est le dossier passé en BAC (défaut : /tmp/voies). La voie travaille là et nulle part ailleurs.
set -u
tour=${1:?tour} ; nom=${2:?nom}
depot=${0:A:h:h}
bac=${BAC:-/tmp/voies}/tour$tour
wt=$bac/wt$tour-$nom
mkdir -p $bac
git -C $depot worktree add $wt -b tour$tour-$nom || exit 1
ln -s $depot/data $wt/data
ln -s $depot/node_modules $wt/node_modules
cd $wt && npm run mesure-entites -- --detail > $bac/$nom-base.txt 2>&1
grep -E "^FORT|^POSSIBLE" $bac/$nom-base.txt
echo "worktree : $wt · référence : $bac/$nom-base.txt · comparer : npm run comparer -- $bac/$nom-base.txt"
