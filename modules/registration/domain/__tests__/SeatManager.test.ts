import { describe, it, expect } from 'vitest'
import { SeatManager, type ISeatStore } from '../SeatManager'

function makeStore(): ISeatStore {
  const data = new Map<string, number>()
  return {
    async get<T = number>(key: string): Promise<T | null> {
      const v = data.get(key)
      return v === undefined ? null : (v as unknown as T)
    },
    async set(key: string, value: number): Promise<'OK'> {
      data.set(key, value)
      return 'OK'
    },
    async incr(key: string): Promise<number> {
      const v = (data.get(key) ?? 0) + 1
      data.set(key, v)
      return v
    },
    async decr(key: string): Promise<number> {
      const v = (data.get(key) ?? 0) - 1
      data.set(key, v)
      return v
    },
  }
}

describe('SeatManager', () => {
  it('zero-capacity: tryReserve always returns false', async () => {
    const sm = new SeatManager(makeStore())
    await sm.init('w0', 0)
    expect(await sm.tryReserve('w0')).toBe(false)
    expect(await sm.tryReserve('w0')).toBe(false)
    expect(await sm.current('w0')).toBe(0)
  })

  it('single seat: first reserve succeeds, second fails', async () => {
    const sm = new SeatManager(makeStore())
    await sm.init('w1', 1)
    expect(await sm.tryReserve('w1')).toBe(true)
    expect(await sm.tryReserve('w1')).toBe(false)
    expect(await sm.current('w1')).toBe(0)
  })

  it('concurrent reserves on last seat: exactly one succeeds', async () => {
    const sm = new SeatManager(makeStore())
    await sm.init('w2', 1)
    const [r1, r2] = await Promise.all([sm.tryReserve('w2'), sm.tryReserve('w2')])
    expect([r1, r2].filter(Boolean).length).toBe(1)
    expect(await sm.current('w2')).toBe(0)
  })

  it('release restores one seat, capped at max', async () => {
    const sm = new SeatManager(makeStore())
    await sm.init('w3', 2)
    await sm.tryReserve('w3')
    await sm.tryReserve('w3')
    expect(await sm.current('w3')).toBe(0)
    await sm.release('w3')
    expect(await sm.current('w3')).toBe(1)
    await sm.release('w3')
    await sm.release('w3') // extra release — capped at max=2
    expect(await sm.current('w3')).toBe(2)
  })
})
