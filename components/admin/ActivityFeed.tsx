'use client'

import { useEffect, useRef, useState } from 'react'

type ActivityItem = {
  id: string
  type: 'registration' | 'checkin' | 'cancelled'
  message: string
  at: string
}

const TYPE_PREFIX: Record<ActivityItem['type'], string> = {
  registration: '> reg  ',
  checkin: '> scan ',
  cancelled: '> cancel ',
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

export function ActivityFeed() {
  const [lines, setLines] = useState<ActivityItem[]>([])
  const [connected, setConnected] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const es = new EventSource('/api/admin/activity')
    setConnected(true)

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data as string) as { type: string; items?: ActivityItem[] }
        if (data.type === 'init' || data.type === 'update') {
          setLines((prev) => {
            const incoming = data.items ?? []
            if (data.type === 'init') return incoming
            const ids = new Set(prev.map((l) => l.id))
            const fresh = incoming.filter((i) => !ids.has(i.id))
            return [...fresh, ...prev].slice(0, 50)
          })
        }
      } catch {}
    }

    es.onerror = () => setConnected(false)

    return () => es.close()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines])

  return (
    <div className="flex flex-col border border-hairline bg-[#111] text-white">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/60">Activity feed</span>
        <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald' : 'bg-nikered'}`} />
      </div>
      <div className="h-[240px] overflow-y-auto p-4 font-mono text-[12px] text-white/80 space-y-1">
        {lines.length === 0 && (
          <span className="text-white/30">Chờ hoạt động…</span>
        )}
        {lines.map((line) => (
          <div key={line.id} className="flex gap-3">
            <span className="shrink-0 text-white/40">{fmtTime(line.at)}</span>
            <span className={line.type === 'cancelled' ? 'text-nikered' : line.type === 'checkin' ? 'text-cyan' : 'text-white/90'}>
              {TYPE_PREFIX[line.type]}{line.message}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
