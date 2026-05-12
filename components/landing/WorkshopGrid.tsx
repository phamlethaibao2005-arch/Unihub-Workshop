import Link from 'next/link'
import { WorkshopCard } from './WorkshopCard'
import type { WorkshopDTO } from '@/shared/types/workshop'

interface WorkshopGridProps {
  items: WorkshopDTO[]
  currentPage: number
  totalPages: number
  buildPageHref: (page: number) => string
}

export function WorkshopGrid({ items, currentPage, totalPages, buildPageHref }: WorkshopGridProps) {
  if (items.length === 0) {
    return (
      <section className="px-4 py-[48px] text-center text-[14px] uppercase tracking-[0.15em] text-ink/60 md:px-6 lg:px-10">
        Chưa có workshop nào
      </section>
    )
  }

  return (
    <section className="px-4 py-[48px] md:px-6 lg:px-10">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-5">
        {items.map((workshop) => (
          <WorkshopCard key={workshop.id} workshop={workshop} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-10 flex items-center justify-center gap-1">
          {currentPage > 1 && (
            <Link
              href={buildPageHref(currentPage - 1)}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-hairline text-[13px] text-ink/60 hover:border-ink hover:text-ink transition-colors"
            >
              ←
            </Link>
          )}
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => Math.abs(p - currentPage) <= 2)
            .map((p) => (
              <Link
                key={p}
                href={buildPageHref(p)}
                className={`flex h-9 w-9 items-center justify-center rounded-md text-[13px] transition-colors ${
                  p === currentPage
                    ? 'bg-ink text-canvas'
                    : 'border border-hairline text-ink/60 hover:border-ink hover:text-ink'
                }`}
              >
                {p}
              </Link>
            ))}
          {currentPage < totalPages && (
            <Link
              href={buildPageHref(currentPage + 1)}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-hairline text-[13px] text-ink/60 hover:border-ink hover:text-ink transition-colors"
            >
              →
            </Link>
          )}
        </div>
      )}
    </section>
  )
}
