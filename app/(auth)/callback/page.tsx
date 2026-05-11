'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/lib/auth-client'

export default function AuthCallbackPage() {
  const router = useRouter()
  const { data: session, isPending } = useSession()

  useEffect(() => {
    if (isPending) return
    if (!session) {
      router.replace('/login')
      return
    }
    const role = (session.user as { role?: string }).role
    if (role === 'CHECKIN_STAFF') router.replace('/scan')
    else if (role === 'ORGANIZER') router.replace('/admin/workshops')
    else router.replace('/workshops')
  }, [session, isPending, router])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <span className="text-sm text-ink/50">Đang chuyển hướng…</span>
    </div>
  )
}
