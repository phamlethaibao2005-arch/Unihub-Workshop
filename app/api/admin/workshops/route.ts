import { NextResponse } from 'next/server'
import { unstable_rethrow } from 'next/navigation'
import { z } from 'zod'
import { Container } from '@/shared/infrastructure/Container'
import { EventBus } from '@/shared/infrastructure/EventBus'
import { WorkshopService } from '@/modules/workshop/application/WorkshopService'
import type { IWorkshopRepository } from '@/modules/workshop/domain/IWorkshopRepository'
import { toWorkshopDTO } from '@/shared/types/workshop-presenter'
import { requireRole } from '@/lib/session'
import { Role } from '@/modules/auth/domain/Role'
import { toResponse } from '@/shared/errors/handle'

export const runtime = 'nodejs'

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  speaker: z.string().min(1),
  room: z.string().min(1),
  roomMapUrl: z.string().url().optional().or(z.literal('')),
  date: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  maxCapacity: z.coerce.number().int().min(1),
  price: z.coerce.number().int().min(0),
})

function getService() {
  return new WorkshopService(
    Container.resolve<IWorkshopRepository>('workshopRepository'),
    EventBus,
  )
}

export async function GET() {
  try {
    await requireRole(Role.ORGANIZER)
    const service = getService()
    const { items } = await service.list({ page: 1, size: 100 })
    return NextResponse.json({ workshops: items.map(toWorkshopDTO) })
  } catch (err) {
    unstable_rethrow(err)
    return toResponse(err)
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireRole(Role.ORGANIZER)
    const body = createSchema.parse(await req.json())

    const workshop = await getService().createWorkshop(
      {
        title: body.title,
        description: body.description ?? null,
        speaker: body.speaker,
        room: body.room,
        roomMapUrl: body.roomMapUrl || null,
        date: new Date(body.date),
        startTime: new Date(body.startTime),
        endTime: new Date(body.endTime),
        maxCapacity: body.maxCapacity,
        price: body.price,
        createdBy: session.user.id,
      },
      session.user.id,
    )

    return NextResponse.json(toWorkshopDTO(workshop), { status: 201 })
  } catch (err) {
    unstable_rethrow(err)
    return toResponse(err)
  }
}
