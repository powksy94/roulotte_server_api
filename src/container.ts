import { pino, type Logger } from "pino";
import type { Config } from "./config.js";
import { createAuth, type Auth } from "./fourni/auth/index.js";
import { MenuController } from "./modules/menu/menu.controller.js";
import type { MenuRepository } from "./modules/menu/menu.repository.js";
import { MenuService } from "./modules/menu/menu.service.js";
import { OrderController } from "./modules/orders/order.controller.js";
import type { OrderRepository } from "./modules/orders/order.repository.js";
import { OrderService } from "./modules/orders/order.service.js";
import type { UserRepository } from "./modules/users/user.repository.js";
import { InMemoryEventBus, type EventBus } from "./shared/event-bus.js";
import type { HealthRepository } from "./modules/health/health.repository.js";
import { CachedMenuRepository } from "./modules/menu/cached-menu.repository.js";
import { DishImageService } from "./modules/menu/image/dish-image.service.js";
import { LocalImageStorage } from "./modules/menu/image/image-storage.js";

export type Repositories = {
    users: UserRepository;
    menu: MenuRepository;
    orders: OrderRepository;
    health: HealthRepository;
};

export type Container = {
    config: Config;
    logger: Logger;
    auth: Auth;
    events: EventBus;
    health: HealthRepository;
    menuController: MenuController;
    orderController: OrderController;
};

// Composition root : le seul endroit qui assemble les objets (inversion des dépendances)
export function createContainer(config: Config, repositories: Repositories): Container {
    // Logs structurés ; jamais de jeton ni de cookie dans les logs
    const logger = pino({
        level: config.LOG_LEVEL,
        redact: ["req.headers.authorization", "req.headers.cookie"],
    });

    const auth = createAuth({
        users: repositories.users,
        jwtSecret: config.JWT_SECRET,
        jwtExpiresIn: config.JWT_EXPIRES_IN,
    });

    // Un seul bus pour toute l'application : le service publie, SSE et cache s'abonnent
    const events = new InMemoryEventBus((err) => logger.error({ err }, "Abonné au bus en erreur"));

    // Decorator : la carte en cache, invalidée par les écritures de l'admin et par les commandes (stock)
    const menu = new CachedMenuRepository(repositories.menu, events);
    const images = new LocalImageStorage(config.UPLOADS_DIR);
    const menuController = new MenuController(new MenuService(menu), new DishImageService(menu, images));
    const orderController = new OrderController(new OrderService(repositories.orders, repositories.menu, events));

    return { config, logger, auth, events, health: repositories.health, menuController, orderController };
}