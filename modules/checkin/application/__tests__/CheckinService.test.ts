import { describe, it, expect, vi } from 'vitest'
import { CheckinService } from '../CheckinService'
import { Checkin } from '../../domain/Checkin'
import { SyncStatus } from '../../domain/SyncStatus'
import type { ICheckinRepository } from '../../domain/ICheckinRepository'
import type { IRegistrationRepository } from '@/modules/registration/domain/IRegistrationRepository'
import type { IWorkshopRepository } from '@/modules/workshop/domain/IWorkshopRepository'
import { Registration } from '@/modules/registration/domain/Registration'
import { RegistrationStatus } from '@/modules/registration/domain/RegistrationStatus'
import { Workshop } from '@/modules/workshop/domain/Workshop'
import { WorkshopStatus } from '@/modules/workshop/domain/WorkshopStatus'
import { AISummaryStatus } from '@/modules/workshop/domain/AISummaryStatus'

// QR_HMAC_SECRET used by CheckinService via qrHmacSecret()
vi.stubEnv('QR_HMAC_SECRET', 'test-secret-32-bytes-hex-string!')

const SECRET = 'test-secret-32-bytes-hex-string!'
const WORKSHOP_ID = 'workshop-1'
const STAFF_ID = 'staff-1'

function makeRegistration(opts?: {
  id?: string
  workshopId?: string
  status?: RegistrationStatus
  withQR?: boolean
}): Registration {
  const reg = new Registration({
    id: opts?.id ?? 'reg-1',
    userId: 'user-1',
    workshopId: opts?.workshopId ?? WORKSHOP_ID,
    status: opts?.status ?? RegistrationStatus.CONFIRMED,
    qrCode: null,
    qrSignature: null,
    createdAt: new Date(),
  })
  if (opts?.withQR !== false) reg.generateQR(SECRET)
  return reg
}

function makeCheckin(registrationId = 'reg-1'): Checkin {
  return new Checkin({
    id: 'checkin-1',
    registrationId,
    checkedInBy: STAFF_ID,
    checkedInAt: new Date(),
    syncStatus: SyncStatus.SYNCED,
    syncedAt: new Date(),
    offlineDeviceId: null,
  })
}

function makeWorkshop(id = WORKSHOP_ID): Workshop {
  const now = new Date()
  return new Workshop({
    id,
    title: 'Test Workshop',
    description: null,
    speaker: 'Speaker',
    room: 'Room A',
    roomMapUrl: null,
    date: now,
    startTime: now,
    endTime: now,
    maxCapacity: 50,
    currentRegistrations: 0,
    version: 0,
    price: 0,
    status: WorkshopStatus.ACTIVE,
    aiSummary: null,
    aiSummaryStatus: AISummaryStatus.NONE,
    pdfUrl: null,
    createdBy: 'organizer-1',
  })
}

function makeRepos() {
  const checkinRepo: ICheckinRepository = {
    findByRegistrationId: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockImplementation((c: Checkin) => Promise.resolve(c)),
    findTicketsForWorkshops: vi.fn().mockResolvedValue([]),
  }
  const registrationRepo: IRegistrationRepository = {
    findById: vi.fn().mockResolvedValue(makeRegistration()),
    findByUserAndWorkshop: vi.fn(),
    listByUser: vi.fn(),
    listByWorkshop: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  }
  const workshopRepo: IWorkshopRepository = {
    findById: vi.fn(),
    findActiveByDate: vi.fn(),
    listPaginated: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, size: 100 }),
    update: vi.fn(),
    create: vi.fn(),
    softDelete: vi.fn(),
  }
  return { checkinRepo, registrationRepo, workshopRepo }
}

describe('CheckinService.checkIn', () => {
  it('creates and returns a CheckinResult for a valid registration', async () => {
    const { checkinRepo, registrationRepo, workshopRepo } = makeRepos()
    const service = new CheckinService(checkinRepo, registrationRepo, workshopRepo)

    const result = await service.checkIn(STAFF_ID, 'reg-1', WORKSHOP_ID)

    expect(result.registrationId).toBe('reg-1')
    expect(result.checkedInAt).toBeInstanceOf(Date)
    expect(checkinRepo.create).toHaveBeenCalledOnce()
  })

  it('throws NotFoundError when registration does not exist', async () => {
    const { checkinRepo, registrationRepo, workshopRepo } = makeRepos()
    vi.mocked(registrationRepo.findById).mockResolvedValue(null)
    const service = new CheckinService(checkinRepo, registrationRepo, workshopRepo)

    await expect(service.checkIn(STAFF_ID, 'reg-1', WORKSHOP_ID)).rejects.toThrow(
      'Registration not found',
    )
  })

  it('throws ConflictError when registration is already checked in', async () => {
    const { checkinRepo, registrationRepo, workshopRepo } = makeRepos()
    vi.mocked(checkinRepo.findByRegistrationId).mockResolvedValue(makeCheckin())
    const service = new CheckinService(checkinRepo, registrationRepo, workshopRepo)

    await expect(service.checkIn(STAFF_ID, 'reg-1', WORKSHOP_ID)).rejects.toThrow(
      'Already checked in',
    )
  })

  it('throws ConflictError when workshopId does not match', async () => {
    const { checkinRepo, registrationRepo, workshopRepo } = makeRepos()
    const service = new CheckinService(checkinRepo, registrationRepo, workshopRepo)

    await expect(service.checkIn(STAFF_ID, 'reg-1', 'wrong-workshop')).rejects.toThrow(
      'QR does not belong to this workshop',
    )
  })

  it('throws ValidationError when registration has no QR', async () => {
    const { checkinRepo, registrationRepo, workshopRepo } = makeRepos()
    vi.mocked(registrationRepo.findById).mockResolvedValue(makeRegistration({ withQR: false }))
    const service = new CheckinService(checkinRepo, registrationRepo, workshopRepo)

    await expect(service.checkIn(STAFF_ID, 'reg-1', WORKSHOP_ID)).rejects.toThrow(
      'QR code not found',
    )
  })
})

describe('CheckinService.syncBatch', () => {
  const makeRecord = (overrides?: { registrationId?: string; workshopId?: string }) => ({
    registrationId: overrides?.registrationId ?? 'reg-1',
    workshopId: overrides?.workshopId ?? WORKSHOP_ID,
    checkedInAt: new Date().toISOString(),
    deviceId: 'device-1',
  })

  it('returns synced for a valid record', async () => {
    const { checkinRepo, registrationRepo, workshopRepo } = makeRepos()
    const service = new CheckinService(checkinRepo, registrationRepo, workshopRepo)

    const { results } = await service.syncBatch(STAFF_ID, [makeRecord()])

    expect(results).toHaveLength(1)
    expect(results[0]).toEqual({ registrationId: 'reg-1', status: 'synced' })
    expect(checkinRepo.create).toHaveBeenCalledOnce()
  })

  it('returns duplicate when checkin already exists', async () => {
    const { checkinRepo, registrationRepo, workshopRepo } = makeRepos()
    vi.mocked(checkinRepo.findByRegistrationId).mockResolvedValue(makeCheckin())
    const service = new CheckinService(checkinRepo, registrationRepo, workshopRepo)

    const { results } = await service.syncBatch(STAFF_ID, [makeRecord()])

    expect(results[0]).toEqual({ registrationId: 'reg-1', status: 'duplicate' })
    expect(checkinRepo.create).not.toHaveBeenCalled()
  })

  it('returns invalid when registration does not exist', async () => {
    const { checkinRepo, registrationRepo, workshopRepo } = makeRepos()
    vi.mocked(registrationRepo.findById).mockResolvedValue(null)
    const service = new CheckinService(checkinRepo, registrationRepo, workshopRepo)

    const { results } = await service.syncBatch(STAFF_ID, [makeRecord()])

    expect(results[0]).toEqual({ registrationId: 'reg-1', status: 'invalid' })
  })

  it('returns invalid when workshopId does not match', async () => {
    const { checkinRepo, registrationRepo, workshopRepo } = makeRepos()
    const service = new CheckinService(checkinRepo, registrationRepo, workshopRepo)

    const { results } = await service.syncBatch(STAFF_ID, [makeRecord({ workshopId: 'wrong' })])

    expect(results[0]).toEqual({ registrationId: 'reg-1', status: 'invalid' })
  })

  it('processes each record independently — partial success on mixed batch', async () => {
    const { checkinRepo, registrationRepo, workshopRepo } = makeRepos()
    vi.mocked(registrationRepo.findById).mockImplementation(async (id) => {
      if (id === 'reg-exists') return null
      return makeRegistration({ id })
    })
    const service = new CheckinService(checkinRepo, registrationRepo, workshopRepo)

    const records = [
      makeRecord({ registrationId: 'reg-1' }),
      makeRecord({ registrationId: 'reg-exists' }),
      makeRecord({ registrationId: 'reg-2' }),
    ]
    const { results } = await service.syncBatch(STAFF_ID, records)

    expect(results[0].status).toBe('synced')
    expect(results[1].status).toBe('invalid')
    expect(results[2].status).toBe('synced')
  })
})

describe('CheckinService.preload', () => {
  it('returns workshops, tickets and hmacKey', async () => {
    const { checkinRepo, registrationRepo, workshopRepo } = makeRepos()
    const workshop = makeWorkshop()
    vi.mocked(workshopRepo.listPaginated).mockResolvedValue({
      items: [workshop],
      total: 1,
      page: 1,
      size: 100,
    })
    vi.mocked(checkinRepo.findTicketsForWorkshops).mockResolvedValue([
      {
        registrationId: 'reg-1',
        workshopId: WORKSHOP_ID,
        studentName: 'Nguyen Van A',
        studentId: '22127001',
        qrCode: 'UNIHUB-reg-1-123',
        qrSignature: null,
        checkedIn: false,
      },
    ])
    const service = new CheckinService(checkinRepo, registrationRepo, workshopRepo)

    const result = await service.preload(new Date())

    expect(result.workshops).toHaveLength(1)
    expect(result.workshops[0].id).toBe(WORKSHOP_ID)
    expect(result.tickets).toHaveLength(1)
    expect(result.tickets[0].registrationId).toBe('reg-1')
    expect(result.hmacKey).toBe(SECRET)
  })

  it('returns empty tickets when there are no workshops', async () => {
    const { checkinRepo, registrationRepo, workshopRepo } = makeRepos()
    const service = new CheckinService(checkinRepo, registrationRepo, workshopRepo)

    const result = await service.preload(new Date())

    expect(result.workshops).toHaveLength(0)
    expect(result.tickets).toHaveLength(0)
    expect(checkinRepo.findTicketsForWorkshops).not.toHaveBeenCalled()
  })
})
