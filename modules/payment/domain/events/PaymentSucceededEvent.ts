import { createDomainEvent, type DomainEvent } from '@/shared/domain/DomainEvent'

export interface PaymentSucceededEvent extends DomainEvent {
  readonly paymentId: string
  readonly registrationId: string
  readonly amount: number
  readonly vnpayTxnRef: string
  readonly paidAt: Date
}

export function createPaymentSucceededEvent(
  paymentId: string,
  registrationId: string,
  amount: number,
  vnpayTxnRef: string,
): PaymentSucceededEvent {
  return createDomainEvent('payment.succeeded', paymentId, {
    paymentId,
    registrationId,
    amount,
    vnpayTxnRef,
    paidAt: new Date(),
  })
}
