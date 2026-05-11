# Notification System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing EventBus → QStash → NotificationService pipeline so that domain events (registration confirmed, payment failed, workshop cancelled/updated) trigger async email + in-app notifications, and surface unread notifications in the Nav via a `NotificationBell` component.

**Architecture:** Approach A — `bootstrap.ts` is imported as a side-effect from the bottom of `shared/infrastructure/Container.ts`; every API route that imports Container automatically gets EventBus handlers registered in the same invocation before any `EventBus.publish()` call fires. Handlers enqueue jobs to QStash, which POSTs back to `/api/queue/notifications`; that webhook invokes `NotificationService.notify()` with email + in-app strategies.

**Tech Stack:** Next.js 16 App Router, Prisma 7 (Neon Postgres), Upstash QStash, Resend, `qrcode` npm package, Tailwind v4, ShadcnUI `Popover`.

> **Note:** This project has no test runner configured. TDD steps are replaced with `npx tsc --noEmit` (type-gate) after each task and a full `npm run build` at the end.

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `bootstrap.ts` | Subscribe EventBus handlers; enqueue QStash jobs |
| Modify | `shared/infrastructure/Container.ts` | Add `import '@/bootstrap'` side-effect |
| Create | `app/api/queue/notifications/route.ts` | QStash webhook — verify sig, call NotificationService |
| Create | `app/api/notifications/route.ts` | GET last 20 unread for current user |
| Create | `app/api/notifications/unread-count/route.ts` | GET unread count (polled by bell) |
| Create | `app/api/notifications/[id]/read/route.ts` | PATCH mark one notification read |
| Create | `components/NotificationBell.tsx` | Bell with badge; popover list; poll every 30 s |
| Modify | `components/landing/Nav.tsx` | Replace static Bell button with `<NotificationBell />` |

---

## Task 1: Create `bootstrap.ts`

**Files:**
- Create: `bootstrap.ts` (project root)

### What this does
Subscribes four EventBus handlers. Each handler fetches the data it needs from Postgres, builds a `NotificationPayload`, and calls `enqueue()` — it never calls `NotificationService` directly. The `RegistrationConfirmed` handler also generates a QR code data-URL via the `qrcode` package so the email template can embed it.

- [ ] **Step 1: Create the file**

```typescript
// bootstrap.ts
import QRCode from 'qrcode'
import { EventBus } from '@/shared/infrastructure/EventBus'
import { enqueue } from '@/shared/infrastructure/QStashClient'
import { db } from '@/shared/infrastructure/PrismaClient'
import type { RegistrationConfirmedEvent } from '@/modules/registration/domain/events/RegistrationConfirmedEvent'
import type { PaymentFailedEvent } from '@/modules/payment/domain/events/PaymentFailedEvent'
import type { WorkshopCancelledEvent } from '@/modules/workshop/domain/events/WorkshopCancelledEvent'
import type { WorkshopUpdatedEvent } from '@/modules/workshop/domain/events/WorkshopUpdatedEvent'
import type { NotificationPayload } from '@/modules/notification/domain/NotificationPayload'

const BASE_URL = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'
const DEST = `${BASE_URL}/api/queue/notifications`

function fmtDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

EventBus.subscribe<RegistrationConfirmedEvent>('registration.confirmed', async (event) => {
  const [workshop, user] = await Promise.all([
    db.workshop.findUnique({
      where: { id: event.workshopId },
      select: { title: true, date: true, room: true },
    }),
    db.user.findUnique({
      where: { id: event.userId },
      select: { email: true },
    }),
  ])
  if (!workshop || !user?.email) return

  const qrCodeDataUrl = await QRCode.toDataURL(event.qrCode, {
    errorCorrectionLevel: 'H',
    margin: 0,
    width: 320,
  })

  const payload: NotificationPayload = {
    type: 'REGISTRATION_CONFIRMED',
    userId: event.userId,
    userEmail: user.email,
    data: {
      workshopTitle: workshop.title,
      workshopDate: fmtDate(workshop.date),
      workshopRoom: workshop.room,
      qrCodeDataUrl,
    },
  }

  await enqueue(DEST, payload, {
    deduplicationId: `${event.userId}-REG_CONFIRMED-${event.registrationId}`,
    retries: 3,
  })
})

EventBus.subscribe<PaymentFailedEvent>('payment.failed', async (event) => {
  const registration = await db.registration.findUnique({
    where: { id: event.registrationId },
    include: {
      user: { select: { email: true } },
      workshop: { select: { title: true, date: true } },
    },
  })
  if (!registration?.user?.email) return

  const payload: NotificationPayload = {
    type: 'PAYMENT_FAILED',
    userId: registration.userId,
    userEmail: registration.user.email,
    data: {
      workshopTitle: registration.workshop.title,
      workshopDate: fmtDate(registration.workshop.date),
      reason: event.reason,
    },
  }

  await enqueue(DEST, payload, {
    deduplicationId: `${registration.userId}-PAY_FAILED-${event.paymentId}`,
    retries: 3,
  })
})

EventBus.subscribe<WorkshopCancelledEvent>('workshop.cancelled', async (event) => {
  const [workshop, registrations] = await Promise.all([
    db.workshop.findUnique({
      where: { id: event.workshopId },
      select: { date: true },
    }),
    db.registration.findMany({
      where: { workshopId: event.workshopId, status: 'CONFIRMED' },
      select: { userId: true, user: { select: { email: true } } },
    }),
  ])
  if (!workshop) return

  for (let i = 0; i < registrations.length; i++) {
    const reg = registrations[i]
    if (!reg.user?.email) continue

    const payload: NotificationPayload = {
      type: 'WORKSHOP_CANCELLED',
      userId: reg.userId,
      userEmail: reg.user.email,
      data: {
        workshopTitle: event.title,
        workshopDate: fmtDate(workshop.date),
      },
    }

    await enqueue(DEST, payload, {
      deduplicationId: `${reg.userId}-WS_CANCELLED-${event.workshopId}`,
      retries: 3,
      delay: i > 0 ? Math.round(i * 1.2) : undefined,
    })
  }
})

EventBus.subscribe<WorkshopUpdatedEvent>('workshop.updated', async (event) => {
  const [workshop, registrations] = await Promise.all([
    db.workshop.findUnique({
      where: { id: event.workshopId },
      select: { title: true },
    }),
    db.registration.findMany({
      where: { workshopId: event.workshopId, status: 'CONFIRMED' },
      select: { userId: true, user: { select: { email: true } } },
    }),
  ])
  if (!workshop) return

  const changes = event.updatedFields.join(', ')

  for (const reg of registrations) {
    if (!reg.user?.email) continue

    const payload: NotificationPayload = {
      type: 'WORKSHOP_UPDATED',
      userId: reg.userId,
      userEmail: reg.user.email,
      data: {
        workshopTitle: workshop.title,
        changes,
      },
    }

    await enqueue(DEST, payload, {
      deduplicationId: `${reg.userId}-WS_UPDATED-${event.workshopId}-${event.occurredAt.toISOString()}`,
      retries: 3,
    })
  }
})
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors. If you see `Property 'date' does not exist on type 'Workshop'` or similar, verify the Prisma schema has the field and run `npx prisma generate`.

- [ ] **Step 3: Commit**

```bash
git add bootstrap.ts
git commit -m "feat: bootstrap EventBus handlers — enqueue notification jobs via QStash"
```

---

## Task 2: Wire `bootstrap.ts` into `Container.ts`

**Files:**
- Modify: `shared/infrastructure/Container.ts`

The side-effect import at the bottom of `Container.ts` means every API route that imports `Container` (which is all of them that use services) will automatically register the EventBus handlers before any handler runs.

- [ ] **Step 1: Add the side-effect import to the imports block of `shared/infrastructure/Container.ts`**

Open `shared/infrastructure/Container.ts`. The current import block (lines 1–9) ends with:

```typescript
import { db } from './PrismaClient'
import { redis } from './RedisClient'
```

Add the bootstrap import directly after those two lines, **before** any executable statements:

```typescript
import { db } from './PrismaClient'
import { redis } from './RedisClient'
import '@/bootstrap'
```

`import` declarations must stay with the other imports (before executable code) to satisfy ESLint `import/first` rules. The declaration is still a module-level side-effect and runs once when the module is first loaded.

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add shared/infrastructure/Container.ts
git commit -m "feat: wire bootstrap into Container side-effect import"
```

---

## Task 3: QStash webhook route

**Files:**
- Create: `app/api/queue/notifications/route.ts`

`verifyQStashSignature` reads the request body via `req.text()`, which consumes the stream. To keep the original body readable, pass `req.clone()` to the verifier and read JSON from the original `req`.

- [ ] **Step 1: Create the directory and file**

```bash
mkdir -p app/api/queue/notifications
```

- [ ] **Step 2: Write the route**

```typescript
// app/api/queue/notifications/route.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyQStashSignature } from '@/shared/infrastructure/QStashClient'
import { db } from '@/shared/infrastructure/PrismaClient'
import { NotificationService } from '@/modules/notification/application/NotificationService'
import { EmailNotificationStrategy } from '@/modules/notification/infrastructure/EmailNotificationStrategy'
import { InAppNotificationStrategy } from '@/modules/notification/infrastructure/InAppNotificationStrategy'
import { PrismaNotificationLogRepository } from '@/modules/notification/infrastructure/PrismaNotificationLogRepository'
import type { NotificationPayload } from '@/modules/notification/domain/NotificationPayload'

function buildService() {
  return new NotificationService(
    [new EmailNotificationStrategy(), new InAppNotificationStrategy(db)],
    new PrismaNotificationLogRepository(db),
  )
}

export async function POST(req: NextRequest) {
  try {
    // Clone before verify so the original body stream is still readable
    await verifyQStashSignature(req.clone() as unknown as NextRequest)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = (await req.json()) as NotificationPayload
  await buildService().notify(payload)
  // Always 200 — QStash retries on non-2xx
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/queue/notifications/route.ts
git commit -m "feat: QStash webhook handler for notification jobs"
```

---

## Task 4: `GET /api/notifications` — unread list

**Files:**
- Create: `app/api/notifications/route.ts`

Returns the 20 most recent unread notifications for the authenticated user. Used by `NotificationBell` to populate the popover.

- [ ] **Step 1: Create the file**

```typescript
// app/api/notifications/route.ts
import { NextResponse } from 'next/server'
import { unstable_rethrow } from 'next/navigation'
import { db } from '@/shared/infrastructure/PrismaClient'
import { requireAuth } from '@/lib/session'
import { toResponse } from '@/shared/errors/handle'

export async function GET() {
  try {
    const session = await requireAuth()
    const notifications = await db.notification.findMany({
      where: { userId: session.user.id, read: false },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
    return NextResponse.json({ notifications })
  } catch (err) {
    unstable_rethrow(err)
    return toResponse(err)
  }
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/notifications/route.ts
git commit -m "feat: GET /api/notifications — unread list for current user"
```

---

## Task 5: `GET /api/notifications/unread-count`

**Files:**
- Create: `app/api/notifications/unread-count/route.ts`

Lightweight count endpoint. Polled every 30 s by `NotificationBell`.

- [ ] **Step 1: Create the directory and file**

```bash
mkdir -p app/api/notifications/unread-count
```

- [ ] **Step 2: Write the route**

```typescript
// app/api/notifications/unread-count/route.ts
import { NextResponse } from 'next/server'
import { unstable_rethrow } from 'next/navigation'
import { db } from '@/shared/infrastructure/PrismaClient'
import { requireAuth } from '@/lib/session'
import { toResponse } from '@/shared/errors/handle'

export async function GET() {
  try {
    const session = await requireAuth()
    const count = await db.notification.count({
      where: { userId: session.user.id, read: false },
    })
    return NextResponse.json({ count })
  } catch (err) {
    unstable_rethrow(err)
    return toResponse(err)
  }
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/notifications/unread-count/route.ts
git commit -m "feat: GET /api/notifications/unread-count for bell polling"
```

---

## Task 6: `PATCH /api/notifications/[id]/read`

**Files:**
- Create: `app/api/notifications/[id]/read/route.ts`

Marks a single notification as read. Uses `updateMany` with both `id` and `userId` to enforce ownership without a separate fetch-then-update.

- [ ] **Step 1: Create the directory and file**

```bash
mkdir -p "app/api/notifications/[id]/read"
```

- [ ] **Step 2: Write the route**

```typescript
// app/api/notifications/[id]/read/route.ts
import { NextResponse } from 'next/server'
import { unstable_rethrow } from 'next/navigation'
import { db } from '@/shared/infrastructure/PrismaClient'
import { requireAuth } from '@/lib/session'
import { toResponse } from '@/shared/errors/handle'

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth()
    const { id } = await params
    await db.notification.updateMany({
      where: { id, userId: session.user.id },
      data: { read: true },
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    unstable_rethrow(err)
    return toResponse(err)
  }
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "app/api/notifications/[id]/read/route.ts"
git commit -m "feat: PATCH /api/notifications/[id]/read"
```

---

## Task 7: `NotificationBell` component

**Files:**
- Create: `components/NotificationBell.tsx`

Client component. Polls `/api/notifications/unread-count` every 30 s for the badge count. On popover open, fetches `/api/notifications` for the unread list. Clicking `×` on a row calls PATCH and removes it from local state.

- [ ] **Step 1: Create the file**

```tsx
// components/NotificationBell.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface NotificationItem {
  id: string
  title: string
  body: string
  createdAt: string
}

export function NotificationBell() {
  const [count, setCount] = useState(0)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [open, setOpen] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchCount = async () => {
    try {
      const res = await fetch('/api/notifications/unread-count')
      if (res.ok) {
        const data = (await res.json()) as { count: number }
        setCount(data.count)
      }
    } catch {
      // silently ignore — bell degrades gracefully when offline
    }
  }

  const fetchItems = async () => {
    try {
      const res = await fetch('/api/notifications')
      if (res.ok) {
        const data = (await res.json()) as { notifications: NotificationItem[] }
        setItems(data.notifications)
      }
    } catch {}
  }

  useEffect(() => {
    fetchCount()
    timerRef.current = setInterval(fetchCount, 30_000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) fetchItems()
  }

  const markRead = async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' })
    setItems((prev) => prev.filter((n) => n.id !== id))
    setCount((prev) => Math.max(0, prev - 1))
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          aria-label="Thông báo"
          className="relative flex h-9 w-9 items-center justify-center rounded-full text-ink"
        >
          <Bell className="h-4 w-4" />
          {count > 0 && (
            <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-nikered text-[9px] font-bold text-white">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b border-hairline px-4 py-3">
          <p className="text-[13px] font-semibold text-ink">Thông báo</p>
        </div>
        {items.length === 0 ? (
          <p className="px-4 py-6 text-center text-[13px] text-ink/50">
            Không có thông báo mới
          </p>
        ) : (
          <ul>
            {items.map((n) => (
              <li
                key={n.id}
                className="flex items-start gap-2 border-b border-hairline px-4 py-3 last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="truncate text-[13px] font-semibold text-ink">
                    {n.title}
                  </p>
                  <p className="text-[12px] text-ink/60">{n.body}</p>
                </div>
                <button
                  onClick={() => markRead(n.id)}
                  className="mt-0.5 shrink-0 text-[16px] leading-none text-ink/40 hover:text-ink"
                  aria-label="Đánh dấu đã đọc"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/NotificationBell.tsx
git commit -m "feat: NotificationBell component with unread badge and popover"
```

---

## Task 8: Wire `NotificationBell` into `Nav.tsx`

**Files:**
- Modify: `components/landing/Nav.tsx`

Replace the static bell `<button>` (currently lines 64–69) with `<NotificationBell />`.

- [ ] **Step 1: Add the import at the top of `components/landing/Nav.tsx`**

After the existing imports, add:

```typescript
import { NotificationBell } from '@/components/NotificationBell'
```

- [ ] **Step 2: Replace the static bell button**

Remove these lines (currently 64–69):

```tsx
        <button
          aria-label="Thông báo"
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink"
        >
          <Bell className="h-4 w-4" />
        </button>
```

Replace with:

```tsx
        <NotificationBell />
```

- [ ] **Step 3: Remove the now-unused `Bell` import**

In `Nav.tsx`, the import line is:

```typescript
import { Bell, Search } from 'lucide-react'
```

Change it to:

```typescript
import { Search } from 'lucide-react'
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/landing/Nav.tsx
git commit -m "feat: replace static bell with NotificationBell in Nav"
```

---

## Task 9: Build verification

- [ ] **Step 1: Run the production build**

```bash
npm run build
```

Expected: no TypeScript errors, no build errors. The build output should list the new routes:
- `app/api/queue/notifications`
- `app/api/notifications`
- `app/api/notifications/unread-count`
- `app/api/notifications/[id]/read`

If the build fails with `'Bell' is defined but never used` or a Tailwind class not found, those are straightforward fixes (remove unused import, check class name spelling).

- [ ] **Step 2: Manual smoke test (local dev)**

```bash
npm run dev
```

1. Log in and register for a free workshop.
2. Within 60 s, check your Resend test inbox — the confirmation email with QR code should arrive.
3. Reload the page — the bell badge should show `1`.
4. Click the bell — the "Đăng ký thành công" notification appears in the popover.
5. Click `×` — the item disappears and the badge drops to `0`.

- [ ] **Step 3: Final commit if any build-fix changes were needed**

```bash
git add -p   # stage only build-fix changes
git commit -m "fix: address build errors in notification system"
```
