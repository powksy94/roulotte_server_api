import type { RequestHandler } from "express";
import { currentUser } from "../../fourni/auth/index.js";
import { idParamsSchema, parse } from "../../shared/validation.js";
import type { OrderService } from "./order-service.js";
import { listOrdersQuerySchema, placeOrderSchema } from "./order.dto.js";

// Pas de try/catch : Express 5 transmet les erreurs async au gestionnaire d'erreurs
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  place: RequestHandler = async (req, res) => {
    const input = parse(placeOrderSchema, req.body); // invalide → 400 VALIDATION_ERROR
    const order = await this.orderService.placeOrder(currentUser(req), input);
    res.status(201).location(`/orders/${order.id}`).json(order);
  };

  list: RequestHandler = async (req, res) => {
    const query = parse(listOrdersQuerySchema, req.query);
    const result = await this.orderService.listOrders(currentUser(req), query);
    res.json(result);
  };

  getById: RequestHandler = async (req, res) => {
    const { id } = parse(idParamsSchema, req.params);
    const order = await this.orderService.getOrderById(currentUser(req), id);
    res.json(order);
  };
}
