'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Bell, Search } from 'lucide-react'
import { signOut, useSession } from '@/lib/auth-client'

const NAV_LINKS = [
  { label: 'Workshop', href: '/workshops' },
  { label: 'Cộng đồng', href: '/community' },
  { label: 'Đối tác', href: '/partners' },
  { label: 'Hỗ trợ', href: '/support' },
]

export function Nav() {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()
  const [signingOut, setSigningOut] = useState(false)

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

      <nav className="hidden flex-1 items-center justify-center gap-6 md:flex">
        {NAV_LINKS.map(({ label, href }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`)
          return (
            <Link
              key={href}
              href={href}
              className={`border-b-2 pb-1 text-[15px] font-semibold text-ink ${
                active ? 'border-ink' : 'border-transparent'
              }`}
            >
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="ml-auto flex items-center gap-3">
        <button className="hidden h-9 items-center gap-2 rounded-md bg-cloud px-3 text-[13px] font-medium text-ink/60 sm:flex">
          <Search className="h-3.5 w-3.5" />
          <span>Tìm kiếm</span>
        </button>

        <button
          aria-label="Thông báo"
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink"
        >
          <Bell className="h-4 w-4" />
        </button>

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
