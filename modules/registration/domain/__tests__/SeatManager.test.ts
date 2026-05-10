/**
 * Run with: npx tsx modules/registration/domain/__tests__/SeatManager.test.ts
 */
import assert from 'assert'
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

async function run() {
  // ── 1. Zero-capacity: tryReserve must return false ──────────────────────────
  {
    const sm = new SeatManager(makeStore())
    await sm.init('w0', 0)
    assert.strictEqual(await sm.tryReserve('w0'), false, 'zero-capacity: first reserve must be false')
    assert.strictEqual(await sm.tryReserve('w0'), false, 'zero-capacity: second reserve must still be false')
    assert.strictEqual(await sm.current('w0'), 0, 'zero-capacity: counter must stay at 0')
  }

  // ── 2. Single seat: first succeeds, second fails ────────────────────────────
  {
    const sm = new SeatManager(makeStore())
    await sm.init('w1', 1)
    assert.strictEqual(await sm.tryReserve('w1'), true, '1-seat: first reserve must succeed')
    assert.strictEqual(await sm.tryReserve('w1'), false, '1-seat: second reserve must fail')
    assert.strictEqual(await sm.current('w1'), 0, '1-seat: counter must be 0 after reservation')
  }

  // ── 3. Concurrent reserves on last seat: exactly one succeeds ───────────────
  // Node is single-threaded; Promise.all starts both coroutines before either awaits,
  // so both redis.decr calls fire synchronously — the DECR-then-check pattern ensures
  // only one positive result.
  {
    const sm = new SeatManager(makeStore())
    await sm.init('w2', 1)
    const [r1, r2] = await Promise.all([sm.tryReserve('w2'), sm.tryReserve('w2')])
    const successes = [r1, r2].filter(Boolean).length
    assert.strictEqual(successes, 1, 'concurrent: exactly 1 of 2 must succeed')
    assert.strictEqual(await sm.current('w2'), 0, 'concurrent: counter must be 0 after')
  }

  // ── 4. Release restores one seat, capped at max ─────────────────────────────
  {
    const sm = new SeatManager(makeStore())
    await sm.init('w3', 2)
    await sm.tryReserve('w3')
    await sm.tryReserve('w3')
    assert.strictEqual(await sm.current('w3'), 0)
    await sm.release('w3')
    assert.strictEqual(await sm.current('w3'), 1, 'release: counter must increase to 1')
    await sm.release('w3')
    await sm.release('w3') // extra release — should be capped at max=2
    assert.strictEqual(await sm.current('w3'), 2, 'release: counter must not exceed max')
  }

  console.log('All SeatManager tests passed ✓')
}

run().catch((err) => { console.error(err); process.exit(1) })
