import { Container } from '@/shared/infrastructure/Container'
import { EventBus } from '@/shared/infrastructure/EventBus'
import { redis } from '@/shared/infrastructure/RedisClient'
import { WorkshopService } from '@/modules/workshop/application/WorkshopService'
import type { IWorkshopRepository } from '@/modules/workshop/domain/IWorkshopRepository'
import type { WorkshopProps } from '@/modules/workshop/domain/Workshop'

export const dynamic = 'force-dynamic'

function getService() {
  return new WorkshopService(Container.resolve<IWorkshopRepository>('workshopRepository'), EventBus)
}

async function readSeatsLeft(id: string): Promise<number | null> {
  try {
    const cached = await redis.get<WorkshopProps>(`workshop:${id}`)
    if (cached) return cached.maxCapacity - cached.currentRegistrations
  } catch {
    // Fall through to the repository poll below.
  }

  try {
    const workshop = await getService().getById(id)
    return workshop.maxCapacity - workshop.currentRegistrations
  } catch {
    return null
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const enc = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      let closed = false
      let lastSeatsLeft: number | null = null

      const emit = (seatsLeft: number) => {
        if (!closed) {
          controller.enqueue(enc.encode(`data: ${JSON.stringify({ seatsLeft })}\n\n`))
        }
      }

      const poll = async () => {
        if (closed) return
        const seatsLeft = await readSeatsLeft(id)
        if (seatsLeft === null || seatsLeft === lastSeatsLeft) return
        lastSeatsLeft = seatsLeft
        emit(seatsLeft)
      }

      poll()
      const timer = setInterval(poll, 5_000)

      req.signal.addEventListener('abort', () => {
        closed = true
        clearInterval(timer)
        try {
          controller.close()
        } catch {
          // The stream may already be closed by the client.
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
