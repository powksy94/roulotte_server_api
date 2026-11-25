import type { Role, StoredUser } from "../../src/fourni/auth/index.js";
import type { UserRepository } from "../../src/modules/users/user.repository.js";

// Même interface que le repository Prisma, sans base : tests rapides et isolés
export class InMemoryUserRepository implements UserRepository {
  private users: StoredUser[] = [];
  private nextId = 1;

  async findByEmail(email: string) {
    return this.users.find((u) => u.email === email) ?? null;
  }

  async findById(id: number) {
    return this.users.find((u) => u.id === id) ?? null;
  }

  async create(data: { email: string; name: string; passwordHash: string; role: Role }) {
    const user = { id: this.nextId++, ...data };
    this.users.push(user);
    return user;
  }
}