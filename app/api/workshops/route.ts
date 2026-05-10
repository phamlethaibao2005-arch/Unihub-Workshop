import { NextResponse } from 'next/server'
import { unstable_rethrow } from 'next/navigation'
import { Container } from '@/shared/infrastructure/Container'
import { EventBus } from '@/shared/infrastructure/EventBus'
import { WorkshopService } from '@/modules/workshop/application/WorkshopService'
import type { IWorkshopRepository } from '@/modules/workshop/domain/IWorkshopRepository'
import { WorkshopStatus } from '@/modules/workshop/domain/WorkshopStatus'
import { toWorkshopDTO } from '@/shared/types/workshop-presenter'
import { toResponse } from '@/shared/errors/handle'

export const dynamic = 'force-dynamic'

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

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const page = parsePage(url.searchParams.get('page'))
    const date = parseDate(url.searchParams.get('date'))
    const category = url.searchParams.get('category')?.trim().toLowerCase()
    const priceFilter = url.searchParams.get('priceFilter')

    const result = await getService().list({
      filters: {
        status: WorkshopStatus.ACTIVE,
        date,
      },
      page: 1,
      size: 500,
    })

    let allItems = result.items.map(toWorkshopDTO)

    if (category) {
      allItems = allItems.filter((item) => item.category.toLowerCase().includes(category))
    }
    if (priceFilter === 'free') {
      allItems = allItems.filter((item) => item.price === 0)
    }
    if (priceFilter === 'paid') {
      allItems = allItems.filter((item) => item.price > 0)
    }

    const start = (page - 1) * PAGE_SIZE
    const items = allItems.slice(start, start + PAGE_SIZE)

    return NextResponse.json({ items, page, total: allItems.length })
  } catch (err) {
    unstable_rethrow(err)
    return toResponse(err)
  }
}
