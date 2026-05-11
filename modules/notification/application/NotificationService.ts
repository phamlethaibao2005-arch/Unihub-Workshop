import type { INotificationStrategy } from '../domain/INotificationStrategy'
import type { INotificationLogRepository } from '../domain/INotificationLogRepository'
import type { NotificationPayload } from '../domain/NotificationPayload'

export class NotificationService {
  constructor(
    private readonly strategies: INotificationStrategy[],
    private readonly logRepo: INotificationLogRepository,
  ) {}

  async notify(payload: NotificationPayload): Promise<void> {
    const results = await Promise.allSettled(
      this.strategies.map((s) => s.send(payload)),
    )

    await Promise.allSettled(
      this.strategies.map((s, i) => {
        const result = results[i]
        return this.logRepo.log({
          userId: payload.userId,
          channel: s.channel,
          type: payload.type,
          status: result.status === 'fulfilled' ? 'SENT' : 'FAILED',
          errorMessage:
            result.status === 'rejected' ? String(result.reason) : undefined,
        })
      }),
    )
  }
}
