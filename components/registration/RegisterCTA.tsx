'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { PillButton } from '@/components/PillButton'
import { RegisterDrawer } from './RegisterDrawer'

interface RegisterCTAProps {
  workshopId: string
  workshopTitle: string
  workshopDate: string
  workshopTime: string
  workshopLocation: string
  workshopPrice: number
  isFull: boolean
  isRegistered: boolean
  paymentDegraded: boolean
}

export function RegisterCTA({
  workshopId,
  workshopTitle,
  workshopDate,
  workshopTime,
  workshopLocation,
  workshopPrice,
  isFull,
  isRegistered,
  paymentDegraded: initialPaymentDegraded,
}: RegisterCTAProps) {
  const [open, setOpen] = useState(false)
  const [countdown, setCountdown] = useState(30)
  const [paymentDegraded, setPaymentDegraded] = useState(initialPaymentDegraded)

  // Keep degraded state in sync with the circuit breaker (same 30s cadence as SystemStatusBanner)
  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch('/api/system/status', { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json() as { payment?: string }
          setPaymentDegraded(data.payment === 'degraded')
        }
      } catch {
        // keep last known value
      }
    }

    void poll()
    const id = setInterval(() => void poll(), 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!paymentDegraded || workshopPrice === 0) return
    const id = setInterval(() => setCountdown((s) => (s <= 1 ? 30 : s - 1)), 1000)
    return () => clearInterval(id)
  }, [paymentDegraded, workshopPrice])

  if (paymentDegraded && workshopPrice > 0) {
    return (
      <div className="space-y-2">
        <PillButton variant="primary" disabled className="w-full justify-center opacity-50">
          Thanh Toán Tạm Ngưng
        </PillButton>
        <p className="text-center text-[11px] text-ink/50">
          Hệ thống đang hồi phục, thử lại sau {countdown}s
        </p>
      </div>
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
      <PillButton variant="primary" disabled className="w-full justify-center opacity-50">
        Hết Chỗ
      </PillButton>
    )
  }

  return (
    <>
      <PillButton
        variant="primary"
        className="w-full justify-center cursor-pointer"
        onClick={() => setOpen(true)}
      >
        Đăng Ký Ngay
      </PillButton>

      <RegisterDrawer
        open={open}
        onClose={() => setOpen(false)}
        workshopId={workshopId}
        workshopTitle={workshopTitle}
        workshopDate={workshopDate}
        workshopTime={workshopTime}
        workshopLocation={workshopLocation}
        workshopPrice={workshopPrice}
      />
    </>
  )
}
