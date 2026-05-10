# Đặc tả: Đăng ký Workshop

## Mô tả

Sinh viên đăng ký workshop (miễn phí hoặc có phí). Hệ thống đảm bảo **không oversell**, **không đăng ký trùng**, và **chịu được retry an toàn** qua Idempotency Key. Concurrency được xử lý bằng **Optimistic Locking** ở tầng DB, không dùng SELECT FOR UPDATE để tránh deadlock.

Triển khai trong `modules/registration/` — `RegistrationService`, `SeatManager`, `Registration` entity.

---

## Luồng chính

### Đăng ký workshop miễn phí

```
Client:
  1. Sinh viên xem trang workshop detail (seats còn lại cập nhật qua SSE)
  2. Bấm "Đăng ký" → client sinh: idempotencyKey = crypto.randomUUID()
  3. POST /api/registrations { workshopId, idempotencyKey }

Server (RegistrationService.register):
  4. Middleware: xác thực session (STUDENT), Rate Limit check
  5. IdempotencyService.checkAndStore(idempotencyKey):
     → Nếu key tồn tại + chưa hết hạn → trả cached response ngay
  6. WorkshopRepository.findById(workshopId):
     → Không tồn tại → 404
     → workshop.isAvailable === false → 409 WORKSHOP_FULL
  7. RegistrationRepository.findByUserAndWorkshop(userId, workshopId):
     → Đã tồn tại → 409 ALREADY_REGISTERED
  8. DB Transaction (Optimistic Lock):
     UPDATE workshops
       SET current_registrations = current_registrations + 1,
           version = version + 1
       WHERE id = :workshopId
         AND version = :readVersion          ← Optimistic lock
         AND current_registrations < max_capacity
     → affected_rows = 0 → ROLLBACK → 409 WORKSHOP_FULL (race condition)
     → affected_rows = 1 →
       INSERT INTO registrations { userId, workshopId, status: CONFIRMED }
       INSERT INTO idempotency_records { key, response, expiresAt: +24h }
       Generate QRTicket (HMAC-SHA256 signature)
       UPDATE registration SET qrCode, qrSignature
     COMMIT
  9. EventBus.publish(RegistrationConfirmedEvent)
     → NotificationService.notify() [async, non-blocking]
  10. Response 201: { registrationId, qrCode, status: "CONFIRMED" }
```

### Đăng ký workshop có phí

```
Bước 1-7: Giống miễn phí

  8. DB Transaction:
     UPDATE workshops (Optimistic Lock — giống trên)
     INSERT INTO registrations { status: PENDING }
     INSERT INTO payments { status: PENDING, idempotencyKey }
     INSERT INTO idempotency_records
     COMMIT

  9. PaymentService.initiatePayment():
     → CircuitBreaker check (OPEN → 503 ngay)
     → CLOSED: gọi VNPayGateway.createPaymentUrl()
     → Trả paymentUrl

  10. Response 201: { registrationId, paymentUrl, status: "PENDING_PAYMENT" }

  11. Client redirect → VNPAY → [xem specs/payment.md]
```

### Hủy đăng ký

```
1. DELETE /api/registrations/:id
2. Verify: session.userId === registration.userId (chỉ hủy của mình)
3. Check trạng thái:
   PENDING → cancel + hoàn ghế (current_registrations - 1)
   CONFIRMED (miễn phí) → cancel + hoàn ghế
   CONFIRMED (có phí, đã thanh toán) → cần refund flow riêng (ngoài scope spec này)
4. Registration.cancel() → status = CANCELLED
5. Workshop.currentRegistrations -= 1 (optimistic update)
6. EventBus.publish(RegistrationCancelledEvent)
```

---

## Kịch bản lỗi

### Hết chỗ do race condition
- **Trigger:** 2 sinh viên đăng ký ghế cuối cùng đồng thời
- **Xử lý:** Optimistic Lock → chỉ 1 UPDATE thành công (`affected_rows=1`). Request còn lại nhận `affected_rows=0` → ROLLBACK → 409 `{ error: "WORKSHOP_FULL" }`
- **Client:** Toast "Rất tiếc, workshop đã hết chỗ", disable nút, refresh seat count qua SSE

### Client retry cùng request (network glitch)
- **Trigger:** Client gửi lại request với cùng `idempotencyKey`
- **Xử lý:** `IdempotencyService` tìm thấy key → trả nguyên cached response
- **Result:** Không tạo registration trùng, sinh viên nhận lại QR code

### Sinh viên đã đăng ký workshop này
- **Trigger:** Double-click hoặc cố tình gửi lại
- **Xử lý (lớp app):** `RegistrationRepository.findByUserAndWorkshop()` → tìm thấy → 409 `ALREADY_REGISTERED`
- **Xử lý (lớp DB):** `UNIQUE(userId, workshopId)` làm safety net nếu app-level check bị bypass

### Rate Limit exceeded
- **Trigger:** Sinh viên gửi > 10 request / bucket
- **Xử lý:** Token Bucket tại Vercel Edge → 429 `{ error: "RATE_LIMIT", retryAfter: 1 }`
- **Client:** Toast "Bạn đang gửi quá nhanh, vui lòng chờ 1 giây"

### Circuit Breaker OPEN (workshop có phí)
- **Trigger:** VNPAY liên tục lỗi, Circuit Breaker đang OPEN
- **Xử lý:** `PaymentGatewayCircuitBreaker.checkState()` → throw `PaymentGatewayUnavailableError` ngay
- **Response:** 503 `{ error: "PAYMENT_UNAVAILABLE", retryAfter: 30 }`
- **Workshop miễn phí:** Không bị ảnh hưởng, vẫn đăng ký bình thường

### PENDING registration timeout (thanh toán không hoàn tất)
- **Trigger:** Sinh viên bỏ dở thanh toán VNPAY, không callback về
- **Xử lý:** Cron job chạy mỗi 5 phút:
  ```
  SELECT * FROM registrations
  WHERE status = PENDING AND createdAt < NOW() - INTERVAL '30 minutes'
  ```
  → Cancel registration + giảm `currentRegistrations` + trả ghế vào Redis counter
- **UI:** Sinh viên quay lại thấy "Đăng ký đã hết hạn"

---

## Ràng buộc

| Ràng buộc | Giá trị |
|---|---|
| Không oversell | Optimistic Lock + DB CHECK constraint |
| Không trùng | UNIQUE(userId, workshopId) |
| API response time | P95 < 500ms khi load bình thường |
| Idempotency TTL | 24 giờ |
| PENDING timeout | 30 phút |
| Seat counter | Redis DECR atomic (100k ops/sec) |
| Cron cleanup | Mỗi 5 phút |

---

## Tiêu chí chấp nhận

- [ ] Đăng ký workshop miễn phí → nhận QR code ngay (< 500ms)
- [ ] Đăng ký workshop có phí → redirect VNPAY đúng
- [ ] Concurrent test: 100 request đồng thời cho workshop 60 chỗ → chính xác 60 registrations được tạo
- [ ] Không thể đăng ký workshop đã đăng ký (409)
- [ ] Retry cùng idempotencyKey → cùng response, không tạo thêm record
- [ ] Rate limit > 10 request burst → 429
- [ ] VNPAY down → workshop miễn phí vẫn đăng ký được
- [ ] PENDING > 30 phút → tự động cancel + ghế được trả lại
- [ ] SSE: số ghế cập nhật real-time khi có người đăng ký
