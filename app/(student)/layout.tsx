import type { ReactNode } from 'react'
import { Nav } from '@/components/landing/Nav'

export default function StudentLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <Nav />
      {children}
    </div>
  )
}