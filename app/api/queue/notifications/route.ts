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

export async function POST(req: NextRequest) {
  try {
    await verifyQStashSignature(req.clone() as unknown as NextRequest)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = (await req.json()) as NotificationPayload
  await buildService().notify(payload)
  return NextResponse.json({ ok: true })
}
