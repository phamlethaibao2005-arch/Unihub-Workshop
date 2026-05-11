import type { PrismaClient } from '@prisma/client'
import type { INotificationStrategy } from '../domain/INotificationStrategy'
import type { NotificationPayload } from '../domain/NotificationPayload'

function buildContent(payload: NotificationPayload): { title: string; body: string } {
  switch (payload.type) {
    case 'REGISTRATION_CONFIRMED':
      return {
        title: 'Đăng ký thành công',
        body: `Bạn đã đăng ký ${payload.data.workshopTitle} vào ngày ${payload.data.workshopDate}.`,
      }
    case 'PAYMENT_FAILED':
      return {
        title: 'Thanh toán thất bại',
        body: `Thanh toán cho ${payload.data.workshopTitle} không thành công. Vui lòng thử lại.`,
      }
    case 'WORKSHOP_CANCELLED':
      return {
        title: 'Workshop bị huỷ',
        body: `Workshop ${payload.data.workshopTitle} ngày ${payload.data.workshopDate} đã bị huỷ.`,
      }
    case 'WORKSHOP_UPDATED':
      return {
        title: 'Workshop có cập nhật',
        body: `${payload.data.workshopTitle}: ${payload.data.changes}`,
      }
    case 'CHECKIN_REMINDER':
      return {
        title: 'Nhắc nhở check-in',
        body: `${payload.data.workshopTitle} sẽ bắt đầu trong 30 phút tại ${payload.data.workshopRoom}.`,
      }
  }
}

export class InAppNotificationStrategy implements INotificationStrategy {
  readonly channel = 'IN_APP' as const

  constructor(private readonly prisma: PrismaClient) {}

  async send(payload: NotificationPayload): Promise<void> {
    const { title, body } = buildContent(payload)
    await this.prisma.notification.create({
      data: {
        userId: payload.userId,
        type: payload.type,
        title,
        body,
      },
    })
  }
}
