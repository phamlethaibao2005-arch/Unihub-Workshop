'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { signOut } from '@/lib/auth-client'

interface AdminUserPanelProps {
  name: string
  email: string
  image?: string | null
}

export function AdminUserPanel({ name, email, image }: AdminUserPanelProps) {
  const router = useRouter()
  const initial = name.trim().charAt(0).toUpperCase()

  const handleLogout = async () => {
    await signOut()
    router.push('/login')
  }

  return (
    <div className="mt-auto border-t border-hairline px-4 py-4">
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-[13px] font-semibold text-canvas overflow-hidden">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" className="h-full w-full object-cover" />
          ) : (
            initial
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium leading-tight text-ink">{name}</p>
          <p className="truncate text-[11px] leading-tight text-ink/50">{email}</p>
        </div>

        {/* Logout */}
        <button
          onClick={() => void handleLogout()}
          title="Đăng xuất"
          className="shrink-0 rounded p-1.5 text-ink/40 transition-colors hover:bg-ink/5 hover:text-ink"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>

      <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-ink/30">Organizer</p>
    </div>
  )
}
