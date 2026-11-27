import type { RequestHandler } from "express";
import { idParamsSchema, parse } from "../../shared/validation.js";
import { toAllergenDto, toCategoryDto, toDishDto } from "./menu.dto.js";
import { createDishSchema, dishQuerySchema, updateDishSchema } from "./menu.schemas.js";
import type { MenuService } from "./menu.service.js";
import type { DishImageService } from "./image/dish-image.service.js";

// Le controller traduit HTTP ↔ métier : valide l'entrée, appelle le service, renvoie le DTO
export class MenuController {
    constructor(
        private readonly service: MenuService,
        private readonly images: DishImageService,
    ) {}

    // Fonctions fléchées : `this` reste lié quand Express les appelle
    listCategories: RequestHandler = async (_req, res) => {
        const categories = await this.service.listCategories();
        res.json(categories.map(toCategoryDto))
    };

    listAllergens: RequestHandler = async (_req, res) => {
        const allergens = await this.service.listAllergens();
        res.json(allergens.map(toAllergenDto));
    };

    listDishes: RequestHandler = async (req, res) => {
        const { page, pageSize, category, ...filters } = parse(dishQuerySchema, req.query);
        const result = await this.service.listDishes({ ...filters, categoryId: category }, { page, pageSize });
        res.json({ ...result, items: result.items.map(toDishDto) });
    };

    getDish: RequestHandler = async (req, res) => {
        const { id } = parse(idParamsSchema, req.params);
        const dish = await this.service.getDish(id);
        res.json(toDishDto(dish));
    };

    // --- Palier 2 : administration ---

    createDish: RequestHandler = async (req, res) => {
        const input = parse(createDishSchema, req.body);
        const dish = await this.service.createDish(input);
        res.status(201).location(`/dishes/${dish.id}`).json(toDishDto(dish));
    };

    updateDish: RequestHandler = async (req, res) => {
        const { id } = parse(idParamsSchema, req.params);
        const input = parse(updateDishSchema, req.body);
        const dish = await this.service.updateDish(id, input);
        res.json(toDishDto(dish));
    };

    deleteDish: RequestHandler = async (req, res) => {
        const { id } = parse(idParamsSchema, req.params);
        await this.service.deleteDish(id);
        res.status(204).end();
    };

    // --- Palier 3 : photo (le fichier a été lu par multer, en mémoire) ---

    setDishImage: RequestHandler = async (req, res) => {
        const { id } = parse(idParamsSchema, req.params);
        const dish = await this.images.setDishImage(id, req.file);
    }
}