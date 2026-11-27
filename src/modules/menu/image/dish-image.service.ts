import { notFound, unsupportedMediaType, validationError } from "../../../shared/errors.js";
import type { ImageStorage } from "./image-storage.js";
import { detectImageExtension } from "./image-type.js";
import type { MenuRepository } from "../menu.repository.js";

// La photo d'un plat : vérification du contenu, enregistrement, remplacement de l'ancienne
export class DishImageService {
    constructor(
        private readonly menu: Pick<MenuRepository, "findDishById" | "setDishImage">,
        private readonly images: ImageStorage,
    ) {}

    async setDishImage(id: number, file: { buffer: Buffer } | undefined) {
        if (!file) throw validationError([{ path: "image", message: "Fichier requis (champ « image »)" }]);

        const dish = await this.menu.findDishById(id);
        if (!dish) throw notFound("Plat introuvable");

        const extension = await detectImageExtension(file.buffer);
        if (!extension) throw unsupportedMediaType("Seules les images PNG, JPEG et WebP sont acceptées");

        const imageUrl = await this.images.save(file.buffer, extension);
        let updated;
        try {
            updated = await this.menu.setDishImage(id, imageUrl);
        } catch (err) {
            await this.images.remove(imageUrl);
            throw err;
        }
        // La nouvelle photo remplace l'ancienne : l'ancien fichier n'est plus servi
        if (dish.imageUrl) await this.images.remove(dish.imageUrl);
        return updated;
    }
}