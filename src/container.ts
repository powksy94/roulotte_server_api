import type { Config } from "./config.js";
import { createAuth, type Auth } from "./fourni/auth/index.js";
import { MenuController } from "./modules/menu/menu.controller.js";
import { MenuRepository } from "./modules/menu/menu.repository.js";
import { MenuService } from "./modules/menu/menu.service.js";
import type { UserRepository } from "./modules/users/user.repository.js";

export type Repositories = {
    users: UserRepository;
    menu: MenuRepository
};

export type Container = {
    config: Config;
    auth: Auth;
    menuController: MenuController;
};

// Composition root : le seul endroit qui assemble les objets (inversion des dépendances)
export function createContainer(config: Config, repositories: Repositories): Container {
    const auth = createAuth({
        users: repositories.users,
        jwtSecret: config.JWT_SECRET,
        jwtExpiresIn: config.JWT_EXPIRES_IN,
    });

    const menuController = new MenuController(new MenuService(repositories.menu));

    return { config, auth, menuController };
}