import type { DomainEvent } from "../domain/DomainEvent";

type Handler<T extends DomainEvent = DomainEvent> = (event: T) => Promise<void>;

const handlers = new Map<string, Handler[]>();

export const EventBus = {
  subscribe<T extends DomainEvent>(eventType: string, handler: Handler<T>): void {
    const existing = handlers.get(eventType) ?? [];
    handlers.set(eventType, [...existing, handler as Handler]);
  },

  async publish(event: DomainEvent): Promise<void> {
    const eventHandlers = handlers.get(event.eventType) ?? [];
    await Promise.allSettled(
      eventHandlers.map((h) =>
        h(event).catch((err) => {
          console.error(`[EventBus] Handler for ${event.eventType} failed:`, err);
        })
      )
    );
  },

  clear(eventType?: string): void {
    if (eventType) {
      handlers.delete(eventType);
    } else {
      handlers.clear();
    }
  },
};
