import type { Workshop } from './Workshop'
import type { WorkshopStatus } from './WorkshopStatus'

export interface WorkshopFilters {
  date?: Date
  status?: WorkshopStatus
  search?: string
}

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  size: number
}

export interface IWorkshopRepository {
  findById(id: string): Promise<Workshop | null>
  findActiveByDate(date: Date): Promise<Workshop[]>
  listPaginated(params: {
    filters?: WorkshopFilters
    page: number
    size: number
  }): Promise<PaginatedResult<Workshop>>
  // Returns false when the optimistic-lock version check fails (no rows updated).
  update(workshop: Workshop, expectedVersion: number): Promise<boolean>
  create(workshop: Workshop): Promise<Workshop>
  softDelete(id: string): Promise<void>
}
