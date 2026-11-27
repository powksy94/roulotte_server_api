// DAO : l'état de la base, sans que le reste de l'application connaisse Prisma
export interface HealthRepository {
    isDatabaseUp(): Promise<boolean>;
}