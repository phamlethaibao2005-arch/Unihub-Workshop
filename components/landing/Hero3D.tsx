'use client'

import dynamic from 'next/dynamic'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { PillButton } from '@/components/PillButton'

const HolographicCanvas = dynamic(() => import('@/components/HolographicCanvas'), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-white" />,
})

type Hero3DProps = {
  onCta?: () => void
}

export function Hero3D({ onCta }: Hero3DProps) {
  return (
    <section className="relative border-b border-hairline bg-white">
      <div className="relative h-[88vh] min-h-160 overflow-hidden">
        <div className="absolute left-6 right-6 top-6 z-20 flex items-start justify-between text-[11px] uppercase tracking-[0.2em] text-ink/70">
          <div className="flex items-center gap-2">
            <span className="dot-blink h-1.5 w-1.5 rounded-full bg-cyan" />
            Live Campaign / Q3.2025
          </div>
          <div className="hidden items-center gap-6 md:flex">
            <span>SGN / UTC+7</span>
            <span>NEXT DROP / 28.06</span>
          </div>
        </div>

        <HolographicCanvas />

        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-end pb-[6vh]">
          <div className="pointer-events-auto px-6 md:px-10">
            <div className="mb-3 text-[11px] uppercase tracking-[0.25em] text-ink/60">
              UniHub Workshop / Drop 03
            </div>
            <h1
              className="max-w-275 font-display uppercase leading-[0.85] tracking-[-0.02em] text-ink"
              style={{ fontSize: 'clamp(56px, 9.2vw, 132px)' }}
            >
              Bước Vào<br />
              Không Gian Tri Thức<br />
              <span className="inline-flex items-center gap-3">
                Tương Lai
                <ArrowUpRight className="-mt-2 h-[0.7em] w-[0.7em]" />
              </span>
            </h1>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <PillButton variant="outline-image" onClick={onCta}>
                Khám Phá Ngay <ArrowRight className="h-4 w-4" />
              </PillButton>
              <PillButton variant="ghost" className="bg-white/60 backdrop-blur-sm">
                Xem Chi Tiết Hệ Thống
              </PillButton>
            </div>
          </div>
        </div>

        <div className="absolute bottom-6 right-6 z-20 hidden flex-col items-end text-ink md:flex">
          <div className="text-[11px] uppercase tracking-[0.25em] opacity-60">Engaged Cohort</div>
          <div className="font-display text-5xl leading-none tabular">12,408</div>
          <div className="mt-1 text-[11px] uppercase tracking-[0.25em] opacity-60">
            Sinh viên / 24 trường
          </div>
        </div>
      </div>
    </section>
  )
}
