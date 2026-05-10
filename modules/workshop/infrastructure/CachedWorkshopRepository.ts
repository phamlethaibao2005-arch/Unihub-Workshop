import type { Redis } from '@upstash/redis'
import type { IWorkshopRepository, WorkshopFilters, PaginatedResult } from '../domain/IWorkshopRepository'
import { Workshop, type WorkshopProps } from '../domain/Workshop'

const TTL = 60 // seconds

// JSON round-trip turns Date objects into ISO strings — restore them before
// reconstructing a domain entity.
function rehydrate(raw: WorkshopProps): WorkshopProps {
  return {
    ...raw,
    date: new Date(raw.date as unknown as string),
    startTime: new Date(raw.startTime as unknown as string),
    endTime: new Date(raw.endTime as unknown as string),
  }
}

export class CachedWorkshopRepository implements IWorkshopRepository {
  constructor(
    private readonly inner: IWorkshopRepository,
    private readonly redis: Redis
  ) {}

  private idKey(id: string) {
    return `workshop:${id}`
  }

  private dateKey(date: Date) {
    return `workshops:date:${date.toISOString().split('T')[0]}`
  }

  async findById(id: string): Promise<Workshop | null> {
    const key = this.idKey(id)
    const cached = await this.redis.get<WorkshopProps>(key)
    if (cached) return new Workshop(rehydrate(cached))

    const workshop = await this.inner.findById(id)
    if (workshop) {
      await this.redis.set(key, workshop.toProps(), { ex: TTL })
    }
    return workshop
  }

  async findActiveByDate(date: Date): Promise<Workshop[]> {
    const key = this.dateKey(date)
    const cached = await this.redis.get<WorkshopProps[]>(key)
    if (cached) return cached.map((raw) => new Workshop(rehydrate(raw)))

    const workshops = await this.inner.findActiveByDate(date)
    await this.redis.set(key, workshops.map((w) => w.toProps()), { ex: TTL })
    return workshops
  }

  // Paginated lists have too many filter combinations to cache usefully.
  async listPaginated(params: {
    filters?: WorkshopFilters
    page: number
    size: number
  }): Promise<PaginatedResult<Workshop>> {
    return this.inner.listPaginated(params)
  }

  async update(workshop: Workshop, expectedVersion: number): Promise<boolean> {
    const success = await this.inner.update(workshop, expectedVersion)
    if (success) {
      await Promise.all([
        this.redis.del(this.idKey(workshop.id)),
        this.redis.del(this.dateKey(workshop.date)),
      ])
    }
    return success
  }

  async create(workshop: Workshop): Promise<Workshop> {
    const created = await this.inner.create(workshop)
    // Invalidate the date-list cache so the new workshop appears.
    await this.redis.del(this.dateKey(workshop.date))
    return created
  }

  async softDelete(id: string): Promise<void> {
    // Fetch before deleting so we can derive the date cache key to invalidate.
    const workshop = await this.inner.findById(id)
    await this.inner.softDelete(id)
    await this.redis.del(this.idKey(id))
    if (workshop) {
      await this.redis.del(this.dateKey(workshop.date))
    }
  }
}
