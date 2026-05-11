'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/admin/dashboard' },
  { label: 'Workshops', href: '/admin/workshops' },
  { label: 'CSV Import', href: '/admin/csv-import' },
  { label: 'Thông báo', href: '/admin/notifications' },
  { label: 'Hệ thống', href: '/admin/system' },
]

export function NavRail() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-1 pt-2">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + '/')
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'px-6 py-2.5 text-[13px] font-medium tracking-tight transition-colors hover:text-ink',
              active
                ? 'border-b border-ink text-ink'
                : 'text-ink/50 hover:text-ink/80',
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
