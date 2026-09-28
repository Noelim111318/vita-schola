#!/usr/bin/env bash
# Sauvegarde chiffree de la cle d'envoi Play Store (~/.android-release :
# fichier .jks + keystore.properties avec ses mots de passe).
#
#   tools/signing-key-backup.sh encrypt <sortie.tar.gz.gpg>   # cree la sauvegarde
#   tools/signing-key-backup.sh decrypt <sauvegarde.gpg>      # restaure dans ~/.android-release
#
# Chiffrement symetrique AES-256 (gpg). La phrase secrete est lue au clavier,
# jamais passee en argument ni en variable d'environnement (invisible dans ps
# et l'historique). La perdre = sauvegarde illisible : la garder ailleurs que
# le fichier chiffre.
set -euo pipefail

KEY_DIR_NAME=".android-release"
KEY_DIR="$HOME/$KEY_DIR_NAME"

die() { echo "Erreur : $*" >&2; exit 1; }
usage() { sed -n '4,5p' "$0" | sed 's/^# //'; exit 1; }

command -v gpg >/dev/null || die "gpg introuvable (sudo apt install gnupg)."
[ $# -eq 2 ] || usage
mode="$1"; file="$2"

read_pass() {
  local prompt="$1" p
  read -r -s -p "$prompt" p; echo >&2
  printf '%s' "$p"
}

# gpg lit la phrase sur le descripteur 3 (jamais sur la ligne de commande).
gpg_run() {
  local pass="$1"; shift
  gpg --batch --yes --quiet --no-symkey-cache --pinentry-mode loopback --passphrase-fd 3 "$@" 3< <(printf '%s' "$pass")
}

case "$mode" in
  encrypt)
    [ -d "$KEY_DIR" ] || die "$KEY_DIR introuvable : rien a sauvegarder."
    ls "$KEY_DIR"/*.jks >/dev/null 2>&1 || die "aucun fichier .jks dans $KEY_DIR."
    [ ! -e "$file" ] || die "$file existe deja (choisis un autre nom ou supprime-le)."
    pass="$(read_pass 'Phrase secrete : ')"
    [ ${#pass} -ge 12 ] || die "phrase trop courte (12 caracteres minimum)."
    [ "$pass" = "$(read_pass 'Confirmation : ')" ] || die "les deux saisies different."

    tar czf - -C "$HOME" "$KEY_DIR_NAME" | gpg_run "$pass" --symmetric --cipher-algo AES256 -o "$file"

    # Verification aller-retour : dechiffre en memoire et compare fichier par fichier.
    tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
    gpg_run "$pass" --decrypt "$file" | tar xzf - -C "$tmp"
    diff -r "$KEY_DIR" "$tmp/$KEY_DIR_NAME" >/dev/null || die "verification echouee : la sauvegarde ne correspond pas."
    echo "Sauvegarde chiffree et verifiee : $file"
    echo "Contenu : $(ls "$KEY_DIR" | tr '\n' ' ')"
    ;;
  decrypt)
    [ -f "$file" ] || die "$file introuvable."
    [ ! -e "$KEY_DIR" ] || die "$KEY_DIR existe deja : deplace-le d'abord (mv $KEY_DIR $KEY_DIR.old) pour ne rien ecraser."
    pass="$(read_pass 'Phrase secrete : ')"
    tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
    gpg_run "$pass" --decrypt "$file" > "$tmp/backup.tgz" || die "dechiffrement impossible (phrase secrete incorrecte ?)."
    tar xzf "$tmp/backup.tgz" -C "$HOME"
    chmod 700 "$KEY_DIR"; chmod 600 "$KEY_DIR"/*
    echo "Cle restauree dans $KEY_DIR : $(ls "$KEY_DIR" | tr '\n' ' ')"
    ;;
  *) usage ;;
esac
