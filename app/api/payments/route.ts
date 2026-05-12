import { NextResponse } from 'next/server'
import { unstable_rethrow } from 'next/navigation'
import { db } from '@/shared/infrastructure/PrismaClient'
import { redis } from '@/shared/infrastructure/RedisClient'
import { Container } from '@/shared/infrastructure/Container'
import { EventBus } from '@/shared/infrastructure/EventBus'
import { toResponse } from '@/shared/errors/handle'
import { requireAuth } from '@/lib/session'
import { ConflictError } from '@/shared/errors/AppError'
import { PaymentService } from '@/modules/payment/application/PaymentService'
import { PrismaPaymentRepository } from '@/modules/payment/infrastructure/PrismaPaymentRepository'
import { PrismaRegistrationRepository } from '@/modules/registration/infrastructure/PrismaRegistrationRepository'
import { SeatManager } from '@/modules/registration/domain/SeatManager'
import { IdempotencyService } from '@/modules/payment/application/IdempotencyService'
import type { IPaymentGateway } from '@/modules/payment/domain/IPaymentGateway'
import type { ISeatStore } from '@/modules/registration/domain/SeatManager'

function getService(): PaymentService {
  return new PaymentService(
    Container.resolve<IPaymentGateway>('paymentGateway'),
    new PrismaPaymentRepository(db),
    new PrismaRegistrationRepository(db),
    new IdempotencyService(db),
    new SeatManager(redis as unknown as ISeatStore),
    EventBus,
    db,
  )
}

export async function POST(req: Request) {
  try {
    await requireAuth()
    const body = await req.json() as { registrationId?: string }
    if (!body.registrationId) {
      return NextResponse.json({ error: 'registrationId required' }, { status: 400 })
    }

    const payment = await db.payment.findUnique({
      where: { registrationId: body.registrationId },
    })
    if (!payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    if (payment.status !== 'PENDING') {
      throw new ConflictError(`Payment is already ${payment.status}`)
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1'
    const svc = getService()
    const result = await svc.initiatePayment(
      body.registrationId,
      payment.amount,
      payment.idempotencyKey,
      ip,
    )

    return NextResponse.json(result)
  } catch (err) {
    unstable_rethrow(err)
    return toResponse(err)
  }
}
