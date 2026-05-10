export type WorkshopBadge = 'Just In' | 'Coming Soon' | ''

export type WorkshopDTO = {
  id: string
  title: string
  category: string
  badge: WorkshopBadge
  seatsTotal: number
  seatsTaken: number
  date: string
  time: string
  location: string
  speaker: string
  cover: string
  price: number
}

export type WorkshopDetailDTO = WorkshopDTO & {
  seatsLeft: number
  description: string | null
  aiSummary: string | null
  aiSummaryStatus: string
  roomMapUrl: string | null
}
