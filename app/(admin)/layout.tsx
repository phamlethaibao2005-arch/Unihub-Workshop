import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { NavRail } from '@/components/admin/NavRail'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.user.role !== 'ORGANIZER') redirect('/workshops')

  return (
    <div className="flex min-h-screen">
      {/* Left rail */}
      <aside className="fixed left-0 top-0 flex h-full w-55 flex-col border-r border-hairline bg-cloud">
        <div className="border-b border-hairline px-6 py-5">
          <span className="font-display text-[20px] uppercase leading-none text-ink">
            UNIHUB / OPS
          </span>
        </div>
        <NavRail />
      </aside>

      {/* Main content */}
      <main className="ml-[220px] min-h-screen flex-1 bg-canvas p-12">
        {children}
      </main>
    </div>
  )
}
