import { NextResponse } from 'next/server'
import { unstable_rethrow } from 'next/navigation'
import { put } from '@vercel/blob'
import { z } from 'zod'
import { Container } from '@/shared/infrastructure/Container'
import type { IWorkshopRepository } from '@/modules/workshop/domain/IWorkshopRepository'
import { AISummaryStatus } from '@/modules/workshop/domain/AISummaryStatus'
import { ConflictError, NotFoundError, ValidationError } from '@/shared/errors/AppError'
import { enqueue } from '@/shared/infrastructure/QStashClient'
import { toResponse } from '@/shared/errors/handle'

export const runtime = 'nodejs'

const MAX_PDF_BYTES = 10 * 1024 * 1024
const paramsSchema = z.object({ id: z.string().min(1) })
const BASE_URL = process.env.BETTER_AUTH_URL!
const DESTINATION = `${BASE_URL}/api/queue/ai-summary`

function getRepository() {
  return Container.resolve<IWorkshopRepository>('workshopRepository')
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = paramsSchema.parse(await params)
    const formData = await req.formData()
    const file = formData.get('file')

    if (!file || typeof file === 'string') {
      throw new ValidationError('Thiếu file PDF')
    }

    if (file.type !== 'application/pdf') {
      throw new ValidationError('Chỉ chấp nhận file PDF')
    }

    if (file.size > MAX_PDF_BYTES) {
      throw new ValidationError('File không được vượt quá 10MB')
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const blob = await put(`workshops/${id}/${Date.now()}.pdf`, buffer, {
      access: 'public',
      contentType: file.type,
    })

    const repo = getRepository()
    const workshop = await repo.findById(id)
    if (!workshop) throw new NotFoundError(`Workshop not found: ${id}`)

    const expectedVersion = workshop.version
    workshop.update({
      pdfUrl: blob.url,
      aiSummaryStatus: AISummaryStatus.PROCESSING,
      aiSummary: null,
    })

    const updated = await repo.update(workshop, expectedVersion)
    if (!updated) {
      throw new ConflictError('Workshop was modified concurrently, please retry')
    }

    await enqueue(DESTINATION, { workshopId: id, pdfUrl: blob.url }, {
      retries: 3,
      deduplicationId: `${id}-${Date.now()}`,
    })

    return NextResponse.json({ status: 'processing' }, { status: 202 })
  } catch (err) {
    unstable_rethrow(err)
    return toResponse(err)
  }
}
