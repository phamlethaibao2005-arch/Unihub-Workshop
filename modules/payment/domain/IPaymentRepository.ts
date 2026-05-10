import type { Payment } from './Payment'

export interface IPaymentRepository {
  findById(id: string): Promise<Payment | null>
  findByTxnRef(txnRef: string): Promise<Payment | null>
  findByRegistrationId(registrationId: string): Promise<Payment | null>
  findByIdempotencyKey(key: string): Promise<Payment | null>
  listPendingOlderThan(cutoff: Date): Promise<Payment[]>
  create(payment: Payment): Promise<Payment>
  update(payment: Payment): Promise<Payment>
}
