import Link from 'next/link'
import Image from 'next/image'
import { Container } from '@/shared/infrastructure/Container'
import { EventBus } from '@/shared/infrastructure/EventBus'
import { WorkshopService } from '@/modules/workshop/application/WorkshopService'
import type { IWorkshopRepository } from '@/modules/workshop/domain/IWorkshopRepository'
import { toWorkshopDTO } from '@/shared/types/workshop-presenter'
import { PillButton } from '@/components/PillButton'
import { WorkshopCancelButton } from '@/components/admin/WorkshopCancelButton'

function getService() {
  return new WorkshopService(
    Container.resolve<IWorkshopRepository>('workshopRepository'),
    EventBus,
  )
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default async function AdminWorkshopsPage() {
  const { items } = await getService().list({ page: 1, size: 100 })
  const workshops = items.map(toWorkshopDTO)

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-ink/60">ADMIN / QUẢN LÝ</p>
          <h1 className="font-display text-[48px] uppercase leading-[0.9] text-ink">Workshops</h1>
        </div>
        <PillButton asChild>
          <Link href="/admin/workshops/new">Tạo workshop mới</Link>
        </PillButton>
      </div>

      {workshops.length === 0 && (
        <p className="py-16 text-center text-ink/40">Chưa có workshop nào.</p>
      )}

      <div className="grid grid-cols-2 gap-6 xl:grid-cols-3">
        {workshops.map((w) => (
          <div key={w.id} className="group relative">
            {/* Card */}
            <div className="border border-hairline bg-canvas">
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-cloud">
                <Image
                  src={w.cover}
                  alt={w.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover"
                />
                {w.badge && (
                  <span className={`badge-promo absolute left-3 top-3 z-10 ${w.badge === 'Just In' ? 'badge-red' : 'badge-green'}`}>
                    {w.badge}
                  </span>
                )}
              </div>
              <div className="p-4">
                <p className="text-[11px] uppercase tracking-[0.15em] text-ink/50">{w.category}</p>
                <p className="mt-1 font-semibold uppercase leading-snug tracking-tight text-ink">{w.title}</p>
                <p className="mt-0.5 text-[13px] text-ink/60">{w.speaker}</p>
                <div className="mt-2 flex items-center justify-between text-[12px] text-ink/50">
                  <span>{formatDate(w.date)} · {w.time}</span>
                  <span>{w.seatsTaken}/{w.seatsTotal} chỗ</span>
                </div>
              </div>
            </div>

            {/* Hover overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-canvas/90 opacity-0 transition-opacity group-hover:opacity-100">
              <PillButton asChild>
                <Link href={`/admin/workshops/${w.id}/edit`}>Sửa</Link>
              </PillButton>
              <WorkshopCancelButton workshopId={w.id} title={w.title} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
