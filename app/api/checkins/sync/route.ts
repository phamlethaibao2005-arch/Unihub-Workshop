import { NextResponse } from 'next/server'
import { unstable_rethrow } from 'next/navigation'
import { z } from 'zod'
import { db } from '@/shared/infrastructure/PrismaClient'
import { Container } from '@/shared/infrastructure/Container'
import { toResponse } from '@/shared/errors/handle'
import { requireRole } from '@/lib/session'
import { Role } from '@/modules/auth/domain/Role'
import { CheckinService } from '@/modules/checkin/application/CheckinService'
import { PrismaCheckinRepository } from '@/modules/checkin/infrastructure/PrismaCheckinRepository'
import { PrismaRegistrationRepository } from '@/modules/registration/infrastructure/PrismaRegistrationRepository'
import type { IWorkshopRepository } from '@/modules/workshop/domain/IWorkshopRepository'

const recordSchema = z.object({
  registrationId: z.string().min(1),
  workshopId: z.string().min(1),
  checkedInAt: z.string().min(1),
  deviceId: z.string().min(1),
})

const schema = z.object({
  records: z.array(recordSchema),
})

function getService(): CheckinService {
  return new CheckinService(
    new PrismaCheckinRepository(db),
    new PrismaRegistrationRepository(db),
    Container.resolve<IWorkshopRepository>('workshopRepository'),
  )
}

export async function POST(req: Request) {
  try {
    const session = await requireRole(Role.CHECKIN_STAFF)
    const { records } = schema.parse(await req.json())
    const result = await getService().syncBatch(session.user.id, records)
    return NextResponse.json(result)
  } catch (err) {
    unstable_rethrow(err)
    return toResponse(err)
  }
}
