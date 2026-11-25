// Module d'authentification FOURNI — ne pas modifier.
// Routes /auth (register, login, me) et middlewares requireAuth / requireRole.
import { Router, type Request, type RequestHandler } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { z } from "zod";
import { hashPassword, signToken, verifyPassword, verifyToken, type AuthUser, type Role } from "./crypto.js";
import { AuthHttpError } from "./errors.js";

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser; // posé par requireAuth
    }
  }
}

// Ce que le module attend de VOTRE accès aux données (par exemple votre UserRepository Prisma)
export type StoredUser = { id: number; email: string; name: string; role: Role; passwordHash: string };

export interface AuthUserStore {
  findByEmail(email: string): Promise<StoredUser | null>;
  findById(id: number): Promise<StoredUser | null>;
  create(data: { email: string; name: string; passwordHash: string; role: Role }): Promise<StoredUser>;
}

export type AuthOptions = {
  users: AuthUserStore;
  jwtSecret: string; // 16 caractères au moins, lu depuis .env
  jwtExpiresIn?: string; // ex. "2h"
  loginRateLimit?: number; // échecs tolérés par (IP, email) sur 15 minutes
};

const registerSchema = z.strictObject({
  email: z.email("Email invalide").trim().toLowerCase(),
  name: z.string().trim().min(2, "2 caractères minimum").max(60, "60 caractères maximum"),
  password: z.string().min(8, "8 caractères minimum").max(72, "72 caractères maximum"),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, "Email requis"),
  password: z.string().min(1, "Mot de passe requis"),
});

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
    throw new AuthHttpError(400, "VALIDATION_ERROR", "Données invalides", details);
  }
  return result.data;
}

const toUserDto = (u: StoredUser) => ({ id: u.id, email: u.email, name: u.name, role: u.role });

export function createAuth({ users, jwtSecret, jwtExpiresIn = "2h", loginRateLimit = 5 }: AuthOptions) {
  if (!jwtSecret || jwtSecret.length < 16) throw new Error("JWT_SECRET doit faire au moins 16 caractères");

  // Sans jeton valide → 401
  const requireAuth: RequestHandler = (req, _res, next) => {
    const header = req.headers.authorization ?? "";
    if (!header.startsWith("Bearer ")) throw new AuthHttpError(401, "UNAUTHORIZED", "Authentification requise");
    req.user = verifyToken(header.slice(7).trim(), jwtSecret);
    next();
  };

  // Rôle insuffisant → 403. À placer APRÈS requireAuth.
  const requireRole =
    (...roles: Role[]): RequestHandler =>
    (req, _res, next) => {
      if (!req.user || !roles.includes(req.user.role)) throw new AuthHttpError(403, "FORBIDDEN", "Rôle insuffisant");
      next();
    };

  // Anti force brute : N échecs par couple (IP, email) en 15 min ; les succès ne comptent pas
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: loginRateLimit,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => `${ipKeyGenerator(req.ip ?? "")}|${String(req.body?.email ?? "").toLowerCase()}`,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, _res, next) =>
      next(new AuthHttpError(429, "TOO_MANY_REQUESTS", "Trop de tentatives de connexion : réessayez dans 15 minutes")),
  });

  const router = Router();

  router.post("/register", async (req, res) => {
    const { email, name, password } = parse(registerSchema, req.body);
    if (await users.findByEmail(email)) throw new AuthHttpError(409, "CONFLICT", "Cet email est déjà utilisé");
    const user = await users.create({ email, name, role: "CUSTOMER", passwordHash: await hashPassword(password) });
    res.status(201).location(`/users/${user.id}`).json(toUserDto(user));
  });

  router.post("/login", loginLimiter, async (req, res) => {
    const { email, password } = parse(loginSchema, req.body);
    const user = await users.findByEmail(email);
    // Même message dans les deux cas : on ne révèle pas si l'email existe
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new AuthHttpError(401, "UNAUTHORIZED", "Email ou mot de passe incorrect");
    }
    res.json({ token: signToken({ id: user.id, role: user.role }, jwtSecret, jwtExpiresIn), user: toUserDto(user) });
  });

  router.get("/me", requireAuth, async (req, res) => {
    const user = await users.findById(currentUser(req).id);
    if (!user) throw new AuthHttpError(401, "UNAUTHORIZED", "Compte introuvable");
    res.json(toUserDto(user));
  });

  return { router, requireAuth, requireRole };
}

export type Auth = ReturnType<typeof createAuth>;

// Dans un controller : l'utilisateur connecté (garanti par requireAuth)
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw new AuthHttpError(401, "UNAUTHORIZED", "Authentification requise");
  return req.user;
}
