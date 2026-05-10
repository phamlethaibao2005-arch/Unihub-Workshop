import { Entity } from '@/shared/domain/Entity'
import { ConflictError } from '@/shared/errors/AppError'
import { PaymentStatus } from './PaymentStatus'

export interface PaymentProps {
  id: string
  registrationId: string
  amount: number
  idempotencyKey: string
  vnpayTxnRef: string | null
  status: PaymentStatus
  paidAt: Date | null
  createdAt: Date
}

export class Payment extends Entity<string> {
  private _registrationId: string
  private _amount: number
  private _idempotencyKey: string
  private _vnpayTxnRef: string | null
  private _status: PaymentStatus
  private _paidAt: Date | null
  private _createdAt: Date

  constructor(props: PaymentProps) {
    super(props.id)
    this._registrationId = props.registrationId
    this._amount = props.amount
    this._idempotencyKey = props.idempotencyKey
    this._vnpayTxnRef = props.vnpayTxnRef
    this._status = props.status
    this._paidAt = props.paidAt
    this._createdAt = props.createdAt
  }

  get registrationId() { return this._registrationId }
  get amount() { return this._amount }
  get idempotencyKey() { return this._idempotencyKey }
  get vnpayTxnRef() { return this._vnpayTxnRef }
  get status() { return this._status }
  get paidAt() { return this._paidAt }
  get createdAt() { return this._createdAt }

  markSuccess(txnRef: string): void {
    if (this._status === PaymentStatus.SUCCESS) {
      throw new ConflictError('Payment is already marked as success')
    }
    this._status = PaymentStatus.SUCCESS
    this._vnpayTxnRef = txnRef
    this._paidAt = new Date()
  }

  markFailed(_reason?: string): void {
    if (this._status === PaymentStatus.SUCCESS) {
      throw new ConflictError('Cannot fail a payment that has already succeeded')
    }
    this._status = PaymentStatus.FAILED
  }

  toProps(): PaymentProps {
    return {
      id: this._id,
      registrationId: this._registrationId,
      amount: this._amount,
      idempotencyKey: this._idempotencyKey,
      vnpayTxnRef: this._vnpayTxnRef,
      status: this._status,
      paidAt: this._paidAt,
      createdAt: this._createdAt,
    }
  }
}
