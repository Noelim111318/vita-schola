# Politique de confidentialité — Vita Schola

*Dernière mise à jour : 28 septembre 2026*

Vita Schola est une application Android gratuite, sans publicité, qui affiche
sur un seul écran les informations scolaires d'un élève (notes, devoirs,
emploi du temps, menu de la cantine, vie scolaire…) à partir de son compte
Pronote. Elle est développée par un particulier et publiée sous licence
libre GPL-3.0 ; son code source est public :
<https://github.com/Noelim111318/vita-schola>.

Vita Schola n'est **pas** une application officielle : elle n'est ni éditée,
ni approuvée par Index Éducation (éditeur de Pronote), ni par le ministère de
l'Éducation nationale.

## En résumé

- **Le développeur ne reçoit aucune de vos données.** Vita Schola n'a pas de
  serveur : elle ne collecte, ne stocke ni ne revend rien.
- L'application échange directement avec le serveur Pronote de
  l'établissement, comme l'application officielle.
- Aucune publicité, aucune mesure d'audience, aucun traceur.
- La fonction facultative « Révision par IA » envoie le texte de cours choisi
  au fournisseur d'IA que **vous** avez configuré avec **votre** clé, et
  seulement quand vous lancez un quiz.

## Données traitées et où elles vont

### Connexion à Pronote

Pour se connecter, vous scannez (ou collez) le QR code généré depuis votre
espace Pronote et saisissez le code PIN choisi. L'application reçoit alors un
jeton de connexion de Pronote. À chaque connexion, elle transmet au serveur
Pronote de l'établissement, et à lui seul, l'identifiant du compte, ce jeton
et un identifiant d'installation aléatoire créé lors du scan (comme le fait
l'application officielle).

- Ce jeton est **chiffré** et conservé uniquement sur votre téléphone (clé de
  chiffrement dans le Keystore Android, qui ne peut pas en sortir).
- Les données scolaires (notes et moyennes, devoirs et pièces jointes, emploi
  du temps, menus, agenda, cahier de textes, vie scolaire) sont récupérées
  directement auprès du serveur Pronote de l'établissement, par une connexion
  chiffrée (HTTPS). Une copie est gardée sur le téléphone pour un affichage
  rapide et hors ligne.
- Ces informations ne transitent par aucun serveur du développeur ni d'un
  tiers.

### Caméra

La caméra sert uniquement à lire le QR code de connexion. L'image est
analysée sur le téléphone, n'est ni enregistrée ni envoyée.

### Pièces jointes des cours

Pour préparer un quiz, l'application peut télécharger les pièces jointes d'un
cours depuis Pronote et en extraire le texte **sur le téléphone** (lecture des
PDF et reconnaissance de texte des documents scannés). Les fichiers et les
images ne quittent pas l'appareil.

### Révision par IA (facultative)

Cette fonction n'est active que si vous saisissez vous-même une clé API d'un
fournisseur d'IA (Groq ou Mistral AI) et acceptez l'avertissement affiché.
Quand vous lancez un quiz :

- sont envoyés au fournisseur choisi : le texte des cours sélectionnés
  (contenu du cahier de textes et texte extrait des pièces jointes), les noms
  des matières et le niveau de classe ;
- ne sont **jamais** envoyés : le nom de l'élève, ses notes, son identifiant
  Pronote ou tout autre renseignement personnel.

L'échange se fait directement entre le téléphone et le fournisseur, sous
votre propre compte chez lui : ses conditions d'utilisation et sa politique
de confidentialité s'appliquent (Groq : <https://groq.com/privacy-policy/> ;
Mistral AI : <https://legal.mistral.ai/terms/privacy-policy>). La clé API est chiffrée et
conservée uniquement sur le téléphone. Les quiz générés sont gardés sur le
téléphone.

### Journal de diagnostic

L'application tient un petit journal technique (étapes de connexion, erreurs
réseau) pour aider à résoudre un problème. Il ne contient ni notes ni contenu
scolaire, reste sur le téléphone, et n'est transmis que si vous le copiez et
l'envoyez vous-même.

## Conservation et suppression

Toutes les données sont stockées sur le téléphone uniquement. Elles sont
exclues des sauvegardes Android et des transferts vers un nouvel appareil.
Vous pouvez les effacer à tout moment :

- retirer un enfant (icône corbeille dans le choix de l'enfant) efface ses
  données ;
- la déconnexion efface tous les comptes et leurs données ;
- « Supprimer la clé » (Réglages de la révision IA) efface la clé API ;
- désinstaller l'application efface tout.

Les données détenues par Pronote relèvent de l'établissement scolaire ; celles
éventuellement conservées par un fournisseur d'IA relèvent de votre compte
chez lui.

## Enfants et élèves

L'application s'adresse aux parents et aux élèves qui disposent d'un compte
Pronote, y compris des collégiens de moins de 13 ans. Elle est conçue pour
eux :

- le développeur ne collecte aucune donnée, quel que soit l'âge de
  l'utilisateur ; il n'y a ni publicité, ni traceur, ni identifiant
  publicitaire, ni géolocalisation ;
- les données scolaires ne sont échangées qu'avec le serveur Pronote de
  l'établissement, qui en est responsable ;
- la révision par IA ne fonctionne qu'avec une clé API créée par un adulte
  (les fournisseurs l'exigent), qui confirme dans l'application être le
  titulaire du compte et, si un enfant l'utilise, son parent ou tuteur qui
  l'y autorise. Le texte envoyé ne contient aucune donnée personnelle de
  l'élève (ni nom, ni notes, ni identifiant).

## Vos droits

Le développeur ne détenant aucune donnée vous concernant, il n'a rien à vous
communiquer, rectifier ou supprimer : tout se trouve sur votre téléphone,
sous votre contrôle. Pour les données détenues par l'établissement (Pronote),
adressez-vous à lui.

## Modifications

Toute modification de cette politique sera publiée à cette adresse, avec sa
date de mise à jour.

## Contact

vitaschola@gmail.com
