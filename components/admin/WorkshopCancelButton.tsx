'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PillButton } from '@/components/PillButton'

export function WorkshopCancelButton({
  workshopId,
  title,
}: {
  workshopId: string
  title: string
}) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleCancel() {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/workshops/${workshopId}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = (await res.json()) as { error?: string }
        throw new Error(body.error ?? 'Không thể hủy workshop')
      }
      toast.success('Workshop đã được hủy')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi hủy workshop')
    } finally {
      setLoading(false)
      setConfirming(false)
    }
  }

  if (confirming) {
    return (
      <div className="flex flex-col items-center gap-2">
        <p className="text-center text-[12px] text-nikered">Xác nhận hủy &ldquo;{title}&rdquo;?</p>
        <div className="flex gap-2">
          <PillButton
            variant="ghost"
            className="border-nikered text-nikered hover:bg-nikered hover:text-white"
            onClick={handleCancel}
            disabled={loading}
          >
            {loading ? 'Đang hủy…' : 'Hủy workshop'}
          </PillButton>
          <PillButton variant="ghost" onClick={() => setConfirming(false)}>
            Quay lại
          </PillButton>
        </div>
      </div>
    )
  }

  return (
    <PillButton
      variant="ghost"
      className="border-nikered/50 text-nikered hover:bg-nikered hover:text-white"
      onClick={() => setConfirming(true)}
    >
      Hủy
    </PillButton>
  )
}
