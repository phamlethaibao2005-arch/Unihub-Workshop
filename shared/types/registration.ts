export type RegistrationStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'PAYMENT_FAILED'

export type RegistrationDTO = {
  id: string
  workshopId: string
  status: RegistrationStatus
  qrCode: string | null
  createdAt: string
  workshop: {
    title: string
    speaker: string
    date: string   // YYYY-MM-DD
    time: string   // "18:30 - 20:30"
    location: string
  }
}
