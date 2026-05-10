'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useQRDataUrl } from '@/lib/qr'

type Status = 'pending' | 'success' | 'failed' | 'timeout'

const POLL_INTERVAL = 3_000
const POLL_TIMEOUT = 120_000

export default function PaymentResultPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const txnRef = searchParams.get('txnRef')

  const [status, setStatus] = useState<Status>('pending')
  const [qrCode, setQrCode] = useState<string | null>(null)
  const qrDataUrl = useQRDataUrl(qrCode)

  const startedAt = useRef(Date.now())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!txnRef) { setStatus('failed'); return }

    const poll = async () => {
      if (Date.now() - startedAt.current > POLL_TIMEOUT) {
        setStatus('timeout')
        return
      }

      try {
        const res = await fetch(`/api/payments/${txnRef}/status`)
        if (!res.ok) { timerRef.current = setTimeout(poll, POLL_INTERVAL); return }

        const data = (await res.json()) as { status: string; qrCode?: string }

        if (data.status === 'SUCCESS') {
          setQrCode(data.qrCode ?? null)
          setStatus('success')
        } else if (data.status === 'FAILED' || data.status === 'PAYMENT_FAILED') {
          setStatus('failed')
        } else {
          timerRef.current = setTimeout(poll, POLL_INTERVAL)
        }
      } catch {
        timerRef.current = setTimeout(poll, POLL_INTERVAL)
      }
    }

    poll()
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [txnRef])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4">
      {status === 'pending' && <PendingCard />}
      {status === 'success' && <SuccessCard qrDataUrl={qrDataUrl} />}
      {status === 'failed' && <FailedCard />}
      {status === 'timeout' && <TimeoutCard txnRef={txnRef} />}
    </main>
  )
}

function PendingCard() {
  return (
    <div className="w-full max-w-md border border-hairline p-8 text-center">
      <div className="mb-6 flex justify-center">
        <span className="inline-block h-10 w-10 animate-spin rounded-full border-2 border-ink border-t-transparent" />
      </div>
      <p className="font-display text-[32px] uppercase leading-none text-ink">Đang xử lý</p>
      <p className="mt-2 text-[13px] text-ink/60">Vui lòng không đóng trang này…</p>
    </div>
  )
}

function SuccessCard({ qrDataUrl }: { qrDataUrl: string | null }) {
  return (
    <div className="w-full max-w-md border border-hairline p-8 text-center">
      <p className="font-display text-[40px] uppercase leading-none text-[var(--emerald)]">
        Thanh toán thành công
      </p>
      <p className="mt-2 text-[13px] text-ink/60">Vé của bạn đã được xác nhận</p>

      {qrDataUrl && (
        <div className="mt-6 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="QR vé" className="h-40 w-40" />
        </div>
      )}

      <Link
        href="/my-registrations"
        className="pill-primary mt-6 inline-flex h-10 items-center px-6 text-[13px]"
      >
        Xem vé của tôi
      </Link>
    </div>
  )
}

function FailedCard() {
  return (
    <div className="w-full max-w-md border border-hairline p-8 text-center">
      <p className="font-display text-[40px] uppercase leading-none text-[var(--red)]">
        Thanh toán thất bại
      </p>
      <p className="mt-2 text-[13px] text-ink/60">Giao dịch không thành công. Vui lòng thử lại.</p>
      <Link
        href="/workshops"
        className="pill-ghost mt-6 inline-flex h-10 items-center px-6 text-[13px]"
      >
        Quay lại danh sách
      </Link>
    </div>
  )
}

function TimeoutCard({ txnRef }: { txnRef: string | null }) {
  return (
    <div className="w-full max-w-md border border-hairline p-8 text-center">
      <p className="font-display text-[40px] uppercase leading-none text-ink">Hết thời gian</p>
      <p className="mt-2 text-[13px] text-ink/60">
        Không nhận được phản hồi từ cổng thanh toán. Kiểm tra lại trong vài phút.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Link href="/my-registrations" className="pill-ghost h-10 px-4 text-[12px]">
          Xem đăng ký của tôi
        </Link>
        {txnRef && (
          <a
            href={`/api/payments/${txnRef}/status`}
            className="pill-primary h-10 px-4 text-[12px]"
          >
            Kiểm tra trạng thái
          </a>
        )}
      </div>
    </div>
  )
}
