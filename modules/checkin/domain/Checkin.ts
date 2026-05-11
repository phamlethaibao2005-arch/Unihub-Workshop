import { Entity } from '@/shared/domain/Entity'
import { SyncStatus } from './SyncStatus'

export interface CheckinProps {
  id: string
  registrationId: string
  checkedInBy: string
  checkedInAt: Date
  syncStatus: SyncStatus
  syncedAt: Date | null
  offlineDeviceId: string | null
}

export class Checkin extends Entity<string> {
  private _registrationId: string
  private _checkedInBy: string
  private _checkedInAt: Date
  private _syncStatus: SyncStatus
  private _syncedAt: Date | null
  private _offlineDeviceId: string | null

  constructor(props: CheckinProps) {
    super(props.id)
    this._registrationId = props.registrationId
    this._checkedInBy = props.checkedInBy
    this._checkedInAt = props.checkedInAt
    this._syncStatus = props.syncStatus
    this._syncedAt = props.syncedAt
    this._offlineDeviceId = props.offlineDeviceId
  }

  get registrationId() { return this._registrationId }
  get checkedInBy() { return this._checkedInBy }
  get checkedInAt() { return this._checkedInAt }
  get syncStatus() { return this._syncStatus }
  get syncedAt() { return this._syncedAt }
  get offlineDeviceId() { return this._offlineDeviceId }

  toProps(): CheckinProps {
    return {
      id: this._id,
      registrationId: this._registrationId,
      checkedInBy: this._checkedInBy,
      checkedInAt: this._checkedInAt,
      syncStatus: this._syncStatus,
      syncedAt: this._syncedAt,
      offlineDeviceId: this._offlineDeviceId,
    }
  }
}
