import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { Redis } from "@upstash/redis"
import { loginLimiter, registerLimiter, retryAfterSeconds } from "@/lib/ratelimit"

const SESSION_COOKIE = "better-auth.session_token"
const SESSION_COOKIE_SECURE = "__Secure-better-auth.session_token"
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

// ---------------------------------------------------------------------------
// Route classification
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
  if (/^\/api\/workshops\/[^/]+\/seats\/stream$/.test(pathname)) return true
  if (pathname === "/api/payments/vnpay-callback") return true
  if (pathname === "/api/queue/notifications") return true

  return false
}

// Routes that need a specific role verified at the middleware layer.
// All other authenticated routes are handled by requireAuth() in the route handlers.
type RequiredRole = "ORGANIZER" | "CHECKIN_STAFF"

function getRoleProtectedRoute(pathname: string): RequiredRole | null {
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin/"))
    return "ORGANIZER"
  if (pathname === "/scan" || pathname.startsWith("/api/checkins/") || pathname === "/api/checkins")
    return "CHECKIN_STAFF"
  return null
}

// ---------------------------------------------------------------------------
// Session lookup — only used for role-protected routes
// ---------------------------------------------------------------------------

type CachedSession = { user: { role: string } }

function getSessionToken(req: NextRequest): string | undefined {
  return req.cookies.get(SESSION_COOKIE_SECURE)?.value ?? req.cookies.get(SESSION_COOKIE)?.value
}

async function lookupSession(req: NextRequest): Promise<CachedSession | null> {
  const token = getSessionToken(req)
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

  // Rate-limit email login (5 req / 15 min sliding window, by IP)
  if (pathname === "/api/auth/login/email" && method === "POST") {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous"
    if (loginLimiter) {
      const { success, reset } = await loginLimiter.limit(ip)
      if (!success) {
        return NextResponse.json(
          { error: "Too many requests", code: "RATE_LIMIT_EXCEEDED" },
          { status: 429, headers: { "Retry-After": String(retryAfterSeconds(reset)) } }
        )
      }
    }
  }

  // Rate-limit registration (token bucket 2/s burst 10, by IP — fine-grained per user in route handler)
  if (pathname === "/api/registrations" && method === "POST") {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous"
    if (registerLimiter) {
      const { success, reset } = await registerLimiter.limit(ip)
      if (!success) {
        return NextResponse.json(
          { error: "Too many requests", code: "RATE_LIMIT_EXCEEDED" },
          { status: 429, headers: { "Retry-After": String(retryAfterSeconds(reset)) } }
        )
      }
    }
  }

  if (isPublicRoute(pathname, method)) {
    return NextResponse.next()
  }

  const requiredRole = getRoleProtectedRoute(pathname)

  if (requiredRole) {
    // Role-protected: do full session + role check
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
    if (session.user.role !== requiredRole) {
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

  if (isApi) {
    // Non-role API routes: pass through to route handler.
    // requireAuth() in each handler is the authoritative auth check.
    return NextResponse.next()
  }

  // Page routes (non-role): require session cookie to exist.
  // The actual session validity is checked by the page's server components.
  const hasCookie = Boolean(getSessionToken(req))
  if (!hasCookie) {
    const loginUrl = new URL("/login", req.url)
    loginUrl.searchParams.set("next", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
