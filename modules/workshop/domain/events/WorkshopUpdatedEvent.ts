import { createDomainEvent, type DomainEvent } from '@/shared/domain/DomainEvent'

export interface WorkshopUpdatedEvent extends DomainEvent {
  readonly workshopId: string
  readonly updatedFields: string[]
}

export function createWorkshopUpdatedEvent(
  workshopId: string,
  updatedFields: string[]
): WorkshopUpdatedEvent {
  return createDomainEvent('workshop.updated', workshopId, {
    workshopId,
    updatedFields,
  })
}
