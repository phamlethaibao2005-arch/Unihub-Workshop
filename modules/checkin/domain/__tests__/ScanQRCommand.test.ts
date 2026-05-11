import { describe, it, expect } from 'vitest'
import { ScanQRCommand } from '../ScanQRCommand'
import { Registration } from '@/modules/registration/domain/Registration'
import { RegistrationStatus } from '@/modules/registration/domain/RegistrationStatus'
import { Checkin } from '../Checkin'
import { SyncStatus } from '../SyncStatus'

const SECRET = 'test-secret-32-bytes-hex-string!'
const WORKSHOP_ID = 'workshop-1'
const STAFF_ID = 'staff-1'

function makeConfirmedRegistration(overrides?: Partial<{
  workshopId: string
  status: RegistrationStatus
  qrCode: string | null
  qrSignature: string | null
}>): Registration {
  const reg = new Registration({
    id: 'reg-1',
    userId: 'user-1',
    workshopId: overrides?.workshopId ?? WORKSHOP_ID,
    status: overrides?.status ?? RegistrationStatus.CONFIRMED,
    qrCode: overrides?.qrCode !== undefined ? overrides.qrCode : null,
    qrSignature: overrides?.qrSignature !== undefined ? overrides.qrSignature : null,
    createdAt: new Date(),
  })
  if (overrides?.qrCode === undefined) {
    reg.generateQR(SECRET)
  }
  return reg
}

describe('ScanQRCommand.execute', () => {
  it('returns a Checkin entity on valid input', () => {
    const reg = makeConfirmedRegistration()
    const command = new ScanQRCommand(reg.qrCode!, STAFF_ID, WORKSHOP_ID, undefined)
    const checkin = command.execute(reg, SECRET)

    expect(checkin).toBeInstanceOf(Checkin)
    expect(checkin.registrationId).toBe('reg-1')
    expect(checkin.checkedInBy).toBe(STAFF_ID)
    expect(checkin.syncStatus).toBe(SyncStatus.SYNCED)
    expect(checkin.offlineDeviceId).toBeNull()
  })

  it('stores the deviceId when provided', () => {
    const reg = makeConfirmedRegistration()
    const command = new ScanQRCommand(reg.qrCode!, STAFF_ID, WORKSHOP_ID, 'device-xyz')
    const checkin = command.execute(reg, SECRET)
    expect(checkin.offlineDeviceId).toBe('device-xyz')
  })

  it('throws ValidationError when qrPayload does not match stored qrCode', () => {
    const reg = makeConfirmedRegistration()
    const command = new ScanQRCommand('UNIHUB-wrong-code', STAFF_ID, WORKSHOP_ID, undefined)
    expect(() => command.execute(reg, SECRET)).toThrow('QR code not found')
  })

  it('throws ValidationError when HMAC signature is invalid', () => {
    const reg = makeConfirmedRegistration()
    // Use correct code but wrong secret
    const command = new ScanQRCommand(reg.qrCode!, STAFF_ID, WORKSHOP_ID, undefined)
    expect(() => command.execute(reg, 'wrong-secret')).toThrow('Invalid QR signature')
  })

  it('throws ValidationError when registration is not CONFIRMED', () => {
    const reg = makeConfirmedRegistration({ status: RegistrationStatus.PENDING })
    // Manually set qrCode so payload matches (PENDING regs normally have no QR,
    // but we test the status check specifically)
    const validReg = makeConfirmedRegistration()
    const pendingReg = new Registration({
      id: 'reg-1',
      userId: 'user-1',
      workshopId: WORKSHOP_ID,
      status: RegistrationStatus.PENDING,
      qrCode: validReg.qrCode,
      qrSignature: validReg.qrSignature,
      createdAt: new Date(),
    })
    const command = new ScanQRCommand(pendingReg.qrCode!, STAFF_ID, WORKSHOP_ID, undefined)
    expect(() => command.execute(pendingReg, SECRET)).toThrow('Registration is not CONFIRMED')
  })

  it('throws ConflictError when workshopId does not match', () => {
    const reg = makeConfirmedRegistration({ workshopId: 'workshop-OTHER' })
    const command = new ScanQRCommand(reg.qrCode!, STAFF_ID, WORKSHOP_ID, undefined)
    expect(() => command.execute(reg, SECRET)).toThrow('QR does not belong to this workshop')
  })

  it('throws ValidationError when registration has no qrCode', () => {
    const reg = new Registration({
      id: 'reg-1',
      userId: 'user-1',
      workshopId: WORKSHOP_ID,
      status: RegistrationStatus.CONFIRMED,
      qrCode: null,
      qrSignature: null,
      createdAt: new Date(),
    })
    const command = new ScanQRCommand('anything', STAFF_ID, WORKSHOP_ID, undefined)
    expect(() => command.execute(reg, SECRET)).toThrow('QR code not found')
  })
})
