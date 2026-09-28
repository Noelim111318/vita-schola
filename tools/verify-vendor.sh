#!/usr/bin/env bash
set -u
cd "$(dirname "$0")/.." || exit 1
V="$PWD/webapp/vendor"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
fail=0

cmp_one() {
  if [ ! -f "$2" ]; then echo "  ?? $3 — absent du paquet npm"; fail=1; return; fi
  if cmp -s "$1" "$2"; then echo "  ok $3"; else echo "  NON $3 — DIFFERENT"; fail=1; fi
}

echo "== Fichiers utilises tels quels (doivent etre identiques a npm) =="
( cd "$TMP" && npm pack jsqr@1.4.0 pdfjs-dist@3.11.174 tesseract.js@5.1.1 \
    tesseract.js-core@5.1.1 @tesseract.js-data/fra@1.0.0 >/dev/null 2>&1 ) || { echo "npm pack a echoue"; exit 1; }
for t in "$TMP"/*.tgz; do
  d="$TMP/$(basename "$t" .tgz)"; mkdir -p "$d"; tar xzf "$t" -C "$d" --strip-components=1
done
J="$TMP/jsqr-1.4.0"; P="$TMP/pdfjs-dist-3.11.174"; T="$TMP/tesseract.js-5.1.1"
C="$TMP/tesseract.js-core-5.1.1"; F="$TMP/tesseract.js-data-fra-1.0.0"
cmp_one "$V/jsqr.js"                            "$J/dist/jsQR.js"                     "jsqr.js (jsQR 1.4.0)"
cmp_one "$V/pdf.min.js"                         "$P/build/pdf.min.js"                 "pdf.min.js (pdfjs-dist 3.11.174)"
cmp_one "$V/pdf.worker.min.js"                  "$P/build/pdf.worker.min.js"          "pdf.worker.min.js"
cmp_one "$V/tesseract/tesseract.min.js"         "$T/dist/tesseract.min.js"            "tesseract.min.js (5.1.1)"
cmp_one "$V/tesseract/worker.min.js"            "$T/dist/worker.min.js"               "tesseract worker.min.js"
cmp_one "$V/tesseract/tesseract-core-lstm.wasm.js"      "$C/tesseract-core-lstm.wasm.js"      "coeur wasm lstm (core 5.1.1)"
cmp_one "$V/tesseract/tesseract-core-simd-lstm.wasm.js" "$C/tesseract-core-simd-lstm.wasm.js" "coeur wasm simd-lstm"
gunzip -c "$F/4.0.0_best_int/fra.traineddata.gz" > "$TMP/fra.ref" 2>/dev/null
cmp_one "$V/tesseract/lang/fra.traineddata"     "$TMP/fra.ref"                        "fra.traineddata (4.0.0_best_int, decompresse)"

echo
echo "== pawnote.js : amont rebundle vs notre copie patchee =="
B="$TMP/bundle"; mkdir -p "$B"
( cd "$B" && npm init -y >/dev/null 2>&1 && npm i @blockshub/pawnote-lts@1.6.4 >/dev/null 2>&1 \
  && npx --yes esbuild node_modules/@blockshub/pawnote-lts/dist/index.mjs \
       --bundle --format=iife --global-name=Pawnote --platform=browser \
       --outfile=upstream.js >/dev/null 2>&1 ) || { echo "  NON rebundle impossible"; exit 1; }
python3 - "$B/upstream.js" "$V/pawnote.js" <<'PY'
import sys, io, re, difflib
up = io.open(sys.argv[1], encoding='utf-8').read().splitlines()
ours = io.open(sys.argv[2], encoding='utf-8').read()
ours = ours[len(re.match(r'/\*.*?\*/\s*', ours, re.S).group(0)):].splitlines()
sm = difflib.SequenceMatcher(None, up, ours, autojunk=False)
ops = [o for o in sm.get_opcodes() if o[0] != 'equal']
print('  %d bloc(s) different(s) sur %d lignes' % (len(ops), len(up)))
for tag, i1, i2, j1, j2 in ops:
    if tag == 'replace' and i2 - i1 == 1 and j2 - j1 == 1:
        s2 = difflib.SequenceMatcher(None, up[i1], ours[j1], autojunk=False)
        for t2, p1, p2, q1, q2 in s2.get_opcodes():
            if t2 == 'equal': continue
            print('    ligne %-6d - %-28r + %r' % (i1, up[i1][p1:p2], ours[j1][q1:q2]))
    else:
        print('    %s amont[%d:%d] -> vendore[%d:%d] : %s' % (tag, i1, i2, j1, j2, (ours[j1][:90] if j2 > j1 else '')))
print('\n  Chaque difference doit correspondre a un patch de la banniere de pawnote.js :')
print('  Android/Android (1), membre x5 (2), Agenda:9 + agenda()/Wt (3),')
print('  JSON.stringify(Erreur) (4), onNewToken (5). Toute AUTRE difference est a examiner.')
PY

echo
[ "$fail" = 0 ] && echo "Fichiers non modifies : tous conformes a npm." || echo "ATTENTION : au moins un fichier ne correspond pas a npm."
exit "$fail"
