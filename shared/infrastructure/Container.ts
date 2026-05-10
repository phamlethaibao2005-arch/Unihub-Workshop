import type { IWorkshopRepository } from '@/modules/workshop/domain/IWorkshopRepository'
import { PrismaWorkshopRepository } from '@/modules/workshop/infrastructure/PrismaWorkshopRepository'
import { CachedWorkshopRepository } from '@/modules/workshop/infrastructure/CachedWorkshopRepository'
import { db } from './PrismaClient'
import { redis } from './RedisClient'

type Factory<T> = () => T;

const registry = new Map<string, Factory<unknown>>();
const singletons = new Map<string, unknown>();

export const Container = {
  register<T>(token: string, factory: Factory<T>): void {
    registry.set(token, factory as Factory<unknown>);
  },

  resolve<T>(token: string): T {
    if (singletons.has(token)) {
      return singletons.get(token) as T;
    }
    const factory = registry.get(token);
    if (!factory) {
      throw new Error(`[Container] No registration found for token: ${token}`);
    }
    const instance = factory() as T;
    singletons.set(token, instance);
    return instance;
  },

  reset(): void {
    singletons.clear();
  },
};

// ── Registrations ──────────────────────────────────────────────────────────
// workshopRepository: CachedWorkshopRepository(PrismaWorkshopRepository)
// findById hits Redis first; only one SQL query on repeated calls.
Container.register<IWorkshopRepository>(
  'workshopRepository',
  () => new CachedWorkshopRepository(new PrismaWorkshopRepository(db), redis)
);
