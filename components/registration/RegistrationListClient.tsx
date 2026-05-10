'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import { BoardingPass } from '@/components/dashboard/BoardingPass'
import type { RegistrationDTO } from '@/shared/types/registration'

interface Props {
  upcoming: RegistrationDTO[]
  past: RegistrationDTO[]
}

export function RegistrationListClient({ upcoming, past }: Props) {
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set())

  const remove = (id: string) =>
    setRemovedIds((prev) => new Set([...prev, id]))

  const visibleUpcoming = upcoming.filter((r) => !removedIds.has(r.id))
  const visiblePast = past.filter((r) => !removedIds.has(r.id))
  const totalVisible = visibleUpcoming.length + visiblePast.length

  if (totalVisible === 0) {
    return (
      <div className="mt-10 border border-dashed border-hairline px-8 py-16 flex flex-col items-center gap-4">
        <p className="text-[13px] uppercase tracking-[0.15em] text-[#9e9ea0]">
          Chưa có vé nào
        </p>
        <Link
          href="/workshops"
          className="pill-ghost text-[13px]"
        >
          Khám phá workshop
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-10 mt-10">
      {visibleUpcoming.length > 0 && (
        <section>
          <p className="text-[11px] uppercase tracking-[0.15em] text-[#9e9ea0] pb-4 border-b border-hairline mb-4">
            Sắp diễn ra
          </p>
          <div className="flex flex-col gap-3">
            <AnimatePresence>
              {visibleUpcoming.map((reg) => (
                <motion.div
                  key={reg.id}
                  layout
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                >
                  <BoardingPass registration={reg} onCancelled={() => remove(reg.id)} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </section>
      )}

      {visiblePast.length > 0 && (
        <section>
          <p className="text-[11px] uppercase tracking-[0.15em] text-[#9e9ea0] pb-4 border-b border-hairline mb-4">
            Đã qua
          </p>
          <div className="flex flex-col gap-3">
            <AnimatePresence>
              {visiblePast.map((reg) => (
                <motion.div
                  key={reg.id}
                  layout
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                >
                  <BoardingPass registration={reg} onCancelled={() => remove(reg.id)} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </section>
      )}
    </div>
  )
}
