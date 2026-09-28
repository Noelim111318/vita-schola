#!/usr/bin/env bash

set -euo pipefail

command -v perl >/dev/null 2>&1 || { echo "perl requis" >&2; exit 1; }

NEW="${1:-}"
DIR="${2:-$PWD}"

case "$NEW" in
  v[0-9]*) ;;
  "") echo "usage: $0 vX.Y.Z [dossier-app]" >&2; exit 2 ;;
  *)  echo "version attendue sous la forme vX.Y.Z (ex: v1.2.0)" >&2; exit 2 ;;
esac
[ -d "$DIR" ] || { echo "dossier introuvable : $DIR" >&2; exit 1; }

export V_NEW="$NEW"
changed=0
found=0

bump() {
  local rel="$1" expr="$2" f="$DIR/$1" before after
  [ -f "$f" ] || return 0
  found=1
  before="$(cat "$f")"
  perl -0777 -pe "$expr" "$f" > "$f.tmp" && mv "$f.tmp" "$f"
  after="$(cat "$f")"
  if [ "$before" != "$after" ]; then echo "  maj  $rel"; changed=1
  else echo "  --   $rel (deja a jour)"; fi
}

bump app.js \
  's/(APP_VERSION\s*=\s*["\x27])[^"\x27]*(["\x27])/${1}$ENV{V_NEW}${2}/g'
bump service-worker.js \
  's/(APP_VERSION\s*=\s*["\x27])[^"\x27]*(["\x27])/${1}$ENV{V_NEW}${2}/g;
   s/(APP_CACHE\s*=\s*["\x27][^"\x27]*-)v[0-9][^"\x27]*(["\x27])/${1}$ENV{V_NEW}${2}/g'
bump index.html \
  's/(name="app-version"\s+content=")[^"]*(")/${1}$ENV{V_NEW}${2}/g;
   s{(id="app-version"[^>]*>)[^<]*(<)}{${1}$ENV{V_NEW}${2}}g'
bump manifest.json \
  's/("version"\s*:\s*")[^"]*(")/${1}$ENV{V_NEW}${2}/g'

if [ "$found" != 1 ]; then
  echo "aucun fichier versionne (app.js / service-worker.js / index.html / manifest.json) dans $DIR" >&2
  exit 1
fi
echo
if [ "$changed" = 1 ]; then
  echo "version -> $NEW"
  echo "pense a ajouter tout nouveau fichier statique a APP_SHELL (service-worker.js)."
else
  echo "deja en $NEW partout, rien a faire."
fi
