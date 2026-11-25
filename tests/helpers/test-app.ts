import { createApp } from "../../src/app.js";
import type { Config } from "../../src/config.js";
import { createContainer } from "../../src/container.js";
import { InMemoryUserRepository } from "../fakes/in-memory-user.repository.js";

// Pas de .env ni de base pour les tests : configuration écrite en dur
export const testConfig: Config = {
  PORT: 0,
  DATABASE_URL: "file::memory:",
  JWT_SECRET: "secret-de-test-assez-long",
  JWT_EXPIRES_IN: "1h",
  CORS_ORIGIN: "http://localhost:5173",
};

export function buildTestApp() {
  const users = new InMemoryUserRepository();
  const app = createApp(createContainer(testConfig, { users }));
  return { app, users };
}