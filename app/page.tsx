import { Footer } from '@/components/Footer'
import { EditorialCTA } from '@/components/landing/EditorialCTA'
import { Hero3D } from '@/components/landing/Hero3D'
import { Nav } from '@/components/landing/Nav'
import { TechShowcase } from '@/components/landing/TechShowcase'
import { WorkshopGrid } from '@/components/landing/WorkshopGrid'
import { Container } from '@/shared/infrastructure/Container'
import { EventBus } from '@/shared/infrastructure/EventBus'
import { WorkshopService } from '@/modules/workshop/application/WorkshopService'
import type { IWorkshopRepository } from '@/modules/workshop/domain/IWorkshopRepository'
import { WorkshopStatus } from '@/modules/workshop/domain/WorkshopStatus'
import { toWorkshopDTO } from '@/shared/types/workshop-presenter'


const MARQUEE_ITEMS = [
  'AI PIPELINES',
  'CLOUD NATIVE',
  'FINTECH LAB',
  'DESIGN SYSTEMS',
  'DATA OPS',
  'PAYMENT SECURITY',
]

function getService() {
  return new WorkshopService(Container.resolve<IWorkshopRepository>('workshopRepository'), EventBus)
}

async function getFeaturedWorkshops() {
  const result = await getService().list({
    filters: { status: WorkshopStatus.ACTIVE },
    page: 1,
    size: 6,
  })
  return result.items.map(toWorkshopDTO)
}

export default async function Home() {
  const featured = await getFeaturedWorkshops()
  const marquee = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS]

  return (
    <main className="bg-canvas text-ink">
      <Nav />
      <Hero3D />

      <section>
        <WorkshopGrid items={featured} />
      </section>

      <section className="overflow-hidden border-y border-hairline bg-canvas py-4">
        <div className="marquee-track flex w-max gap-8 whitespace-nowrap">
          {marquee.map((item, index) => (
            <span
              key={`${item}-${index}`}
              className="font-display text-[40px] uppercase leading-none text-ink"
            >
              {item}
            </span>
          ))}
        </div>
      </section>

      <TechShowcase />
      <EditorialCTA />
      <Footer />
    </main>
  )
}
