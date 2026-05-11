'use client'

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { AISummaryStatus } from '@/modules/workshop/domain/AISummaryStatus'
import { PillButton } from '@/components/PillButton'
import { cn } from '@/lib/utils'

type LogLine = {
  text: string
  tone?: 'error'
}

type AISummaryTerminalProps = {
  workshopId: string
  status?: AISummaryStatus | string | null
  failureReason?: string | null
  readOnly?: boolean
}

const MAX_PDF_BYTES = 10 * 1024 * 1024

function normalizeStatus(value?: AISummaryStatus | string | null): AISummaryStatus {
  if (!value) return AISummaryStatus.NONE
  if (Object.values(AISummaryStatus).includes(value as AISummaryStatus)) {
    return value as AISummaryStatus
  }
  return AISummaryStatus.NONE
}

function buildInitialLogs(status: AISummaryStatus, failureReason?: string | null): LogLine[] {
  if (status === AISummaryStatus.PROCESSING) {
    return [
      { text: '> status: PROCESSING' },
      { text: '> gemini: extracting...' },
      { text: '> gemini: summarizing...' },
    ]
  }
  if (status === AISummaryStatus.COMPLETED) return [{ text: '> done' }]
  if (status === AISummaryStatus.FAILED) {
    return [{ text: `> error: ${failureReason || 'Lỗi không xác định'}`, tone: 'error' }]
  }
  return []
}

export function AISummaryTerminal({
  workshopId,
  status,
  failureReason,
  readOnly = false,
}: AISummaryTerminalProps) {
  const initialStatus = normalizeStatus(status)
  const [currentStatus, setCurrentStatus] = useState<AISummaryStatus>(initialStatus)
  const [logs, setLogs] = useState<LogLine[]>(() =>
    buildInitialLogs(initialStatus, failureReason)
  )
  const [currentFailure, setCurrentFailure] = useState<string | null>(failureReason ?? null)
  const [uploading, setUploading] = useState(false)
  const lastStatusRef = useRef<AISummaryStatus>(initialStatus)
  const inputRef = useRef<HTMLInputElement>(null)

  const appendLog = useCallback((line: LogLine) => {
    setLogs((prev) => [...prev, line])
  }, [])

  const appendProcessingLogs = useCallback(() => {
    setLogs((prev) => [
      ...prev,
      { text: '> status: PROCESSING' },
      { text: '> gemini: extracting...' },
      { text: '> gemini: summarizing...' },
    ])
  }, [])

  const appendStatusLogs = useCallback(() => {
    if (currentStatus === lastStatusRef.current) return

    if (currentStatus === AISummaryStatus.COMPLETED) {
      appendLog({ text: '> done' })
    }
    if (currentStatus === AISummaryStatus.FAILED) {
      appendLog({
        text: `> error: ${currentFailure || 'Lỗi không xác định'}`,
        tone: 'error',
      })
    }

    lastStatusRef.current = currentStatus
  }, [appendLog, currentFailure, currentStatus])

  useEffect(() => {
    appendStatusLogs()
  }, [appendStatusLogs])

  useEffect(() => {
    if (currentStatus !== AISummaryStatus.PROCESSING) return

    let active = true
    const poll = async () => {
      try {
        const res = await fetch(`/api/workshops/${workshopId}`, { cache: 'no-store' })
        if (!res.ok) return
        const data = (await res.json()) as { aiSummaryStatus?: string; aiSummary?: string | null }
        const nextStatus = normalizeStatus(data.aiSummaryStatus)
        if (!active || nextStatus === currentStatus) return
        if (nextStatus === AISummaryStatus.FAILED) {
          setCurrentFailure(data.aiSummary ?? 'Lỗi không xác định')
        }
        setCurrentStatus(nextStatus)
      } catch {
        // Ignore polling failures
      }
    }

    poll()
    const timer = window.setInterval(poll, 10_000)

    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [currentStatus, workshopId])

  const uploadFile = useCallback(async (file: File) => {
    if (file.type !== 'application/pdf') {
      appendLog({ text: '> error: Chỉ chấp nhận file PDF', tone: 'error' })
      return
    }

    if (file.size > MAX_PDF_BYTES) {
      appendLog({ text: '> error: File không được vượt quá 10MB', tone: 'error' })
      return
    }

    appendLog({ text: `> upload --workshop ${workshopId} --file ${file.name}` })
    appendProcessingLogs()
    setCurrentFailure(null)
    setCurrentStatus(AISummaryStatus.PROCESSING)

    const formData = new FormData()
    formData.append('file', file)

    setUploading(true)
    try {
      const res = await fetch(`/api/admin/workshops/${workshopId}/upload-pdf`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null
        const message = payload?.error || 'Upload thất bại'
        setCurrentFailure(message)
        setCurrentStatus(AISummaryStatus.FAILED)
      }
    } catch {
      setCurrentFailure('Upload thất bại')
      setCurrentStatus(AISummaryStatus.FAILED)
    } finally {
      setUploading(false)
    }
  }, [appendLog, appendProcessingLogs, workshopId])

  const onDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (readOnly) return
    const file = event.dataTransfer.files?.[0]
    if (file) void uploadFile(file)
  }, [readOnly, uploadFile])

  const onFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) void uploadFile(file)
  }, [uploadFile])

  const isActive = currentStatus === AISummaryStatus.PROCESSING || uploading

  return (
    <div className="space-y-4 border border-hairline bg-[#111] p-6 text-white rounded-none">
      {!readOnly && (
        <div
          className="flex flex-col items-center justify-center gap-3 border border-dashed border-hairline/60 p-4 text-[11px] uppercase tracking-[0.2em] text-white/70"
          onDrop={onDrop}
          onDragOver={(event) => event.preventDefault()}
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="sr-only"
            onChange={onFileChange}
            disabled={uploading}
          />
          <PillButton
            variant="ghost"
            type="button"
            className="border-white/50 text-white hover:bg-white hover:text-ink disabled:opacity-60"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Đang tải...' : 'Chọn PDF'}
          </PillButton>
          <span>Kéo thả PDF vào đây</span>
        </div>
      )}

      <div className="space-y-2 font-mono text-[12px] text-white/90">
        {logs.map((line, index) => {
          const isLast = index === logs.length - 1
          return (
            <div
              key={`${line.text}-${index}`}
              className={cn(
                'whitespace-pre-wrap',
                line.tone === 'error' && 'text-nikered',
                isActive && isLast && 'terminal-cursor'
              )}
            >
              {line.text}
            </div>
          )
        })}
      </div>
    </div>
  )
}
