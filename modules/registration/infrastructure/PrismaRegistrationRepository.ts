import type { PrismaClient, Registration as PrismaRegistration } from '@prisma/client'
import type { IRegistrationRepository } from '../domain/IRegistrationRepository'
import { Registration } from '../domain/Registration'
import { RegistrationStatus } from '../domain/RegistrationStatus'

function toDomain(row: PrismaRegistration): Registration {
  return new Registration({
    id: row.id,
    userId: row.userId,
    workshopId: row.workshopId,
    status: row.status as unknown as RegistrationStatus,
    qrCode: row.qrCode,
    qrSignature: row.qrSignature,
    createdAt: row.createdAt,
  })
}

export class PrismaRegistrationRepository implements IRegistrationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Registration | null> {
    const row = await this.prisma.registration.findUnique({ where: { id } })
    return row ? toDomain(row) : null
  }

  async findByUserAndWorkshop(userId: string, workshopId: string): Promise<Registration | null> {
    const row = await this.prisma.registration.findUnique({
      where: { userId_workshopId: { userId, workshopId } },
    })
    return row ? toDomain(row) : null
  }

  async listByUser(userId: string): Promise<Registration[]> {
    const rows = await this.prisma.registration.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map(toDomain)
  }

  async listByWorkshop(workshopId: string): Promise<Registration[]> {
    const rows = await this.prisma.registration.findMany({
      where: { workshopId },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map(toDomain)
  }

  async create(registration: Registration): Promise<Registration> {
    const p = registration.toProps()
    const row = await this.prisma.registration.create({
      data: {
        id: p.id,
        userId: p.userId,
        workshopId: p.workshopId,
        status: p.status as unknown as PrismaRegistration['status'],
        qrCode: p.qrCode,
        qrSignature: p.qrSignature,
      },
    })
    return toDomain(row)
  }

  async update(registration: Registration): Promise<Registration> {
    const p = registration.toProps()
    const row = await this.prisma.registration.update({
      where: { id: p.id },
      data: {
        status: p.status as unknown as PrismaRegistration['status'],
        qrCode: p.qrCode,
        qrSignature: p.qrSignature,
      },
    })
    return toDomain(row)
  }
}
