import { Checkin } from '../domain/Checkin'
import { QRVerifier } from '../domain/QRVerifier'
import { ScanQRCommand } from '../domain/ScanQRCommand'
import { SyncStatus } from '../domain/SyncStatus'
import type { ICheckinRepository, PreloadTicket } from '../domain/ICheckinRepository'
import type { IRegistrationRepository } from '@/modules/registration/domain/IRegistrationRepository'
import { RegistrationStatus } from '@/modules/registration/domain/RegistrationStatus'
import type { IWorkshopRepository } from '@/modules/workshop/domain/IWorkshopRepository'
import { WorkshopStatus } from '@/modules/workshop/domain/WorkshopStatus'
import { ConflictError, NotFoundError } from '@/shared/errors/AppError'
import { qrHmacSecret } from '@/shared/config/env'

export interface CheckinResult {
  registrationId: string
  checkedInAt: Date
}

export interface SyncRecord {
  registrationId: string
  workshopId: string
  checkedInAt: string
  deviceId: string
}

export interface SyncResult {
  registrationId: string
  status: 'synced' | 'duplicate' | 'invalid'
}

export interface PreloadResult {
  workshops: Array<{
    id: string
    title: string
    room: string
    startTime: Date
    endTime: Date
  }>
  tickets: PreloadTicket[]
  hmacKey: string
}

export class CheckinService {
  constructor(
    private readonly checkinRepo: ICheckinRepository,
    private readonly registrationRepo: IRegistrationRepository,
    private readonly workshopRepo: IWorkshopRepository,
  ) {}

  async checkIn(
    staffId: string,
    registrationId: string,
    workshopId: string,
    deviceId?: string,
  ): Promise<CheckinResult> {
    const registration = await this.registrationRepo.findById(registrationId)
    if (!registration) throw new NotFoundError('Registration not found')

    // Validate QR + workshop first so wrong-workshop errors surface before duplicate check
    const command = new ScanQRCommand(registration.qrCode!, staffId, workshopId, deviceId)
    const checkin = command.execute(registration, qrHmacSecret())

    const existing = await this.checkinRepo.findByRegistrationId(registrationId)
    if (existing) throw new ConflictError('Already checked in')

    const saved = await this.checkinRepo.create(checkin)
    return { registrationId: saved.registrationId, checkedInAt: saved.checkedInAt }
  }

  async syncBatch(staffId: string, records: SyncRecord[]): Promise<{ results: SyncResult[] }> {
    const results: SyncResult[] = []

    for (const record of records) {
      try {
        const registration = await this.registrationRepo.findById(record.registrationId)

        if (!registration || registration.status !== RegistrationStatus.CONFIRMED) {
          results.push({ registrationId: record.registrationId, status: 'invalid' })
          continue
        }

        if (
          !registration.qrCode ||
          !registration.qrSignature ||
          !QRVerifier.verify(registration.qrCode, registration.qrSignature, qrHmacSecret())
        ) {
          results.push({ registrationId: record.registrationId, status: 'invalid' })
          continue
        }

        if (registration.workshopId !== record.workshopId) {
          results.push({ registrationId: record.registrationId, status: 'invalid' })
          continue
        }

        const existing = await this.checkinRepo.findByRegistrationId(record.registrationId)
        if (existing) {
          results.push({ registrationId: record.registrationId, status: 'duplicate' })
          continue
        }

        await this.checkinRepo.create(
          new Checkin({
            id: crypto.randomUUID(),
            registrationId: record.registrationId,
            checkedInBy: staffId,
            checkedInAt: new Date(record.checkedInAt),
            syncStatus: SyncStatus.SYNCED,
            syncedAt: new Date(),
            offlineDeviceId: record.deviceId,
          }),
        )
        results.push({ registrationId: record.registrationId, status: 'synced' })
      } catch {
        results.push({ registrationId: record.registrationId, status: 'invalid' })
      }
    }

    return { results }
  }

  async preload(date: Date): Promise<PreloadResult> {
    const { items: workshops } = await this.workshopRepo.listPaginated({
      filters: { status: WorkshopStatus.ACTIVE, date },
      page: 1,
      size: 100,
    })

    const workshopIds = workshops.map((w) => w.id)
    const tickets =
      workshopIds.length > 0
        ? await this.checkinRepo.findTicketsForWorkshops(workshopIds)
        : []

    return {
      workshops: workshops.map((w) => ({
        id: w.id,
        title: w.title,
        room: w.room,
        startTime: w.startTime,
        endTime: w.endTime,
      })),
      tickets,
      hmacKey: qrHmacSecret(),
    }
  }
}
