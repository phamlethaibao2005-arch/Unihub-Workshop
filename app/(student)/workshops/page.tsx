import Link from 'next/link'
import { Footer } from '@/components/Footer'
import { WorkshopGrid } from '@/components/landing/WorkshopGrid'
import { cn } from '@/lib/utils'
import { WorkshopService } from '@/modules/workshop/application/WorkshopService'
import type { IWorkshopRepository } from '@/modules/workshop/domain/IWorkshopRepository'
import { WorkshopStatus } from '@/modules/workshop/domain/WorkshopStatus'
import { Container } from '@/shared/infrastructure/Container'
import { EventBus } from '@/shared/infrastructure/EventBus'
import { toWorkshopDTO } from '@/shared/types/workshop-presenter'
import type { WorkshopDTO } from '@/shared/types/workshop'

const PAGE_SIZE = 12

const PRICE_FILTERS = [
  { label: 'Tất cả', value: 'all' },
  { label: 'Miễn phí', value: 'free' },
  { label: 'Có phí', value: 'paid' },
]

const DATE_FILTERS = [
  { label: 'Tất cả ngày', value: 'all' },
  { label: 'Hôm nay', value: 'today' },
  { label: '7 ngày tới', value: 'week' },
  { label: 'Tháng này', value: 'month' },
]

type Search = {
  priceFilter?: string
  date?: string
  q?: string
  page?: string
}

function getService() {
  return new WorkshopService(Container.resolve<IWorkshopRepository>('workshopRepository'), EventBus)
}

function buildHref(
  filters: { priceFilter: string; date: string; q: string; page: string },
  next: Partial<{ priceFilter: string; date: string; q: string; page: string }>
) {
  const params = new URLSearchParams()
  const priceFilter = next.priceFilter ?? filters.priceFilter
  const date = next.date ?? filters.date
  const q = next.q ?? filters.q
  const page = next.page ?? filters.page

  if (priceFilter !== 'all') params.set('priceFilter', priceFilter)
  if (date !== 'all') params.set('date', date)
  if (q) params.set('q', q)
  if (page && page !== '1') params.set('page', page)

  const query = params.toString()
  return query ? `/workshops?${query}` : '/workshops'
}

function filterByDate(items: WorkshopDTO[], dateFilter: string): WorkshopDTO[] {
  if (dateFilter === 'all') return items

  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  if (dateFilter === 'today') {
    return items.filter((item) => new Date(`${item.date}T00:00:00`).getTime() === start.getTime())
  }

  if (dateFilter === 'week') {
    const end = new Date(start)
    end.setDate(start.getDate() + 7)
    return items.filter((item) => {
      const date = new Date(`${item.date}T00:00:00`)
      return date >= start && date < end
    })
  }

  if (dateFilter === 'month') {
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1)
    return items.filter((item) => {
      const date = new Date(`${item.date}T00:00:00`)
      return date >= start && date < end
    })
  }

  return items
}

export default async function WorkshopsPage({
  searchParams,
}: {
  searchParams: Promise<Search>
}) {
  const query = await searchParams
  const filters = {
    priceFilter: query.priceFilter ?? 'all',
    date: query.date ?? 'all',
    q: query.q ?? '',
    page: query.page ?? '1',
  }

  const result = await getService().list({
    filters: { status: WorkshopStatus.ACTIVE },
    page: 1,
    size: 200,
  })

  let items = result.items.map(toWorkshopDTO)

  if (filters.priceFilter === 'free') items = items.filter((item) => item.price === 0)
  if (filters.priceFilter === 'paid') items = items.filter((item) => item.price > 0)
  items = filterByDate(items, filters.date)
  if (filters.q) {
    const lower = filters.q.toLowerCase()
    items = items.filter(
      (item) =>
        item.title.toLowerCase().includes(lower) ||
        item.category.toLowerCase().includes(lower) ||
        item.speaker.toLowerCase().includes(lower) ||
        item.location.toLowerCase().includes(lower)
    )
  }

  const currentPage = Math.max(1, parseInt(filters.page ?? '1'))
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const pagedItems = items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const buildPageHref = (p: number) => buildHref({ ...filters, page: '1' }, { page: String(p) })

  return (
    <main className="bg-canvas pb-16 text-ink">

      <section className="px-4 py-12 md:px-6 lg:px-10">
        <p className="text-[11px] uppercase tracking-[0.25em] text-ink/60">UNIHUB / WORKSHOPS</p>
        <h1 className="mt-4 font-display text-[64px] uppercase leading-[0.9] tracking-[-0.02em] text-ink md:text-[72px]">
          Tất Cả Workshop
        </h1>

        {filters.q && (
          <div className="mt-4 flex items-center gap-3">
            <p className="text-[14px] text-ink/70">
              Kết quả cho: <span className="font-semibold text-ink">&ldquo;{filters.q}&rdquo;</span>
              {' '}— {items.length} workshop
            </p>
            <Link
              href={buildHref(filters, { q: '', page: '1' })}
              className="text-[12px] text-ink/50 underline underline-offset-2 hover:text-ink"
            >
              Xóa tìm kiếm
            </Link>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          {PRICE_FILTERS.map((filter) => (
            <Link
              key={filter.value}
              href={buildHref(filters, { priceFilter: filter.value, page: '1' })}
              className={cn(
                'rounded-full border border-hairline bg-canvas px-4 py-2 text-[14px] font-medium text-ink',
                filters.priceFilter === filter.value && 'border-ink bg-ink text-white'
              )}
            >
              {filter.label}
            </Link>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {DATE_FILTERS.map((filter) => (
            <Link
              key={filter.value}
              href={buildHref(filters, { date: filter.value, page: '1' })}
              className={cn(
                'rounded-full border border-hairline bg-canvas px-4 py-2 text-[14px] font-medium text-ink',
                filters.date === filter.value && 'border-ink bg-ink text-white'
              )}
            >
              {filter.label}
            </Link>
          ))}
        </div>
      </section>

      <WorkshopGrid
        items={pagedItems}
        currentPage={safePage}
        totalPages={totalPages}
        buildPageHref={buildPageHref}
      />
      <Footer />
    </main>
  )
}
