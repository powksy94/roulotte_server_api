// Les statuts du contrat, écrits une seule fois (validation et, au palier 2, machine à états)
export const ORDER_STATUSES = ["RECEIVED", "PREPARING", "READY", "PICKED_UP", "CANCELLED"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type OrderSort = "createdAt" | "-createdAt";

export type OrderLine = { dishId: number; name: string; quantity: number; unitPriceCents: number };

// Une commande telle que le reste de l'application la connaît (jamais une ligne Prisma brute)
export type Order = {
  id: number;
  status: OrderStatus;
  note: string | null;
  totalCents: number;
  createdAt: Date;
  updatedAt: Date;
  customer: { id: number; name: string };
  items: OrderLine[];
};

// Ce que le service demande d'enregistrer : prix et total déjà calculés par le serveur
export type NewOrder = {
  customerId: number;
  note: string | null;
  totalCents: number;
  items: { dishId: number; quantity: number; unitPriceCents: number }[];
};

export type OrderFilters = {
  customerId?: number; // absent = toutes les commandes (cuisine, admin)
  statuses?: OrderStatus[];
  sort: OrderSort;
  page: number;
  pageSize: number;
};

// DAO : le contrat que respectent l'implémentation Prisma et le faux repository des tests
export interface OrderRepository {
  create(data: NewOrder): Promise<Order>;
  findMany(filter: OrderFilters): Promise<{ items: Order[]; total: number }>;
  findById(id: number): Promise<Order | null>;
}
