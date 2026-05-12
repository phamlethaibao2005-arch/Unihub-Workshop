/**
 * Concurrent registration load test.
 * Run: npx tsx scripts/load-test.ts
 *
 * Fires 100 register() calls against a workshop with capacity=60.
 * Asserts exactly 60 CONFIRMED registrations are created.
 *
 * The primary guard is SeatManager.tryReserve (Redis atomic DECR).
 * The DB optimistic-lock is the secondary safety net; in this in-memory
 * simulation we verify the Redis-level invariant.
 */
import assert from 'assert'
import { SeatManager, type ISeatStore } from '../modules/registration/domain/SeatManager'
import { RegistrationService } from '../modules/registration/application/RegistrationService'
import { Registration, type RegistrationProps } from '../modules/registration/domain/Registration'
import { RegistrationStatus } from '../modules/registration/domain/RegistrationStatus'
import { Workshop } from '../modules/workshop/domain/Workshop'
import { WorkshopStatus } from '../modules/workshop/domain/WorkshopStatus'
import { AISummaryStatus } from '../modules/workshop/domain/AISummaryStatus'
import type { IRegistrationRepository } from '../modules/registration/domain/IRegistrationRepository'
import type { IWorkshopRepository, WorkshopFilters, PaginatedResult } from '../modules/workshop/domain/IWorkshopRepository'
import type { IEventBus } from '../shared/domain/IEventBus'
import type { DomainEvent } from '../shared/domain/DomainEvent'
import type { IIdempotencyService } from '../modules/payment/application/IIdempotencyService'
import type { PrismaClient } from '@prisma/client'

// ── In-memory Redis store ────────────────────────────────────────────────────

function makeInMemoryStore(): ISeatStore {
  const data = new Map<string, number>()
  return {
    async get<T = number>(key: string): Promise<T | null> {
      const v = data.get(key)
      return v === undefined ? null : (v as unknown as T)
    },
    async set(key: string, value: number) { data.set(key, value); return 'OK' as const },
    async incr(key: string) { const v = (data.get(key) ?? 0) + 1; data.set(key, v); return v },
    async decr(key: string) { const v = (data.get(key) ?? 0) - 1; data.set(key, v); return v },
  }
}

// ── In-memory WorkshopRepository ────────────────────────────────────────────

function makeWorkshopRepo(workshopId: string, maxCapacity: number): IWorkshopRepository {
  const stored = {
    currentRegistrations: 0,
    version: 0,
    maxCapacity,
  }

  const make = () => new Workshop({
    id: workshopId,
    title: 'Test Workshop',
    description: null,
    speaker: 'Speaker',
    room: 'A1',
    roomMapUrl: null,
    date: new Date(),
    startTime: new Date(),
    endTime: new Date(),
    maxCapacity: stored.maxCapacity,
    currentRegistrations: stored.currentRegistrations,
    version: stored.version,
    price: 0,
    status: WorkshopStatus.ACTIVE,
    aiSummary: null,
    aiSummaryStatus: AISummaryStatus.NONE,
    pdfUrl: null,
    createdBy: 'organizer',
  })

  return {
    async findById() { return make() },
    async findActiveByDate() { return [] },
    async listPaginated(params: { filters?: WorkshopFilters; page: number; size: number }): Promise<PaginatedResult<Workshop>> {
      void params
      return { items: [make()], total: 1, page: 1, size: 20 }
    },
    // OL not enforced in mock — SeatManager is the real gate being tested.
    // update() atomically (synchronous Map mutation) increments the counter.
    async update() {
      if (stored.currentRegistrations >= stored.maxCapacity) return false
      stored.currentRegistrations += 1
      stored.version += 1
      return true
    },
    async create(w) { return w },
    async softDelete() {},
  }
}

// ── In-memory RegistrationRepository ────────────────────────────────────────

function makeRegistrationRepo(): IRegistrationRepository & { all(): Registration[] } {
  const rows = new Map<string, Registration>()

  return {
    all() { return [...rows.values()] },
    async findById(id) { return rows.get(id) ?? null },
    async findByUserAndWorkshop(userId, workshopId) {
      for (const r of rows.values()) {
        if (r.userId === userId && r.workshopId === workshopId) return r
      }
      return null
    },
    async listByUser() { return [] },
    async listByWorkshop() { return [] },
    async create(r) { rows.set(r.id, r); return r },
    async update(r) { rows.set(r.id, r); return r },
  }
}

// ── Mock IdempotencyService (each unique key runs once) ─────────────────────

class MockIdempotencyService implements IIdempotencyService {
  async runOnce<T>(_key: string, _ttl: number, fn: () => Promise<T>): Promise<T> {
    return fn()
  }
}

// ── Mock PrismaClient (transaction executes callback with mock tx) ───────────
//
// $executeRaw always returns 1 (OL success) — the SeatManager's DECR is the
// actual guard ensuring at most maxCapacity calls reach the transaction.
// registration.create stores rows in the shared registrationRepo.

function makeMockPrisma(registrationRepo: IRegistrationRepository): PrismaClient {
  const txProxy = {
    async $executeRaw(...args: unknown[]) { void args; return 1 },
    registration: {
      async create({ data }: { data: RegistrationProps & { status: string; qrCode?: string | null; qrSignature?: string | null } }) {
        const reg = new Registration({
          id: data.id,
          userId: data.userId,
          workshopId: data.workshopId,
          status: data.status as RegistrationStatus,
          qrCode: data.qrCode ?? null,
          qrSignature: data.qrSignature ?? null,
          createdAt: new Date(),
        })
        await registrationRepo.create(reg)
        return data
      },
      async update({ where, data }: { where: { id: string }; data: { status: string } }) {
        return { id: where.id, ...data }
      },
    },
    payment: {
      async create({ data }: { data: object }) { return data },
    },
  }

  return {
    async $transaction(fn: (tx: typeof txProxy) => Promise<unknown>) {
      return fn(txProxy)
    },
  } as unknown as PrismaClient
}

// ── Null EventBus ────────────────────────────────────────────────────────────

const nullEventBus: IEventBus = {
  async publish(event: DomainEvent) { void event },
}

// ── Test ─────────────────────────────────────────────────────────────────────

async function run() {
  const CAPACITY = 60
  const CALLERS = 100
  const WORKSHOP_ID = 'workshop-load-test'

  const store = makeInMemoryStore()
  const seatManager = new SeatManager(store)
  await seatManager.init(WORKSHOP_ID, CAPACITY)

  const workshopRepo = makeWorkshopRepo(WORKSHOP_ID, CAPACITY)
  const registrationRepo = makeRegistrationRepo()
  const mockPrisma = makeMockPrisma(registrationRepo)

  const service = new RegistrationService(
    workshopRepo,
    registrationRepo,
    seatManager,
    new MockIdempotencyService(),
    nullEventBus,
    null,
    mockPrisma,
  )

  // Fire 100 concurrent register() calls, each with a unique userId + idempotencyKey
  const calls = [] as Array<Promise<{ ok: true; result: unknown } | { ok: false; error: Error }>>
  for (let i = 0; i < CALLERS; i += 1) {
    calls.push(
      service.register(`user-${i}`, WORKSHOP_ID, `key-${i}`).then(
        (r) => ({ ok: true, result: r }),
        (e) => ({ ok: false, error: e as Error }),
      ),
    )
  }

  const results = await Promise.all(calls)
  const successes = results.filter((r) => r.ok)
  const failures = results.filter((r) => !r.ok)

  console.log(`Successes : ${successes.length}`)
  console.log(`Failures  : ${failures.length}`)
  console.log(`Redis remaining seats: ${await seatManager.current(WORKSHOP_ID)}`)

  assert.strictEqual(successes.length, CAPACITY, `Expected exactly ${CAPACITY} successes, got ${successes.length}`)
  assert.strictEqual(failures.length, CALLERS - CAPACITY, `Expected exactly ${CALLERS - CAPACITY} failures`)
  assert.strictEqual(
    await seatManager.current(WORKSHOP_ID),
    0,
    'Redis seat counter must be 0 after all seats are taken',
  )

  const confirmed = registrationRepo.all().filter((r) => r.status === RegistrationStatus.CONFIRMED)
  assert.strictEqual(confirmed.length, CAPACITY, `Expected exactly ${CAPACITY} CONFIRMED registrations in repo`)

  console.log(`\nAll load-test assertions passed ✓  (${CAPACITY} CONFIRMED / ${CALLERS} total)`)
}

run().catch((err) => { console.error(err); process.exit(1) })
