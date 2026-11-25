# Module d'authentification fourni — La Roulotte

Ce dossier vous est **fourni**. Vous le copiez dans votre projet, vous le branchez, et vous **ne le modifiez pas**.
Il fait toute la partie sécurité « technique » du projet ; votre travail porte sur le **contrôle d'accès** :
mettre la bonne protection sur chaque route et vérifier à qui appartient une commande.

## Ce qu'il fait pour vous

| Fonction | Détail |
|---|---|
| `POST /auth/register` | inscription d'un client (validation Zod, mot de passe haché avec bcrypt, 409 si l'email existe, 201 + `Location`) |
| `POST /auth/login` | connexion : renvoie `{ token, user }` ; même message si l'email ou le mot de passe est faux ; anti force brute (429) |
| `GET /auth/me` | le compte connecté |
| `requireAuth` | middleware : exige un jeton valide (sinon 401) et remplit `req.user = { id, role }` |
| `requireRole("STAFF", "ADMIN")` | middleware : exige l'un des rôles (401 sans jeton, 403 si le rôle ne convient pas) |
| `currentUser(req)` | dans un controller : l'utilisateur connecté |
| `installSecurity(app, { corsOrigin })` | Helmet, CORS (expose `Location` et `X-Request-Id`), parseur JSON limité à 100 ko |
| `authErrorHandler` | transforme les erreurs du module et du parseur JSON au format du contrat (`{ error: { code, message } }`) |
| `hashPassword(motDePasse)` | pour le seed : hache les mots de passe des comptes de démonstration |

Les réponses respectent `contrat/openapi.yaml` : la recette les vérifie.

## Installation

```bash
cp -r fourni/auth <votre-projet>/src/fourni/auth
npm install bcryptjs jsonwebtoken helmet cors express-rate-limit
npm install -D @types/jsonwebtoken @types/cors
```

## Branchement en 3 étapes

### 1. Un repository d'utilisateurs qui respecte `AuthUserStore`

Le module ne connaît ni Prisma ni votre base : il demande seulement trois méthodes.

```ts
interface AuthUserStore {
  findByEmail(email: string): Promise<StoredUser | null>;
  findById(id: number): Promise<StoredUser | null>;
  create(data: { email: string; name: string; passwordHash: string; role: Role }): Promise<StoredUser>;
}
// StoredUser = { id, email, name, role, passwordHash }  (des champs en plus, comme createdAt, sont acceptés)
```

Votre `UserRepository` (Prisma et mémoire) implémente ces méthodes : c'est lui que vous passez au module.

### 2. Le composition root (`container.ts`)

```ts
import { createAuth } from "./fourni/auth/index.js";

const auth = createAuth({
  users: repositories.users,
  jwtSecret: config.JWT_SECRET,      // 16 caractères au moins, lu dans .env
  jwtExpiresIn: config.JWT_EXPIRES_IN, // facultatif, "2h" par défaut
});
// … puis renvoyez `auth` avec le reste du container
```

### 3. L'application (`app.ts`)

```ts
import { authErrorHandler, installSecurity } from "./fourni/auth/index.js";

installSecurity(app, { corsOrigin: config.CORS_ORIGIN }); // AVANT les routes
app.use("/auth", container.auth.router);
// … vos routes …
app.use(authErrorHandler); // juste AVANT votre propre gestionnaire d'erreurs
app.use(errorHandler);
```

## Protéger vos routes — c'est votre travail

```ts
export function createOrderRouter(controller: OrderController, auth: Auth) {
  const router = Router();
  router.use(auth.requireAuth);                                 // tout le routeur exige une connexion
  router.post("/", controller.place);
  router.patch("/:id/status", auth.requireRole("STAFF", "ADMIN"), controller.updateStatus);
  return router;
}
```

```ts
// Dans un controller
const user = currentUser(req); // { id, role }
const order = await this.orders.getFor(user, Number(req.params.id));
```

Ce que le module **ne fait pas** et que vous devez faire :

- choisir, pour chaque route du contrat, si elle est publique, réservée aux connectés ou à un rôle ;
- vérifier dans le **service** qu'un client ne lit, ne paie ni n'annule que **ses** commandes (404 sinon, pour ne pas révéler qu'elles existent) ;
- ne jamais renvoyer `passwordHash` : vos DTO de sortie ne contiennent que les champs du contrat ;
- valider toutes vos entrées avec des schémas `strictObject`.

## Le seed

```ts
import { hashPassword } from "../src/fourni/auth/index.js";

await prisma.user.create({
  data: { email: u.email, name: u.name, role: u.role, passwordHash: await hashPassword(u.password) },
});
```

## Dans les tests

`createAuth` fonctionne avec votre repository mémoire : pour un test Supertest, construisez l'application
avec les repositories mémoire, inscrivez-vous ou connectez-vous via `/auth`, puis envoyez
`Authorization: Bearer <token>`.

## Règles

- Ne modifiez aucun fichier de ce dossier. Une évolution nécessaire ? Demandez au formateur.
- Ne réécrivez pas de routes `/auth` à côté : celles du module suffisent.
- Le secret JWT vient de `.env`, jamais du code.
