import type { Workshop } from '@/modules/workshop/domain/Workshop'
import type { WorkshopBadge, WorkshopDTO, WorkshopDetailDTO } from './workshop'

const COVERS = [
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80',
  'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=800&q=80',
  'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=800&q=80',
  'https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=800&q=80',
  'https://images.unsplash.com/photo-1501504905252-473c47e087f8?w=800&q=80',
  'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=800&q=80',
]

function coverFor(id: string): string {
  const hash = id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return COVERS[hash % COVERS.length]
}

function badgeFor(date: Date): WorkshopBadge {
  const days = (date.getTime() - Date.now()) / 86_400_000
  if (days > 1) return 'Coming Soon'
  if (days >= -7) return 'Just In'
  return ''
}

function timeStr(start: Date, end: Date): string {
  const fmt = (date: Date) =>
    date.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  return `${fmt(start)} - ${fmt(end)}`
}

function categoryFor(workshop: Workshop): string {
  return workshop.description?.split(' ').slice(0, 3).join(' ') ?? 'Workshop'
}

export function toWorkshopDTO(workshop: Workshop): WorkshopDTO {
  return {
    id: workshop.id,
    title: workshop.title,
    category: categoryFor(workshop),
    badge: badgeFor(workshop.date),
    seatsTotal: workshop.maxCapacity,
    seatsTaken: workshop.currentRegistrations,
    date: workshop.date.toISOString().split('T')[0],
    time: timeStr(workshop.startTime, workshop.endTime),
    location: workshop.room,
    speaker: workshop.speaker,
    cover: coverFor(workshop.id),
    price: workshop.price,
  }
}

export function toWorkshopDetailDTO(workshop: Workshop): WorkshopDetailDTO {
  const seatsLeft = workshop.maxCapacity - workshop.currentRegistrations
  return {
    ...toWorkshopDTO(workshop),
    seatsLeft,
    description: workshop.description,
    aiSummary: workshop.aiSummary,
    aiSummaryStatus: workshop.aiSummaryStatus,
    roomMapUrl: workshop.roomMapUrl,
  }
}
