import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ForbiddenError, ConflictError, NotFoundError } from '@/shared/errors/AppError'

// ── hoisted mock values (must be created before vi.mock factories run) ─────────

const mockService = vi.hoisted(() => ({
  checkIn: vi.fn(),
  syncBatch: vi.fn(),
  preload: vi.fn(),
}))

// ── module mocks ───────────────────────────────────────────────────────────────

vi.mock('@/lib/session', () => ({ requireRole: vi.fn() }))
vi.mock('@/shared/infrastructure/Container', () => ({
  Container: { resolve: vi.fn().mockReturnValue({}) },
}))
vi.mock('@/shared/infrastructure/PrismaClient', () => ({ db: {} }))
vi.mock('@/shared/infrastructure/RedisClient', () => ({ redis: {} }))
vi.mock('@/bootstrap', () => ({}))
vi.mock('next/navigation', () => ({ unstable_rethrow: vi.fn() }))

// Use a class (not arrow) so `new CheckinService()` works as a constructor
vi.mock('@/modules/checkin/application/CheckinService', () => ({
  CheckinService: class {
    checkIn = mockService.checkIn
    syncBatch = mockService.syncBatch
    preload = mockService.preload
  },
}))

// Plain vi.fn() constructors — no arrow mockImplementation
vi.mock('@/modules/checkin/infrastructure/PrismaCheckinRepository', () => ({
  PrismaCheckinRepository: vi.fn(),
}))
vi.mock('@/modules/registration/infrastructure/PrismaRegistrationRepository', () => ({
  PrismaRegistrationRepository: vi.fn(),
}))

// ── imports after mocks ────────────────────────────────────────────────────────

import { POST as checkinPOST } from '../route'
import { GET as preloadGET } from '../preload/route'
import { POST as syncPOST } from '../sync/route'
import { requireRole } from '@/lib/session'

// ── helpers ───────────────────────────────────────────────────────────────────

type Session = Awaited<ReturnType<typeof requireRole>>
const STAFF_SESSION = { user: { id: 'staff-1', role: 'CHECKIN_STAFF' } } as Session

function makeReq(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireRole).mockResolvedValue(STAFF_SESSION)
})

// ── POST /api/checkins ─────────────────────────────────────────────────────────

describe('POST /api/checkins', () => {
  it('returns 201 with checkin result on valid input', async () => {
    const checkedInAt = new Date('2025-01-01T10:00:00Z')
    mockService.checkIn.mockResolvedValue({ registrationId: 'reg-1', checkedInAt })

    const res = await checkinPOST(
      makeReq('http://localhost/api/checkins', 'POST', {
        registrationId: 'reg-1',
        workshopId: 'ws-1',
      }),
    )

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.registrationId).toBe('reg-1')
    expect(mockService.checkIn).toHaveBeenCalledWith('staff-1', 'reg-1', 'ws-1', undefined)
  })

  it('passes deviceId to service when provided', async () => {
    mockService.checkIn.mockResolvedValue({ registrationId: 'reg-1', checkedInAt: new Date() })

    await checkinPOST(
      makeReq('http://localhost/api/checkins', 'POST', {
        registrationId: 'reg-1',
        workshopId: 'ws-1',
        deviceId: 'device-1',
      }),
    )

    expect(mockService.checkIn).toHaveBeenCalledWith('staff-1', 'reg-1', 'ws-1', 'device-1')
  })

  it('returns 403 when caller is not CHECKIN_STAFF', async () => {
    vi.mocked(requireRole).mockRejectedValue(new ForbiddenError())

    const res = await checkinPOST(
      makeReq('http://localhost/api/checkins', 'POST', {
        registrationId: 'reg-1',
        workshopId: 'ws-1',
      }),
    )

    expect(res.status).toBe(403)
  })

  it('returns 422 when body is missing required fields', async () => {
    const res = await checkinPOST(
      makeReq('http://localhost/api/checkins', 'POST', { bad: 'data' }),
    )

    expect(res.status).toBe(422)
    expect(mockService.checkIn).not.toHaveBeenCalled()
  })

  it('returns 409 when registration is already checked in', async () => {
    mockService.checkIn.mockRejectedValue(new ConflictError('ALREADY_CHECKED_IN'))

    const res = await checkinPOST(
      makeReq('http://localhost/api/checkins', 'POST', {
        registrationId: 'reg-1',
        workshopId: 'ws-1',
      }),
    )

    expect(res.status).toBe(409)
  })

  it('returns 404 when registration does not exist', async () => {
    mockService.checkIn.mockRejectedValue(new NotFoundError('Registration not found'))

    const res = await checkinPOST(
      makeReq('http://localhost/api/checkins', 'POST', {
        registrationId: 'reg-1',
        workshopId: 'ws-1',
      }),
    )

    expect(res.status).toBe(404)
  })
})

// ── GET /api/checkins/preload ──────────────────────────────────────────────────

describe('GET /api/checkins/preload', () => {
  const preloadResult = {
    workshops: [{ id: 'ws-1', title: 'Test', room: 'A', startTime: new Date(), endTime: new Date() }],
    tickets: [{ registrationId: 'reg-1', workshopId: 'ws-1', studentName: 'A', studentId: '001', qrCode: 'QR', checkedIn: false }],
    hmacKey: 'secret',
  }

  it('returns 200 with preload data', async () => {
    mockService.preload.mockResolvedValue(preloadResult)

    const res = await preloadGET(new Request('http://localhost/api/checkins/preload'))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.workshops).toHaveLength(1)
    expect(body.tickets).toHaveLength(1)
    expect(body.hmacKey).toBe('secret')
  })

  it('passes today as date when no query param is given', async () => {
    mockService.preload.mockResolvedValue(preloadResult)

    await preloadGET(new Request('http://localhost/api/checkins/preload'))

    expect(mockService.preload).toHaveBeenCalledOnce()
    const calledDate = mockService.preload.mock.calls[0][0] as Date
    expect(calledDate).toBeInstanceOf(Date)
    expect(isNaN(calledDate.getTime())).toBe(false)
  })

  it('parses date query param correctly', async () => {
    mockService.preload.mockResolvedValue(preloadResult)

    await preloadGET(new Request('http://localhost/api/checkins/preload?date=2025-06-15'))

    const calledDate = mockService.preload.mock.calls[0][0] as Date
    expect(calledDate.toISOString().startsWith('2025-06-15')).toBe(true)
  })

  it('returns 400 for an invalid date param', async () => {
    const res = await preloadGET(
      new Request('http://localhost/api/checkins/preload?date=not-a-date'),
    )

    expect(res.status).toBe(400)
    expect(mockService.preload).not.toHaveBeenCalled()
  })

  it('returns 403 when caller is not CHECKIN_STAFF', async () => {
    vi.mocked(requireRole).mockRejectedValue(new ForbiddenError())

    const res = await preloadGET(new Request('http://localhost/api/checkins/preload'))

    expect(res.status).toBe(403)
  })
})

// ── POST /api/checkins/sync ────────────────────────────────────────────────────

describe('POST /api/checkins/sync', () => {
  const validRecords = [
    { registrationId: 'reg-1', workshopId: 'ws-1', checkedInAt: new Date().toISOString(), deviceId: 'dev-1' },
    { registrationId: 'reg-2', workshopId: 'ws-1', checkedInAt: new Date().toISOString(), deviceId: 'dev-1' },
  ]

  it('returns 200 with sync results', async () => {
    mockService.syncBatch.mockResolvedValue({
      results: [
        { registrationId: 'reg-1', status: 'synced' },
        { registrationId: 'reg-2', status: 'duplicate' },
      ],
    })

    const res = await syncPOST(
      makeReq('http://localhost/api/checkins/sync', 'POST', { records: validRecords }),
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.results).toHaveLength(2)
    expect(body.results[0].status).toBe('synced')
    expect(body.results[1].status).toBe('duplicate')
  })

  it('passes records and staffId to service', async () => {
    mockService.syncBatch.mockResolvedValue({ results: [] })

    await syncPOST(
      makeReq('http://localhost/api/checkins/sync', 'POST', { records: validRecords }),
    )

    expect(mockService.syncBatch).toHaveBeenCalledWith('staff-1', validRecords)
  })

  it('accepts an empty records array', async () => {
    mockService.syncBatch.mockResolvedValue({ results: [] })

    const res = await syncPOST(
      makeReq('http://localhost/api/checkins/sync', 'POST', { records: [] }),
    )

    expect(res.status).toBe(200)
  })

  it('returns 403 when caller is not CHECKIN_STAFF', async () => {
    vi.mocked(requireRole).mockRejectedValue(new ForbiddenError())

    const res = await syncPOST(
      makeReq('http://localhost/api/checkins/sync', 'POST', { records: [] }),
    )

    expect(res.status).toBe(403)
  })

  it('returns 422 when records array is missing from body', async () => {
    const res = await syncPOST(
      makeReq('http://localhost/api/checkins/sync', 'POST', { bad: 'data' }),
    )

    expect(res.status).toBe(422)
    expect(mockService.syncBatch).not.toHaveBeenCalled()
  })

  it('returns 422 when a record is missing required fields', async () => {
    const res = await syncPOST(
      makeReq('http://localhost/api/checkins/sync', 'POST', {
        records: [{ registrationId: 'reg-1' }],
      }),
    )

    expect(res.status).toBe(422)
  })
})
