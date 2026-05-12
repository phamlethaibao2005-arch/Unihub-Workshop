'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { AnimatePresence, motion } from 'framer-motion'
import { Bell, Filter, Search, Loader, CheckCircle2, MailWarning } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type NotificationItem = {
  id: string
  title: string
  body: string
  type: string
  read: boolean
  createdAt: string
  user: {
    name: string | null
    email: string
    image: string | null
  }
}

type ApiResponse = {
  items: NotificationItem[]
  page: number
  size: number
  total: number
  unread: number
}

const PAGE_SIZE = 12
const TYPE_FILTERS = [
  { label: 'Tất cả', value: 'all' },
  { label: 'Đăng ký', value: 'REGISTRATION_CONFIRMED' },
  { label: 'Thanh toán lỗi', value: 'PAYMENT_FAILED' },
  { label: 'Hủy workshop', value: 'WORKSHOP_CANCELLED' },
  { label: 'Cập nhật workshop', value: 'WORKSHOP_UPDATED' },
  { label: 'Nhắc check-in', value: 'CHECKIN_REMINDER' },
]

const READ_FILTERS = [
  { label: 'Tất cả', value: 'all' },
  { label: 'Chưa đọc', value: 'unread' },
  { label: 'Đã đọc', value: 'read' },
]

function formatDate(value: string) {
  const date = new Date(value)
  return date.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function AdminNotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [total, setTotal] = useState(0)
  const [unread, setUnread] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [readFilter, setReadFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')

  const sentinelRef = useRef<HTMLDivElement>(null)
  const isFetchingRef = useRef(false)

  const queryParams = useMemo(() => {
    const params = new URLSearchParams()
    params.set('size', String(PAGE_SIZE))
    if (readFilter === 'read') params.set('read', 'true')
    if (readFilter === 'unread') params.set('read', 'false')
    if (typeFilter !== 'all') params.set('type', typeFilter)
    if (search.trim()) params.set('q', search.trim())
    return params
  }, [readFilter, typeFilter, search])

  const loadPage = useCallback(
    async (nextPage: number, mode: 'replace' | 'append') => {
      if (isFetchingRef.current) return
      isFetchingRef.current = true
      setLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams(queryParams)
        params.set('page', String(nextPage))
        const response = await fetch(`/api/admin/notifications?${params.toString()}`)
        if (!response.ok) throw new Error('Không thể tải danh sách thông báo')
        const data = (await response.json()) as ApiResponse

        setItems((prev) => (mode === 'replace' ? data.items : [...prev, ...data.items]))
        setTotal(data.total)
        setUnread(data.unread)
        setPage(data.page)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Có lỗi xảy ra')
      } finally {
        setLoading(false)
        isFetchingRef.current = false
      }
    },
    [queryParams]
  )

  useEffect(() => {
    const id = setTimeout(() => {
      void loadPage(1, 'replace')
    }, 0)
    return () => clearTimeout(id)
  }, [loadPage])

  const hasMore = items.length < total

  const handleLoadMore = useCallback(() => {
    if (loading || !hasMore) return
    void loadPage(page + 1, 'append')
  }, [hasMore, loadPage, loading, page])

  useEffect(() => {
    if (!sentinelRef.current) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) handleLoadMore()
      },
      { rootMargin: '200px' }
    )
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [handleLoadMore])

  return (
    <div className="space-y-10">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-ink/50">ADMIN / NOTIFICATIONS</p>
        <h1 className="mt-3 font-display text-[56px] uppercase leading-[0.85] text-ink">Thông Báo</h1>
        <p className="mt-3 max-w-2xl text-[14px] text-ink/60">
          Theo dõi thông báo gửi đến người dùng, lọc nhanh theo loại và trạng thái, và tải thêm theo từng trang.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-none border-hairline">
          <CardHeader className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Trung tâm thông báo
              </CardTitle>
              <Badge className="bg-ink text-canvas">{total} thông báo</Badge>
            </div>
            <CardDescription className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1 text-[12px] text-ink/50">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Chưa đọc: {unread}
              </span>
              <span className="inline-flex items-center gap-1 text-[12px] text-ink/50">
                <MailWarning className="h-3.5 w-3.5" />
                Tải theo trang {page}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-full border border-hairline bg-canvas px-3 py-2">
                <Search className="h-3.5 w-3.5 text-ink/40" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm theo tiêu đề, nội dung, người nhận"
                  className="min-w-55 bg-transparent text-[13px] text-ink placeholder:text-ink/40 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 rounded-full border border-hairline bg-canvas px-3 py-2 text-[12px] text-ink/60">
                <Filter className="h-3.5 w-3.5" />
                {READ_FILTERS.map((filter) => (
                  <button
                    key={filter.value}
                    onClick={() => setReadFilter(filter.value)}
                    className={cn(
                      'rounded-full px-3 py-1 transition-colors',
                      readFilter === filter.value
                        ? 'bg-ink text-canvas'
                        : 'text-ink/60 hover:text-ink'
                    )}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {TYPE_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setTypeFilter(filter.value)}
                  className={cn(
                    'rounded-full border border-hairline px-4 py-2 text-[12px] font-medium uppercase tracking-[0.08em] transition-colors',
                    typeFilter === filter.value
                      ? 'border-ink bg-ink text-canvas'
                      : 'text-ink/60 hover:border-ink hover:text-ink'
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {error && (
              <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {items.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className={cn(
                      'flex gap-3 rounded-xl border border-hairline bg-canvas p-4 transition-shadow hover:shadow-sm',
                      item.read ? 'opacity-70' : 'border-ink/30'
                    )}
                  >
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-hairline bg-cloud">
                      {item.user.image ? (
                        <Image
                          src={item.user.image}
                          alt=""
                          fill
                          sizes="40px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[12px] font-semibold text-ink/60">
                          {(item.user.name ?? item.user.email)[0]?.toUpperCase()}
                        </div>
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[13px] font-semibold text-ink">{item.title}</p>
                        {!item.read && <Badge className="bg-emerald text-canvas">New</Badge>}
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {item.type}
                        </Badge>
                      </div>
                      <p className="mt-2 text-[13px] text-ink/60 line-clamp-2">{item.body}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-ink/50">
                        <span>{item.user.name ?? 'Chưa đặt tên'}</span>
                        <span>•</span>
                        <span>{item.user.email}</span>
                        <span>•</span>
                        <span>{formatDate(item.createdAt)}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {items.length === 0 && !loading && (
                <div className="rounded border border-hairline px-4 py-6 text-center text-[13px] text-ink/60">
                  Chưa có thông báo phù hợp bộ lọc.
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[12px] text-ink/50">
                Hiển thị {Math.min(items.length, total)} / {total} thông báo
              </p>
              <button
                onClick={handleLoadMore}
                disabled={!hasMore || loading}
                className="inline-flex items-center gap-2 rounded-full border border-hairline px-4 py-2 text-[12px] font-medium uppercase tracking-widest text-ink transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? <Loader className="h-3.5 w-3.5 animate-spin" /> : 'Tải thêm'}
              </button>
            </div>

            <div ref={sentinelRef} className="h-2" />
          </CardContent>
        </Card>

        <Card className="rounded-none border-hairline">
          <CardHeader>
            <CardTitle>Chức năng cần thiết</CardTitle>
            <CardDescription>Checklist vận hành thông báo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-[13px] text-ink/60">
            <div className="rounded-lg border border-hairline p-3">
              <p className="font-semibold text-ink">Theo dõi lượng gửi</p>
              <p className="mt-1">Nắm tổng số thông báo và trạng thái đọc để đánh giá hiệu quả.</p>
            </div>
            <div className="rounded-lg border border-hairline p-3">
              <p className="font-semibold text-ink">Bộ lọc nhanh</p>
              <p className="mt-1">Lọc theo loại sự kiện, trạng thái đọc, và tìm theo tên/email.</p>
            </div>
            <div className="rounded-lg border border-hairline p-3">
              <p className="font-semibold text-ink">Tải theo trang</p>
              <p className="mt-1">Lazy loading để tối ưu hiệu năng khi dữ liệu tăng lớn.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
