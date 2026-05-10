'use client'

import dynamic from 'next/dynamic'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { PillButton } from '@/components/PillButton'

const HolographicCanvas = dynamic(
  () => import('@/components/HolographicCanvas'),
  {
    ssr: false,
    loading: () => <div className="absolute inset-0 bg-white" />,
  }
)

type Hero3DProps = {
  onCta?: () => void
}

export function Hero3D({ onCta }: Hero3DProps) {
  return (
    <section className="relative bg-white border-b border-hairline">
      <div className="relative h-[88vh] min-h-160 overflow-hidden">

        {/* Top meta bar */}
        <div className="absolute top-6 left-6 right-6 z-20 flex items-start justify-between text-[11px] tracking-[0.2em] uppercase text-ink/70">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan dot-blink" />
            Live Campaign / Q3.2025
          </div>
          <div className="hidden md:flex items-center gap-6">
            <span>SGN / UTC+7</span>
            <span>NEXT DROP / 28.06</span>
          </div>
        </div>

        {/* 3D canvas — absolute fill */}
        <HolographicCanvas />

        {/* Bottom-left headline + CTA */}
        <div className="absolute inset-0 z-10 flex flex-col justify-end pb-[6vh] pointer-events-none">
          <div className="px-6 md:px-10 pointer-events-auto">
            <div className="text-[11px] uppercase tracking-[0.25em] text-ink/60 mb-3">
              UniHub Workshop / Drop 03
            </div>
            <h1
              className="font-display uppercase text-ink leading-[0.85] tracking-[-0.02em] max-w-275"
              style={{ fontSize: 'clamp(56px, 9.2vw, 132px)' }}
            >
              Bước Vào<br />
              Không Gian Tri Thức<br />
              <span className="inline-flex items-center gap-3">
                Tương Lai
                <ArrowUpRight className="w-[0.7em] h-[0.7em] -mt-2" />
              </span>
            </h1>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <PillButton variant="outline-image" onClick={onCta}>
                Khám Phá Ngay <ArrowRight className="w-4 h-4" />
              </PillButton>
              <PillButton
                variant="ghost"
                className="bg-white/60 backdrop-blur-sm"
              >
                Xem Chi Tiết Hệ Thống
              </PillButton>
            </div>
          </div>
        </div>

        {/* Bottom-right cohort counter */}
        <div className="absolute bottom-6 right-6 z-20 hidden md:flex flex-col items-end text-ink">
          <div className="text-[11px] uppercase tracking-[0.25em] opacity-60">
            Engaged Cohort
          </div>
          <div className="font-display text-5xl tabular leading-none mt-1">
            12,408
          </div>
          <div className="text-[11px] uppercase tracking-[0.25em] opacity-60 mt-1">
            Sinh viên / 24 trường
          </div>
        </div>

      </div>
    </section>
  )
}
