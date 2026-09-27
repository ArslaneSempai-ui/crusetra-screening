#!/bin/zsh
# COMMETTRE : la suite entière d'abord, le commit seulement si elle est verte. Jamais « npm test ; git commit ».
#   zsh scripts/commettre.sh -F message.txt      (les arguments vont à git commit)
set -u
cd ${0:A:h:h} && npm test && git commit "$@"
