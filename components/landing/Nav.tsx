'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { NotificationBell } from '@/components/NotificationBell'
import { signOut, useSession } from '@/lib/auth-client'

export function Nav() {
  const router = useRouter()
  const pathname = usePathname()
  const { data: session } = useSession()
  const [signingOut, setSigningOut] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input when opening
  useEffect(() => {
    if (searchOpen) inputRef.current?.focus()
  }, [searchOpen])

  // '/' shortcut to open search (skip when focused on an input/textarea)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (searchOpen) return
      const tag = (document.activeElement?.tagName ?? '').toLowerCase()
      if (tag === 'input' || tag === 'textarea') return
      if (e.key === '/') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [searchOpen])

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
        {/* Search — animates width via framer-motion spring */}
        <motion.div
          animate={{ width: searchOpen ? 220 : 130 }}
          transition={{ type: 'spring', stiffness: 500, damping: 38, mass: 0.8 }}
          // Close when focus leaves the whole search area
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) closeSearch()
          }}
          className="relative hidden h-9 cursor-pointer items-center overflow-hidden rounded-md bg-cloud px-3 sm:flex"
          onClick={() => { if (!searchOpen) setSearchOpen(true) }}
        >
          <Search className="h-3.5 w-3.5 shrink-0 text-ink/50 transition-colors" />

          <AnimatePresence mode="wait" initial={false}>
            {searchOpen ? (
              <motion.div
                key="input"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="ml-2 flex flex-1 items-center gap-1 overflow-hidden"
              >
                <input
                  ref={inputRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Tìm workshop..."
                  className="min-w-0 flex-1 bg-transparent text-[13px] text-ink placeholder:text-ink/40 focus:outline-none"
                />
                <button
                  onMouseDown={(e) => e.preventDefault()} // keep focus in container
                  onClick={(e) => { e.stopPropagation(); closeSearch() }}
                  className="shrink-0 rounded p-0.5 text-ink/30 transition-colors hover:text-ink"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="label"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }}
                className="ml-2 flex items-center gap-2"
              >
                <span className="whitespace-nowrap text-[13px] font-medium text-ink/50">
                  Tìm kiếm
                </span>
                <kbd className="rounded border border-ink/15 bg-white px-1.5 py-px font-mono text-[10px] text-ink/30">
                  /
                </kbd>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <NotificationBell />

        {session?.user ? (
          <div className="flex items-center gap-2">
            <Link
              href="/my-registrations"
              className={`hidden text-[13px] font-medium transition-colors sm:block ${
                pathname === '/my-registrations'
                  ? 'text-ink'
                  : 'text-ink/50 hover:text-ink'
              }`}
            >
              Vé của tôi
            </Link>

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
          <Link
            href="/login"
            className="text-[13px] font-semibold text-ink underline underline-offset-4 cursor-pointer"
          >
            Đăng nhập
          </Link>
        )}
      </div>
    </header>
  )
}
