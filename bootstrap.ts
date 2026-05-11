import QRCode from 'qrcode'
import { put } from '@vercel/blob'
import { EventBus } from '@/shared/infrastructure/EventBus'
import { enqueue } from '@/shared/infrastructure/QStashClient'
import { db } from '@/shared/infrastructure/PrismaClient'
import type { RegistrationConfirmedEvent } from '@/modules/registration/domain/events/RegistrationConfirmedEvent'
import type { PaymentFailedEvent } from '@/modules/payment/domain/events/PaymentFailedEvent'
import type { WorkshopCancelledEvent } from '@/modules/workshop/domain/events/WorkshopCancelledEvent'
import type { WorkshopUpdatedEvent } from '@/modules/workshop/domain/events/WorkshopUpdatedEvent'
import type { NotificationPayload } from '@/modules/notification/domain/NotificationPayload'

const BASE_URL = process.env.BETTER_AUTH_URL!
const DEST = `${BASE_URL}/api/queue/notifications`

function fmtDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

EventBus.subscribe<RegistrationConfirmedEvent>('registration.confirmed', async (event) => {
  const [workshop, user] = await Promise.all([
    db.workshop.findUnique({
      where: { id: event.workshopId },
      select: { title: true, date: true, room: true },
    }),
    db.user.findUnique({
      where: { id: event.userId },
      select: { email: true },
    }),
  ])
  if (!workshop || !user?.email) return

  const qrBuffer = await QRCode.toBuffer(event.qrCode, {
    errorCorrectionLevel: 'H',
    margin: 0,
    width: 320,
  })
  const { url: qrCodeUrl } = await put(
    `qr/${event.registrationId}.png`,
    qrBuffer,
    { access: 'public' },
  )

  const payload: NotificationPayload = {
    type: 'REGISTRATION_CONFIRMED',
    userId: event.userId,
    userEmail: user.email,
    data: {
      workshopTitle: workshop.title,
      workshopDate: fmtDate(workshop.date),
      workshopRoom: workshop.room,
      qrCodeDataUrl: qrCodeUrl,
    },
  }

  await enqueue(DEST, payload, {
    deduplicationId: `${event.userId}-REG_CONFIRMED-${event.registrationId}`,
    retries: 3,
  })
})

EventBus.subscribe<PaymentFailedEvent>('payment.failed', async (event) => {
  const registration = await db.registration.findUnique({
    where: { id: event.registrationId },
    include: {
      user: { select: { email: true } },
      workshop: { select: { title: true, date: true } },
    },
  })
  if (!registration?.user?.email) return

  const payload: NotificationPayload = {
    type: 'PAYMENT_FAILED',
    userId: registration.userId,
    userEmail: registration.user.email,
    data: {
      workshopTitle: registration.workshop.title,
      workshopDate: fmtDate(registration.workshop.date),
      reason: event.reason,
    },
  }

  await enqueue(DEST, payload, {
    deduplicationId: `${registration.userId}-PAY_FAILED-${event.paymentId}`,
    retries: 3,
  })
})

EventBus.subscribe<WorkshopCancelledEvent>('workshop.cancelled', async (event) => {
  const [workshop, registrations] = await Promise.all([
    db.workshop.findUnique({
      where: { id: event.workshopId },
      select: { date: true },
    }),
    db.registration.findMany({
      where: { workshopId: event.workshopId, status: 'CONFIRMED' },
      select: { userId: true, user: { select: { email: true } } },
    }),
  ])
  if (!workshop) return

  await Promise.all(
    registrations
      .filter((reg) => !!reg.user?.email)
      .map((reg, i) => {
        const payload: NotificationPayload = {
          type: 'WORKSHOP_CANCELLED',
          userId: reg.userId,
          userEmail: reg.user!.email!,
          data: {
            workshopTitle: event.title,
            workshopDate: fmtDate(workshop.date),
          },
        }
        return enqueue(DEST, payload, {
          deduplicationId: `${reg.userId}-WS_CANCELLED-${event.workshopId}`,
          retries: 3,
          delay: i > 0 ? Math.round(i * 1.2) : undefined,
        })
      }),
  )
})

EventBus.subscribe<WorkshopUpdatedEvent>('workshop.updated', async (event) => {
  const [workshop, registrations] = await Promise.all([
    db.workshop.findUnique({
      where: { id: event.workshopId },
      select: { title: true },
    }),
    db.registration.findMany({
      where: { workshopId: event.workshopId, status: 'CONFIRMED' },
      select: { userId: true, user: { select: { email: true } } },
    }),
  ])
  if (!workshop) return

  const changes = event.updatedFields.join(', ')

  await Promise.all(
    registrations
      .filter((reg) => !!reg.user?.email)
      .map((reg) => {
        const payload: NotificationPayload = {
          type: 'WORKSHOP_UPDATED',
          userId: reg.userId,
          userEmail: reg.user!.email!,
          data: {
            workshopTitle: workshop.title,
            changes,
          },
        }
        return enqueue(DEST, payload, {
          deduplicationId: `${reg.userId}-WS_UPDATED-${event.workshopId}-${event.occurredAt.toISOString()}`,
          retries: 3,
        })
      }),
  )
})
