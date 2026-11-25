import { z } from "zod";

export const paginationShape = {
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
};

export type Pagination = { page: number; pageSize: number };

export type Page<T> = { items: T[]; total: number; page: number; pageSize: number };

// Pour Prisma : findMany({ ...toSkipTake(p) })
export const toSkipTake = ({ page, pageSize }: Pagination) => ({ skip: (page - 1) * pageSize, take: pageSize });

export const toPage = <T>(items: T[], total: number, { page, pageSize }: Pagination): Page<T> => ({
    items,
    total,
    page,
    pageSize,
});