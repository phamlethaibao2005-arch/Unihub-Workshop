import { Entity } from '@/shared/domain/Entity'
import { ConflictError } from '@/shared/errors/AppError'
import { RegistrationStatus } from './RegistrationStatus'
import { QRTicket } from './QRTicket'

export interface RegistrationProps {
  id: string
  userId: string
  workshopId: string
  status: RegistrationStatus
  qrCode: string | null
  qrSignature: string | null
  createdAt: Date
}

export class Registration extends Entity<string> {
  private _userId: string
  private _workshopId: string
  private _status: RegistrationStatus
  private _qrCode: string | null
  private _qrSignature: string | null
  private _createdAt: Date

  constructor(props: RegistrationProps) {
    super(props.id)
    this._userId = props.userId
    this._workshopId = props.workshopId
    this._status = props.status
    this._qrCode = props.qrCode
    this._qrSignature = props.qrSignature
    this._createdAt = props.createdAt
  }

  get userId() { return this._userId }
  get workshopId() { return this._workshopId }
  get status() { return this._status }
  get qrCode() { return this._qrCode }
  get qrSignature() { return this._qrSignature }
  get createdAt() { return this._createdAt }

  confirm(): void {
    if (this._status === RegistrationStatus.CANCELLED) {
      throw new ConflictError('Cannot confirm a cancelled registration')
    }
    if (this._status === RegistrationStatus.CONFIRMED) {
      throw new ConflictError('Registration is already confirmed')
    }
    this._status = RegistrationStatus.CONFIRMED
  }

  cancel(): void {
    if (this._status === RegistrationStatus.CANCELLED) {
      throw new ConflictError('Registration is already cancelled')
    }
    this._status = RegistrationStatus.CANCELLED
  }

  markPaymentFailed(): void {
    if (this._status !== RegistrationStatus.PENDING) {
      throw new ConflictError('Only pending registrations can be marked as payment failed')
    }
    this._status = RegistrationStatus.PAYMENT_FAILED
  }

  generateQR(secret: string): void {
    const ticket = QRTicket.issue(this._id, secret)
    this._qrCode = ticket.code
    this._qrSignature = ticket.signature
  }

  toProps(): RegistrationProps {
    return {
      id: this._id,
      userId: this._userId,
      workshopId: this._workshopId,
      status: this._status,
      qrCode: this._qrCode,
      qrSignature: this._qrSignature,
      createdAt: this._createdAt,
    }
  }
}
