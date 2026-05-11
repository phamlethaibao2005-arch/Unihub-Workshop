import { Checkin } from './Checkin'
import { QRVerifier } from './QRVerifier'
import { SyncStatus } from './SyncStatus'
import type { Registration } from '@/modules/registration/domain/Registration'
import { RegistrationStatus } from '@/modules/registration/domain/RegistrationStatus'
import { ConflictError, ValidationError } from '@/shared/errors/AppError'

export class ScanQRCommand {
  constructor(
    private readonly qrPayload: string,
    private readonly staffUserId: string,
    private readonly workshopId: string,
    private readonly deviceId: string | undefined,
  ) {}

  execute(registration: Registration, secret: string): Checkin {
    if (!registration.qrCode || registration.qrCode !== this.qrPayload) {
      throw new ValidationError('QR code not found')
    }
    if (!registration.qrSignature || !QRVerifier.verify(this.qrPayload, registration.qrSignature, secret)) {
      throw new ValidationError('Invalid QR signature')
    }
    if (registration.status !== RegistrationStatus.CONFIRMED) {
      throw new ValidationError('Registration is not CONFIRMED')
    }
    if (registration.workshopId !== this.workshopId) {
      throw new ConflictError('QR does not belong to this workshop')
    }
    return new Checkin({
      id: crypto.randomUUID(),
      registrationId: registration.id,
      checkedInBy: this.staffUserId,
      checkedInAt: new Date(),
      syncStatus: SyncStatus.SYNCED,
      syncedAt: new Date(),
      offlineDeviceId: this.deviceId ?? null,
    })
  }
}
