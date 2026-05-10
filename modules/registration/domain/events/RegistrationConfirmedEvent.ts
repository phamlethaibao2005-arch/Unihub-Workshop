import { createDomainEvent, type DomainEvent } from '@/shared/domain/DomainEvent'

export interface RegistrationConfirmedEvent extends DomainEvent {
  readonly registrationId: string
  readonly userId: string
  readonly workshopId: string
  readonly qrCode: string
  readonly confirmedAt: Date
}

export function createRegistrationConfirmedEvent(
  registrationId: string,
  userId: string,
  workshopId: string,
  qrCode: string
): RegistrationConfirmedEvent {
  return createDomainEvent('registration.confirmed', registrationId, {
    registrationId,
    userId,
    workshopId,
    qrCode,
    confirmedAt: new Date(),
  })
}
