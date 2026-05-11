import type { PrismaClient } from '@prisma/client'
import { NotFoundError } from '@/shared/errors/AppError'
import type { IEventBus } from '@/shared/domain/IEventBus'
import type { IPaymentGateway } from '../domain/IPaymentGateway'
import type { IPaymentRepository } from '../domain/IPaymentRepository'
import type { IPaymentService } from '../domain/IPaymentService'
import { PaymentStatus } from '../domain/PaymentStatus'
import { createPaymentSucceededEvent } from '../domain/events/PaymentSucceededEvent'
import { createPaymentFailedEvent } from '../domain/events/PaymentFailedEvent'
import type { IIdempotencyService } from './IIdempotencyService'
import type { IRegistrationRepository } from '@/modules/registration/domain/IRegistrationRepository'
import type { SeatManager } from '@/modules/registration/domain/SeatManager'
import { qrHmacSecret, appBaseUrl } from '@/shared/config/env'

export interface CallbackResult {
  RspCode: string
  Message: string
}

export class PaymentService implements IPaymentService {
  constructor(
    private readonly gateway: IPaymentGateway,
    private readonly paymentRepo: IPaymentRepository,
    private readonly registrationRepo: IRegistrationRepository,
    private readonly idempotencyService: IIdempotencyService,
    private readonly seatManager: SeatManager,
    private readonly eventBus: IEventBus,
    private readonly prisma: PrismaClient,
  ) {}

  async initiatePayment(
    registrationId: string,
    _amount: number,
    _idempotencyKey: string,
    ipAddress = '127.0.0.1',
  ): Promise<{ paymentUrl: string }> {
    const payment = await this.paymentRepo.findByRegistrationId(registrationId)
    if (!payment) throw new NotFoundError('Payment record not found')

    const registration = await this.registrationRepo.findById(registrationId)
    if (!registration) throw new NotFoundError('Registration not found')

    const returnUrl = `${appBaseUrl()}/workshops/${registration.workshopId}/payment-result?txnRef=${payment.id}`

    return this.idempotencyService.runOnce(`payment:url:${payment.id}`, 24, async () => {
      const paymentUrl = await this.gateway.createPaymentUrl({
        amount: payment.amount,
        orderId: payment.id,
        description: `Thanh toan workshop ${registrationId.slice(-8).toUpperCase()}`,
        returnUrl,
        ipnUrl: `${appBaseUrl()}/api/payments/vnpay-callback`,
        ipAddress,
      })
      return { paymentUrl }
    })
  }

  async handleCallback(params: Record<string, string>): Promise<CallbackResult> {
    if (!this.gateway.verifyCallback(params)) {
      return { RspCode: '97', Message: 'Invalid signature' }
    }

    const txnRef = params.vnp_TxnRef
    if (!txnRef) return { RspCode: '01', Message: 'Missing TxnRef' }

    const payment = await this.paymentRepo.findById(txnRef)
    if (!payment) return { RspCode: '01', Message: 'Order not found' }

    if (payment.status === PaymentStatus.SUCCESS) {
      return { RspCode: '02', Message: 'Order already confirmed' }
    }

    const callbackAmount = Math.round(parseInt(params.vnp_Amount ?? '0') / 100)
    if (callbackAmount !== payment.amount) {
      console.error(`[Payment] Amount mismatch: expected ${payment.amount}, got ${callbackAmount}`)
      return { RspCode: '04', Message: 'Invalid amount' }
    }

    const responseCode = params.vnp_ResponseCode ?? ''
    const vnpayTxnRef = params.vnp_TransactionNo ?? txnRef

    if (responseCode === '00') {
      await this._applySuccess(payment.id, payment.registrationId, payment.amount, vnpayTxnRef)
    } else {
      await this._applyFailure(payment.id, payment.registrationId, responseCode)
    }

    return { RspCode: '00', Message: 'Confirmed' }
  }

  async reconcilePayment(paymentId: string, gatewayStatus: 'SUCCESS' | 'FAILED'): Promise<void> {
    const payment = await this.paymentRepo.findById(paymentId)
    if (!payment || payment.status !== PaymentStatus.PENDING) return

    if (gatewayStatus === 'SUCCESS') {
      await this._applySuccess(paymentId, payment.registrationId, payment.amount, paymentId)
    } else {
      await this._applyFailure(paymentId, payment.registrationId, 'reconcile')
    }
  }

  async getStatus(txnRef: string): Promise<{ status: string; qrCode?: string }> {
    const payment = await this.paymentRepo.findById(txnRef)
    if (!payment) throw new NotFoundError('Payment not found')

    if (payment.status === PaymentStatus.SUCCESS) {
      const registration = await this.registrationRepo.findById(payment.registrationId)
      return { status: payment.status, qrCode: registration?.qrCode ?? undefined }
    }

    return { status: payment.status }
  }

  private async _applySuccess(
    paymentId: string,
    registrationId: string,
    amount: number,
    vnpayTxnRef: string,
  ): Promise<void> {
    const registration = await this.registrationRepo.findById(registrationId)

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: paymentId },
        data: { status: 'SUCCESS', vnpayTxnRef, paidAt: new Date() },
      })
      if (registration) {
        registration.confirm()
        registration.generateQR(qrHmacSecret())
        await tx.registration.update({
          where: { id: registration.id },
          data: { status: 'CONFIRMED', qrCode: registration.qrCode, qrSignature: registration.qrSignature },
        })
      }
    })

    await this.eventBus.publish(
      createPaymentSucceededEvent(paymentId, registrationId, amount, vnpayTxnRef),
    )
  }

  private async _applyFailure(
    paymentId: string,
    registrationId: string,
    reason: string,
  ): Promise<void> {
    const registration = await this.registrationRepo.findById(registrationId)

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({ where: { id: paymentId }, data: { status: 'FAILED' } })
      if (registration) {
        await tx.registration.update({
          where: { id: registration.id },
          data: { status: 'PAYMENT_FAILED' },
        })
        await tx.$executeRaw`
          UPDATE "Workshop"
          SET "currentRegistrations" = GREATEST("currentRegistrations" - 1, 0),
              "updatedAt" = NOW()
          WHERE id = ${registration.workshopId}
        `
      }
    })

    if (registration) {
      await this.seatManager.release(registration.workshopId)
      await this.eventBus.publish(createPaymentFailedEvent(paymentId, registrationId, reason))
    }
  }
}
