# Đặc tả: Đồng Bộ Dữ Liệu Sinh Viên (CSV Import)

## Mô tả

Hệ thống sinh viên cũ không có API — chỉ export CSV hàng đêm. UniHub Workshop đọc file này qua **Vercel Cron Job** lúc 2:00 AM để upsert dữ liệu sinh viên. Import chạy hoàn toàn background, không ảnh hưởng hệ thống đang chạy.

Triển khai trong `modules/csv-import/` — `StudentCSVImportJob` (kế thừa `BaseImportJob` theo Template Method).

---

## Luồng chính

### Import tự động (Cron Job)

```
1. Cron Job (vercel.json, 2:00 AM hàng ngày):
   GET /api/admin/csv-import/trigger (internal, chỉ Vercel gọi được)

2. Scan thư mục data/csv-import/incoming/ tìm file .csv mới
   → Không có file → log info "No new files", exit

3. Với mỗi file tìm thấy:
   a. Move file: incoming/ → processing/
   b. Enqueue job Kafka "csv-import-queue":
      { filename, filepath, triggeredBy: "cron" }

4. StudentCSVImportJob.run(filename):  [BaseImportJob Template Method]
   a. readRows(): stream từng dòng (không load cả file vào RAM)
      - csv-parser (streaming) với BOM handling (UTF-8)
      - Validate header row: phải có [student_id, name, email]
        → Thiếu cột → throw InvalidHeaderError → FAILED, dừng
   b. validateRow(row):
      - student_id: /^\d{8}$/ → invalid → skip row, log
      - email: valid format → invalid → skip row, log
      - name: not empty → invalid → skip row, log
   c. processRow(validRow):
      - Prisma upsert theo batch 100 rows:
        INSERT INTO users (studentId, name, email, role)
        VALUES (...)
        ON CONFLICT (studentId) DO UPDATE SET
          name = EXCLUDED.name, email = EXCLUDED.email,
          updatedAt = now()
      - Success → successCount++
      - Conflict (đã tồn tại) → duplicateCount++
      - Error → errorCount++, log chi tiết
   d. Sau khi xử lý xong:
      - Move file: processing/ → processed/{date}_{filename}
      - INSERT CsvImportLog { filename, totalRows, successCount,
          errorCount, duplicateCount, errorDetails, status }
      - status = "SUCCESS" nếu errorCount = 0
              = "PARTIAL" nếu errorCount > 0 nhưng successCount > 0
              = "FAILED"  nếu không import được dòng nào

5. Log kết quả lên console + database
```

### Import thủ công (Admin Dashboard)

```
1. Organizer vào /admin/csv-import
2. Upload file CSV HOẶC bấm "Import Now" (lấy file trong incoming/)
3. POST /api/admin/csv-import
4. Server enqueue job → response ngay: { jobId, status: "queued" }
5. Admin polling: GET /api/admin/csv-import/:jobId/status
6. Khi xong: hiển thị kết quả (total / success / error / duplicate)
```

---

## Kịch bản lỗi

### File CSV rỗng (0 data rows)
- Validate: row count = 0 → `status = FAILED`
- Log: "Empty file, nothing imported"
- Không crash, không ảnh hưởng hệ thống

### File CSV thiếu cột header bắt buộc
- `readRows()` check header row đầu tiên
- Missing any of `[student_id, name, email]` → throw `InvalidHeaderError`
- Import dừng hoàn toàn, `status = FAILED`
- Log: "Missing required columns: [faculty]"

### Row giữa file bị lỗi dữ liệu
- `validateRow()` throw `ValidationError` → catch trong `BaseImportJob.run()`
- Skip row đó, `errorCount++`, log chi tiết `{ row: 247, error: "Invalid email", data: "..." }`
- **Tiếp tục** xử lý các row sau
- Cuối cùng: `status = PARTIAL` nếu vẫn có rows thành công

### Encoding sai (không phải UTF-8)
- csv-parser cố UTF-8 → nếu có ký tự lạ → fallback latin1
- Nếu cả 2 fail → log + `status = FAILED`
- File BOM (UTF-8 with BOM): xử lý tự động

### File CSV quá lớn (> 100MB, > 100.000 rows)
- `readRows()` dùng streaming — không load vào RAM
- Batch upsert 100 rows/lần — không tạo transaction quá lớn
- Cron timeout Vercel: 300s. Ước tính 100.000 rows × 10ms = ~1000s → cần chunk nhiều file

### 2 import chạy đồng thời
- Kafka queue concurrency = 1 cho "csv-import-queue"
- Job mới đợi trong queue, không chạy song song
- Tránh race condition khi upsert cùng student_id

### File không tồn tại khi worker xử lý (đã bị xóa thủ công)
- `readRows()` → FileNotFoundError → catch → `status = FAILED`
- Log warning, move file log record sang FAILED

---

## Ràng buộc

| Ràng buộc | Giá trị |
|---|---|
| Concurrency | 1 import tại 1 thời điểm (queue size = 1 worker) |
| Batch size | 100 rows/upsert |
| Encoding | UTF-8 (hỗ trợ BOM), fallback latin1 |
| Schedule | 2:00 AM hàng ngày (configurable qua vercel.json) |
| Error tolerance | Skip bad rows, tiếp tục import |
| Audit | Mỗi import có CsvImportLog với chi tiết lỗi |
| No downtime | Chạy background, không ảnh hưởng user-facing routes |
| Memory | Stream CSV, không load toàn bộ vào RAM |

---

## Tiêu chí chấp nhận

- [ ] Cron tự chạy lúc 2:00 AM, import file mới trong incoming/
- [ ] Không có file mới → log info, không lỗi
- [ ] CSV hợp lệ → sinh viên được upsert, có thể đăng ký workshop ngay
- [ ] student_id trùng → update thông tin, duplicateCount++
- [ ] Row lỗi → skip + log, tiếp tục import rows còn lại
- [ ] Header thiếu → dừng toàn bộ, status = FAILED
- [ ] File rỗng → status = FAILED, không crash
- [ ] 2 imports đồng thời → queued, chạy tuần tự
- [ ] Admin dashboard hiển thị lịch sử import (success / error / duplicate counts)
- [ ] Manual import từ dashboard hoạt động
