import type { PrismaClient } from '@prisma/client'
import type { IIdempotencyService } from './IIdempotencyService'

export class IdempotencyService implements IIdempotencyService {
  constructor(private readonly prisma: PrismaClient) {}

  async runOnce<T>(key: string, ttlHours: number, fn: () => Promise<T>): Promise<T> {
    const now = new Date()

    const existing = await this.prisma.idempotencyRecord.findUnique({ where: { key } })
    if (existing && existing.expiresAt > now) {
      return existing.response as T
    }

    const result = await fn()

    const expiresAt = new Date(now.getTime() + ttlHours * 3_600_000)
    await this.prisma.idempotencyRecord.upsert({
      where: { key },
      create: { key, response: result as object, expiresAt },
      update: { response: result as object, expiresAt },
    })

    return result
  }
}
