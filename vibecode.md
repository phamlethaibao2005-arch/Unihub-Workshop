# UniHub Workshop — Vibecode Prompt Sequence

> Sequential prompts to build the entire system. Run them **in order** — each phase depends on the previous.
> Every prompt assumes the agent reads `blueprint/design.md`, `blueprint/proposal.md`, `blueprint/frontend-rule.md`, `3D_frontend.md`, and the relevant spec in `blueprint/specs/` before coding.
> Stack: Next.js 16 (App Router) + Prisma 7 + Better-Auth + Tailwind v4 + ShadcnUI + Upstash Redis + Upstash QStash + Neon Postgres + three.js / @react-three/fiber + framer-motion.

---

## Global rules (paste into CLAUDE.md or system prompt once)

```
- Stack: Next.js 16, Prisma 7, Better-Auth, Tailwind v4, ShadcnUI, Upstash Redis, Upstash QStash, Neon Postgres, Resend, Gemini 2.5 Flash, VNPAY sandbox, three.js + @react-three/fiber, framer-motion.
- Architecture: Modular Monolith + Clean Architecture. Folders: app/, modules/<name>/{domain,application,infrastructure}, shared/, components/, prisma/.
- Domain layer imports nothing from outer layers. Application depends only on interfaces.
- Read `node_modules/next/dist/docs/` before using Next.js APIs — this version has breaking changes.
- TypeScript strict. No `any`. Zod for runtime validation at boundaries.
- Design system = Nike editorial + 3D holographic hero (see `blueprint/frontend-rule.md` and `3D_frontend.md`):
  - Palette: `--ink #111111`, `--canvas #ffffff`, `--cloud #f5f5f5`, `--hairline #cacacb`, `--red #d30005`, `--emerald #007d48`, `--cyan #06b6d4`, `--violet #8b5cf6` (last two only inside the 3D canvas torus rings).
  - Fonts: Inter (sans/body), Bebas Neue (display, uppercase, tracking -0.02em), JetBrains Mono (terminal/code).
  - Geometry: pill CTAs (`rounded-full` 9999px / `rounded-lg` 30px), flat cards (`rounded-none`, zero shadow), 1px hairline dividers only.
  - One primary `pill-primary` (black) per viewport; pair with `pill-ghost` or `pill-outline-image`.
  - Reserve 96px Bebas display strictly for editorial hero / campaign lockups; everything else 12–16px Inter.
  - 3D hero (`HolographicCanvas`) is the brand signature — use on landing + login bg + admin dashboard hero. Always `dynamic(..., { ssr: false })`.
- Never log secrets. Use env vars from .env.example.
- Prefer editing existing files over creating new ones.
- Before claiming a phase done: run `npm run build` and `npx tsc --noEmit`; fix all errors.
```

---

## Phase 0 — Bootstrap & Shared Kernel

### P0.1 — Env, Prisma schema, migration

```
Read blueprint/design.md §4 (DB schema) and blueprint/specs/auth.md.

Tasks:
1. Create .env.example listing every required var: DATABASE_URL, DIRECT_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, QSTASH_TOKEN, QSTASH_CURRENT_SIGNING_KEY, QSTASH_NEXT_SIGNING_KEY, VNPAY_TMN_CODE, VNPAY_HASH_SECRET, VNPAY_URL, VNPAY_RETURN_URL, GEMINI_API_KEY, RESEND_API_KEY, BLOB_READ_WRITE_TOKEN, QR_HMAC_SECRET.
2. Write prisma/schema.prisma EXACTLY matching design.md §4.2 (User, Session, Account, Verification, Workshop, Registration, Payment, IdempotencyRecord, Checkin, CsvImportLog, NotificationLog and all enums + indexes).
3. Generate first migration: `prisma migrate dev --name init`.
4. Create prisma/seed.ts with 1 ORGANIZER, 2 CHECKIN_STAFF, 5 STUDENT users (bcrypt password "password123"), 6 workshops (3 free, 3 paid; mix of dates/capacities).
5. Wire `"prisma": { "seed": "tsx prisma/seed.ts" }` in package.json. Add `tsx` as devDep.

Acceptance: `npx prisma migrate reset --force` runs clean; `select count(*) from "Workshop"` returns 6.
```

### P0.2 — Shared kernel (DDD bases, singletons, EventBus, Container, errors)

```
Create shared/ files:

1. shared/domain/Entity.ts — abstract class with `id`, `equals(other)`.
2. shared/domain/ValueObject.ts — abstract, structural equality via JSON.stringify of props.
3. shared/domain/DomainEvent.ts — abstract { occurredAt: Date; aggregateId: string }.
4. shared/infrastructure/PrismaClient.ts — singleton PrismaClient (globalThis pattern for Next.js dev hot reload).
5. shared/infrastructure/RedisClient.ts — singleton @upstash/redis Redis client from env.
6. shared/infrastructure/QStashClient.ts — `@upstash/qstash` Client singleton; export `enqueue(destinationUrl, payload, opts?)` which calls `client.publishJSON({ url, body: payload, ...opts })`. Also export `verifyQStashSignature(req)` using Receiver with QSTASH_CURRENT/NEXT_SIGNING_KEY — call this at the top of every queue handler route.
7. shared/infrastructure/EventBus.ts — in-memory pub/sub: `subscribe(eventName, handler)`, `publish(event)`. Handlers are async; failures logged but don't throw.
8. shared/infrastructure/Container.ts — DI container. Exports `container` with lazy getters for every service we'll add later (start empty, fill as we go).
9. shared/errors/AppError.ts — class with { code, statusCode, message }; subclasses NotFoundError(404), ConflictError(409), ValidationError(400), UnauthorizedError(401), ForbiddenError(403), RateLimitError(429), ServiceUnavailableError(503).
10. shared/errors/handle.ts — `toResponse(err)` converts AppError | ZodError | unknown into NextResponse with proper status + JSON body.

Install: @upstash/redis, @upstash/qstash.

Acceptance: `npx tsc --noEmit` passes.
```

### P0.3 — Nike design tokens, fonts, CSS utilities

```
Read blueprint/frontend-rule.md and 3D_frontend.md §5–§7.

1. Install: `npm i framer-motion lucide-react qrcode tailwindcss-animate && npm i -D @types/qrcode`.

2. app/layout.tsx — replace existing fonts with three next/font/google entries (copy verbatim from 3D_frontend.md §7):
   - Inter (subsets latin + vietnamese, weights 300-900, variable --font-inter).
   - Bebas_Neue (weight 400, variable --font-bebas).
   - JetBrains_Mono (weights 400/500/700, variable --font-mono).
   <html lang="vi" gets all three .variable classes; <body className="font-sans bg-white text-ink antialiased">.

3. app/globals.css — replace contents with the block from 3D_frontend.md §5 verbatim. This defines:
   - CSS vars: --ink, --canvas, --cloud, --hairline, --red, --emerald, --cyan, --violet.
   - Font utilities: .font-display (Bebas, -0.02em tracking), .font-sans (Inter), .font-mono (JetBrains).
   - .hairline border helper.
   - Button utilities: .pill-primary (black 9999px pill), .pill-outline-image (white-on-image), .pill-ghost (transparent w/ hairline).
   - .badge-promo / .badge-red / .badge-green.
   - Animations: softBlink + .dot-blink, marquee + .marquee-track, blinkCursor + .terminal-cursor.
   - Custom scrollbar, .tabular numerics, :focus-visible 2px ink outline.

4. Tailwind v4 (@theme inline in globals.css): expose tokens so utility classes work — colors {ink, canvas, cloud, hairline, nikered (#d30005), emerald (#007d48), cyan (#06b6d4), violet (#8b5cf6)}; fontFamily {sans, display, mono}; borderRadius {none:0, sm:4px, md:24px, lg:30px, full:9999px}; spacing.section = 48px.

5. Update components/ui (ShadcnUI primitives previously generated) — override Button default to use .pill-primary; Input radius to 24px; Card radius to 0 with no shadow (flat). Keep Form/Dialog primitives as-is.

6. components/PillButton.tsx — wrapper that maps `variant="primary"|"ghost"|"outline-image"` to the global pill classes; accepts asChild + lucide icons.

Acceptance: render <PillButton variant="primary">Test <ArrowRight/></PillButton> on the homepage — black 9999px pill with Inter 14/500. `npm run build` clean.
```

### P0.4 — 3D HolographicCanvas + Hero3D primitive

```
Read 3D_frontend.md §3 and §4.

1. Install: `npm i three @react-three/fiber && npm i -D @types/three`.

2. components/HolographicCanvas.tsx — copy the file VERBATIM from 3D_frontend.md §3 (HolographicCore + default export). It contains:
   - 800-particle Float32Array on a sphere shell (r ∈ [1.8, 3.4]).
   - Outer wireframe icosahedron (color #111111, opacity 0.85).
   - Inner solid + wire icosahedron pair (#f5f5f5 + #111111, scale 0.55-0.56).
   - Two torus rings — cyan (#06b6d4) and violet (#8b5cf6) — orthogonal axes.
   - Pointer-driven group rotation lerped 0.05; auto-rotation y += 0.18·delta.
   - Canvas: camera [0,0,5.2] fov 50, dpr [1, 1.6], alpha+antialias, ambient light 0.9.
   - 'use client' directive at top.

3. components/landing/Hero3D.tsx — copy the Hero3D pattern from 3D_frontend.md §4. Key points:
   - `dynamic(() => import('@/components/HolographicCanvas'), { ssr: false, loading: white div })`.
   - <section> bg-canvas with a 88vh / min-640 stage; HolographicCanvas absolute inset-0.
   - Top-left z-20 status row: cyan dot-blink + uppercase tracking-[0.2em] meta (LIVE / Q-marker).
   - Top-right meta cluster (locale, next drop date) — hidden on mobile.
   - Bottom-left z-10 headline block: 11px uppercase eyebrow, then font-display headline at clamp(56px, 9.2vw, 132px) leading-[0.85], ending with an inline ArrowUpRight at 0.7em.
   - CTA row: <PillButton variant="outline-image"> + <PillButton variant="ghost"> with backdrop-blur.
   - Bottom-right cohort counter: tiny eyebrow + .font-display tabular 5xl number + sublabel.
   - Vietnamese copy WITH proper diacritics (the prototype has encoding errors — fix them: "Bước Vào Không Gian Tri Thức Tương Lai", "Khám Phá Ngay", "Xem Chi Tiết Hệ Thống", "Sinh viên / 24 trường").

4. Verify import path `@/components/...` resolves via tsconfig paths.

Acceptance: visit / → 3D core spins, mouse-move tilts the group, rings orbit, headline burns into the page; no SSR hydration warning; Lighthouse perf still ≥80 on desktop.
```

---

## Phase 1 — Auth

### P1.1 — Better-Auth setup + RBAC primitives

```
Read blueprint/specs/auth.md.

1. modules/auth/domain/Role.ts — `enum Role { STUDENT, ORGANIZER, CHECKIN_STAFF }` (string enum matching Prisma).
2. modules/auth/domain/Permission.ts — map Permission -> Role[]; export `can(role, permission)` and a typed Permission union.
3. lib/auth.ts — configure betterAuth with prismaAdapter, emailAndPassword enabled, session expiresIn 7d, cookie { httpOnly, secure (prod), sameSite: 'lax' }, customSession to include `role`, `studentId`.
4. app/api/auth/[...all]/route.ts — Better-Auth handler.
5. lib/session.ts — server helper `getSession()` (reads cookies, looks up session, caches in Redis 60s), `requireAuth()`, `requireRole(role)`.

Acceptance: POST /api/auth/sign-up/email creates a User + Session row; GET /api/auth/get-session returns role.
```

### P1.2 — Middleware (3-layer RBAC layer 1)

```
Read blueprint/specs/auth.md.

Implement proxy.ts at project root (Next.js 16 middleware):
- Public routes pass through: GET /, /workshops, /workshops/:id, /api/workshops (GET only), /login, /signup, /api/auth/*, /_next/*, static files.
- Read better-auth session cookie. Redis-cache lookup (key `session:<token>`, TTL 60s).
- No session on protected route → redirect /login (web) or 401 (api).
- Role gates:
  /admin/*, /api/admin/*       → ORGANIZER
  /scan, /api/checkins/*       → CHECKIN_STAFF
  /my-registrations, POST /api/registrations → STUDENT
- Sai role → 403.
- Rate-limit /api/auth/sign-in/email: 5/15min/IP via Upstash Ratelimit (token bucket). 429 on excess.

Acceptance: curl with no cookie to /admin redirects to /login; STUDENT cookie to /admin returns 403.
```

### P1.3 — Login + Signup pages (Network canvas bg)

```
Refer 3D_frontend.md §8 (AuthPage row) — auth pages use a 2D NetworkCanvas behind the form, not the 3D holographic core.

1. components/auth/NetworkCanvas.tsx — 'use client'. <canvas> filling parent. RequestAnimationFrame loop draws ~60 nodes drifting on a 2D plane; connect any two within distance 140px with a 1px hairline `rgba(17,17,17,0.18)` line; nodes are 2px filled #111111 dots. Use refs + cleanup. Pause when document.hidden.

2. app/(auth)/layout.tsx — full-bleed white. Children render centered max-w-[440px] with NetworkCanvas absolute inset-0 z-0 (pointer-events-none) and the form z-10.

3. app/(auth)/signin/page.tsx — Bebas eyebrow "UNIHUB / ACCESS" 11px uppercase tracking-[0.25em]; .font-display 48px headline "Đăng Nhập"; Inter form (email + password) using ShadcnUI Form + Zod, inputs with .hairline border + rounded-md 24px; submit = <PillButton variant="primary">Tiếp Tục <ArrowRight/></PillButton>; small link below to /signup. On submit: authClient.signIn.email → redirect by role (STUDENT→/workshops, ORGANIZER→/admin/dashboard, CHECKIN_STAFF→/scan).

4. app/(auth)/signup/page.tsx — same skeleton, headline "Tạo Tài Khoản"; default role STUDENT.

5. lib/auth-client.ts — createAuthClient. sonner Toaster mounted in root layout for errors.

6. Add `<GoogleMark/> <GitHubMark/>` icon row beneath form (lucide), purely visual placeholders (Better-Auth social can be added later).

Acceptance: NetworkCanvas animates at 60fps and pauses on tab hide; signup → auto-login → redirect works; brute-force returns 429 after 5 tries.
```

---

## Phase 2 — Workshop Module

### P2.1 — Domain + Application

```
Read blueprint/design.md §4-§5 and blueprint/specs/registration.md (for the Workshop side of seat invariants).

1. modules/workshop/domain/Workshop.ts — Entity with: id, title, description, speaker, room, roomMapUrl, date, startTime, endTime, maxCapacity, currentRegistrations, version, price, status, aiSummary, aiSummaryStatus, pdfUrl. Methods: `isAvailable()`, `cancel()`, `attemptReserveOne()` (returns new version+1 patch), `releaseOne()`.
2. modules/workshop/domain/IWorkshopRepository.ts — findById, findActiveByDate, listPaginated({ filters, page, size }), update(workshop, expectedVersion) returning boolean (false on optimistic-lock failure), create, softDelete.
3. modules/workshop/domain/events/WorkshopCancelledEvent.ts, WorkshopUpdatedEvent.ts.
4. modules/workshop/application/WorkshopService.ts — list(filters), getById(id), createWorkshop(input, organizerId), updateWorkshop(id, patch), cancelWorkshop(id) (publishes event).

Acceptance: `npx tsc --noEmit` passes; no import from infrastructure inside domain/application except interfaces.
```

### P2.2 — Infrastructure + Caching decorator

```
1. modules/workshop/infrastructure/PrismaWorkshopRepository.ts — implements IWorkshopRepository. The `update` method runs:
   UPDATE "Workshop" SET ..., version = version + 1
   WHERE id = $1 AND version = $expectedVersion AND current_registrations <= max_capacity
   returning affected_rows. Convert Prisma rows ↔ domain entities via a mapper.

2. modules/workshop/infrastructure/CachedWorkshopRepository.ts — Decorator wrapping any IWorkshopRepository. Uses Redis: `workshop:<id>` (TTL 60s) for findById; invalidate on update/cancel. listActiveByDate cached as `workshops:date:<yyyy-mm-dd>`.

3. Wire both into shared/infrastructure/Container.ts: `container.workshopRepository = new CachedWorkshopRepository(new PrismaWorkshopRepository(prisma), redis)`.

Acceptance: hitting findById twice → only 1 SQL query (verify via Prisma log).
```

### P2.3 — Workshop API + Landing + List + Detail (Nike + 3D)

```
Read 3D_frontend.md §8–§9 for component split + workshop data shape.

1. app/api/workshops/route.ts — GET (?date, ?category, ?priceFilter, ?page). `export const revalidate = 60`. Returns `{ items, page, total }` where each item conforms to the Workshop shape in 3D_frontend.md §9: id, title, category, badge ("Just In"|"Coming Soon"|""), seatsTotal, seatsTaken, date, time, location, speaker, cover (image URL), price.

2. app/api/workshops/[id]/route.ts — GET single + seatsLeft. Update next.config.ts `images.remotePatterns` to allow `images.unsplash.com` for cover images.

3. components/landing/Nav.tsx — sticky top, h-14, bg-canvas, 1px hairline-bottom. Left: brand "UNIHUB" .font-display tracking-[0.04em]. Center: nav row (Workshop, Cộng đồng, Đối tác, Hỗ trợ) Inter body-strong; active item gets 2px ink underline. Right: SearchPill (rounded-md, bg-cloud) + NotificationBell + auth state (login link / user chip).

4. components/landing/SeatBar.tsx — horizontal hairline strip showing seatsTaken/seatsTotal as ratio fill in #111; right-aligned tabular "48 / 60 ghế".

5. components/landing/WorkshopCard.tsx — flat (rounded-none, no shadow):
   - Top: full-bleed cover img on bg-cloud, 4:5 portrait, lazy-loaded, with absolute top-left .badge-promo (badge-red for "Just In", badge-green for "Coming Soon").
   - Below image stack with 8px gap: category caption-md mute, title body-strong ink uppercase tracking-tight, speaker caption-md mute.
   - SeatBar.
   - Footer row: time + location caption-sm mute on left; price right (".font-display" if non-zero, else "Miễn phí" in emerald).
   - Whole card is a Link to /workshops/:id.

6. components/landing/WorkshopGrid.tsx — desktop 3-up, tablet 2-up, mobile 1-up; gap 8px (`{spacing.sm}`); section padding `{spacing.section}` 48px vertical.

7. components/landing/TechShowcase.tsx — dark editorial chapter. Bg #111, text-white, py-24. Left column: 96px Bebas headline "TECHNICAL INTEGRITY" / "ZERO OVERSELL"; right column: SVG system map (boxes for User, API, DB, Redis, VNPAY connected with 1px lines) + 3 stat tiles (uptime, capacity, response). Use framer-motion `whileInView` fade-up.

8. components/landing/EditorialCTA.tsx — full-bleed campaign tile. Choose a moody hero image as bg (Unsplash); .font-display 96px white headline "ĐĂNG KÝ NGAY HÔM NAY" burned in lower-left; <PillButton variant="outline-image"> CTA "Tạo Tài Khoản → /signup" anchored bottom-left.

9. app/page.tsx — landing composition: <Nav/> + <Hero3D/> + <section><WorkshopGrid items={featured}/></section> + marquee strip of past workshops (.marquee-track) + <TechShowcase/> + <EditorialCTA/> + <Footer/>. Use server component; fetch featured via revalidate=60.

10. app/(student)/workshops/page.tsx — full listing with filter chips (`{component.filter-chip}` + active variant per frontend-rule.md): "Tất cả", "Miễn phí", "Có phí", date filters. Server component, ISR 60.

11. app/(student)/workshops/[id]/page.tsx — Detail layout:
   - Hero: dark chapter (#111, text-white) with cover image as right-aligned 1:1 tile; left text block: badge, .font-display 64–96px title, speaker/date/room row.
   - Body: AI summary section (skeleton "Đang tạo tóm tắt..." if PROCESSING; FAILED message; rendered markdown when COMPLETED).
   - Sticky right rail (desktop) / bottom bar (mobile): SeatBar live, price, <PillButton variant="primary"> with state: "Đăng Ký Ngay" | "Hết Chỗ" (disabled) | "Bạn Đã Đăng Ký" (link to /my-registrations) | "Thanh Toán Tạm Ngưng" (when system status payment=degraded and price>0).
   - 1px hairline disclosure rows below: "Chi tiết workshop", "Phòng và bản đồ", "Liên hệ BTC" (PDP-disclosure pattern from frontend-rule.md).

12. components/Footer.tsx — bg-canvas, 1px hairline-top, 4 columns (Tài nguyên, Hỗ trợ, Về UniHub, Pháp lý), utility-xs fine-print bottom row.

13. SSE: app/api/workshops/[id]/seats/stream/route.ts — emit seatsLeft when Redis counter changes (5s poll fallback). Detail page's SeatBar subscribes to update live.

Acceptance: landing page hero spins; workshop grid renders 3-up with cover art and live seat bars; detail CTA reflects all four states; tabbing through CTAs respects the ink :focus-visible ring.
```

---

## Phase 3 — Registration Module

### P3.1 — Domain + SeatManager

```
Read blueprint/specs/registration.md.

1. modules/registration/domain/Registration.ts — Aggregate Root. Fields: id, userId, workshopId, status (PENDING|CONFIRMED|CANCELLED|PAYMENT_FAILED), qrCode, qrSignature, createdAt. Methods: confirm(), cancel(), markPaymentFailed(), generateQR(secret).
2. modules/registration/domain/QRTicket.ts — Value Object. Builder: `QRTicket.issue(registrationId, secret)` returns { code, signature } where code = `UNIHUB-${id}-${ts}`, signature = HMAC-SHA256(code, secret).
3. modules/registration/domain/SeatManager.ts — Domain Service. Methods backed by Redis: `tryReserve(workshopId)` (DECR with floor at 0; returns boolean), `release(workshopId)` (INCR capped at max), `init(workshopId, capacity)`, `current(workshopId)`. Key: `seats:<workshopId>`.
4. modules/registration/domain/IRegistrationRepository.ts — findById, findByUserAndWorkshop, listByUser, listByWorkshop, create, update.
5. modules/registration/domain/events/RegistrationConfirmedEvent.ts, RegistrationCancelledEvent.ts.

Acceptance: tsc passes; SeatManager.tryReserve returns false at 0 even under concurrent calls (logical check via test).
```

### P3.2 — RegistrationService + IdempotencyService

```
Read blueprint/specs/registration.md and §7.3 of design.md.

1. modules/payment/application/IdempotencyService.ts (place here because shared by both registration & payment) — `runOnce(key, ttlHours, fn)`: lookup IdempotencyRecord; if exists & not expired → return stored response; else run fn, store JSON response, return.

2. modules/registration/application/RegistrationService.ts:
   register(userId, workshopId, idempotencyKey):
     a. idempotencyService.runOnce(key, 24, async () => { ... }):
        b. workshopRepo.findById; throw NotFound or Conflict("WORKSHOP_FULL") if !isAvailable.
        c. registrationRepo.findByUserAndWorkshop → Conflict("ALREADY_REGISTERED").
        d. seatManager.tryReserve(workshopId) → Conflict("WORKSHOP_FULL") if false.
        e. prisma.$transaction:
           - workshopRepo.update with optimistic lock (++currentRegistrations, ++version). If false: seatManager.release & throw Conflict.
           - For free workshop: registrationRepo.create({status:CONFIRMED}) + generateQR(QR_HMAC_SECRET) + update.
           - For paid: registrationRepo.create({status:PENDING}); also create Payment row PENDING with idempotencyKey.
        f. EventBus.publish(RegistrationConfirmedEvent) [free] OR return paymentUrl from PaymentService.initiatePayment [paid].
        g. Return { registrationId, status, qrCode? , paymentUrl? }.

   cancel(userId, registrationId):
     - Verify ownership. If CONFIRMED/PENDING → cancel + seatManager.release + workshopRepo.update(currentRegistrations-1) + publish event.

3. Cron handler: app/api/cron/registrations-cleanup/route.ts — verify `Authorization: Bearer ${CRON_SECRET}` header. Selects PENDING > 30min, cancels them, releases seats. Triggered by cron-job.org every 5 min (NOT vercel.json — Vercel Hobby free tier does not support sub-daily cron schedules). Configure cron-job.org to call GET `https://<domain>/api/cron/registrations-cleanup` with header `Authorization: Bearer <CRON_SECRET>`.

Acceptance: tsc passes; concurrent test (script in scripts/load-test.ts) firing 100 register calls for capacity=60 yields exactly 60 CONFIRMED rows.
```

### P3.3 — Registration API + Boarding Pass dashboard

```
Refer 3D_frontend.md §8 (BoardingPass + Dashboard).

1. app/api/registrations/route.ts:
   - POST { workshopId, idempotencyKey } → RegistrationService.register. Headers must include X-Idempotency-Key (fallback to body).
   - GET → STUDENT: own list; ORGANIZER: all (?workshopId filter).
   Wrap with toResponse(err).

2. app/api/registrations/[id]/route.ts — DELETE (cancel).

3. lib/qr.ts — `useQRDataUrl(payload)` client hook: useEffect → qrcode.toDataURL(payload, { errorCorrectionLevel: 'H', margin: 0, width: 320, color: { dark: '#111111', light: '#00000000' } }) → returns dataUrl.

4. components/dashboard/BoardingPass.tsx — flat card (rounded-none, hairline border) styled like an airline boarding pass:
   - Top bar: brand "UNIHUB / BOARDING" .font-display + status badge (badge-green CONFIRMED / hairline PENDING / badge-red CANCELLED).
   - Left section (60%): workshop title .font-display 32px uppercase, speaker, date+time tabular, location.
   - Right section (40%, dashed-hairline left border): QR image 160px on bg-cloud, JetBrains Mono caption "REG-{id.slice(-6)}".
   - Hover: framer-motion scale 1.005 + reveals "Tap to enlarge" caption.
   - Click → opens shadcn Dialog with QR enlarged 320px + "Hủy đăng ký" PillButton (only when cancellable).

5. app/(student)/my-registrations/page.tsx — server component:
   - Eyebrow uppercase "MY DROPS / Cohort {year}", .font-display 64px headline "Vé Của Bạn".
   - Stack of <BoardingPass> per registration; group by upcoming/past with .hairline divider sections.
   - Empty state: dashed hairline panel + link "Khám phá workshop".

6. components/registration/RegisterDrawer.tsx — drawer (vaul) opened from workshop detail CTA. Shows confirmation summary, idempotency key debug, then PillButton "Xác Nhận" → POSTs to /api/registrations → on success: free → toast + redirect /my-registrations; paid → redirect to paymentUrl.

Acceptance: register a free workshop → /my-registrations shows BoardingPass with scannable QR; second register attempt → drawer surfaces 409 toast "Bạn đã đăng ký workshop này"; cancel removes pass with framer-motion exit.
```

---

## Phase 4 — Payment Module

### P4.1 — Domain + Strategy

```
Read blueprint/specs/payment.md.

1. modules/payment/domain/Payment.ts — Entity: id, registrationId, amount, idempotencyKey, vnpayTxnRef, status, paidAt. Methods: markSuccess(txnRef), markFailed(reason).
2. modules/payment/domain/IPaymentGateway.ts — interface { createPaymentUrl(input): Promise<string>; verifyCallback(params): boolean; queryStatus(txnRef): Promise<'SUCCESS'|'FAILED'|'PENDING'> }.
3. modules/payment/domain/IPaymentRepository.ts.
4. modules/payment/domain/events/PaymentSucceededEvent.ts, PaymentFailedEvent.ts.
```

### P4.2 — VNPayGateway + CircuitBreaker decorator

```
1. modules/payment/infrastructure/VNPayGateway.ts — implements IPaymentGateway:
   createPaymentUrl: build params per VNPAY spec (vnp_Version=2.1.0, vnp_Command=pay, vnp_TmnCode, vnp_Amount=amount*100, vnp_CurrCode=VND, vnp_TxnRef=paymentId, vnp_OrderInfo, vnp_Locale=vn, vnp_ReturnUrl, vnp_IpAddr, vnp_CreateDate). Sort params, sign HMAC-SHA512 with VNPAY_HASH_SECRET → vnp_SecureHash. Return full URL.
   verifyCallback: pull vnp_SecureHash, recompute HMAC-SHA512 over remaining sorted params, timing-safe compare.
   queryStatus: call VNPAY Transaction Query API.

2. modules/payment/infrastructure/PaymentGatewayCircuitBreaker.ts — decorator implementing IPaymentGateway. State in Redis `circuit:vnpay`. CLOSED → if 5 failures in 60s → OPEN; OPEN → reject for 30s → HALF_OPEN; HALF_OPEN probe → CLOSED on success / OPEN on fail. Throw ServiceUnavailableError when OPEN.

3. Wire into Container: container.paymentGateway = new PaymentGatewayCircuitBreaker(new VNPayGateway(env), redis).
```

### P4.3 — PaymentService + API + result page

```
1. modules/payment/application/PaymentService.ts:
   initiatePayment(registrationId, amount, idempotencyKey):
     - circuitBreaker check (gateway throws if OPEN).
     - idempotencyService.runOnce(key, 24, async () => gateway.createPaymentUrl({...}))
     - Persist payment row if not yet (caller may have already created it).
     - Return paymentUrl.

   handleCallback(params):
     a. gateway.verifyCallback → if false return RspCode=97.
     b. payment = repo.findByVnpayTxnRef(params.vnp_TxnRef); not found → 01.
     c. payment.status === SUCCESS → return 02 (idempotent).
     d. amount mismatch (params.vnp_Amount/100 !== payment.amount) → return 04 + alert.
     e. responseCode === '00' (success):
        DB transaction:
          payment.markSuccess(txnRef); repo.update.
          registration.confirm(); generate QR; registrationRepo.update.
        EventBus.publish(PaymentSucceededEvent). Return 00.
     f. else: markFailed; registration → PAYMENT_FAILED; seatManager.release; workshopRepo (-1); publish PaymentFailedEvent. Return 00.

   getStatus(vnpayTxnRef): for client polling.

2. app/api/payments/route.ts — POST { registrationId } (re-initiate if PENDING).
3. app/api/payments/vnpay-callback/route.ts — POST handler; ALWAYS HTTP 200 with `RspCode=...&Message=...`.
4. app/api/payments/[txnRef]/status/route.ts — GET.
5. app/(student)/workshops/[id]/payment-result/page.tsx — client poll every 3s up to 2min; show result card; on success embed QRDisplay.
6. app/api/system/status/route.ts — GET returns { payment: state of circuit breaker, db: ok, redis: ok }.

7. Cron app/api/cron/payments-reconcile/route.ts — triggered by cron-job.org every 5 min (NOT vercel.json). Verify `Authorization: Bearer ${CRON_SECRET}`. PENDING > 10min → gateway.queryStatus → reconcile. Configure cron-job.org: GET `https://<domain>/api/cron/payments-reconcile`, header `Authorization: Bearer <CRON_SECRET>`.

Acceptance: VNPAY sandbox round-trip works; firing the callback twice doesn't change state past first SUCCESS; toggling 5 failures → /api/system/status reports `payment: degraded`; UI hides paid-register CTA in degraded mode.
```

---

## Phase 5 — Notifications

### P5.1 — Strategy + Service + Strategies

```
Read blueprint/specs/notification.md.

1. modules/notification/domain/INotificationStrategy.ts — { channel, send(payload) }.
2. modules/notification/domain/NotificationPayload.ts — discriminated union by `type`: REGISTRATION_CONFIRMED | PAYMENT_FAILED | WORKSHOP_CANCELLED | WORKSHOP_UPDATED | CHECKIN_REMINDER, each with typed `data`.
3. modules/notification/domain/INotificationLogRepository.ts.
4. modules/notification/application/NotificationService.ts — constructor(strategies[], logRepo). notify(payload): Promise.allSettled across strategies, log every result with status SENT/FAILED.
5. modules/notification/infrastructure/EmailNotificationStrategy.ts — Resend send. HTML template per type (use simple template literal or react-email if quick). Embed QR for REGISTRATION_CONFIRMED as inline data URL.
6. modules/notification/infrastructure/InAppNotificationStrategy.ts — INSERT NotificationLog with channel=IN_APP and a separate `notifications` rendered list (we reuse NotificationLog table — add columns title/body if missing OR add a new `Notification` table; choose one and migrate).
7. modules/notification/infrastructure/PrismaNotificationLogRepository.ts.

Acceptance: tsc passes; calling notify() with email-down stub → in-app still SENT, email FAILED, no thrown error.
```

### P5.2 — Async queue + EventBus wiring

```
1. bootstrap.ts at project root — exports `bootstrap()` that subscribes EventBus handlers (RegistrationConfirmed → enqueue notification job, etc.). Called once at module init via shared/infrastructure/Container.
2. app/api/queue/notifications/route.ts — POST handler invoked by QStash webhook. Call `verifyQStashSignature(req)` first (rejects with 401 if invalid). Parse body, call NotificationService.notify. Always return HTTP 200 (QStash retries on non-2xx).
3. shared/infrastructure/QStashClient.ts (already created in P0.2): use `enqueue('/api/queue/notifications', payload, { deduplicationId: userId+type+ts, retries: 3 })`.
4. Wire EventBus listeners in bootstrap to enqueue via QStashClient (NOT call NotificationService directly — keep it async).
5. WorkshopCancelledEvent handler: fetch all CONFIRMED registrations for workshopId → enqueue 1 job per user with QStash `delay` staggered at 1.2s intervals to stay within Resend 50 emails/min limit.
6. app/api/notifications/route.ts — GET unread for current user.
7. app/api/notifications/[id]/read/route.ts — PATCH.
8. components/NotificationBell.tsx — header bell with unread count (poll /api/notifications/unread-count every 30s).

Acceptance: register free workshop → email arrives within 60s in Resend test inbox; bell increments.
```

---

## Phase 6 — Check-in PWA

### P6.1 — Domain + Service

```
Read blueprint/specs/checkin.md.

1. modules/checkin/domain/Checkin.ts — Entity { id, registrationId, checkedInBy, checkedInAt, syncStatus, syncedAt, offlineDeviceId }.
2. modules/checkin/domain/QRVerifier.ts — `verify(code, signature, secret)`: timing-safe HMAC compare.
3. modules/checkin/domain/ScanQRCommand.ts — Command pattern: execute(qrPayload, staffUserId, workshopId, deviceId) — encapsulates verify + lookup + insert.
4. modules/checkin/domain/ICheckinRepository.ts.
5. modules/checkin/application/CheckinService.ts:
   - checkIn(staffId, registrationId, workshopId, deviceId): verify reg exists+CONFIRMED, workshop matches, no existing checkin → create (SYNCED).
   - syncBatch(staffId, records[]): per-record processing → returns { results: [{registrationId, status: synced|duplicate|invalid}] }. Idempotent on registrationId.
   - preload(staffId, date): returns { workshops, tickets (with qrCode), hmacKey: env.QR_HMAC_SECRET (server-side; sent only over HTTPS to authenticated CHECKIN_STAFF) }.

6. modules/checkin/infrastructure/PrismaCheckinRepository.ts.

Acceptance: tsc passes; check-in via service correctly rejects wrong workshop, duplicate, invalid HMAC.
```

### P6.2 — API + PWA shell

```
1. app/api/checkins/preload/route.ts — GET (CHECKIN_STAFF only).
2. app/api/checkins/route.ts — POST single.
3. app/api/checkins/sync/route.ts — POST batch.
4. public/manifest.json — name UniHub Scan, icons (use placeholder), display standalone, theme #000.
5. public/sw.js — Service Worker: cache app shell (`/scan`, JS chunks), passthrough API. Listen `online` event → postMessage clients to trigger sync.
6. app/(staff)/scan/layout.tsx — register sw + add manifest link.

Acceptance: Lighthouse PWA audit passes installability check.
```

### P6.3 — Scanner page + IndexedDB

```
1. lib/idb.ts — wrapper over `idb` (install): stores workshops, tickets, pendingCheckins, config.
2. components/checkin/CameraScanner.tsx — uses @zxing/browser; emits decoded payload string.
3. app/(staff)/scan/page.tsx — UI:
   - Top bar: online/offline indicator, pending count badge, "Sync now" button.
   - Workshop selector (from IDB).
   - "Preload" button → GET /api/checkins/preload → store in IDB + cache hmacKey.
   - Big scan button → opens CameraScanner.
   - On decode:
     decode JSON {registrationId, workshopId, studentId, signature}.
     if online: POST /api/checkins → toast result.
     if offline: QRVerifier.verify (Web Crypto subtle HMAC) using cached hmacKey; lookup IDB.tickets; validate; INSERT pendingCheckins; UPDATE ticket.checkedIn=true.
   - Auto-sync triggered by sw 'online' message: read pendingCheckins → POST /api/checkins/sync → reconcile IDB.
4. Use Web Crypto SubtleCrypto.importKey + sign for HMAC-SHA256 (same as server) — write a tiny helper lib/hmac.ts shared by client & server.

Acceptance: with devtools offline mode → scan still works in <200ms; toggling online triggers sync; reopening tab preserves pending checkins.
```

---

## Phase 7 — AI Summary

### P7.1 — Pipeline + worker

```
Read blueprint/specs/ai-summary.md.

1. modules/workshop/infrastructure/AISummaryPipeline.ts — Pipe-and-Filter:
   - PDFDownloadFilter: fetch(pdfUrl) → Buffer.
   - PDFExtractFilter: pdf-parse buffer → text; throw PDFEmptyError if empty; clean whitespace; truncate 4000 tokens.
   - GeminiSummarizeFilter: call @google/genai gemini-2.5-flash with the system+user prompt from spec.
   - Pipeline.run(pdfUrl) chains filters, returns summary string.

2. modules/workshop/application/AISummaryService.ts — processPDF(workshopId, pdfUrl): try pipeline; on success update workshop aiSummary+status=COMPLETED; on error update status=FAILED.

3. app/api/admin/workshops/[id]/upload-pdf/route.ts — POST multipart. Validate type/size. Upload to Vercel Blob. Update workshop pdfUrl + status=PROCESSING. Enqueue QStash job. Return 202.

4. app/api/queue/ai-summary/route.ts — QStash worker handler. Validate signature. Call AISummaryService.processPDF.

5. components/dashboard/AISummaryTerminal.tsx — JetBrains Mono terminal-style upload block (per 3D_frontend.md §8):
   - bg #111, text-white, p-6, rounded-none, with .terminal-cursor on the active line.
   - Lines logged: `> upload --workshop {id} --file {name}`, `> status: PROCESSING`, `> gemini: extracting…`, `> gemini: summarizing…`, `> done` / `> error: {reason}`.
   - File input is a custom drop zone with hairline dashed border; PillButton variant="ghost" "Chọn PDF".
   - While PROCESSING: poll /api/workshops/:id every 10s; append new log lines on status change.
   - Mount in admin /workshops/[id]/edit and on the public detail page below the AI summary card (read-only logs for organizer; hidden for student).

Acceptance: upload a 1-page text PDF → terminal logs PROCESSING immediately → COMPLETED within 60s with summary appearing on workshop detail; image-only PDF → terminal shows red "error: PDF không có text layer".
```

---

## Phase 8 — Admin & CSV Import

### P8.1 — Admin layout + Command-Center dashboard + Workshop CRUD

```
Refer 3D_frontend.md §8 (Dashboard) — admin = "command center" aesthetic.

1. app/(admin)/layout.tsx — split layout. Left fixed rail w-[220px] bg-cloud with brand "UNIHUB / OPS" .font-display + nav rows (Dashboard, Workshops, CSV Import, Thông báo, Hệ thống) — active row gets 1px ink underline. Right content area bg-canvas, p-12. 1px hairline divider between rail and content.

2. app/(admin)/dashboard/page.tsx — Command Center:
   - Top: 11px uppercase eyebrow "MISSION CONTROL / {today}" + .font-display 64px headline "Điều Hành".
   - 4-up stat grid (rounded-none flat tiles with hairline border, p-6): "Workshop hôm nay", "Đăng ký 24h", "Check-in đã sync", "Trạng thái VNPAY" (color-coded badge from /api/system/status).
   - Embed a small <HolographicCanvas/> in a 320px square panel as a "system pulse" widget (purely decorative).
   - Live activity feed: JetBrains Mono terminal block streaming SSE from /api/admin/activity (recent registrations, payments, check-ins). Use .terminal-cursor on last row.
   - Recent registrations table: hairline rows, no shadow, columns (Sinh viên, Workshop, Trạng thái badge, Thời gian tabular).

3. app/(admin)/workshops/page.tsx — same WorkshopCard grid but each card has hover overlay with "Sửa" + "Hủy" PillButtons (organizer-only). PillButton "Tạo workshop mới" pinned top-right.

4. app/(admin)/workshops/new/page.tsx — form in 2-column layout: left .font-display eyebrow + section description; right form fields (title, description Textarea, speaker, room, roomMapUrl, date Calendar, startTime/endTime TimePicker, maxCapacity, price, cover URL). Submit = PillButton "Tạo Workshop".

5. app/(admin)/workshops/[id]/edit/page.tsx — same form prefilled + AISummaryTerminal (PDF upload) + destructive section bottom: hairline-top, badge-red eyebrow "DANGER ZONE", PillButton "Hủy Workshop" with confirm Dialog (lists # affected registrations).

6. app/api/admin/workshops/route.ts — POST/GET; app/api/admin/workshops/[id]/route.ts — PATCH/DELETE (soft cancel); on DELETE publish WorkshopCancelledEvent.

7. app/api/admin/activity/route.ts — SSE stream of recent events for the dashboard terminal (last 50 events from EventBus log table or in-memory ring buffer).

Acceptance: organizer logs in → command center renders 3D pulse, 4 stats, live terminal; create → list → edit → cancel → all confirmed students receive notification within 60s.
```

### P8.2 — CSV import

```
Read blueprint/specs/csv-import.md.

1. modules/csv-import/application/BaseImportJob.ts — abstract Template Method:
   run(filename): readRows() → for each: validateRow + processRow (catch per-row, count). emit CsvImportLog at end.
2. modules/csv-import/application/StudentCSVImportJob.ts — concrete:
   - readRows: csv-parser stream with BOM, validate header [student_id,name,email].
   - validateRow: regex student_id /^\d{8}$/, email zod, name non-empty.
   - processRow: prisma.user.upsert by studentId (batched 100 via accumulator).
3. app/api/cron/csv-import/route.ts — GET (Vercel cron at 02:00). Scans data/csv-import/incoming/ → moves to processing → enqueues QStash job per file.
4. app/api/queue/csv-import/route.ts — QStash handler runs StudentCSVImportJob → moves file to processed/.
5. app/api/admin/csv-import/route.ts — POST manual trigger (file upload) → puts into incoming → enqueues. GET → list CsvImportLog.
6. app/(admin)/csv-import/page.tsx — file picker + history table + status badges.
7. vercel.json — cron entry for CSV import only (Vercel Hobby supports daily schedules): `{ "crons": [{ "path": "/api/cron/csv-import", "schedule": "0 2 * * *" }] }`. The other two crons (`registrations-cleanup`, `payments-reconcile`) run every 5 min via cron-job.org — configure each job with GET `https://<domain>/api/cron/<name>` and header `Authorization: Bearer <CRON_SECRET>`.

Acceptance: drop sample.csv with 10 valid + 2 invalid rows into incoming/ → manual trigger → log row shows totalRows=12, success=10, error=2; users upserted; file moved to processed/.
```

---

## Phase 9 — Hardening

### P9.1 — Rate limiting on hot endpoints

```
1. lib/ratelimit.ts — Upstash Ratelimit instances:
   - register: tokenBucket(refillRate=2/sec, capacity=10) keyed by ip+userId.
   - workshopsList: fixedWindow(30, '10 s') by ip.
   - login: slidingWindow(5, '15 m') by ip.
2. Apply in proxy.ts for /api/registrations (POST), in route handlers for fine grained limits.
3. On 429 set Retry-After header.

Acceptance: ab/k6 burst test → 429 starts after threshold; normal traffic unaffected.
```

### P9.2 — System status + degradation banner

```
1. app/api/system/status/route.ts — already created in P4.3; ensure: { payment: 'ok'|'degraded', ai: 'ok'|'degraded', email: 'ok'|'degraded' }.
2. components/SystemStatusBanner.tsx — client component, polls every 30s; when anything is degraded render a thin bg-ink text-canvas strip above <Nav/>: 11px uppercase tracking-[0.2em] meta with a `.dot-blink` red dot + "Thanh toán tạm thời không khả dụng. Workshop miễn phí vẫn hoạt động bình thường." Rounded none, 1px hairline-soft inset bottom.
3. Mount in app/layout.tsx above <main>.
4. WorkshopDetail CTA: when payment=degraded and price>0 → swap to disabled "Thanh Toán Tạm Ngưng" pill + small caption "Hệ thống đang hồi phục, thử lại sau {30}s".

Acceptance: simulate 5 VNPAY failures → red dot-blink banner appears across every page → paid CTA flips to disabled state; once breaker closes the banner disappears within 30s.
```

### P9.3 — Build + smoke test checklist

```
Run, in order, and fix anything red:
1. `npx prisma migrate deploy` against a fresh DB.
2. `npx prisma db seed`.
3. `npm run build` — zero errors, zero TS errors.
4. `npm run start`.
5. Manual smoke test:
   - Signup → login → list workshops → register free → see QR + email → cancel.
   - Login organizer → create paid workshop → list view shows new card.
   - Login student → register paid → VNPAY sandbox success → QR appears.
   - Toggle VNPAY env to invalid → 5 attempts → banner appears, free reg still works.
   - Login staff → /scan → preload → toggle offline → scan QR (use dev console to simulate decoded payload) → toggle online → sync.
   - Drop CSV in incoming/ → manual import → log shows result.
6. Lighthouse on /scan → PWA installable.

Done = every checkbox in every spec's "Tiêu chí chấp nhận" demonstrably passes.
```

---

## How to use this file

- Run prompts top-to-bottom; never skip ahead.
- After each prompt, manually verify its acceptance line before moving on. If it fails, fix in-place — don't accumulate debt.
- Keep prompts short: agents read the spec from `blueprint/specs/<name>.md` or `3D_frontend.md` directly. Do NOT paste spec contents into prompts (token waste).
- Whenever you change a Prisma model, run `prisma migrate dev` immediately.
- Re-run `npx tsc --noEmit` after every phase.

## Component map (where each piece from `3D_frontend.md` lives)

| 3D_frontend.md component | Created in | Used in |
|---|---|---|
| `HolographicCanvas` | P0.4 | Hero3D, /admin/dashboard pulse widget |
| `Hero3D` | P0.4 | / (landing) |
| `Nav` | P2.3 | All public + student routes |
| `WorkshopCard` + `SeatBar` + `WorkshopGrid` | P2.3 | / + /workshops + /admin/workshops |
| `TechShowcase` | P2.3 | / (landing dark chapter) |
| `EditorialCTA` | P2.3 | / (landing close) |
| `NetworkCanvas` + auth UI | P1.3 | /login + /signup |
| `BoardingPass` | P3.3 | /my-registrations |
| `AISummaryTerminal` | P7.1 | /admin/workshops/[id]/edit + workshop detail |
| `Dashboard` (Command Center) | P8.1 | /admin/dashboard |
| `pill-primary` / `pill-ghost` / `pill-outline-image` | P0.3 | Everywhere via `<PillButton/>` |
| `dot-blink` / `marquee-track` / `terminal-cursor` | P0.3 | Status banners, partner strip, terminals |
