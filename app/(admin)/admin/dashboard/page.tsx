import { db } from '@/shared/infrastructure/PrismaClient'
import { ActivityFeed } from '@/components/admin/ActivityFeed'
import { HolographicPanel } from '@/components/admin/HolographicPanel'

async function getStats() {
  const [workshops, registrations, todayCheckins, revenue] = await Promise.all([
    db.workshop.count({ where: { status: 'ACTIVE' } }),
    db.registration.count({ where: { status: 'CONFIRMED' } }),
    db.checkin.count({
      where: {
        checkedInAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    }),
    db.payment.aggregate({
      _sum: { amount: true },
      where: { status: 'SUCCESS' },
    }),
  ])
  return {
    workshops,
    registrations,
    todayCheckins,
    revenue: revenue._sum.amount ?? 0,
  }
}

async function getRecentRegistrations() {
  return db.registration.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: {
      user: { select: { name: true, email: true } },
      workshop: { select: { title: true } },
    },
  })
}

function fmtPrice(amount: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const STATUS_LABEL: Record<string, string> = {
  CONFIRMED: 'Confirmed',
  PENDING: 'Pending',
  CANCELLED: 'Cancelled',
  PAYMENT_FAILED: 'Thất bại',
}
const STATUS_CLASS: Record<string, string> = {
  CONFIRMED: 'text-emerald',
  PENDING: 'text-ink/60',
  CANCELLED: 'text-nikered',
  PAYMENT_FAILED: 'text-nikered',
}

export default async function AdminDashboardPage() {
  const [stats, recentRegs] = await Promise.all([getStats(), getRecentRegistrations()])

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <p className="text-[11px] uppercase tracking-[0.25em] text-ink/60">ADMIN / COMMAND CENTER</p>
        <h1 className="font-display text-[64px] uppercase leading-[0.9] text-ink">Dashboard</h1>
      </div>

      {/* Stats + 3D panel */}
      <div className="grid grid-cols-3 gap-6">
        {/* 4-up stat grid */}
        <div className="col-span-2 grid grid-cols-2 gap-4">
          <StatCard label="Workshops đang hoạt động" value={stats.workshops} />
          <StatCard label="Đăng ký xác nhận" value={stats.registrations} />
          <StatCard label="Check-in hôm nay" value={stats.todayCheckins} accent="cyan" />
          <StatCard label="Doanh thu" value={fmtPrice(stats.revenue)} accent="emerald" />
        </div>

        {/* Holographic panel */}
        <HolographicPanel />
      </div>

      {/* Activity feed */}
      <div>
        <p className="mb-3 text-[11px] uppercase tracking-[0.2em] text-ink/60">Live Activity</p>
        <ActivityFeed />
      </div>

      {/* Recent registrations */}
      <div>
        <p className="mb-3 text-[11px] uppercase tracking-[0.2em] text-ink/60">Đăng ký gần đây</p>
        <div className="border border-hairline">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-hairline bg-cloud text-left text-[11px] uppercase tracking-[0.15em] text-ink/60">
                <th className="px-4 py-2.5">Sinh viên</th>
                <th className="px-4 py-2.5">Workshop</th>
                <th className="px-4 py-2.5">Trạng thái</th>
                <th className="px-4 py-2.5">Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {recentRegs.map((reg) => (
                <tr key={reg.id} className="border-b border-hairline last:border-0 hover:bg-cloud/50">
                  <td className="px-4 py-3">
                    <p className="font-medium">{reg.user.name}</p>
                    <p className="text-ink/50">{reg.user.email}</p>
                  </td>
                  <td className="px-4 py-3 text-ink/80">{reg.workshop.title}</td>
                  <td className={`px-4 py-3 font-medium ${STATUS_CLASS[reg.status] ?? 'text-ink/60'}`}>
                    {STATUS_LABEL[reg.status] ?? reg.status}
                  </td>
                  <td className="px-4 py-3 text-ink/50">{fmtDate(reg.createdAt)}</td>
                </tr>
              ))}
              {recentRegs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-ink/40">
                    Chưa có đăng ký
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string
  value: string | number
  accent?: 'cyan' | 'emerald'
}) {
  const valueClass = accent === 'cyan'
    ? 'text-cyan'
    : accent === 'emerald'
      ? 'text-emerald'
      : 'text-ink'

  return (
    <div className="flex flex-col justify-between border border-hairline p-5">
      <p className="text-[11px] uppercase tracking-[0.15em] text-ink/60">{label}</p>
      <p className={`font-display text-[40px] leading-none ${valueClass}`}>{value}</p>
    </div>
  )
}
