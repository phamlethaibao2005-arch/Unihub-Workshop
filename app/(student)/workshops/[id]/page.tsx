import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { Footer } from '@/components/Footer'
import { LiveSeatBar } from '@/components/landing/LiveSeatBar'
import { Nav } from '@/components/landing/Nav'
import { PillButton } from '@/components/PillButton'
import { getSession } from '@/lib/session'
import { AISummaryStatus } from '@/modules/workshop/domain/AISummaryStatus'
import { WorkshopService } from '@/modules/workshop/application/WorkshopService'
import type { IWorkshopRepository } from '@/modules/workshop/domain/IWorkshopRepository'
import { db } from '@/shared/infrastructure/PrismaClient'
import { redis } from '@/shared/infrastructure/RedisClient'
import { Container } from '@/shared/infrastructure/Container'
import { EventBus } from '@/shared/infrastructure/EventBus'
import { toWorkshopDetailDTO } from '@/shared/types/workshop-presenter'
import type { WorkshopDetailDTO } from '@/shared/types/workshop'

export const dynamic = 'force-dynamic'

type PaymentStatus = 'ok' | 'degraded'

function getService() {
  return new WorkshopService(Container.resolve<IWorkshopRepository>('workshopRepository'), EventBus)
}

function formatPrice(price: number): { label: string; isDisplay: boolean } {
  if (price === 0) return { label: 'Miễn phí', isDisplay: false }
  return {
    label: new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price),
    isDisplay: true,
  }
}

async function getPaymentStatus(): Promise<PaymentStatus> {
  if (process.env.PAYMENT_STATUS === 'degraded') return 'degraded'

  try {
    const status = await redis.get<{ payment?: string }>('system:status')
    return status?.payment === 'degraded' ? 'degraded' : 'ok'
  } catch {
    return 'ok'
  }
}

async function isUserRegistered(workshopId: string): Promise<boolean> {
  const session = await getSession()
  if (!session?.user.id) return false

  const registration = await db.registration.findUnique({
    where: {
      userId_workshopId: {
        userId: session.user.id,
        workshopId,
      },
    },
    select: { status: true },
  })

  return registration?.status === 'CONFIRMED' || registration?.status === 'PENDING'
}

function renderMarkdown(source: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const lines = source.split('\n')
  let list: string[] = []

  const flushList = (key: number) => {
    if (list.length === 0) return
    nodes.push(
      <ul key={`list-${key}`} className="list-disc space-y-1 pl-5 text-[15px] leading-relaxed text-ink">
        {list.map((item, index) => (
          <li key={`${key}-${index}`}>{item}</li>
        ))}
      </ul>
    )
    list = []
  }

  lines.forEach((line, index) => {
    const trimmed = line.trim()
    if (trimmed.startsWith('- ')) {
      list.push(trimmed.slice(2))
      return
    }

    if (trimmed === '') {
      flushList(index)
      return
    }

    flushList(index)

    if (trimmed.startsWith('## ')) {
      nodes.push(
        <h3 key={`h3-${index}`} className="text-[18px] font-semibold text-ink">
          {trimmed.slice(3)}
        </h3>
      )
      return
    }

    if (trimmed.startsWith('# ')) {
      nodes.push(
        <h2 key={`h2-${index}`} className="text-[22px] font-semibold text-ink">
          {trimmed.slice(2)}
        </h2>
      )
      return
    }

    nodes.push(
      <p key={`p-${index}`} className="text-[15px] leading-relaxed text-ink">
        {trimmed}
      </p>
    )
  })

  flushList(lines.length)
  return nodes
}

function CtaButton({
  isFull,
  isRegistered,
  paymentDegraded,
  price,
}: {
  isFull: boolean
  isRegistered: boolean
  paymentDegraded: boolean
  price: number
}) {
  if (paymentDegraded && price > 0) {
    return (
      <PillButton variant="primary" disabled className="w-full justify-center opacity-50">
        Thanh Toán Tạm Ngưng
      </PillButton>
    )
  }

  if (isRegistered) {
    return (
      <PillButton variant="primary" asChild className="w-full justify-center">
        <Link href="/my-registrations">Bạn Đã Đăng Ký</Link>
      </PillButton>
    )
  }

  if (isFull) {
    return (
      <PillButton variant="primary" disabled className="w-full justify-center opacity-50 cursor-pointer">
        Hết Chỗ
      </PillButton>
    )
  }

  return (
    <PillButton variant="primary" className="w-full justify-center cursor-pointer">
      Đăng Ký Ngay
    </PillButton>
  )
}

export default async function WorkshopDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  let workshop: WorkshopDetailDTO

  try {
    workshop = toWorkshopDetailDTO(await getService().getById(id))
  } catch {
    notFound()
  }

  const [registered, paymentStatus] = await Promise.all([
    isUserRegistered(workshop.id),
    getPaymentStatus(),
  ])
  const price = formatPrice(workshop.price)
  const isFull = workshop.seatsLeft <= 0
  const paymentDegraded = paymentStatus === 'degraded'

  return (
    <main className="bg-canvas pb-24 text-ink">
      <Nav />

      <section className="bg-ink text-white">
        <div className="grid grid-cols-1 items-center gap-10 px-4 py-12 md:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-10">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-white/60">
              {workshop.badge ? (
                <span
                  className={`badge-promo ${
                    workshop.badge === 'Just In' ? 'badge-red' : 'badge-green'
                  }`}
                >
                  {workshop.badge}
                </span>
              ) : null}
              <span>{workshop.category}</span>
            </div>
            <h1
              className="font-display uppercase leading-[0.9]"
              style={{ fontSize: 'clamp(64px, 6vw, 96px)' }}
            >
              {workshop.title}
            </h1>
            <div className="mt-6 flex flex-wrap items-center gap-4 text-[13px] text-white/70">
              <span>{workshop.speaker}</span>
              <span>{workshop.date}</span>
              <span>{workshop.time}</span>
              <span>{workshop.location}</span>
            </div>
          </div>

          <div className="relative aspect-square w-full max-w-105 justify-self-end bg-white/5">
            <Image
              src={workshop.cover}
              alt={workshop.title}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 420px"
              priority
            />
          </div>
        </div>
      </section>

      <section className="px-4 py-12 md:px-6 lg:px-10">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_320px]">
          <div className="space-y-12">
            <div>
              <p className="text-[11px] uppercase tracking-[0.25em] text-ink/60">AI SUMMARY</p>
              <h2 className="mt-3 font-display text-[32px] uppercase leading-[0.9]">
                Tóm Tắt Workshop
              </h2>

              <div className="mt-6">
                {workshop.aiSummaryStatus === AISummaryStatus.PROCESSING && (
                  <div className="h-16 animate-pulse bg-cloud p-4 text-[14px] text-ink/60">
                    Đang tạo tóm tắt...
                  </div>
                )}
                {workshop.aiSummaryStatus === AISummaryStatus.FAILED && (
                  <p className="text-[14px] text-nikered">Không thể tạo tóm tắt AI.</p>
                )}
                {workshop.aiSummaryStatus === AISummaryStatus.COMPLETED && workshop.aiSummary && (
                  <div className="space-y-3">{renderMarkdown(workshop.aiSummary)}</div>
                )}
                {workshop.aiSummaryStatus === AISummaryStatus.NONE && (
                  <p className="text-[14px] text-ink/60">Chưa có tóm tắt AI.</p>
                )}
              </div>
            </div>

            <div className="border-t border-hairline">
              {['Chi tiết workshop', 'Phòng và bản đồ', 'Liên hệ BTC'].map((label) => (
                <div key={label} className="flex items-center justify-between border-b border-hairline py-6">
                  <span className="text-[15px] font-semibold text-ink">{label}</span>
                  <ChevronDown className="h-4 w-4 text-ink" />
                </div>
              ))}
            </div>
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-24 border border-hairline p-5">
              <div className="mb-4 text-[11px] uppercase tracking-[0.25em] text-ink/60">
                Seat Status
              </div>
              <LiveSeatBar workshopId={workshop.id} taken={workshop.seatsTaken} total={workshop.seatsTotal} />

              <div className="mt-6 flex items-center justify-between">
                <span className="text-[12px] text-ink/60">Giá vé</span>
                {price.isDisplay ? (
                  <span className="font-display text-[20px] text-ink">{price.label}</span>
                ) : (
                  <span className="text-[14px] font-semibold text-emerald">{price.label}</span>
                )}
              </div>

              <div className="mt-6">
                <CtaButton
                  isFull={isFull}
                  isRegistered={registered}
                  paymentDegraded={paymentDegraded}
                  price={workshop.price}
                />
              </div>
            </div>
          </aside>
        </div>
      </section>

      <Footer />

      <div className="fixed bottom-0 left-0 right-0 bg-canvas px-4 py-3 lg:hidden">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[12px] text-ink/60">Giá vé</span>
          {price.isDisplay ? (
            <span className="font-display text-[18px] text-ink">{price.label}</span>
          ) : (
            <span className="text-[13px] font-semibold text-emerald">{price.label}</span>
          )}
        </div>
        <LiveSeatBar workshopId={workshop.id} taken={workshop.seatsTaken} total={workshop.seatsTotal} />
        <div className="mt-3">
          <CtaButton
            isFull={isFull}
            isRegistered={registered}
            paymentDegraded={paymentDegraded}
            price={workshop.price}
          />
        </div>
      </div>
    </main>
  )
}
