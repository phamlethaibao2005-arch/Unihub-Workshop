import { NextResponse } from 'next/server'
import { unstable_rethrow } from 'next/navigation'
import { db } from '@/shared/infrastructure/PrismaClient'
import { redis } from '@/shared/infrastructure/RedisClient'
import { Container } from '@/shared/infrastructure/Container'
import { EventBus } from '@/shared/infrastructure/EventBus'
import { toResponse } from '@/shared/errors/handle'
import { requireAuth } from '@/lib/session'
import { RegistrationService } from '@/modules/registration/application/RegistrationService'
import { PrismaRegistrationRepository } from '@/modules/registration/infrastructure/PrismaRegistrationRepository'
import { SeatManager } from '@/modules/registration/domain/SeatManager'
import { IdempotencyService } from '@/modules/payment/application/IdempotencyService'
import type { IWorkshopRepository } from '@/modules/workshop/domain/IWorkshopRepository'
import type { ISeatStore } from '@/modules/registration/domain/SeatManager'


function getService(): RegistrationService {
  return new RegistrationService(
    Container.resolve<IWorkshopRepository>('workshopRepository'),
    new PrismaRegistrationRepository(db),
    new SeatManager(redis as unknown as ISeatStore),
    new IdempotencyService(db),
    EventBus,
    null,
    db,
  )
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth()
    const { id } = await params
    await getService().cancel(session.user.id, id)
    return NextResponse.json({ success: true })
  } catch (err) {
    unstable_rethrow(err)
    return toResponse(err)
  }
}
