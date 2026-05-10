import type { PrismaClient } from '@prisma/client'
import type { IPaymentRepository } from '../domain/IPaymentRepository'
import { Payment } from '../domain/Payment'
import { PaymentStatus } from '../domain/PaymentStatus'

function toDomain(row: {
  id: string
  registrationId: string
  amount: number
  idempotencyKey: string
  vnpayTxnRef: string | null
  status: string
  paidAt: Date | null
  createdAt: Date
}): Payment {
  return new Payment({
    id: row.id,
    registrationId: row.registrationId,
    amount: row.amount,
    idempotencyKey: row.idempotencyKey,
    vnpayTxnRef: row.vnpayTxnRef,
    status: row.status as PaymentStatus,
    paidAt: row.paidAt,
    createdAt: row.createdAt,
  })
}

export class PrismaPaymentRepository implements IPaymentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Payment | null> {
    const row = await this.prisma.payment.findUnique({ where: { id } })
    return row ? toDomain(row) : null
  }

  async findByTxnRef(txnRef: string): Promise<Payment | null> {
    const row = await this.prisma.payment.findUnique({ where: { vnpayTxnRef: txnRef } })
    return row ? toDomain(row) : null
  }

  async findByRegistrationId(registrationId: string): Promise<Payment | null> {
    const row = await this.prisma.payment.findUnique({ where: { registrationId } })
    return row ? toDomain(row) : null
  }

  async findByIdempotencyKey(key: string): Promise<Payment | null> {
    const row = await this.prisma.payment.findUnique({ where: { idempotencyKey: key } })
    return row ? toDomain(row) : null
  }

  async listPendingOlderThan(cutoff: Date): Promise<Payment[]> {
    const rows = await this.prisma.payment.findMany({
      where: { status: 'PENDING', createdAt: { lt: cutoff } },
    })
    return rows.map(toDomain)
  }

  async create(payment: Payment): Promise<Payment> {
    const p = payment.toProps()
    const row = await this.prisma.payment.create({
      data: {
        id: p.id,
        registrationId: p.registrationId,
        amount: p.amount,
        idempotencyKey: p.idempotencyKey,
        vnpayTxnRef: p.vnpayTxnRef,
        status: p.status,
        paidAt: p.paidAt,
      },
    })
    return toDomain(row)
  }

  async update(payment: Payment): Promise<Payment> {
    const p = payment.toProps()
    const row = await this.prisma.payment.update({
      where: { id: p.id },
      data: {
        vnpayTxnRef: p.vnpayTxnRef,
        status: p.status,
        paidAt: p.paidAt,
      },
    })
    return toDomain(row)
  }
}
