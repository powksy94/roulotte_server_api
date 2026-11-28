import type { Config } from "./config.js";
import { createAuth, type Auth } from "./fourni/auth/index.js";
import { MenuController } from "./modules/menu/menu.controller.js";
import type { MenuRepository } from "./modules/menu/menu.repository.js";
import { MenuService } from "./modules/menu/menu.service.js";
import { OrderController } from "./modules/orders/order.controller.js";
import type { OrderRepository } from "./modules/orders/order.repository.js";
import { OrderService } from "./modules/orders/order.service.js";
import type { UserRepository } from "./modules/users/user.repository.js";
import { AppEventBus } from "./shared/event-bus.js";
import { EventController } from "./modules/events/event-controller.js";
import { PrismaOrderRepository } from "./modules/orders/prisma-order.repository.js";

export type Repositories = {
    users: UserRepository;
    menu: MenuRepository;
    orders: OrderRepository;
};

export type Container = {
    config: Config;
    auth: Auth;
    menuController: MenuController;
    orderController: OrderController;
    eventController: EventController;
};

// Composition root : le seul endroit qui assemble les objets (inversion des dépendances)
export function createContainer(config: Config, repositories: Repositories): Container {
    const auth = createAuth({
        users: repositories.users,
        jwtSecret: config.JWT_SECRET,
        jwtExpiresIn: config.JWT_EXPIRES_IN,
    });

    // 1. Créez l'instance unique du bus
    const eventBus = new AppEventBus();

    // 3. Créez le contrôleur SSE avec le même bus
    const eventController = new EventController(eventBus);

    const menuController = new MenuController(new MenuService(repositories.menu));
    const orderController = new OrderController(new OrderService(repositories.orders, repositories.menu, eventBus));

    return { config, auth, menuController, orderController, eventController };
}