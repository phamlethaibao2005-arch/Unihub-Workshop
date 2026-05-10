import { db } from '@/shared/infrastructure/PrismaClient'
import { redis } from '@/shared/infrastructure/RedisClient'
import { Container } from '@/shared/infrastructure/Container'
import { EventBus } from '@/shared/infrastructure/EventBus'
import { PaymentService } from '@/modules/payment/application/PaymentService'
import { PrismaPaymentRepository } from '@/modules/payment/infrastructure/PrismaPaymentRepository'
import { PrismaRegistrationRepository } from '@/modules/registration/infrastructure/PrismaRegistrationRepository'
import { SeatManager } from '@/modules/registration/domain/SeatManager'
import { IdempotencyService } from '@/modules/payment/application/IdempotencyService'
import type { IPaymentGateway } from '@/modules/payment/domain/IPaymentGateway'
import type { ISeatStore } from '@/modules/registration/domain/SeatManager'

export async function GET(req: Request) {
  if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const gateway = Container.resolve<IPaymentGateway>('paymentGateway')
  const paymentRepo = new PrismaPaymentRepository(db)
  const svc = new PaymentService(
    gateway,
    paymentRepo,
    new PrismaRegistrationRepository(db),
    new IdempotencyService(db),
    new SeatManager(redis as unknown as ISeatStore),
    EventBus,
    db,
  )

  const cutoff = new Date(Date.now() - 10 * 60_000)
  const pending = await paymentRepo.listPendingOlderThan(cutoff)
  let reconciled = 0

  for (const payment of pending) {
    try {
      const status = await gateway.queryStatus(payment.id)
      if (status === 'PENDING') continue
      await svc.reconcilePayment(payment.id, status)
      reconciled++
    } catch (err) {
      console.error(`[cron:reconcile] Failed for payment ${payment.id}`, err)
    }
  }

  return Response.json({ reconciled, total: pending.length })
}
