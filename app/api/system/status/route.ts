import { db } from '@/shared/infrastructure/PrismaClient'
import { redis } from '@/shared/infrastructure/RedisClient'

interface CircuitState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN'
}

function circuitStatus(result: PromiseSettledResult<CircuitState | null>): 'ok' | 'degraded' {
  if (result.status !== 'fulfilled') return 'ok'
  return result.value?.state === 'OPEN' ? 'degraded' : 'ok'
}

export async function GET() {
  const [paymentCircuit, aiCircuit, emailCircuit, dbResult] = await Promise.allSettled([
    redis.get<CircuitState>('circuit:vnpay'),
    redis.get<CircuitState>('circuit:ai'),
    redis.get<CircuitState>('circuit:email'),
    db.$queryRaw`SELECT 1`,
  ])

  return Response.json({
    payment: circuitStatus(paymentCircuit),
    ai: circuitStatus(aiCircuit),
    email: circuitStatus(emailCircuit),
    db: dbResult.status === 'fulfilled' ? 'ok' : 'degraded',
  })
}
