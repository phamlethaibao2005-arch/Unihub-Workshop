import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { Redis } from "@upstash/redis"
import { Ratelimit } from "@upstash/ratelimit"

const SESSION_COOKIE = "better-auth.session_token"
const SESSION_TTL = 60 // seconds

const hasRedisConfig = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
)

const redis = hasRedisConfig
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null

// 5 requests per 15 minutes per IP (token bucket)
const loginRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.tokenBucket(5, "15 m", 5),
      prefix: "rl:login",
    })
  : null

// ---------------------------------------------------------------------------
// Route helpers
// ---------------------------------------------------------------------------

function isPublicRoute(pathname: string, method: string): boolean {
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    /\.(ico|png|jpe?g|svg|webp|woff2?|ttf|css|js|map)$/.test(pathname)
  ) return true

  if (pathname.startsWith("/api/auth/")) return true

  if (pathname === "/" || pathname === "/login" || pathname === "/signup") return true

  if (pathname === "/workshops" || pathname.startsWith("/workshops/")) return true

  if (pathname === "/api/workshops" && method === "GET") return true
  if (/^\/api\/workshops\/[^/]+$/.test(pathname) && method === "GET") return true
  // SSE seat stream is public — no auth required
  if (/^\/api\/workshops\/[^/]+\/seats\/stream$/.test(pathname)) return true
  // VNPAY IPN callback — authenticated by HMAC signature, not session
  if (pathname === "/api/payments/vnpay-callback") return true
  // QStash notification webhook — authenticated by QStash signature
  if (pathname === "/api/queue/notifications") return true

  return false
}

type RequiredRole = "ORGANIZER" | "CHECKIN_STAFF" | "STUDENT" | null

function getRequiredRole(pathname: string, method: string): RequiredRole {
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin/"))
    return "ORGANIZER"
  if (pathname === "/scan" || pathname.startsWith("/api/checkins/") || pathname === "/api/checkins")
    return "CHECKIN_STAFF"
  if (pathname === "/my-registrations") return "STUDENT"
  if (pathname === "/api/registrations" && method === "POST") return "STUDENT"
  return null
}

// ---------------------------------------------------------------------------
// Session lookup — Redis first, then Better-Auth API on miss
// ---------------------------------------------------------------------------

type CachedSession = { user: { role: string } }

async function lookupSession(req: NextRequest): Promise<CachedSession | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token) return null

  if (redis) {
    const cached = await redis.get<CachedSession>(`session:${token}`)
    if (cached) return cached
  }

  try {
    const url = new URL("/api/auth/get-session", req.url)
    const res = await fetch(url.toString(), {
      headers: { cookie: req.headers.get("cookie") ?? "" },
      cache: "no-store",
    })
    if (!res.ok) return null
    const data: CachedSession | null = await res.json()
    if (redis && data?.user?.role) {
      await redis.set(`session:${token}`, data, { ex: SESSION_TTL })
    }
    return data?.user ? data : null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Proxy entry point
// ---------------------------------------------------------------------------

export async function proxy(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl
  const method = req.method
  const isApi = pathname.startsWith("/api/")

  // Rate-limit login
  if (pathname === "/api/auth/login/email" && method === "POST") {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous"
    if (loginRatelimit) {
      const { success } = await loginRatelimit.limit(ip)
      if (!success) {
        return NextResponse.json(
          { error: "Too many requests", code: "RATE_LIMIT_EXCEEDED" },
          { status: 429 }
        )
      }
    }
  }

  if (isPublicRoute(pathname, method)) {
    return NextResponse.next()
  }

  const session = await lookupSession(req)

  if (!session) {
    if (isApi) {
      return NextResponse.json(
        { error: "Authentication required", code: "UNAUTHORIZED" },
        { status: 401 }
      )
    }
    const loginUrl = new URL("/login", req.url)
    loginUrl.searchParams.set("next", pathname)
    return NextResponse.redirect(loginUrl)
  }

  const required = getRequiredRole(pathname, method)
  if (required && session.user.role !== required) {
    if (isApi) {
      return NextResponse.json(
        { error: "Insufficient permissions", code: "FORBIDDEN" },
        { status: 403 }
      )
    }
    return new NextResponse("403 Forbidden", { status: 403 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
