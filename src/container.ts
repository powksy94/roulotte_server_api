import type { Config } from "./config.js";
import { createAuth, type Auth } from "./fourni/auth/index.js";
import type { UserRepository } from "./modules/users/user.repository.js";

export type Repositories = {
    users: UserRepository;
};

export type Container = {
    config: Config;
    auth: Auth;
};

// Composition root : le seul endroit qui assemble les objets (inversion des dépendances)
export function createContainer(config: Config, repositories: Repositories): Container {
    const auth = createAuth({
        users: repositories.users,
        jwtSecret: config.JWT_SECRET,
        jwtExpiresIn: config.JWT_EXPIRES_IN,
    });

    return { config, auth };
}