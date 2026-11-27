import type { Order } from "../modules/orders/order.repository.js";

// Les événements du domaine (le contrat SSE en reprend les noms)
export type DomainEvent = 
    | { type: "order.created"; order: Order}
    | { type: "order.updated"; order: Order};

export type EventListener = (event: DomainEvent) => void;

export interface EventPublisher {
    publish(event: DomainEvent): void;
}

export interface EventBus extends EventPublisher {
    subscribe(listener: EventListener): () => void;
}

export class InMemoryEventBus implements EventBus {
    private readonly listeners = new Set<EventListener>();

    constructor(private readonly onListenerError: (err: unknown) => void = () => {}) {}

    publish(event: DomainEvent) {
        for (const listener of this.listeners) {
            // Un abonné en erreur (connexion SSE coupée…) ne doit ni casser la commande ni priver les autres
            try {
                listener(event);
            } catch (err) {
                this.onListenerError(err);
            }
        }
    }

    subscribe(listener: EventListener) {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }
}