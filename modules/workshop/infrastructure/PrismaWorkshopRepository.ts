import { Prisma, WorkshopStatus as PrismaWorkshopStatus, AISummaryStatus as PrismaAISummaryStatus } from '@prisma/client'
import type { PrismaClient, Workshop as PrismaWorkshop } from '@prisma/client'
import type { IWorkshopRepository, WorkshopFilters, PaginatedResult } from '../domain/IWorkshopRepository'
import { Workshop } from '../domain/Workshop'
import { WorkshopStatus } from '../domain/WorkshopStatus'
import { AISummaryStatus } from '../domain/AISummaryStatus'

function toDomain(row: PrismaWorkshop): Workshop {
  return new Workshop({
    id: row.id,
    title: row.title,
    description: row.description,
    speaker: row.speaker,
    room: row.room,
    roomMapUrl: row.roomMapUrl,
    date: row.date,
    startTime: row.startTime,
    endTime: row.endTime,
    maxCapacity: row.maxCapacity,
    currentRegistrations: row.currentRegistrations,
    version: row.version,
    price: row.price,
    status: row.status as unknown as WorkshopStatus,
    aiSummary: row.aiSummary,
    aiSummaryStatus: row.aiSummaryStatus as unknown as AISummaryStatus,
    pdfUrl: row.pdfUrl,
    createdBy: row.createdBy,
  })
}

export class PrismaWorkshopRepository implements IWorkshopRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Workshop | null> {
    const row = await this.prisma.workshop.findUnique({ where: { id } })
    return row ? toDomain(row) : null
  }

  async findActiveByDate(date: Date): Promise<Workshop[]> {
    const y = date.getUTCFullYear()
    const m = date.getUTCMonth()
    const d = date.getUTCDate()
    const rows = await this.prisma.workshop.findMany({
      where: {
        status: PrismaWorkshopStatus.ACTIVE,
        date: { gte: new Date(Date.UTC(y, m, d)), lt: new Date(Date.UTC(y, m, d + 1)) },
      },
      orderBy: { startTime: 'asc' },
    })
    return rows.map(toDomain)
  }

  async listPaginated(params: {
    filters?: WorkshopFilters
    page: number
    size: number
  }): Promise<PaginatedResult<Workshop>> {
    const { filters, page, size } = params
    const skip = (page - 1) * size
    const where: Prisma.WorkshopWhereInput = {}

    if (filters?.status) {
      where.status = filters.status as unknown as PrismaWorkshopStatus
    }
    if (filters?.date) {
      const y = filters.date.getUTCFullYear()
      const m = filters.date.getUTCMonth()
      const d = filters.date.getUTCDate()
      where.date = { gte: new Date(Date.UTC(y, m, d)), lt: new Date(Date.UTC(y, m, d + 1)) }
    }
    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { speaker: { contains: filters.search, mode: 'insensitive' } },
      ]
    }
    if (filters?.priceFilter === 'free') where.price = 0
    if (filters?.priceFilter === 'paid') where.price = { gt: 0 }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.workshop.findMany({ where, skip, take: size, orderBy: { date: 'asc' } }),
      this.prisma.workshop.count({ where }),
    ])

    return { items: rows.map(toDomain), total, page, size }
  }

  // Runs an optimistic-lock UPDATE: only succeeds (count=1) if the DB version matches
  // expectedVersion and currentRegistrations hasn't exceeded maxCapacity.
  async update(workshop: Workshop, expectedVersion: number): Promise<boolean> {
    const p = workshop.toProps()
    const count = await this.prisma.$executeRaw`
      UPDATE "Workshop"
      SET
        title                  = ${p.title},
        description            = ${p.description},
        speaker                = ${p.speaker},
        room                   = ${p.room},
        "roomMapUrl"           = ${p.roomMapUrl},
        date                   = ${p.date},
        "startTime"            = ${p.startTime},
        "endTime"              = ${p.endTime},
        "maxCapacity"          = ${p.maxCapacity},
        "currentRegistrations" = ${p.currentRegistrations},
        version                = version + 1,
        price                  = ${p.price},
        status                 = CAST(${p.status} AS "WorkshopStatus"),
        "aiSummary"            = ${p.aiSummary},
        "aiSummaryStatus"      = CAST(${p.aiSummaryStatus} AS "AISummaryStatus"),
        "pdfUrl"               = ${p.pdfUrl},
        "updatedAt"            = NOW()
      WHERE id      = ${p.id}
        AND version = ${expectedVersion}
        AND "currentRegistrations" <= "maxCapacity"
    `
    return count === 1
  }

  async create(workshop: Workshop): Promise<Workshop> {
    const p = workshop.toProps()
    const row = await this.prisma.workshop.create({
      data: {
        id: p.id,
        title: p.title,
        description: p.description,
        speaker: p.speaker,
        room: p.room,
        roomMapUrl: p.roomMapUrl,
        date: p.date,
        startTime: p.startTime,
        endTime: p.endTime,
        maxCapacity: p.maxCapacity,
        currentRegistrations: p.currentRegistrations,
        version: p.version,
        price: p.price,
        status: p.status as unknown as PrismaWorkshopStatus,
        aiSummary: p.aiSummary,
        aiSummaryStatus: p.aiSummaryStatus as unknown as PrismaAISummaryStatus,
        pdfUrl: p.pdfUrl,
        createdBy: p.createdBy,
      },
    })
    return toDomain(row)
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.workshop.update({
      where: { id },
      data: { status: PrismaWorkshopStatus.CANCELLED },
    })
  }
}
