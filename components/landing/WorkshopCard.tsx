import Image from 'next/image'
import Link from 'next/link'
import { SeatBar } from './SeatBar'
import type { WorkshopDTO } from '@/shared/types/workshop'

function formatPrice(price: number): { label: string; isDisplay: boolean } {
  if (price === 0) return { label: 'Miễn phí', isDisplay: false }
  return {
    label: new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price),
    isDisplay: true,
  }
}

export function WorkshopCard({ workshop }: { workshop: WorkshopDTO }) {
  const price = formatPrice(workshop.price)

  return (
    <Link
      href={`/workshops/${workshop.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-hairline bg-canvas transition-colors hover:border-ink/30"
    >
      {/* Image */}
      <div className="relative h-40 overflow-hidden bg-cloud sm:h-44 lg:h-48">
        <Image
          src={workshop.cover}
          alt={workshop.title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          loading="lazy"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />

        {/* Date gradient overlay */}
        <div className="absolute bottom-0 inset-x-0 bg-linear-to-t from-black/60 to-transparent px-3 py-2">
          <p className="text-[11px] text-white/80">{workshop.date} · {workshop.time}</p>
        </div>

        {/* Badge */}
        {workshop.badge && (
          <span
            className={`badge-promo absolute left-3 top-3 z-10 ${
              workshop.badge === 'Just In' ? 'badge-red' : 'badge-green'
            }`}
          >
            {workshop.badge}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col gap-2 p-4">
        <p className="text-[11px] uppercase tracking-wide text-ink/40">{workshop.category}</p>
        <p className="text-[14px] font-semibold leading-snug text-ink line-clamp-2">{workshop.title}</p>
        <p className="text-[12px] text-ink/50">{workshop.speaker}</p>

        <SeatBar taken={workshop.seatsTaken} total={workshop.seatsTotal} />

        <div className="flex items-center justify-between pt-1">
          <span className="text-[12px] text-ink/50">{workshop.location}</span>
          {price.isDisplay ? (
            <span className="shrink-0 font-display text-[18px] text-ink">{price.label}</span>
          ) : (
            <span className="shrink-0 text-[13px] font-semibold text-emerald">{price.label}</span>
          )}
        </div>
      </div>
    </Link>
  )
}
