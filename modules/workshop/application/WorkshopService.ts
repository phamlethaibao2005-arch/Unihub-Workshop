import type { IEventBus } from '@/shared/domain/IEventBus'
import { NotFoundError, ConflictError } from '@/shared/errors/AppError'
import { Workshop, type CreateWorkshopInput, type UpdateWorkshopInput } from '../domain/Workshop'
import { WorkshopStatus } from '../domain/WorkshopStatus'
import { AISummaryStatus } from '../domain/AISummaryStatus'
import type { IWorkshopRepository, WorkshopFilters, PaginatedResult } from '../domain/IWorkshopRepository'
import { createWorkshopCancelledEvent } from '../domain/events/WorkshopCancelledEvent'
import { createWorkshopUpdatedEvent } from '../domain/events/WorkshopUpdatedEvent'

export class WorkshopService {
  constructor(
    private readonly repo: IWorkshopRepository,
    private readonly eventBus: IEventBus
  ) {}

  async list(params?: {
    filters?: WorkshopFilters
    page?: number
    size?: number
  }): Promise<PaginatedResult<Workshop>> {
    return this.repo.listPaginated({
      filters: params?.filters,
      page: params?.page ?? 1,
      size: params?.size ?? 20,
    })
  }

  async getById(id: string): Promise<Workshop> {
    const workshop = await this.repo.findById(id)
    if (!workshop) throw new NotFoundError(`Workshop not found: ${id}`)
    return workshop
  }

  async createWorkshop(input: CreateWorkshopInput, organizerId: string): Promise<Workshop> {
    const workshop = new Workshop({
      id: crypto.randomUUID(),
      title: input.title,
      description: input.description,
      speaker: input.speaker,
      room: input.room,
      roomMapUrl: input.roomMapUrl,
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      maxCapacity: input.maxCapacity,
      price: input.price,
      currentRegistrations: 0,
      version: 0,
      status: WorkshopStatus.ACTIVE,
      aiSummary: null,
      aiSummaryStatus: AISummaryStatus.NONE,
      pdfUrl: null,
      createdBy: organizerId,
    })
    return this.repo.create(workshop)
  }

  async updateWorkshop(id: string, patch: UpdateWorkshopInput): Promise<Workshop> {
    const workshop = await this.getById(id)
    const expectedVersion = workshop.version
    workshop.update(patch)
    const success = await this.repo.update(workshop, expectedVersion)
    if (!success) throw new ConflictError('Update conflict — workshop was modified concurrently, please retry')
    await this.eventBus.publish(
      createWorkshopUpdatedEvent(id, Object.keys(patch))
    )
    return workshop
  }

  async cancelWorkshop(id: string): Promise<void> {
    const workshop = await this.getById(id)
    const expectedVersion = workshop.version
    workshop.cancel()
    const success = await this.repo.update(workshop, expectedVersion)
    if (!success) throw new ConflictError('Update conflict — workshop was modified concurrently, please retry')
    await this.eventBus.publish(
      createWorkshopCancelledEvent(id, workshop.title)
    )
  }
}
