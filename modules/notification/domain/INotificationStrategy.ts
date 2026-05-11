import type { NotificationPayload } from './NotificationPayload'

export interface INotificationStrategy {
  readonly channel: 'EMAIL' | 'IN_APP'
  send(payload: NotificationPayload): Promise<void>
}
