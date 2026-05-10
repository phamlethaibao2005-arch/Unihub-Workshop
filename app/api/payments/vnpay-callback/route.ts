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

// VNPAY sends IPN as POST with JSON body or query-string params.
// We must ALWAYS respond HTTP 200; use RspCode field to signal errors.
export async function POST(req: Request) {
  try {
    let params: Record<string, string> = {}

    const contentType = req.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      params = (await req.json()) as Record<string, string>
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await req.text()
      new URLSearchParams(text).forEach((v, k) => { params[k] = v })
    } else {
      // Fallback: parse from URL query string
      new URL(req.url).searchParams.forEach((v, k) => { params[k] = v })
    }

    const result = await getService().handleCallback(params)
    return Response.json(result, { status: 200 })
  } catch {
    return Response.json({ RspCode: '99', Message: 'Unknown error' }, { status: 200 })
  }
}

// Some integrations use GET for IPN
export async function GET(req: Request) {
  try {
    const params: Record<string, string> = {}
    new URL(req.url).searchParams.forEach((v, k) => { params[k] = v })
    const result = await getService().handleCallback(params)
    return Response.json(result, { status: 200 })
  } catch {
    return Response.json({ RspCode: '99', Message: 'Unknown error' }, { status: 200 })
  }
}
