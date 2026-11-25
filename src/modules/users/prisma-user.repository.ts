import type { PrismaClient } from "../../generated/prisma/client.js";
import type { Role } from "../../fourni/auth/index.js";
import type { UserRepository } from "./user.repository.js";

// Seul endroit du module users qui parle à Prisma (DAO)
export class PrismaUserRepository implements UserRepository {
    constructor(private readonly prisma: PrismaClient) {}

    findByEmail(email: string) {
        return this.prisma.user.findUnique({ where: { email } });
    }

    findById(id: number) {
        return this.prisma.user.findUnique({ where: { id } });
    }

    create(data: { email: string; name: string; passwordHash: string; role: Role }) {
        return this.prisma.user.create({ data });
    }
}