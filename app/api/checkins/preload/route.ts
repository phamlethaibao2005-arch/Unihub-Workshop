import { NextResponse } from 'next/server'
import { unstable_rethrow } from 'next/navigation'
import { db } from '@/shared/infrastructure/PrismaClient'
import { Container } from '@/shared/infrastructure/Container'
import { toResponse } from '@/shared/errors/handle'
import { requireRole } from '@/lib/session'
import { Role } from '@/modules/auth/domain/Role'
import { CheckinService } from '@/modules/checkin/application/CheckinService'
import { PrismaCheckinRepository } from '@/modules/checkin/infrastructure/PrismaCheckinRepository'
import { PrismaRegistrationRepository } from '@/modules/registration/infrastructure/PrismaRegistrationRepository'
import type { IWorkshopRepository } from '@/modules/workshop/domain/IWorkshopRepository'

function getService(): CheckinService {
  return new CheckinService(
    new PrismaCheckinRepository(db),
    new PrismaRegistrationRepository(db),
    Container.resolve<IWorkshopRepository>('workshopRepository'),
  )
}

export async function GET(req: Request) {
  try {
    await requireRole(Role.CHECKIN_STAFF)
    const url = new URL(req.url)
    const dateParam = url.searchParams.get('date')
    const date = dateParam ? new Date(dateParam) : new Date()
    if (isNaN(date.getTime())) {
      return NextResponse.json({ error: 'Invalid date', code: 'VALIDATION_ERROR' }, { status: 400 })
    }
    const result = await getService().preload(date)
    return NextResponse.json(result)
  } catch (err) {
    unstable_rethrow(err)
    return toResponse(err)
  }
}
