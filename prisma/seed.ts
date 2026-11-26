import { readFile } from "node:fs/promises";
import { prisma } from "../src/db/prisma.js";
import { hashPassword } from "../src/fourni/auth/index.js";

const menu = JSON.parse(await readFile(new URL("../donnees/menu.json", import.meta.url), "utf8"));

await prisma.orderItem.deleteMany();
await prisma.order.deleteMany();
await prisma.dish.deleteMany();
await prisma.category.deleteMany();
await prisma.allergen.deleteMany();
await prisma.user.deleteMany();

await prisma.category.createMany({ data: menu.categories });
await prisma.allergen.createMany({ data: menu.allergens });

for (const d of menu.dishes) {
  await prisma.dish.create({
    data: {
      name: d.name, description: d.description, priceCents: d.priceCents, available: d.available,
      stock: d.stock,
      category: { connect: { name: d.category } },
      allergens: { connect: d.allergens.map((code: string) => ({ code })) },
    },
  });
}

for (const u of menu.users) {
  await prisma.user.create({
    data: { email: u.email, name: u.name, role: u.role, passwordHash: await hashPassword(u.password) },
  });
}

console.log("Seed terminé");
await prisma.$disconnect();