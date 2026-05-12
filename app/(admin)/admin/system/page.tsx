'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Activity, ShieldAlert, ShieldCheck, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type Status = 'ok' | 'degraded'

type SystemStatus = {
  payment: Status
  ai: Status
  email: Status
  db: Status
}

type Snapshot = {
  at: string
  status: SystemStatus
}

const HISTORY_PAGE_SIZE = 6

function formatTime(value: string) {
  const date = new Date(value)
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

function tone(status: Status) {
  return status === 'ok'
    ? { label: 'Ổn định', className: 'bg-emerald text-canvas' }
    : { label: 'Gián đoạn', className: 'bg-red-600 text-canvas' }
}

export default function AdminSystemPage() {
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<Snapshot[]>([])
  const [historyPage, setHistoryPage] = useState(1)
  const [historyVisible, setHistoryVisible] = useState(false)

  const historyRef = useRef<HTMLDivElement>(null)

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/system/status')
      if (!response.ok) throw new Error('Không thể tải trạng thái hệ thống')
      const data = (await response.json()) as SystemStatus
      setStatus(data)
      setHistory((prev) => {
        const next = [{ at: new Date().toISOString(), status: data }, ...prev]
        return next.slice(0, 30)
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const initial = setTimeout(() => {
      void fetchStatus()
    }, 0)

    const interval = setInterval(() => {
      void fetchStatus()
    }, 30_000)

    return () => {
      clearTimeout(initial)
      clearInterval(interval)
    }
  }, [fetchStatus])

  useEffect(() => {
    if (!historyRef.current) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setHistoryVisible(true)
      },
      { rootMargin: '120px' }
    )
    observer.observe(historyRef.current)
    return () => observer.disconnect()
  }, [])

  const historyItems = useMemo(() => {
    const end = historyPage * HISTORY_PAGE_SIZE
    return history.slice(0, end)
  }, [history, historyPage])

  const hasMoreHistory = historyItems.length < history.length

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-ink/50">ADMIN / SYSTEM</p>
          <h1 className="mt-3 font-display text-[56px] uppercase leading-[0.85] text-ink">Hệ Thống</h1>
          <p className="mt-3 max-w-2xl text-[14px] text-ink/60">
            Bảng điều khiển sức khỏe dịch vụ theo thời gian thực. Theo dõi circuit breaker và khả năng phục hồi của hệ thống.
          </p>
        </div>

        <button
          onClick={() => void fetchStatus()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-full border border-hairline px-4 py-2 text-[12px] font-semibold uppercase tracking-widest text-ink transition-colors hover:border-ink disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Làm mới
        </button>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600">
          {error}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              { key: 'payment', label: 'Thanh toán VNPAY', desc: 'Circuit breaker + retry' },
              { key: 'ai', label: 'Tóm tắt AI', desc: 'Gemini pipeline' },
              { key: 'email', label: 'Email thông báo', desc: 'Resend + queue' },
              { key: 'db', label: 'Database', desc: 'Neon Postgres' },
            ] as Array<{ key: keyof SystemStatus; label: string; desc: string }>
          ).map((item) => {
            const state = status?.[item.key] ?? 'ok'
            const badge = tone(state)
            return (
              <motion.div
                key={item.key}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
              >
                <Card className="rounded-none border-hairline">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{item.label}</span>
                      <Badge className={badge.className}>{badge.label}</Badge>
                    </CardTitle>
                    <CardDescription>{item.desc}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-center gap-3 text-[13px] text-ink/60">
                    {state === 'ok' ? (
                      <ShieldCheck className="h-4 w-4 text-emerald" />
                    ) : (
                      <ShieldAlert className="h-4 w-4 text-red-600" />
                    )}
                    {state === 'ok'
                      ? 'Dịch vụ đang ổn định, phản hồi trong ngưỡng tốt.'
                      : 'Hệ thống đang tự bảo vệ, tạm giảm tải.'}
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>

        <Card className="rounded-none border-hairline">
          <CardHeader>
            <CardTitle>Chức năng cần thiết</CardTitle>
            <CardDescription>Vận hành & giám sát</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-[13px] text-ink/60">
            <div className="rounded-lg border border-hairline p-3">
              <p className="font-semibold text-ink">Giám sát circuit breaker</p>
              <p className="mt-1">Theo dõi trạng thái Payment/AI/Email để phản ứng kịp thời.</p>
            </div>
            <div className="rounded-lg border border-hairline p-3">
              <p className="font-semibold text-ink">Lịch sử kiểm tra</p>
              <p className="mt-1">Ghi lại snapshot trong phiên để so sánh biến động theo thời gian.</p>
            </div>
            <div className="rounded-lg border border-hairline p-3">
              <p className="font-semibold text-ink">Làm mới thủ công</p>
              <p className="mt-1">Cho phép kiểm tra tức thời khi có sự cố phát sinh.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div ref={historyRef}>
        <Card className="rounded-none border-hairline">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Lịch sử trạng thái</CardTitle>
              <CardDescription>Snapshot mỗi 30 giây (tối đa 30 bản ghi gần nhất)</CardDescription>
            </div>
            <Badge variant="outline" className="text-[11px] uppercase tracking-widest">
              {history.length} bản ghi
            </Badge>
          </CardHeader>
          <CardContent>
            {!historyVisible ? (
              <div className="flex items-center gap-3 rounded border border-hairline bg-cloud px-4 py-6 text-[13px] text-ink/60">
                <Activity className="h-4 w-4" />
                Đang tải lịch sử...
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {historyItems.map((item) => (
                    <motion.div
                      key={item.at}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-hairline px-4 py-3 text-[13px]"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-ink/50">{formatTime(item.at)}</span>
                        <span className="text-ink">Payment: {item.status.payment}</span>
                        <span className="text-ink">AI: {item.status.ai}</span>
                        <span className="text-ink">Email: {item.status.email}</span>
                        <span className="text-ink">DB: {item.status.db}</span>
                      </div>
                      <Badge className={tone(item.status.payment).className}>Snapshot</Badge>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {history.length === 0 && (
                  <div className="rounded border border-hairline px-4 py-6 text-[13px] text-ink/60">
                    Chưa có dữ liệu. Hãy chờ lần cập nhật đầu tiên.
                  </div>
                )}

                {hasMoreHistory && (
                  <button
                    onClick={() => setHistoryPage((p) => p + 1)}
                    className="inline-flex items-center gap-2 rounded-full border border-hairline px-4 py-2 text-[12px] font-medium uppercase tracking-widest text-ink transition-colors hover:border-ink"
                  >
                    Tải thêm
                  </button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
