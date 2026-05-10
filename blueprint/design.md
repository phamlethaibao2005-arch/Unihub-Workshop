# UniHub Workshop — Technical Design

---

## 1. Kiến trúc tổng thể

### 1.1 Lựa chọn: Modular Monolith + Clean Architecture

Hệ thống được tổ chức theo kiến trúc **Modular Monolith** kết hợp **Clean Architecture** 4 tầng. Đây là lựa chọn phù hợp nhất với quy mô đồ án vì:

| Tiêu chí | Microservices | **Modular Monolith ✅** | Monolith thuần |
|---|---|---|---|
| Deployment | Nhiều service, cần Docker/K8s | 1 app Next.js trên Vercel | 1 app |
| Team size | 20+ người | **Nhóm sinh viên 3-4 người** | Bất kỳ |
| Debugging | Distributed tracing phức tạp | Stack trace thẳng | Stack trace thẳng |
| Scale sau | Native | Tách module → microservice dễ | Rất khó tách |
| Phù hợp KISS/YAGNI | ❌ Over-engineer | ✅ | ❌ Khó mở rộng |

**4 tầng Clean Architecture** — dependency chỉ đi một chiều từ ngoài vào trong:

```
┌────────────────────────────────────────────────────┐
│  Presentation (app/api/*)                          │
│  Next.js Route Handlers, Server Actions            │
├────────────────────────────────────────────────────┤
│  Application (modules/*/application/)              │
│  Use Cases, Application Services                   │
├────────────────────────────────────────────────────┤
│  Domain (modules/*/domain/)                        │
│  Entities, Value Objects, Interfaces, Events       │
├────────────────────────────────────────────────────┤
│  Infrastructure (modules/*/infrastructure/)        │
│  Prisma Repos, Redis, QStash, External APIs        │
└────────────────────────────────────────────────────┘
```

> **Quy tắc vàng:** Domain layer không được import bất kỳ thứ gì từ tầng trên.
> Application layer chỉ phụ thuộc vào interfaces (không biết Prisma tồn tại).

### 1.2 Cấu trúc thư mục dự án

```
unihub-workshop/
├── app/                              ← Next.js App Router (Presentation Layer)
│   ├── (student)/                   ← Route group: sinh viên
│   │   ├── workshops/               ← /workshops
│   │   │   ├── page.tsx             ← Danh sách workshop
│   │   │   └── [id]/
│   │   │       ├── page.tsx         ← Chi tiết workshop
│   │   │       └── payment-result/
│   │   │           └── page.tsx     ← Kết quả thanh toán
│   │   ├── my-registrations/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   │
│   ├── (admin)/                     ← Route group: ban tổ chức (ORGANIZER only)
│   │   ├── dashboard/
│   │   ├── workshops/
│   │   │   └── [id]/edit/
│   │   ├── csv-import/
│   │   └── layout.tsx
│   │
│   ├── (staff)/                     ← Route group: nhân sự check-in (CHECKIN_STAFF only)
│   │   ├── scan/
│   │   │   └── page.tsx             ← PWA QR scanner
│   │   └── layout.tsx
│   │
│   ├── api/                         ← API Route Handlers
│   │   ├── workshops/
│   │   │   ├── route.ts             ← GET /api/workshops
│   │   │   └── [id]/
│   │   │       ├── route.ts
│   │   │       └── upload-pdf/
│   │   │           └── route.ts
│   │   ├── registrations/
│   │   │   └── route.ts             ← POST /api/registrations
│   │   ├── payments/
│   │   │   ├── route.ts
│   │   │   └── vnpay-callback/
│   │   │       └── route.ts
│   │   ├── checkins/
│   │   │   ├── route.ts
│   │   │   ├── preload/
│   │   │   │   └── route.ts
│   │   │   └── sync/
│   │   │       └── route.ts
│   │   ├── admin/
│   │   │   ├── workshops/
│   │   │   │   └── route.ts
│   │   │   └── csv-import/
│   │   │       └── route.ts
│   │   └── system/
│   │       └── status/
│   │           └── route.ts         ← Health check + Circuit Breaker state
│   │
│   └── layout.tsx
│
├── modules/                         ← Domain Modules (không có src/)
│   │
│   ├── workshop/
│   │   ├── domain/
│   │   │   ├── Workshop.ts          ← Entity
│   │   │   ├── WorkshopStatus.ts    ← Enum
│   │   │   ├── AISummaryStatus.ts   ← Enum
│   │   │   ├── IWorkshopRepository.ts
│   │   │   └── events/
│   │   │       ├── WorkshopCancelledEvent.ts
│   │   │       └── WorkshopUpdatedEvent.ts
│   │   ├── application/
│   │   │   ├── WorkshopService.ts
│   │   │   └── AISummaryService.ts
│   │   └── infrastructure/
│   │       ├── PrismaWorkshopRepository.ts
│   │       ├── CachedWorkshopRepository.ts  ← Decorator
│   │       └── AISummaryPipeline.ts
│   │
│   ├── registration/
│   │   ├── domain/
│   │   │   ├── Registration.ts       ← Entity (Aggregate Root)
│   │   │   ├── QRTicket.ts           ← Value Object
│   │   │   ├── SeatManager.ts        ← Domain Service
│   │   │   ├── IRegistrationRepository.ts
│   │   │   └── events/
│   │   │       ├── RegistrationConfirmedEvent.ts
│   │   │       └── RegistrationCancelledEvent.ts
│   │   ├── application/
│   │   │   └── RegistrationService.ts
│   │   └── infrastructure/
│   │       └── PrismaRegistrationRepository.ts
│   │
│   ├── payment/
│   │   ├── domain/
│   │   │   ├── Payment.ts
│   │   │   ├── IPaymentGateway.ts    ← Strategy interface
│   │   │   ├── IPaymentRepository.ts
│   │   │   └── events/
│   │   │       ├── PaymentSucceededEvent.ts
│   │   │       └── PaymentFailedEvent.ts
│   │   ├── application/
│   │   │   ├── PaymentService.ts
│   │   │   └── IdempotencyService.ts
│   │   └── infrastructure/
│   │       ├── VNPayGateway.ts
│   │       ├── PaymentGatewayCircuitBreaker.ts  ← Decorator
│   │       └── PrismaPaymentRepository.ts
│   │
│   ├── checkin/
│   │   ├── domain/
│   │   │   ├── Checkin.ts
│   │   │   ├── QRVerifier.ts         ← Domain Service
│   │   │   ├── ScanQRCommand.ts      ← Command Pattern
│   │   │   └── ICheckinRepository.ts
│   │   ├── application/
│   │   │   ├── CheckinService.ts
│   │   │   └── OfflineSyncService.ts
│   │   └── infrastructure/
│   │       └── PrismaCheckinRepository.ts
│   │
│   ├── notification/
│   │   ├── domain/
│   │   │   ├── INotificationStrategy.ts  ← Strategy interface
│   │   │   ├── NotificationPayload.ts
│   │   │   └── INotificationLogRepository.ts
│   │   ├── application/
│   │   │   └── NotificationService.ts
│   │   └── infrastructure/
│   │       ├── EmailNotificationStrategy.ts
│   │       ├── InAppNotificationStrategy.ts
│   │       ├── TelegramNotificationStrategy.ts  ← thêm sau, không sửa gì khác
│   │       └── PrismaNotificationLogRepository.ts
│   │
│   ├── auth/
│   │   ├── domain/
│   │   │   ├── Role.ts               ← Enum: STUDENT | ORGANIZER | CHECKIN_STAFF
│   │   │   └── Permission.ts         ← Permission map per role
│   │   └── infrastructure/
│   │       └── BetterAuthAdapter.ts
│   │
│   └── csv-import/
│       ├── domain/
│       │   ├── ImportReport.ts
│       │   └── IImportJobRepository.ts
│       ├── application/
│       │   ├── BaseImportJob.ts       ← Template Method
│       │   └── StudentCSVImportJob.ts
│       └── infrastructure/
│           └── PrismaImportLogRepository.ts
│
├── shared/                          ← Code dùng chung, không thuộc module nào
│   ├── domain/
│   │   ├── Entity.ts                ← Base class
│   │   ├── ValueObject.ts           ← Base class
│   │   └── DomainEvent.ts           ← Base class
│   ├── infrastructure/
│   │   ├── PrismaClient.ts          ← Singleton Prisma instance
│   │   ├── RedisClient.ts           ← Singleton Redis instance
│   │   ├── EventBus.ts              ← Observer pattern
│   │   └── Container.ts             ← Dependency Injection wiring
│   └── errors/
│       └── AppError.ts
│
├── components/                      ← React UI components
│   ├── ui/                          ← ShadcnUI base components
│   ├── workshop/
│   ├── registration/
│   └── checkin/
│
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts                      ← Seed data
│
├── public/
│   ├── sw.js                        ← Service Worker (PWA)
│   └── manifest.json
│
├── data/                            ← CSV import working directories
│   └── csv-import/
│       ├── incoming/                ← Drop file vào đây
│       ├── processing/              ← Đang xử lý
│       └── processed/               ← Đã xử lý
│
├── proxy.ts                         ← Next.js middleware: Auth + Rate Limit
├── bootstrap.ts                     ← Event handler wiring (chạy 1 lần khi start)
├── vercel.json                      ← Cron jobs config
├── .env.example
└── README.md
```

---

## 2. C4 Diagram

### Level 1 — System Context

```
┌─────────────────────────────────────────────────────────────────────┐
│                         UniHub Workshop                              │
│              (Next.js Monorepo trên Vercel)                          │
└───────────────────────┬─────────────────────────────────────────────┘
           uses │                   │ uses              │ uses
                ▼                   ▼                   ▼
        ┌──────────┐      ┌─────────────────┐   ┌───────────────┐
        │ Sinh viên│      │  Ban tổ chức    │   │Nhân sự check-in│
        │ (Browser)│      │  (Admin Portal) │   │    (PWA)       │
        └──────────┘      └─────────────────┘   └───────────────┘

Hệ thống ngoài:
  ┌──────────────────────────────────────────────────────────────────┐
  │  VNPAY (Payment Gateway)    ← Thanh toán workshop có phí         │
  │  Gemini 2.5 Flash (AI API)  ← Tóm tắt PDF                       │
  │  SMTP / Resend (Email)      ← Gửi email thông báo               │
  │  Legacy SIS (CSV Export)    ← Đồng bộ dữ liệu sinh viên (1 chiều)│
  └──────────────────────────────────────────────────────────────────┘
```

### Level 2 — Container

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         UniHub Workshop System                                │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │              Next.js App (Vercel Serverless Functions)                   │ │
│  │                                                                          │ │
│  │   ┌─────────────────┐   ┌───────────────────┐   ┌──────────────────┐   │ │
│  │   │  Web App (SSR)  │   │   API Handlers    │   │  Cron Jobs       │   │ │
│  │   │  React + ShadcnUI│  │  Route Handlers   │   │  vercel.json     │   │ │
│  │   │  TailwindCSS    │   │  (REST endpoints) │   │  CSV sync 2AM    │   │ │
│  │   └────────┬────────┘   └────────┬──────────┘   └────────┬─────────┘   │ │
│  │            │                     │                        │              │ │
│  │   ┌────────▼─────────────────────▼────────────────────────▼──────────┐ │ │
│  │   │           Business Logic Layer (modules/)                         │ │ │
│  │   │  WorkshopService │ RegistrationService │ PaymentService           │ │ │
│  │   │  NotificationService │ CheckinService │ AISummaryService          │ │ │
│  │   └──────────────────────────┬────────────────────────────────────────┘ │ │
│  └─────────────────────────────-│───────────────────────────────────────────┘ │
│                                  │                                             │
│     ┌────────────────────────────┼──────────────────────────────────┐         │
│     │                            │                                   │         │
│  ┌──▼───────────────┐   ┌────────▼────────────┐   ┌────────────────▼───┐     │
│  │  Neon PostgreSQL  │   │  Upstash Redis      │   │  Upstash QStash    │     │
│  │  (Primary Store)  │   │  - Seat counters    │   │  (HTTP Job Queue)  │     │
│  │  Prisma ORM      │   │  - Session cache     │   │  - Notifications   │     │
│  │  - All entities   │   │  - Rate limit state  │   │  - AI jobs         │     │
│  │  - Audit logs     │   │  - Circuit Breaker   │   │  - CSV import      │     │
│  └──────────────────┘   └─────────────────────┘   └────────────────────┘     │
│                                                                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │            PWA (Progressive Web App) — Check-in Client                  │  │
│  │  Service Worker + IndexedDB                                              │  │
│  │  Offline-first: preload → scan → sync                                   │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Giao tiếp giữa containers:**

| Từ | Đến | Protocol |
|---|---|---|
| Next.js App | Neon PostgreSQL | TCP (Prisma + Connection Pooling) |
| Next.js App | Upstash Redis | HTTPS (Upstash REST SDK) |
| Next.js App | Upstash QStash | HTTPS (QStash REST API) |
| Next.js App | VNPAY | HTTPS (REST, HMAC-SHA512 signature) |
| Next.js App | Gemini AI | HTTPS (Google AI REST) |
| Next.js App | Resend/SMTP | HTTPS / SMTP |
| PWA | Next.js App | HTTPS (REST) / IndexedDB (offline) |
| Cron Job | Next.js App | HTTP (internal trigger) |

---

## 3. High-Level Architecture Diagram

```
                        ┌──────────────────────────────────┐
                        │     Vercel Edge Network           │
                        │  • CDN cache cho trang tĩnh       │
                        │  • Rate Limiting (Token Bucket)   │
                        │  • middleware.ts chạy ở edge      │
                        └──────────────┬───────────────────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              │                        │                        │
     ┌────────▼────────┐   ┌──────────▼──────────┐   ┌────────▼────────┐
     │  Đọc Workshop   │   │  Đăng ký + Thanh    │   │  Admin APIs      │
     │  (ISR Cache)    │   │  toán (Live)         │   │  (ORGANIZER)     │
     │  DB load ≈ 0    │   │                      │   │                  │
     └─────────────────┘   └──────────┬───────────┘   └─────────────────┘
                                      │
                        ┌─────────────▼──────────────┐
                        │     Application Layer        │
                        │                              │
                        │  RegistrationService         │
                        │    ├─ SeatManager (Redis)    │─────► Upstash Redis
                        │    │   DECR atomic           │       (seat counters)
                        │    └─ IdempotencyService     │
                        │                              │
                        │  PaymentService              │
                        │    └─ CircuitBreaker ────────┼──────► VNPAY
                        │         CLOSED/OPEN/         │
                        │         HALF_OPEN            │
                        │                              │
                        │  AISummaryService            │
                        │    └─ Pipeline ──────────────┼──────► Gemini API
                        │       PDFDownload            │
                        │       → Extract              │
                        │       → Summarize            │
                        └─────────────┬────────────────┘
                                      │
              ┌────────────┬──────────┴──────────┬────────────┐
              │            │                     │            │
     ┌────────▼───┐ ┌──────▼─────┐  ┌───────────▼──┐ ┌──────▼──────┐
     │   Neon     │ │  Upstash   │  │  Upstash     │ │  Vercel     │
     │ PostgreSQL │ │   Redis    │  │  QStash      │ │   Blob/S3   │
     │ (Source of │ │  (Fast     │  │  (Async HTTP │ │  (PDF       │
     │  truth)    │ │  ops)      │  │  job queue)  │ │  storage)   │
     └────────────┘ └────────────┘  └──────────────┘ └─────────────┘

  Check-in Offline Flow:
  ┌──────────┐   preload    ┌──────────┐   offline    ┌──────────────┐
  │  PWA     │ ──────────►  │IndexedDB │ ──scan─────► │ Local verify │
  │ (Staff)  │              │(Local DB)│              │ HMAC + lookup│
  └──────────┘              └──────────┘              └──────┬───────┘
       ▲                                                      │ online
       │                   sync batch                        ▼
       └──────────────────────────────────────── POST /api/checkins/sync

  CSV Import Flow (Legacy Integration):
  ┌──────────────┐  drop file  ┌────────────────┐  cron 2AM  ┌───────────────┐
  │ Legacy SIS   │ ──────────► │ /data/csv-     │ ─────────► │ StudentCSV    │
  │ (No API)     │             │  import/       │            │ ImportJob     │
  └──────────────┘             │  incoming/     │            │ (upsert batch)│
                               └────────────────┘            └───────┬───────┘
                                                                      │
                                                             Neon PostgreSQL
```

---

## 4. Thiết kế Cơ sở Dữ liệu

### 4.1 Lựa chọn: PostgreSQL (Neon Serverless)

**Lý do dùng SQL (PostgreSQL) thay vì NoSQL:**

| Yêu cầu | SQL ✅ | NoSQL |
|---|---|---|
| Không oversell chỗ ngồi | `CHECK (current_registrations <= max_capacity)`, ACID transaction | Khó enforce |
| Không trùng đăng ký | `UNIQUE(userId, workshopId)` | Cần app-level check |
| Idempotency payment | `UNIQUE(vnpayTxnRef)` | Cần 2-phase |
| Quan hệ phức tạp | JOIN workshop → registration → payment → checkin | Denormalize cồng kềnh |
| Audit trail | Timestamp trên mọi bảng | Phải tự implement |

**Neon Serverless PostgreSQL** được chọn vì Connection Pooler tích hợp sẵn — khi 12.000 sinh viên
tạo hàng vạn Serverless connections, Neon pooler gom chúng lại, bảo vệ DB khỏi bị sập.

**Redis (Upstash)** dùng song song cho:
- Đếm ghế ngồi (atomic `DECR`) — xử lý 100k ops/sec không cần chạm DB
- Cache session lookup — giảm DB query mỗi request
- Rate limit state — Token Bucket counter
- Circuit Breaker state — failure count + last failure time

### 4.2 Schema

```prisma
// ─────────────────────────────────────────────
// AUTHENTICATION (Better-Auth standard schema)
// ─────────────────────────────────────────────
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  emailVerified Boolean   @default(false)
  name          String
  image         String?
  studentId     String?   @unique        // Sync từ CSV legacy
  role          Role      @default(STUDENT)

  accounts      Account[]
  sessions      Session[]
  registrations Registration[]
  checkins      Checkin[]       @relation("StaffCheckins")
  notifications NotificationLog[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

enum Role { STUDENT  ORGANIZER  CHECKIN_STAFF }

model Session {
  id        String   @id @default(cuid())
  userId    String
  expiresAt DateTime
  token     String   @unique
  ipAddress String?
  userAgent String?
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
}

model Account {
  id                   String    @id @default(cuid())
  accountId            String
  providerId           String
  userId               String
  accessToken          String?
  refreshToken         String?
  idToken              String?
  accessTokenExpiresAt DateTime?
  scope                String?
  password             String?
  user                 User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt

  @@unique([providerId, accountId])
  @@index([userId])
}

model Verification {
  id         String   @id @default(cuid())
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([identifier])
}

// ─────────────────────────────────────────────
// CORE: WORKSHOP
// ─────────────────────────────────────────────
model Workshop {
  id                   String          @id @default(cuid())
  title                String
  description          String?
  speaker              String
  room                 String
  roomMapUrl           String?

  date      DateTime @db.Date    // Index riêng cho query theo ngày
  startTime DateTime
  endTime   DateTime

  maxCapacity          Int
  currentRegistrations Int             @default(0)
  version              Int             @default(0)  // Optimistic locking
  price                Int             @default(0)  // VNĐ, 0 = miễn phí
  status               WorkshopStatus  @default(ACTIVE)

  aiSummary       String?
  aiSummaryStatus AISummaryStatus @default(NONE)
  pdfUrl          String?

  registrations Registration[]
  createdBy     String
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt

  @@index([date, status])  // Query lọc workshop theo ngày + status
}

enum WorkshopStatus  { ACTIVE  CANCELLED  COMPLETED }
enum AISummaryStatus { NONE  PROCESSING  COMPLETED  FAILED }

// ─────────────────────────────────────────────
// CORE: REGISTRATION (Aggregate Root)
// ─────────────────────────────────────────────
model Registration {
  id         String             @id @default(cuid())
  userId     String
  workshopId String
  status     RegistrationStatus @default(PENDING)

  qrCode      String?  @unique  // Payload QR: "UNIHUB-{regId}-{timestamp}"
  qrSignature String?           // HMAC-SHA256 — xác thực offline

  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  workshop Workshop @relation(fields: [workshopId], references: [id], onDelete: Cascade)
  payment  Payment?
  checkin  Checkin?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, workshopId])     // Không đăng ký trùng
  @@index([workshopId, status])
}

enum RegistrationStatus { PENDING  CONFIRMED  CANCELLED  PAYMENT_FAILED }

// ─────────────────────────────────────────────
// PAYMENT (Idempotency built-in)
// ─────────────────────────────────────────────
model Payment {
  id             String        @id @default(cuid())
  registrationId String        @unique
  amount         Int           // VNĐ
  idempotencyKey String        @unique
  vnpayTxnRef    String?       @unique  // ID phía VNPAY
  status         PaymentStatus @default(PENDING)
  paidAt         DateTime?

  registration Registration @relation(fields: [registrationId], references: [id], onDelete: Cascade)
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt

  @@index([idempotencyKey])
}

enum PaymentStatus { PENDING  SUCCESS  FAILED  REFUNDED }

// Cache response cũ để trả về khi client retry
model IdempotencyRecord {
  key       String   @id
  response  Json
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([expiresAt])
}

// ─────────────────────────────────────────────
// CHECK-IN (Offline-first)
// ─────────────────────────────────────────────
model Checkin {
  id             String     @id @default(cuid())
  registrationId String     @unique
  checkedInBy    String     // Staff userId
  checkedInAt    DateTime   // Giờ thực tế (device clock khi offline)
  syncStatus     SyncStatus @default(SYNCED)
  syncedAt       DateTime?  // Giờ bản ghi được push lên server
  offlineDeviceId String?   // Để trace lỗi nếu cần

  registration Registration @relation(fields: [registrationId], references: [id], onDelete: Cascade)
  staff        User         @relation("StaffCheckins", fields: [checkedInBy], references: [id])

  @@index([checkedInBy])
}

enum SyncStatus { SYNCED  PENDING_SYNC }

// ─────────────────────────────────────────────
// INFRASTRUCTURE LOGS
// ─────────────────────────────────────────────
model CsvImportLog {
  id             String   @id @default(cuid())
  filename       String
  totalRows      Int
  successCount   Int
  errorCount     Int
  duplicateCount Int
  errorDetails   Json?    // [{ row, error, data }]
  status         String   // "SUCCESS" | "PARTIAL" | "FAILED"
  processedAt    DateTime @default(now())
}

model NotificationLog {
  id           String   @id @default(cuid())
  userId       String
  channel      String   // "EMAIL" | "IN_APP" | "TELEGRAM"
  type         String   // "REGISTRATION_CONFIRMED" | "WORKSHOP_CANCELLED" | ...
  status       String   // "SENT" | "FAILED" | "PENDING"
  errorMessage String?
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt    DateTime @default(now())

  @@index([userId, status])
}
```

**Indexing strategy:**

| Index | Lý do |
|---|---|
| `Workshop(date, status)` | Query "workshop hôm nay đang ACTIVE" |
| `Registration(workshopId, status)` | Count confirmed registrations per workshop |
| `Registration UNIQUE(userId, workshopId)` | Chặn đăng ký trùng ở DB level |
| `Payment UNIQUE(vnpayTxnRef)` | Chặn process duplicate callback |
| `Payment(idempotencyKey)` | Lookup nhanh khi client retry |
| `IdempotencyRecord(expiresAt)` | Cleanup job xóa record hết hạn |

---

## 5. Các Luồng Nghiệp Vụ Quan Trọng

### Luồng 1: Đăng ký Workshop có Phí

```
Sinh viên              API Handler          RegistrationService      PaymentService
    │                      │                        │                      │
    │── POST /api/reg ─────►│                        │                      │
    │   { workshopId,       │── checkIdempotency()──►│                      │
    │     idempotencyKey }  │                        │── validateWorkshop() │
    │                       │                        │── checkDuplicate()   │
    │                       │                        │                      │
    │                       │                        │── DB Transaction: ───┤
    │                       │                        │   UPDATE workshops   │
    │                       │                        │   (version check +   │
    │                       │                        │    affected_rows=1?) │
    │                       │                        │   INSERT registration│
    │                       │                        │   (PENDING)          │
    │                       │                        │   INSERT payment     │
    │                       │                        │   (PENDING)          │
    │                       │                        │   INSERT idempotency │
    │                       │                        │   COMMIT ────────────┤
    │                       │                        │                      │
    │                       │                        │──────────────────────►│
    │                       │                        │                      │── createPaymentUrl()
    │                       │                        │                      │   (CircuitBreaker check)
    │                       │                        │                      │── VNPAY API ──►
    │                       │◄── { paymentUrl } ─────│◄── paymentUrl ───────│
    │◄── { paymentUrl } ────│                        │                      │
    │                       │                        │                      │
    │── redirect VNPAY ─────────────────────────────────────────────────────►│
    │                                                                          VNPAY
    │◄── callback IPN ────────────────────────────────── POST /api/payments/vnpay-callback
    │                       │                        │                      │
    │                       │── verifySignature() ──►│                      │
    │                       │── checkIdempotency() ──►│                      │
    │                       │                        │── DB Transaction: ───┤
    │                       │                        │   UPDATE payment     │
    │                       │                        │     status=SUCCESS   │
    │                       │                        │   UPDATE registration│
    │                       │                        │     status=CONFIRMED │
    │                       │                        │   Generate QRTicket  │
    │                       │                        │   COMMIT             │
    │                       │                        │                      │
    │                       │◄── EventBus.publish(PaymentSucceededEvent)    │
    │                       │    ↳ NotificationService.notify()             │
    │                       │      (email + in-app, async)                  │
    │◄── redirect /result ──│                        │                      │
```

### Luồng 2: Check-in Offline và Sync

```
Phase 1 — Preload (sáng, có mạng):
┌──────────────────────────────────────────────────────────────┐
│  Staff mở PWA → GET /api/checkins/preload?date=today          │
│  Server trả: workshops + registrations + hmacPublicKey        │
│  PWA lưu vào IndexedDB (3 stores: workshops, registrations,   │
│  pendingCheckins) + Service Worker cache static assets        │
└──────────────────────────────────────────────────────────────┘

Phase 2 — Offline check-in (mất mạng):
┌─────────────────────────────────────────────────────────────────┐
│  PWA detect offline → banner "Đang ở chế độ offline"           │
│                                                                  │
│  Staff scan QR → decode payload:                                │
│    { registrationId, workshopId, studentId, signature }         │
│                                                                  │
│  QRVerifier.verify(code, signature):                            │
│    expected = HMAC-SHA256(code, cachedHmacKey)                  │
│    timingSafeEqual(signature, expected) → boolean               │
│                                                                  │
│  Lookup IndexedDB:                                              │
│    ✓ registrationId exists?                                     │
│    ✓ status === "CONFIRMED"?                                    │
│    ✓ workshopId khớp workshop đang scan?                        │
│    ✓ checkedIn === false? (chống quét 2 lần offline)            │
│                                                                  │
│  Nếu pass:                                                      │
│    INSERT IndexedDB pendingCheckins: { registrationId,          │
│      workshopId, checkedInAt: now(), syncStatus: PENDING_SYNC } │
│    UPDATE IndexedDB registrations: checkedIn = true             │
│    Hiển thị ✅ "Check-in thành công (chờ đồng bộ)"             │
└─────────────────────────────────────────────────────────────────┘

Phase 3 — Sync khi online lại:
┌─────────────────────────────────────────────────────────────────┐
│  Service Worker detect 'online' event                           │
│                                                                  │
│  OfflineSyncService.syncPendingCheckins():                      │
│    1. Đọc tất cả { syncStatus: PENDING_SYNC } từ IndexedDB      │
│    2. POST /api/checkins/sync { checkins: [...] }               │
│                                                                  │
│  Server (xử lý per-record, không 1 transaction chung):          │
│    For each record:                                             │
│      - Verify signature lại (server-side)                       │
│      - Check registration exists + CONFIRMED                    │
│      - INSERT Checkin (idempotent: skip nếu đã có)              │
│      → { registrationId, status: "synced"|"duplicate"|"invalid"}│
│                                                                  │
│  PWA update IndexedDB:                                          │
│    synced → remove from pendingCheckins                         │
│    duplicate → remove (đã có người khác check-in trước)         │
│    invalid → mark ERROR, hiển thị để staff review              │
│                                                                  │
│  Hiển thị: "Đã đồng bộ 8/9. 1 bị bỏ qua (check-in trùng)"     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Thiết kế Kiểm soát Truy cập (RBAC)

### 6.1 Roles & Permissions

| Permission | STUDENT | ORGANIZER | CHECKIN_STAFF |
|---|:---:|:---:|:---:|
| Xem danh sách workshop | ✅ | ✅ | ✅ |
| Đăng ký / huỷ đăng ký | ✅ | ❌ | ❌ |
| Xem lịch sử đăng ký của mình | ✅ | ❌ | ❌ |
| Tạo / sửa / huỷ workshop | ❌ | ✅ | ❌ |
| Xem tất cả registrations | ❌ | ✅ | ❌ |
| Upload PDF / xem AI summary | ❌ | ✅ | ❌ |
| Import CSV sinh viên | ❌ | ✅ | ❌ |
| Xem thống kê / dashboard | ❌ | ✅ | ❌ |
| Quét QR check-in | ❌ | ❌ | ✅ |
| Sync check-in | ❌ | ❌ | ✅ |

### 6.2 Cơ chế kiểm tra — 3 lớp bảo vệ

**Lớp 1: Next.js Middleware** (chạy ở Vercel Edge, trước khi request vào server)

```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  const session = await getSession(request); // lookup Redis cache → DB

  // Public routes: không cần auth
  const PUBLIC = ['/workshops', '/api/workshops'];
  if (PUBLIC.some(p => request.nextUrl.pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (!session) return NextResponse.redirect('/login');

  // Route-based role check
  const { pathname } = request.nextUrl;
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    if (session.user.role !== 'ORGANIZER') return new NextResponse(null, { status: 403 });
  }
  if (pathname.startsWith('/scan') || pathname.startsWith('/api/checkins')) {
    if (session.user.role !== 'CHECKIN_STAFF') return new NextResponse(null, { status: 403 });
  }

  return NextResponse.next();
}
```

**Lớp 2: API Route Handler** (kiểm tra chi tiết hơn, resource-level)

```typescript
// Ví dụ: GET /api/registrations
export async function GET(request: Request) {
  const session = await requireAuth(request); // throw 401 nếu không có session

  if (session.user.role === 'STUDENT') {
    // STUDENT chỉ xem registrations của chính mình
    return registrationService.getByUserId(session.user.id);
  }
  if (session.user.role === 'ORGANIZER') {
    // ORGANIZER xem tất cả
    return registrationService.getAll();
  }
  return new Response(null, { status: 403 });
}
```

**Lớp 3: Database Constraints** (phòng thủ cuối, không thể bypass)

```sql
-- Không thể đăng ký trùng dù có bypass middleware
UNIQUE(userId, workshopId) ON registrations

-- Không thể oversell dù có race condition
CHECK (current_registrations <= max_capacity) ON workshops

-- Không thể duplicate payment
UNIQUE(vnpayTxnRef) ON payments
```

---

## 7. Thiết kế Các Cơ chế Bảo vệ Hệ thống

### 7.1 Kiểm soát Tải đột biến — Token Bucket Rate Limiting

**Thuật toán:** Token Bucket (chọn vì phép burst ngắn tự nhiên hơn Fixed Window)

```
Cấu hình:
  - Capacity: 10 token / IP
  - Refill rate: 2 token / giây
  - Áp dụng cho: /api/registrations (endpoint nhạy cảm nhất)
  - Public endpoints (/api/workshops GET): 30 token / 10 giây / IP

Cơ chế:
  Mỗi IP có 1 bucket trong Redis:
    key = "ratelimit:{ip}"
    value = { tokens: 10, lastRefillAt: timestamp }

  Mỗi request:
    1. Đọc bucket từ Redis
    2. Tính tokens đã refill kể từ lastRefillAt
       newTokens = min(capacity, current + elapsed * rate)
    3. Nếu newTokens >= 1 → cho qua, trừ 1 token, update Redis
    4. Nếu newTokens < 1 → trả 429, header: Retry-After: 1

Khi 12.000 sinh viên vào:
  - 12.000 requests đến Vercel Edge
  - Rate Limiter xử lý ở edge (không vào server)
  - Request hợp lệ → vào RegistrationService
  - Request quá nhanh → 429 ngay tại edge
  - DB chỉ nhận lượng request kiểm soát được
```

**Graceful Degradation khi tải cực cao:**
- Trang danh sách workshop dùng ISR cache (TTL 60s) → 12.000 người đọc từ CDN
- Chỉ POST /api/registrations mới thực sự chạm DB
- Redis đếm ghế (DECR) xử lý 100k ops/sec → không cần DB lock

### 7.2 Circuit Breaker — VNPAY không ổn định

**Các trạng thái:**

```
                  5 failures / 60s
    CLOSED ──────────────────────────► OPEN
      ▲                                  │
      │ success                          │ 30s timeout
      │                                  ▼
    HALF_OPEN ◄────────────────────── (wait)
      │
      │ 1 probe request
      ├─ success → CLOSED
      └─ failure → OPEN (reset timer)
```

**Triển khai `PaymentGatewayCircuitBreaker`:**

```
State lưu trong Redis (dùng chung giữa các Serverless instances):
  key = "circuit:vnpay"
  value = { state, failureCount, lastFailureAt, openedAt }

CLOSED:
  → Cho request qua
  → Failure: failureCount++
  → failureCount >= 5 AND tất cả trong 60s → chuyển OPEN

OPEN:
  → Reject ngay, không gọi VNPAY
  → Response: 503 { error: "PAYMENT_UNAVAILABLE", retryAfter: 30 }
  → Sau 30s → HALF_OPEN

HALF_OPEN:
  → Cho 1 request probe qua
  → Success → CLOSED, reset failureCount
  → Failure → OPEN, reset timer

Graceful Degradation khi OPEN:
  → GET /api/system/status trả { payment: "degraded" }
  → Frontend ẩn nút "Thanh toán", hiển thị banner cảnh báo
  → Workshop miễn phí, xem lịch, check-in: vẫn hoạt động bình thường
```

### 7.3 Chống trừ tiền 2 lần — Idempotency

**Idempotency Key flow:**

```
Client tạo key: idempotencyKey = crypto.randomUUID()
  → Gửi kèm trong mọi POST request quan trọng

Server nhận request:
  1. Lookup IdempotencyRecord WHERE key = idempotencyKey
  2. Nếu tìm thấy:
     - Chưa hết hạn → trả response cũ (cached)
     - Đã hết hạn → reject, yêu cầu key mới
  3. Nếu không tìm thấy:
     - Chạy business logic
     - Lưu IdempotencyRecord { key, response, expiresAt: +24h }
     - Trả response mới

Trường hợp VNPAY callback duplicate:
  - Check payment.vnpayTxnRef đã tồn tại
  - Nếu payment.status === SUCCESS → trả RspCode=02 (đã xử lý)
  - UNIQUE constraint trên vnpayTxnRef là safety net cuối cùng

TTL 24h: Đủ cho một phiên thanh toán (VNPAY redirect flow < 15 phút)
```

---

## 8. Các Quyết định Kỹ thuật (ADR)

### ADR-001: Modular Monolith thay vì Microservices
- **Quyết định:** Modular Monolith + Clean Architecture
- **Lý do:** KISS/YAGNI — 4 thành viên, 1 semester. Microservices cần DevOps infra phức tạp.
- **Đánh đổi:** Không scale từng module độc lập. Chấp nhận được ở quy mô 12k users.
- **Tương lai:** Các module có interface rõ ràng → tách microservice dễ nếu cần.

### ADR-002: PostgreSQL (Neon) + Redis (Upstash) thay vì chỉ 1 DB
- **Quyết định:** PostgreSQL cho persistent data, Redis cho real-time ops
- **Lý do:** SQL ACID cho seat counting & payment atomicity. Redis cho DECR atomic 100k/ops.
- **Đánh đổi:** 2 data stores → cần sync. Giải quyết bằng: Redis là cache/counter, PostgreSQL là source of truth.

### ADR-003: Session-based Auth (Better-Auth) thay vì JWT stateless
- **Quyết định:** Session stored in PostgreSQL + Redis cache
- **Lý do:** Có thể revoke ngay lập tức (logout, ban user). JWT stateless không revoke được trước khi hết hạn.
- **Đánh đổi:** Mỗi request lookup session (giảm bằng Redis cache).

### ADR-004: Optimistic Locking cho seat booking thay vì Pessimistic Lock
- **Quyết định:** `UPDATE workshops SET ... WHERE id = ? AND version = ?`
- **Lý do:** Tránh deadlock khi nhiều user cùng UPDATE. Rollback nhanh nếu version mismatch.
- **Đánh đổi:** Client phải retry khi conflict (hiếm xảy ra với 60 chỗ/workshop).

### ADR-005: Upstash QStash cho async jobs thay vì BullMQ + Redis hoặc Kafka
- **Quyết định:** Upstash QStash cho message queue
- **Lý do:** BullMQ cần Redis persistent connection — không tương thích Serverless. Upstash Kafka đã bị deprecated. QStash là HTTP-based, push-to-webhook, native cho Vercel: publish một HTTP call → QStash gọi lại API route của mình như webhook, có built-in retry và deduplication.
- **Đánh đổi:** Latency cao hơn BullMQ in-memory (~100–500ms). Chấp nhận được cho notification và AI jobs (không yêu cầu real-time).
