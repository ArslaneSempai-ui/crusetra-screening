#!/bin/zsh
# L'EXEMPLE REJOUÉ APRÈS UN TOUR : le criblage d'exemple refait sur le matcher du tour, la fixture de
# cascade-licencie rafraîchie et commise là-bas, puis ici les figures, le relevé et le README commis par
# commettre.sh (la suite entière d'abord). Chaque étape tient en une ligne ; la première qui échoue arrête
# tout, et montre la dernière ligne de son journal.
#   zsh scripts/exemple.sh <round> <commit>     round : en lettres (« twelve ») ; commit : le matcher rejoué
set -u
round=${1:?round, in words (e.g. twelve)} ; commit=${2:?commit of the matcher replayed (short sha)}
depot=${0:A:h:h}
licencie=${LICENCIE:-/Users/arslanechr/Documents/cascade-licencie}
fixture=$licencie/src/fixtures/criblage-exemple.json
releve=exemple/contreparties-exemple.screening.json
cosign="Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
tmp=$(mktemp -d) ; n=0

# une étape : son libellé, un motif (grep -E) dont la première ligne du journal résume l'étape, la commande.
# Le journal reste dans $tmp ; l'échec en montre la dernière ligne et sort.
etape() {
  local libelle=$1 motif=$2 ; shift 2
  local journal=$tmp/$(( ++n )).log resume=""
  if "$@" > $journal 2>&1 ; then
    [[ -n $motif ]] && resume=$(grep -E -m1 -- "$motif" $journal)
    print -r -- "ok    $libelle${resume:+ : $resume}"
  else
    print -r -- "FAIL  $libelle : $(tail -n 1 $journal)"
    print -r -- "      journal : $journal"
    exit 1
  fi
}

cd $depot || exit 1
etape "example screening rerun" ' strong, .* possible, ' npm run cribler -- --names=exemple/contreparties-exemple.csv --client="Example Forwarding Inc. (invented)"

# le relevé porte le commit du matcher qui l'a produit : il doit être celui que le message va nommer
lu=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).commit ?? "")' $releve)
if [[ $lu != $commit ]]; then
  print -r -- "FAIL  the record says commit ${lu:-none}, not $commit : rerun from that commit, or pass it"
  exit 1
fi
totaux=$(node -e 'const t = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).totaux; console.log(`${t.forts} strong, ${t.possibles} possible, ${t.sansCorrespondance} with no candidate`)' $releve)
if [[ -n $(git status --porcelain -- exemple/contreparties-exemple.screening.csv) ]]; then
  print -r -- "note  the spreadsheet moved too and is not added: exemple/contreparties-exemple.screening.csv"
fi

etape "fixture copied to cascade-licencie" '' cp $releve $fixture
etape "cascade-licencie: node --test src/rapport-criblage.test.ts" '^# (pass|fail) ' zsh -c "cd $licencie && node --test src/rapport-criblage.test.ts"

{
  print -r -- "Example screening fixture refreshed on the round-$round matcher"
  print -r -- ""
  print -r -- "Copied from cascade-screening exemple/contreparties-exemple.screening.json,"
  print -r -- "the example screening rerun by npm run cribler on commit $commit (round"
  print -r -- "$round): $totaux. node --test"
  print -r -- "src/rapport-criblage.test.ts is green on this fixture."
  print -r -- ""
  print -r -- "$cosign"
} > $tmp/licencie.txt
etape "cascade-licencie: commit" '' zsh -c "cd $licencie && git add src/fixtures/criblage-exemple.json && git commit -q -F $tmp/licencie.txt"

etape "npm run figures" '' npm run figures
etape "git add $releve README.md" '' git add $releve README.md
{
  print -r -- "Example record refreshed after round $round"
  print -r -- ""
  print -r -- "The example screening rerun on the round-$round matcher ($commit):"
  print -r -- "$totaux. The fixture of cascade-licencie"
  print -r -- "was refreshed from the same record in the same pass."
  print -r -- ""
  print -r -- "$cosign"
} > $tmp/message.txt
etape "commettre.sh (npm test, then the commit)" '' zsh scripts/commettre.sh -q -F $tmp/message.txt
print -r -- "done  $(git log --oneline -1)"
