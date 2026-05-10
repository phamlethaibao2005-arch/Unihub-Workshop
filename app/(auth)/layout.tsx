import type { ReactNode } from 'react'
import NetworkCanvas from '@/components/auth/NetworkCanvas'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen w-full bg-white overflow-hidden">
      {/* 2D network background */}
      <NetworkCanvas />

      {/* Centered form shell */}
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-110">
          {children}
        </div>
      </div>
    </div>
  )
}
