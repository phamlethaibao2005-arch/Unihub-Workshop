import { Entity } from '@/shared/domain/Entity'
import { ConflictError } from '@/shared/errors/AppError'
import { WorkshopStatus } from './WorkshopStatus'
import { AISummaryStatus } from './AISummaryStatus'

export interface WorkshopProps {
  id: string
  title: string
  description: string | null
  speaker: string
  room: string
  roomMapUrl: string | null
  date: Date
  startTime: Date
  endTime: Date
  maxCapacity: number
  currentRegistrations: number
  version: number
  price: number
  status: WorkshopStatus
  aiSummary: string | null
  aiSummaryStatus: AISummaryStatus
  pdfUrl: string | null
  createdBy: string
}

export type CreateWorkshopInput = Omit<
  WorkshopProps,
  'id' | 'currentRegistrations' | 'version' | 'status' | 'aiSummary' | 'aiSummaryStatus' | 'pdfUrl'
>

export type UpdateWorkshopInput = Partial<
  Pick<
    WorkshopProps,
    | 'title'
    | 'description'
    | 'speaker'
    | 'room'
    | 'roomMapUrl'
    | 'date'
    | 'startTime'
    | 'endTime'
    | 'maxCapacity'
    | 'price'
    | 'aiSummary'
    | 'aiSummaryStatus'
    | 'pdfUrl'
  >
>

export class Workshop extends Entity<string> {
  private _title: string
  private _description: string | null
  private _speaker: string
  private _room: string
  private _roomMapUrl: string | null
  private _date: Date
  private _startTime: Date
  private _endTime: Date
  private _maxCapacity: number
  private _currentRegistrations: number
  private _version: number
  private _price: number
  private _status: WorkshopStatus
  private _aiSummary: string | null
  private _aiSummaryStatus: AISummaryStatus
  private _pdfUrl: string | null
  private _createdBy: string

  constructor(props: WorkshopProps) {
    super(props.id)
    this._title = props.title
    this._description = props.description
    this._speaker = props.speaker
    this._room = props.room
    this._roomMapUrl = props.roomMapUrl
    this._date = props.date
    this._startTime = props.startTime
    this._endTime = props.endTime
    this._maxCapacity = props.maxCapacity
    this._currentRegistrations = props.currentRegistrations
    this._version = props.version
    this._price = props.price
    this._status = props.status
    this._aiSummary = props.aiSummary
    this._aiSummaryStatus = props.aiSummaryStatus
    this._pdfUrl = props.pdfUrl
    this._createdBy = props.createdBy
  }

  get title() { return this._title }
  get description() { return this._description }
  get speaker() { return this._speaker }
  get room() { return this._room }
  get roomMapUrl() { return this._roomMapUrl }
  get date() { return this._date }
  get startTime() { return this._startTime }
  get endTime() { return this._endTime }
  get maxCapacity() { return this._maxCapacity }
  get currentRegistrations() { return this._currentRegistrations }
  get version() { return this._version }
  get price() { return this._price }
  get status() { return this._status }
  get aiSummary() { return this._aiSummary }
  get aiSummaryStatus() { return this._aiSummaryStatus }
  get pdfUrl() { return this._pdfUrl }
  get createdBy() { return this._createdBy }

  isAvailable(): boolean {
    return (
      this._status === WorkshopStatus.ACTIVE &&
      this._currentRegistrations < this._maxCapacity
    )
  }

  cancel(): void {
    if (this._status === WorkshopStatus.CANCELLED) {
      throw new ConflictError('Workshop is already cancelled')
    }
    this._status = WorkshopStatus.CANCELLED
  }

  // Validates availability, increments seat counter and version.
  // Returns the new patch values for use in an optimistic-lock UPDATE.
  // Caller must pass the pre-mutation version as expectedVersion to the repo.
  attemptReserveOne(): { currentRegistrations: number; version: number } {
    if (!this.isAvailable()) {
      throw new ConflictError('Workshop is full or not available')
    }
    this._currentRegistrations += 1
    this._version += 1
    return { currentRegistrations: this._currentRegistrations, version: this._version }
  }

  releaseOne(): void {
    if (this._currentRegistrations > 0) {
      this._currentRegistrations -= 1
    }
  }

  update(patch: UpdateWorkshopInput): void {
    if (patch.title !== undefined) this._title = patch.title
    if (patch.description !== undefined) this._description = patch.description ?? null
    if (patch.speaker !== undefined) this._speaker = patch.speaker
    if (patch.room !== undefined) this._room = patch.room
    if (patch.roomMapUrl !== undefined) this._roomMapUrl = patch.roomMapUrl ?? null
    if (patch.date !== undefined) this._date = patch.date
    if (patch.startTime !== undefined) this._startTime = patch.startTime
    if (patch.endTime !== undefined) this._endTime = patch.endTime
    if (patch.maxCapacity !== undefined) this._maxCapacity = patch.maxCapacity
    if (patch.price !== undefined) this._price = patch.price
    if (patch.aiSummary !== undefined) this._aiSummary = patch.aiSummary ?? null
    if (patch.aiSummaryStatus !== undefined) this._aiSummaryStatus = patch.aiSummaryStatus
    if (patch.pdfUrl !== undefined) this._pdfUrl = patch.pdfUrl ?? null
  }

  toProps(): WorkshopProps {
    return {
      id: this._id,
      title: this._title,
      description: this._description,
      speaker: this._speaker,
      room: this._room,
      roomMapUrl: this._roomMapUrl,
      date: this._date,
      startTime: this._startTime,
      endTime: this._endTime,
      maxCapacity: this._maxCapacity,
      currentRegistrations: this._currentRegistrations,
      version: this._version,
      price: this._price,
      status: this._status,
      aiSummary: this._aiSummary,
      aiSummaryStatus: this._aiSummaryStatus,
      pdfUrl: this._pdfUrl,
      createdBy: this._createdBy,
    }
  }
}
