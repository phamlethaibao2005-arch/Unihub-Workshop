'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface NotificationItem {
  id: string
  title: string
  body: string
  createdAt: string
}

export function NotificationBell() {
  const [count, setCount] = useState(0)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [open, setOpen] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchCount = async () => {
    try {
      const res = await fetch('/api/notifications/unread-count')
      if (res.ok) {
        const data = (await res.json()) as { count: number }
        setCount(data.count)
      }
    } catch {
      // silently ignore — bell degrades gracefully when offline
    }
  }

  const fetchItems = async () => {
    try {
      const res = await fetch('/api/notifications')
      if (res.ok) {
        const data = (await res.json()) as { notifications: NotificationItem[] }
        setItems(data.notifications)
      }
    } catch {}
  }

  useEffect(() => {
    fetchCount()
    timerRef.current = setInterval(fetchCount, 30_000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) fetchItems()
  }

  const markRead = async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' })
    setItems((prev) => prev.filter((n) => n.id !== id))
    setCount((prev) => Math.max(0, prev - 1))
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          aria-label="Thông báo"
          className="relative flex h-9 w-9 items-center justify-center rounded-full text-ink"
        >
          <Bell className="h-4 w-4" />
          {count > 0 && (
            <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#d30005] text-[9px] font-bold text-white">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b border-hairline px-4 py-3">
          <p className="text-[13px] font-semibold text-ink">Thông báo</p>
        </div>
        {items.length === 0 ? (
          <p className="px-4 py-6 text-center text-[13px] text-ink/50">
            Không có thông báo mới
          </p>
        ) : (
          <ul>
            {items.map((n) => (
              <li
                key={n.id}
                className="flex items-start gap-2 border-b border-hairline px-4 py-3 last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="truncate text-[13px] font-semibold text-ink">
                    {n.title}
                  </p>
                  <p className="text-[12px] text-ink/60">{n.body}</p>
                </div>
                <button
                  onClick={() => markRead(n.id)}
                  className="mt-0.5 shrink-0 text-[16px] leading-none text-ink/40 hover:text-ink"
                  aria-label="Đánh dấu đã đọc"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}
