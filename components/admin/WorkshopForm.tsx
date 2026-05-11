'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PillButton } from '@/components/PillButton'
import type { WorkshopDetailDTO } from '@/shared/types/workshop'

type FormValues = {
  title: string
  description: string
  speaker: string
  room: string
  roomMapUrl: string
  date: string
  startTime: string
  endTime: string
  maxCapacity: string
  price: string
}

function toInputDate(iso?: string): string {
  if (!iso) return ''
  return iso.split('T')[0]
}

function toInputTime(isoOrTime?: string): string {
  if (!isoOrTime) return ''
  // Already "HH:MM"
  if (/^\d{2}:\d{2}/.test(isoOrTime)) return isoOrTime.slice(0, 5)
  // ISO date-time string
  const d = new Date(isoOrTime)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function buildDateTimeISO(date: string, time: string): string {
  return `${date}T${time}:00`
}

export function WorkshopForm({ initial }: { initial?: WorkshopDetailDTO }) {
  const router = useRouter()
  const isEdit = !!initial

  const [values, setValues] = useState<FormValues>({
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    speaker: initial?.speaker ?? '',
    room: initial?.location ?? '',
    roomMapUrl: initial?.roomMapUrl ?? '',
    date: toInputDate(initial?.date),
    startTime: toInputTime(initial?.time?.split(' - ')[0]),
    endTime: toInputTime(initial?.time?.split(' - ')[1]),
    maxCapacity: String(initial?.seatsTotal ?? ''),
    price: String(initial?.price ?? '0'),
  })
  const [submitting, setSubmitting] = useState(false)

  const set = (field: keyof FormValues) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setValues((v) => ({ ...v, [field]: e.target.value }))

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const body = {
        title: values.title,
        description: values.description || undefined,
        speaker: values.speaker,
        room: values.room,
        roomMapUrl: values.roomMapUrl || undefined,
        date: buildDateTimeISO(values.date, '00:00'),
        startTime: buildDateTimeISO(values.date, values.startTime),
        endTime: buildDateTimeISO(values.date, values.endTime),
        maxCapacity: Number(values.maxCapacity),
        price: Number(values.price),
      }

      const url = isEdit ? `/api/admin/workshops/${initial!.id}` : '/api/admin/workshops'
      const method = isEdit ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? 'Lỗi lưu workshop')
      }

      toast.success(isEdit ? 'Workshop đã được cập nhật' : 'Workshop đã được tạo')
      router.push('/admin/workshops')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lỗi không xác định')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="grid grid-cols-2 gap-8">
        {/* Left column */}
        <div className="space-y-5">
          <Field label="Tên workshop *">
            <input
              required
              value={values.title}
              onChange={set('title')}
              className="input-field"
              placeholder="System Design Masterclass"
            />
          </Field>

          <Field label="Mô tả">
            <textarea
              rows={4}
              value={values.description}
              onChange={set('description')}
              className="input-field resize-none"
              placeholder="Mô tả nội dung workshop..."
            />
          </Field>

          <Field label="Diễn giả *">
            <input
              required
              value={values.speaker}
              onChange={set('speaker')}
              className="input-field"
              placeholder="Dr. Nguyễn Văn A"
            />
          </Field>

          <Field label="Phòng *">
            <input
              required
              value={values.room}
              onChange={set('room')}
              className="input-field"
              placeholder="Hall A / Innovation Lab"
            />
          </Field>

          <Field label="Link bản đồ phòng">
            <input
              type="url"
              value={values.roomMapUrl}
              onChange={set('roomMapUrl')}
              className="input-field"
              placeholder="https://..."
            />
          </Field>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          <Field label="Ngày *">
            <input
              required
              type="date"
              value={values.date}
              onChange={set('date')}
              className="input-field"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Giờ bắt đầu *">
              <input
                required
                type="time"
                value={values.startTime}
                onChange={set('startTime')}
                className="input-field"
              />
            </Field>
            <Field label="Giờ kết thúc *">
              <input
                required
                type="time"
                value={values.endTime}
                onChange={set('endTime')}
                className="input-field"
              />
            </Field>
          </div>

          <Field label="Sức chứa tối đa *">
            <input
              required
              type="number"
              min={1}
              value={values.maxCapacity}
              onChange={set('maxCapacity')}
              className="input-field"
              placeholder="50"
            />
          </Field>

          <Field label="Giá (VND) — để 0 nếu miễn phí">
            <input
              type="number"
              min={0}
              step={1000}
              value={values.price}
              onChange={set('price')}
              className="input-field"
              placeholder="0"
            />
          </Field>
        </div>
      </div>

      <div className="flex gap-3 border-t border-hairline pt-6">
        <PillButton type="submit" disabled={submitting}>
          {submitting ? 'Đang lưu…' : isEdit ? 'Lưu thay đổi' : 'Tạo workshop'}
        </PillButton>
        <PillButton
          type="button"
          variant="ghost"
          onClick={() => router.push('/admin/workshops')}
        >
          Huỷ
        </PillButton>
      </div>
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] uppercase tracking-[0.15em] text-ink/60">{label}</label>
      {children}
    </div>
  )
}
