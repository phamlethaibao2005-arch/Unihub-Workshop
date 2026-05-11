export type NotificationPayload =
  | {
      type: 'REGISTRATION_CONFIRMED'
      userId: string
      userEmail: string
      data: {
        workshopTitle: string
        workshopDate: string
        workshopRoom: string
        qrCodeDataUrl: string
      }
    }
  | {
      type: 'PAYMENT_FAILED'
      userId: string
      userEmail: string
      data: {
        workshopTitle: string
        workshopDate: string
        reason?: string
      }
    }
  | {
      type: 'WORKSHOP_CANCELLED'
      userId: string
      userEmail: string
      data: {
        workshopTitle: string
        workshopDate: string
      }
    }
  | {
      type: 'WORKSHOP_UPDATED'
      userId: string
      userEmail: string
      data: {
        workshopTitle: string
        changes: string
      }
    }
  | {
      type: 'CHECKIN_REMINDER'
      userId: string
      userEmail: string
      data: {
        workshopTitle: string
        workshopDate: string
        workshopRoom: string
      }
    }
