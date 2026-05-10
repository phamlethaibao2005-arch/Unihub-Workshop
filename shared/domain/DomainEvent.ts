export interface DomainEvent {
  readonly eventId: string;
  readonly occurredAt: Date;
  readonly eventType: string;
  readonly aggregateId: string;
}

export function createDomainEvent<T extends object>(
  eventType: string,
  aggregateId: string,
  payload: T
): DomainEvent & T {
  return {
    eventId: crypto.randomUUID(),
    occurredAt: new Date(),
    eventType,
    aggregateId,
    ...payload,
  };
}
