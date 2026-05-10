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
import type { RegistrationDTO } from '@/shared/types/registration'


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

function timeStr(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${fmt(start)} – ${fmt(end)}`
}

function toDTO(row: {
  id: string
  workshopId: string
  status: string
  qrCode: string | null
  createdAt: Date
  workshop: { title: string; speaker: string; date: Date; startTime: Date; endTime: Date; room: string }
}): RegistrationDTO {
  return {
    id: row.id,
    workshopId: row.workshopId,
    status: row.status as RegistrationDTO['status'],
    qrCode: row.qrCode,
    createdAt: row.createdAt.toISOString(),
    workshop: {
      title: row.workshop.title,
      speaker: row.workshop.speaker,
      date: row.workshop.date.toISOString().split('T')[0],
      time: timeStr(row.workshop.startTime, row.workshop.endTime),
      location: row.workshop.room,
    },
  }
}

const WORKSHOP_SELECT = {
  title: true,
  speaker: true,
  date: true,
  startTime: true,
  endTime: true,
  room: true,
} as const

export async function POST(req: Request) {
  try {
    const session = await requireAuth()
    const body = await req.json()
    const idempotencyKey =
      req.headers.get('X-Idempotency-Key') ??
      (typeof body.idempotencyKey === 'string' ? body.idempotencyKey : null) ??
      crypto.randomUUID()
    const workshopId = body.workshopId as string

    const result = await getService().register(session.user.id, workshopId, idempotencyKey)
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    unstable_rethrow(err)
    return toResponse(err)
  }
}

export async function GET(req: Request) {
  try {
    const session = await requireAuth()
    const url = new URL(req.url)
    const workshopId = url.searchParams.get('workshopId') ?? undefined

    const where =
      session.user.role === 'ORGANIZER'
        ? { workshopId }
        : { userId: session.user.id }

    const rows = await db.registration.findMany({
      where,
      include: { workshop: { select: WORKSHOP_SELECT } },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(rows.map(toDTO))
  } catch (err) {
    unstable_rethrow(err)
    return toResponse(err)
  }
}
