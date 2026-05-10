# Đặc tả: Thông Báo (Notification)

## Mô tả

Gửi thông báo đến sinh viên qua nhiều kênh (**email**, **in-app**). Thiết kế theo **Strategy Pattern** — thêm kênh mới (Telegram, Zalo) chỉ cần thêm 1 class, không sửa `NotificationService`. Toàn bộ notification xử lý **async** qua message queue — không block luồng nghiệp vụ chính.

Triển khai trong `modules/notification/` — `NotificationService`, `INotificationStrategy`, các strategy implementations.

---

## Luồng chính

### Kiến trúc Strategy Pattern

```typescript
// Domain interface — mọi kênh đều implement
interface INotificationStrategy {
  readonly channel: "EMAIL" | "IN_APP" | "TELEGRAM";
  send(payload: NotificationPayload): Promise<void>;
}

// NotificationService nhận array strategies qua DI
// Thêm channel mới = thêm 1 class, không sửa service
class NotificationService {
  constructor(
    private strategies: INotificationStrategy[],
    private logRepo: INotificationLogRepository
  ) {}

  async notify(payload: NotificationPayload): Promise<void> {
    // Gửi song song tất cả kênh
    const results = await Promise.allSettled(
      this.strategies.map(s => s.send(payload))
    );
    // Log từng kênh (kể cả lỗi)
    await this.logAll(payload, results);
  }
}
```

### Trigger Notification (từ EventBus)

```
EventBus.subscribe("RegistrationConfirmedEvent", async (event) => {
  await notificationService.notify({
    userId: event.userId,
    userEmail: event.userEmail,
    type: "REGISTRATION_CONFIRMED",
    data: {
      workshopTitle, workshopDate, workshopRoom, qrCodeDataUrl
    }
  });
});
// Tương tự cho các event khác
```

### Các loại sự kiện và kênh

| Event | Trigger bởi | Email | In-app |
|---|---|:---:|:---:|
| `REGISTRATION_CONFIRMED` | `RegistrationConfirmedEvent` | ✅ (kèm QR) | ✅ |
| `PAYMENT_FAILED` | `PaymentFailedEvent` | ✅ | ✅ |
| `WORKSHOP_CANCELLED` | `WorkshopCancelledEvent` | ✅ | ✅ |
| `WORKSHOP_UPDATED` | `WorkshopUpdatedEvent` | ✅ | ✅ |
| `CHECKIN_REMINDER` | Cron 30 phút trước | ❌ | ✅ |

### Async processing qua Kafka/QStash

```
Các flow khác (Registration, Payment) publish event → EventBus
EventBus handler enqueue job vào Kafka "notification-queue":
  { type, userId, userEmail, data }

NotificationWorker:
  1. Pull job từ queue
  2. Build NotificationPayload từ type + data
  3. NotificationService.notify(payload)
     → EmailStrategy: Resend API → HTML template
     → InAppStrategy: INSERT notifications table
  4. Mỗi kênh: log result vào NotificationLog
  → Promise.allSettled → 1 kênh lỗi không ảnh hưởng kênh khác
```

### In-app Notification

```
- Lưu trong bảng notifications (PostgreSQL):
  { userId, type, title, body, read: false, createdAt }
- API: GET /api/notifications → trả unread list
- Bell icon hiển thị count (SSE hoặc polling mỗi 30s)
- PATCH /api/notifications/:id/read → mark read
- Xóa tự động sau 30 ngày
```

---

## Kịch bản lỗi

### Email server down (Resend unavailable)
- `EmailStrategy.send()` throws → `Promise.allSettled` catch
- `InAppStrategy` vẫn chạy và thành công
- `NotificationLog`: email → "FAILED" (+ errorMessage), in-app → "SENT"
- Kafka retry: 3 lần với delay 30s → 60s → 120s
- Sau 3 lần: mark job failed, log warning. Sinh viên **vẫn nhận in-app notification**.

### Notification queue backlog (nhiều đăng ký cùng lúc)
- 12.000 sinh viên đăng ký → 12.000 jobs trong queue
- Worker concurrency = 5: xử lý song song 5 jobs
- Tất cả jobs được xử lý, không mất notification nào
- **Không block:** Registration API trả response ngay, không chờ email gửi

### Workshop bị huỷ — broadcast tới nhiều user
```
WorkshopCancelledEvent → EventBus handler:
  1. RegistrationRepository.findAllConfirmedByWorkshop(workshopId)
  2. Enqueue 1 job per user vào Kafka
  3. Worker xử lý tuần tự (rate limit: 50 emails/phút)
```
- Không gửi tất cả cùng lúc (tránh SMTP rate limit)
- Kafka queue đảm bảo không mất notification

### Notification cho user không tồn tại
- `UserRepository.findById(userId)` → null
- Log warning, skip (không throw)
- Xảy ra khi user bị xóa nhưng event chưa được xử lý

---

## Ràng buộc

| Ràng buộc | Giá trị |
|---|---|
| Async | Không block luồng đăng ký / thanh toán |
| Email rate | 50 emails/phút (Resend free tier) |
| Retry | 3 lần, exponential: 30s → 60s → 120s |
| In-app TTL | 30 ngày rồi tự xóa |
| Thêm kênh mới | Thêm class implement INotificationStrategy, đăng ký vào Container |
| Template | HTML email template (React Email hoặc Handlebars) |

---

## Tiêu chí chấp nhận

- [ ] Đăng ký thành công → nhận email (kèm QR inline image) + in-app trong vòng 60 giây
- [ ] In-app notification: hiển thị trên bell icon với unread count
- [ ] Mark read hoạt động
- [ ] Email server down → in-app vẫn nhận được (lỗi không lan rộng)
- [ ] Workshop bị huỷ → tất cả sinh viên đã đăng ký nhận notification
- [ ] Thêm `TelegramNotificationStrategy` → chỉ thêm 1 file mới, không sửa `NotificationService`
- [ ] `NotificationLog` có record cho mỗi lần gửi (kể cả failed)
