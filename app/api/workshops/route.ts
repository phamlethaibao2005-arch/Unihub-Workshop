import { NextResponse } from 'next/server'
import { unstable_rethrow } from 'next/navigation'
import { workshopsListLimiter, retryAfterSeconds } from '@/lib/ratelimit'
import { Container } from '@/shared/infrastructure/Container'
import { EventBus } from '@/shared/infrastructure/EventBus'
import { WorkshopService } from '@/modules/workshop/application/WorkshopService'
import type { IWorkshopRepository } from '@/modules/workshop/domain/IWorkshopRepository'
import { WorkshopStatus } from '@/modules/workshop/domain/WorkshopStatus'
import { toWorkshopDTO } from '@/shared/types/workshop-presenter'
import { toResponse } from '@/shared/errors/handle'


const PAGE_SIZE = 12

function getService() {
  return new WorkshopService(Container.resolve<IWorkshopRepository>('workshopRepository'), EventBus)
}

function parsePage(value: string | null): number {
  const page = Number.parseInt(value ?? '1', 10)
  return Number.isFinite(page) && page > 0 ? page : 1
}

function parseDate(value: string | null): Date | undefined {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function parseDateTime(value: string | null): Date | undefined {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

export async function GET(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1'
    if (workshopsListLimiter) {
      const { success, reset } = await workshopsListLimiter.limit(ip)
      if (!success) {
        return NextResponse.json(
          { error: 'Too many requests', code: 'RATE_LIMIT_EXCEEDED' },
          { status: 429, headers: { 'Retry-After': String(retryAfterSeconds(reset)) } },
        )
      }
    }
    const url = new URL(req.url)
    const page = parsePage(url.searchParams.get('page'))
    const date = parseDate(url.searchParams.get('date'))
    const dateFrom = parseDateTime(url.searchParams.get('dateFrom'))
    const dateTo = parseDateTime(url.searchParams.get('dateTo'))
    const category = url.searchParams.get('category')?.trim().toLowerCase() || undefined
    const search = url.searchParams.get('q')?.trim() || undefined
    const priceFilter = (url.searchParams.get('priceFilter') || undefined) as
      | 'free'
      | 'paid'
      | undefined

    const filters = {
      status: WorkshopStatus.ACTIVE,
      date,
      dateFrom,
      dateTo,
      priceFilter,
      search,
    }

    // category is derived from description at runtime, cannot be filtered in DB
    if (category) {
      const { items } = await getService().list({ filters, page: 1, size: 500 })
      const filtered = items
        .map(toWorkshopDTO)
        .filter((w) => w.category.toLowerCase().includes(category))
      const start = (page - 1) * PAGE_SIZE
      return NextResponse.json({
        items: filtered.slice(start, start + PAGE_SIZE),
        page,
        total: filtered.length,
      })
    }

    const result = await getService().list({ filters, page, size: PAGE_SIZE })
    return NextResponse.json({
      items: result.items.map(toWorkshopDTO),
      page: result.page,
      total: result.total,
    })
  } catch (err) {
    unstable_rethrow(err)
    return toResponse(err)
  }
}
