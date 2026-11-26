import type { RequestHandler } from "express";
import { currentUser } from "../../fourni/auth/index.js";
import { idParamsSchema, parse } from "../../shared/validation.js";
import { toOrderDto } from "./order.dto.js";
import { listOrdersQuerySchema, placeOrderSchema } from "./order.schemas.js";
import type { OrderService } from "./order.service.js";

// Le controller traduit HTTP ↔ métier : valide l'entrée, appelle le service, renvoie le DTO.
// Pas de try/catch : Express 5 transmet les erreurs async au gestionnaire d'erreurs.
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  place: RequestHandler = async (req, res) => {
    const input = parse(placeOrderSchema, req.body); // invalide → 400 VALIDATION_ERROR
    const order = await this.orderService.placeOrder(currentUser(req), input);
    res.status(201).location(`/orders/${order.id}`).json(toOrderDto(order));
  };

  list: RequestHandler = async (req, res) => {
    const query = parse(listOrdersQuerySchema, req.query);
    const page = await this.orderService.listOrders(currentUser(req), query);
    res.json({ ...page, items: page.items.map(toOrderDto) });
  };

  getById: RequestHandler = async (req, res) => {
    const { id } = parse(idParamsSchema, req.params);
    const order = await this.orderService.getOrderById(currentUser(req), id);
    res.json(toOrderDto(order));
  };
}
