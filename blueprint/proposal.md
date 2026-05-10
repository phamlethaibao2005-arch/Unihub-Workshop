# UniHub Workshop — Project Proposal

---

## 1. Vấn đề

### Bối cảnh hiện tại

Trường Đại học A tổ chức "Tuần lễ kỹ năng và nghề nghiệp" hàng năm — sự kiện kéo dài 5 ngày với 8–12 workshop diễn ra song song mỗi ngày tại nhiều phòng khác nhau. Quy mô tổng cộng lên đến hàng chục workshop và hàng nghìn lượt đăng ký mỗi năm.

Hiện tại, toàn bộ quy trình được thực hiện thủ công:
- Sinh viên đăng ký qua **Google Form** — không có xác thực danh tính, không giới hạn số chỗ tự động.
- Ban tổ chức **thông báo xác nhận qua email thủ công** — mỗi workshop phải gửi từng email riêng lẻ.
- Check-in tại cửa phòng bằng **danh sách giấy in** — nhân sự phải tra tên thủ công.
- Không có công cụ theo dõi thống kê đăng ký theo thời gian thực.

### Hậu quả cụ thể

| Vấn đề | Hậu quả |
|---|---|
| Google Form không giới hạn capacity | Một workshop 60 chỗ nhận hàng trăm đăng ký — ban tổ chức phải lọc tay |
| Không xác thực sinh viên | Người ngoài trường có thể đăng ký, chiếm chỗ của sinh viên |
| Email thông báo thủ công | Khi đổi phòng / huỷ workshop → gửi email sai người, sót người |
| Check-in bằng giấy | Hàng dài chờ đợi tại cửa, dễ gian lận, mất danh sách khi ướt/rách |
| Không có thanh toán tích hợp | Workshop có phí phải thu tiền mặt tại chỗ — không kiểm soát được |
| Không có tóm tắt nội dung | Sinh viên không biết workshop nói về gì trước khi đăng ký |

### Tại sao Google Form không còn đủ

Google Form được thiết kế cho khảo sát, không phải quản lý sự kiện. Nó thiếu hoàn toàn: giới hạn số chỗ real-time, xác thực danh tính sinh viên, tích hợp thanh toán, thông báo tự động, và check-in kỹ thuật số. Khi quy mô tăng lên 12.000 sinh viên truy cập đồng thời, Google Form không có bất kỳ cơ chế bảo vệ nào chống quá tải.

---

## 2. Mục tiêu

### Mục tiêu nghiệp vụ

- **Số hóa toàn bộ quy trình** từ đăng ký → xác nhận → thanh toán → check-in, loại bỏ hoàn toàn thao tác thủ công lặp đi lặp lại.
- **Đảm bảo công bằng:** Không ai lấy được chỗ của người khác. Không ai bị gửi thông báo sai.
- **Tăng trải nghiệm sinh viên:** Đăng ký trong vài giây, nhận QR ngay, check-in nhanh dưới 3 giây.

### Mục tiêu kỹ thuật (định lượng)

| Chỉ tiêu | Giá trị mục tiêu |
|---|---|
| Số sinh viên hỗ trợ đồng thời | 12.000 trong 10 phút đầu |
| Không oversell chỗ ngồi | 0 trường hợp bán trùng trong mọi điều kiện |
| Thời gian phản hồi đăng ký (P95) | < 500ms trong điều kiện bình thường |
| Check-in offline | Hoạt động 100% khi mất mạng, 0% mất dữ liệu |
| Tự động sync sau khi có mạng | < 30 giây sau khi kết nối phục hồi |
| Uptime tính năng không thanh toán | 100% kể cả khi cổng thanh toán sập |
| Thời gian tạo AI Summary | 10–60 giây sau khi upload PDF |

---

## 3. Người dùng và Nhu cầu

### Sinh viên (~12.000 người)

**Họ cần:** Xem lịch workshop nhanh, đăng ký không rắc rối, biết mình đã đăng ký thành công, và check-in vào nhanh nhất có thể.

**Điều quan trọng nhất:** Không mất chỗ vì lỗi hệ thống. Nhận xác nhận và QR ngay lập tức. Không phải xếp hàng dài ở cửa.

**Đặc điểm:** Truy cập chủ yếu qua điện thoại, nhiều người đăng ký cùng lúc ngay khi mở đăng ký.

### Ban tổ chức — Organizer (~5–10 người)

**Họ cần:** Tạo workshop nhanh, cập nhật thông tin kịp thời khi có thay đổi (đổi phòng, đổi giờ), theo dõi số lượng đăng ký real-time, không phải xử lý email thủ công.

**Điều quan trọng nhất:** Hệ thống phải tự động hóa tối đa. Khi có sự cố (huỷ workshop), thông báo phải đến tay sinh viên ngay lập tức và đúng người.

### Nhân sự check-in (~10–20 người/ngày)

**Họ cần:** Quét QR nhanh, không phụ thuộc mạng internet, không cần training phức tạp.

**Điều quan trọng nhất:** App phải hoạt động khi mạng trong trường không ổn định. Không mất dữ liệu check-in khi mạng mất đột ngột.

---

## 4. Phạm vi

### Thuộc phạm vi đồ án này

- Xem danh sách và chi tiết workshop (public, không cần đăng nhập).
- Đăng ký workshop miễn phí và có phí (VNPAY sandbox).
- Thông báo tự động qua Email và In-App (đăng ký thành công, workshop huỷ/cập nhật).
- Quản trị workshop: tạo, sửa, huỷ, upload PDF để tạo AI Summary.
- Check-in bằng QR: hoạt động online và offline, tự đồng bộ khi có mạng.
- AI Summary: upload PDF → Gemini tự động tạo tóm tắt hiển thị trên trang workshop.
- Đồng bộ dữ liệu sinh viên từ CSV (Vercel Cron hàng đêm + trigger thủ công).
- Phân quyền RBAC: STUDENT, ORGANIZER, CHECKIN_STAFF.
- Cơ chế bảo vệ: Rate Limiting, Circuit Breaker, Idempotency Key.

### Không thuộc phạm vi đồ án này

- **Payment gateway thật:** Dùng VNPAY sandbox (test mode), không xử lý tiền thật.
- **Hạ tầng production thật:** Deploy trên Vercel free/hobby tier, không cấu hình hạ tầng enterprise.
- **Mobile app native** (iOS/Android): Chỉ PWA (Progressive Web App) qua trình duyệt.
- **Multi-tenant:** Hệ thống phục vụ đúng 1 trường, không hỗ trợ nhiều tổ chức.
- **Hoàn tiền tự động:** Khi workshop bị huỷ, hoàn tiền được thực hiện thủ công ngoài hệ thống.
- **Analytics nâng cao:** Không có dashboard BI, chỉ thống kê cơ bản (số đăng ký, số check-in).
- **SSO với hệ thống trường:** Đăng nhập bằng email/password, không tích hợp LDAP hay SSO.
- **Push notification (mobile):** Chỉ có email và in-app notification, không có push notification qua FCM/APNs.
- **OCR cho PDF scan:** AI Summary chỉ hoạt động với PDF có text layer, không hỗ trợ file scan ảnh.

---

## 5. Rủi ro và Ràng buộc

### Rủi ro kỹ thuật đã biết trước

**Rủi ro 1 — Tranh chấp chỗ ngồi (Race Condition)**
- **Mô tả:** Một số workshop chỉ có 60 chỗ nhưng hàng trăm sinh viên cố đăng ký cùng lúc ngay khi mở. Nếu dùng check-and-set thông thường trong DB, hai request có thể đọc cùng một giá trị `currentRegistrations = 59` và cả hai đều tưởng mình lấy được chỗ cuối.
- **Giải pháp:** Redis `DECR` atomic trên seat counter — đảm bảo chỉ 1 trong N concurrent requests nhận kết quả `>= 0`. Xem `specs/registration.md`.

**Rủi ro 2 — Tải đột biến**
- **Mô tả:** Dự kiến ~12.000 sinh viên truy cập trong 10 phút đầu khi mở đăng ký, 60% trong 3 phút đầu. Backend API nếu không có bảo vệ sẽ bị quá tải, DB sẽ bị bão connection.
- **Giải pháp:** Token Bucket Rate Limiting tại Vercel Edge (Upstash Ratelimit), ISR Cache cho trang danh sách workshop, Neon connection pooler chặn connection flood. Xem `design.md` mục 6.1.

**Rủi ro 3 — Cổng thanh toán không ổn định**
- **Mô tả:** VNPAY có thể timeout hoặc down trong giờ cao điểm. Nếu không có cơ chế bảo vệ, toàn bộ hệ thống sẽ bị kéo sập theo (cascade failure) do các request treo chờ timeout.
- **Giải pháp:** Circuit Breaker (`PaymentGatewayCircuitBreaker`) ngắt mạch sau 5 lỗi liên tiếp, trả lỗi ngay thay vì chờ timeout. Các tính năng không liên quan (xem workshop, check-in, đăng ký miễn phí) vẫn hoạt động bình thường. Xem `specs/payment.md`.

**Rủi ro 4 — Trừ tiền hai lần**
- **Mô tả:** Network timeout khiến client retry, VNPAY nhận 2 request cho cùng giao dịch, trừ tiền 2 lần.
- **Giải pháp:** Idempotency Key (client-generated UUID) + `IdempotencyRecord` table trong PostgreSQL. VNPAY `txnRef` UNIQUE constraint là lớp bảo vệ thứ hai. Xem `specs/payment.md`.

**Rủi ro 5 — Check-in offline mất dữ liệu**
- **Mô tả:** Khu vực trong trường có mạng không ổn định. Nhân sự check-in có thể mất kết nối bất kỳ lúc nào. Dữ liệu không được mất.
- **Giải pháp:** PWA lưu check-in vào IndexedDB (persistent, không mất khi đóng app/restart thiết bị). QR verify bằng HMAC offline (không cần gọi server). Tự động sync khi mạng phục hồi. Xem `specs/checkin.md`.

**Rủi ro 6 — Tích hợp một chiều với hệ thống cũ**
- **Mô tả:** Hệ thống quản lý sinh viên của trường không có API, chỉ export CSV hàng đêm. Không thể gọi ngược lại để xác thực sinh viên real-time.
- **Giải pháp:** Vercel Cron chạy lúc 2AM, stream parse CSV, upsert vào DB. Import lỗi một phần vẫn tiếp tục (skip bad rows). Log chi tiết từng lỗi. Xem `specs/csv-import.md`.

### Ràng buộc kỹ thuật

- **Serverless-first:** Toàn bộ backend chạy trên Vercel Serverless Functions — stateless, không giữ persistent connection, timeout tối đa 60s. Không dùng công nghệ cần giữ long-running process (BullMQ, WebSocket thuần).
- **TypeScript end-to-end:** Frontend, Backend, Workers đều dùng TypeScript để đảm bảo type-safety và tránh lỗi runtime.
- **Không có server riêng:** Không dùng VPS, Docker, hay Kubernetes. Tất cả managed services (Vercel, Neon, Upstash).
- **Budget-aware:** Dùng free tier / hobby plan của các dịch vụ: Vercel (hobby), Neon (free), Upstash (free tier 10k requests/ngày), Resend (100 emails/ngày free).