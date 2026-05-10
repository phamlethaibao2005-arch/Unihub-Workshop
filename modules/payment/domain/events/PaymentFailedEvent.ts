import { createDomainEvent, type DomainEvent } from '@/shared/domain/DomainEvent'

export interface PaymentFailedEvent extends DomainEvent {
  readonly paymentId: string
  readonly registrationId: string
  readonly reason: string | undefined
  readonly failedAt: Date
}

export function createPaymentFailedEvent(
  paymentId: string,
  registrationId: string,
  reason?: string,
): PaymentFailedEvent {
  return createDomainEvent('payment.failed', paymentId, {
    paymentId,
    registrationId,
    reason,
    failedAt: new Date(),
  })
}
