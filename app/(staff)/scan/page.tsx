'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import CameraScanner from '@/components/checkin/CameraScanner'
import * as idb from '@/lib/idb'
import { hmacVerify } from '@/lib/hmac'
import type { WorkshopRecord, PendingCheckinRecord } from '@/lib/idb'

// ── helpers ────────────────────────────────────────────────────────────────────

function getDeviceId(): string {
  let id = localStorage.getItem('scan-device-id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('scan-device-id', id)
  }
  return id
}

// Extracts the registrationId from either:
//   JSON  {"registrationId":"...", ...}
//   plain "UNIHUB-{registrationId}-{timestamp}"
function parseRegistrationId(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (typeof parsed.registrationId === 'string') return parsed.registrationId
  } catch {}
  const match = raw.match(/^UNIHUB-(.+)-\d+$/)
  return match ? match[1] : null
}

// ── component ──────────────────────────────────────────────────────────────────

export default function ScanPage() {
  const [online, setOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )
  const [workshops, setWorkshops] = useState<WorkshopRecord[]>([])
  const [selectedWorkshopId, setSelectedWorkshopId] = useState('')
  const [pendingCount, setPendingCount] = useState(0)
  const [scanning, setScanning] = useState(false)
  const [preloading, setPreloading] = useState(false)
  const [syncing, setSyncing] = useState(false)

  // Refs that mirror the latest state — used inside stable callbacks to avoid
  // stale closures while keeping the dependency array for useEffect empty.
  const onlineRef = useRef(online)
  onlineRef.current = online
  const workshopIdRef = useRef(selectedWorkshopId)
  workshopIdRef.current = selectedWorkshopId

  // Async-guard refs so syncPending / handleDecode are never re-entered
  const isSyncingRef = useRef(false)
  const processingRef = useRef(false)

  // ── IDB helpers ──────────────────────────────────────────────────────────────

  const refreshCounts = useCallback(async () => {
    try {
      const [ws, count] = await Promise.all([idb.getWorkshops(), idb.getPendingCount()])
      setWorkshops(ws)
      setPendingCount(count)
    } catch {
      // IDB might not be available during SSR; ignore
    }
  }, [])

  // ── sync ─────────────────────────────────────────────────────────────────────

  const syncPending = useCallback(async () => {
    if (isSyncingRef.current) return
    isSyncingRef.current = true
    setSyncing(true)
    try {
      const pending = await idb.getPendingCheckins()
      if (pending.length === 0) return
      const res = await fetch('/api/checkins/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: pending }),
      })
      if (!res.ok) throw new Error('Sync request failed')
      const { results } = (await res.json()) as {
        results: { registrationId: string; status: string }[]
      }
      let synced = 0
      await Promise.all(
        results.map(async (r) => {
          if (r.status !== 'invalid') {
            await idb.removePendingCheckin(r.registrationId)
            if (r.status === 'synced') synced++
          }
        }),
      )
      setPendingCount(await idb.getPendingCount())
      if (synced > 0) toast.success(`Synced ${synced} check-in${synced > 1 ? 's' : ''}`)
    } catch {
      toast.error('Sync failed — will retry when online')
    } finally {
      isSyncingRef.current = false
      setSyncing(false)
    }
  }, [])

  // ── mount: load IDB data + wire up listeners ─────────────────────────────────

  useEffect(() => {
    refreshCounts()
    if (navigator.onLine) syncPending()

    const handleOnline = () => {
      setOnline(true)
      syncPending()
    }
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // SW broadcasts SYNC_NOW when it hears the device is back online
    const handleSWMessage = (e: MessageEvent) => {
      if (e.data?.type === 'SYNC_NOW') syncPending()
    }
    navigator.serviceWorker?.addEventListener('message', handleSWMessage)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      navigator.serviceWorker?.removeEventListener('message', handleSWMessage)
    }
  }, [refreshCounts, syncPending])

  // ── preload ──────────────────────────────────────────────────────────────────

  async function handlePreload() {
    setPreloading(true)
    try {
      const date = new Date().toISOString().split('T')[0]
      const res = await fetch(`/api/checkins/preload?date=${date}`)
      if (!res.ok) {
        const body = (await res.json()) as { error?: string }
        throw new Error(body.error ?? 'Preload failed')
      }
      const data = (await res.json()) as {
        workshops: WorkshopRecord[]
        tickets: Array<{
          registrationId: string
          workshopId: string
          studentName: string
          studentId: string | null
          qrCode: string
          qrSignature: string | null
          checkedIn: boolean
        }>
        hmacKey: string
      }
      await idb.savePreload(data.workshops, data.tickets, data.hmacKey)
      setWorkshops(data.workshops)
      toast.success(
        `Loaded ${data.tickets.length} tickets across ${data.workshops.length} workshop${data.workshops.length !== 1 ? 's' : ''}`,
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Preload failed')
    } finally {
      setPreloading(false)
    }
  }

  // ── decode ───────────────────────────────────────────────────────────────────

  const handleDecode = useCallback(async (raw: string) => {
    if (processingRef.current) return
    processingRef.current = true
    setScanning(false) // close camera immediately

    try {
      const workshopId = workshopIdRef.current
      if (!workshopId) {
        toast.error('No workshop selected')
        return
      }

      if (onlineRef.current) {
        // ── online path: let the server do full validation ──────────────────
        const registrationId = parseRegistrationId(raw)
        if (!registrationId) {
          toast.error('Unrecognized QR code')
          return
        }
        const res = await fetch('/api/checkins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ registrationId, workshopId }),
        })
        if (res.ok) {
          toast.success('✓ Checked in!')
        } else {
          const body = (await res.json()) as { error?: string; code?: string }
          if (body.code === 'CONFLICT') toast.error('Already checked in')
          else if (body.code === 'NOT_FOUND') toast.error('Registration not found')
          else toast.error(body.error ?? 'Check-in failed')
        }
      } else {
        // ── offline path: verify locally against IDB ────────────────────────
        const ticket = await idb.getTicketByQrCode(raw)
        if (!ticket) {
          toast.error('QR not in preloaded data — tap Preload first')
          return
        }
        if (ticket.workshopId !== workshopId) {
          toast.error('QR belongs to a different workshop')
          return
        }
        if (ticket.checkedIn) {
          toast.error('Already checked in (offline record)')
          return
        }
        const hmacKey = await idb.getHmacKey()
        if (!hmacKey || !ticket.qrSignature) {
          toast.error('Cannot verify QR — please re-preload')
          return
        }
        const valid = await hmacVerify(ticket.qrCode, ticket.qrSignature, hmacKey)
        if (!valid) {
          toast.error('Invalid QR signature')
          return
        }
        const record: PendingCheckinRecord = {
          registrationId: ticket.registrationId,
          workshopId,
          checkedInAt: new Date().toISOString(),
          deviceId: getDeviceId(),
        }
        await idb.addPendingCheckin(record)
        await idb.updateTicketCheckedIn(ticket.registrationId, true)
        setPendingCount((n) => n + 1)
        toast.success(`✓ ${ticket.studentName} (offline — will sync)`)
      }
    } finally {
      processingRef.current = false
    }
  }, [])

  // ── render ───────────────────────────────────────────────────────────────────

  return (
    <>
      {scanning && <CameraScanner onDecode={handleDecode} onClose={() => setScanning(false)} />}

      <div className="flex min-h-svh flex-col bg-black text-white">
        {/* ── top bar ─────────────────────────────────────────────────────── */}
        <header className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <span className="text-sm font-semibold tracking-tight">UniHub Scan</span>

          <div className="ml-auto flex items-center gap-2">
            {/* online / offline pill */}
            <span
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                online ? 'bg-green-900/60 text-green-300' : 'bg-red-900/60 text-red-300'
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {online ? 'Online' : 'Offline'}
            </span>

            {/* pending badge */}
            {pendingCount > 0 && (
              <span className="rounded-full bg-yellow-500 px-2 py-0.5 text-xs font-bold text-black">
                {pendingCount} pending
              </span>
            )}

            {/* sync button */}
            <button
              onClick={syncPending}
              disabled={!online || syncing || pendingCount === 0}
              className="rounded-full border border-white/20 px-3 py-1 text-xs transition hover:bg-white/10 disabled:opacity-40"
            >
              {syncing ? 'Syncing…' : 'Sync now'}
            </button>
          </div>
        </header>

        {/* ── workshop row ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <select
            value={selectedWorkshopId}
            onChange={(e) => setSelectedWorkshopId(e.target.value)}
            className="flex-1 rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none"
          >
            <option value="">
              {workshops.length === 0 ? 'No workshops — tap Preload' : 'Select workshop…'}
            </option>
            {workshops.map((w) => (
              <option key={w.id} value={w.id}>
                {w.title} · {w.room}
              </option>
            ))}
          </select>

          <button
            onClick={handlePreload}
            disabled={preloading}
            className="rounded-lg bg-white/10 px-3 py-2 text-sm transition hover:bg-white/20 disabled:opacity-40"
          >
            {preloading ? 'Loading…' : 'Preload'}
          </button>
        </div>

        {/* ── scan area ────────────────────────────────────────────────────── */}
        <main className="flex flex-1 flex-col items-center justify-center gap-4 px-8 py-12">
          <button
            onClick={() => setScanning(true)}
            disabled={!selectedWorkshopId}
            className="rounded-full bg-white px-12 py-5 text-xl font-bold text-black shadow-[0_0_40px_rgba(255,255,255,0.15)] transition hover:bg-white/90 disabled:opacity-30"
          >
            Scan QR Code
          </button>

          {!selectedWorkshopId && workshops.length > 0 && (
            <p className="text-sm text-white/50">Select a workshop to begin scanning</p>
          )}
          {workshops.length === 0 && (
            <p className="max-w-xs text-center text-sm text-white/40">
              Tap <strong className="text-white/60">Preload</strong> to download today&apos;s
              workshops and enable offline scanning
            </p>
          )}
        </main>
      </div>
    </>
  )
}
