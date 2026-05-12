'use client'

import { useEffect, useState } from 'react'
import { SeatBar } from './SeatBar'

type LiveSeatBarProps = {
  workshopId: string
  taken: number
  total: number
}

export function LiveSeatBar({ workshopId, taken, total }: LiveSeatBarProps) {
  const [seatsLeft, setSeatsLeft] = useState(() => Math.max(total - taken, 0))

  useEffect(() => {
    let active = true

    async function poll() {
      try {
        const res = await fetch(`/api/workshops/${workshopId}`, { cache: 'no-store' })
        if (!res.ok || !active) return
        const data = await res.json() as { seatsLeft?: number }
        if (typeof data.seatsLeft === 'number') {
          setSeatsLeft(Math.max(data.seatsLeft, 0))
        }
      } catch {
        // Ignore network errors — keep last known value
      }
    }

    void poll()
    const id = setInterval(() => void poll(), 5_000)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [workshopId])

  const safeTaken = Math.min(total, Math.max(total - seatsLeft, 0))

  return <SeatBar taken={safeTaken} total={total} />
}
