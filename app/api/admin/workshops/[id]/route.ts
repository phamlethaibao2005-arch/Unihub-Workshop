import { NextResponse } from 'next/server'
import { unstable_rethrow } from 'next/navigation'
import { z } from 'zod'
import { Container } from '@/shared/infrastructure/Container'
import { EventBus } from '@/shared/infrastructure/EventBus'
import { WorkshopService } from '@/modules/workshop/application/WorkshopService'
import type { IWorkshopRepository } from '@/modules/workshop/domain/IWorkshopRepository'
import { toWorkshopDetailDTO } from '@/shared/types/workshop-presenter'
import { requireRole } from '@/lib/session'
import { Role } from '@/modules/auth/domain/Role'
import { toResponse } from '@/shared/errors/handle'

export const runtime = 'nodejs'

const paramsSchema = z.object({ id: z.string().min(1) })

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  speaker: z.string().min(1).optional(),
  room: z.string().min(1).optional(),
  roomMapUrl: z.string().url().optional().nullable(),
  date: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  maxCapacity: z.coerce.number().int().min(1).optional(),
  price: z.coerce.number().int().min(0).optional(),
})

function getService() {
  return new WorkshopService(
    Container.resolve<IWorkshopRepository>('workshopRepository'),
    EventBus,
  )
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireRole(Role.ORGANIZER)
    const { id } = paramsSchema.parse(await params)
    const workshop = await getService().getById(id)
    return NextResponse.json(toWorkshopDetailDTO(workshop))
  } catch (err) {
    unstable_rethrow(err)
    return toResponse(err)
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireRole(Role.ORGANIZER)
    const { id } = paramsSchema.parse(await params)
    const body = patchSchema.parse(await req.json())

    const patch: Parameters<WorkshopService['updateWorkshop']>[1] = {}
    if (body.title !== undefined) patch.title = body.title
    if (body.description !== undefined) patch.description = body.description ?? undefined
    if (body.speaker !== undefined) patch.speaker = body.speaker
    if (body.room !== undefined) patch.room = body.room
    if (body.roomMapUrl !== undefined) patch.roomMapUrl = body.roomMapUrl ?? undefined
    if (body.date !== undefined) patch.date = new Date(body.date)
    if (body.startTime !== undefined) patch.startTime = new Date(body.startTime)
    if (body.endTime !== undefined) patch.endTime = new Date(body.endTime)
    if (body.maxCapacity !== undefined) patch.maxCapacity = body.maxCapacity
    if (body.price !== undefined) patch.price = body.price

    const workshop = await getService().updateWorkshop(id, patch)
    return NextResponse.json(toWorkshopDetailDTO(workshop))
  } catch (err) {
    unstable_rethrow(err)
    return toResponse(err)
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireRole(Role.ORGANIZER)
    const { id } = paramsSchema.parse(await params)
    await getService().cancelWorkshop(id)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    unstable_rethrow(err)
    return toResponse(err)
  }
}
