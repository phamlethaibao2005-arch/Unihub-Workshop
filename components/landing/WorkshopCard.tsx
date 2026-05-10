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
    <Link href={`/workshops/${workshop.id}`} className="block rounded-none bg-canvas shadow-none">
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-cloud">
        <Image
          src={workshop.cover}
          alt={workshop.title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover"
          loading="lazy"
        />
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

      <div className="mt-2 flex flex-col gap-2">
        <p className="text-[13px] font-medium text-ink/60">{workshop.category}</p>
        <p className="text-[15px] font-semibold uppercase leading-snug tracking-tight text-ink">
          {workshop.title}
        </p>
        <p className="text-[13px] font-medium text-ink/60">{workshop.speaker}</p>

        <SeatBar taken={workshop.seatsTaken} total={workshop.seatsTotal} />

        <div className="mt-1 flex items-end justify-between gap-3">
          <span className="text-[12px] leading-snug text-ink/60">
            {workshop.time} / {workshop.location}
          </span>
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
