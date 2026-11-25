# La Roulotte — API

API de click & collect du food truck La Roulotte : carte, comptes, commandes.
Stack : Node.js 22+, TypeScript strict, Express 5, Prisma 7 (SQLite), Zod, Vitest, Supertest.

## Prérequis

- **Node.js 22 ou plus** : vérifier avec `node -v`
- **Git**
- Le **kit du projet** (`la-roulotte-kit`) dans un dossier à part : il contient le front, la recette et le simulateur de paiement

## Installation

```powershell
git clone https://github.com/powksy94/roulotte_server_api.git la-roulotte-api
cd la-roulotte-api
npm ci                          # installe les versions exactes du package-lock.json
Copy-Item .env.example .env     # (bash : cp .env.example .env)
npx prisma generate             # génère le client Prisma dans src/generated/prisma
npx prisma migrate deploy       # crée dev.db et applique les migrations
npm run seed                    # charge la carte et les 3 comptes de démonstration
npm run dev                     # http://localhost:3000
```

Vérification :

```powershell
curl.exe http://localhost:3000/health    # → {"status":"ok"}
```

### Le fichier `.env`

Le `.env` n'est jamais commité : chacun a le sien, créé à partir de `.env.example`.
Remplace `JWT_SECRET` par une vraie valeur aléatoire (16 caractères au moins, sinon l'API refuse de démarrer) :

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

| Variable | Rôle | Valeur par défaut |
|---|---|---|
| `PORT` | Port HTTP de l'API | `3000` |
| `DATABASE_URL` | Fichier SQLite | `file:./dev.db` |
| `JWT_SECRET` | Secret de signature des jetons | à générer |
| `JWT_EXPIRES_IN` | Durée de validité des jetons | `2h` |
| `CORS_ORIGIN` | Origine autorisée (le front) | `http://localhost:5173` |

## Scripts

| Commande | Effet |
|---|---|
| `npm run dev` | Lance l'API et la relance à chaque modification |
| `npm start` | Lance l'API sans rechargement |
| `npm run seed` | Vide la base et recharge `donnees/menu.json` |
| `npm test` | Lance nos tests (Vitest + Supertest), sans avoir besoin de l'API |
| `npm run typecheck` | Vérifie les types TypeScript |

## Travailler avec le kit

Dans un **second terminal**, depuis le dossier `la-roulotte-kit` (l'API doit tourner) :

```powershell
npm run front          # le front sur http://localhost:5173
npm run recette:1      # recette du palier 1 (recette:2, :3, :4 pour les suivants)
npm run paiement       # simulateur de paiement, palier 4 seulement
```

La recette crée des comptes, des plats et des commandes : relance `npm run seed` pour repartir d'une base propre.

### Comptes de démonstration

| Email | Mot de passe | Rôle |
|---|---|---|
| admin@roulotte.test | Admin123! | ADMIN |
| cuisine@roulotte.test | Cuisine123! | STAFF |
| client@roulotte.test | Client123! | CUSTOMER |

## Au quotidien

Après un `git pull` qui touche aux dépendances ou au schéma Prisma :

```powershell
npm ci
npx prisma generate
npx prisma migrate deploy
```

Pour **modifier le schéma** (`prisma/schema.prisma`) :

```powershell
npx prisma migrate dev --name <nom-explicite>   # ex. : stock, image-url, payment-status
npx prisma generate                             # Prisma 7 ne le fait plus automatiquement
```

On commite le dossier `prisma/migrations/` créé : l'historique des migrations fait partie du rendu.
Ne jamais modifier une migration déjà poussée, en créer une nouvelle.

Pour repartir de zéro (supprime toutes les données) :

```powershell
npx prisma migrate reset    # recrée la base et réapplique les migrations
npm run seed
```

## Problèmes fréquents

| Symptôme | Cause et solution |
|---|---|
| `Cannot find module '../generated/prisma/client.js'` | Le client Prisma n'est pas généré : `npx prisma generate` |
| `/health` répond autre chose que `{"status":"ok"}`, ou `EADDRINUSE` au démarrage | Une autre application occupe le port 3000. La trouver : `Get-NetTCPConnection -LocalPort 3000 -State Listen` puis l'arrêter, ou changer `PORT` dans `.env` |
| L'API refuse de démarrer : « Configuration invalide » | Une variable manque ou est invalide dans `.env` (souvent `JWT_SECRET` trop court) |
| Le front affiche « API injoignable » | L'API ne tourne pas, ou `CORS_ORIGIN` ne vaut pas `http://localhost:5173` |
| `prisma` en version 8 après une installation | Toujours installer avec `npm ci` : le projet est figé sur **Prisma 7.10.1**. Ne pas lancer `npm install prisma` sans version |
| Le seed échoue sur une contrainte unique | La base contient déjà des données de la recette : `npx prisma migrate reset` puis `npm run seed` |

## Règles du projet

- Les fichiers fournis par le kit ne se modifient pas : `src/fourni/auth/` et `donnees/menu.json`.
- Ne jamais commiter : `.env`, `*.db`, `node_modules/`, `src/generated/`, `uploads/` (déjà dans le `.gitignore`).
- Architecture : routes → controller → service → repository. Pas de `req`/`res` dans un service, pas de Prisma hors des repositories.
- Un tag par palier atteint : `git tag palier-1` puis `git push --tags`.
