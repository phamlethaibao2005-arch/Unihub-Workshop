import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { db } from '@/shared/infrastructure/PrismaClient'
import { RegistrationListClient } from '@/components/registration/RegistrationListClient'
import type { RegistrationDTO } from '@/shared/types/registration'


function fmt(d: Date) {
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export default async function MyRegistrationsPage() {
  const session = await getSession()
  console.log('Session in MyRegistrationsPage:', session) // Debug log
  if (!session?.user) redirect('/login')

  const year = new Date().getFullYear()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const rows = await db.registration.findMany({
    where: { userId: session.user.id },
    include: {
      workshop: {
        select: { title: true, speaker: true, date: true, startTime: true, endTime: true, room: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const registrations: RegistrationDTO[] = rows.map((row: typeof rows[number]) => ({
    id: row.id,
    workshopId: row.workshopId,
    status: row.status as RegistrationDTO['status'],
    qrCode: row.qrCode,
    createdAt: row.createdAt.toISOString(),
    workshop: {
      title: row.workshop.title,
      speaker: row.workshop.speaker,
      date: row.workshop.date.toISOString().split('T')[0],
      time: `${fmt(row.workshop.startTime)} – ${fmt(row.workshop.endTime)}`,
      location: row.workshop.room,
    },
  }))

  const upcoming = registrations.filter((r) => new Date(r.workshop.date) >= today)
  const past = registrations.filter((r) => new Date(r.workshop.date) < today)

  return (
    <main className="px-4 md:px-6 lg:px-10 py-[48px] max-w-2xl">
      {/* Eyebrow */}
      <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-[#9e9ea0]">
        MY DROPS / Cohort {year}
      </p>

      {/* Headline */}
      <h1 className="font-display text-[64px] text-ink uppercase leading-none mt-1 mb-2">
        Vé Của Bạn
      </h1>

      <RegistrationListClient upcoming={upcoming} past={past} />
    </main>
  )
}
