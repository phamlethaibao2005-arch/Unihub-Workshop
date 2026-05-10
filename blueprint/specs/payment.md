# Đặc tả: Luồng Thanh Toán

## Mô tả

Xử lý thanh toán workshop có phí qua **VNPAY**. Ba đảm bảo cốt lõi:
1. **Exactly-once processing** — không trừ tiền hai lần dù callback đến nhiều lần
2. **Graceful Degradation** — VNPAY sập không kéo sập toàn bộ hệ thống
3. **Consistency** — `payment.status` và `registration.status` luôn nhất quán trong cùng 1 transaction

Triển khai trong `modules/payment/` — `PaymentService`, `VNPayGateway`, `PaymentGatewayCircuitBreaker`, `IdempotencyService`.

---

## Luồng chính

### Tạo thanh toán (tiếp sau registration flow)

```
Input: registrationId đã được tạo (status = PENDING)

PaymentService.initiatePayment(registrationId, amount):
  1. CircuitBreaker.checkState():
     → OPEN → throw PaymentGatewayUnavailableError (không gọi VNPAY)
  2. IdempotencyService.checkAndStore(idempotencyKey, async () => ...):
     → Key tồn tại → trả paymentUrl cũ (client retry an toàn)
  3. VNPayGateway.createPaymentUrl({
       amount,
       orderId: registrationId,      ← vnp_TxnRef = payment.id (unique)
       description: "Thanh toan workshop",
       returnUrl: /workshops/{id}/payment-result,
       ipnUrl: /api/payments/vnpay-callback
     })
  4. CircuitBreaker.onSuccess() / onFailure()
  5. Lưu idempotency_record { key, response: { paymentUrl }, expiresAt: +24h }
  6. Trả paymentUrl → client redirect VNPAY
```

### Xử lý VNPAY IPN Callback

```
VNPAY gọi POST /api/payments/vnpay-callback (server-to-server, không qua browser)

PaymentService.handleCallback(params):
  1. VNPayGateway.verifySignature(params):
     expected = HMAC-SHA512(sortedParams, vnpaySecretKey)
     compare(params.vnp_SecureHash, expected)
     → Sai → log security warning, trả RspCode=97

  2. Lookup Payment WHERE vnpayTxnRef = params.vnp_TxnRef
     → Không tìm thấy → trả RspCode=01

  3. Idempotency check:
     payment.status === SUCCESS → trả RspCode=02 (đã xử lý, OK với VNPAY)
     → Dừng, không xử lý tiếp

  4. Validate amount:
     params.vnp_Amount / 100 !== payment.amount → log + trả RspCode=04

  5. Nếu params.vnp_ResponseCode === "00" (thành công):
     DB Transaction:
       UPDATE payments SET status=SUCCESS, paidAt=now(), vnpayTxnRef=...
       UPDATE registrations SET status=CONFIRMED
       Generate QRTicket (HMAC-SHA256 signature)
       UPDATE registrations SET qrCode, qrSignature
     COMMIT
     EventBus.publish(PaymentSucceededEvent)
     → [RegistrationService] confirm registration
     → [NotificationService] notify user (email + in-app), async
     Trả RspCode=00

  6. Nếu vnp_ResponseCode !== "00" (thất bại / cancel):
     UPDATE payments SET status=FAILED
     UPDATE registrations SET status=PAYMENT_FAILED
     Workshop.releaseOne() → SeatManager.releaseOne(workshopId) → Redis INCR
     EventBus.publish(PaymentFailedEvent)
     → [NotificationService] notify user
     Trả RspCode=00

  ! Luôn trả HTTP 200 cho VNPAY (họ retry nếu không nhận 200)
```

### Return URL (user quay về sau khi thanh toán)

```
VNPAY redirect user về: /workshops/{id}/payment-result?vnp_TxnRef=...

Client polling: GET /api/payments/{vnp_TxnRef}/status (mỗi 3 giây)
  → SUCCESS  → hiển thị "Thanh toán thành công!" + QR code
  → FAILED   → "Thanh toán thất bại" + nút "Thử lại"
  → PENDING  → "Đang xử lý..." + tiếp tục polling (tối đa 2 phút)
  → Timeout polling (2 phút) → "Trạng thái chưa xác nhận, kiểm tra email hoặc liên hệ BTC"
```

---

## Kịch bản lỗi

### VNPAY timeout khi tạo payment URL
- **Trigger:** VNPAY không response trong 10 giây
- **CircuitBreaker.onFailure():** failureCount++
- **Response client:** 503 "Không thể kết nối cổng thanh toán, thử lại sau"
- **Registration:** Giữ status PENDING, cleanup sau 30 phút (xem registration spec)

### VNPAY callback không đến (network issue)
- **Trigger:** User thanh toán xong nhưng IPN callback bị mất
- **VNPAY:** Tự retry IPN 3-5 lần theo schedule riêng
- **Reconciliation worker** (chạy mỗi 5 phút):
  ```
  SELECT * FROM payments WHERE status=PENDING AND createdAt < NOW() - 10m
  → Query VNPAY Transaction Query API để lấy trạng thái thực
  → Cập nhật payment.status theo kết quả từ VNPAY
  ```

### Duplicate callback (VNPAY retry)
- **Trigger:** VNPAY gọi IPN 2+ lần
- **Bước 3 trong flow callback:** `payment.status === SUCCESS` → trả `RspCode=02` ngay
- **Safety net:** `UNIQUE(vnpayTxnRef)` — nếu code bị skip, DB reject INSERT trùng

### Số tiền không khớp (possible tampering)
- **Trigger:** `params.vnp_Amount / 100 !== payment.amount`
- **Xử lý:** Reject RspCode=04, log security alert
- **Alert:** Notify ORGANIZER qua email (potential fraud)

### Circuit Breaker chuyển OPEN
- **Trigger:** 5 failures liên tiếp trong 60 giây
- **Hệ thống:**
  - `GET /api/system/status` → `{ payment: "degraded" }`
  - Frontend hiển thị banner "Thanh toán tạm thời không khả dụng"
  - Ẩn nút thanh toán, hiển thị thông báo
  - Workshop miễn phí, xem lịch, check-in → hoạt động bình thường
- **Recovery:**
  - Sau 30s → HALF_OPEN → 1 probe request
  - Thành công → CLOSED → thanh toán hoạt động lại
  - Thất bại → OPEN → reset timer

---

## Ràng buộc

| Ràng buộc | Giá trị |
|---|---|
| Exactly-once | Idempotency + UNIQUE(vnpayTxnRef) |
| Consistency | payment + registration cùng 1 DB transaction |
| VNPAY signature | HMAC-SHA512, verify mọi callback |
| Circuit Breaker threshold | 5 failures / 60s |
| Circuit Breaker recovery | 30s timeout → HALF_OPEN |
| PENDING cleanup | Cron mỗi 5 phút, timeout 30 phút |
| Callback response | Luôn HTTP 200 + RspCode theo VNPAY spec |

---

## Tiêu chí chấp nhận

- [ ] Thanh toán VNPAY sandbox thành công → nhận QR code qua email + in-app
- [ ] Duplicate IPN callback → chỉ xử lý 1 lần (payment.status = SUCCESS sau lần đầu)
- [ ] Amount mismatch → reject, log, không cập nhật trạng thái
- [ ] VNPAY timeout × 5 → Circuit Breaker OPEN, banner cảnh báo hiển thị
- [ ] Circuit Breaker tự CLOSED khi VNPAY phục hồi
- [ ] PENDING payment > 30 phút → cleanup, ghế được trả lại
- [ ] Workshop miễn phí vẫn đăng ký được khi payment down
- [ ] `GET /api/system/status` phản ánh đúng trạng thái Circuit Breaker
