'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
  isLoggedIn: boolean
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
  isLoggedIn,
  paymentDegraded,
}: RegisterCTAProps) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  if (paymentDegraded && workshopPrice > 0) {
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
        onClick={() => isLoggedIn ? setOpen(true) : router.push('/login')}
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
