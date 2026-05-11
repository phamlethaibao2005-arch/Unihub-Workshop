import type { Metadata, Viewport } from 'next'
import SwRegistrar from './_components/SwRegistrar'

export const metadata: Metadata = {
  title: 'UniHub Scan',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
}

export default function ScanLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SwRegistrar />
      {children}
    </>
  )
}
