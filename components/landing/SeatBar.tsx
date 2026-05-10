type SeatBarProps = {
  taken: number
  total: number
}

export function SeatBar({ taken, total }: SeatBarProps) {
  const safeTotal = Math.max(total, 0)
  const safeTaken = Math.min(Math.max(taken, 0), safeTotal)
  const pct = safeTotal > 0 ? (safeTaken / safeTotal) * 100 : 0

  return (
    <div className="w-full">
      <div className="relative h-px w-full overflow-hidden bg-hairline">
        <div
          className="absolute inset-y-0 left-0 bg-ink transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1 flex justify-end">
        <span className="text-[11px] tabular-nums text-ink/60">
          {safeTaken} / {safeTotal} ghế
        </span>
      </div>
    </div>
  )
}
