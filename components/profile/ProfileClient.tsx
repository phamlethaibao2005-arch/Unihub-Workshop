'use client'

import { useState } from 'react'
import { authClient } from '@/lib/auth-client'

interface Stats {
  total: number
  confirmed: number
  upcoming: number
}

interface Props {
  name: string
  email: string
  studentId: string | null
  stats: Stats
}

export function ProfileClient({ name: initialName, email, studentId: initialStudentId, stats }: Props) {
  const [name, setName] = useState(initialName)
  const [studentId, setStudentId] = useState(initialStudentId ?? '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase())
    .slice(0, 2)
    .join('') || 'U'

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        studentId: studentId.trim() || null,
      }
      const result = await (authClient.updateUser as (data: Record<string, unknown>) => Promise<{ error: { message?: string } | null }>)(payload)
      if (result?.error) {
        setMessage({ type: 'error', text: result.error.message ?? 'Có lỗi xảy ra' })
      } else {
        setMessage({ type: 'success', text: 'Đã cập nhật thông tin' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Có lỗi xảy ra, vui lòng thử lại' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-0">
      {/* Avatar + name */}
      <div className="flex items-center gap-4 mb-8">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-ink text-canvas">
          <span className="font-display text-[28px] leading-none">{initials}</span>
        </div>
        <div>
          <p className="text-[15px] font-semibold text-ink leading-tight">{name || 'Chưa đặt tên'}</p>
          <p className="text-[13px] text-ink/50 mt-0.5">{email}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 border border-hairline mb-8">
        {[
          { label: 'Đăng ký', value: stats.total },
          { label: 'Xác nhận', value: stats.confirmed },
          { label: 'Sắp tới', value: stats.upcoming },
        ].map(({ label, value }, i) => (
          <div
            key={label}
            className={`flex flex-col items-center justify-center py-5 ${i < 2 ? 'border-r border-hairline' : ''}`}
          >
            <span className="font-display text-[36px] leading-none text-ink">{value}</span>
            <span className="mt-1 text-[10px] uppercase tracking-[0.12em] text-ink/50">{label}</span>
          </div>
        ))}
      </div>

      {/* Edit form */}
      <div className="border border-hairline p-6 flex flex-col gap-5">
        <p className="text-[11px] uppercase tracking-[0.15em] text-ink/50 pb-4 border-b border-hairline -mb-1">
          Chỉnh sửa thông tin
        </p>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] uppercase tracking-[0.1em] text-ink/50">Họ và tên</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nhập họ và tên"
            className="h-10 border border-hairline bg-canvas px-3 text-[14px] text-ink outline-none focus:border-ink transition-colors"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] uppercase tracking-[0.1em] text-ink/50">Mã số sinh viên</span>
          <input
            type="text"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            placeholder="Nhập MSSV"
            className="h-10 border border-hairline bg-canvas px-3 text-[14px] text-ink outline-none focus:border-ink transition-colors"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] uppercase tracking-[0.1em] text-ink/50">Email</span>
          <input
            type="email"
            value={email}
            disabled
            className="h-10 border border-hairline bg-cloud px-3 text-[14px] text-ink/40 cursor-not-allowed"
          />
          <span className="text-[11px] text-ink/40">Email không thể thay đổi</span>
        </label>
      </div>

      {message && (
        <div
          className={`mt-4 border px-4 py-3 text-[13px] ${
            message.type === 'success'
              ? 'border-[var(--emerald)] text-[var(--emerald)]'
              : 'border-[var(--red)] text-[var(--red)]'
          }`}
        >
          {message.text}
        </div>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="pill-primary mt-5 h-11 w-full text-[13px] font-semibold uppercase tracking-[0.08em] disabled:opacity-50"
      >
        {saving ? 'Đang lưu…' : 'Lưu thông tin'}
      </button>
    </div>
  )
}
