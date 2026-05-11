'use client'

import dynamic from 'next/dynamic'

const HolographicCanvas = dynamic(() => import('@/components/HolographicCanvas'), { ssr: false })

export function HolographicPanel() {
  return (
    <div className="relative h-80 border border-hairline bg-cloud">
      <HolographicCanvas />
      <div className="pointer-events-none absolute bottom-4 left-4 right-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/40">UniHub OPS Core</p>
      </div>
    </div>
  )
}
