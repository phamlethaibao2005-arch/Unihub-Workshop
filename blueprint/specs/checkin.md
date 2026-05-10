# Đặc tả: Check-in Offline

## Mô tả

Nhân sự (`CHECKIN_STAFF`) dùng **PWA** quét mã QR sinh viên tại cửa phòng. App hoạt động **offline-first**: verify QR và ghi nhận check-in ngay cả khi mất mạng hoàn toàn, không mất dữ liệu, tự đồng bộ khi mạng phục hồi.

Triển khai trong `modules/checkin/` — `CheckinService`, `QRVerifier`, `OfflineSyncService`, `ScanQRCommand`.

---

## Luồng chính

### Phase 1 — Preload (trước sự kiện, bắt buộc có mạng)

```
1. Staff mở PWA, đăng nhập (role CHECKIN_STAFF)
2. GET /api/checkins/preload?date=today
3. Server trả:
   {
     workshops: [{ id, title, room, startTime, endTime }],
     tickets: [{
       registrationId, workshopId,
       studentName, studentId,
       qrCode, status: "CONFIRMED",
       checkedIn: false
     }],
     hmacKey: "<32-byte-hex>"   ← Key để verify QR offline
   }
4. PWA lưu IndexedDB:
   Store "workshops"         ← danh sách workshops hôm nay
   Store "tickets"           ← index by registrationId
   Store "pendingCheckins"   ← ban đầu trống
   Store "config"            ← { hmacKey, preloadedAt }
5. Service Worker cache: HTML, JS, CSS, icons (app shell)
6. Hiển thị: "✅ Đã tải dữ liệu. App sẵn sàng hoạt động offline."
```

### Phase 2 — Check-in Online

```
1. Staff chọn workshop đang diễn ra
2. Bấm "Scan" → camera mở
3. Scan QR → decode payload JSON:
   { registrationId, workshopId, studentId, signature }
4. POST /api/checkins { registrationId, workshopId }
5. Server — CheckinService.checkIn():
   a. QRVerifier.verify(qrCode, signature) → boolean
   b. RegistrationRepository.findById(registrationId):
      → Không tồn tại hoặc status ≠ CONFIRMED → 422
   c. Verify workshopId khớp với registration.workshopId → 422
   d. CheckinRepository.findByRegistrationId():
      → Đã tồn tại → 409 { error: "ALREADY_CHECKED_IN", studentName }
   e. ScanQRCommand.execute():
      INSERT Checkin { registrationId, checkedInBy, checkedInAt: now(), syncStatus: SYNCED }
6. Response 201: { success: true, studentName, checkedInAt }
7. PWA: hiển thị ✅ tên sinh viên
8. Update IndexedDB ticket.checkedIn = true (sync local cache)
```

### Phase 3 — Check-in Offline

```
1. PWA detect: navigator.onLine === false HOẶC fetch timeout
2. Banner: "📴 Đang offline — Check-in sẽ được đồng bộ sau"
3. Staff scan QR → decode payload
4. QRVerifier.verify() [offline — dùng hmacKey từ IndexedDB]:
   expected = HMAC-SHA256(qrCode, cachedHmacKey)
   timingSafeEqual(signature, expected)
   → Sai → "❌ QR không hợp lệ (chữ ký sai)"
5. Lookup IndexedDB "tickets" by registrationId:
   → Không tìm thấy → "❌ Vé không thuộc danh sách workshop hôm nay"
   → ticket.status ≠ CONFIRMED → "❌ Vé chưa được xác nhận"
   → ticket.workshopId ≠ selectedWorkshopId → "❌ Vé không thuộc workshop này"
   → ticket.checkedIn === true → "⚠️ Sinh viên đã check-in rồi"
6. Nếu hợp lệ:
   INSERT IndexedDB "pendingCheckins":
   { registrationId, workshopId, checkedInAt: new Date().toISOString(),
     deviceId: hash(navigator.userAgent), syncStatus: "PENDING_SYNC" }
   UPDATE IndexedDB "tickets": ticket.checkedIn = true
   Hiển thị: "✅ Check-in thành công (chờ đồng bộ)" + tên sinh viên
7. Counter badge: "🔄 5 check-in đang chờ đồng bộ"
```

### Phase 4 — Sync khi mạng phục hồi

```
1. Service Worker 'online' event HOẶC user bấm "Đồng bộ ngay"
2. OfflineSyncService.syncPendingCheckins():
   a. Đọc tất cả IndexedDB pendingCheckins có syncStatus = PENDING_SYNC
   b. POST /api/checkins/sync:
      { checkins: [{ registrationId, workshopId, checkedInAt, deviceId }] }
3. Server xử lý PER RECORD (không dùng single transaction cho cả batch):
   For each:
     - QRVerifier.verify() lại phía server
     - Check registration tồn tại + CONFIRMED
     - INSERT Checkin (idempotent): nếu registrationId đã có → skip
     → status: "synced" | "duplicate" | "invalid"
4. Response:
   { results: [{ registrationId, status }], synced: 8, duplicate: 1, failed: 0 }
5. PWA update IndexedDB:
   "synced"    → xóa khỏi pendingCheckins (hoặc syncStatus = SYNCED)
   "duplicate" → xóa (ai đó check-in trước, OK)
   "invalid"   → mark ERROR, hiển thị list để staff review
6. Toast: "Đã đồng bộ 8/9. 1 bị bỏ qua (đã check-in trước đó)."
```

---

## Kịch bản lỗi

### QR không hợp lệ / QR giả mạo
- **Online:** Server QRVerifier verify HMAC → fail → 422
- **Offline:** Client QRVerifier verify HMAC với cached key → fail → từ chối ngay
- HMAC key phía client là **hmacPublicKey** (chỉ để verify, không tạo QR mới được)

### Sinh viên quét sai workshop
- `ticket.workshopId ≠ selectedWorkshopId` → "❌ Vé không thuộc workshop này"
- Cả online lẫn offline đều check

### 2 thiết bị offline check-in cùng 1 sinh viên
- Cả 2 ghi vào IndexedDB local (mỗi device)
- Khi sync: server nhận record đầu tiên → INSERT. Record sau → `registrationId` đã tồn tại → skip, trả "duplicate"
- **First-write-wins.** Không mất dữ liệu, không trùng.

### Sync thất bại giữa chừng (mạng mất lại)
- Server xử lý per-record, không batch transaction
- Records đã xử lý: không bị rollback
- Records chưa gửi: vẫn PENDING_SYNC trong IndexedDB
- Service Worker retry sau 30s → 60s → 120s (exponential backoff)
- **Zero data loss:** IndexedDB persist qua restart thiết bị

### App bị đóng khi có pending checkins
- IndexedDB là **persistent storage** — survive app close, device restart
- Khi mở lại: đọc pendingCheckins → hiển thị "Có N check-in chờ đồng bộ" → auto-sync

### Preload chưa được thực hiện (staff quên preload)
- Staff scan QR → lookup IndexedDB "tickets" → empty
- Hiển thị: "⚠️ Chưa preload dữ liệu. Kết nối mạng để preload trước khi vào offline mode."
- Fallback online-only: vẫn gọi API bình thường nếu có mạng

---

## Ràng buộc

| Ràng buộc | Giá trị |
|---|---|
| Zero data loss | IndexedDB persistent, retry vô hạn |
| Offline latency | Scan → kết quả < 200ms (chỉ IndexedDB + HMAC) |
| Online latency | Scan → kết quả < 1 giây |
| Idempotency | registrationId = natural key, server skip duplicate |
| Clock tolerance | Device clock lệch ≤ 5 phút so với server → accept (log warning) |
| HMAC Key | Rotate hàng ngày, sync qua preload API |
| Sync retry | Exponential backoff: 30s → 60s → 120s → max 5 phút |

---

## Tiêu chí chấp nhận

- [ ] Online check-in: scan → kết quả < 1 giây
- [ ] Offline check-in: scan → kết quả < 200ms (không cần mạng)
- [ ] Offline banner hiển thị khi mất mạng
- [ ] Counter hiển thị số check-in đang chờ sync
- [ ] Auto-sync khi mạng phục hồi (không cần thao tác)
- [ ] Manual sync: nút "Đồng bộ ngay" hoạt động
- [ ] Duplicate check-in (cùng QR, 2 lần scan): bị từ chối lần 2
- [ ] 2 thiết bị offline scan cùng QR: chỉ 1 check-in được ghi nhận
- [ ] Đóng app → mở lại → pending checkins vẫn còn
- [ ] QR giả mạo (sai HMAC): bị từ chối cả online lẫn offline
- [ ] Sync summary hiển thị (synced / duplicate / failed)
