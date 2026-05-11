import type { PrismaClient } from '@prisma/client'
import type { INotificationLogRepository, LogEntry } from '../domain/INotificationLogRepository'

export class PrismaNotificationLogRepository implements INotificationLogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async log(entry: LogEntry): Promise<void> {
    await this.prisma.notificationLog.create({
      data: {
        userId: entry.userId,
        channel: entry.channel,
        type: entry.type,
        status: entry.status,
        errorMessage: entry.errorMessage,
      },
    })
  }
}
