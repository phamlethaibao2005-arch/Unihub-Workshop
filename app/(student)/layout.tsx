import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { Nav } from '@/components/landing/Nav'
import { getSession } from '@/lib/session'

export default async function StudentLayout({ children }: { children: ReactNode }) {
  const session = await getSession()
  if (session?.user.role === 'CHECKIN_STAFF') redirect('/scan')

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <Nav />
      {children}
    </div>
  )
}