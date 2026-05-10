import { NextResponse } from 'next/server'
import { unstable_rethrow } from 'next/navigation'
import { db } from '@/shared/infrastructure/PrismaClient'
import { redis } from '@/shared/infrastructure/RedisClient'
import { Container } from '@/shared/infrastructure/Container'
import { EventBus } from '@/shared/infrastructure/EventBus'
import { toResponse } from '@/shared/errors/handle'
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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ txnRef: string }> },
) {
  try {
    const { txnRef } = await params
    const result = await getService().getStatus(txnRef)
    return NextResponse.json(result)
  } catch (err) {
    unstable_rethrow(err)
    return toResponse(err)
  }
}
