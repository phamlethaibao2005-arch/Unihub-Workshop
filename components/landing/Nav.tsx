'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { NotificationBell } from '@/components/NotificationBell'
import { signOut, useSession } from '@/lib/auth-client'

export function Nav() {
  const router = useRouter()
  const { data: session } = useSession()
  const [signingOut, setSigningOut] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus()
  }, [searchOpen])

  const openSearch = () => setSearchOpen(true)

  const closeSearch = () => {
    setSearchOpen(false)
    setSearchQuery('')
  }

  const submitSearch = () => {
    const q = searchQuery.trim()
    if (q) router.push(`/workshops?q=${encodeURIComponent(q)}`)
    closeSearch()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') submitSearch()
    if (e.key === 'Escape') closeSearch()
  }

  const onSignOut = async () => {
    setSigningOut(true)
    try {
      await signOut()
      router.push('/login')
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center border-b border-hairline bg-canvas px-4 md:px-6 lg:px-10">
      <Link
        href="/"
        className="mr-8 shrink-0 font-display text-[22px] tracking-[0.04em] text-ink cursor-pointer"
      >
        UNIHUB
      </Link>

      <div className="ml-auto flex items-center gap-3">
        {/* Search */}
        {searchOpen ? (
          <div className="hidden items-center gap-1.5 rounded-md bg-cloud px-3 sm:flex">
            <Search className="h-3.5 w-3.5 shrink-0 text-ink/40" />
            <input
              ref={inputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => {
                // small delay so clicking X doesn't race with blur
                setTimeout(closeSearch, 150)
              }}
              placeholder="Tìm workshop..."
              className="h-9 w-48 bg-transparent text-[13px] text-ink placeholder:text-ink/40 focus:outline-none"
            />
            <button
              onMouseDown={(e) => e.preventDefault()} // prevent blur before click
              onClick={closeSearch}
              className="shrink-0 text-ink/40 hover:text-ink"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={openSearch}
            className="hidden h-9 items-center gap-2 rounded-md bg-cloud px-3 text-[13px] font-medium text-ink/60 transition-colors hover:text-ink sm:flex"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Tìm kiếm</span>
          </button>
        )}

        <NotificationBell />

        {session?.user ? (
          <div className="flex items-center gap-2">
            <Link href="/profile" className="flex items-center gap-2">
              <span className="hidden text-[13px] font-semibold text-ink sm:block">
                {session.user.name?.split(' ').pop() ?? 'Bạn'}
              </span>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-semibold text-canvas">
                {session.user.name?.[0]?.toUpperCase() ?? 'U'}
              </span>
            </Link>
            <button
              type="button"
              onClick={onSignOut}
              disabled={signingOut}
              className="pill-ghost h-8 px-4 text-[12px] cursor-pointer"
            >
              Đăng xuất
            </button>
          </div>
        ) : (
          <Link href="/login" className="text-[13px] font-semibold text-ink underline underline-offset-4 cursor-pointer">
            Đăng nhập
          </Link>
        )}
      </div>
    </header>
  )
}
