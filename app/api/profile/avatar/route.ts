import { NextResponse } from 'next/server'
import { unstable_rethrow } from 'next/navigation'
import { put } from '@vercel/blob'
import { requireAuth } from '@/lib/session'
import { ValidationError } from '@/shared/errors/AppError'
import { toResponse } from '@/shared/errors/handle'

export const runtime = 'nodejs'

const MAX_BYTES = 2 * 1024 * 1024

function extensionFor(type: string): string {
  if (type === 'image/png') return 'png'
  if (type === 'image/webp') return 'webp'
  return 'jpg'
}

export async function POST(req: Request) {
  try {
    const session = await requireAuth()
    const formData = await req.formData()
    const file = formData.get('file')

    if (!file || typeof file === 'string') {
      throw new ValidationError('Thiếu file ảnh')
    }

    if (!file.type.startsWith('image/')) {
      throw new ValidationError('Chỉ chấp nhận file ảnh')
    }

    if (file.size > MAX_BYTES) {
      throw new ValidationError('Ảnh không được vượt quá 2MB')
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = extensionFor(file.type)
    const key = `avatars/${session.user.id}/${Date.now()}.${ext}`

    const blob = await put(key, buffer, {
      access: 'public',
      contentType: file.type,
    })

    return NextResponse.json({ url: blob.url })
  } catch (err) {
    unstable_rethrow(err)
    return toResponse(err)
  }
}
