import type { RequestHandler } from "express";
import { idParamsSchema, parse } from "../../shared/validation.js";
import { toAllergenDto, toCategoryDto, toDishDto } from "./menu.dto.js";
import { dishQuerySchema } from "./menu.schemas.js";
import type { MenuService } from "./menu.service.js";

// Le controller traduit HTTP ↔ métier : valide l'entrée, appelle le service, renvoie le DTO
export class MenuController {
    constructor(private readonly service: MenuService) {}

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
}