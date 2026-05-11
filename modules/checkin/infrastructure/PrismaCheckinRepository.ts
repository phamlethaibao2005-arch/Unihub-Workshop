import type { PrismaClient } from '@prisma/client'
import { Checkin } from '../domain/Checkin'
import { SyncStatus } from '../domain/SyncStatus'
import type { ICheckinRepository, PreloadTicket } from '../domain/ICheckinRepository'

function toDomain(row: {
  id: string
  registrationId: string
  checkedInBy: string
  checkedInAt: Date
  syncStatus: string
  syncedAt: Date | null
  offlineDeviceId: string | null
}): Checkin {
  return new Checkin({
    id: row.id,
    registrationId: row.registrationId,
    checkedInBy: row.checkedInBy,
    checkedInAt: row.checkedInAt,
    syncStatus: row.syncStatus as SyncStatus,
    syncedAt: row.syncedAt,
    offlineDeviceId: row.offlineDeviceId,
  })
}

export class PrismaCheckinRepository implements ICheckinRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByRegistrationId(registrationId: string): Promise<Checkin | null> {
    const row = await this.prisma.checkin.findUnique({ where: { registrationId } })
    return row ? toDomain(row) : null
  }

  async create(checkin: Checkin): Promise<Checkin> {
    const p = checkin.toProps()
    const row = await this.prisma.checkin.create({
      data: {
        id: p.id,
        registrationId: p.registrationId,
        checkedInBy: p.checkedInBy,
        checkedInAt: p.checkedInAt,
        syncStatus: p.syncStatus as 'SYNCED' | 'PENDING_SYNC',
        syncedAt: p.syncedAt,
        offlineDeviceId: p.offlineDeviceId,
      },
    })
    return toDomain(row)
  }

  async findTicketsForWorkshops(workshopIds: string[]): Promise<PreloadTicket[]> {
    const rows = await this.prisma.registration.findMany({
      where: {
        workshopId: { in: workshopIds },
        status: 'CONFIRMED',
        qrCode: { not: null },
      },
      select: {
        id: true,
        workshopId: true,
        qrCode: true,
        user: { select: { name: true, studentId: true } },
        checkin: { select: { id: true } },
      },
    })

    return rows.map((row) => ({
      registrationId: row.id,
      workshopId: row.workshopId,
      studentName: row.user.name,
      studentId: row.user.studentId,
      qrCode: row.qrCode!,
      checkedIn: row.checkin !== null,
    }))
  }
}
