import type { IPaymentGateway, CreatePaymentUrlInput } from '../domain/IPaymentGateway'
import type { Redis } from '@upstash/redis'
import { ServiceUnavailableError } from '@/shared/errors/AppError'

const KEY = 'circuit:vnpay'
const FAILURE_THRESHOLD = 5
const FAILURE_WINDOW_MS = 60_000  // slide window resets after 60s of no new failures
const OPEN_TIMEOUT_MS = 30_000    // OPEN → HALF_OPEN after 30s

interface CircuitState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN'
  failures: number
  windowStart: number
  openedAt: number | null
}

function defaultState(): CircuitState {
  return { state: 'CLOSED', failures: 0, windowStart: Date.now(), openedAt: null }
}

export class PaymentGatewayCircuitBreaker implements IPaymentGateway {
  constructor(
    private readonly inner: IPaymentGateway,
    private readonly redis: Redis,
  ) {}

  private async getState(): Promise<CircuitState> {
    const raw = await this.redis.get<CircuitState>(KEY)
    return raw ?? defaultState()
  }

  private async setState(s: CircuitState): Promise<void> {
    await this.redis.set(KEY, s)
  }

  private async preCall(): Promise<void> {
    const s = await this.getState()
    const now = Date.now()

    if (s.state === 'OPEN') {
      if (s.openedAt !== null && now - s.openedAt >= OPEN_TIMEOUT_MS) {
        await this.setState({ ...s, state: 'HALF_OPEN' })
        return  // let the probe through
      }
      throw new ServiceUnavailableError('Payment gateway is temporarily unavailable')
    }
    // CLOSED or HALF_OPEN: allow through
  }

  private async onSuccess(): Promise<void> {
    const s = await this.getState()
    if (s.state !== 'CLOSED' || s.failures > 0) {
      await this.setState(defaultState())
    }
  }

  private async onFailure(): Promise<void> {
    const s = await this.getState()
    const now = Date.now()

    if (s.state === 'HALF_OPEN') {
      await this.setState({ ...s, state: 'OPEN', openedAt: now })
      return
    }

    // CLOSED: count failures within the sliding window
    const windowExpired = now - s.windowStart > FAILURE_WINDOW_MS
    const failures = windowExpired ? 1 : s.failures + 1
    const windowStart = windowExpired ? now : s.windowStart

    if (failures >= FAILURE_THRESHOLD) {
      await this.setState({ state: 'OPEN', failures, windowStart, openedAt: now })
    } else {
      await this.setState({ ...s, state: 'CLOSED', failures, windowStart })
    }
  }

  async createPaymentUrl(input: CreatePaymentUrlInput): Promise<string> {
    await this.preCall()
    try {
      const result = await this.inner.createPaymentUrl(input)
      await this.onSuccess()
      return result
    } catch (err) {
      await this.onFailure()
      throw err
    }
  }

  verifyCallback(params: Record<string, string>): boolean {
    // Local HMAC — no network call, circuit does not apply
    return this.inner.verifyCallback(params)
  }

  async queryStatus(txnRef: string): Promise<'SUCCESS' | 'FAILED' | 'PENDING'> {
    await this.preCall()
    try {
      const result = await this.inner.queryStatus(txnRef)
      await this.onSuccess()
      return result
    } catch (err) {
      await this.onFailure()
      throw err
    }
  }
}
