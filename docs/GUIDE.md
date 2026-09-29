# Guide d'utilisation de TimeToWork

TimeToWork est une application de suivi du temps dans l'esprit de Clockify : on note ce sur quoi on travaille (avec un minuteur ou en saisissant des horaires), on range le temps par projet et par client, puis on l'analyse dans un calendrier, un tableau de bord et des rapports exportables.

> Les captures d'écran de ce guide montrent un compte de démonstration (« Camille Martin ») avec des données fictives. Elles sont générées automatiquement, voir [Régénérer les captures](#régénérer-les-captures).

## Sommaire

1. [Démarrer](#1-démarrer)
2. [Compte et connexion](#2-compte-et-connexion)
3. [Suivi du temps](#3-suivi-du-temps)
4. [Calendrier](#4-calendrier)
5. [Tableau de bord](#5-tableau-de-bord)
6. [Rapports et exports](#6-rapports-et-exports)
7. [Projets et clients](#7-projets-et-clients)
8. [Administration](#8-administration)
9. [Bonnes pratiques et sécurité](#9-bonnes-pratiques-et-sécurité)
10. [Dépannage](#10-dépannage)

---

## 1. Démarrer

Il faut [Docker](https://www.docker.com/) (avec Docker Compose). Depuis le dossier du projet :

```bash
cp .env.example .env
docker compose up --build
```

| Adresse | Contenu |
|---|---|
| http://localhost:8080 | L'application (à ouvrir dans le navigateur) |
| http://localhost:4000/api | L'API |
| localhost:5432 | La base PostgreSQL |

Ces trois ports ne sont ouverts **que sur votre machine** : personne d'autre sur le réseau ne peut s'y connecter.

Avant un vrai usage, ouvrez le fichier `.env` et remplacez `JWT_SECRET` par un secret aléatoire (voir [section 9](#9-bonnes-pratiques-et-sécurité)). Les autres réglages utiles :

| Variable | Rôle |
|---|---|
| `JWT_SECRET` | Signe les sessions. **À remplacer** par `openssl rand -hex 32`. |
| `DEV_MODE` | `true` = connexion rapide sans mot de passe (développement local uniquement). |
| `SMTP_HOST`, `SMTP_USER`… | Envoi des emails de réinitialisation de mot de passe (facultatif). |
| `POSTGRES_PASSWORD` | Mot de passe de la base. |

---

## 2. Compte et connexion

### Créer un compte

Sur `/register`, saisissez un nom, un email et un mot de passe de **8 à 72 caractères**. Vous êtes connecté immédiatement.

![Créer un compte](screenshots/register.png)

### Se connecter

Saisissez votre email et votre mot de passe. Après 10 mots de passe faux pour un même compte, la connexion est bloquée quelques minutes (« Trop de tentatives »).

![Connexion](screenshots/login.png)

> **Mode développeur.** Si `DEV_MODE=true`, la page de connexion affiche en plus la liste de tous les comptes : un clic sur un compte connecte sans mot de passe. Réservé à un usage strictement local.

### Mot de passe oublié

Cliquez sur « Mot de passe oublié ? », saisissez votre email : un lien de réinitialisation valable **1 heure** et utilisable **une seule fois** vous est envoyé. Le message affiché est toujours le même, que le compte existe ou non.

![Mot de passe oublié](screenshots/forgot-password.png)

Si aucun serveur email n'est configuré (`SMTP_HOST` vide), aucun email ne part : le lien apparaît dans les logs du backend.

```bash
docker compose logs backend
```

### Mon compte : apparence, email et mot de passe

Le lien « Mon compte » du menu affiche votre nom et votre email, règle l'apparence de l'application et permet de changer l'email comme le mot de passe.

**Apparence.** Deux réglages de confort, sans bouton « Enregistrer » : chaque choix s'applique tout de suite (« Réglage enregistré » s'affiche brièvement) et est **enregistré sur votre compte**. Vous le retrouvez donc sur tous vos appareils et navigateurs, et il n'affecte personne d'autre. À la déconnexion, l'écran de connexion reprend l'apparence par défaut.

![Réglages d'apparence](screenshots/appearance.png)

- **Animations** (activées par défaut) : fondu à chaque changement de page, fenêtres et menus qui apparaissent en douceur, barres et anneaux des graphiques qui se dessinent, bouton du minuteur qui pulse tant qu'il tourne, léger retour au clic. Désactivées, tout s'affiche instantanément, sans transition.
  Si votre système d'exploitation demande de **réduire les animations** (Windows : *Paramètres > Accessibilité > Effets visuels* ; macOS : *Réduire les animations*), elles restent désactivées quel que soit ce réglage, et la page le signale.
- **Taille du texte** : *Normale*, *Grande* (+12,5 %) ou *Très grande* (+25 %). Toute l'interface s'agrandit, pas seulement le texte.

Le commutateur « Animations » s'utilise aussi au clavier : Tab jusqu'à lui, puis Espace ou Entrée.

**Changer l'adresse email.** Saisissez le nouvel email **deux fois** (une faute de frappe vous empêcherait ensuite de réinitialiser votre mot de passe), puis votre **mot de passe actuel** : l'email sert à se connecter et à recevoir les liens de réinitialisation, donc celui ou celle qui le contrôle contrôle le compte. Une fois validé :

- vous vous connectez désormais avec la nouvelle adresse (l'ancienne ne fonctionne plus et peut être utilisée par quelqu'un d'autre) ;
- votre session reste ouverte, et le menu affiche la nouvelle adresse tout de suite ;
- l'**ancienne adresse reçoit un email d'information** (sans SMTP, il apparaît seulement dans les logs du backend) : si le changement n'est pas de vous, c'est ainsi que vous le découvrez ;
- un lien de réinitialisation demandé avant le changement est annulé ;
- l'adresse doit être différente de l'actuelle et ne pas déjà appartenir à un autre compte (majuscules et minuscules comptent pareil).

**Changer le mot de passe.** Saisissez l'actuel, puis le nouveau (8 caractères minimum, différent de l'actuel) deux fois.

![Mon compte](screenshots/account.png)

---

## 3. Suivi du temps

C'est la page d'accueil. En haut, la barre de saisie ; dessous, votre historique rangé par semaine, puis par jour.

![Suivi du temps](screenshots/tracker.png)

### La barre de saisie

De gauche à droite : la description, le **projet**, les **balises** (tags), le bouton **$** (facturable), puis les horaires. Le bouton tout à droite (icône liste ou chronomètre) bascule entre les deux modes.

**Mode saisie manuelle** (par défaut) — pour noter du temps déjà passé :

- **Début** et **fin** se tapent librement : `0800`, `8h30`, `8:00` ou `8` sont tous compris et remis au format `08:00`.
- Le bouton calendrier change la **date** (aujourd'hui par défaut).
- Le champ **durée** se tape aussi (`1:30` ou `90` pour 90 minutes) : c'est la fin qui se déplace, le début reste.
- **AJOUTER** enregistre l'entrée.

**Tâches récentes.** Un clic dans la description propose vos 5 dernières tâches ; en choisir une reprend sa description et son projet.

![Tâches récentes](screenshots/tracker-suggestions.png)

**Projet et balises.** Le bouton « Projet » liste vos projets (avec leur client). Les balises se cherchent ou se créent à la volée (Entrée).

![Choix du projet](screenshots/tracker-project-picker.png)

### Le minuteur

Basculez en mode minuteur, décrivez la tâche, choisissez le projet, puis **DÉMARRER**. Le compteur tourne ; **ARRÊTER** enregistre l'entrée.

![Minuteur en cours](screenshots/tracker-timer.png)

- Un seul minuteur à la fois : en démarrer un autre arrête le précédent.
- Le minuteur survit à un rechargement de la page ; le bouton de changement de mode est verrouillé pendant qu'il tourne.

### L'historique

Chaque ligne affiche la description, le projet et son client, le signe **$** si facturable, les balises, les horaires et la durée. À droite, **▶ Continuer** relance un minuteur identique (même description, projet, balises), et le menu **⋮** permet de supprimer.

Les entrées identiques d'une même journée (même description, projet, balises et facturable) sont regroupées sur une ligne avec un compteur (ici « 4 ») ; un clic la déplie.

### Modifier une entrée

Cliquez sur une ligne pour ouvrir l'éditeur : description, projet, balises, facturable, heures, date et durée se modifient directement, chaque changement est enregistré à l'instant.

![Édition d'une entrée](screenshots/tracker-edit.png)

### Fusionner des créneaux

Une même mission est parfois coupée en plusieurs morceaux (8:45–10:00 puis 10:00–12:00). Dépliez le groupe, ouvrez le menu **⋮** d'une ligne et choisissez **Fusionner avec le créneau précédent** (ou **suivant**).

![Fusionner deux créneaux](screenshots/tracker-merge.png)

- Le menu ⋮ de la **ligne du groupe** propose « Fusionner les créneaux consécutifs » : toutes les suites sans pause sont fusionnées d'un coup.
- Ne sont fusionnables que des créneaux **de la même mission** (mêmes description, projet, balises, facturable) **sans pause** (1 minute au plus). Une pause déjeuner ou une autre mission ne se fusionne jamais : le temps total ne change donc jamais.

---

## 4. Calendrier

Vos entrées dessinées sur une grille horaire : chacune est placée à son **heure réelle** et sa hauteur est proportionnelle à sa **durée**.

![Calendrier, vue semaine](screenshots/calendar-week.png)

- **Semaine / Jour** : le bouton en haut à gauche change de vue ; les flèches ‹ › avancent d'une semaine ou d'un jour.
- **− / +** (en haut à gauche de la grille) zooment de 30 à 120 pixels par heure.
- Chaque colonne indique son **total** ; les week-ends sont plus sombres ; une ligne rouge marque l'heure actuelle sur la journée du jour.
- Deux entrées qui se chevauchent sont placées côte à côte.

![Calendrier, vue jour](screenshots/calendar-day.png)

### Modifier un créneau

Un clic sur un bloc ouvre **Modifier le créneau** : durée, début, fin, date, description, projet et balises. Le menu **⋮** en bas à gauche supprime l'entrée ; **Annuler**, la croix ou la touche Échap ferment sans rien enregistrer.

![Modifier un créneau](screenshots/calendar-edit.png)

- La fin doit être après le début (sinon **Enregistrer** est grisé).
- Le menu des balises se superpose au dialogue ; Échap le referme sans fermer le dialogue.
- Un créneau **en cours** (minuteur actif) n'a que son heure de début modifiable.

---

## 5. Tableau de bord

La synthèse d'une période (cette semaine par défaut ; ici « Semaine dernière »).

![Tableau de bord](screenshots/dashboard.png)

- **Bandeau du haut** : temps total, projet principal et client principal de la période.
- **Histogramme** : une barre par jour, empilée par projet, avec la durée au-dessus. Sur une période longue (plus de 62 jours), une barre par mois.
- **Donut et liste** : la répartition du temps par projet, avec les pourcentages.
- **Activités les plus suivies** (à droite) : les entrées de même description et même projet sont additionnées puis classées. Le menu permet d'afficher les 5, 10 ou 20 meilleures.
- Le sélecteur de période propose les périodes usuelles et une **plage personnalisée**.

---

## 6. Rapports et exports

Le menu **Rapports** a quatre onglets (le quatrième, « Partagé », n'est pas encore disponible). Tous partagent la période, les filtres et l'interrupteur **Arrondi** (durées arrondies au quart d'heure).

### Résumé

![Rapport : résumé](screenshots/reports-summary.png)

Un histogramme par jour, puis la liste des projets avec leur durée et leur nombre d'entrées. Un clic sur une ligne détaille ses entrées. Le bouton **Regrouper par** bascule entre **Projet** et **Description**.

### Choisir la période

Le sélecteur propose Aujourd'hui, Hier, Cette semaine, Semaine dernière, Ce mois-ci, Mois dernier, Cette année, et **Plage personnalisée…** pour deux dates au choix. Les flèches ‹ › décalent la période.

![Périodes proposées](screenshots/reports-period.png)

![Plage personnalisée](screenshots/reports-custom-range.png)

### Filtres

**Client**, **Projet**, **Balise** (choix multiples) et **Description** (texte contenu) restreignent tout le rapport, le total et l'export compris. Les filtres s'appliquent dès qu'on les change.

![Filtre par projet](screenshots/reports-filter.png)

### Détaillé

Une ligne par entrée, de la plus récente à la plus ancienne. Cochez des lignes pour les **supprimer en masse**, ajoutez des balises directement, ou utilisez le menu ⋮ (continuer, supprimer).

![Rapport : détaillé](screenshots/reports-detailed.png)

### Hebdomadaire

Exactement **une semaine** (du lundi au dimanche) : une ligne par projet, client ou description (au choix, via « Regrouper par »), une colonne par jour, et les totaux par ligne et par jour. Les flèches changent de semaine.

![Rapport : hebdomadaire](screenshots/reports-weekly.png)

### Exporter

Le bouton **EXPORTATION** ouvre la fenêtre d'export.

![Exporter le rapport](screenshots/reports-export.png)

1. **Contenu** : *Détaillé* (une ligne par entrée), *Résumé par projet* ou *Résumé par jour*.
2. **Colonnes** (pour le détaillé) : date, début, fin, durée, heures décimales, projet, client, description, balises, facturable, utilisateur. **Tout** / **Aucune** en un clic.
3. **Format** : **CSV**, **Excel (.xlsx)**, **PDF** (ouvre l'impression du navigateur : choisissez « Enregistrer au format PDF ») ou **JSON**.

Le fichier reprend la période et les filtres affichés, et s'appelle par exemple `rapport-detaille_2026-09-01_2026-09-30.csv`. Les cellules CSV commençant par `=`, `+`, `-` ou `@` sont neutralisées pour qu'Excel ne les exécute pas comme des formules.

---

## 7. Projets et clients

### Projets

Un projet a un **nom**, une **couleur** et, si vous le souhaitez, un **client**. La couleur se retrouve partout : calendrier, graphiques, listes.

![Projets](screenshots/projects.png)

- **Créer** : nom, client, couleur, **+ Ajouter**.
- **Modifier** : cliquez sur la ligne pour ouvrir l'éditeur (nom, client, couleur ; chaque changement est enregistré).
- **Archiver / Réactiver** : le projet reste visible mais barré.
- **Supprimer** : les entrées déjà saisies sont conservées, simplement sans projet.

### Clients

Même principe : on crée, renomme, archive ou supprime un client. Supprimer un client ne supprime pas ses projets ; ils n'ont simplement plus de client.

![Clients](screenshots/clients.png)

---

## 8. Administration

Un compte peut avoir le rôle **administrateur**. Le lien **Administration** (icône 🛡) apparaît alors en bas du menu ; les autres utilisateurs ne le voient pas, et le serveur refuse leurs appels.

### Créer le premier administrateur

Personne n'est administrateur au départ, et l'application ne permet volontairement pas de se promouvoir soi-même. Le premier se crée en ligne de commande, avec l'email d'un compte existant :

```bash
docker run --rm --network timetowork_default \
  -e DATABASE_URL="postgresql://timetowork:timetowork@db:5432/timetowork" \
  -v "$(pwd)/backend:/app" -w /app node:20-alpine \
  sh -c "apk add --no-cache openssl >/dev/null && npx tsx scripts/set-admin.ts vous@example.com"
```

Ajoutez `--revoke` après l'email pour retirer le rôle. Ensuite, les administrateurs se gèrent depuis la page.

### Onglet Utilisateurs

![Administration : utilisateurs](screenshots/admin-users.png)

La liste de tous les comptes, avec leur rôle, leur nombre d'entrées et leur date d'inscription ; la recherche filtre par nom ou email. À droite de chaque ligne, un bouton donne ou retire le rôle, **après confirmation** :

![Confirmer une promotion](screenshots/admin-promote.png)

- Le **dernier administrateur ne peut pas être rétrogradé** : l'application ne se retrouve jamais sans personne pour gérer les rôles.
- Un administrateur peut se retirer son propre rôle tant qu'un autre existe ; il perd alors l'accès à la page immédiatement.
- Retirer le rôle prend effet **tout de suite**, même pour quelqu'un déjà connecté.

### Onglet Journaux

Le journal de l'application : ce qui s'est mal passé, et qui a fait quoi.

![Administration : journaux](screenshots/admin-logs.png)

Ce qui est enregistré, par **type** :

| Type | Quand |
|---|---|
| Erreur serveur | Une erreur inattendue dans l'API, avec sa trace |
| Erreur navigateur | Une erreur JavaScript survenue sur l'écran d'un utilisateur, remontée automatiquement |
| Échec d'authentification | Mauvais mot de passe, lien de réinitialisation invalide |
| Limite atteinte | Trop de tentatives (blocage temporaire) |
| Accès refusé | Un utilisateur a tenté une action réservée aux administrateurs |
| Données invalides | L'API a refusé des données (on garde le champ concerné, jamais la valeur) |
| Action d'administration | Un changement de rôle : qui l'a fait et pour qui |
| Compte créé | Une inscription (le nom et l'email utilisés) |
| Connexion | Chaque connexion réussie ; une connexion rapide sans mot de passe (`DEV_MODE`) est signalée comme avertissement |
| Déconnexion | Un utilisateur qui se déconnecte |
| Demande de réinitialisation | Quelqu'un a demandé un lien de réinitialisation. Le journal précise si le compte existe (avertissement s'il n'existe pas), alors que le visiteur, lui, reçoit toujours la même réponse |
| Mot de passe réinitialisé | Le lien de réinitialisation a été utilisé |
| Mot de passe modifié | Un utilisateur a changé son mot de passe depuis « Mon compte » |
| Email modifié | Un utilisateur a changé l'adresse de son compte : l'ancienne et la nouvelle adresse sont notées dans les détails |

Une inscription refusée parce que l'email est déjà pris apparaît comme un « Échec d'authentification ».

Chaque ligne a aussi un **niveau** : Erreur, Avertissement ou Info.

**Informations conservées.** Pour chaque événement d'un compte, le journal garde la personne (nom et email), la date, l'**adresse IP** et le **navigateur** utilisés. Un clic sur la ligne les affiche :

![Une inscription dans le journal](screenshots/admin-logs-account.png)

- Jamais de mot de passe, ni de lien de réinitialisation.
- L'adresse IP et le navigateur sont des données personnelles : elles suivent la même durée de conservation que la ligne (30 jours par défaut).
- Derrière Docker Desktop, ou derrière un reverse proxy, toutes les requêtes peuvent sembler venir de la même adresse (celle de Docker ou du proxy). Si l'API est placée derrière un reverse proxy, renseignez `TRUST_PROXY` dans le `.env` (nombre de proxys, ou `true`) pour voir l'adresse réelle des visiteurs ; ne le renseignez pas si l'API est jointe directement, l'en-tête pourrait alors être falsifié.
- La recherche texte porte aussi sur l'adresse IP et le navigateur.

**Trouver ce qu'on cherche**

- **Compteurs** en haut : le nombre d'entrées de chaque type ; un clic filtre sur ce type (un second clic retire le filtre).
- **Filtres** : par **personne**, par **type**, par **niveau**, par **période** (Du / Au) et par **texte** (message, route, email, détails). Ils se combinent ; « Réinitialiser » les efface.
- **Tri** : cliquez sur l'en-tête **Date**, **Niveau**, **Type** ou **Personne** pour trier ; un second clic inverse l'ordre.
- **Pagination** : 25, 50 ou 100 lignes par page. **Actualiser** recharge.

Un clic sur une ligne affiche ses **détails**, par exemple la trace d'une erreur :

![Détails d'une entrée du journal](screenshots/admin-logs-details.png)

**À savoir**

- Le journal ne contient **jamais** de mot de passe, de jeton ni le contenu des requêtes.
- Les entrées de plus de **30 jours** sont supprimées automatiquement (`LOG_RETENTION_DAYS` pour changer la durée).
- Si un compte est supprimé, ses lignes restent, identifiées par son email.

---

## 9. Bonnes pratiques et sécurité

- **Changez `JWT_SECRET`.** C'est le secret qui signe les sessions : avec la valeur d'exemple, n'importe qui connaissant le projet peut fabriquer une session valide. Générez-en un :

  ```bash
  openssl rand -hex 32
  ```

  Collez le résultat dans `.env` puis relancez le backend (`docker compose up -d backend`). Tout le monde est déconnecté une fois. Avec `DEV_MODE=false`, le serveur refuse même de démarrer sur un secret faible.
- **`DEV_MODE=true` uniquement en local.** Cette option permet de se connecter à n'importe quel compte sans mot de passe.
- **Ne publiez pas les ports** de la base et de l'API sur Internet : le fichier `docker-compose.yml` les limite volontairement à `127.0.0.1`.
- **Vos données sont sauvegardées automatiquement** (voir [Sauvegardes de la base](#sauvegardes-de-la-base) ci-dessous) : pensez surtout à en copier une de temps en temps **hors de cette machine**.
- **Mots de passe** : 8 à 72 caractères. Les sessions durent 30 jours ; se déconnecter n'invalide pas un jeton volé, changez de `JWT_SECRET` en cas de doute.

Détail des protections en place (isolation des données, limitation des tentatives, en-têtes, etc.) : section « Sécurité » du [README](../README.md).

### Sauvegardes de la base

Un service `backup` démarre avec le reste (`docker compose up`) et copie la base dans le dossier **`backups/`** du projet, à intervalle régulier. Il n'y a rien à lancer.

- **Fréquence** : tous les jours par défaut. Réglable dans `.env` (en minutes) : `BACKUP_INTERVAL_MINUTES=360` pour toutes les 6 heures, `60` pour toutes les heures.
- **Une sauvegarde au démarrage**, puis à chaque intervalle. Redémarrer la pile n'en ajoute pas à chaque fois : le service attend ce qui reste de l'intervalle.
- **Rotation** : les sauvegardes de plus de 14 jours sont supprimées (`BACKUP_KEEP_DAYS`), mais les 3 plus récentes sont toujours gardées quel que soit leur âge (`BACKUP_KEEP_MIN`), pour ne jamais se retrouver sans sauvegarde si le service s'arrête un moment.
- **Fichiers** : `timetowork_AAAAMMJJ_HHMMSS.dump` (heure UTC), compressés. Chaque fichier est vérifié avant d'être gardé ; un fichier vide ou illisible est écarté.
- **Suivi** : `docker compose ps` montre l'état du service ; il passe à *unhealthy* s'il n'y a plus de sauvegarde récente (base arrêtée, disque plein…). Le détail est dans les logs :

  ```bash
  docker compose logs backup
  ```

**Copie sur un autre disque.** Une sauvegarde à côté de la base ne survit pas à la panne du disque. Pour que chaque sauvegarde soit aussi copiée ailleurs (clé USB, disque externe, partage réseau/NAS, dossier synchronisé OneDrive…), indiquez le dossier dans `.env` (il doit exister ; slashs `/` même sous Windows) :

```bash
BACKUP_COPY_PATH=D:/Sauvegardes/TimeToWork
```

puis relancez le service : `docker compose up -d backup`. La copie a le même nom, la même date et la même rotation que l'original. Si le dossier est inaccessible (disque débranché), la sauvegarde principale est quand même faite, les copies manquées sont rattrapées dès que le dossier revient, et le service passe à *unhealthy* tant que la copie n'est pas à jour. Sans `BACKUP_COPY_PATH`, il n'y a pas de copie.

Commandes utiles :

```bash
# Faire une sauvegarde tout de suite
docker compose run --rm backup once

# Lister les sauvegardes
docker compose run --rm backup list
```

**Restaurer une sauvegarde.** Arrêtez d'abord le backend, restaurez, puis relancez-le :

```bash
docker compose stop backend
docker compose run --rm backup restore timetowork_20260928_131733.dump
docker compose start backend
```

La base actuelle est **d'abord copiée** dans `backups/pre-restore_….dump` (jamais supprimée automatiquement) : une restauration peut donc elle-même être annulée. Pour examiner une sauvegarde sans toucher à la vraie base, restaurez-la dans une base de test : `docker compose run --rm backup restore <fichier> nom_de_la_base_de_test`.

**À savoir**

- Les sauvegardes contiennent **toutes les données** : mots de passe hachés, adresses email, journal. Le dossier `backups/` est exclu de git ; gardez-le privé et ne le partagez pas.
- Elles ne sont **pas chiffrées** et se trouvent sur le même disque que la base : elles protègent d'une erreur de manipulation, d'un volume Docker supprimé ou d'une mise à jour ratée, pas d'une panne du disque, sauf si vous avez activé la copie sur un autre disque (`BACKUP_COPY_PATH`, ci-dessus). Si ce dossier est dans le cloud, sachez que les fichiers y partent en clair.
- Le service a ses propres tests (`docker compose run --rm --entrypoint /bin/sh backup /scripts/test.sh`) : sauvegarde, restauration, rotation, échecs et contrôle de santé, sur des bases jetables.


---

## 10. Dépannage

| Problème | Solution |
|---|---|
| **Je suis déconnecté après un redémarrage** | Le `JWT_SECRET` a changé : reconnectez-vous. |
| **Je ne vois pas « Administration »** | Votre compte n'est pas administrateur (voir [section 8](#créer-le-premier-administrateur)), ou l'application n'est pas à jour : `docker compose build frontend && docker compose up -d frontend`, puis `Ctrl+F5`. |
| **« Trop de tentatives »** | Trop de mots de passe faux ou de demandes de réinitialisation : attendez 15 minutes (1 heure pour les emails de réinitialisation). |
| **Je ne reçois pas l'email de réinitialisation** | Vérifiez la configuration `SMTP_*` du `.env`. Sans SMTP, le lien est dans `docker compose logs backend`. |
| **Impossible d'ouvrir http://localhost:8080** | Vérifiez que les conteneurs tournent (`docker compose ps`). Les ports ne sont accessibles que depuis votre machine. |
| **Le service `backup` est « unhealthy »** | Aucune sauvegarde récente : regardez `docker compose logs backup` (base arrêtée ? disque plein ? dossier `backups/` non accessible ?). Une sauvegarde manuelle : `docker compose run --rm backup once`. |
| **Une page affiche « Une erreur est survenue »** | L'incident est signalé dans le journal (type « Erreur navigateur ») ; rechargez la page. |

### Lancer les tests

```bash
# Backend (base de test dédiée)
docker compose -f docker-compose.yml -f docker-compose.test.yml run --rm backend-test

# Bout en bout (un vrai navigateur)
docker compose -f docker-compose.yml -f docker-compose.test.yml build frontend-test
docker compose -f docker-compose.yml -f docker-compose.test.yml up -d frontend-test
docker compose -f docker-compose.yml -f docker-compose.test.yml run --rm e2e
```

### Régénérer les captures

Les images de ce guide sont produites par un script qui crée des comptes de démonstration (préfixe `e2e_docs_`, supprimés par le script de nettoyage des tests) et parcourt chaque écran. À relancer quand l'interface change :

```bash
docker compose -f docker-compose.yml -f docker-compose.test.yml build frontend-test
docker compose -f docker-compose.yml -f docker-compose.test.yml up -d frontend-test
docker compose -f docker-compose.yml -f docker-compose.test.yml run --rm e2e \
  sh -c "npm install && npm run docs:screenshots"
```

Les images sont écrites dans `docs/screenshots/`.
