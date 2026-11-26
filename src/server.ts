import { createApp } from "./app.js";
import { config } from "./config.js";
import { createContainer } from "./container.js";
import { prisma } from "./db/prisma.js";
import { PrismaMenuRepository } from "./modules/menu/prisma-menu.repository.js";
import { PrismaOrderRepository } from "./modules/orders/order-repository.js";
import { PrismaUserRepository } from "./modules/users/prisma-user.repository.js";

const container = createContainer(config, {
    users: new PrismaUserRepository(prisma),
    menu: new PrismaMenuRepository(prisma),
    orders: new PrismaOrderRepository(prisma),
});

createApp(container).listen(
    config.PORT, () => {
        console.log(`API sur http://localhost:${config.PORT}`)
    });