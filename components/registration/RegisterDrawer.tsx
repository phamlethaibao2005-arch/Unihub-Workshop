'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from '@/components/ui/drawer'

interface RegisterDrawerProps {
  open: boolean
  onClose: () => void
  workshopId: string
  workshopTitle: string
  workshopDate: string
  workshopTime: string
  workshopLocation: string
  workshopPrice: number
}

export function RegisterDrawer({
  open,
  onClose,
  workshopId,
  workshopTitle,
  workshopDate,
  workshopTime,
  workshopLocation,
  workshopPrice,
}: RegisterDrawerProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const idempotencyKey = useState(() => crypto.randomUUID())[0]

  const handleConfirm = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/registrations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({ workshopId, idempotencyKey }),
      })

      const data = await res.json()

      if (!res.ok) {
        const code = data.code as string
        if (code === 'CONFLICT' && data.error === 'ALREADY_REGISTERED') {
          toast.error('Bạn đã đăng ký workshop này')
        } else if (code === 'CONFLICT' && data.error === 'WORKSHOP_FULL') {
          toast.error('Rất tiếc, workshop đã hết chỗ')
        } else {
          toast.error(data.error ?? 'Đã xảy ra lỗi. Vui lòng thử lại.')
        }
        return
      }

      onClose()

      if (data.status === 'CONFIRMED') {
        toast.success('Đăng ký thành công! Vé đã được gửi.')
        router.push('/my-registrations')
      } else if (data.paymentUrl) {
        window.location.href = data.paymentUrl
      }
    } catch {
      toast.error('Không thể kết nối. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={(v) => !v && onClose()}>
      <DrawerContent className="rounded-none border-t border-hairline bg-canvas">
        <DrawerHeader className="border-b border-hairline pb-4">
          <DrawerTitle className="font-display text-[22px] text-ink uppercase tracking-[0.02em]">
            Xác nhận đăng ký
          </DrawerTitle>
        </DrawerHeader>

        <div className="px-4 py-6 flex flex-col gap-4">
          {/* Workshop summary */}
          <div className="border border-hairline p-4 flex flex-col gap-1">
            <p className="font-display text-[20px] text-ink uppercase leading-tight">
              {workshopTitle}
            </p>
            <p className="text-[12px] font-mono tabular-nums text-[#707072]">
              {workshopDate} · {workshopTime}
            </p>
            <p className="text-[12px] text-[#707072]">{workshopLocation}</p>
          </div>

          {/* Price row */}
          <div className="flex items-center justify-between py-3 border-b border-hairline">
            <span className="text-[13px] text-ink font-medium">Học phí</span>
            <span className="font-display text-[18px] text-ink">
              {workshopPrice === 0
                ? 'Miễn phí'
                : new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(
                    workshopPrice,
                  )}
            </span>
          </div>

          {/* Idempotency key — debug context */}
          <p className="font-mono text-[10px] text-[#9e9ea0] break-all">
            key: {idempotencyKey}
          </p>
        </div>

        <DrawerFooter className="border-t border-hairline pt-4 flex flex-col gap-2">
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="pill-primary w-full justify-center disabled:opacity-50"
          >
            {loading ? 'Đang xử lý...' : 'Xác Nhận'}
          </button>
          <DrawerClose asChild>
            <button className="pill-ghost w-full justify-center" onClick={onClose}>
              Huỷ
            </button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
