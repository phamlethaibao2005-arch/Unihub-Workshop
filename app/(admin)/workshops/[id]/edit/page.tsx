import { notFound } from 'next/navigation'
import { AISummaryTerminal } from '@/components/dashboard/AISummaryTerminal'
import { AISummaryStatus } from '@/modules/workshop/domain/AISummaryStatus'
import { WorkshopService } from '@/modules/workshop/application/WorkshopService'
import type { IWorkshopRepository } from '@/modules/workshop/domain/IWorkshopRepository'
import { Container } from '@/shared/infrastructure/Container'
import { EventBus } from '@/shared/infrastructure/EventBus'

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

  return (
    <main className="bg-canvas px-4 py-10 text-ink md:px-8">
      <div className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.25em] text-ink/60">WORKSHOP / AI</p>
        <h1 className="font-display text-[32px] uppercase leading-[0.9]">{workshop.title}</h1>
      </div>

      <AISummaryTerminal
        workshopId={workshop.id}
        status={workshop.aiSummaryStatus}
        failureReason={
          workshop.aiSummaryStatus === AISummaryStatus.FAILED ? workshop.aiSummary : null
        }
      />
    </main>
  )
}
