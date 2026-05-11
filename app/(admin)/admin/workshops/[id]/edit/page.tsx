import { notFound } from 'next/navigation'
import { AISummaryTerminal } from '@/components/dashboard/AISummaryTerminal'
import { WorkshopForm } from '@/components/admin/WorkshopForm'
import { WorkshopCancelButton } from '@/components/admin/WorkshopCancelButton'
import { AISummaryStatus } from '@/modules/workshop/domain/AISummaryStatus'
import { WorkshopStatus } from '@/modules/workshop/domain/WorkshopStatus'
import { WorkshopService } from '@/modules/workshop/application/WorkshopService'
import type { IWorkshopRepository } from '@/modules/workshop/domain/IWorkshopRepository'
import { Container } from '@/shared/infrastructure/Container'
import { EventBus } from '@/shared/infrastructure/EventBus'
import { toWorkshopDetailDTO } from '@/shared/types/workshop-presenter'

function getService() {
  return new WorkshopService(Container.resolve<IWorkshopRepository>('workshopRepository'), EventBus)
}

export default async function AdminWorkshopEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const workshop = await getService().getById(id).catch(() => notFound())
  const dto = toWorkshopDetailDTO(workshop)
  const isCancelled = workshop.status === WorkshopStatus.CANCELLED

  return (
    <div className="space-y-12">
      {/* Header */}
      <div>
        <p className="text-[11px] uppercase tracking-[0.25em] text-ink/60">ADMIN / WORKSHOPS / SỬA</p>
        <h1 className="font-display text-[48px] uppercase leading-[0.9] text-ink">{workshop.title}</h1>
        {isCancelled && (
          <span className="mt-2 inline-block border border-nikered px-3 py-1 text-[11px] uppercase tracking-[0.15em] text-nikered">
            Đã hủy
          </span>
        )}
      </div>

      {/* Edit form */}
      {!isCancelled && (
        <section>
          <p className="mb-5 text-[11px] uppercase tracking-[0.2em] text-ink/60">Thông tin workshop</p>
          <WorkshopForm initial={dto} />
        </section>
      )}

      {/* AI Summary terminal */}
      <section>
        <p className="mb-3 text-[11px] uppercase tracking-[0.2em] text-ink/60">AI Summary</p>
        <AISummaryTerminal
          workshopId={workshop.id}
          status={workshop.aiSummaryStatus}
          failureReason={
            workshop.aiSummaryStatus === AISummaryStatus.FAILED ? workshop.aiSummary : null
          }
          readOnly={isCancelled}
        />
      </section>

      {/* Danger zone */}
      {!isCancelled && (
        <section className="border border-nikered/30 p-6">
          <p className="mb-1 text-[11px] uppercase tracking-[0.2em] text-nikered">Danger Zone</p>
          <p className="mb-5 text-[13px] text-ink/60">
            Hủy workshop sẽ gửi thông báo đến tất cả sinh viên đã đăng ký. Hành động này không thể hoàn tác.
          </p>
          <WorkshopCancelButton workshopId={workshop.id} title={workshop.title} />
        </section>
      )}
    </div>
  )
}
