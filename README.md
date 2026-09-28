# Vita Schola — build & structure

App PWA/Capacitor : un tableau de bord Pronote, pour voir d'un coup d'oeil
ce qui compte (cours du jour, devoirs, dernieres notes, cantine...), plus
des quiz de revision tires des cours. Ne remplace pas l'app officielle
Pronote (messagerie, bulletins... restent la-bas). Batie sur
`toolbox/pwa-engine` (hors de ce depot).

## Arborescence

```
.
├── webapp/                    # l'app web (PWA, sans build)
│   ├── index.html app.js app.css data.js
│   ├── manifest.json service-worker.js
│   ├── engine/               # pwa-engine vendore (ne pas editer ici)
│   ├── vendor/pawnote.js     # @blockshub/pawnote-lts 1.6.4 bundle (IIFE, global `Pawnote`)
│   ├── vendor/jsqr.js        # jsQR (npm, UMD tel quel) — scan QR camera, global `jsQR`
│   ├── vendor/pdf.min.js + pdf.worker.min.js  # pdfjs-dist 3.11.174 (UMD, dernier build non-ESM) — texte des PDF joints, charge a la demande
│   ├── vendor/tesseract/     # tesseract.js 5.1.1 + coeur wasm LSTM + lang/fra.traineddata (non compresse) — OCR local des scans, charge a la demande
│   └── icons/
├── package.json              # tooling Capacitor (pas l'app elle-meme)
├── capacitor.config.json      # webDir=webapp, CapacitorHttp active
└── android/                   # projet natif genere par `cap add android`
```

## Reconstruire l'APK

Prerequis : Node.js, **JDK 21** et **SDK Android 36** (Capacitor 8), avec
`JAVA_HOME` et `ANDROID_HOME` definis. Sur la machine de developpement, un
script local hors depot (`~/tools/android-env.sh`) les positionne :

```bash
source ~/tools/android-env.sh   # JAVA_HOME, ANDROID_HOME, PATH
npx cap sync android            # recopie webapp/ -> android/app/.../assets/public
cd android
./gradlew assembleDebug
# -> android/app/build/outputs/apk/debug/app-debug.apk
```

APK **debug** (signe avec la cle debug Android, installation manuelle
uniquement). La version publiee sur Google Play est un AAB signe
(`./gradlew bundleRelease`) avec une cle d'envoi gardee hors du depot : si
`~/.android-release/keystore.properties` existe, `android/app/build.gradle`
l'utilise, sinon le build release n'est pas signe.

## Tester en navigateur (dev uniquement)

```bash
cd webapp
python3 -m http.server 8000     # http://localhost:8000
```

Le mode navigateur fonctionne pour l'UI, mais **la vraie connexion a Pronote
y est bloquee par CORS** — pas de proxy integre a l'app (garder les reglages
simples). Pour explorer l'interface sans APK : bouton **Mode demonstration**
sur l'ecran de connexion (donnees fictives, zero reseau). Pour de vraies
notes, le seul chemin est l'APK (CapacitorHttp = HTTP natif, pas de CORS).

## Si `pawnote` doit etre mis a jour

Le `pawnote` original (LiterateInk) est archive par son auteur — on utilise le
fork communautaire `@blockshub/pawnote-lts` (memes mainteneurs que Papillon,
API identique, bugfixes uniquement). Verifier sur npm si une version plus
recente existe avant de forker/patcher quoi que ce soit dans `app.js`.

```bash
mkdir /tmp/bundle && cd /tmp/bundle && npm init -y
npm i @blockshub/pawnote-lts@<version>
npx esbuild node_modules/@blockshub/pawnote-lts/dist/index.mjs \
  --bundle --format=iife --global-name=Pawnote --platform=browser \
  --outfile=<repo>/webapp/vendor/pawnote.js
```

Puis `tools/bump-version.sh vX.Y.Z webapp` (bumpe la version dans
index.html/app.js/service-worker.js/manifest.json d'un coup) et ajouter tout
nouveau fichier a `APP_SHELL` dans `service-worker.js`.

Apres toute mise a jour d'une dependance vendoree, relancer
`bash tools/verify-vendor.sh` (voir ci-dessous).

## Verifier la provenance du code tiers

`webapp/vendor/` = ~11 Mo de code tiers qui tournent dans l'APK avec les memes
acces que `app.js` (plugins Capacitor, jeton Pronote, cle d'IA). Le relire est
illusoire (minifie) ; ce qui a du sens est de verifier qu'il correspond a ce que
npm publie :

```bash
bash tools/verify-vendor.sh
```

Compare octet pour octet jsQR, pdf.js, tesseract.js + son coeur wasm + la langue
francaise, puis rebundle `@blockshub/pawnote-lts` depuis l'amont et liste les
differences avec notre copie : elles doivent TOUTES correspondre aux patches
decrits dans la banniere en tete de `webapp/vendor/pawnote.js`. Verifie le
2026-09-22 : 8 fichiers sur 8 identiques, et pawnote = amont + exactement les
5 patches documentes. Utile aussi pour la GPL, qui impose d'indiquer les
modifications apportees.

## Ce qui est cable / pas encore

- ✅ Connexion QR + PIN (`pawnote.loginQrCode`), reconnexion silencieuse par
  jeton (`loginToken`), stockage local uniquement (jamais de mot de passe).
  QR scanne a la camera (`getUserMedia` + `jsQR`, vendore) ou colle
  manuellement en repli.
- ✅ Plusieurs enfants, meme d'etablissements differents : un QR ne relie que
  les enfants du MEME etablissement (`session.user.resources` +
  `pawnote.use()`) — un enfant dans un autre etablissement demande un second
  QR/compte, gere en parallele (liste plate des enfants, un compte par
  etablissement en interne). Ecran de choix accessible directement via le
  bouton portant le nom de l'enfant dans l'entete du Resume, avec un bouton
  "+ Ajouter un enfant" pour scanner un nouveau QR sans se deconnecter.
  Fonctionne aussi bien avec un QR de compte parent qu'un QR de compte
  eleve ; l'ecran de choix indique le type de compte (parent/eleve/
  enseignant) a cote du nom de l'etablissement. Chaque ligne a aussi une
  icone poubelle pour retirer cet enfant seul (efface son cache local et
  son compte associe si plus aucun autre enfant ne s'en sert), sans
  toucher aux autres enfants connus — distinct du bouton "Se deconnecter"
  qui retire tout d'un coup.
- ✅ Ecran **Resume** (seul ecran principal desormais — pas d'ecran "Toutes
  les notes" separe) : ordre par defaut (modifiable, voir plus bas) — vie scolaire recente (`pawnote.notebook`),
  prochain(s) DS (`TimetableClassLesson.test`, derive de la recuperation
  d'emploi du temps), devoirs non faits (`assignmentsFromIntervals`, filtre
  `done === false`, trie par echeance croissante ; matiere/extrait sur 2
  lignes tronquees proprement, "+ N autres" cliquable pour deplier), emploi
  du temps du jour restant ou prochain jour de cours — restant seulement
  tant que la journee n'est pas finie, sinon la journee entiere ; un trou
  d'environ 1h ou plus entre 2 cours affiche une carte "Libre (Nh)" avec
  les vraies heures de debut/fin du trou. Bouton a cote du titre (meme
  principe que "Tout afficher"), duplique sur Menu, pour basculer vers l'autre jour,
  aujourd'hui par defaut tant qu'il reste un cours sinon le prochain jour
  d'ecole — le menu, cale sur cette meme date, suit automatiquement, les
  2 boutons partagent le meme choix. Devoirs, DS et emploi du temps
  partagent une bordure coloree par matiere (teinte reprise de la vraie
  couleur Pronote de la matiere, teinte et saturation conservees, seule
  la luminosite ramenee dans une plage lisible sur fond sombre —
  memorisee par matiere, reinitialisee a chaque changement d'enfant),
  dernieres notes,
  moyennes par matiere (tape dessus -> detail + graphique d'evolution +
  simulateur, chevron "›" pour indiquer que c'est cliquable), moyennes
  generale/classe (idem, tape dessus -> sous-ecran avec graphique
  d'evolution et simulateur multi-matieres, comme une matiere),
  menu de cantine (`pawnote.menus`, aspect "colonnes", une ligne par
  categorie — entree/plat/accompagnement/fromage/dessert —, date du jour
  dans le titre de la section comme l'emploi du temps plutot qu'en ligne
  separee), puis l'agenda (`pawnote.agenda`, meme aspect colonnes,
  vacances/jours feries/conseils
  de classe/RDV a venir) tout en bas. Une section reste entierement masquee
  quand sa donnee n'a jamais pu etre tentee (onglet indisponible pour ce
  compte) ; si la recuperation a reussi mais qu'il n'y a vraiment rien
  (ex. debut d'annee, aucune note saisie), la section s'affiche quand
  meme avec un petit texte explicite ("Aucune note pour le moment"...) au
  lieu de rester silencieuse comme en cas d'echec — sauf "Prochain DS",
  masquee des qu'elle est vide sans texte (certains etablissements/niveaux
  n'ont structurellement jamais de DS signale, ex. college vs lycee sur un
  meme compte multi-enfants ; l'App officielle fait pareil). Chaque source
  est chargee independamment (`Promise.allSettled`) sauf le menu, sequentiel
  apres l'emploi du temps puisqu'il en depend. Vie scolaire
  peut etre masquee ligne par ligne (icone œil a cote de chaque ligne,
  jamais envoye a Pronote — purement local) ; un bouton "Tout afficher (N)"
  / "Réduire", toujours visible a cote (pas dans) le titre de la section,
  bascule vers les elements masques pour les revoir attenues et les
  reafficher pour de bon — la bulle de detail d'un element masquable a le
  meme bouton œil. Vie scolaire affiche matiere/type et detail sur 2
  lignes distinctes (pas combinees par un tiret). N'importe quelle ligne
  de Vie scolaire/Devoirs/DS/Emploi du temps/Dernieres notes s'ouvre en
  bulle de detail (description complete, commentaire, prof, salle...) au
  lieu de rester tronquee — les listes elles-memes gardent un texte court
  faute de place. Sur un compte eleve, la bulle d'un devoir propose en
  plus "Marquer comme fait" (`pawnote.assignmentStatus`, cote eleve
  uniquement — absent sur un compte parent).
- ✅ Disposition du Resume (global, pas par enfant) : bascule **Complète /
  Personnalisée** sous l'entete. La vue complete montre TOUTES les
  sections, meme vides ("Rien à afficher."). La vue personnalisee masque
  celles que tu as decochees dans **Personnaliser** (icone œil par section)
  ainsi que toute section sans rien a montrer (aucune donnee, ou toutes les
  lignes masquees a la main ; exception : Emploi du temps/Menu restent tant
  que leur bouton de bascule de jour est visible). Le meme panneau
  permet de **reordonner** les sections (fleches haut/bas) — l'ordre vaut
  pour les deux vues ; Vie scolaire est en premier par defaut, Menu en
  dernier.
  En haut du panneau : le nombre de lignes affichees en mode reduit (avant
  "+ N autres") pour Devoirs (8 par defaut), Devoirs a anticiper (6) et
  le nombre de Dernieres notes (5). Vie scolaire, elle, affiche toujours
  toutes ses lignes (seules celles masquees avec l'œil disparaissent).
- ✅ **Bulle d'erreur** : les erreurs de connexion/bascule d'enfant/demarrage
  s'affichent dans une bulle en haut, quel que soit l'ecran (fermeture au
  toucher ou apres 10 s).
- ✅ **Devoirs à anticiper** ("long terme") : section (cachee quand vide) listant les
  devoirs non faits a rendre au-dela de 2 semaines (constante
  `NEAR_HOMEWORK_DAYS` dans app.js), jusqu'a ~20 semaines / fin d'annee,
  utile pour anticiper une lecture ou un expose ; un 📖 signale ceux dont
  le texte ressemble a une lecture (mots-cles lire/lecture/livre/roman/
  œuvre...).
- ✅ **Début et fin de journée** : section (deplacable) qui donne l'heure du
  premier cours et de la fin du dernier, horaires seuls, pour le jour choisi
  (bouton "Voir ..." propre, partage le meme choix que l'emploi du temps et
  le menu), sur la journee entiere meme quand l'emploi du temps ne montre
  plus que le restant. Un cours annule est ignore : annule de 8h a 9h, la
  journee commence a 9h.
- ✅ **Remplacements** : un cours annule + un cours qui le recouvre
  (remplacement) sont fusionnes en une ligne, l'info qui a change
  (matiere, prof, salle) etant barree avec la nouvelle a cote ; le statut
  Pronote d'un cours (ex. "Salle modifiée") n'apparait que dans sa bulle de
  detail. Heuristique non verifiee sur donnees reelles.
- ✅ **Badge "Nouveau" sur les notes** : une note apparue apres la 1re
  synchro d'un enfant (qui, elle, ne badge rien) porte un badge jaune dans
  "Dernieres notes" et dans le tableau de sa matiere, jusqu'a ce qu'on ouvre
  sa bulle (14 jours au plus).
- ✅ **Cours en cours** : sur le jour "aujourd'hui", le cours actuel est
  surligne avec un badge "En cours", le suivant porte "dans N min" (mis a
  jour toutes les 30 s, sans reseau).
- ✅ **Actualisation automatique** au retour dans l'app apres plus de 15 min.
- ✅ **Déjeuner** : un creneau de repas (matiere "Dejeuner", "Repas",
  "Cantine"...) s'affiche comme un creneau libre (pointille, sans couleur ni
  prof/salle) et n'entre pas dans debut/fin de journee. Une matiere sans couleur
  ou dont la couleur Pronote est blanche n'a pas de barre coloree, comme
  dans l'App officielle ; une couleur grise reste affichee en gris.
- ✅ **Pieces jointes des devoirs** : 📎 devant le texte du devoir (pas devant la matiere), liste de liens dans la
  bulle de detail (ouverts dans le navigateur ; les fichiers Pronote ne
  marchent que tant que la session est valide).
- ✅ **Cours annules** : affiches barres et estompes dans l'emploi du temps
  (mention "Cours annulé" dans leur bulle), ignores pour debut/fin de
  journee, le choix du prochain jour d'ecole et les DS.
- ✅ **Simulation sur la moyenne générale** : "Moyenne générale" ouvre un
  sous-ecran comme une matiere (moyennes, courbe d'evolution, simulateur
  avec choix de la matiere, plusieurs notes) qui affiche "avant → apres
  (ecart)" ; le simulateur d'une matiere montre aussi l'effet sur la
  moyenne generale. Calcul maison, ancre sur la moyenne officielle.
- ✅ **Moyennes estimees** : quand Pronote ne renvoie pas de moyenne generale
  (certaines classes de college), l'app l'estime comme Papillon — moyenne
  simple des moyennes de chaque matiere, sans coefficients de matiere —,
  affichee avec "≈" et une explication. Idem pour une matiere sans moyenne
  officielle (calcul a partir de ses notes).
- ✅ Hors-ligne : dernier releve de chaque section en cache, affiche
  immediatement au lancement.
- ✅ Mode demonstration (ecran de connexion) : simule un compte parent a 2
  enfants (college / lycee, avec et sans DS a venir) via l'ecran de choix
  normal — donnees fictives, aucun reseau, marche en navigateur comme dans
  l'APK.
- ✅ Ecran **A propos** (icone "i", entete du Resume) : version, description,
  et un journal de debug (200 dernieres lignes, persiste dans le stockage
  local) avec bouton "Copier les logs" (presse-papiers, repli textarea
  selectionnable si indisponible) — trace les requetes reseau (methode +
  chemin sans jetons), les tentatives de connexion et les erreurs globales,
  rien de personnel (pas de notes).
- ✅ Couleurs reprises du vrai Pronote (demo.index-education.net) : bleu
  `#0E78D5`, sarcelle `#008673`. Theme sombre par defaut ; theme clair / systeme au choix dans
  Personnaliser > Apparence.
- ⛔ Pas de notifications push "nouvelle note" (le resume se rafraichit a
  l'ouverture de l'app, pas de tache de fond).
- ⛔ Pas de connexion reelle possible en navigateur (CORS, volontairement pas
  de proxy pour rester simple) — seul l'APK se connecte pour de vrai.
- ✅ Bug corrige (2026-09-15) : Notes/Vie scolaire renvoyaient "Acces
  refuse" sur au moins un compte reel malgre une vraie connexion reussie.
  Cause racine trouvee par comparaison avec le trafic reel de l'App
  officielle (capture reseau) : pawnote-lts omettait le champ `membre`
  (quel enfant est concerne) attendu par cette version de Pronote sur les
  appels Notes/Vie scolaire d'un compte parent — patche dans
  `vendor/pawnote.js`. Emploi du temps/Menus/Devoirs restent masques sur
  ce compte precis (onglets reellement absents pour lui, confirme via le
  protocole — pas lie a ce bug), mais le meme correctif a ete applique
  par prudence a Menus/Devoirs pour les comptes/etablissements ou ces
  onglets sont actives.

## Revision par IA (quiz)

Section "Réviser" du Resume : cours du cahier de textes (14 j passes) avec
contenu et pieces jointes ; ecran de quiz genere par IA (Groq par defaut,
Mistral en second) avec la **cle API personnelle** du parent, stockee sur
l'appareil seulement. Les fichiers joints sont lus localement (pdf.js pour les
PDF, tesseract.js pour les scans/images, zip+XML pour .docx/.pptx) ; seul le
texte du cours (+ le niveau de classe) part chez le fournisseur choisi.

## Licences

L'application est publiee sous **GPL-3.0 ou ulterieure**, la licence de
`vendor/pawnote.js` (bundle modifie de `@blockshub/pawnote-lts` ; ses
modifications sont decrites dans la banniere en tete du fichier). Code
source : https://github.com/Noelim111318/vita-schola. Autres composants :
Capacitor (MIT), jsQR / PDF.js / Tesseract.js et son coeur (Apache-2.0),
donnees de langue francaise Tesseract (tessdata_best, Apache-2.0). Les
textes de licence sont embarques dans l'appli (`webapp/vendor/`,
`webapp/vendor/tesseract/`) et la liste est affichee dans A propos.

Texte complet dans `LICENSE` (GNU GPLv3, recupere tel quel depuis
gnu.org/licenses/gpl-3.0.txt).

## Depot

Code source de l'application Android "Vita Schola", publie sous
GPL-3.0 ou ulterieure (texte complet dans `LICENSE`) — correspond a
l'application distribuee sur Google Play.

Politique de confidentialite : `PRIVACY.md`. Contact : vitaschola@gmail.com.
Application independante et non officielle, ni editee ni approuvee par
Index Education (Pronote).
