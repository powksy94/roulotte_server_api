import type { PrismaClient } from "../../generated/prisma/client.js";
import type { HealthRepository } from "./health.repository.js";

export class PrismaHealthRepository implements HealthRepository {
    constructor(private readonly prisma: PrismaClient) {}

    async isDatabaseUp() {
        try {
            await this.prisma.$queryRaw`SELECT 1`;
            return true;
        } catch {
            return false;
        }
    }
}