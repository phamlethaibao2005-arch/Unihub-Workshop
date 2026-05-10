import { createDomainEvent, type DomainEvent } from '@/shared/domain/DomainEvent'

export interface WorkshopCancelledEvent extends DomainEvent {
  readonly workshopId: string
  readonly title: string
  readonly cancelledAt: Date
}

export function createWorkshopCancelledEvent(
  workshopId: string,
  title: string
): WorkshopCancelledEvent {
  return createDomainEvent('workshop.cancelled', workshopId, {
    workshopId,
    title,
    cancelledAt: new Date(),
  })
}
