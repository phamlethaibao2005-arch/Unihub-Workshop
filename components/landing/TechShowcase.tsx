'use client'

import { motion } from 'framer-motion'

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: 'easeOut' as const },
  viewport: { once: true, amount: 0.3 },
}

export function TechShowcase() {
  return (
    <section className="bg-ink text-white py-24">
      <div className="px-4 md:px-6 lg:px-10 grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-12 items-center">
        <motion.div {...fadeUp}>
          <h2
            className="font-display uppercase leading-[0.9]"
            style={{ fontSize: 'clamp(56px, 7vw, 96px)' }}
          >
            TECHNICAL INTEGRITY
            <br />
            ZERO OVERSELL
          </h2>
        </motion.div>

        <motion.div {...fadeUp}>
          <div className="border border-white/15 p-6">
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/60 mb-4">
              System Map
            </div>
            <svg viewBox="0 0 520 220" className="w-full h-auto">
              <g stroke="rgba(255,255,255,0.4)" strokeWidth="1" fill="none">
                <rect x="18" y="20" width="120" height="48" rx="6" />
                <rect x="200" y="20" width="120" height="48" rx="6" />
                <rect x="382" y="20" width="120" height="48" rx="6" />
                <rect x="120" y="150" width="120" height="48" rx="6" />
                <rect x="300" y="150" width="120" height="48" rx="6" />

                <line x1="138" y1="44" x2="200" y2="44" />
                <line x1="320" y1="44" x2="382" y2="44" />
                <line x1="260" y1="68" x2="180" y2="150" />
                <line x1="260" y1="68" x2="360" y2="150" />
              </g>

              <g fill="#ffffff" fontSize="10" letterSpacing="2">
                <text x="44" y="48">USER</text>
                <text x="238" y="48">API</text>
                <text x="420" y="48">DB</text>
                <text x="148" y="178">REDIS</text>
                <text x="320" y="178">VNPAY</text>
              </g>
            </svg>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
            <div className="border border-white/15 p-4">
              <div className="text-[10px] uppercase tracking-[0.25em] text-white/60">Uptime</div>
              <div className="font-display text-3xl mt-2">99.98%</div>
            </div>
            <div className="border border-white/15 p-4">
              <div className="text-[10px] uppercase tracking-[0.25em] text-white/60">Capacity</div>
              <div className="font-display text-3xl mt-2">12k</div>
            </div>
            <div className="border border-white/15 p-4">
              <div className="text-[10px] uppercase tracking-[0.25em] text-white/60">Response</div>
              <div className="font-display text-3xl mt-2">142ms</div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
