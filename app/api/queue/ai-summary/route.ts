import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { verifyQStashSignature } from '@/shared/infrastructure/QStashClient'
import { Container } from '@/shared/infrastructure/Container'
import type { IWorkshopRepository } from '@/modules/workshop/domain/IWorkshopRepository'
import { AISummaryService } from '@/modules/workshop/application/AISummaryService'
import { AISummaryPipeline } from '@/modules/workshop/infrastructure/AISummaryPipeline'

export const runtime = 'nodejs'

function buildService() {
  return new AISummaryService(
    Container.resolve<IWorkshopRepository>('workshopRepository'),
    new AISummaryPipeline()
  )
}

const payloadSchema = z.object({
  workshopId: z.string().min(1),
  pdfUrl: z.string().url(),
})

export async function POST(req: NextRequest) {
  try {
    await verifyQStashSignature(req.clone() as unknown as NextRequest)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: z.infer<typeof payloadSchema>
  try {
    payload = payloadSchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const retryCount = Number(req.headers.get('upstash-retry-count') ?? 0)
  // Mark failed on any retry so the workshop never stays stuck in PROCESSING
  const shouldMarkFailed = true

  try {
    await buildService().processPDF(payload.workshopId, payload.pdfUrl, {
      markFailed: shouldMarkFailed,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[AISummary] workshopId=${payload.workshopId} retry=${retryCount}`, err)
    return NextResponse.json({ error: 'Processing failed', detail: message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
