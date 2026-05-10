import type { DomainEvent } from './DomainEvent'

export interface IEventBus {
  publish(event: DomainEvent): Promise<void>
}
