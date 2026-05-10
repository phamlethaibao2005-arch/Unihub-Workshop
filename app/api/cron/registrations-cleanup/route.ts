import { db } from '@/shared/infrastructure/PrismaClient'
import { redis } from '@/shared/infrastructure/RedisClient'
import { SeatManager } from '@/modules/registration/domain/SeatManager'
import type { ISeatStore } from '@/modules/registration/domain/SeatManager'

type TxClient = Parameters<Parameters<typeof db.$transaction>[0]>[0]


const seatManager = new SeatManager(redis as unknown as ISeatStore)

export async function GET(req: Request) {
  if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - 30 * 60_000)

  const stale = await db.registration.findMany({
    where: { status: 'PENDING', createdAt: { lt: cutoff } },
    select: { id: true, workshopId: true },
  })

  let cancelled = 0
  for (const reg of stale) {
    try {
      await db.$transaction(async (tx: TxClient) => {
        await tx.registration.update({
          where: { id: reg.id },
          data: { status: 'CANCELLED' },
        })
        await tx.$executeRaw`
          UPDATE "Workshop"
          SET "currentRegistrations" = GREATEST("currentRegistrations" - 1, 0),
              "updatedAt" = NOW()
          WHERE id = ${reg.workshopId}
        `
      })
      await seatManager.release(reg.workshopId)
      cancelled++
    } catch {
      // Log failures individually so one bad row doesn't abort the whole batch
      console.error(`[cron] Failed to cancel registration ${reg.id}`)
    }
  }

  return Response.json({ cancelled, total: stale.length })
}
