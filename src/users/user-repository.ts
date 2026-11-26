import { PrismaClient, Role } from "../generated/prisma/client.js";

export interface StoredUser {
    id: number;
    email: string;
    name: string;
    role: Role;
    passwordHash: string;
}

export interface AuthUserStore {
  findByEmail(email: string): Promise<StoredUser | null>;
  findById(id: number): Promise<StoredUser | null>;
  create(data: { email: string; name: string; passwordHash: string; role: Role }): Promise<StoredUser>;
}

//1. Implementation Prisma (seul fichier à importer Prisma pour users)
export class PrismaUserRepository implements AuthUserStore {
    constructor(private readonly prisma : PrismaClient) {}

    findByEmail(email: string): Promise<StoredUser | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

    findById(id: number): Promise<StoredUser | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

    create(data: { email: string; name: string; passwordHash: string; role: Role }): Promise<StoredUser> {
    return this.prisma.user.create({ data });
  }
}

// 2. Implémentation Mémoire (utile pour vos tests unitaires / Supertest)
export class InMemoryUserRepository implements AuthUserStore {
  private users: StoredUser[] = [];
  private nextId = 1;

  async findByEmail(email: string): Promise<StoredUser | null> {
    return this.users.find((u) => u.email === email) ?? null;
  }

  async findById(id: number): Promise<StoredUser | null> {
    return this.users.find((u) => u.id === id) ?? null;
  }

  async create(data: { email: string; name: string; passwordHash: string; role: Role }): Promise<StoredUser> {
    const user: StoredUser = { id: this.nextId++, ...data };
    this.users.push(user);
    return user;
  }
}