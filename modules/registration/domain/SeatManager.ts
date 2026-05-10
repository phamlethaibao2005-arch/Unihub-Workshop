/** Minimal Redis interface required by SeatManager — satisfied by @upstash/redis Redis. */
export interface ISeatStore {
  get<T = number>(key: string): Promise<T | null>
  set(key: string, value: number): Promise<unknown>
  incr(key: string): Promise<number>
  decr(key: string): Promise<number>
}

/**
 * Domain service: atomic seat counter backed by Redis.
 * Key layout: seats:<workshopId> (current available), seats:<workshopId>:max (capacity).
 *
 * tryReserve uses DECR-then-check: if the result goes negative the decrement is rolled back
 * and false is returned. DECR itself is atomic in Redis, so concurrent calls cannot both
 * succeed when only one seat remains.
 */
export class SeatManager {
  constructor(private readonly store: ISeatStore) {}

  private key(workshopId: string) { return `seats:${workshopId}` }
  private maxKey(workshopId: string) { return `seats:${workshopId}:max` }

  async init(workshopId: string, capacity: number): Promise<void> {
    await this.store.set(this.key(workshopId), capacity)
    await this.store.set(this.maxKey(workshopId), capacity)
  }

  async current(workshopId: string): Promise<number> {
    const val = await this.store.get<number>(this.key(workshopId))
    return val ?? 0
  }

  async tryReserve(workshopId: string): Promise<boolean> {
    const after = await this.store.decr(this.key(workshopId))
    if (after < 0) {
      await this.store.incr(this.key(workshopId))
      return false
    }
    return true
  }

  async release(workshopId: string): Promise<void> {
    const max = await this.store.get<number>(this.maxKey(workshopId))
    const after = await this.store.incr(this.key(workshopId))
    if (max !== null && after > max) {
      await this.store.set(this.key(workshopId), max)
    }
  }
}
