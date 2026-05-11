import { NextResponse } from 'next/server'
import { unstable_rethrow } from 'next/navigation'
import { db } from '@/shared/infrastructure/PrismaClient'
import { requireAuth } from '@/lib/session'
import { toResponse } from '@/shared/errors/handle'

export async function GET() {
  try {
    const session = await requireAuth()
    const count = await db.notification.count({
      where: { userId: session.user.id, read: false },
    })
    return NextResponse.json({ count })
  } catch (err) {
    unstable_rethrow(err)
    return toResponse(err)
  }
}
