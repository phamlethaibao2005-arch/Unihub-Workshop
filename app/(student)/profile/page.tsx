import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/session'
import { db } from '@/shared/infrastructure/PrismaClient'
import { ProfileClient } from '@/components/profile/ProfileClient'
import type { Session } from '@/lib/auth'

type SessionUser = Session['user'] & { studentId?: string | null }

export default async function ProfilePage() {
  const session = await getSession()
  if (!session?.user) redirect('/login')

  const user = session.user as SessionUser
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [total, confirmed, upcoming] = await Promise.all([
    db.registration.count({ where: { userId: user.id } }),
    db.registration.count({ where: { userId: user.id, status: 'CONFIRMED' } }),
    db.registration.count({
      where: {
        userId: user.id,
        status: 'CONFIRMED',
        workshop: { date: { gte: today } },
      },
    }),
  ])

  const year = new Date().getFullYear()

  return (
    <main className="px-4 md:px-6 lg:px-10 py-12 max-w-lg mx-auto">
      {/* Back */}
      <Link
        href="/workshops"
        className="inline-flex items-center gap-1.5 text-[12px] uppercase tracking-widest text-ink/40 hover:text-ink transition-colors mb-8"
      >
        ← Khám phá workshops
      </Link>

      {/* Eyebrow */}
      <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-[#9e9ea0]">
        HỒ SƠ / Cohort {year}
      </p>

      {/* Headline */}
      <h1 className="font-display text-[48px] md:text-[64px] text-ink uppercase leading-none mt-1 mb-8">
        Cá Nhân
      </h1>

      <ProfileClient
        name={user.name ?? ''}
        email={user.email}
        studentId={user.studentId ?? null}
        stats={{ total, confirmed, upcoming }}
      />

      {/* Quick links */}
      <div className="mt-8 border-t border-hairline pt-6 flex flex-col gap-3">
        <Link
          href="/my-registrations"
          className="flex items-center justify-between py-3 border-b border-hairline group"
        >
          <span className="text-[14px] font-medium text-ink">Vé của tôi</span>
          <span className="text-[13px] text-ink/40 group-hover:text-ink transition-colors">→</span>
        </Link>
        <Link
          href="/workshops"
          className="flex items-center justify-between py-3 border-b border-hairline group"
        >
          <span className="text-[14px] font-medium text-ink">Khám phá workshops</span>
          <span className="text-[13px] text-ink/40 group-hover:text-ink transition-colors">→</span>
        </Link>
      </div>
    </main>
  )
}
