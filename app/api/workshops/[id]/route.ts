import { NextResponse } from 'next/server'
import { unstable_rethrow } from 'next/navigation'
import { Container } from '@/shared/infrastructure/Container'
import { EventBus } from '@/shared/infrastructure/EventBus'
import { WorkshopService } from '@/modules/workshop/application/WorkshopService'
import type { IWorkshopRepository } from '@/modules/workshop/domain/IWorkshopRepository'
import { toWorkshopDetailDTO } from '@/shared/types/workshop-presenter'
import { toResponse } from '@/shared/errors/handle'


function getService() {
  return new WorkshopService(Container.resolve<IWorkshopRepository>('workshopRepository'), EventBus)
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const workshop = await getService().getById(id)
    return NextResponse.json(toWorkshopDetailDTO(workshop))
  } catch (err) {
    unstable_rethrow(err)
    return toResponse(err)
  }
}
