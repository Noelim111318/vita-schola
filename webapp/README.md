# Vita Schola

PWA installable, hors-ligne, sans build. Construite sur **pwa-engine**
(dossier `engine/` : service worker, bandeau d'installation, helpers).

## Lancer en local

Un service worker exige http:// (pas file://) :

```
python3 -m http.server 8000
# puis http://localhost:8000
```

Les icones (monogramme "VS" jaune sur fond bleu nuit uni) se regenerent depuis la racine
du depot :

```
python3 tools/make-icons.py     # icons/ + favicon.ico + lanceur Android (necessite Pillow)
```

## Structure

| Fichier | Role |
|---|---|
| `index.html` | coque + ecrans (`#screen-home`, `#screen-play`, `#screen-done`) |
| `data.js` | **tout le contenu editable** (`window.APP_DATA`) |
| `app.js` | logique de l'app ; appelle `AppEngine.boot(...)` puis cable le reste |
| `app.css` | `@import "engine/engine.css"` + styles specifiques |
| `manifest.json` | metadonnees PWA |
| `service-worker.js` | declare `APP_SLUG` + `APP_VERSION` + `APP_SHELL`, importe `engine/sw-core.js` |
| `engine/` | le moteur, **copie** depuis toolbox/pwa-engine (ne pas editer ici) |
| `engine/.version` | version du moteur vendore (ecrite par new-app.sh / sync-engine.sh) |
| `icons/` | placeholders, remplaces par `tools/make-icons.py` |

## Langue

`<html lang/dir>` et `manifest.json` prennent la valeur passee a la creation
(`APP_LANG="en" ./tools/new-app.sh …`, defaut `fr`, `dir=rtl` pour ar/he/fa/ur).
Les textes du moteur (serie, semaine, aide iOS) restent FR : pour une autre
langue, `AppEngine.boot({ strings: { … } })` — cles dans `engine/README.md`.

## Aller plus loin (manifest)

`shortcuts` (actions au appui long sur l'icone) et `screenshots` (fiche
d'installation enrichie sur Android) ne sont pas dans le template : ajoute-les
a `manifest.json` quand l'app a des ecrans stables, p.ex.

```json
"shortcuts": [
  { "name": "Nouvelle partie", "url": "./index.html#play" }
],
"screenshots": [
  { "src": "screenshots/home.png", "sizes": "1080x1920", "type": "image/png", "form_factor": "narrow" }
]
```

## Livrer une nouvelle version

1. `./tools/bump-version.sh vX.Y.Z` — bumpe la version dans `index.html`,
   `app.js`, `service-worker.js`, `manifest.json` d'un coup.
2. Ajoute tout nouveau fichier statique a `APP_SHELL` dans `service-worker.js`.
3. Deploie. Les clients se mettent a jour tout seuls (SKIP_WAITING + reload).
   Pour un reload non force, `AppEngine.boot({ autoReload: false })` puis
   ecoute `AppEngine.on('sw:updateready', ...)`.

## Mettre a jour le moteur

Depuis `toolbox/pwa-engine/` :

```
./tools/sync-engine.sh <chemin-vers>/webapp
```

puis `./tools/bump-version.sh vX.Y.Z` ici (le cache SW inclut `engine/*`).

## API du moteur

Voir `engine/README.md`.
