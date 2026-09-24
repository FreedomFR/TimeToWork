# TimeToWork

Application de suivi du temps, dans l'esprit de Clockify : minuteur, entrées de temps manuelles, projets, clients et rapports — le tout conteneurisé avec Docker.

## Stack

- **Backend** : Node.js, Express, TypeScript, Prisma, PostgreSQL, JWT
- **Frontend** : React, TypeScript, Vite, Tailwind CSS, React Router
- **Infra** : Docker Compose (db + backend + frontend/nginx)

## Démarrage

```bash
cp .env.example .env
docker compose up --build
```

- Frontend : http://localhost:8080
- API : http://localhost:4000/api
- PostgreSQL : localhost:5432

Crée un compte depuis l'écran d'inscription, puis crée tes projets/clients et démarre le minuteur.

## Fonctionnalités

- Minuteur démarrer/arrêter avec description, sélection de projet et suivi en direct
- Ajout d'entrées manuelles et "continuer" une entrée passée
- Entrées de temps regroupées par jour avec total quotidien
- Gestion des projets (couleur, client associé, archivage)
- Gestion des clients
- Rapports par période avec répartition du temps par projet
- Réinitialisation du mot de passe par email ("Mot de passe oublié ?" sur l'écran de connexion)

## Réinitialisation du mot de passe

Le lien "Mot de passe oublié ?" envoie un email avec un lien de réinitialisation valable 1 heure. Pour que l'email parte réellement, configure un compte SMTP dans `.env` (voir les commentaires du fichier `.env.example`, avec un exemple pour Gmail via un mot de passe d'application).

Si `SMTP_HOST` n'est pas renseigné, aucun email n'est envoyé : le lien de réinitialisation est simplement affiché dans les logs du backend (`docker compose logs backend`), ce qui reste utilisable en local.

## Mode développeur (connexion sans mot de passe)

En passant `DEV_MODE=true` dans `.env`, l'écran de connexion affiche la liste de tous les comptes existants : un clic sur un compte connecte instantanément, sans mot de passe.

⚠️ À réserver strictement à un environnement local/dev — n'active jamais `DEV_MODE` sur une instance accessible par quelqu'un d'autre que toi, cela permet de se connecter à n'importe quel compte.

## Développement sans Docker

```bash
# Backend
cd backend
npm install
npx prisma migrate deploy
npm run dev

# Frontend
cd frontend
npm install
npm run dev
```

Nécessite une instance PostgreSQL locale et un fichier `.env` dans `backend/` avec `DATABASE_URL` et `JWT_SECRET`.

## Tests

Le projet a deux suites de tests, à lancer après avoir démarré la stack (`docker compose up -d`) :

**Backend (69 tests)** — tests d'intégration (Vitest + Supertest) qui couvrent auth, projets, clients, tags, entrées de temps et rapports, sur une base Postgres de test dédiée (`timetowork_test`, créée et migrée automatiquement) :

```bash
docker compose -f docker-compose.yml -f docker-compose.test.yml run --rm backend-test
```

**End-to-end (20 tests)** — Playwright, qui pilote un vrai navigateur contre l'application complète (inscription, connexion, minuteur, saisie manuelle, tags, projets/clients, édition en ligne, rapports, mot de passe oublié, mode DEV) :

```bash
docker compose -f docker-compose.yml -f docker-compose.test.yml build frontend-test
docker compose -f docker-compose.yml -f docker-compose.test.yml up -d frontend-test
docker compose -f docker-compose.yml -f docker-compose.test.yml run --rm e2e
```

Les tests E2E créent des comptes utilisateur jetables (email horodaté unique) dans la base de données réelle utilisée par `docker compose up` — ils n'écrivent jamais dans un compte existant, mais laissent quelques comptes/projets de test après coup. Le test du mode DEV s'auto-ignore proprement si `DEV_MODE` n'est pas activé.

Pour nettoyer ces comptes de test (`E2E User ... <e2e_...@example.com>`) de la vraie base après une session de tests E2E :

```bash
docker run --rm --network timetowork_default \
  -e DATABASE_URL="postgresql://timetowork:timetowork@db:5432/timetowork" \
  -v "$(pwd)/backend:/app" -w /app node:20-alpine \
  sh -c "apk add --no-cache openssl >/dev/null && npx tsx scripts/cleanup-e2e-users.ts"
```

**Après toute modification du code**, relance ces deux suites pour vérifier qu'aucune fonctionnalité existante n'a régressé avant d'ajouter la suivante.
