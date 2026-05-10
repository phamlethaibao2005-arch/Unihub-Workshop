export interface IIdempotencyService {
  runOnce<T>(key: string, ttlHours: number, fn: () => Promise<T>): Promise<T>
}
