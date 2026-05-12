'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, CalendarDays, FileSpreadsheet, Bell, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { label: 'Dashboard',   href: '/admin/dashboard',      icon: LayoutDashboard },
  { label: 'Workshops',   href: '/admin/workshops',       icon: CalendarDays },
  { label: 'CSV Import',  href: '/admin/csv-import',      icon: FileSpreadsheet },
  { label: 'Thông báo',   href: '/admin/notifications',   icon: Bell },
  { label: 'Hệ thống',    href: '/admin/system',          icon: Settings },
]

export function NavRail() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-0.5 px-3 pt-3">
      {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 rounded px-3 py-2.5 text-[13px] font-medium tracking-tight transition-colors',
              active
                ? 'bg-ink text-canvas'
                : 'text-ink/50 hover:bg-ink/5 hover:text-ink',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
