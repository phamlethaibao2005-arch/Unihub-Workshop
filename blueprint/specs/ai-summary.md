# Đặc tả: AI Summary

## Mô tả

Ban tổ chức upload file PDF giới thiệu workshop. Hệ thống tự động xử lý qua **Pipe-and-Filter pipeline** (PDFDownload → TextExtract → Gemini Summarize), chạy **async** ở background — organizer nhận phản hồi ngay, summary xuất hiện sau vài chục giây.

Triển khai trong `modules/workshop/` — `AISummaryService`, `AISummaryPipeline` (với 3 filter).

---

## Luồng chính

### Upload PDF và trigger pipeline

```
1. Organizer vào trang edit workshop
2. Chọn file PDF (max 10MB, chỉ .pdf)
3. POST /api/admin/workshops/:id/upload-pdf (multipart/form-data)
4. Server:
   a. Validate: file type === application/pdf, size ≤ 10MB
   b. Upload file lên Vercel Blob / S3 → nhận pdfUrl
   c. DB Transaction:
      UPDATE Workshop SET pdfUrl = :pdfUrl, aiSummaryStatus = PROCESSING
   d. Enqueue job via QStash → POST /api/queue/ai-summary:
      { workshopId, pdfUrl }
   e. Response 202: { status: "processing" }  ← trả về ngay, không chờ AI

5. Client cập nhật UI:
   aiSummaryStatus = PROCESSING → hiển thị skeleton "Đang tạo tóm tắt..."
```

### AISummaryPipeline xử lý background

```
AISummaryWorker nhận job → AISummaryService.processPDF(workshopId, pdfUrl):

Filter 1 — PDFDownloadFilter:
  fetch(pdfUrl) → Buffer
  → Thất bại: throw PDFDownloadError

Filter 2 — PDFExtractFilter:
  pdf-parse(buffer) → rawText
  → rawText.trim() === "" → throw PDFEmptyError (scanned image PDF)
  → Làm sạch: remove repeated headers/footers, normalize whitespace
  → Truncate: lấy 4000 token đầu nếu quá dài

Filter 3 — GeminiSummarizeFilter:
  gemini-2.5-flash.generateContent({
    systemPrompt: "Tóm tắt nội dung workshop sau bằng tiếng Việt, 
                   2-3 đoạn ngắn, tập trung vào mục tiêu và nội dung chính.",
    userPrompt: cleanedText
  })
  → Trả summary string

Kết thúc pipeline:
  UPDATE Workshop SET aiSummary = summary, aiSummaryStatus = COMPLETED
```

### Hiển thị trên trang chi tiết workshop

```
aiSummaryStatus:
  NONE        → không hiển thị section AI Summary
  PROCESSING  → skeleton loader "Đang tạo tóm tắt..." (polling mỗi 10 giây)
  COMPLETED   → hiển thị summary text
  FAILED      → "Không thể tạo tóm tắt tự động. Organizer có thể nhập tay."
```

---

## Kịch bản lỗi

### PDF không extract được text (ảnh scan)
- `PDFExtractFilter` trả empty text
- Throw `PDFEmptyError` → `aiSummaryStatus = FAILED`
- Message: "Không thể đọc nội dung PDF. Vui lòng upload PDF có text (không phải ảnh scan)."

### Gemini API timeout / error
- QStash retry: 3 lần với delay 60s → 120s → 240s (cấu hình qua `retries` và `delay` trong publishJSON)
- Sau 3 lần → `aiSummaryStatus = FAILED`
- Organizer có thể: re-upload PDF để trigger lại, hoặc nhập summary thủ công

### PDF text quá dài (vượt token limit)
- `PDFExtractFilter` truncate về 4000 tokens trước khi gửi Gemini
- Trade-off: summary có thể thiếu nội dung cuối. Chấp nhận được vì workshop PDF thường ngắn (2-5 trang).
- Log warning nếu text bị truncate

### Re-upload PDF (organizer muốn cập nhật)
- Cho phép upload lại bất kỳ lúc nào
- Cùng flow: pdfUrl mới → aiSummaryStatus = PROCESSING → pipeline chạy lại
- Summary cũ bị override khi có summary mới

### File không phải PDF / quá lớn
- Validate ngay tại server trước khi upload:
  - `file.type !== 'application/pdf'` → 400 "Chỉ chấp nhận file PDF"
  - `file.size > 10MB` → 400 "File không được vượt quá 10MB"
- Không enqueue job, không lưu file

---

## Ràng buộc

| Ràng buộc | Giá trị |
|---|---|
| Async (không block) | Upload → 202, pipeline chạy background |
| File size | Max 10MB |
| File type | PDF only |
| AI model | Gemini 2.5 Flash (Google AI API) |
| Summary language | Tiếng Việt |
| Token limit | 4000 tokens input, truncate nếu vượt |
| Retry | 3 lần, 60s / 120s / 240s |
| Pipeline | Pipe-and-Filter: mỗi filter độc lập, thêm bước không sửa bước khác |

---

## Tiêu chí chấp nhận

- [ ] Upload PDF → status chuyển PROCESSING ngay lập tức
- [ ] Summary xuất hiện trên trang chi tiết trong vòng 30-90 giây
- [ ] PDF ảnh scan → status FAILED + thông báo rõ nguyên nhân
- [ ] File không phải PDF → reject ngay (400), không upload
- [ ] File > 10MB → reject ngay (400)
- [ ] Gemini API down → retry 3 lần → FAILED nếu không thành công
- [ ] Re-upload PDF → summary mới ghi đè summary cũ
- [ ] Organizer có thể nhập summary thủ công khi status = FAILED
