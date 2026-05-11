import { requireRole } from '@/lib/session'
import { Role } from '@/modules/auth/domain/Role'
import { db } from '@/shared/infrastructure/PrismaClient'
import { toResponse } from '@/shared/errors/handle'

export const runtime = 'nodejs'

type ActivityItem = {
  id: string
  type: 'registration' | 'checkin' | 'cancelled'
  message: string
  at: string
}

async function getRecentActivity(): Promise<ActivityItem[]> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // last 7 days

  const [registrations, checkins, cancelled] = await Promise.all([
    db.registration.findMany({
      where: { createdAt: { gte: since } },
      include: {
        user: { select: { name: true } },
        workshop: { select: { title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    db.checkin.findMany({
      where: { checkedInAt: { gte: since } },
      include: {
        registration: {
          include: {
            user: { select: { name: true } },
            workshop: { select: { title: true } },
          },
        },
      },
      orderBy: { checkedInAt: 'desc' },
      take: 20,
    }),
    db.workshop.findMany({
      where: { status: 'CANCELLED', updatedAt: { gte: since } },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    }),
  ])

  const items: ActivityItem[] = [
    ...registrations.map((r) => ({
      id: `reg-${r.id}`,
      type: 'registration' as const,
      message: `${r.user.name} đăng ký "${r.workshop.title}"`,
      at: r.createdAt.toISOString(),
    })),
    ...checkins.map((c) => ({
      id: `ci-${c.id}`,
      type: 'checkin' as const,
      message: `${c.registration.user.name} check-in "${c.registration.workshop.title}"`,
      at: c.checkedInAt.toISOString(),
    })),
    ...cancelled.map((w) => ({
      id: `cancel-${w.id}`,
      type: 'cancelled' as const,
      message: `Workshop "${w.title}" đã bị hủy`,
      at: w.updatedAt.toISOString(),
    })),
  ]

  return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 50)
}

export async function GET() {
  try {
    await requireRole(Role.ORGANIZER)
  } catch (err) {
    return toResponse(err)
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      // Send initial batch
      try {
        const items = await getRecentActivity()
        send({ type: 'init', items })
      } catch {
        send({ type: 'error', message: 'Failed to load activity' })
      }

      // Keep alive + poll for new events every 10s
      let lastCheck = new Date()
      const interval = setInterval(async () => {
        try {
          const newItems = await db.registration.findMany({
            where: { createdAt: { gte: lastCheck } },
            include: {
              user: { select: { name: true } },
              workshop: { select: { title: true } },
            },
            orderBy: { createdAt: 'desc' },
          })
          lastCheck = new Date()
          if (newItems.length > 0) {
            send({
              type: 'update',
              items: newItems.map((r) => ({
                id: `reg-${r.id}`,
                type: 'registration',
                message: `${r.user.name} đăng ký "${r.workshop.title}"`,
                at: r.createdAt.toISOString(),
              })),
            })
          } else {
            controller.enqueue(encoder.encode(': ping\n\n'))
          }
        } catch {
          controller.enqueue(encoder.encode(': ping\n\n'))
        }
      }, 10_000)

      // Clean up when client disconnects
      const cleanup = () => clearInterval(interval)
      // The stream will be closed by the client disconnect
      void cleanup
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
