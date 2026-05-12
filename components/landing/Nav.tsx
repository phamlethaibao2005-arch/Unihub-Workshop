'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { Search, X, User, LogOut } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { NotificationBell } from '@/components/NotificationBell'
import { signOut, useSession } from '@/lib/auth-client'

const PANEL_TRANSITION = { duration: 0.15, ease: [0.16, 1, 0.3, 1] } as const
const PANEL_VARIANTS = {
  hidden: { opacity: 0, scale: 0.96, y: -6 },
  show:   { opacity: 1, scale: 1,    y: 0  },
}

export function Nav() {
  const router   = useRouter()
  const pathname = usePathname()
  const { data: session } = useSession()

  // Search state
  const [searchOpen,  setSearchOpen]  = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const inputRef    = useRef<HTMLInputElement>(null)

  // Profile dropdown state
  const [profileOpen, setProfileOpen] = useState(false)
  const [signingOut,  setSigningOut]  = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  // ── Search: focus on open ──────────────────────────────────────
  useEffect(() => {
    if (searchOpen) inputRef.current?.focus()
  }, [searchOpen])

  // ── Search: '/' shortcut ───────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (searchOpen) return
      const tag = (document.activeElement?.tagName ?? '').toLowerCase()
      if (tag === 'input' || tag === 'textarea') return
      if (e.key === '/') { e.preventDefault(); setSearchOpen(true) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [searchOpen])

  // ── Profile dropdown: outside click + Escape ──────────────────
  useEffect(() => {
    if (!profileOpen) return
    const onMouse = (e: MouseEvent) => {
      if (!profileRef.current?.contains(e.target as Node)) setProfileOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setProfileOpen(false) }
    document.addEventListener('mousedown', onMouse)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouse)
      document.removeEventListener('keydown', onKey)
    }
  }, [profileOpen])

  const closeSearch = () => { setSearchOpen(false); setSearchQuery('') }

  const submitSearch = () => {
    const q = searchQuery.trim()
    if (q) router.push(`/workshops?q=${encodeURIComponent(q)}`)
    closeSearch()
  }

  const handleSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter')  submitSearch()
    if (e.key === 'Escape') closeSearch()
  }

  const onSignOut = async () => {
    setSigningOut(true)
    setProfileOpen(false)
    try {
      await signOut()
      router.push('/login')
    } finally {
      setSigningOut(false)
    }
  }

  const navLink = (href: string) =>
    `text-[13px] font-medium transition-colors ${
      pathname === href || pathname.startsWith(href + '/')
        ? 'text-ink'
        : 'text-ink/50 hover:text-ink'
    }`

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center border-b border-hairline bg-canvas px-4 md:px-6 lg:px-10">

      {/* ── Left: brand + nav links ───────────────────────────── */}
      <Link
        href="/"
        className="mr-6 shrink-0 font-display text-[22px] tracking-[0.04em] text-ink"
      >
        UNIHUB
      </Link>

      <nav className="hidden items-center gap-1 md:flex">
        <Link href="/workshops" className={`rounded-md px-3 py-1.5 ${navLink('/workshops')}`}>
          Workshop
        </Link>
      </nav>

      {/* ── Right: search + bell + my-tickets + avatar ──────── */}
      <div className="ml-auto flex items-center gap-2">

        {/* Search */}
        <motion.div
          animate={{ width: searchOpen ? 220 : 130 }}
          transition={{ type: 'spring', stiffness: 500, damping: 38, mass: 0.8 }}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) closeSearch()
          }}
          className="relative hidden h-9 cursor-pointer items-center overflow-hidden rounded-md bg-cloud px-3 sm:flex"
          onClick={() => { if (!searchOpen) setSearchOpen(true) }}
        >
          <Search className="h-3.5 w-3.5 shrink-0 text-ink/50" />

          <AnimatePresence mode="wait" initial={false}>
            {searchOpen ? (
              <motion.div
                key="input"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="ml-2 flex flex-1 items-center gap-1 overflow-hidden"
              >
                <input
                  ref={inputRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKey}
                  placeholder="Tìm workshop..."
                  className="min-w-0 flex-1 bg-transparent text-[13px] text-ink placeholder:text-ink/40 focus:outline-none"
                />
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => { e.stopPropagation(); closeSearch() }}
                  className="shrink-0 rounded p-0.5 text-ink/30 hover:text-ink transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="label"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }}
                className="ml-2 flex items-center gap-2"
              >
                <span className="whitespace-nowrap text-[13px] font-medium text-ink/50">Tìm kiếm</span>
                <kbd className="rounded border border-ink/15 bg-white px-1.5 py-px font-mono text-[10px] text-ink/30">/</kbd>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <NotificationBell />

        {session?.user ? (
          <>
            {/* My tickets link */}
            <Link href="/my-registrations" className={`hidden sm:block ${navLink('/my-registrations')}`}>
              Vé của tôi
            </Link>

            {/* Avatar + profile dropdown */}
            <div ref={profileRef} className="relative">
              <button
                onClick={() => setProfileOpen((v) => !v)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-[12px] font-semibold text-canvas ring-2 ring-transparent transition hover:opacity-85 focus-visible:ring-ink/30"
                aria-label="Tài khoản"
              >
                {session.user.name?.[0]?.toUpperCase() ?? 'U'}
              </button>

              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    variants={PANEL_VARIANTS}
                    initial="hidden" animate="show" exit="hidden"
                    transition={PANEL_TRANSITION}
                    style={{ transformOrigin: 'top right' }}
                    className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-hairline bg-canvas shadow-lg"
                  >
                    {/* User info */}
                    <div className="px-4 py-3.5">
                      <p className="truncate text-[13px] font-semibold text-ink">
                        {session.user.name ?? 'Người dùng'}
                      </p>
                      <p className="truncate text-[12px] text-ink/50">{session.user.email}</p>
                    </div>

                    <div className="border-t border-hairline py-1">
                      <Link
                        href="/profile"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-ink/70 transition-colors hover:bg-cloud hover:text-ink"
                      >
                        <User className="h-3.5 w-3.5" />
                        Chỉnh sửa hồ sơ
                      </Link>
                      <Link
                        href="/my-registrations"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-ink/70 transition-colors hover:bg-cloud hover:text-ink sm:hidden"
                      >
                        Vé của tôi
                      </Link>
                    </div>

                    <div className="border-t border-hairline py-1">
                      <button
                        onClick={() => void onSignOut()}
                        disabled={signingOut}
                        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-[13px] text-ink/70 transition-colors hover:bg-cloud hover:text-ink disabled:opacity-50"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        {signingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        ) : (
          <Link
            href="/login"
            className="text-[13px] font-semibold text-ink underline underline-offset-4"
          >
            Đăng nhập
          </Link>
        )}
      </div>
    </header>
  )
}
