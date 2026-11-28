import { EventEmitter} from "node:events";

export type OrderEventPayload = {
    order: unknown; // DTO de commande (ex: OrderDto)
    userId: number; // ID du client propriétaire de la commande
}

export type AppEvents = {
    "order.created": OrderEventPayload;
    "order.updated": OrderEventPayload;
}

export class AppEventBus {
    private readonly emitter = new EventEmitter();

    emit<K extends keyof AppEvents>(event: K, payload: AppEvents[K]): void {
    this.emitter.emit(event, payload);
  }

    on<K extends keyof AppEvents>(event: K, listener: (payload: AppEvents[K]) => void): () => void {
    this.emitter.on(event, listener);
    // Retourne la fonction de nettoyage pour éviter toute fuite mémoire à la déconnexion SSE
    return () => {
      this.emitter.off(event, listener);
    };
  }
}