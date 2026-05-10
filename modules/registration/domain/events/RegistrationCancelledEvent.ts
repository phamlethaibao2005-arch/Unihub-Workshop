import { createDomainEvent, type DomainEvent } from '@/shared/domain/DomainEvent'

export interface RegistrationCancelledEvent extends DomainEvent {
  readonly registrationId: string
  readonly userId: string
  readonly workshopId: string
  readonly cancelledAt: Date
}

export function createRegistrationCancelledEvent(
  registrationId: string,
  userId: string,
  workshopId: string
): RegistrationCancelledEvent {
  return createDomainEvent('registration.cancelled', registrationId, {
    registrationId,
    userId,
    workshopId,
    cancelledAt: new Date(),
  })
}
