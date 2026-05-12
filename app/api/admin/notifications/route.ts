import { NextResponse } from 'next/server'
import { unstable_rethrow } from 'next/navigation'
import type { Prisma } from '@prisma/client'
import { db } from '@/shared/infrastructure/PrismaClient'
import { requireRole } from '@/lib/session'
import { Role } from '@/modules/auth/domain/Role'
import { toResponse } from '@/shared/errors/handle'

const DEFAULT_PAGE_SIZE = 12
const MAX_PAGE_SIZE = 50

function parseNumber(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  if (!Number.isFinite(parsed)) return fallback
  return parsed
}

export async function GET(req: Request) {
  try {
    await requireRole(Role.ORGANIZER)

    const url = new URL(req.url)
    const page = Math.max(1, parseNumber(url.searchParams.get('page'), 1))
    const size = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseNumber(url.searchParams.get('size'), DEFAULT_PAGE_SIZE))
    )
    const readParam = url.searchParams.get('read')
    const typeParam = url.searchParams.get('type')?.trim() || undefined
    const query = url.searchParams.get('q')?.trim() || undefined

    const where: Prisma.NotificationWhereInput = {}
    if (readParam === 'true') where.read = true
    if (readParam === 'false') where.read = false
    if (typeParam) where.type = typeParam
    if (query) {
      where.OR = [
        { title: { contains: query, mode: 'insensitive' } },
        { body: { contains: query, mode: 'insensitive' } },
        { user: { name: { contains: query, mode: 'insensitive' } } },
        { user: { email: { contains: query, mode: 'insensitive' } } },
      ]
    }

    const skip = (page - 1) * size

    const [items, total, unread] = await db.$transaction([
      db.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: size,
        include: {
          user: { select: { name: true, email: true, image: true } },
        },
      }),
      db.notification.count({ where }),
      db.notification.count({ where: { read: false } }),
    ])

    return NextResponse.json({
      items,
      page,
      size,
      total,
      unread,
    })
  } catch (err) {
    unstable_rethrow(err)
    return toResponse(err)
  }
}
