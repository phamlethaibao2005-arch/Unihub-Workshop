import { NextResponse } from 'next/server'
import { unstable_rethrow } from 'next/navigation'
import { db } from '@/shared/infrastructure/PrismaClient'
import { requireAuth } from '@/lib/session'
import { toResponse } from '@/shared/errors/handle'

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth()
    const { id } = await params
    await db.notification.updateMany({
      where: { id, userId: session.user.id },
      data: { read: true },
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    unstable_rethrow(err)
    return toResponse(err)
  }
}
