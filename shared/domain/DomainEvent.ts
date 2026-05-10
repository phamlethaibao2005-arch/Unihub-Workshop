export interface DomainEvent {
  readonly eventId: string;
  readonly occurredAt: Date;
  readonly eventType: string;
}

export function createDomainEvent<T extends object>(
  eventType: string,
  payload: T
): DomainEvent & T {
  return {
    eventId: crypto.randomUUID(),
    occurredAt: new Date(),
    eventType,
    ...payload,
  };
}
