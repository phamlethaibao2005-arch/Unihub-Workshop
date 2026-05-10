import { WorkshopCard } from './WorkshopCard'
import type { WorkshopDTO } from '@/shared/types/workshop'

export function WorkshopGrid({ items }: { items: WorkshopDTO[] }) {
  if (items.length === 0) {
    return (
      <section className="px-4 py-[48px] text-center text-[14px] uppercase tracking-[0.15em] text-ink/60 md:px-6 lg:px-10">
        Chưa có workshop nào
      </section>
    )
  }

  return (
    <section className="px-4 py-[48px] md:px-6 lg:px-10">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((workshop) => (
          <WorkshopCard key={workshop.id} workshop={workshop} />
        ))}
      </div>
    </section>
  )
}
