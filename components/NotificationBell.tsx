'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Bell, CheckCircle2, AlertCircle, Calendar,
  CreditCard, XCircle, X,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'

interface NotificationItem {
  id: string
  type: string
  title: string
  body: string
  createdAt: string
}

// ── Type → icon + colour ────────────────────────────────────────────
const TYPE_MAP: Record<string, { Icon: LucideIcon; cls: string }> = {
  REGISTRATION_CONFIRMED: { Icon: CheckCircle2, cls: 'text-emerald-500 bg-emerald-50' },
  REGISTRATION:           { Icon: CheckCircle2, cls: 'text-emerald-500 bg-emerald-50' },
  PAYMENT_SUCCESS:        { Icon: CreditCard,   cls: 'text-emerald-500 bg-emerald-50' },
  PAYMENT_FAILED:         { Icon: AlertCircle,  cls: 'text-red-500    bg-red-50'      },
  WORKSHOP_REMINDER:      { Icon: Calendar,     cls: 'text-blue-500   bg-blue-50'     },
  WORKSHOP_CANCELLED:     { Icon: XCircle,      cls: 'text-red-500    bg-red-50'      },
}
function typeConfig(type: string) {
  return TYPE_MAP[type] ?? { Icon: Bell, cls: 'text-ink/40 bg-ink/5' }
}

// ── Relative time ───────────────────────────────────────────────────
function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1)  return 'Vừa xong'
  if (m < 60) return `${m} phút trước`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} giờ trước`
  return `${Math.floor(h / 24)} ngày trước`
}

// ── Skeleton row ────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="h-8 w-8 shrink-0 rounded-full bg-ink/8 animate-pulse" />
      <div className="flex-1 space-y-2 pt-0.5">
        <div className="h-3 w-3/5 rounded bg-ink/8 animate-pulse" />
        <div className="h-2.5 w-4/5 rounded bg-ink/8 animate-pulse" />
        <div className="h-2 w-1/4 rounded bg-ink/8 animate-pulse" />
      </div>
    </div>
  )
}

export function NotificationBell() {
  const [count, setCount]     = useState(0)
  const [items, setItems]     = useState<NotificationItem[]>([])
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [ringing, setRinging] = useState(false)

  const containerRef  = useRef<HTMLDivElement>(null)
  const prevCountRef  = useRef(0)
  const pollRef       = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Badge pulse when count rises ──────────────────────────────────
  useEffect(() => {
    if (count > prevCountRef.current && prevCountRef.current !== 0) {
      setRinging(true)
      setTimeout(() => setRinging(false), 600)
    }
    prevCountRef.current = count
  }, [count])

  // ── Poll unread count every 30s ───────────────────────────────────
  const fetchCount = async () => {
    try {
      const res = await fetch('/api/notifications/unread-count')
      if (res.ok) setCount(((await res.json()) as { count: number }).count)
    } catch {}
  }

  useEffect(() => {
    void fetchCount()
    pollRef.current = setInterval(() => void fetchCount(), 30_000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  // ── Close on outside click / Escape ──────────────────────────────
  useEffect(() => {
    if (!open) return
    const onMouse = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onMouse)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouse)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // ── Fetch items on open ───────────────────────────────────────────
  const openPanel = async () => {
    setOpen((v) => !v)
    if (open) return
    setLoading(true)
    try {
      const res = await fetch('/api/notifications')
      if (res.ok) setItems(((await res.json()) as { notifications: NotificationItem[] }).notifications)
    } catch {} finally {
      setLoading(false)
    }
  }

  // ── Mark one read ─────────────────────────────────────────────────
  const markOne = async (id: string) => {
    setItems((p) => p.filter((n) => n.id !== id))
    setCount((p) => Math.max(0, p - 1))
    await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' }).catch(() => null)
  }

  // ── Mark all read ─────────────────────────────────────────────────
  const markAll = async () => {
    setItems([])
    setCount(0)
    await fetch('/api/notifications/read-all', { method: 'PATCH' }).catch(() => null)
  }

  return (
    <div ref={containerRef} className="relative">
      {/* ── Bell button ── */}
      <button
        aria-label="Thông báo"
        onClick={() => void openPanel()}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-ink transition-colors hover:bg-ink/5"
      >
        <motion.div
          animate={ringing ? { rotate: [0, -14, 14, -9, 9, -5, 5, 0] } : {}}
          transition={{ duration: 0.55, ease: 'easeInOut' }}
        >
          <Bell className="h-4 w-4" />
        </motion.div>

        <AnimatePresence>
          {count > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
              className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-nikered text-[9px] font-bold text-white"
            >
              {count > 99 ? '99+' : count}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* ── Dropdown panel ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -6 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{    opacity: 0, scale: 0.96, y: -6 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformOrigin: 'top right' }}
            className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-hairline bg-canvas shadow-lg"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
              <p className="text-[13px] font-semibold text-ink">Thông báo</p>
              {items.length > 0 && (
                <button
                  onClick={() => void markAll()}
                  className="text-[11px] font-medium text-ink/50 hover:text-ink transition-colors"
                >
                  Đọc tất cả
                </button>
              )}
            </div>

            {/* Body */}
            <div className="max-h-95 overflow-y-auto">
              {loading ? (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                  <Bell className="h-6 w-6 text-ink/20" />
                  <p className="text-[13px] text-ink/40">Không có thông báo mới</p>
                </div>
              ) : (
                <motion.ul
                  initial="hidden"
                  animate="show"
                  variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
                >
                  <AnimatePresence initial={false}>
                    {items.map((n) => {
                      const { Icon, cls } = typeConfig(n.type)
                      return (
                        <motion.li
                          key={n.id}
                          layout="position"
                          variants={{
                            hidden: { opacity: 0, y: 6 },
                            show:   { opacity: 1, y: 0, transition: { duration: 0.2 } },
                          }}
                          exit={{ opacity: 0, x: 24, transition: { duration: 0.18 } }}
                          className="group flex items-start gap-3 border-b border-hairline px-4 py-3 last:border-0"
                        >
                          {/* Type icon */}
                          <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${cls}`}>
                            <Icon className="h-4 w-4" />
                          </div>

                          {/* Content */}
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-semibold leading-snug text-ink">
                              {n.title}
                            </p>
                            <p className="mt-0.5 text-[12px] leading-snug text-ink/60">
                              {n.body}
                            </p>
                            <p className="mt-1.5 text-[11px] text-ink/35">
                              {relTime(n.createdAt)}
                            </p>
                          </div>

                          {/* Dismiss */}
                          <button
                            onClick={() => void markOne(n.id)}
                            aria-label="Đánh dấu đã đọc"
                            className="mt-0.5 shrink-0 rounded p-0.5 text-ink/25 opacity-0 transition-all group-hover:opacity-100 hover:bg-ink/5 hover:text-ink/70"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </motion.li>
                      )
                    })}
                  </AnimatePresence>
                </motion.ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
