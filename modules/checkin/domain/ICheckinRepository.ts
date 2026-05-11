import type { Checkin } from './Checkin'

export interface PreloadTicket {
  registrationId: string
  workshopId: string
  studentName: string
  studentId: string | null
  qrCode: string
  qrSignature: string | null
  checkedIn: boolean
}

export interface ICheckinRepository {
  findByRegistrationId(registrationId: string): Promise<Checkin | null>
  create(checkin: Checkin): Promise<Checkin>
  findTicketsForWorkshops(workshopIds: string[]): Promise<PreloadTicket[]>
}
