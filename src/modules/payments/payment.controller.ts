import type { RequestHandler } from "express";
import { currentUser } from "../../fourni/auth/index.js";
import { idParamsSchema, parse } from "../../shared/validation.js";
import { toOrderDto } from "../orders/order.dto.js";
import { paymentSchema } from "./payment.schemas.js";
import type { PaymentService } from "./payment.service.js";

export class PaymentController {
    constructor(private readonly payments: PaymentService) {}

    pay: RequestHandler = async (req, res) => {
        const { id } = parse(idParamsSchema, req.params);
        const { token } = parse(paymentSchema, req.body);
        const order = await this.payments.pay(currentUser(req), id, token);
        res.json(toOrderDto(order));
    };
}
