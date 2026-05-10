import { db } from '@/shared/infrastructure/PrismaClient'
import { redis } from '@/shared/infrastructure/RedisClient'

interface CircuitState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN'
}

export async function GET() {
  const [circuitResult, dbResult, redisResult] = await Promise.allSettled([
    redis.get<CircuitState>('circuit:vnpay'),
    db.$queryRaw`SELECT 1`,
    redis.set('health:ping', '1'),
  ])

  const circuit = circuitResult.status === 'fulfilled' ? circuitResult.value : null
  const payment = circuit?.state === 'OPEN' ? 'degraded' : 'ok'

  return Response.json({
    payment,
    db: dbResult.status === 'fulfilled' ? 'ok' : 'degraded',
    redis: redisResult.status === 'fulfilled' ? 'ok' : 'degraded',
  })
}
