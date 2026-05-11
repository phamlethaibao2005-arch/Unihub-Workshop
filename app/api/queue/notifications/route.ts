// app/api/queue/notifications/route.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyQStashSignature } from '@/shared/infrastructure/QStashClient'
import { db } from '@/shared/infrastructure/PrismaClient'
import { NotificationService } from '@/modules/notification/application/NotificationService'
import { EmailNotificationStrategy } from '@/modules/notification/infrastructure/EmailNotificationStrategy'
import { InAppNotificationStrategy } from '@/modules/notification/infrastructure/InAppNotificationStrategy'
import { PrismaNotificationLogRepository } from '@/modules/notification/infrastructure/PrismaNotificationLogRepository'
import type { NotificationPayload } from '@/modules/notification/domain/NotificationPayload'

function buildService() {
  return new NotificationService(
    [new EmailNotificationStrategy(), new InAppNotificationStrategy(db)],
    new PrismaNotificationLogRepository(db),
  )
}

// DEBUG: remove after confirming Vercel deployment works
export async function GET() {
  return NextResponse.json({
    ok: true,
    dest: `${process.env.BETTER_AUTH_URL ?? '(not set)'}/api/queue/notifications`,
    resendFrom: process.env.RESEND_FROM_EMAIL ?? '(not set)',
    hasQstashToken: !!process.env.QSTASH_TOKEN,
    hasBlobToken: !!process.env.BLOB_READ_WRITE_TOKEN,
  })
}

export async function POST(req: NextRequest) {
  console.log('[queue/notifications] POST received')
  try {
    await verifyQStashSignature(req.clone() as unknown as NextRequest)
  } catch (err) {
    console.error('[queue/notifications] Signature verification failed:', err)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = (await req.json()) as NotificationPayload
  console.log('[queue/notifications] Processing payload type:', payload.type, 'for:', payload.userEmail)
  try {
    await buildService().notify(payload)
    console.log('[queue/notifications] notify() completed successfully')
  } catch (err) {
    console.error('[queue/notifications] notify() failed:', err)
    throw err
  }
  return NextResponse.json({ ok: true })
}
