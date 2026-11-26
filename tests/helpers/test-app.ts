import type { Express } from "express";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { hashPassword, type Role } from "../../src/fourni/auth/index.js";
import type { Config } from "../../src/config.js";
import { createContainer } from "../../src/container.js";
import type { Dish } from "../../src/modules/menu/menu.repository.js";
import { InMemoryMenuRepository } from "../fakes/in-memory-menu.repository.js";
import { InMemoryUserRepository } from "../fakes/in-memory-user.repository.js";
import { InMemoryOrderRepository } from "../fakes/in-memory-order.repository.js";

export const testConfig: Config = {
  PORT: 0,
  DATABASE_URL: "file::memory:",
  JWT_SECRET: "secret-de-test-assez-long",
  JWT_EXPIRES_IN: "1h",
  CORS_ORIGIN: "http://localhost:5173",
};

// Une petite carte de test
export const burgers = { id: 1, name: "Burgers", position: 1 };
export const boissons = { id: 2, name: "Boissons", position: 2 };

export const dish = (id: number, name: string, overrides: Partial<Dish> = {}): Dish => ({
  id,
  name,
  description: "",
  priceCents: 1000,
  available: true,
  category: { id: burgers.id, name: burgers.name },
  allergens: [],
  ...overrides,
});

export const testDishes: Dish[] = [
  dish(1, "Le Classique", { allergens: [{ code: "gluten", label: "Gluten" }] }),
  dish(2, "Frites maison", { priceCents: 400 }),
  dish(3, "Le Burger du mois", { available: false }),
  dish(4, "Citronnade", { priceCents: 350, category: { id: boissons.id, name: boissons.name } }),
];

export function buildTestApp() {
  const users = new InMemoryUserRepository();
  const menu = new InMemoryMenuRepository(
    [boissons, burgers],
    [{ id: 1, code: "lait", label: "Lait" }, { id: 2, code: "gluten", label: "Gluten" }],
    testDishes,
  );
  const orders = new InMemoryOrderRepository(users, menu);
  const app = createApp(createContainer(testConfig, { users, menu, orders }));
  return { app, users, menu, orders };
}

// Crée un compte avec le rôle voulu et renvoie son jeton (l'inscription publique ne donne que CUSTOMER)
let accountCounter = 0;
export async function loginAs(app: Express, users: InMemoryUserRepository, role: Role) {
  const email = `${role.toLowerCase()}-${++accountCounter}@test.fr`;
  const password = "MotDePasse1!";
  const user = await users.create({ email, name: `Compte ${role}`, role, passwordHash: await hashPassword(password) });
  const res = await request(app).post("/auth/login").send({ email, password });
  return { token: res.body.token as string, user };
}