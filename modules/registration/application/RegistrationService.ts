import type { PrismaClient } from '@prisma/client'
import { ConflictError, ForbiddenError, NotFoundError } from '@/shared/errors/AppError'
import type { IEventBus } from '@/shared/domain/IEventBus'
import type { IWorkshopRepository } from '@/modules/workshop/domain/IWorkshopRepository'
import type { IRegistrationRepository } from '../domain/IRegistrationRepository'
import type { SeatManager } from '../domain/SeatManager'
import type { IIdempotencyService } from '@/modules/payment/application/IIdempotencyService'
import type { IPaymentService } from '@/modules/payment/domain/IPaymentService'
import { Registration } from '../domain/Registration'
import { RegistrationStatus } from '../domain/RegistrationStatus'
import { createRegistrationConfirmedEvent } from '../domain/events/RegistrationConfirmedEvent'
import { createRegistrationCancelledEvent } from '../domain/events/RegistrationCancelledEvent'
import { qrHmacSecret } from '@/shared/config/env'

export interface RegisterResult {
  registrationId: string
  status: string
  qrCode?: string
  paymentUrl?: string
}

export class RegistrationService {
  constructor(
    private readonly workshopRepo: IWorkshopRepository,
    private readonly registrationRepo: IRegistrationRepository,
    private readonly seatManager: SeatManager,
    private readonly idempotencyService: IIdempotencyService,
    private readonly eventBus: IEventBus,
    private readonly paymentService: IPaymentService | null,
    private readonly prisma: PrismaClient,
  ) {}

  async register(
    userId: string,
    workshopId: string,
    idempotencyKey: string,
  ): Promise<RegisterResult> {
    return this.idempotencyService.runOnce(idempotencyKey, 24, async () => {
      const workshop = await this.workshopRepo.findById(workshopId)
      if (!workshop) throw new NotFoundError(`Workshop not found: ${workshopId}`)
      if (!workshop.isAvailable()) throw new ConflictError('WORKSHOP_FULL')

      const existing = await this.registrationRepo.findByUserAndWorkshop(userId, workshopId)
      if (existing) throw new ConflictError('ALREADY_REGISTERED')

      // Seed Redis counter on cold-start (missing key → DECR returns -1 = false positive full)
      await this.seatManager.initIfMissing(
        workshopId,
        workshop.maxCapacity - workshop.currentRegistrations,
      )

      // Fast-path: atomic Redis DECR — only maxCapacity callers may proceed
      const reserved = await this.seatManager.tryReserve(workshopId)
      if (!reserved) throw new ConflictError('WORKSHOP_FULL')

      const expectedVersion = workshop.version
      workshop.attemptReserveOne()

      // seatTaken tracks whether the Redis seat needs rolling back on failure
      let seatTaken = true
      try {
        const txResult = await this.prisma.$transaction(async (tx) => {
          // Optimistic-lock UPDATE: ensures no concurrent oversell at DB level
          const updated = await tx.$executeRaw`
            UPDATE "Workshop"
            SET "currentRegistrations" = "currentRegistrations" + 1,
                version = version + 1,
                "updatedAt" = NOW()
            WHERE id = ${workshopId}
              AND version = ${expectedVersion}
              AND "currentRegistrations" < "maxCapacity"
          `
          if (updated === 0) throw new ConflictError('WORKSHOP_FULL')

          const registrationId = crypto.randomUUID()

          if (workshop.price === 0) {
            const reg = new Registration({
              id: registrationId,
              userId,
              workshopId,
              status: RegistrationStatus.CONFIRMED,
              qrCode: null,
              qrSignature: null,
              createdAt: new Date(),
            })
            reg.generateQR(qrHmacSecret())

            await tx.registration.create({
              data: {
                id: registrationId,
                userId,
                workshopId,
                status: 'CONFIRMED',
                qrCode: reg.qrCode,
                qrSignature: reg.qrSignature,
              },
            })

            return {
              registrationId,
              status: 'CONFIRMED',
              qrCode: reg.qrCode ?? undefined,
            } as RegisterResult
          } else {
            await tx.registration.create({
              data: { id: registrationId, userId, workshopId, status: 'PENDING' },
            })
            await tx.payment.create({
              data: {
                id: crypto.randomUUID(),
                registrationId,
                amount: workshop.price,
                idempotencyKey,
                status: 'PENDING',
              },
            })
            return { registrationId, status: 'PENDING_PAYMENT' } as RegisterResult
          }
        })

        seatTaken = false // transaction committed — seat legitimately consumed

        // Post-commit: publish event or fetch payment URL
        if (txResult.status === 'CONFIRMED' && txResult.qrCode) {
          await this.eventBus.publish(
            createRegistrationConfirmedEvent(
              txResult.registrationId,
              userId,
              workshopId,
              txResult.qrCode,
            ),
          )
        } else if (txResult.status === 'PENDING_PAYMENT' && this.paymentService) {
          const { paymentUrl } = await this.paymentService.initiatePayment(
            txResult.registrationId,
            workshop.price,
            idempotencyKey,
          )
          return { ...txResult, paymentUrl }
        }

        return txResult
      } catch (err) {
        if (seatTaken) {
          await this.seatManager.release(workshopId).catch(() => {})
        }
        throw err
      }
    })
  }

  async cancel(userId: string, registrationId: string): Promise<void> {
    const registration = await this.registrationRepo.findById(registrationId)
    if (!registration) throw new NotFoundError(`Registration not found: ${registrationId}`)
    if (registration.userId !== userId) {
      throw new ForbiddenError('You can only cancel your own registrations')
    }

    const cancellable = [RegistrationStatus.PENDING, RegistrationStatus.CONFIRMED]
    if (!cancellable.includes(registration.status)) {
      throw new ConflictError(`Cannot cancel a ${registration.status} registration`)
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.registration.update({
        where: { id: registrationId },
        data: { status: 'CANCELLED' },
      })
      // Decrement workshop seat count; GREATEST prevents going negative
      await tx.$executeRaw`
        UPDATE "Workshop"
        SET "currentRegistrations" = GREATEST("currentRegistrations" - 1, 0),
            "updatedAt" = NOW()
        WHERE id = ${registration.workshopId}
      `
    })

    await this.seatManager.release(registration.workshopId)

    await this.eventBus.publish(
      createRegistrationCancelledEvent(registrationId, userId, registration.workshopId),
    )
  }
}
