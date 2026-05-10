# Đặc tả: Phân Quyền (Authentication & Authorization)

## Mô tả

Hệ thống dùng **RBAC (Role-Based Access Control)** với 3 role cố định: `STUDENT`, `ORGANIZER`, `CHECKIN_STAFF`. Authentication qua **Better-Auth** (session-based). Authorization được kiểm tra ở **3 lớp độc lập** theo thứ tự: Middleware → API Handler → Database Constraint.

Triển khai trong `modules/auth/` và `middleware.ts`.

---

## Luồng chính

### Đăng nhập

```
1. User truy cập /login
2. Nhập email + password
3. Better-Auth:
   a. Lookup Account (password provider)
   b. bcrypt.compare(inputPassword, hashedPassword)
   c. Tạo Session record trong PostgreSQL
   d. Set cookie: better-auth.session (httpOnly, secure, sameSite=lax)
4. Redirect theo role:
   STUDENT        → /workshops
   ORGANIZER      → /admin/dashboard
   CHECKIN_STAFF  → /scan
```

### Kiểm tra quyền mỗi request — 3 lớp

```
Lớp 1: proxy.ts (Vercel Edge — nhanh nhất, chặn sớm nhất)
─────────────────────────────────────────────────────────────
  1. Đọc cookie better-auth.session
  2. Lookup session: Redis cache trước (hit ~1ms), miss → PostgreSQL
  3. Public routes → pass through không cần session:
       GET /workshops, GET /api/workshops, /login, /api/auth/*
  4. Không có session → redirect /login
  5. Kiểm tra role theo route group:
       /admin/* | /api/admin/*        → require ORGANIZER
       /scan/*  | /api/checkins/*     → require CHECKIN_STAFF
       /api/registrations/* (POST)    → require STUDENT
  6. Sai role → 403 Forbidden

Lớp 2: API Route Handler (resource-level check)
─────────────────────────────────────────────────────────────
  - GET /api/registrations:
      STUDENT   → chỉ trả registrations của chính mình (filter by userId)
      ORGANIZER → trả tất cả
      Khác      → 403
  - GET /api/checkins/preload:
      Chỉ CHECKIN_STAFF (đã check ở middleware, confirm lại ở handler)
  - DELETE /api/workshops/:id:
      Chỉ ORGANIZER, và createdBy phải là userId (nếu muốn enforce ownership)

Lớp 3: Database Constraints (last line of defense)
─────────────────────────────────────────────────────────────
  - UNIQUE(userId, workshopId) ON registrations
      → Không đăng ký trùng dù bypass middleware
  - UNIQUE(vnpayTxnRef) ON payments
      → Không duplicate payment dù race condition
  - CHECK (current_registrations <= max_capacity) ON workshops
      → Không oversell dù mọi lớp trên đều bị bypass
```

---

## Kịch bản lỗi

### Session hết hạn (TTL 7 ngày)
- **Middleware** detect session expired (expiresAt < now())
- Xóa cookie → redirect `/login`
- PWA offline: vẫn hoạt động với cached data trong IndexedDB. Khi online lại → Better-Auth re-authenticate tự động (silent refresh nếu configure)

### Truy cập trái phép (STUDENT vào /admin)
- Middleware check: `/admin/*` require ORGANIZER, role=STUDENT → 403
- Server render trang lỗi "Bạn không có quyền truy cập"
- Log attempt (security audit)

### Direct API call bypass UI (POST /api/admin/workshops không qua browser)
- Lớp 1: Middleware check route `/api/admin/*` require ORGANIZER
- Lớp 2: Handler verify session.user.role === ORGANIZER
- Không qua được nếu không có session hợp lệ

### Cookie bị steal (CSRF attack)
- Better-Auth tích hợp CSRF protection (Double Submit Cookie hoặc Origin check)
- `sameSite=lax` ngăn cross-site request gửi cookie

---

## Ràng buộc

| Ràng buộc | Giá trị |
|---|---|
| Session storage | PostgreSQL (source of truth) + Redis (cache) |
| Cookie flags | `httpOnly=true`, `secure=true`, `sameSite=lax` |
| Password hashing | bcrypt, cost factor 10 (Better-Auth default) |
| Session TTL | 7 ngày |
| Mỗi user | Đúng 1 role (không multi-role) |
| CSRF | Better-Auth built-in |
| Rate limit /login | 5 attempts / 15 phút / IP (chống brute force) |

---

## Tiêu chí chấp nhận

- [ ] Đăng nhập thành công → redirect đúng trang theo role
- [ ] Đăng xuất → session bị xóa, cookie cleared
- [ ] STUDENT truy cập `/admin` → 403
- [ ] CHECKIN_STAFF truy cập `/admin` → 403
- [ ] ORGANIZER truy cập `/scan` → 403
- [ ] GET `/api/registrations` với STUDENT → chỉ trả registrations của mình
- [ ] Session expired → redirect `/login`
- [ ] Cookie có đủ `httpOnly`, `secure`, `sameSite`
- [ ] Brute force `/login` > 5 lần → 429
