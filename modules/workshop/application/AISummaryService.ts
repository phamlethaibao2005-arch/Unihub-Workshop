import { ConflictError, NotFoundError } from '@/shared/errors/AppError'
import { AISummaryStatus } from '../domain/AISummaryStatus'
import type { IWorkshopRepository } from '../domain/IWorkshopRepository'
import type { UpdateWorkshopInput } from '../domain/Workshop'
import {
  AISummaryPipeline,
  GeminiSummarizeError,
  PDFDownloadError,
  PDFEmptyError,
  PDFExtractError,
} from '../infrastructure/AISummaryPipeline'

const CONCURRENT_UPDATE_ERROR = 'Workshop was modified concurrently, please retry'

function failureMessage(err: unknown): string {
  if (err instanceof PDFEmptyError) return 'PDF không có text layer'
  if (err instanceof PDFDownloadError) return 'Không thể tải PDF'
  if (err instanceof PDFExtractError) return 'Không thể trích xuất nội dung PDF'
  if (err instanceof GeminiSummarizeError) return 'Gemini không phản hồi'
  return 'Lỗi xử lý PDF'
}

export class AISummaryService {
  constructor(
    private readonly repo: IWorkshopRepository,
    private readonly pipeline: AISummaryPipeline
  ) {}

  async processPDF(
    workshopId: string,
    pdfUrl: string,
    options: { markFailed?: boolean } = {}
  ): Promise<void> {
    try {
      const summary = await this.pipeline.run(pdfUrl)
      await this.persist(workshopId, {
        aiSummary: summary,
        aiSummaryStatus: AISummaryStatus.COMPLETED,
        pdfUrl,
      })
    } catch (err) {
      const shouldMarkFailed = options.markFailed !== false || err instanceof PDFEmptyError
      if (shouldMarkFailed) {
        await this.persist(workshopId, {
          aiSummary: failureMessage(err),
          aiSummaryStatus: AISummaryStatus.FAILED,
          pdfUrl,
        })
      }
      if (err instanceof PDFEmptyError) return
      throw err
    }
  }

  private async persist(workshopId: string, patch: UpdateWorkshopInput): Promise<void> {
    const workshop = await this.repo.findById(workshopId)
    if (!workshop) throw new NotFoundError(`Workshop not found: ${workshopId}`)

    const expectedVersion = workshop.version
    workshop.update(patch)
    const updated = await this.repo.update(workshop, expectedVersion)
    if (updated) return

    const retryWorkshop = await this.repo.findById(workshopId)
    if (!retryWorkshop) throw new NotFoundError(`Workshop not found: ${workshopId}`)

    const retryExpected = retryWorkshop.version
    retryWorkshop.update(patch)
    const retryUpdated = await this.repo.update(retryWorkshop, retryExpected)
    if (!retryUpdated) throw new ConflictError(CONCURRENT_UPDATE_ERROR)
  }
}
