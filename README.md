# Mie Hair Performance - Stylist Performance Calendar

## ⚠️ LƯU Ý QUAN TRỌNG: Thiết lập cơ sở dữ liệu
Để ứng dụng hoạt động chính xác, bạn **BẮT BUỘC** phải thiết lập schema cơ sở dữ liệu và các hàm/trigger liên quan trong Supabase.

### 🚀 Hướng dẫn thiết lập nhanh:
1.  **Tạo Project Supabase**: Truy cập [supabase.com](https://supabase.com/). Lưu lại **Project URL** và **anon key**.
2.  **Chạy Script SQL**:
    *   Mở Supabase SQL Editor.
    *   **Sao chép toàn bộ nội dung từ tệp `SQL_Setup.sql`** trong dự án này.
    *   Dán vào SQL Editor và chạy. Script này sẽ tạo tất cả các bảng, vai trò, hàm và trigger cần thiết.
    *   **Quan trọng**: Sau khi chạy script, bạn cần thiết lập một **cron job trong Supabase** (ví dụ: sử dụng `pg_cron`) để chạy hàm `public.auto_end_long_shifts()` định kỳ. Ví dụ: `SELECT cron.schedule('auto-end-long-shifts', '*/5 * * * *', 'SELECT public.auto_end_long_shifts();');` sẽ chạy mỗi 5 phút.
3.  **Cấu hình Storage**:
    *   Tạo 2 bucket ở chế độ **Public**:
        1.  `avatars`
        2.  `daily_attachments`
    *   Đừng quên thiết lập RLS Policy cho Storage để cho phép người dùng upload file vào thư mục của chính họ.

---

## 🛠️ Chi tiết các thành phần Schema (Đã gộp vào `SQL_Setup.sql`)

Các script dưới đây đã được tổng hợp lại thành một tệp duy nhất là `SQL_Setup.sql`. Bạn không cần chạy riêng lẻ từng script này nữa.

**Script 1: Roles và Hàm kiểm tra Admin**
```sql
-- Đã gộp vào SQL_Setup.sql
```

**Script 2: Bảng Profiles**
```sql
-- Đã gộp vào SQL_Setup.sql
```

**Script 3: Bảng Chấm công và Ghi chú**
(Tham khảo các script đã cung cấp trước đó cho `time_entries` và `daily_notes`. Nếu bạn chưa có, hãy tạo chúng và thêm vào `SQL_Setup.sql` ở vị trí thích hợp.)

**Script 4: Bảng cài đặt ứng dụng**
```sql
-- Đã gộp vào SQL_Setup.sql
```

**Script 5: Hàm tự động ngắt ca**
```sql
-- Đã gộp vào SQL_Setup.sql
```