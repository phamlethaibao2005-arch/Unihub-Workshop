import { Redis } from "@upstash/redis"
import { Ratelimit } from "@upstash/ratelimit"

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null

// POST /api/registrations — 2 tokens/sec refill, 10 token burst, keyed by ip:userId
export const registerLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.tokenBucket(2, "1 s", 10),
      prefix: "rl:register",
    })
  : null

// GET /api/workshops — 30 req per 10 s fixed window, keyed by ip
export const workshopsListLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(30, "10 s"),
      prefix: "rl:workshops",
    })
  : null

// POST /api/auth/login/email — 5 req per 15 min sliding window, keyed by ip
export const loginLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "15 m"),
      prefix: "rl:login",
    })
  : null

export function retryAfterSeconds(reset: number): number {
  return Math.max(1, Math.ceil((reset - Date.now()) / 1000))
}
