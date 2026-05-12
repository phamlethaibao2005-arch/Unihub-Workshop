'use client'

import { useState, useEffect } from 'react'

interface SystemStatus {
  payment: 'ok' | 'degraded'
  ai: 'ok' | 'degraded'
  email: 'ok' | 'degraded'
}

export function SystemStatusBanner() {
  const [status, setStatus] = useState<SystemStatus | null>(null)

  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch('/api/system/status', { cache: 'no-store' })
        if (res.ok) setStatus(await res.json() as SystemStatus)
      } catch {
        // network error — keep last known state
      }
    }

    void poll()
    const id = setInterval(() => void poll(), 30_000)
    return () => clearInterval(id)
  }, [])

  if (!status || status.payment !== 'degraded') return null

  return (
    <div
      className="flex w-full items-center gap-2.5 border-b border-hairline/50 bg-ink px-4 py-2"
      style={{ borderRadius: 0 }}
    >
      <span className="dot-blink inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-nikered" />
      <p className="text-[11px] uppercase tracking-[0.2em] text-canvas">
        Thanh toán tạm thời không khả dụng. Workshop miễn phí vẫn hoạt động bình thường.
      </p>
    </div>
  )
}
