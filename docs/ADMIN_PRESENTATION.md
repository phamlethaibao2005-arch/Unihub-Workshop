# UniHub Workshop — Script Demo Video: Admin Panel

> **Định dạng:** Camera người thuyết trình + demo trực tiếp trên code/app đang chạy
> **Không dùng slide.** Mỗi vấn đề kỹ thuật = nêu bài toán → mở code → chạy app minh họa.

---

## Thông tin demo

| | |
|---|---|
| **Account** | `admin.organizer@unihub.edu.vn` / `password123` |
| **App** | `http://localhost:3000/admin` |
| **Editor** | Mở sẵn VS Code tại folder `jayce_workshop/` |

---

## Mở Đầu (30 giây) `[Camera]`

> Xin chào thầy. Em sẽ trình bày phần **Admin Panel** — tập trung vào các **vấn đề kỹ thuật** mà nhóm em phải giải quyết khi xây dựng hệ thống đăng ký workshop cho 12.000 sinh viên.
>
> Có 5 bài toán chính em sẽ demo:
> 1. **Oversell** — làm sao đảm bảo không bán quá số chỗ khi 100 người cùng đăng ký slot cuối
> 2. **Cascade failure** — khi VNPAY sập, làm sao các tính năng khác vẫn sống
> 3. **Async pipeline** — AI tóm tắt PDF mà không block request của người dùng
> 4. **CSV Import** — import an toàn khi file có dòng lỗi, tránh chạy 2 job song song
> 5. **Thông báo hàng loạt** — gửi email đến toàn bộ registrant mà không spam và không mất tin

---

## VẤN ĐỀ 1 — Không Oversell Khi Concurrent Registration

### Bài toán `[Camera]`

> 100 sinh viên cùng bấm "Đăng ký" vào slot cuối của một workshop. Nếu mỗi request đều đọc `currentRegistrations` từ DB rồi so sánh với `maxCapacity`, có thể cả 100 đều đọc được "còn 1 chỗ" trước khi bất kỳ ai ghi — và ta tạo ra 100 registration cho 1 chỗ trống.

### Giải pháp: 2 tầng bảo vệ `[Mở code: SeatManager.ts]`

**Tầng 1 — Redis DECR (primary guard):**

```
// modules/registration/domain/SeatManager.ts
async tryReserve(workshopId: string): Promise<boolean> {
  const after = await this.store.decr(this.key(workshopId))
  if (after < 0) {
    await this.store.incr(this.key(workshopId))  // rollback ngay
    return false
  }
  return true
}
```

> `DECR` là lệnh **atomic** trong Redis — 100 request cùng gọi, chỉ đúng 1 cái nhận `after = 0`. 99 cái còn lại nhận âm, rollback `INCR` ngay lập tức. Không có race condition.

---

**Tầng 2 — Optimistic Lock trên PostgreSQL (safety net):**

```
// modules/registration/application/RegistrationService.ts
const updated = await tx.$executeRaw`
  UPDATE "Workshop"
  SET "currentRegistrations" = "currentRegistrations" + 1,
      version = version + 1,
      "updatedAt" = NOW()
  WHERE id = ${workshopId}
    AND version = ${expectedVersion}        -- <-- optimistic lock
    AND "currentRegistrations" < "maxCapacity"
`
if (updated === 0) throw new ConflictError('WORKSHOP_FULL')
```

> Nếu Redis bị reset hoặc stale (cold start), DB-level `version` check làm lưới an toàn. `updated === 0` nghĩa là ai đó đã thay đổi version trước ta — throw conflict, rollback Redis.

---

**Cold-start edge case:**

```
// Seed lại Redis nếu key bị mất (cold-start)
await this.seatManager.initIfMissing(
  workshopId,
  workshop.maxCapacity - workshop.currentRegistrations,
)
```

> Nếu Redis key không tồn tại, `DECR` trả về `-1` (Redis khởi tạo key = 0 rồi decrement). Tất cả request đều bị block dù còn chỗ. `initIfMissing()` seed lại key từ DB trước khi DECR.

### Demo trên app `[Mở app: /admin/dashboard]`

> **[Chỉ vào stat card "Đăng ký xác nhận"]** — con số này là tổng CONFIRMED registration. Với cơ chế 2 tầng, số này không bao giờ vượt `maxCapacity` của bất kỳ workshop nào.

---

## VẤN ĐỀ 2 — Circuit Breaker: Khi VNPAY Sập

### Bài toán `[Camera]`

> VNPAY sandbox có uptime không ổn định. Khi VNPAY timeout (30 giây), nếu không có gì chặn, mỗi request thanh toán sẽ treo 30s chờ — thread pool cạn — toàn hệ thống sập theo kiểu **cascade failure**. Sinh viên muốn xem workshop, đăng ký miễn phí, check-in — tất cả đều bị ảnh hưởng dù không liên quan đến thanh toán.

### Giải pháp: Circuit Breaker — Decorator Pattern `[Mở code: PaymentGatewayCircuitBreaker.ts]`

```
// modules/payment/infrastructure/PaymentGatewayCircuitBreaker.ts
const FAILURE_THRESHOLD = 5
const FAILURE_WINDOW_MS = 60_000   // 5 failures trong 60s → OPEN
const OPEN_TIMEOUT_MS = 30_000     // OPEN → HALF_OPEN sau 30s

export class PaymentGatewayCircuitBreaker implements IPaymentGateway {
  constructor(
    private readonly inner: IPaymentGateway,  // wraps VNPayGateway
    private readonly redis: Redis,
  ) {}

  private async preCall(): Promise<void> {
    const s = await this.getState()
    if (s.state === 'OPEN') {
      if (s.openedAt !== null && Date.now() - s.openedAt >= OPEN_TIMEOUT_MS) {
        await this.setState({ ...s, state: 'HALF_OPEN' })
        return  // cho 1 probe request qua
      }
      throw new ServiceUnavailableError('Payment gateway is temporarily unavailable')
    }
  }

  async createPaymentUrl(input: CreatePaymentUrlInput): Promise<string> {
    await this.preCall()
    try {
      const result = await this.inner.createPaymentUrl(input)
      await this.onSuccess()   // reset failures
      return result
    } catch (err) {
      await this.onFailure()   // tăng counter, có thể chuyển OPEN
      throw err
    }
  }
}
```

> **Decorator Pattern** — `CircuitBreaker` implements cùng interface `IPaymentGateway`, wraps `VNPayGateway` thật. Code gọi không biết mình đang giao tiếp với circuit breaker hay gateway thật.

---

**State lưu trong Redis (không phải in-memory):**

> Vercel Serverless là **stateless** — mỗi request có thể chạy trên instance khác nhau. In-memory state sẽ mất sau cold start. Lưu state vào Redis → tất cả instances đều thấy circuit đang OPEN.

---

**3 state transitions:**

```
CLOSED  ──(5 failures/60s)──▶  OPEN  ──(30s)──▶  HALF_OPEN
  ▲                                                    │
  └──────────────(probe success)──────────────────────┘
                     (probe fail → OPEN lại)
```

### Demo trên app `[Mở app: /admin/system]`

> **[Chỉ vào 4 card: Payment, AI, Email, DB]**
>
> Trang System Status poll `/api/system/status` mỗi 30 giây — API này đọc state circuit breaker từ Redis và trả về. Admin thấy được hệ thống đang ở trạng thái nào theo thời gian thực.
>
> **[Chỉ vào history snapshots ở dưới]** — mỗi poll tạo ra 1 snapshot, tối đa 30 bản ghi. Admin trace lại được diễn biến trong phiên.

---

## VẤN ĐỀ 3 — AI PDF Summary Không Block Request

### Bài toán `[Camera]`

> Admin upload PDF (slide bài giảng, tài liệu workshop) và muốn hệ thống tự tóm tắt bằng AI. Vấn đề: Vercel Serverless có **timeout 60 giây**. Gọi Gemini API có thể mất 10-30 giây, cộng với download PDF, parse text — dễ vượt ngưỡng và request bị kill giữa chừng.
>
> Ngoài ra, PDF có thể có header/footer lặp lại hàng chục lần — gửi thẳng vào Gemini vừa tốn token vừa làm nhiễu output.

### Giải pháp: Pipe-and-Filter + Async QStash Job `[Mở code: AISummaryPipeline.ts]`

```
// modules/workshop/infrastructure/AISummaryPipeline.ts
export class AISummaryPipeline {
  constructor(
    private readonly downloadFilter = new PDFDownloadFilter(),
    private readonly extractFilter  = new PDFExtractFilter(),
    private readonly summarizeFilter = new GeminiSummarizeFilter()
  ) {}

  async run(pdfUrl: string): Promise<string> {
    const buffer = await this.downloadFilter.run(pdfUrl)   // fetch PDF bytes
    const text   = await this.extractFilter.run(buffer)    // extract + clean text
    return        this.summarizeFilter.run(text)           // Gemini 2.5 Flash
  }
}
```

> **Pipe-and-Filter** — output của filter trước là input của filter sau. Mỗi filter độc lập, có thể test riêng, có thể swap (đổi Gemini sang OpenAI chỉ cần đổi `GeminiSummarizeFilter`).

---

**Xử lý header/footer lặp lại:**

```
// Heuristic: loại dòng xuất hiện >= 20% tổng số dòng
function stripRepeatedLines(text: string): string {
  const counts = new Map<string, number>()
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.length < 4 || trimmed.length > 80) continue
    counts.set(trimmed, (counts.get(trimmed) ?? 0) + 1)
  }
  const threshold = Math.max(3, Math.ceil(lines.length * 0.2))
  const repeated = new Set(
    [...counts.entries()].filter(([, c]) => c >= threshold).map(([l]) => l)
  )
  return lines.filter((line) => !repeated.has(line.trim())).join('\n')
}
```

> Sau đó truncate xuống còn **4000 tokens** trước khi gửi Gemini — tránh vượt context window và tốn tiền không cần thiết.

---

**Không block request — 202 Accepted ngay lập tức:**

```
// app/api/admin/workshops/[id]/upload-pdf/route.ts (lược bỏ)
// 1. Upload PDF lên Vercel Blob
// 2. Cập nhật Workshop.aiSummaryStatus = 'PROCESSING'
// 3. Enqueue job vào QStash
await enqueue(`${BASE_URL}/api/queue/ai-summary`, { workshopId, pdfUrl })
// 4. Trả về 202 ngay — không chờ Gemini
return NextResponse.json({ status: 'processing' }, { status: 202 })
```

> QStash gọi `/api/queue/ai-summary` **bất đồng bộ**, có retry 3 lần (60s → 120s → 240s) nếu fail. Request của admin đã xong, không bị timeout.

### Demo trên app `[Mở app: /admin/workshops → click edit một workshop]`

> **[Scroll xuống phần AI Summary]** — thấy status "NONE". Upload một file PDF.
>
> **[Quan sát]** status chuyển sang "PROCESSING" — trang không bị treo. Sau vài giây QStash callback xong, status chuyển "COMPLETED" và summary hiện ra trong terminal-style UI.

---

## VẤN ĐỀ 4 — CSV Import: Tránh Chạy Song Song & Không Abort Khi Có Dòng Lỗi

### Bài toán `[Camera]`

> Hệ thống cần đồng bộ dữ liệu sinh viên từ SIS (Student Information System) cũ — chỉ export được CSV. Hai rủi ro:
> 1. **Concurrent import**: cron 2AM + admin trigger thủ công có thể chạy cùng lúc → duplicate upsert, data corruption
> 2. **Bad rows**: CSV từ SIS thường có dòng thiếu field, encoding lạ — nếu abort toàn bộ khi gặp 1 dòng lỗi thì không import được gì

### Giải pháp: Distributed Lock + Template Method `[Mở code: BaseImportJob.ts]`

**Distributed Lock ngăn concurrent job:**

```
// app/api/cron/csv-import/route.ts (lược bỏ)
// Redis SET NX — atomic: chỉ set nếu key chưa tồn tại
const acquired = await redis.set('lock:csv-import', '1', { nx: true, ex: 300 })
if (!acquired) {
  return NextResponse.json({ message: 'Import already running' }, { status: 409 })
}
// Enqueue QStash job rồi release lock sau khi xong
```

---

**Template Method — skeleton trong BaseImportJob:**

```
// modules/csv-import/application/BaseImportJob.ts
abstract class BaseImportJob {
  // Skeleton: orchestrate toàn bộ luồng
  async run(filename: string): Promise<ImportResult> {
    const rows = await this.readRows(filename)      // abstract
    for (const row of rows) {
      try {
        const validated = await this.validateRow(row, rowIndex)  // abstract
        if (validated) await this.processRow(validated, rowIndex) // abstract
      } catch (error) {
        if (this.isDuplicateError(error)) {
          this.duplicateCount++
        } else {
          this.errorCount++
          this.errorDetails.push({ row: rowIndex, error: error.message, data: row })
          // SKIP — không throw, tiếp tục dòng tiếp theo
        }
      }
    }
    await this.finalize()
    return this.emitLog(filename)
  }

  // Subclass override phần này
  protected abstract readRows(filename: string): Promise<ImportRowData[]>
  protected abstract validateRow(row: ImportRowData, rowIndex: number): Promise<ImportRowData | null>
  protected abstract processRow(row: ImportRowData, rowIndex: number): Promise<void>
}
```

> **Template Method Pattern** — `BaseImportJob` định nghĩa thuật toán cố định (loop, error handling, logging). `StudentCSVImportJob` chỉ implement 3 method abstract. Nếu mai mốt cần import giảng viên hoặc phòng học: tạo class mới, không đụng vào infrastructure.

---

**Dòng lỗi không abort toàn bộ:**

> Mỗi dòng lỗi được skip và ghi vào `errorDetails` (JSON). Import vẫn tiếp tục. Kết quả cuối: `{ totalRows, successCount, errorCount, duplicateCount, errorDetails }`.

### Demo trên app `[Mở app: /admin/csv-import]`

> **[Chỉ vào tab "Hoạt Động"]** — danh sách import log gần nhất với trạng thái SUCCESS / PARTIAL / FAILED, số dòng thành công/lỗi.
>
> **[Click vào một log có errorCount > 0]** — xem chi tiết dòng lỗi cụ thể.
>
> **[Click "Trigger Import"]** — thấy response 202 ngay, không treo — job chạy bất đồng bộ qua QStash. Sau vài giây log mới xuất hiện.

---

## VẤN ĐỀ 5 — Thông Báo: Strategy Pattern + Không Spam + Không Mất Tin

### Bài toán `[Camera]`

> Khi workshop bị hủy, hệ thống phải gửi thông báo đến **tất cả** sinh viên đã đăng ký. Vấn đề:
> 1. **Fan-out**: gửi 500 email cùng lúc → trigger rate limit của Resend (100 emails/phút)
> 2. **Coupling**: nếu logic gửi email nằm thẳng trong WorkshopService, mai thêm kênh Zalo phải sửa core
> 3. **Duplicate**: QStash retry 3 lần nếu webhook fail → không được gửi 3 lần cùng 1 thông báo

### Giải pháp: Strategy + Observer + Deduplication `[Mở code: bootstrap.ts + NotificationService.ts]`

**Strategy Pattern — thêm kênh mới không sửa code cũ:**

```
// modules/notification/application/NotificationService.ts
export class NotificationService {
  constructor(
    private readonly strategies: INotificationStrategy[],  // Email + InApp
    private readonly logRepo: INotificationLogRepository,
  ) {}

  async notify(payload: NotificationPayload): Promise<void> {
    // Gửi qua tất cả kênh song song, không throw nếu 1 kênh fail
    const results = await Promise.allSettled(
      this.strategies.map((s) => s.send(payload))
    )
    // Log kết quả từng kênh (SENT / FAILED)
    await Promise.allSettled(
      this.strategies.map((s, i) =>
        this.logRepo.log({ channel: s.channel, status: results[i].status === 'fulfilled' ? 'SENT' : 'FAILED' })
      )
    )
  }
}
```

> Thêm kênh Zalo: tạo `ZaloNotificationStrategy implements INotificationStrategy`, đăng ký vào container. Zero thay đổi ở `NotificationService`.

---

**Observer Pattern — domain events không coupling:**

```
// bootstrap.ts — wiring EventBus → QStash
EventBus.subscribe<WorkshopCancelledEvent>('workshop.cancelled', async (event) => {
  const registrations = await db.registration.findMany({
    where: { workshopId: event.workshopId, status: 'CONFIRMED' },
  })

  await Promise.all(
    registrations.map((reg, i) =>
      enqueue(DEST, payload, {
        deduplicationId: `${reg.userId}-WS_CANCELLED-${event.workshopId}`,
        retries: 3,
        delay: i > 0 ? Math.round(i * 1.2) : undefined,  // stagger 1.2s/người
      })
    )
  )
})
```

> **Stagger delay**: mỗi email cách nhau 1.2 giây — 500 người = gửi trải ra ~10 phút, không spike rate limit của Resend.
>
> **deduplicationId**: QStash deduplicate theo ID này — dù retry 3 lần, webhook chỉ được xử lý 1 lần duy nhất.
>
> **Observer**: `WorkshopService` chỉ `publish('workshop.cancelled', event)`. Không biết ai lắng nghe, không import NotificationService. Tách hoàn toàn.

### Demo trên app `[Mở app: /admin/notifications]`

> **[Chỉ vào bộ lọc type]** — lọc theo loại sự kiện: REGISTRATION_CONFIRMED, PAYMENT_FAILED, WORKSHOP_CANCELLED. Mỗi type tương ứng với một domain event đã xử lý.
>
> **[Thử filter "Hủy workshop"]** — xem thông báo đã gửi đến các sinh viên khi workshop bị cancel.
>
> **[Chỉ vào badge "New" trên các thông báo chưa đọc]** — real-time, lazy-loaded qua IntersectionObserver.

---

## Kết — Tổng Kết Kỹ Thuật (1 phút) `[Camera]`

> Năm vấn đề kỹ thuật em đã trình bày hội tụ vào một triết lý thiết kế chung:

| Vấn đề | Giải pháp | Pattern |
|---|---|---|
| Oversell concurrent | Redis DECR atomic + DB version | Optimistic Locking |
| Cascade failure | Circuit Breaker trên VNPAY | Decorator |
| AI timeout Serverless | Async QStash + 202 Accepted | Pipe-and-Filter |
| CSV concurrent + bad rows | Distributed Lock + skip-not-abort | Template Method |
| Notification fan-out + dedup | Strategy + EventBus + stagger | Strategy + Observer |

> Tất cả các pattern này không phải áp dụng cho đẹp — chúng giải quyết **constraint thực tế** của môi trường Vercel Serverless: stateless, timeout 60s, không có long-running process.

---

## Phụ Lục — Q&A Dự Phòng

**Q: Tại sao không dùng `SELECT FOR UPDATE` thay cho Redis DECR?**

> `SELECT FOR UPDATE` tạo row lock — serialize tất cả registrations cùng workshop, latency tuyến tính theo số concurrent. Redis DECR < 1ms, không block request khác. 100 concurrent → chỉ DECR bị serialized tại Redis, còn lại xử lý song song.

**Q: Circuit Breaker state trong Redis — nếu Redis down thì sao?**

> `getState()` trả về `defaultState()` (CLOSED) nếu Redis không trả về gì. Chấp nhận được: Upstash Redis uptime > 99.9%, và worst case là không có circuit breaker thay vì sập hoàn toàn.

**Q: QStash retry sẽ gây duplicate thông báo không?**

> Không. Mỗi job có `deduplicationId` — QStash đảm bảo mỗi ID chỉ deliver đúng 1 lần, dù retry bao nhiêu lần. Ngoài ra phía DB còn có `NotificationLog` ghi trạng thái từng lần gửi.

**Q: PDF scan ảnh (không có text layer) xử lý thế nào?**

> `PDFExtractFilter` gọi `pdf-parse` — nếu `text` trả về rỗng sau khi clean, throw `PDFEmptyError`. Pipeline catch và set `aiSummaryStatus = 'FAILED'`. Admin nhận thông báo và có thể nhập tay.

**Q: Làm sao RBAC ngăn sinh viên vào `/admin`?**

> 3 lớp: (1) Vercel Edge Middleware kiểm tra session + redirect theo role; (2) `app/(admin)/layout.tsx` là Server Component — `if role !== ORGANIZER → redirect`; (3) mỗi API route gọi `requireAuth()` + role check. Không thể bypass layer này kể cả gọi API trực tiếp.
