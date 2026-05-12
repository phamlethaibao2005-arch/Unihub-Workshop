'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { Camera } from 'lucide-react'
import { updateUser } from '@/lib/auth-client'

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
  image: string | null
}

const MAX_AVATAR_BYTES = 2 * 1024 * 1024

function cropAndResizeToBlob(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new window.Image()
      img.onload = () => {
        const size = Math.min(img.width, img.height)
        const sx = (img.width - size) / 2
        const sy = (img.height - size) / 2

        const canvas = document.createElement('canvas')
        canvas.width = 200
        canvas.height = 200
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('canvas context unavailable'))
          return
        }
        ctx.drawImage(img, sx, sy, size, size, 0, 0, 200, 200)
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('blob creation failed'))
              return
            }
            resolve(blob)
          },
          'image/jpeg',
          0.85
        )
      }
      img.onerror = reject
      img.src = e.target?.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function ProfileClient({ name: initialName, email, studentId: initialStudentId, stats, image: initialImage }: Props) {
  const [name, setName] = useState(initialName)
  const [studentId, setStudentId] = useState(initialStudentId ?? '')
  const [saving, setSaving] = useState(false)
  const [avatarSaving, setAvatarSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [image, setImage] = useState<string | null>(initialImage)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase())
    .slice(0, 2)
    .join('') || 'U'

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // reset input so selecting same file works again
    e.target.value = ''

    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Chỉ chấp nhận file ảnh' })
      return
    }

    if (file.size > MAX_AVATAR_BYTES) {
      setMessage({ type: 'error', text: 'Ảnh không được vượt quá 2MB' })
      return
    }

    setAvatarSaving(true)
    try {
      const blob = await cropAndResizeToBlob(file)
      const formData = new FormData()
      formData.append('file', blob, 'avatar.jpg')

      const response = await fetch('/api/profile/avatar', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error ?? 'Không thể tải ảnh lên')
      }

      const data = (await response.json()) as { url?: string }
      if (!data.url) throw new Error('Không thể tải ảnh lên')

      const result = await updateUser({ image: data.url })
      if (result?.error) {
        setMessage({ type: 'error', text: result.error.message ?? 'Không thể lưu ảnh' })
      } else {
        setImage(data.url)
      }
    } catch {
      setMessage({ type: 'error', text: 'Có lỗi khi xử lý ảnh' })
    } finally {
      setAvatarSaving(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        studentId: studentId.trim() || null,
      }
      const result = await updateUser(payload)
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
        <button
          type="button"
          onClick={handleAvatarClick}
          disabled={avatarSaving}
          className="group relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-ink text-canvas overflow-hidden"
          aria-label="Thay đổi ảnh đại diện"
        >
          {image ? (
            <Image
              src={image}
              alt=""
              fill
              sizes="64px"
              className="object-cover"
            />
          ) : (
            <span className="font-display text-[28px] leading-none">{initials}</span>
          )}
          {/* Hover overlay */}
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
            {avatarSaving ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Camera className="h-5 w-5 text-white" />
            )}
          </div>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

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
          <span className="text-[11px] uppercase tracking-widest text-ink/50">Họ và tên</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nhập họ và tên"
            className="h-10 border border-hairline bg-canvas px-3 text-[14px] text-ink outline-none focus:border-ink transition-colors"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] uppercase tracking-widest text-ink/50">Mã số sinh viên</span>
          <input
            type="text"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            placeholder="Nhập MSSV"
            className="h-10 border border-hairline bg-canvas px-3 text-[14px] text-ink outline-none focus:border-ink transition-colors"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] uppercase tracking-widest text-ink/50">Email</span>
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
              ? 'border-(--emerald) text-(--emerald)'
              : 'border-(--red) text-(--red)'
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
