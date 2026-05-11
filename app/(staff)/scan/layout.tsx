import type { Metadata, Viewport } from 'next'
import { redirect } from 'next/navigation'
import SwRegistrar from './_components/SwRegistrar'
import { getSession } from '@/lib/session'

export const metadata: Metadata = {
  title: 'UniHub Scan',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
}

export default async function ScanLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.user.role !== 'CHECKIN_STAFF') redirect('/workshops')

  return (
    <>
      <SwRegistrar />
      {children}
    </>
  )
}
