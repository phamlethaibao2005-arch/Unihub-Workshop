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
    const source = new EventSource(`/api/workshops/${workshopId}/seats/stream`)

    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as { seatsLeft?: number }
        if (typeof data.seatsLeft === 'number') {
          setSeatsLeft(Math.max(data.seatsLeft, 0))
        }
      } catch {
        // Ignore malformed SSE payloads
      }
    }

    source.onerror = () => {
      source.close()
    }

    return () => {
      source.close()
    }
  }, [workshopId])

  const safeTaken = Math.min(total, Math.max(total - seatsLeft, 0))

  return <SeatBar taken={safeTaken} total={total} />
}
