# UniHub Workshop — Tài liệu tổng hợp dự án

---

## 1. Tổng quan dự án

**UniHub Workshop** là hệ thống quản lý đăng ký workshop cho "Tuần lễ kỹ năng và nghề nghiệp" tại trường đại học. Trước đây, toàn bộ quy trình được thực hiện thủ công qua Google Form (không giới hạn capacity, không xác thực sinh viên, check-in bằng danh sách giấy, thu tiền mặt tại chỗ). Hệ thống thay thế toàn bộ quy trình đó bằng nền tảng số hóa hỗ trợ 12.000 sinh viên đồng thời: đăng ký, thanh toán VNPAY, nhận QR vé tức thì, check-in offline-first, thông báo tự động, và AI tóm tắt nội dung từ PDF. Mục tiêu kỹ thuật: P95 < 500ms, zero oversell, check-in hoạt động 100% khi mất mạng.

---

## 2. Kiến trúc & Công nghệ

### Architectural Style

**Modular Monolith + Clean Architecture (4 tầng)**

- Chọn Monolith thay vì Microservices vì quy mô nhóm nhỏ (3-4 người), không cần operational overhead của phân tán (service discovery, network partition, distributed tracing).
- Modular: mỗi domain (workshop, registration, payment, checkin, notification, csv-import) đóng gói trong `modules/<name>/` với các tầng domain → application → infrastructure. Domain layer không import gì từ tầng ngoài.
- Deploy trên Vercel Serverless (stateless, timeout 60s) — không dùng công nghệ cần long-running process (BullMQ, WebSocket thuần).
- Async jobs qua QStash (HTTP-based queue) thay vì in-process queue vì phù hợp Serverless.

### Tech Stack

| Thành phần | Công nghệ | Lý do |
|---|---|---|
| Framework | Next.js 16 (App Router) | SSR/SSG/API Routes trong 1 project, Vercel-native |
| Database | Neon PostgreSQL (Prisma 7) | SQL cho consistency, ACID transactions, optimistic locking |
| Cache / Queue state | Upstash Redis | Serverless-compatible, atomic DECR cho seat counting, circuit breaker state |
| Async jobs | Upstash QStash | HTTP-based message queue, native Vercel, retries tự động |
| Auth | Better-Auth 1.6 | Session-based (revocable), không cần infrastructure riêng |
| Payment | VNPAY sandbox | Yêu cầu bài toán (sandbox, không tiền thật) |
| Email | Resend | 100 emails/ngày free tier, React Email templates |
| AI | Google Gemini 2.5 Flash | PDF summarization, tiếng Việt tốt |
| File storage | Vercel Blob | PDF upload, QR code images |
| Rate Limiting | Upstash Ratelimit | Token Bucket / Sliding Window tại Edge |
| UI | Tailwind v4 + shadcn/ui + Radix UI | Utility-first, accessible primitives |
| Animation | Framer Motion 12 | Micro-interactions, stagger, spring |
| 3D | Three.js + @react-three/fiber | Hero landing page |
| Offline storage | idb (IndexedDB) | Check-in PWA, survive app close |
| QR | @zxing/browser + qrcode | Scan và generate QR |
| Validation | Zod 4 | Runtime validation tại boundaries |
| Language | TypeScript strict | Type-safety end-to-end |

### Sơ đồ kiến trúc (text)

```
┌─────────────────────────────────────────────────────────────┐
│                    VERCEL EDGE (middleware)                  │
│           Auth check · Rate Limiting (Token Bucket)         │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                  NEXT.JS APP ROUTER                          │
│                                                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────────┐ │
│  │  (student) │  │  (admin)   │  │       (staff)          │ │
│  │ /workshops │  │  /admin/*  │  │       /scan            │ │
│  │ /profile   │  │            │  │                        │ │
│  └────────────┘  └────────────┘  └────────────────────────┘ │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                    API Routes                           │ │
│  │  /api/workshops  /api/registrations  /api/payments      │ │
│  │  /api/checkins   /api/notifications  /api/queue/*       │ │
│  │  /api/cron/*     /api/admin/*        /api/system/*      │ │
│  └─────────────────────────────────────────────────────────┘ │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                   MODULES (Domain Logic)                     │
│                                                              │
│  workshop   registration   payment   checkin   notification  │
│  csv-import               (shared: EventBus, Container)     │
└───────┬──────────┬─────────────────┬───────────────────────┘
        │          │                 │
┌───────▼──┐  ┌────▼──────┐  ┌──────▼──────┐
│  Neon    │  │  Upstash  │  │  Upstash    │
│ Postgres │  │   Redis   │  │   QStash    │
└──────────┘  └───────────┘  └─────────────┘
                                    │
                         ┌──────────▼──────────┐
                         │  /api/queue/         │
                         │  notifications       │
                         │  ai-summary          │
                         │  csv-import          │
                         └─────────────────────┘
```

---

## 3. Database

### Loại DB và lý do

**Neon PostgreSQL** (serverless Postgres, connection pooling qua `@prisma/adapter-pg`):
- SQL vì cần ACID transactions cho optimistic locking (không oversell).
- Neon: serverless-compatible, free tier đủ cho demo, không cần manage server.
- **Upstash Redis** cho real-time ops: seat counter (atomic DECR), circuit breaker state, rate limit buckets — không dùng Postgres cho những thứ này vì latency cao hơn và không atomic.

### Models

| Model | Mục đích | Constraints quan trọng |
|---|---|---|
| `User` | Tài khoản người dùng | `email @unique`, `studentId @unique`, `role` enum |
| `Session` | Better-Auth sessions (7 ngày TTL) | `token @unique`, index `userId` |
| `Account` | Credential provider (bcrypt) | `@@unique([providerId, accountId])` |
| `Verification` | Email OTP | index `identifier` |
| `Workshop` | Workshop entity | `version` (optimistic lock), index `[date, status]` |
| `Registration` | Đăng ký workshop | `@@unique([userId, workshopId])` — không đăng ký trùng |
| `Payment` | Giao dịch VNPAY | `registrationId @unique`, `idempotencyKey @unique`, `vnpayTxnRef @unique` |
| `IdempotencyRecord` | Cache deduplication | `key @id`, index `expiresAt` (24h TTL) |
| `Checkin` | Bản ghi check-in | `registrationId @unique` — không check-in 2 lần |
| `CsvImportLog` | Audit trail import CSV | `archived Boolean @default(false)` |
| `Notification` | Thông báo in-app | index `[userId, read]`, index `createdAt` |
| `NotificationLog` | Audit log kênh gửi | index `[userId, status]` |

### Enums

```
Role:               STUDENT | ORGANIZER | CHECKIN_STAFF
WorkshopStatus:     ACTIVE | CANCELLED | COMPLETED
AISummaryStatus:    NONE | PROCESSING | COMPLETED | FAILED
RegistrationStatus: PENDING | CONFIRMED | CANCELLED | PAYMENT_FAILED
PaymentStatus:      PENDING | SUCCESS | FAILED | REFUNDED
SyncStatus:         SYNCED | PENDING_SYNC
```

### Constraints quan trọng

- `Registration.@@unique([userId, workshopId])` — không cho phép đăng ký cùng workshop 2 lần ở DB level.
- `Payment.idempotencyKey @unique` + `Payment.vnpayTxnRef @unique` — 2 lớp chống trừ tiền trùng.
- `Checkin.registrationId @unique` — chỉ được check-in 1 lần per vé.
- `Workshop.version Int @default(0)` — optimistic locking counter.

---

## 4. Tính năng đã cài đặt

### 4.1 Xem & Đăng ký Workshop

**Mô tả:** Sinh viên xem danh sách workshop với filter (giá, ngày, search), xem chi tiết, đăng ký miễn phí (QR tức thì) hoặc có phí (redirect VNPAY).

**Files liên quan:**
- `app/(student)/workshops/page.tsx` — danh sách, filter, phân trang (12/trang)
- `app/(student)/workshops/[id]/page.tsx` — chi tiết workshop, trạng thái payment
- `components/landing/WorkshopCard.tsx` — card thiết kế lại (landscape 3:2, hover scale)
- `components/landing/WorkshopGrid.tsx` — grid + pagination
- `components/landing/Nav.tsx` — navigation + search bar
- `components/registration/RegisterCTA.tsx` — nút đăng ký, polling payment status
- `components/registration/RegisterDrawer.tsx` — drawer xác nhận đăng ký
- `app/api/registrations/route.ts` — POST tạo đăng ký
- `app/api/workshops/[id]/seats/stream/route.ts` — SSE real-time seat count
- `modules/registration/application/RegistrationService.ts`
- `modules/registration/domain/SeatManager.ts`

**Luồng xử lý (free):**
1. Sinh viên nhấn "Đăng ký" → `RegisterDrawer` confirm
2. POST `/api/registrations` với idempotency key
3. `RegistrationService` gọi `SeatManager.tryReserve()` (Redis DECR atomic)
4. Nếu còn chỗ: tạo `Registration(PENDING)` + QR code + HMAC signature trong DB
5. Cập nhật `Workshop.currentRegistrations` + `version` (optimistic lock)
6. Phát `RegistrationConfirmedEvent` → EventBus → bootstrap.ts → enqueue notification
7. Trả về `{ qrCode, status: 'CONFIRMED' }`

**Luồng xử lý (paid):**
1. Bước 1-5 như free, nhưng status `PENDING`
2. Tạo `Payment(PENDING)` với `idempotencyKey`
3. Gọi `PaymentService.createPaymentUrl()` qua CircuitBreaker
4. Redirect sinh viên đến VNPAY
5. VNPAY callback → `/api/payments/vnpay-callback` → verify HMAC → cập nhật `Payment(SUCCESS)` + `Registration(CONFIRMED)` → phát event

**Edge cases:**
- `SeatManager`: nếu DECR trả về < 0, rollback bằng INCR ngay lập tức
- `@@unique([userId, workshopId])` bắt duplicate ở DB level
- `idempotencyKey` ngăn retry tạo 2 payment record
- CircuitBreaker ngắt mạch nếu VNPAY down (5 failures/60s → OPEN 30s)

---

### 4.2 Thanh toán VNPAY

**Mô tả:** Tích hợp VNPAY sandbox, ký/xác thực HMAC-SHA512, circuit breaker, idempotency, reconciliation cron.

**Files liên quan:**
- `app/api/payments/route.ts` — tạo payment URL
- `app/api/payments/vnpay-callback/route.ts` — IPN callback từ VNPAY
- `app/api/payments/[txnRef]/status/route.ts` — query trạng thái
- `app/api/cron/payments-reconcile/route.ts` — reconciliation cron hàng giờ
- `modules/payment/application/PaymentService.ts`
- `modules/payment/application/IdempotencyService.ts`
- `modules/payment/infrastructure/VNPayGateway.ts`
- `modules/payment/infrastructure/PaymentGatewayCircuitBreaker.ts`
- `lib/hmac.ts` — HMAC-SHA512 sign/verify
- `components/registration/RegisterCTA.tsx` — poll /api/system/status mỗi 30s

**Luồng xử lý:**
1. POST `/api/payments` → `IdempotencyService.runOnce(key, 24h, fn)` — nếu key đã tồn tại trả cache
2. `PaymentGatewayCircuitBreaker.createPaymentUrl()` → delegate hoặc throw nếu OPEN
3. `VNPayGateway` tạo URL có chữ ký HMAC-SHA512
4. Sinh viên redirect đến VNPAY, thanh toán
5. VNPAY gọi `/api/payments/vnpay-callback` (IPN)
6. Verify `vnp_SecureHash` bằng HMAC
7. Kiểm tra `vnpayTxnRef` đã xử lý chưa (idempotency)
8. Cập nhật `Payment.status` + `Registration.status`
9. Phát `PaymentSucceededEvent` hoặc `PaymentFailedEvent`

**Edge cases:**
- Signature mismatch → từ chối ngay
- Duplicate callback → `vnpayTxnRef @unique` bắt ở DB
- VNPAY timeout → CircuitBreaker đếm failure, mở sau 5 failures
- Missed IPN → reconciliation cron `/api/cron/payments-reconcile` query VNPAY status cho các payment PENDING > 15 phút

---

### 4.3 Thông báo (Email + In-App)

**Mô tả:** Strategy Pattern (Email + In-App), async qua QStash, deduplication, retry tự động.

**Files liên quan:**
- `bootstrap.ts` — wiring EventBus → QStash enqueue
- `app/api/queue/notifications/route.ts` — QStash webhook handler
- `modules/notification/application/NotificationService.ts`
- `modules/notification/infrastructure/EmailNotificationStrategy.ts`
- `modules/notification/infrastructure/InAppNotificationStrategy.ts`
- `app/api/notifications/route.ts` — GET danh sách thông báo
- `app/api/notifications/unread-count/route.ts` — GET count badge
- `app/api/notifications/[id]/read/route.ts` — PATCH đánh dấu đã đọc
- `app/api/notifications/read-all/route.ts` — PATCH đọc tất cả
- `components/NotificationBell.tsx` — UI dropdown với framer-motion

**Luồng xử lý:**
1. Domain event (e.g. `RegistrationConfirmedEvent`) phát qua `EventBus`
2. Handler trong `bootstrap.ts` lắng nghe, build `NotificationPayload`
3. Với `REGISTRATION_CONFIRMED`: tạo QR PNG → upload Vercel Blob → đính kèm URL vào payload
4. `enqueue(DEST, payload, { deduplicationId, retries: 3 })` → QStash queue
5. QStash gọi `/api/queue/notifications` (async, có retry)
6. `NotificationService.send()` dispatch qua tất cả strategies (Email + In-App)
7. `EmailNotificationStrategy`: gửi email HTML qua Resend
8. `InAppNotificationStrategy`: tạo `Notification` record trong DB
9. `NotificationBell` poll `/api/notifications/unread-count` mỗi 30s

**Events được xử lý:**
- `registration.confirmed` → Email + In-App với QR code
- `payment.failed` → Email + In-App
- `workshop.cancelled` → Email + In-App cho tất cả CONFIRMED registrations (stagger delay)
- `workshop.updated` → Email + In-App

---

### 4.4 Check-in (Online + Offline)

**Mô tả:** PWA offline-first. Staff quét QR → verify HMAC offline → lưu IndexedDB → sync khi có mạng.

**Files liên quan:**
- `app/(staff)/scan/page.tsx` — trang quét QR
- `components/checkin/CameraScanner.tsx` — camera + @zxing/browser
- `app/api/checkins/route.ts` — POST online check-in
- `app/api/checkins/preload/route.ts` — GET tải trước danh sách vé + HMAC key
- `app/api/checkins/sync/route.ts` — POST đồng bộ offline records
- `lib/idb.ts` — IndexedDB wrapper (idb library)
- `lib/qr.ts` — QR parse/generate
- `lib/hmac.ts` — HMAC-SHA256 verify
- `modules/checkin/application/CheckinService.ts`
- `modules/checkin/domain/QRVerifier.ts`
- `modules/checkin/domain/ScanQRCommand.ts`

**Luồng xử lý (online):**
1. Staff mở `/scan`, app gọi `GET /api/checkins/preload` → nhận workshops hôm nay + tất cả QR codes + HMAC key
2. Lưu vào IndexedDB (persistent qua reload/close)
3. Camera quét QR → `QRVerifier.verify(qrCode, qrSignature, hmacKey)` — check HMAC locally
4. Nếu valid: POST `/api/checkins` → `CheckinService.checkIn()` → kiểm tra `Checkin.registrationId @unique`
5. Trả về kết quả (success / duplicate / not found)

**Luồng xử lý (offline):**
1. Camera quét QR → `QRVerifier.verify()` bằng key đã preload → không cần network
2. Nếu valid: lưu `{ registrationId, checkedInAt, deviceId }` vào IndexedDB với `syncStatus: PENDING_SYNC`
3. App phát hiện network phục hồi → `POST /api/checkins/sync` với batch records
4. `CheckinService.syncBatch()`: verify lại từng record, check duplicate, upsert vào DB
5. Trả về per-record: `'synced' | 'duplicate' | 'invalid'`

**Edge cases:**
- 2 thiết bị quét cùng QR → `registrationId @unique` constraint ở DB bắt duplicate
- HMAC verify offline: không cần round-trip, không thể giả mạo QR
- IndexedDB persist qua app close/restart → không mất check-in khi tắt browser
- Preload chỉ lấy workshops hôm nay (filter `date`) để giữ payload nhỏ

---

### 4.5 AI Summary

**Mô tả:** Pipe-and-Filter: upload PDF → extract text → Gemini 2.5 Flash tóm tắt → lưu vào workshop.

**Files liên quan:**
- `app/api/admin/workshops/[id]/upload-pdf/route.ts` — nhận PDF, upload Blob, enqueue
- `app/api/queue/ai-summary/route.ts` — QStash webhook handler
- `modules/workshop/application/AISummaryService.ts`
- `modules/workshop/infrastructure/AISummaryPipeline.ts` — Pipe-and-Filter implementation
- `components/dashboard/AISummaryTerminal.tsx` — UI terminal-style hiển thị summary

**Luồng xử lý:**
1. Organizer upload PDF (max 10MB) từ trang edit workshop
2. `POST /api/admin/workshops/[id]/upload-pdf` → validate type/size → upload lên Vercel Blob → cập nhật `Workshop.aiSummaryStatus = PROCESSING` → enqueue QStash job
3. Trả về `202 Accepted` ngay
4. QStash gọi `/api/queue/ai-summary` (có retry 3 lần: 60s → 120s → 240s)
5. `AISummaryPipeline.run(pdfUrl)`:
   - `PDFDownloadFilter.run()` — fetch buffer từ Blob
   - `PDFExtractFilter.run()` — pdf-parse, strip repeated headers/footers, normalize whitespace, truncate 4000 tokens
   - `GeminiSummarizeFilter.run()` — gọi Gemini 2.5 Flash, system prompt tiếng Việt
6. Cập nhật `Workshop.aiSummary = result`, `aiSummaryStatus = COMPLETED`
7. Nếu lỗi: `aiSummaryStatus = FAILED` (organizer có thể nhập tay)

**Edge cases:**
- PDF scan ảnh (không có text layer) → `PDFEmptyError` → status `FAILED`
- Gemini trả về empty → `GeminiSummarizeError` → status `FAILED`, log để retry
- Repeated headers/footers → `stripRepeatedLines()` loại bỏ trước khi gửi Gemini

---

### 4.6 CSV Import

**Mô tả:** Đồng bộ dữ liệu sinh viên từ CSV legacy SIS. Template Method pattern, stream parsing, batch upsert, distributed lock.

**Files liên quan:**
- `app/api/cron/csv-import/route.ts` — Vercel Cron kích hoạt lúc 2AM
- `app/api/queue/csv-import/route.ts` — QStash webhook handler
- `app/(admin)/admin/csv-import/page.tsx` — trang quản lý logs, upload thủ công
- `app/api/admin/csv-import/route.ts` — GET logs, POST trigger thủ công
- `app/api/admin/csv-import/[id]/route.ts` — PATCH (archive/unarchive, xóa lỗi), DELETE
- `modules/csv-import/application/BaseImportJob.ts` — Template Method
- `modules/csv-import/application/StudentCSVImportJob.ts` — implementation cụ thể
- `modules/csv-import/infrastructure/PrismaImportLogRepository.ts`

**Luồng xử lý:**
1. Vercel Cron 2AM hoặc admin trigger thủ công → POST `/api/cron/csv-import`
2. Kiểm tra distributed lock (`Redis SET NX`) — nếu đang chạy thì skip
3. Enqueue QStash job → trả về `202` ngay
4. QStash gọi `/api/queue/csv-import` → `StudentCSVImportJob.run()`
5. `BaseImportJob` (Template Method):
   - `open()` — stream parse CSV (không load toàn bộ vào RAM)
   - `parseRow()` — validate từng dòng, build user object
   - Batch 100 rows → `prisma.user.upsert()` transaction
   - Skip bad rows (continue), không abort toàn bộ
6. `ImportReport`: totalRows, successCount, errorCount, duplicateCount, errorDetails (JSON)
7. Lưu `CsvImportLog` record

**Edge cases:**
- Concurrent import: Redis lock `SET NX` ngăn 2 job chạy song song
- Encoding: UTF-8 + BOM, fallback latin1
- Dòng lỗi (thiếu studentId, email trùng): skip + ghi vào `errorDetails`
- Admin có thể: archive/unarchive logs, xóa log, xóa từng error row hoặc xóa tất cả lỗi

---

### 4.7 Admin Dashboard

**Mô tả:** Trang quản trị cho ORGANIZER: quản lý workshop, xem thống kê, CSV import, thông báo hệ thống, system status.

**Files liên quan:**
- `app/(admin)/layout.tsx` — layout với sidebar + user panel + logout
- `app/(admin)/admin/dashboard/page.tsx` — thống kê tổng quan
- `app/(admin)/admin/workshops/page.tsx` — danh sách workshop
- `app/(admin)/admin/workshops/new/page.tsx` — tạo workshop mới
- `app/(admin)/admin/workshops/[id]/edit/page.tsx` — sửa workshop, upload PDF
- `app/(admin)/admin/csv-import/page.tsx` — logs import (Hoạt Động / Lưu Trữ tabs)
- `app/(admin)/admin/notifications/page.tsx` — broadcast thông báo
- `app/(admin)/admin/system/page.tsx` — circuit breaker status, system health
- `components/admin/NavRail.tsx` — sidebar navigation với icons
- `components/admin/AdminUserPanel.tsx` — user info + logout ở cuối sidebar
- `components/admin/WorkshopForm.tsx` — form tạo/sửa workshop
- `components/admin/ActivityFeed.tsx` — feed hoạt động gần đây
- `app/api/admin/activity/route.ts`
- `app/api/system/status/route.ts` — đọc circuit breaker state từ Redis
- `components/SystemStatusBanner.tsx` — banner cảnh báo khi payment degraded

---

## 5. Cơ chế bảo vệ hệ thống

### 5.1 Rate Limiting (Token Bucket + Sliding Window)

**Giải pháp đã chọn:** Upstash Ratelimit với nhiều thuật toán tùy endpoint.

| Endpoint | Thuật toán | Giới hạn | Key |
|---|---|---|---|
| `POST /api/registrations` | Token Bucket | 2 tokens/s refill, burst 10 | `ip:userId` |
| `GET /api/workshops` | Fixed Window | 30 req / 10s | `ip` |
| `POST /api/auth/login/email` | Sliding Window | 5 req / 15 phút | `ip` |

**Tại sao Token Bucket cho registration:**
- Token Bucket phù hợp hơn Fixed Window cho đăng ký vì cho phép burst hợp lý (10 token) nhưng rate refill có kiểm soát. Fixed Window có thể bị tấn công double-edge (cuối window + đầu window).
- Sliding Window cho login để chống brute force không bị bypass bằng cách đợi window reset.

**Trade-offs:** Rate limit key by IP bị ảnh hưởng nếu nhiều sinh viên dùng cùng IP (NAT của trường). Giải pháp: key by `ip:userId` cho registration để sinh viên không bị chặn do người khác.

**File implementation:** `lib/ratelimit.ts`, áp dụng trong các API route handler tương ứng.

---

### 5.2 Circuit Breaker (VNPAY)

**Giải pháp đã chọn:** Decorator pattern, state lưu trong Upstash Redis, 3 states: CLOSED → OPEN → HALF_OPEN.

**Thông số:**
- `FAILURE_THRESHOLD = 5` failures trong `FAILURE_WINDOW_MS = 60s` → chuyển OPEN
- `OPEN_TIMEOUT_MS = 30s` → chuyển HALF_OPEN (cho 1 probe qua)
- HALF_OPEN: nếu probe thành công → CLOSED (reset failures); nếu thất bại → OPEN lại

**Tại sao chọn:**
- Nếu không có circuit breaker, khi VNPAY timeout (30s), mỗi request treo đợi → thread pool cạn → cascade failure toàn hệ thống.
- Circuit breaker fail-fast: throw `ServiceUnavailableError` ngay, không chờ timeout.
- Các tính năng không liên quan (xem workshop, đăng ký miễn phí, check-in) vẫn hoạt động bình thường khi payment down.

**Trade-offs:** State trong Redis → nếu Redis down, circuit breaker không hoạt động (fallback về `defaultState()` = CLOSED). Chấp nhận được vì Upstash Redis uptime > 99.9%.

**File implementation:** `modules/payment/infrastructure/PaymentGatewayCircuitBreaker.ts`

---

### 5.3 Idempotency Key

**Giải pháp đã chọn:** Client-generated UUID làm idempotency key, lưu vào `IdempotencyRecord` table (24h TTL).

**Cơ chế:**
```
IdempotencyService.runOnce(key, ttlHours, fn):
  1. Tìm IdempotencyRecord với key này
  2. Nếu tồn tại và chưa expire → trả về response đã cache
  3. Nếu không → chạy fn(), lưu kết quả vào IdempotencyRecord
  4. Trả về kết quả
```

**Hai lớp bảo vệ:**
- `IdempotencyRecord` (layer 1): bắt duplicate request trong 24h
- `Payment.idempotencyKey @unique` + `Payment.vnpayTxnRef @unique` (layer 2): DB constraint bắt race condition nếu 2 request vào cùng lúc trước khi layer 1 ghi được

**Tại sao:**
- Network timeout khiến client retry → nếu không có idempotency, tạo 2 payment, trừ tiền 2 lần.
- Client-generated key: client tự generate UUID, gửi cùng mỗi request. Server dùng key này để dedup.

**Trade-offs:** `IdempotencyRecord` cần cleanup job (cron xóa records đã expire). Hiện tại dùng index trên `expiresAt` để query hiệu quả.

**File implementation:** `modules/payment/application/IdempotencyService.ts`

---

### 5.4 Optimistic Locking (Workshop Registration)

**Giải pháp đã chọn:** `Workshop.version` counter, tăng 1 mỗi lần cập nhật `currentRegistrations`. Kết hợp với Redis `SeatManager.tryReserve()`.

**Hai tầng:**

**Tầng 1 — Redis DECR (primary guard):**
```
tryReserve(workshopId):
  after = DECR seats:<workshopId>   // atomic
  if after < 0:
    INCR seats:<workshopId>         // rollback
    return false
  return true
```
- `DECR` là atomic trong Redis → 100 concurrent requests cho 1 slot cuối → chỉ 1 cái nhận `after >= 0`
- Rollback ngay lập tức nếu âm

**Tầng 2 — PostgreSQL version check (safety net):**
- `Workshop.version` tăng cùng với `currentRegistrations`
- Nếu Redis bị reset hoặc stale: DB constraint `maxCapacity >= currentRegistrations` làm safety net
- `SeatManager.initIfMissing()`: re-seed Redis nếu key không tồn tại hoặc stuck ở 0 (cold start edge case)

**Tại sao không dùng DB lock thuần:**
- `SELECT FOR UPDATE` tạo row lock → serialize tất cả registrations → latency cao khi 100 concurrent
- Redis DECR nhanh hơn (< 1ms) và không block các requests khác

**File implementation:** `modules/registration/domain/SeatManager.ts`, `modules/registration/application/RegistrationService.ts`

---

## 6. Phân quyền (RBAC)

### Ma trận quyền

| Tính năng | STUDENT | ORGANIZER | CHECKIN_STAFF | Public |
|---|---|---|---|---|
| Xem danh sách workshop | ✓ | ✓ | ✓ | ✓ |
| Xem chi tiết workshop | ✓ | ✓ | ✓ | ✓ |
| Đăng ký workshop | ✓ | — | — | — |
| Xem vé của mình | ✓ | — | — | — |
| Chỉnh sửa hồ sơ | ✓ | ✓ | ✓ | — |
| Tạo/sửa/huỷ workshop | — | ✓ | — | — |
| Xem admin dashboard | — | ✓ | — | — |
| CSV Import | — | ✓ | — | — |
| Broadcast notification | — | ✓ | — | — |
| Xem system status | — | ✓ | — | — |
| Quét QR check-in | — | — | ✓ | — |
| Sync offline check-in | — | — | ✓ | — |
| Preload vé hôm nay | — | — | ✓ | — |

### Kiểm tra quyền tại mỗi layer

**Layer 1 — Next.js Middleware (Vercel Edge):**
- Đọc session cookie, redirect nếu chưa đăng nhập
- Redirect theo role: ORGANIZER → `/admin`, CHECKIN_STAFF → `/scan`
- Block toàn bộ `/admin/*` nếu không phải ORGANIZER

**Layer 2 — Route Group Layout (Server Component):**
- `app/(admin)/layout.tsx`: `if (session.user.role !== 'ORGANIZER') redirect('/workshops')`
- `app/(staff)/scan/layout.tsx`: kiểm tra `CHECKIN_STAFF`

**Layer 3 — API Route Handler:**
- Mỗi API route gọi `requireAuth()` → kiểm tra session
- Kiểm tra role cụ thể: `if (session.user.role !== 'ORGANIZER') return 403`
- Ownership check: student chỉ được xem registrations của chính mình

---

## 7. Cách khởi chạy

### Prerequisites

- Node.js >= 20
- npm >= 10
- Tài khoản: Neon PostgreSQL, Upstash Redis, Upstash QStash, Resend, Vercel Blob, Google Cloud (Gemini API)

### Step-by-step setup

```bash
# 1. Clone và cài dependencies
git clone <repo>
cd jayce_workshop
npm install

# 2. Cấu hình environment variables
cp .env.example .env
# Điền các giá trị sau vào .env:
# DATABASE_URL=          (Neon connection string với pooler)
# UPSTASH_REDIS_REST_URL=
# UPSTASH_REDIS_REST_TOKEN=
# QSTASH_TOKEN=
# QSTASH_CURRENT_SIGNING_KEY=
# QSTASH_NEXT_SIGNING_KEY=
# BETTER_AUTH_SECRET=    (random string >= 32 chars)
# BETTER_AUTH_URL=       (e.g. http://localhost:3000)
# RESEND_API_KEY=
# BLOB_READ_WRITE_TOKEN= (Vercel Blob)
# GEMINI_API_KEY=
# QR_HMAC_SECRET=        (random string)
# VNPAY_TMN_CODE=        (VNPAY sandbox credentials)
# VNPAY_HASH_SECRET=
# CRON_SECRET=           (random string để bảo vệ cron endpoints)

# 3. Khởi tạo database
npx prisma migrate deploy
npx prisma generate

# 4. Seed dữ liệu mẫu
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts

# 5. Chạy dev server
npm run dev
# → http://localhost:3000

# 6. Build kiểm tra lỗi TypeScript
npm run build
npx tsc --noEmit
```

### Test accounts (sau khi seed)

Tất cả dùng password: **`password123`**

| Email | Role | Mô tả |
|---|---|---|
| `admin.organizer@unihub.edu.vn` | ORGANIZER | Truy cập `/admin` dashboard |
| `staff.one@unihub.edu.vn` | CHECKIN_STAFF | Truy cập `/scan` check-in |
| `staff.two@unihub.edu.vn` | CHECKIN_STAFF | Thiết bị thứ 2 cho test offline |
| `nguyen.van.a@unihub.edu.vn` | STUDENT | studentId: 22000001 |
| `tran.thi.b@unihub.edu.vn` | STUDENT | studentId: 22000002 |
| `le.van.c@unihub.edu.vn` | STUDENT | studentId: 22000003 |
| `pham.thi.d@unihub.edu.vn` | STUDENT | studentId: 22000004 |
| `hoang.van.e@unihub.edu.vn` | STUDENT | studentId: 22000005 |

Seed tạo sẵn:
- 6 workshops (3 free, 3 paid) với ngày trong tương lai
- 3 workshops **hôm nay** (để test check-in ngay)
- CONFIRMED registrations + QR codes cho tất cả students trên 3 workshops hôm nay

---

## 8. Cấu trúc thư mục

```
jayce_workshop/
├── app/
│   ├── (admin)/
│   │   ├── admin/
│   │   │   ├── csv-import/page.tsx
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── notifications/page.tsx
│   │   │   ├── system/page.tsx
│   │   │   └── workshops/
│   │   │       ├── [id]/edit/page.tsx
│   │   │       ├── new/page.tsx
│   │   │       └── page.tsx
│   │   └── layout.tsx
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── (staff)/
│   │   └── scan/page.tsx
│   ├── (student)/
│   │   ├── my-registrations/page.tsx
│   │   ├── profile/page.tsx
│   │   └── workshops/
│   │       ├── [id]/page.tsx
│   │       ├── [id]/payment-result/page.tsx
│   │       └── page.tsx
│   ├── api/
│   │   ├── admin/
│   │   │   ├── activity/route.ts
│   │   │   ├── csv-import/[id]/route.ts
│   │   │   ├── csv-import/route.ts
│   │   │   ├── notifications/route.ts
│   │   │   └── workshops/[id]/route.ts
│   │   ├── auth/[...all]/route.ts
│   │   ├── checkins/route.ts
│   │   ├── checkins/preload/route.ts
│   │   ├── checkins/sync/route.ts
│   │   ├── cron/
│   │   │   ├── csv-import/route.ts
│   │   │   ├── payments-reconcile/route.ts
│   │   │   └── registrations-cleanup/route.ts
│   │   ├── notifications/
│   │   │   ├── [id]/read/route.ts
│   │   │   ├── read-all/route.ts
│   │   │   ├── route.ts
│   │   │   └── unread-count/route.ts
│   │   ├── payments/
│   │   │   ├── [txnRef]/status/route.ts
│   │   │   ├── route.ts
│   │   │   └── vnpay-callback/route.ts
│   │   ├── queue/
│   │   │   ├── ai-summary/route.ts
│   │   │   ├── csv-import/route.ts
│   │   │   └── notifications/route.ts
│   │   ├── registrations/[id]/route.ts
│   │   ├── registrations/route.ts
│   │   ├── system/status/route.ts
│   │   └── workshops/[id]/seats/stream/route.ts
│   ├── layout.tsx
│   └── page.tsx
│
├── modules/
│   ├── auth/domain/{Permission.ts,Role.ts}
│   ├── checkin/
│   │   ├── domain/{Checkin.ts,QRVerifier.ts,ScanQRCommand.ts,SyncStatus.ts}
│   │   ├── application/CheckinService.ts
│   │   └── infrastructure/PrismaCheckinRepository.ts
│   ├── csv-import/
│   │   ├── domain/{ImportReport.ts,IImportJobRepository.ts}
│   │   ├── application/{BaseImportJob.ts,StudentCSVImportJob.ts}
│   │   └── infrastructure/PrismaImportLogRepository.ts
│   ├── notification/
│   │   ├── domain/{NotificationPayload.ts,INotificationStrategy.ts}
│   │   ├── application/NotificationService.ts
│   │   └── infrastructure/{EmailNotificationStrategy.ts,InAppNotificationStrategy.ts}
│   ├── payment/
│   │   ├── domain/{Payment.ts,PaymentStatus.ts,IPaymentGateway.ts}
│   │   ├── application/{PaymentService.ts,IdempotencyService.ts}
│   │   └── infrastructure/{VNPayGateway.ts,PaymentGatewayCircuitBreaker.ts}
│   ├── registration/
│   │   ├── domain/{Registration.ts,SeatManager.ts,QRTicket.ts}
│   │   ├── application/RegistrationService.ts
│   │   └── infrastructure/PrismaRegistrationRepository.ts
│   └── workshop/
│       ├── domain/{Workshop.ts,WorkshopStatus.ts,AISummaryStatus.ts}
│       ├── application/{WorkshopService.ts,AISummaryService.ts}
│       └── infrastructure/{AISummaryPipeline.ts,CachedWorkshopRepository.ts}
│
├── shared/
│   ├── domain/{Entity.ts,ValueObject.ts,DomainEvent.ts,IEventBus.ts}
│   ├── errors/{AppError.ts,handle.ts}
│   ├── infrastructure/
│   │   ├── Container.ts          ← Dependency Injection
│   │   ├── EventBus.ts           ← Observer (pub/sub)
│   │   ├── PrismaClient.ts       ← Singleton
│   │   ├── QStashClient.ts
│   │   └── RedisClient.ts
│   └── types/{workshop.ts,workshop-presenter.ts,registration.ts}
│
├── components/
│   ├── admin/{NavRail.tsx,AdminUserPanel.tsx,WorkshopForm.tsx,ActivityFeed.tsx}
│   ├── checkin/CameraScanner.tsx
│   ├── dashboard/{AISummaryTerminal.tsx,BoardingPass.tsx}
│   ├── landing/{Nav.tsx,WorkshopCard.tsx,WorkshopGrid.tsx,Hero3D.tsx,SeatBar.tsx}
│   ├── profile/ProfileClient.tsx
│   ├── registration/{RegisterCTA.tsx,RegisterDrawer.tsx,RegistrationListClient.tsx}
│   ├── ui/                       ← shadcn/ui components (~75 files)
│   ├── Footer.tsx
│   ├── NotificationBell.tsx
│   └── SystemStatusBanner.tsx
│
├── lib/
│   ├── auth.ts                   ← Better-Auth server config
│   ├── auth-client.ts            ← Better-Auth client
│   ├── hmac.ts                   ← HMAC-SHA256/SHA512
│   ├── idb.ts                    ← IndexedDB wrapper
│   ├── qr.ts                     ← QR generate/parse
│   ├── ratelimit.ts              ← Upstash Ratelimit config
│   ├── session.ts
│   └── utils.ts
│
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
│
├── bootstrap.ts                  ← EventBus wiring (domain events → QStash)
├── vercel.json                   ← Cron job schedule
├── AGENTS.md
└── blueprint/
    ├── proposal.md
    ├── design.md
    ├── frontend-rule.md
    └── specs/
        ├── ai-summary.md
        ├── auth.md
        ├── checkin.md
        ├── csv-import.md
        ├── notification.md
        ├── payment.md
        └── registration.md
```
