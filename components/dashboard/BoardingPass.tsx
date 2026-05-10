'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useQRDataUrl } from '@/lib/qr'
import type { RegistrationDTO } from '@/shared/types/registration'

interface BoardingPassProps {
  registration: RegistrationDTO
  onCancelled?: () => void
}

function StatusBadge({ status }: { status: RegistrationDTO['status'] }) {
  if (status === 'CONFIRMED') return <span className="badge-promo badge-green">CONFIRMED</span>
  if (status === 'CANCELLED') return <span className="badge-promo badge-red">CANCELLED</span>
  return (
    <span className="badge-promo" style={{ borderColor: '#cacacb', color: '#707072' }}>
      PENDING
    </span>
  )
}

export function BoardingPass({ registration, onCancelled }: BoardingPassProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const qrDataUrl = useQRDataUrl(registration.qrCode)
  const cancellable =
    registration.status === 'CONFIRMED' || registration.status === 'PENDING'

  const handleCancel = async () => {
    setCancelling(true)
    try {
      const res = await fetch(`/api/registrations/${registration.id}`, { method: 'DELETE' })
      if (res.ok) {
        setDialogOpen(false)
        onCancelled?.()
      }
    } finally {
      setCancelling(false)
    }
  }

  return (
    <>
      <motion.div
        whileHover={{ scale: 1.005 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        onHoverStart={() => setHovered(true)}
        onHoverEnd={() => setHovered(false)}
        onClick={() => setDialogOpen(true)}
        className="border border-hairline rounded-none bg-canvas cursor-pointer select-none overflow-hidden"
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-hairline">
          <span className="font-display text-[15px] text-ink tracking-[0.04em]">
            UNIHUB / BOARDING
          </span>
          <StatusBadge status={registration.status} />
        </div>

        {/* Body */}
        <div className="flex">
          {/* Left — 60% */}
          <div className="flex-3 px-5 py-5 flex flex-col gap-2">
            <p className="font-display text-[32px] text-ink uppercase leading-none tracking-tight">
              {registration.workshop.title}
            </p>
            <p className="text-[13px] font-medium text-[#707072]">
              {registration.workshop.speaker}
            </p>
            <div className="mt-2 flex flex-col gap-1">
              <p className="font-mono text-[12px] tabular-nums text-ink">
                {registration.workshop.date} · {registration.workshop.time}
              </p>
              <p className="font-mono text-[12px] tabular-nums text-[#707072]">
                {registration.workshop.location}
              </p>
            </div>
          </div>

          {/* Right — 40%, dashed left border */}
          <div
            className="flex-2 flex flex-col items-center justify-center gap-2 px-5 py-5"
            style={{ borderLeft: '1px dashed #cacacb' }}
          >
            {registration.qrCode && qrDataUrl ? (
              <div className="w-20 h-20 bg-cloud flex items-center justify-center overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt="QR" width={80} height={80} className="object-contain" />
              </div>
            ) : (
              <div className="w-20 h-20 bg-cloud" />
            )}
            <p className="font-mono text-[10px] text-[#707072] tracking-widest">
              REG-{registration.id.slice(-6).toUpperCase()}
            </p>

            <motion.p
              animate={{ opacity: hovered ? 1 : 0 }}
              transition={{ duration: 0.15 }}
              className="text-[10px] text-[#9e9ea0] uppercase tracking-widest mt-1"
            >
              Tap to enlarge
            </motion.p>
          </div>
        </div>
      </motion.div>

      {/* Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-none border border-hairline shadow-none max-w-md p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-hairline">
            <DialogTitle className="font-display text-[22px] tracking-[0.02em] text-ink uppercase">
              {registration.workshop.title}
            </DialogTitle>
            <StatusBadge status={registration.status} />
          </DialogHeader>

          <div className="px-6 py-6 flex flex-col items-center gap-4">
            {registration.qrCode && qrDataUrl ? (
              <div className="w-50 h-50 bg-cloud p-3 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrDataUrl}
                  alt="QR Code"
                  width={180}
                  height={180}
                  className="object-contain"
                />
              </div>
            ) : (
              <div className="w-50 h-50 bg-cloud" />
            )}

            <div className="w-full space-y-1 text-center">
              <p className="font-mono text-[13px] text-ink tracking-widest">
                REG-{registration.id.slice(-6).toUpperCase()}
              </p>
              <p className="text-[12px] text-[#707072]">
                {registration.workshop.speaker} · {registration.workshop.location}
              </p>
              <p className="text-[12px] tabular-nums text-[#707072]">
                {registration.workshop.date} · {registration.workshop.time}
              </p>
            </div>
          </div>

          {cancellable && (
            <div className="px-6 pb-6">
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="pill-ghost w-full justify-center text-nikered border-nikered/40 hover:bg-nikered hover:text-canvas hover:border-nikered disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" />
                {cancelling ? 'Đang hủy...' : 'Hủy đăng ký'}
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
