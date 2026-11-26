import { Request, Response, NextFunction } from "express";
import { currentUser } from "../../fourni/auth/index.js";
import { OrderService } from "./order-service.js";
import { listOrdersQuerySchema, orderIdParamSchema } from "./order.dto.js";

export class OrderController {
    constructor(private readonly orderService: OrderService) {}

    list = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = currentUser(req);
            const query = listOrdersQuerySchema.parse(req.query);
            const result = await this.orderService.listOrders(user, query);
            res.json(result);
        } catch (error) {
            next(error);
        }
    };

    getById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = currentUser(req);
            const {id} = orderIdParamSchema.parse(req.params);
            const order = await this.orderService.getOrderById(user, id);
            res.json(order);
        } catch (error) {
            next(error);
        }
    };
}