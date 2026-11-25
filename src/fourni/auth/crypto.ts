// Module d'authentification FOURNI — ne pas modifier.
// Mots de passe (bcrypt) et jetons (JWT).
import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { AuthHttpError } from "./errors.js";

export type Role = "CUSTOMER" | "STAFF" | "ADMIN";

// Ce que le jeton transporte, et ce que req.user contient
export type AuthUser = { id: number; role: Role };

// Hash lent et salé ; version asynchrone pour ne pas bloquer l'event loop
export function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

export function signToken(user: AuthUser, secret: string, expiresIn: string) {
  return jwt.sign({ sub: String(user.id), role: user.role }, secret, {
    expiresIn: expiresIn as SignOptions["expiresIn"],
  });
}

export function verifyToken(token: string, secret: string): AuthUser {
  try {
    const claims = jwt.verify(token, secret, { algorithms: ["HS256"] }) as jwt.JwtPayload;
    return { id: Number(claims.sub), role: claims.role as Role };
  } catch {
    throw new AuthHttpError(401, "UNAUTHORIZED", "Jeton invalide ou expiré");
  }
}
